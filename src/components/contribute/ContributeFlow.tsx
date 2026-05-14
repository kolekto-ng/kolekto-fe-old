import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, ArrowRight, Check, Loader2, CreditCard, User, Tag, Ticket, Heart,
  Phone, Info, ChevronLeft, ChevronRight, Trophy, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/formatters';
import { normalizeContributions } from '@/utils/contributions';

interface ContributeFlowProps {
  collection: any;
}

type Step = 'details' | 'contact' | 'summary';

type TicketTierSelection = {
  tierId: string | null;
  tierName: string;
  pricePerUnit: number;
  quantity: number;
  subtotal: number;
  description?: string;
  remainingCapacity?: number | null;
  prefix?: string | null;
};

const FUNDRAISING_PRESETS = [5000, 10000, 20000, 50000];
const MAX_TICKETS_PER_ORDER = 10;
const CONTRIBUTOR_FIELD_MAP_KEY = "__fieldValues";

function calcFees(amount: number, feeBearer: string, collectionType: string) {
  // Fundraising: fee is invisible to donor — backend embeds 2.5% in stored amount
  if (feeBearer !== 'contributor') return { gatewayFee: 0, platformFee: 0, total: amount };
  const gatewayFee = Math.min(amount * 0.015, 2000);
  const platformFee = Math.min(amount * (collectionType === 'fundraising' ? 0.01 : 0.005), 2000);
  return { gatewayFee, platformFee, total: amount + gatewayFee + platformFee };
}

function roundCurrency(value: number) {
  return Number((value || 0).toFixed(2));
}

function fmt(n: number) {
  return `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

function getFieldStorageKey(field: any) {
  return String(field?.id || field?.name || "").trim();
}

function getFieldValue(formData: Record<string, string>, field: any) {
  return formData[getFieldStorageKey(field)] || "";
}

function buildContributorFieldPayload(fields: any[], formData: Record<string, string>) {
  const namedValues: Record<string, string> = {};
  const mappedValues: Record<string, string> = {};

  fields.forEach((field) => {
    const storageKey = getFieldStorageKey(field);
    const displayName = String(field?.name || "").trim();

    if (!storageKey || displayName.toLowerCase() === "unique code") {
      return;
    }

    const value = formData[storageKey];
    if (value === undefined || value === null || value === "") {
      return;
    }

    mappedValues[storageKey] = value;

    if (displayName) {
      namedValues[displayName] = value;
    }
  });

  return Object.keys(mappedValues).length > 0
    ? {
        ...namedValues,
        [CONTRIBUTOR_FIELD_MAP_KEY]: mappedValues,
      }
    : namedValues;
}

// ── Image Slideshow (poster-sized) ────────────────────────────────────────────
const ImageSlideshow: React.FC<{ images: string[]; title: string }> = ({ images, title }) => {
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return (
    <div className="relative w-full bg-gray-950 rounded-t-xl overflow-hidden" style={{ aspectRatio: '3/4', maxHeight: '480px' }}>
      <img
        src={images[idx]}
        alt={`${title} — image ${idx + 1}`}
        className="w-full h-full object-contain"
        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
          if (images.length > 1) setIdx(prev => (prev + 1) % images.length);
          else e.currentTarget.parentElement!.style.display = 'none';
        }}
      />

      {/* Gradient overlay for readability of controls */}
      {images.length > 1 && (
        <>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/30" />

          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/50 hover:bg-white/75'}`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>

          {/* Counter */}
          <div className="absolute top-3 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            {idx + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
};

// ── Fee breakdown inline notice ───────────────────────────────────────────────
const FeeBreakdown: React.FC<{
  gatewayFee: number; platformFee: number; total: number;
  isFundraising: boolean;
}> = ({ gatewayFee, platformFee, total, isFundraising }) => (
  <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="font-semibold text-xs uppercase tracking-wide mb-1.5">Processing fees applied</p>
      <div className="space-y-0.5 text-xs">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
          <span>Gateway fee (1.5%, max ₦2,000):</span>
          <span className="font-medium">{formatCurrency(gatewayFee)}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
          <span>Platform fee ({isFundraising ? '1%' : '0.5%'}, max ₦2,000):</span>
          <span className="font-medium">{formatCurrency(platformFee)}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-between font-bold border-t border-amber-300 pt-1 mt-1 text-sm gap-0.5">
          <span>Total you pay:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  </div>
);

// ── Fundraising contributors section ─────────────────────────────────────────
const FundraisingContributors: React.FC<{ collectionId: string }> = ({ collectionId }) => {
  const [contributors, setContributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('contributions')
      .select('*')
      .eq('collection_id', collectionId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error('Failed to fetch contributors:', error.message);
        setContributors(normalizeContributions(data));
        setLoading(false);
      });
  }, [collectionId]);

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;

  const topContributors = [...contributors]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const totalRaised = contributors.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

  return (
    <div className="mt-8 space-y-5">
      <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-slate-50 shadow-sm">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">Contributor Wall</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">See the people powering this fundraiser</h3>
            <p className="mt-1 text-sm text-slate-500">Anonymous supporters are shown clearly while keeping their privacy intact.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Contributors</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{contributors.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Heart className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Total Raised</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{fmt(totalRaised)}</p>
            </div>
          </div>
        </div>
      </div>

      {contributors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/40 p-8 text-center">
          <Heart className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-semibold text-slate-700">No contributions yet</p>
          <p className="mt-1 text-xs text-slate-500">Be the first to support this fundraiser!</p>
        </div>
      ) : (
        <>
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top Contributors
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid gap-3 md:grid-cols-3">
                {topContributors.map((contributor, index) => (
                  <div key={contributor.id || index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? 'bg-amber-100 text-amber-700'
                          : index === 1
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-orange-100 text-orange-700'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {contributor.is_anonymous ? 'Anonymous' : 'Public'}
                      </span>
                    </div>
                    <p className={`mt-4 text-sm font-semibold ${contributor.is_anonymous ? 'text-slate-500 italic' : 'text-slate-900'}`}>
                      {contributor.display_name}
                    </p>
                    <p className="mt-1 text-lg font-bold text-green-700">{fmt(contributor.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
                <Users className="h-4 w-4 text-gray-500" />
                Contributors
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="divide-y divide-slate-100">
                {contributors.map((contributor: any, index: number) => (
                  <div key={contributor.id || index} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm font-medium ${contributor.is_anonymous ? 'italic text-slate-500' : 'text-slate-900'}`}>
                          {contributor.display_name}
                        </p>
                        {contributor.is_anonymous && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            Anonymous
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(contributor.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-green-700">{fmt(contributor.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ContributeFlow: React.FC<ContributeFlowProps> = ({ collection }) => {
  const colType: string = collection.collection_type || collection.type || 'fixed';
  const isTicket = colType === 'ticket';
  const isFundraising = colType === 'fundraising';
  const isTiered = colType === 'tiered' || (isTicket && collection.ticket_mode === 'tiered');
  const isOpenPool = colType === 'open_pool';
  const feeBearer: string = collection.fee_bearer || 'organizer';

  const tiers: any[] = Array.isArray(collection.pricing_tiers) ? collection.pricing_tiers : [];
  const normalizedTiers = tiers.map((tier: any, index: number) => ({
    ...tier,
    tierId: tier.id || `${tier.name || 'tier'}-${index}`,
    tierName: tier.name || `Tier ${index + 1}`,
    price: Number(tier.price || 0),
    totalCapacity:
      tier.quantity === null || tier.quantity === undefined
        ? null
        : Number(tier.quantity),
    remainingCapacity:
      tier.remaining_quantity === null || tier.remaining_quantity === undefined
        ? tier.quantity === null || tier.quantity === undefined
          ? null
          : Number(tier.quantity)
        : Number(tier.remaining_quantity),
  }));
  const formFields: any[] = Array.isArray(collection.form_fields) ? collection.form_fields : [];

  // Build poster slideshow images: banner first, then story images
  const allImages: string[] = [
    collection.banner_url || collection.banner_image,
    ...(Array.isArray(collection.story_images) ? collection.story_images : []),
  ].filter(Boolean) as string[];

  // Show slideshow for ticket and fundraising (poster types). For others, show if banner exists.
  const showSlideshow = allImages.length > 0;

  // --- State ---
  const [step, setStep] = useState<Step>('details');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: '', email: '', phone: '' });
  const [selectedTier, setSelectedTier] = useState<any>(
    !isTicket && isTiered ? normalizedTiers[0] || null : null
  );
  const [customAmount, setCustomAmount] = useState('');
  const [presetAmount, setPresetAmount] = useState<number | null>(null);
  const [openPoolAmount, setOpenPoolAmount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [ticketSelections, setTicketSelections] = useState<Record<string, number>>(() =>
    Object.fromEntries(normalizedTiers.map((tier: any) => [String(tier.tierId), 0]))
  );
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed amount
  const getAmount = (): number => {
    if (isFundraising) {
      return presetAmount ?? (customAmount ? parseFloat(customAmount) : 0);
    }
    if (isOpenPool) {
      return openPoolAmount ? parseFloat(openPoolAmount) : 0;
    }
    if (isTicket && isTiered) {
      return roundCurrency(
        normalizedTiers.reduce((sum: number, tier: any) => {
          const tierQuantity = ticketSelections[String(tier.tierId)] || 0;
          return sum + tier.price * tierQuantity;
        }, 0)
      );
    }
    if (isTiered && selectedTier) {
      return selectedTier.price;
    }
    return (collection.amount || 0) * (isTicket ? quantity : 1);
  };

  const amount = getAmount();
  const selectedTicketSelections: TicketTierSelection[] = isTicket && isTiered
    ? normalizedTiers
        .map((tier: any) => {
          const selectedQuantity = ticketSelections[String(tier.tierId)] || 0;
          if (selectedQuantity < 1) return null;
          return {
            tierId: tier.tierId ? String(tier.tierId) : null,
            tierName: String(tier.tierName),
            pricePerUnit: Number(tier.price || 0),
            quantity: selectedQuantity,
            subtotal: roundCurrency(Number(tier.price || 0) * selectedQuantity),
            description: tier.description || undefined,
            remainingCapacity:
              tier.remainingCapacity === null || tier.remainingCapacity === undefined
                ? null
                : Number(tier.remainingCapacity),
            prefix: tier.prefix || null,
          };
        })
        .filter(Boolean) as TicketTierSelection[]
    : [];
  const totalTicketQuantity = isTicket
    ? (isTiered
        ? selectedTicketSelections.reduce((sum, selection) => sum + selection.quantity, 0)
        : quantity)
    : 0;
  const { gatewayFee, platformFee, total } = calcFees(amount, feeBearer, colType);
  const minAmount = collection.amount || 0;
  const showFees = feeBearer === 'contributor' && amount > 0;

  const totalContributed: number = collection.total_amount || 0;
  const goalAmount: number = collection.goal_amount || 0;
  const openPoolRemaining: number | null =
    isOpenPool && goalAmount > 0 ? Math.max(0, goalAmount - totalContributed) : null;
  const maxContributions: number = collection.max_contributions ?? collection.max_participants ?? 0;
  const participantsPaid: number = collection.participants_count ?? 0;
  const spotsRemaining: number | null = maxContributions > 0 ? Math.max(0, maxContributions - participantsPaid) : null;

  const supportPhone: string | undefined =
    collection.support_phone || collection.support_phone_number || collection.support || undefined;

  // --- Validation ---
  const validateDetails = (): boolean => {
    if (isFundraising) {
      const val = presetAmount ?? parseFloat(customAmount);
      if (!val || val < (minAmount || 1)) {
        toast.error(minAmount ? `Minimum donation is ${formatCurrency(minAmount)}` : 'Please enter a donation amount');
        return false;
      }
    }
    if (isOpenPool) {
      const val = parseFloat(openPoolAmount);
      if (!val || val < minAmount) {
        toast.error(minAmount ? `Minimum contribution is ${formatCurrency(minAmount)}` : 'Please enter an amount');
        return false;
      }
    }
    if (isTicket && isTiered) {
      if (selectedTicketSelections.length === 0) {
        toast.error('Select at least one ticket tier before checkout');
        return false;
      }
      if (totalTicketQuantity > MAX_TICKETS_PER_ORDER) {
        toast.error(`You can only buy up to ${MAX_TICKETS_PER_ORDER} tickets per checkout`);
        return false;
      }
      const soldOutTier = selectedTicketSelections.find(selection =>
        selection.remainingCapacity !== null && selection.quantity > Number(selection.remainingCapacity)
      );
      if (soldOutTier) {
        toast.error(`${soldOutTier.tierName} does not have enough tickets left`);
        return false;
      }
    }
    if (isTicket && !isTiered) {
      if (quantity < 1) {
        toast.error('Select at least one ticket');
        return false;
      }
      if (quantity > MAX_TICKETS_PER_ORDER) {
        toast.error(`You can only buy up to ${MAX_TICKETS_PER_ORDER} tickets per checkout`);
        return false;
      }
      if (spotsRemaining !== null && quantity > spotsRemaining) {
        toast.error('Not enough tickets remain for this order');
        return false;
      }
    }
    if (!isTicket && isTiered && !selectedTier) { toast.error('Please select a tier'); return false; }
    for (const field of formFields) {
      if (field.required && field.name.toLowerCase() !== 'unique code') {
        if (!getFieldValue(formData, field)?.trim()) { toast.error(`Please fill in ${field.name}`); return false; }
      }
    }
    return true;
  };

  const validateContact = (): boolean => {
    if (!isAnonymous || !isFundraising) {
      if (!contact.name.trim()) { toast.error('Full name is required'); return false; }
      if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        toast.error('Valid email is required'); return false;
      }
      if (!contact.phone.trim()) { toast.error('Phone number is required'); return false; }
    } else {
      if (!contact.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        toast.error('Email is required to send your receipt'); return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (step === 'details' && validateDetails()) setStep('contact');
    else if (step === 'contact' && validateContact()) setStep('summary');
  };

  const goBack = () => {
    if (step === 'summary') setStep('contact');
    else if (step === 'contact') setStep('details');
  };

  // --- Payment ---
  const handlePay = async () => {
    setIsSubmitting(true);
    try {
      const pending = {
        collectionId: collection.id,
        collectionType: colType,
        collectionTitle: collection.title,
        contact: isAnonymous && isFundraising
          ? { name: 'Anonymous', email: contact.email, phone: contact.phone || '' }
          : contact,
        formData,
        selectedTier: !isTicket && isTiered ? selectedTier?.tierName || selectedTier?.name || null : null,
        selectedTierId: !isTicket && isTiered ? selectedTier?.tierId || selectedTier?.id || null : null,
        contributionAmount: amount,
        quantity: isTicket ? totalTicketQuantity : 1,
        ticketSelections: selectedTicketSelections,
        isAnonymous: isFundraising && isAnonymous,
        codePrefix: collection.code_prefix || '',
        feeBearer,
        totalPayable: total,
        feeBreakdown: {
          contributionAmount: amount,
          platformFee: roundCurrency(platformFee),
          gatewayFee: roundCurrency(gatewayFee),
          totalFees: roundCurrency(platformFee + gatewayFee),
          totalPayable: roundCurrency(total),
        },
      };

      localStorage.setItem('kolekto-pending-contribution', JSON.stringify(pending));

      const contactName = pending.contact.name;
      const contactEmail = pending.contact.email;
      const contactPhone = pending.contact.phone || '';

      // Fix #4: Send only host-requested form fields as formData.
      // Contact info (name/email/phone) is passed separately — NOT merged into formData.
      // This ensures contributor_information only stores what the host asked for,
      // while payer contact is used only for payment processing and the Activities tab.
      const hostFormData = {
        ...buildContributorFieldPayload(formFields, pending.formData || {}),
        ...(pending.selectedTier ? { Tier: pending.selectedTier } : {}),
        ...(pending.selectedTierId ? { TierId: pending.selectedTierId } : {}),
      };

      const { data, error: invokeError } = await supabase.functions.invoke(
        'initiate-paystack-payment',
        {
          body: {
            email: contactEmail,
            callback_url: `${window.location.origin}/payment/verify`,
            metadata: {
              ...pending,
              amount,
              totalPayable: total,
              contact: {
                name: contactName,
                email: contactEmail,
                phone: contactPhone,
              },
              formData: hostFormData,
            },
          },
        }
      );

      // supabase-js wraps non-2xx responses in a FunctionsHttpError. The real
      // server-side error message lives in the response body, which we have to
      // read manually — otherwise we only see "Edge Function returned a non-2xx status code".
      if (invokeError) {
        let serverMessage = invokeError.message || 'Failed to initiate payment';
        try {
          const ctx = (invokeError as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) serverMessage = body.error;
            console.error('[initiate-paystack-payment] edge function error body:', body);
          } else if (ctx && typeof ctx.text === 'function') {
            const text = await ctx.text();
            if (text) serverMessage = text;
            console.error('[initiate-paystack-payment] edge function error text:', text);
          }
        } catch (readErr) {
          console.error('[initiate-paystack-payment] failed to read error body:', readErr);
        }
        throw new Error(serverMessage);
      }

      const authorizationUrl = data?.authorization_url || data?.authorizationUrl;
      if (!authorizationUrl) {
        throw new Error(data?.error || 'No payment URL returned from gateway');
      }

      window.location.href = authorizationUrl;
    } catch (err: any) {
      const msg = err?.message || 'Failed to initiate payment';
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  // --- Field renderer ---
  const renderField = (field: any) => {
    if (field.name.toLowerCase() === 'unique code') return null;
    const fieldKey = getFieldStorageKey(field);
    const inputId = field.id || field.name;
    const value = getFieldValue(formData, field);
    const onChange = (val: string) => setFormData(prev => ({ ...prev, [fieldKey]: val }));

    switch (field.type) {
      case 'textarea':
        return <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={`Enter ${field.name.toLowerCase()}`} />;
      case 'select':
      case 'selectdropdown':
        return (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={`Select ${field.name.toLowerCase()}`} /></SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string, i: number) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={value} onValueChange={onChange}>
            {field.options?.map((opt: string, i: number) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`${inputId}-${i}`} />
                <Label htmlFor={`${inputId}-${i}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox checked={value === 'true'} onCheckedChange={(c: boolean | 'indeterminate') => onChange(c.toString())} id={inputId} />
            <Label htmlFor={inputId}>{field.name}</Label>
          </div>
        );
      default:
        return (
          <Input
            type={field.type || 'text'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={`Enter ${field.name.toLowerCase()}`}
          />
        );
    }
  };

  // --- Details step ---
  const renderDetails = () => (
    <div className="space-y-5">
      {/* Open Pool: raised/remaining bar */}
      {isOpenPool && (totalContributed > 0 || openPoolRemaining !== null) && (
        <div className="rounded-xl bg-cyan-50 border border-cyan-100 p-4 flex items-center justify-between text-sm">
          <div>
            <p className="text-xs text-cyan-600 uppercase tracking-wide font-medium">Total Raised So Far</p>
            <p className="text-lg font-bold text-cyan-800">{formatCurrency(totalContributed)}</p>
          </div>
          {openPoolRemaining !== null && (
            <div className="text-right">
              <p className="text-xs text-cyan-600 uppercase tracking-wide font-medium">Remaining</p>
              <p className="text-lg font-bold text-cyan-800">{formatCurrency(openPoolRemaining)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── FUNDRAISING ─────────────────────────────────────────────────────── */}
      {isFundraising && (
        <>
          {/* Campaign story */}
          {(() => {
            const storyWhat = collection.story?.what || collection.story_what;
            const storyWhy = collection.story?.why || collection.story_why;
            const storyImpact = collection.story?.impact || collection.story_impact;
            return (storyWhat || storyWhy || storyImpact) ? (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 text-sm text-gray-800">
                {storyWhat && <div><p className="font-semibold text-gray-900">What we're doing</p><p className="text-gray-600 mt-0.5">{storyWhat}</p></div>}
                {storyWhy && <div><p className="font-semibold mt-2 text-gray-900">Why it matters</p><p className="text-gray-600 mt-0.5">{storyWhy}</p></div>}
                {storyImpact && <div><p className="font-semibold mt-2 text-gray-900">The impact</p><p className="text-gray-600 mt-0.5">{storyImpact}</p></div>}
              </div>
            ) : null;
          })()}

          {/* Donation amount */}
          <div className="space-y-2">
            <Label className="font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" /> Donation Amount
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FUNDRAISING_PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPresetAmount(p); setCustomAmount(''); }}
                  className={`rounded-lg border py-2 text-sm font-medium transition-colors ${presetAmount === p ? 'border-kolekto bg-kolekto text-white' : 'border-gray-200 hover:border-kolekto'}`}
                >
                  {formatCurrency(p)}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
              <Input
                type="number"
                className="pl-7"
                placeholder={minAmount ? `Min ${formatCurrency(minAmount)}` : 'Custom amount'}
                value={customAmount}
                onChange={e => { setCustomAmount(e.target.value); setPresetAmount(null); }}
                min={minAmount || 1}
              />
            </div>
            {minAmount > 0 && <p className="text-xs text-gray-500">Minimum donation: {formatCurrency(minAmount)}</p>}
          </div>

          {/* Fee breakdown — below amount selection */}
          {showFees && (
            <FeeBreakdown gatewayFee={gatewayFee} platformFee={platformFee} total={total} isFundraising={true} />
          )}

          <div className="flex items-center space-x-2">
            <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={(c: boolean | 'indeterminate') => setIsAnonymous(!!c)} />
            <Label htmlFor="anonymous" className="text-sm cursor-pointer">
              Donate anonymously (your name will not be shown publicly)
            </Label>
          </div>
        </>
      )}

      {/* ── OPEN POOL ───────────────────────────────────────────────────────── */}
      {isOpenPool && (
        <>
          <div className="space-y-2">
            <Label className="font-medium">Contribution Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
              <Input
                type="number"
                className="pl-7"
                placeholder={minAmount ? `Min ${formatCurrency(minAmount)}` : 'Enter amount'}
                value={openPoolAmount}
                onChange={e => setOpenPoolAmount(e.target.value)}
                min={minAmount || 1}
              />
            </div>
            {minAmount > 0 && <p className="text-xs text-gray-500">Minimum: {formatCurrency(minAmount)}</p>}
          </div>

          {/* Fee breakdown — below amount input */}
          {showFees && (
            <FeeBreakdown gatewayFee={gatewayFee} platformFee={platformFee} total={total} isFundraising={false} />
          )}
        </>
      )}

      {/* ── TIERED ──────────────────────────────────────────────────────────── */}
      {isTiered && tiers.length > 0 && (
        <>
          <div className="space-y-2">
            <Label className="font-medium flex items-center gap-2"><Tag className="h-4 w-4" /> {isTicket ? 'Select Ticket Mix' : 'Select Tier'}</Label>
            <div className="space-y-2">
              {normalizedTiers.map((tier, i) => {
                const isTierSoldOut = isTicket && tier.remainingCapacity !== null && tier.remainingCapacity !== undefined && Number(tier.remainingCapacity) <= 0;
                const isTierFull = !isTicket && tier.remainingCapacity !== null && Number(tier.remainingCapacity) <= 0;

                if (isTicket) {
                  return (
                    <div key={i} className={`rounded-xl border p-4 space-y-3 ${isTierSoldOut ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isTierSoldOut ? 'text-gray-400' : ''}`}>{tier.tierName}</span>
                            {isTierSoldOut
                              ? <Badge variant="outline" className="text-xs text-red-500 border-red-200">Sold Out</Badge>
                              : tier.remainingCapacity !== null && (
                                  <Badge variant="outline" className="text-xs">{Math.max(0, Number(tier.remainingCapacity))} left</Badge>
                                )
                            }
                          </div>
                          {tier.description && <p className="text-sm text-gray-500 mt-1">{tier.description}</p>}
                        </div>
                        <span className={`font-bold ${isTierSoldOut ? 'text-gray-400' : 'text-kolekto'}`}>{formatCurrency(tier.price)}</span>
                      </div>
                      {isTierSoldOut ? (
                        <p className="text-xs text-red-400 text-center py-1">This tier is no longer available</p>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-500">Add this tier to your ticket cart.</p>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setTicketSelections(prev => ({
                                  ...prev,
                                  [String(tier.tierId)]: Math.max(0, (prev[String(tier.tierId)] || 0) - 1),
                                }))
                              }
                              className="w-9 h-9 rounded-lg border border-gray-200 text-lg font-medium hover:bg-gray-50 flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-10 text-center text-lg font-semibold">
                              {ticketSelections[String(tier.tierId)] || 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const currentTierQty = ticketSelections[String(tier.tierId)] || 0;
                                const maxForTier =
                                  tier.remainingCapacity === null || tier.remainingCapacity === undefined
                                    ? MAX_TICKETS_PER_ORDER
                                    : Math.max(0, Number(tier.remainingCapacity));
                                if (totalTicketQuantity >= MAX_TICKETS_PER_ORDER || currentTierQty >= maxForTier) return;
                                setTicketSelections(prev => ({
                                  ...prev,
                                  [String(tier.tierId)]: currentTierQty + 1,
                                }));
                              }}
                              className="w-9 h-9 rounded-lg border border-gray-200 text-lg font-medium hover:bg-gray-50 flex items-center justify-center"
                              disabled={
                                totalTicketQuantity >= MAX_TICKETS_PER_ORDER ||
                                (tier.remainingCapacity !== null && tier.remainingCapacity !== undefined &&
                                  (ticketSelections[String(tier.tierId)] || 0) >= Number(tier.remainingCapacity))
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { if (!isTierFull) setSelectedTier(tier); }}
                    disabled={isTierFull}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      isTierFull
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : selectedTier?.tierId === tier.tierId
                        ? 'border-kolekto bg-kolekto/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isTierFull ? 'border-gray-300 bg-gray-200'
                            : selectedTier?.tierId === tier.tierId ? 'border-kolekto bg-kolekto' : 'border-gray-300'
                          }`}>
                            {!isTierFull && selectedTier?.tierId === tier.tierId && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className={`font-medium ${isTierFull ? 'text-gray-400' : ''}`}>{tier.tierName}</span>
                          {isTierFull
                            ? <Badge variant="outline" className="text-xs text-red-500 border-red-200">Sold Out</Badge>
                            : tier.remainingCapacity !== null && (
                                <Badge variant="outline" className="text-xs">{Math.max(0, Number(tier.remainingCapacity))} left</Badge>
                              )
                          }
                        </div>
                        {tier.description && <p className="text-sm text-gray-500 mt-1 ml-6">{tier.description}</p>}
                      </div>
                      <span className={`font-bold ${isTierFull ? 'text-gray-400' : 'text-kolekto'}`}>{formatCurrency(tier.price)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fee breakdown — below tier selection */}
          {showFees && (
            <FeeBreakdown gatewayFee={gatewayFee} platformFee={platformFee} total={total} isFundraising={false} />
          )}
        </>
      )}

      {/* ── FIXED (non-tiered, non-fundraising, non-pool) ───────────────────── */}
      {!isFundraising && !isOpenPool && !isTiered && (
        <>
          <div className="rounded-xl bg-kolekto/5 border border-kolekto/20 p-4 text-center">
            <p className="text-sm text-gray-500">Collection Amount</p>
            <p className="text-3xl font-bold text-kolekto mt-1">{formatCurrency(collection.amount || 0)}</p>
          </div>

          {/* Fee breakdown — below fixed amount display */}
          {showFees && (
            <FeeBreakdown gatewayFee={gatewayFee} platformFee={platformFee} total={total} isFundraising={false} />
          )}
        </>
      )}

      {/* ── TICKET quantity (all ticket types) ──────────────────────────────── */}
      {isTicket && (
        <div className="space-y-2">
          <Label className="font-medium flex items-center gap-2"><Ticket className="h-4 w-4" /> Number of Tickets</Label>
          {isTiered ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 flex items-center justify-between">
              <span>Total tickets selected</span>
              <span className="font-semibold text-gray-900">{totalTicketQuantity}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-lg border border-gray-200 text-xl font-medium hover:bg-gray-50 flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => {
                    const maxQty = spotsRemaining !== null
                      ? Math.min(MAX_TICKETS_PER_ORDER, spotsRemaining)
                      : MAX_TICKETS_PER_ORDER;
                    setQuantity(q => Math.min(maxQty, q + 1));
                  }}
                  disabled={
                    quantity >= MAX_TICKETS_PER_ORDER ||
                    (spotsRemaining !== null && quantity >= spotsRemaining)
                  }
                  className="w-10 h-10 rounded-lg border border-gray-200 text-xl font-medium hover:bg-gray-50 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {spotsRemaining !== null && spotsRemaining < MAX_TICKETS_PER_ORDER
                  ? `${spotsRemaining} ticket${spotsRemaining === 1 ? '' : 's'} remaining`
                  : `Max ${MAX_TICKETS_PER_ORDER} tickets per order`}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Custom form fields ───────────────────────────────────────────────── */}
      {formFields.filter(f => f.name.toLowerCase() !== 'unique code').length > 0 && (
        <div className="space-y-4 pt-2 border-t">
          <p className="text-sm font-medium text-gray-700">Additional Details</p>
          {formFields.map((field, i) => {
            if (field.name.toLowerCase() === 'unique code') return null;
            return (
              <div key={field.id || `${field.name}-${i}`} className="space-y-1.5">
                <Label>{field.name}{field.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
                {renderField(field)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderContact = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cf-name">{isAnonymous && isFundraising ? 'Your Name (private)' : 'Full Name'} *</Label>
        <Input
          id="cf-name"
          value={contact.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(p => ({ ...p, name: e.target.value }))}
          placeholder="Enter your full name"
        />
        {isAnonymous && isFundraising && <p className="text-xs text-gray-500">This will not be shown publicly.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-email">Email *</Label>
        <Input
          id="cf-email"
          type="email"
          value={contact.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(p => ({ ...p, email: e.target.value }))}
          placeholder="Enter your email address"
        />
        <p className="text-xs text-gray-500">Your receipt will be sent to this email.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf-phone">Phone Number *</Label>
        <Input
          id="cf-phone"
          type="tel"
          value={contact.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(p => ({ ...p, phone: e.target.value }))}
          placeholder="e.g. 08012345678"
        />
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-5 space-y-3">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> Payment Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Collection</span>
            <span className="font-medium">{collection.title}</span>
          </div>
          {!isTicket && selectedTier && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tier</span>
              <span className="font-medium">{selectedTier.tierName || selectedTier.name}</span>
            </div>
          )}
          {isTicket && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tickets</span>
              <span className="font-medium">{totalTicketQuantity}</span>
            </div>
          )}
          {isTicket && isTiered && selectedTicketSelections.length > 0 && (
            <div className="space-y-2 rounded-lg border border-blue-100 bg-white/70 p-3">
              {selectedTicketSelections.map(selection => (
                <div key={`${selection.tierId || selection.tierName}`} className="flex items-center justify-between">
                  <span className="text-gray-600">{selection.quantity} x {selection.tierName}</span>
                  <span className="font-medium">{formatCurrency(selection.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">{isFundraising ? 'Contribution amount' : isTicket ? 'Ticket subtotal' : 'Contribution amount'}</span>
            <span className="font-medium">{formatCurrency(amount)}</span>
          </div>
          {feeBearer === 'contributor' && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Gateway fee (1.5%)</span>
                <span>{formatCurrency(gatewayFee)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Platform fee ({isFundraising ? '1%' : '0.5%'}, max ₦2,000)</span>
                <span>{formatCurrency(platformFee)}</span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-blue-900 text-base">
            <span>Total paid</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-2 text-sm">
        <p className="font-medium text-gray-700 flex items-center gap-2"><User className="h-4 w-4" /> Paying as</p>
        <p className="text-gray-600">{isAnonymous && isFundraising ? 'Anonymous' : contact.name}</p>
        <p className="text-gray-500">{contact.email}</p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 text-center">
        Secure payment powered by Paystack. You'll be redirected to complete payment.
      </div>
    </div>
  );

  const steps: { key: Step; label: string }[] = [
    { key: 'details', label: isFundraising ? 'Donation' : isTicket ? 'Tickets' : 'Details' },
    { key: 'contact', label: 'Contact' },
    { key: 'summary', label: 'Review' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Organizer contact bar */}
      {supportPhone && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="h-4 w-4 text-kolekto flex-shrink-0" />
            <span>Need help? Contact the organizer:</span>
            <a href={`tel:${supportPhone}`} className="font-semibold text-kolekto hover:underline whitespace-nowrap">{supportPhone}</a>
          </div>
          <a
            href={`https://wa.me/${supportPhone.replace(/^\+?0?/, '234')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-600 font-medium hover:underline flex-shrink-0 self-start sm:self-auto"
          >
            WhatsApp
          </a>
        </div>
      )}

      <Card className="overflow-hidden">
        {/* ── Poster-sized image slideshow ─────────────────────────────────── */}
        {showSlideshow && <ImageSlideshow images={allImages} title={collection.title} />}

        <CardHeader>
          <CardTitle className="text-lg">{collection.title}</CardTitle>
          {(collection.campaign_summary || collection.description) && (
            <CardDescription className="mt-1">{collection.campaign_summary || collection.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step indicators */}
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 text-sm font-medium ${
                    idx === stepIndex
                      ? 'border-kolekto bg-kolekto text-white'
                      : idx < stepIndex
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-200 bg-white text-gray-400'
                  }`}>
                    {idx < stepIndex ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`mt-1 text-xs ${idx === stepIndex ? 'font-semibold text-kolekto' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${idx < stepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step content */}
          {step === 'details' && renderDetails()}
          {step === 'contact' && renderContact()}
          {step === 'summary' && renderSummary()}
        </CardContent>

        <CardFooter className="border-t pt-4 flex flex-col gap-3">
          {step !== 'summary' && (
            <div className="w-full flex justify-between items-center text-sm text-gray-500">
              <span>Total</span>
              <span className="font-bold text-base text-gray-800">{formatCurrency(total)}</span>
            </div>
          )}

          <div className="flex gap-2 w-full">
            {step !== 'details' && (
              <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step !== 'summary' ? (
              <Button type="button" onClick={goNext} className="flex-1 bg-kolekto hover:bg-kolekto/90">
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={spotsRemaining === 0 ? undefined : handlePay}
                disabled={isSubmitting || spotsRemaining === 0}
                className="flex-1 bg-kolekto hover:bg-kolekto/90 disabled:bg-gray-400"
              >
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                  : spotsRemaining === 0
                  ? 'Collection Full'
                  : `Pay ${formatCurrency(total)}`}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* ── Fundraising: contributors list ───────────────────────────────────── */}
      {isFundraising && <FundraisingContributors collectionId={collection.id} />}
    </div>
  );
};

export default ContributeFlow;

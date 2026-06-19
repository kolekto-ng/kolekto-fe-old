import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { axiosInstance } from '@/utils/axios';
import Footer from '@/components/Footer';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertTriangle, Clock, XCircle, ShieldCheck } from 'lucide-react';
import { FaTwitter, FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import ContributeFlow from '@/components/contribute/ContributeFlow';
import { Skeleton } from '@/components/ui/skeleton';
import { toFriendlyErrorMessage } from '@/utils/errorMessages';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const annotateTierAvailability = (collectionData: any, paidContributions: any[]) => {
  const tiers = Array.isArray(collectionData.pricing_tiers)
    ? collectionData.pricing_tiers
    : Array.isArray(collectionData.price_tiers)
    ? collectionData.price_tiers
    : [];

  const soldByTier = new Map<string, number>();
  for (const contribution of paidContributions) {
    const info = Array.isArray(contribution.contributor_information)
      ? contribution.contributor_information[0] || {}
      : {};
    const tierId = info?.TierId ? String(info.TierId) : '';
    const tierName = info?.Tier ? String(info.Tier) : '';
    const key = tierId || tierName;
    if (!key) continue;
    soldByTier.set(key, (soldByTier.get(key) || 0) + 1);
  }

  const pricing_tiers = tiers.map((tier: any, index: number) => {
    const tierId = String(tier.id || '');
    const tierName = String(tier.name || `Tier ${index + 1}`);
    const sold = soldByTier.get(tierId) || soldByTier.get(tierName) || 0;
    const capacity =
      tier.quantity === null || tier.quantity === undefined ? null : Number(tier.quantity);

    return {
      ...tier,
      sold_quantity: sold,
      remaining_quantity: capacity === null ? null : Math.max(0, capacity - sold),
    };
  });

  return {
    ...collectionData,
    pricing_tiers,
    price_tiers: pricing_tiers,
    participants_count: paidContributions.length,
  };
};

const ContributePage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      if (!collectionId) {
        setError('Invalid collection link.');
        setLoading(false);
        return;
      }

      try {
        let collectionData: any;

        if (UUID_RE.test(collectionId)) {
          // Direct Supabase lookup by UUID
          const { data, error: fetchError } = await supabase
            .from('collections')
            .select('*')
            .eq('id', collectionId)
            .single();

          if (fetchError || !data) throw new Error('Collection not found.');
          collectionData = data;
        } else {
          // Slug-based lookup via backend API
          const res = await axiosInstance.get('/collection', { params: { collectionId } });
          if (!res.data?.data) throw new Error('Collection not found.');
          const raw = res.data.data;
          // Normalize field names: backend uses contributions_fields / price_tiers
          collectionData = {
            ...raw,
            form_fields: raw.contributions_fields ?? raw.form_fields ?? [],
            pricing_tiers: raw.price_tiers ?? raw.pricing_tiers ?? [],
          };
        }

        const [
          { data: paidContributions, error: contributionsError },
          { data: walletData },
        ] = await Promise.all([
          supabase
            .from('contributions')
            .select('id, contributor_information')
            .eq('collection_id', collectionData.id)
            .eq('status', 'paid'),
          // Fetch wallet so the Open Pool progress bar has the real total raised
          supabase
            .from('wallets')
            .select('net_payment')
            .eq('collection_id', collectionData.id)
            .maybeSingle(),
        ]);

        if (contributionsError) throw new Error(contributionsError.message);

        // Inject total_amount (= net_payment from wallet) and goal_amount so
        // ContributeFlow's Open Pool progress bar shows accurate figures.
        const enrichedCollection = {
          ...collectionData,
          total_amount: walletData?.net_payment ?? 0,
          goal_amount: collectionData.target_amount ?? collectionData.goal_amount ?? 0,
        };

        setCollection(annotateTierAvailability(enrichedCollection, paidContributions || []));
      } catch (err: any) {
        setError(toFriendlyErrorMessage(err, 'Could not load this collection. Please check the link and try again.'));
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionId]);

  useEffect(() => {
    if (!collection?.id) return;

    const channel = supabase
      .channel(`collection-live-${collection.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `collection_id=eq.${collection.id}` },
        async () => {
          const [{ data: paidContributions }, { data: walletData }] = await Promise.all([
            supabase
              .from('contributions')
              .select('id, contributor_information')
              .eq('collection_id', collection.id)
              .eq('status', 'paid'),
            supabase
              .from('wallets')
              .select('net_payment')
              .eq('collection_id', collection.id)
              .maybeSingle(),
          ]);

          setCollection((prev: any) =>
            annotateTierAvailability(
              { ...prev, total_amount: walletData?.net_payment ?? prev.total_amount ?? 0 },
              paidContributions || []
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collection?.id]);

  const ContributionNavBar = () => (
    <nav className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-1.5">
          <a className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-kolekto/5 hover:text-kolekto" href="https://x.com/kolektng" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
            <FaTwitter className="text-lg" />
          </a>
          <a className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-kolekto/5 hover:text-kolekto" href="https://www.facebook.com/share/1AVyxK7Prc/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <FaFacebook className="text-lg" />
          </a>
          <a className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-kolekto/5 hover:text-kolekto" href="https://www.instagram.com/kolekto.ng" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <FaInstagram className="text-lg" />
          </a>
          <a className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-kolekto/5 hover:text-kolekto" href="https://wa.me/+2349019840377" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <FaWhatsapp className="text-lg" />
          </a>
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <ContributionNavBar />
        <main className="flex-grow p-4 sm:p-6">
          <div className="mx-auto grid w-full max-w-5xl gap-6 py-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/5 rounded-lg" />
              <Skeleton className="h-5 w-4/5 rounded-lg" />
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-52 rounded-xl" />
            </div>
            <Skeleton className="h-[480px] rounded-xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <ContributionNavBar />
        <main className="flex-grow flex items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-xl border-slate-200 shadow-sm">
            <CardContent className="px-5 py-7 text-center space-y-4">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <XCircle className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-950">Collection Not Found</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{error || 'The requested collection does not exist.'}</p>
              </div>
              <Button className="min-h-11 rounded-lg bg-kolekto hover:bg-kolekto/90" onClick={() => navigate('/')}>Return to Home</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Status gates
  const status = collection.status;
  const isExpired = collection.deadline && new Date(collection.deadline) < new Date();
  const supportPhone: string | undefined =
    collection.support_phone || collection.support_phone_number || collection.support || undefined;

  // Renders a "contact the host" block for statuses where the host should be reached directly.
  // Not shown for pending/under-review collections (fundraising approval flow).
  const ContactHostBlock = () => {
    if (!supportPhone) return null;
    const wa = `https://wa.me/${supportPhone.replace(/^\+?0?/, '234')}`;
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <p className="font-semibold text-slate-900">Need help? Contact the organizer</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <a href={`tel:${supportPhone}`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 font-medium text-kolekto">{supportPhone}</a>
          <span className="opacity-40">·</span>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-green-200 bg-green-50 px-3 font-medium text-green-700">WhatsApp</a>
        </div>
      </div>
    );
  };

  const renderStatusGate = () => {
    if (isExpired) {
      return (
        <Card className="w-full max-w-md rounded-xl border-red-200 bg-red-50 shadow-sm">
          <CardContent className="px-5 py-7 text-center space-y-3">
            <Clock className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-red-700">Collection Expired</h2>
            <p className="text-red-600">
              The deadline for <strong>{collection.title}</strong> has passed.
            </p>
            <ContactHostBlock />
            <Button className="min-h-11 rounded-lg" variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    if (status === 'paused') {
      return (
        <Card className="w-full max-w-md rounded-xl border-yellow-200 bg-yellow-50 shadow-sm">
          <CardContent className="px-5 py-7 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-bold text-yellow-800">Collection Paused</h2>
            <p className="text-yellow-700">
              <strong>{collection.title}</strong> is temporarily paused by the organizer. Please check back later.
            </p>
            <ContactHostBlock />
            <Button className="min-h-11 rounded-lg" variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    // pending_review / pending_verification = fundraising awaiting admin approval
    // Do NOT show contact prompt for either — contributor should simply wait.
    if (status === 'pending_review' || status === 'pending_verification') {
      return (
        <Card className="w-full max-w-md rounded-xl border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="px-5 py-7 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-amber-800">Under Review</h2>
            <p className="text-amber-700">
              This collection is pending review and will be available soon.
            </p>
            <Button className="min-h-11 rounded-lg" variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    if (status === 'closed' || status === 'completed') {
      return (
        <Card className="w-full max-w-md rounded-xl border-gray-200 bg-gray-50 shadow-sm">
          <CardContent className="px-5 py-7 text-center space-y-3">
            <Lock className="h-12 w-12 text-gray-400 mx-auto" />
            <h2 className="text-xl font-bold text-gray-700">Collection Closed</h2>
            <p className="text-gray-600">
              <strong>{collection.title}</strong> is no longer accepting contributions.
            </p>
            <ContactHostBlock />
            <Button className="min-h-11 rounded-lg" variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    const maxContributions = collection.max_contributions ?? collection.max_participants ?? 0;
    if (maxContributions > 0 && (collection.participants_count ?? 0) >= maxContributions) {
      return (
        <Card className="w-full max-w-md rounded-xl border-red-200 bg-red-50 shadow-sm">
          <CardContent className="px-5 py-7 text-center space-y-3">
            <Lock className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-red-700">Collection Full</h2>
            <p className="text-red-600">
              <strong>{collection.title}</strong> has reached its maximum number of contributors.
            </p>
            <ContactHostBlock />
            <Button className="min-h-11 rounded-lg" variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const gate = renderStatusGate();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <ContributionNavBar />
      <main className="flex-grow px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-4xl">
          {gate ? (
            <div className="flex justify-center">{gate}</div>
          ) : (
            <ContributeFlow collection={collection} />
          )}
          <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-kolekto/10 text-kolekto">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Ready to Start Collecting?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Join thousands of organizers across Africa who use Kolekto to simplify group payments.
            </p>
            <Button asChild className="mt-5 min-h-11 rounded-lg bg-kolekto px-5 hover:bg-kolekto/90">
              <Link to="/register">Create Your Account</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContributePage;

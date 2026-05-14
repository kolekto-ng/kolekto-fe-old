import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, Info, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCollectionStore } from '@/store';

interface ContributionField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
  legacy_names?: string[];
}

interface PriceTier {
  id?: string;
  name: string;
  price: number;
  quantity?: number;
  description?: string;
  sold_quantity?: number;
  prefix?: string | null;
}

interface EditCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  initialData: {
    title: string;
    description?: string;
    amount?: number;
    deadline?: string;
    fee_bearer?: string;
    max_contributions?: number;
    code_prefix?: string;
    contributions_fields?: ContributionField[];
    total_contributions?: number;
    type?: 'fixed' | 'tiered' | 'ticket';
    price_tiers?: PriceTier[];
    collection_type?: string;
    banner_image?: string;
    story_what?: string;
    story_why?: string;
    story_impact?: string;
    story_images?: string[];
    event_date?: string;
  };
  onSuccess?: () => void;
}

// ── Image uploader ─────────────────────────────────────────────────────────────
interface ImageUploaderProps {
  label: string;
  currentUrl: string;
  onUrlChange: (url: string) => void;
  pendingFile: File | null;
  onFileChange: (file: File | null) => void;
  previewUrl: string;
  hint?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  label, currentUrl, onUrlChange, pendingFile, onFileChange, previewUrl, hint,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    onFileChange(file);
  };

  const handleRemove = () => {
    onFileChange(null);
    onUrlChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Upload className="h-4 w-4" />
        {label}
      </Label>

      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-40 object-contain bg-gray-50 rounded-xl border"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.parentElement!.style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-red-50"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-kolekto transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Click to upload image</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — max 5MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
};

// ── Main dialog ────────────────────────────────────────────────────────────────
const EditCollectionDialog: React.FC<EditCollectionDialogProps> = ({
  open, onOpenChange, collectionId, initialData, onSuccess,
}) => {
  const normalizeContributionFields = (fields: ContributionField[] = []) =>
    fields.map((field, index) => ({
      ...field,
      id: field.id || `field-${index + 1}-${Date.now()}`,
      legacy_names: Array.isArray(field.legacy_names) ? field.legacy_names : [],
    }));

  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [ticketAmount, setTicketAmount] = useState<number>(Number(initialData.amount || 0));
  const [deadline, setDeadline] = useState<Date | undefined>(
    initialData.deadline ? new Date(initialData.deadline) : undefined
  );
  const [maxContributions, setMaxContributions] = useState<number | undefined>(
    initialData.max_contributions || undefined
  );
  const [contributionFields, setContributionFields] = useState<ContributionField[]>(
    normalizeContributionFields(initialData.contributions_fields || [])
  );
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>(initialData.price_tiers || []);

  // Type-specific
  const [bannerUrl, setBannerUrl] = useState(initialData.banner_image || '');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState(initialData.banner_image || '');
  const [storyWhat, setStoryWhat] = useState(initialData.story_what || '');
  const [storyWhy, setStoryWhy] = useState(initialData.story_why || '');
  const [storyImpact, setStoryImpact] = useState(initialData.story_impact || '');
  const [storyImageUrls, setStoryImageUrls] = useState<string[]>(initialData.story_images || []);
  const [pendingStoryFiles, setPendingStoryFiles] = useState<{ file: File; localUrl: string }[]>([]);
  const storyImgInputRef = useRef<HTMLInputElement>(null);
  const [eventDate, setEventDate] = useState<Date | undefined>(
    initialData.event_date ? new Date(initialData.event_date) : undefined
  );

  const [isLoading, setIsLoading] = useState(false);
  const { updateCollection } = useCollectionStore();

  const hasContributions = (initialData.total_contributions || 0) > 0;
  const collectionType = initialData.collection_type || (initialData.type === 'tiered' ? 'tiered' : 'fixed');
  const isFundraising = collectionType === 'fundraising';
  const isTicket = collectionType === 'ticket';
  const isFixedTicket = isTicket && priceTiers.length === 0;

  // Reset when dialog opens
  useEffect(() => {
    if (!open) return;
    setTitle(initialData.title || '');
    setDescription(initialData.description || '');
    setTicketAmount(Number(initialData.amount || 0));
    setDeadline(initialData.deadline ? new Date(initialData.deadline) : undefined);
    setMaxContributions(initialData.max_contributions || undefined);
    setContributionFields(normalizeContributionFields(initialData.contributions_fields || []));
    setPriceTiers(initialData.price_tiers || []);
    setBannerUrl(initialData.banner_image || '');
    setBannerFile(null);
    setBannerPreview(initialData.banner_image || '');
    setStoryWhat(initialData.story_what || '');
    setStoryWhy(initialData.story_why || '');
    setStoryImpact(initialData.story_impact || '');
    setStoryImageUrls(initialData.story_images || []);
    setPendingStoryFiles([]);
    setEventDate(initialData.event_date ? new Date(initialData.event_date) : undefined);
  }, [open]);

  // When file is selected, create a local preview URL
  const handleBannerFileChange = (file: File | null) => {
    setBannerFile(file);
    if (file) {
      setBannerPreview(URL.createObjectURL(file));
    } else {
      setBannerPreview(bannerUrl);
    }
  };

  // ── Tier helpers ─────────────────────────────────────────────────────────────
  const updatePriceTier = (index: number, updates: Partial<PriceTier>) => {
    setPriceTiers(t => t.map((tier, i) => i === index ? { ...tier, ...updates } : tier));
  };

  // ── Form field helpers ───────────────────────────────────────────────────────
  const addContributionField = () => {
    setContributionFields(f => [
      ...f,
      { id: Date.now().toString(), name: '', type: 'text', required: false, legacy_names: [] },
    ]);
  };

  const updateField = (id: string, updates: Partial<ContributionField>) => {
    setContributionFields((fields) =>
      fields.map((field) => {
        if (field.id !== id) return field;

        const nextName = typeof updates.name === 'string' ? updates.name.trim() : field.name.trim();
        const currentName = String(field.name || '').trim();
        const legacyNames = new Set(field.legacy_names || []);

        if (
          typeof updates.name === 'string' &&
          currentName &&
          nextName &&
          currentName !== nextName
        ) {
          legacyNames.add(currentName);
        }

        return {
          ...field,
          ...updates,
          legacy_names: Array.from(legacyNames),
        };
      })
    );
  };

  const removeField = (id: string) => {
    setContributionFields(f => f.filter(field => field.id !== id));
  };

  // Per-field option helpers
  const addOption = (fieldId: string) => {
    setContributionFields(f => f.map(field =>
      field.id === fieldId ? { ...field, options: [...(field.options || []), ''] } : field
    ));
  };

  const updateOption = (fieldId: string, optIdx: number, value: string) => {
    setContributionFields(f => f.map(field => {
      if (field.id !== fieldId) return field;
      const opts = [...(field.options || [])];
      opts[optIdx] = value;
      return { ...field, options: opts };
    }));
  };

  const removeOption = (fieldId: string, optIdx: number) => {
    setContributionFields(f => f.map(field => {
      if (field.id !== fieldId) return field;
      return { ...field, options: (field.options || []).filter((_, i) => i !== optIdx) };
    }));
  };

  // ── Upload banner to Supabase Storage ────────────────────────────────────────
  const uploadBanner = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${collectionId}/banner-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('campaign_assets').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('campaign_assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadStoryImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${collectionId}/story-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('campaign_assets').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('campaign_assets').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleStoryImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_TOTAL = 5;
    const remaining = MAX_TOTAL - storyImageUrls.length - pendingStoryFiles.length;
    files.slice(0, remaining).forEach(file => {
      setPendingStoryFiles(prev => [...prev, { file, localUrl: URL.createObjectURL(file) }]);
    });
    if (storyImgInputRef.current) storyImgInputRef.current.value = '';
  };

  const removeStoryImageUrl = (idx: number) => {
    setStoryImageUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const removePendingStoryFile = (idx: number) => {
    setPendingStoryFiles(prev => {
      URL.revokeObjectURL(prev[idx].localUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { toast.error('Collection title is required'); return; }
    if (isFixedTicket && (!ticketAmount || ticketAmount <= 0)) {
      toast.error('Ticket price must be greater than 0');
      return;
    }
    const badFields = contributionFields.filter(f => !f.name.trim());
    if (badFields.length > 0) { toast.error('All form fields must have a name'); return; }

    setIsLoading(true);
    try {
      let resolvedBanner = bannerUrl;
      if (bannerFile) {
        try {
          resolvedBanner = await uploadBanner(bannerFile);
        } catch {
          // Storage bucket may not be configured; keep current URL
          toast('Banner upload failed — existing image kept.', { icon: '⚠️' });
        }
      }

      const updateData: any = {
        title,
        deadline: deadline ? deadline.toISOString() : null,
        collectionType,
        updated_at: new Date().toISOString(),
      };

      if (!isFundraising) {
        updateData.description = description;
        updateData.max_contributions = (collectionType === 'fixed' || collectionType === 'flat' || (isTicket && priceTiers.length === 0)) ? (maxContributions || null) : null;
        updateData.contributions_fields = (contributionFields.length > 0) ? contributionFields : null;
        if (isFixedTicket) {
          updateData.amount = ticketAmount;
        }
        // Strip derived sold_quantity before saving — that field is computed at runtime, not persisted
        updateData.price_tiers = (collectionType === 'tiered' || isTicket)
          ? priceTiers.map(({ sold_quantity: _sq, ...tier }: any) => tier)
          : null;
      }

      if (isFundraising) {
        updateData.banner_url = resolvedBanner || null;
        updateData.campaign_summary = description;
        updateData.story = {
          what: storyWhat || null,
          why: storyWhy || null,
          impact: storyImpact || null,
        };
        // Upload pending story images
        const uploadedUrls: string[] = [];
        for (const { file } of pendingStoryFiles) {
          try {
            const url = await uploadStoryImage(file);
            uploadedUrls.push(url);
          } catch {
            toast('Some story images failed to upload.', { icon: '⚠️' });
          }
        }
        updateData.story_images = [...storyImageUrls, ...uploadedUrls];
      }
      if (isTicket) {
        updateData.banner_url = resolvedBanner || null;
        updateData.event_date = eventDate ? eventDate.toISOString() : null;
      }

      await updateCollection(collectionId, updateData);
      toast.success('Collection updated');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Tab config ────────────────────────────────────────────────────────────────
  // Fundraising: Basic | Story | (no Form Fields)
  // Ticket:      Basic | Settings
  // Others:      Basic | Settings | Form Fields
  const tabs = isFundraising
    ? ['basic', 'story']
    : ['basic', 'settings', 'fields'];

  const tabLabels: Record<string, string> = {
    basic: 'Basic Info', story: 'Story', settings: 'Settings', fields: 'Form Fields',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
          <DialogDescription>
            Changes take effect immediately. Financial settings are locked once contributions are received.
          </DialogDescription>
        </DialogHeader>

        {hasContributions && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {initialData.total_contributions} contribution(s) received — amounts and tiers are locked.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="basic">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(t => <TabsTrigger key={t} value={t}>{tabLabels[t]}</TabsTrigger>)}
          </TabsList>

          {/* ── BASIC INFO ─────────────────────────────────────────── */}
          <TabsContent value="basic" className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-title">Title *</Label>
              <Input
                id="ed-title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Collection title"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ed-desc">{isFundraising ? 'Summary / Tagline' : 'Description'}</Label>
              <Textarea
                id="ed-desc"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder={isFundraising ? 'Short summary shown on the campaign page' : 'Describe this collection'}
                rows={3}
              />
            </div>

            {/* Banner image — fundraising + ticket */}
            {(isFundraising || isTicket) && (
              <ImageUploader
                label={isTicket ? 'Event Banner Image' : 'Campaign Banner Image'}
                currentUrl={bannerUrl}
                onUrlChange={setBannerUrl}
                pendingFile={bannerFile}
                onFileChange={handleBannerFileChange}
                previewUrl={bannerPreview}
                hint="Upload a wide image (16:9 recommended). Accepted: JPG, PNG, WEBP."
              />
            )}

            {/* Event date — ticket only */}
            {isTicket && (
              <div className="space-y-1.5">
                <Label>Event Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !eventDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {eventDate ? format(eventDate, 'PPP') : 'Select event date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={eventDate} onSelect={setEventDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {isTicket ? 'Registration Deadline' : 'Deadline'}
                <span className="ml-1.5 text-xs text-gray-400 font-normal">(can be extended)</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !deadline && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, 'PPP') : 'No deadline set'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus />
                </PopoverContent>
              </Popover>
              {deadline && (
                <button type="button" className="text-xs text-gray-400 hover:text-red-500" onClick={() => setDeadline(undefined)}>
                  Remove deadline
                </button>
              )}
            </div>
          </TabsContent>

          {/* ── STORY (fundraising only) ───────────────────────────── */}
          {isFundraising && (
            <TabsContent value="story" className="space-y-5 pt-2">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Campaigns with a clear story raise significantly more. All fields are optional but recommended.
                </AlertDescription>
              </Alert>
              <div className="space-y-1.5">
                <Label htmlFor="story-what">What are you doing?</Label>
                <Textarea
                  id="story-what"
                  value={storyWhat}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryWhat(e.target.value)}
                  placeholder="Describe the project or cause in clear, simple terms…"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-why">Why does it matter?</Label>
                <Textarea
                  id="story-why"
                  value={storyWhy}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryWhy(e.target.value)}
                  placeholder="Explain the problem you're solving or why this cause is important…"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="story-impact">What will the impact be?</Label>
                <Textarea
                  id="story-impact"
                  value={storyImpact}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryImpact(e.target.value)}
                  placeholder="Describe what will change as a result of this campaign…"
                  rows={3}
                />
              </div>

              {/* Supporting images */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-1.5"><Upload className="h-4 w-4" /> Supporting Images</Label>
                    <p className="text-xs text-gray-400 mt-0.5">Up to 5 images shown in your campaign</p>
                  </div>
                  <span className="text-xs text-gray-400">{storyImageUrls.length + pendingStoryFiles.length}/5</span>
                </div>

                {/* Image grid — existing + pending */}
                {(storyImageUrls.length > 0 || pendingStoryFiles.length > 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {storyImageUrls.map((src, i) => (
                      <div key={`existing-${i}`} className="relative aspect-square">
                        <img src={src} alt={`Story image ${i + 1}`} className="w-full h-full object-cover rounded-lg border" onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.parentElement!.style.display = 'none'; }} />
                        <button type="button" onClick={() => removeStoryImageUrl(i)} className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:bg-red-50">
                          <X className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                    {pendingStoryFiles.map(({ localUrl }, i) => (
                      <div key={`pending-${i}`} className="relative aspect-square">
                        <img src={localUrl} alt={`New image ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-dashed border-kolekto" />
                        <button type="button" onClick={() => removePendingStoryFile(i)} className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:bg-red-50">
                          <X className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(storyImageUrls.length + pendingStoryFiles.length) < 5 && (
                  <button
                    type="button"
                    onClick={() => storyImgInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full h-14 border-2 border-dashed border-gray-300 rounded-xl hover:border-kolekto hover:bg-kolekto/5 transition-colors text-gray-500 text-sm"
                  >
                    <Upload className="h-4 w-4" /> Add photos
                  </button>
                )}

                <input ref={storyImgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleStoryImageAdd} />
              </div>
            </TabsContent>
          )}

          {/* ── SETTINGS (non-fundraising) ─────────────────────────── */}
          {!isFundraising && (
            <TabsContent value="settings" className="space-y-5 pt-2">
              {isFixedTicket && (
                <div className="space-y-1.5">
                  <Label htmlFor="ed-ticket-price">Ticket Price</Label>
                  <Input
                    id="ed-ticket-price"
                    type="number"
                    value={ticketAmount || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value ? parseFloat(e.target.value) : 0;
                      setTicketAmount(Number.isFinite(val) ? val : 0);
                    }}
                    placeholder="Enter ticket price"
                    min="1"
                    step="0.01"
                    disabled={hasContributions}
                  />
                  {hasContributions && (
                    <p className="text-xs text-gray-400">
                      Ticket price is locked after tickets have been sold.
                    </p>
                  )}
                </div>
              )}

              {(collectionType === 'fixed' || collectionType === 'flat' || (isTicket && priceTiers.length === 0)) && (
                <div className="space-y-1.5">
                  <Label htmlFor="ed-max">{isTicket ? 'Total Ticket Capacity' : 'Maximum Contributors'}</Label>
                  <Input
                    id="ed-max"
                    type="number"
                    value={maxContributions || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                      const minAllowed = initialData.total_contributions || 0;
                      if (val !== undefined && val < minAllowed) return;
                      setMaxContributions(val);
                    }}
                    placeholder="Leave empty for unlimited"
                    min={initialData.total_contributions || 1}
                  />
                  {(initialData.total_contributions || 0) > 0 && (
                    <p className="text-xs text-gray-400">
                      Minimum {initialData.total_contributions} (tickets already sold). You can only increase capacity.
                    </p>
                  )}
                </div>
              )}

              {(collectionType === 'tiered' || isTicket) && priceTiers.length > 0 && (
                <div className="space-y-3">
                  <Label>Price Tiers</Label>
                  {hasContributions && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>Tier prices are locked after contributions are received.</AlertDescription>
                    </Alert>
                  )}
                  {priceTiers.map((tier, index) => (
                    <div key={index} className="border rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Tier Name</Label>
                          <Input value={tier.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePriceTier(index, { name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            value={tier.price || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const val = e.target.value ? parseFloat(e.target.value) : 0;
                              updatePriceTier(index, { price: Number.isFinite(val) ? val : 0 });
                            }}
                            min="1"
                            step="0.01"
                            disabled={hasContributions}
                            className={hasContributions ? 'bg-gray-50 text-gray-500' : ''}
                          />
                        </div>
                      </div>
                      {hasContributions && (
                        <p className="text-xs text-gray-400">
                          Tier prices are locked after tickets have been sold.
                        </p>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea value={tier.description || ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePriceTier(index, { description: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Quantity Limit</Label>
                          {(tier.sold_quantity || 0) > 0 && (
                            <span className="text-xs text-amber-600 font-medium">
                              {tier.sold_quantity} sold
                            </span>
                          )}
                        </div>
                        <Input
                          type="number"
                          value={tier.quantity || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const val = e.target.value ? parseInt(e.target.value) : undefined;
                            const minAllowed = tier.sold_quantity || 0;
                            if (val !== undefined && val < minAllowed) return;
                            updatePriceTier(index, { quantity: val });
                          }}
                          placeholder="Unlimited"
                          min={tier.sold_quantity || 1}
                        />
                        {(tier.sold_quantity || 0) > 0 && (
                          <p className="text-xs text-gray-400">
                            Minimum {tier.sold_quantity} (tickets already sold). You can only increase capacity.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* ── FORM FIELDS (non-fundraising only) ─────────────────── */}
          {!isFundraising && (
            <TabsContent value="fields" className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label>Contribution Form Fields</Label>
                <Button type="button" variant="outline" size="sm" onClick={addContributionField}>
                  <Plus className="h-4 w-4 mr-1" /> Add Field
                </Button>
              </div>

              {contributionFields.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No custom fields. Contributors provide basic contact info only.
                </p>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {contributionFields.map(field => (
                    <div key={field.id} className="border rounded-xl p-4 space-y-3">
                      {/* Field name + delete */}
                      <div className="flex items-center gap-2">
                        <Input
                          value={field.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(field.id, { name: e.target.value })}
                          placeholder="Field name (e.g., Matric Number)"
                          className="flex-1"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeField(field.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>

                      {/* Type + Required */}
                      <div className="flex items-center gap-3">
                        <Select value={field.type} onValueChange={(v: any) => updateField(field.id, { type: v })}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="textarea">Long Text</SelectItem>
                            <SelectItem value="select">Dropdown</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2 ml-auto">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(c: boolean) => updateField(field.id, { required: c })}
                          />
                          <Label className="text-sm">Required</Label>
                        </div>
                      </div>

                      {/* Dropdown options — individual inputs */}
                      {field.type === 'select' && (
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Options</Label>
                          {(field.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <Input
                                value={opt}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateOption(field.id, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                                className="flex-1 text-sm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOption(field.id, optIdx)}
                              >
                                <X className="h-3.5 w-3.5 text-gray-400" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(field.id)}
                            className="w-full text-xs"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isLoading} className="bg-kolekto hover:bg-kolekto/90">
            {isLoading ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditCollectionDialog;

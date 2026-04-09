import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useCollectionStore } from '@/store';

import {
  WizardData,
  StepId,
  STEP_FLOWS,
  initialWizardData,
  CollectionType,
} from './wizardTypes';
import WizardStepper from './WizardStepper';
import { VerificationFile } from './steps/FundraisingVerificationStep';
import { StoryImageFile } from './steps/FundraisingStoryStep';
import { uploadVerificationDocuments, uploadStoryImages, uploadBannerImage } from '@/lib/storageUpload';

import Step1TypeSelection from './steps/Step1TypeSelection';
import Step2BasicInfo from './steps/Step2BasicInfo';
import Step3Pricing from './steps/Step3Pricing';
import Step4Charges from './steps/Step4Charges';
import Step5ContributorFields from './steps/Step5ContributorFields';
import Step6UniqueId from './steps/Step6UniqueId';
import FundraisingGoalStep from './steps/FundraisingGoalStep';
import FundraisingStoryStep from './steps/FundraisingStoryStep';
import FundraisingVerificationStep from './steps/FundraisingVerificationStep';
import ReviewStep from './steps/ReviewStep';

// ─── Validation per step ──────────────────────────────────────────────────────

const validateStep = (stepId: StepId, data: WizardData): string | null => {
  switch (stepId) {
    case 'type-selection':
      return null;

    case 'basic-info': {
      if (!data.title.trim()) return 'Please enter a title.';

      if (data.collection_type === 'ticket') {
        if (!data.event_date) return 'Please enter the event date.';
        if (!data.deadline) return 'Please enter the ticket sales deadline.';
        if (!data.description.trim()) return 'Please enter an event description.';
      } else if (data.collection_type === 'fundraising') {
        if (!data.campaign_summary.trim()) return 'Please enter a campaign summary.';
      } else {
        if (!data.deadline) return 'Please enter a deadline.';
        if (new Date(data.deadline) < new Date(new Date().toDateString()))
          return 'Deadline must be a future date.';
      }

      if (!data.support_phone) return 'Please enter a support phone number.';
      const isValidPhone = /^\+234\d{10}$/.test(data.support_phone);
      if (!isValidPhone) return 'Support number must be a valid Nigerian number (+234XXXXXXXXXX).';
      return null;
    }

    case 'pricing': {
      if (data.collection_type === 'fixed') {
        const amt = parseFloat(data.fixed_amount);
        if (!data.fixed_amount || isNaN(amt) || amt <= 100)
          return 'Please enter a valid amount greater than ₦100.';
      }
      if (data.collection_type === 'tiered') {
        for (const tier of data.pricing_tiers) {
          if (!tier.name.trim()) return 'Each tier must have a name.';
          const p = parseFloat(tier.price);
          if (!tier.price || isNaN(p) || p <= 100)
            return 'Each tier must have a price greater than ₦100.';
        }
      }
      if (data.collection_type === 'open_pool') {
        const min = parseFloat(data.min_amount);
        if (!data.min_amount || isNaN(min) || min <= 0)
          return 'Please enter a valid minimum amount.';
      }
      if (data.collection_type === 'ticket') {
        if (data.ticket_mode === 'fixed') {
          const p = parseFloat(data.ticket_price);
          if (!data.ticket_price || isNaN(p) || p <= 100)
            return 'Ticket price must be greater than ₦100.';
        } else {
          for (const tier of data.pricing_tiers) {
            if (!tier.name.trim()) return 'Each ticket tier must have a name.';
            const p = parseFloat(tier.price);
            if (!tier.price || isNaN(p) || p <= 100)
              return 'Each ticket tier must have a price greater than ₦100.';
          }
        }
      }
      return null;
    }

    case 'charges':
      return null;

    case 'contributor-fields': {
      const hasEmptyName = data.form_fields.some((f) => !f.name.trim());
      if (hasEmptyName) return 'All contributor fields must have a name.';
      const hasInvalidOptions = data.form_fields.some(
        (f) =>
          (f.type === 'select' || f.type === 'radio') &&
          (!f.options || f.options.length < 2 || f.options.some((o: string) => !o.trim()))
      );
      if (hasInvalidOptions)
        return 'Dropdown and radio fields must have at least 2 non-empty options.';
      return null;
    }

    case 'unique-id':
      return null;

    case 'fundraising-goal': {
      if (!data.fundraising_open_ended) {
        const t = parseFloat(data.fundraising_target);
        if (!data.fundraising_target || isNaN(t) || t <= 0)
          return 'Please enter a valid fundraising target or enable open-ended.';
      }
      return null;
    }

    case 'fundraising-story':
      return null;

    case 'fundraising-verification': {
      if (!data.campaign_category) return 'Please select a campaign category.';
      return null;
    }

    case 'review':
      return null;

    default:
      return null;
  }
};

// ─── Build API payload ────────────────────────────────────────────────────────
// Matches the create-collection Edge Function's expected body shape.

export interface VerificationDocPayload { url: string; name: string; }

const buildPayload = (
  data: WizardData,
  storyImages: string[],
  verificationDocs: VerificationDocPayload[],
  bannerUrl: string | null = null
) => {
  const isTicket = data.collection_type === 'ticket';
  const isTiered = data.collection_type === 'tiered';
  const isOpenPool = data.collection_type === 'open_pool';
  const isFundraising = data.collection_type === 'fundraising';
  const usesTiers = isTiered || (isTicket && data.ticket_mode === 'tiered');

  const price_tiers = usesTiers
    ? data.pricing_tiers.map((t) => ({
        id: t.id,
        name: t.name,
        price: parseFloat(t.price),
        description: t.description || null,
        quantity: t.quantity ? parseInt(t.quantity) : null,
        prefix: t.prefix || null,
      }))
    : null;

  // Primary amount field
  const amount = data.collection_type === 'fixed'
    ? parseFloat(data.fixed_amount) || 0
    : isTicket && data.ticket_mode === 'fixed'
    ? parseFloat(data.ticket_price) || 0
    : isOpenPool
    ? parseFloat(data.min_amount) || 0
    : 0;

  // Deadline: use collection deadline or fundraising deadline
  const deadlineIso = data.deadline
    ? new Date(data.deadline).toISOString()
    : data.fundraising_deadline
    ? new Date(data.fundraising_deadline).toISOString()
    : null;

  return {
    collection_type: data.collection_type,
    title: data.title,
    description: data.description || null,
    amount,
    price_tiers,
    target_amount:
      isFundraising && !data.fundraising_open_ended && data.fundraising_target
        ? parseFloat(data.fundraising_target)
        : isOpenPool && data.target_amount
        ? parseFloat(data.target_amount)
        : null,
    min_contribution: isOpenPool ? parseFloat(data.min_amount) || 0 : 0,
    max_contributions: data.max_contributors ? parseInt(data.max_contributors) : null,
    deadline: deadlineIso,
    fee_bearer: isFundraising || isOpenPool ? 'contributor' : data.fee_bearer,
    contributions_fields: isFundraising || isTicket ? [] : data.form_fields,
    code_prefix: (data.unique_id_enabled || isTicket) ? (data.unique_id_prefix || null) : null,
    unique_id_enabled: isTicket ? true : data.unique_id_enabled,
    ticket_mode: isTicket ? data.ticket_mode : null,
    allow_multiple_quantity: isTicket ? data.allow_multiple_quantity : null,
    event_date: isTicket && data.event_date ? new Date(data.event_date).toISOString() : null,
    is_open_ended: isOpenPool ? false : isFundraising ? data.fundraising_open_ended : false,
    auto_close: isFundraising ? data.fundraising_auto_close : false,
    story: isFundraising
      ? { what: data.story_what, why: data.story_why, impact: data.story_impact }
      : null,
    campaign_summary: isFundraising ? data.campaign_summary : null,
    campaign_category: isFundraising ? data.campaign_category : null,
    campaign_keywords: isFundraising ? data.campaign_keywords : null,
    campaign_country: isFundraising ? data.campaign_country : null,
    social_links: isFundraising
      ? data.social_links.filter((l) => l.url.trim())
      : null,
    support_phone: data.support_phone || null,
    story_images: isFundraising ? storyImages : null,
    banner_url: bannerUrl || null,
    // Pass as [{url, name}] so the edge function can save proper document names
    verification_documents: isFundraising
      ? verificationDocs.map((d) => ({ url: d.url, name: d.name }))
      : null,
  };
};

// ─── Main Wizard Component ────────────────────────────────────────────────────

const CreateCollectionWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createCollection } = useCollectionStore();

  const [data, setData] = useState<WizardData>({ ...initialWizardData });
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initDone, setInitDone] = useState(false);

  // File state managed separately (not serialised in WizardData for cleanliness)
  const [storyImages, setStoryImages] = useState<string[]>([]);
  const [storyImageFiles, setStoryImageFiles] = useState<StoryImageFile[]>([]);
  const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
  const [verificationFiles, setVerificationFiles] = useState<VerificationFile[]>([]);

  const location = window.location;

  React.useEffect(() => {
    if (!initDone) {
      const params = new URLSearchParams(location.search);
      const typeParam = params.get('type') as CollectionType;
      
      if (typeParam && STEP_FLOWS[typeParam]) {
        setData(d => ({ ...d, collection_type: typeParam }));
      }
      
      const historyState = window.history.state as any;
      const skipToBasicInfo = historyState?.usr?.skipToBasicInfo;
      
      if (skipToBasicInfo) {
        setStepIndex(1); // skip to basic-info
      }
      setInitDone(true);
    }
  }, [location.search, initDone]);

  const update = (updates: Partial<WizardData>) => setData((d) => ({ ...d, ...updates }));

  // Recalculate steps when type changes
  const steps = STEP_FLOWS[data.collection_type];
  const currentStepId = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  // When collection type changes, reset to step 1 but keep type
  const handleTypeChange = (type: CollectionType) => {
    setData({ ...initialWizardData, collection_type: type });
    setStoryImages([]);
    setStoryImageFiles([]);
    setVerificationDocs([]);
    setVerificationFiles([]);
    // Stay on step 1 (type selection), don't advance
  };

  const goNext = () => {
    const error = validateStep(currentStepId, data);
    if (error) {
      toast.error(error);
      return;
    }
    if (!isLast) setStepIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (!isFirst) setStepIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to create a collection.');
      return;
    }
    setIsSubmitting(true);
    try {
      let finalStoryImageUrls: string[] = storyImages;
      // Build VerificationDocPayload[] from existing files (name comes from verificationFiles metadata)
      let finalVerificationDocs: VerificationDocPayload[] = verificationDocs.map(
        (url, i) => ({ url, name: verificationFiles[i]?.name || `Document ${i + 1}` })
      );

      const tempCollectionId = `temp-${Date.now()}`;
      let finalBannerUrl: string | null = null;

      // Upload banner image (ticket or fundraising)
      const isFundraisingType = data.collection_type === 'fundraising';
      const isTicketType = data.collection_type === 'ticket';
      const bannerPreview = isFundraisingType
        ? data.campaign_banner_preview
        : isTicketType
        ? data.ticket_banner_preview
        : '';

      if (bannerPreview && bannerPreview.startsWith('data:')) {
        try {
          finalBannerUrl = await uploadBannerImage(bannerPreview, tempCollectionId);
        } catch (err) {
          console.warn('Banner upload failed, will use preview fallback:', err);
          finalBannerUrl = bannerPreview; // store base64 as fallback
        }
      }

      // For fundraising collections, upload story images & verification docs
      if (isFundraisingType) {
        if (verificationFiles.length > 0) {
          const docResults = await uploadVerificationDocuments(verificationFiles, tempCollectionId);
          finalVerificationDocs = docResults.map(
            (r: { url: string; name: string }) => ({ url: r.url, name: r.name })
          );
        }

        if (storyImageFiles.length > 0) {
          const imageResults = await uploadStoryImages(storyImageFiles, tempCollectionId);
          finalStoryImageUrls = imageResults.map((r: { url: string }) => r.url);
        }
      }

      const payload = buildPayload(data, finalStoryImageUrls, finalVerificationDocs, finalBannerUrl);
      await createCollection(payload as any);
      toast.success(
        data.collection_type === 'fundraising'
          ? 'Campaign submitted for review! We\'ll notify you within 24–48 hours.'
          : 'Collection created successfully!'
      );
      navigate('/dashboard/collections');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'An error occurred while creating the collection.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render active step ────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStepId) {
      case 'type-selection':
        return (
          <Step1TypeSelection
            value={data.collection_type}
            onChange={handleTypeChange}
          />
        );
      case 'basic-info':
        return <Step2BasicInfo data={data} onChange={update} />;
      case 'pricing':
        return <Step3Pricing data={data} onChange={update} />;
      case 'charges':
        return <Step4Charges data={data} onChange={update} />;
      case 'contributor-fields':
        return <Step5ContributorFields data={data} onChange={update} />;
      case 'unique-id':
        return <Step6UniqueId data={data} onChange={update} />;
      case 'fundraising-goal':
        return <FundraisingGoalStep data={data} onChange={update} />;
      case 'fundraising-story':
        return (
          <FundraisingStoryStep
            data={data}
            onChange={update}
            storyImages={storyImages}
            storyImageFiles={storyImageFiles}
            onImagesChange={setStoryImages}
            onImageFilesChange={setStoryImageFiles}
          />
        );
      case 'fundraising-verification':
        return (
          <FundraisingVerificationStep
            data={data}
            onChange={update}
            verificationDocs={verificationDocs}
            verificationFiles={verificationFiles}
            onDocsChange={setVerificationDocs}
            onFilesChange={setVerificationFiles}
          />
        );
      case 'review':
        return (
          <ReviewStep
            data={data}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onBack={goPrev}
            onCancel={() => navigate('/dashboard/collections')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress stepper */}
      <div className="mb-8">
        <WizardStepper steps={steps} currentIndex={stepIndex} />
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      {/* Navigation footer */}
      {currentStepId !== 'review' && (
        <div className="mt-8 flex items-center justify-between gap-4 pt-6 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={isFirst}
            className="flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex-1 text-center">
            <span className="text-xs text-gray-400">
              Step {stepIndex + 1} of {steps.length}
            </span>
          </div>

          <Button
            type="button"
            onClick={goNext}
            className="bg-green-700 hover:bg-green-800 text-white flex items-center gap-1.5"
          >
            {stepIndex === steps.length - 2 ? 'Review' : 'Continue'}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CreateCollectionWizard;

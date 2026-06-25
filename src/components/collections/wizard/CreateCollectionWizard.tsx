import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from "@/lib/toast";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore, useCollectionDraftStore, useCollectionStore } from '@/store';
import CollectionPublishAuthPrompt from '@/components/collections/CollectionPublishAuthPrompt';
import { toFriendlyErrorMessage } from '@/utils/errorMessages';
import {
  CollectionType,
  STEP_FLOWS,
  StepId,
  WizardData,
  createInitialWizardData,
  hasWizardDraftContent,
} from './wizardTypes';
import WizardStepper from './WizardStepper';
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
import type { VerificationFile } from './steps/FundraisingVerificationStep';
import type { StoryImageFile } from './steps/FundraisingStoryStep';
import {
  uploadBannerImage,
  uploadStoryImages,
  uploadVerificationDocuments,
} from '@/lib/storageUpload';

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
        if (new Date(data.deadline) < new Date(new Date().toDateString())) {
          return 'Deadline must be a future date.';
        }
      }

      if (!data.support_phone) return 'Please enter a support phone number.';
      const isValidPhone = /^\+234\d{10}$/.test(data.support_phone);
      if (!isValidPhone) {
        return 'Support number must be a valid Nigerian number (+234XXXXXXXXXX).';
      }
      return null;
    }

    case 'pricing': {
      if (data.collection_type === 'fixed') {
        const amount = parseFloat(data.fixed_amount);
        if (!data.fixed_amount || Number.isNaN(amount) || amount <= 100) {
          return 'Please enter a valid amount greater than N100.';
        }
      }

      if (data.collection_type === 'tiered') {
        for (const tier of data.pricing_tiers) {
          if (!tier.name.trim()) return 'Each tier must have a name.';
          const price = parseFloat(tier.price);
          if (!tier.price || Number.isNaN(price) || price <= 100) {
            return 'Each tier must have a price greater than N100.';
          }
        }
      }

      if (data.collection_type === 'open_pool') {
        const minimum = parseFloat(data.min_amount);
        if (!data.min_amount || Number.isNaN(minimum) || minimum <= 0) {
          return 'Please enter a valid minimum amount.';
        }
      }

      if (data.collection_type === 'ticket') {
        if (data.ticket_mode === 'fixed') {
          const price = parseFloat(data.ticket_price);
          if (!data.ticket_price || Number.isNaN(price) || price <= 100) {
            return 'Ticket price must be greater than N100.';
          }
        } else {
          for (const tier of data.pricing_tiers) {
            if (!tier.name.trim()) return 'Each ticket tier must have a name.';
            const price = parseFloat(tier.price);
            if (!tier.price || Number.isNaN(price) || price <= 100) {
              return 'Each ticket tier must have a price greater than N100.';
            }
          }
        }
      }
      return null;
    }

    case 'charges':
      return null;

    case 'contributor-fields': {
      const hasEmptyName = data.form_fields.some((field) => !field.name.trim());
      if (hasEmptyName) return 'All contributor fields must have a name.';

      const hasInvalidOptions = data.form_fields.some(
        (field) =>
          (field.type === 'select' || field.type === 'radio') &&
          (!field.options || field.options.length < 2 || field.options.some((option: string) => !option.trim()))
      );

      if (hasInvalidOptions) {
        return 'Dropdown and radio fields must have at least 2 non-empty options.';
      }
      return null;
    }

    case 'unique-id': {
      if (!data.unique_id_enabled) return null;

      const isTicketStep = data.collection_type === 'ticket';
      const usesTierPrefixes =
        data.collection_type === 'tiered' || (isTicketStep && data.ticket_mode === 'tiered');

      if (usesTierPrefixes) {
        const hasAnyTierPrefix = data.pricing_tiers.some((tier) => tier.prefix.trim());
        if (!hasAnyTierPrefix) {
          return 'Add a prefix to at least one tier, or turn off unique IDs for this collection.';
        }
      } else if (!data.unique_id_prefix.trim()) {
        return isTicketStep
          ? 'Add a prefix to generate ticket IDs, or turn off this toggle.'
          : 'Add a prefix to generate unique IDs, or turn off this toggle.';
      }
      return null;
    }

    case 'fundraising-goal': {
      if (!data.fundraising_open_ended) {
        const target = parseFloat(data.fundraising_target);
        if (!data.fundraising_target || Number.isNaN(target) || target <= 0) {
          return 'Please enter a valid fundraising target or enable open-ended.';
        }
      }
      return null;
    }

    case 'fundraising-story':
      return null;

    case 'fundraising-verification':
      if (!data.campaign_category) return 'Please select a campaign category.';
      return null;

    case 'review':
      return null;

    default:
      return null;
  }
};

export interface VerificationDocPayload {
  url: string;
  name: string;
}

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

  const priceTiers = usesTiers
    ? data.pricing_tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        price: parseFloat(tier.price),
        description: tier.description || null,
        quantity: tier.quantity ? parseInt(tier.quantity, 10) : null,
        prefix: tier.prefix || null,
      }))
    : null;
  const amount =
    data.collection_type === 'fixed'
      ? parseFloat(data.fixed_amount) || 0
      : isTicket && data.ticket_mode === 'fixed'
        ? parseFloat(data.ticket_price) || 0
        : isOpenPool
          ? parseFloat(data.min_amount) || 0
          : 0;

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
    price_tiers: priceTiers,
    target_amount:
      isFundraising && !data.fundraising_open_ended && data.fundraising_target
        ? parseFloat(data.fundraising_target)
        : isOpenPool && data.target_amount
          ? parseFloat(data.target_amount)
          : null,
    min_contribution: isOpenPool ? parseFloat(data.min_amount) || 0 : 0,
    max_contributions: data.max_contributors ? parseInt(data.max_contributors, 10) : null,
    deadline: deadlineIso,
    fee_bearer: isFundraising || isOpenPool ? 'contributor' : data.fee_bearer,
    contributions_fields: isFundraising || isTicket ? [] : data.form_fields,
    // unique_id_enabled is saved exactly as the organizer set it — it must
    // not be silently downgraded to false just because no prefix was typed
    // yet (a prior regression conflated "feature enabled" with "prefix
    // configured", which prevented the toggle from ever reaching the DB).
    code_prefix: data.unique_id_enabled && data.unique_id_prefix ? data.unique_id_prefix : null,
    unique_id_enabled: data.unique_id_enabled,
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
    social_links: isFundraising ? data.social_links.filter((link) => link.url.trim()) : null,
    support_phone: data.support_phone || null,
    story_images: isFundraising ? storyImages : null,
    banner_url: bannerUrl || null,
    verification_documents: isFundraising
      ? verificationDocs.map((doc) => ({ url: doc.url, name: doc.name }))
      : null,
  };
};

interface CreateCollectionWizardProps {
  cancelPath?: string;
  redirectToAuthPath?: string;
}

const CreateCollectionWizard: React.FC<CreateCollectionWizardProps> = ({
  cancelPath = '/dashboard/collections',
  redirectToAuthPath = '/create-collection',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { createCollection } = useCollectionStore();
  const {
    data,
    stepIndex,
    storyImageFiles,
    verificationFiles,
    publishIntent,
    hasHydrated,
    setDraftData,
    setStepIndex,
    setStoryImageFiles,
    setVerificationFiles,
    requestPublish,
    clearPublishIntent,
    resetDraft,
  } = useCollectionDraftStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const autoPublishTriggeredRef = useRef(false);

  const storyImages = storyImageFiles.map((file) => file.dataUrl);
  const verificationDocs = verificationFiles.map((file) => file.dataUrl);
  const steps = STEP_FLOWS[data.collection_type];
  const currentStepId = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const shouldResumePublish = new URLSearchParams(location.search).get('resumePublish') === '1';
  const hasSavedDraft = hasWizardDraftContent(data, storyImageFiles, verificationFiles, stepIndex);

  useEffect(() => {
    if (!hasHydrated || initDone) return;

    const params = new URLSearchParams(location.search);
    const typeParam = params.get('type') as CollectionType | null;
    const skipToBasicInfo = Boolean((window.history.state as { usr?: { skipToBasicInfo?: boolean } } | null)?.usr?.skipToBasicInfo);
    const hasDraft = hasWizardDraftContent(data, storyImageFiles, verificationFiles, stepIndex);

    if (!hasDraft && typeParam && STEP_FLOWS[typeParam]) {
      setDraftData({ collection_type: typeParam });
    }

    if (!hasDraft && skipToBasicInfo) {
      setStepIndex(1);
    }

    setInitDone(true);
  }, [
    data,
    hasHydrated,
    initDone,
    location.search,
    setDraftData,
    setStepIndex,
    stepIndex,
    storyImageFiles,
    verificationFiles,
  ]);

  useEffect(() => {
    if (
      !user ||
      !publishIntent ||
      !shouldResumePublish ||
      !hasHydrated ||
      isSubmitting ||
      autoPublishTriggeredRef.current
    ) {
      return;
    }

    autoPublishTriggeredRef.current = true;
    void handlePublish(true);
  }, [hasHydrated, isSubmitting, publishIntent, shouldResumePublish, user]);

  useEffect(() => {
    if (!hasHydrated || !shouldResumePublish || publishIntent || !hasSavedDraft) {
      return;
    }

    requestPublish();
  }, [hasHydrated, hasSavedDraft, publishIntent, requestPublish, shouldResumePublish]);

  const update = (updates: Partial<WizardData>) => {
    setDraftData(updates);
  };

  const handleTypeChange = (type: CollectionType) => {
    resetDraft(type);
  };

  const goNext = () => {
    const error = validateStep(currentStepId, data);
    if (error) {
      toast.error(error);
      return;
    }

    if (!isLast) {
      setStepIndex(stepIndex + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) {
      setStepIndex(stepIndex - 1);
    }
  };

  const publishCollection = async () => {
    let finalStoryImageUrls: string[] = storyImages;
    let finalVerificationDocs: VerificationDocPayload[] = verificationFiles.map((file) => ({
      url: file.dataUrl,
      name: file.name,
    }));

    const tempCollectionId = `temp-${Date.now()}`;
    let finalBannerUrl: string | null = null;
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
      } catch (error) {
        console.warn('Banner upload failed, using preview fallback.', error);
        finalBannerUrl = bannerPreview;
      }
    }

    if (isFundraisingType) {
      if (verificationFiles.length > 0) {
        const docResults = await uploadVerificationDocuments(verificationFiles, tempCollectionId);
        finalVerificationDocs = docResults.map((result) => ({
          url: result.url,
          name: result.name,
        }));
      }

      if (storyImageFiles.length > 0) {
        const imageResults = await uploadStoryImages(storyImageFiles, tempCollectionId);
        finalStoryImageUrls = imageResults.map((result) => result.url);
      }
    }

    const payload = buildPayload(data, finalStoryImageUrls, finalVerificationDocs, finalBannerUrl);
    return createCollection(payload as never);
  };

  const handlePublish = async (isAutoTriggered = false) => {
    if (isSubmitting) return;

    if (!user) {
      requestPublish();
      setIsAuthPromptOpen(true);
      return;
    }

    clearPublishIntent();
    setIsSubmitting(true);

    const isFundraising = data.collection_type === 'fundraising';
    // A single stable toast id: the loading toast is replaced in-place by the
    // success or error toast, so a submit can never stack duplicate popups and
    // the user always gets exactly one piece of feedback (no silent failure).
    const toastId = 'collection-publish';
    toast.loading(
      isFundraising ? 'Submitting your campaign for review…' : 'Creating your collection…',
      { id: toastId }
    );

    try {
      const newCollection = await publishCollection();
      toast.success(
        isFundraising ? 'Campaign submitted for review' : 'Collection created successfully',
        { id: toastId }
      );
      resetDraft();
      autoPublishTriggeredRef.current = false;
      navigate(`/dashboard/collections/${newCollection.id}`);
    } catch (error: any) {
      const message = toFriendlyErrorMessage(error, 'Could not create collection. Please try again.');
      if (isAutoTriggered) {
        autoPublishTriggeredRef.current = false;
      }
      toast.error(message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthPromptOpenChange = (open: boolean) => {
    setIsAuthPromptOpen(open);
    if (!open) {
      clearPublishIntent();
      autoPublishTriggeredRef.current = false;
    }
  };

  const renderStep = () => {
    switch (currentStepId) {
      case 'type-selection':
        return <Step1TypeSelection value={data.collection_type} onChange={handleTypeChange} />;
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
            storyImageFiles={storyImageFiles as StoryImageFile[]}
            onImagesChange={() => undefined}
            onImageFilesChange={(files) => setStoryImageFiles(files)}
          />
        );
      case 'fundraising-verification':
        return (
          <FundraisingVerificationStep
            data={data}
            onChange={update}
            verificationDocs={verificationDocs}
            verificationFiles={verificationFiles as VerificationFile[]}
            onDocsChange={() => undefined}
            onFilesChange={(files) => setVerificationFiles(files)}
          />
        );
      case 'review':
        return (
          <ReviewStep
            data={data}
            isSubmitting={isSubmitting}
            isAuthenticated={Boolean(user)}
            onSubmit={() => void handlePublish()}
            onBack={goPrev}
            onCancel={() => navigate(cancelPath)}
          />
        );
      default:
        return null;
    }
  };

  if (!hasHydrated) {
    return (
      <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-2 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <WizardStepper steps={steps} currentIndex={stepIndex} />
        </div>

        <div className="min-h-[400px]">{renderStep()}</div>

        {currentStepId !== 'review' && (
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-gray-100 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={goPrev}
              disabled={isFirst}
              className="flex items-center gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
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
              className="flex items-center gap-1.5 bg-green-700 text-white hover:bg-green-800"
            >
              {stepIndex === steps.length - 2 ? 'Review' : 'Continue'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <CollectionPublishAuthPrompt
        open={isAuthPromptOpen}
        onOpenChange={handleAuthPromptOpenChange}
        redirectTo={redirectToAuthPath}
      />
    </>
  );
};

export default CreateCollectionWizard;

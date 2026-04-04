import { FormField } from '@/types';

export type CollectionType = 'fixed' | 'tiered' | 'open_pool' | 'ticket' | 'fundraising';

export type StepId =
  | 'type-selection'
  | 'basic-info'
  | 'pricing'
  | 'charges'
  | 'contributor-fields'
  | 'unique-id'
  | 'fundraising-goal'
  | 'fundraising-story'
  | 'fundraising-verification'
  | 'review';

export const STEP_LABELS: Record<StepId, string> = {
  'type-selection': 'Collection Type',
  'basic-info': 'Basic Info',
  'pricing': 'Pricing',
  'charges': 'Charges',
  'contributor-fields': 'Contributor Fields',
  'unique-id': 'Unique ID',
  'fundraising-goal': 'Campaign Goal',
  'fundraising-story': 'Campaign Story',
  'fundraising-verification': 'Verification',
  'review': 'Review',
};

export const STEP_FLOWS: Record<CollectionType, StepId[]> = {
  fixed: ['type-selection', 'basic-info', 'pricing', 'charges', 'contributor-fields', 'unique-id', 'review'],
  tiered: ['type-selection', 'basic-info', 'pricing', 'charges', 'contributor-fields', 'unique-id', 'review'],
  open_pool: ['type-selection', 'basic-info', 'pricing', 'contributor-fields', 'unique-id', 'review'],
  ticket: ['type-selection', 'basic-info', 'pricing', 'charges', 'contributor-fields', 'unique-id', 'review'],
  fundraising: ['type-selection', 'basic-info', 'fundraising-goal', 'fundraising-story', 'fundraising-verification', 'review'],
};

export interface WizardTier {
  id: string;
  name: string;
  price: string;
  description: string;
  quantity: string;
  prefix: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface WizardData {
  // Step 1
  collection_type: CollectionType;

  // Step 2 – Basic Info (shared)
  title: string;
  description: string;
  deadline: string;
  support_phone: string;

  // Ticket-specific basic info
  event_date: string;
  ticket_banner_preview: string;
  ticket_template_preview: string;

  // Fundraising-specific basic info
  campaign_banner_preview: string;
  campaign_summary: string;

  // Step 3 – Pricing
  fixed_amount: string;
  max_contributors: string;
  pricing_tiers: WizardTier[];
  min_amount: string;
  target_amount: string;
  ticket_mode: 'fixed' | 'tiered';
  ticket_price: string;
  allow_multiple_quantity: boolean;

  // Step 4 – Charges
  fee_bearer: 'contributor' | 'organizer';

  // Step 5 – Contributor Fields
  form_fields: FormField[];

  // Step 6 – Unique ID
  unique_id_enabled: boolean;
  unique_id_prefix: string;

  // Fundraising Goal
  fundraising_target: string;
  fundraising_open_ended: boolean;
  fundraising_deadline: string;
  fundraising_auto_close: boolean;

  // Fundraising Story
  story_what: string;
  story_why: string;
  story_impact: string;

  // Fundraising Verification
  campaign_category: string;
  campaign_keywords: string;
  campaign_phone: string;
  campaign_country: string;
  social_links: SocialLink[];
}

export const initialWizardData: WizardData = {
  collection_type: 'fixed',
  title: '',
  description: '',
  deadline: '',
  support_phone: '',
  event_date: '',
  ticket_banner_preview: '',
  ticket_template_preview: '',
  campaign_banner_preview: '',
  campaign_summary: '',
  fixed_amount: '',
  max_contributors: '',
  pricing_tiers: [{ id: '1', name: '', price: '', description: '', quantity: '', prefix: '' }],
  min_amount: '',
  target_amount: '',
  ticket_mode: 'fixed',
  ticket_price: '',
  allow_multiple_quantity: true,
  fee_bearer: 'contributor',
  form_fields: [{ id: '1', name: '', type: 'text', required: false }],
  unique_id_enabled: false,
  unique_id_prefix: '',
  fundraising_target: '',
  fundraising_open_ended: false,
  fundraising_deadline: '',
  fundraising_auto_close: false,
  story_what: '',
  story_why: '',
  story_impact: '',
  campaign_category: '',
  campaign_keywords: '',
  campaign_phone: '',
  campaign_country: 'Nigeria',
  social_links: [{ platform: 'twitter', url: '' }],
};

// Fee calculation utility
export const calculateFees = (
  amount: number,
  collectionType: CollectionType,
  feeBearer: 'contributor' | 'organizer'
) => {
  if (!amount || isNaN(amount) || amount <= 0) {
    return { kolektoFee: 0, gatewayFee: 0, totalFees: 0, totalPayable: amount || 0 };
  }
  const kolektoRate = collectionType === 'fundraising' ? 0.01 : 0.005;
  const kolektoFee = Math.min(amount * kolektoRate, 2000);
  const gatewayFee = Math.min(amount * 0.015, 2000);
  const totalFees = kolektoFee + gatewayFee;
  const totalPayable = feeBearer === 'contributor' ? amount + totalFees : amount;
  return { kolektoFee, gatewayFee, totalFees, totalPayable };
};

export const fmtCurrency = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const sanitizeCurrency = (input: string) => {
  const clean = input.replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = clean.split('.');
  const intPart = (parts[0] || '').replace(/^0+(?!$)/, '') || '0';
  return parts.length > 1 ? `${intPart}.${parts[1].slice(0, 2)}` : intPart === '0' ? '' : intPart;
};

export const displayCurrency = (raw: string) => {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
};

export const TYPE_META: Record<CollectionType, { label: string; tagline: string; icon: string; color: string }> = {
  fixed: {
    label: 'Fixed Collection',
    tagline: 'One price for all contributors',
    icon: '🔒',
    color: 'blue',
  },
  tiered: {
    label: 'Tiered Collection',
    tagline: 'Multiple pricing categories',
    icon: '🎚️',
    color: 'purple',
  },
  open_pool: {
    label: 'Open Pool',
    tagline: 'Contributors choose their amount',
    icon: '🌊',
    color: 'cyan',
  },
  ticket: {
    label: 'Ticket Collection',
    tagline: 'Event tickets with QR codes',
    icon: '🎟️',
    color: 'orange',
  },
  fundraising: {
    label: 'Fundraising',
    tagline: 'Campaign-style crowdfunding',
    icon: '❤️',
    color: 'rose',
  },
};

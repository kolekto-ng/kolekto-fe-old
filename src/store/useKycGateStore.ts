import { create } from 'zustand';

/**
 * The gate that blocked the user, as reported by the backend's `feature`
 * field. Used only to title the modal — never to make an access decision,
 * which is always the backend's call.
 */
export type KycGatedFeature =
  | 'create_collection'
  | 'manage_bank_account'
  | 'withdraw'
  | 'publish_collection';

// Tiny, UI-only store so non-component code (the axios response interceptor)
// can trigger the shared "Identity verification required" modal without
// reaching into React state directly. No KYC business logic lives here —
// it only remembers "should the modal be open, and with what message".
interface KycGateState {
  isOpen: boolean;
  message: string | null;
  feature: KycGatedFeature | null;
  open: (message?: string, feature?: string) => void;
  close: () => void;
}

const KNOWN_FEATURES: KycGatedFeature[] = [
  'create_collection',
  'manage_bank_account',
  'withdraw',
  'publish_collection',
];

/** Only accept feature names we actually render copy for; ignore anything else. */
function normalizeFeature(feature?: string): KycGatedFeature | null {
  return KNOWN_FEATURES.includes(feature as KycGatedFeature)
    ? (feature as KycGatedFeature)
    : null;
}

export const useKycGateStore = create<KycGateState>((set) => ({
  isOpen: false,
  message: null,
  feature: null,
  open: (message, feature) =>
    set({
      isOpen: true,
      message: message || 'Complete identity verification before using this feature.',
      feature: normalizeFeature(feature),
    }),
  close: () => set({ isOpen: false }),
}));

export default useKycGateStore;

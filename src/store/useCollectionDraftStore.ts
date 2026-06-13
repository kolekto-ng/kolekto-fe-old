import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  createInitialWizardData,
  type CollectionType,
  type DraftUploadFile,
  type WizardData,
} from '@/components/collections/wizard/wizardTypes';

interface CollectionDraftState {
  data: WizardData;
  stepIndex: number;
  storyImageFiles: DraftUploadFile[];
  verificationFiles: DraftUploadFile[];
  publishIntent: boolean;
  hasHydrated: boolean;
  setDraftData: (updates: Partial<WizardData>) => void;
  replaceDraftData: (data: WizardData) => void;
  setStepIndex: (stepIndex: number) => void;
  setStoryImageFiles: (files: DraftUploadFile[]) => void;
  setVerificationFiles: (files: DraftUploadFile[]) => void;
  requestPublish: () => void;
  clearPublishIntent: () => void;
  resetDraft: (collectionType?: CollectionType) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const initialState = () => ({
  data: createInitialWizardData(),
  stepIndex: 0,
  storyImageFiles: [] as DraftUploadFile[],
  verificationFiles: [] as DraftUploadFile[],
  publishIntent: false,
});

export const useCollectionDraftStore = create<CollectionDraftState>()(
  persist(
    (set) => ({
      ...initialState(),
      hasHydrated: false,
      setDraftData: (updates) =>
        set((state) => ({
          data: { ...state.data, ...updates },
        })),
      replaceDraftData: (data) =>
        set(() => ({
          data,
        })),
      setStepIndex: (stepIndex) => set(() => ({ stepIndex })),
      setStoryImageFiles: (storyImageFiles) => set(() => ({ storyImageFiles })),
      setVerificationFiles: (verificationFiles) => set(() => ({ verificationFiles })),
      requestPublish: () => set(() => ({ publishIntent: true })),
      clearPublishIntent: () => set(() => ({ publishIntent: false })),
      resetDraft: (collectionType = 'fixed') =>
        set(() => ({
          ...initialState(),
          data: createInitialWizardData(collectionType),
        })),
      setHasHydrated: (hasHydrated) => set(() => ({ hasHydrated })),
    }),
    {
      name: 'kolekto-collection-draft',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        data: state.data,
        stepIndex: state.stepIndex,
        storyImageFiles: state.storyImageFiles,
        verificationFiles: state.verificationFiles,
        publishIntent: state.publishIntent,
      }),
    }
  )
);

import { create } from 'zustand';

interface FundraisingState {
    // Step 1: Basics
    title: string;
    image: File | null;
    imagePreview: string | null;
    summary: string;

    // Step 2: Goals
    minContribution: string;
    targetAmount: string;
    isOpenEnded: boolean;
    deadline: Date | null;

    // Step 3: Story
    storyFor: string;
    storyWhy: string;
    storyAchieve: string;
    supportingImages: File[];
    supportingImagePreviews: string[];

    // Step 4: Verification
    verificationDocs: File[];
    category: string;
    keywords: string;
    phoneNumber: string;
    countryCode: string;
    country: string;
    city: string;
    socials: {
        twitter: string;
        instagram: string;
        facebook: string;
    };

    // Navigation
    currentStep: number;

    // Actions
    setField: (field: keyof FundraisingState, value: any) => void;
    setSocial: (platform: 'twitter' | 'instagram' | 'facebook', value: string) => void;
    nextStep: () => void;
    prevStep: () => void;
    reset: () => void;
}

export const useFundraisingStore = create<FundraisingState>((set) => ({
    // Initial State
    title: '',
    image: null,
    imagePreview: null,
    summary: '',

    minContribution: '',
    targetAmount: '',
    isOpenEnded: false,
    deadline: null,

    storyFor: '',
    storyWhy: '',
    storyAchieve: '',
    supportingImages: [],
    supportingImagePreviews: [],

    verificationDocs: [],
    category: '',
    keywords: '',
    phoneNumber: '',
    countryCode: 'US +1',
    country: 'Nigeria',
    city: '',
    socials: {
        twitter: '',
        instagram: '',
        facebook: '',
    },

    currentStep: 1,

    // Actions
    setField: (field, value) => set((state) => ({ ...state, [field]: value })),

    setSocial: (platform, value) => set((state) => ({
        socials: { ...state.socials, [platform]: value }
    })),

    nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, 5)
    })),

    prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 1)
    })),

    reset: () => set({
        title: '',
        image: null,
        imagePreview: null,
        summary: '',
        minContribution: '',
        targetAmount: '',
        isOpenEnded: false,
        deadline: null,
        storyFor: '',
        storyWhy: '',
        storyAchieve: '',
        supportingImages: [],
        supportingImagePreviews: [],
        verificationDocs: [],
        category: '',
        keywords: '',
        phoneNumber: '',
        countryCode: 'US +1',
        country: '',
        city: '',
        socials: {
            twitter: '',
            instagram: '',
            facebook: '',
        },
        currentStep: 1,
    }),
}));

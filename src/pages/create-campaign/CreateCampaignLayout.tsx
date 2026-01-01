import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFundraisingStore } from '@/store/useFundraisingStore';
import Basics from './steps/Basics';
import FundraisingGoals from './steps/FundraisingGoals';
import CampaignStory from './steps/CampaignStory';
import Verification from './steps/Verification';
import LivePreview from './steps/LivePreview';

const CreateCampaignLayout = () => {
    const navigate = useNavigate();
    const { currentStep, reset } = useFundraisingStore();

    useEffect(() => {
        // Reset store on mount (optional, or rely on explicit user reset)
        // reset(); 
        // Keeping data might be better for accidental closures, sticking to no reset for now
    }, []);

    const handleClose = () => {
        if (confirm('Are you sure you want to exit? Unsaved changes will be lost.')) {
            reset();
            navigate('/dashboard/collections');
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <Basics />;
            case 2:
                return <FundraisingGoals />;
            case 3:
                return <CampaignStory />;
            case 4:
                return <Verification />;
            case 5:
                return <LivePreview />;
            default:
                return <Basics />;
        }
    };

    // Only show progress bar for steps 1-4 (as per design 1st screen)
    // Design 1st screen: "Basics Step 1 of 4"
    // So likely the preview is a separate "state" visually or just the final confirmation.
    // The provided HTMLs show headers for each step essentially.
    // I will delegate the header rendering to the step components to match the provided HTML exactly,
    // as each HTML has a slightly different header structure (some have progress bars, some dont).
    // Actually, looking at the provided HTMLs:
    // Screen 1 (Basics): Has header with Close btn. Has progress bar.
    // Screen 2 (Goals): Has header with Close btn. No progress bar shown in snippet, but likely needs one for consistency? 
    // Wait, Screen 2 snippet has "Fundraising goals" header. 
    // Screen 3 (Story): "Campaign Story" header.
    // Screen 4 (Verification): "Internal Verification" header with Back button instead of Close? 
    // Screen 5 (Preview): "Live Preview" with Back button.

    // It seems the header controls are slightly different per step. 
    // I will make the layout a simple wrapper and let steps trigger navigation, 
    // OR I can lift the common parts if possible.
    // Given the design differences (Close vs Back), I might keep the Header inside the Layout 
    // but control its content via props or store, OR easier: have the Layout just render the step 
    // and let each Step component implement its own consistent Header structure code using a shared component.

    // For now, I'll just render the current step component. 
    // I'll assume each step component implements the full page structure as per the HTML provided.

    return (
        <div className="min-h-screen bg-background font-poppins">
            <div className="mx-auto max-w-lg md:max-w-2xl lg:max-w-4xl bg-white min-h-screen md:min-h-0 md:my-8 md:rounded-xl md:shadow-lg md:border border-border overflow-hidden">
                {renderStep()}
            </div>
        </div>
    );
};

export default CreateCampaignLayout;

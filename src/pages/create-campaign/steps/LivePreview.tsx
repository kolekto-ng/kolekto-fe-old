import React from 'react';
import { useFundraisingStore } from '@/store/useFundraisingStore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/store/useCollectionStore';
import { createCampaign } from '@/services/fundraisingService';
import { ArrowLeft, X, Share2, AlertCircle } from 'lucide-react';

const LivePreview = () => {
    const navigate = useNavigate();
    const {
        title, imagePreview, summary,
        minContribution, targetAmount, deadline, isOpenEnded,
        storyFor, storyWhy, storyAchieve,
        category, keywords, phoneNumber, countryCode, country, city, socials,
        prevStep, reset
    } = useFundraisingStore();

    const { createCollection } = useCollectionStore();

    const handlePublish = async () => {
        try {
            toast.loading("Publishing campaign...");

            const campaign = await createCampaign({
                title,
                summary,
                mainImage: useFundraisingStore.getState().image, // Access raw file from store
                minContribution,
                targetAmount,
                isOpenEnded,
                deadline,
                currency: 'NGN',
                storyFor,
                storyWhy,
                storyAchieve,
                supportingImages: useFundraisingStore.getState().supportingImages,
                verificationDocs: useFundraisingStore.getState().verificationDocs,
                category,
                keywords,
                phoneNumber,
                countryCode,
                country,
                city,
                socials
            });

            toast.dismiss();
            toast.success("Campaign published successfully!");
            reset();
            navigate('/dashboard/collections');

        } catch (error: any) {
            toast.dismiss();
            console.error("Publish error:", error);
            toast.error(error.message || "Failed to publish campaign.");
        }
    };

    const handleEdit = () => {
        prevStep();
    }

    const handleClose = () => {
        if (confirm("Exit campaign creation?")) {
            reset();
            window.location.href = '/dashboard/collections';
        }
    }


    // Calculate days left
    const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0;

    return (
        <div className="relative flex size-full min-h-screen md:min-h-[600px] flex-col bg-background font-poppins">
            <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
                <button onClick={prevStep} className="text-foreground flex size-10 items-center justify-center rounded-full hover:bg-secondary/10">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold font-clash text-foreground">Live Preview</h1>
                <button onClick={handleClose} className="text-foreground flex size-10 items-center justify-center rounded-full hover:bg-secondary/10">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <p className="px-4 py-3 text-muted-foreground bg-secondary/5 text-center text-sm border-b border-border flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                This is how your collection will look to contributors.
            </p>

            <div className="flex-1 overflow-y-auto p-4 bg-secondary/5">
                <div className="mx-auto max-w-md rounded-2xl bg-white shadow-lg overflow-hidden border border-border">
                    <div className="relative">
                        <div
                            className="h-48 w-full bg-cover bg-center"
                            style={{ backgroundImage: `url("${imagePreview || 'https://placehold.co/600x400'}")` }}
                        ></div>
                        {deadline && (
                            <div className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-gray-800 backdrop-blur-sm shadow-sm">
                                Ends in {daysLeft} days
                            </div>
                        )}
                    </div>

                    <div className="p-5">
                        <h2 className="text-xl font-bold text-foreground leading-tight font-clash">{title || "Untitled Campaign"}</h2>
                        <p className="mt-2 text-muted-foreground text-sm line-clamp-3">{summary || "No summary provided."}</p>

                        <div className="mt-4">
                            <div className="flex justify-between text-sm font-medium text-foreground">
                                <span>Raised</span>
                                <span>₦0 of {targetAmount ? `₦${parseFloat(targetAmount.replace(/,/g, '')).toLocaleString()}` : 'Unlimited'}</span>
                            </div>
                            <div className="mt-1 h-2 w-full rounded-full bg-secondary/20">
                                <div className="h-2 rounded-full bg-primary" style={{ width: '1%' }}></div>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <button disabled className="flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white opacity-90 shadow-lg shadow-primary/20">
                                Contribute Now
                            </button>
                            <button disabled className="flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-secondary/10 py-3 text-sm font-bold text-foreground hover:bg-secondary/20 flex gap-2">
                                <Share2 className="w-4 h-4" />
                                Share
                            </button>
                        </div>

                        <div className="mt-6 border-t border-border pt-4">
                            <h3 className="font-semibold mb-2 text-foreground">About</h3>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{storyWhy || "No story detail."}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-border bg-white p-4 flex gap-4">
                <button onClick={handleEdit} className="flex-1 rounded-xl bg-secondary/10 py-3 font-bold text-foreground hover:bg-secondary/20 transition-colors">
                    Continue Editing
                </button>
                <button onClick={handlePublish} className="flex-[2] rounded-xl bg-primary py-3 font-bold text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                    Publish Campaign
                </button>
            </div>
        </div>
    );
};

export default LivePreview;

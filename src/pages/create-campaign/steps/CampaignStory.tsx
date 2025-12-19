import React from 'react';
import { useFundraisingStore } from '@/store/useFundraisingStore';
import { toast } from 'sonner';
import { X, Bold, Italic, List, ImagePlus } from 'lucide-react';

const CampaignStory = () => {
    const {
        storyFor, storyWhy, storyAchieve, supportingImages,
        setField, nextStep, prevStep, reset
    } = useFundraisingStore();

    const handleNext = () => {
        // Basic validation
        if (!storyFor.trim()) { toast.error("Please explain what you are raising money for."); return; }
        if (!storyWhy.trim()) { toast.error("Please explain your story."); return; }
        if (!storyAchieve.trim()) { toast.error("Please explain what the funds will achieve."); return; }

        nextStep();
    };

    const handleClose = () => {
        if (confirm("Exit campaign creation?")) {
            reset();
            window.location.href = '/dashboard/collections';
        }
    }


    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (supportingImages.length + files.length > 5) {
                toast.error("You can only upload up to 5 images.");
                return;
            }
            // Filter size
            const validFiles = files.filter(f => f.size <= 5 * 1024 * 1024);
            if (validFiles.length < files.length) {
                toast.error("Some files were skipped (max 5MB each).");
            }

            setField('supportingImages', [...supportingImages, ...validFiles]);

            // Generate previews
            const newPreviews = validFiles.map(f => URL.createObjectURL(f));
            // Note: In a real app we need to clean up these object URLs to avoid memory leaks
            // But for a simple flow it's often okay, or we can useEffect to revoke them.
            // For now, I'll assume we just append them. 
            // Need to retrieve existing previews first? 
            // The store doesn't persist previews efficiently? 
            // Let's generate them on render or store them. 
            // I added supportingImagePreviews to store.
            if (useFundraisingStore.getState().supportingImagePreviews) {
                setField('supportingImagePreviews', [...useFundraisingStore.getState().supportingImagePreviews, ...newPreviews]);
            } else {
                setField('supportingImagePreviews', newPreviews);
            }
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...supportingImages];
        newImages.splice(index, 1);
        setField('supportingImages', newImages);

        const newPreviews = [...useFundraisingStore.getState().supportingImagePreviews];
        newPreviews.splice(index, 1);
        setField('supportingImagePreviews', newPreviews);
    };

    return (
        <div className="relative flex size-full min-h-screen md:min-h-[600px] flex-col justify-between group/design-root overflow-x-hidden bg-background">
            <div className="flex flex-col flex-1">
                {/* Header */}
                <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/80 p-4 backdrop-blur-sm">
                    <button onClick={handleClose} className="flex size-8 items-center justify-center rounded-full text-foreground hover:bg-secondary/10">
                        <X className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold font-clash text-foreground">Campaign Story</h1>
                    <div className="size-8"></div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="space-y-6">

                        {/* Fundraising For */}
                        <div>
                            <label className="block text-base font-medium text-foreground" htmlFor="fundraising-for">What are you raising money for?</label>
                            <div className="mt-2">
                                <textarea
                                    id="fundraising-for"
                                    rows={3}
                                    placeholder="e.g., Medical expenses for my dog, tuition for my final year."
                                    value={storyFor}
                                    onChange={(e) => setField('storyFor', e.target.value)}
                                    className="w-full resize-none rounded-xl border-none bg-secondary/10 p-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                                ></textarea>
                            </div>
                        </div>

                        {/* Why */}
                        <div>
                            <label className="block text-base font-medium text-foreground" htmlFor="why">Why are you raising the funds?</label>
                            <div className="mt-2">
                                <div className="relative rounded-xl bg-secondary/10">
                                    <textarea
                                        id="why"
                                        rows={6}
                                        placeholder="Share your story. Be authentic and connect with potential contributors."
                                        value={storyWhy}
                                        onChange={(e) => setField('storyWhy', e.target.value)}
                                        className="w-full resize-none rounded-t-xl border-none bg-transparent p-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                                    ></textarea>
                                    <div className="flex items-center space-x-2 border-t border-border p-2">
                                        <button className="rounded p-1.5 text-muted-foreground hover:bg-secondary/20" title="Bold (Not Functional)">
                                            <Bold className="w-4 h-4" />
                                        </button>
                                        <button className="rounded p-1.5 text-muted-foreground hover:bg-secondary/20" title="Italic (Not Functional)">
                                            <Italic className="w-4 h-4" />
                                        </button>
                                        <button className="rounded p-1.5 text-muted-foreground hover:bg-secondary/20" title="List (Not Functional)">
                                            <List className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Achieve */}
                        <div>
                            <label className="block text-base font-medium text-foreground" htmlFor="achieve">What will the funds raised help achieve?</label>
                            <div className="mt-2">
                                <textarea
                                    id="achieve"
                                    rows={4}
                                    placeholder="e.g., Cover the full cost of surgery and post-operative care."
                                    value={storyAchieve}
                                    onChange={(e) => setField('storyAchieve', e.target.value)}
                                    className="w-full resize-none rounded-xl border-none bg-secondary/10 p-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                                ></textarea>
                                <p className="mt-2 text-sm text-muted-foreground">Example: Funds will be used to cover the cost of surgery and post-operative care.</p>
                            </div>
                        </div>

                        {/* Images */}
                        <div>
                            <h3 className="text-base font-medium text-foreground">Supporting Images (Optional)</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Add up to 5 images to make your campaign more compelling.</p>
                            <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-5">
                                {useFundraisingStore.getState().supportingImagePreviews?.map((src, index) => (
                                    <div key={index} className="relative col-span-1 h-24">
                                        <img src={src} alt={`Supporting ${index + 1}`} className="h-full w-full rounded-lg object-cover shadow-sm" />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                {supportingImages.length < 5 && (
                                    <div className="relative col-span-1 flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/5 hover:bg-secondary/10 cursor-pointer">
                                        <input type="file" accept="image/*" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} />
                                        <div className="flex flex-col items-center text-muted-foreground hover:text-primary">
                                            <ImagePlus className="w-6 h-6" />
                                            <span className="text-xs">Add</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <footer className="sticky bottom-0 bg-white p-4 pb-6 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex gap-4 border-t border-border">
                <button
                    onClick={prevStep}
                    className="flex-1 rounded-xl bg-secondary/10 py-3.5 text-base font-bold text-foreground hover:bg-secondary/20"
                >
                    Back
                </button>
                <button
                    onClick={handleNext}
                    className="flex-[2] flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-lg shadow-primary/20 transition-transform active:scale-95 hover:bg-primary/90"
                >
                    Next
                </button>
            </footer>
        </div>
    );
};

export default CampaignStory;

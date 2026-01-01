import React from 'react';
import { useFundraisingStore } from '@/store/useFundraisingStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { X, CloudUpload } from 'lucide-react';

const Basics = () => {
    const navigate = useNavigate();
    const {
        title, image, imagePreview, summary,
        setField, nextStep, reset
    } = useFundraisingStore();

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error("File size too large (max 5MB)");
                return;
            }
            setField('image', file);
            const objectUrl = URL.createObjectURL(file);
            setField('imagePreview', objectUrl);
        }
    };

    const handleNext = () => {
        if (!title.trim()) {
            toast.error('Please enter a campaign title.');
            return;
        }
        if (!summary.trim()) {
            toast.error('Please enter a campaign summary.');
            return;
        }
        // Image is optional? Design says "Campaign Image". Usually required.
        // Making it optional for now to ease testing, or enforce?
        // Let's enforce it for a "premium" feel.
        if (!image) {
            toast.error('Please upload a campaign image.');
            return;
        }
        nextStep();
    };

    const handleClose = () => {
        // Assuming close goes back to dashboard
        if (confirm("Exit campaign creation?")) {
            reset();
            navigate('/dashboard/collections');
        }
    }

    return (
        <div className="flex h-screen flex-col bg-white">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-border">
                <div className="flex items-center p-4">
                    <button onClick={handleClose} className="text-foreground hover:text-muted-foreground transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <h1 className="flex-1 text-center text-lg font-bold font-clash text-foreground">
                        Create Fundraising Campaign
                    </h1>
                    <div className="w-8"></div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 scroller">


                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    {/* Title */}
                    <div>
                        <label className="mb-2 block text-base font-medium text-foreground" htmlFor="title">Title</label>
                        <div className="relative">
                            <input
                                id="title"
                                name="title"
                                type="text"
                                placeholder="e.g., Help us build a community garden"
                                maxLength={60}
                                value={title}
                                onChange={(e) => setField('title', e.target.value)}
                                className="w-full rounded-lg border-none bg-secondary/10 p-4 pr-16 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                            />
                            <span className="absolute bottom-4 right-4 text-xs text-muted-foreground">{title.length}/60</span>
                        </div>
                    </div>

                    {/* Campaign Image */}
                    <div>
                        <label className="mb-2 block text-base font-medium text-foreground">Campaign Image</label>
                        <div className="relative group">
                            <label
                                className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed ${imagePreview ? 'border-primary' : 'border-border'} bg-secondary/10 text-center text-muted-foreground transition hover:border-primary group-hover:bg-secondary/20 relative overflow-hidden`}
                            >
                                {imagePreview ? (
                                    <div className="absolute inset-0 w-full h-full">
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg opacity-90" />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <CloudUpload className="w-10 h-10" />
                                            <p className="mt-2 text-sm font-medium">Change Image</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <CloudUpload className="w-10 h-10" />
                                        <p className="mt-2 text-sm font-medium">
                                            Drag & drop or <span className="font-bold text-primary">browse files</span>
                                        </p>
                                        <p className="mt-1 text-xs">JPG, PNG, GIF up to 900x900px</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Summary */}
                    <div>
                        <label className="mb-2 block text-base font-medium text-foreground" htmlFor="summary">Campaign Summary</label>
                        <div className="relative">
                            <textarea
                                id="summary"
                                name="summary"
                                rows={3}
                                placeholder="Briefly describe your campaign in 140 characters."
                                maxLength={140}
                                value={summary}
                                onChange={(e) => setField('summary', e.target.value)}
                                className="w-full resize-none rounded-lg border-none bg-secondary/10 p-4 pr-16 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                            ></textarea>
                            <span className="absolute bottom-4 right-4 text-xs text-muted-foreground">{summary.length}/140</span>
                        </div>
                    </div>
                </form>
            </main>

            {/* Footer */}
            <footer className="bg-white p-4 shadow-[0_-1px_4px_rgba(0,0,0,0.05)]">
                <button
                    onClick={handleNext}
                    className="w-full rounded-xl bg-primary py-3.5 text-base font-bold text-white transition hover:bg-primary/90 active:scale-95"
                >
                    Next
                </button>
            </footer>
        </div>
    );
};

export default Basics;

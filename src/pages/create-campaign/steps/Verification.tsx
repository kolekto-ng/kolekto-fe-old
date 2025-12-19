import React from 'react';
import { useFundraisingStore } from '@/store/useFundraisingStore';
import { toast } from 'sonner';
import { ArrowLeft, X, ShieldCheck, UploadCloud, CheckCircle, Twitter, Instagram, Facebook } from 'lucide-react';

const Verification = () => {
    const {
        verificationDocs, category, keywords, phoneNumber, country, city,
        socials,
        setField, setSocial, nextStep, prevStep, reset
    } = useFundraisingStore();

    const handleNext = () => {
        // Validation
        if (!verificationDocs.length) { toast.error("Please upload verification documents."); return; }
        if (!category || category === "Select Category") { toast.error("Please select a category."); return; }
        if (!phoneNumber) { toast.error("Please enter a phone number."); return; }
        if (!country || country === "Select Country") { toast.error("Please select a country."); return; }
        if (!city) { toast.error("Please enter a city."); return; }

        nextStep();
    }

    const handleClose = () => {
        if (confirm("Exit campaign creation?")) {
            reset();
            window.location.href = '/dashboard/collections';
        }
    }


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            // Limit check if needed
            setField('verificationDocs', [...verificationDocs, ...files]);
        }
    }

    return (
        <div className="relative flex size-full min-h-screen md:min-h-[600px] flex-col bg-background font-poppins">
            {/* Header */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white p-4">
                <button onClick={prevStep} className="text-foreground hover:bg-secondary/10 rounded-full p-2">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold font-clash text-foreground">Internal Verification</h1>
                <button onClick={handleClose} className="text-foreground hover:bg-secondary/10 rounded-full p-2">
                    <X className="w-5 h-5" />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto p-6 scroller">
                <div className="mb-6 rounded-lg bg-primary/10 p-4 border border-primary/20">
                    <h2 className="text-base font-bold text-foreground mb-2">Information</h2>
                    <p className="text-sm text-muted-foreground mb-2">
                        All campaigns hosted on kolekto are verified by the compliance team.
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                        The Kolekto compliance team requires campaigners to upload documents that allow them to validate the authenticity of the campaign being created.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Expected documents could include but not limited to national identity card, letter from hospital/diagnosis report, letter of admission, school ID Card, proof of enrollment and Community project budget.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Upload */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2" htmlFor="dropzone-file">Upload Verification Documents</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer bg-secondary/5 hover:bg-secondary/10 relative hover:border-primary transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-muted-foreground">PDF, JPG, PNG (MAX. 5MB)</p>
                                </div>
                                <input id="dropzone-file" type="file" multiple className="hidden" onChange={handleFileChange} />
                            </label>
                        </div>
                        {verificationDocs.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {verificationDocs.map((file: File, i: number) => (
                                    <p key={i} className="text-xs text-primary flex items-center">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {file.name}
                                    </p>
                                ))}
                            </div>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">Upload documents showing your identity and fundraising purpose.</p>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2" htmlFor="category">Fundraising Category</label>
                        <select
                            id="category"
                            className="w-full rounded-xl border border-border bg-background p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            value={category}
                            onChange={(e) => setField('category', e.target.value)}
                        >
                            <option value="">Select Category</option>
                            <option value="Alumni">Alumni</option>
                            <option value="Charity">Charity</option>
                            <option value="Community">Community</option>
                            <option value="Disaster">Disaster</option>
                            <option value="Education">Education</option>
                            <option value="Legal">Legal</option>
                            <option value="Medical">Medical</option>
                            <option value="Politics">Politics</option>
                            <option value="Sports">Sports</option>
                            <option value="Others">Others</option>
                        </select>
                    </div>

                    {/* Keywords */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2" htmlFor="keywords">Keywords for Search</label>
                        <input
                            id="keywords"
                            type="text"
                            placeholder="e.g., school, health, student"
                            value={keywords}
                            onChange={(e) => setField('keywords', e.target.value)}
                            className="w-full rounded-xl border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="mt-2 text-xs text-muted-foreground">Separate keywords with commas.</p>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2" htmlFor="phone-number">Phone Number</label>
                        <input
                            id="phone-number"
                            type="tel"
                            placeholder="Enter phone number"
                            value={phoneNumber}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setField('phoneNumber', val);
                            }}
                            className="w-full rounded-xl border border-border p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2" htmlFor="country">Country</label>
                            <select
                                id="country"
                                className="w-full rounded-xl border border-border bg-background p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                value={country}
                                onChange={(e) => setField('country', e.target.value)}
                            >
                                <option value="Nigeria">Nigeria</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2" htmlFor="city">City</label>
                            <input
                                id="city"
                                type="text"
                                placeholder="e.g., Lagos"
                                value={city}
                                onChange={(e) => setField('city', e.target.value)}
                                className="w-full rounded-xl border border-border p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Socials */}
                    <div>
                        <h3 className="text-base font-semibold text-foreground pt-4 border-t border-border">Social Media (Optional)</h3>
                        <div className="space-y-4 mt-4">
                            <div className="relative">
                                {/* Twitter Icon */}
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Twitter className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <input
                                    className="w-full rounded-xl border border-border p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="@twitter_handle"
                                    value={socials.twitter}
                                    onChange={(e) => setSocial('twitter', e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                {/* Instagram Icon */}
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Instagram className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <input
                                    className="w-full rounded-xl border border-border p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="@instagram_handle"
                                    value={socials.instagram}
                                    onChange={(e) => setSocial('instagram', e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                {/* Facebook Icon */}
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <Facebook className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <input
                                    className="w-full rounded-xl border border-border p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="@facebook_handle"
                                    value={socials.facebook}
                                    onChange={(e) => setSocial('facebook', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="sticky bottom-0 bg-white p-4 border-t border-border">
                <button
                    onClick={handleNext}
                    className="w-full h-12 px-6 text-white font-bold bg-primary rounded-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
                >
                    Submit for Verification
                </button>
            </footer>
        </div>
    );
};

export default Verification;

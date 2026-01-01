import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Info, Loader2, ImagePlus, X } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateCampaign } from '@/services/fundraisingService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface EditCampaignDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaignId: string;
    initialData: {
        title: string;
        description: string;
        story_for: string;
        story_why: string;
        story_achieve: string;
        targetAmount?: number;
        minContribution?: number;
        deadline?: string;
        status: string;
        main_image_url?: string;
        images?: any[];
        city?: string;
        country?: string;
        category?: string;
    };
    onSuccess?: () => void;
}

const CATEGORIES = [
    "Medical",
    "Education",
    "Emergency",
    "Non-profit",
    "Business",
    "Community",
    "Sports",
    "Travel",
    "Volunteer",
    "Wishes",
    "Other"
];

const EditCampaignDialog: React.FC<EditCampaignDialogProps> = ({
    open,
    onOpenChange,
    campaignId,
    initialData,
    onSuccess
}) => {
    const [activeTab, setActiveTab] = useState("basics");
    const [isLoading, setIsLoading] = useState(false);

    // Basics
    const [title, setTitle] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [category, setCategory] = useState('');

    // Story
    const [storyFor, setStoryFor] = useState('');
    const [storyWhy, setStoryWhy] = useState('');
    const [storyAchieve, setStoryAchieve] = useState('');

    // Goals
    const [targetAmount, setTargetAmount] = useState<string>('');
    const [minContribution, setMinContribution] = useState<string>('');
    const [deadline, setDeadline] = useState<Date | undefined>(undefined);

    // Media
    const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);
    const [newMainImage, setNewMainImage] = useState<File | null>(null);
    const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setTitle(initialData.title || '');
            setCity(initialData.city || '');
            setCountry(initialData.country || '');
            setCategory(initialData.category || '');

            setStoryFor(initialData.story_for || '');
            setStoryWhy(initialData.story_why || '');
            setStoryAchieve(initialData.story_achieve || '');

            setTargetAmount(initialData.targetAmount?.toString() || '');
            setMinContribution(initialData.minContribution?.toString() || '');
            setDeadline(initialData.deadline ? new Date(initialData.deadline) : undefined);

            setMainImageUrl(initialData.main_image_url || null);
            setNewMainImage(null);
            setMainImagePreview(null);
        }
    }, [open, initialData]);

    const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewMainImage(file);
            setMainImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Campaign title is required');
            return;
        }

        setIsLoading(true);

        try {
            let finalMainImageUrl = mainImageUrl;

            if (newMainImage) {
                const fileExt = newMainImage.name.split('.').pop();
                const fileName = `updates/${campaignId}/${Date.now()}_main.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('campaign_assets')
                    .upload(fileName, newMainImage);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('campaign_assets')
                    .getPublicUrl(fileName);

                finalMainImageUrl = publicUrl;
            }

            const updates: any = {
                title,
                city,
                country,
                category,
                story_for: storyFor,
                story_why: storyWhy,
                story_achieve: storyAchieve,
                summary: storyFor.slice(0, 200),
                target_amount: targetAmount ? parseFloat(targetAmount) : null,
                min_contribution: minContribution ? parseFloat(minContribution) : 0,
                deadline: deadline ? deadline.toISOString() : null,
                main_image_url: finalMainImageUrl
            };

            await updateCampaign(campaignId, updates);

            toast.success('Campaign updated successfully');
            onOpenChange(false);

            if (onSuccess) {
                onSuccess();
            }
        } catch (error: any) {
            console.error('Error updating campaign:', error);
            toast.error(`Failed to update campaign: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const isCompleted = initialData.status === 'completed';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Campaign Details</DialogTitle>
                    <DialogDescription>
                        Update your fundraising story, goals, and media.
                    </DialogDescription>
                </DialogHeader>

                {isCompleted && (
                    <Alert className="mb-4">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            This campaign is completed. Some critical details may be locked.
                        </AlertDescription>
                    </Alert>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="basics">Basics</TabsTrigger>
                        <TabsTrigger value="story">Story</TabsTrigger>
                        <TabsTrigger value="goals">Goals</TabsTrigger>
                        <TabsTrigger value="media">Media</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basics" className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Campaign Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                                placeholder="e.g. Help John recover from surgery"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    value={city}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                                    placeholder="Lagos"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="country">Country</Label>
                                <Input
                                    id="country"
                                    value={country}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountry(e.target.value)}
                                    placeholder="Nigeria"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category">Category</Label>
                            <Select value={category} onValueChange={setCategory} disabled={isLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    <TabsContent value="story" className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="storyFor">Who are you raising funds for?</Label>
                            <Textarea
                                id="storyFor"
                                value={storyFor}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryFor(e.target.value)}
                                placeholder="Tell us about the beneficiary..."
                                rows={4}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storyWhy">Why do you need support?</Label>
                            <Textarea
                                id="storyWhy"
                                value={storyWhy}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryWhy(e.target.value)}
                                placeholder="Explain the situation..."
                                rows={4}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="storyAchieve">What will the funds achieve?</Label>
                            <Textarea
                                id="storyAchieve"
                                value={storyAchieve}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStoryAchieve(e.target.value)}
                                placeholder="Describe the impact..."
                                rows={4}
                                disabled={isLoading}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="goals" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="targetAmount">Target Amount (₦)</Label>
                                <Input
                                    id="targetAmount"
                                    type="number"
                                    value={targetAmount}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetAmount(e.target.value)}
                                    placeholder="0.00"
                                    disabled={isLoading}
                                />
                                <p className="text-xs text-muted-foreground">Set 0 for open-ended</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="minContribution">Minimum Contribution (₦)</Label>
                                <Input
                                    id="minContribution"
                                    type="number"
                                    value={minContribution}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinContribution(e.target.value)}
                                    placeholder="0.00"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Deadline</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !deadline && "text-muted-foreground"
                                        )}
                                        disabled={isLoading}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deadline ? format(deadline, "PPP") : "Select deadline"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={deadline}
                                        onSelect={setDeadline}
                                        initialFocus
                                        disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </TabsContent>

                    <TabsContent value="media" className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Main Campaign Image</Label>
                            <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px] relative bg-gray-50/50">
                                {(mainImagePreview || mainImageUrl) ? (
                                    <div className="relative w-full h-full max-h-[300px] flex items-center justify-center">
                                        <img
                                            src={mainImagePreview || mainImageUrl || ''}
                                            alt="Campaign Main"
                                            className="max-h-[300px] object-contain rounded-md"
                                        />
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="absolute top-2 right-2"
                                            onClick={() => {
                                                setMainImageUrl(null);
                                                setMainImagePreview(null);
                                                setNewMainImage(null);
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="flex justify-center mb-2">
                                            <ImagePlus className="h-10 w-10 text-gray-400" />
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">Upload a cover image</p>
                                        <Input
                                            id="mainImage"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleMainImageChange}
                                        />
                                        <Button variant="outline" size="sm" onClick={() => document.getElementById('mainImage')?.click()}>
                                            Select Image
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                            <Info className="h-4 w-4 inline mr-2" />
                            Currently, you can only replace the main cover image. Gallery management will be available soon.
                        </div>
                    </TabsContent>

                </Tabs>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-kolekto hover:bg-kolekto/90">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EditCampaignDialog;

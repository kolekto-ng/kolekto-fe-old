import React, { useState, useEffect } from "react";
import { formatCurrency } from "@/utils/formatters";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Calendar,
    MapPin,
    Target,
    Share2,
    Heart,
    Clock,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { getCampaignDonations } from "@/services/fundraisingService";
import { supabase } from "@/integrations/supabase/client";
import { usePaystackStore } from "@/store/usePaystackStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface FundraisingPublicPageProps {
    campaign: any;
}

const FundraisingPublicPage: React.FC<FundraisingPublicPageProps> = ({ campaign }) => {
    const [donations, setDonations] = useState<any[]>([]);
    const [donationAmount, setDonationAmount] = useState<string>("");
    const [donorName, setDonorName] = useState("");
    const [donorEmail, setDonorEmail] = useState("");
    const [donorPhone, setDonorPhone] = useState("");
    const [donorMessage, setDonorMessage] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const { initializePayment } = usePaystackStore();

    // Calculate stats
    const totalRaised = donations.reduce((sum, d) => sum + (d.status === 'paid' ? Number(d.amount) : 0), 0);
    const targetAmount = Number(campaign.target_amount) || 0;
    const progressPercentage = targetAmount > 0 ? Math.min((totalRaised / targetAmount) * 100, 100) : 0;
    const donorsCount = donations.filter(d => d.status === 'paid').length;

    // Combine main image and supporting images for gallery
    const allImages = [
        campaign.main_image_url,
        ...(campaign.campaign_images?.map((img: any) => img.image_url) || [])
    ].filter(Boolean);

    useEffect(() => {
        fetchDonations();
    }, [campaign.id]);

    const fetchDonations = async () => {
        try {
            const data = await getCampaignDonations(campaign.id);
            if (data) setDonations(data);
        } catch (error) {
            console.error("Error fetching donations:", error);
        }
    };

    // Calculate fees
    const amount = Number(donationAmount) || 0;
    // Fees logic matching ContributionForm
    // Gateway 1.5%, Platform 1%
    const gatewayFee = amount * 0.015;
    const platformFee = amount * 0.01;
    const totalFees = gatewayFee + platformFee;
    const totalPayable = amount + totalFees;

    const handleDonate = async () => {
        if (!donationAmount || amount <= 0) {
            toast.error("Please enter a valid donation amount");
            return;
        }
        if (!donorName || !donorEmail) {
            toast.error("Name and Email are required");
            return;
        }

        if (campaign.min_contribution && amount < campaign.min_contribution) {
            toast.error(`Minimum contribution is ${formatCurrency(campaign.min_contribution)}`);
            return;
        }

        setIsProcessing(true);

        try {
            // 1. Create a pending donation record in Supabase
            // Note: We might want to create this AFTER successful payment verification to avoid spam, 
            // but creating it here allows us to link the reference.
            // However, if we rely on backend verification, we should ensure the backend doesn't create a duplicate if it supports fundraising.
            // Since backend likely doesn't support fundraising tables yet, we create it here.

            const { data: donationData, error: donationError } = await supabase
                .from('campaign_donations')
                .insert({
                    campaign_id: campaign.id,
                    donor_name: donorName,
                    donor_email: donorEmail,
                    donor_phone: donorPhone,
                    amount: amount, // We store the actual donation amount, not total payable
                    currency: 'NGN',
                    status: 'pending',
                    message: donorMessage
                })
                .select()
                .single();

            if (donationError) throw donationError;

            // 2. Initialize Paystack Payment
            const paymentData = {
                email: donorEmail,
                fullName: donorName, // Required by backend
                phoneNumber: donorPhone, // Required by backend
                amount: totalPayable, // Charge total including fees
                callback_url: `${window.location.origin}/payment/verify`,
                metadata: {
                    type: 'campaign_donation',
                    campaignId: campaign.id,
                    donationId: donationData.id,
                    custom_fields: [
                        { display_name: "Campaign", variable_name: "campaign_title", value: campaign.title },
                        { display_name: "Donor Name", variable_name: "donor_name", value: donorName },
                        { display_name: "Donation Amount", variable_name: "donation_amount", value: amount }
                    ]
                },
                // Legacy fields that might be used by backend
                collectionId: campaign.id,
                collectionType: 'fundraising',
                contributor: {
                    name: donorName,
                    email: donorEmail,
                    phoneNumber: donorPhone,
                    amount: totalPayable,
                    contributionInformation: [
                        { "Message": donorMessage || "No message" }
                    ]
                }
            };

            const response = await initializePayment(paymentData);

            if (response?.authorization_url) {
                window.location.href = response.authorization_url;
            } else {
                throw new Error("Failed to initialize payment");
            }

        } catch (error: any) {
            console.error("Donation error:", error);
            toast.error(error.message || "Failed to process donation");
            setIsProcessing(false);
        }
    };

    // Days left calculation
    const daysLeft = campaign.deadline
        ? Math.ceil((new Date(campaign.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const isExpired = daysLeft !== null && daysLeft < 0;

    // Status Logic
    // For fundraising, completion is when the target is met (if > 0)
    const isGoalReached = targetAmount > 0 && totalRaised >= targetAmount;

    // Determine status blocking
    let blockReason: 'paused' | 'closed' | 'completed' | 'expired' | null = null;

    // Priority: Closed (Manual) > Paused (Manual) > Completed (Goal) > Expired (Time)
    if (campaign.status === 'closed') blockReason = 'closed';
    else if (campaign.status === 'paused') blockReason = 'paused';
    else if (isGoalReached) blockReason = 'completed';
    else if (isExpired) blockReason = 'expired';

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Hero Section */}
            <div className="relative h-[300px] md:h-[400px]">
                <img
                    src={campaign.main_image_url || "/placeholder.svg"}
                    alt={campaign.title}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute bottom-0 left-0 w-full p-6 text-white bg-gradient-to-t from-black/80 to-transparent">
                    <div className="container max-w-6xl mx-auto">
                        <div className="max-w-3xl">
                            <Badge className="mb-3 bg-kolekto text-white border-none">
                                {campaign.category || 'Fundraising'}
                            </Badge>
                            <h1 className="text-3xl md:text-4xl font-bold mb-3 text-white leading-tight">
                                {campaign.title}
                            </h1>
                            <div className="flex items-center text-gray-200 text-sm">
                                <MapPin className="h-4 w-4 mr-2" />
                                {campaign.city}, {campaign.country}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container max-w-6xl mx-auto px-4 md:px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Content Area - 2/3 width on large screens */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Status Banner */}
                        {blockReason && (
                            <div className={`rounded-xl p-5 border shadow-sm ${blockReason === 'paused' ? 'bg-orange-50 border-orange-200' :
                                blockReason === 'closed' ? 'bg-gray-100 border-gray-300' :
                                    blockReason === 'completed' ? 'bg-green-50 border-green-200' :
                                        'bg-yellow-50 border-yellow-200'
                                }`}>
                                <div className="flex items-start gap-4">
                                    {blockReason === 'completed' ? (
                                        <CheckCircle2 className="h-7 w-7 mt-0.5 text-green-600 flex-shrink-0" />
                                    ) : blockReason === 'paused' ? (
                                        <AlertCircle className="h-7 w-7 mt-0.5 text-orange-600 flex-shrink-0" />
                                    ) : (
                                        <AlertCircle className={`h-7 w-7 mt-0.5 ${blockReason === 'closed' ? 'text-gray-600' : 'text-yellow-600'}`} />
                                    )}
                                    <div>
                                        <h3 className={`text-lg font-bold ${blockReason === 'paused' ? 'text-orange-900' :
                                            blockReason === 'closed' ? 'text-gray-900' :
                                                blockReason === 'completed' ? 'text-green-900' :
                                                    'text-yellow-900'
                                            }`}>
                                            {blockReason === 'paused' ? 'Campaign Paused' :
                                                blockReason === 'closed' ? 'Campaign Closed' :
                                                    blockReason === 'completed' ? 'Goal Reached!' :
                                                        'Campaign Ended'}
                                        </h3>
                                        <p className={`mt-1.5 ${blockReason === 'paused' ? 'text-orange-800' :
                                            blockReason === 'closed' ? 'text-gray-600' :
                                                blockReason === 'completed' ? 'text-green-800' :
                                                    'text-yellow-800'
                                            }`}>
                                            {blockReason === 'paused' ? 'This campaign is temporarily paused by the organizer.' :
                                                blockReason === 'closed' ? 'This campaign has been closed by the organizer.' :
                                                    blockReason === 'completed' ? 'This campaign has successfully reached its goal! Thank you for your support.' :
                                                        'This campaign has ended and is no longer accepting donations.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Progress Card - Moved to main content area for better flow */}
                        <Card className="border shadow-sm">
                            <CardContent className="pt-6">
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-baseline mb-2">
                                            <span className="text-2xl md:text-3xl font-bold text-gray-900">
                                                {formatCurrency(totalRaised)}
                                            </span>
                                            <span className="text-gray-500 text-sm">
                                                raised of {campaign.target_amount ? formatCurrency(targetAmount) : 'No Goal'} goal
                                            </span>
                                        </div>
                                        <Progress value={progressPercentage} className="h-3" />
                                        <div className="flex justify-between text-sm text-gray-500 mt-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-900">{progressPercentage.toFixed(1)}%</span>
                                                <span>funded</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <span className="font-semibold text-gray-900">{donorsCount}</span>
                                                    <span className="ml-1">donations</span>
                                                </div>
                                                {daysLeft !== null && (
                                                    <div className="flex items-center">
                                                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                                                        {isExpired ? 'Ended' : `${daysLeft} days left`}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Story Tabs */}
                        <Card className="border shadow-sm">
                            <CardContent className="pt-6">
                                <Tabs defaultValue="story" className="w-full">
                                    <TabsList className="mb-6">
                                        <TabsTrigger value="story" className="px-4">Story</TabsTrigger>
                                        <TabsTrigger value="updates" className="px-4">Updates</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="story" className="space-y-6">
                                        {campaign.story_for && (
                                            <div>
                                                <h3 className="font-semibold text-lg text-gray-900 mb-3">Who is this for?</h3>
                                                <div className="bg-gray-50 rounded-lg p-4 border">
                                                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{campaign.story_for}</p>
                                                </div>
                                            </div>
                                        )}
                                        {campaign.story_why && (
                                            <div>
                                                <h3 className="font-semibold text-lg text-gray-900 mb-3">Why it matters</h3>
                                                <div className="bg-gray-50 rounded-lg p-4 border">
                                                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{campaign.story_why}</p>
                                                </div>
                                            </div>
                                        )}
                                        {campaign.story_achieve && (
                                            <div>
                                                <h3 className="font-semibold text-lg text-gray-900 mb-3">What we'll achieve</h3>
                                                <div className="bg-gray-50 rounded-lg p-4 border">
                                                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{campaign.story_achieve}</p>
                                                </div>
                                            </div>
                                        )}
                                        {!campaign.story_for && !campaign.story_why && !campaign.story_achieve && (
                                            <div className="bg-gray-50 rounded-lg p-4 border">
                                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{campaign.summary || campaign.description}</p>
                                            </div>
                                        )}
                                    </TabsContent>
                                    <TabsContent value="updates">
                                        <div className="text-center py-12 text-gray-500">
                                            <div className="max-w-sm mx-auto">
                                                <div className="text-4xl mb-4">📰</div>
                                                <p className="text-lg font-medium mb-2">No updates yet</p>
                                                <p className="text-sm">Check back later for campaign updates</p>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        {/* Gallery */}
                        {allImages.length > 0 && (
                            <Card className="border shadow-sm">
                                <CardContent className="pt-6">
                                    <h3 className="font-semibold text-lg text-gray-900 mb-5">Gallery</h3>
                                    <div className="space-y-5">
                                        <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                                            <img
                                                src={allImages[activeImageIndex]}
                                                alt="Campaign gallery"
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        {allImages.length > 1 && (
                                            <div>
                                                <p className="text-sm text-gray-500 mb-3">Click on images to view</p>
                                                <div className="flex gap-3 overflow-x-auto pb-3">
                                                    {allImages.map((img: string, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setActiveImageIndex(idx)}
                                                            className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-blue-600 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'
                                                                }`}
                                                        >
                                                            <div className="w-24 h-24">
                                                                <img
                                                                    src={img}
                                                                    alt={`Thumbnail ${idx + 1}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar Area - 1/3 width on large screens */}
                    <div className="space-y-8">

                        {/* Donation Card */}
                        <Card className="border-t-4 border-t-kolekto shadow-lg sticky top-8">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl font-bold text-gray-900">
                                    Support This Campaign
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {blockReason ? (
                                    <div className="text-center py-6">
                                        <div className="mb-4">
                                            {blockReason === 'completed' ? (
                                                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                                            ) : (
                                                <AlertCircle className={`h-12 w-12 mx-auto ${blockReason === 'paused' ? 'text-orange-500' : 'text-gray-500'}`} />
                                            )}
                                        </div>
                                        <p className="font-medium text-gray-700 mb-2">
                                            {blockReason === 'completed' ? 'Goal Reached!' :
                                                blockReason === 'paused' ? 'Campaign Paused' :
                                                    'Campaign Ended'}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Donations are currently not being accepted
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                            <h4 className="font-semibold text-blue-900 mb-4">Make a Contribution</h4>

                                            <div className="space-y-4">
                                                <div>
                                                    <Label htmlFor="amount" className="text-sm font-medium text-gray-700 mb-1.5 block">
                                                        Donation Amount
                                                    </Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                                                        <Input
                                                            id="amount"
                                                            type="number"
                                                            placeholder="Enter amount"
                                                            className="pl-8 bg-white h-11"
                                                            value={donationAmount}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDonationAmount(e.target.value)}
                                                            min={campaign.min_contribution || 0}
                                                        />
                                                    </div>
                                                    {campaign.min_contribution > 0 && (
                                                        <p className="text-xs text-blue-600 mt-2">
                                                            Minimum contribution: {formatCurrency(campaign.min_contribution)}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-sm font-medium text-gray-700">Your Information</Label>
                                                    <Input
                                                        placeholder="Full Name"
                                                        value={donorName}
                                                        onChange={(e) => setDonorName(e.target.value)}
                                                        className="h-11"
                                                    />
                                                    <Input
                                                        placeholder="Email Address"
                                                        type="email"
                                                        value={donorEmail}
                                                        onChange={(e) => setDonorEmail(e.target.value)}
                                                        className="h-11"
                                                    />
                                                    <Input
                                                        placeholder="Phone Number (Optional)"
                                                        type="tel"
                                                        value={donorPhone}
                                                        onChange={(e) => setDonorPhone(e.target.value)}
                                                        className="h-11"
                                                    />
                                                </div>

                                                <div>
                                                    <Label htmlFor="message" className="text-sm font-medium text-gray-700 mb-1.5 block">
                                                        Message (Optional)
                                                    </Label>
                                                    <Textarea
                                                        id="message"
                                                        placeholder="Leave an encouraging message"
                                                        value={donorMessage}
                                                        onChange={(e) => setDonorMessage(e.target.value)}
                                                        className="h-24 resize-none bg-white"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fee Breakdown */}
                                        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Donation Amount</span>
                                                <span className="font-medium">{formatCurrency(amount)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Transaction Fees</span>
                                                <span className="font-medium">{formatCurrency(totalFees)}</span>
                                            </div>
                                            <div className="border-t pt-3">
                                                <div className="flex justify-between font-bold">
                                                    <span className="text-gray-900">Total to Pay</span>
                                                    <span className="text-lg">{formatCurrency(totalPayable)}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Includes 1.5% gateway + 1% platform fees
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full bg-kolekto hover:bg-kolekto/90 h-12 text-lg font-semibold"
                                            onClick={handleDonate}
                                            disabled={isProcessing || amount <= 0 || !donorEmail || !donorName}
                                        >
                                            {isProcessing ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    Processing...
                                                </span>
                                            ) : "Donate Now"}
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Share Button */}
                        <div className="text-center">
                            <Button
                                variant="outline"
                                className="w-full border-gray-300 hover:bg-gray-50"
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    toast.success("Link copied to clipboard");
                                }}
                            >
                                <Share2 className="h-4 w-4 mr-2" />
                                Share Campaign
                            </Button>
                        </div>

                        {/* Recent Donations
                        <Card className="border shadow-sm">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 mb-5">
                                    <Heart className="h-5 w-5 text-red-500" />
                                    <h3 className="font-bold text-lg text-gray-900">Recent Donations</h3>
                                </div>

                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                    {donations.filter(d => d.status === 'paid').length > 0 ? (
                                        donations.filter(d => d.status === 'paid').map((donation) => (
                                            <div key={donation.id} className="flex gap-3 items-start border-b pb-4 last:border-0 last:pb-0">
                                                <div className="h-11 w-11 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg shrink-0">
                                                    {donation.donor_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="font-semibold text-gray-900 truncate pr-2">
                                                            {donation.donor_name}
                                                        </span>
                                                        <span className="font-bold text-green-700 shrink-0">
                                                            {formatCurrency(donation.amount)}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(donation.created_at).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </div>
                                                    {donation.message && (
                                                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">
                                                            "{donation.message}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                                <Heart className="h-8 w-8 text-gray-400" />
                                            </div>
                                            <p className="font-medium text-gray-700 mb-1">No donations yet</p>
                                            <p className="text-sm text-gray-500">Be the first to support this campaign!</p>
                                        </div>
                                    )}
                                </div>

                                {donations.length > 5 && (
                                    <Button variant="ghost" className="w-full mt-4 text-kolekto hover:text-kolekto/80">
                                        View all donations
                                    </Button>
                                )}
                            </CardContent>
                        </Card> */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FundraisingPublicPage;
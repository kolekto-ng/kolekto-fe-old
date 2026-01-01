import { supabase } from "@/integrations/supabase/client";

interface CreateCampaignParams {
    title: string;
    summary: string;
    mainImage: File | null;
    minContribution: string;
    targetAmount: string;
    isOpenEnded: boolean;
    deadline: Date | null;
    currency: string;

    storyFor: string;
    storyWhy: string;
    storyAchieve: string;
    supportingImages: File[];

    verificationDocs: File[];
    category: string;
    keywords: string; // Comma separated? or string
    phoneNumber: string;
    countryCode: string;
    country: string;
    city: string;

    socials: {
        twitter: string;
        instagram: string;
        facebook: string;
    };
}

export const createCampaign = async (params: CreateCampaignParams) => {
    const {
        title, summary, mainImage,
        minContribution, targetAmount, isOpenEnded, deadline, currency = 'NGN',
        storyFor, storyWhy, storyAchieve, supportingImages,
        verificationDocs, category, keywords,
        phoneNumber, countryCode, country, city,
        socials
    } = params;

    // 1. Get User
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    let userId = user?.id;

    if (userError || !userId) {
        console.warn("getUser failed, attempting session recovery...");

        // Try to get session from auth store/storage
        const { useAuthStore } = await import('@/store/useAuthStore');
        const authStore = useAuthStore.getState();
        const storedSession = authStore.session;

        if (storedSession) {
            console.log("Found stored session, attempting to set Supabase session...");
            // The stored session structure might vary, we accept both standard and custom
            if (storedSession.access_token && storedSession.refresh_token) {
                const { error: setSessionError } = await supabase.auth.setSession({
                    access_token: storedSession.access_token,
                    refresh_token: storedSession.refresh_token,
                });
                if (setSessionError) {
                    console.error("Failed to set session from store:", setSessionError);
                }
            } else if (storedSession.token) {
                // Fallback for custom backend token if it's compatible
                console.warn("Session has 'token' but not 'access_token'. Attempting to use as access_token.");
                const { error: setSessionError } = await supabase.auth.setSession({
                    access_token: storedSession.token,
                    refresh_token: storedSession.token, // This might fail if refresh token is required/different
                });
                if (setSessionError) {
                    console.error("Failed to set session from token:", setSessionError);
                }
            }
        }

        // Retry getUser after setting session
        const { data: { user: retriedUser }, error: retryError } = await supabase.auth.getUser();

        if (retryError || !retriedUser) {
            console.warn("Retry user retrieval failed. Attempting refresh...");
            const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError || !session?.user) {
                console.error("Session refresh failed:", refreshError);
                if (refreshError?.message?.includes("Invalid API key")) {
                    throw new Error("System Error: Invalid API configuration. Please report this to support.");
                }
                throw new Error("User not authenticated. Please log out and log back in.");
            }
            userId = session.user.id;
        } else {
            userId = retriedUser.id;
        }
    }

    // 2. Upload Main Image
    let mainImageUrl = null;
    if (mainImage) {
        const fileExt = mainImage.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_main.${fileExt}`;
        const { error: uploadError } = await supabase.storage
            .from('campaign_assets')
            .upload(fileName, mainImage);

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('campaign_assets')
            .getPublicUrl(fileName);

        mainImageUrl = publicUrl;
    }

    // 3. Create Campaign Record
    // Parse numeric values
    const minContribVal = minContribution ? parseFloat(minContribution.replace(/,/g, '')) : 0;
    const targetVal = targetAmount ? parseFloat(targetAmount.replace(/,/g, '')) : null;

    // Split keywords string into array
    const keywordsArray = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];

    const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
            creator_id: userId,
            title,
            summary,
            main_image_url: mainImageUrl,
            min_contribution: minContribVal,
            target_amount: targetVal,
            currency,
            is_open_ended: isOpenEnded,
            deadline: deadline ? deadline.toISOString() : null,
            story_for: storyFor,
            story_why: storyWhy,
            story_achieve: storyAchieve,
            phone_number: phoneNumber,
            country_code: countryCode,
            country,
            city,
            category: category as any, // Cast to enum type if needed or string
            keywords: keywordsArray,
            social_twitter: socials.twitter,
            social_instagram: socials.instagram,
            social_facebook: socials.facebook,
            status: 'pending_verification'
        })
        .select()
        .single();

    if (campaignError) throw campaignError;

    const campaignId = campaign.id;

    // 4. Upload Supporting Images
    if (supportingImages && supportingImages.length > 0) {
        const uploadPromises = supportingImages.map(async (file, index) => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${campaignId}/support_${index}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('campaign_assets')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('campaign_assets')
                .getPublicUrl(fileName);

            return {
                campaign_id: campaignId,
                image_url: publicUrl,
                display_order: index
            };
        });

        const imagesData = await Promise.all(uploadPromises);

        const { error: imagesInsertError } = await supabase
            .from('campaign_images')
            .insert(imagesData);

        if (imagesInsertError) throw imagesInsertError; // Non-fatal? Maybe, but good to know.
    }

    // 5. Upload Verification Docs
    if (verificationDocs && verificationDocs.length > 0) {
        const docPromises = verificationDocs.map(async (file) => {
            const fileExt = file.name.split('.').pop();
            // Store in a folder named after the user_id as per policy recommendation, or campaign_id
            // Policy: auth.uid()::text = (storage.foldername(name))[1]
            // So path must start with user_id
            const fileName = `${userId}/${campaignId}/${Date.now()}_${file.name}`;

            const { error: uploadError, data: uploadData } = await supabase.storage
                .from('verification_docs')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            return {
                campaign_id: campaignId,
                document_url: uploadData.path, // Store the path for private access
                document_name: file.name
            };
        });

        const docsData = await Promise.all(docPromises);

        const { error: docsInsertError } = await supabase
            .from('verification_documents')
            .insert(docsData);

        if (docsInsertError) throw docsInsertError;
    }

    return campaign;
};

export const getCampaignById = async (id: string) => {
    // Check if ID is a valid UUID to avoid PostgreSQL errors if a non-UUID is passed
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        return null;
    }

    const { data, error } = await supabase
        .from('campaigns')
        .select(`
            *,
            campaign_images (*)
        `)
        .eq('id', id)
        .single();

    if (error) {
        // handle "Row not found" gracefully
        if (error.code === 'PGRST116') return null;
        console.error("Error fetching campaign:", error);
        throw error;
    }

    return data;
};

export const getCampaignDonations = async (id: string) => {
    const { data, error } = await supabase
        .from('campaign_donations')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching donations:", error);
        throw error;
    }
    return data;
};

export const getUserCampaigns = async (userId: string) => {
    // Fetch campaigns
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select(`
            *,
            campaign_images (*)
        `)
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching user campaigns:", error);
        throw error;
    }

    // For each campaign, we might want to fetch donation stats 
    // Ideally this would be a database view or function, but doing it in app for now for speed
    const campaignsWithStats = await Promise.all(campaigns.map(async (campaign) => {
        const { data: donations } = await supabase
            .from('campaign_donations')
            .select('amount')
            .eq('campaign_id', campaign.id)
            .in('status', ['paid', 'succeeded']); // Only count paid donations

        const totalRaised = donations?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
        const donationsCount = donations?.length || 0;

        return {
            ...campaign,
            total_raised: totalRaised,
            donations_count: donationsCount
        };
    }));

    return campaignsWithStats;
};

export const updateCampaign = async (id: string, updates: Partial<any>) => {
    // 1. Check if ID is a valid UUID
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        throw new Error('Invalid campaign ID');
    }

    // 2. Perform Update
    const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating campaign:', error);
        throw error;
    }

    return data;
};

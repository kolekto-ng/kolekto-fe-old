-- Enable the storage extension if not already enabled (usually defaults to enabled)
-- create extension if not exists "storage";

-- 1. Create 'campaign_assets' bucket (Public for images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign_assets', 'campaign_assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'verification_docs' bucket (Private for sensitive docs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification_docs', 'verification_docs', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies for 'campaign_assets'
DO $$
BEGIN
    -- Allow public read access to all images
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'campaign_assets' );
    END IF;

    -- Allow authenticated users to upload images
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload images' AND schemaname = 'storage') THEN
        CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'campaign_assets' AND auth.role() = 'authenticated' );
    END IF;

    -- Allow users to update/delete their own images
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can update own images' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can update own images" ON storage.objects FOR UPDATE USING ( bucket_id = 'campaign_assets' AND auth.uid()::text = (storage.foldername(name))[1] );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can delete own images' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE USING ( bucket_id = 'campaign_assets' AND auth.uid()::text = (storage.foldername(name))[1] );
    END IF;

    -- 4. Policies for 'verification_docs'
    -- Allow authenticated users to upload documents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload docs' AND schemaname = 'storage') THEN
        CREATE POLICY "Authenticated users can upload docs" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'verification_docs' AND auth.role() = 'authenticated' );
    END IF;

    -- Allow users to view their own documents
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can view own docs' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can view own docs" ON storage.objects FOR SELECT USING ( bucket_id = 'verification_docs' AND auth.uid()::text = (storage.foldername(name))[1] );
    END IF;

END $$;


-- ============================================================================
-- DATABASE TABLE POLICIES (Run this to fix "violates row-level security policy")
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

-- CUSTOMER: Create policies if they don't exist (Using DO block to avoid errors if policies exist)
DO $$
BEGIN
    -- CAMPAIGNS TABLE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Public can view active campaigns') THEN
        CREATE POLICY "Public can view active campaigns" ON campaigns FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Authenticated users can create campaigns') THEN
        CREATE POLICY "Authenticated users can create campaigns" ON campaigns FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Creators can update their own campaigns') THEN
        CREATE POLICY "Creators can update their own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = creator_id);
    END IF;

    -- CAMPAIGN IMAGES TABLE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_images' AND policyname = 'Public can view campaign images') THEN
        CREATE POLICY "Public can view campaign images" ON campaign_images FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_images' AND policyname = 'Authenticated users can add images') THEN
        CREATE POLICY "Authenticated users can add images" ON campaign_images FOR INSERT WITH CHECK (auth.role() = 'authenticated');
        -- Alternatively, link to campaign creator:
        -- WITH CHECK (EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_id AND creator_id = auth.uid()));
        -- But simple authenticated check is often sufficient for creation, preventing complex join errors on insert.
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_images' AND policyname = 'Creators can delete their images') THEN
        CREATE POLICY "Creators can delete their images" ON campaign_images FOR DELETE USING (
            EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_images.campaign_id AND creator_id = auth.uid())
        );
    END IF;

    -- VERIFICATION DOCUMENTS TABLE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'verification_documents' AND policyname = 'Creators can insert own documents') THEN
         CREATE POLICY "Creators can insert own documents" ON verification_documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'verification_documents' AND policyname = 'Creators can view own documents') THEN
        CREATE POLICY "Creators can view own documents" ON verification_documents FOR SELECT USING (
             EXISTS (SELECT 1 FROM campaigns WHERE id = verification_documents.campaign_id AND creator_id = auth.uid())
        );
    END IF;

END $$;


-- ============================================================================
-- CAMPAIGN DONATIONS TABLE (New)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    donor_name TEXT,
    donor_email TEXT,
    donor_phone TEXT,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'pending', -- pending, paid, failed
    message TEXT,
    transaction_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE campaign_donations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Allow anyone to insert (donate)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_donations' AND policyname = 'Public can donate') THEN
        CREATE POLICY "Public can donate" ON campaign_donations FOR INSERT WITH CHECK (true);
    END IF;

    -- Allow hosts to view donations for their campaigns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_donations' AND policyname = 'Hosts can view campaign donations') THEN
        CREATE POLICY "Hosts can view campaign donations" ON campaign_donations FOR SELECT USING (
            EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_donations.campaign_id AND creator_id = auth.uid())
        );
    END IF;
    
END $$;

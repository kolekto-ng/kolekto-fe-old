-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Create Enums
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM (
    'draft',
    'pending_verification',
    'active',
    'paused',
    'completed',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE fundraising_category AS ENUM (
    'Alumni',
    'Charity',
    'Community',
    'Disaster',
    'Education',
    'Legal',
    'Medical',
    'Politics',
    'Sports',
    'Others'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Create Tables
-- -----------------------------------------------------------------------------

-- Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Basics
  title TEXT NOT NULL,
  summary TEXT,
  main_image_url TEXT,
  
  -- Financial Goals
  min_contribution NUMERIC(15, 2) DEFAULT 0,
  target_amount NUMERIC(15, 2), -- Nullable for open-ended
  currency TEXT DEFAULT 'NGN',
  is_open_ended BOOLEAN DEFAULT FALSE,
  deadline TIMESTAMPTZ,
  
  -- Story
  story_for TEXT,
  story_why TEXT,
  story_achieve TEXT,
  
  -- Location & Contact
  phone_number TEXT,
  country_code TEXT DEFAULT 'NG +234',
  country TEXT DEFAULT 'Nigeria',
  city TEXT,
  
  -- Categorization
  category fundraising_category,
  keywords TEXT[], -- Array of strings
  
  -- Socials
  social_twitter TEXT,
  social_instagram TEXT,
  social_facebook TEXT,
  
  -- Status & Meta
  status campaign_status DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT target_amount_check CHECK (is_open_ended OR (target_amount IS NOT NULL AND target_amount > 0))
);

-- Supporting Images Table (for Campaign Story)
CREATE TABLE IF NOT EXISTS public.campaign_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification Documents Table (Private/Internal)
CREATE TABLE IF NOT EXISTS public.verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  document_url TEXT NOT NULL,
  document_name TEXT, -- Original filename
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contributions/Donations Table
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  donor_id UUID REFERENCES auth.users(id), -- Nullable for anonymous/guest donations
  
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT DEFAULT 'NGN',
  
  donor_name TEXT, -- User provided name or "Anonymous"
  donor_email TEXT, -- For receipt
  message TEXT, -- Optional support message
  is_anonymous BOOLEAN DEFAULT FALSE,
  
  payment_reference TEXT UNIQUE, -- From payment gateway (e.g., Paystack/Stripe)
  status TEXT DEFAULT 'pending', -- pending, success, failed
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

-- Campaigns Policies
-- Everyone can read active campaigns
DROP POLICY IF EXISTS "Public can view active campaigns" ON public.campaigns;
CREATE POLICY "Public can view active campaigns"
ON public.campaigns
FOR SELECT
USING (status = 'active');

-- Creators can view all their own campaigns (drafts, pending, etc)
DROP POLICY IF EXISTS "Creators can view own campaigns" ON public.campaigns;
CREATE POLICY "Creators can view own campaigns"
ON public.campaigns
FOR SELECT
USING (auth.uid() = creator_id);

-- Creators can update their own campaigns
DROP POLICY IF EXISTS "Creators can update own campaigns" ON public.campaigns;
CREATE POLICY "Creators can update own campaigns"
ON public.campaigns
FOR UPDATE
USING (auth.uid() = creator_id);

-- Creators can insert their own campaigns
DROP POLICY IF EXISTS "Creators can create campaigns" ON public.campaigns;
CREATE POLICY "Creators can create campaigns"
ON public.campaigns
FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- Verification Documents Policies
-- Only creator and admins (if admin role exists) can see verification docs
-- Here restricting to creator
DROP POLICY IF EXISTS "Creators can view own verification docs" ON public.verification_documents;
CREATE POLICY "Creators can view own verification docs"
ON public.verification_documents
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.campaigns 
  WHERE campaigns.id = verification_documents.campaign_id 
  AND campaigns.creator_id = auth.uid()
));

DROP POLICY IF EXISTS "Creators can upload verification docs" ON public.verification_documents;
CREATE POLICY "Creators can upload verification docs"
ON public.verification_documents
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns 
  WHERE campaigns.id = verification_documents.campaign_id 
  AND campaigns.creator_id = auth.uid()
));

-- -----------------------------------------------------------------------------
-- 4. Storage Buckets Setup (Instructions)
-- -----------------------------------------------------------------------------

-- You need to create two buckets in your Storage:
-- 1. 'campaign_assets' (Public) - For main campaign images and story images.
-- 2. 'verification_docs' (Private) - For sensitive ID documents.

/*
SQL to create buckets (if using Supabase Storage extension in SQL):

-- Campaign Assets (Public)
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign_assets', 'campaign_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Verification Docs (Private)
INSERT INTO storage.buckets (id, name, public) VALUES ('verification_docs', 'verification_docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'campaign_assets'
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'campaign_assets' );

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'campaign_assets' AND auth.role() = 'authenticated' );

-- Storage Policies for 'verification_docs'
-- Only specific user can upload/read their own folder (folder name = user_id)
DROP POLICY IF EXISTS "Individual Access" ON storage.objects;
CREATE POLICY "Individual Access" ON storage.objects FOR ALL USING ( bucket_id = 'verification_docs' AND auth.uid()::text = (storage.foldername(name))[1] );
*/

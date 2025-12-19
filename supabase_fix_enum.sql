-- Safely handle the campaign_status enum and status column

DO $$
BEGIN
    -- 1. Check if the 'campaign_status' enum type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
        -- Enum exists, we need to add new values if they are missing
        -- Postgres doesn't support "ADD VALUE IF NOT EXISTS" directly in a simple way for all versions in one block,
        -- so we often just try to add them and catch errors, or inspect pg_enum.
        
        -- Add 'pending'
        BEGIN
            ALTER TYPE campaign_status ADD VALUE 'pending';
        EXCEPTION WHEN duplicate_object THEN END;

        -- Add 'active'
        BEGIN
            ALTER TYPE campaign_status ADD VALUE 'active';
        EXCEPTION WHEN duplicate_object THEN END;

        -- Add 'rejected'
        BEGIN
            ALTER TYPE campaign_status ADD VALUE 'rejected';
        EXCEPTION WHEN duplicate_object THEN END;

        -- Add 'paused'
        BEGIN
            ALTER TYPE campaign_status ADD VALUE 'paused';
        EXCEPTION WHEN duplicate_object THEN END;

         -- Add 'closed'
        BEGIN
            ALTER TYPE campaign_status ADD VALUE 'closed';
        EXCEPTION WHEN duplicate_object THEN END;
        
    ELSE
        -- Enum does not exist, but maybe the column exists as text?
        -- Let's check the column type of 'status' in 'campaigns'
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'status') THEN
             -- Column exists. Is it text or some other enum?
             -- If we want to strictly use our check constraint approach (safer/easier than Enums usually),
             -- we might want to convert it to text.
             
             -- However, if the user says "invalid input value for enum campaign_status", 
             -- it strongly suggests the column IS using the enum type.
             
             -- So we should probably just Create the enum if it was missing (impossible given the error) 
             -- OR just accept that we fixed the enum values above.
             NULL;
        ELSE
            -- Column doesn't exist, create it as text with check constraint (simpler) 
            -- OR create the enum type and use it.
            -- Given the error, let's stick to TEXT to avoid Enum headaches if possible, 
            -- BUT changing a column from ENUM to TEXT might be hard.
            
            -- Let's try to standardize on TEXT + CHECK CONSTRAINT, which is more flexible.
            NULL;
        END IF;
    END IF;

    -- 2. Drop the conflicting check constraint if it exists (from my previous failed attempt)
    -- The previous script tried to add 'campaigns_status_check'.
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

    -- 3. If the column is an ENUM, the above "ADD VALUE" steps fixed it.
    -- If the column is TEXT, we can add the check constraint safely.
    -- Let's check the column type.
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'status' 
        AND data_type = 'USER-DEFINED'
    ) THEN
        -- It is an enum. We are good since we added values above.
        NULL;
    ELSE
        -- It is TEXT (or not enum). Add the check constraint.
        -- This covers the case where the user might have deleted the column or it was never an enum.
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check 
        CHECK (status IN ('pending', 'active', 'rejected', 'paused', 'closed'));
    END IF;

END $$;

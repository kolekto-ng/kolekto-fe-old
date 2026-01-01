-- Update campaigns table to include status column with check constraint
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add check constraint for valid statuses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_status_check') THEN
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check 
        CHECK (status IN ('pending', 'active', 'rejected', 'paused', 'closed'));
    END IF;
END $$;

-- Set existing campaigns to 'active' if they are null or invalid (optional safe migration)
UPDATE campaigns SET status = 'active' WHERE status IS NULL;

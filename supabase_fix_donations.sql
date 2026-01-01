-- Add missing columns to campaign_donations table
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS donor_phone TEXT;
ALTER TABLE campaign_donations ADD COLUMN IF NOT EXISTS message TEXT;

-- Ensure RLS allows selecting the inserted row if needed (optional, but helpful for the .select() call)
-- NOTE: For anonymous inserts to return data, we might need a generic SELECT policy or just trust the INSERT return if Supabase handles it.
-- However, standard RLS might block 'RETURNING' if no SELECT policy applies to the row.
-- Since we identify donors by email/session in the future, for now let's just ensure the columns exist.

-- If you face RLS errors on the .select() call, you might need to relax policies or remove .select() if the ID isn't strictly needed for the next step immediately 
-- (though we use it for payment metadata).

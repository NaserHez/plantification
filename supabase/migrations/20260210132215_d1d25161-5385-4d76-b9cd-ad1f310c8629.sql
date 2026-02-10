
-- Add nickname and care_tips columns to plants table
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS care_tips TEXT;

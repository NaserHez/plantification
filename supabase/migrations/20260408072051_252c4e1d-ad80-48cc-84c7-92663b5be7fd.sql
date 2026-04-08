-- Add is_public to plants
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Add garden_bio and avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS garden_bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow anyone to view public plants
CREATE POLICY "Anyone can view public plants"
ON public.plants
FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Allow anyone to view profiles (for community pages)
CREATE POLICY "Anyone can view public profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow viewing photos of public plants
CREATE POLICY "Anyone can view photos of public plants"
ON public.plant_photos
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.plants
    WHERE plants.id = plant_photos.plant_id
    AND plants.is_public = true
  )
);
-- 1) Make plant-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'plant-images';

-- 2) Create community-images public bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for community-images
DROP POLICY IF EXISTS "Anyone can view community images" ON storage.objects;
CREATE POLICY "Anyone can view community images"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-images');

-- Authenticated users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload community images" ON storage.objects;
CREATE POLICY "Users can upload community images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own community images" ON storage.objects;
CREATE POLICY "Users can update own community images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'community-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own community images" ON storage.objects;
CREATE POLICY "Users can delete own community images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 3) Defensive deny-direct-insert policy on community_notifications
-- (SECURITY DEFINER triggers bypass RLS; this guards against accidental future relaxation)
DROP POLICY IF EXISTS "No direct inserts" ON public.community_notifications;
CREATE POLICY "No direct inserts"
ON public.community_notifications
FOR INSERT
TO authenticated, anon
WITH CHECK (false);
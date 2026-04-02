-- Fix plant-images storage: restrict SELECT to owner's folder
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Users can view own plant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'plant-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Fix plant-images storage: restrict INSERT to owner's folder
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'plant-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Fix plant-images storage: restrict UPDATE to owner's folder
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
CREATE POLICY "Users can update own plant images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'plant-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Fix DELETE policy
DROP POLICY IF EXISTS "Users can delete own plant images" ON storage.objects;
CREATE POLICY "Users can delete own plant images"
ON storage.objects FOR DELETE
USING (bucket_id = 'plant-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Add UPDATE policy for plant_photos
CREATE POLICY "Users can update own plant photos"
ON public.plant_photos FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
-- Fix broken SELECT policy on storage.objects for plant-images
DROP POLICY IF EXISTS "View own or public plant images" ON storage.objects;

CREATE POLICY "View own or public plant images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'plant-images' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.user_id::text = (storage.foldername(storage.objects.name))[1]
        AND plants.is_public = true
    )
  )
);
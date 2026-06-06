CREATE POLICY "View images of public plants"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'plant-images'
  AND EXISTS (
    SELECT 1 FROM public.plants p
    WHERE p.is_public = true
      AND p.image_url = storage.objects.name
  )
);
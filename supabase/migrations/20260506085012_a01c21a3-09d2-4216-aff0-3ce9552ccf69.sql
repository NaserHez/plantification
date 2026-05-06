
-- Restrict plant-images storage policies to authenticated users only
DROP POLICY IF EXISTS "View own or public plant images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own plant images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own plant images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own plant images" ON storage.objects;

CREATE POLICY "View own plant images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'plant-images'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own plant images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-images'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own plant images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'plant-images'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'plant-images'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own plant images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'plant-images'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

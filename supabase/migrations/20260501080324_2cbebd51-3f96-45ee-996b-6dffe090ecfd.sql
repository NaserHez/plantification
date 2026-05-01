
-- 1) Tighten public profiles SELECT policy
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;

CREATE POLICY "View profiles with public plants"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.plants
    WHERE plants.user_id = profiles.user_id
      AND plants.is_public = true
  )
);

-- 2) Remove broad upload policy on storage.objects so only the folder-scoped one remains
DROP POLICY IF EXISTS "Authenticated users can upload plant images" ON storage.objects;

-- 3) Tighten plant-images SELECT policy: owner OR owner has at least one public plant
DROP POLICY IF EXISTS "Anyone can view plant images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own plant images" ON storage.objects;

CREATE POLICY "View own or public plant images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'plant-images'
  AND (
    -- Owner can always view their own files
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Anyone can view files belonging to a user that has at least one public plant
    EXISTS (
      SELECT 1 FROM public.plants
      WHERE plants.user_id::text = (storage.foldername(name))[1]
        AND plants.is_public = true
    )
  )
);

-- 4) Remove journal_entries from realtime publication to prevent cross-user broadcast leakage
ALTER PUBLICATION supabase_realtime DROP TABLE public.journal_entries;

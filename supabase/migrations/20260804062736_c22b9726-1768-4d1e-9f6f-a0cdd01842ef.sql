DROP POLICY IF EXISTS "Users can update own community images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own community images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own community images" ON storage.objects;
DROP POLICY IF EXISTS "Community images are publicly readable" ON storage.objects;

DROP FUNCTION IF EXISTS public.unnotify_post_like() CASCADE;

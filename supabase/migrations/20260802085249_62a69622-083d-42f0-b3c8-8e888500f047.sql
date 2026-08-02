DROP TRIGGER IF EXISTS trg_notify_post_like ON public.post_likes;
DROP TRIGGER IF EXISTS trg_notify_post_comment ON public.post_comments;

DROP TABLE IF EXISTS public.community_notifications CASCADE;
DROP TABLE IF EXISTS public.post_reports CASCADE;
DROP TABLE IF EXISTS public.post_comments CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;

DROP FUNCTION IF EXISTS public.notify_post_like() CASCADE;
DROP FUNCTION IF EXISTS public.notify_post_comment() CASCADE;
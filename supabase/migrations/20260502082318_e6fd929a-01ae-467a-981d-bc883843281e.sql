-- Lock down SECURITY DEFINER functions so only the trigger system uses them
REVOKE EXECUTE ON FUNCTION public.notify_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unnotify_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_post_comment() FROM PUBLIC, anon, authenticated;

-- Replace overly-permissive INSERT policy on community_notifications.
-- Notifications are now exclusively created by SECURITY DEFINER triggers,
-- so direct client inserts are not needed.
DROP POLICY IF EXISTS "System can insert notifications" ON public.community_notifications;
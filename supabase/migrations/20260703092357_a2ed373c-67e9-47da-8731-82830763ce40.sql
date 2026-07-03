
-- Revoke EXECUTE from anon/authenticated for SECURITY DEFINER functions
-- that should not be directly callable via the API. Trigger and helper
-- functions only need to run in the definer/service context.

REVOKE EXECUTE ON FUNCTION public.grant_badge(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_plant_badges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_garden_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.garden_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_post_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unnotify_post_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cron_watering_secret() FROM PUBLIC, anon, authenticated;

-- Keep RPCs that users legitimately call: join_shared_garden, record_care_action.
-- Make grants explicit.
GRANT EXECUTE ON FUNCTION public.join_shared_garden(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_care_action(uuid) TO authenticated;


REVOKE ALL ON FUNCTION public.is_garden_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.garden_owner(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_badge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_plant_badges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_shared_garden(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_care_action(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_garden_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.garden_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_shared_garden(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_care_action(UUID) TO authenticated;

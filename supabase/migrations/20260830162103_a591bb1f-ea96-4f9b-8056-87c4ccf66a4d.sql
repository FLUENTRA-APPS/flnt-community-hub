
REVOKE EXECUTE ON FUNCTION public.gen_poll_code() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_poll_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_rating_cooldown() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gen_poll_code() TO service_role;


REVOKE EXECUTE ON FUNCTION public.gen_poll_code() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_poll_counts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_rating_cooldown() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

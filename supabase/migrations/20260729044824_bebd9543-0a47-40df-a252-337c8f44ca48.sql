REVOKE EXECUTE ON FUNCTION public.has_paid_access(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_access(uuid, text) TO service_role;
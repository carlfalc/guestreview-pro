REVOKE ALL ON FUNCTION public.enforce_business_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_qr_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.effective_plan_key(uuid) FROM anon;
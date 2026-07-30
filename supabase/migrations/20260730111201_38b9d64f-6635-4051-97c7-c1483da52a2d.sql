REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_stripe_webhook_event(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_webhook_event(text, text, text) TO service_role;
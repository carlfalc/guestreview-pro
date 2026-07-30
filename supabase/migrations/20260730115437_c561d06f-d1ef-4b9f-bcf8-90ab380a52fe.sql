CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bug','idea','confusing','praise','other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 4000),
  path text,
  rating integer CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','resolved','wont_fix')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON public.beta_feedback;
CREATE POLICY "Users insert own feedback" ON public.beta_feedback
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users read own feedback" ON public.beta_feedback;
CREATE POLICY "Users read own feedback" ON public.beta_feedback
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update feedback" ON public.beta_feedback;
CREATE POLICY "Admins update feedback" ON public.beta_feedback
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS beta_feedback_set_updated_at ON public.beta_feedback;
CREATE TRIGGER beta_feedback_set_updated_at BEFORE UPDATE ON public.beta_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS beta_feedback_created_idx ON public.beta_feedback (created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_beta_health(_since timestamptz DEFAULT (now() - interval '7 days'))
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'since', _since,
    'signups', (SELECT count(*) FROM public.profiles WHERE created_at >= _since),
    'totalAccounts', (SELECT count(*) FROM public.profiles),
    'businesses', (SELECT count(*) FROM public.businesses WHERE status = 'active'),
    'activeQrCodes', (SELECT count(*) FROM public.qr_codes WHERE status = 'active'),
    'scans', (SELECT count(*) FROM public.scan_events WHERE created_at >= _since),
    'scanClickThrough', (
      SELECT CASE WHEN count(*) = 0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE destination_clicked) / count(*), 1) END
      FROM public.scan_events WHERE created_at >= _since),
    'packs', (SELECT count(*) FROM public.marketing_packs WHERE created_at >= _since),
    'paidAccounts', (SELECT count(DISTINCT owner_id) FROM public.subscriptions
                      WHERE plan_key <> 'free' AND status IN ('active','trialing','past_due')),
    'checkoutsStarted', (SELECT count(*) FROM public.checkout_attempts WHERE started_at >= _since),
    'checkoutsCompleted', (SELECT count(*) FROM public.checkout_attempts
                            WHERE started_at >= _since AND status = 'completed'),
    'webhookFailures', (SELECT count(*) FROM public.stripe_webhook_events
                          WHERE processing_status = 'failed' AND received_at >= _since),
    'feedbackNew', (SELECT count(*) FROM public.beta_feedback WHERE status = 'new'),
    'feedbackTotal', (SELECT count(*) FROM public.beta_feedback WHERE created_at >= _since),
    'pendingRegionRequests', (SELECT count(*) FROM public.region_correction_requests WHERE status = 'pending')
  ) INTO result;

  RETURN result;
END;
$$;
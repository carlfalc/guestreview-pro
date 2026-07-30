-- ============================================================
-- Product / conversion analytics (first-party, privacy-conscious)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  session_id text,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No IP, no user agent, no free-text PII by design.
COMMENT ON TABLE public.product_events IS
  'First-party product analytics. Privacy-conscious: no IP addresses, no user agents, no personal data. Properties must contain non-identifying values only.';

ALTER TABLE public.product_events
  ADD CONSTRAINT product_events_name_len CHECK (char_length(event_name) BETWEEN 1 AND 64);
ALTER TABLE public.product_events
  ADD CONSTRAINT product_events_path_len CHECK (path IS NULL OR char_length(path) <= 200);
ALTER TABLE public.product_events
  ADD CONSTRAINT product_events_session_len CHECK (session_id IS NULL OR char_length(session_id) <= 64);

CREATE INDEX IF NOT EXISTS idx_product_events_owner_created
  ON public.product_events (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_name_created
  ON public.product_events (event_name, created_at DESC);

GRANT SELECT, INSERT ON public.product_events TO authenticated;
GRANT ALL ON public.product_events TO service_role;

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_events owner insert"
  ON public.product_events FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "product_events owner read"
  ON public.product_events FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "product_events admin read"
  ON public.product_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Checkout attempts (abandoned-checkout recovery)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  plan_key text NOT NULL,
  billing_interval text NOT NULL,
  currency_code text,
  amount_minor integer,
  stripe_session_id text,
  status text NOT NULL DEFAULT 'started',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  abandoned_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkout_attempts
  ADD CONSTRAINT checkout_attempts_env_chk CHECK (environment IN ('sandbox','live'));
ALTER TABLE public.checkout_attempts
  ADD CONSTRAINT checkout_attempts_plan_chk CHECK (plan_key IN ('pro','business'));
ALTER TABLE public.checkout_attempts
  ADD CONSTRAINT checkout_attempts_interval_chk CHECK (billing_interval IN ('monthly','annual'));
ALTER TABLE public.checkout_attempts
  ADD CONSTRAINT checkout_attempts_status_chk CHECK (status IN ('started','completed','dismissed'));

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_owner
  ON public.checkout_attempts (owner_id, environment, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkout_attempts_session
  ON public.checkout_attempts (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

GRANT SELECT, UPDATE ON public.checkout_attempts TO authenticated;
GRANT ALL ON public.checkout_attempts TO service_role;

ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkout_attempts owner read"
  ON public.checkout_attempts FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Owners may only dismiss their own prompt; everything else is server-written.
CREATE POLICY "checkout_attempts owner dismiss"
  ON public.checkout_attempts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND status IN ('started','dismissed'));

CREATE TRIGGER trg_checkout_attempts_updated_at
  BEFORE UPDATE ON public.checkout_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Admin-only conversion funnel
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_conversion_funnel(_since timestamptz DEFAULT (now() - interval '30 days'))
RETURNS TABLE (step text, step_order integer, accounts bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH cohort AS (
    SELECT p.id FROM public.profiles p WHERE p.created_at >= _since
  )
  SELECT 'signed_up'::text, 1, count(*)::bigint FROM cohort
  UNION ALL
  SELECT 'created_business', 2, count(DISTINCT b.owner_id)::bigint
    FROM public.businesses b JOIN cohort c ON c.id = b.owner_id
  UNION ALL
  SELECT 'created_qr', 3, count(DISTINCT q.owner_id)::bigint
    FROM public.qr_codes q JOIN cohort c ON c.id = q.owner_id
  UNION ALL
  SELECT 'downloaded_qr', 4, count(DISTINCT e.owner_id)::bigint
    FROM public.product_events e JOIN cohort c ON c.id = e.owner_id
    WHERE e.event_name IN ('qr_downloaded','pack_exported')
  UNION ALL
  SELECT 'first_scan', 5, count(DISTINCT s.owner_id)::bigint
    FROM public.scan_events s JOIN cohort c ON c.id = s.owner_id
  UNION ALL
  SELECT 'viewed_pricing', 6, count(DISTINCT e.owner_id)::bigint
    FROM public.product_events e JOIN cohort c ON c.id = e.owner_id
    WHERE e.event_name = 'pricing_viewed'
  UNION ALL
  SELECT 'started_checkout', 7, count(DISTINCT a.owner_id)::bigint
    FROM public.checkout_attempts a JOIN cohort c ON c.id = a.owner_id
  UNION ALL
  SELECT 'upgraded', 8, count(DISTINCT s.owner_id)::bigint
    FROM public.subscriptions s JOIN cohort c ON c.id = s.owner_id
    WHERE s.plan_key <> 'free'
  ORDER BY 2;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_conversion_funnel(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_conversion_funnel(timestamptz) TO authenticated;

-- ============================================================
-- Onboarding progress for the signed-in account (single round trip)
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_onboarding_progress()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'hasBusiness',   EXISTS (SELECT 1 FROM public.businesses  WHERE owner_id = auth.uid() AND status = 'active'),
    'hasQrCode',     EXISTS (SELECT 1 FROM public.qr_codes    WHERE owner_id = auth.uid() AND status = 'active'),
    'hasDownload',   EXISTS (SELECT 1 FROM public.product_events
                              WHERE owner_id = auth.uid()
                                AND event_name IN ('qr_downloaded','pack_exported')),
    'hasScan',       EXISTS (SELECT 1 FROM public.scan_events WHERE owner_id = auth.uid()),
    'hasPack',       EXISTS (SELECT 1 FROM public.marketing_packs WHERE owner_id = auth.uid()),
    'scanCount',     (SELECT count(*) FROM public.scan_events WHERE owner_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.my_onboarding_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_onboarding_progress() TO authenticated;
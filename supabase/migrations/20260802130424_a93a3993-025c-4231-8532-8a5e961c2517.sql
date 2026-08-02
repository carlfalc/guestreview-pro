-- ============ email_preferences ============
CREATE TABLE public.email_preferences (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_report_enabled boolean NOT NULL DEFAULT true,
  weekday smallint NOT NULL DEFAULT 1,
  local_time time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'UTC',
  business_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_updates_enabled boolean NOT NULL DEFAULT false,
  product_updates_consent_at timestamptz,
  product_updates_consent_source text,
  portfolio_digest_enabled boolean NOT NULL DEFAULT false,
  report_format text NOT NULL DEFAULT 'full',
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_preferences_weekday_chk CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT email_preferences_format_chk CHECK (report_format IN ('full','summary'))
);

GRANT SELECT, INSERT, UPDATE ON public.email_preferences TO authenticated;
GRANT ALL ON public.email_preferences TO service_role;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email preferences" ON public.email_preferences
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users insert own email preferences" ON public.email_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users update own email preferences" ON public.email_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins read all email preferences" ON public.email_preferences
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_preferences_set_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ email_deliveries ============
CREATE TABLE public.email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable',
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued',
  idempotency_key text UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  scheduled_for timestamptz,
  period_start timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  bounced_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_deliveries_status_chk CHECK (
    status IN ('queued','sending','sent','delivered','failed','bounced','suppressed','canceled')
  )
);

CREATE INDEX email_deliveries_owner_idx ON public.email_deliveries (owner_id, created_at DESC);
CREATE INDEX email_deliveries_status_idx ON public.email_deliveries (status, next_attempt_at);
CREATE INDEX email_deliveries_type_idx ON public.email_deliveries (email_type, created_at DESC);

GRANT SELECT ON public.email_deliveries TO authenticated;
GRANT ALL ON public.email_deliveries TO service_role;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email deliveries" ON public.email_deliveries
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins read all email deliveries" ON public.email_deliveries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_deliveries_set_updated_at
  BEFORE UPDATE ON public.email_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ email_suppressions ============
CREATE TABLE public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  source text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suppressions_unique UNIQUE (email, scope),
  CONSTRAINT email_suppressions_scope_chk CHECK (scope IN ('all','weekly_report','product_updates'))
);

GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email suppressions" ON public.email_suppressions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.email_suppressions TO authenticated;

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.suppress_email(
  p_email text, p_owner_id uuid, p_reason text, p_source text, p_scope text DEFAULT 'all'
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.email_suppressions (email, owner_id, reason, source, scope)
  VALUES (lower(trim(p_email)), p_owner_id, p_reason, p_source, COALESCE(p_scope,'all'))
  ON CONFLICT (email, scope) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.suppress_email(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Accounts whose weekly report is due right now in their own local timezone.
CREATE OR REPLACE FUNCTION public.weekly_reports_due(p_now timestamptz DEFAULT now())
RETURNS TABLE(owner_id uuid, timezone text, business_ids jsonb, report_format text, local_now timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.owner_id, p.timezone, p.business_ids, p.report_format, (p_now AT TIME ZONE p.timezone)::timestamptz
  FROM public.email_preferences p
  WHERE p.weekly_report_enabled
    AND p.unsubscribed_at IS NULL
    AND EXTRACT(DOW FROM (p_now AT TIME ZONE p.timezone))::int = p.weekday
    AND (p_now AT TIME ZONE p.timezone)::time >= p.local_time
    AND (p_now AT TIME ZONE p.timezone)::time < p.local_time + interval '2 hours';
$$;

REVOKE ALL ON FUNCTION public.weekly_reports_due(timestamptz) FROM PUBLIC, anon, authenticated;

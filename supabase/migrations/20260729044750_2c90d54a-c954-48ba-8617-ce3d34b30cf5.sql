-- Subscriptions -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  environment text NOT NULL DEFAULT 'sandbox',
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  stripe_product_id text,
  plan_key text NOT NULL DEFAULT 'free',
  billing_interval text,
  currency_code text,
  amount_minor integer,
  pricing_region text,
  status text NOT NULL DEFAULT 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  trial_end timestamptz,
  last_invoice_id text,
  last_payment_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_env_chk CHECK (environment IN ('sandbox','live')),
  CONSTRAINT subscriptions_plan_chk CHECK (plan_key IN ('free','pro','business')),
  CONSTRAINT subscriptions_interval_chk CHECK (billing_interval IS NULL OR billing_interval IN ('monthly','annual')),
  CONSTRAINT subscriptions_status_chk CHECK (status IN (
    'free','incomplete','incomplete_expired','trialing','active',
    'past_due','unpaid','paused','canceled'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_customer_uidx
  ON public.subscriptions (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can read their subscription" ON public.subscriptions;
CREATE POLICY "Owners can read their subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Webhook event ledger --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'received',
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT stripe_webhook_events_status_chk
    CHECK (processing_status IN ('received','processed','failed','ignored'))
);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admins can read webhook events"
  ON public.stripe_webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Paid-access helper ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_paid_access(_owner_id uuid, _environment text DEFAULT 'sandbox')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.owner_id = _owner_id
      AND s.environment = _environment
      AND s.plan_key <> 'free'
      AND (
        (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  );
$$;
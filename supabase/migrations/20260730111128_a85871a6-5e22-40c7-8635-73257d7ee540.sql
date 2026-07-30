-- 1. Retry-safe webhook event tracking
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

UPDATE public.stripe_webhook_events SET environment = CASE WHEN livemode THEN 'live' ELSE 'sandbox' END;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_webhook_events_environment_check') THEN
    ALTER TABLE public.stripe_webhook_events
      ADD CONSTRAINT stripe_webhook_events_environment_check CHECK (environment IN ('sandbox','live'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_webhook_events_status_check') THEN
    ALTER TABLE public.stripe_webhook_events
      ADD CONSTRAINT stripe_webhook_events_status_check
      CHECK (processing_status IN ('received','processing','processed','failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stripe_webhook_events_event_id_key') THEN
    ALTER TABLE public.stripe_webhook_events
      ADD CONSTRAINT stripe_webhook_events_event_id_key UNIQUE (stripe_event_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON public.stripe_webhook_events(processing_status, received_at DESC);

-- Atomic claim. Returns 'claimed' | 'processed' | 'locked'.
CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_environment text,
  p_livemode boolean
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed boolean := false;
  v_status text;
BEGIN
  INSERT INTO public.stripe_webhook_events
    (stripe_event_id, event_type, environment, livemode, processing_status, retry_count, last_attempt_at)
  VALUES
    (p_event_id, p_event_type, p_environment, p_livemode, 'processing', 1, now())
  ON CONFLICT (stripe_event_id) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed THEN
    RETURN 'claimed';
  END IF;

  UPDATE public.stripe_webhook_events
     SET processing_status = 'processing',
         retry_count = retry_count + 1,
         last_attempt_at = now(),
         error_message = NULL
   WHERE stripe_event_id = p_event_id
     AND (
       processing_status IN ('received','failed')
       OR (processing_status = 'processing' AND last_attempt_at < now() - interval '10 minutes')
     )
  RETURNING processing_status INTO v_status;

  IF v_status IS NOT NULL THEN
    RETURN 'claimed';
  END IF;

  SELECT processing_status INTO v_status
    FROM public.stripe_webhook_events WHERE stripe_event_id = p_event_id;

  IF v_status = 'processed' THEN
    RETURN 'processed';
  END IF;
  RETURN 'locked';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_stripe_webhook_event(
  p_event_id text,
  p_status text,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.stripe_webhook_events
     SET processing_status = CASE WHEN p_status = 'processed' THEN 'processed' ELSE 'failed' END,
         error_message = left(p_error, 1000),
         processed_at = CASE WHEN p_status = 'processed' THEN now() ELSE processed_at END
   WHERE stripe_event_id = p_event_id;
$$;

-- 2. Trusted Stripe price -> plan mapping
CREATE TABLE IF NOT EXISTS public.regional_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id text,
  stripe_lookup_key text NOT NULL,
  plan_key text NOT NULL CHECK (plan_key IN ('pro','business')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly','annual')),
  currency_code text NOT NULL,
  pricing_region text NOT NULL,
  amount_minor integer NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_lookup_key, environment)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_plan_prices_price_id
  ON public.regional_plan_prices(stripe_price_id, environment)
  WHERE stripe_price_id IS NOT NULL;

GRANT SELECT ON public.regional_plan_prices TO authenticated;
GRANT ALL ON public.regional_plan_prices TO service_role;

ALTER TABLE public.regional_plan_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read plan price mapping"
  ON public.regional_plan_prices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_regional_plan_prices_updated_at ON public.regional_plan_prices;
CREATE TRIGGER set_regional_plan_prices_updated_at
  BEFORE UPDATE ON public.regional_plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.regional_plan_prices
  (stripe_lookup_key, plan_key, billing_interval, currency_code, pricing_region, amount_minor, environment)
SELECT
  p.plan_key || '_' || p.billing_interval || '_' || lower(p.currency_code),
  p.plan_key, p.billing_interval, p.currency_code, p.pricing_region, p.amount_minor, e.environment
FROM (VALUES
  ('pro','monthly','NZD','NZ',2900),   ('pro','annual','NZD','NZ',29000),
  ('business','monthly','NZD','NZ',7900), ('business','annual','NZD','NZ',79000),
  ('pro','monthly','AUD','AU',2900),   ('pro','annual','AUD','AU',29000),
  ('business','monthly','AUD','AU',7900), ('business','annual','AUD','AU',79000),
  ('pro','monthly','USD','US',1900),   ('pro','annual','USD','US',19000),
  ('business','monthly','USD','US',4900), ('business','annual','USD','US',49000),
  ('pro','monthly','CAD','CA',2700),   ('pro','annual','CAD','CA',27000),
  ('business','monthly','CAD','CA',6900), ('business','annual','CAD','CA',69000),
  ('pro','monthly','GBP','GB',1500),   ('pro','annual','GBP','GB',15000),
  ('business','monthly','GBP','GB',3900), ('business','annual','GBP','GB',39000),
  ('pro','monthly','EUR','EU',1700),   ('pro','annual','EUR','EU',17000),
  ('business','monthly','EUR','EU',4500), ('business','annual','EUR','EU',45000)
) AS p(plan_key, billing_interval, currency_code, pricing_region, amount_minor)
CROSS JOIN (VALUES ('sandbox'), ('live')) AS e(environment)
ON CONFLICT (stripe_lookup_key, environment) DO NOTHING;
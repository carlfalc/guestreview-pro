-- Server-authoritative plan limits enforced at the database level.

CREATE OR REPLACE FUNCTION public.effective_plan_key(_owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
        WHEN s.plan_key = 'free' THEN 'free'
        WHEN s.status IN ('active','trialing','past_due')
             AND (s.current_period_end IS NULL OR s.current_period_end > now()) THEN s.plan_key
        WHEN s.status = 'canceled'
             AND s.current_period_end IS NOT NULL AND s.current_period_end > now() THEN s.plan_key
        ELSE 'free'
      END
     FROM public.subscriptions s
     WHERE s.owner_id = _owner_id
     ORDER BY s.updated_at DESC
     LIMIT 1),
    'free');
$$;

REVOKE ALL ON FUNCTION public.effective_plan_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_plan_key(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_business_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_max integer;
  v_count integer;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.status <> 'active' OR OLD.status = 'active') THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_plan := public.effective_plan_key(NEW.owner_id);
  v_max := CASE WHEN v_plan = 'business' THEN 10 ELSE 1 END;

  SELECT count(*) INTO v_count
  FROM public.businesses
  WHERE owner_id = NEW.owner_id AND status = 'active' AND id <> NEW.id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'PLAN_LIMIT_BUSINESSES: your current plan includes % business(es). Upgrade to add more.', v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_qr_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_count integer;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.status <> 'active' OR OLD.status = 'active') THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  v_plan := public.effective_plan_key(NEW.owner_id);
  IF v_plan <> 'free' THEN
    RETURN NEW; -- paid plans are unlimited
  END IF;

  SELECT count(*) INTO v_count
  FROM public.qr_codes
  WHERE owner_id = NEW.owner_id AND status = 'active' AND id <> NEW.id;

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'PLAN_LIMIT_QR_CODES: the Free plan includes 1 active QR code. Upgrade to Pro for unlimited QR codes.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_business_limit_trg ON public.businesses;
CREATE TRIGGER enforce_business_limit_trg
  BEFORE INSERT OR UPDATE OF status ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_limit();

DROP TRIGGER IF EXISTS enforce_qr_limit_trg ON public.qr_codes;
CREATE TRIGGER enforce_qr_limit_trg
  BEFORE INSERT OR UPDATE OF status ON public.qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_qr_limit();
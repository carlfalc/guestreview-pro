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
    RETURN NEW;
  END IF;

  IF NEW.destination_type = 'website' THEN
    SELECT count(*) INTO v_count
    FROM public.qr_codes
    WHERE owner_id = NEW.owner_id
      AND status = 'active'
      AND destination_type = 'website'
      AND id <> NEW.id;

    IF v_count >= 3 THEN
      RAISE EXCEPTION 'PLAN_LIMIT_WEBSITE_QR_CODES: the Free plan includes 3 website QR codes. Upgrade for unlimited website QR codes.'
        USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.qr_codes
  WHERE owner_id = NEW.owner_id
    AND status = 'active'
    AND destination_type <> 'website'
    AND id <> NEW.id;

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'PLAN_LIMIT_QR_CODES: the Free plan includes 1 active QR code. Upgrade to Pro for unlimited QR codes.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_qr_limit() FROM PUBLIC, anon, authenticated;
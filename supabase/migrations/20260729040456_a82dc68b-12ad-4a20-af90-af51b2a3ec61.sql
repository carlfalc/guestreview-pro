CREATE OR REPLACE FUNCTION public.log_scan_redirect(
  p_qr_id uuid,
  p_destination_type text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_os text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_visitor_hash text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_clicked boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_qr public.qr_codes%ROWTYPE;
  v_event_id uuid;
BEGIN
  SELECT * INTO v_qr FROM public.qr_codes WHERE id = p_qr_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.scan_events (
    qr_code_id, business_id, location_id, owner_id, campaign,
    destination_type, device_type, os, browser, user_agent,
    visitor_hash, referrer, session_id, country_code,
    destination_clicked, destination_clicked_at
  ) VALUES (
    v_qr.id, v_qr.business_id, v_qr.location_id, v_qr.owner_id, v_qr.campaign,
    COALESCE(p_destination_type, v_qr.destination_type), p_device_type, p_os, p_browser, p_user_agent,
    p_visitor_hash, p_referrer, p_session_id, p_country_code,
    COALESCE(p_clicked, true), CASE WHEN COALESCE(p_clicked, true) THEN now() ELSE NULL END
  )
  RETURNING id INTO v_event_id;

  UPDATE public.qr_codes SET scans_count = scans_count + 1 WHERE id = v_qr.id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_scan_redirect(uuid, text, text, text, text, text, text, text, text, text, boolean) TO anon, authenticated, service_role;
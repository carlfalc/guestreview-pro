
CREATE OR REPLACE FUNCTION public.increment_qr_scans(p_qr_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.qr_codes SET scans_count = scans_count + 1 WHERE id = p_qr_id AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.increment_qr_scans(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_qr_scans(uuid) TO anon, authenticated;

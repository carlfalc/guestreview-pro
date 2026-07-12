
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "scan_events public insert" ON public.scan_events;
CREATE POLICY "scan_events public insert" ON public.scan_events
  FOR INSERT TO anon
  WITH CHECK (
    qr_code_id IS NOT NULL
    AND business_id IS NOT NULL
    AND owner_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.qr_codes q
      WHERE q.id = qr_code_id
        AND q.business_id = scan_events.business_id
        AND q.owner_id = scan_events.owner_id
        AND q.status = 'active'
    )
  );
CREATE POLICY "scan_events auth insert" ON public.scan_events
  FOR INSERT TO authenticated
  WITH CHECK (
    qr_code_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.qr_codes q
      WHERE q.id = qr_code_id AND q.status = 'active'
    )
  );

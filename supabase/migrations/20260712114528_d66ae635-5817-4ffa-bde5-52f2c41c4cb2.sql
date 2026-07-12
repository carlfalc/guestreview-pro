-- Add new scan_events columns
ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS clicked_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_scan_events_updated_at ON public.scan_events;
CREATE TRIGGER set_scan_events_updated_at
  BEFORE UPDATE ON public.scan_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS scan_events_qr_code_id_idx ON public.scan_events (qr_code_id);
CREATE INDEX IF NOT EXISTS scan_events_business_id_idx ON public.scan_events (business_id);
CREATE INDEX IF NOT EXISTS scan_events_created_at_idx ON public.scan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS scan_events_session_id_idx ON public.scan_events (session_id);
CREATE INDEX IF NOT EXISTS scan_events_clicked_review_idx ON public.scan_events (clicked_review);

-- RPC function for anonymous visitors to mark their scan as clicked-through.
-- Uses security definer so anon can update the row they just created without needing a broad UPDATE policy.
CREATE OR REPLACE FUNCTION public.mark_scan_clicked(p_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.scan_events
    SET clicked_review = true,
        clicked_review_at = now()
  WHERE id = p_event_id
    AND clicked_review = false;
$$;

GRANT EXECUTE ON FUNCTION public.mark_scan_clicked(uuid) TO anon, authenticated;
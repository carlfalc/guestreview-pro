
-- Part A: scan_events new fields
ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS destination_clicked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS destination_clicked_at timestamptz;

-- Backfill: any prior review click counts as a destination click
UPDATE public.scan_events
  SET destination_clicked = true, destination_clicked_at = clicked_review_at
  WHERE clicked_review = true AND destination_clicked = false;

-- Denormalise destination_type onto scan_events for analytics (nullable, informational)
ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS destination_type text;

UPDATE public.scan_events se
  SET destination_type = q.destination_type
  FROM public.qr_codes q
  WHERE se.qr_code_id = q.id AND se.destination_type IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS scan_events_destination_clicked_idx ON public.scan_events (destination_clicked);
CREATE INDEX IF NOT EXISTS scan_events_destination_type_idx ON public.scan_events (destination_type);
CREATE INDEX IF NOT EXISTS scan_events_clicked_review_idx ON public.scan_events (clicked_review);
CREATE INDEX IF NOT EXISTS scan_events_qr_session_idx ON public.scan_events (qr_code_id, session_id);

-- Replace mark_scan_clicked to require session_id and a destination flag
DROP FUNCTION IF EXISTS public.mark_scan_clicked(uuid);
DROP FUNCTION IF EXISTS public.mark_scan_clicked(uuid, text);
DROP FUNCTION IF EXISTS public.mark_scan_clicked(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.mark_scan_clicked(
  p_event_id uuid,
  p_session_id text,
  p_is_review boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.scan_events
     SET destination_clicked = true,
         destination_clicked_at = COALESCE(destination_clicked_at, now()),
         clicked_review = CASE WHEN p_is_review THEN true ELSE clicked_review END,
         clicked_review_at = CASE
           WHEN p_is_review AND clicked_review_at IS NULL THEN now()
           ELSE clicked_review_at
         END
   WHERE id = p_event_id
     AND session_id = p_session_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_scan_clicked(uuid, text, boolean) TO anon, authenticated;

-- Part B: format project fields on qr_codes
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS selected_formats jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS layout_template text NOT NULL DEFAULT 'clean-minimal',
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS support_text text,
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS format_customizations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS format_last_edited_at timestamptz;

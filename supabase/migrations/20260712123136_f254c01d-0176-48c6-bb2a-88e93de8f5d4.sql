
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS destination_type text NOT NULL DEFAULT 'google_review',
  ADD COLUMN IF NOT EXISTS destination_url text,
  ADD COLUMN IF NOT EXISTS destination_label text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS landing_mode text NOT NULL DEFAULT 'landing';

-- constrain destination_type
DO $$ BEGIN
  ALTER TABLE public.qr_codes ADD CONSTRAINT qr_codes_destination_type_check CHECK (destination_type IN (
    'google_review','website','menu','restaurant_booking','accommodation_booking','feedback','wifi','loyalty','event','social_media','custom'
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.qr_codes ADD CONSTRAINT qr_codes_landing_mode_check CHECK (landing_mode IN ('landing','redirect'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.qr_codes ADD CONSTRAINT qr_codes_status_check CHECK (status IN ('active','paused','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_qr_codes_updated_at ON public.qr_codes;
CREATE TRIGGER trg_qr_codes_updated_at
BEFORE UPDATE ON public.qr_codes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

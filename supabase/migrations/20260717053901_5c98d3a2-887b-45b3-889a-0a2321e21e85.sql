
-- 1) account_regions
CREATE TABLE public.account_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  country_name text NOT NULL,
  currency_code text NOT NULL,
  currency_symbol text NOT NULL,
  currency_name text NOT NULL,
  pricing_region text NOT NULL,
  detection_source text NOT NULL,
  confidence text NOT NULL,
  is_locked boolean NOT NULL DEFAULT true,
  detected_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  stripe_billing_country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_regions TO authenticated;
GRANT ALL ON public.account_regions TO service_role;

ALTER TABLE public.account_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own region"
  ON public.account_regions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- No INSERT/UPDATE/DELETE policies for authenticated — only service_role may write.

CREATE TRIGGER trg_account_regions_updated_at
  BEFORE UPDATE ON public.account_regions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) region_correction_requests
CREATE TABLE public.region_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_country_code text,
  requested_country_code text NOT NULL,
  reason text NOT NULL,
  supporting_information text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT region_correction_status_chk
    CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX region_correction_requests_owner_idx
  ON public.region_correction_requests(owner_id);

GRANT SELECT, INSERT ON public.region_correction_requests TO authenticated;
GRANT ALL ON public.region_correction_requests TO service_role;

ALTER TABLE public.region_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own correction requests"
  ON public.region_correction_requests FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners create their own correction requests"
  ON public.region_correction_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND status = 'pending'
    AND admin_notes IS NULL
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

CREATE TRIGGER trg_region_correction_requests_updated_at
  BEFORE UPDATE ON public.region_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) businesses: structured address columns
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country_code text;

-- 4) Backfill existing NZ business + account region for owner in Whanganui
UPDATE public.businesses
  SET country_code = 'NZ', city = COALESCE(city, 'Whanganui')
  WHERE address ILIKE '%Whanganui%' AND country_code IS NULL;

INSERT INTO public.account_regions (
  owner_id, country_code, country_name, currency_code, currency_symbol, currency_name,
  pricing_region, detection_source, confidence, is_locked, detected_at
)
SELECT DISTINCT b.owner_id,
  'NZ','New Zealand','NZD','NZ$','New Zealand Dollar',
  'NZ','business_address','high', true, now()
FROM public.businesses b
WHERE b.country_code = 'NZ'
ON CONFLICT (owner_id) DO NOTHING;

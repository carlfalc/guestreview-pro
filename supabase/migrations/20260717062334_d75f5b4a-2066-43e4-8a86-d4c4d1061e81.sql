
-- 1. Data validation on account_regions
ALTER TABLE public.account_regions
  DROP CONSTRAINT IF EXISTS account_regions_country_code_chk,
  DROP CONSTRAINT IF EXISTS account_regions_currency_code_chk,
  DROP CONSTRAINT IF EXISTS account_regions_pricing_region_chk,
  DROP CONSTRAINT IF EXISTS account_regions_detection_source_chk,
  DROP CONSTRAINT IF EXISTS account_regions_confidence_chk,
  DROP CONSTRAINT IF EXISTS account_regions_stripe_billing_country_chk;

ALTER TABLE public.account_regions
  ADD CONSTRAINT account_regions_country_code_chk
    CHECK (country_code ~ '^[A-Z]{2}$' OR country_code = 'ZZ'),
  ADD CONSTRAINT account_regions_currency_code_chk
    CHECK (currency_code IN (
      'NZD','AUD','USD','CAD','GBP','EUR','SGD','HKD','JPY','KRW','INR','ZAR',
      'AED','SAR','CHF','NOK','SEK','DKK','PLN','BRL','MXN','MYR','THB','PHP','IDR'
    )),
  ADD CONSTRAINT account_regions_pricing_region_chk
    CHECK (pricing_region IN (
      'NZ','AU','US','CA','GB','EU','SG','HK','JP','KR','IN','ZA','AE','SA','CH',
      'NO','SE','DK','PL','BR','MX','MY','TH','PH','ID','INTERNATIONAL'
    )),
  ADD CONSTRAINT account_regions_detection_source_chk
    CHECK (detection_source IN (
      'stripe_billing','business_address','registration','profile',
      'ip_geolocation','browser_locale','admin_correction','fallback'
    )),
  ADD CONSTRAINT account_regions_confidence_chk
    CHECK (confidence IN ('high','medium','low')),
  ADD CONSTRAINT account_regions_stripe_billing_country_chk
    CHECK (stripe_billing_country IS NULL OR stripe_billing_country ~ '^[A-Z]{2}$');

-- 2. region_correction_requests: constraints + partial unique index
ALTER TABLE public.region_correction_requests
  DROP CONSTRAINT IF EXISTS rcr_requested_cc_chk,
  DROP CONSTRAINT IF EXISTS rcr_current_cc_chk,
  DROP CONSTRAINT IF EXISTS rcr_reason_chk,
  DROP CONSTRAINT IF EXISTS rcr_status_chk;

ALTER TABLE public.region_correction_requests
  ADD CONSTRAINT rcr_requested_cc_chk CHECK (requested_country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT rcr_current_cc_chk   CHECK (current_country_code IS NULL OR current_country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT rcr_reason_chk       CHECK (char_length(btrim(reason)) >= 5),
  ADD CONSTRAINT rcr_status_chk       CHECK (status IN ('pending','approved','rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS rcr_one_pending_per_owner
  ON public.region_correction_requests(owner_id)
  WHERE status = 'pending';

-- Admins can read + update any correction request
DROP POLICY IF EXISTS "Admins can view all correction requests" ON public.region_correction_requests;
CREATE POLICY "Admins can view all correction requests"
  ON public.region_correction_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can review correction requests" ON public.region_correction_requests;
CREATE POLICY "Admins can review correction requests"
  ON public.region_correction_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Registration country snapshot on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_country_code text,
  ADD COLUMN IF NOT EXISTS registration_country_source text,
  ADD COLUMN IF NOT EXISTS registration_country_recorded_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_registration_country_code_chk,
  DROP CONSTRAINT IF EXISTS profiles_registration_country_source_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_registration_country_code_chk
    CHECK (registration_country_code IS NULL OR registration_country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT profiles_registration_country_source_chk
    CHECK (registration_country_source IS NULL OR registration_country_source IN (
      'business_address','ip_geolocation','browser_locale','admin','stripe_billing'
    ));

-- Users cannot edit their own registration_country_* (block at UPDATE via policy replacement).
-- We keep existing "users can update their own profile" but disallow changing the registration_country_code once set:
-- Easiest: BEFORE UPDATE trigger that resets registration_country_* to OLD when user is not admin.
CREATE OR REPLACE FUNCTION public.protect_registration_country()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF OLD.registration_country_code IS NOT NULL THEN
      NEW.registration_country_code := OLD.registration_country_code;
      NEW.registration_country_source := OLD.registration_country_source;
      NEW.registration_country_recorded_at := OLD.registration_country_recorded_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_protect_registration_country ON public.profiles;
CREATE TRIGGER profiles_protect_registration_country
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_registration_country();

-- 4. Audit log
CREATE TABLE IF NOT EXISTS public.account_region_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_country_code text,
  new_country_code text,
  previous_currency_code text,
  new_currency_code text,
  previous_pricing_region text,
  new_pricing_region text,
  change_source text NOT NULL CHECK (change_source IN (
    'initial_detection','admin_correction','stripe_verified','manual_support','system_backfill'
  )),
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_region_audit_log TO authenticated;
GRANT ALL ON public.account_region_audit_log TO service_role;

ALTER TABLE public.account_region_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their region audit entries"
  ON public.account_region_audit_log FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can read all region audit entries"
  ON public.account_region_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- No INSERT/UPDATE/DELETE policy: only service_role writes.

CREATE INDEX IF NOT EXISTS account_region_audit_owner_created
  ON public.account_region_audit_log(owner_id, created_at DESC);

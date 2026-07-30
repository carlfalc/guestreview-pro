ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_primary_qr_id uuid,
  ADD COLUMN IF NOT EXISTS plan_primary_business_id uuid,
  ADD COLUMN IF NOT EXISTS upgrade_checklist_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS upgrade_welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS upgrade_welcome_plan_key text;
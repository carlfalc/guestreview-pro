ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS portfolio_weekday smallint,
  ADD COLUMN IF NOT EXISTS portfolio_local_time time without time zone,
  ADD COLUMN IF NOT EXISTS portfolio_business_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.email_preferences
  DROP CONSTRAINT IF EXISTS email_preferences_portfolio_weekday_chk;
ALTER TABLE public.email_preferences
  ADD CONSTRAINT email_preferences_portfolio_weekday_chk
  CHECK (portfolio_weekday IS NULL OR (portfolio_weekday BETWEEN 0 AND 6));

CREATE INDEX IF NOT EXISTS email_deliveries_recipient_type_idx
  ON public.email_deliveries (recipient_email, email_type, created_at DESC);
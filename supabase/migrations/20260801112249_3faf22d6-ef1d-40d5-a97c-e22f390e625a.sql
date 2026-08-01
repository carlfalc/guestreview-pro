CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  guide_key text NOT NULL DEFAULT 'qr-placement-guide',
  industry text,
  source_path text,
  marketing_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_leads_email_len CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT marketing_leads_guide_len CHECK (char_length(guide_key) BETWEEN 1 AND 64),
  CONSTRAINT marketing_leads_industry_len CHECK (industry IS NULL OR char_length(industry) <= 64),
  CONSTRAINT marketing_leads_source_len CHECK (source_path IS NULL OR char_length(source_path) <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_leads_email_guide_idx
  ON public.marketing_leads (lower(email), guide_key);

GRANT SELECT ON public.marketing_leads TO authenticated;
GRANT ALL ON public.marketing_leads TO service_role;

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read marketing leads" ON public.marketing_leads;
CREATE POLICY "Admins can read marketing leads"
  ON public.marketing_leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'admin'));
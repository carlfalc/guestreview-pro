CREATE TABLE public.print_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  email text NOT NULL,
  country_code text,
  product_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_quantity text,
  preferred_size text,
  preferred_material text,
  desired_timeframe text,
  comments text,
  contact_consent boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_interest_status_check CHECK (status IN ('new','contacted','quoted','converted','not_interested','archived'))
);

CREATE UNIQUE INDEX print_interest_owner_source_key ON public.print_interest (owner_id, source);
CREATE INDEX print_interest_created_at_idx ON public.print_interest (created_at DESC);
CREATE INDEX print_interest_status_idx ON public.print_interest (status);

GRANT SELECT, INSERT, UPDATE ON public.print_interest TO authenticated;
GRANT ALL ON public.print_interest TO service_role;

ALTER TABLE public.print_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own print interest"
  ON public.print_interest FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners create own print interest"
  ON public.print_interest FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update own print interest"
  ON public.print_interest FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins update print interest"
  ON public.print_interest FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER print_interest_set_updated_at
  BEFORE UPDATE ON public.print_interest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
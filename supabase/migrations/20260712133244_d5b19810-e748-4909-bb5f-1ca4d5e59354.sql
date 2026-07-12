
-- Marketing Packs table for Stage 4 builder
CREATE TABLE public.marketing_packs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  project_name text not null,
  description text,
  pack_type text not null default 'custom',
  layout_template text not null default 'clean-minimal',
  headline text,
  support_text text,
  cta_text text,
  footer_text text,
  show_business_name boolean not null default true,
  show_logo boolean not null default true,
  show_stars boolean not null default true,
  show_google_badge boolean not null default true,
  selected_formats jsonb not null default '[]'::jsonb,
  global_settings jsonb not null default '{}'::jsonb,
  format_customizations jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_packs TO authenticated;
GRANT ALL ON public.marketing_packs TO service_role;

ALTER TABLE public.marketing_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their packs"
  ON public.marketing_packs FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their packs"
  ON public.marketing_packs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their packs"
  ON public.marketing_packs FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their packs"
  ON public.marketing_packs FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE INDEX marketing_packs_owner_idx ON public.marketing_packs(owner_id, updated_at DESC);
CREATE INDEX marketing_packs_business_idx ON public.marketing_packs(business_id);
CREATE INDEX marketing_packs_qr_idx ON public.marketing_packs(qr_code_id);

CREATE TRIGGER marketing_packs_set_updated_at
  BEFORE UPDATE ON public.marketing_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

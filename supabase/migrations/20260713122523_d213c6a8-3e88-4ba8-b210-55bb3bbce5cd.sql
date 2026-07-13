
-- 1. business-level AI copy preferences
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ai_copy_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. generations history
CREATE TABLE IF NOT EXISTS public.ai_copy_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  marketing_pack_id uuid REFERENCES public.marketing_packs(id) ON DELETE SET NULL,
  format_id text,
  placement text,
  tone text,
  language text,
  input_summary text,
  generated_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_alternative integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_copy_generations_owner_idx ON public.ai_copy_generations(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_copy_generations_business_idx ON public.ai_copy_generations(business_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_copy_generations TO authenticated;
GRANT ALL ON public.ai_copy_generations TO service_role;
ALTER TABLE public.ai_copy_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own generations"
  ON public.ai_copy_generations FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 3. favourites
CREATE TABLE IF NOT EXISTS public.ai_copy_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  headline text,
  support_text text,
  cta_text text,
  footer_text text,
  tone text,
  placement text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_copy_favourites_owner_idx ON public.ai_copy_favourites(owner_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_copy_favourites TO authenticated;
GRANT ALL ON public.ai_copy_favourites TO service_role;
ALTER TABLE public.ai_copy_favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favourites"
  ON public.ai_copy_favourites FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

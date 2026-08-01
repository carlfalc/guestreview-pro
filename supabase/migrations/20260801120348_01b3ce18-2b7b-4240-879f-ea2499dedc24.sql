CREATE TABLE public.placement_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text NOT NULL,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_placements jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  generated_qr_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  marketing_pack_id uuid REFERENCES public.marketing_packs(id) ON DELETE SET NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT placement_plans_status_check CHECK (status IN ('draft','ready','generating','generated','partially_generated','archived'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.placement_plans TO authenticated;
GRANT ALL ON public.placement_plans TO service_role;
ALTER TABLE public.placement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their placement plans" ON public.placement_plans
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX placement_plans_owner_idx ON public.placement_plans (owner_id, updated_at DESC);
CREATE INDEX placement_plans_business_idx ON public.placement_plans (business_id);

CREATE TRIGGER placement_plans_set_updated_at
  BEFORE UPDATE ON public.placement_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.placement_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_plan_id uuid NOT NULL REFERENCES public.placement_plans(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  placement_key text NOT NULL,
  placement_name text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  goal text,
  destination_type text NOT NULL DEFAULT 'google_review',
  destination_url text,
  recommended_format_id text,
  qr_code_id uuid REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  headline text,
  support_text text,
  cta_text text,
  material text,
  sort_order integer NOT NULL DEFAULT 0,
  implementation_status text NOT NULL DEFAULT 'draft',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT placement_plan_items_priority_check CHECK (priority IN ('high','medium','low')),
  CONSTRAINT placement_plan_items_status_check CHECK (implementation_status IN ('draft','ready','generating','generated','failed','skipped','archived'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.placement_plan_items TO authenticated;
GRANT ALL ON public.placement_plan_items TO service_role;
ALTER TABLE public.placement_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their placement plan items" ON public.placement_plan_items
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX placement_plan_items_plan_idx ON public.placement_plan_items (placement_plan_id, sort_order);
CREATE INDEX placement_plan_items_owner_idx ON public.placement_plan_items (owner_id);

CREATE TRIGGER placement_plan_items_set_updated_at
  BEFORE UPDATE ON public.placement_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS placement_plan_id uuid REFERENCES public.placement_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_plan_item_id uuid REFERENCES public.placement_plan_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placement_key text,
  ADD COLUMN IF NOT EXISTS business_goal text;

CREATE INDEX IF NOT EXISTS qr_codes_placement_plan_idx ON public.qr_codes (placement_plan_id);
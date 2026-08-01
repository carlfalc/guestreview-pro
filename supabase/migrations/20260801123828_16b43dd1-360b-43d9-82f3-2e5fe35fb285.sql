CREATE TABLE IF NOT EXISTS public.recommendation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  recommendation_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('completed','snoozed','dismissed')),
  snooze_until timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, business_id, recommendation_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_actions TO authenticated;
GRANT ALL ON public.recommendation_actions TO service_role;

ALTER TABLE public.recommendation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their recommendation actions" ON public.recommendation_actions;
CREATE POLICY "Owners manage their recommendation actions"
  ON public.recommendation_actions FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP TRIGGER IF EXISTS set_recommendation_actions_updated_at ON public.recommendation_actions;
CREATE TRIGGER set_recommendation_actions_updated_at
  BEFORE UPDATE ON public.recommendation_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS recommendation_actions_owner_business_idx
  ON public.recommendation_actions (owner_id, business_id);
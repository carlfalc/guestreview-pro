CREATE TABLE IF NOT EXISTS public.weekly_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  health_score_id uuid,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_output jsonb,
  provider text NOT NULL DEFAULT 'lovable-ai',
  model text,
  generation_status text NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending','generating','completed','failed','insufficient_data')),
  error_message text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_ai_insights_period_valid CHECK (period_end > period_start)
);

GRANT SELECT, DELETE ON public.weekly_ai_insights TO authenticated;
GRANT ALL ON public.weekly_ai_insights TO service_role;

ALTER TABLE public.weekly_ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their own weekly insights" ON public.weekly_ai_insights;
CREATE POLICY "Owners read their own weekly insights"
  ON public.weekly_ai_insights FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners delete their own weekly insights" ON public.weekly_ai_insights;
CREATE POLICY "Owners delete their own weekly insights"
  ON public.weekly_ai_insights FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

DROP TRIGGER IF EXISTS set_weekly_ai_insights_updated_at ON public.weekly_ai_insights;
CREATE TRIGGER set_weekly_ai_insights_updated_at
  BEFORE UPDATE ON public.weekly_ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS weekly_ai_insights_owner_business_idx
  ON public.weekly_ai_insights (owner_id, business_id, created_at DESC);

-- One in-flight generation per business at a time (blocks duplicate concurrent requests).
CREATE UNIQUE INDEX IF NOT EXISTS weekly_ai_insights_one_inflight_idx
  ON public.weekly_ai_insights (business_id)
  WHERE generation_status IN ('pending','generating');

CREATE TABLE IF NOT EXISTS public.weekly_ai_insight_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid NOT NULL REFERENCES public.weekly_ai_insights(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  reason text CHECK (reason IN ('too_generic','incorrect_emphasis','missing_context','too_long','other')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insight_id, owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_ai_insight_feedback TO authenticated;
GRANT ALL ON public.weekly_ai_insight_feedback TO service_role;

ALTER TABLE public.weekly_ai_insight_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their insight feedback" ON public.weekly_ai_insight_feedback;
CREATE POLICY "Owners manage their insight feedback"
  ON public.weekly_ai_insight_feedback FOR ALL
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid());

DROP TRIGGER IF EXISTS set_weekly_ai_insight_feedback_updated_at ON public.weekly_ai_insight_feedback;
CREATE TRIGGER set_weekly_ai_insight_feedback_updated_at
  BEFORE UPDATE ON public.weekly_ai_insight_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
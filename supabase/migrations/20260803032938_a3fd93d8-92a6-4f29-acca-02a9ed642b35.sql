-- ============ Founding Member Beta ============

CREATE TABLE IF NOT EXISTS public.founding_member_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  slot_number integer NOT NULL CHECK (slot_number BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','released','refunded','canceled')),
  reserved_at timestamptz,
  activated_at timestamptz,
  released_at timestamptz,
  release_reason text,
  pricing_region text NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('monthly','annual')),
  founder_price_id text,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS founding_member_slots_owner_key
  ON public.founding_member_slots (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS founding_member_slots_held_number_key
  ON public.founding_member_slots (slot_number)
  WHERE status IN ('pending','active');
CREATE INDEX IF NOT EXISTS founding_member_slots_status_idx
  ON public.founding_member_slots (status);
CREATE INDEX IF NOT EXISTS founding_member_slots_subscription_idx
  ON public.founding_member_slots (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS founding_member_slots_customer_idx
  ON public.founding_member_slots (stripe_customer_id);

GRANT SELECT ON public.founding_member_slots TO authenticated;
GRANT ALL ON public.founding_member_slots TO service_role;
ALTER TABLE public.founding_member_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their founder slot"
  ON public.founding_member_slots FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Admins read all founder slots"
  ON public.founding_member_slots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER founding_member_slots_set_updated_at
  BEFORE UPDATE ON public.founding_member_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- history ----------
CREATE TABLE IF NOT EXISTS public.founder_slot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.founding_member_slots(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  slot_number integer NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'system',
  actor_id uuid,
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS founder_slot_events_slot_idx
  ON public.founder_slot_events (slot_id, created_at DESC);

GRANT SELECT ON public.founder_slot_events TO authenticated;
GRANT ALL ON public.founder_slot_events TO service_role;
ALTER TABLE public.founder_slot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their founder history"
  ON public.founder_slot_events FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Admins read all founder history"
  ON public.founder_slot_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------- founder feedback ----------
CREATE TABLE IF NOT EXISTS public.founder_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number integer,
  setup_ease integer CHECK (setup_ease BETWEEN 1 AND 5),
  nearly_stopped text,
  most_important_feature text,
  recommend_score integer CHECK (recommend_score BETWEEN 0 AND 10),
  missing text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','actioned','dismissed')),
  dismissed_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS founder_feedback_owner_key
  ON public.founder_feedback (owner_id);

GRANT SELECT, INSERT, UPDATE ON public.founder_feedback TO authenticated;
GRANT ALL ON public.founder_feedback TO service_role;
ALTER TABLE public.founder_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their founder feedback"
  ON public.founder_feedback FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owners submit their founder feedback"
  ON public.founder_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their founder feedback"
  ON public.founder_feedback FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins read all founder feedback"
  ON public.founder_feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER founder_feedback_set_updated_at
  BEFORE UPDATE ON public.founder_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- authoritative remaining count (safe for anonymous visitors) ----------
CREATE OR REPLACE FUNCTION public.founder_slots_remaining()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, 100 - (
    SELECT count(*)::int FROM public.founding_member_slots
    WHERE status IN ('pending','active')
  ));
$$;

GRANT EXECUTE ON FUNCTION public.founder_slots_remaining() TO anon, authenticated, service_role;

-- ---------- race-safe allocation ----------
CREATE OR REPLACE FUNCTION public.allocate_founder_slot(
  p_owner_id uuid,
  p_pricing_region text,
  p_billing_interval text,
  p_founder_price_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_environment text DEFAULT 'sandbox',
  p_stripe_event_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.founding_member_slots%ROWTYPE;
  v_held integer;
  v_number integer;
  v_id uuid;
BEGIN
  -- Serialise every allocation attempt: only one can hold the final place.
  PERFORM pg_advisory_xact_lock(hashtext('founding_member_slots'));

  SELECT * INTO v_existing FROM public.founding_member_slots WHERE owner_id = p_owner_id;

  IF FOUND THEN
    IF v_existing.status IN ('pending','active') THEN
      UPDATE public.founding_member_slots
         SET status = 'active',
             activated_at = COALESCE(activated_at, now()),
             stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
             stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
             founder_price_id = COALESCE(p_founder_price_id, founder_price_id),
             billing_interval = COALESCE(p_billing_interval, billing_interval)
       WHERE id = v_existing.id;

      IF v_existing.status <> 'active' THEN
        INSERT INTO public.founder_slot_events
          (slot_id, owner_id, slot_number, previous_status, new_status, reason, source, stripe_event_id)
        VALUES (v_existing.id, p_owner_id, v_existing.slot_number, v_existing.status, 'active',
                'payment confirmed', 'stripe', p_stripe_event_id);
      END IF;
      RETURN v_existing.slot_number;
    END IF;

    -- One founder offer per owner: a released/refunded/canceled founder
    -- returning later pays normal pricing.
    RETURN NULL;
  END IF;

  SELECT count(*)::int INTO v_held FROM public.founding_member_slots
   WHERE status IN ('pending','active');
  IF v_held >= 100 THEN
    RETURN NULL;
  END IF;

  SELECT n INTO v_number
    FROM generate_series(1, 100) AS n
   WHERE NOT EXISTS (
     SELECT 1 FROM public.founding_member_slots s
      WHERE s.slot_number = n AND s.status IN ('pending','active'))
   ORDER BY n LIMIT 1;

  IF v_number IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.founding_member_slots
    (owner_id, stripe_customer_id, stripe_subscription_id, slot_number, status,
     reserved_at, activated_at, pricing_region, billing_interval, founder_price_id, environment)
  VALUES
    (p_owner_id, p_stripe_customer_id, p_stripe_subscription_id, v_number, 'active',
     now(), now(), p_pricing_region, p_billing_interval, p_founder_price_id,
     COALESCE(p_environment, 'sandbox'))
  RETURNING id INTO v_id;

  INSERT INTO public.founder_slot_events
    (slot_id, owner_id, slot_number, previous_status, new_status, reason, source, stripe_event_id)
  VALUES (v_id, p_owner_id, v_number, NULL, 'active', 'founder checkout completed', 'stripe',
          p_stripe_event_id);

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_founder_slot(uuid, text, text, text, text, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_founder_slot(uuid, text, text, text, text, text, text, text) TO service_role;

-- ---------- release ----------
CREATE OR REPLACE FUNCTION public.release_founder_slot(
  p_owner_id uuid,
  p_status text,
  p_reason text DEFAULT NULL,
  p_source text DEFAULT 'system',
  p_actor_id uuid DEFAULT NULL,
  p_stripe_event_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.founding_member_slots%ROWTYPE;
BEGIN
  IF p_status NOT IN ('released','refunded','canceled') THEN
    RAISE EXCEPTION 'Invalid release status %', p_status;
  END IF;

  SELECT * INTO v_slot FROM public.founding_member_slots WHERE owner_id = p_owner_id;
  IF NOT FOUND OR v_slot.status NOT IN ('pending','active') THEN
    RETURN false;
  END IF;

  UPDATE public.founding_member_slots
     SET status = p_status, released_at = now(), release_reason = p_reason
   WHERE id = v_slot.id;

  INSERT INTO public.founder_slot_events
    (slot_id, owner_id, slot_number, previous_status, new_status, reason, source, actor_id, stripe_event_id)
  VALUES (v_slot.id, p_owner_id, v_slot.slot_number, v_slot.status, p_status, p_reason,
          COALESCE(p_source,'system'), p_actor_id, p_stripe_event_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.release_founder_slot(uuid, text, text, text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_founder_slot(uuid, text, text, text, uuid, text) TO service_role;

-- ---------- admin restore ----------
CREATE OR REPLACE FUNCTION public.restore_founder_slot(
  p_owner_id uuid,
  p_reason text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.founding_member_slots%ROWTYPE;
  v_held integer;
  v_number integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('founding_member_slots'));

  SELECT * INTO v_slot FROM public.founding_member_slots WHERE owner_id = p_owner_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_slot.status IN ('pending','active') THEN RETURN v_slot.slot_number; END IF;

  SELECT count(*)::int INTO v_held FROM public.founding_member_slots
   WHERE status IN ('pending','active');
  IF v_held >= 100 THEN RETURN NULL; END IF;

  IF EXISTS (SELECT 1 FROM public.founding_member_slots
              WHERE slot_number = v_slot.slot_number AND status IN ('pending','active')) THEN
    SELECT n INTO v_number FROM generate_series(1, 100) AS n
     WHERE NOT EXISTS (SELECT 1 FROM public.founding_member_slots s
                        WHERE s.slot_number = n AND s.status IN ('pending','active'))
     ORDER BY n LIMIT 1;
  ELSE
    v_number := v_slot.slot_number;
  END IF;

  IF v_number IS NULL THEN RETURN NULL; END IF;

  UPDATE public.founding_member_slots
     SET status = 'active', slot_number = v_number, released_at = NULL,
         release_reason = NULL, activated_at = COALESCE(activated_at, now())
   WHERE id = v_slot.id;

  INSERT INTO public.founder_slot_events
    (slot_id, owner_id, slot_number, previous_status, new_status, reason, source, actor_id)
  VALUES (v_slot.id, p_owner_id, v_number, v_slot.status, 'active',
          COALESCE(p_reason, 'restored by administrator'), 'admin', p_actor_id);

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_founder_slot(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_founder_slot(uuid, text, uuid) TO service_role;

-- ---------- admin stats ----------
CREATE OR REPLACE FUNCTION public.admin_founder_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'totalSlots', 100,
    'active', (SELECT count(*) FROM public.founding_member_slots WHERE status = 'active'),
    'pending', (SELECT count(*) FROM public.founding_member_slots WHERE status = 'pending'),
    'released', (SELECT count(*) FROM public.founding_member_slots WHERE status = 'released'),
    'refunded', (SELECT count(*) FROM public.founding_member_slots WHERE status = 'refunded'),
    'canceled', (SELECT count(*) FROM public.founding_member_slots WHERE status = 'canceled'),
    'remaining', public.founder_slots_remaining(),
    'monthly', (SELECT count(*) FROM public.founding_member_slots
                 WHERE status = 'active' AND billing_interval = 'monthly'),
    'annual', (SELECT count(*) FROM public.founding_member_slots
                WHERE status = 'active' AND billing_interval = 'annual'),
    'revenue', (
      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
        SELECT s.currency_code AS currency,
               sum(s.amount_minor)::bigint AS amount_minor,
               count(*)::int AS accounts
          FROM public.founding_member_slots f
          JOIN public.subscriptions s ON s.owner_id = f.owner_id
         WHERE f.status = 'active' AND s.amount_minor IS NOT NULL
         GROUP BY s.currency_code
      ) r),
    'checkoutsStarted', (SELECT count(*) FROM public.checkout_attempts
                          WHERE plan_key = 'pro'),
    'feedbackCount', (SELECT count(*) FROM public.founder_feedback)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_founder_stats() TO authenticated, service_role;

-- ---------- founder-aware onboarding + status helper ----------
CREATE OR REPLACE FUNCTION public.my_founder_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'remaining', public.founder_slots_remaining(),
    'slot', (
      SELECT jsonb_build_object(
        'slotNumber', f.slot_number,
        'status', f.status,
        'billingInterval', f.billing_interval,
        'pricingRegion', f.pricing_region,
        'activatedAt', f.activated_at,
        'releasedAt', f.released_at,
        'releaseReason', f.release_reason
      )
      FROM public.founding_member_slots f WHERE f.owner_id = auth.uid()
    ),
    'feedbackSubmitted', EXISTS (
      SELECT 1 FROM public.founder_feedback WHERE owner_id = auth.uid()
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.my_founder_status() TO authenticated, service_role;
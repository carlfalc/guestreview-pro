// Executive overview server functions — aggregation only, no AI calls.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeHealthScore, type HealthScore } from "@/lib/health-score";
import {
  buildAiSummaryPayload,
  buildEmailPreview,
  buildRecommendations,
  confidenceFor,
  isPeriodDays,
  rankPlacements,
  ratingFor,
  totalsForWindow,
  trendFor,
  type AiSummaryPayload,
  type Confidence,
  type EmailPreview,
  type ExecutiveSnapshot,
  type Rating,
  type Recommendation,
  type Trend,
} from "@/lib/executive";

const DAY = 24 * 60 * 60 * 1000;

export interface ExecutiveOverview {
  business: { id: string; name: string; industry: string | null } | null;
  businesses: Array<{ id: string; name: string }>;
  health: HealthScore;
  rating: Rating | null;
  confidence: Confidence;
  confidenceNote: string;
  trend: Trend;
  lastUpdated: string;
  snapshot: ExecutiveSnapshot;
  recommendations: Recommendation[];
  aiPayload: AiSummaryPayload;
  email: EmailPreview;
  labels: Record<string, string>;
}

export const getExecutiveOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { businessId?: string; periodDays?: number }) => ({
    businessId:
      typeof data?.businessId === "string" && /^[0-9a-f-]{36}$/i.test(data.businessId)
        ? data.businessId
        : null,
    periodDays: isPeriodDays(data?.periodDays) ? data.periodDays : 7,
  }))
  .handler(async ({ data, context }): Promise<ExecutiveOverview> => {
    const { supabase, userId } = context;
    const { loadHealthFacts } = await import("@/lib/health-facts.server");
    const { placementByKey } = await import("@/lib/placement-recommendations");

    const facts = await loadHealthFacts(supabase, userId, data.businessId);
    const health = computeHealthScore(facts.input);

    const { data: businessRows } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    const businesses = (businessRows ?? []).map((b) => ({ id: b.id, name: b.name }));

    const now = Date.now();
    const period = data.periodDays * DAY;
    const current = totalsForWindow(facts.input.scans, now - period, now + 1);
    const previous = totalsForWindow(facts.input.scans, now - 2 * period, now - period);

    // Trend of the score itself: the same engine run over each window.
    const scoreFor = (from: number, to: number) =>
      computeHealthScore({
        ...facts.input,
        now: to,
        scans: facts.input.scans.filter((s) => {
          const t = Date.parse(s.createdAt);
          return t >= from && t < to;
        }),
      }).overall;
    const currentScore = health.overall;
    const previousScore = scoreFor(now - 2 * period, now - period);
    const trend = trendFor(currentScore, previousScore);

    const labels: Record<string, string> = { ...facts.locationLabels };
    for (const row of health.byPlacement) {
      labels[row.key] = placementByKey(row.key)?.name ?? row.key;
    }
    const label = (k: string) => labels[k] ?? k;

    const { best, weakest } = rankPlacements(health.byPlacement);

    const { data: actionRows } = await supabase
      .from("recommendation_actions")
      .select("recommendation_key, action, snooze_until")
      .eq("owner_id", userId)
      .eq("business_id", facts.businessRow?.id ?? "00000000-0000-0000-0000-000000000000");

    const actions = (actionRows ?? []).map((a) => ({
      key: a.recommendation_key as string,
      action: a.action as "completed" | "snoozed" | "dismissed",
      snoozeUntil: (a.snooze_until as string | null) ?? null,
    }));

    const recommendations = buildRecommendations({
      health,
      placementLabel: label,
      actions,
      now,
    });

    const rolloutCompletion =
      health.dimensions.find((d) => d.key === "rollout")?.score ?? null;

    const snapshot: ExecutiveSnapshot = {
      periodDays: data.periodDays,
      current,
      previous,
      scanTrend: trendFor(current.scans, previous.scans),
      clickTrend: trendFor(current.clicks, previous.clicks),
      clickRateTrend: trendFor(current.clickRate, previous.clickRate, "%"),
      bestPlacement: best,
      weakestPlacement: weakest,
      activePlacementPlans: facts.input.plans.length,
      rolloutCompletion,
      openRecommendations: recommendations.filter((r) => r.status === "open").length,
      marketingPackCompletion:
        facts.packStats.total > 0
          ? Math.round((facts.packStats.ready / facts.packStats.total) * 100)
          : null,
      newQrCodes: facts.newQrCodesInWindow(new Date(now - period).toISOString()),
      businessesMonitored: businesses.length,
    };

    const rating = ratingFor(health.overall);
    const confidence = confidenceFor(health.totals.scans, health.totals.eventDataAvailable);
    const businessInfo = facts.businessRow ?? { id: "", name: "Your business", industry: null };

    const { confidenceNote } = await import("@/lib/executive");

    return {
      business: facts.businessRow,
      businesses,
      health,
      rating,
      confidence,
      confidenceNote: confidenceNote(confidence),
      trend,
      lastUpdated: new Date(now).toISOString(),
      snapshot,
      recommendations,
      aiPayload: buildAiSummaryPayload({
        business: businessInfo,
        health,
        rating,
        confidence,
        trend,
        snapshot,
        recommendations,
        placementLabel: label,
        now,
      }),
      email: buildEmailPreview({
        businessName: businessInfo.name,
        health,
        rating,
        trend,
        snapshot,
        recommendations,
        placementLabel: label,
      }),
      labels,
    };
  });

export const setRecommendationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string; key: string; action: string }) => {
    const action = String(data?.action ?? "");
    if (!["completed", "snoozed", "dismissed", "reopen"].includes(action)) {
      throw new Error("Unsupported action");
    }
    const key = String(data?.key ?? "").trim();
    if (!key || key.length > 120) throw new Error("Invalid recommendation");
    if (!/^[0-9a-f-]{36}$/i.test(String(data?.businessId ?? ""))) {
      throw new Error("Invalid business");
    }
    return { businessId: data.businessId, key, action };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const { data: owned } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .eq("id", data.businessId)
      .maybeSingle();
    if (!owned) throw new Error("Business not found");

    if (data.action === "reopen") {
      const { error } = await supabase
        .from("recommendation_actions")
        .delete()
        .eq("owner_id", userId)
        .eq("business_id", data.businessId)
        .eq("recommendation_key", data.key);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const snoozeUntil =
      data.action === "snoozed" ? new Date(Date.now() + 7 * DAY).toISOString() : null;

    const { error } = await supabase.from("recommendation_actions").upsert(
      {
        owner_id: userId,
        business_id: data.businessId,
        recommendation_key: data.key,
        action: data.action,
        snooze_until: snoozeUntil,
      },
      { onConflict: "owner_id,business_id,recommendation_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

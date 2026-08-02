// Server-only executive overview builder. Shared by the executive dashboard
// server functions and the AI Weekly Insights generator so both read exactly
// the same verified figures.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHealthScore } from "@/lib/health-score";
import {
  buildAiSummaryPayload,
  buildEmailPreview,
  buildRecommendations,
  confidenceFor,
  confidenceNote,
  rankPlacements,
  ratingFor,
  totalsForWindow,
  trendFor,
  type ExecutiveOverview,
  type ExecutiveSnapshot,
} from "@/lib/executive";

const DAY = 24 * 60 * 60 * 1000;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, any, any>;

export async function buildExecutiveOverview(args: {
  supabase: Db;
  userId: string;
  businessId: string | null;
  periodDays: number;
}): Promise<ExecutiveOverview> {
  const { supabase, userId } = args;
  const data = { businessId: args.businessId, periodDays: args.periodDays };

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

  const rolloutCompletion = health.dimensions.find((d) => d.key === "rollout")?.score ?? null;

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
}

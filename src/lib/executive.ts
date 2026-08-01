// Executive intelligence layer — pure logic only.
//
// RULES:
//  * Never re-derive or invent a score. Everything here reads the already
//    computed Reputation Health™ result.
//  * Never claim causation. Improvements are described as "Performance
//    improved after this change." — never "this caused".
//  * Never surface technical/developer terminology in user-facing strings.
//  * Low activity is always "Not enough data yet", never failure or risk.

import type {
  DimensionBreakdown,
  DimensionKey,
  DimensionResult,
  HealthScore,
  ScanFact,
} from "@/lib/health-score";
import { MIN_SCANS_PER_PLACEMENT } from "@/lib/health-score";

/* -------------------------------------------------------------------------- */
/* Ratings and confidence                                                     */
/* -------------------------------------------------------------------------- */

export type Rating = "Excellent" | "Strong" | "Improving" | "Needs Attention";
export type Confidence = "High" | "Medium" | "Low";

export function ratingFor(score: number | null): Rating | null {
  if (score === null) return null;
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Improving";
  return "Needs Attention";
}

export const CONFIDENCE_HIGH_SCANS = 100;
export const CONFIDENCE_MEDIUM_SCANS = 25;

export function confidenceFor(scans: number, eventDataAvailable: boolean): Confidence {
  if (!eventDataAvailable) return "Low";
  if (scans >= CONFIDENCE_HIGH_SCANS) return "High";
  if (scans >= CONFIDENCE_MEDIUM_SCANS) return "Medium";
  return "Low";
}

export function confidenceNote(confidence: Confidence): string {
  if (confidence === "High") return "Based on a large, steady stream of customer scans.";
  if (confidence === "Medium") return "Based on a moderate number of customer scans so far.";
  return "Based on a small number of scans — treat this as an early read.";
}

/* -------------------------------------------------------------------------- */
/* Trends                                                                     */
/* -------------------------------------------------------------------------- */

export type TrendDirection = "up" | "down" | "flat" | "unknown";

export interface Trend {
  direction: TrendDirection;
  delta: number | null;
  label: string;
}

export function trendFor(current: number | null, previous: number | null, unit = ""): Trend {
  if (current === null || previous === null) {
    return { direction: "unknown", delta: null, label: "No comparison yet" };
  }
  const delta = current - previous;
  if (delta === 0) return { direction: "flat", delta: 0, label: `No change${unit}` };
  const sign = delta > 0 ? "+" : "−";
  return {
    direction: delta > 0 ? "up" : "down",
    delta,
    label: `${sign}${Math.abs(delta)}${unit}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Business-friendly dimension copy                                           */
/* -------------------------------------------------------------------------- */

export interface DimensionCopy {
  label: string;
  whyItMatters: string;
  action: string;
}

export const DIMENSION_COPY: Record<DimensionKey, DimensionCopy> = {
  setup: {
    label: "Business Profile",
    whyItMatters:
      "Your logo, colours and review link appear on every printed item a customer sees. A complete profile looks trustworthy and converts better.",
    action: "Finish the missing profile details on your business page.",
  },
  technical: {
    label: "QR Quality",
    whyItMatters:
      "A QR code that leads nowhere wastes every scan. Working destinations are the single most important thing to get right.",
    action: "Open each QR code and test that it lands on the right page.",
  },
  rollout: {
    label: "Rollout Progress",
    whyItMatters:
      "Codes only earn reviews once they're physically in front of customers. Rollout progress tracks how much of your plan is actually live.",
    action: "Work through the remaining items on your placement plan checklist.",
  },
  activity: {
    label: "Customer Activity",
    whyItMatters:
      "Scan volume shows how visible your codes are. Low activity usually means placement, not interest.",
    action: "Move your quietest code to a spot customers already look at.",
  },
  clickThrough: {
    label: "Customer Engagement",
    whyItMatters:
      "This is how many people who scanned went on to your review page. It reflects how clear and compelling your wording is.",
    action: "Shorten your call to action and make the reward for leaving a review obvious.",
  },
};

export function friendlyDimension(d: DimensionResult): DimensionResult & DimensionCopy {
  return { ...d, ...DIMENSION_COPY[d.key] };
}

export function stateLabel(state: DimensionResult["state"]): string {
  if (state === "good") return "Excellent";
  if (state === "fair") return "Strong";
  if (state === "attention") return "Needs Attention";
  return "Not enough data yet";
}

/* -------------------------------------------------------------------------- */
/* Weekly executive snapshot                                                  */
/* -------------------------------------------------------------------------- */

export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

export function isPeriodDays(v: unknown): v is PeriodDays {
  return typeof v === "number" && (PERIOD_OPTIONS as readonly number[]).includes(v);
}

export interface PeriodTotals {
  scans: number;
  clicks: number;
  clickRate: number | null;
}

export interface ExecutiveSnapshot {
  periodDays: number;
  current: PeriodTotals;
  previous: PeriodTotals;
  scanTrend: Trend;
  clickTrend: Trend;
  clickRateTrend: Trend;
  bestPlacement: DimensionBreakdown | null;
  weakestPlacement: DimensionBreakdown | null;
  activePlacementPlans: number;
  rolloutCompletion: number | null;
  openRecommendations: number;
  marketingPackCompletion: number | null;
  newQrCodes: number;
  businessesMonitored: number;
}

function ratePct(clicks: number, scans: number): number | null {
  if (scans < MIN_SCANS_PER_PLACEMENT) return null;
  return Math.round((clicks / scans) * 100);
}

export function totalsForWindow(scans: ScanFact[], from: number, to: number): PeriodTotals {
  let s = 0;
  let c = 0;
  for (const scan of scans) {
    const t = Date.parse(scan.createdAt);
    if (Number.isNaN(t) || t < from || t >= to) continue;
    s += 1;
    if (scan.destinationClicked) c += 1;
  }
  return { scans: s, clicks: c, clickRate: ratePct(c, s) };
}

/** Placement rows with enough data, best and weakest by engagement. */
export function rankPlacements(rows: DimensionBreakdown[]): {
  best: DimensionBreakdown | null;
  weakest: DimensionBreakdown | null;
} {
  const usable = rows.filter((r) => r.enoughData && r.clickRate !== null);
  if (usable.length === 0) {
    // Fall back to raw volume so the strongest area is still meaningful.
    const byVolume = [...rows].sort((a, b) => b.scans - a.scans);
    return { best: byVolume[0] ?? null, weakest: null };
  }
  const sorted = [...usable].sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0));
  return {
    best: sorted[0] ?? null,
    weakest: sorted.length > 1 ? (sorted[sorted.length - 1] ?? null) : null,
  };
}

/** Share of all scans taken by one placement, as a whole percentage. */
export function scanShare(row: DimensionBreakdown | null, totalScans: number): number | null {
  if (!row || totalScans <= 0) return null;
  return Math.round((row.scans / totalScans) * 100);
}

/* -------------------------------------------------------------------------- */
/* Smart recommendations                                                      */
/* -------------------------------------------------------------------------- */

export type Effort = "Low" | "Medium" | "High";
export type Impact = "Low" | "Medium" | "High";
export type RecommendationStatus = "open" | "completed" | "snoozed" | "dismissed";

export interface Recommendation {
  key: string;
  title: string;
  explanation: string;
  evidence: string;
  action: string;
  effort: Effort;
  impact: Impact;
  status: RecommendationStatus;
}

export interface RecommendationActionRecord {
  key: string;
  action: "completed" | "snoozed" | "dismissed";
  snoozeUntil: string | null;
}

export interface RecommendationContext {
  health: HealthScore;
  placementLabel?: (key: string) => string;
  actions?: RecommendationActionRecord[];
  now?: number;
}

function applyStatus(
  recs: Omit<Recommendation, "status">[],
  actions: RecommendationActionRecord[],
  now: number,
): Recommendation[] {
  const byKey = new Map(actions.map((a) => [a.key, a]));
  return recs
    .map((r) => {
      const a = byKey.get(r.key);
      let status: RecommendationStatus = "open";
      if (a?.action === "completed") status = "completed";
      else if (a?.action === "dismissed") status = "dismissed";
      else if (a?.action === "snoozed") {
        const until = a.snoozeUntil ? Date.parse(a.snoozeUntil) : 0;
        status = until > now ? "snoozed" : "open";
      }
      return { ...r, status };
    })
    .filter((r) => r.status !== "dismissed");
}

export function buildRecommendations(ctx: RecommendationContext): Recommendation[] {
  const { health } = ctx;
  const label = ctx.placementLabel ?? ((k: string) => k);
  const now = ctx.now ?? Date.now();
  const out: Omit<Recommendation, "status">[] = [];

  const dim = (k: DimensionKey) => health.dimensions.find((d) => d.key === k);

  const technical = dim("technical");
  if (technical && technical.details.length > 0) {
    out.push({
      key: "quality:destinations",
      title: "Fix codes that lead nowhere",
      explanation:
        "One or more of your QR codes has no working destination, so every scan of it is lost.",
      evidence: technical.details.join(" · "),
      action: "Open each affected QR code and set a working review or booking link.",
      effort: "Low",
      impact: "High",
    });
  }

  const setup = dim("setup");
  if (setup && setup.details.length > 0) {
    out.push({
      key: "profile:complete",
      title: "Complete your business profile",
      explanation:
        "Printed items pull your logo, colours and review link straight from your profile. Gaps make finished designs look unfinished.",
      evidence: setup.details.join(" · "),
      action: "Add the missing details on your business page.",
      effort: "Low",
      impact: "Medium",
    });
  }

  const rollout = dim("rollout");
  if (rollout && rollout.score !== null && rollout.score < 100) {
    out.push({
      key: "rollout:finish",
      title: "Finish putting your codes in place",
      explanation:
        "Part of your placement plan hasn't been rolled out yet, so those spots can't earn reviews.",
      evidence: rollout.summary,
      action: "Work through the remaining checklist items on your placement plan.",
      effort: "Medium",
      impact: "High",
    });
  }

  const { best, weakest } = rankPlacements(health.byPlacement);
  if (weakest && best && weakest.key !== best.key) {
    out.push({
      key: `placement:${weakest.key}`,
      title: `Improve the ${label(weakest.key)} spot`,
      explanation:
        "This placement is getting seen but far fewer customers continue to your review page than at your strongest spot.",
      evidence: `${label(weakest.key)}: ${weakest.clickRate}% engagement vs ${label(best.key)}: ${best.clickRate}%.`,
      action: `Move the ${label(weakest.key)} code to eye level where customers are already pausing, and copy the wording from your ${label(best.key)} design.`,
      effort: "Low",
      impact: "Medium",
    });
  }

  const activity = dim("activity");
  if (activity?.state === "insufficient_data") {
    out.push({
      key: "activity:visibility",
      title: "Get your first steady stream of scans",
      explanation:
        "There isn't enough customer activity yet to measure performance. This is normal for a new setup.",
      evidence: activity.summary,
      action:
        "Place a code where every customer already looks — the payment counter, the table or the receipt.",
      effort: "Low",
      impact: "High",
    });
  } else if (activity && activity.score !== null && activity.score < 50) {
    out.push({
      key: "activity:low",
      title: "Raise the visibility of your codes",
      explanation:
        "Your codes are working but relatively few customers are scanning them, which usually points to placement rather than interest.",
      evidence: activity.summary,
      action: "Move your quietest code closer to the payment point and add a short prompt above it.",
      effort: "Low",
      impact: "Medium",
    });
  }

  const engagement = dim("clickThrough");
  if (engagement && engagement.score !== null && engagement.score < 60) {
    out.push({
      key: "engagement:copy",
      title: "Sharpen the wording customers read",
      explanation:
        "Plenty of people are scanning, but fewer than expected continue to your review page. That gap is almost always the wording.",
      evidence: engagement.summary,
      action:
        "Use one short line asking for a review and remove anything else competing for attention.",
      effort: "Low",
      impact: "High",
    });
  }

  if (health.byPlan.length === 0 && health.totals.activeQrCodes > 0) {
    out.push({
      key: "coverage:plan",
      title: "Build a placement plan",
      explanation:
        "A placement plan maps each customer touchpoint to a code, so nothing relies on a single spot.",
      evidence: `${health.totals.activeQrCodes} active code(s) with no placement plan behind them.`,
      action: "Run the placement wizard and generate the recommended set.",
      effort: "Medium",
      impact: "Medium",
    });
  }

  return applyStatus(out, ctx.actions ?? [], now);
}

export function topRecommendation(recs: Recommendation[]): Recommendation | null {
  const rank = { High: 3, Medium: 2, Low: 1 } as const;
  const open = recs.filter((r) => r.status === "open");
  const sorted = [...open].sort(
    (a, b) => rank[b.impact] - rank[a.impact] || rank[a.effort] - rank[b.effort],
  );
  return sorted[0] ?? null;
}

/** Neutral, non-causal phrasing for a completed improvement. */
export function improvementNote(title: string): string {
  return `Performance improved after this change: ${title}.`;
}

/* -------------------------------------------------------------------------- */
/* AI summary payload (prepared only — never sent, never used to score)       */
/* -------------------------------------------------------------------------- */

export interface AiSummaryPayload {
  version: 1;
  generatedAt: string;
  business: { id: string; name: string; industry: string | null };
  reputationHealth: {
    score: number | null;
    rating: Rating | null;
    confidence: Confidence;
    state: string;
  };
  trend: { direction: TrendDirection; delta: number | null };
  topPerformingPlacement: { key: string; label: string; clickRate: number | null } | null;
  lowestPerformingPlacement: { key: string; label: string; clickRate: number | null } | null;
  totals: { scans: number; clicks: number; clickRate: number | null; periodDays: number };
  placementCoverage: { plannedPlacements: number; activeQrCodes: number; rollout: number | null };
  completedRecommendations: string[];
  outstandingRecommendations: string[];
  /** The writer may only phrase these numbers; it must never compute a score. */
  instructions: string;
}

export interface AiPayloadInput {
  business: { id: string; name: string; industry: string | null };
  health: HealthScore;
  rating: Rating | null;
  confidence: Confidence;
  trend: Trend;
  snapshot: ExecutiveSnapshot;
  recommendations: Recommendation[];
  placementLabel?: (key: string) => string;
  now?: number;
}

export function buildAiSummaryPayload(input: AiPayloadInput): AiSummaryPayload {
  const label = input.placementLabel ?? ((k: string) => k);
  const asPlacement = (r: DimensionBreakdown | null) =>
    r ? { key: r.key, label: label(r.key), clickRate: r.clickRate } : null;

  return {
    version: 1,
    generatedAt: new Date(input.now ?? Date.now()).toISOString(),
    business: input.business,
    reputationHealth: {
      score: input.health.overall,
      rating: input.rating,
      confidence: input.confidence,
      state: input.health.state,
    },
    trend: { direction: input.trend.direction, delta: input.trend.delta },
    topPerformingPlacement: asPlacement(input.snapshot.bestPlacement),
    lowestPerformingPlacement: asPlacement(input.snapshot.weakestPlacement),
    totals: {
      scans: input.snapshot.current.scans,
      clicks: input.snapshot.current.clicks,
      clickRate: input.snapshot.current.clickRate,
      periodDays: input.snapshot.periodDays,
    },
    placementCoverage: {
      plannedPlacements: input.health.byPlanItem.length,
      activeQrCodes: input.health.totals.activeQrCodes,
      rollout: input.snapshot.rolloutCompletion,
    },
    completedRecommendations: input.recommendations
      .filter((r) => r.status === "completed")
      .map((r) => r.title),
    outstandingRecommendations: input.recommendations
      .filter((r) => r.status === "open")
      .map((r) => r.title),
    instructions:
      "Write a short plain-English weekly summary using only the values supplied. Do not calculate, estimate or adjust any score. Do not claim any change caused an improvement.",
  };
}

/* -------------------------------------------------------------------------- */
/* Weekly email preview (rendered only — never sent)                          */
/* -------------------------------------------------------------------------- */

export interface EmailPreview {
  subject: string;
  businessName: string;
  score: number | null;
  rating: Rating | null;
  trendLabel: string;
  kpis: Array<{ label: string; value: string }>;
  topSuccess: string;
  biggestOpportunity: string;
  actions: string[];
  ctaLabel: string;
}

export function buildEmailPreview(input: {
  businessName: string;
  health: HealthScore;
  rating: Rating | null;
  trend: Trend;
  snapshot: ExecutiveSnapshot;
  recommendations: Recommendation[];
  placementLabel?: (key: string) => string;
}): EmailPreview {
  const label = input.placementLabel ?? ((k: string) => k);
  const s = input.snapshot;
  const open = input.recommendations.filter((r) => r.status === "open");

  const topSuccess = s.bestPlacement
    ? `${label(s.bestPlacement.key)} is your strongest spot with ${s.bestPlacement.scans} scans${
        s.bestPlacement.clickRate !== null ? ` and ${s.bestPlacement.clickRate}% engagement` : ""
      }.`
    : "Your codes are live — we'll highlight your strongest spot as soon as scans come in.";

  const biggestOpportunity = s.weakestPlacement
    ? `${label(s.weakestPlacement.key)} is your biggest opportunity at ${s.weakestPlacement.clickRate}% engagement.`
    : (open[0]?.title ?? "Keep your codes in place — nothing needs attention right now.");

  return {
    subject: `${input.businessName}: your ${s.periodDays}-day reputation summary`,
    businessName: input.businessName,
    score: input.health.overall,
    rating: input.rating,
    trendLabel: input.trend.label,
    kpis: [
      { label: "Scans", value: String(s.current.scans) },
      { label: "Review clicks", value: String(s.current.clicks) },
      {
        label: "Engagement",
        value: s.current.clickRate === null ? "Not enough data yet" : `${s.current.clickRate}%`,
      },
      {
        label: "Rollout",
        value: s.rolloutCompletion === null ? "No plan yet" : `${s.rolloutCompletion}%`,
      },
    ],
    topSuccess,
    biggestOpportunity,
    actions: open.slice(0, 3).map((r) => r.title),
    ctaLabel: "View Dashboard",
  };
}

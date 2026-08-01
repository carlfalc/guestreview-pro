// AI Weekly Insights — pure logic.
//
// The deterministic Reputation Health™ engine remains authoritative. Nothing
// here recalculates a score: this module only assembles verified values into a
// payload, defines the required output shape, and screens the model's wording.
import type { HealthScore } from "@/lib/health-score";
import type {
  Confidence,
  ExecutiveSnapshot,
  Rating,
  Recommendation,
  Trend,
} from "@/lib/executive";
import { DIMENSION_COPY, confidenceNote } from "@/lib/executive";
import type { PlanTierKey } from "@/lib/entitlements";

/* -------------------------------------------------------------------------- */
/* Input payload — the only facts the model may use                           */
/* -------------------------------------------------------------------------- */

export interface InsightPayload {
  version: 1;
  business: { name: string; industry: string | null };
  period: { start: string; end: string; days: number };
  reputationHealth: {
    score: number | null;
    previousScore: number | null;
    movement: { direction: Trend["direction"]; delta: number | null; label: string };
    rating: Rating | null;
    confidence: Confidence;
    confidenceNote: string;
    state: string;
  };
  dimensions: Array<{ key: string; label: string; score: number | null; state: string; summary: string }>;
  activity: {
    scans: number;
    destinationClicks: number;
    clickThroughRate: number | null;
    previousScans: number;
    previousClicks: number;
    previousClickThroughRate: number | null;
    scanTrend: string;
    clickTrend: string;
    clickRateTrend: string;
  };
  placements: {
    strongest: { label: string; scans: number; clickRate: number | null } | null;
    weakest: { label: string; scans: number; clickRate: number | null } | null;
  };
  rollout: { completion: number | null; activePlans: number; newQrCodes: number };
  qrQualityWarnings: string[];
  recommendations: {
    completed: string[];
    outstanding: Array<{ title: string; reason: string; action: string; effort: string; impact: string }>;
  };
  deterministicInsights: string[];
  dataConfidenceNotes: string[];
}

export interface PayloadInput {
  businessName: string;
  industry: string | null;
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  health: HealthScore;
  previousScore: number | null;
  trend: Trend;
  rating: Rating | null;
  confidence: Confidence;
  snapshot: ExecutiveSnapshot;
  recommendations: Recommendation[];
  placementLabel?: (key: string) => string;
}

export function buildInsightPayload(input: PayloadInput): InsightPayload {
  const label = input.placementLabel ?? ((k: string) => k);
  const s = input.snapshot;
  const h = input.health;

  const warnings: string[] = [];
  const technical = h.dimensions.find((d) => d.key === "technical");
  if (technical && technical.state === "attention") {
    warnings.push(technical.summary);
  }
  for (const line of technical?.details ?? []) warnings.push(line);

  const notes: string[] = [confidenceNote(input.confidence)];
  if (!h.totals.eventDataAvailable) {
    notes.push("Scan event data could not be read for this period, so activity figures are incomplete.");
  }
  if (h.totals.clickRate === null) {
    notes.push("There are too few scans to report a reliable click-through rate.");
  }
  for (const p of h.preconditions.filter((p) => !p.passed)) {
    notes.push(`${p.label}: ${p.note}`);
  }

  const deterministic: string[] = [];
  if (s.bestPlacement) {
    deterministic.push(
      `${label(s.bestPlacement.key)} recorded the most engagement with ${s.bestPlacement.scans} scans.`,
    );
  }
  if (s.weakestPlacement) {
    deterministic.push(
      `${label(s.weakestPlacement.key)} recorded the lowest engagement at ${s.weakestPlacement.clickRate}%.`,
    );
  }
  if (s.rolloutCompletion !== null) {
    deterministic.push(`Placement rollout is ${s.rolloutCompletion}% complete.`);
  }
  deterministic.push(
    `Scans moved from ${s.previous.scans} to ${s.current.scans} compared with the previous ${s.periodDays} days.`,
  );

  const asPlacement = (r: ExecutiveSnapshot["bestPlacement"]) =>
    r ? { label: label(r.key), scans: r.scans, clickRate: r.clickRate } : null;

  return {
    version: 1,
    business: { name: input.businessName, industry: input.industry },
    period: { start: input.periodStart, end: input.periodEnd, days: input.periodDays },
    reputationHealth: {
      score: h.overall,
      previousScore: input.previousScore,
      movement: {
        direction: input.trend.direction,
        delta: input.trend.delta,
        label: input.trend.label,
      },
      rating: input.rating,
      confidence: input.confidence,
      confidenceNote: confidenceNote(input.confidence),
      state: h.state,
    },
    dimensions: h.dimensions.map((d) => ({
      key: d.key,
      label: DIMENSION_COPY[d.key].label,
      score: d.score,
      state: d.state,
      summary: d.summary,
    })),
    activity: {
      scans: s.current.scans,
      destinationClicks: s.current.clicks,
      clickThroughRate: s.current.clickRate,
      previousScans: s.previous.scans,
      previousClicks: s.previous.clicks,
      previousClickThroughRate: s.previous.clickRate,
      scanTrend: s.scanTrend.label,
      clickTrend: s.clickTrend.label,
      clickRateTrend: s.clickRateTrend.label,
    },
    placements: {
      strongest: asPlacement(s.bestPlacement),
      weakest: asPlacement(s.weakestPlacement),
    },
    rollout: {
      completion: s.rolloutCompletion,
      activePlans: s.activePlacementPlans,
      newQrCodes: s.newQrCodes,
    },
    qrQualityWarnings: warnings,
    recommendations: {
      completed: input.recommendations.filter((r) => r.status === "completed").map((r) => r.title),
      outstanding: input.recommendations
        .filter((r) => r.status === "open")
        .map((r) => ({
          title: r.title,
          reason: r.evidence,
          action: r.action,
          effort: r.effort.toLowerCase(),
          impact: r.impact.toLowerCase(),
        })),
    },
    deterministicInsights: deterministic,
    dataConfidenceNotes: notes,
  };
}

/* -------------------------------------------------------------------------- */
/* Sufficiency gate                                                           */
/* -------------------------------------------------------------------------- */

export const MIN_SCANS_FOR_INSIGHT = 5;

export interface SufficiencyResult {
  sufficient: boolean;
  message: string;
  actions: string[];
}

export const INSUFFICIENT_MESSAGE =
  "Not enough activity yet to generate a reliable weekly insight.";

export function checkInsightSufficiency(payload: InsightPayload, health: HealthScore): SufficiencyResult {
  const actions = [
    "Test your QR codes",
    "Complete your placement rollout",
    "Wait for more scans",
    "Review setup quality",
  ];
  const blocking = health.preconditions.filter((p) => p.blocking && !p.passed);
  if (blocking.length > 0 || payload.activity.scans < MIN_SCANS_FOR_INSIGHT) {
    return { sufficient: false, message: INSUFFICIENT_MESSAGE, actions };
  }
  return { sufficient: true, message: "", actions: [] };
}

/* -------------------------------------------------------------------------- */
/* Structured output                                                          */
/* -------------------------------------------------------------------------- */

export type EffortLevel = "low" | "medium" | "high";

export interface InsightAction {
  title: string;
  reason: string;
  effort: EffortLevel;
  expectedImpact: EffortLevel;
}

export interface InsightOutput {
  headline: string;
  executiveSummary: string;
  topWin: { title: string; explanation: string };
  mainOpportunity: { title: string; explanation: string };
  recommendedActions: InsightAction[];
  closingNote: string;
  confidenceDisclaimer: string;
}

export const MAX_ACTIONS = 3;

const LEVELS: EffortLevel[] = ["low", "medium", "high"];

function level(v: unknown): EffortLevel {
  const s = String(v ?? "").toLowerCase().trim();
  return (LEVELS as string[]).includes(s) ? (s as EffortLevel) : "medium";
}

function text(v: unknown, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Throws on a response that does not match the required shape. */
export function validateInsightOutput(raw: unknown): InsightOutput {
  if (!raw || typeof raw !== "object") throw new Error("invalid_response_format");
  const o = raw as Record<string, unknown>;
  const pair = (v: unknown) => {
    const x = (v ?? {}) as Record<string, unknown>;
    return { title: text(x.title, 90), explanation: text(x.explanation, 400) };
  };

  const out: InsightOutput = {
    headline: text(o.headline, 100),
    executiveSummary: text(o.executiveSummary, 900),
    topWin: pair(o.topWin),
    mainOpportunity: pair(o.mainOpportunity),
    recommendedActions: (Array.isArray(o.recommendedActions) ? o.recommendedActions : [])
      .slice(0, MAX_ACTIONS)
      .map((a) => {
        const x = (a ?? {}) as Record<string, unknown>;
        return {
          title: text(x.title, 90),
          reason: text(x.reason, 300),
          effort: level(x.effort),
          expectedImpact: level(x.expectedImpact),
        };
      })
      .filter((a) => a.title.length > 0),
    closingNote: text(o.closingNote, 300),
    confidenceDisclaimer: text(o.confidenceDisclaimer, 300),
  };

  if (!out.headline || !out.executiveSummary) throw new Error("invalid_response_format");
  return out;
}

/* -------------------------------------------------------------------------- */
/* Safety screening                                                           */
/* -------------------------------------------------------------------------- */

/** Claims the model must never make. Matching text is rejected, not rewritten. */
const BANNED_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: "review_totals", re: /\b(\d+)\s+(new\s+)?(google\s+)?reviews?\b/i },
  { key: "star_rating", re: /\b\d(\.\d)?\s*[- ]?stars?\b|\bstar rating\b/i },
  { key: "sentiment", re: /\bcustomers? (loved|hated|enjoyed|were delighted)\b/i },
  { key: "revenue", re: /\b(revenue|profit|sales|turnover|£|\$|€)\s?\d/i },
  { key: "competitor", re: /\bcompetitors?\b|\bcompared with other businesses\b/i },
  { key: "guarantee", re: /\b(guarantee[sd]?|will definitely|is guaranteed to)\b/i },
  { key: "causal", re: /\bthis caused\b|\bcaused (a|an|the)\b|\bdirectly resulted in\b/i },
  { key: "promise", re: /\bwill increase (your )?reviews?\b|\bwill boost\b|\byou gained\b/i },
];

export function detectInsightSafetyIssues(out: InsightOutput): string[] {
  const blob = [
    out.headline,
    out.executiveSummary,
    out.topWin.title,
    out.topWin.explanation,
    out.mainOpportunity.title,
    out.mainOpportunity.explanation,
    ...out.recommendedActions.flatMap((a) => [a.title, a.reason]),
    out.closingNote,
    out.confidenceDisclaimer,
  ].join("\n");
  return BANNED_PATTERNS.filter((p) => p.re.test(blob)).map((p) => p.key);
}

/* -------------------------------------------------------------------------- */
/* Usage limits                                                               */
/* -------------------------------------------------------------------------- */

export interface InsightLimits {
  /** Free accounts see a preview only. */
  canGenerate: boolean;
  /** Generations allowed per business, per rolling week. */
  perBusinessPerWeek: number;
  /** Generations allowed per account, per rolling hour. */
  perAccountPerHour: number;
  /** Businesses that may be generated for; 1 means the primary business only. */
  businessesCovered: number | "all";
}

export const INSIGHT_LIMITS: Record<PlanTierKey, InsightLimits> = {
  free: { canGenerate: false, perBusinessPerWeek: 0, perAccountPerHour: 0, businessesCovered: 0 },
  pro: { canGenerate: true, perBusinessPerWeek: 3, perAccountPerHour: 10, businessesCovered: 1 },
  business: { canGenerate: true, perBusinessPerWeek: 3, perAccountPerHour: 10, businessesCovered: "all" },
};

export function insightLimitsFor(plan: PlanTierKey): InsightLimits {
  return INSIGHT_LIMITS[plan] ?? INSIGHT_LIMITS.free;
}

export type LimitDenial =
  | { allowed: true }
  | { allowed: false; code: "plan_required" | "business_not_covered" | "weekly_limit" | "hourly_limit" | "in_progress"; message: string };

export function checkInsightAllowance(args: {
  plan: PlanTierKey;
  weeklyCount: number;
  hourlyCount: number;
  businessCovered: boolean;
  inProgress: boolean;
}): LimitDenial {
  const limits = insightLimitsFor(args.plan);
  if (!limits.canGenerate) {
    return {
      allowed: false,
      code: "plan_required",
      message: "AI Weekly Insights are available on Pro and Business plans. Upgrade to generate your own summary.",
    };
  }
  if (!args.businessCovered) {
    return {
      allowed: false,
      code: "business_not_covered",
      message:
        "Your plan covers weekly insights for one business. Upgrade to Business to generate insights for every location.",
    };
  }
  if (args.inProgress) {
    return {
      allowed: false,
      code: "in_progress",
      message: "An insight is already being generated for this business. Give it a moment.",
    };
  }
  if (args.weeklyCount >= limits.perBusinessPerWeek) {
    return {
      allowed: false,
      code: "weekly_limit",
      message: `You've used all ${limits.perBusinessPerWeek} insight generations for this business this week.`,
    };
  }
  if (args.hourlyCount >= limits.perAccountPerHour) {
    return {
      allowed: false,
      code: "hourly_limit",
      message: `You've reached the limit of ${limits.perAccountPerHour} generations per hour. Please try again shortly.`,
    };
  }
  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* Freshness                                                                  */
/* -------------------------------------------------------------------------- */

export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type InsightCardState =
  | "not_generated"
  | "generating"
  | "ready"
  | "stale"
  | "failed"
  | "insufficient_data";

export function cardStateFor(
  insight: { status: string; generatedAt: string | null } | null,
  now = Date.now(),
): InsightCardState {
  if (!insight) return "not_generated";
  if (insight.status === "pending" || insight.status === "generating") return "generating";
  if (insight.status === "failed") return "failed";
  if (insight.status === "insufficient_data") return "insufficient_data";
  const at = insight.generatedAt ? Date.parse(insight.generatedAt) : NaN;
  if (Number.isNaN(at) || now - at > STALE_AFTER_MS) return "stale";
  return "ready";
}

export const AI_DISCLAIMER =
  "AI-generated summary based on verified GuestReview Pro activity data.";

/** Plain-text version of an insight, for the copy-to-clipboard action. */
export function insightToPlainText(out: InsightOutput, businessName: string): string {
  return [
    `${businessName} — ${out.headline}`,
    "",
    out.executiveSummary,
    "",
    `Top win: ${out.topWin.title}`,
    out.topWin.explanation,
    "",
    `Main opportunity: ${out.mainOpportunity.title}`,
    out.mainOpportunity.explanation,
    "",
    "Recommended actions:",
    ...out.recommendedActions.map(
      (a, i) => `${i + 1}. ${a.title} — ${a.reason} (effort: ${a.effort}, impact: ${a.expectedImpact})`,
    ),
    "",
    out.closingNote,
    out.confidenceDisclaimer,
    "",
    AI_DISCLAIMER,
  ].join("\n");
}

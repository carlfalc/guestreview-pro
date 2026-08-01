// Review Health Score — pure scoring logic.
//
// RULES (see project memory):
//  * Placement performance is derived from event-level `scan_events` joined to
//    the placement dimensions on `qr_codes`. `qr_codes.scans_count` is only a
//    fallback when no event rows exist at all, and is never used to compute a
//    conversion rate.
//  * A business with too little activity is reported as "Not enough data yet".
//    It is never described as failing, poor or at risk.

export const MIN_SCANS_FOR_ACTIVITY = 10;
export const MIN_SCANS_FOR_CLICK_RATE = 10;
export const MIN_SCANS_PER_PLACEMENT = 5;
export const RECENT_WINDOW_DAYS = 30;

/** Every dimension is scored independently and can abstain. */
export type DimensionKey =
  | "setup"
  | "technical"
  | "rollout"
  | "activity"
  | "clickThrough";

export type DimensionState = "good" | "fair" | "attention" | "insufficient_data";

export interface DimensionResult {
  key: DimensionKey;
  label: string;
  /** null when state is `insufficient_data` — never coerce this to 0. */
  score: number | null;
  state: DimensionState;
  summary: string;
  details: string[];
}

export type PreconditionKey =
  | "business_exists"
  | "active_qr_exists"
  | "destinations_resolve"
  | "plan_generation_complete"
  | "event_data_quality_known";

export interface PreconditionResult {
  key: PreconditionKey;
  label: string;
  passed: boolean;
  /** A precondition can pass with a caveat (e.g. plan explicitly partial). */
  note: string;
  blocking: boolean;
}

/** One event-level scan row, already joined to its QR placement dimensions. */
export interface ScanFact {
  qrCodeId: string;
  placementPlanId: string | null;
  placementPlanItemId: string | null;
  placementKey: string | null;
  businessGoal: string | null;
  campaign: string | null;
  locationId: string | null;
  destinationClicked: boolean;
  createdAt: string;
}

export interface QrFact {
  id: string;
  label: string | null;
  status: string;
  destinationResolves: boolean;
  scansCount: number;
  placementPlanId: string | null;
  placementPlanItemId: string | null;
  placementKey: string | null;
  businessGoal: string | null;
  campaign: string | null;
  locationId: string | null;
}

export interface BusinessFact {
  id: string;
  name: string;
  hasGoogleReviewUrl: boolean;
  hasLogo: boolean;
  hasBrandColours: boolean;
  hasAddress: boolean;
  hasWelcomeMessage: boolean;
}

export interface PlanFact {
  id: string;
  status: string;
  itemCount: number;
  generatedItemCount: number;
  checklistTotal: number;
  checklistDone: number;
}

export interface HealthInput {
  business: BusinessFact | null;
  qrCodes: QrFact[];
  plans: PlanFact[];
  scans: ScanFact[];
  /** True when scan_events could be read successfully (data quality known). */
  eventDataAvailable: boolean;
  now?: number;
}

/** Aggregation bucket for one analytics dimension value. */
export interface DimensionBreakdown {
  key: string;
  label: string;
  scans: number;
  clicks: number;
  /** null until MIN_SCANS_PER_PLACEMENT event-level scans exist. */
  clickRate: number | null;
  enoughData: boolean;
}

export interface HealthScore {
  /** null whenever overall activity is insufficient — never a bad number. */
  overall: number | null;
  state: DimensionState;
  headline: string;
  message: string;
  preconditions: PreconditionResult[];
  canScore: boolean;
  dimensions: DimensionResult[];
  byPlacement: DimensionBreakdown[];
  byGoal: DimensionBreakdown[];
  byCampaign: DimensionBreakdown[];
  byLocation: DimensionBreakdown[];
  byPlan: DimensionBreakdown[];
  byPlanItem: DimensionBreakdown[];
  totals: {
    scans: number;
    clicks: number;
    recentScans: number;
    clickRate: number | null;
    activeQrCodes: number;
    eventDataAvailable: boolean;
    /** Only surfaced when there are no event rows at all. */
    fallbackScansCount: number;
  };
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function stateForScore(score: number): DimensionState {
  if (score >= 75) return "good";
  if (score >= 50) return "fair";
  return "attention";
}

function group(
  scans: ScanFact[],
  pick: (s: ScanFact) => string | null,
  label: (key: string) => string,
): DimensionBreakdown[] {
  const map = new Map<string, { scans: number; clicks: number }>();
  for (const s of scans) {
    const k = pick(s);
    if (!k) continue;
    const bucket = map.get(k) ?? { scans: 0, clicks: 0 };
    bucket.scans += 1;
    if (s.destinationClicked) bucket.clicks += 1;
    map.set(k, bucket);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: label(key),
      scans: v.scans,
      clicks: v.clicks,
      clickRate: v.scans >= MIN_SCANS_PER_PLACEMENT ? pct(v.clicks, v.scans) : null,
      enoughData: v.scans >= MIN_SCANS_PER_PLACEMENT,
    }))
    .sort((a, b) => b.scans - a.scans);
}

export function checkPreconditions(input: HealthInput): PreconditionResult[] {
  const active = input.qrCodes.filter((q) => q.status === "active");
  const unresolved = active.filter((q) => !q.destinationResolves);
  const partialPlans = input.plans.filter(
    (p) => p.status === "partially_generated" || p.generatedItemCount < p.itemCount,
  );
  const incomplete = input.plans.filter(
    (p) =>
      p.status !== "archived" &&
      p.status !== "generated" &&
      p.status !== "partially_generated" &&
      p.generatedItemCount < p.itemCount,
  );

  return [
    {
      key: "business_exists",
      label: "Business exists",
      passed: Boolean(input.business),
      note: input.business ? input.business.name : "Add a business to begin.",
      blocking: true,
    },
    {
      key: "active_qr_exists",
      label: "At least one active QR code",
      passed: active.length > 0,
      note: active.length > 0 ? `${active.length} active` : "Create a QR code first.",
      blocking: true,
    },
    {
      key: "destinations_resolve",
      label: "Destination URLs resolve",
      passed: active.length > 0 && unresolved.length === 0,
      note:
        active.length === 0
          ? "No active QR codes to check."
          : unresolved.length === 0
            ? "All destinations resolve."
            : `${unresolved.length} QR code(s) have no usable destination.`,
      blocking: true,
    },
    {
      key: "plan_generation_complete",
      label: "Placement plan generation complete",
      passed: input.plans.length === 0 || incomplete.length === 0,
      note:
        input.plans.length === 0
          ? "No placement plan — scoring uses your QR codes directly."
          : incomplete.length > 0
            ? `${incomplete.length} plan(s) still mid-generation.`
            : partialPlans.length > 0
              ? `${partialPlans.length} plan(s) explicitly partial — counted as partial.`
              : "All plans generated.",
      blocking: false,
    },
    {
      key: "event_data_quality_known",
      label: "Event data quality known",
      passed: input.eventDataAvailable,
      note: input.eventDataAvailable
        ? `${input.scans.length} scan event(s) available for analysis.`
        : "Scan event data could not be read — scores are withheld.",
      blocking: true,
    },
  ];
}

export function computeHealthScore(input: HealthInput): HealthScore {
  const now = input.now ?? Date.now();
  const preconditions = checkPreconditions(input);
  const canScore = preconditions.every((p) => !p.blocking || p.passed);

  const active = input.qrCodes.filter((q) => q.status === "active");
  const scans = input.eventDataAvailable ? input.scans : [];
  const clicks = scans.filter((s) => s.destinationClicked).length;
  const cutoff = now - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentScans = scans.filter((s) => Date.parse(s.createdAt) >= cutoff).length;
  const fallbackScansCount = input.qrCodes.reduce((n, q) => n + (q.scansCount || 0), 0);

  const qrById = new Map(input.qrCodes.map((q) => [q.id, q]));
  const dimOf = (s: ScanFact, field: keyof QrFact) =>
    (s[field as keyof ScanFact] as string | null) ??
    ((qrById.get(s.qrCodeId)?.[field] as string | null) ?? null);

  const byPlacement = group(scans, (s) => dimOf(s, "placementKey"), (k) => k);
  const byGoal = group(scans, (s) => dimOf(s, "businessGoal"), (k) => k);
  const byCampaign = group(scans, (s) => dimOf(s, "campaign"), (k) => k);
  const byLocation = group(scans, (s) => dimOf(s, "locationId"), (k) => k);
  const byPlan = group(scans, (s) => dimOf(s, "placementPlanId"), (k) => k);
  const byPlanItem = group(scans, (s) => dimOf(s, "placementPlanItemId"), (k) => k);

  // --- Setup quality -------------------------------------------------------
  const b = input.business;
  const setupChecks = b
    ? [
        { ok: b.hasGoogleReviewUrl, text: "Google review link saved" },
        { ok: b.hasLogo, text: "Logo uploaded" },
        { ok: b.hasBrandColours, text: "Brand colours set" },
        { ok: b.hasAddress, text: "Address added" },
        { ok: b.hasWelcomeMessage, text: "Welcome message written" },
      ]
    : [];
  const setupScore = b ? pct(setupChecks.filter((c) => c.ok).length, setupChecks.length) : null;

  // --- QR technical health -------------------------------------------------
  const resolving = active.filter((q) => q.destinationResolves).length;
  const technicalScore = active.length > 0 ? pct(resolving, active.length) : null;

  // --- Rollout completion --------------------------------------------------
  const planItems = input.plans.reduce((n, p) => n + p.itemCount, 0);
  const planGenerated = input.plans.reduce((n, p) => n + p.generatedItemCount, 0);
  const checklistTotal = input.plans.reduce((n, p) => n + p.checklistTotal, 0);
  const checklistDone = input.plans.reduce((n, p) => n + p.checklistDone, 0);
  const rolloutScore =
    planItems === 0 && checklistTotal === 0
      ? null
      : Math.round(
          (planItems > 0 ? pct(planGenerated, planItems) : 0) * (checklistTotal > 0 ? 0.5 : 1) +
            (checklistTotal > 0 ? pct(checklistDone, checklistTotal) * 0.5 : 0),
        );

  // --- Real customer activity ---------------------------------------------
  const activityEnough = scans.length >= MIN_SCANS_FOR_ACTIVITY;
  const scansPerQr = active.length > 0 ? recentScans / active.length : 0;
  // 10 recent scans per active QR in 30 days is treated as a healthy baseline.
  const activityScore = activityEnough ? Math.min(100, Math.round((scansPerQr / 10) * 100)) : null;

  // --- Destination click-through -------------------------------------------
  const clickEnough = scans.length >= MIN_SCANS_FOR_CLICK_RATE;
  const clickRate = clickEnough ? pct(clicks, scans.length) : null;
  const clickScore = clickRate === null ? null : Math.min(100, Math.round((clickRate / 80) * 100));

  const dimensions: DimensionResult[] = [
    {
      key: "setup",
      label: "Setup quality",
      score: setupScore,
      state: setupScore === null ? "insufficient_data" : stateForScore(setupScore),
      summary: b
        ? `${setupChecks.filter((c) => c.ok).length} of ${setupChecks.length} business details complete`
        : "No business yet",
      details: setupChecks.filter((c) => !c.ok).map((c) => `Missing: ${c.text}`),
    },
    {
      key: "technical",
      label: "QR technical health",
      score: technicalScore,
      state: technicalScore === null ? "insufficient_data" : stateForScore(technicalScore),
      summary:
        active.length === 0
          ? "No active QR codes"
          : `${resolving} of ${active.length} active QR codes resolve to a valid destination`,
      details: active
        .filter((q) => !q.destinationResolves)
        .map((q) => `${q.label || "Untitled QR"} has no usable destination`),
    },
    {
      key: "rollout",
      label: "Rollout completion",
      score: rolloutScore,
      state: rolloutScore === null ? "insufficient_data" : stateForScore(rolloutScore),
      summary:
        rolloutScore === null
          ? "No placement plan yet"
          : `${planGenerated}/${planItems} placements generated · ${checklistDone}/${checklistTotal} rollout tasks done`,
      details: [],
    },
    {
      key: "activity",
      label: "Real customer activity",
      score: activityScore,
      state: activityScore === null ? "insufficient_data" : stateForScore(activityScore),
      summary: activityEnough
        ? `${recentScans} scans in the last ${RECENT_WINDOW_DAYS} days across ${active.length} active QR code(s)`
        : `Not enough data yet — ${scans.length} of ${MIN_SCANS_FOR_ACTIVITY} scans needed`,
      details: activityEnough
        ? []
        : ["Keep your QR codes in place; activity scoring starts once real scans arrive."],
    },
    {
      key: "clickThrough",
      label: "Destination click-through",
      score: clickScore,
      state: clickScore === null ? "insufficient_data" : stateForScore(clickScore),
      summary:
        clickRate === null
          ? `Not enough data yet — ${scans.length} of ${MIN_SCANS_FOR_CLICK_RATE} scans needed`
          : `${clickRate}% of scans continued to the destination`,
      details: [],
    },
  ];

  const scored = dimensions.filter((d) => d.score !== null);
  const activityKnown = activityScore !== null || clickScore !== null;
  const overall =
    canScore && activityKnown && scored.length > 0
      ? Math.round(scored.reduce((n, d) => n + (d.score ?? 0), 0) / scored.length)
      : null;

  let headline: string;
  let message: string;
  if (!canScore) {
    headline = "Not enough data yet";
    message =
      "Finish the setup steps below and we'll start measuring your Reputation Health™. Nothing here counts against you.";
  } else if (overall === null) {
    headline = "Not enough data yet";
    message = `Your setup looks fine — we just need real customer scans before scoring performance. Setup and technical checks are shown below in the meantime.`;
  } else {
    headline = `Reputation Health™ ${overall}/100`;
    message = "Scored from real scan events across your placements, goals and campaigns.";
  }

  return {
    overall,
    state: overall === null ? "insufficient_data" : stateForScore(overall),
    headline,
    message,
    preconditions,
    canScore,
    dimensions,
    byPlacement,
    byGoal,
    byCampaign,
    byLocation,
    byPlan,
    byPlanItem,
    totals: {
      scans: scans.length,
      clicks,
      recentScans,
      clickRate,
      activeQrCodes: active.length,
      eventDataAvailable: input.eventDataAvailable,
      fallbackScansCount: scans.length === 0 ? fallbackScansCount : 0,
    },
  };
}

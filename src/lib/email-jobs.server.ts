// Server-only job layer: turns verified account data into email payloads and
// dispatches them. Called by the cron worker route and by test sends.
import type { LooseClient } from "./loose-types";
import { PUBLIC_SITE_URL } from "./public-url";
import {
  idempotencyKey,
  isWeeklyReportDue,
  localClock,
  reportPeriodStart,
  type SchedulePreference,
} from "./email-schedule";
import { emailEntitlementsFor } from "./email-entitlements";
import { hasSufficientWeeklyData, MIN_BUSINESSES_FOR_DIGEST } from "./email-content";
import { dispatchEmail, remainingBatch, type DispatchResult } from "./email-dispatch.server";

const DASHBOARD_URL = `${PUBLIC_SITE_URL}/dashboard`;
const REPORT_URL = `${PUBLIC_SITE_URL}/reports`;
const UNSUBSCRIBE_NOTE =
  "Manage or switch off these emails any time in Settings → Email preferences.";

function periodLabel(periodStart: string, endDate: string): string {
  return `${periodStart} – ${endDate}`;
}

async function admin(): Promise<LooseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseClient;
}

/* -------------------------------------------------------------------------- */
/* Weekly Reputation Health™ report                                           */
/* -------------------------------------------------------------------------- */

export interface WeeklyPayloadResult {
  data: Record<string, unknown>;
  sufficient: boolean;
  businessId: string;
}

/** Build the weekly report payload for one business from verified data only. */
export async function buildWeeklyPayload(args: {
  userId: string;
  businessId: string;
  periodStart: string;
  endDate: string;
}): Promise<WeeklyPayloadResult> {
  const db = await admin();
  const { buildExecutiveOverview } = await import("./executive.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overview = await buildExecutiveOverview({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: db as any,
    userId: args.userId,
    businessId: args.businessId,
    periodDays: 7,
  });

  const snapshot = overview.snapshot;
  const label = (k: string) => overview.labels[k] ?? k;
  const strongest = snapshot.bestPlacement
    ? `${label(snapshot.bestPlacement.key)} (${snapshot.bestPlacement.scans} scans)`
    : "Not enough data yet";
  const opportunity = snapshot.weakestPlacement
    ? `${label(snapshot.weakestPlacement.key)} needs attention`
    : (overview.recommendations.find((r) => r.status === "open")?.title ?? "Not enough data yet");

  const aiSummary = await loadLatestInsightSummary(db, args.userId, args.businessId);

  return {
    businessId: args.businessId,
    sufficient: hasSufficientWeeklyData({
      scans: snapshot.current.scans,
      score: overview.health.overall,
      hasBusiness: Boolean(overview.business),
    }),
    data: {
      businessName: overview.business?.name ?? "Your business",
      periodLabel: periodLabel(args.periodStart, args.endDate),
      score: overview.health.overall,
      scoreMovement: overview.trend.label,
      confidence: overview.confidence,
      scans: snapshot.current.scans,
      clicks: snapshot.current.clicks,
      clickRate:
        snapshot.current.clickRate === null
          ? "Not enough data yet"
          : `${snapshot.current.clickRate}%`,
      strongestPlacement: strongest,
      mainOpportunity: opportunity,
      aiSummary,
      actions: overview.recommendations
        .filter((r) => r.status === "open")
        .slice(0, 3)
        .map((r) => r.title),
      dashboardUrl: DASHBOARD_URL,
      reportUrl: REPORT_URL,
      unsubscribeNote: UNSUBSCRIBE_NOTE,
    },
  };
}

async function loadLatestInsightSummary(
  db: LooseClient,
  userId: string,
  businessId: string,
): Promise<string> {
  const { data } = await db
    .from("weekly_ai_insights")
    .select("generated_output, generation_status")
    .eq("owner_id", userId)
    .eq("business_id", businessId)
    .eq("generation_status", "complete")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  const output = row?.generated_output as { summary?: unknown } | null | undefined;
  return typeof output?.summary === "string" ? output.summary : "";
}

export async function sendWeeklyReport(args: {
  userId: string;
  email: string;
  businessId: string;
  periodStart: string;
  endDate: string;
  kind?: "scheduled" | "test";
}): Promise<DispatchResult | { status: "insufficient_data" }> {
  const payload = await buildWeeklyPayload(args);
  if (!payload.sufficient && args.kind !== "test") return { status: "insufficient_data" };

  return dispatchEmail({
    templateKey: "weekly_reputation_health",
    to: args.email,
    ownerId: args.userId,
    businessId: args.businessId,
    periodStart: args.periodStart,
    idempotencyKey:
      args.kind === "test"
        ? `weekly-health-test:${args.userId}:${args.businessId}:${Date.now()}`
        : `weekly-health:${args.userId}:${args.businessId}:${args.periodStart}`,
    templateData: payload.data,
    kind: args.kind === "test" ? "test" : "scheduled",
  });
}

/* -------------------------------------------------------------------------- */
/* Portfolio digest                                                            */
/* -------------------------------------------------------------------------- */

export async function buildPortfolioPayload(args: {
  userId: string;
  businessIds: string[];
  periodStart: string;
  endDate: string;
}): Promise<{ data: Record<string, unknown>; eligible: boolean }> {
  const db = await admin();
  const { buildExecutiveOverview } = await import("./executive.server");

  const rows: Array<Record<string, unknown>> = [];
  let improving = 0;
  let attention = 0;
  const movements: number[] = [];
  const recommendations: string[] = [];

  for (const businessId of args.businessIds.slice(0, 10)) {
    const overview = await buildExecutiveOverview({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: db as any,
      userId: args.userId,
      businessId,
      periodDays: 7,
    });
    const delta = overview.trend.delta ?? 0;
    if (delta > 0) improving += 1;
    if (overview.rating === "Needs Attention" || delta < 0) attention += 1;
    movements.push(delta);
    const open = overview.recommendations.find((r) => r.status === "open");
    if (open) recommendations.push(`${overview.business?.name ?? "Business"}: ${open.title}`);

    rows.push({
      businessName: overview.business?.name ?? "Business",
      score: overview.health.overall,
      movement: delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`,
      confidence: overview.confidence,
      scans: overview.snapshot.current.scans,
      warning: open?.title ?? "None",
    });
  }

  const avgMovement =
    movements.length > 0
      ? Math.round(movements.reduce((a, b) => a + b, 0) / movements.length)
      : 0;
  const scored = rows
    .map((r) => ({ name: String(r.businessName), score: r.score as number | null }))
    .filter((r): r is { name: string; score: number } => typeof r.score === "number")
    .sort((a, b) => b.score - a.score);

  return {
    eligible: rows.length >= MIN_BUSINESSES_FOR_DIGEST,
    data: {
      periodLabel: periodLabel(args.periodStart, args.endDate),
      averageMovement:
        avgMovement === 0 ? "No change yet" : `${avgMovement > 0 ? "+" : ""}${avgMovement}`,
      improving,
      needingAttention: attention,
      strongest: scored[0] ? `${scored[0].name} (${scored[0].score})` : "Not enough data yet",
      weakest: scored.at(-1)
        ? `${scored.at(-1)!.name} (${scored.at(-1)!.score})`
        : "Not enough data yet",
      recommendations: recommendations.slice(0, 3),
      rows,
      dashboardUrl: DASHBOARD_URL,
      unsubscribeNote: UNSUBSCRIBE_NOTE,
    },
  };
}

export async function sendPortfolioDigest(args: {
  userId: string;
  email: string;
  businessIds: string[];
  periodStart: string;
  endDate: string;
  kind?: "scheduled" | "test";
}): Promise<DispatchResult | { status: "insufficient_data" }> {
  const payload = await buildPortfolioPayload(args);
  if (!payload.eligible) return { status: "insufficient_data" };

  return dispatchEmail({
    templateKey: "portfolio_digest",
    to: args.email,
    ownerId: args.userId,
    periodStart: args.periodStart,
    idempotencyKey:
      args.kind === "test"
        ? `portfolio-digest-test:${args.userId}:${Date.now()}`
        : `portfolio-digest:${args.userId}:${args.periodStart}`,
    templateData: payload.data,
    kind: args.kind === "test" ? "test" : "scheduled",
  });
}

/* -------------------------------------------------------------------------- */
/* Scheduler pass                                                              */
/* -------------------------------------------------------------------------- */

export interface WorkerSummary {
  checked: number;
  weeklySent: number;
  digestsSent: number;
  skipped: number;
  throttled: number;
  failed: number;
  budget: number;
}

interface PrefRow {
  owner_id: string;
  weekly_report_enabled: boolean;
  portfolio_digest_enabled: boolean;
  weekday: number;
  local_time: string;
  timezone: string;
  business_ids: string[];
  portfolio_weekday: number | null;
  portfolio_local_time: string | null;
  unsubscribed_at: string | null;
}

/** One scheduler pass. Sends at most `budget` emails so volume stays gradual. */
export async function runEmailWorker(now = new Date()): Promise<WorkerSummary> {
  const db = await admin();
  const summary: WorkerSummary = {
    checked: 0,
    weeklySent: 0,
    digestsSent: 0,
    skipped: 0,
    throttled: 0,
    failed: 0,
    budget: 0,
  };

  let budget = await remainingBatch(db, 10);
  summary.budget = budget;
  if (budget <= 0) return summary;

  const { data } = await db
    .from("email_preferences")
    .select("*")
    .is("unsubscribed_at", null)
    .or("weekly_report_enabled.eq.true,portfolio_digest_enabled.eq.true")
    .limit(500);

  const prefs = (data ?? []) as unknown as PrefRow[];
  const { accountPlanForBackground } = await import("./email-plan.server");

  for (const pref of prefs) {
    if (budget <= 0) break;
    summary.checked += 1;

    const plan = await accountPlanForBackground(pref.owner_id);
    const ent = emailEntitlementsFor(plan);
    const email = await ownerEmail(db, pref.owner_id);
    if (!email) {
      summary.skipped += 1;
      continue;
    }

    const clock = localClock(now, pref.timezone);
    const endDate = clock.date;
    const periodStart = reportPeriodStart(now, pref.timezone);

    // Weekly report — one per selected business.
    const weeklyPref: SchedulePreference = {
      weekday: pref.weekday,
      localTime: pref.local_time,
      timezone: pref.timezone,
    };
    if (ent.weeklyReport && pref.weekly_report_enabled && isWeeklyReportDue(weeklyPref, now)) {
      for (const businessId of (pref.business_ids ?? []).slice(
        0,
        ent.weeklyReportBusinessesMax,
      )) {
        if (budget <= 0) break;
        const result = await sendWeeklyReport({
          userId: pref.owner_id,
          email,
          businessId,
          periodStart,
          endDate,
        });
        budget = tally(summary, result, "weekly", budget);
      }
    }

    // Portfolio digest — one per account.
    const digestPref: SchedulePreference = {
      weekday: pref.portfolio_weekday ?? pref.weekday,
      localTime: pref.portfolio_local_time ?? pref.local_time,
      timezone: pref.timezone,
    };
    if (
      budget > 0 &&
      ent.portfolioDigest &&
      pref.portfolio_digest_enabled &&
      (pref.business_ids ?? []).length >= MIN_BUSINESSES_FOR_DIGEST &&
      isWeeklyReportDue(digestPref, now)
    ) {
      const result = await sendPortfolioDigest({
        userId: pref.owner_id,
        email,
        businessIds: pref.business_ids ?? [],
        periodStart,
        endDate,
      });
      budget = tally(summary, result, "digest", budget);
    }
  }

  // Track how much of the pass budget was actually used.
  summary.budget = summary.budget - budget;
  return summary;
}

function tally(
  summary: WorkerSummary,
  result: DispatchResult | { status: "insufficient_data" },
  kind: "weekly" | "digest",
  budget: number,
): number {
  switch (result.status) {
    case "sent":
      if (kind === "weekly") summary.weeklySent += 1;
      else summary.digestsSent += 1;
      return budget - 1;
    case "throttled":
      summary.throttled += 1;
      return 0;
    case "failed":
      summary.failed += 1;
      return budget - 1;
    default:
      summary.skipped += 1;
      return budget;
  }
}

async function ownerEmail(db: LooseClient, ownerId: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("email").eq("id", ownerId).maybeSingle();
  const email = (data as { email?: string | null } | null)?.email;
  return typeof email === "string" && email.includes("@") ? email : null;
}

export { idempotencyKey };

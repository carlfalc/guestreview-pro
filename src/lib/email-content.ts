// Pure content layer for production email templates.
//
// Everything here is deterministic and I/O free so it can be unit tested and
// safely imported from both server code and the React Email templates.
// Nothing rendered by a template may contain caller-supplied HTML: values are
// coerced to plain text here before they ever reach a component.

import { AI_SUMMARY_DISCLAIMER } from "./email-entitlements";

export const TEMPLATE_KEYS = [
  "weekly_reputation_health",
  "qr_placement_guide",
  "portfolio_digest",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export { AI_SUMMARY_DISCLAIMER };

/* -------------------------------------------------------------------------- */
/* Sanitisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Reduce any untrusted value (business name, AI summary, recommendation) to
 * inert plain text. React escapes props on render, but stripping markup here
 * means the plain-text part is safe too and no stray tags survive.
 */
export function plainText(value: unknown, maxLength = 300): string {
  const raw = value == null ? "" : String(value);
  const stripped = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, "")
    // eslint-disable-next-line no-control-regex -- strip control characters
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function plainTextList(values: unknown, max = 3, maxLength = 160): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => plainText(v, maxLength))
    .filter((v) => v.length > 0)
    .slice(0, max);
}

/** Only http(s) links are ever emitted into an email. */
export function safeUrl(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!/^https?:\/\//i.test(raw)) return fallback;
  try {
    return new URL(raw).toString();
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Claim safety                                                               */
/* -------------------------------------------------------------------------- */

const BANNED_CLAIM_PATTERNS: RegExp[] = [
  /\b\d+(\.\d+)?\s*(star|stars|★)/i,
  /\bstar rating\b/i,
  /\bgoogle (reviews?|rating)\b/i,
  /\breview (count|total|totals)\b/i,
  /\b(revenue|sales|turnover|profit)\b/i,
  /\b(guarantee|guaranteed|guarantees)\b/i,
  /\bcompetitors?\b/i,
  /\b(customers? (feel|felt|love|hate)|sentiment)\b/i,
];

/** True when a line makes a claim this product cannot verify. */
export function violatesClaimPolicy(text: string): boolean {
  return BANNED_CLAIM_PATTERNS.some((re) => re.test(text));
}

/** Drop any AI/recommendation line that makes an unverifiable claim. */
export function screenClaims(lines: string[]): string[] {
  return lines.filter((line) => !violatesClaimPolicy(line));
}

export function screenSummary(summary: string): string {
  const kept = screenClaims(
    summary
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return kept.join(" ");
}

/* -------------------------------------------------------------------------- */
/* Weekly Reputation Health™ report                                           */
/* -------------------------------------------------------------------------- */

export interface WeeklyReportData {
  businessName: string;
  periodLabel: string;
  score: number | null;
  scoreMovement: string;
  confidence: string;
  scans: number;
  clicks: number;
  clickRate: string;
  strongestPlacement: string;
  mainOpportunity: string;
  aiSummary: string;
  actions: string[];
  dashboardUrl: string;
  reportUrl: string;
  unsubscribeNote?: string;
}

const FALLBACK_BASE = "https://www.guestreviewpro.com";

/** Validate + sanitise raw weekly report input. Throws on unusable data. */
export function buildWeeklyReportData(input: Record<string, unknown>): WeeklyReportData {
  const businessName = plainText(input.businessName, 80);
  if (!businessName) throw new Error("weekly report: businessName is required");

  const rawScore = Number(input.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;

  return {
    businessName,
    periodLabel: plainText(input.periodLabel, 60) || "Last 7 days",
    score,
    scoreMovement: plainText(input.scoreMovement, 60) || "No change yet",
    confidence: plainText(input.confidence, 20) || "Low",
    scans: nonNegativeInt(input.scans),
    clicks: nonNegativeInt(input.clicks),
    clickRate: plainText(input.clickRate, 24) || "Not enough data yet",
    strongestPlacement: plainText(input.strongestPlacement, 160) || "Not enough data yet",
    mainOpportunity: plainText(input.mainOpportunity, 160) || "Not enough data yet",
    aiSummary: screenSummary(plainText(input.aiSummary, 600)),
    actions: screenClaims(plainTextList(input.actions, 3, 160)),
    dashboardUrl: safeUrl(input.dashboardUrl, `${FALLBACK_BASE}/dashboard`),
    reportUrl: safeUrl(input.reportUrl, `${FALLBACK_BASE}/reports`),
    unsubscribeNote: plainText(input.unsubscribeNote, 200) || undefined,
  };
}

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Minimum verified activity before a weekly report is worth sending. */
export const MIN_SCANS_FOR_WEEKLY_REPORT = 5;

export interface SufficiencyInput {
  scans: number;
  score: number | null;
  hasBusiness: boolean;
}

export function hasSufficientWeeklyData(input: SufficiencyInput): boolean {
  if (!input.hasBusiness) return false;
  if (input.score === null) return false;
  return input.scans >= MIN_SCANS_FOR_WEEKLY_REPORT;
}

export function weeklySubject(data: { businessName?: unknown }): string {
  const name = plainText(data?.businessName, 60);
  return name
    ? `This week's Reputation Health™ update for ${name}`
    : "Your weekly Reputation Health™ report";
}

/* -------------------------------------------------------------------------- */
/* QR Placement Guide                                                         */
/* -------------------------------------------------------------------------- */

export interface GuideEmailData {
  guideUrl: string;
  createQrUrl: string;
  industryLabel: string | null;
}

export function buildGuideEmailData(input: Record<string, unknown>): GuideEmailData {
  return {
    guideUrl: safeUrl(input.guideUrl, `${FALLBACK_BASE}/resources/qr-code-size-and-placement`),
    createQrUrl: safeUrl(input.createQrUrl, `${FALLBACK_BASE}/auth`),
    industryLabel: plainText(input.industryLabel, 60) || null,
  };
}

export const GUIDE_SUBJECT = "Your Google Review QR Placement Guide";

/** Resend window for the public guide — the same address cannot re-trigger. */
export const GUIDE_RESEND_WINDOW_HOURS = 24;

/* -------------------------------------------------------------------------- */
/* Portfolio digest                                                           */
/* -------------------------------------------------------------------------- */

export interface PortfolioRow {
  businessName: string;
  score: number | null;
  movement: string;
  confidence: string;
  scans: number;
  warning: string;
}

export interface PortfolioDigestData {
  periodLabel: string;
  businessCount: number;
  averageScore: number | null;
  averageMovement: string;
  improving: number;
  needingAttention: number;
  strongest: string;
  weakest: string;
  recommendations: string[];
  rows: PortfolioRow[];
  dashboardUrl: string;
  unsubscribeNote?: string;
}

export const MIN_BUSINESSES_FOR_DIGEST = 2;

export function buildPortfolioDigestData(input: Record<string, unknown>): PortfolioDigestData {
  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  const rows: PortfolioRow[] = rawRows.slice(0, 25).map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    const score = Number(row.score);
    return {
      businessName: plainText(row.businessName, 80) || "Business",
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
      movement: plainText(row.movement, 24) || "—",
      confidence: plainText(row.confidence, 20) || "Low",
      scans: nonNegativeInt(row.scans),
      warning: plainText(row.warning, 120) || "None",
    };
  });
  if (rows.length < MIN_BUSINESSES_FOR_DIGEST) {
    throw new Error("portfolio digest: at least two businesses are required");
  }

  const scored = rows.map((r) => r.score).filter((s): s is number => s !== null);
  const avg =
    scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  return {
    periodLabel: plainText(input.periodLabel, 60) || "Last 7 days",
    businessCount: rows.length,
    averageScore: avg,
    averageMovement: plainText(input.averageMovement, 40) || "No change yet",
    improving: nonNegativeInt(input.improving),
    needingAttention: nonNegativeInt(input.needingAttention),
    strongest: plainText(input.strongest, 80) || "Not enough data yet",
    weakest: plainText(input.weakest, 80) || "Not enough data yet",
    recommendations: screenClaims(plainTextList(input.recommendations, 3, 160)),
    rows,
    dashboardUrl: safeUrl(input.dashboardUrl, `${FALLBACK_BASE}/dashboard`),
    unsubscribeNote: plainText(input.unsubscribeNote, 200) || undefined,
  };
}

export function portfolioSubject(data: { businessCount?: unknown }): string {
  const count = Number(data?.businessCount);
  return Number.isFinite(count) && count > 0
    ? `${Math.round(count)} businesses at a glance`
    : "Your weekly GuestReview Pro portfolio digest";
}

// Pure scheduling, idempotency and retry logic for outbound email.
// No I/O, no browser APIs — safe to import anywhere and fully unit-testable.
// Schedules are ALWAYS evaluated server-side; browser code never decides when
// an email is due.

export const EMAIL_TYPES = [
  "weekly_report",
  "portfolio_digest",
  "welcome",
  "email_verification",
  "password_reset",
  "subscription_started",
  "subscription_changed",
  "payment_failed",
  "subscription_canceled",
  "lead_guide",
  "beta_feedback_ack",
  "test_send",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

/** Emails that are operationally or legally required and can never be opted out of. */
export const ESSENTIAL_EMAIL_TYPES: readonly EmailType[] = [
  "email_verification",
  "password_reset",
  "subscription_started",
  "subscription_changed",
  "payment_failed",
  "subscription_canceled",
];

export function isEssentialEmail(type: EmailType): boolean {
  return ESSENTIAL_EMAIL_TYPES.includes(type);
}

/** Emails that must carry an unsubscribe link. */
export function requiresUnsubscribeLink(type: EmailType): boolean {
  return type === "weekly_report" || type === "portfolio_digest" || type === "lead_guide";
}

export const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.label ?? "Monday";
}

export interface LocalClock {
  /** 0 = Sunday … 6 = Saturday, in the account's own timezone. */
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Resolve an instant into an account's local weekday / time-of-day / date. */
export function localClock(now: Date, timezone: string): LocalClock {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  } catch {
    return localClock(now, "UTC");
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutes: hour * 60 + Number(get("minute")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** Default local delivery time (minutes since midnight) when a value is unusable. */
export const DEFAULT_LOCAL_MINUTES = 8 * 60;

/** "08:30" or "08:30:00" → minutes since midnight. Falls back to 08:00. */
export function parseLocalTime(value: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value).trim());
  if (!match) return DEFAULT_LOCAL_MINUTES;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const mins = Math.min(59, Math.max(0, Number(match[2])));
  return hours * 60 + mins;
}

export function formatLocalTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface SchedulePreference {
  weekday: number;
  localTime: string;
  timezone: string;
}

/**
 * A weekly report is due when the account's local weekday matches and the
 * local clock has passed the chosen time, within a grace window (the scheduler
 * runs periodically, so it must tolerate not firing at the exact minute).
 */
export const DUE_GRACE_MINUTES = 120;

export function isWeeklyReportDue(
  pref: SchedulePreference,
  now: Date,
  graceMinutes = DUE_GRACE_MINUTES,
): boolean {
  const clock = localClock(now, pref.timezone);
  if (clock.weekday !== pref.weekday) return false;
  const target = parseLocalTime(pref.localTime);
  return clock.minutes >= target && clock.minutes < target + graceMinutes;
}

/**
 * The report period is the seven local days ending on the delivery date.
 * Returned as a local calendar date (YYYY-MM-DD) so the idempotency key is
 * stable regardless of when in the grace window the job actually ran.
 */
export function reportPeriodStart(now: Date, timezone: string): string {
  const clock = localClock(now, timezone);
  const [y, m, d] = clock.date.split("-").map(Number);
  const start = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  start.setUTCDate(start.getUTCDate() - 7);
  return start.toISOString().slice(0, 10);
}

/** Stable key preventing the same email going out twice. */
export function idempotencyKey(args: {
  type: EmailType;
  ownerId: string;
  businessId?: string | null;
  periodStart?: string | null;
}): string {
  return [args.type, args.ownerId, args.businessId ?? "all", args.periodStart ?? "once"].join(":");
}

/* -------------------------------------------------------------------------- */
/* Retry policy                                                               */
/* -------------------------------------------------------------------------- */

export const MAX_ATTEMPTS = 5;

/** Exponential backoff: 1m, 5m, 25m, 2h05m (capped at 6h). */
export function retryDelayMs(attempt: number): number {
  const base = 60_000;
  const delay = base * Math.pow(5, Math.max(0, attempt - 1));
  return Math.min(delay, 6 * 60 * 60 * 1000);
}

export function nextAttemptAt(attempt: number, now: Date): Date {
  return new Date(now.getTime() + retryDelayMs(attempt));
}

export type FailureKind = "transient" | "permanent";

const PERMANENT_CODES = new Set([
  "recipient_suppressed",
  "invalid_recipient",
  "domain_not_verified",
  "emails_disabled",
  "hard_bounce",
  "complaint",
  "unsubscribed",
  "template_missing",
  "not_entitled",
]);

/** Transient failures are retried; permanent ones stop immediately. */
export function classifyFailure(code: string | null | undefined, status?: number): FailureKind {
  if (code && PERMANENT_CODES.has(code)) return "permanent";
  if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) {
    return "permanent";
  }
  return "transient";
}

export function shouldRetry(args: {
  kind: FailureKind;
  attempt: number;
  maxAttempts?: number;
}): boolean {
  if (args.kind === "permanent") return false;
  return args.attempt < (args.maxAttempts ?? MAX_ATTEMPTS);
}

/* -------------------------------------------------------------------------- */
/* Privacy helpers                                                            */
/* -------------------------------------------------------------------------- */

/** j***n@example.com — used everywhere a recipient is displayed or logged. */
export function maskEmail(email: string): string {
  const value = String(email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : "";
  return `${head}***${tail}@${domain}`;
}

export function normaliseEmail(email: string): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  const value = normaliseEmail(email);
  return value.length <= 254 && EMAIL_RE.test(value);
}

/** A list of supported delivery timezones (IANA), kept short and practical. */
export const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export function isSupportedTimezone(tz: string): boolean {
  return (COMMON_TIMEZONES as readonly string[]).includes(tz);
}

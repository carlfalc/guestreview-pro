// Deliverability guard rails for a brand-new sending domain.
//
// Pure decision logic — the caller supplies the current counts and config, so
// every rule here is unit-testable and no provider reputation is assumed.

export type DomainStatus = "verifying" | "active" | "failed";

export interface ThrottleConfig {
  maxPerHour: number;
  maxPerDay: number;
  /** Operator pause: scheduled/bulk email stops, one-off test sends still run. */
  paused: boolean;
  /** Global kill switch: nothing is sent at all. */
  killSwitch: boolean;
  domainStatus: DomainStatus;
}

export const DEFAULT_MAX_PER_HOUR = 50;
export const DEFAULT_MAX_PER_DAY = 200;

function intFrom(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function boolFrom(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function domainStatusFrom(value: string | undefined): DomainStatus {
  const v = (value ?? "").toLowerCase();
  if (v === "active" || v === "verified") return "active";
  if (v === "failed" || v === "provisioning_failed") return "failed";
  return "verifying";
}

/** Read the throttle configuration from server environment variables. */
export function throttleConfigFromEnv(env: Record<string, string | undefined>): ThrottleConfig {
  return {
    maxPerHour: intFrom(env["EMAIL_MAX_PER_HOUR"], DEFAULT_MAX_PER_HOUR),
    maxPerDay: intFrom(env["EMAIL_MAX_PER_DAY"], DEFAULT_MAX_PER_DAY),
    paused: boolFrom(env["EMAIL_SENDING_PAUSED"]),
    killSwitch: boolFrom(env["EMAIL_KILL_SWITCH"]),
    domainStatus: domainStatusFrom(env["EMAIL_DOMAIN_STATUS"]),
  };
}

export type ThrottleReason =
  | "kill_switch"
  | "paused"
  | "domain_not_verified"
  | "hourly_limit"
  | "daily_limit";

export type ThrottleDecision =
  | { allowed: true; remainingHour: number; remainingDay: number }
  | { allowed: false; reason: ThrottleReason };

export interface ThrottleCounts {
  sentLastHour: number;
  sentLastDay: number;
}

export interface ThrottleRequest {
  config: ThrottleConfig;
  counts: ThrottleCounts;
  /** Test sends bypass the pause switch but never the kill switch or limits. */
  kind: "scheduled" | "triggered" | "test";
}

export function evaluateThrottle(req: ThrottleRequest): ThrottleDecision {
  const { config, counts, kind } = req;
  if (config.killSwitch) return { allowed: false, reason: "kill_switch" };
  if (config.paused && kind !== "test") return { allowed: false, reason: "paused" };
  if (config.domainStatus !== "active") return { allowed: false, reason: "domain_not_verified" };
  if (counts.sentLastHour >= config.maxPerHour) return { allowed: false, reason: "hourly_limit" };
  if (counts.sentLastDay >= config.maxPerDay) return { allowed: false, reason: "daily_limit" };
  return {
    allowed: true,
    remainingHour: config.maxPerHour - counts.sentLastHour,
    remainingDay: config.maxPerDay - counts.sentLastDay,
  };
}

export function throttleMessage(reason: ThrottleReason): string {
  switch (reason) {
    case "kill_switch":
      return "Email sending is switched off.";
    case "paused":
      return "Email sending is paused by an administrator.";
    case "domain_not_verified":
      return "Email delivery is waiting for DNS verification.";
    case "hourly_limit":
      return "Hourly send limit reached — queued for the next window.";
    case "daily_limit":
      return "Daily send limit reached — queued for tomorrow.";
  }
}

/**
 * How many scheduled emails a single worker pass may dispatch. Kept well under
 * the hourly cap so reports trickle out instead of arriving as one burst.
 */
export function batchSize(config: ThrottleConfig, counts: ThrottleCounts, requested = 10): number {
  const room = Math.min(
    config.maxPerHour - counts.sentLastHour,
    config.maxPerDay - counts.sentLastDay,
  );
  return Math.max(0, Math.min(requested, room));
}

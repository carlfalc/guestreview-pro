import { describe, expect, it } from "vitest";
import {
  EMAIL_ENTITLEMENTS,
  allowedBusinessIds,
  canReceivePortfolioDigest,
  canReceiveWeeklyReport,
  emailEntitlementsFor,
} from "@/lib/email-entitlements";
import {
  classifyFailure,
  formatLocalTime,
  idempotencyKey,
  isEssentialEmail,
  isSupportedTimezone,
  isWeeklyReportDue,
  isValidEmail,
  localClock,
  maskEmail,
  normaliseEmail,
  parseLocalTime,
  requiresUnsubscribeLink,
  retryDelayMs,
  shouldRetry,
} from "@/lib/email-schedule";

describe("email entitlements", () => {
  it("blocks weekly reports on the free plan", () => {
    expect(canReceiveWeeklyReport("free")).toBe(false);
    expect(canReceiveWeeklyReport("pro")).toBe(true);
    expect(canReceiveWeeklyReport("business")).toBe(true);
  });

  it("only gives the portfolio digest to Business", () => {
    expect(canReceivePortfolioDigest("pro")).toBe(false);
    expect(canReceivePortfolioDigest("business")).toBe(true);
  });

  it("caps selected businesses by plan", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `b${i}`);
    expect(allowedBusinessIds("free", ids)).toHaveLength(0);
    expect(allowedBusinessIds("pro", ids)).toHaveLength(1);
    expect(allowedBusinessIds("business", ids)).toHaveLength(10);
  });

  it("falls back to free for unknown plans", () => {
    expect(emailEntitlementsFor("nope" as never)).toEqual(EMAIL_ENTITLEMENTS.free);
  });
});

describe("email classification", () => {
  it("treats billing and security mail as essential", () => {
    expect(isEssentialEmail("password_reset")).toBe(true);
    expect(isEssentialEmail("weekly_report")).toBe(false);
  });

  it("requires an unsubscribe link only on non-essential mail", () => {
    expect(requiresUnsubscribeLink("weekly_report")).toBe(true);
    expect(requiresUnsubscribeLink("password_reset")).toBe(false);
  });
});

describe("local clock and scheduling", () => {
  it("converts UTC to a local weekday and time", () => {
    const clock = localClock(new Date("2026-01-05T08:30:00Z"), "UTC");
    expect(clock.weekday).toBe(1);
    expect(formatLocalTime(clock.minutes)).toBe("08:30");
  });

  it("shifts weekday across timezones", () => {
    const clock = localClock(new Date("2026-01-05T23:30:00Z"), "Australia/Sydney");
    expect(clock.weekday).toBe(2);
  });

  it("is due at the configured local time", () => {
    const pref = { weekday: 1, localTime: "08:00", timezone: "UTC" };
    expect(isWeeklyReportDue(pref, new Date("2026-01-05T08:05:00Z"))).toBe(true);
    expect(isWeeklyReportDue(pref, new Date("2026-01-05T07:00:00Z"))).toBe(false);
    expect(isWeeklyReportDue(pref, new Date("2026-01-06T08:05:00Z"))).toBe(false);
  });

  it("still fires inside the grace window after a delayed run", () => {
    const pref = { weekday: 1, localTime: "08:00", timezone: "UTC" };
    expect(isWeeklyReportDue(pref, new Date("2026-01-05T09:45:00Z"))).toBe(true);
    expect(isWeeklyReportDue(pref, new Date("2026-01-05T11:00:00Z"))).toBe(false);
  });

  it("round-trips local times", () => {
    expect(formatLocalTime(parseLocalTime("07:05"))).toBe("07:05");
    expect(formatLocalTime(parseLocalTime("bad"))).toBe("08:00");
  });

  it("validates timezones", () => {
    expect(isSupportedTimezone("Europe/London")).toBe(true);
    expect(isSupportedTimezone("Middle/Earth")).toBe(false);
  });

  it("builds a stable idempotency key", () => {
    const args = {
      type: "weekly_report" as const,
      ownerId: "o1",
      businessId: "b1",
      periodStart: "2026-01-05",
    };
    expect(idempotencyKey(args)).toBe(idempotencyKey(args));
    expect(idempotencyKey(args)).toContain("weekly_report");
  });
});

describe("retry policy", () => {
  it("backs off exponentially", () => {
    expect(retryDelayMs(1)).toBeLessThan(retryDelayMs(2));
    expect(retryDelayMs(2)).toBeLessThan(retryDelayMs(3));
  });

  it("classifies permanent failures", () => {
    expect(classifyFailure("recipient_suppressed")).toBe("permanent");
    expect(classifyFailure(null, 500)).toBe("transient");
    expect(classifyFailure(null, 429)).toBe("transient");
  });

  it("stops retrying after the attempt cap or a permanent failure", () => {
    expect(shouldRetry({ attempt: 1, kind: "transient" })).toBe(true);
    expect(shouldRetry({ attempt: 9, kind: "transient" })).toBe(false);
    expect(shouldRetry({ attempt: 1, kind: "permanent" })).toBe(false);
  });
});

describe("address handling", () => {
  it("masks recipients for display", () => {
    expect(maskEmail("owner@example.com")).not.toContain("owner@");
    expect(maskEmail("owner@example.com")).toContain("example.com");
  });

  it("normalises and validates addresses", () => {
    expect(normaliseEmail("  Owner@Example.COM ")).toBe("owner@example.com");
    expect(isValidEmail("owner@example.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
  });
});

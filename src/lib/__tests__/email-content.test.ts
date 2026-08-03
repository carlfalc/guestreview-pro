import { describe, expect, it } from "vitest";
import {
  buildGuideEmailData,
  buildPortfolioDigestData,
  buildWeeklyReportData,
  hasSufficientWeeklyData,
  MIN_BUSINESSES_FOR_DIGEST,
  plainText,
  portfolioSubject,
  safeUrl,
  screenClaims,
  screenSummary,
  violatesClaimPolicy,
  weeklySubject,
} from "../email-content";
import {
  batchSize,
  DEFAULT_MAX_PER_DAY,
  domainStatusFrom,
  evaluateThrottle,
  throttleConfigFromEnv,
} from "../email-throttle";

describe("email content safety", () => {
  it("strips HTML and control characters", () => {
    expect(plainText("<b>Hello</b>\u0000 world")).toBe("Hello world");
  });

  it("rejects non-https URLs and falls back", () => {
    expect(safeUrl("javascript:alert(1)", "https://example.com")).toBe("https://example.com");
    expect(safeUrl("https://ok.test/x", "https://example.com")).toBe("https://ok.test/x");
  });

  it("flags unverifiable claims", () => {
    expect(violatesClaimPolicy("You gained 12 new 5 star reviews")).toBe(true);
    expect(violatesClaimPolicy("Revenue grew last week")).toBe(true);
    expect(violatesClaimPolicy("Your counter placement earned the most scans")).toBe(false);
  });

  it("removes offending lines and sentences", () => {
    expect(screenClaims(["Add a table tent", "Guaranteed 5 stars"])).toEqual(["Add a table tent"]);
    expect(screenSummary("Scans rose. Your star rating improved.")).toBe("Scans rose.");
  });
});

describe("weekly report payload", () => {
  const base = {
    businessName: "Glasshouse",
    score: 72.4,
    scans: 30,
    clicks: 12,
    clickRate: "40%",
    dashboardUrl: "https://www.guestreviewpro.com/dashboard",
  };

  it("rounds and clamps the score", () => {
    expect(buildWeeklyReportData(base).score).toBe(72);
    expect(buildWeeklyReportData({ ...base, score: 900 }).score).toBe(100);
  });

  it("falls back to 'Not enough data yet' rather than inventing values", () => {
    const data = buildWeeklyReportData({ ...base, strongestPlacement: "" });
    expect(data.strongestPlacement).toBe("Not enough data yet");
  });

  it("requires a business name", () => {
    expect(() => buildWeeklyReportData({ ...base, businessName: "" })).toThrow();
  });

  it("gates sending on verified activity", () => {
    expect(hasSufficientWeeklyData({ scans: 30, score: 70, hasBusiness: true })).toBe(true);
    expect(hasSufficientWeeklyData({ scans: 1, score: 70, hasBusiness: true })).toBe(false);
    expect(hasSufficientWeeklyData({ scans: 30, score: null, hasBusiness: true })).toBe(false);
    expect(hasSufficientWeeklyData({ scans: 30, score: 70, hasBusiness: false })).toBe(false);
  });

  it("personalises the subject", () => {
    expect(weeklySubject({ businessName: "Glasshouse" })).toContain("Glasshouse");
    expect(weeklySubject({})).toContain("Reputation Health");
  });
});

describe("guide and digest payloads", () => {
  it("defaults guide links to safe URLs", () => {
    const data = buildGuideEmailData({ guideUrl: "not-a-url" });
    expect(data.guideUrl.startsWith("https://")).toBe(true);
    expect(data.industryLabel).toBeNull();
  });

  it("builds a digest and counts businesses", () => {
    const data = buildPortfolioDigestData({
      periodLabel: "week",
      rows: [
        { businessName: "A", score: 70, movement: "+2", confidence: "High", scans: 20 },
        { businessName: "B", score: 40, movement: "-3", confidence: "Low", scans: 4 },
      ],
      dashboardUrl: "https://www.guestreviewpro.com/dashboard",
    });
    expect(data.rows).toHaveLength(2);
    expect(portfolioSubject({ businessCount: 2 })).toBeTruthy();
    expect(MIN_BUSINESSES_FOR_DIGEST).toBe(2);
  });
});

describe("deliverability guard rails", () => {
  it("maps domain status values", () => {
    expect(domainStatusFrom("verified")).toBe("active");
    expect(domainStatusFrom("provisioning_failed")).toBe("failed");
    expect(domainStatusFrom(undefined)).toBe("verifying");
  });

  it("reads limits from the environment", () => {
    const config = throttleConfigFromEnv({ EMAIL_MAX_PER_HOUR: "5", EMAIL_SENDING_PAUSED: "true" });
    expect(config.maxPerHour).toBe(5);
    expect(config.maxPerDay).toBe(DEFAULT_MAX_PER_DAY);
    expect(config.paused).toBe(true);
  });

  it("holds every send until the sending domain is verified", () => {
    const config = throttleConfigFromEnv({});
    const counts = { sentLastHour: 0, sentLastDay: 0 };
    const decision = evaluateThrottle({ config, counts, kind: "scheduled" });
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toBe("domain_not_verified");
  });

  it("blocks scheduled email when paused but allows tests", () => {
    const config = throttleConfigFromEnv({ EMAIL_SENDING_PAUSED: "1", EMAIL_DOMAIN_STATUS: "active" });
    const counts = { sentLastHour: 0, sentLastDay: 0 };
    expect(evaluateThrottle({ config, counts, kind: "scheduled" }).allowed).toBe(false);
    expect(evaluateThrottle({ config, counts, kind: "test" }).allowed).toBe(true);
  });

  it("stops everything on the kill switch", () => {
    const config = throttleConfigFromEnv({ EMAIL_KILL_SWITCH: "1", EMAIL_DOMAIN_STATUS: "active" });
    const counts = { sentLastHour: 0, sentLastDay: 0 };
    expect(evaluateThrottle({ config, counts, kind: "test" }).allowed).toBe(false);
  });

  it("caps the batch to the remaining hourly and daily budget", () => {
    const config = throttleConfigFromEnv({ EMAIL_MAX_PER_HOUR: "10", EMAIL_MAX_PER_DAY: "12" });
    expect(batchSize(config, { sentLastHour: 8, sentLastDay: 8 }, 10)).toBe(2);
    expect(batchSize(config, { sentLastHour: 0, sentLastDay: 12 }, 10)).toBe(0);
  });
});

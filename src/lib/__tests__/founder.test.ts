import { describe, it, expect } from "vitest";
import {
  FOUNDER_SLOT_LIMIT,
  FOUNDER_COPY,
  resolveFounderPlan,
  allFounderLookupKeys,
  isFounderLookupKey,
  formatSlotNumber,
  founderBadgeLabel,
  isFounderActive,
  founderOfferAvailable,
  remainingLabel,
  founderFeedbackDue,
  FOUNDER_FEEDBACK_DELAY_DAYS,
} from "@/lib/founder";

describe("founder programme rules", () => {
  it("caps the programme at 100 places", () => {
    expect(FOUNDER_SLOT_LIMIT).toBe(100);
  });

  it("only offers the deal while places remain", () => {
    expect(founderOfferAvailable(1)).toBe(true);
    expect(founderOfferAvailable(0)).toBe(false);
    expect(founderOfferAvailable(null)).toBe(false);
    expect(remainingLabel(0)).toMatch(/claimed/i);
    expect(remainingLabel(1)).toBe("1 founder place left");
  });

  it("states the one-offer-per-account and refund rules", () => {
    const terms = FOUNDER_COPY.terms.join(" ").toLowerCase();
    expect(terms).toContain("one founder offer per account");
    expect(terms).toContain("refunded");
    expect(terms).toContain("standard pricing applies");
  });
});

describe("regional founder pricing", () => {
  it("prices NZ at NZ$19 monthly and NZ$190 annually", () => {
    const monthly = resolveFounderPlan("NZ", "monthly");
    const annual = resolveFounderPlan("NZ", "annual");
    expect(monthly.currency).toBe("NZD");
    expect(monthly.amountMinor).toBe(1900);
    expect(annual.amountMinor).toBe(19000);
  });

  it("always discounts against the standard regional price", () => {
    for (const region of ["NZ", "AU", "US", "CA", "GB", "EU"] as const) {
      for (const interval of ["monthly", "annual"] as const) {
        const plan = resolveFounderPlan(region, interval);
        expect(plan.amountMinor).toBeLessThan(plan.standardAmountMinor);
        expect(plan.discountPercent).toBeGreaterThan(0);
        expect(plan.tier).toBe("pro");
      }
    }
  });

  it("falls back to the international US$ rate for unbillable currencies", () => {
    const plan = resolveFounderPlan("JP", "monthly");
    expect(plan.usesFallbackCurrency).toBe(true);
    expect(plan.currency).toBe("USD");
  });

  it("uses stable lookup keys that the webhook recognises", () => {
    expect(resolveFounderPlan("NZ", "monthly").stripeLookupKey).toBe("founder_pro_nzd_monthly");
    for (const key of allFounderLookupKeys()) {
      expect(isFounderLookupKey(key)).toBe(true);
    }
    expect(isFounderLookupKey("pro_monthly_nzd")).toBe(false);
    expect(isFounderLookupKey(null)).toBe(false);
  });
});

describe("founder badge and slot state", () => {
  it("formats slot numbers to three digits", () => {
    expect(formatSlotNumber(42)).toBe("#042");
    expect(formatSlotNumber(100)).toBe("#100");
    expect(formatSlotNumber(null)).toBe("");
    expect(founderBadgeLabel(7)).toBe("Founding Member #007");
  });

  it("shows the badge only for an active place", () => {
    expect(isFounderActive({ status: "active" })).toBe(true);
    for (const status of ["pending", "released", "refunded", "canceled"]) {
      expect(isFounderActive({ status })).toBe(false);
    }
    expect(isFounderActive(null)).toBe(false);
  });
});

describe("founder feedback timing", () => {
  it("opens the survey only after the delay", () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 86_400_000).toISOString();
    const old = new Date(now - (FOUNDER_FEEDBACK_DELAY_DAYS + 1) * 86_400_000).toISOString();
    expect(founderFeedbackDue(recent)).toBe(false);
    expect(founderFeedbackDue(old)).toBe(true);
    expect(founderFeedbackDue(null)).toBe(false);
  });
});

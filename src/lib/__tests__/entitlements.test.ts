import { describe, it, expect } from "vitest";
import {
  effectivePlan,
  entitlementsFor,
  canCreateQrCodeWith,
  canCreateBusinessWith,
  markLegacyOverLimit,
} from "@/lib/entitlements";
import { resolveBillablePlan } from "@/lib/regional-pricing";

describe("effectivePlan", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it("defaults to free with no subscription", () => {
    expect(effectivePlan(null)).toBe("free");
  });
  it("grants the plan while active", () => {
    expect(effectivePlan({ planKey: "pro", status: "active", currentPeriodEnd: future })).toBe("pro");
  });
  it("keeps access while past_due (dunning)", () => {
    expect(effectivePlan({ planKey: "pro", status: "past_due", currentPeriodEnd: future })).toBe("pro");
  });
  it("keeps access after cancel until period end", () => {
    expect(effectivePlan({ planKey: "business", status: "canceled", currentPeriodEnd: future })).toBe("business");
  });
  it("drops to free once the period has passed", () => {
    expect(effectivePlan({ planKey: "pro", status: "canceled", currentPeriodEnd: past })).toBe("free");
  });
});

describe("limits", () => {
  it("free allows one QR code and one business", () => {
    expect(canCreateQrCodeWith("free", { businesses: 0, activeQrCodes: 0 })).toBe(true);
    expect(canCreateQrCodeWith("free", { businesses: 0, activeQrCodes: 1 })).toBe(false);
    expect(canCreateBusinessWith("free", { businesses: 1, activeQrCodes: 0 })).toBe(false);
  });
  it("pro is unlimited on QR codes but single-business", () => {
    expect(canCreateQrCodeWith("pro", { businesses: 1, activeQrCodes: 500 })).toBe(true);
    expect(canCreateBusinessWith("pro", { businesses: 1, activeQrCodes: 0 })).toBe(false);
  });
  it("business allows ten businesses", () => {
    expect(entitlementsFor("business").businessesMax).toBe(10);
    expect(canCreateBusinessWith("business", { businesses: 9, activeQrCodes: 0 })).toBe(true);
  });
});

describe("legacy accounts", () => {
  it("flags only the excess QR codes, never deletes", () => {
    const rows = [
      { id: "a", created_at: "2024-01-01", status: "active" },
      { id: "b", created_at: "2024-02-01", status: "active" },
      { id: "c", created_at: "2024-03-01", status: "paused" },
    ];
    const marked = markLegacyOverLimit(rows, "free");
    expect(marked.find((r) => r.id === "a")!.legacyOverLimit).toBe(false);
    expect(marked.find((r) => r.id === "b")!.legacyOverLimit).toBe(true);
    expect(marked.find((r) => r.id === "c")!.legacyOverLimit).toBe(false);
    expect(marked).toHaveLength(3);
  });
});

describe("regional billing resolution", () => {
  it("bills NZ accounts in NZD", () => {
    const plan = resolveBillablePlan("NZ", "pro", "monthly");
    expect(plan.currency).toBe("NZD");
    expect(plan.stripeLookupKey).toBe("pro_monthly_nzd");
    expect(plan.usesFallbackCurrency).toBe(false);
  });
  it("falls back to USD for currencies with no Stripe price", () => {
    const plan = resolveBillablePlan("JP", "business", "annual");
    expect(plan.currency).toBe("USD");
    expect(plan.stripeLookupKey).toBe("business_annual_usd");
    expect(plan.usesFallbackCurrency).toBe(true);
  });
});

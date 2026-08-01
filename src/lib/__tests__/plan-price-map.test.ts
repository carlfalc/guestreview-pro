import { describe, it, expect } from "vitest";
import {
  resolveTrustedPlanForPrice,
  findTrustedPriceByLookupKey,
  UnknownStripePriceError,
} from "@/lib/plan-price-map.server";

interface Row {
  stripe_price_id: string | null;
  stripe_lookup_key: string;
  plan_key: string;
  billing_interval: string;
  currency_code: string;
  pricing_region: string;
  amount_minor: number;
  environment: string;
  active: boolean;
}

const ROWS: Row[] = [
  {
    stripe_price_id: "price_live_pro_nzd",
    stripe_lookup_key: "pro_monthly_nzd",
    plan_key: "pro",
    billing_interval: "monthly",
    currency_code: "NZD",
    pricing_region: "NZ",
    amount_minor: 2900,
    environment: "live",
    active: true,
  },
  {
    stripe_price_id: null,
    stripe_lookup_key: "business_annual_gbp",
    plan_key: "business",
    billing_interval: "annual",
    currency_code: "GBP",
    pricing_region: "GB",
    amount_minor: 39000,
    environment: "live",
    active: true,
  },
  {
    stripe_price_id: "price_test_pro_nzd",
    stripe_lookup_key: "pro_monthly_nzd",
    plan_key: "pro",
    billing_interval: "monthly",
    currency_code: "NZD",
    pricing_region: "NZ",
    amount_minor: 2900,
    environment: "sandbox",
    active: true,
  },
  {
    stripe_price_id: "price_retired",
    stripe_lookup_key: "pro_monthly_old",
    plan_key: "pro",
    billing_interval: "monthly",
    currency_code: "NZD",
    pricing_region: "NZ",
    amount_minor: 1000,
    environment: "live",
    active: false,
  },
];

/** Minimal chainable stub of the Supabase query builder used by the module. */
function fakeAdmin(rows: Row[]) {
  return {
    from() {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        maybeSingle: async () => {
          const match = rows.find((r) =>
            Object.entries(filters).every(
              ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
            ),
          );
          return { data: match ?? null, error: null };
        },
      };
      return builder;
    },
  } as never;
}

const admin = fakeAdmin(ROWS);

describe("trusted price mapping", () => {
  it("resolves an exact price ID within the same environment", async () => {
    const plan = await resolveTrustedPlanForPrice(
      admin,
      { id: "price_live_pro_nzd", currency: "nzd", unit_amount: 2900 },
      "live",
    );
    expect(plan.planKey).toBe("pro");
    expect(plan.pricingRegion).toBe("NZ");
  });

  it("falls back to the lookup key when the price ID is not yet recorded", async () => {
    const plan = await resolveTrustedPlanForPrice(
      admin,
      {
        id: "price_unrecorded",
        lookup_key: "business_annual_gbp",
        currency: "gbp",
        unit_amount: 39000,
      },
      "live",
    );
    expect(plan.planKey).toBe("business");
    expect(plan.billingInterval).toBe("annual");
  });

  it("accepts the legacy lovable_external_id metadata", async () => {
    const plan = await resolveTrustedPlanForPrice(
      admin,
      { id: "price_legacy", metadata: { lovable_external_id: "business_annual_gbp" } },
      "live",
    );
    expect(plan.planKey).toBe("business");
  });

  it("never infers a plan from a price-ID prefix", async () => {
    await expect(
      resolveTrustedPlanForPrice(admin, { id: "price_business_something" }, "live"),
    ).rejects.toBeInstanceOf(UnknownStripePriceError);
  });

  it("throws instead of silently downgrading an unknown price to free", async () => {
    await expect(
      resolveTrustedPlanForPrice(
        admin,
        { id: "price_unknown", lookup_key: "mystery_plan" },
        "live",
      ),
    ).rejects.toThrow(/BILLING_CONFIG_ERROR/);
  });

  it("rejects a currency that disagrees with the trusted mapping", async () => {
    await expect(
      resolveTrustedPlanForPrice(
        admin,
        { id: "price_live_pro_nzd", currency: "usd", unit_amount: 2900 },
        "live",
      ),
    ).rejects.toBeInstanceOf(UnknownStripePriceError);
  });

  it("rejects an amount that disagrees with the trusted mapping", async () => {
    await expect(
      resolveTrustedPlanForPrice(
        admin,
        { id: "price_live_pro_nzd", currency: "nzd", unit_amount: 100 },
        "live",
      ),
    ).rejects.toBeInstanceOf(UnknownStripePriceError);
  });

  it("isolates environments: a live price is unknown in sandbox", async () => {
    await expect(
      resolveTrustedPlanForPrice(admin, { id: "price_live_pro_nzd" }, "sandbox"),
    ).rejects.toBeInstanceOf(UnknownStripePriceError);
    const sandbox = await resolveTrustedPlanForPrice(
      admin,
      { id: "price_test_pro_nzd" },
      "sandbox",
    );
    expect(sandbox.environment).toBe("sandbox");
  });

  it("ignores inactive mappings", async () => {
    expect(await findTrustedPriceByLookupKey(admin, "pro_monthly_old", "live")).toBeNull();
  });

  it("returns null for a lookup key that does not exist", async () => {
    expect(await findTrustedPriceByLookupKey(admin, "does_not_exist", "live")).toBeNull();
  });
});

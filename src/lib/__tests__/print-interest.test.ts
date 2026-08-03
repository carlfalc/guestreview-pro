import { describe, expect, it } from "vitest";
import {
  demandThresholds,
  isPrintInterestSource,
  isPrintProductKey,
  normalisePrintInterestSource,
  printInterestCsv,
  printProductLabel,
  summarisePrintDemand,
  PRINT_INTEREST_SOURCES,
  type AdminPrintInterestRow,
} from "../print-interest";

function row(overrides: Partial<AdminPrintInterestRow> = {}): AdminPrintInterestRow {
  return {
    id: "1",
    ownerId: "owner-1",
    businessId: "biz-1",
    businessName: "Glasshouse",
    businessIndustry: "restaurant",
    adminNotes: null,
    email: "a@example.com",
    countryCode: "GB",
    productKeys: ["vinyl_stickers", "counter_cards"],
    expectedQuantity: "50_99",
    preferredSize: "medium",
    preferredMaterial: "vinyl",
    desiredTimeframe: "this_month",
    comments: null,
    contactConsent: true,
    source: "marketing_pack",
    status: "new",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("print interest sources and products", () => {
  it("accepts every catalogued source", () => {
    for (const s of PRINT_INTEREST_SOURCES) expect(isPrintInterestSource(s)).toBe(true);
  });

  it("falls back to unknown for junk sources", () => {
    expect(normalisePrintInterestSource("nope")).toBe("unknown");
    expect(normalisePrintInterestSource(undefined)).toBe("unknown");
  });

  it("validates product keys and labels them", () => {
    expect(isPrintProductKey("vinyl_stickers")).toBe(true);
    expect(isPrintProductKey("spaceship")).toBe(false);
    expect(printProductLabel("counter_cards")).toBe("Counter cards");
  });
});

describe("summarisePrintDemand", () => {
  const rows = [
    row(),
    row({
      id: "2",
      ownerId: "owner-2",
      countryCode: "US",
      productKeys: ["vinyl_stickers"],
      contactConsent: false,
      status: "contacted",
      source: "dashboard",
    }),
    // Same owner submitting twice must not double-count accounts.
    row({ id: "3", productKeys: ["posters"] }),
  ];

  it("counts accounts, submissions and consent distinctly", () => {
    const s = summarisePrintDemand(rows);
    expect(s.totalAccounts).toBe(2);
    expect(s.totalSubmissions).toBe(3);
    expect(s.consentedAccounts).toBe(1);
  });

  it("ranks products and countries by demand", () => {
    const s = summarisePrintDemand(rows);
    expect(s.byProduct[0]?.key).toBe("vinyl_stickers");
    expect(s.byProduct[0]?.count).toBe(2);
    expect(s.byCountry.find((c) => c.key === "GB")?.count).toBe(2);
  });

  it("returns an empty, non-throwing shape with no rows", () => {
    const s = summarisePrintDemand([]);
    expect(s.totalAccounts).toBe(0);
    expect(s.byProduct).toEqual([]);
    expect(s.mostRequestedBundle).toBeNull();
  });
});

describe("demandThresholds", () => {
  it("reports nothing met with no demand", () => {
    expect(demandThresholds(summarisePrintDemand([])).every((t) => !t.met)).toBe(true);
  });

  it("meets the supplier-research threshold at 10 accounts", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ id: `r${i}`, ownerId: `o${i}` }));
    const t = demandThresholds(summarisePrintDemand(rows)).find(
      (x) => x.key === "research_supplier",
    );
    expect(t?.met).toBe(true);
    expect(t?.actual).toBe(10);
  });
});

describe("printInterestCsv", () => {
  it("emits a header row plus one row per record", () => {
    const lines = printInterestCsv([row(), row({ id: "2" })])
      .trim()
      .split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("email");
  });

  it("escapes values containing commas or quotes", () => {
    const csv = printInterestCsv([row({ comments: 'a,b "quoted"' })]);
    expect(csv).toContain('"a,b ""quoted"""');
  });
});

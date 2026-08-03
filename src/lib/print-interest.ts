// Print demand validation — pure, client-safe data and helpers.
//
// The Print Store backend exists but the customer-facing store is paused.
// This module models the waitlist form options, statuses and the internal
// decision thresholds used by the admin demand dashboard.

export const PRINT_INTEREST_PRODUCTS = [
  { key: "vinyl_stickers", label: "Vinyl QR stickers" },
  { key: "window_decals", label: "Window decals" },
  { key: "counter_cards", label: "Counter cards" },
  { key: "table_tents", label: "Table tents" },
  { key: "posters", label: "A4 or A5 posters" },
  { key: "hotel_room_cards", label: "Hotel room cards" },
  { key: "reception_signs", label: "Reception signs" },
  { key: "restaurant_pack", label: "Restaurant starter pack" },
  { key: "hotel_pack", label: "Hotel or motel starter pack" },
  { key: "cafe_pack", label: "Café starter pack" },
  { key: "retail_pack", label: "Retail starter pack" },
  { key: "acrylic_stand", label: "Acrylic counter stand" },
  { key: "other", label: "Other" },
] as const;

export type PrintInterestProductKey = (typeof PRINT_INTEREST_PRODUCTS)[number]["key"];

const PRODUCT_KEYS = new Set(PRINT_INTEREST_PRODUCTS.map((p) => p.key as string));

export function isPrintProductKey(value: unknown): value is PrintInterestProductKey {
  return typeof value === "string" && PRODUCT_KEYS.has(value);
}

export function printProductLabel(key: string): string {
  return PRINT_INTEREST_PRODUCTS.find((p) => p.key === key)?.label ?? key;
}

/** Bundle-style products, used for the "most requested bundle" metric. */
export const PRINT_BUNDLE_KEYS: readonly string[] = [
  "restaurant_pack",
  "hotel_pack",
  "cafe_pack",
  "retail_pack",
];

export const PRINT_QUANTITY_OPTIONS = [
  "1-25",
  "26-50",
  "51-100",
  "101-250",
  "251-500",
  "500+",
  "Not sure yet",
] as const;

export const PRINT_SIZE_OPTIONS = [
  "Small (up to 50mm)",
  "Medium (50-100mm)",
  "Large (A5)",
  "Extra large (A4 or bigger)",
  "Mixed sizes",
  "Not sure yet",
] as const;

export const PRINT_MATERIAL_OPTIONS = [
  "Vinyl sticker",
  "Laminated card",
  "Recycled card",
  "Acrylic",
  "Weatherproof outdoor",
  "Not sure yet",
] as const;

export const PRINT_TIMEFRAME_OPTIONS = [
  "As soon as possible",
  "Within 1 month",
  "Within 3 months",
  "Within 6 months",
  "Just exploring",
] as const;

export const PRINT_INTEREST_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "converted",
  "not_interested",
  "archived",
] as const;

export type PrintInterestStatus = (typeof PRINT_INTEREST_STATUSES)[number];

export const PRINT_INTEREST_STATUS_LABEL: Record<PrintInterestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  converted: "Converted",
  not_interested: "Not interested",
  archived: "Archived",
};

export function isPrintInterestStatus(value: unknown): value is PrintInterestStatus {
  return (
    typeof value === "string" && (PRINT_INTEREST_STATUSES as readonly string[]).includes(value)
  );
}

/** Where the waitlist form was opened from. Recorded as an analytics dimension. */
export const PRINT_INTEREST_SOURCES = [
  "marketing_pack",
  "placement_plan",
  "qr_export",
  "dashboard",
  "print_store",
  "unknown",
] as const;

export type PrintInterestSource = (typeof PRINT_INTEREST_SOURCES)[number];

export function isPrintInterestSource(value: unknown): value is PrintInterestSource {
  return typeof value === "string" && (PRINT_INTEREST_SOURCES as readonly string[]).includes(value);
}

export function normalisePrintInterestSource(value: unknown): PrintInterestSource {
  return isPrintInterestSource(value) ? value : "unknown";
}

export interface PrintInterestRecord {
  id: string;
  businessId: string | null;
  email: string;
  countryCode: string | null;
  productKeys: string[];
  expectedQuantity: string | null;
  preferredSize: string | null;
  preferredMaterial: string | null;
  desiredTimeframe: string | null;
  comments: string | null;
  contactConsent: boolean;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPrintInterestRow extends PrintInterestRecord {
  ownerId: string;
  businessName: string | null;
  businessIndustry: string | null;
  adminNotes: string | null;
}

export interface DemandCount {
  key: string;
  label: string;
  count: number;
}

export interface PrintDemandSummary {
  totalAccounts: number;
  totalSubmissions: number;
  consentedAccounts: number;
  byProduct: DemandCount[];
  byCountry: DemandCount[];
  byQuantity: DemandCount[];
  byTimeframe: DemandCount[];
  byIndustry: DemandCount[];
  byStatus: DemandCount[];
  mostRequestedBundle: DemandCount | null;
}

function tally(
  rows: readonly AdminPrintInterestRow[],
  pick: (row: AdminPrintInterestRow) => string[] | string | null,
  label: (key: string) => string = (k) => k,
): DemandCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = pick(row);
    const keys = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Aggregate demand entirely from the raw rows — no separate counters to drift. */
export function summarisePrintDemand(rows: readonly AdminPrintInterestRow[]): PrintDemandSummary {
  const owners = new Set(rows.map((r) => r.ownerId));
  const byProduct = tally(rows, (r) => r.productKeys, printProductLabel);
  const bundles = byProduct.filter((p) => PRINT_BUNDLE_KEYS.includes(p.key));
  return {
    totalAccounts: owners.size,
    totalSubmissions: rows.length,
    consentedAccounts: new Set(rows.filter((r) => r.contactConsent).map((r) => r.ownerId)).size,
    byProduct,
    byCountry: tally(rows, (r) => r.countryCode),
    byQuantity: tally(rows, (r) => r.expectedQuantity),
    byTimeframe: tally(rows, (r) => r.desiredTimeframe),
    byIndustry: tally(rows, (r) => r.businessIndustry),
    byStatus: tally(rows, (r) => r.status, (k) =>
      isPrintInterestStatus(k) ? PRINT_INTEREST_STATUS_LABEL[k] : k,
    ),
    mostRequestedBundle: bundles[0] ?? null,
  };
}

export interface DemandThreshold {
  key: string;
  title: string;
  detail: string;
  target: number;
  actual: number;
  met: boolean;
}

/**
 * Internal planning aids only — never rendered to customers.
 */
export function demandThresholds(summary: PrintDemandSummary): DemandThreshold[] {
  const topProduct = summary.byProduct[0];
  const topCountry = summary.byCountry[0];
  return [
    {
      key: "research_supplier",
      title: "Research supplier pricing",
      detail: "10 interested accounts",
      target: 10,
      actual: summary.totalAccounts,
      met: summary.totalAccounts >= 10,
    },
    {
      key: "prepare_pilot",
      title: "Prepare a pilot product",
      detail: topProduct
        ? `25 accounts for one product — top: ${topProduct.label}`
        : "25 accounts for one product",
      target: 25,
      actual: topProduct?.count ?? 0,
      met: (topProduct?.count ?? 0) >= 25,
    },
    {
      key: "full_ui",
      title: "Prioritise the full customer store UI",
      detail: "50 interested accounts",
      target: 50,
      actual: summary.totalAccounts,
      met: summary.totalAccounts >= 50,
    },
    {
      key: "regional_printer",
      title: "Consider a regional printer pilot",
      detail: topCountry
        ? `15 accounts in one country — top: ${topCountry.label}`
        : "15 accounts in one country",
      target: 15,
      actual: topCountry?.count ?? 0,
      met: (topCountry?.count ?? 0) >= 15,
    },
  ];
}

export interface PrintDemandFunnelStep {
  step: string;
  label: string;
  accounts: number;
}

/** CSV export for the admin dashboard. Kept pure so it is unit testable. */
export function printInterestCsv(rows: readonly AdminPrintInterestRow[]): string {
  const header = [
    "created_at",
    "email",
    "business",
    "industry",
    "country",
    "products",
    "expected_quantity",
    "preferred_size",
    "preferred_material",
    "timeframe",
    "contact_consent",
    "source",
    "status",
    "comments",
  ];
  const escape = (value: string | null | undefined) => {
    const v = value ?? "";
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = rows.map((r) =>
    [
      r.createdAt,
      r.email,
      r.businessName,
      r.businessIndustry,
      r.countryCode,
      r.productKeys.map(printProductLabel).join(" | "),
      r.expectedQuantity,
      r.preferredSize,
      r.preferredMaterial,
      r.desiredTimeframe,
      r.contactConsent ? "yes" : "no",
      r.source,
      r.status,
      r.comments,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

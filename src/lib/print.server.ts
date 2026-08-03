// Server-only Print Store data layer. Never imported by client code.
//
// Everything a customer could tamper with — prices, discounts, margins, order
// numbers, fulfilment cost — is resolved here from database state.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PricingRegion } from "./regions";
import { asJsonObject, type JsonObject } from "./json";
import type { PlanTierKey } from "./entitlements";
import type { StripeEnvName } from "./entitlements.server";
import {
  type PrintBundleDTO,
  type PrintCategory,
  type PrintProductDTO,
  type PrintShape,
  type PrintVariantAdminDTO,
  type PrintVariantDTO,
  type ShippingClass,
} from "./print-catalogue";
import {
  computeCartTotals,
  convertBaseMinor,
  marginFor,
  printCurrencyFor,
  publicTotals,
  type CartPricingLine,
  type CartTotals,
} from "./print-pricing";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : Number(v ?? fallback) || 0);

/* -------------------------------------------------------------------------- */
/* Account context                                                            */
/* -------------------------------------------------------------------------- */

export interface PrintAccountContext {
  ownerId: string;
  region: PricingRegion;
  countryCode: string;
  currency: string;
  plan: PlanTierKey;
  environment: StripeEnvName;
}

/**
 * Locked region + authoritative plan for the signed-in account. The customer
 * cannot pick a currency: it follows the region assigned at first login.
 */
export async function printAccountContext(
  admin: Db,
  ownerId: string,
  environment: StripeEnvName,
): Promise<PrintAccountContext> {
  const { data: region, error } = await admin
    .from("account_regions")
    .select("pricing_region, country_code")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const pricingRegion = (str((region as Row | null)?.pricing_region, "NZ") ||
    "NZ") as PricingRegion;
  const countryCode = str((region as Row | null)?.country_code, "NZ") || "NZ";

  const { getAccountPlan } = await import("./entitlements.server");
  const plan = await getAccountPlan(admin as never, ownerId, environment);

  return {
    ownerId,
    region: pricingRegion,
    countryCode,
    currency: printCurrencyFor(pricingRegion),
    plan,
    environment,
  };
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

function mapVariant(row: Row, region: PricingRegion): PrintVariantDTO {
  return {
    id: str(row.id),
    variantKey: str(row.variant_key),
    label: str(row.label),
    quantity: num(row.quantity, 1),
    priceMinor: convertBaseMinor(num(row.retail_price_minor), region),
    currency: printCurrencyFor(region),
    active: row.active !== false,
  };
}

function mapProduct(row: Row, region: PricingRegion): PrintProductDTO {
  const variants = ((row.print_product_variants as Row[] | undefined) ?? [])
    .filter((v) => v.active !== false)
    .sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((v) => mapVariant(v, region));
  return {
    id: str(row.id),
    productKey: str(row.product_key),
    slug: str(row.slug),
    name: str(row.name),
    description: str(row.description),
    category: str(row.category, "sticker") as PrintCategory,
    shape: str(row.shape, "square") as PrintShape,
    material: str(row.material),
    finish: str(row.finish),
    artworkFormat: str(row.artwork_format, "pdf"),
    widthMm: num(row.width_mm),
    heightMm: num(row.height_mm),
    bleedMm: num(row.bleed_mm, 3),
    safeAreaMm: num(row.safe_area_mm, 4),
    minQrMm: num(row.min_qr_mm, 25),
    printSides: num(row.print_sides, 1),
    formatId: (row.format_id as string | null) ?? null,
    productionDaysMin: num(row.production_days_min, 2),
    productionDaysMax: num(row.production_days_max, 5),
    shippingClass: str(row.shipping_class, "parcel") as ShippingClass,
    supportedCountries: (row.supported_countries as string[] | null) ?? ["*"],
    active: row.active !== false,
    variants,
  };
}

const PRODUCT_SELECT =
  "*, print_product_variants(id, variant_key, label, quantity, retail_price_minor, fulfilment_cost_minor, active, sort_order)";

export async function loadCatalogue(
  admin: Db,
  region: PricingRegion,
  opts: { includeInactive?: boolean } = {},
): Promise<PrintProductDTO[]> {
  let query = admin.from("print_products").select(PRODUCT_SELECT).order("sort_order");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data as Row[] | null) ?? []).map((r) => mapProduct(r, region));
}

/** Admin catalogue view — adds supplier cost and live margin per variant. */
export async function loadAdminCatalogue(
  admin: Db,
  region: PricingRegion,
): Promise<Array<PrintProductDTO & { variants: PrintVariantAdminDTO[] }>> {
  const { data, error } = await admin
    .from("print_products")
    .select(PRODUCT_SELECT)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return ((data as Row[] | null) ?? []).map((row) => {
    const product = mapProduct(row, region);
    const raw = ((row.print_product_variants as Row[] | undefined) ?? []).sort(
      (a, b) => num(a.sort_order) - num(b.sort_order),
    );
    const variants: PrintVariantAdminDTO[] = raw.map((v) => {
      const dto = mapVariant(v, region);
      const cost = convertBaseMinor(num(v.fulfilment_cost_minor), region);
      const margin = marginFor(dto.priceMinor, cost);
      return {
        ...dto,
        fulfilmentCostMinor: cost,
        marginMinor: margin.marginMinor,
        marginPercent: margin.marginPercent,
      };
    });
    return { ...product, variants };
  });
}

export async function loadBundles(
  admin: Db,
  opts: { includeInactive?: boolean } = {},
): Promise<PrintBundleDTO[]> {
  let query = admin
    .from("print_bundles")
    .select(
      "*, print_bundle_items(id, label, quantity, sort_order, product_id, variant_id, print_products(product_key, name), print_product_variants(label))",
    )
    .order("sort_order");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data as Row[] | null) ?? []).map((row) => ({
    id: str(row.id),
    bundleKey: str(row.bundle_key),
    slug: str(row.slug),
    name: str(row.name),
    description: str(row.description),
    industry: (row.industry as string | null) ?? null,
    discountPercent: num(row.discount_percent),
    active: row.active !== false,
    items: ((row.print_bundle_items as Row[] | undefined) ?? [])
      .sort((a, b) => num(a.sort_order) - num(b.sort_order))
      .map((item) => ({
        id: str(item.id),
        productId: str(item.product_id),
        productKey: str((item.print_products as Row | null)?.product_key),
        productName: str((item.print_products as Row | null)?.name),
        variantId: (item.variant_id as string | null) ?? null,
        variantLabel: ((item.print_product_variants as Row | null)?.label as string) ?? null,
        label: str(item.label),
        quantity: num(item.quantity, 1),
      })),
  }));
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                       */
/* -------------------------------------------------------------------------- */

export interface CartItemDTO {
  id: string;
  productId: string;
  productKey: string;
  productName: string;
  productSlug: string;
  shippingClass: ShippingClass;
  variantId: string;
  variantLabel: string;
  bundleId: string | null;
  bundleGroup: string | null;
  businessId: string;
  businessName: string;
  qrCodeId: string;
  qrLabel: string;
  campaign: string | null;
  quantity: number;
  unitRetailMinor: number;
  lineTotalMinor: number;
  currency: string;
  validationStatus: "pass" | "warning" | "error";
  warningsAcknowledged: boolean;
  proofId: string | null;
  approvedAt: string | null;
  artworkVersion: number;
  design: JsonObject;
}

export interface CartDTO {
  id: string;
  currency: string;
  region: PricingRegion;
  items: CartItemDTO[];
  totals: ReturnType<typeof publicTotals>;
  /** Every item has an approved proof and no blocking validation. */
  readyForPayment: boolean;
  blockingReasons: string[];
}

const CART_ITEM_SELECT =
  "*, print_products(product_key, name, slug, shipping_class), print_product_variants(label), businesses(name), qr_codes(label, short_code)";

/** Fetch (or lazily create) the account's single open cart. */
export async function getOrCreateCart(
  admin: Db,
  ctx: PrintAccountContext,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("print_carts")
    .select("id, currency_code, pricing_region")
    .eq("owner_id", ctx.ownerId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const row = data as Row;
    // Keep a stale cart aligned with the account's locked region.
    if (str(row.pricing_region) !== ctx.region || str(row.currency_code) !== ctx.currency) {
      await admin
        .from("print_carts")
        .update({ pricing_region: ctx.region, currency_code: ctx.currency })
        .eq("id", str(row.id));
    }
    return { id: str(row.id) };
  }
  const { data: created, error: insertError } = await admin
    .from("print_carts")
    .insert({
      owner_id: ctx.ownerId,
      status: "open",
      currency_code: ctx.currency,
      pricing_region: ctx.region,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return { id: str((created as Row).id) };
}

function mapCartItem(row: Row): CartItemDTO {
  const product = (row.print_products as Row | null) ?? {};
  const qr = (row.qr_codes as Row | null) ?? {};
  const quantity = num(row.quantity, 1);
  const unit = num(row.unit_retail_minor);
  return {
    id: str(row.id),
    productId: str(row.product_id),
    productKey: str(product.product_key),
    productName: str(product.name),
    productSlug: str(product.slug),
    shippingClass: str(product.shipping_class, "parcel") as ShippingClass,
    variantId: str(row.variant_id),
    variantLabel: str((row.print_product_variants as Row | null)?.label),
    bundleId: (row.bundle_id as string | null) ?? null,
    bundleGroup: (row.bundle_group as string | null) ?? null,
    businessId: str(row.business_id),
    businessName: str((row.businesses as Row | null)?.name),
    qrCodeId: str(row.qr_code_id),
    qrLabel: str(qr.label) || str(qr.short_code),
    campaign: (row.campaign as string | null) ?? null,
    quantity,
    unitRetailMinor: unit,
    lineTotalMinor: unit * quantity,
    currency: str(row.currency_code, "NZD"),
    validationStatus: str(row.validation_status, "error") as CartItemDTO["validationStatus"],
    warningsAcknowledged: row.warnings_acknowledged === true,
    proofId: (row.proof_id as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    artworkVersion: num(row.artwork_version, 1),
    design: asJsonObject(row.design),
  };
}

export async function loadCartRows(admin: Db, cartId: string): Promise<Row[]> {
  const { data, error } = await admin
    .from("print_cart_items")
    .select(CART_ITEM_SELECT)
    .eq("cart_id", cartId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data as Row[] | null) ?? [];
}

export function pricingLines(rows: Row[]): CartPricingLine[] {
  return rows.map((row) => ({
    quantity: num(row.quantity, 1),
    unitRetailMinor: num(row.unit_retail_minor),
    unitCostMinor: num(row.unit_cost_minor),
    shippingClass: str(
      (row.print_products as Row | null)?.shipping_class,
      "parcel",
    ) as ShippingClass,
    bundleId: (row.bundle_id as string | null) ?? null,
  }));
}

/** Internal totals, including supplier cost and margin. Admin/server only. */
export async function cartTotalsInternal(
  admin: Db,
  cartId: string,
  ctx: PrintAccountContext,
): Promise<{ rows: Row[]; totals: CartTotals }> {
  const rows = await loadCartRows(admin, cartId);
  return { rows, totals: computeCartTotals(pricingLines(rows), ctx.region, ctx.plan) };
}

export async function buildCartDTO(admin: Db, ctx: PrintAccountContext): Promise<CartDTO> {
  const cart = await getOrCreateCart(admin, ctx);
  const { rows, totals } = await cartTotalsInternal(admin, cart.id, ctx);
  const items = rows.map(mapCartItem);

  const blockingReasons: string[] = [];
  for (const item of items) {
    if (item.validationStatus === "error") {
      blockingReasons.push(`${item.productName} has artwork problems that must be fixed.`);
    } else if (item.validationStatus === "warning" && !item.warningsAcknowledged) {
      blockingReasons.push(`${item.productName} has warnings that need acknowledging.`);
    }
    if (!item.approvedAt) {
      blockingReasons.push(`${item.productName} is waiting for proof approval.`);
    }
  }

  return {
    id: cart.id,
    currency: ctx.currency,
    region: ctx.region,
    items,
    totals: publicTotals(totals),
    readyForPayment: items.length > 0 && blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
  };
}

/* -------------------------------------------------------------------------- */
/* Ownership guards                                                           */
/* -------------------------------------------------------------------------- */

/** Confirm a business + QR pair belongs to the account and belong together. */
export async function assertArtworkOwnership(
  admin: Db,
  ownerId: string,
  businessId: string,
  qrCodeId: string,
): Promise<{ business: Row; qr: Row }> {
  const { data: business, error: bErr } = await admin
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!business) throw new Error("That business could not be found on your account.");

  const { data: qr, error: qErr } = await admin
    .from("qr_codes")
    .select("*")
    .eq("id", qrCodeId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!qr) throw new Error("That QR code could not be found on your account.");
  if (str((qr as Row).business_id) !== businessId) {
    throw new Error("That QR code belongs to a different business.");
  }
  return { business: business as Row, qr: qr as Row };
}

/** Variant + product pair, validated against each other. */
export async function loadVariantForProduct(
  admin: Db,
  productId: string,
  variantId: string,
): Promise<{ product: Row; variant: Row }> {
  const { data: product, error: pErr } = await admin
    .from("print_products")
    .select("*")
    .eq("id", productId)
    .eq("active", true)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!product) throw new Error("That product is not available.");

  const { data: variant, error: vErr } = await admin
    .from("print_product_variants")
    .select("*")
    .eq("id", variantId)
    .eq("product_id", productId)
    .eq("active", true)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!variant) throw new Error("That quantity option is not available.");
  return { product: product as Row, variant: variant as Row };
}

/* -------------------------------------------------------------------------- */
/* Order events                                                               */
/* -------------------------------------------------------------------------- */

export async function recordOrderEvent(
  admin: Db,
  args: {
    orderId: string;
    ownerId: string;
    eventType: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    note?: string | null;
    visibility?: "customer" | "internal";
    actorId?: string | null;
  },
): Promise<void> {
  await admin.from("print_order_events").insert({
    order_id: args.orderId,
    owner_id: args.ownerId,
    event_type: args.eventType,
    previous_status: args.previousStatus ?? null,
    new_status: args.newStatus ?? null,
    note: args.note ?? null,
    visibility: args.visibility ?? "customer",
    actor_id: args.actorId ?? null,
  });
}

export { convertBaseMinor };

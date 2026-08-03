// Print Store catalogue types and presentation helpers.
//
// The authoritative catalogue lives in the database (print_products,
// print_product_variants, print_bundles). This module is pure, client-safe
// data + helpers: it never reads fulfilment cost, which is admin-only.

export type PrintShape = "circular" | "square" | "portrait" | "landscape";
export type PrintCategory = "sticker" | "counter" | "poster" | "hotel" | "bundle";
export type ShippingClass = "letter" | "parcel" | "tube";

/** Product as seen by a customer. Fulfilment cost is deliberately absent. */
export interface PrintProductDTO {
  id: string;
  productKey: string;
  slug: string;
  name: string;
  description: string;
  category: PrintCategory;
  shape: PrintShape;
  material: string;
  finish: string;
  artworkFormat: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeAreaMm: number;
  minQrMm: number;
  printSides: number;
  formatId: string | null;
  productionDaysMin: number;
  productionDaysMax: number;
  shippingClass: ShippingClass;
  supportedCountries: string[];
  active: boolean;
  variants: PrintVariantDTO[];
}

export interface PrintVariantDTO {
  id: string;
  variantKey: string;
  label: string;
  quantity: number;
  /** Customer price in the account's currency, minor units. */
  priceMinor: number;
  currency: string;
  active: boolean;
}

/** Admin view adds supplier cost and the derived margin. */
export interface PrintVariantAdminDTO extends PrintVariantDTO {
  fulfilmentCostMinor: number;
  marginMinor: number;
  marginPercent: number;
}

export interface PrintBundleItemDTO {
  id: string;
  productId: string;
  productKey: string;
  productName: string;
  variantId: string | null;
  variantLabel: string | null;
  label: string;
  quantity: number;
}

export interface PrintBundleDTO {
  id: string;
  bundleKey: string;
  slug: string;
  name: string;
  description: string;
  industry: string | null;
  discountPercent: number;
  active: boolean;
  items: PrintBundleItemDTO[];
}

export const SHIPPING_CLASS_LABEL: Record<ShippingClass, string> = {
  letter: "Flat letter post",
  parcel: "Tracked parcel",
  tube: "Rigid tube",
};

export const CATEGORY_LABEL: Record<PrintCategory, string> = {
  sticker: "Stickers & decals",
  counter: "Counter cards",
  poster: "Posters",
  hotel: "Hotel & rooms",
  bundle: "Starter packs",
};

export function productionEstimate(p: {
  productionDaysMin: number;
  productionDaysMax: number;
}): string {
  return p.productionDaysMin === p.productionDaysMax
    ? `${p.productionDaysMin} working days`
    : `${p.productionDaysMin}–${p.productionDaysMax} working days`;
}

/**
 * A product may be shipped to a country when the catalogue allows everywhere
 * ("*") or explicitly lists the ISO code.
 */
export function shipsTo(product: { supportedCountries: string[] }, countryCode: string): boolean {
  const list = product.supportedCountries ?? [];
  if (!list.length || list.includes("*")) return true;
  return list.includes(countryCode.toUpperCase());
}

/** Cheapest live variant, used for the "from" price on catalogue tiles. */
export function fromPriceMinor(product: PrintProductDTO): number | null {
  const live = product.variants.filter((v) => v.active);
  if (!live.length) return null;
  return live.reduce((min, v) => Math.min(min, v.priceMinor), Number.POSITIVE_INFINITY);
}

/** Total physical pieces a bundle contains — used in bundle summaries. */
export function bundlePieceCount(bundle: PrintBundleDTO): number {
  return bundle.items.reduce((sum, item) => sum + item.quantity, 0);
}

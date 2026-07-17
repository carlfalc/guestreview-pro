// Central country + currency configuration.
// Every supported country maps to a pricing region and locale.
// Countries not listed here fall back to INTERNATIONAL / USD.

import { ISO_COUNTRY_NAMES } from "./country-names";


export type CurrencyCode =
  | "NZD" | "AUD" | "USD" | "CAD" | "GBP" | "EUR" | "SGD" | "HKD" | "JPY"
  | "KRW" | "INR" | "ZAR" | "AED" | "SAR" | "CHF" | "NOK" | "SEK" | "DKK"
  | "PLN" | "BRL" | "MXN" | "MYR" | "THB" | "PHP" | "IDR";

export type PricingRegion =
  | "NZ" | "AU" | "US" | "CA" | "GB" | "EU" | "SG" | "HK" | "JP" | "KR"
  | "IN" | "ZA" | "AE" | "SA" | "CH" | "NO" | "SE" | "DK" | "PL" | "BR"
  | "MX" | "MY" | "TH" | "PH" | "ID" | "INTERNATIONAL";

export interface RegionConfig {
  countryCode: string;
  countryName: string;
  currencyCode: CurrencyCode;
  currencyName: string;
  currencySymbol: string;
  locale: string;
  pricingRegion: PricingRegion;
  taxLabel: string;
  taxInclusiveDefault: boolean;
  taxNote: string;
  supported: boolean;
  fallbackRegion: PricingRegion;
}

const EU_TAX_NOTE = "VAT may apply based on your billing location.";
const US_TAX_NOTE = "Applicable taxes may be added at checkout.";
const CA_TAX_NOTE = "Applicable GST/HST/PST may be added at checkout.";
const NZ_TAX_NOTE = "Prices include GST where applicable.";
const AU_TAX_NOTE = "Prices include GST where applicable.";
const UK_TAX_NOTE = "Prices include VAT where applicable.";
const GENERIC_NOTE = "Applicable taxes may be added at checkout.";

function eu(countryCode: string, countryName: string, locale: string): RegionConfig {
  return {
    countryCode, countryName,
    currencyCode: "EUR", currencyName: "Euro", currencySymbol: "€",
    locale, pricingRegion: "EU",
    taxLabel: "VAT", taxInclusiveDefault: false, taxNote: EU_TAX_NOTE,
    supported: true, fallbackRegion: "EU",
  };
}

export const REGIONS: Record<string, RegionConfig> = {
  NZ: { countryCode: "NZ", countryName: "New Zealand", currencyCode: "NZD", currencyName: "New Zealand Dollar", currencySymbol: "NZ$", locale: "en-NZ", pricingRegion: "NZ", taxLabel: "GST", taxInclusiveDefault: true,  taxNote: NZ_TAX_NOTE, supported: true, fallbackRegion: "NZ" },
  AU: { countryCode: "AU", countryName: "Australia",  currencyCode: "AUD", currencyName: "Australian Dollar", currencySymbol: "A$",  locale: "en-AU", pricingRegion: "AU", taxLabel: "GST", taxInclusiveDefault: true,  taxNote: AU_TAX_NOTE, supported: true, fallbackRegion: "AU" },
  US: { countryCode: "US", countryName: "United States", currencyCode: "USD", currencyName: "US Dollar",    currencySymbol: "US$", locale: "en-US", pricingRegion: "US", taxLabel: "Sales tax", taxInclusiveDefault: false, taxNote: US_TAX_NOTE, supported: true, fallbackRegion: "US" },
  CA: { countryCode: "CA", countryName: "Canada",      currencyCode: "CAD", currencyName: "Canadian Dollar", currencySymbol: "CA$", locale: "en-CA", pricingRegion: "CA", taxLabel: "GST/HST", taxInclusiveDefault: false, taxNote: CA_TAX_NOTE, supported: true, fallbackRegion: "CA" },
  GB: { countryCode: "GB", countryName: "United Kingdom", currencyCode: "GBP", currencyName: "British Pound", currencySymbol: "£", locale: "en-GB", pricingRegion: "GB", taxLabel: "VAT", taxInclusiveDefault: true, taxNote: UK_TAX_NOTE, supported: true, fallbackRegion: "GB" },

  IE: eu("IE", "Ireland", "en-IE"),
  DE: eu("DE", "Germany", "de-DE"),
  FR: eu("FR", "France", "fr-FR"),
  ES: eu("ES", "Spain", "es-ES"),
  IT: eu("IT", "Italy", "it-IT"),
  NL: eu("NL", "Netherlands", "nl-NL"),
  BE: eu("BE", "Belgium", "nl-BE"),
  AT: eu("AT", "Austria", "de-AT"),
  PT: eu("PT", "Portugal", "pt-PT"),
  FI: eu("FI", "Finland", "fi-FI"),
  GR: eu("GR", "Greece", "el-GR"),

  SG: { countryCode: "SG", countryName: "Singapore",       currencyCode: "SGD", currencyName: "Singapore Dollar", currencySymbol: "S$", locale: "en-SG", pricingRegion: "SG", taxLabel: "GST", taxInclusiveDefault: true,  taxNote: "Prices include GST where applicable.", supported: true, fallbackRegion: "SG" },
  HK: { countryCode: "HK", countryName: "Hong Kong",       currencyCode: "HKD", currencyName: "Hong Kong Dollar", currencySymbol: "HK$", locale: "en-HK", pricingRegion: "HK", taxLabel: "Tax", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "HK" },
  JP: { countryCode: "JP", countryName: "Japan",           currencyCode: "JPY", currencyName: "Japanese Yen",     currencySymbol: "¥",   locale: "ja-JP", pricingRegion: "JP", taxLabel: "Consumption tax", taxInclusiveDefault: true, taxNote: "Prices include consumption tax where applicable.", supported: true, fallbackRegion: "JP" },
  KR: { countryCode: "KR", countryName: "South Korea",     currencyCode: "KRW", currencyName: "South Korean Won", currencySymbol: "₩",   locale: "ko-KR", pricingRegion: "KR", taxLabel: "VAT", taxInclusiveDefault: true,  taxNote: "Prices include VAT where applicable.", supported: true, fallbackRegion: "KR" },
  IN: { countryCode: "IN", countryName: "India",           currencyCode: "INR", currencyName: "Indian Rupee",     currencySymbol: "₹",   locale: "en-IN", pricingRegion: "IN", taxLabel: "GST", taxInclusiveDefault: true,  taxNote: "Prices include GST where applicable.", supported: true, fallbackRegion: "IN" },
  ZA: { countryCode: "ZA", countryName: "South Africa",    currencyCode: "ZAR", currencyName: "South African Rand", currencySymbol: "R", locale: "en-ZA", pricingRegion: "ZA", taxLabel: "VAT", taxInclusiveDefault: true, taxNote: "Prices include VAT where applicable.", supported: true, fallbackRegion: "ZA" },
  AE: { countryCode: "AE", countryName: "United Arab Emirates", currencyCode: "AED", currencyName: "UAE Dirham",  currencySymbol: "AED", locale: "en-AE", pricingRegion: "AE", taxLabel: "VAT", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "AE" },
  SA: { countryCode: "SA", countryName: "Saudi Arabia",    currencyCode: "SAR", currencyName: "Saudi Riyal",      currencySymbol: "SAR", locale: "ar-SA", pricingRegion: "SA", taxLabel: "VAT", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "SA" },
  CH: { countryCode: "CH", countryName: "Switzerland",     currencyCode: "CHF", currencyName: "Swiss Franc",      currencySymbol: "CHF", locale: "de-CH", pricingRegion: "CH", taxLabel: "VAT", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "CH" },
  NO: { countryCode: "NO", countryName: "Norway",          currencyCode: "NOK", currencyName: "Norwegian Krone",  currencySymbol: "kr",  locale: "nb-NO", pricingRegion: "NO", taxLabel: "VAT", taxInclusiveDefault: true,  taxNote: "Prices include VAT where applicable.", supported: true, fallbackRegion: "NO" },
  SE: { countryCode: "SE", countryName: "Sweden",          currencyCode: "SEK", currencyName: "Swedish Krona",    currencySymbol: "kr",  locale: "sv-SE", pricingRegion: "SE", taxLabel: "VAT", taxInclusiveDefault: true,  taxNote: "Prices include VAT where applicable.", supported: true, fallbackRegion: "SE" },
  DK: { countryCode: "DK", countryName: "Denmark",         currencyCode: "DKK", currencyName: "Danish Krone",     currencySymbol: "kr",  locale: "da-DK", pricingRegion: "DK", taxLabel: "VAT", taxInclusiveDefault: true,  taxNote: "Prices include VAT where applicable.", supported: true, fallbackRegion: "DK" },
  PL: { countryCode: "PL", countryName: "Poland",          currencyCode: "PLN", currencyName: "Polish Zloty",     currencySymbol: "zł",  locale: "pl-PL", pricingRegion: "PL", taxLabel: "VAT", taxInclusiveDefault: true,  taxNote: "Prices include VAT where applicable.", supported: true, fallbackRegion: "PL" },
  BR: { countryCode: "BR", countryName: "Brazil",          currencyCode: "BRL", currencyName: "Brazilian Real",   currencySymbol: "R$",  locale: "pt-BR", pricingRegion: "BR", taxLabel: "Tax", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "BR" },
  MX: { countryCode: "MX", countryName: "Mexico",          currencyCode: "MXN", currencyName: "Mexican Peso",     currencySymbol: "MX$", locale: "es-MX", pricingRegion: "MX", taxLabel: "IVA", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "MX" },
  MY: { countryCode: "MY", countryName: "Malaysia",        currencyCode: "MYR", currencyName: "Malaysian Ringgit", currencySymbol: "RM", locale: "ms-MY", pricingRegion: "MY", taxLabel: "SST", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "MY" },
  TH: { countryCode: "TH", countryName: "Thailand",        currencyCode: "THB", currencyName: "Thai Baht",        currencySymbol: "฿",   locale: "th-TH", pricingRegion: "TH", taxLabel: "VAT", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "TH" },
  PH: { countryCode: "PH", countryName: "Philippines",     currencyCode: "PHP", currencyName: "Philippine Peso",  currencySymbol: "₱",   locale: "en-PH", pricingRegion: "PH", taxLabel: "VAT", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "PH" },
  ID: { countryCode: "ID", countryName: "Indonesia",       currencyCode: "IDR", currencyName: "Indonesian Rupiah", currencySymbol: "Rp", locale: "id-ID", pricingRegion: "ID", taxLabel: "VAT", taxInclusiveDefault: false, taxNote: GENERIC_NOTE, supported: true, fallbackRegion: "ID" },
};

export const INTERNATIONAL_FALLBACK: RegionConfig = {
  countryCode: "ZZ",
  countryName: "International",
  currencyCode: "USD",
  currencyName: "US Dollar",
  currencySymbol: "US$",
  locale: "en-US",
  pricingRegion: "INTERNATIONAL",
  taxLabel: "Tax",
  taxInclusiveDefault: false,
  taxNote: US_TAX_NOTE,
  supported: false,
  fallbackRegion: "INTERNATIONAL",
};

/** Returns the region config for a country code, or the international fallback (with the actual country retained). */
export function getRegionForCountry(countryCode: string | null | undefined): RegionConfig {
  if (!countryCode) return INTERNATIONAL_FALLBACK;
  const up = countryCode.toUpperCase();
  const cfg = REGIONS[up];
  if (cfg) return cfg;
  // Unsupported country: retain actual code + proper name, but use international pricing/currency.
  // Lazy import to avoid coupling regions.ts to the full ISO list at module load in tight loops.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ISO_COUNTRY_NAMES } = require("./country-names") as typeof import("./country-names");
  return {
    ...INTERNATIONAL_FALLBACK,
    countryCode: up,
    countryName: ISO_COUNTRY_NAMES[up] ?? up,
  };
}

export const SUPPORTED_COUNTRIES: RegionConfig[] = Object.values(REGIONS);

/** Zero-decimal currencies use 0 minor units. */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set(["JPY", "KRW", "IDR"]);


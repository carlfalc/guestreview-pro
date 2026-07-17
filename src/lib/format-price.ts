import { ZERO_DECIMAL_CURRENCIES, type CurrencyCode } from "./regions";

/**
 * Format an integer minor-unit amount for display.
 * Uses `currencyDisplay: "narrowSymbol"` where meaningful, but for
 * dollar-family currencies we prefer explicit qualifiers (NZ$, A$, US$,
 * CA$) to remove ambiguity. Handles zero-decimal currencies (JPY, KRW, IDR).
 */
export function formatRegionalPrice(
  amountMinor: number,
  currencyCode: CurrencyCode | string,
  locale = "en-US",
): string {
  const code = String(currencyCode).toUpperCase() as CurrencyCode;
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(code);
  const major = zeroDecimal ? amountMinor : amountMinor / 100;

  // Explicit qualifiers for ambiguous dollar-family currencies
  const explicit: Partial<Record<CurrencyCode, string>> = {
    NZD: "NZ$",
    AUD: "A$",
    USD: "US$",
    CAD: "CA$",
    SGD: "S$",
    HKD: "HK$",
    MXN: "MX$",
    BRL: "R$",
  };
  const prefix = explicit[code];

  const nf = new Intl.NumberFormat(locale, {
    style: prefix ? "decimal" : "currency",
    currency: prefix ? undefined : code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  });

  if (prefix) return `${prefix}${nf.format(major)}`;
  try {
    return nf.format(major);
  } catch {
    return `${code} ${major.toFixed(zeroDecimal ? 0 : 2)}`;
  }
}

/** Compact display: hides ".00" tail for whole-number amounts. */
export function formatRegionalPriceCompact(
  amountMinor: number,
  currencyCode: CurrencyCode | string,
  locale = "en-US",
): string {
  const full = formatRegionalPrice(amountMinor, currencyCode, locale);
  return full.replace(/([.,])00\b/, "");
}

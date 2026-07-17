import { formatRegionalPrice, formatRegionalPriceCompact } from "@/lib/format-price";
import { getRegionForCountry } from "@/lib/regions";
import type { AccountRegionDTO } from "@/lib/account-region.functions";
import { getRegionalPlanPrices, type PlanKey } from "@/lib/regional-pricing";

export function RegionalPrice({
  region,
  plan,
  compact = true,
  className,
}: {
  region: AccountRegionDTO | null | undefined;
  plan: PlanKey;
  compact?: boolean;
  className?: string;
}) {
  // Do not render prices until the account region is resolved.
  if (!region) return <span className={className}>—</span>;
  const config = getRegionForCountry(region.countryCode);
  const prices = getRegionalPlanPrices(region.pricingRegion as ReturnType<typeof getRegionForCountry>["pricingRegion"]);
  const p = prices[plan];
  const fmt = compact ? formatRegionalPriceCompact : formatRegionalPrice;
  return <span className={className}>{fmt(p.amountMinor, p.currency, config.locale)}</span>;
}

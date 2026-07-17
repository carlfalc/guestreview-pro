import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { getRegionForCountry } from "@/lib/regions";
import { getRegionalPlanPrices, PLAN_FEATURES, type PlanKey } from "@/lib/regional-pricing";
import { formatRegionalPriceCompact } from "@/lib/format-price";
import { BillingRegionBadge } from "./BillingRegionBadge";
import type { AccountRegionDTO } from "@/lib/account-region.functions";

export function RegionalPricingTable({ region }: { region: AccountRegionDTO }) {
  const config = getRegionForCountry(region.countryCode);
  const prices = getRegionalPlanPrices(region.pricingRegion as ReturnType<typeof getRegionForCountry>["pricingRegion"]);

  const rows: Array<{ tier: "free" | "pro" | "business"; monthly: PlanKey; annual: PlanKey | null }> = [
    { tier: "free",     monthly: "free",             annual: null },
    { tier: "pro",      monthly: "pro_monthly",      annual: "pro_annual" },
    { tier: "business", monthly: "business_monthly", annual: "business_annual" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pricing for {config.countryName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{config.taxNote}</p>
        </div>
        <BillingRegionBadge region={region} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((row) => {
          const feature = PLAN_FEATURES.find((p) => p.key === row.tier)!;
          const monthly = prices[row.monthly];
          const annual = row.annual ? prices[row.annual] : null;
          const monthlyFmt = formatRegionalPriceCompact(monthly.amountMinor, monthly.currency, config.locale);
          const annualFmt = annual ? formatRegionalPriceCompact(annual.amountMinor, annual.currency, config.locale) : null;
          const savingsPct = annual && monthly.amountMinor > 0
            ? Math.round((1 - annual.amountMinor / (monthly.amountMinor * 12)) * 100)
            : 0;

          return (
            <Card key={row.tier} className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
              <CardContent className="flex h-full flex-col p-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{feature.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.tagline}</p>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-tight">{monthlyFmt}</span>
                    {monthly.amountMinor > 0 && <span className="text-xs text-muted-foreground">/ month</span>}
                  </div>
                  {annualFmt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      or {annualFmt} / year{savingsPct > 0 ? ` — save ${savingsPct}%` : ""}
                    </p>
                  )}
                </div>
                <ul className="mt-5 space-y-2 text-sm">
                  {feature.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { getRegionForCountry } from "@/lib/regions";
import { getRegionalPlanPrices, PLAN_FEATURES, type PlanKey } from "@/lib/regional-pricing";
import { formatRegionalPriceCompact } from "@/lib/format-price";
import { BillingRegionBadge } from "./BillingRegionBadge";
import type { AccountRegionDTO } from "@/lib/account-region.functions";

/** Consistent annual-vs-monthly savings calculation. Returns null when the
 *  annual price is not lower than 12 × monthly (never claim a saving). */
function annualSavings(monthlyMinor: number, annualMinor: number) {
  if (monthlyMinor <= 0 || annualMinor <= 0) return null;
  const twelve = monthlyMinor * 12;
  if (annualMinor >= twelve) return null;
  const pct = Math.round((1 - annualMinor / twelve) * 100);
  const monthsFree = Math.round((twelve - annualMinor) / monthlyMinor);
  return { pct, monthsFree };
}

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
          <p className="mt-1 text-xs text-muted-foreground">
            Note: tax messaging shown here is presentation-only. Authoritative tax
            treatment (GST/VAT/sales tax) will apply once checkout is enabled.
          </p>
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
          const savings = annual ? annualSavings(monthly.amountMinor, annual.amountMinor) : null;

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
                    {monthly.amountMinor > 0 && (
                      <span className="text-xs text-muted-foreground">per month · billed monthly</span>
                    )}
                  </div>
                  {annualFmt && annual && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      or {annualFmt} per year · billed annually
                      {savings ? (
                        savings.monthsFree >= 2
                          ? ` — ${savings.monthsFree} months free`
                          : ` — save ${savings.pct}% compared with monthly billing`
                      ) : ""}
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

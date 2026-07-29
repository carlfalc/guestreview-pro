import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { getRegionForCountry } from "@/lib/regions";
import {
  getRegionalPlanPrices,
  PLAN_FEATURES,
  resolveBillablePlan,
  type PlanKey,
  type PlanTier,
  type PaidInterval,
} from "@/lib/regional-pricing";
import { formatRegionalPriceCompact } from "@/lib/format-price";
import { BillingRegionBadge } from "./BillingRegionBadge";
import { CheckoutDialog } from "./CheckoutDialog";
import { useBilling } from "@/hooks/use-billing";
import type { AccountRegionDTO } from "@/lib/account-region.functions";
import { useNavigate } from "@tanstack/react-router";

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
  const billing = useBilling();
  const navigate = useNavigate();
  const [interval, setInterval] = useState<PaidInterval>("monthly");
  const [checkout, setCheckout] = useState<PlanTier | null>(null);

  const fallback = resolveBillablePlan(
    region.pricingRegion as ReturnType<typeof getRegionForCountry>["pricingRegion"],
    "pro",
    interval,
  );

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
          {fallback.usesFallbackCurrency && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your local currency isn't billable yet — subscriptions in {config.countryName} are charged in
              US$ at the international rate.
            </p>
          )}
        </div>
        <BillingRegionBadge region={region} />
      </div>

      <div className="inline-flex rounded-full border border-border/70 p-1">
        {(["monthly", "annual"] as PaidInterval[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              interval === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {value === "monthly" ? "Monthly" : "Annual"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((row) => {
          const feature = PLAN_FEATURES.find((p) => p.key === row.tier)!;
          const monthly = prices[row.monthly];
          const annual = row.annual ? prices[row.annual] : null;
          const monthlyFmt = formatRegionalPriceCompact(monthly.amountMinor, monthly.currency, config.locale);
          const annualFmt = annual ? formatRegionalPriceCompact(annual.amountMinor, annual.currency, config.locale) : null;
          const savings = annual ? annualSavings(monthly.amountMinor, annual.amountMinor) : null;
          const isCurrent = billing.plan === row.tier;
          const paidTier = row.tier !== "free" ? (row.tier as PlanTier) : null;
          const billable = paidTier
            ? resolveBillablePlan(
                region.pricingRegion as ReturnType<typeof getRegionForCountry>["pricingRegion"],
                paidTier,
                interval,
              )
            : null;

          return (
            <Card
              key={row.tier}
              className={`rounded-3xl shadow-[var(--shadow-card)] ${
                row.tier === "pro" ? "border-primary/50" : "border-border/70"
              }`}
            >
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{feature.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{feature.tagline}</p>
                  </div>
                  {isCurrent && <Badge variant="secondary">Current plan</Badge>}
                  {!isCurrent && row.tier === "pro" && <Badge>Most popular</Badge>}
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
                  {billable && billable.usesFallbackCurrency && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Charged as {formatRegionalPriceCompact(billable.amountMinor, billable.currency, config.locale)}{" "}
                      {billable.interval === "annual" ? "per year" : "per month"}.
                    </p>
                  )}
                </div>

                {paidTier && (
                  <Button
                    className="mt-5"
                    disabled={isCurrent || !billing.paymentsConfigured}
                    onClick={() => setCheckout(paidTier)}
                  >
                    {isCurrent
                      ? "Your current plan"
                      : billing.isPaid
                        ? `Switch to ${feature.name}`
                        : `Upgrade to ${feature.name}`}
                  </Button>
                )}
                {!paidTier && (
                  <Button variant="outline" className="mt-5" disabled>
                    {isCurrent ? "Your current plan" : "Included"}
                  </Button>
                )}

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

      <p className="text-xs text-muted-foreground">
        Prices are set for your account region and cannot be changed manually. Taxes are calculated at
        checkout where applicable. Cancel any time — paid features stay available until the end of the
        billing period.
      </p>

      {checkout && (
        <CheckoutDialog
          open
          onOpenChange={(open) => !open && setCheckout(null)}
          tier={checkout}
          interval={interval}
          onAlreadySubscribed={() => {
            setCheckout(null);
            navigate({ to: "/billing" });
          }}
        />
      )}
    </div>
  );

}

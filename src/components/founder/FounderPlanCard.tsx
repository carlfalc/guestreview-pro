import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { formatRegionalPriceCompact } from "@/lib/format-price";
import { getRegionForCountry } from "@/lib/regions";
import type { AccountRegionDTO } from "@/lib/account-region.functions";
import type { PaidInterval } from "@/lib/regional-pricing";
import { PLAN_FEATURES } from "@/lib/regional-pricing";
import { FOUNDER_COPY, resolveFounderPlan, remainingLabel } from "@/lib/founder";
import { useFounderOffer, useMyFounderStatus } from "@/hooks/use-founder";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { useTrack } from "@/hooks/use-analytics";

/**
 * Founding Member Pro card for the signed-in pricing page.
 * Hidden once the programme is full or the account is no longer eligible —
 * pricing shown here is the same server-authoritative regional pricing used
 * at checkout.
 */
export function FounderPlanCard({ region }: { region: AccountRegionDTO }) {
  const offer = useFounderOffer();
  const status = useMyFounderStatus();
  const track = useTrack();
  const [interval, setInterval] = useState<PaidInterval>("monthly");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const remaining = status.data?.remaining ?? offer.data?.remaining ?? 0;
  const eligible = status.data?.eligible ?? false;
  if (!eligible || remaining <= 0) return null;

  const config = getRegionForCountry(region.countryCode);
  const plan = resolveFounderPlan(
    region.pricingRegion as ReturnType<typeof getRegionForCountry>["pricingRegion"],
    interval,
  );
  const proFeatures = PLAN_FEATURES.find((p) => p.key === "pro");

  return (
    <Card className="overflow-hidden rounded-3xl border-amber-400/40 bg-amber-400/[0.04]">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="gap-1.5 bg-amber-400/20 text-amber-300 hover:bg-amber-400/20">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {FOUNDER_COPY.eyebrow}
          </Badge>
          <span className="text-sm text-muted-foreground">{remainingLabel(remaining)}</span>
        </div>

        <div>
          <h3 className="text-2xl font-semibold tracking-tight">{FOUNDER_COPY.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything in Pro, at a permanently lower founder rate.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-border/70 p-1">
          {(["monthly", "annual"] as PaidInterval[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              aria-pressed={interval === value}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                interval === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-4xl font-semibold">
            {formatRegionalPriceCompact(plan.amountMinor, plan.currency, config.locale)}
          </span>
          <span className="text-sm text-muted-foreground">
            per {interval === "annual" ? "year" : "month"}
          </span>
          {plan.standardAmountMinor > plan.amountMinor && (
            <span className="text-sm text-muted-foreground">
              <s>
                {formatRegionalPriceCompact(plan.standardAmountMinor, plan.currency, config.locale)}
              </s>{" "}
              standard · save {plan.discountPercent}%
            </span>
          )}
        </div>

        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {FOUNDER_COPY.lockWording}.
        </p>

        {proFeatures && (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {proFeatures.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            track("founder_checkout_started", { interval, remaining });
            setCheckoutOpen(true);
          }}
        >
          Claim your founder place
        </Button>

        <ul className="space-y-1 text-xs text-muted-foreground">
          {FOUNDER_COPY.terms.map((term) => (
            <li key={term}>· {term}</li>
          ))}
        </ul>
      </CardContent>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        tier="pro"
        interval={interval}
        founder
      />
    </Card>
  );
}

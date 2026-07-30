import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBilling, useRefreshBilling } from "@/hooks/use-billing";
import { createCustomerPortalSession, getMyInvoices } from "@/lib/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { formatRegionalPrice } from "@/lib/format-price";
import { PLAN_FEATURES } from "@/lib/regional-pricing";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
  validateSearch: (search: Record<string, unknown>) => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing & subscription — GuestReview Pro" },
      { name: "description", content: "Manage your GuestReview Pro subscription, plan and invoices." },
      { property: "og:title", content: "Billing & subscription — GuestReview Pro" },
      { property: "og:description", content: "Manage your GuestReview Pro subscription, plan and invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  incomplete: "Awaiting payment",
  unpaid: "Unpaid",
  free: "Free plan",
};

function BillingPage() {
  const { checkout } = Route.useSearch();
  const billing = useBilling();
  const refresh = useRefreshBilling();
  const portal = useServerFn(createCustomerPortalSession);
  const fetchInvoices = useServerFn(getMyInvoices);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Webhooks land a moment after the redirect back from Stripe.
  useEffect(() => {
    if (checkout !== "complete") return;
    toast.success("Payment received — activating your plan…");
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(refresh, ms));
    return () => timers.forEach(clearTimeout);
  }, [checkout, refresh]);

  const invoices = useQuery({
    queryKey: ["billing-invoices"],
    enabled: billing.paymentsConfigured && Boolean(billing.subscription?.stripeCustomerId),
    queryFn: async () => (await fetchInvoices({ data: { environment: getStripeEnvironment() } })).invoices,
  });

  const sub = billing.subscription;
  const feature = PLAN_FEATURES.find((p) => p.key === billing.plan);

  const openPortal = async () => {
    setOpeningPortal(true);
    try {
      const result = await portal({
        data: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/billing` },
      });
      if (result.error || !result.url) throw new Error(result.error ?? "Portal unavailable.");
      window.open(result.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the billing portal.");
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing & subscription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your plan, renewal date and payment history. Pricing follows your locked account region.
        </p>
      </div>

      <UpgradeChecklist />
      <PlanPrioritiesCard />



      <Card className="rounded-3xl border-border/70">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold">{feature?.name ?? "Free"}</span>
            <Badge variant={billing.isPaid ? "default" : "secondary"}>
              {STATUS_LABEL[sub?.status ?? "free"] ?? sub?.status}
            </Badge>
            {sub?.cancelAtPeriodEnd && <Badge variant="outline">Cancels at period end</Badge>}
          </div>

          {sub && sub.amountMinor != null && sub.currencyCode && (
            <p className="text-sm text-muted-foreground">
              {formatRegionalPrice(sub.amountMinor, sub.currencyCode as never, undefined)} per{" "}
              {sub.billingInterval === "annual" ? "year" : "month"}
              {sub.currentPeriodEnd && (
                <> · {sub.cancelAtPeriodEnd ? "access until" : "renews"}{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString()}</>
              )}
            </p>
          )}

          {sub?.status === "past_due" && (
            <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              Your last payment failed. Update your card in the billing portal to keep your plan active — we
              retry automatically in the meantime.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button asChild variant={billing.isPaid ? "outline" : "default"}>
              <Link to="/pricing">{billing.isPaid ? "Change plan" : "Upgrade"}</Link>
            </Button>
            {sub?.stripeCustomerId && (
              <Button variant="outline" onClick={openPortal} disabled={openingPortal}>
                {openingPortal ? "Opening…" : "Manage payment & invoices"}
              </Button>
            )}
          </div>
          {sub?.stripeCustomerId && (
            <p className="text-xs text-muted-foreground">
              The billing portal opens in a new tab — card updates, cancellations and receipts live there.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Usage</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <UsageRow
              label="Businesses"
              used={billing.usage.businesses}
              max={billing.entitlements.businessesMax}
            />
            <UsageRow
              label="Active QR codes"
              used={billing.usage.activeQrCodes}
              max={billing.entitlements.activeQrCodesMax}
            />
          </div>
        </CardContent>
      </Card>

      {invoices.data && invoices.data.length > 0 && (
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Invoices</h2>
            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {invoices.data.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{inv.created ? new Date(inv.created).toLocaleDateString() : "—"}</span>
                  <span className="text-muted-foreground">{inv.status}</span>
                  <span>
                    {(inv.amountPaid / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: inv.currency,
                    })}
                  </span>
                  {inv.hostedInvoiceUrl && (
                    <a
                      className="text-primary underline"
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      View
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsageRow({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = !Number.isFinite(max);
  return (
    <div className="rounded-2xl border border-border/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">
        {used} <span className="text-sm font-normal text-muted-foreground">of {unlimited ? "unlimited" : max}</span>
      </p>
    </div>
  );
}

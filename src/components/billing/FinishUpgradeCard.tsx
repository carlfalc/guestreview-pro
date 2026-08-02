import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { getPendingCheckout, dismissPendingCheckout } from "@/lib/analytics.functions";
import { useBilling } from "@/hooks/use-billing";
import { useTrack } from "@/hooks/use-analytics";

/**
 * Abandoned-checkout recovery. Shows only when the account started a checkout
 * in the last 7 days, never completed it, and is still on the free plan.
 */
export function FinishUpgradeCard() {
  const fetchPending = useServerFn(getPendingCheckout);
  const dismissFn = useServerFn(dismissPendingCheckout);
  const { isPaid, paymentsConfigured } = useBilling();
  const track = useTrack();
  const qc = useQueryClient();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: pending } = useQuery({
    queryKey: ["pending-checkout"],
    queryFn: () => fetchPending(),
    enabled: paymentsConfigured && !isPaid,
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending-checkout"] }),
  });

  if (!pending || isPaid) return null;

  const planLabel = pending.planKey === "business" ? "Business" : "Pro";
  const intervalLabel = pending.billingInterval === "annual" ? "annual" : "monthly";

  return (
    <>
      <Card className="rounded-3xl border-primary/40 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <Clock className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Finish upgrading to {planLabel}</p>
            <p className="text-sm text-muted-foreground">
              You started a {intervalLabel} {planLabel} checkout on{" "}
              {new Date(pending.startedAt).toLocaleDateString()} but didn’t complete it. Pick up
              where you left off — nothing has been charged.
            </p>
          </div>
          <Button
            className="rounded-full"
            onClick={() => {
              track("upgrade_prompt_clicked", {
                source: "checkout_recovery",
                plan: pending.planKey,
              });
              setCheckoutOpen(true);
            }}
          >
            Finish upgrading
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={() => dismiss.mutate(pending.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        tier={pending.planKey}
        interval={pending.billingInterval}
      />
    </>
  );
}

import { useCallback, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSubscriptionCheckout } from "@/lib/billing.functions";
import type { PlanTier, PaidInterval } from "@/lib/regional-pricing";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: PlanTier;
  interval: PaidInterval;
  onAlreadySubscribed?: () => void;
}

export function CheckoutDialog({ open, onOpenChange, tier, interval, onAlreadySubscribed }: Props) {
  const createCheckout = useServerFn(createSubscriptionCheckout);
  const [failed, setFailed] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const result = await createCheckout({
      data: {
        tier,
        interval,
        environment: getStripeEnvironment(),
        returnUrl: `${window.location.origin}/billing?checkout=complete&session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if (result.alreadySubscribed) {
      onAlreadySubscribed?.();
      throw new Error("You already have an active subscription. Manage it from the billing page.");
    }
    if (result.error) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a checkout session.");
    return result.clientSecret;
  }, [createCheckout, tier, interval, onAlreadySubscribed]);

  // Stable options object — a new reference remounts the provider and Stripe
  // then throws "cannot change the client secret after creation".
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => {
        try {
          return await fetchClientSecret();
        } catch (e) {
          const message = e instanceof Error ? e.message : "Checkout could not be started.";
          setFailed(message);
          toast.error(message);
          throw e;
        }
      },
    }),
    [fetchClientSecret],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade to {tier === "pro" ? "Pro" : "Business"}</DialogTitle>
          <DialogDescription>
            Billed {interval === "annual" ? "annually" : "monthly"} in your account currency. Cancel any time.
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="py-8 text-center text-sm text-destructive">{failed}</p>
        ) : (
          <div id="checkout">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getStripe } from "@/lib/stripe";
import { createSubscriptionCheckout } from "@/lib/billing.functions";
import type { PlanTier, PaidInterval } from "@/lib/regional-pricing";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FOUNDER_COPY } from "@/lib/founder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: PlanTier;
  interval: PaidInterval;
  /** Ask the server to apply the founder price. Never trusted client-side. */
  founder?: boolean;
  onAlreadySubscribed?: () => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  tier,
  interval,
  founder = false,
  onAlreadySubscribed,
}: Props) {
  const createCheckout = useServerFn(createSubscriptionCheckout);
  const [failed, setFailed] = useState<string | null>(null);
  // Set when the founder offer sold out mid-checkout. Nothing is charged until
  // the customer explicitly accepts standard pricing.
  const [soldOut, setSoldOut] = useState<string | null>(null);
  const [acceptStandard, setAcceptStandard] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    // No environment and no return URL from the browser — the server decides
    // both from trusted configuration.
    const result = await createCheckout({
      data: {
        tier,
        interval,
        returnPath: "/billing",
        founder,
        acceptStandardIfSoldOut: acceptStandard,
      },
    });
    if (result.alreadySubscribed) {
      onAlreadySubscribed?.();
      throw new Error("You already have an active subscription. Manage it from the billing page.");
    }
    if (result.founderUnavailable) {
      setSoldOut(
        result.founderUnavailableReason === "already_founder"
          ? "Your account already holds a founder place."
          : FOUNDER_COPY.soldOut,
      );
      throw new Error("Founder offer unavailable");
    }
    if (result.error) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a checkout session.");
    return result.clientSecret;
  }, [createCheckout, tier, interval, founder, acceptStandard, onAlreadySubscribed]);

  // Stable options object — a new reference remounts the provider and Stripe
  // then throws "cannot change the client secret after creation".
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => {
        try {
          return await fetchClientSecret();
        } catch (e) {
          const message = e instanceof Error ? e.message : "Checkout could not be started.";
          if (message !== "Founder offer unavailable") {
            setFailed(message);
            toast.error(message);
          }
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
          <DialogTitle>
            {founder && !acceptStandard
              ? `Join as a ${FOUNDER_COPY.name}`
              : `Upgrade to ${tier === "pro" ? "Pro" : "Business"}`}
          </DialogTitle>
          <DialogDescription>
            Billed {interval === "annual" ? "annually" : "monthly"} in your account currency. Cancel
            any time.
          </DialogDescription>
        </DialogHeader>
        {soldOut ? (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{soldOut}</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Not now
              </Button>
              <Button
                onClick={() => {
                  setSoldOut(null);
                  setAcceptStandard(true);
                }}
              >
                Continue at the standard price
              </Button>
            </div>
          </div>
        ) : failed ? (
          <p className="py-8 text-center text-sm text-destructive">{failed}</p>
        ) : (
          <div id="checkout">
            <EmbeddedCheckoutProvider
              key={acceptStandard ? "standard" : "founder"}
              stripe={getStripe()}
              options={options}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBillingState, type AccountBillingState } from "@/lib/billing.functions";
import { paymentsConfigured } from "@/lib/stripe";
import { entitlementsFor, PLAN_ENTITLEMENTS } from "@/lib/entitlements";

const FALLBACK: AccountBillingState = {
  plan: "free",
  entitlements: PLAN_ENTITLEMENTS.free,
  usage: { businesses: 0, activeQrCodes: 0 },
  subscription: null,
  environment: "sandbox",
};

/**
 * Reads the server-authoritative plan. Client checks are UX only — every
 * privileged action re-verifies server-side, and the payment environment is
 * chosen by the server, never by this hook.
 */
export function useBilling() {
  const fetchState = useServerFn(getMyBillingState);
  const configured = paymentsConfigured();

  const query = useQuery<AccountBillingState>({
    queryKey: ["billing-state"],
    enabled: configured,
    queryFn: async () => await fetchState(),
    staleTime: 60_000,
  });

  const state = query.data ?? FALLBACK;
  return {
    ...query,
    plan: state.plan,
    entitlements: state.entitlements ?? entitlementsFor(state.plan),
    usage: state.usage,
    subscription: state.subscription,
    isPaid: state.plan !== "free",
    paymentsConfigured: configured,
  };
}

export function useRefreshBilling() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["billing-state"] });
}

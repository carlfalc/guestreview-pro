import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFounderOffer, getMyFounderStatus } from "@/lib/founder.functions";

/** Public, unauthenticated slot counter — safe on marketing pages. */
export function useFounderOffer() {
  const fetchOffer = useServerFn(getFounderOffer);
  return useQuery({
    queryKey: ["founder-offer"],
    queryFn: async () => await fetchOffer(),
    staleTime: 60_000,
  });
}

/** The signed-in account's founder place and eligibility. */
export function useMyFounderStatus() {
  const fetchStatus = useServerFn(getMyFounderStatus);
  return useQuery({
    queryKey: ["founder-status"],
    queryFn: async () => await fetchStatus(),
    staleTime: 30_000,
  });
}

export function useRefreshFounder() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["founder-status"] });
    void qc.invalidateQueries({ queryKey: ["founder-offer"] });
  };
}

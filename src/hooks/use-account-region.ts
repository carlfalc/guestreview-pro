import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getAccountRegion, resolveAccountRegion, type AccountRegionDTO } from "@/lib/account-region.functions";

/**
 * Loads the caller's account_regions row, auto-invoking the detection
 * server function on first login (when the row does not yet exist).
 * Cached via React Query so we don't geolocate on every page load.
 */
export function useAccountRegion() {
  const fetchRegion = useServerFn(getAccountRegion);
  const resolve = useServerFn(resolveAccountRegion);

  const q = useQuery<AccountRegionDTO | null>({
    queryKey: ["account-region"],
    queryFn: async () => await fetchRegion(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  useEffect(() => {
    if (!q.isSuccess) return;
    if (q.data) return;
    // First-login resolution
    (async () => {
      try {
        await resolve();
        await q.refetch();
      } catch {
        // Detection failure is handled by the fallback path server-side.
      }
    })();
  }, [q.isSuccess, q.data, q, resolve]);

  return q;
}

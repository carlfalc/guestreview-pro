import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAccountRegion, resolveAccountRegion, type AccountRegionDTO } from "@/lib/account-region.functions";

/**
 * Load the caller's account_regions row. If none exists yet, run the
 * first-login detection once via a mutation and store the returned row
 * directly in the cache — no second fetch, no effect-driven refetch loop.
 */
export function useAccountRegion() {
  const qc = useQueryClient();
  const fetchRegion = useServerFn(getAccountRegion);
  const resolve = useServerFn(resolveAccountRegion);

  const query = useQuery<AccountRegionDTO | null>({
    queryKey: ["account-region"],
    queryFn: async () => await fetchRegion(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  // Idempotent one-shot resolution. React Query dedupes concurrent identical
  // mutation calls via a stable key when we route through a mutation.
  const initial = useMutation({
    mutationKey: ["account-region", "initial-resolve"],
    mutationFn: async () => await resolve(),
    onSuccess: (dto) => {
      qc.setQueryData<AccountRegionDTO | null>(["account-region"], dto);
    },
  });

  if (query.isSuccess && query.data === null && !initial.isPending && !initial.isSuccess && !initial.isError) {
    // Fire-and-forget; mutation state prevents duplicates on re-render.
    initial.mutate();
  }

  return {
    ...query,
    isResolving: initial.isPending,
    resolveError: initial.error,
  };
}

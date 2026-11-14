import { MutationCache, QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    // The API runs on this machine, so a failed request won't succeed on a retry.
    defaultOptions: { queries: { retry: false } },
    mutationCache: new MutationCache({
      // One user and little data, so refreshing everything after a change is the simplest
      // way to keep every screen correct.
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  });
  return queryClient;
}

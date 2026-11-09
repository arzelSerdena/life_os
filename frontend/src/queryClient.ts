import { MutationCache, QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      // One user and little data, so refreshing everything after a change is the simplest
      // way to keep every screen correct.
      onSuccess: () => queryClient.invalidateQueries(),
    }),
  });
  return queryClient;
}

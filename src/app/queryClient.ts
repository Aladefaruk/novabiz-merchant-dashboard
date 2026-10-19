import { QueryClient } from '@tanstack/react-query';
import { ApiError, backoffDelay } from '../shared/api/client';

export function createQueryClient(opts: { test?: boolean } = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        // Low-end Android + metered data: don't refetch every time the tab regains focus.
        refetchOnWindowFocus: false,
        // Retry only what can succeed on retry (timeouts, network, 5xx, 429) with jittered backoff.
        retry: (failureCount, error) =>
          !opts.test && error instanceof ApiError && error.isRetryable && failureCount < 3,
        retryDelay: (attempt) => backoffDelay(attempt),
      },
    },
  });
}

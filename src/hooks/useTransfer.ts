import { notifyManager, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { ApiError, backoffDelay } from '../api/client';
import { api, mutationKeys, queryKeys } from '../api/endpoints';
import type { BalanceSummary, TransactionPage, TransferRequest, TransferResponse } from '../api/types';

/** One transfer intent. The idempotency key is created once per intent and reused on every retry. */
export interface TransferVariables extends TransferRequest {
  idempotencyKey: string;
  feeKobo: number;
}

/** What the UI shows while a transfer is in flight. No PIN in here. */
export interface PendingTransfer {
  idempotencyKey: string;
  amountKobo: number;
  feeKobo: number;
  accountName: string;
  narration: string;
}

const OUTBOX_KEY = ['transfer-outbox'] as const;
export const MAX_TRANSFER_ATTEMPTS = 3;

/** Tests set this to () => 0 so they don't wait for real backoff. */
export const transferRetryConfig = { delay: (attempt: number) => backoffDelay(attempt) };

/**
 * In-flight transfers ("outbox"). Stored in the query cache under a client-only key
 * so that removing an entry and writing the new server balance can happen in one
 * notifyManager.batch — React renders both changes together, no flicker.
 */
export function usePendingTransfers(): PendingTransfer[] {
  const { data } = useQuery({
    queryKey: OUTBOX_KEY,
    queryFn: () => [] as PendingTransfer[],
    initialData: [] as PendingTransfer[],
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

function removeFromOutbox(qc: QueryClient, key: string) {
  qc.setQueryData<PendingTransfer[]>(OUTBOX_KEY, (list = []) => list.filter((p) => p.idempotencyKey !== key));
}

/**
 * Re-sync the transaction feed with ONE request: trim every cached infinite query
 * to its first page, then refetch (instead of re-fetching all 20+ loaded pages).
 */
export function refreshFeedHead(qc: QueryClient) {
  qc.setQueriesData<InfiniteData<TransactionPage>>({ queryKey: queryKeys.transactionsRoot }, (old) =>
    old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) } : old,
  );
  return qc.invalidateQueries({ queryKey: queryKeys.transactionsRoot });
}

/**
 * Optimistic update WITHOUT touching the server's cached balance:
 *   displayed balance = server balance − pending transfers   (see useBalance)
 * So "rolling back" is just removing the pending entry. A snapshot-restore rollback
 * would wipe out any customer payment that arrived while the transfer was in flight.
 */
export function useTransfer() {
  const qc = useQueryClient();

  return useMutation<TransferResponse, ApiError, TransferVariables>({
    mutationKey: mutationKeys.transfer,
    mutationFn: ({ idempotencyKey, feeKobo: _fee, ...body }) => api.createTransfer(body, idempotencyKey),

    // Retrying a POST is only safe because every attempt sends the same Idempotency-Key.
    // Never retry 4xx (definite rejections).
    retry: (failureCount, error) => error.isRetryable && failureCount < MAX_TRANSFER_ATTEMPTS - 1,
    retryDelay: (attempt) => transferRetryConfig.delay(attempt),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: queryKeys.balance }); // don't let an in-flight poll land on top
      qc.setQueryData<PendingTransfer[]>(OUTBOX_KEY, (list = []) => [
        ...list,
        {
          idempotencyKey: vars.idempotencyKey,
          amountKobo: vars.amountKobo,
          feeKobo: vars.feeKobo,
          accountName: vars.accountName,
          narration: vars.narration,
        },
      ]);
    },

    onSuccess: async (data, vars) => {
      await refreshFeedHead(qc); // real row is in the feed before the pending row disappears
      notifyManager.batch(() => {
        removeFromOutbox(qc, vars.idempotencyKey);
        qc.setQueryData<BalanceSummary>(queryKeys.balance, (old) => old && { ...old, availableKobo: data.balanceKobo });
      });
      void qc.invalidateQueries({ queryKey: queryKeys.balance }); // refresh today's totals in the background
    },

    onError: async (error, vars) => {
      if (!error.isAmbiguous) {
        // Definite rejection (4xx): nothing moved on the server.
        removeFromOutbox(qc, vars.idempotencyKey);
        return;
      }
      // Timeout / network / 5xx: we DON'T KNOW if money moved. Ask the server first,
      // then swap in its balance and drop the pending entry together.
      const fresh = await api.getBalance().catch(() => null);
      notifyManager.batch(() => {
        removeFromOutbox(qc, vars.idempotencyKey);
        if (fresh) qc.setQueryData(queryKeys.balance, fresh);
      });
      if (!fresh) void qc.invalidateQueries({ queryKey: queryKeys.balance });
      await refreshFeedHead(qc);
    },
  });
}

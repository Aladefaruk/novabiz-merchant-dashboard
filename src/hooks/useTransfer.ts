import {
  notifyManager,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { ApiError, backoffDelay } from '../api/client';
import { api, mutationKeys, queryKeys } from '../api/endpoints';
import type { BalanceSummary, Transaction, TransactionFilters, TransactionPage, TransferRequest, TransferResponse } from '../api/types';
import { matchesFilters } from '../lib/filters';

/** Variables for one transfer intent. The key is created once per intent and reused across every retry. */
export interface TransferVariables extends TransferRequest {
  idempotencyKey: string;
  feeKobo: number;
}

/** What the UI shows optimistically while a transfer is in flight. Contains no PIN. */
export interface PendingTransfer {
  idempotencyKey: string;
  amountKobo: number;
  feeKobo: number;
  accountName: string;
  bankName: string;
  narration: string;
  submittedAt: string;
}

const OUTBOX_KEY = ['transfer-outbox'] as const;
export const MAX_TRANSFER_ATTEMPTS = 3;

/** Overridable so tests don't wait on real backoff. */
export const transferRetryConfig = { delay: (attempt: number) => backoffDelay(attempt, 600, 4_000) };

/**
 * The outbox lives in the query cache (client-only key) so that removing a
 * pending entry and writing the server's authoritative balance can be flushed
 * to React in ONE notifyManager batch — no frame where the deduction is
 * counted twice or not at all.
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

function updateOutbox(qc: QueryClient, fn: (list: PendingTransfer[]) => PendingTransfer[]) {
  qc.setQueryData<PendingTransfer[]>(OUTBOX_KEY, (old) => fn(old ?? []));
}

type FeedData = InfiniteData<TransactionPage, string | null>;

/** Splice a SERVER-CONFIRMED transaction into every cached feed it belongs to (no refetch of N pages). */
export function insertConfirmedTransaction(qc: QueryClient, tx: Transaction) {
  for (const query of qc.getQueryCache().findAll({ queryKey: queryKeys.transactionsRoot })) {
    const filters = (query.queryKey[1] ?? {}) as TransactionFilters;
    if (!matchesFilters(tx, filters)) continue;
    qc.setQueryData<FeedData>(query.queryKey, (old) => {
      if (!old?.pages[0] || old.pages.some((p) => p.items.some((i) => i.id === tx.id))) return old;
      const [first, ...rest] = old.pages;
      const headAt = first.headAt && first.headAt > tx.createdAt ? first.headAt : tx.createdAt;
      return { ...old, pages: [{ ...first, items: [tx, ...first.items], total: first.total + 1, headAt }, ...rest] };
    });
  }
}

/**
 * Re-sync feeds with the server cheaply: trim each cached infinite query to its
 * first page, then refetch — 1 request instead of re-walking every loaded page.
 */
export function refreshFeedHead(qc: QueryClient) {
  qc.setQueriesData<FeedData>({ queryKey: queryKeys.transactionsRoot }, (old) =>
    old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) } : old,
  );
  return qc.invalidateQueries({ queryKey: queryKeys.transactionsRoot });
}

export function useTransfer() {
  const qc = useQueryClient();

  return useMutation<TransferResponse, ApiError, TransferVariables>({
    mutationKey: mutationKeys.transfer,
    mutationFn: ({ idempotencyKey, feeKobo: _fee, ...body }) => api.createTransfer(body, idempotencyKey),

    // Safe ONLY because every attempt carries the same Idempotency-Key.
    retry: (failureCount, error) => error instanceof ApiError && error.isRetryable && failureCount < MAX_TRANSFER_ATTEMPTS - 1,
    retryDelay: (attempt) => transferRetryConfig.delay(attempt),

    onMutate: async (vars) => {
      // Stop any in-flight balance fetch from landing on top of our optimistic state.
      await qc.cancelQueries({ queryKey: queryKeys.balance });
      updateOutbox(qc, (list) => [
        ...list.filter((p) => p.idempotencyKey !== vars.idempotencyKey),
        {
          idempotencyKey: vars.idempotencyKey,
          amountKobo: vars.amountKobo,
          feeKobo: vars.feeKobo,
          accountName: vars.accountName,
          bankName: vars.bankName,
          narration: vars.narration,
          submittedAt: new Date().toISOString(),
        },
      ]);
    },

    onSuccess: (data, vars) => {
      // Atomically: drop the optimistic entry + apply the server's authoritative numbers.
      notifyManager.batch(() => {
        updateOutbox(qc, (list) => list.filter((p) => p.idempotencyKey !== vars.idempotencyKey));
        qc.setQueryData<BalanceSummary>(queryKeys.balance, (old) =>
          old ? { ...old, availableKobo: data.balanceKobo, latestTransactionAt: data.transaction.createdAt } : old,
        );
        insertConfirmedTransaction(qc, data.transaction);
      });
      // Background refresh for today's totals; not awaited, the UI is already correct.
      void qc.invalidateQueries({ queryKey: queryKeys.balance });
    },

    onError: async (error, vars) => {
      if (error.isAmbiguous) {
        // We do NOT know whether money moved (e.g. committed, then response lost).
        // Fetch server truth first, then swap it in and drop the pending entry in one batch.
        const fresh = await api.getBalance().catch(() => null);
        notifyManager.batch(() => {
          updateOutbox(qc, (list) => list.filter((p) => p.idempotencyKey !== vars.idempotencyKey));
          if (fresh) qc.setQueryData(queryKeys.balance, fresh);
        });
        if (!fresh) void qc.invalidateQueries({ queryKey: queryKeys.balance });
        await refreshFeedHead(qc);
      } else {
        // Definite rejection (4xx): nothing moved server-side, just drop the optimistic entry.
        updateOutbox(qc, (list) => list.filter((p) => p.idempotencyKey !== vars.idempotencyKey));
      }
    },
  });
}

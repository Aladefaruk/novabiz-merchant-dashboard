import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, queryKeys } from '../../shared/api/endpoints';
import type { TransactionFilters } from '../../shared/api/types';
import { EmptyState, ErrorState, Skeleton } from '../../shared/components/AsyncStates';
import { btnGhost, btnSecondary, card } from '../../shared/components/ui';
import { refreshFeedHead } from '../send-money/useTransfer';
import { FeedFilters } from './FeedFilters';
import { PendingTransfers } from './PendingTransfers';
import { TransactionRow } from './TransactionRow';

const ROW_HEIGHT = 76; // fixed height on every screen size keeps virtualization simple

/** Drop empty values so "no filter" is always `undefined`, never "". */
function withoutEmpty(filters: TransactionFilters): TransactionFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')) as TransactionFilters;
}

export function TransactionFeed() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({});
  const updateFilters = useCallback((patch: Partial<TransactionFilters>) => setFilters((f) => withoutEmpty({ ...f, ...patch })), []);
  const clearFilters = useCallback(() => setFilters({}), []);

  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
    useInfiniteQuery({
      queryKey: queryKeys.transactions(filters),
      queryFn: ({ pageParam, signal }) => api.getTransactions(filters, pageParam, signal),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.nextCursor,
    });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const total = data?.pages.at(-1)?.total ?? 0;

  // Virtualization: only the ~20 rows on screen (+ overscan) are in the DOM, however many are loaded.
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastIndex = virtualRows.at(-1)?.index ?? -1;

  // Infinite scroll: load the next page when we're within 15 rows of the end.
  useEffect(() => {
    if (lastIndex >= items.length - 15 && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [lastIndex, items.length, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const renderBody = () => {
    if (isPending) {
      return (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only" role="status">Loading transactions…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      );
    }
    // Only a first-page failure replaces the list. (In React Query v5 a failed
    // fetchNextPage ALSO sets isError, but keeps data — handled in the footer.)
    if (isError && !data) {
      return <ErrorState title="We couldn’t load your transactions" error={error} onRetry={() => void refetch()} />;
    }
    if (items.length === 0) {
      return Object.keys(filters).length > 0 ? (
        <EmptyState
          title="No transactions match"
          action={<button type="button" className={btnSecondary} onClick={clearFilters}>Clear filters</button>}
        >
          Try another search or a wider date range.
        </EmptyState>
      ) : (
        <EmptyState title="No transactions yet">Share your NovaBiz QR code to start receiving payments.</EmptyState>
      );
    }

    return (
      <>
        <div ref={listRef} role="feed" aria-busy={isFetchingNextPage} aria-label="Transactions" className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualRows.map((row) => (
            <div
              key={items[row.index]!.id}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
            >
              <TransactionRow tx={items[row.index]!} index={row.index} total={total} />
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-4 text-sm text-slate-600 dark:text-slate-400">
          {isFetchingNextPage ? (
            <p role="status" className="flex items-center gap-2">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Loading more…
            </p>
          ) : isFetchNextPageError ? (
            <ErrorState title="Couldn’t load more transactions" error={error} onRetry={() => void fetchNextPage()} />
          ) : hasNextPage ? (
            <button type="button" className={btnSecondary} onClick={() => void fetchNextPage()}>
              Load more
            </button>
          ) : (
            <p>You’ve reached the end · {total} transactions</p>
          )}
        </div>
      </>
    );
  };

  return (
    <section aria-labelledby="feed-heading" className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="feed-heading" className="text-lg font-bold">
          Transactions
        </h2>
        <button type="button" className={btnGhost} onClick={() => void refreshFeedHead(qc)}>
          <RefreshCw aria-hidden className="size-4" /> Refresh
        </button>
      </div>
      <FeedFilters filters={filters} onChange={updateFilters} onClear={clearFilters} />
      <PendingTransfers />
      {renderBody()}
    </section>
  );
}

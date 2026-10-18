import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, queryKeys } from '../../api/endpoints';
import { EmptyState, ErrorState, Skeleton } from '../../components/AsyncStates';
import { Icon } from '../../components/Icon';
import { refreshFeedHead } from '../../hooks/useTransfer';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { hasActiveFilters } from '../../lib/filters';
import { FeedFilters } from './FeedFilters';
import { PendingTransfers } from './PendingTransfers';
import { TransactionRow } from './TransactionRow';

/** Fixed row height (CSS enforces it at every breakpoint) keeps virtualization math O(1). */
export const ROW_HEIGHT = 76;
const PREFETCH_THRESHOLD = 15;
const countFormatter = new Intl.NumberFormat('en-NG');

export function TransactionFeed() {
  const qc = useQueryClient();
  const { filters, setFilters } = useUrlFilters();
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: ({ pageParam, signal }) => api.getTransactions(filters, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !rangeInvalid,
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const total = data?.pages[data.pages.length - 1]?.total ?? 0;
  const headAt = data?.pages[0]?.headAt ?? null;

  // Shares the balance query (polled by BalanceSummary) — no extra request.
  const { data: latestAt } = useQuery({
    queryKey: queryKeys.balance,
    queryFn: ({ signal }) => api.getBalance(signal),
    select: (b) => b.latestTransactionAt,
  });
  const hasNewActivity = Boolean(latestAt && headAt && latestAt > headAt);

  // --- Virtualization (window scroller: natural page scrolling on mobile) ---
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [items.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

  // Infinite scroll: prefetch the next page well before the user hits the bottom.
  useEffect(() => {
    if (lastVisibleIndex >= items.length - PREFETCH_THRESHOLD && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [lastVisibleIndex, items.length, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const filtered = hasActiveFilters(filters);

  return (
    <section className="card feed" aria-labelledby="feed-heading">
      <div className="card__header">
        <h2 id="feed-heading">Transactions</h2>
        {items.length > 0 && (
          <p className="feed__count">
            Showing {countFormatter.format(items.length)} of {countFormatter.format(total)}
          </p>
        )}
      </div>

      <FeedFilters filters={filters} onChange={setFilters} />

      <div aria-live="polite" className="feed__live">
        {hasNewActivity && (
          <div className="new-activity">
            <span>
              <Icon name="arrowDown" size={16} /> New activity on your account
            </span>
            <button type="button" className="btn btn--gold btn--sm" onClick={() => { void refreshFeedHead(qc); window.scrollTo({ top: Math.max(0, scrollMargin - 220), behavior: 'smooth' }); }}>
              Show latest
            </button>
          </div>
        )}
      </div>

      <PendingTransfers />

      {rangeInvalid ? null : isPending ? (
        <div className="feed__skeleton" aria-busy="true">
          <span className="visually-hidden" role="status">Loading transactions…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="tx-row tx-row--skeleton">
              <Skeleton width={40} height={40} />
              <div className="tx-row__main">
                <Skeleton width="55%" />
                <Skeleton width="80%" height={12} />
              </div>
              <Skeleton width={90} />
            </div>
          ))}
        </div>
      ) : isError && !data ? (
        // Only a FIRST-page failure replaces the list. In v5 a failed fetchNextPage also sets
        // status 'error' but keeps data — that case is handled inline in the footer below.
        <ErrorState title="We couldn’t load your transactions" error={error} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No transactions match these filters"
            action={<button type="button" className="btn btn--secondary btn--sm" onClick={() => setFilters({})}>Clear filters</button>}
          >
            Try a wider date range or a different status.
          </EmptyState>
        ) : (
          <EmptyState title="No transactions yet">
            Share your NovaBiz QR code or *894# merchant code to start receiving payments.
          </EmptyState>
        )
      ) : (
        <>
          <div
            ref={listRef}
            role="feed"
            aria-busy={isFetchingNextPage}
            aria-labelledby="feed-heading"
            className="feed__list"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((v) => {
              const tx = items[v.index]!;
              return (
                <div
                  key={tx.id}
                  className="feed__item"
                  style={{ height: v.size, transform: `translateY(${v.start - scrollMargin}px)` }}
                >
                  <TransactionRow tx={tx} index={v.index} setSize={total} />
                </div>
              );
            })}
          </div>

          <div className="feed__footer">
            {isFetchingNextPage ? (
              <p role="status" className="feed__loading-more">
                <span className="spinner" aria-hidden="true" /> Loading more transactions…
              </p>
            ) : isFetchNextPageError ? (
              <ErrorState compact title="Couldn’t load more transactions" error={error} onRetry={() => void fetchNextPage()} />
            ) : hasNextPage ? (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => void fetchNextPage()}>
                Load more
              </button>
            ) : (
              <p className="feed__end">You’ve reached the end · {countFormatter.format(total)} transactions</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

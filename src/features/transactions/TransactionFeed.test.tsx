import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setMockConfig } from '../../mocks/config';
import { db } from '../../mocks/db';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/utils';
import { TransactionFeed } from './TransactionFeed';

describe('TransactionFeed', () => {
  it('shows a loading state, then the newest transactions first', async () => {
    renderWithProviders(<TransactionFeed />);
    expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();

    const feed = await screen.findByRole('feed');
    const rows = within(feed).getAllByRole('article');
    const times = rows.map((r) => r.querySelector('time')!.getAttribute('datetime')!);
    expect([...times].sort().reverse()).toEqual(times);
    expect(rows[0]).toHaveAttribute('aria-posinset', '1');
    expect(rows[0]).toHaveAttribute('aria-setsize', String(db.transactions.length));
  });

  it('virtualizes: renders only a window of rows even with 1,000+ loaded', async () => {
    const { queryClient } = renderWithProviders(<TransactionFeed />);
    await screen.findByRole('feed');
    // Pull every page into the cache (> 1,000 rows).
    while (true) {
      const loadMore = screen.queryByRole('button', { name: /load more/i });
      if (!loadMore) break;
      await userEvent.click(loadMore);
      await waitFor(() => expect(screen.queryByText(/loading more/i)).not.toBeInTheDocument());
    }
    const cached = queryClient.getQueriesData<{ pages: { items: unknown[] }[] }>({ queryKey: ['transactions'] });
    const loaded = cached[0]![1]!.pages.reduce((n, p) => n + p.items.length, 0);
    expect(loaded).toBeGreaterThanOrEqual(1_000);
    expect(screen.getAllByRole('article').length).toBeLessThan(60);
    expect(screen.getByText(/you’ve reached the end/i)).toBeInTheDocument();
  });

  it('renders hostile descriptions as inert text (no HTML injection)', async () => {
    db.transactions[0]!.description = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    db.transactions[1]!.description = 'Refund \u202E00.000,05₦';
    renderWithProviders(<TransactionFeed />);
    const feed = await screen.findByRole('feed');

    expect(feed.querySelector('img')).toBeNull();
    expect(feed.querySelector('script')).toBeNull();
    // The markup is visible as literal text instead of being executed.
    expect(within(feed).getByText(/<img src=x onerror="window.__pwned=1">/)).toBeInTheDocument();
    expect(feed.textContent).not.toContain('\u202E');
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('filters by status and type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionFeed />);
    await screen.findByRole('feed');

    await user.selectOptions(screen.getByLabelText(/status/i), 'failed');
    await user.selectOptions(screen.getByLabelText(/^type/i), 'debit');

    await waitFor(() => {
      const rows = within(screen.getByRole('feed')).getAllByRole('article');
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r) => {
        expect(r).toHaveTextContent('Failed');
        expect(r).toHaveTextContent(/sent to/i);
      });
    });
    expect(window.location.search).toContain('status=failed');
    expect(window.location.search).toContain('type=debit');
  });

  it('shows an empty state for a date range with no activity, with a way out', async () => {
    window.history.replaceState(null, '', '/?from=2020-01-01&to=2020-01-31');
    const user = userEvent.setup();
    renderWithProviders(<TransactionFeed />);

    expect(await screen.findByText(/no transactions match these filters/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /clear filters/i })[0]!);
    expect(await screen.findByRole('feed')).toBeInTheDocument();
  });

  it('flags an inverted date range instead of querying', async () => {
    window.history.replaceState(null, '', '/?from=2026-02-10&to=2026-02-01');
    renderWithProviders(<TransactionFeed />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/must be on or before/i);
  });

  it('shows an error state with a working retry', async () => {
    setMockConfig({ failureRate: 1 }, { persist: false });
    const user = userEvent.setup();
    renderWithProviders(<TransactionFeed />);

    expect(await screen.findByText(/couldn’t load your transactions/i)).toBeInTheDocument();
    setMockConfig({ failureRate: 0 }, { persist: false });
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('feed')).toBeInTheDocument();
  });

  it('keeps loaded rows when a NEXT page fails, and retries inline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionFeed />);
    await screen.findByRole('feed');

    server.use(http.get('*/api/transactions', () => HttpResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'Down' }, { status: 503 })));
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText(/couldn’t load more transactions/i)).toBeInTheDocument();
    expect(screen.getByRole('feed')).toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.queryByText(/couldn’t load more/i)).not.toBeInTheDocument());
  });

  it('shows the empty state for a brand-new merchant', async () => {
    db.transactions = [];
    renderWithProviders(<TransactionFeed />);
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument();
  });
});

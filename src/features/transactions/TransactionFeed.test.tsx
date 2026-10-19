import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setMockConfig } from '../../mocks/config';
import { db } from '../../mocks/db';
import { renderWithProviders } from '../../test/utils';
import { TransactionFeed } from './TransactionFeed';

describe('TransactionFeed', () => {
  it('loads newest first and only renders the visible rows (virtualized)', async () => {
    renderWithProviders(<TransactionFeed />);
    expect(screen.getByText('Loading transactions…')).toBeInTheDocument();

    const rows = within(await screen.findByRole('feed')).getAllByRole('article');
    const times = rows.map((r) => r.querySelector('time')!.getAttribute('datetime')!);
    expect(times).toEqual([...times].sort().reverse());
    // 50 rows were fetched, far fewer are in the DOM.
    expect(rows.length).toBeLessThan(50);
  });

  it('searches by name, narration or reference', async () => {
    const target = db.transactions[42]!;
    renderWithProviders(<TransactionFeed />);
    await screen.findByRole('feed');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), target.reference);
    await waitFor(() => expect(within(screen.getByRole('feed')).getAllByRole('article')).toHaveLength(1));
    expect(within(screen.getByRole('feed')).getByText(target.counterparty.name)).toBeInTheDocument();
  });

  it('renders hostile descriptions as plain text, never HTML', async () => {
    db.transactions[0]!.description = '<img src=x onerror="window.pwned=1">';
    renderWithProviders(<TransactionFeed />);
    const feed = await screen.findByRole('feed');

    expect(feed.querySelector('img')).toBeNull();
    expect(within(feed).getByText('<img src=x onerror="window.pwned=1">')).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    setMockConfig({ failureRate: 1 }, { persist: false });
    renderWithProviders(<TransactionFeed />);
    expect(await screen.findByText('We couldn’t load your transactions')).toBeInTheDocument();

    setMockConfig({ failureRate: 0 }, { persist: false });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('feed')).toBeInTheDocument();
  });
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { db } from '../../mocks/db';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test/utils';
import { BalanceSummary } from './BalanceSummary';

describe('BalanceSummary', () => {
  it('formats kobo integers from the API as Naira', async () => {
    server.use(
      http.get('*/api/balance', () =>
        HttpResponse.json({
          ...db.summary(),
          availableKobo: 100050,
          todayInflowKobo: 1999,
          todayInflowCount: 2,
          todayOutflowKobo: 0,
          todayOutflowCount: 0,
        }),
      ),
    );
    renderWithProviders(<BalanceSummary />);

    expect(await screen.findByTestId('available-balance')).toHaveTextContent('₦1,000.50');
    expect(screen.getByTestId('available-balance')).toHaveTextContent('1,000 naira and 50 kobo');
    expect(screen.getByText('₦19.99')).toBeInTheDocument();
    expect(screen.getByText('2 payments')).toBeInTheDocument();
    expect(screen.getByText(/no transfers yet today/i)).toBeInTheDocument();
  });

  it('shows loading, then an error state with retry', async () => {
    let fail = true;
    server.use(
      http.get('*/api/balance', () =>
        fail ? HttpResponse.json({ code: 'X', message: 'Service temporarily unavailable.' }, { status: 503 }) : HttpResponse.json(db.summary()),
      ),
    );
    renderWithProviders(<BalanceSummary />);
    expect(screen.getByText(/loading balance/i)).toBeInTheDocument();
    expect(await screen.findByText(/couldn’t load your balance/i)).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('available-balance')).toBeInTheDocument();
  });

  it('lets the merchant hide the balance, and remembers it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BalanceSummary />);
    await screen.findByTestId('available-balance');

    await user.click(screen.getByRole('button', { name: /hide balance/i }));
    expect(screen.getByTestId('available-balance')).toHaveTextContent(/balance hidden/i);
    expect(screen.getByRole('button', { name: /show balance/i })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('novabiz:hide-balance')).toBe('1');
  });
});

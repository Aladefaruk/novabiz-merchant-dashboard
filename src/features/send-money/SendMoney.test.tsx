import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { App } from '../../App';
import { formatNaira, toKobo } from '../../lib/money';
import { setMockConfig } from '../../mocks/config';
import { db } from '../../mocks/db';
import { server } from '../../mocks/server';
import { captureRequests, deferred, renderWithProviders } from '../../test/utils';

const AMOUNT = 1_000_00; // ₦1,000.00
const FEE = 10_75; //       NIP fee for ≤ ₦5,000

const expectBalance = (kobo: number) =>
  waitFor(() => expect(screen.getByTestId('available-balance')).toHaveTextContent(formatNaira(toKobo(kobo))));

async function setup() {
  const user = userEvent.setup();
  const start = db.availableKobo;
  renderWithProviders(<App />);
  await expectBalance(start);
  return { user, start };
}

/** Recipient → Amount → Review → Confirm → submit with PIN. */
async function sendOneThousand(user: UserEvent) {
  await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
  await user.selectOptions(screen.getByLabelText('Bank'), '058');
  await user.type(screen.getByLabelText('Account number'), '0123456789');
  await screen.findByTestId('resolved-name');
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(await screen.findByLabelText('Amount (₦)'), '1000');
  await user.click(screen.getByRole('button', { name: 'Review transfer' }));
  await user.click(await screen.findByRole('button', { name: 'Continue to confirm' }));

  await user.type(await screen.findByLabelText('Transaction PIN'), '1234');
  await user.click(screen.getByRole('button', { name: 'Send ₦1,000.00' }));
}

describe('Send Money', () => {
  it('sends money with an Idempotency-Key and debits amount + fee', async () => {
    const { user, start } = await setup();
    const requests = captureRequests('/api/transfers');

    await sendOneThousand(user);

    expect(await screen.findByRole('heading', { name: 'Transfer successful' })).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(db.committedTransfers).toBe(1);
    await expectBalance(start - AMOUNT - FEE);
  });

  it('shows the transfer optimistically, then rolls back on a rejection', async () => {
    const { user, start } = await setup();
    const gate = deferred();
    server.use(
      http.post('*/api/transfers', async () => {
        await gate.promise; // hold the request "in flight"
        return HttpResponse.json({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance.' }, { status: 422 });
      }),
    );

    await sendOneThousand(user);

    // Before the server answers: balance already reduced, "Processing" row visible.
    await expectBalance(start - AMOUNT - FEE);
    expect(screen.getByTestId('optimistic-row')).toBeInTheDocument();

    gate.resolve();

    expect(await screen.findByRole('alert')).toHaveTextContent('No money left your account');
    await expectBalance(start);
    expect(screen.queryByTestId('optimistic-row')).not.toBeInTheDocument();
  });

  it('after a network failure, shows the SERVER balance — keeping a payment that arrived meanwhile', async () => {
    const { user, start } = await setup();
    const requests = captureRequests('/api/transfers');
    const gate = deferred();
    server.use(
      http.post('*/api/transfers', async () => {
        await gate.promise;
        return HttpResponse.error(); // network drop on every attempt
      }),
    );

    await sendOneThousand(user);
    const inflow = db.receivePayment(); // a customer pays while the transfer is in flight
    gate.resolve();

    expect(await screen.findByRole('heading', { name: 'We couldn’t confirm this transfer' })).toBeInTheDocument();
    // A snapshot-restore rollback would show `start` here and lose the customer's payment.
    await expectBalance(start + inflow.amountKobo);
    // It retried automatically, always with the same key.
    expect(requests).toHaveLength(3);
    expect(new Set(requests.map((r) => r.headers.get('Idempotency-Key'))).size).toBe(1);
  });

  it('if the server commits but the response is lost, the retry does not send twice', async () => {
    setMockConfig({ lostResponseRate: 1 }, { persist: false });
    const { user, start } = await setup();
    const requests = captureRequests('/api/transfers');

    await sendOneThousand(user);

    expect(await screen.findByRole('heading', { name: 'Transfer successful' })).toBeInTheDocument();
    expect(requests).toHaveLength(2); // original + automatic retry
    expect(requests[0]!.headers.get('Idempotency-Key')).toBe(requests[1]!.headers.get('Idempotency-Key'));
    expect(db.committedTransfers).toBe(1); // debited exactly once
    await expectBalance(start - AMOUNT - FEE);
  });
});

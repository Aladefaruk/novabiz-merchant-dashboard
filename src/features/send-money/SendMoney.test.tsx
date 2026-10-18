import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { App } from '../../App';
import { formatNaira, toKobo } from '../../lib/money';
import { setMockConfig } from '../../mocks/config';
import { db } from '../../mocks/db';
import { server } from '../../mocks/server';
import { captureRequests, deferred, renderWithProviders } from '../../test/utils';

const AMOUNT = 1_000_00; // ₦1,000.00
const FEE = 10_75; // NIP fee tier 1
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const balanceEl = () => screen.getByTestId('available-balance');
const expectBalance = async (kobo: number) =>
  waitFor(() => expect(balanceEl()).toHaveTextContent(formatNaira(toKobo(kobo))));

async function goToConfirm(user: UserEvent, amount = '1000') {
  await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
  await user.selectOptions(screen.getByLabelText(/^bank/i), '058');
  await user.type(screen.getByLabelText(/account number/i), '0123456789');
  const resolved = await screen.findByTestId('resolved-name');
  const accountName = resolved.textContent!.replace('Account name: ', '');
  await user.click(screen.getByRole('button', { name: /continue/i }));

  await user.type(await screen.findByLabelText(/amount/i), amount);
  await user.click(screen.getByRole('button', { name: /review transfer/i }));
  await user.click(await screen.findByRole('button', { name: /continue to confirm/i }));
  await screen.findByLabelText(/transaction pin/i);
  return accountName;
}

async function confirmWithPin(user: UserEvent, pin = '1234') {
  await user.type(screen.getByLabelText(/transaction pin/i), pin);
  await user.click(screen.getByRole('button', { name: /^send 1,000 naira/i }));
}

async function setup() {
  const user = userEvent.setup();
  const startKobo = db.availableKobo;
  renderWithProviders(<App />);
  await expectBalance(startKobo);
  return { user, startKobo };
}

describe('Send Money', () => {
  it('sends money end-to-end with an Idempotency-Key and updates balance + feed', async () => {
    const { user, startKobo } = await setup();
    const requests = captureRequests('/api/transfers');

    const accountName = await goToConfirm(user);
    await confirmWithPin(user);

    expect(await screen.findByRole('heading', { name: /transfer successful/i })).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(requests[0]!.body).toMatchObject({ amountKobo: AMOUNT, accountNumber: '0123456789', accountName });
    expect(db.committedTransfers).toBe(1);

    await expectBalance(startKobo - AMOUNT - FEE);
    const feed = screen.getByRole('feed');
    expect(within(feed).getAllByRole('article')[0]).toHaveTextContent(`Sent to ${accountName}`);
  });

  it('shows the transfer optimistically, then rolls back cleanly on a definite rejection', async () => {
    const { user, startKobo } = await setup();
    const gate = deferred();
    server.use(
      http.post('*/api/transfers', async () => {
        await gate.promise;
        return HttpResponse.json({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance for this transfer.' }, { status: 422 });
      }),
    );

    await goToConfirm(user);
    await confirmWithPin(user);

    // Optimistic: balance already reduced and a "Processing" row is visible before the server answers.
    await expectBalance(startKobo - AMOUNT - FEE);
    expect(screen.getByTestId('optimistic-row')).toHaveTextContent(/processing/i);
    expect(screen.getByTestId('balance-pending')).toBeInTheDocument();

    gate.resolve();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no money left your account/i);
    await expectBalance(startKobo);
    expect(screen.queryByTestId('optimistic-row')).not.toBeInTheDocument();
    expect(db.committedTransfers).toBe(0);
  });

  it('on an ambiguous failure, reconciles to SERVER truth — not a stale snapshot (keeps payments that arrived meanwhile)', async () => {
    const { user, startKobo } = await setup();
    const requests = captureRequests('/api/transfers');
    const gate = deferred();
    server.use(
      http.post('*/api/transfers', async () => {
        await gate.promise;
        return HttpResponse.error(); // network drop on every attempt
      }),
    );

    await goToConfirm(user);
    await confirmWithPin(user);
    await expectBalance(startKobo - AMOUNT - FEE);

    // A customer pays the merchant while the transfer is in flight.
    const inflow = db.receivePayment();
    gate.resolve();

    expect(await screen.findByRole('heading', { name: /couldn’t confirm this transfer/i })).toBeInTheDocument();
    // A snapshot-restore rollback would show `startKobo` here and lose the inflow.
    await expectBalance(startKobo + inflow.amountKobo);
    expect(screen.queryByTestId('optimistic-row')).not.toBeInTheDocument();

    // It retried automatically, always with the SAME key.
    expect(requests).toHaveLength(3);
    expect(new Set(requests.map((r) => r.headers.get('Idempotency-Key'))).size).toBe(1);
  });

  it('when the server commits but the response is lost, the retry is deduplicated — the merchant is debited exactly once', async () => {
    setMockConfig({ lostResponseRate: 1 }, { persist: false });
    const { user, startKobo } = await setup();
    const requests = captureRequests('/api/transfers');

    await goToConfirm(user);
    await confirmWithPin(user);

    expect(await screen.findByRole('heading', { name: /transfer successful/i })).toBeInTheDocument();
    expect(requests).toHaveLength(2);
    expect(requests[0]!.headers.get('Idempotency-Key')).toBe(requests[1]!.headers.get('Idempotency-Key'));
    expect(db.committedTransfers).toBe(1);
    await expectBalance(startKobo - AMOUNT - FEE);
  });

  it('manual "retry" after an ambiguous failure reuses the key and cannot double-send', async () => {
    const { user, startKobo } = await setup();
    const requests = captureRequests('/api/transfers');
    // First 3 attempts: commit on the server but drop every response.
    let calls = 0;
    server.use(
      http.post('*/api/transfers', async ({ request }) => {
        calls++;
        if (calls <= 3) {
          db.transfer((await request.json()) as never, request.headers.get('Idempotency-Key')!);
          return HttpResponse.error();
        }
        return undefined; // fall through to the real mock handler
      }),
    );

    await goToConfirm(user);
    await confirmWithPin(user);
    await screen.findByRole('heading', { name: /couldn’t confirm this transfer/i });
    // Reconciliation already shows the committed debit from server truth.
    await expectBalance(startKobo - AMOUNT - FEE);

    await user.click(screen.getByRole('button', { name: /check & retry/i }));
    expect(await screen.findByRole('heading', { name: /transfer successful/i })).toBeInTheDocument();

    expect(new Set(requests.map((r) => r.headers.get('Idempotency-Key'))).size).toBe(1);
    expect(db.committedTransfers).toBe(1);
    await expectBalance(startKobo - AMOUNT - FEE);
  });

  it('returns to the PIN step on a wrong PIN and succeeds with the same key afterwards', async () => {
    const { user } = await setup();
    const requests = captureRequests('/api/transfers');

    await goToConfirm(user);
    await confirmWithPin(user, '9999');

    expect(await screen.findByText(/incorrect transaction pin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/transaction pin/i)).toHaveValue('');

    await confirmWithPin(user, '1234');
    expect(await screen.findByRole('heading', { name: /transfer successful/i })).toBeInTheDocument();
    expect(requests[0]!.headers.get('Idempotency-Key')).toBe(requests[1]!.headers.get('Idempotency-Key'));
  });

  it('generates a NEW key when the transfer is edited after review', async () => {
    const { user } = await setup();
    await goToConfirm(user);
    const firstRef = screen.getByText(/transfer reference/i).textContent;

    await user.click(screen.getByRole('button', { name: /^back$/i })); // -> review
    await user.click(screen.getByRole('button', { name: /change amount/i }));
    const amount = screen.getByLabelText(/amount/i);
    await user.clear(amount);
    await user.type(amount, '1500');
    await user.click(screen.getByRole('button', { name: /review transfer/i }));
    await user.click(screen.getByRole('button', { name: /continue to confirm/i }));

    expect(screen.getByText(/transfer reference/i).textContent).not.toBe(firstRef);
  });

  describe('validation', () => {
    it('blocks progress and explains each problem', async () => {
      const { user } = await setup();
      await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      expect(screen.getByText(/select the recipient’s bank/i)).toBeInTheDocument();
      const account = screen.getByLabelText(/account number/i);
      expect(account).toHaveAttribute('aria-invalid', 'true');
      expect(account).toHaveAccessibleDescription(/enter the 10-digit account number/i);
    });

    it('reports an unknown account from name enquiry', async () => {
      const { user } = await setup();
      await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
      await user.selectOptions(screen.getByLabelText(/^bank/i), '058');
      await user.type(screen.getByLabelText(/account number/i), '0123450000');
      expect(await screen.findByText(/couldn’t find an account/i)).toBeInTheDocument();
    });

    it('rejects an amount equal to the balance, because the fee pushes it over', async () => {
      const summary = db.summary();
      server.use(http.get('*/api/balance', () => HttpResponse.json({ ...summary, availableKobo: 5_000_00 })));
      const user = userEvent.setup();
      renderWithProviders(<App />);
      await expectBalance(5_000_00);
      await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
      await user.selectOptions(screen.getByLabelText(/^bank/i), '058');
      await user.type(screen.getByLabelText(/account number/i), '0123456789');
      await screen.findByTestId('resolved-name');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await user.type(await screen.findByLabelText(/amount/i), '5000');
      await user.click(screen.getByRole('button', { name: /review transfer/i }));
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue to confirm/i })).not.toBeInTheDocument();
    });

    it('rejects sub-kobo precision', async () => {
      const { user } = await setup();
      await screen.findByRole('option', { name: 'Guaranty Trust Bank' });
      await user.selectOptions(screen.getByLabelText(/^bank/i), '058');
      await user.type(screen.getByLabelText(/account number/i), '0123456789');
      await screen.findByTestId('resolved-name');
      await user.click(screen.getByRole('button', { name: /continue/i }));
      await user.type(await screen.findByLabelText(/amount/i), '100.555');
      await user.click(screen.getByRole('button', { name: /review transfer/i }));
      expect(screen.getByText(/at most 2 decimal places/i)).toBeInTheDocument();
    });
  });
});

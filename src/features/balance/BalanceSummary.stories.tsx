import type { Meta, StoryObj } from '@storybook/react';
import type { QueryClient } from '@tanstack/react-query';
import { HttpResponse, delay, http } from 'msw';
import type { BalanceSummary as Summary } from '../../shared/api/types';
import { queryKeys } from '../../shared/api/endpoints';
import { OUTBOX_KEY, type PendingTransfer } from '../send-money/useTransfer';
import { BalanceSummary } from './BalanceSummary';

const summary: Summary = {
  availableKobo: 248_635_075,
  todayInflowKobo: 18_450_000,
  todayOutflowKobo: 2_510_750,
  todayInflowCount: 14,
  todayOutflowCount: 1,
  latestTransactionAt: '2026-10-18T11:42:00Z',
  asOf: '2026-10-18T11:45:00Z',
};
const balanceReturns = (body: Summary) => http.get('*/api/balance', () => HttpResponse.json(body));
const unavailable = http.get('*/api/balance', () => HttpResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' }, { status: 503 }));

/** Balance card + today's totals. Data comes from the mock API; `parameters.msw` overrides it per story. */
const meta = {
  title: 'Dashboard/BalanceSummary',
  component: BalanceSummary,
  parameters: { msw: [balanceReturns(summary)] },
} satisfies Meta<typeof BalanceSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {};
export const Loading: Story = { parameters: { msw: [http.get('*/api/balance', () => delay('infinite'))] } };
export const LoadFailed: Story = { parameters: { msw: [unavailable] } };
export const NoActivityToday: Story = {
  parameters: { msw: [balanceReturns({ ...summary, todayInflowKobo: 0, todayOutflowKobo: 0, todayInflowCount: 0, todayOutflowCount: 0 })] },
};

/** Optimistic state: ₦25,000 + ₦53.75 fee is held while the transfer is in flight. Displayed = server − pending. */
export const TransferInFlight: Story = {
  parameters: {
    seed: (qc: QueryClient) =>
      qc.setQueryData<PendingTransfer[]>(OUTBOX_KEY, [
        { idempotencyKey: 'demo', amountKobo: 2_500_000, feeKobo: 5_375, accountName: 'Dangote Flour Mills', narration: '' },
      ]),
  },
};

/** A background refresh failed: keep showing the last known balance instead of an error screen. */
export const RefreshFailed: Story = {
  parameters: {
    msw: [unavailable],
    seed: (qc: QueryClient) => qc.setQueryData(queryKeys.balance, summary, { updatedAt: 0 }),
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { createRef, type ComponentProps } from 'react';
import { ApiError } from '../../shared/api/client';
import { toKobo } from '../../shared/lib/money';
import { ResultView } from './ResultView';

type Transfer = ComponentProps<typeof ResultView>['transfer'];
/** Only the mutation fields ResultView reads. */
const mutation = (state: Partial<Record<'isSuccess' | 'isError' | 'isPaused', boolean>> & { failureCount?: number; error?: ApiError }) =>
  ({
    isSuccess: false,
    isError: false,
    isPaused: false,
    failureCount: 0,
    data: { transaction: { reference: 'NVB2610181200042' } },
    ...state,
  }) as unknown as Transfer;

/** The last step of Send Money: every outcome the merchant can see after pressing Send. */
const meta = {
  title: 'Send Money/ResultView',
  component: ResultView,
  args: {
    headingRef: createRef(),
    transfer: mutation({}),
    amountKobo: toKobo(2_500_000),
    accountName: 'Dangote Flour Mills',
    onRetry: fn(),
    onEdit: fn(),
    onDone: fn(),
  },
  decorators: [(Story) => <div className="mx-auto max-w-md rounded-2xl bg-white p-6 dark:bg-navy-900"><Story /></div>],
} satisfies Meta<typeof ResultView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sending: Story = {};
/** Automatic retry with the same Idempotency-Key, so it can't double-send. */
export const RetryingSafely: Story = { args: { transfer: mutation({ failureCount: 1 }) } };
export const WaitingForNetwork: Story = { args: { transfer: mutation({ isPaused: true }) } };
export const Success: Story = { args: { transfer: mutation({ isSuccess: true }) } };

/** Timeout / network / 5xx: money MAY have moved, so the copy says "couldn't confirm", not "failed". */
export const CouldNotConfirm: Story = {
  args: { transfer: mutation({ isError: true, error: new ApiError('timeout', 'The request timed out.') }) },
};
/** 4xx: a definite rejection. Nothing left the account. */
export const Rejected: Story = {
  args: {
    transfer: mutation({ isError: true, error: new ApiError('http', 'Insufficient balance for this transfer and fee.', { status: 422, code: 'INSUFFICIENT_FUNDS' }) }),
  },
};

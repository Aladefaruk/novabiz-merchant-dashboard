import type { Meta, StoryObj } from '@storybook/react';
import { HttpResponse, http } from 'msw';
import { SendMoney } from './SendMoney';

/**
 * The whole 4-step flow against the mock API. Try GTBank 0123456789 with PIN 1234.
 * Accounts ending in 0000 return "account not found".
 */
const meta = {
  title: 'Send Money/Full flow',
  component: SendMoney,
  decorators: [(Story) => <div className="mx-auto max-w-md"><Story /></div>],
} satisfies Meta<typeof SendMoney>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HappyPath: Story = {};

/** The transfer endpoint returns 503: watch the safe retries (same key), then the rollback to server truth. */
export const ServerDown: Story = {
  parameters: {
    msw: [http.post('*/api/transfers', () => HttpResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' }, { status: 503 }))],
  },
};

/** The server commits but the reply is lost: the retry reuses the same key and the merchant is debited once. */
export const LostResponse: Story = { parameters: { mockConfig: { lostResponseRate: 1 } } };

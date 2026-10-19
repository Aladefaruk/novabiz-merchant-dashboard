import type { Meta, StoryObj } from '@storybook/react';
import type { Transaction } from '../../shared/api/types';
import { TransactionRow } from './TransactionRow';

const base: Transaction = {
  id: 'tx_1',
  reference: 'NVB2610181200001',
  type: 'credit',
  status: 'successful',
  channel: 'qr',
  amountKobo: 1_250_000,
  feeKobo: 0,
  description: 'QR payment — 2 bags of rice',
  counterparty: { name: 'Adaeze Okafor', bankName: 'Moniepoint MFB', accountMasked: '•••• 4821' },
  createdAt: '2026-10-18T11:42:00Z',
};

/** One row of the virtualized feed. Resize to 360px to see the stacked mobile layout. */
const meta = {
  title: 'Feed/TransactionRow',
  component: TransactionRow,
  args: { tx: base, index: 0, total: 1 },
  decorators: [(Story) => <div role="feed" aria-label="Transactions" className="rounded-2xl bg-white p-2 dark:bg-navy-900"><Story /></div>],
} satisfies Meta<typeof TransactionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Credit: Story = {};
export const DebitWithFee: Story = {
  args: {
    tx: { ...base, type: 'debit', channel: 'transfer', amountKobo: 25_000_000, feeKobo: 5_375, description: 'Payment for flour supply', counterparty: { name: 'Dangote Flour Mills', bankName: 'Zenith Bank', accountMasked: '•••• 0192' } },
  },
};
export const Pending: Story = { args: { tx: { ...base, status: 'pending', channel: 'remittance', description: 'Diaspora transfer from UK' } } };
/** Failed amounts are struck through so they don't read as money received. */
export const Failed: Story = { args: { tx: { ...base, status: 'failed', channel: 'pos' } } };

/** Untrusted text: these render as inert text. The bidi override (U+202E) is stripped so it can't fake an amount. */
export const HostileText: Story = {
  args: {
    tx: {
      ...base,
      counterparty: { ...base.counterparty, name: '<img src=x onerror=alert(1)>' },
      description: 'Refund \u202E05.000,1₦ <script>alert("xss")</script>',
    },
  },
};

export const VeryLongText: Story = {
  args: {
    tx: {
      ...base,
      counterparty: { ...base.counterparty, name: 'Alaba International Wholesale Electronics and General Merchandise Limited' },
      description: 'Balance payment for 40 cartons of assorted phone accessories delivered to Shop 12B on Thursday afternoon',
    },
  },
};

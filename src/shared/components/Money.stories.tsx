import type { Meta, StoryObj } from '@storybook/react';
import { Money } from './Money';

/** Integer kobo in, Intl-formatted Naira out. Edit `kobo` in Controls to try any value. */
const meta = {
  title: 'Core/Money',
  component: Money,
  args: { kobo: 100050, className: 'text-2xl font-bold' },
} satisfies Meta<typeof Money>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BriefExample: Story = { name: '100050 kobo → ₦1,000.50' };
export const OneKobo: Story = { args: { kobo: 1 } };
export const Zero: Story = { args: { kobo: 0 } };
export const SignedCredit: Story = { args: { kobo: 2_500_000, signed: true } };
export const SignedDebit: Story = { args: { kobo: -1_075, signed: true } };

/** Above Number.MAX_SAFE_INTEGER / 100: `(kobo / 100).toLocaleString()` would lose the last kobo here. */
export const VeryLarge: Story = { args: { kobo: 9_007_199_254_740_991 } };

/** Every case side by side, for a quick visual check. */
export const AllCases: Story = {
  render: () => (
    <table className="text-left">
      <tbody>
        {[100050, 1, 0, 99, 1_075, 2_500_000, -1_075, 9_007_199_254_740_991].map((k) => (
          <tr key={k} className="border-b border-slate-300 dark:border-navy-700">
            <td className="py-1 pr-6 font-mono text-sm">{k}</td>
            <td className="py-1 font-bold"><Money kobo={k} signed={k < 0} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

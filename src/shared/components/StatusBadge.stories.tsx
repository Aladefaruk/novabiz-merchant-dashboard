import type { Meta, StoryObj } from '@storybook/react';
import { StatusBadge } from './StatusBadge';

/** Text + icon on every status, so it never relies on colour alone (WCAG 1.4.1). */
const meta = {
  title: 'Core/StatusBadge',
  component: StatusBadge,
  args: { status: 'successful' },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Successful: Story = {};
export const Pending: Story = { args: { status: 'pending' } };
export const Failed: Story = { args: { status: 'failed' } };
/** Client-only: an optimistic transfer the server hasn't confirmed yet. */
export const Processing: Story = { args: { status: 'processing' } };

export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="successful" />
      <StatusBadge status="pending" />
      <StatusBadge status="failed" />
      <StatusBadge status="processing" />
    </div>
  ),
};

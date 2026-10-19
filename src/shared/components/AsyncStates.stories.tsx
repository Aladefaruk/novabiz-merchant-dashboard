import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, Skeleton } from './AsyncStates';
import { btnSecondary } from './ui';

/** The shared loading / empty / error building blocks. No screen is ever blank. */
const meta = {
  title: 'Core/Async states',
  component: ErrorState,
  args: { title: 'We couldn’t load your transactions', error: new ApiError('timeout', 'The request timed out.'), onRetry: fn() },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Slow 3G: the message tells the merchant it's their connection, not their money. */
export const ErrorTimeout: Story = {};
export const ErrorOffline: Story = { args: { error: new ApiError('network', 'Network error') } };
export const ErrorFromServer: Story = {
  args: { error: new ApiError('http', 'Service temporarily unavailable. Please try again.', { status: 503 }) },
};
export const ErrorWithoutRetry: Story = { args: { onRetry: undefined } };

export const Empty: Story = {
  render: () => (
    <EmptyState title="No transactions match these filters" action={<button type="button" className={btnSecondary}>Clear filters</button>}>
      Try a wider date range.
    </EmptyState>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="space-y-3">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-[76px]" />
      <Skeleton className="h-[76px]" />
    </div>
  ),
};

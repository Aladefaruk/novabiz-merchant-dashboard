import type { TxStatus } from '../api/types';

const LABELS: Record<TxStatus | 'processing', string> = {
  successful: 'Successful',
  pending: 'Pending',
  failed: 'Failed',
  processing: 'Processing',
};

/** Status is conveyed by text + shape, never colour alone (WCAG 1.4.1). */
export function StatusBadge({ status }: { status: TxStatus | 'processing' }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

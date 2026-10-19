import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import type { TxStatus } from '../api/types';

const STYLES = {
  successful: { label: 'Successful', Icon: CheckCircle2, cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  pending: { label: 'Pending', Icon: Clock, cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300' },
  failed: { label: 'Failed', Icon: XCircle, cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  processing: { label: 'Processing', Icon: Loader2, cls: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200' },
};

/** Status is shown with text + icon, never colour alone (WCAG 1.4.1). */
export function StatusBadge({ status }: { status: TxStatus | 'processing' }) {
  const { label, Icon, cls } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${cls}`}>
      <Icon aria-hidden className={`size-3.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

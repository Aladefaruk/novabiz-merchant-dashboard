import { Send } from 'lucide-react';
import { Money } from '../../components/Money';
import { StatusBadge } from '../../components/StatusBadge';
import { usePendingTransfers } from '../../hooks/useTransfer';

/** Optimistic rows: transfers submitted but not yet confirmed by the server. */
export function PendingTransfers() {
  const pending = usePendingTransfers();
  if (pending.length === 0) return null;

  return (
    <ul aria-label="Transfers in progress" className="mb-1">
      {pending.map((p) => (
        <li
          key={p.idempotencyKey}
          data-testid="optimistic-row"
          className="mb-1 grid h-[76px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl bg-blue-50 px-1 dark:bg-blue-950/40"
        >
          <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-white text-navy-800 dark:bg-navy-800 dark:text-gold-300">
            <Send className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              <span className="sr-only">Sending to </span>
              {p.accountName}
            </p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400">{p.narration || 'Transfer'}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Money kobo={-p.amountKobo} signed className="font-bold" />
            <StatusBadge status="processing" />
          </div>
        </li>
      ))}
    </ul>
  );
}

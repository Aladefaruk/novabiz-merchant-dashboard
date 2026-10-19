import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { memo } from 'react';
import type { Transaction } from '../../shared/api/types';
import { Money } from '../../shared/components/Money';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { formatTxDate } from '../../shared/lib/dates';
import { toSafeDisplayText } from '../../shared/lib/sanitize';

/**
 * memo: the virtualizer re-renders on scroll; a row only re-renders when its own transaction changes.
 * All free text is cleaned and rendered as plain React text (never as HTML).
 */
export const TransactionRow = memo(function TransactionRow({ tx, index, total }: { tx: Transaction; index: number; total: number }) {
  const isCredit = tx.type === 'credit';
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;

  return (
    <article
      aria-posinset={index + 1}
      aria-setsize={total}
      tabIndex={0}
      className="grid h-[76px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-slate-200 px-1 dark:border-navy-700 md:grid-cols-[40px_minmax(0,1fr)_140px_120px_150px]"
    >
      <span
        aria-hidden
        className={`grid size-10 place-items-center rounded-xl ${isCredit ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0">
        <h3 className="truncate font-semibold">
          <span className="sr-only">{isCredit ? 'Received from ' : 'Sent to '}</span>
          {toSafeDisplayText(tx.counterparty.name, 60)}
        </h3>
        <p className="truncate text-sm text-slate-600 dark:text-slate-400">{toSafeDisplayText(tx.description)}</p>
        {/* Date sits under the description on mobile, in its own column on desktop. */}
        <time dateTime={tx.createdAt} className="text-xs text-slate-600 md:hidden dark:text-slate-400">
          {formatTxDate(tx.createdAt)}
        </time>
      </div>

      <time dateTime={tx.createdAt} className="hidden text-sm text-slate-600 md:block dark:text-slate-400">
        {formatTxDate(tx.createdAt)}
      </time>
      <div className="hidden md:block">
        <StatusBadge status={tx.status} />
      </div>

      <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
        <Money
          kobo={isCredit ? tx.amountKobo : -tx.amountKobo}
          signed
          className={`font-bold ${tx.status === 'failed' ? 'text-slate-500 line-through dark:text-slate-400' : isCredit ? 'text-green-700 dark:text-green-400' : ''}`}
        />
        {tx.feeKobo > 0 && (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            + <Money kobo={tx.feeKobo} /> fee
          </span>
        )}
        <span className="md:hidden">
          <StatusBadge status={tx.status} />
        </span>
      </div>
    </article>
  );
});

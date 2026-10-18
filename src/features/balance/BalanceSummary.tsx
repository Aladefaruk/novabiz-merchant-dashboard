import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { ErrorState, Skeleton } from '../../components/AsyncStates';
import { Money } from '../../components/Money';
import { card } from '../../components/ui';
import { useBalance } from '../../hooks/useBalance';

const timeFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });

export function BalanceSummary() {
  const { data, displayedKobo, pendingKobo, pendingCount, isPending, isError, error, refetch } = useBalance();

  if (isPending) {
    return (
      <section aria-label="Balance summary" aria-busy="true" className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <span className="sr-only" role="status">Loading balance…</span>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </section>
    );
  }

  // Full error only when there's nothing to show. A failed background refresh keeps the last balance.
  if (!data || displayedKobo === undefined) {
    return <ErrorState title="We couldn’t load your balance" error={error} onRetry={() => void refetch()} />;
  }

  return (
    <section aria-label="Balance summary" className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
      <div className="flex min-h-40 flex-col justify-between gap-2 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 p-5 text-white shadow-sm ring-2 ring-gold-500/60">
        <p className="text-xs font-semibold tracking-widest text-gold-300 uppercase">Available balance</p>
        <p className="text-3xl font-extrabold break-words sm:text-4xl" data-testid="available-balance">
          <Money kobo={displayedKobo} />
        </p>
        <p className="text-sm text-slate-300">
          {isError ? (
            <>
              Couldn’t refresh — showing balance from {timeFormatter.format(new Date(data.asOf))} WAT.{' '}
              <button type="button" className="font-semibold underline" onClick={() => void refetch()}>
                Retry
              </button>
            </>
          ) : pendingCount > 0 ? (
            <span className="text-gold-300" data-testid="balance-pending">
              <Money kobo={pendingKobo} /> held for {pendingCount} transfer{pendingCount > 1 ? 's' : ''} in progress
            </span>
          ) : (
            <>Updated {timeFormatter.format(new Date(data.asOf))} WAT</>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-1">
        <Stat label="Money in today" Icon={ArrowDownLeft} iconClass="text-green-700 dark:text-green-400" kobo={data.todayInflowKobo} count={data.todayInflowCount} noun="payment" />
        <Stat label="Money out today" Icon={ArrowUpRight} iconClass="text-red-700 dark:text-red-400" kobo={data.todayOutflowKobo} count={data.todayOutflowCount} noun="transfer" />
      </dl>
    </section>
  );
}

interface StatProps {
  label: string;
  Icon: typeof ArrowDownLeft;
  iconClass: string;
  kobo: number;
  count: number;
  noun: string;
}

function Stat({ label, Icon, iconClass, kobo, count, noun }: StatProps) {
  return (
    <div className={card}>
      <dt className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <Icon aria-hidden className={`size-4 ${iconClass}`} /> {label}
      </dt>
      <dd className="mt-1">
        <Money kobo={kobo} className="block text-lg font-bold break-words sm:text-xl" />
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {count === 0 ? `No ${noun}s yet today` : `${count} ${noun}${count > 1 ? 's' : ''}`}
        </span>
      </dd>
    </div>
  );
}

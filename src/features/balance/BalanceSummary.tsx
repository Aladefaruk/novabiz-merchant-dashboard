import { ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ErrorState, Skeleton } from '../../shared/components/AsyncStates';
import { Money } from '../../shared/components/Money';
import { useBalance } from './useBalance';
import { MERCHANT_KYC_TIER } from '../../shared/lib/fees';

const timeFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });

export function BalanceSummary() {
  const { data, displayedKobo, pendingKobo, pendingCount, isPending, isError, error, refetch } = useBalance();

  if (isPending) {
    return (
      <section aria-label="Balance summary" aria-busy="true">
        <span className="sr-only" role="status">Loading balance…</span>
        <Skeleton className="h-64 rounded-2xl sm:h-56" />
      </section>
    );
  }

  // Full error only when there's nothing to show. A failed background refresh keeps the last balance.
  if (!data || displayedKobo === undefined) {
    return <ErrorState title="We couldn’t load your balance" error={error} onRetry={() => void refetch()} />;
  }

  return (
    <section
      aria-label="Balance summary"
      className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 p-5 text-white shadow-sm ring-2 ring-gold-500/60 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-widest text-gold-300 uppercase">Available balance</p>
        <p className="inline-flex items-center gap-1 rounded-full border border-gold-400/70 px-2.5 py-0.5 text-xs font-bold text-gold-300">
          <ShieldCheck aria-hidden className="size-3.5" />
          KYC Tier {MERCHANT_KYC_TIER}
        </p>
      </div>

      <div className="space-y-1">
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

      {/* Phones: one row per total (label left, amount right). From sm: side by side. */}
      <dl className="grid gap-2 border-t border-white/15 pt-4 sm:grid-cols-2 sm:gap-3">
        <Stat label="Money in today" Icon={ArrowDownLeft} iconClass="text-green-400" kobo={data.todayInflowKobo} count={data.todayInflowCount} noun="payment" />
        <Stat label="Money out today" Icon={ArrowUpRight} iconClass="text-red-400" kobo={data.todayOutflowKobo} count={data.todayOutflowCount} noun="transfer" />
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
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/5 p-3 sm:block sm:p-4">
      <dt className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
        <Icon aria-hidden className={`size-4 shrink-0 ${iconClass}`} /> {label}
      </dt>
      <dd className="text-right sm:mt-1 sm:text-left">
        {/* nowrap: an amount must never split across lines ("₦1,597,738.9" / "3"). */}
        <Money kobo={kobo} className="block text-base font-bold whitespace-nowrap sm:text-xl" />
        <span className="text-xs text-slate-300">
          {count === 0 ? `No ${noun}s yet today` : `${count} ${noun}${count > 1 ? 's' : ''}`}
        </span>
      </dd>
    </div>
  );
}

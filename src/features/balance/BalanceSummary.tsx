import { useState } from 'react';
import { ErrorState, Skeleton } from '../../components/AsyncStates';
import { Icon } from '../../components/Icon';
import { Money } from '../../components/Money';
import { useBalance } from '../../hooks/useBalance';

const HIDE_KEY = 'novabiz:hide-balance';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

const timeFormatter = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });

export function BalanceSummary() {
  const { data, displayedKobo, pendingKobo, pendingCount, isPending, isError, error, refetch, isFetching } = useBalance();
  // Merchants check balances at a busy counter — let them hide the figure from shoulder-surfers.
  const [hidden, setHidden] = useState(readHidden);

  const toggleHidden = () => {
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !h;
    });
  };

  if (isPending) {
    return (
      <section className="balance" aria-labelledby="balance-heading" aria-busy="true">
        <h2 id="balance-heading" className="visually-hidden">Balance summary</h2>
        <div className="balance__main">
          <p className="balance__label">Available balance</p>
          <Skeleton width="60%" height={40} className="skeleton--on-brand" />
          <span className="visually-hidden" role="status">Loading balance…</span>
        </div>
        <div className="balance__stats">
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      </section>
    );
  }

  // Full error screen only when we have NOTHING to show. A failed background
  // refresh keeps the last known balance on screen with a staleness note.
  if (!data || displayedKobo === undefined) {
    return (
      <section className="balance balance--error" aria-labelledby="balance-heading">
        <h2 id="balance-heading">Balance summary</h2>
        <ErrorState title="We couldn’t load your balance" error={error} onRetry={() => void refetch()} />
      </section>
    );
  }

  return (
    <section className="balance" aria-labelledby="balance-heading">
      <h2 id="balance-heading" className="visually-hidden">Balance summary</h2>
      <div className="balance__main">
        <div className="balance__top">
          <p className="balance__label">Available balance</p>
          <button
            type="button"
            className="icon-btn icon-btn--on-brand"
            onClick={toggleHidden}
            aria-pressed={hidden}
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
          >
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={18} />
          </button>
        </div>
        <p className="balance__amount" data-testid="available-balance">
          {hidden ? (
            <span>
              <span aria-hidden="true">₦ ••••••</span>
              <span className="visually-hidden">Balance hidden</span>
            </span>
          ) : (
            <Money kobo={displayedKobo} />
          )}
        </p>
        <p className="balance__meta">
          {isError ? (
            <span className="balance__stale" role="status">
              Couldn’t refresh — showing balance from {timeFormatter.format(new Date(data.asOf))} WAT.{' '}
              <button type="button" className="link-btn link-btn--on-brand" onClick={() => void refetch()}>
                Retry
              </button>
            </span>
          ) : pendingCount > 0 ? (
            <span className="balance__pending" data-testid="balance-pending">
              <Money kobo={pendingKobo} /> held for {pendingCount === 1 ? '1 transfer' : `${pendingCount} transfers`} in progress
            </span>
          ) : (
            <span>
              Updated {timeFormatter.format(new Date(data.asOf))} WAT{isFetching ? ' · refreshing…' : ''}
            </span>
          )}
        </p>
      </div>

      <dl className="balance__stats">
        <div className="stat stat--in">
          <dt>
            <Icon name="arrowDown" size={16} /> Money in today
          </dt>
          <dd>
            <Money kobo={data.todayInflowKobo} className="stat__value" />
            <span className="stat__sub">
              {data.todayInflowCount === 0 ? 'No payments yet today' : `${data.todayInflowCount} payment${data.todayInflowCount === 1 ? '' : 's'}`}
            </span>
          </dd>
        </div>
        <div className="stat stat--out">
          <dt>
            <Icon name="arrowUp" size={16} /> Money out today
          </dt>
          <dd>
            <Money kobo={data.todayOutflowKobo} className="stat__value" />
            <span className="stat__sub">
              {data.todayOutflowCount === 0 ? 'No transfers yet today' : `${data.todayOutflowCount} transfer${data.todayOutflowCount === 1 ? '' : 's'} incl. fees`}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

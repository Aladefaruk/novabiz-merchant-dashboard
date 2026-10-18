import { Icon } from '../../components/Icon';
import { Money } from '../../components/Money';
import { StatusBadge } from '../../components/StatusBadge';
import { usePendingTransfers } from '../../hooks/useTransfer';
import { toSafeDisplayText } from '../../lib/sanitize';

/** Optimistic rows: transfers the merchant just submitted that the server hasn't confirmed yet. */
export function PendingTransfers() {
  const pending = usePendingTransfers();
  if (pending.length === 0) return null;

  return (
    <ul className="pending-list" aria-label="Transfers in progress">
      {pending.map((p) => (
        <li key={p.idempotencyKey} className="tx-row tx-row--debit tx-row--optimistic" data-testid="optimistic-row">
          <span className="tx-row__icon tx-row__icon--debit" aria-hidden="true">
            <Icon name="send" size={16} />
          </span>
          <div className="tx-row__main">
            <p className="tx-row__title">
              <span className="visually-hidden">Sending to </span>
              {toSafeDisplayText(p.accountName, 60)}
            </p>
            <p className="tx-row__desc">{toSafeDisplayText(p.narration) || p.bankName}</p>
          </div>
          <div className="tx-row__meta">
            <span className="tx-row__channel">Transfer</span>
            <span>Just now</span>
          </div>
          <div className="tx-row__status">
            <StatusBadge status="processing" />
          </div>
          <div className="tx-row__amount">
            <Money kobo={-p.amountKobo} signed className="amount amount--debit" />
            <span className="tx-row__fee">
              + <Money kobo={p.feeKobo} /> fee
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

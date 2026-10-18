import { memo } from 'react';
import type { Transaction, TxChannel } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Money } from '../../components/Money';
import { StatusBadge } from '../../components/StatusBadge';
import { formatTxDate, formatTxDateLong } from '../../lib/dates';
import { toSafeDisplayText } from '../../lib/sanitize';

const CHANNEL_LABEL: Record<TxChannel, string> = {
  qr: 'QR',
  pos: 'POS',
  transfer: 'Transfer',
  ussd: 'USSD',
  remittance: 'Remittance',
};

interface Props {
  tx: Transaction;
  index: number;
  setSize: number;
}

/**
 * Memoised: with 1,000+ rows loaded and a virtualizer re-rendering on scroll,
 * rows only re-render when their own transaction object changes.
 * All free text goes through toSafeDisplayText and is rendered as a React text node.
 */
export const TransactionRow = memo(function TransactionRow({ tx, index, setSize }: Props) {
  const description = toSafeDisplayText(tx.description);
  const counterparty = toSafeDisplayText(tx.counterparty.name, 60);
  const isCredit = tx.type === 'credit';
  const headingId = `tx-${tx.id}-title`;

  return (
    <article
      className={`tx-row tx-row--${tx.type} tx-row--${tx.status}`}
      aria-labelledby={headingId}
      aria-posinset={index + 1}
      aria-setsize={setSize}
      tabIndex={0}
    >
      <span className={`tx-row__icon tx-row__icon--${tx.type}`} aria-hidden="true">
        <Icon name={isCredit ? 'arrowDown' : 'arrowUp'} size={18} />
      </span>

      <div className="tx-row__main">
        <h3 id={headingId} className="tx-row__title">
          <span className="visually-hidden">{isCredit ? 'Received from' : 'Sent to'} </span>
          {counterparty}
        </h3>
        <p className="tx-row__desc" title={description}>
          {description}
        </p>
      </div>

      <div className="tx-row__meta">
        <span className="tx-row__channel">{CHANNEL_LABEL[tx.channel]}</span>
        <time dateTime={tx.createdAt} title={formatTxDateLong(tx.createdAt)}>
          {formatTxDate(tx.createdAt)}
        </time>
      </div>

      <div className="tx-row__status">
        <StatusBadge status={tx.status} />
      </div>

      <div className="tx-row__amount">
        <Money kobo={isCredit ? tx.amountKobo : -tx.amountKobo} signed className={`amount amount--${tx.type}`} />
        {tx.feeKobo > 0 && (
          <span className="tx-row__fee">
            + <Money kobo={tx.feeKobo} /> fee
          </span>
        )}
      </div>
    </article>
  );
});

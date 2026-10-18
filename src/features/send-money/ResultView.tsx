import type { RefObject } from 'react';
import type { ApiError } from '../../api/client';
import type { TransferResponse } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Money } from '../../components/Money';
import { MAX_TRANSFER_ATTEMPTS } from '../../hooks/useTransfer';
import type { Kobo } from '../../lib/money';

interface Props {
  status: 'idle' | 'pending' | 'success' | 'error';
  isPaused: boolean;
  failureCount: number;
  data?: TransferResponse;
  error: ApiError | null;
  amountKobo: Kobo;
  accountName: string;
  headingRef: RefObject<HTMLHeadingElement>;
  onRetry: () => void;
  onEdit: () => void;
  onDone: () => void;
}

export function ResultView({ status, isPaused, failureCount, data, error, amountKobo, accountName, headingRef, onRetry, onEdit, onDone }: Props) {
  if (status === 'pending' || status === 'idle') {
    const message = isPaused
      ? 'Waiting for network… your transfer will be sent when you’re back online.'
      : failureCount > 0
        ? `Connection problem — retrying safely (attempt ${failureCount + 1} of ${MAX_TRANSFER_ATTEMPTS})…`
        : 'Sending…';
    return (
      <div className="result result--pending">
        <span className="spinner spinner--lg" aria-hidden="true" />
        <h3 ref={headingRef} tabIndex={-1} className="step__title">
          Sending <Money kobo={amountKobo} /> to {accountName}
        </h3>
        <p role="status" data-testid="transfer-status">
          {message}
        </p>
      </div>
    );
  }

  if (status === 'success' && data) {
    return (
      <div className="result result--success">
        <span className="result__icon result__icon--success" aria-hidden="true">
          <Icon name="check" size={32} />
        </span>
        <h3 ref={headingRef} tabIndex={-1} className="step__title">
          Transfer successful
        </h3>
        <p role="status" data-testid="transfer-status">
          <Money kobo={data.transaction.amountKobo} /> sent to {accountName}.
        </p>
        <dl className="result__details">
          <div>
            <dt>Reference</dt>
            <dd>
              <code>{data.transaction.reference}</code>
            </dd>
          </div>
          <div>
            <dt>Fee</dt>
            <dd>
              <Money kobo={data.transaction.feeKobo} />
            </dd>
          </div>
        </dl>
        <div className="step__actions">
          <button type="button" className="btn btn--primary" onClick={onDone}>
            Send another transfer
          </button>
        </div>
      </div>
    );
  }

  // Error
  const ambiguous = error?.isAmbiguous ?? false;
  return (
    <div className="result result--error">
      <span className="result__icon result__icon--error" aria-hidden="true">
        <Icon name="alert" size={32} />
      </span>
      <h3 ref={headingRef} tabIndex={-1} className="step__title">
        {ambiguous ? 'We couldn’t confirm this transfer' : 'Transfer failed'}
      </h3>
      <div role="alert" data-testid="transfer-status">
        {ambiguous ? (
          <p>
            We lost contact with NovaPay before getting a final answer. Your balance and transactions have been refreshed from
            the server — check them before trying again. <strong>Trying again is safe:</strong> it reuses the same transfer
            reference, so you can’t be debited twice.
          </p>
        ) : (
          <p>
            {error?.message ?? 'The transfer was declined.'} <strong>No money left your account.</strong>
          </p>
        )}
      </div>
      <div className="step__actions">
        <button type="button" className="btn btn--ghost" onClick={onEdit}>
          Edit transfer
        </button>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          {ambiguous ? 'Check & retry' : 'Try again'}
        </button>
      </div>
      <p className="step__note">
        <Icon name="phone" size={14} /> Poor connection? You can also transfer by dialling <strong>*894#</strong>.
      </p>
    </div>
  );
}

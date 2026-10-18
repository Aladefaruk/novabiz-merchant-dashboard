import type { Dispatch, RefObject } from 'react';
import { Money } from '../../components/Money';
import { useBalance } from '../../hooks/useBalance';
import { nipTransferFee } from '../../lib/fees';
import { newIdempotencyKey } from '../../lib/idempotency';
import { addKobo, parseNairaInput, toKobo } from '../../lib/money';
import { toSafeDisplayText } from '../../lib/sanitize';
import type { Action, SendMoneyState } from './state';

interface Props {
  state: SendMoneyState;
  dispatch: Dispatch<Action>;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function ReviewStep({ state, dispatch, headingRef }: Props) {
  const { draft } = state;
  const { displayedKobo } = useBalance();
  const parsed = parseNairaInput(draft.amountInput);
  if (!parsed.ok) return null; // unreachable: AmountStep blocks invalid input
  const fee = nipTransferFee(parsed.kobo);
  const total = addKobo(parsed.kobo, fee);

  const onContinue = () => {
    // Generate the key ONCE per intent; editing the draft clears it (see reducer).
    if (!state.idempotencyKey) dispatch({ type: 'setKey', key: newIdempotencyKey() });
    dispatch({ type: 'go', step: 'confirm' });
  };

  return (
    <div className="step">
      <h3 ref={headingRef} tabIndex={-1} className="step__title">
        Review your transfer
      </h3>

      <dl className="review">
        <div className="review__row">
          <dt>Recipient</dt>
          <dd>
            <strong>{draft.accountName}</strong>
            <span>
              {draft.bankName} · {draft.accountNumber}
            </span>
          </dd>
          <button type="button" className="link-btn" onClick={() => dispatch({ type: 'go', step: 'recipient' })} aria-label="Change recipient">
            Change
          </button>
        </div>
        <div className="review__row">
          <dt>Amount</dt>
          <dd>
            <Money kobo={parsed.kobo} />
          </dd>
          <button type="button" className="link-btn" onClick={() => dispatch({ type: 'go', step: 'amount' })} aria-label="Change amount">
            Change
          </button>
        </div>
        <div className="review__row">
          <dt>Fee</dt>
          <dd>
            <Money kobo={fee} />
          </dd>
        </div>
        {draft.narration && (
          <div className="review__row">
            <dt>Narration</dt>
            <dd>{toSafeDisplayText(draft.narration)}</dd>
          </div>
        )}
        <div className="review__row review__row--total">
          <dt>Total debit</dt>
          <dd>
            <Money kobo={total} />
          </dd>
        </div>
        {displayedKobo !== undefined && (
          <div className="review__row review__row--muted">
            <dt>Balance after</dt>
            <dd>
              <Money kobo={toKobo(displayedKobo - total)} />
            </dd>
          </div>
        )}
      </dl>

      <p className="step__note">Transfers over NIP are instant and can’t be reversed once successful. Check the name carefully.</p>

      <div className="step__actions">
        <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'go', step: 'amount' })}>
          Back
        </button>
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          Continue to confirm
        </button>
      </div>
    </div>
  );
}

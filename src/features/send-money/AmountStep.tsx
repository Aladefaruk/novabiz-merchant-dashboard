import { useState, type Dispatch, type FormEvent, type RefObject } from 'react';
import { Field } from '../../components/Field';
import { Money } from '../../components/Money';
import { useBalance } from '../../hooks/useBalance';
import { nipTransferFee } from '../../lib/fees';
import { addKobo, parseNairaInput } from '../../lib/money';
import { NARRATION_MAX_LENGTH } from '../../lib/sanitize';
import { validateAmount, validateNarration } from '../../lib/validation';
import type { Action, Draft } from './state';

interface Props {
  draft: Draft;
  dispatch: Dispatch<Action>;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function AmountStep({ draft, dispatch, headingRef }: Props) {
  const [showErrors, setShowErrors] = useState(false);
  const { displayedKobo } = useBalance();

  const amount = validateAmount(draft.amountInput, displayedKobo);
  const narrationError = validateNarration(draft.narration);
  const parsed = parseNairaInput(draft.amountInput);
  const fee = parsed.ok ? nipTransferFee(parsed.kobo) : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (amount.error || narrationError) return;
    dispatch({ type: 'go', step: 'review' });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="step">
      <h3 ref={headingRef} tabIndex={-1} className="step__title">
        How much are you sending to <span className="nowrap">{draft.accountName}</span>?
      </h3>

      <Field
        label="Amount (₦)"
        required
        error={showErrors ? amount.error : null}
        hint={
          displayedKobo !== undefined ? (
            <>
              Available: <Money kobo={displayedKobo} />
            </>
          ) : undefined
        }
      >
        {(control) => (
          <div className="input-affix">
            <span className="input-affix__prefix" aria-hidden="true">
              ₦
            </span>
            <input
              {...control}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={draft.amountInput}
              onChange={(e) => dispatch({ type: 'update', patch: { amountInput: e.target.value.replace(/[^\d.,]/g, '') } })}
            />
          </div>
        )}
      </Field>

      {parsed.ok && fee !== null && (
        <dl className="fee-preview" aria-live="polite">
          <div>
            <dt>Transfer fee (NIP, incl. VAT)</dt>
            <dd>
              <Money kobo={fee} />
            </dd>
          </div>
          <div className="fee-preview__total">
            <dt>Total debit</dt>
            <dd>
              <Money kobo={addKobo(parsed.kobo, fee)} />
            </dd>
          </div>
        </dl>
      )}

      <Field
        label="Narration (optional)"
        error={narrationError}
        hint={`${draft.narration.length}/${NARRATION_MAX_LENGTH} — appears on the recipient’s statement`}
      >
        {(control) => (
          <input
            {...control}
            type="text"
            autoComplete="off"
            maxLength={NARRATION_MAX_LENGTH}
            placeholder="e.g. Payment for flour supply"
            value={draft.narration}
            onChange={(e) => dispatch({ type: 'update', patch: { narration: e.target.value } })}
          />
        )}
      </Field>

      <div className="step__actions">
        <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'go', step: 'recipient' })}>
          Back
        </button>
        <button type="submit" className="btn btn--primary">
          Review transfer
        </button>
      </div>
    </form>
  );
}

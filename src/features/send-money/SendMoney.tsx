import { useEffect, useReducer, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useTransfer, type TransferVariables } from '../../hooks/useTransfer';
import { nipTransferFee } from '../../lib/fees';
import { addKobo, parseNairaInput } from '../../lib/money';
import { AmountStep } from './AmountStep';
import { ConfirmStep } from './ConfirmStep';
import { RecipientStep } from './RecipientStep';
import { ResultView } from './ResultView';
import { ReviewStep } from './ReviewStep';
import { INITIAL_STATE, STEPS, reducer } from './state';

export function SendMoney() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [serverPinError, setServerPinError] = useState<string | null>(null);
  const transfer = useTransfer();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the new step's heading so keyboard & screen-reader users land in context.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [state.step, transfer.status]);

  const { draft, step, idempotencyKey } = state;
  const parsed = parseNairaInput(draft.amountInput);
  const amountKobo = parsed.ok ? parsed.kobo : null;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const submit = (vars: TransferVariables) => {
    setServerPinError(null);
    dispatch({ type: 'go', step: 'result' });
    transfer.mutate(vars, {
      onError: (err) => {
        // Wrong PIN is a definite, user-fixable rejection: send them straight back to the PIN.
        if (err.code === 'INVALID_PIN') {
          setServerPinError(err.message);
          dispatch({ type: 'go', step: 'confirm' });
        }
      },
    });
  };

  const onConfirm = (pin: string) => {
    if (!idempotencyKey || amountKobo === null) return;
    submit({
      idempotencyKey,
      bankCode: draft.bankCode,
      bankName: draft.bankName,
      accountNumber: draft.accountNumber,
      accountName: draft.accountName,
      amountKobo,
      feeKobo: nipTransferFee(amountKobo),
      narration: draft.narration.trim(),
      pin,
    });
  };

  const reset = () => {
    transfer.reset();
    setServerPinError(null);
    dispatch({ type: 'reset' });
  };

  return (
    <section className="card send" aria-labelledby="send-heading">
      <div className="card__header">
        <h2 id="send-heading">
          <Icon name="send" size={20} /> Send money
        </h2>
      </div>

      {step !== 'result' && (
        <ol className="stepper" aria-label="Transfer progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`stepper__item${i < stepIndex ? ' is-done' : ''}${i === stepIndex ? ' is-current' : ''}`}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              <span className="stepper__num" aria-hidden="true">
                {i < stepIndex ? '✓' : i + 1}
              </span>
              <span className="stepper__label">{s.label}</span>
              <span className="visually-hidden">{i < stepIndex ? ' (completed)' : ''}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Polite announcement of step changes for screen readers. */}
      <p className="visually-hidden" aria-live="polite">
        {stepIndex >= 0 ? `Step ${stepIndex + 1} of ${STEPS.length}: ${STEPS[stepIndex]!.label}` : ''}
      </p>

      {step === 'recipient' && <RecipientStep draft={draft} dispatch={dispatch} headingRef={headingRef} />}
      {step === 'amount' && <AmountStep draft={draft} dispatch={dispatch} headingRef={headingRef} />}
      {step === 'review' && <ReviewStep state={state} dispatch={dispatch} headingRef={headingRef} />}
      {step === 'confirm' && idempotencyKey && amountKobo !== null && (
        <ConfirmStep
          draft={draft}
          amountKobo={amountKobo}
          totalKobo={addKobo(amountKobo, nipTransferFee(amountKobo))}
          idempotencyKey={idempotencyKey}
          serverPinError={serverPinError}
          dispatch={dispatch}
          onSubmit={onConfirm}
          headingRef={headingRef}
        />
      )}
      {step === 'result' && amountKobo !== null && (
        <ResultView
          status={transfer.status}
          isPaused={transfer.isPaused}
          failureCount={transfer.failureCount}
          data={transfer.data}
          error={transfer.error}
          amountKobo={amountKobo}
          accountName={draft.accountName}
          headingRef={headingRef}
          // Retry re-submits the SAME variables => same Idempotency-Key.
          onRetry={() => transfer.variables && submit(transfer.variables)}
          onEdit={() => {
            transfer.reset();
            dispatch({ type: 'go', step: 'amount' });
          }}
          onDone={reset}
        />
      )}
    </section>
  );
}

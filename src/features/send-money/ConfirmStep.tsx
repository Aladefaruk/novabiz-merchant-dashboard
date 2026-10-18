import { useState, type Dispatch, type FormEvent, type RefObject } from 'react';
import { Field } from '../../components/Field';
import { Money } from '../../components/Money';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { Kobo } from '../../lib/money';
import { validatePin } from '../../lib/validation';
import type { Action, Draft } from './state';

interface Props {
  draft: Draft;
  totalKobo: Kobo;
  amountKobo: Kobo;
  idempotencyKey: string;
  serverPinError: string | null;
  dispatch: Dispatch<Action>;
  onSubmit: (pin: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function ConfirmStep({ draft, amountKobo, totalKobo, idempotencyKey, serverPinError, dispatch, onSubmit, headingRef }: Props) {
  const [pin, setPin] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const online = useOnlineStatus();
  const pinError = showErrors ? validatePin(pin) : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (validatePin(pin)) return;
    onSubmit(pin);
    setPin(''); // never keep the PIN in component state after use
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="step">
      <h3 ref={headingRef} tabIndex={-1} className="step__title">
        Confirm with your PIN
      </h3>
      <p className="step__lead">
        You’re sending <strong><Money kobo={amountKobo} /></strong> to <strong>{draft.accountName}</strong>. Total debit{' '}
        <Money kobo={totalKobo} />.
      </p>

      <Field label="Transaction PIN" required error={pinError ?? serverPinError} hint="Demo PIN: 1234">
        {(control) => (
          <input
            {...control}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className="pin-input"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        )}
      </Field>

      {!online && (
        <p className="step__note step__note--warn" role="status">
          You’re offline. Your transfer will be sent automatically when you reconnect — it can only go through once.
        </p>
      )}

      <p className="step__ref">
        Transfer reference <code>{idempotencyKey.slice(0, 8).toUpperCase()}</code>
      </p>

      <div className="step__actions">
        <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'go', step: 'review' })}>
          Back
        </button>
        <button type="submit" className="btn btn--primary">
          Send <Money kobo={amountKobo} />
        </button>
      </div>
    </form>
  );
}

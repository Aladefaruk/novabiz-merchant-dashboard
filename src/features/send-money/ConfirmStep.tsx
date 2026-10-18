import { useState, type FormEvent } from 'react';
import { Money } from '../../components/Money';
import { btnGhost, btnPrimary, errorText, hint, input, label } from '../../components/ui';
import type { Kobo } from '../../lib/money';
import type { StepProps } from './SendMoney';

interface Props extends StepProps {
  amountKobo: Kobo;
  accountName: string;
  reference: string;
  serverError: string | null;
  onBack: () => void;
  onSubmit: (pin: string) => void;
}

/** The PIN lives only in this component's state and is cleared as soon as it's submitted. */
export function ConfirmStep({ headingRef, amountKobo, accountName, reference, serverError, onBack, onSubmit }: Props) {
  const [pin, setPin] = useState('');
  const [touched, setTouched] = useState(false);
  const error = touched && !/^\d{4}$/.test(pin) ? 'Enter your 4-digit transaction PIN.' : serverError;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!/^\d{4}$/.test(pin)) return;
    onSubmit(pin);
    setPin('');
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">Confirm with your PIN</h3>
      <p className="text-slate-600 dark:text-slate-400">
        Sending <strong className="text-slate-900 dark:text-white"><Money kobo={amountKobo} /></strong> to{' '}
        <strong className="text-slate-900 dark:text-white">{accountName}</strong>.
      </p>
      <div>
        <label htmlFor="pin" className={label}>Transaction PIN</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          className={`${input} max-w-48 text-2xl tracking-[0.5em]`}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!!error}
          aria-describedby={error ? 'pin-error' : 'pin-hint'}
        />
        {error ? <p id="pin-error" className={errorText}>{error}</p> : <p id="pin-hint" className={hint}>Demo PIN: 1234</p>}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Transfer reference <code>{reference.slice(0, 8).toUpperCase()}</code>
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onBack}>Back</button>
        <button type="submit" className={btnPrimary}>Send <Money kobo={amountKobo} /></button>
      </div>
    </form>
  );
}

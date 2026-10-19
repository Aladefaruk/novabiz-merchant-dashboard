import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Money } from '../../shared/components/Money';
import { btnGhost, btnPrimary, errorText, hint, input, label } from '../../shared/components/ui';
import { useBalance } from '../balance/useBalance';
import { nipTransferFee } from '../../shared/lib/fees';
import { addKobo, parseNairaInput } from '../../shared/lib/money';
import type { StepProps } from './SendMoney';
import { checkAmount, type TransferForm } from './schema';

/** Common reasons a small merchant sends money. Each must pass the narration rule in schema.ts. */
const NARRATION_PRESETS = [
  'Payment for goods',
  'Supplier payment',
  'Stock purchase',
  'Shop rent',
  'Staff salary',
  'Transport and delivery',
  'Utility bill',
  'Customer refund',
];
const CUSTOM = '__custom__';

export function AmountStep({ headingRef, accountName, onBack, onNext }: StepProps & { accountName: string; onBack: () => void; onNext: () => void }) {
  const { register, watch, trigger, setError, setValue, setFocus, formState: { errors } } = useFormContext<TransferForm>();
  const { displayedKobo } = useBalance();
  const amountKobo = parseNairaInput(watch('amount'));
  const fee = amountKobo !== null ? nipTransferFee(amountKobo) : null;

  // The form only stores the final narration text. "Custom" is UI state, restored when coming Back to this step.
  const narration = watch('narration');
  const [custom, setCustom] = useState(() => narration !== '' && !NARRATION_PRESETS.includes(narration));
  const focusCustom = useRef(false);
  useEffect(() => {
    if (custom && focusCustom.current) setFocus('narration');
    focusCustom.current = false;
  }, [custom, setFocus]);

  const onNarrationChoice = (choice: string) => {
    const toCustom = choice === CUSTOM;
    focusCustom.current = toCustom;
    setCustom(toCustom);
    setValue('narration', toCustom ? '' : choice, { shouldValidate: true });
  };

  const onContinue = async () => {
    if (!(await trigger(['amount', 'narration'])) || amountKobo === null) return;
    const problem = checkAmount(amountKobo, displayedKobo);
    if (problem) return setError('amount', { message: problem }, { shouldFocus: true });
    onNext();
  };

  return (
    <div className="space-y-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        How much are you sending to {accountName}?
      </h3>

      <div>
        <label htmlFor="amount" className={label}>Amount (₦)</label>
        <input
          id="amount"
          className={`${input} text-xl font-bold`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? 'amount-error' : 'amount-hint'}
          {...register('amount')}
        />
        {errors.amount ? (
          <p id="amount-error" className={errorText}>{errors.amount.message}</p>
        ) : (
          displayedKobo !== undefined && (
            <p id="amount-hint" className={hint}>Available: <Money kobo={displayedKobo} /></p>
          )
        )}
      </div>

      {amountKobo !== null && fee !== null && (
        <dl aria-live="polite" className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-navy-800">
          <div className="flex justify-between"><dt>Transfer fee (NIP, incl. VAT)</dt><dd><Money kobo={fee} /></dd></div>
          <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 font-bold dark:border-navy-700"><dt>Total debit</dt><dd><Money kobo={addKobo(amountKobo, fee)} /></dd></div>
        </dl>
      )}

      <div>
        <label htmlFor="narration-choice" className={label}>Narration (optional)</label>
        <select id="narration-choice" className={input} value={custom ? CUSTOM : narration} onChange={(e) => onNarrationChoice(e.target.value)}>
          <option value="">No narration</option>
          {NARRATION_PRESETS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value={CUSTOM}>Custom narration…</option>
        </select>
      </div>

      {custom && (
        <div>
          <label htmlFor="narration" className={label}>Custom narration</label>
          <input
            id="narration"
            className={input}
            maxLength={60}
            autoComplete="off"
            placeholder="e.g. Payment for flour supply"
            aria-invalid={!!errors.narration}
            aria-describedby={errors.narration ? 'narration-error' : 'narration-hint'}
            {...register('narration')}
          />
          {errors.narration ? (
            <p id="narration-error" className={errorText}>{errors.narration.message}</p>
          ) : (
            <p id="narration-hint" className={hint}>Up to 60 characters. The recipient sees this on their statement.</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onBack}>Back</button>
        <button type="button" className={btnPrimary} onClick={() => void onContinue()}>Review transfer</button>
      </div>
    </div>
  );
}

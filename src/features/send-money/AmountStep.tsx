import { useFormContext } from 'react-hook-form';
import { Money } from '../../components/Money';
import { btnGhost, btnPrimary, errorText, hint, input, label } from '../../components/ui';
import { useBalance } from '../../hooks/useBalance';
import { nipTransferFee } from '../../lib/fees';
import { addKobo, parseNairaInput } from '../../lib/money';
import type { StepProps } from './SendMoney';
import { checkAmount, type TransferForm } from './schema';

export function AmountStep({ headingRef, accountName, onBack, onNext }: StepProps & { accountName: string; onBack: () => void; onNext: () => void }) {
  const { register, watch, trigger, setError, formState: { errors } } = useFormContext<TransferForm>();
  const { displayedKobo } = useBalance();
  const amountKobo = parseNairaInput(watch('amount'));
  const fee = amountKobo !== null ? nipTransferFee(amountKobo) : null;

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
        <label htmlFor="narration" className={label}>Narration (optional)</label>
        <input
          id="narration"
          className={input}
          maxLength={60}
          autoComplete="off"
          placeholder="e.g. Payment for flour supply"
          aria-invalid={!!errors.narration}
          aria-describedby={errors.narration ? 'narration-error' : undefined}
          {...register('narration')}
        />
        {errors.narration && <p id="narration-error" className={errorText}>{errors.narration.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onBack}>Back</button>
        <button type="button" className={btnPrimary} onClick={() => void onContinue()}>Review transfer</button>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { ApiError } from '../../shared/api/client';
import { api, queryKeys } from '../../shared/api/endpoints';
import { friendlyError } from '../../shared/components/AsyncStates';
import { btnPrimary, errorText, hint, input, label } from '../../shared/components/ui';
import type { StepProps } from './SendMoney';
import type { TransferForm } from './schema';

export function RecipientStep({ headingRef, onNext }: StepProps & { onNext: (accountName: string, bankName: string) => void }) {
  const { register, watch, trigger, formState: { errors } } = useFormContext<TransferForm>();
  const bankCode = watch('bankCode');
  const accountNumber = watch('accountNumber');

  const banks = useQuery({ queryKey: queryKeys.banks, queryFn: ({ signal }) => api.getBanks(signal), staleTime: Infinity });

  // NIP name enquiry: confirm WHO we're paying before any money moves.
  const canEnquire = Boolean(bankCode) && /^\d{10}$/.test(accountNumber);
  const enquiry = useQuery({
    queryKey: queryKeys.nameEnquiry(bankCode, accountNumber),
    queryFn: ({ signal }) => api.nameEnquiry(bankCode, accountNumber, signal),
    enabled: canEnquire,
    retry: false,
  });
  const notFound = enquiry.error instanceof ApiError && enquiry.error.status === 404;

  const onContinue = async () => {
    const valid = await trigger(['bankCode', 'accountNumber']);
    if (!valid || !enquiry.data) return;
    const bankName = banks.data?.find((b) => b.code === bankCode)?.name ?? '';
    onNext(enquiry.data.accountName, bankName);
  };

  return (
    <div className="space-y-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        Who are you sending to?
      </h3>

      <div>
        <label htmlFor="bankCode" className={label}>Bank</label>
        <select id="bankCode" className={input} disabled={banks.isPending} aria-invalid={!!errors.bankCode} aria-describedby={errors.bankCode ? 'bankCode-error' : undefined} {...register('bankCode')}>
          <option value="">{banks.isPending ? 'Loading banks…' : 'Select bank'}</option>
          {banks.data?.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
        {errors.bankCode && <p id="bankCode-error" className={errorText}>{errors.bankCode.message}</p>}
        {banks.isError && (
          <p role="alert" className={errorText}>
            Couldn’t load banks. <button type="button" className="underline" onClick={() => void banks.refetch()}>Retry</button>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="accountNumber" className={label}>Account number</label>
        <input
          id="accountNumber"
          className={input}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="0123456789"
          aria-invalid={!!errors.accountNumber}
          aria-describedby={errors.accountNumber ? 'accountNumber-error' : 'accountNumber-hint'}
          {...register('accountNumber')}
        />
        {errors.accountNumber ? (
          <p id="accountNumber-error" className={errorText}>{errors.accountNumber.message}</p>
        ) : (
          <p id="accountNumber-hint" className={hint}>10-digit NUBAN</p>
        )}
      </div>

      {/* Name-enquiry result is announced to screen readers as it arrives. */}
      <div aria-live="polite" className="min-h-7">
        {canEnquire && enquiry.isFetching && (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Verifying account…
          </p>
        )}
        {canEnquire && enquiry.data && !enquiry.isFetching && (
          <p data-testid="resolved-name" className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            <CheckCircle2 aria-hidden className="size-4" /> {enquiry.data.accountName}
          </p>
        )}
        {canEnquire && enquiry.isError && (
          <p className={errorText}>
            {notFound ? 'We couldn’t find an account with that number at this bank.' : friendlyError(enquiry.error)}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button type="button" className={btnPrimary} onClick={() => void onContinue()}>Continue</button>
      </div>
    </div>
  );
}

import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ApiError } from '../../api/client';
import type { TransferResponse } from '../../api/types';
import { Money } from '../../components/Money';
import { btnGhost, btnPrimary } from '../../components/ui';
import { MAX_TRANSFER_ATTEMPTS, type TransferVariables } from '../../hooks/useTransfer';
import type { Kobo } from '../../lib/money';
import type { StepProps } from './SendMoney';

interface Props extends StepProps {
  transfer: UseMutationResult<TransferResponse, ApiError, TransferVariables>;
  amountKobo: Kobo;
  accountName: string;
  onRetry: () => void;
  onEdit: () => void;
  onDone: () => void;
}

export function ResultView({ headingRef, transfer, amountKobo, accountName, onRetry, onEdit, onDone }: Props) {
  const box = 'flex flex-col items-center gap-3 py-2 text-center';

  if (transfer.isSuccess) {
    return (
      <div className={box}>
        <CheckCircle2 aria-hidden className="size-14 text-green-700 dark:text-green-400" />
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">Transfer successful</h3>
        <p role="status"><Money kobo={amountKobo} /> sent to {accountName}.</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">Reference <code>{transfer.data.transaction.reference}</code></p>
        <button type="button" className={btnPrimary} onClick={onDone}>Send another transfer</button>
      </div>
    );
  }

  if (transfer.isError) {
    // Ambiguous = timeout / network / 5xx: the server MAY have processed it.
    const ambiguous = transfer.error.isAmbiguous;
    return (
      <div className={box}>
        <AlertTriangle aria-hidden className="size-14 text-red-700 dark:text-red-400" />
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
          {ambiguous ? 'We couldn’t confirm this transfer' : 'Transfer failed'}
        </h3>
        <p role="alert" className="text-left text-sm text-slate-600 dark:text-slate-300">
          {ambiguous
            ? 'We lost contact before getting an answer. Your balance has been refreshed from the server. Trying again is safe — it reuses the same reference, so you can’t be charged twice.'
            : `${transfer.error.message} No money left your account.`}
        </p>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={onEdit}>Edit transfer</button>
          <button type="button" className={btnPrimary} onClick={onRetry}>Try again</button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">Poor connection? You can also dial *894#.</p>
      </div>
    );
  }

  const message = transfer.isPaused
    ? 'Waiting for network… it will send when you’re back online.'
    : transfer.failureCount > 0
      ? `Connection problem — retrying safely (attempt ${transfer.failureCount + 1} of ${MAX_TRANSFER_ATTEMPTS})…`
      : 'Sending…';
  return (
    <div className={box}>
      <Loader2 aria-hidden className="size-12 animate-spin text-gold-500" />
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        Sending <Money kobo={amountKobo} /> to {accountName}
      </h3>
      <p role="status">{message}</p>
    </div>
  );
}

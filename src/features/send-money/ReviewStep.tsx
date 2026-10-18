import type { ReactNode } from 'react';
import { Money } from '../../components/Money';
import { btnGhost, btnPrimary } from '../../components/ui';
import { useBalance } from '../../hooks/useBalance';
import { addKobo, toKobo, type Kobo } from '../../lib/money';
import { toSafeDisplayText } from '../../lib/sanitize';
import type { StepProps } from './SendMoney';

interface Props extends StepProps {
  accountName: string;
  bankName: string;
  accountNumber: string;
  amountKobo: Kobo;
  feeKobo: Kobo;
  narration: string;
  onBack: () => void;
  onNext: () => void;
}

export function ReviewStep({ headingRef, accountName, bankName, accountNumber, amountKobo, feeKobo, narration, onBack, onNext }: Props) {
  const { displayedKobo } = useBalance();
  const total = addKobo(amountKobo, feeKobo);

  return (
    <div className="space-y-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold">Review your transfer</h3>
      <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-navy-700 dark:border-navy-700">
        <Row label="Recipient">
          <strong>{accountName}</strong>
          <span className="block text-sm text-slate-600 dark:text-slate-400">{bankName} · {accountNumber}</span>
        </Row>
        <Row label="Amount"><Money kobo={amountKobo} /></Row>
        <Row label="Fee"><Money kobo={feeKobo} /></Row>
        {narration && <Row label="Narration">{toSafeDisplayText(narration)}</Row>}
        <Row label="Total debit"><strong><Money kobo={total} /></strong></Row>
        {displayedKobo !== undefined && <Row label="Balance after"><Money kobo={toKobo(displayedKobo - total)} /></Row>}
      </dl>
      <p className="text-sm text-slate-600 dark:text-slate-400">NIP transfers are instant and can’t be reversed. Check the name carefully.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onBack}>Back</button>
        <button type="button" className={btnPrimary} onClick={onNext}>Continue to confirm</button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2.5">
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right break-words">{children}</dd>
    </div>
  );
}

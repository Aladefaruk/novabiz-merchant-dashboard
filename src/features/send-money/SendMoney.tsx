import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { card } from '../../shared/components/ui';
import { useTransfer } from './useTransfer';
import { nipTransferFee } from '../../shared/lib/fees';
import { parseNairaInput } from '../../shared/lib/money';
import { AmountStep } from './AmountStep';
import { ConfirmStep } from './ConfirmStep';
import { RecipientStep } from './RecipientStep';
import { ResultView } from './ResultView';
import { ReviewStep } from './ReviewStep';
import { transferSchema, type TransferForm } from './schema';

export interface StepProps {
  headingRef: RefObject<HTMLHeadingElement>;
}

const STEPS = ['Recipient', 'Amount', 'Review', 'Confirm'] as const;
type Step = (typeof STEPS)[number] | 'Result';

const EMPTY: TransferForm = { bankCode: '', accountNumber: '', amount: '', narration: '' };

export function SendMoney() {
  const form = useForm<TransferForm>({ resolver: zodResolver(transferSchema), defaultValues: EMPTY, mode: 'onTouched' });
  const [step, setStep] = useState<Step>('Recipient');
  const [recipient, setRecipient] = useState({ accountName: '', bankName: '' });
  // One Idempotency-Key per transfer INTENT. `details` is what the key was made for;
  // if the merchant edits anything, the details no longer match and a new key is made.
  const [intent, setIntent] = useState<{ key: string; details: string } | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const transfer = useTransfer();

  // Move focus to the new step's heading so keyboard and screen-reader users land in context.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else headingRef.current?.focus();
  }, [step, transfer.status]);

  const values = form.watch();
  const amountKobo = parseNairaInput(values.amount);
  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);

  const goToConfirm = () => {
    const details = JSON.stringify([values.bankCode, values.accountNumber, recipient.accountName, amountKobo, values.narration]);
    if (intent?.details !== details) setIntent({ key: crypto.randomUUID(), details });
    setStep('Confirm');
  };

  const submit = (pin: string) => {
    if (!intent || amountKobo === null) return;
    setPinError(null);
    setStep('Result');
    transfer.mutate(
      {
        idempotencyKey: intent.key,
        bankCode: values.bankCode,
        bankName: recipient.bankName,
        accountNumber: values.accountNumber,
        accountName: recipient.accountName,
        amountKobo,
        feeKobo: nipTransferFee(amountKobo),
        narration: values.narration.trim(),
        pin,
      },
      {
        // A wrong PIN is a definite, fixable rejection: go straight back to the PIN step.
        onError: (err) => {
          if (err.code === 'INVALID_PIN') {
            setPinError(err.message);
            setStep('Confirm');
          }
        },
      },
    );
  };

  const startOver = () => {
    transfer.reset();
    form.reset(EMPTY);
    setIntent(null);
    setStep('Recipient');
  };

  return (
    <section aria-labelledby="send-heading" className={card}>
      <h2 id="send-heading" className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Send aria-hidden className="size-5 text-gold-700 dark:text-gold-400" /> Send money
      </h2>

      {step !== 'Result' && (
        <ol aria-label="Transfer progress" className="mb-5 grid grid-cols-4 gap-1 text-center text-xs">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === stepIndex ? 'step' : undefined} className={i === stepIndex ? 'font-bold' : 'text-slate-500 dark:text-slate-400'}>
              <span
                aria-hidden
                className={`mx-auto mb-1 grid size-7 place-items-center rounded-full border-2 font-bold ${
                  i < stepIndex ? 'border-gold-500 bg-gold-500 text-navy-950' : i === stepIndex ? 'border-navy-800 bg-navy-800 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950' : 'border-slate-400'
                }`}
              >
                {i < stepIndex ? '✓' : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      )}
      <p aria-live="polite" className="sr-only">
        {stepIndex >= 0 ? `Step ${stepIndex + 1} of 4: ${step}` : ''}
      </p>

      <FormProvider {...form}>
        {step === 'Recipient' && (
          <RecipientStep
            headingRef={headingRef}
            onNext={(accountName, bankName) => {
              setRecipient({ accountName, bankName });
              setStep('Amount');
            }}
          />
        )}
        {step === 'Amount' && (
          <AmountStep headingRef={headingRef} accountName={recipient.accountName} onBack={() => setStep('Recipient')} onNext={() => setStep('Review')} />
        )}
        {step === 'Review' && amountKobo !== null && (
          <ReviewStep
            headingRef={headingRef}
            accountName={recipient.accountName}
            bankName={recipient.bankName}
            accountNumber={values.accountNumber}
            amountKobo={amountKobo}
            feeKobo={nipTransferFee(amountKobo)}
            narration={values.narration}
            onBack={() => setStep('Amount')}
            onNext={goToConfirm}
          />
        )}
        {step === 'Confirm' && intent && amountKobo !== null && (
          <ConfirmStep
            headingRef={headingRef}
            amountKobo={amountKobo}
            accountName={recipient.accountName}
            reference={intent.key}
            serverError={pinError}
            onBack={() => setStep('Review')}
            onSubmit={submit}
          />
        )}
        {step === 'Result' && amountKobo !== null && (
          <ResultView
            headingRef={headingRef}
            transfer={transfer}
            amountKobo={amountKobo}
            accountName={recipient.accountName}
            // Retry re-sends the SAME variables, so the same Idempotency-Key.
            onRetry={() => transfer.variables && transfer.mutate(transfer.variables)}
            onEdit={() => {
              transfer.reset();
              setStep('Amount');
            }}
            onDone={startOver}
          />
        )}
      </FormProvider>
    </section>
  );
}

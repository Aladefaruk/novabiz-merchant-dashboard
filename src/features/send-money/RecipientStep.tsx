import { useQuery } from '@tanstack/react-query';
import { useState, type Dispatch, type FormEvent, type RefObject } from 'react';
import { ApiError } from '../../api/client';
import { api, queryKeys } from '../../api/endpoints';
import { friendlyError } from '../../components/AsyncStates';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { validateAccountNumber, validateBank } from '../../lib/validation';
import type { Action, Draft } from './state';

interface Props {
  draft: Draft;
  dispatch: Dispatch<Action>;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function RecipientStep({ draft, dispatch, headingRef }: Props) {
  const [showErrors, setShowErrors] = useState(false);
  const [accountTouched, setAccountTouched] = useState(false);

  const banks = useQuery({
    queryKey: queryKeys.banks,
    queryFn: ({ signal }) => api.getBanks(signal),
    staleTime: Infinity,
  });

  const bankError = validateBank(draft.bankCode);
  const accountError = validateAccountNumber(draft.accountNumber);
  const canEnquire = !bankError && !accountError;

  // NIP name enquiry: confirm WHO we're paying before any money moves.
  const enquiry = useQuery({
    queryKey: queryKeys.nameEnquiry(draft.bankCode, draft.accountNumber),
    queryFn: ({ signal }) => api.nameEnquiry(draft.bankCode, draft.accountNumber, signal),
    enabled: canEnquire,
    staleTime: 5 * 60_000,
    retry: (count, err) => err instanceof ApiError && err.isRetryable && count < 2,
  });

  const notFound = enquiry.error instanceof ApiError && enquiry.error.status === 404;
  const recipientError =
    canEnquire && enquiry.isError
      ? notFound
        ? 'We couldn’t find an account with that number at this bank. Check the details and try again.'
        : friendlyError(enquiry.error)
      : null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (bankError || accountError || !enquiry.data) return;
    dispatch({ type: 'update', patch: { accountName: enquiry.data.accountName } });
    dispatch({ type: 'go', step: 'amount' });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="step">
      <h3 ref={headingRef} tabIndex={-1} className="step__title">
        Who are you sending to?
      </h3>

      <Field label="Bank" required error={showErrors ? bankError : null} hint={banks.isError ? undefined : 'All NIBSS NIP banks & wallets'}>
        {(control) => (
          <>
            <select
              {...control}
              value={draft.bankCode}
              disabled={banks.isPending}
              onChange={(e) => {
                const bank = banks.data?.find((b) => b.code === e.target.value);
                dispatch({ type: 'update', patch: { bankCode: e.target.value, bankName: bank?.name ?? '', accountName: '' } });
              }}
            >
              <option value="">{banks.isPending ? 'Loading banks…' : 'Select bank'}</option>
              {banks.data?.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            {banks.isError && (
              <p className="field__error" role="alert">
                Couldn’t load banks.{' '}
                <button type="button" className="link-btn" onClick={() => void banks.refetch()}>
                  Retry
                </button>
              </p>
            )}
          </>
        )}
      </Field>

      <Field
        label="Account number"
        required
        hint="10-digit NUBAN"
        error={showErrors || (accountTouched && draft.accountNumber.length > 0) ? accountError : null}
      >
        {(control) => (
          <input
            {...control}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="0123456789"
            value={draft.accountNumber}
            onBlur={() => setAccountTouched(true)}
            onChange={(e) =>
              dispatch({ type: 'update', patch: { accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10), accountName: '' } })
            }
          />
        )}
      </Field>

      {/* Name-enquiry result is announced as it resolves. */}
      <div className="enquiry" aria-live="polite" aria-atomic="true">
        {canEnquire && enquiry.isFetching && (
          <p className="enquiry__pending">
            <span className="spinner" aria-hidden="true" /> Verifying account…
          </p>
        )}
        {canEnquire && enquiry.data && !enquiry.isFetching && (
          <p className="enquiry__ok" data-testid="resolved-name">
            <Icon name="check" size={16} />
            <span>
              <span className="visually-hidden">Account name: </span>
              {enquiry.data.accountName}
            </span>
          </p>
        )}
        {recipientError && !enquiry.isFetching && (
          <p className="field__error">
            {recipientError}{' '}
            {!notFound && (
              <button type="button" className="link-btn" onClick={() => void enquiry.refetch()}>
                Retry
              </button>
            )}
          </p>
        )}
      </div>

      <div className="step__actions">
        <button type="submit" className="btn btn--primary" disabled={showErrors && canEnquire && enquiry.isFetching}>
          Continue
        </button>
      </div>
      {showErrors && canEnquire && !enquiry.data && !enquiry.isError && !enquiry.isFetching && (
        <p className="field__error" role="alert">Wait for the account name to be verified.</p>
      )}
    </form>
  );
}

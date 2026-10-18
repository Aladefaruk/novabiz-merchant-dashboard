import { useId } from 'react';
import type { TransactionFilters, TxStatus, TxType } from '../../api/types';
import { lagosDateKey } from '../../lib/dates';
import { hasActiveFilters } from '../../lib/filters';

interface Props {
  filters: TransactionFilters;
  onChange: (next: TransactionFilters) => void;
}

export function FeedFilters({ filters, onChange }: Props) {
  const id = useId();
  const today = lagosDateKey(new Date());
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  const set = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K] | '') => {
    const next = { ...filters };
    if (value) next[key] = value as TransactionFilters[K];
    else delete next[key];
    onChange(next);
  };

  return (
    <form className="filters" role="search" aria-label="Filter transactions" onSubmit={(e) => e.preventDefault()}>
      <div className="field field--compact">
        <label htmlFor={`${id}-from`}>From</label>
        <input
          id={`${id}-from`}
          type="date"
          value={filters.from ?? ''}
          max={filters.to ?? today}
          onChange={(e) => set('from', e.target.value)}
          aria-invalid={rangeInvalid || undefined}
          aria-describedby={rangeInvalid ? `${id}-range-error` : undefined}
        />
      </div>
      <div className="field field--compact">
        <label htmlFor={`${id}-to`}>To</label>
        <input
          id={`${id}-to`}
          type="date"
          value={filters.to ?? ''}
          min={filters.from}
          max={today}
          onChange={(e) => set('to', e.target.value)}
          aria-invalid={rangeInvalid || undefined}
          aria-describedby={rangeInvalid ? `${id}-range-error` : undefined}
        />
      </div>
      <div className="field field--compact">
        <label htmlFor={`${id}-status`}>Status</label>
        <select id={`${id}-status`} value={filters.status ?? ''} onChange={(e) => set('status', e.target.value as TxStatus | '')}>
          <option value="">All statuses</option>
          <option value="successful">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="field field--compact">
        <label htmlFor={`${id}-type`}>Type</label>
        <select id={`${id}-type`} value={filters.type ?? ''} onChange={(e) => set('type', e.target.value as TxType | '')}>
          <option value="">Money in &amp; out</option>
          <option value="credit">Money in (credit)</option>
          <option value="debit">Money out (debit)</option>
        </select>
      </div>
      {hasActiveFilters(filters) && (
        <button type="button" className="btn btn--ghost btn--sm filters__clear" onClick={() => onChange({})}>
          Clear filters
        </button>
      )}
      {rangeInvalid && (
        <p id={`${id}-range-error`} className="field__error filters__error" role="alert">
          “From” date must be on or before the “To” date.
        </p>
      )}
    </form>
  );
}

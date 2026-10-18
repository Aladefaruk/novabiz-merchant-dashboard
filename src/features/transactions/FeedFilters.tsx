import type { TransactionFilters, TxStatus, TxType } from '../../api/types';
import { btnGhost, input } from '../../components/ui';

interface Props {
  filters: TransactionFilters;
  onChange: (next: TransactionFilters) => void;
  rangeInvalid: boolean;
}

const fieldLabel = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';

export function FeedFilters({ filters, onChange, rangeInvalid }: Props) {
  // Empty string from a cleared input/select removes the filter.
  const set = (key: keyof TransactionFilters, value: string) => onChange({ ...filters, [key]: value || undefined });

  return (
    <form role="search" aria-label="Filter transactions" onSubmit={(e) => e.preventDefault()} className="mb-4 grid grid-cols-2 items-end gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <div>
        <label htmlFor="filter-from" className={fieldLabel}>From</label>
        <input id="filter-from" type="date" className={input} value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} aria-invalid={rangeInvalid || undefined} aria-describedby={rangeInvalid ? 'range-error' : undefined} />
      </div>
      <div>
        <label htmlFor="filter-to" className={fieldLabel}>To</label>
        <input id="filter-to" type="date" className={input} value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} aria-invalid={rangeInvalid || undefined} aria-describedby={rangeInvalid ? 'range-error' : undefined} />
      </div>
      <div>
        <label htmlFor="filter-status" className={fieldLabel}>Status</label>
        <select id="filter-status" className={input} value={filters.status ?? ''} onChange={(e) => set('status', e.target.value as TxStatus)}>
          <option value="">All statuses</option>
          <option value="successful">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-type" className={fieldLabel}>Type</label>
        <select id="filter-type" className={input} value={filters.type ?? ''} onChange={(e) => set('type', e.target.value as TxType)}>
          <option value="">Money in &amp; out</option>
          <option value="credit">Money in</option>
          <option value="debit">Money out</option>
        </select>
      </div>
      <button type="button" className={btnGhost} onClick={() => onChange({})}>
        Clear
      </button>
      {rangeInvalid && (
        <p id="range-error" role="alert" className="col-span-full text-sm font-semibold text-red-700 dark:text-red-400">
          “From” date must be on or before the “To” date.
        </p>
      )}
    </form>
  );
}

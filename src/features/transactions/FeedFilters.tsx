import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TransactionFilters, TxStatus, TxType } from '../../shared/api/types';
import { btnGhost, input } from '../../shared/components/ui';
import { DateRangeFilter } from './DateRangeFilter';

interface Props {
  filters: TransactionFilters;
  onChange: (patch: Partial<TransactionFilters>) => void;
  onClear: () => void;
}

const fieldLabel = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';
/** Wait for a pause in typing before searching: fewer requests on metered mobile data. */
const SEARCH_DEBOUNCE_MS = 400;

export function FeedFilters({ filters, onChange, onClear }: Props) {
  const [text, setText] = useState(filters.q ?? '');

  useEffect(() => {
    if (text.trim() === (filters.q ?? '')) return;
    const timer = setTimeout(() => onChange({ q: text.trim() }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, filters.q, onChange]);

  // Filters cleared from elsewhere (e.g. the empty state's "Clear filters") also empty the box.
  useEffect(() => {
    if (!filters.q) setText((t) => (t.trim() ? '' : t));
  }, [filters.q]);

  return (
    <form
      role="search"
      aria-label="Filter transactions"
      // Enter searches straight away, without waiting for the debounce.
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ q: text.trim() });
      }}
      className="mb-4 grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(0,1fr))_auto]"
    >
      <div className="col-span-full">
        <label htmlFor="filter-search" className={fieldLabel}>Search</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            id="filter-search"
            type="search"
            className={`${input} pl-9`}
            placeholder="Name, narration or reference"
            maxLength={60}
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>
      <div className="col-span-full lg:col-span-1">
        <DateRangeFilter from={filters.from} to={filters.to} onChange={onChange} />
      </div>
      <div>
        <label htmlFor="filter-status" className={fieldLabel}>Status</label>
        <select id="filter-status" className={input} value={filters.status ?? ''} onChange={(e) => onChange({ status: (e.target.value || undefined) as TxStatus | undefined })}>
          <option value="">All statuses</option>
          <option value="successful">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-type" className={fieldLabel}>Type</label>
        <select id="filter-type" className={input} value={filters.type ?? ''} onChange={(e) => onChange({ type: (e.target.value || undefined) as TxType | undefined })}>
          <option value="">Money in &amp; out</option>
          <option value="credit">Money in</option>
          <option value="debit">Money out</option>
        </select>
      </div>
      <button
        type="button"
        className={`${btnGhost} col-span-full justify-self-end lg:col-span-1`}
        onClick={() => {
          setText('');
          onClear();
        }}
      >
        Clear
      </button>
    </form>
  );
}

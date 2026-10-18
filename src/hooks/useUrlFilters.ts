import { useCallback, useState } from 'react';
import type { TransactionFilters, TxStatus, TxType } from '../api/types';
import { isValidDateKey } from '../lib/dates';

const STATUSES: TxStatus[] = ['pending', 'successful', 'failed'];
const TYPES: TxType[] = ['credit', 'debit'];

/** URL is untrusted input too: only whitelisted values make it into filters. */
export function parseFilters(search: string): TransactionFilters {
  const p = new URLSearchParams(search);
  const out: TransactionFilters = {};
  const from = p.get('from');
  const to = p.get('to');
  const status = p.get('status') as TxStatus | null;
  const type = p.get('type') as TxType | null;
  if (from && isValidDateKey(from)) out.from = from;
  if (to && isValidDateKey(to)) out.to = to;
  if (status && STATUSES.includes(status)) out.status = status;
  if (type && TYPES.includes(type)) out.type = type;
  return out;
}

/** Filters mirrored to the query string so a filtered view survives refresh and can be shared. */
export function useUrlFilters() {
  const [filters, setFiltersState] = useState<TransactionFilters>(() => parseFilters(window.location.search));

  const setFilters = useCallback((next: TransactionFilters) => {
    setFiltersState(next);
    const params = new URLSearchParams(window.location.search);
    for (const k of ['from', 'to', 'status', 'type'] as const) {
      const v = next[k];
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  return { filters, setFilters };
}

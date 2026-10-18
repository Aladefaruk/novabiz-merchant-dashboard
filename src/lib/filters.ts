import type { Transaction, TransactionFilters } from '../api/types';
import { lagosDayEnd, lagosDayStart } from './dates';

/** Client-side mirror of the server filter, used when splicing a confirmed transfer into cached pages. */
export function matchesFilters(tx: Transaction, filters: TransactionFilters): boolean {
  const t = Date.parse(tx.createdAt);
  if (filters.from && t < lagosDayStart(filters.from).getTime()) return false;
  if (filters.to && t >= lagosDayEnd(filters.to).getTime()) return false;
  if (filters.status && tx.status !== filters.status) return false;
  if (filters.type && tx.type !== filters.type) return false;
  return true;
}

export function hasActiveFilters(filters: TransactionFilters): boolean {
  return Boolean(filters.from || filters.to || filters.status || filters.type);
}

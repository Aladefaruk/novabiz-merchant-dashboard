import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../shared/api/endpoints';
import { toKobo, type Kobo } from '../../shared/lib/money';
import { usePendingTransfers } from '../send-money/useTransfer';

export const BALANCE_POLL_MS = 15_000;

/**
 * Server balance + the client's in-flight transfers.
 * displayed = server.available − Σ(pending amount + fee)
 *
 * The optimistic deduction is DERIVED, never written into the server cache, so
 * rolling back is just "the pending entry disappears" — no snapshot restore that
 * could clobber a payment that arrived meanwhile.
 */
export function useBalance() {
  const pending = usePendingTransfers();
  const query = useQuery({
    queryKey: queryKeys.balance,
    queryFn: ({ signal }) => api.getBalance(signal),
    // Pause polling while a transfer is in flight: a poll landing between server
    // commit and our response would briefly double-count the deduction.
    refetchInterval: pending.length > 0 ? false : BALANCE_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const pendingKobo = toKobo(pending.reduce((sum, p) => sum + p.amountKobo + p.feeKobo, 0));
  const displayedKobo: Kobo | undefined =
    query.data !== undefined ? toKobo(query.data.availableKobo - pendingKobo) : undefined;

  return { ...query, pendingKobo, pendingCount: pending.length, displayedKobo };
}

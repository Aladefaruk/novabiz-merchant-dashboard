import type {
  BalanceSummary,
  NameEnquiryResult,
  Transaction,
  TransactionFilters,
  TransactionPage,
  TransferRequest,
  TransferResponse,
} from '../api/types';
import { lagosDateKey, lagosDayEnd, lagosDayStart } from '../lib/dates';
import { TRANSFER_LIMITS, nipTransferFee } from '../lib/fees';
import { toKobo } from '../lib/money';
import { maskAccountNumber } from '../lib/sanitize';
import { BANKS, generateTransactions, makeCredit, makeReference, mulberry32 } from './seed';

/**
 * In-memory "core banking" for the mock API. Owns the ledger, balance and the
 * idempotency store. Lives in the page (MSW handlers run on the main thread),
 * so a hard refresh resets it — documented trade-off.
 */

export const DEMO_PIN = '1234';
const TARGET_SEED_BALANCE_KOBO = 2_486_350_75; // ₦2,486,350.75

type Outcome<T> = { ok: true; status: number; body: T } | { ok: false; status: number; body: { code: string; message: string } };

interface IdempotencyRecord {
  fingerprint: string;
  response: Outcome<TransferResponse>;
}

class MockDb {
  transactions: Transaction[] = [];
  private openingBalanceKobo = 0;
  private idempotency = new Map<string, IdempotencyRecord>();
  private rng = mulberry32(1);
  private seq = 0;
  /** Observability for tests: how many times money actually moved. */
  committedTransfers = 0;
  transferAttempts = 0;

  reset(now = new Date(), count?: number) {
    this.transactions = generateTransactions(now, count);
    this.idempotency.clear();
    this.rng = mulberry32(7);
    this.seq = 0;
    this.committedTransfers = 0;
    this.transferAttempts = 0;
    // Back-solve the opening balance so a small merchant lands on a realistic, fixed current balance.
    this.openingBalanceKobo = TARGET_SEED_BALANCE_KOBO - this.netMovement();
  }

  private netMovement(): number {
    let net = 0;
    for (const tx of this.transactions) {
      if (tx.type === 'credit' && tx.status === 'successful') net += tx.amountKobo;
      // Pending debits are already held against the available balance.
      if (tx.type === 'debit' && tx.status !== 'failed') net -= tx.amountKobo + tx.feeKobo;
    }
    return net;
  }

  get availableKobo(): number {
    return this.openingBalanceKobo + this.netMovement();
  }

  summary(now = new Date()): BalanceSummary {
    const today = lagosDateKey(now);
    const start = lagosDayStart(today).getTime();
    const end = lagosDayEnd(today).getTime();
    let inflow = 0, outflow = 0, inCount = 0, outCount = 0;
    for (const tx of this.transactions) {
      const t = Date.parse(tx.createdAt);
      if (t < start) break; // sorted newest-first
      if (t >= end || tx.status !== 'successful') continue;
      if (tx.type === 'credit') { inflow += tx.amountKobo; inCount++; }
      else { outflow += tx.amountKobo + tx.feeKobo; outCount++; }
    }
    return {
      availableKobo: this.availableKobo,
      todayInflowKobo: inflow,
      todayOutflowKobo: outflow,
      todayInflowCount: inCount,
      todayOutflowCount: outCount,
      latestTransactionAt: this.transactions[0]?.createdAt ?? null,
      asOf: now.toISOString(),
    };
  }

  /** Keyset pagination: cursor = (createdAt, id) of the last row seen. Stable when new rows arrive on top. */
  list(filters: TransactionFilters, cursor: string | null, limit: number): TransactionPage {
    const from = filters.from ? lagosDayStart(filters.from).getTime() : -Infinity;
    const to = filters.to ? lagosDayEnd(filters.to).getTime() : Infinity;
    const matching = this.transactions.filter((tx) => {
      const t = Date.parse(tx.createdAt);
      return t >= from && t < to && (!filters.status || tx.status === filters.status) && (!filters.type || tx.type === filters.type);
    });

    let startIndex = 0;
    if (cursor) {
      const [cAt, cId] = decodeCursor(cursor);
      startIndex = matching.findIndex((tx) => tx.createdAt < cAt || (tx.createdAt === cAt && tx.id < cId));
      if (startIndex === -1) startIndex = matching.length;
    }
    const items = matching.slice(startIndex, startIndex + limit);
    const last = items[items.length - 1];
    const hasMore = startIndex + limit < matching.length;
    return { items, total: matching.length, nextCursor: hasMore && last ? encodeCursor(last) : null };
  }

  nameEnquiry(bankCode: string, accountNumber: string): NameEnquiryResult | null {
    if (!BANKS.some((b) => b.code === bankCode) || !/^\d{10}$/.test(accountNumber)) return null;
    if (accountNumber.endsWith('0000')) return null;
    const rng = mulberry32(Number(accountNumber.slice(-6)) + Number(bankCode));
    const first = ['ADAEZE', 'BABATUNDE', 'CHIOMA', 'DANLADI', 'EFE', 'FOLAKE', 'GODWIN', 'HADIZA'][Math.floor(rng() * 8)];
    const last = ['OKAFOR', 'ADEBAYO', 'MOHAMMED', 'EZE', 'OGUNDIPE', 'NNAMDI'][Math.floor(rng() * 6)];
    const suffix = rng() < 0.4 ? ' ENTERPRISES' : rng() < 0.5 ? ' STORES' : '';
    return { accountName: `${first} ${last}${suffix}`, accountNumber, bankCode };
  }

  /**
   * Execute a transfer exactly once per Idempotency-Key.
   * - Same key + same payload  -> replay the original response, no new debit.
   * - Same key + different payload -> 422 (client bug; refuse rather than guess).
   * - Only SUCCESSFUL commits are stored, so a wrong-PIN attempt can be corrected and resubmitted with the same key.
   */
  transfer(req: TransferRequest, key: string, now = new Date()): Outcome<TransferResponse> & { replayed: boolean } {
    this.transferAttempts++;
    const fingerprint = JSON.stringify([req.bankCode, req.accountNumber, req.amountKobo, req.narration]);
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return { ok: false, status: 422, replayed: false, body: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'This reference was already used for a different transfer.' } };
      }
      return { ...existing.response, replayed: true };
    }

    const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, replayed: false, body: { code, message } });
    if (req.pin !== DEMO_PIN) return fail(401, 'INVALID_PIN', 'Incorrect transaction PIN.');
    if (!Number.isSafeInteger(req.amountKobo) || req.amountKobo < TRANSFER_LIMITS.minKobo || req.amountKobo > TRANSFER_LIMITS.maxSingleKobo) {
      return fail(422, 'INVALID_AMOUNT', 'Amount is outside the allowed transfer limits.');
    }
    const resolved = this.nameEnquiry(req.bankCode, req.accountNumber);
    if (!resolved || resolved.accountName !== req.accountName) return fail(422, 'NAME_MISMATCH', 'Recipient details could not be verified.');
    const fee = nipTransferFee(toKobo(req.amountKobo));
    if (req.amountKobo + fee > this.availableKobo) return fail(422, 'INSUFFICIENT_FUNDS', 'Insufficient balance for this transfer.');

    this.seq++;
    const tx: Transaction = {
      id: `tx_out_${Date.now()}_${this.seq}`,
      reference: makeReference(this.rng, now),
      type: 'debit',
      status: 'successful',
      channel: 'transfer',
      amountKobo: req.amountKobo,
      feeKobo: fee,
      description: req.narration || `Transfer to ${req.accountName}`,
      counterparty: { name: req.accountName, bankName: req.bankName, accountMasked: maskAccountNumber(req.accountNumber) },
      createdAt: now.toISOString(),
      idempotencyKey: key,
    };
    this.transactions.unshift(tx);
    this.committedTransfers++;
    const response: Outcome<TransferResponse> = { ok: true, status: 201, body: { transaction: tx, balanceKobo: this.availableKobo } };
    this.idempotency.set(key, { fingerprint, response });
    return { ...response, replayed: false };
  }

  /** A customer pays the merchant (live inflow simulation). */
  receivePayment(now = new Date()): Transaction {
    this.seq++;
    const tx = makeCredit(this.rng, now, `tx_in_${now.getTime()}_${this.seq}`, { channel: 'qr', description: 'QR payment' });
    tx.amountKobo = (500 + Math.floor(this.rng() * 24_500)) * 100;
    this.transactions.unshift(tx);
    return tx;
  }
}

function encodeCursor(tx: Transaction): string {
  return btoa(`${tx.createdAt}|${tx.id}`);
}
function decodeCursor(cursor: string): [string, string] {
  const [at = '', id = ''] = atob(cursor).split('|');
  return [at, id];
}

export const db = new MockDb();
db.reset();

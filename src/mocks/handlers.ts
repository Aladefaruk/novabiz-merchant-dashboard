import { HttpResponse, delay, http } from 'msw';
import type { TransactionFilters, TransferRequest, TxStatus, TxType } from '../api/types';
import { isValidDateKey } from '../lib/dates';
import { getMockConfig } from './config';
import { BANKS } from './seed';
import { db } from './db';

async function simulateNetwork() {
  const { minLatencyMs, maxLatencyMs } = getMockConfig();
  const ms = minLatencyMs + Math.random() * Math.max(0, maxLatencyMs - minLatencyMs);
  if (ms > 0) await delay(ms);
}

function shouldFail(): boolean {
  return Math.random() < getMockConfig().failureRate;
}

const unavailable = () =>
  HttpResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again.' }, { status: 503 });

const STATUSES: TxStatus[] = ['pending', 'successful', 'failed'];
const TYPES: TxType[] = ['credit', 'debit'];

export const handlers = [
  http.get('*/api/balance', async () => {
    await simulateNetwork();
    if (shouldFail()) return unavailable();
    return HttpResponse.json(db.summary());
  }),

  http.get('*/api/transactions', async ({ request }) => {
    await simulateNetwork();
    if (shouldFail()) return unavailable();
    const params = new URL(request.url).searchParams;
    const filters: TransactionFilters = {};
    const from = params.get('from');
    const to = params.get('to');
    const status = params.get('status') as TxStatus | null;
    const type = params.get('type') as TxType | null;
    if (from && isValidDateKey(from)) filters.from = from;
    if (to && isValidDateKey(to)) filters.to = to;
    if (status && STATUSES.includes(status)) filters.status = status;
    if (type && TYPES.includes(type)) filters.type = type;
    const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 50));
    return HttpResponse.json(db.list(filters, params.get('cursor'), limit));
  }),

  http.get('*/api/banks', async () => {
    await simulateNetwork();
    if (shouldFail()) return unavailable();
    return HttpResponse.json(BANKS);
  }),

  http.get('*/api/name-enquiry', async ({ request }) => {
    await simulateNetwork();
    if (shouldFail()) return unavailable();
    const params = new URL(request.url).searchParams;
    const result = db.nameEnquiry(params.get('bankCode') ?? '', params.get('accountNumber') ?? '');
    if (!result) {
      return HttpResponse.json({ code: 'ACCOUNT_NOT_FOUND', message: 'We couldn’t find an account with those details.' }, { status: 404 });
    }
    return HttpResponse.json(result);
  }),

  http.post('*/api/transfers', async ({ request }) => {
    const key = request.headers.get('Idempotency-Key');
    if (!key) {
      return HttpResponse.json({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required.' }, { status: 400 });
    }
    await simulateNetwork();
    // Fails BEFORE commit: nothing happened server-side.
    if (shouldFail()) return unavailable();

    const body = (await request.json()) as TransferRequest;
    const result = db.transfer(body, key);

    // Fails AFTER commit: money moved, but the client never hears back.
    if (result.ok && !result.replayed && Math.random() < getMockConfig().lostResponseRate) {
      return HttpResponse.error();
    }
    return HttpResponse.json(result.body, {
      status: result.status,
      headers: result.replayed ? { 'Idempotent-Replayed': 'true' } : {},
    });
  }),
];

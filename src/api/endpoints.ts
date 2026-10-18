import { apiRequest } from './client';
import type {
  BalanceSummary,
  Bank,
  NameEnquiryResult,
  TransactionFilters,
  TransactionPage,
  TransferRequest,
  TransferResponse,
} from './types';

export const PAGE_SIZE = 50;
export const TRANSFER_TIMEOUT_MS = 15_000;

export const api = {
  getBalance: (signal?: AbortSignal) => apiRequest<BalanceSummary>('/api/balance', { signal }),

  getTransactions: (filters: TransactionFilters, cursor: string | null, signal?: AbortSignal) =>
    apiRequest<TransactionPage>('/api/transactions', {
      signal,
      query: { ...filters, cursor: cursor ?? undefined, limit: PAGE_SIZE },
    }),

  getBanks: (signal?: AbortSignal) => apiRequest<Bank[]>('/api/banks', { signal }),

  nameEnquiry: (bankCode: string, accountNumber: string, signal?: AbortSignal) =>
    apiRequest<NameEnquiryResult>('/api/name-enquiry', { signal, query: { bankCode, accountNumber } }),

  createTransfer: (body: TransferRequest, idempotencyKey: string) =>
    apiRequest<TransferResponse>('/api/transfers', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': idempotencyKey },
      timeoutMs: TRANSFER_TIMEOUT_MS,
    }),
};

export const queryKeys = {
  balance: ['balance'] as const,
  banks: ['banks'] as const,
  transactionsRoot: ['transactions'] as const,
  transactions: (filters: TransactionFilters) => ['transactions', filters] as const,
  nameEnquiry: (bankCode: string, accountNumber: string) => ['name-enquiry', bankCode, accountNumber] as const,
};

export const mutationKeys = {
  transfer: ['transfer'] as const,
};

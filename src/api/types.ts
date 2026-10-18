/**
 * Wire contract between the dashboard and the (mocked) NovaBiz API.
 * All money fields are integer kobo — the API never sends floats or formatted strings.
 */
export type TxStatus = 'pending' | 'successful' | 'failed';
export type TxType = 'credit' | 'debit';
export type TxChannel = 'qr' | 'pos' | 'transfer' | 'ussd' | 'remittance';

export interface Counterparty {
  name: string;
  bankName: string;
  /** Already masked by the API (NDPA data minimisation) — the UI never receives full numbers. */
  accountMasked: string;
}

export interface Transaction {
  id: string;
  reference: string;
  type: TxType;
  status: TxStatus;
  channel: TxChannel;
  amountKobo: number;
  feeKobo: number;
  /** UNTRUSTED free text supplied by payers/counterparties. */
  description: string;
  counterparty: Counterparty;
  createdAt: string; // ISO-8601 UTC
  /** Present on transfers the merchant initiated; lets the client reconcile optimistic rows. */
  idempotencyKey?: string;
}

export interface BalanceSummary {
  availableKobo: number;
  todayInflowKobo: number;
  todayOutflowKobo: number;
  todayInflowCount: number;
  todayOutflowCount: number;
  latestTransactionAt: string | null;
  asOf: string;
}

export interface TransactionFilters {
  from?: string; // yyyy-mm-dd (Lagos)
  to?: string; // yyyy-mm-dd (Lagos), inclusive
  status?: TxStatus;
  type?: TxType;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
  total: number;
}

export interface Bank {
  code: string;
  name: string;
}

export interface NameEnquiryResult {
  accountName: string;
  accountNumber: string;
  bankCode: string;
}

export interface TransferRequest {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountKobo: number;
  narration: string;
  pin: string;
}

export interface TransferResponse {
  transaction: Transaction;
  balanceKobo: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

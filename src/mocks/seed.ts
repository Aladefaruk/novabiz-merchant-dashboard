import type { Bank, Transaction, TxChannel, TxStatus } from '../api/types';
import { nipTransferFee } from '../lib/fees';
import { toKobo } from '../lib/money';
import { maskAccountNumber } from '../lib/sanitize';

/** Deterministic PRNG so every run (and every test) sees the same dataset. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BANKS: Bank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '50211', name: 'Kuda Microfinance Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
];

const FIRST = ['Adaeze', 'Chinedu', 'Oluwaseun', 'Aisha', 'Emeka', 'Funmilayo', 'Ibrahim', 'Ngozi', 'Tunde', 'Zainab', 'Obinna', 'Halima', 'Kelechi', 'Bisola', 'Musa', 'Chiamaka', 'Yakubu', 'Temitope', 'Uche', 'Hauwa'];
const LAST = ['Okafor', 'Adeyemi', 'Bello', 'Eze', 'Ogunleye', 'Abubakar', 'Nwosu', 'Balogun', 'Okonkwo', 'Usman', 'Afolabi', 'Danjuma', 'Igwe', 'Lawal', 'Obi'];
const SUPPLIERS = ['Dangote Flour Mills', 'Nestlé Nigeria Distributor', 'Mama Nkechi Provisions', 'Ikeja Electric (prepaid)', 'Alaba Wholesale Electronics', 'Shoprite Supplier Hub', 'Landlord — Shop 12B Yaba'];
const DIASPORA = ['UK', 'US', 'Canada'];

const CREDIT_DESCRIPTIONS: Record<Exclude<TxChannel, 'remittance'>, string[]> = {
  qr: ['QR payment', 'QR payment — Table 4', 'Scan-to-pay at counter', 'QR payment for 2 crates of malt'],
  pos: ['POS purchase', 'POS — card payment', 'POS purchase (contactless)'],
  transfer: ['Payment for goods', 'Transfer for order #A-{n}', 'Balance payment', 'Deposit for bulk order'],
  ussd: ['*894# payment', 'USSD transfer — order {n}'],
};

/**
 * Hostile / weird descriptions — real payers can type anything into a narration.
 * These exercise our "treat as untrusted text" handling on every load.
 */
export const HOSTILE_DESCRIPTIONS = [
  '<img src=x onerror=alert("xss")>',
  '<script>alert(document.cookie)</script> Thanks for the bread!',
  'Refund \u202E00.000,05₦\u202C for order', // bidi override trying to spoof an amount
  'Pay\u0000ment\u0007 for goods​​',
  'javascript:alert(1)',
  `Very long narration ${'— really long '.repeat(30)}`,
];

const pick = <T,>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

export function randomName(rng: () => number): string {
  return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
}

function randomAccount(rng: () => number): string {
  return String(Math.floor(rng() * 9_000_000_000) + 1_000_000_000);
}

/** Skewed amount: lots of small payments, a few big ones — like real merchant traffic. */
function skewedKobo(rng: () => number, minNaira: number, maxNaira: number): number {
  const naira = minNaira + (maxNaira - minNaira) * rng() ** 3;
  return Math.round(naira) * 100 + (rng() < 0.3 ? Math.floor(rng() * 100) : 0);
}

export function makeReference(rng: () => number, date: Date): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `NVB${ymd}${Math.floor(rng() * 1e8).toString().padStart(8, '0')}`;
}

export function makeCredit(rng: () => number, createdAt: Date, id: string, overrides: Partial<Transaction> = {}): Transaction {
  const channel: TxChannel = pick(rng, ['qr', 'qr', 'qr', 'pos', 'pos', 'transfer', 'transfer', 'ussd', 'remittance'] as const);
  const name = randomName(rng);
  const bank = pick(rng, BANKS);
  const description =
    channel === 'remittance'
      ? `Diaspora transfer from ${pick(rng, DIASPORA)} — ${name.split(' ')[0]}`
      : pick(rng, CREDIT_DESCRIPTIONS[channel]).replace('{n}', String(1000 + Math.floor(rng() * 9000)));
  return {
    id,
    reference: makeReference(rng, createdAt),
    type: 'credit',
    status: 'successful',
    channel,
    amountKobo: channel === 'remittance' ? skewedKobo(rng, 20_000, 900_000) : skewedKobo(rng, 200, 150_000),
    feeKobo: 0,
    description,
    counterparty: { name, bankName: channel === 'remittance' ? 'NovaPay Remit' : bank.name, accountMasked: maskAccountNumber(randomAccount(rng)) },
    createdAt: createdAt.toISOString(),
    ...overrides,
  };
}

function makeDebit(rng: () => number, createdAt: Date, id: string): Transaction {
  const bank = pick(rng, BANKS);
  const supplier = pick(rng, SUPPLIERS);
  const amountKobo = skewedKobo(rng, 2_000, 400_000);
  return {
    id,
    reference: makeReference(rng, createdAt),
    type: 'debit',
    status: 'successful',
    channel: 'transfer',
    amountKobo,
    feeKobo: nipTransferFee(toKobo(amountKobo)),
    description: `Transfer to ${supplier}`,
    counterparty: { name: supplier, bankName: bank.name, accountMasked: maskAccountNumber(randomAccount(rng)) },
    createdAt: createdAt.toISOString(),
  };
}

export const SEED_TRANSACTION_COUNT = 1_250;

/** ~1,250 transactions over the last 60 days, newest first. */
export function generateTransactions(now: Date, count = SEED_TRANSACTION_COUNT, seed = 20260824): Transaction[] {
  const rng = mulberry32(seed);
  const spanMs = 60 * 24 * 60 * 60 * 1000;
  const times = Array.from({ length: count }, () => now.getTime() - Math.floor(rng() ** 1.4 * spanMs) - 60_000);
  times.sort((a, b) => b - a);

  return times.map((t, i) => {
    const createdAt = new Date(t);
    const id = `tx_${String(count - i).padStart(6, '0')}`;
    const tx = rng() < 0.78 ? makeCredit(rng, createdAt, id) : makeDebit(rng, createdAt, id);
    const ageHours = (now.getTime() - t) / 3_600_000;
    const roll = rng();
    const status: TxStatus = roll < 0.04 ? 'failed' : roll < 0.1 && ageHours < 36 ? 'pending' : 'successful';
    tx.status = status;
    if (i % 97 === 13) tx.description = HOSTILE_DESCRIPTIONS[(i / 97) % HOSTILE_DESCRIPTIONS.length | 0]!;
    return tx;
  });
}

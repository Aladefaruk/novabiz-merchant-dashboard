/**
 * Money is ALWAYS an integer number of kobo (₦1 = 100 kobo). It is only turned
 * into a string at render time and only parsed from a string at form input.
 */

/** Integer kobo. Branded so a raw float can't be passed by accident. */
export type Kobo = number & { readonly __brand: 'Kobo' };

export function toKobo(value: number): Kobo {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Kobo amount must be a safe integer, received ${value}`);
  }
  return value as Kobo;
}

export function addKobo(a: Kobo, b: Kobo): Kobo {
  return toKobo(a + b);
}

/**
 * 100050 -> "1000.50", using integer remainder maths only (never kobo / 100).
 */
export function koboToDecimalString(amount: Kobo): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const kobo = abs % 100;
  const naira = (abs - kobo) / 100; // exact: abs - kobo is a multiple of 100
  return `${sign}${naira}.${String(kobo).padStart(2, '0')}`;
}

const formatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 });
const signedFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/**
 * 100050 -> "₦1,000.50".
 * Intl.NumberFormat accepts an exact decimal *string* (ES2023), so the value is
 * never a binary float at any point. Intl does the symbol and comma grouping.
 */
export function formatNaira(amount: Kobo, { signed = false } = {}): string {
  // TypeScript's lib types lag the spec here; the cast only affects types.
  return (signed ? signedFormatter : formatter).format(koboToDecimalString(amount) as unknown as number);
}

/**
 * Parse what the merchant typed ("1,000.5", "19.99") into kobo with string maths.
 * parseFloat("19.99") * 100 === 1998.9999999999998, so we never do that.
 * Returns null if the input isn't a valid amount with at most 2 decimal places.
 */
export function parseNairaInput(raw: string): Kobo | null {
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(raw.replace(/[₦,\s]/g, ''));
  if (!match) return null;
  const naira = Number(match[1]);
  const kobo = Number((match[2] ?? '').padEnd(2, '0'));
  const total = naira * 100 + kobo; // integer maths: exact while it's a safe integer
  return Number.isSafeInteger(total) ? toKobo(total) : null;
}

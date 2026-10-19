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

const formatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 });
const signedFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/**
 * 100050 -> "₦1,000.50".
 * "100050e-2" means "move the decimal point two places left". Intl.NumberFormat reads
 * a numeric string exactly (ES2023), so we never divide by 100 and no float ever exists.
 * Intl does the ₦ symbol, the commas and the 2 decimal places.
 */
export function formatNaira(amount: Kobo, { signed = false } = {}): string {
  // TypeScript's lib types lag the spec here; the cast only affects types.
  return (signed ? signedFormatter : formatter).format(`${amount}e-2` as unknown as number);
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

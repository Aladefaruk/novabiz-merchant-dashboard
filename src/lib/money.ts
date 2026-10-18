/**
 * Money primitives.
 *
 * Rule: money is ALWAYS an integer number of kobo inside the app. It is only
 * converted to a human string at the very edge (rendering), and only parsed
 * from a human string at the very edge (form input). No float arithmetic on
 * money anywhere — `naira * 100` and `kobo / 100` are banned (see AI_USAGE.md).
 */

declare const KoboBrand: unique symbol;
/** Integer number of kobo (₦1 = 100 kobo). Branded so a raw float can't sneak in. */
export type Kobo = number & { readonly [KoboBrand]: true };

export const KOBO_PER_NAIRA = 100;

export function toKobo(value: number): Kobo {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Kobo amount must be a safe integer, received ${value}`);
  }
  return value as Kobo;
}

export function addKobo(...values: Kobo[]): Kobo {
  return toKobo(values.reduce<number>((sum, v) => sum + v, 0));
}

export function subtractKobo(a: Kobo, b: Kobo): Kobo {
  return toKobo(a - b);
}

/**
 * Exact decimal string for a kobo integer, e.g. 100050 -> "1000.50".
 * Uses integer remainder arithmetic only — never `kobo / 100`.
 */
export function koboToDecimalString(amount: Kobo): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const fraction = abs % KOBO_PER_NAIRA;
  const whole = (abs - fraction) / KOBO_PER_NAIRA; // exact: abs - fraction is a multiple of 100
  return `${negative ? '-' : ''}${whole}.${String(fraction).padStart(2, '0')}`;
}

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedNairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/**
 * Format kobo as Naira, e.g. 100050 -> "₦1,000.50".
 *
 * We hand Intl.NumberFormat an exact decimal *string* (Intl.NumberFormat v3,
 * ES2023). Intl treats it as an exact decimal, so there is no binary-float
 * rounding even for very large balances. Grouping, symbol and sign placement
 * are all done by Intl — no manual string splicing of the output.
 */
export function formatNaira(amount: Kobo, options: { signed?: boolean } = {}): string {
  const formatter = options.signed ? signedNairaFormatter : nairaFormatter;
  // TS's lib typing for format() lags the spec (StringNumericLiteral); the cast is type-only.
  return formatter.format(koboToDecimalString(amount) as unknown as number);
}

/** Accessible long-form reading, e.g. "1,000 naira and 50 kobo". */
export function describeNaira(amount: Kobo): string {
  const abs = Math.abs(amount);
  const fraction = abs % KOBO_PER_NAIRA;
  const whole = (abs - fraction) / KOBO_PER_NAIRA;
  const sign = amount < 0 ? 'minus ' : '';
  const nairaPart = `${new Intl.NumberFormat('en-NG').format(whole)} naira`;
  return fraction === 0 ? `${sign}${nairaPart}` : `${sign}${nairaPart} and ${fraction} kobo`;
}

export type ParseResult = { ok: true; kobo: Kobo } | { ok: false; reason: 'empty' | 'invalid' | 'precision' | 'too_large' };

/**
 * Parse what a merchant typed ("1,000.5", "₦ 2500", "19.99") into kobo using
 * string arithmetic. `parseFloat(x) * 100` is wrong: 19.99 * 100 === 1998.9999999999998.
 */
export function parseNairaInput(raw: string): ParseResult {
  const cleaned = raw.replace(/[₦,\s]/g, '').replace(/^NGN/i, '');
  if (cleaned === '') return { ok: false, reason: 'empty' };
  const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return { ok: false, reason: 'invalid' };
  const [, wholePart = '0', fractionPart = ''] = match;
  if (fractionPart.length > 2) return { ok: false, reason: 'precision' };
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(2, '0'));
  const total = whole * KOBO_PER_NAIRA + fraction; // integer * integer + integer: exact while safe
  if (!Number.isSafeInteger(total)) return { ok: false, reason: 'too_large' };
  return { ok: true, kobo: toKobo(total) };
}

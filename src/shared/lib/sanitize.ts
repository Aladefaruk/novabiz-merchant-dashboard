/**
 * Transaction descriptions and names are typed by other people, so they're untrusted.
 * React already renders strings as text (no HTML), and we never use dangerouslySetInnerHTML.
 * On top of that we strip invisible characters that are dangerous even as plain text —
 * e.g. U+202E (right-to-left override) can make "Refund \u202E05.000,1₦" display a fake amount.
 */
const INVISIBLE_OR_CONTROL = /[\u0000-\u001F\u007F-\u009F​-\u200F\u202A-\u202E\u2066-\u2069﻿]/g;

export function toSafeDisplayText(input: unknown, maxLength = 120): string {
  if (typeof input !== 'string') return '';
  const cleaned = input.replace(INVISIBLE_OR_CONTROL, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

/** NDPA 2023 data minimisation: only show the last 4 digits of an account number. */
export function maskAccountNumber(accountNumber: string): string {
  return `•••• ${accountNumber.slice(-4)}`;
}

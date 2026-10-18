/**
 * Untrusted-text handling.
 *
 * Transaction descriptions and narrations are written by *other people*
 * (payers, counterparties, the merchant themselves). We never render them as
 * HTML — React's text rendering escapes markup, and this codebase has zero
 * raw-HTML sinks (enforced by src/test/security.test.ts). On top of that we strip
 * characters that are dangerous even as plain text:
 *   - C0/C1 control characters (can break layout / logs)
 *   - Unicode bidi overrides & isolates (U+202A–202E, U+2066–2069): these let a
 *     description like "Refund \u202E000,05₦" visually spoof an amount
 *     ("Trojan Source"-style). Critical in a money UI.
 *   - zero-width characters used to disguise names
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const ZERO_WIDTH = /[​-‍⁠﻿]/g;

export const MAX_DISPLAY_LENGTH = 120;

export function toSafeDisplayText(input: unknown, maxLength = MAX_DISPLAY_LENGTH): string {
  if (typeof input !== 'string') return '';
  const cleaned = input
    .normalize('NFC')
    .replace(CONTROL_CHARS, ' ')
    .replace(BIDI_CONTROLS, '')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${Array.from(cleaned).slice(0, maxLength - 1).join('')}…`;
}

/** Narration the merchant types: restrict to what NIP narrations actually accept. */
export const NARRATION_PATTERN = /^[A-Za-z0-9 .,\-/'&()#:]*$/;
export const NARRATION_MAX_LENGTH = 60;

/** NDPA 2023 data minimisation: only ever show the last 4 digits of an account. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  return digits.length <= 4 ? digits : `•••• ${digits.slice(-4)}`;
}

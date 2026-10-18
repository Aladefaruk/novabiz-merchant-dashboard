import { TRANSFER_LIMITS, nipTransferFee } from './fees';
import { addKobo, formatNaira, parseNairaInput, type Kobo } from './money';
import { NARRATION_MAX_LENGTH, NARRATION_PATTERN } from './sanitize';

/** Returns an error message, or null when valid. Pure functions — unit tested directly. */

export function validateBank(bankCode: string): string | null {
  return bankCode ? null : 'Select the recipient’s bank.';
}

export function validateAccountNumber(value: string): string | null {
  if (!value) return 'Enter the 10-digit account number.';
  if (!/^\d+$/.test(value)) return 'Account number can only contain digits.';
  if (value.length !== 10) return 'Account number must be exactly 10 digits (NUBAN).';
  return null;
}

export function validateAmount(raw: string, availableKobo: Kobo | undefined): { error: string | null; kobo?: Kobo } {
  const parsed = parseNairaInput(raw);
  if (!parsed.ok) {
    const messages = {
      empty: 'Enter an amount.',
      invalid: 'Enter a valid amount, e.g. 2,500 or 2500.50.',
      precision: 'Amount can have at most 2 decimal places (kobo).',
      too_large: 'That amount is too large.',
    } as const;
    return { error: messages[parsed.reason] };
  }
  const { kobo } = parsed;
  if (kobo < TRANSFER_LIMITS.minKobo) {
    return { error: `Minimum transfer is ${formatNaira(TRANSFER_LIMITS.minKobo)}.`, kobo };
  }
  if (kobo > TRANSFER_LIMITS.maxSingleKobo) {
    return { error: `Maximum per transfer is ${formatNaira(TRANSFER_LIMITS.maxSingleKobo)}.`, kobo };
  }
  if (availableKobo !== undefined) {
    const total = addKobo(kobo, nipTransferFee(kobo));
    if (total > availableKobo) {
      return {
        error: `Insufficient balance. Amount plus ${formatNaira(nipTransferFee(kobo))} fee exceeds your available ${formatNaira(availableKobo)}.`,
        kobo,
      };
    }
  }
  return { error: null, kobo };
}

export function validateNarration(value: string): string | null {
  if (value.length > NARRATION_MAX_LENGTH) return `Narration must be ${NARRATION_MAX_LENGTH} characters or fewer.`;
  if (!NARRATION_PATTERN.test(value)) return 'Narration can only use letters, numbers, spaces and . , - / \' & ( ) # :';
  return null;
}

export function validatePin(value: string): string | null {
  if (!/^\d{4}$/.test(value)) return 'Enter your 4-digit transaction PIN.';
  return null;
}

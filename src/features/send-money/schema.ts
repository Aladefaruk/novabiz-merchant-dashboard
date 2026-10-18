import { z } from 'zod';
import { TRANSFER_LIMITS, nipTransferFee } from '../../lib/fees';
import { addKobo, formatNaira, parseNairaInput, type Kobo } from '../../lib/money';

/** Static field rules. Balance-dependent rules are in checkAmount() below. */
export const transferSchema = z.object({
  bankCode: z.string().min(1, 'Select the recipient’s bank.'),
  accountNumber: z.string().regex(/^\d{10}$/, 'Enter the 10-digit account number (NUBAN).'),
  amount: z
    .string()
    .min(1, 'Enter an amount.')
    .refine((v) => parseNairaInput(v) !== null, 'Enter a valid amount with at most 2 decimal places, e.g. 2500.50.'),
  narration: z
    .string()
    .max(60, 'Narration must be 60 characters or fewer.')
    .regex(/^[A-Za-z0-9 .,\-/'&()#:]*$/, 'Narration can only use letters, numbers and basic punctuation.'),
});

export type TransferForm = z.infer<typeof transferSchema>;

/** Limits and balance check (the fee counts against the balance). Returns an error message or null. */
export function checkAmount(amount: Kobo, availableKobo: Kobo | undefined): string | null {
  if (amount < TRANSFER_LIMITS.minKobo) return `Minimum transfer is ${formatNaira(TRANSFER_LIMITS.minKobo)}.`;
  if (amount > TRANSFER_LIMITS.maxSingleKobo) return `Maximum per transfer is ${formatNaira(TRANSFER_LIMITS.maxSingleKobo)}.`;
  if (availableKobo !== undefined && addKobo(amount, nipTransferFee(amount)) > availableKobo) {
    return `Insufficient balance. Amount plus ${formatNaira(nipTransferFee(amount))} fee is more than your ${formatNaira(availableKobo)}.`;
  }
  return null;
}

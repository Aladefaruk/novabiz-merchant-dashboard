import { toKobo, type Kobo } from './money';

/**
 * NIP transfer charges per the CBN Guide to Charges by Banks (2020), VAT-inclusive (7.5%).
 *   ≤ ₦5,000            -> ₦10.00  + VAT = ₦10.75
 *   ₦5,000.01–₦50,000   -> ₦25.00  + VAT = ₦26.88 (VAT rounded half-up to the kobo)
 *   > ₦50,000           -> ₦50.00  + VAT = ₦53.75
 * Assumption (documented in README): NovaBiz passes the standard NIP fee to the merchant.
 */
const TIERS: ReadonlyArray<{ upTo: number; fee: number }> = [
  { upTo: 5_000_00, fee: 10_75 },
  { upTo: 50_000_00, fee: 26_88 },
  { upTo: Number.MAX_SAFE_INTEGER, fee: 53_75 },
];

export function nipTransferFee(amount: Kobo): Kobo {
  const tier = TIERS.find((t) => amount <= t.upTo) ?? TIERS[TIERS.length - 1]!;
  return toKobo(tier.fee);
}

/** The demo merchant's KYC tier (BVN/NIN verified). The limits below assume it. */
export const MERCHANT_KYC_TIER = 3;

/** Business limits for the demo merchant (assumed KYC Tier 3 corporate wallet). */
export const TRANSFER_LIMITS = {
  minKobo: toKobo(100_00), // ₦100
  maxSingleKobo: toKobo(5_000_000_00), // ₦5,000,000 per transfer
} as const;

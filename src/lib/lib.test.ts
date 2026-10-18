import { lagosDateKey, lagosDayStart } from './dates';
import { nipTransferFee } from './fees';
import { toKobo } from './money';
import { maskAccountNumber, toSafeDisplayText } from './sanitize';
import { validateAccountNumber, validateAmount, validateNarration, validatePin } from './validation';

describe('toSafeDisplayText', () => {
  it('keeps markup as inert text (React escapes it on render)', () => {
    expect(toSafeDisplayText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });

  it('strips bidi overrides that could visually spoof an amount', () => {
    expect(toSafeDisplayText('Refund \u202E00.000,05₦\u202C')).toBe('Refund 00.000,05₦');
  });

  it('strips control and zero-width characters and collapses whitespace', () => {
    expect(toSafeDisplayText('Pay\u0000ment\u0007  for​ goods\n')).toBe('Pay ment for goods');
  });

  it('caps length', () => {
    expect(toSafeDisplayText('x'.repeat(500), 10)).toBe(`${'x'.repeat(9)}…`);
  });

  it('handles non-strings defensively', () => {
    expect(toSafeDisplayText(undefined)).toBe('');
    expect(toSafeDisplayText({ toString: () => 'evil' })).toBe('');
  });

  it('masks account numbers to the last 4 digits (NDPA minimisation)', () => {
    expect(maskAccountNumber('0123456789')).toBe('•••• 6789');
  });
});

describe('nipTransferFee (CBN tiers, VAT-inclusive)', () => {
  it.each([
    [100_00, 10_75],
    [5_000_00, 10_75],
    [5_000_01, 26_88],
    [50_000_00, 26_88],
    [50_000_01, 53_75],
    [5_000_000_00, 53_75],
  ])('%i kobo -> fee %i kobo', (amount, fee) => {
    expect(nipTransferFee(toKobo(amount))).toBe(fee);
  });
});

describe('validation', () => {
  it('validates NUBAN account numbers', () => {
    expect(validateAccountNumber('')).toMatch(/enter/i);
    expect(validateAccountNumber('12345')).toMatch(/10 digits/);
    expect(validateAccountNumber('12345abcde')).toMatch(/digits/);
    expect(validateAccountNumber('0123456789')).toBeNull();
  });

  it('includes the fee when checking the balance', () => {
    // ₦1,000 + ₦10.75 fee = ₦1,010.75 > ₦1,010.74 available
    expect(validateAmount('1000', toKobo(1_010_74)).error).toMatch(/insufficient/i);
    expect(validateAmount('1000', toKobo(1_010_75)).error).toBeNull();
  });

  it('enforces min/max limits', () => {
    expect(validateAmount('99.99', undefined).error).toMatch(/minimum/i);
    expect(validateAmount('5000000.01', undefined).error).toMatch(/maximum/i);
  });

  it('restricts narration characters and length', () => {
    expect(validateNarration('Payment for flour, invoice #12')).toBeNull();
    expect(validateNarration('<script>')).toMatch(/only use/);
    expect(validateNarration('x'.repeat(61))).toMatch(/60/);
  });

  it('requires a 4-digit PIN', () => {
    expect(validatePin('123')).not.toBeNull();
    expect(validatePin('12a4')).not.toBeNull();
    expect(validatePin('1234')).toBeNull();
  });
});

describe('Lagos business day', () => {
  it('uses WAT (UTC+1) regardless of device timezone', () => {
    // 23:30 UTC on 1 Mar is already 00:30 on 2 Mar in Lagos.
    expect(lagosDateKey(new Date('2026-03-01T23:30:00Z'))).toBe('2026-03-02');
    expect(lagosDayStart('2026-03-02').toISOString()).toBe('2026-03-01T23:00:00.000Z');
  });
});

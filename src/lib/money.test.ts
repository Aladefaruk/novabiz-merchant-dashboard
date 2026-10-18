import { describeNaira, formatNaira, koboToDecimalString, parseNairaInput, toKobo } from './money';

describe('formatNaira', () => {
  it.each([
    [100050, '₦1,000.50'], // the example from the brief
    [0, '₦0.00'],
    [1, '₦0.01'],
    [99, '₦0.99'],
    [100, '₦1.00'],
    [123456789, '₦1,234,567.89'],
    [-250075, '-₦2,500.75'],
  ])('%i kobo -> %s', (kobo, expected) => {
    expect(formatNaira(toKobo(kobo))).toBe(expected);
  });

  it('has no floating-point drift at the top of the safe-integer range', () => {
    // Number(9007199254740991) / 100 would print …409.90 — the exact string path keeps the last kobo.
    expect(formatNaira(toKobo(Number.MAX_SAFE_INTEGER))).toBe('₦90,071,992,547,409.91');
  });

  it('shows explicit signs when asked', () => {
    expect(formatNaira(toKobo(25000), { signed: true })).toBe('+₦250.00');
    expect(formatNaira(toKobo(-25000), { signed: true })).toBe('-₦250.00');
    expect(formatNaira(toKobo(0), { signed: true })).toBe('₦0.00');
  });

  it('rejects non-integer kobo instead of silently rounding', () => {
    expect(() => toKobo(100.5)).toThrow(RangeError);
    expect(() => toKobo(Number.NaN)).toThrow(RangeError);
    expect(() => toKobo(2 ** 53)).toThrow(RangeError);
  });
});

describe('koboToDecimalString', () => {
  it('uses integer arithmetic only', () => {
    expect(koboToDecimalString(toKobo(5))).toBe('0.05');
    expect(koboToDecimalString(toKobo(-5))).toBe('-0.05');
    expect(koboToDecimalString(toKobo(100000))).toBe('1000.00');
  });
});

describe('describeNaira (screen-reader text)', () => {
  it('reads naira and kobo unambiguously', () => {
    expect(describeNaira(toKobo(100050))).toBe('1,000 naira and 50 kobo');
    expect(describeNaira(toKobo(500000))).toBe('5,000 naira');
  });
});

describe('parseNairaInput', () => {
  it.each([
    ['1000.50', 100050],
    ['1,000.5', 100050],
    ['₦ 2,500', 250000],
    ['0.01', 1],
    ['19.99', 1999], // parseFloat('19.99') * 100 === 1998.9999999999998
    ['1.15', 115], // parseFloat('1.15') * 100 === 114.99999999999999
    ['0.29', 29], // 0.29 * 100 === 28.999999999999996
    ['5.', 500],
  ])('%s -> %i kobo', (input, kobo) => {
    expect(parseNairaInput(input)).toEqual({ ok: true, kobo });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'invalid'],
    ['1.2.3', 'invalid'],
    ['-50', 'invalid'],
    ['1e5', 'invalid'],
    ['10.999', 'precision'],
    ['99999999999999999999', 'too_large'],
  ])('rejects %j (%s)', (input, reason) => {
    expect(parseNairaInput(input)).toEqual({ ok: false, reason });
  });
});

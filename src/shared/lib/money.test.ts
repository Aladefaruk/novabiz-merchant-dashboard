import { formatNaira, parseNairaInput, toKobo } from './money';

describe('money', () => {
  it('formats kobo as Naira with no floating-point drift', () => {
    expect(formatNaira(toKobo(100050))).toBe('₦1,000.50'); // example from the brief
    expect(formatNaira(toKobo(5))).toBe('₦0.05');
    expect(formatNaira(toKobo(-250075), { signed: true })).toBe('-₦2,500.75');
    // Formatting kobo / 100 as a float would print …409.90 here.
    expect(formatNaira(toKobo(Number.MAX_SAFE_INTEGER))).toBe('₦90,071,992,547,409.91');
  });

  it('parses typed amounts with string maths (parseFloat * 100 gets these wrong)', () => {
    expect(parseNairaInput('19.99')).toBe(1999); // 19.99 * 100 === 1998.9999999999998
    expect(parseNairaInput('1.15')).toBe(115); //   1.15 * 100 === 114.99999999999999
    expect(parseNairaInput('1,000.5')).toBe(100050);
    expect(parseNairaInput('10.999')).toBeNull(); // sub-kobo precision
    expect(parseNairaInput('abc')).toBeNull();
  });

  it('refuses non-integer kobo instead of silently rounding', () => {
    expect(() => toKobo(100.5)).toThrow(RangeError);
  });
});

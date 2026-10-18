/**
 * Guardrail: no raw-HTML rendering anywhere in the app. If someone (or an AI
 * assistant) adds dangerouslySetInnerHTML / innerHTML later, this fails CI.
 */
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('untrusted text guardrails', () => {
  it('scans a meaningful number of source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it.each(['dangerouslySetInnerHTML', '.innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval('])('no source file uses %s', (needle) => {
    const offenders = Object.entries(sources)
      .filter(([, code]) => code.includes(needle))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it('never does float math on kobo (no "/ 100" or "* 100" outside money.ts)', () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !file.endsWith('lib/money.ts') && !file.includes('/mocks/'))
      .filter(([, code]) => /[*/]\s*100\b(?!_)/.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});

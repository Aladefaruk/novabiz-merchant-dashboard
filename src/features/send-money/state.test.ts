import { INITIAL_STATE, reducer } from './state';

describe('send-money reducer: idempotency key lifecycle', () => {
  const withKey = { ...INITIAL_STATE, idempotencyKey: 'key-1', draft: { ...INITIAL_STATE.draft, amountInput: '500' } };

  it('keeps the key when navigating between steps (retries reuse it)', () => {
    const s = reducer(withKey, { type: 'go', step: 'review' });
    expect(s.idempotencyKey).toBe('key-1');
  });

  it.each(['amountInput', 'accountNumber', 'bankCode', 'narration', 'accountName'] as const)(
    'clears the key when %s changes, so an edited transfer can never replay the old one',
    (field) => {
      const s = reducer(withKey, { type: 'update', patch: { [field]: 'changed' } });
      expect(s.idempotencyKey).toBeNull();
    },
  );

  it('keeps the key when a field is "updated" to the same value', () => {
    const s = reducer(withKey, { type: 'update', patch: { amountInput: '500' } });
    expect(s.idempotencyKey).toBe('key-1');
  });

  it('reset clears everything', () => {
    expect(reducer(withKey, { type: 'reset' })).toEqual(INITIAL_STATE);
  });
});

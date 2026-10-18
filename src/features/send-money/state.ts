export type Step = 'recipient' | 'amount' | 'review' | 'confirm' | 'result';

export const STEPS: { id: Exclude<Step, 'result'>; label: string }[] = [
  { id: 'recipient', label: 'Recipient' },
  { id: 'amount', label: 'Amount' },
  { id: 'review', label: 'Review' },
  { id: 'confirm', label: 'Confirm' },
];

export interface Draft {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  /** Set only from a successful name enquiry — never typed by the user. */
  accountName: string;
  amountInput: string;
  narration: string;
}

export interface SendMoneyState {
  step: Step;
  draft: Draft;
  /**
   * One key per transfer INTENT. Created when the user first reaches Confirm,
   * kept across retries, and cleared whenever anything that defines the
   * transfer changes (so an edited transfer can never replay an old one).
   */
  idempotencyKey: string | null;
}

export type Action =
  | { type: 'update'; patch: Partial<Draft> }
  | { type: 'go'; step: Step }
  | { type: 'setKey'; key: string }
  | { type: 'reset' };

export const EMPTY_DRAFT: Draft = {
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  amountInput: '',
  narration: '',
};

export const INITIAL_STATE: SendMoneyState = { step: 'recipient', draft: EMPTY_DRAFT, idempotencyKey: null };

const INTENT_FIELDS: (keyof Draft)[] = ['bankCode', 'accountNumber', 'accountName', 'amountInput', 'narration'];

export function reducer(state: SendMoneyState, action: Action): SendMoneyState {
  switch (action.type) {
    case 'update': {
      const draft = { ...state.draft, ...action.patch };
      const intentChanged = INTENT_FIELDS.some((f) => draft[f] !== state.draft[f]);
      return { ...state, draft, idempotencyKey: intentChanged ? null : state.idempotencyKey };
    }
    case 'go':
      return { ...state, step: action.step };
    case 'setKey':
      return { ...state, idempotencyKey: action.key };
    case 'reset':
      return INITIAL_STATE;
  }
}

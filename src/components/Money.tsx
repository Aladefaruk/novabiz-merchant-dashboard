import { describeNaira, formatNaira, toKobo } from '../lib/money';

interface MoneyProps {
  kobo: number;
  signed?: boolean;
  className?: string;
}

/**
 * The ONLY way money reaches the screen. Takes integer kobo, validates it,
 * formats via Intl. Screen readers get an unambiguous long form ("1,000 naira
 * and 50 kobo") as visually-hidden text; aria-label on a <span> is unreliable.
 */
export function Money({ kobo, signed, className }: MoneyProps) {
  const amount = toKobo(kobo);
  return (
    <span className={className}>
      <span aria-hidden="true">{formatNaira(amount, { signed })}</span>
      <span className="visually-hidden">{`${signed && amount > 0 ? 'plus ' : ''}${describeNaira(amount)}`}</span>
    </span>
  );
}

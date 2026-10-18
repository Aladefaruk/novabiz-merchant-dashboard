import { formatNaira, toKobo } from '../lib/money';

/** The only way money reaches the screen: integer kobo in, Intl-formatted Naira out. */
export function Money({ kobo, signed, className }: { kobo: number; signed?: boolean; className?: string }) {
  return <span className={className}>{formatNaira(toKobo(kobo), { signed })}</span>;
}

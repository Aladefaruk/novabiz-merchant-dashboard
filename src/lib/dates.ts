/**
 * All "business day" logic is in West Africa Time (Africa/Lagos, UTC+1, no DST),
 * regardless of the device clock's timezone — a merchant's "today" is a Lagos day.
 */
export const BUSINESS_TZ = 'Africa/Lagos';
const WAT_OFFSET_MS = 60 * 60 * 1000;

const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  timeZone: BUSINESS_TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTxDate(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** yyyy-mm-dd of the Lagos calendar day containing `date`. */
export function lagosDateKey(date: Date): string {
  return new Date(date.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant at which a Lagos calendar day (yyyy-mm-dd) starts. */
export function lagosDayStart(dateKey: string): Date {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - WAT_OFFSET_MS);
}

/** Exclusive UTC end instant of a Lagos calendar day. */
export function lagosDayEnd(dateKey: string): Date {
  return new Date(lagosDayStart(dateKey).getTime() + 24 * 60 * 60 * 1000);
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

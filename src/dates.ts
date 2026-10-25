/** Today's date as YYYY-MM-DD in local time. */
export function localDate(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** The first day of the month `amount` months from `date`'s month. */
export function shiftMonth(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/** A local date's month as YYYY-MM. */
export function monthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The YYYY-MM month of a YYYY-MM-DD or ISO date string. */
export function dateMonth(value: string): string {
	return value.slice(0, 7);
}

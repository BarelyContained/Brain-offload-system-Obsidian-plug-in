import { dateMonth } from './dates';
import type { IntentionStretch } from './types';

export const HORIZON_RANGES = [3, 6, 12, 24, 48, 96] as const;

export type StretchState = 'historical' | 'current' | 'planned';

export function isStretchActiveInMonth(stretch: IntentionStretch, month: string): boolean {
	return dateMonth(stretch.startDate) <= month && (!stretch.endDate || dateMonth(stretch.endDate) >= month);
}

/** Counts each intention at most once, however many of its stretches cover the month. */
export function concurrentIntentions(stretches: IntentionStretch[], month: string): number {
	return new Set(
		stretches
			.filter((stretch) => isStretchActiveInMonth(stretch, month))
			.map((stretch) => stretch.intentionId),
	).size;
}

/** The first and last visible month indexes a stretch covers, or undefined if it is out of view. */
export function visibleSpan(
	stretch: IntentionStretch,
	monthKeys: string[],
): { first: number; last: number } | undefined {
	const indexes = monthKeys
		.map((key, index) => isStretchActiveInMonth(stretch, key) ? index : -1)
		.filter((index) => index >= 0);
	const first = indexes[0];
	const last = indexes[indexes.length - 1];
	return first === undefined || last === undefined ? undefined : { first, last };
}

/** `today` is a YYYY-MM-DD date. */
export function stretchState(stretch: IntentionStretch, today: string): StretchState {
	if (stretch.endDate && stretch.endDate < today) return 'historical';
	if (stretch.startDate > today) return 'planned';
	return 'current';
}

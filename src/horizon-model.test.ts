import { describe, expect, it } from 'vitest';
import { monthKey, shiftMonth } from './dates';
import { concurrentIntentions, isStretchActiveInMonth, stretchState, visibleSpan } from './horizon-model';
import type { IntentionStretch } from './types';

const stretch = (intentionId: string, startDate: string, endDate?: string): IntentionStretch => ({
	id: `${intentionId}-${startDate}`,
	intentionId,
	startDate,
	endDate,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('month helpers', () => {
	it('shifts across year boundaries', () => {
		expect(monthKey(shiftMonth(new Date(2026, 10, 15), 3))).toBe('2027-02');
		expect(monthKey(shiftMonth(new Date(2026, 0, 31), -1))).toBe('2025-12');
	});
});

describe('isStretchActiveInMonth', () => {
	it('covers whole months from start to end, inclusive', () => {
		const employed = stretch('job', '2026-03-17', '2026-06-02');
		expect(isStretchActiveInMonth(employed, '2026-02')).toBe(false);
		expect(isStretchActiveInMonth(employed, '2026-03')).toBe(true);
		expect(isStretchActiveInMonth(employed, '2026-06')).toBe(true);
		expect(isStretchActiveInMonth(employed, '2026-07')).toBe(false);
	});

	it('continues indefinitely without an end date', () => {
		expect(isStretchActiveInMonth(stretch('job', '2025-01-01'), '2034-12')).toBe(true);
	});
});

describe('concurrentIntentions', () => {
	it('counts an intention once even when its stretches overlap', () => {
		const stretches = [
			stretch('job', '2026-01-01', '2026-05-31'),
			stretch('job', '2026-05-01'),
			stretch('guitar', '2026-04-01', '2026-04-30'),
		];
		expect(concurrentIntentions(stretches, '2026-05')).toBe(1);
		expect(concurrentIntentions(stretches, '2026-04')).toBe(2);
		expect(concurrentIntentions(stretches, '2025-12')).toBe(0);
	});

	it('leaves pauses uncounted', () => {
		const stretches = [stretch('guitar', '2026-01-01', '2026-02-28'), stretch('guitar', '2026-05-01')];
		expect(concurrentIntentions(stretches, '2026-03')).toBe(0);
		expect(concurrentIntentions(stretches, '2026-05')).toBe(1);
	});
});

describe('visibleSpan', () => {
	const months = ['2026-01', '2026-02', '2026-03', '2026-04'];

	it('clips a stretch to the visible months', () => {
		expect(visibleSpan(stretch('job', '2025-06-01', '2026-02-10'), months)).toEqual({ first: 0, last: 1 });
		expect(visibleSpan(stretch('job', '2026-03-05'), months)).toEqual({ first: 2, last: 3 });
	});

	it('returns undefined when the stretch is out of view', () => {
		expect(visibleSpan(stretch('job', '2026-06-01'), months)).toBeUndefined();
	});
});

describe('stretchState', () => {
	const today = '2026-10-21';

	it('distinguishes ended, current, and future stretches', () => {
		expect(stretchState(stretch('a', '2026-01-01', '2026-10-20'), today)).toBe('historical');
		expect(stretchState(stretch('a', '2026-01-01', today), today)).toBe('current');
		expect(stretchState(stretch('a', today), today)).toBe('current');
		expect(stretchState(stretch('a', '2026-10-22'), today)).toBe('planned');
	});
});

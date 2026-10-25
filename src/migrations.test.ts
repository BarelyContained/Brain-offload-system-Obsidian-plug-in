import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';

const now = '2026-10-21T00:00:00.000Z';
const intention = {
	id: 'a',
	title: 'Remain employed',
	kind: 'ongoing',
	description: '',
	sharedContext: '',
	recipe: '',
	createdAt: '2025-01-05T09:00:00.000Z',
	updatedAt: now,
};
const session = {
	id: 's',
	intentionId: 'a',
	date: '2026-10-01',
	durationMinutes: 30,
	context: '',
	contextMode: 'one-shot',
	createdAt: now,
};
const stretch = { id: 'r', intentionId: 'a', startDate: '2025-01-01', createdAt: now, updatedAt: now };

describe('migrate', () => {
	it('starts empty on first run', () => {
		const result = migrate(null, now);
		expect(result.kind).toBe('empty');
		if (result.kind !== 'empty') return;
		expect(result.data).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, startedAt: now, intentions: [] });
	});

	it('upgrades version 2 data without losing records', () => {
		const result = migrate(
			{ schemaVersion: 2, startedAt: now, intentions: [intention], sessions: [session], stretches: [stretch] },
			now,
		);
		expect(result.kind).toBe('loaded');
		if (result.kind !== 'loaded') return;
		expect(result.changed).toBe(true);
		expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
		expect(result.data.intentions).toEqual([intention]);
		expect(result.data.sessions).toEqual([session]);
		expect(result.data.stretches).toEqual([stretch]);
		expect(result.data.quarantine).toEqual([]);
	});

	it('treats a missing schema version as version 1 and fills missing lists', () => {
		const result = migrate({ intentions: [intention] }, now);
		if (result.kind !== 'loaded') throw new Error(result.kind);
		expect(result.data.stretches).toEqual([]);
		expect(result.data.startedAt).toBe(intention.createdAt);
	});

	it('does not report a change for data that is already current', () => {
		const first = migrate({ schemaVersion: 2, startedAt: now, intentions: [intention], sessions: [session] }, now);
		if (first.kind !== 'loaded') throw new Error(first.kind);
		const second = migrate(JSON.parse(JSON.stringify(first.data)), now);
		expect(second).toMatchObject({ kind: 'loaded', changed: false });
	});

	it('quarantines invalid and orphaned records instead of dropping them', () => {
		const orphan = { ...session, id: 't', intentionId: 'gone' };
		const result = migrate(
			{ schemaVersion: 2, startedAt: now, intentions: [intention, { id: 'x' }], sessions: [session, orphan], stretches: 'oops' },
			now,
		);
		if (result.kind !== 'loaded') throw new Error(result.kind);
		expect(result.data.intentions).toEqual([intention]);
		expect(result.data.sessions).toEqual([session]);
		expect(result.data.quarantine).toEqual([
			{ collection: 'intentions', record: { id: 'x' }, reason: 'Invalid intention.', quarantinedAt: now },
			{ collection: 'sessions', record: orphan, reason: 'Intention not found.', quarantinedAt: now },
			{ collection: 'stretches', record: 'oops', reason: 'Expected a list.', quarantinedAt: now },
		]);
	});

	it('keeps previously quarantined records across loads', () => {
		const held = { collection: 'sessions', record: { id: 'old' }, reason: 'Invalid session.', quarantinedAt: '2026-01-01' };
		const result = migrate({ schemaVersion: 3, startedAt: now, quarantine: [held] }, now);
		if (result.kind !== 'loaded') throw new Error(result.kind);
		expect(result.data.quarantine).toEqual([held]);
	});

	it.each([
		['newer schema', { schemaVersion: CURRENT_SCHEMA_VERSION + 1 }],
		['non-integer schema', { schemaVersion: '2' }],
		['a list', [intention]],
		['a string', 'data'],
	])('refuses to load %s', (_, saved) => {
		expect(migrate(saved, now).kind).toBe('unreadable');
	});
});

import type {
	BrainOffloadData,
	Intention,
	IntentionSession,
	IntentionStretch,
	QuarantinedRecord,
} from './types';

export const CURRENT_SCHEMA_VERSION = 3;

export type LoadResult =
	| { kind: 'empty'; data: BrainOffloadData }
	| { kind: 'loaded'; data: BrainOffloadData; changed: boolean }
	| { kind: 'unreadable'; reason: string };

export const emptyData = (now: string): BrainOffloadData => ({
	schemaVersion: CURRENT_SCHEMA_VERSION,
	startedAt: now,
	intentions: [],
	sessions: [],
	stretches: [],
	quarantine: [],
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntention(value: unknown): value is Intention {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.title === 'string' &&
		(value.kind === 'idea' || value.kind === 'goal' || value.kind === 'project' || value.kind === 'ongoing') &&
		typeof value.description === 'string' &&
		typeof value.sharedContext === 'string' &&
		typeof value.recipe === 'string' &&
		typeof value.createdAt === 'string' &&
		typeof value.updatedAt === 'string'
	);
}

function isSession(value: unknown): value is IntentionSession {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.intentionId === 'string' &&
		typeof value.date === 'string' &&
		typeof value.durationMinutes === 'number' &&
		typeof value.context === 'string' &&
		(value.contextMode === 'one-shot' || value.contextMode === 'recurring') &&
		typeof value.createdAt === 'string'
	);
}

function isStretch(value: unknown): value is IntentionStretch {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'string' &&
		typeof value.intentionId === 'string' &&
		typeof value.startDate === 'string' &&
		(value.endDate === undefined || typeof value.endDate === 'string') &&
		typeof value.createdAt === 'string' &&
		typeof value.updatedAt === 'string'
	);
}

function isQuarantinedRecord(value: unknown): value is QuarantinedRecord {
	return (
		isRecord(value) &&
		typeof value.collection === 'string' &&
		typeof value.reason === 'string' &&
		typeof value.quarantinedAt === 'string' &&
		'record' in value
	);
}

function earliestRecordDate(records: Array<{ createdAt: string }>): string | undefined {
	const timestamps = records
		.map((record) => Date.parse(record.createdAt))
		.filter((timestamp) => Number.isFinite(timestamp));
	return timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : undefined;
}

/**
 * Turns whatever was saved into current-schema data without discarding anything:
 * records that fail validation, or reference a missing intention, are kept in quarantine.
 */
export function migrate(saved: unknown, now: string): LoadResult {
	if (saved === null || saved === undefined) return { kind: 'empty', data: emptyData(now) };
	if (!isRecord(saved)) return { kind: 'unreadable', reason: 'Saved data is not an object.' };
	const version = saved.schemaVersion ?? 1;
	if (typeof version !== 'number' || !Number.isInteger(version)) {
		return { kind: 'unreadable', reason: 'Saved data has an invalid schema version.' };
	}
	if (version > CURRENT_SCHEMA_VERSION) {
		return {
			kind: 'unreadable',
			reason: `Saved data uses schema version ${version}, which is newer than this plugin supports.`,
		};
	}

	const quarantine: QuarantinedRecord[] = Array.isArray(saved.quarantine)
		? saved.quarantine.filter(isQuarantinedRecord)
		: [];
	const hold = (collection: string, record: unknown, reason: string) => {
		quarantine.push({ collection, record, reason, quarantinedAt: now });
	};
	const listOf = (key: string): unknown[] => {
		const value = saved[key];
		if (value === undefined) return [];
		if (Array.isArray(value)) return value;
		hold(key, value, 'Expected a list.');
		return [];
	};

	const intentions: Intention[] = [];
	for (const record of listOf('intentions')) {
		if (isIntention(record)) intentions.push(record);
		else hold('intentions', record, 'Invalid intention.');
	}
	const intentionIds = new Set(intentions.map((intention) => intention.id));
	const sessions: IntentionSession[] = [];
	for (const record of listOf('sessions')) {
		if (!isSession(record)) hold('sessions', record, 'Invalid session.');
		else if (!intentionIds.has(record.intentionId)) hold('sessions', record, 'Intention not found.');
		else sessions.push(record);
	}
	const stretches: IntentionStretch[] = [];
	for (const record of listOf('stretches')) {
		if (!isStretch(record)) hold('stretches', record, 'Invalid stretch.');
		else if (!intentionIds.has(record.intentionId)) hold('stretches', record, 'Intention not found.');
		else stretches.push(record);
	}

	const startedAt = typeof saved.startedAt === 'string' && Number.isFinite(Date.parse(saved.startedAt))
		? saved.startedAt
		: earliestRecordDate([...intentions, ...sessions]) ?? now;
	const data: BrainOffloadData = {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		startedAt,
		intentions,
		sessions,
		stretches,
		quarantine,
	};
	return { kind: 'loaded', data, changed: JSON.stringify(data) !== JSON.stringify(saved) };
}

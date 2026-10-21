import { Plugin } from 'obsidian';
import type {
	BrainOffloadData,
	Intention,
	IntentionDraft,
	IntentionSession,
	IntentionStretch,
	IntentionStretchDraft,
	SessionDraft,
} from './types';

const emptyData = (): BrainOffloadData => ({
	schemaVersion: 2,
	startedAt: new Date().toISOString(),
	intentions: [],
	sessions: [],
	stretches: [],
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
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

function earliestRecordDate(records: Array<{ createdAt: string }>): string | undefined {
	const timestamps = records
		.map((record) => Date.parse(record.createdAt))
		.filter((timestamp) => Number.isFinite(timestamp));
	return timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : undefined;
}

export class BrainOffloadStore {
	private data = emptyData();

	constructor(private readonly plugin: Plugin) {}

	get intentions(): Intention[] {
		return [...this.data.intentions];
	}

	get sessions(): IntentionSession[] {
		return [...this.data.sessions];
	}

	get stretches(): IntentionStretch[] {
		return [...this.data.stretches];
	}

	get startedAt(): string {
		return this.data.startedAt;
	}

	async load(): Promise<void> {
		const saved: unknown = await this.plugin.loadData();
		if (!isRecord(saved)) {
			this.data = emptyData();
			await this.persist();
			return;
		}
		const intentions = Array.isArray(saved.intentions)
			? saved.intentions.filter(isIntention)
			: [];
		const intentionIds = new Set(intentions.map((intention) => intention.id));
		const sessions = Array.isArray(saved.sessions)
			? saved.sessions.filter(
					(session): session is IntentionSession =>
						isSession(session) && intentionIds.has(session.intentionId),
				)
			: [];
			const stretches = Array.isArray(saved.stretches)
				? saved.stretches.filter(
						(stretch): stretch is IntentionStretch =>
							isStretch(stretch) && intentionIds.has(stretch.intentionId),
					)
				: [];
			const startedAt = typeof saved.startedAt === 'string' && Number.isFinite(Date.parse(saved.startedAt))
				? saved.startedAt
				: earliestRecordDate([...intentions, ...sessions]) ?? new Date().toISOString();
			this.data = { schemaVersion: 2, startedAt, intentions, sessions, stretches };
			if (saved.schemaVersion !== 2 || saved.startedAt !== startedAt || !Array.isArray(saved.stretches)) {
				await this.persist();
			}
	}

	async saveIntention(draft: IntentionDraft, id?: string): Promise<Intention> {
		const now = new Date().toISOString();
		const existing = id
			? this.data.intentions.find((intention) => intention.id === id)
			: undefined;
		const intention: Intention = {
			...draft,
			id: existing?.id ?? crypto.randomUUID(),
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};
		if (existing) {
			this.data.intentions = this.data.intentions.map((item) =>
				item.id === intention.id ? intention : item,
			);
		} else {
			this.data.intentions.unshift(intention);
		}
		await this.persist();
		return intention;
	}

	async saveSession(draft: SessionDraft): Promise<IntentionSession> {
		if (!this.data.intentions.some((item) => item.id === draft.intentionId)) {
			throw new Error('Choose an existing intention for this session.');
		}
		const session: IntentionSession = {
			...draft,
			id: crypto.randomUUID(),
			createdAt: new Date().toISOString(),
		};
		this.data.sessions.unshift(session);
		await this.persist();
		return session;
	}

	async saveStretch(draft: IntentionStretchDraft, id?: string): Promise<IntentionStretch> {
		if (!this.data.intentions.some((item) => item.id === draft.intentionId)) {
			throw new Error('Choose an existing intention for this stretch.');
		}
		if (!draft.startDate || (draft.endDate && draft.endDate < draft.startDate)) {
			throw new Error('Enter a valid stretch date range.');
		}
		const now = new Date().toISOString();
		const existing = id ? this.data.stretches.find((stretch) => stretch.id === id) : undefined;
		const stretch: IntentionStretch = {
			...draft,
			endDate: draft.endDate || undefined,
			id: existing?.id ?? crypto.randomUUID(),
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};
		if (existing) {
			this.data.stretches = this.data.stretches.map((item) =>
				item.id === stretch.id ? stretch : item,
			);
		} else {
			this.data.stretches.push(stretch);
		}
		await this.persist();
		return stretch;
	}

	private async persist(): Promise<void> {
		await this.plugin.saveData(this.data);
	}
}
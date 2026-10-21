import { normalizePath, Plugin } from 'obsidian';
import { emptyData, migrate } from './migrations';
import type {
	Intention,
	IntentionDraft,
	IntentionSession,
	IntentionStretch,
	IntentionStretchDraft,
	SessionDraft,
} from './types';

const MAX_BACKUPS = 10;

export class BrainOffloadStore {
	private data = emptyData(new Date().toISOString());
	/** Set when saved data could not be read or backed up; saving would risk overwriting it. */
	private writeBlockedReason?: string;

	constructor(private readonly plugin: Plugin) {}

	get loadProblem(): string | undefined {
		return this.writeBlockedReason;
	}

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
		let saved: unknown;
		try {
			saved = await this.plugin.loadData();
		} catch {
			this.writeBlockedReason = 'Brain Offload could not read its saved data, so changes will not be saved.';
			return;
		}
		const result = migrate(saved, new Date().toISOString());
		if (result.kind === 'unreadable') {
			this.writeBlockedReason = `${result.reason} Changes will not be saved, to protect your data.`;
			return;
		}
		this.data = result.data;
		if (result.kind === 'empty') {
			await this.persist();
			return;
		}
		if (!result.changed) return;
		try {
			await this.backup(saved);
		} catch {
			this.writeBlockedReason =
				'Brain Offload could not back up its saved data before upgrading it, so changes will not be saved.';
			return;
		}
		await this.persist();
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
		if (this.writeBlockedReason) throw new Error(this.writeBlockedReason);
		await this.plugin.saveData(this.data);
	}

	/** Copies the saved data, as read, to a timestamped file before it is overwritten. */
	private async backup(saved: unknown): Promise<void> {
		const { adapter, configDir } = this.plugin.app.vault;
		const pluginDir = this.plugin.manifest.dir ?? `${configDir}/plugins/${this.plugin.manifest.id}`;
		const folder = normalizePath(`${pluginDir}/backups`);
		if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		await adapter.write(normalizePath(`${folder}/data-${stamp}.json`), JSON.stringify(saved, null, '\t'));
		const backups = (await adapter.list(folder)).files
			.filter((path) => /\/data-[^/]+\.json$/.test(path))
			.sort();
		for (const path of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
			await adapter.remove(path);
		}
	}
}
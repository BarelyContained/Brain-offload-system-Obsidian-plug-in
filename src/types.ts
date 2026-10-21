export type IntentionKind = 'idea' | 'goal' | 'project' | 'ongoing';
export type SessionContextMode = 'one-shot' | 'recurring';

export interface IntentionDraft {
	title: string;
	kind: IntentionKind;
	description: string;
	sharedContext: string;
	recipe: string;
}

export interface Intention extends IntentionDraft {
	id: string;
	createdAt: string;
	updatedAt: string;
}

export interface SessionDraft {
	intentionId: string;
	date: string;
	durationMinutes: number;
	context: string;
	contextMode: SessionContextMode;
}

export interface IntentionSession extends SessionDraft {
	id: string;
	createdAt: string;
}

export interface IntentionStretchDraft {
	intentionId: string;
	startDate: string;
	endDate?: string;
}

export interface IntentionStretch extends IntentionStretchDraft {
	id: string;
	createdAt: string;
	updatedAt: string;
}

export interface BrainOffloadData {
	schemaVersion: 2;
	startedAt: string;
	intentions: Intention[];
	sessions: IntentionSession[];
	stretches: IntentionStretch[];
}
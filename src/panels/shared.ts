import { App, Notice, setIcon } from 'obsidian';
import { SessionModal } from '../modals';
import type { BrainOffloadStore } from '../store';
import type { Intention, IntentionSession } from '../types';

export interface PanelContext {
	app: App;
	store: BrainOffloadStore;
	rerender(): void;
}

export interface Panel {
	render(root: HTMLElement): void;
}

export function addPanelAction(container: HTMLElement, label: string, icon: string, onClick: () => void): void {
	const button = container.createEl('button', { cls: 'brain-offload__action mod-cta' });
	const iconEl = button.createSpan({ cls: 'brain-offload__action-icon' });
	setIcon(iconEl, icon);
	button.createSpan({ text: label });
	button.addEventListener('click', onClick);
}

export function addQuietAction(container: HTMLElement, label: string, onClick: () => void): void {
	const button = container.createEl('button', {
		cls: 'brain-offload__quiet-action',
		text: label,
	});
	button.addEventListener('click', onClick);
}

export function addIconAction(container: HTMLElement, label: string, icon: string, onClick: () => void): void {
	const button = container.createEl('button', {
		cls: 'brain-offload__icon-action',
		attr: { 'aria-label': label, title: label },
	});
	setIcon(button, icon);
	button.addEventListener('click', onClick);
}

export function renderSessionRow(
	container: HTMLElement,
	session: IntentionSession,
	showIntention: boolean,
	intentionTitle?: string,
): void {
	const row = container.createDiv({ cls: 'brain-offload__session-row' });
	const main = row.createDiv({ cls: 'brain-offload__session-main' });
	if (showIntention && intentionTitle) main.createEl('strong', { text: intentionTitle });
	main.createSpan({
		cls: 'brain-offload__session-meta',
		text: `${formatDate(session.date)} · ${formatDuration(session.durationMinutes)}`,
	});
	if (session.context) main.createEl('p', { text: session.context });
	row.createSpan({
		cls: 'brain-offload__context-tag',
		text: session.contextMode === 'one-shot' ? 'One-shot context' : 'Recurring context',
	});
}

export function renderTextSection(container: HTMLElement, title: string, text: string): void {
	const section = container.createDiv({ cls: 'brain-offload__text-section' });
	section.createEl('h3', { text: title });
	section.createEl('p', {
		cls: text ? '' : 'brain-offload__muted',
		text: text || 'Nothing saved here yet.',
	});
}

export function openSessionModal(ctx: PanelContext, intentionId?: string): void {
	const intentions = ctx.store.intentions;
	if (intentions.length === 0) {
		new Notice('Create an intention before logging a session.');
		return;
	}
	new SessionModal(
		ctx.app,
		intentions,
		async (draft) => {
			await ctx.store.saveSession(draft);
			ctx.rerender();
		},
		intentionId,
	).open();
}

export function kindLabel(kind: Intention['kind']): string {
	const labels: Record<Intention['kind'], string> = {
		idea: 'Vague idea',
		goal: 'Concrete goal',
		project: 'Work project',
		ongoing: 'Ongoing commitment',
	};
	return labels[kind];
}

export function formatDate(value: string): string {
	const date = new Date(`${value}T12:00:00`);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	if (hours === 0) return `${remainder} min`;
	if (remainder === 0) return `${hours} hr`;
	return `${hours} hr ${remainder} min`;
}

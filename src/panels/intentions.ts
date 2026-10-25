import { IntentionModal } from '../modals';
import type { Intention, IntentionSession } from '../types';
import {
	addPanelAction,
	addQuietAction,
	kindLabel,
	openSessionModal,
	Panel,
	PanelContext,
	renderSessionRow,
	renderTextSection,
} from './shared';

export class IntentionsPanel implements Panel {
	private selectedIntentionId?: string;

	constructor(private readonly ctx: PanelContext) {}

	render(root: HTMLElement): void {
		const intentions = this.ctx.store.intentions;
		const sessions = this.ctx.store.sessions;
		const selected = intentions.find((item) => item.id === this.selectedIntentionId) ?? intentions[0];
		this.selectedIntentionId = selected?.id;
		const heading = root.createDiv({ cls: 'brain-offload__page-heading' });
		const titleGroup = heading.createDiv();
		titleGroup.createEl('p', {
			cls: 'brain-offload__eyebrow',
			text: 'Intentions, over the longer term',
		});
		titleGroup.createEl('h2', { text: 'A little room for the bigger picture' });
		titleGroup.createEl('p', {
			cls: 'brain-offload__subheading',
			text: 'Months of intention, not calendar events.',
		});
		addPanelAction(heading, 'New intention', 'plus', () => {
			new IntentionModal(this.ctx.app, async (draft) => {
				const saved = await this.ctx.store.saveIntention(draft);
				this.selectedIntentionId = saved.id;
				this.ctx.rerender();
			}).open();
		});
		if (!selected) {
			const empty = root.createDiv({ cls: 'brain-offload__empty' });
			empty.createEl('h3', { text: 'Start with one intention' });
			empty.createEl('p', {
				text: 'Save the idea, its shared context, and a recipe you can return to.',
			});
			return;
		}

		const layout = root.createDiv({ cls: 'brain-offload__intention-layout' });
		const list = layout.createDiv({ cls: 'brain-offload__intention-list' });
		const listHeading = list.createDiv({ cls: 'brain-offload__list-heading' });
		listHeading.createEl('h3', { text: 'Your intentions' });
		listHeading.createSpan({ cls: 'brain-offload__count', text: String(intentions.length) });
		for (const intention of intentions) {
			const count = sessions.filter((item) => item.intentionId === intention.id).length;
			const item = list.createEl('button', {
				cls: intention.id === selected.id
					? 'brain-offload__intention-item is-selected'
					: 'brain-offload__intention-item',
			});
			item.createSpan({ cls: 'brain-offload__kind', text: kindLabel(intention.kind) });
			item.createEl('strong', { text: intention.title });
			item.createSpan({
				cls: 'brain-offload__muted',
				text: `${count} ${count === 1 ? 'session' : 'sessions'}`,
			});
			item.addEventListener('click', () => {
				this.selectedIntentionId = intention.id;
				this.ctx.rerender();
			});
		}
		this.renderDetail(layout, selected, sessions);
	}

	private renderDetail(layout: HTMLElement, intention: Intention, sessions: IntentionSession[]): void {
		const detail = layout.createDiv({ cls: 'brain-offload__detail' });
		const actions = detail.createDiv({ cls: 'brain-offload__detail-actions' });
		addPanelAction(actions, 'Log session', 'circle-play', () => openSessionModal(this.ctx, intention.id));
		addQuietAction(actions, 'Edit intention', () => {
			new IntentionModal(
				this.ctx.app,
				async (draft) => {
					await this.ctx.store.saveIntention(draft, intention.id);
					this.ctx.rerender();
				},
				intention,
			).open();
		});
		detail.createEl('p', {
			cls: 'brain-offload__eyebrow',
			text: kindLabel(intention.kind).toUpperCase(),
		});
		detail.createEl('h2', { text: intention.title });
		if (intention.description) {
			detail.createEl('p', { cls: 'brain-offload__description', text: intention.description });
		}
		renderTextSection(detail, 'Shared context', intention.sharedContext);
		renderTextSection(detail, 'Recipe', intention.recipe);
		const intentionSessions = sessions.filter((item) => item.intentionId === intention.id);
		const recent = detail.createDiv({ cls: 'brain-offload__recent' });
		const recentHeading = recent.createDiv({ cls: 'brain-offload__section-heading' });
		recentHeading.createEl('h3', { text: 'Recent sessions' });
		recentHeading.createSpan({ cls: 'brain-offload__muted', text: `${intentionSessions.length} total` });
		if (intentionSessions.length === 0) {
			recent.createEl('p', { cls: 'brain-offload__muted', text: 'No sessions logged yet.' });
		} else {
			for (const session of intentionSessions.slice(0, 3)) {
				renderSessionRow(recent, session, false);
			}
		}
	}
}

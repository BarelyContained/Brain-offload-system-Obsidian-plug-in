import { addPanelAction, openSessionModal, Panel, PanelContext, renderSessionRow } from './shared';

export class SessionsPanel implements Panel {
	constructor(private readonly ctx: PanelContext) {}

	render(root: HTMLElement): void {
		const intentions = this.ctx.store.intentions;
		const sessions = [...this.ctx.store.sessions].sort((left, right) => right.date.localeCompare(left.date));
		const heading = root.createDiv({ cls: 'brain-offload__page-heading' });
		const titleGroup = heading.createDiv();
		titleGroup.createEl('p', { cls: 'brain-offload__eyebrow', text: 'Recorded work' });
		titleGroup.createEl('h2', { text: 'Sessions' });
		titleGroup.createEl('p', {
			cls: 'brain-offload__subheading',
			text: 'Actual time spent, with the context you needed.',
		});
		addPanelAction(heading, 'Log session', 'circle-play', () => openSessionModal(this.ctx));
		const list = root.createDiv({ cls: 'brain-offload__session-list' });
		if (sessions.length === 0) {
			const empty = list.createDiv({ cls: 'brain-offload__empty' });
			empty.createEl('h3', { text: 'No sessions yet' });
			empty.createEl('p', {
				text: 'Log a session when you finish, then save the time you actually spent.',
			});
			return;
		}
		for (const session of sessions) {
			const intention = intentions.find((item) => item.id === session.intentionId);
			if (intention) renderSessionRow(list, session, true, intention.title);
		}
	}
}

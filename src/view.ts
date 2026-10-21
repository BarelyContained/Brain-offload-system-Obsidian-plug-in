import { ItemView, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import { BrainOffloadStore } from './store';
import { IntentionModal, SessionModal, StretchModal } from './modals';
import { Intention, IntentionSession, IntentionStretch } from './types';

export const VIEW_TYPE_BRAIN_OFFLOAD = 'brain-offload-panel';
type Panel = 'intentions' | 'horizon' | 'sessions';

const HORIZON_RANGES = [3, 6, 12, 24, 48, 96] as const;

function shiftMonth(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateMonth(value: string): string {
	return value.slice(0, 7);
}

function localDate(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export class BrainOffloadView extends ItemView {
	private panel: Panel = 'intentions';
	private selectedIntentionId?: string;
	private horizonMonths = 6;
	private horizonStart?: Date;

	constructor(leaf: WorkspaceLeaf, private readonly store: BrainOffloadStore) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_BRAIN_OFFLOAD;
	}

	getDisplayText(): string {
		return 'Brain offload';
	}

	getIcon(): string {
		return 'brain';
	}

	onOpen(): Promise<void> {
		this.render();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('brain-offload-view');
		const root = contentEl.createDiv({ cls: 'brain-offload' });
		const header = root.createDiv({ cls: 'brain-offload__header' });
		const identity = header.createDiv({ cls: 'brain-offload__identity' });
		const icon = identity.createSpan({ cls: 'brain-offload__brand-icon' });
		setIcon(icon, 'brain');
		const brand = identity.createDiv();
		brand.createEl('h1', { text: 'Brain offload' });
		brand.createEl('p', { text: 'Keep intentions, context, and real work sessions together.' });

		const tabs = root.createDiv({
			cls: 'brain-offload__tabs',
			attr: { role: 'tablist', 'aria-label': 'Brain Offload views' },
		});
		this.renderTab(tabs, 'intentions', 'Intentions');
		this.renderTab(tabs, 'horizon', 'Horizon');
		this.renderTab(tabs, 'sessions', 'Sessions');
		if (this.panel === 'intentions') this.renderIntentions(root);
		else if (this.panel === 'horizon') this.renderHorizon(root);
		else this.renderSessions(root);
	}

	private renderTab(container: HTMLElement, panel: Panel, label: string): void {
		const button = container.createEl('button', {
			cls: this.panel === panel ? 'brain-offload__tab is-active' : 'brain-offload__tab',
			text: label,
			attr: { role: 'tab', 'aria-selected': String(this.panel === panel) },
		});
		button.addEventListener('click', () => {
			this.panel = panel;
			this.render();
		});
	}

	private renderIntentions(root: HTMLElement): void {
		const intentions = this.store.intentions;
		const sessions = this.store.sessions;
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
		this.addPanelAction(heading, 'New intention', 'plus', () => {
			new IntentionModal(this.app, async (draft) => {
				const saved = await this.store.saveIntention(draft);
				this.selectedIntentionId = saved.id;
				this.render();
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
			item.createSpan({ cls: 'brain-offload__kind', text: this.kindLabel(intention.kind) });
			item.createEl('strong', { text: intention.title });
			item.createSpan({
				cls: 'brain-offload__muted',
				text: `${count} ${count === 1 ? 'session' : 'sessions'}`,
			});
			item.addEventListener('click', () => {
				this.selectedIntentionId = intention.id;
				this.render();
			});
		}
		this.renderIntentionDetail(layout, selected, sessions);
	}

	private renderIntentionDetail(
		layout: HTMLElement,
		intention: Intention,
		sessions: IntentionSession[],
	): void {
		const detail = layout.createDiv({ cls: 'brain-offload__detail' });
		const actions = detail.createDiv({ cls: 'brain-offload__detail-actions' });
		this.addPanelAction(actions, 'Log session', 'circle-play', () => this.openSessionModal(intention.id));
		this.addQuietAction(actions, 'Edit intention', () => {
			new IntentionModal(
				this.app,
				async (draft) => {
					await this.store.saveIntention(draft, intention.id);
					this.render();
				},
				intention,
			).open();
		});
		detail.createEl('p', {
			cls: 'brain-offload__eyebrow',
			text: this.kindLabel(intention.kind).toUpperCase(),
		});
		detail.createEl('h2', { text: intention.title });
		if (intention.description) {
			detail.createEl('p', { cls: 'brain-offload__description', text: intention.description });
		}
		this.renderTextSection(detail, 'Shared context', intention.sharedContext);
		this.renderTextSection(detail, 'Recipe', intention.recipe);
		const intentionSessions = sessions.filter((item) => item.intentionId === intention.id);
		const recent = detail.createDiv({ cls: 'brain-offload__recent' });
		const recentHeading = recent.createDiv({ cls: 'brain-offload__section-heading' });
		recentHeading.createEl('h3', { text: 'Recent sessions' });
		recentHeading.createSpan({ cls: 'brain-offload__muted', text: `${intentionSessions.length} total` });
		if (intentionSessions.length === 0) {
			recent.createEl('p', { cls: 'brain-offload__muted', text: 'No sessions logged yet.' });
		} else {
			for (const session of intentionSessions.slice(0, 3)) {
				this.renderSessionRow(recent, session, false);
			}
		}
	}

	private renderSessions(root: HTMLElement): void {
		const intentions = this.store.intentions;
		const sessions = [...this.store.sessions].sort((left, right) => right.date.localeCompare(left.date));
		const heading = root.createDiv({ cls: 'brain-offload__page-heading' });
		const titleGroup = heading.createDiv();
		titleGroup.createEl('p', { cls: 'brain-offload__eyebrow', text: 'Recorded work' });
		titleGroup.createEl('h2', { text: 'Sessions' });
		titleGroup.createEl('p', {
			cls: 'brain-offload__subheading',
			text: 'Actual time spent, with the context you needed.',
		});
		this.addPanelAction(heading, 'Log session', 'circle-play', () => this.openSessionModal());
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
			if (intention) this.renderSessionRow(list, session, true, intention.title);
		}
	}

	private renderHorizon(root: HTMLElement): void {
		const intentions = this.store.intentions;
		const stretches = this.store.stretches;
		const today = new Date();
		const todayKey = monthKey(today);
		if (!this.horizonStart) {
			this.horizonStart = shiftMonth(today, 0);
		}
		const start = this.horizonStart;
		const months = Array.from({ length: this.horizonMonths }, (_, index) => shiftMonth(start, index));
		const monthKeys = months.map(monthKey);
		const heading = root.createDiv({ cls: 'brain-offload__page-heading brain-offload__horizon-heading' });
		const titleGroup = heading.createDiv();
		titleGroup.createEl('p', { cls: 'brain-offload__eyebrow', text: 'Active stretches, pauses, and plans' });
		titleGroup.createEl('h2', { text: 'Intention horizon' });
		titleGroup.createEl('p', {
			cls: 'brain-offload__subheading',
			text: 'One row per intention. Sessions are not shown here.',
		});

		const controls = heading.createDiv({ cls: 'brain-offload__horizon-controls' });
		const rangeControl = controls.createDiv({
			cls: 'brain-offload__range-control',
			attr: { role: 'group', 'aria-label': 'Horizon range in months' },
		});
		for (const range of HORIZON_RANGES) {
			const button = rangeControl.createEl('button', {
				cls: range === this.horizonMonths ? 'is-active' : '',
				text: String(range),
				attr: {
					'aria-label': `${range} months`,
					'aria-pressed': String(range === this.horizonMonths),
					title: `${range} months`,
				},
			});
			button.addEventListener('click', () => {
				this.horizonMonths = range;
				this.horizonStart = shiftMonth(today, 0);
				this.render();
			});
		}

		const navigation = controls.createDiv({ cls: 'brain-offload__horizon-navigation' });
		this.addIconAction(navigation, 'Previous range', 'chevron-left', () => {
			this.horizonStart = shiftMonth(start, -this.horizonMonths);
			this.render();
		});
		const todayButton = navigation.createEl('button', {
			cls: 'brain-offload__today-action',
			text: 'Today',
		});
		todayButton.addEventListener('click', () => {
			this.horizonStart = shiftMonth(today, 0);
			this.render();
		});
		this.addIconAction(navigation, 'Next range', 'chevron-right', () => {
			this.horizonStart = shiftMonth(start, this.horizonMonths);
			this.render();
		});

		const legend = root.createDiv({ cls: 'brain-offload__horizon-legend' });
		legend.createSpan({ cls: 'is-historical', text: 'Historical' });
		legend.createSpan({ cls: 'is-current', text: 'Active' });
		legend.createSpan({ cls: 'is-planned', text: 'Planned' });
		const board = root.createDiv({ cls: 'brain-offload__horizon-board' });
		const fixedList = board.createDiv({ cls: 'brain-offload__horizon-fixed-list' });
		fixedList.createDiv({ cls: 'brain-offload__horizon-fixed-heading', text: 'Intention' });
		const countLabel = fixedList.createDiv({ cls: 'brain-offload__concurrency-label' });
		countLabel.createEl('strong', { text: 'Concurrent intentions' });
		countLabel.createSpan({ text: 'Active stretches only' });

		const scroll = board.createDiv({ cls: 'brain-offload__horizon-scroll' });
		const monthColumns = `repeat(${months.length}, minmax(42px, 1fr))`;
		const headerGrid = scroll.createDiv({ cls: 'brain-offload__horizon-grid' });
		headerGrid.style.gridTemplateColumns = monthColumns;
		for (let index = 0; index < months.length; index++) {
			const month = months[index];
			const key = monthKeys[index];
			const headerCell = headerGrid.createDiv({
				cls: `brain-offload__month-heading${key === todayKey ? ' is-today' : ''}${key === dateMonth(this.store.startedAt) ? ' is-started' : ''}`,
			});
			headerCell.createSpan({
				cls: 'brain-offload__month-label',
				text: new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(month),
			});
			if (key === todayKey) headerCell.createSpan({ cls: 'brain-offload__month-marker', text: 'Today' });
			if (key === dateMonth(this.store.startedAt)) {
				headerCell.createSpan({ cls: 'brain-offload__month-marker', text: 'Started' });
			}
		}

		const countGrid = scroll.createDiv({ cls: 'brain-offload__horizon-grid' });
		countGrid.style.gridTemplateColumns = monthColumns;
		for (const key of monthKeys) {
			const activeIds = new Set(
				stretches
					.filter((stretch) => this.isStretchActiveInMonth(stretch, key))
					.map((stretch) => stretch.intentionId),
			);
			const countCell = countGrid.createDiv({
				cls: `brain-offload__concurrency-cell${key === todayKey ? ' is-today' : ''}`,
			});
			countCell.createSpan({ text: String(activeIds.size), attr: { 'aria-label': `${activeIds.size} active intentions` } });
		}

		for (const intention of intentions) {
			const rowLabel = fixedList.createDiv({ cls: 'brain-offload__horizon-row-label' });
			rowLabel.createEl('strong', { text: intention.title });
			rowLabel.createSpan({ cls: 'brain-offload__kind', text: this.kindLabel(intention.kind) });
			const addButton = rowLabel.createEl('button', {
				cls: 'brain-offload__add-stretch',
				text: 'Add stretch',
				attr: { 'aria-label': `Add active stretch for ${intention.title}` },
			});
			addButton.addEventListener('click', () => this.openStretchModal(intention));

			const track = scroll.createDiv({ cls: 'brain-offload__horizon-track' });
			track.style.gridTemplateColumns = monthColumns;
			for (let index = 0; index < months.length; index++) {
				const key = monthKeys[index];
				track.createDiv({
					cls: `brain-offload__horizon-cell${key === todayKey ? ' is-today' : ''}`,
				});
			}

			for (const stretch of stretches.filter((item) => item.intentionId === intention.id)) {
				const visibleIndexes = monthKeys
					.map((key, index) => this.isStretchActiveInMonth(stretch, key) ? index : -1)
					.filter((index) => index >= 0);
				if (visibleIndexes.length === 0) continue;
				const first = visibleIndexes[0];
				const last = visibleIndexes[visibleIndexes.length - 1];
				if (first === undefined || last === undefined) continue;
				const historical = Boolean(stretch.endDate && stretch.endDate < localDate());
				const planned = stretch.startDate > localDate();
				const state = historical ? 'is-historical' : planned ? 'is-planned' : 'is-current';
				const bar = track.createEl('button', {
					cls: `brain-offload__stretch-bar ${state}`,
					attr: {
						'aria-label': `Adjust ${historical ? 'historical' : planned ? 'planned' : 'active'} stretch for ${intention.title}, ${this.formatDate(stretch.startDate)} to ${stretch.endDate ? this.formatDate(stretch.endDate) : 'ongoing'}`,
						title: `${this.formatDate(stretch.startDate)} to ${stretch.endDate ? this.formatDate(stretch.endDate) : 'ongoing'} · Select to adjust`,
					},
				});
				bar.style.left = `${first * 100 / months.length}%`;
				bar.style.width = `${(last - first + 1) * 100 / months.length}%`;
				bar.createSpan({ text: historical ? 'Historical' : planned ? 'Planned' : 'Active' });
				if (!stretch.endDate) {
					const continuation = bar.createSpan({ cls: 'brain-offload__stretch-continuation' });
					setIcon(continuation, 'arrow-right');
				}
				bar.addEventListener('click', () => this.openStretchModal(intention, stretch));
			}
		}

		if (intentions.length === 0) {
			const empty = root.createDiv({ cls: 'brain-offload__empty' });
			empty.createEl('h3', { text: 'Add an intention to the horizon' });
			empty.createEl('p', { text: 'Intentions appear here as dated active stretches, never as individual sessions.' });
		}
	}

	private isStretchActiveInMonth(stretch: IntentionStretch, month: string): boolean {
		return dateMonth(stretch.startDate) <= month && (!stretch.endDate || dateMonth(stretch.endDate) >= month);
	}

	private openStretchModal(intention: Intention, existing?: IntentionStretch): void {
		new StretchModal(
			this.app,
			intention,
			async (draft, id) => {
				await this.store.saveStretch(draft, id);
				this.render();
			},
			existing,
		).open();
	}

	private addIconAction(container: HTMLElement, label: string, icon: string, onClick: () => void): void {
		const button = container.createEl('button', {
			cls: 'brain-offload__icon-action',
			attr: { 'aria-label': label, title: label },
		});
		setIcon(button, icon);
		button.addEventListener('click', onClick);
	}

	private renderSessionRow(
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
			text: `${this.formatDate(session.date)} · ${this.formatDuration(session.durationMinutes)}`,
		});
		if (session.context) main.createEl('p', { text: session.context });
		row.createSpan({
			cls: 'brain-offload__context-tag',
			text: session.contextMode === 'one-shot' ? 'One-shot context' : 'Recurring context',
		});
	}

	private renderTextSection(container: HTMLElement, title: string, text: string): void {
		const section = container.createDiv({ cls: 'brain-offload__text-section' });
		section.createEl('h3', { text: title });
		section.createEl('p', {
			cls: text ? '' : 'brain-offload__muted',
			text: text || 'Nothing saved here yet.',
		});
	}

	private openSessionModal(intentionId?: string): void {
		const intentions = this.store.intentions;
		if (intentions.length === 0) {
			new Notice('Create an intention before logging a session.');
			return;
		}
		new SessionModal(
			this.app,
			intentions,
			async (draft) => {
				await this.store.saveSession(draft);
				this.render();
			},
			intentionId,
		).open();
	}

	private addPanelAction(container: HTMLElement, label: string, icon: string, onClick: () => void): void {
		const button = container.createEl('button', { cls: 'brain-offload__action mod-cta' });
		const iconEl = button.createSpan({ cls: 'brain-offload__action-icon' });
		setIcon(iconEl, icon);
		button.createSpan({ text: label });
		button.addEventListener('click', onClick);
	}

	private addQuietAction(container: HTMLElement, label: string, onClick: () => void): void {
		const button = container.createEl('button', {
			cls: 'brain-offload__quiet-action',
			text: label,
		});
		button.addEventListener('click', onClick);
	}

	private kindLabel(kind: Intention['kind']): string {
		const labels: Record<Intention['kind'], string> = {
			idea: 'Vague idea',
			goal: 'Concrete goal',
			project: 'Work project',
			ongoing: 'Ongoing commitment',
		};
		return labels[kind];
	}

	private formatDate(value: string): string {
		const date = new Date(`${value}T12:00:00`);
		return Number.isNaN(date.getTime())
			? value
			: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
	}

	private formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const remainder = minutes % 60;
		if (hours === 0) return `${remainder} min`;
		if (remainder === 0) return `${hours} hr`;
		return `${hours} hr ${remainder} min`;
	}
}
import { setIcon } from 'obsidian';
import { dateMonth, localDate, monthKey, shiftMonth } from '../dates';
import {
	concurrentIntentions,
	HORIZON_RANGES,
	stretchState,
	visibleSpan,
} from '../horizon-model';
import { StretchModal } from '../modals';
import type { Intention, IntentionStretch } from '../types';
import { addIconAction, formatDate, kindLabel, Panel, PanelContext } from './shared';

const STATE_LABELS = { historical: 'Historical', current: 'Active', planned: 'Planned' } as const;

export class HorizonPanel implements Panel {
	private months = 6;
	private start?: Date;

	constructor(private readonly ctx: PanelContext) {}

	render(root: HTMLElement): void {
		const intentions = this.ctx.store.intentions;
		const stretches = this.ctx.store.stretches;
		const startedMonth = dateMonth(this.ctx.store.startedAt);
		const today = new Date();
		const todayKey = monthKey(today);
		if (!this.start) {
			this.start = shiftMonth(today, 0);
		}
		const start = this.start;
		const months = Array.from({ length: this.months }, (_, index) => shiftMonth(start, index));
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
				cls: range === this.months ? 'is-active' : '',
				text: String(range),
				attr: {
					'aria-label': `${range} months`,
					'aria-pressed': String(range === this.months),
					title: `${range} months`,
				},
			});
			button.addEventListener('click', () => {
				this.months = range;
				this.start = shiftMonth(today, 0);
				this.ctx.rerender();
			});
		}

		const navigation = controls.createDiv({ cls: 'brain-offload__horizon-navigation' });
		addIconAction(navigation, 'Previous range', 'chevron-left', () => {
			this.start = shiftMonth(start, -this.months);
			this.ctx.rerender();
		});
		const todayButton = navigation.createEl('button', {
			cls: 'brain-offload__today-action',
			text: 'Today',
		});
		todayButton.addEventListener('click', () => {
			this.start = shiftMonth(today, 0);
			this.ctx.rerender();
		});
		addIconAction(navigation, 'Next range', 'chevron-right', () => {
			this.start = shiftMonth(start, this.months);
			this.ctx.rerender();
		});

		const legend = root.createDiv({ cls: 'brain-offload__horizon-legend' });
		legend.createSpan({ cls: 'is-historical', text: 'Historical' });
		legend.createSpan({ cls: 'is-current', text: 'Active' });
		legend.createSpan({ cls: 'is-planned', text: 'Planned' });
		// Each row pairs its label with its months, so labels and bars stay aligned.
		const board = root.createDiv({ cls: 'brain-offload__horizon-board' });
		const table = board.createDiv({ cls: 'brain-offload__horizon-table' });
		const addRow = (): HTMLElement => table.createDiv({ cls: 'brain-offload__horizon-row' });
		const monthColumns = `repeat(${months.length}, minmax(42px, 1fr))`;

		const headerRow = addRow();
		headerRow.createDiv({ cls: 'brain-offload__horizon-fixed-heading', text: 'Intention' });
		const headerGrid = headerRow.createDiv({ cls: 'brain-offload__horizon-grid' });
		headerGrid.style.gridTemplateColumns = monthColumns;
		for (let index = 0; index < months.length; index++) {
			const month = months[index];
			const key = monthKeys[index];
			const headerCell = headerGrid.createDiv({
				cls: `brain-offload__month-heading${key === todayKey ? ' is-today' : ''}${key === startedMonth ? ' is-started' : ''}`,
			});
			headerCell.createSpan({
				cls: 'brain-offload__month-label',
				text: new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(month),
			});
			if (key === todayKey) headerCell.createSpan({ cls: 'brain-offload__month-marker', text: 'Today' });
			if (key === startedMonth) {
				headerCell.createSpan({ cls: 'brain-offload__month-marker', text: 'Started' });
			}
		}

		const countRow = addRow();
		const countLabel = countRow.createDiv({ cls: 'brain-offload__concurrency-label' });
		countLabel.createEl('strong', { text: 'Concurrent intentions' });
		countLabel.createSpan({ text: 'Active stretches only' });
		const countGrid = countRow.createDiv({ cls: 'brain-offload__horizon-grid' });
		countGrid.style.gridTemplateColumns = monthColumns;
		for (const key of monthKeys) {
			const count = concurrentIntentions(stretches, key);
			const countCell = countGrid.createDiv({
				cls: `brain-offload__concurrency-cell${key === todayKey ? ' is-today' : ''}`,
			});
			countCell.createSpan({ text: String(count), attr: { 'aria-label': `${count} active intentions` } });
		}

		for (const intention of intentions) {
			const row = addRow();
			const rowLabel = row.createDiv({ cls: 'brain-offload__horizon-row-label' });
			rowLabel.createEl('strong', { text: intention.title });
			rowLabel.createSpan({ cls: 'brain-offload__kind', text: kindLabel(intention.kind) });
			const addButton = rowLabel.createEl('button', {
				cls: 'brain-offload__add-stretch',
				text: 'Add stretch',
				attr: { 'aria-label': `Add active stretch for ${intention.title}` },
			});
			addButton.addEventListener('click', () => this.openStretchModal(intention));

			const track = row.createDiv({ cls: 'brain-offload__horizon-track' });
			track.style.gridTemplateColumns = monthColumns;
			for (const key of monthKeys) {
				track.createDiv({
					cls: `brain-offload__horizon-cell${key === todayKey ? ' is-today' : ''}`,
				});
			}

			for (const stretch of stretches.filter((item) => item.intentionId === intention.id)) {
				const span = visibleSpan(stretch, monthKeys);
				if (!span) continue;
				const state = stretchState(stretch, localDate());
				const label = STATE_LABELS[state];
				const range = `${formatDate(stretch.startDate)} to ${stretch.endDate ? formatDate(stretch.endDate) : 'ongoing'}`;
				const bar = track.createEl('button', {
					cls: `brain-offload__stretch-bar is-${state}`,
					attr: {
						'aria-label': `Adjust ${label.toLowerCase()} stretch for ${intention.title}, ${range}`,
						title: `${range} · Select to adjust`,
					},
				});
				bar.style.left = `${span.first * 100 / months.length}%`;
				bar.style.width = `${(span.last - span.first + 1) * 100 / months.length}%`;
				bar.createSpan({ text: label });
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

	private openStretchModal(intention: Intention, existing?: IntentionStretch): void {
		new StretchModal(
			this.ctx.app,
			intention,
			async (draft, id) => {
				await this.ctx.store.saveStretch(draft, id);
				this.ctx.rerender();
			},
			existing,
		).open();
	}
}

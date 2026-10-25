import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';
import { HorizonPanel } from './panels/horizon';
import { IntentionsPanel } from './panels/intentions';
import { SessionsPanel } from './panels/sessions';
import type { Panel, PanelContext } from './panels/shared';
import { BrainOffloadStore } from './store';

export const VIEW_TYPE_BRAIN_OFFLOAD = 'brain-offload-panel';
type PanelId = 'intentions' | 'horizon' | 'sessions';

export class BrainOffloadView extends ItemView {
	private panel: PanelId = 'intentions';
	private readonly panels: Record<PanelId, Panel>;

	constructor(leaf: WorkspaceLeaf, store: BrainOffloadStore) {
		super(leaf);
		const ctx: PanelContext = { app: this.app, store, rerender: () => this.render() };
		this.panels = {
			intentions: new IntentionsPanel(ctx),
			horizon: new HorizonPanel(ctx),
			sessions: new SessionsPanel(ctx),
		};
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
		this.panels[this.panel].render(root);
	}

	private renderTab(container: HTMLElement, panel: PanelId, label: string): void {
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
}

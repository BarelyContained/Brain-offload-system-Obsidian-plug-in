import { Notice, Plugin } from 'obsidian';
import { BrainOffloadStore } from './store';
import { BrainOffloadView, VIEW_TYPE_BRAIN_OFFLOAD } from './view';

export default class BrainOffloadPlugin extends Plugin {
	store!: BrainOffloadStore;

	async onload() {
		this.store = new BrainOffloadStore(this);
		await this.store.load();
		if (this.store.loadProblem) new Notice(this.store.loadProblem, 0);

		this.registerView(
			VIEW_TYPE_BRAIN_OFFLOAD,
			(leaf) => new BrainOffloadView(leaf, this.store),
		);
		this.addRibbonIcon('brain', 'Open brain offload', () => {
			void this.activateView();
		});
		this.addCommand({
			id: 'open-panel',
			name: 'Open panel',
			callback: () => this.activateView(),
		});
	}

	/** Reveals an open panel wherever the user placed it, or opens a new one as a main-area tab. */
	private async activateView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_BRAIN_OFFLOAD)[0];
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}
		const leaf = workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_BRAIN_OFFLOAD, active: true });
		await workspace.revealLeaf(leaf);
	}
}
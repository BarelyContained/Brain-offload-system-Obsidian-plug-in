import { App, Modal, Notice, Setting } from 'obsidian';
import type {
	Intention,
	IntentionDraft,
	IntentionKind,
	IntentionStretch,
	IntentionStretchDraft,
	SessionContextMode,
	SessionDraft,
} from './types';

function localDate(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
		.toISOString()
		.slice(0, 10);
}

export class IntentionModal extends Modal {
	constructor(
		app: App,
		private readonly onSave: (draft: IntentionDraft) => Promise<void>,
		private readonly existing?: Intention,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('brain-offload-modal');
		this.titleEl.setText(this.existing ? 'Edit intention' : 'New intention');
		let title = this.existing?.title ?? '';
		let kind: IntentionKind = this.existing?.kind ?? 'idea';
		let description = this.existing?.description ?? '';
		let sharedContext = this.existing?.sharedContext ?? '';
		let recipe = this.existing?.recipe ?? '';

		new Setting(contentEl).setName('Name').addText((input) => {
			input.setPlaceholder('What are you carrying?').setValue(title);
			input.onChange((value) => (title = value));
		});
		new Setting(contentEl).setName('Kind').addDropdown((input) => {
			input
				.addOption('idea', 'Vague idea')
				.addOption('goal', 'Concrete goal')
				.addOption('project', 'Work project')
				.addOption('ongoing', 'Ongoing commitment')
				.setValue(kind)
				.onChange((value) => (kind = value as IntentionKind));
		});
		new Setting(contentEl)
			.setName('Description')
			.setDesc('A short reminder of what this intention means.')
			.addTextArea((input) => {
				input.setValue(description);
				input.inputEl.rows = 3;
				input.onChange((value) => (description = value));
			});
		new Setting(contentEl)
			.setName('Shared context')
			.setDesc('Prerequisites and instructions that apply across sessions.')
			.addTextArea((input) => {
				input.setValue(sharedContext);
				input.inputEl.rows = 4;
				input.onChange((value) => (sharedContext = value));
			});
		new Setting(contentEl)
			.setName('Recipe')
			.setDesc('The steps, materials, or approach you want to remember.')
			.addTextArea((input) => {
				input.setValue(recipe);
				input.inputEl.rows = 4;
				input.onChange((value) => (recipe = value));
			});
		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(this.existing ? 'Save changes' : 'Create intention')
				.setCta()
				.onClick(() => {
					void this.submit({
						title: title.trim(),
						kind,
						description: description.trim(),
						sharedContext: sharedContext.trim(),
						recipe: recipe.trim(),
					});
				}),
		);
	}

	private async submit(draft: IntentionDraft): Promise<void> {
		if (!draft.title) {
			new Notice('Add a name for this intention.');
			return;
		}
		try {
			await this.onSave(draft);
			this.close();
		} catch {
			new Notice('Could not save this intention.');
		}
	}
}

export class SessionModal extends Modal {
	constructor(
		app: App,
		private readonly intentions: Intention[],
		private readonly onSave: (draft: SessionDraft) => Promise<void>,
		private readonly initialIntentionId?: string,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('brain-offload-modal');
		this.titleEl.setText('Log a session');
		let intentionId = this.initialIntentionId ?? this.intentions[0]?.id ?? '';
		let date = localDate();
		let durationMinutes = 30;
		let context = '';
		let contextMode: SessionContextMode = 'one-shot';

		new Setting(contentEl).setName('Intention').addDropdown((input) => {
			for (const intention of this.intentions) {
				input.addOption(intention.id, intention.title);
			}
			input.setValue(intentionId).onChange((value) => (intentionId = value));
		});
		new Setting(contentEl).setName('Date').addText((input) => {
			input.inputEl.type = 'date';
			input.setValue(date);
			input.onChange((value) => (date = value));
		});
		new Setting(contentEl)
			.setName('Actual duration')
			.setDesc('Record the time you spent, in minutes.')
			.addText((input) => {
				input.inputEl.type = 'number';
				input.inputEl.min = '1';
				input.inputEl.step = '1';
				input.setValue(String(durationMinutes));
				input.onChange((value) => (durationMinutes = Number(value)));
			});
		new Setting(contentEl)
			.setName('Session context')
			.setDesc('Notes or instructions for this session.')
			.addTextArea((input) => {
				input.setValue(context);
				input.inputEl.rows = 4;
				input.onChange((value) => (context = value));
			});
		new Setting(contentEl)
			.setName('Context applies')
			.addDropdown((input) => {
				input
					.addOption('one-shot', 'This session only')
					.addOption('recurring', 'Recurring sessions')
					.setValue(contextMode)
					.onChange((value) => (contextMode = value as SessionContextMode));
			});
		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText('Save session')
				.setCta()
				.onClick(() => {
					void this.submit({
						intentionId,
						date,
						durationMinutes,
						context: context.trim(),
						contextMode,
					});
				}),
		);
	}

	private async submit(draft: SessionDraft): Promise<void> {
		if (!draft.intentionId) {
			new Notice('Choose an intention for this session.');
			return;
		}
		if (!draft.date || !Number.isInteger(draft.durationMinutes) || draft.durationMinutes < 1) {
			new Notice('Enter a date and an actual duration of at least 1 minute.');
			return;
		}
		try {
			await this.onSave(draft);
			this.close();
		} catch {
			new Notice('Could not save this session.');
		}
	}
}

export class StretchModal extends Modal {
	constructor(
		app: App,
		private readonly intention: Intention,
		private readonly onSave: (draft: IntentionStretchDraft, id?: string) => Promise<void>,
		private readonly existing?: IntentionStretch,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('brain-offload-modal');
		this.titleEl.setText(this.existing ? 'Adjust active stretch' : 'Add active stretch');
		let startDate = this.existing?.startDate ?? localDate();
		let endDate = this.existing?.endDate ?? '';

		new Setting(contentEl).setName('Intention').setDesc(this.intention.title);
		new Setting(contentEl).setName('Start date').addText((input) => {
			input.inputEl.type = 'date';
			input.setValue(startDate);
			input.onChange((value) => (startDate = value));
		});
		new Setting(contentEl)
			.setName('End date')
			.setDesc('Leave blank if this intention is still active.')
			.addText((input) => {
				input.inputEl.type = 'date';
				input.setValue(endDate);
				input.onChange((value) => (endDate = value));
			});
		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(this.existing ? 'Save stretch' : 'Add stretch')
				.setCta()
				.onClick(() => {
					void this.submit({
						intentionId: this.intention.id,
						startDate,
						endDate: endDate || undefined,
					}, this.existing?.id);
				}),
		);
	}

	private async submit(draft: IntentionStretchDraft, id?: string): Promise<void> {
		if (!draft.startDate || (draft.endDate && draft.endDate < draft.startDate)) {
			new Notice('Enter an end date on or after the start date.');
			return;
		}
		try {
			await this.onSave(draft, id);
			this.close();
		} catch {
			new Notice('Could not save this active stretch.');
		}
	}
}
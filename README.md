# Brain Offload

Brain Offload is a local-first Obsidian desktop plugin for keeping an intention, its shared context and recipe, and the sessions spent on it together.

## Current workflow

- Create and edit intentions as vague ideas, concrete goals, work projects, or ongoing commitments.
- Save shared prerequisites/instructions and an intention recipe.
- Log sessions against an intention with the date, actual duration in minutes, and session-specific context.
- Mark session context as one-shot or recurring.
- View intentions over 3, 6, 12, 24, 48, or 96 months, independently of sessions.
- Add multiple active stretches to each intention. End a stretch to mark a definite pause, then add another to resume.
- Compare monthly concurrent-intention counts, and distinguish historical stretches from future plans.

All records are stored in this vault's Obsidian plugin data. The plugin makes no network requests. Calendar-linked scheduling and synchronization are intentionally deferred.

## Build

Use Node.js 18 or newer:

```bash
npm install
npm run dev
```

`npm run dev` watches the source and writes `main.js` to the project root. For a production build, run `npm run build`.

## Install in Obsidian

1. Create `<Vault>/.obsidian/plugins/brain-offload/` if it does not exist.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. In Obsidian, open **Settings → Community plugins**, enable community plugins if prompted, then enable **Brain Offload**.
4. Open the panel from the Brain Offload ribbon icon or the **Open Brain Offload** command.

After rebuilding, copy the updated `main.js` and `styles.css` into the plugin folder and reload Obsidian.

## Use the intention horizon

1. Open **Horizon** and choose a range. Use the arrows to move backward or forward, or **Today** to return.
2. Add a stretch to each intention. Leave its end date blank while it remains active.
3. To pause, adjust the stretch and set its end date. To resume, add a new stretch with the resume date.
4. Select a stretch bar to adjust its dates. The monthly count includes each intention at most once and excludes months outside its active stretches.
5. Use the **Today** and **Started** markers to orient the timeline. Open-ended stretches show continuation beyond the visible range.

The horizon shows one row per intention and never displays individual sessions.

## Check persistence after restarting

1. Create an intention and add an active stretch.
2. Close and restart Obsidian, then open Brain Offload → **Horizon**.
3. Confirm the intention and stretch are still present. Add another stretch to verify that pauses and resumes persist separately.

The saved records are in `<Vault>/.obsidian/plugins/brain-offload/data.json`.

Before the plugin upgrades or repairs that file, it copies the original to `backups/` in the same folder and keeps the 10 most recent copies. Records that fail validation are kept in the file's `quarantine` list rather than deleted. If the data cannot be read or backed up, the plugin shows a notice and does not save changes.

## Development checks

```bash
npm run build
npm run lint
```

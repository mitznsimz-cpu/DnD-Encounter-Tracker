# MitzNSimz Encounter Tracker

A fast, offline‑friendly combat tracker for **Dungeons & Dragons 5th Edition** — built for Dungeon Masters who run their games at the table with physical minis and just want the bookkeeping handled.

**▶ Use it here: https://mitznsimz-cpu.github.io/DnD-Encounter-Tracker/index.html**

No install, no account, no setup. It runs entirely in your browser, works on desktop, tablet and phone, and keeps everything on your own device.

📖 **[User Guide (PDF)](MitzNSimz_Encounter_Tracker_User_Guide.pdf)** · 🃏 **[Table Card — one printable page for beside the dice](MitzNSimz_Encounter_Tracker_Table_Card.pdf)**
Both are also built into the app under **Help**.

---

## What it does

- **Initiative & turn tracking** — add players and monsters, sort by initiative, and step through turns. Round counter, current‑turn highlight, and an optional turn timer.
- **HP, damage & healing** — apply damage or healing in a click, with quick maths, temporary HP, bloodied indicators and death/unconscious handling.
- **Never lose the turn** — the active combatant's card carries a pulsing marker, a highlight ring and an inverted initiative circle; click the name in the turn banner to scroll straight back to it after wandering off.
- **Bulk actions & groups** — select several combatants for one‑click area damage, and identical monsters collapse into a single group line so eight goblins take one row.
- **Hide the fallen** — once bodies pile up, one click (or the **H** key) hides defeated combatants so you only scroll past living ones. Nothing is deleted.
- **Absent players** — mark someone absent and they're skipped in turn order while still counting toward party size for XP.
- **Undo** — Ctrl/Cmd+Z reverses the last twenty actions, including clearing the whole encounter by accident.
- **Conditions with rule reminders** — apply any of the 5e conditions to a combatant. Tap the ⓘ on a condition for a short, plain‑language reminder of what it does, with **2014 / 2024** edition pills for the conditions whose rules changed between editions. Add your own custom “Other” marker for anything the list doesn’t cover.
- **Monster database (Open5e)** — search thousands of monsters with full stat blocks, cached offline after first load. Filter by ruleset (2014 / 2024) and by **source book** (e.g. SRD only, or specific bestiaries) with a multi‑select Sources filter.
- **Spell reference** — full spell stat blocks, including 2014 / 2024 versions where they differ, viewable inline.
- **Monster machinery tracked for you** — legendary action budgets (multi‑cost actions spend correctly), lair actions on initiative count 20 which can be promoted to their own combatant card, recharge abilities, spell slots, innate and at‑will casting, X/Day abilities, and wild shape / polymorph that swaps the stat block and swaps it back.
- **Concentration & death saves** — concentration prompts the saving throw with the right DC when the caster takes damage; death saves track successes, failures, stabilisation and a Revivify countdown.
- **Combat log & exports** — a timestamped log by round, exportable as plain text, Markdown (Obsidian‑ready) or JSON, plus an AI‑ready recap prompt and an end‑of‑session summary for your players.
- **Custom content** — create your own monsters and spells, or paste a stat block (D&D Beyond, PDF, Homebrewery, plain text or **Tetra‑cube** Markdown / `.monster` JSON) and let the parser do the work — it's a time‑saver rather than a guarantee, so give AC, HP, attacks and recharge text a glance before saving.
- **Random encounter generator** — a bit of cheeky fun for when you can't decide what to throw at the party. Build by difficulty and shape (horde, skirmish, boss, boss + minions), filtered by environment and by its own independent source‑book selection. Every result is checked against the real XP thresholds for *your* party before it's offered, and minions are picked to suit the boss — a Hobgoblin Captain arrives with hobgoblins, not random wildlife. It's a prompt to run or adapt, not a ruling.
- **Parties** — save your regular party once (levels, AC, HP and portraits), then drop them into any encounter at full health. Your roster is remembered between sessions, so XP thresholds and generated encounters always use your real party. Update a saved party in place, and export / import parties between devices.
- **XP & difficulty** — live Easy / Medium / Hard / Deadly readout that updates as monsters fall, for both the 2014 and 2024 rulesets.
- **Encounter library** — quick‑save an encounter mid‑session and resume later exactly where you left off — HP, conditions, round and all.
- **Backup & transfer** — everything you create (encounters, parties, monster groups, custom monsters and custom spells) can be exported to a JSON file and re‑imported on another device.
- **Appearance** — Day / Night themes, six accent colours, a high‑legibility font option, and respect for your device’s reduce‑motion and text‑size settings.
- **Keyboard** — **N** next turn, **H** hide/show defeated, **Ctrl/Cmd+Z** undo, **Esc** close.

## Designed for the table

This is a **tracker**, not a virtual tabletop. There’s deliberately no map or grid — it’s built to sit alongside your physical tiles and miniatures and handle the fiddly parts of combat, fast, on whatever screen you have to hand.

## Privacy & offline use

Everything lives in your browser (via `localStorage` and `IndexedDB`). You need to be online **once**, for the initial database download (roughly 30–60 seconds); after that the tracker runs entirely offline at the table. You'll only need a connection again to refresh the database on demand, or to re‑fetch it on a new browser or device. Nothing you create is uploaded anywhere — there’s no account and no server. Player portraits, for example, are shrunk to a small thumbnail and stored only on your device; the original image is never kept or sent.

> Because all data is local, it can be lost if you clear your browser storage, uninstall the browser, or change devices. Use the **Export** options now and then to keep a backup.

## How it’s built

- A single, self‑contained `index.html` — vanilla HTML, CSS and JavaScript with **no build step and no framework**.
- State persisted locally in `localStorage` and `IndexedDB`.
- Monster and spell data from the **[Open5e](https://open5e.com) v2 API**, cached on first load.
- Designed to be hosted as a static page (it runs from GitHub Pages).

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | The entire application |
| `tests/` | Automated release checks (below) |
| `tests/tools/` | Occasional‑use analysis tools |
| `MitzNSimz_Encounter_Tracker_User_Guide.pdf` | User guide, linked from inside the app |
| `MitzNSimz_Encounter_Tracker_Table_Card.pdf` | One‑page quick reference, linked from inside the app |

## Tests

Six Node runners guard every release. They use [Playwright](https://playwright.dev/) (Chromium) and
run against the built file directly — there's nothing to compile:

```bash
npm install -g playwright && playwright install chromium
export NODE_PATH=$(npm root -g)

node tests/run-parser.js      index.html   # stat-block parser fixtures
node tests/run-invariants.js  index.html   # structural rules that must always hold
node tests/run-cardhtml.js    index.html   # combatant-card markup, byte-identical to goldens
node tests/run-generator.js   index.html   # encounter difficulty band adherence
node tests/run-boot.js        index.html   # cold start with a saved mid-combat encounter
node tests/run-viewport.js    index.html   # layout sweep across screen widths
```

`run-cardhtml.js --record` deliberately re‑records the golden hashes when card markup is meant to
change. The invariants mostly encode lessons from real bugs — for instance, that every action wired
into an event dispatcher must have something in the interface that actually triggers it.

## Data & attribution

Monster and spell data are provided by **[Open5e](https://open5e.com)**, an open‑source project serving the D&D 5e SRD and other open‑licensed tabletop content. That data remains subject to its original licensing and attribution requirements, including the Open Game License and Creative Commons terms as applicable. This project is an independent tool and is not affiliated with, endorsed or sponsored by Wizards of the Coast or Open5e.

## Feedback & bugs

Found a bug or have an idea? Please open an issue:
**https://github.com/mitznsimz-cpu/DnD-Encounter-Tracker/issues**

Including your device, browser and the steps to reproduce is a big help. Please also quote the **version shown in the app header** — a cached older copy is the commonest cause of “it's broken” — and, if a control seems to do nothing at all, anything red in the browser console (F12).

## Acknowledgements

With thanks to the beta testers whose detailed reports and ideas have shaped this tool: Andi, Nigel, Adam, Sharron, [@Porky_Plays](https://instagram.com/Porky_Plays), [@chaosmistressuk](https://instagram.com/chaosmistressuk) and [@spookiigourd](https://instagram.com/spookiigourd).

## License

© 2026 MitzNSimz.

This software is released under the **[PolyForm Noncommercial License 1.0.0](https://github.com/mitznsimz-cpu/DnD-Encounter-Tracker/blob/main/LICENSE)**. In short, you’re free to use, share and modify it for any **non‑commercial** purpose — personal use, hobby games, study, and use by charitable, educational or other noncommercial organisations — provided the license and copyright notice travel with it. See the license for the exact terms, which govern.

**Commercial use** (anything with an anticipated commercial application) is **not** granted by this license. If you’d like to use the tracker commercially, please get in touch via [MitzNSimz.com](https://mitznsimz.com) to discuss a separate arrangement.

---

<p align="center">⚔ Made by <a href="https://mitznsimz.com">MitzNSimz</a> — miniatures and tools for Dungeon Masters · ☕ <a href="https://ko-fi.com/mitznsimz">Support on Ko‑fi</a></p>

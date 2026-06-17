# MitzNSimz Encounter Tracker

A fast, offline‑friendly combat tracker for **Dungeons & Dragons 5th Edition** — built for Dungeon Masters who run their games at the table with physical minis and just want the bookkeeping handled.

**▶ Use it here: https://mitznsimz-cpu.github.io/DnD-Encounter-Tracker/index.html**

No install, no account, no setup. It runs entirely in your browser, works on desktop, tablet and phone, and keeps everything on your own device.

---

## What it does

- **Initiative & turn tracking** — add players and monsters, sort by initiative, and step through turns. Round counter, current‑turn highlight, and an optional turn timer.
- **HP, damage & healing** — apply damage or healing in a click, with quick maths, temporary HP, bloodied indicators and death/unconscious handling.
- **Conditions with rule reminders** — apply any of the 5e conditions to a combatant. Tap the ⓘ on a condition for a short, plain‑language reminder of what it does, with **2014 / 2024** edition pills for the conditions whose rules changed between editions. Add your own custom “Other” marker for anything the list doesn’t cover.
- **Monster database (Open5e)** — search thousands of monsters with full stat blocks, cached offline after first load. Filter by ruleset (2014 / 2024) and by **source book** (e.g. SRD only, or specific bestiaries) with a multi‑select Sources filter.
- **Spell reference** — full spell stat blocks, including 2014 / 2024 versions where they differ, viewable inline.
- **Custom content** — create your own monsters and spells, or paste a stat block (D&D Beyond, PDF, Homebrewery, plain text or **Tetra‑cube** Markdown / `.monster` JSON) and let the parser do the work.
- **Random encounter generator** — build encounters by difficulty, type and environment, with its own independent source‑book filter so you can roll only from the books you own.
- **Parties** — save your regular party once (levels, AC, HP and portraits), then drop them into any encounter at full health. Update a saved party in place, and export / import parties between devices.
- **XP & difficulty** — live Easy / Medium / Hard / Deadly readout that updates as monsters fall, for both the 2014 and 2024 rulesets.
- **Encounter library** — quick‑save an encounter mid‑session and resume later exactly where you left off — HP, conditions, round and all.
- **Backup & transfer** — everything you create (encounters, parties, monster groups, custom monsters and custom spells) can be exported to a JSON file and re‑imported on another device.
- **Appearance** — Day / Night themes, six accent colours, a high‑legibility font option, and respect for your device’s reduce‑motion and text‑size settings.

## Designed for the table

This is a **tracker**, not a virtual tabletop. There’s deliberately no map or grid — it’s built to sit alongside your physical tiles and miniatures and handle the fiddly parts of combat, fast, on whatever screen you have to hand.

## Privacy & offline use

Everything lives in your browser (via `localStorage` and `IndexedDB`). The monster and spell database downloads once on first load and then works fully offline. Nothing you create is uploaded anywhere — there’s no account and no server. Player portraits, for example, are shrunk to a small thumbnail and stored only on your device; the original image is never kept or sent.

> Because all data is local, it can be lost if you clear your browser storage, uninstall the browser, or change devices. Use the **Export** options now and then to keep a backup.

## How it’s built

- A single, self‑contained `index.html` — vanilla HTML, CSS and JavaScript with **no build step and no framework**.
- State persisted locally in `localStorage` and `IndexedDB`.
- Monster and spell data from the **[Open5e](https://open5e.com) v2 API**, cached on first load.
- Designed to be hosted as a static page (it runs from GitHub Pages).

## Data & attribution

Monster and spell data are provided by **[Open5e](https://open5e.com)**, an open‑source project serving the D&D 5e SRD and other open‑licensed tabletop content. That data remains subject to its original licensing and attribution requirements, including the Open Game License and Creative Commons terms as applicable. This project is an independent tool and is not affiliated with, endorsed or sponsored by Wizards of the Coast or Open5e.

## Feedback & bugs

Found a bug or have an idea? Please open an issue:
**https://github.com/mitznsimz-cpu/DnD-Encounter-Tracker/issues**

Including your device, browser and the steps to reproduce is a big help.

## Acknowledgements

With thanks to the beta testers whose detailed reports and ideas have shaped this tool: Andi, Nigel, Adam, Sharron, [@Porky_Plays](https://instagram.com/Porky_Plays), [@chaosmistressuk](https://instagram.com/chaosmistressuk) and [@spookiigourd](https://instagram.com/spookiigourd).

## License

© 2026 MitzNSimz.

This software is released under the **[PolyForm Noncommercial License 1.0.0](https://github.com/mitznsimz-cpu/DnD-Encounter-Tracker/blob/main/LICENSE)**. In short, you’re free to use, share and modify it for any **non‑commercial** purpose — personal use, hobby games, study, and use by charitable, educational or other noncommercial organisations — provided the license and copyright notice travel with it. See the license for the exact terms, which govern.

**Commercial use** (anything with an anticipated commercial application) is **not** granted by this license. If you’d like to use the tracker commercially, please get in touch via [MitzNSimz.com](https://mitznsimz.com) to discuss a separate arrangement.

---

<p align="center">⚔ Made by <a href="https://mitznsimz.com">MitzNSimz</a> — miniatures and tools for Dungeon Masters · ☕ <a href="https://ko-fi.com/mitznsimz">Support on Ko‑fi</a></p>

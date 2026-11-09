# MitzNSimz Encounter Tracker — Tests

Regression suite for the single-file tracker (`index.html`). **Eight runners**, run before every
release against both the dev and prod builds. Most of what they check exists because a bug got
through once — each guard below is a scar with a lesson.

## What's here

| File | Needs | What it checks |
|---|---|---|
| `run-parser.js` | Node only | `parseStatBlock()` against **15 real-world fixtures** in `fixtures/` per `expectations.json` — D&D Beyond pipe format, markdown-link pastes, boundary-keyword traps ("plus any six languages", "understands Giant but can't speak"), Gear lines, fractional CRs, legendary sections, official book-style formatting with lair/regional effects, and homebrew section delimiters (`!`, `?`, no punctuation). |
| `run-invariants.js` | Node only | **~210 static guards**: version strings, `STORAGE_NS` and the " - DEV" tab title per build (dev has both, prod neither), guarded `localStorage` writes, combat-log cap, card-helper decomposition, generator rules, undo snapshots, **no orphaned dispatcher actions**, **no inline `on*=` handlers** and a closed `FIELD_ACTIONS` map, skip-unchanged card rendering, the compact WebP logo, the single damage core, the mini-shop link (Monster DB only, plain untracked link, no `utm_` anywhere), and no `console.log`/TODO. |
| `run-cardhtml.js` | Playwright | **44 golden SHA-256 hashes** of `buildCardHTML` output across 20+ synthetic combatant states (types, dead/dying/bloodied, conditions, concentration, recharge, legendary, both lair-pip cases, spellcasting, X/Day, absent, an armed damage type, edge values) in active/inactive/grouped variants. Refactors must be **byte-identical**. |
| `run-cardfit.js` | Playwright | Every child of a combatant card stays inside it across 12 panel- and viewport-driven widths plus a phone — measured with the worst-case damage row (type button armed with its longest label). |
| `run-generator.js` | Playwright | Random-encounter difficulty: every difficulty × shape × ruleset must land in the requested XP band, plus a party-scaling assertion. One statistical miss per cell tolerated; a systematic maths error fails outright. |
| `run-boot.js` | Playwright | Cold start with a realistic **saved mid-combat encounter** (player, lair card, boss, dead monsters, log, hide-defeated on): zero page errors, state and preferences restored, correct filtering. Also loads the sample encounter **with a populated monster DB** — the exact combination that once crashed on boot — and checks the **mini-shop link** rules: Monster DB only, search terms (name, custom term, creature type), no referrer, hidden in combat / Wild Shape picking / with a mini photo / when switched off. |
| `run-viewport.js` | Playwright | Layout sweep at 5 viewports with a loaded encounter: zero page errors, logos hydrated, no scroll-leak, More menu fits, list reachable; **every More-menu item can be scrolled to and tapped** and the menu's scroll doesn't chain to the page; **with the bulk bar open the last combatant still scrolls clear of it**; the custom-monster dialog is on screen and centred. |
| `run-damage.js` | Playwright | The damage core shared by every DMG/HEAL button (v1.115): defence-line parsing (incl. 2024 combined immunities and comma-joined custom tags), immunity/resistance/vulnerability maths, conditional defences flagged but never auto-applied, untyped log text unchanged, concentration DC from damage actually taken, bulk paths matching the card (undo, death-save bosses, Heal All), the card's type button, one-hit picks and input clearing; and **concentration checks** — multi-part hits fold into one save, AoE checks queue instead of overwriting, turn advance starts a new check, the 2024 DC cap of 30, and the remembered 2014/2024 ruleset. |

## Running

```bash
# Playwright (Chromium) is needed for six of the eight runners:
npm install -g playwright && playwright install chromium
export NODE_PATH=$(npm root -g)

# Full gate — run every one of these before a release:
node tests/run-parser.js      index.html
node tests/run-invariants.js  index.html prod     # use "dev" for the dev build
node tests/run-cardhtml.js    index.html
node tests/run-cardfit.js     index.html
node tests/run-generator.js   index.html
node tests/run-boot.js        index.html
node tests/run-viewport.js    index.html
node tests/run-damage.js      index.html
```

Each runner exits non-zero on failure, so they chain with `&&` in a script or CI step.

## Updating goldens deliberately

When card markup is *meant* to change:

```bash
node tests/run-cardhtml.js index.html --record
```

This rewrites `goldens-cardhtml.json` (hashes) and `goldens-cardhtml-dump.json` (full output, handy
for diffing when a hash changes unexpectedly). Only record when the change is intended — the whole
point is that an accidental change is loud.

## Adding a fixture

Drop the raw stat-block text into `fixtures/` and add its expected fields to `expectations.json`.
Convention: whenever a real paste breaks the parser, it becomes a fixture in the same commit as the
fix, so the same break can never return quietly.

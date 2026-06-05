# ⚔ MitzNSimz D&D Encounter Tracker

A lightweight, offline-ready D&D 5e encounter tracker for Dungeon Masters. Single HTML file — no installation required.

**[▶ Open the Tracker](https://mitznsimz-cpu.github.io/DnD-Encounter-Tracker/)**

Built for the table. Tested at the table.

---

## Features

### Combat Management
- Initiative tracking with auto-sort and drag-to-reorder for tiebreaking
- HP bars with colour coding (green → amber → red), Bloodied badge at ≤50% HP
- Damage, healing, and Temp HP with one-click AoE half-damage
- Full undo — 20-step history restoring HP, conditions, active turn, and round number

### Death Saves (Full 5e Rules)
- Automatic death save pips at 0 HP for players
- Nat 1 button (2 failures), Nat 20 button (instant recovery)
- 3 successes → Stable + Unconscious auto-applied
- 3 failures → ✦ Revive button appears
- Optional death saves for boss monsters (☠ DS toggle)

### Conditions & Status Strip
- 18 standard conditions + Advantage/Disadvantage, all colour-coded
- Duration countdown with auto-remove and amber pulse warning
- Concentration auto-check popup with DC on any damage
- Per-card status strip: reaction ⚡, legendary pips ●●●, recharge tags, ready action badge
- Recharge reminder — ability flashes bold red at start of monster's turn

### Monsters & Stat Blocks
- ~3,200 monsters + ~1,400 spells from Open5e, cached offline
- Inline expandable stat blocks — multiple open simultaneously
- Wild Shape / Transform — full Monster DB UX, stat block visible while transformed
- Custom monster editor with stat block parser (paste from D&D Beyond, PDF, or plain text)

### Encounter Planning
- XP calculator with 2014 and 2024 ruleset toggle
- Random encounter generator — difficulty, type, environment
- Party configurations — save player rosters, add to encounter in one click
- Encounter library — save/load full combat state including mid-session continuity
- Combat log — auto-logs all events, DM notes, export as .txt

### Other Features
- **Other combatant type** — for environmental hazards, lair actions, avalanches, traps
- **Turn timer** (optional) — countdown on active card, colour-coded, auto-advance on expiry
- Bulk actions — damage, heal, conditions, initiative across multiple selected combatants
- Group collapse/expand for monster groups
- Player absent marking
- Dark / light theme
- Fully offline after first load (IndexedDB cache)
- Responsive — tablet and mobile friendly
- Apple PWA support (Add to Home Screen)

---

## How to Use

**Online:** [mitznsimz-cpu.github.io/DnD-Encounter-Tracker](https://mitznsimz-cpu.github.io/DnD-Encounter-Tracker/)

**Offline:** Download `index.html`, open in any modern browser. First open requires internet to download the monster database (~30–60 seconds). After that, fully offline.

> **Note:** For best offline performance, serve via a local HTTP server rather than opening as a `file://` URL:
> ```
> python3 -m http.server 8080
> ```
> Then open `http://localhost:8080`

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | Next Turn |
| `Esc` | Close any open panel |
| `Enter` | Apply damage (when damage field focused) |
| `H` | Apply as healing (when damage field focused) |
| `Ctrl+Z` | Undo last action |

---

## About

Created by **[MitzNSimz](https://mitznsimz.com)** — Miniatures and tools for Dungeon Masters.

☕ [Support on Ko-fi](https://ko-fi.com/mitznsimz)

---

*Built for the table. Tested at the table.*

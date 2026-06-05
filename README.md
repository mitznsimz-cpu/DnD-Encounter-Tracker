# ⚔ MitzNSimz D&D Encounter Tracker

A lightweight, offline-ready D&D 5e encounter tracker for Dungeon Masters. Single HTML file — no installation required.

**[▶ Open the Tracker](https://mitznsimz-cpu.github.io/DnD-Encounter-Tracker/)**

> Built for the table. Tested at the table.

---

## Why This Tracker Exists

Running combat in D&D 5e requires a DM to simultaneously track initiative, HP, conditions, concentration, legendary actions, spell slots, ability recharges, and round flow — all while narrating the scene and keeping players engaged.

The MitzNSimz Encounter Tracker handles the bookkeeping so the DM can focus on the story.

**Core principles:**
- 🔒 **Offline First** — works completely without internet after first load
- 🚫 **No Accounts** — nothing to sign up for
- 💸 **No Subscriptions** — free to use, forever
- 🏠 **Local Data** — your encounters stay on your device
- 🎲 **Physical Dice** — the tracker records outcomes, not replaces rolling

---

## Features

### Combat Management
- Initiative tracking with auto-sort and drag-to-reorder for tiebreaking
- HP bars colour-coded (green → amber → red), Bloodied badge at ≤50%
- Damage, healing, Temp HP with one-click AoE half-damage (½ DMG)
- Full undo — 20-step history restoring HP, conditions, active turn, and round

### Death Saves (Full 5e Rules)
- Auto pips at 0 HP — Nat 1 (2 failures), Nat 20 (instant recovery)
- 3 successes → Stable + Unconscious auto-applied
- 3 failures → ✦ Revive button
- Optional death saves for boss monsters (☠ DS toggle)

### Conditions & Status Strip
- 18 standard conditions + Advantage/Disadvantage, all colour-coded
- Duration countdown with auto-remove and amber pulse warning
- Concentration auto-check popup on any damage
- Per-card status strip: reaction ⚡, legendary pips ●●●, recharge tags, ready action

### Spell & Ability Tracking (Auto-Detected)
- Spell slots per level (purple pips) — click to expend any level
- Innate spellcasting — per-spell use pips, at-will spells labelled
- X/Day abilities — amber pips for limited-use abilities
- ↺ Reset Uses — restores all uses in one click

### Monsters & Stat Blocks
- ~3,200 monsters + ~1,400 spells from Open5e, cached offline
- Inline expandable stat blocks — multiple open simultaneously
- Wild Shape / Transform — Monster DB UX, stat block visible while transformed
- **⚗ Parse Block** — paste any stat block (D&D Beyond, PDF, plain text) to import instantly
- **⚗ Parse Spell** — paste any spell stat block to import into your custom library

### Encounter Planning
- XP calculator with 2014 and 2024 ruleset toggle
- Random encounter generator — difficulty, type, environment
- Party configurations — save player rosters, add to encounter in one click
- Encounter library — save/load full combat state for mid-session continuity
- Combat log — all events auto-logged, DM notes, export as .txt

### Environmental & Special Events
- **Other combatant type** — for lair actions, avalanches, traps, ritual timers, reinforcements
- Teal card styling, excluded from XP and Alive counts

### Data & Backup
- All data stored locally — no cloud, no account required
- Export/Import: encounters, custom monsters, and custom spells as JSON
- Auto-save on every change — resume exactly where you left off

---

## How to Use

**Online:** [mitznsimz-cpu.github.io/DnD-Encounter-Tracker](https://mitznsimz-cpu.github.io/DnD-Encounter-Tracker/)

**Offline:** Download `index.html`, open in any modern browser. First open requires internet to download the monster database (~30-60 seconds). Fully offline thereafter.

> **Tip:** For best offline performance, serve via a local HTTP server:
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
| `Ctrl+Z` | Undo last action (up to 20 steps) |

---

## Backing Up Your Data

All data is stored locally in your browser. Export regularly to avoid data loss:

- **Encounters:** 📚 Encounters → Export All
- **Custom Monsters:** ＋ Custom Monster → ⬇ Export
- **Custom Spells:** ✦ Add Spell → ⬇ Export Spells

Re-import on any device using the matching Import buttons.

---

## About

Created by **[MitzNSimz](https://mitznsimz.com)** — Miniatures and tools for Dungeon Masters.

☕ [Support on Ko-fi](https://ko-fi.com/mitznsimz)

---

*Built for the table. Tested at the table.*

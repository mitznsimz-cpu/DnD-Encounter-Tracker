#!/usr/bin/env node
/*
 * MitzNSimz Encounter Tracker — static invariants runner
 *
 * Checks the release checklist and permanent regression guards against a build,
 * without needing a browser. Run on BOTH dev and prod builds before release.
 *
 * Usage:
 *   node tests/run-invariants.js                (checks ../index.html, expects prod)
 *   node tests/run-invariants.js dev.html dev   (checks a dev build)
 *
 * Requires: Node only.
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const buildKind = process.argv[3] || 'prod'; // 'prod' | 'dev'
const html = fs.readFileSync(target, 'utf8');

let pass = 0, fail = 0;
const t = (label, ok, detail='') => {
  if (ok) { pass++; console.log('✓ ' + label); }
  else    { fail++; console.log('✗ ' + label + (detail ? ' — ' + detail : '')); }
};

// ── 1. Version-string consistency (the 4 display strings must agree)
const versions = [
  (html.match(/<title>[^<]*?(v\d+\.\d+)(?: - DEV)?<\/title>/) || [])[1],
  (html.match(/letter-spacing:\.04em;flex-shrink:0">(v\d+\.\d+)<\/span>/) || [])[1],
  ...[...html.matchAll(/Encounter Tracker · (v\d+\.\d+)</g)].map(m => m[1]),
];
const vSet = new Set(versions.filter(Boolean));
t(`version strings consistent (found: ${[...vSet].join(', ') || 'none'})`,
  vSet.size === 1 && versions.filter(Boolean).length >= 4,
  `${versions.filter(Boolean).length}/4 strings, ${vSet.size} distinct`);

// ── 1b. Dev builds say so in the browser tab (Pete's release tweak, adopted v1.117+):
//        "… v1.117 - DEV" in dev, plain "… v1.117" in prod.
const devTitle = /<title>[^<]* - DEV<\/title>/.test(html);
t(`page title ${buildKind === 'prod' ? 'has no' : 'ends with'} " - DEV" for ${buildKind} build`,
  buildKind === 'prod' ? !devTitle : devTitle);

// ── 2. STORAGE_NS matches build kind
const ns = (html.match(/const STORAGE_NS = '([^']*)'/) || [])[1];
t(`STORAGE_NS is ${buildKind === 'prod' ? "''" : "'dev_'"} for ${buildKind} build`,
  buildKind === 'prod' ? ns === '' : ns === 'dev_', `got '${ns}'`);

// ── 3. No unguarded localStorage.setItem (v1.40 hardening guard)
const lines = html.split('\n');
const unguarded = [];
lines.forEach((l, i) => {
  if (l.includes('.setItem(')) {
    const ctx = lines.slice(Math.max(0, i - 8), i + 2).join('\n');
    if (!ctx.includes('try')) unguarded.push(i + 1);
  }
});
t('all localStorage.setItem calls try-guarded', unguarded.length === 0, `unguarded at lines ${unguarded.join(',')}`);

// ── 4. combatLog persisted and restored (v1.45 guard)
t('save() persists combatLog', /setItem\('enc_state',JSON\.stringify\(\{[^}]*combatLog/.test(html));
t('loadState() restores combatLog', /combatLog=Array\.isArray\(d\.combatLog\)/.test(html));
t('combatLog trimmed to cap in save()', /combatLog\.length > 2000/.test(html));

// ── 5. buildInlineSB renders all four defence rows (v1.43 guard)
const inlineSB = html.slice(html.indexOf('function buildInlineSB'), html.indexOf('function buildInlineSB') + 4000);
['Vulnerabilities', 'Resistances', 'Immunities', 'Condition Immunities'].forEach(row =>
  t(`buildInlineSB renders ${row} row`, inlineSB.includes(`'${row}'`)));

// ── 6. Stat-block cache gated on slug (v1.43 guard)
t('_sbHTMLCache read gated on m.slug', /m\.slug && _sbHTMLCache\[m\.slug\]/.test(html));
t('_sbHTMLCache write gated on m.slug', /if \(m\.slug\) _sbHTMLCache\[m\.slug\] = html/.test(html));

// ── 7. Group add respects addAsType (v1.42 guard)
const dropGroup = html.slice(html.indexOf('function dropGroup'), html.indexOf('function dropGroup') + 2500);
t('dropGroup reads addAsType for combatant type', /addAsType === 'ally'/.test(dropGroup));
t('groups pane has its own add-as toggle', /groupsPane[\s\S]{0,600}add-as-toggle|add-as-toggle[\s\S]{0,600}groupsPane/.test(html) || (html.match(/class="add-as-toggle"/g)||[]).length >= 2, `toggle instances: ${(html.match(/class="add-as-toggle"/g)||[]).length}`);

// ── 8. Logo stored once, hydrated (v1.40 guard)
// v1.115: the logo became a 135x160 WebP (~16 KB of base64, was a 107.5 KB PNG).
// Exactly one copy, small, and no large PNG creeping back in.
const logoDecl = html.match(/const MITZNSIMZ_LOGO = 'data:image\/webp;base64,([A-Za-z0-9+/=]+)'/);
t('logo embedded once as compact WebP', !!logoDecl && logoDecl[1].length < 25000 &&
  (html.match(/data:image\/webp;base64,[A-Za-z0-9+/=]{5000,}/g) || []).length === 1,
  logoDecl ? `${logoDecl[1].length} b64 chars` : 'MITZNSIMZ_LOGO not a WebP data URI');
const bigPngs = (html.match(/data:image\/png;base64,[A-Za-z0-9+/=]{20000,}/g) || []);
t('no large embedded PNG', bigPngs.length === 0, `found ${bigPngs.length}`);
t('hydrateLogos present and re-run on DOMContentLoaded', /hydrateLogos\(\);[\s\S]{0,200}DOMContentLoaded', hydrateLogos/.test(html));

// ── 9. Off-canvas panels use transform not right-offset (v1.40 guard)
t('no right:-Npx off-canvas panels remain', !/right:-\d/.test(html));

// ── 10. Hygiene
t('no console.log in shipped code', !/console\.log\(/.test(html), 'console.log found');
t('no TODO/FIXME/HACK markers', !/\b(TODO|FIXME|HACK)\b/.test(html));

// ── 11. aria-live turn announcements (v1.40 guard)
t('turn banner is aria-live', /id="bnr" aria-live="polite"/.test(html));

// ── 12. DB freshness check wired at both DB-ready points (v1.46 guard)
t('checkDBFreshness defined', /async function checkDBFreshness/.test(html));
t('freshness checked at both dbReady points', (html.match(/checkDBFreshness\(\);/g) || []).length >= 2, `hook count: ${(html.match(/checkDBFreshness\(\);/g) || []).length}`);
t('freshness note appended to refresh caption', /_freshNote\(\)/.test(html));

// ── 14. Lair pip wired end-to-end (v1.55 guard)
t('detectLairMax defined', /function detectLairMax/.test(html));
t('lair pip rendered and toggle wired', /data-action="toggleLair"/.test(html) && /toggleLair:/.test(html));
t('lair resets on round increment', /round\+\+;[\s\S]{0,120}lairUsed = 0/.test(html));
t('spawnLairCard defined and wired', /function spawnLairCard/.test(html) && (html.match(/spawnLair:/g)||[]).length >= 3);
t('roll-all preserves other-type initiative', /if \(c\.type === 'other'\) return;/.test(html));
// Every combatant-creation site that detects legendary must also detect lair —
// this is the audit that caught the v1.58 gaps (two sites missing lair fields).
const legSites = (html.match(/legendaryMax:\s*detectLegendaryMax\(m\)/g) || []).length;
const lairSites = (html.match(/lairMax:\s*detectLairMax\(m\)/g) || []).length;
t('all legendary-detecting creation sites also detect lair (' + legSites + ' sites)', legSites > 0 && legSites === lairSites, legSites + ' leg vs ' + lairSites + ' lair');
t('parser-editor path stashes legendary_desc', /populateCustomMonsterFromParser\(p\) \{\n  _cmLegendaryDesc/.test(html));
t('lair pip live-checks for existing lair card', /cbs\.some\(x => x\.statSlug === 'lair-' \+ c\.statSlug\)/.test(html));
// ── 16. Lair button state must be live, not cached (v1.59 guard)
t('lair slot placeholder in cached SB html', /<!--LAIR_SLOT-->/.test(html));
t('lair slot substituted on both return paths', (html.match(/_applyLairSlot\(/g)||[]).length >= 3);
// ── 17. Hide-defeated (v1.60 guards)
t('hideDead persisted with try-guard', /try \{ localStorage\.setItem\('enc_hide_dead'/.test(html));
t('hide-defeated wired: pill, dispatcher, keyboard', /data-action="toggleHideDead"/.test(html) && /toggleHideDead: \(\) => toggleHideDead\(\)/.test(html) && /e\.key==='h'\|\|e\.key==='H'/.test(html));
t('render filter exempts active combatant', /hideDead && cbs\[i\]\.dead && i !== active/.test(html));
t('hideDead declared with core state vars (boot-safe, v1.61)', (() => {
  // Position-based rather than a fixed character window: every added state
  // line used to push hideDead out of the window and fail this spuriously.
  // What actually matters is that it is declared BEFORE anything that renders.
  const core = html.indexOf('let cbs = []');
  const hd   = html.indexOf('let hideDead = false');
  const fn   = html.indexOf('function render()');
  return core > -1 && hd > core && fn > -1 && hd < fn;
})());
// ── 18. Turn-visibility set (v1.62 guards)
t('turn chevron with reduced-motion guard', /turnPulse 2s/.test(html) && /prefers-reduced-motion: reduce\)\{\.cb\.active::before\{animation:none/.test(html));
t('active ring + inverted init circle', /box-shadow:0 0 0 2px var\(--gold\),0 0 0 5px var\(--gold-dim\)/.test(html) && /\.cb\.active \.init-b[\s\S]{0,120}background:var\(--gold\)/.test(html));
t('jumpToActive wired in both banners', /function jumpToActive/.test(html) && (html.match(/data-action="jumpToActive"/g)||[]).length === 2 && (html.match(/jumpToActive: \(\) => jumpToActive\(\)/g)||[]).length === 2);
// ── 19. buildCardHTML decomposition (v1.63 guards)
const cardHelpers = (html.match(/^function card[A-Z][A-Za-z]*HTML\(/gm)||[]).length;
t('card section helpers extracted (16+)', cardHelpers >= 16, cardHelpers + ' helpers');
const bchStart = html.indexOf('function buildCardHTML(c, ctx) {');
const bchEnd = html.indexOf('\n}', html.indexOf('<div class="cb-sb">', bchStart));
t('buildCardHTML assembler stays slim (<80 lines)', bchStart > -1 && (html.slice(bchStart, bchEnd).split('\n').length) < 80);
// ── 20. Banner visibility single-owner (v1.64 guard)
t('no inline banner display:none hack', !/bnr\.style\.display\s*=\s*'none'/.test(html) && !/bnr\){bnr\.style\.display='none'/.test(html));
t('render owns banner visibility (defensive clear)', /bnr\.style\.display = '';/.test(html));
// ── 21. Generator rules (v1.65 guards)
t('2024 ruleset uses no encounter multiplier', /xpRuleset === '2024' \? \(\(\) => 1\)/.test(html));
t('generator verifies band and classifies honestly', /classify\(adj2\) === difficulty/.test(html) && /diffLabels\[actualDiff\]/.test(html));
// ── 22. Undoable New Encounter (v1.66 guards)
t('new encounter snapshots before wipe, keeps history', /if \(cbs\.length\) pushHistory\(\);\n  cbs=\[\];round=1/.test(html) && !/cbs=\[\];round=1;active=-1;uid=0;selectedIds\.clear\(\);collapsedGroups\.clear\(\);\n  combatLog=\[\]; actionHistory=\[\]/.test(html));
t('history-clearing sites refresh the undo badge', (html.match(/actionHistory=\[\]; updateUndoBtn\(\);/g)||[]).length === 2);
t('new-encounter dialogs mention Undo', (html.match(/Undo can bring the combatants back|brought back with Undo/g)||[]).length >= 3);
// ── 23. Environment pipeline (v1.67 guards)
t('cache version 6 (environments in shape)', /const CACHE_VERSION = 6;/.test(html));
t('environments kept by both normalizers', (html.match(/environments:\(m\.environments\|\|\[\]\)\.map/g)||[]).length === 2);
t('env dropdown collated from DB after load', /function populateEnvDropdown/.test(html) && (html.match(/populateEnvDropdown\(\);/g)||[]).length >= 2);
t('env dropdown sorted alphabetically (v1.72)', /const names = Object\.keys\(counts\)\.sort\(\(a,b\) => a\.localeCompare\(b\)\);/.test(html));
// ── 26. No orphaned dispatcher actions (v1.74)
// Every action wired into a dispatcher must have something in the DOM that
// triggers it. The absent-player toggle was mapped, implemented and documented
// for months with NO button rendering it — this check makes that impossible.
// Exceptions: actions whose data-action is generated at runtime from a string
// argument (the spell-variant pills), so no literal appears in source.
const DYNAMIC_ACTIONS = ['spellSBVariant', 'sppopVariant'];
const mappedActions = (html.match(/^\s{2}([a-zA-Z][A-Za-z0-9_]*):\s*\((?:el|e)?[^)]*\)\s*=>/gm) || [])
  .map(s => s.trim().split(':')[0]);
const renderedActions = new Set((html.match(/data-action="([a-zA-Z][A-Za-z0-9_]*)"/g) || [])
  .map(s => s.slice(13, -1)));
// v1.115: field handlers (FIELD_ACTIONS) are triggered by data-on-input /
// data-on-change / data-on-key rather than data-action.
const fieldUses = (html.match(/data-on-(?:input|change|key)="([a-zA-Z][A-Za-z0-9_]*)"/g) || [])
  .map(s => s.slice(s.indexOf('"') + 1, -1));
fieldUses.forEach(a => renderedActions.add(a));
const orphanActions = mappedActions.filter(a => !renderedActions.has(a) && !DYNAMIC_ACTIONS.includes(a));
t('no orphaned dispatcher actions (nothing to click)', orphanActions.length === 0, orphanActions.join(', '));
t('absent toggle is reachable on player cards (v1.74)', /data-action="toggleAbsent"/.test(html) && /c\.type==='player'\?`<button class="cond-btn\$\{c\.absent\?' active':''\}"/.test(html));
t('env filter is exact match with honest fallback note', /\.includes\(env\)\);/.test(html) && /drew from all environments instead/.test(html));
// ── 24. Tiered boss+minions + sample hardening (v1.68 guards)
t('affinity tiers present in shared helper (name family → type → any)', /function genAffinityPool/.test(html) && /const tier1 = cands\.filter/.test(html) && /const tier2 = lty \? cands\.filter/.test(html));
t('variety stays within the matched tier, chosen from a window', /const kin = genAffinityPool\(boss, minionCands\)/.test(html) && /nearest\(kin, perMinion\)\.slice\(0, 5\)/.test(html) && /const others = kinNear\.filter/.test(html));
t('boss+minions is count-first with a real retinue (v1.71)', /const wantMinions = \[2,2,3,4,4,6\]/.test(html) && /const rawTarget = target \/ mult\(n\)/.test(html));
t('crowd shapes never settle for a lone monster', /const wantsCrowd = \(type === 'horde' \|\| type === 'boss_minions'\)/.test(html) && /crowdOK = !wantsCrowd \|\| sel\.length >= 3/.test(html));
t('party persisted and restored (v1.71)', /localStorage\.setItem\('enc_party'/.test(html) && /function persistParty/.test(html) && /persistParty\(\);   \/\/ party changes are saved/.test(html));
t('roster portraits re-link after reload (v1.76)', /function _adoptPlayerAvatars/.test(html) && /_syncXpAvatars\(\) \{[\s\S]{0,240}_adoptPlayerAvatars\(\);/.test(html));
// ── 27. Mini photos (v1.77 guards)
// The isolation guarantee is the important one: Refresh Database clears
// db_cache wholesale, so user photographs must live in their own store.
t('mini photos use an isolated IDB store', /const IDB_PHOTOS\s*=\s*'mini_photos'/.test(html) && /IDB_VERSION = 2/.test(html));
t('miniIndex declared with core state (boot-safe, v1.77)', /let miniIndex = \{\};[\s\S]{0,200}let hideDead = false/.test(html));
t('photo store created on upgrade, db_cache untouched', /objectStoreNames\.contains\(IDB_PHOTOS\)\) db\.createObjectStore\(IDB_PHOTOS\)/.test(html));
t('photo helpers never touch IDB_STORE', !/_photoTx[\s\S]{0,200}IDB_STORE/.test(html));
t('caps enforced with a route to the manager', /MINI_MAX_PHOTOS = \d+/.test(html) && /MINI_MAX_BYTES/.test(html) && /Manage Mini Photos/.test(html));
t('photo capture is EXIF-aware', /imageOrientation: 'from-image'/.test(html));
t('mini photos included in full backup', /miniPhotos/.test(html) && /_restoreMiniPhotos/.test(html));
t('stat block photo slot substituted live', /_applyMiniSlot/.test(html) && (html.match(/_applyMiniSlot\(/g)||[]).length >= 3);
// Photo actions must be reachable from EVERY surface that shows a stat block:
// the Monster DB panel, the combatant side panel (wide screens) and the inline
// card block (narrow screens). v1.77 shipped wired to only one of them.
t('photo actions wired on all stat-block surfaces (v1.78)',
  (html.match(/pickMiniPhoto:\s*\(el\) => pickMiniPhoto/g)||[]).length >= 3 &&
  /cbSBPanel'\)[\s\S]{0,400}pickMiniPhoto/.test(html));
t('DB panel renders its own photo block (v1.78)', /_miniBlock/.test(html) && /sb-mini-img/.test(html));
// ── 28. Group tie-break (v1.79 guards)
t('group move works on blocks within one initiative', /function moveGroup/.test(html) && /function _tieBlocks/.test(html) && /c\.initiative === init/.test(html));
t('group move buttons wired and whole control exempt from collapse', /data-action="moveGroupUp"/.test(html) && /moveGroupUp:\s*\(el, e\)/.test(html) && /closest\('\.group-move-btns'\)\) return;/.test(html));
t('group order control is visually distinct from the collapse caret (v1.80)', /group-move-label/.test(html) && /\.group-move-btns\{[^}]*border-left/.test(html));
// Same control, different scope — the group arrows must share the per-card
// arrows' visual language (v1.81), so they can't drift into looking unrelated.
t('group and card move arrows share one visual language (v1.81)',
  /\.group-move-btn\{[^}]*background:none;border:none;color:var\(--text3\);[^}]*font-size:13px/.test(html) &&
  /\.cb-move-btn\{background:none;border:none;color:var\(--text3\)[^}]*font-size:13px/.test(html));
// ── 29. Initiative roll modes (v1.82 guards)
t('one shared roller for both roll paths', /function rollInitFor\(list, mode\)/.test(html) && /rollInitFor\(cbs\)/.test(html) && /rollInitFor\(getSelected\(\), mode\)/.test(html));
t('roll mode persisted and boot-safe', /let initRollMode = 'group';/.test(html) && /localStorage\.setItem\('enc_init_mode'/.test(html) && /let initRollMode[\s\S]{0,400}let hideDead = false/.test(html));
t('initiative bonus applied from the stat block', /initiative_bonus !== undefined && [\s\S]{0,90}dexterity \|\| 10\) - 10\) \/ 2\)/.test(html) && /d20 \+ bonus/.test(html));
t('split reroll available without changing the global mode', /bulkRerollSplit: \(\) => bulkRerollInit\('individual'\)/.test(html) && /data-action="bulkRerollSplit"/.test(html));
// ── 30. Adaptive cards, display modes, resize, dev diagnostic (v1.84)
// v1.103: container queries replaced by width classes. `container-type` on a
// scrolling element triggered a Safari repaint failure (blank combatant list),
// so the same adaptation is driven by a ResizeObserver instead. The card must
// still respond to ITS OWN width, never the viewport — that part is unchanged.
t('card layout keyed to the list width, not the viewport', /function applyListWidthClasses/.test(html) && /\.list-area\.lw-narrow \.cb\{grid-template-columns/.test(html) && !/container-type:inline-size/.test(html));
t('width classes recomputed when the list resizes', /new ResizeObserver\(\(\) => applyListWidthClasses\(\)\)\.observe\(la\)/.test(html) && /initListWidthWatcher\(\);/.test(html));
t('narrow tier lets the action row wrap', /\.list-area\.lw-tiny \.act-row\{flex-wrap:wrap/.test(html));
t('stat block display modes wired', /const SB_MODES = \['auto', 'side', 'below', 'popup'\]/.test(html) && /data-action="mSbMode"/.test(html) && /html\[data-sbmode="popup"\]/.test(html));
// A chooser, not a cycling menu item (v1.85): with four options, cycling meant
// reopening the menu up to three times, and the labels don't explain themselves.
t('display mode uses a chooser with descriptions', /function openSbModeChooser/.test(html) && /SB_MODE_DESC/.test(html) && /setSbModeChoice/.test(html) && !/function cycleSbMode/.test(html));
// The pop-up is reference material read WHILE acting on the card, so it must not
// lock the UI behind a backdrop (matches the spell popup).
t('pop-up does not block the rest of the UI', !/sbPopBackdrop/.test(html) && /sbDisplayMode==='popup' && document\.getElementById\('cbSBPanel'\)/.test(html));
t('panel width clamped on apply and on resize', /SB_MIN_W = 300/.test(html) && /window\.addEventListener\('resize', applySbWidth\)/.test(html));
t('resize grip is touch-capable', /#sbResizeGrip\{[^}]*touch-action:none/.test(html) && /pointerdown/.test(html));
// The diagnostic must be inert in prod. It is gated on STORAGE_NS, which the
// prod build empties — so no second build difference is needed.
t('layout diagnostic gated to dev builds', /const IS_DEV_BUILD = !!STORAGE_NS;/.test(html) && /if \(!IS_DEV_BUILD\) return;/.test(html));
// v1.86: the button was wired to the wrong dispatcher and revealed from the
// database-load path, so it was present but dead. Both are now pinned.
t('diagnostic button wired to the About dialog', /const WELCOME_ACTIONS = \{\n\s*openLayoutDiagnostic:/.test(html));
t('diagnostic button revealed independently of DB load', /if \(IS_DEV_BUILD\) \{ const _d = document\.getElementById\('devDiagBtn'\)[\s\S]{0,120}wireDispatcher\(document\.getElementById\('cbSBPanel'\)/.test(html));
// ── 31. Draggable pop-ups (v1.87)
t('one shared drag helper for both pop-ups', /function makeDraggable\(el, handle, opts\)/.test(html) && /makeDraggable\(sb, sbBar/.test(html) && /makeDraggable\(sp, spBar/.test(html));
// The handle must be the header only: both pop-ups scroll, and touch-action:none
// on the body would kill that scrolling on touch devices.
t('drag handle is the header, not the body', /html\[data-sbmode="popup"\] \.cb-sb-panel-bar\{cursor:move;touch-action:none/.test(html) && !/\.cb-sb-panel-body\{[^}]*touch-action:none/.test(html));
t('pop-up position clamped and re-clamped on resize', /function _clampPopPos/.test(html) && /DRAG_EDGE/.test(html) && /if \(el\.dataset\.dragged !== '1'\) return;/.test(html));
t('dragging disabled on narrow screens', /DRAG_MIN_VW = 600/.test(html) && /window\.innerWidth < DRAG_MIN_VW\) return;/.test(html));
// ── 32. More menu fits its labels and the screen (v1.88)
t('more menu wide enough for its longest label and the accent row', /min-width:260px/.test(html));
// Six swatches previously had ~2px of slack, so any font or zoom change pushed
// the last one onto a second line. Below 650px the site-wide 44px tap-target
// rule applies and wrapping is the correct answer instead.
t('accent swatches stay on one line above the touch breakpoint', /\.more-menu-accent-row\{display:flex;flex-wrap:nowrap/.test(html) && /@media \(max-width:650px\)\{\n\s*\.more-menu-accent-row\{flex-wrap:wrap/.test(html));
t('accent caption removed (saves menu height)', !/accentCaption/.test(html));
// ── 34. Restart Encounter replaces Sort Initiative (v1.92)
// The old item was misleading: the list is auto-sorted from ten call sites, so
// its only real effect was silently clearing the active turn, unrecoverably.
t('Sort Initiative removed', !/mSortInit/.test(html) && !/Sort Initiative<\/button>/.test(html));
t('Restart Encounter present and undoable', /function restartEncounterConfirmed/.test(html) && /pushHistory\(\);\s*\/\/ recoverable/.test(html) && /data-action="mRestartEnc"/.test(html));
t('restart keeps initiative and absent flags', !/_restartCombatant[\s\S]{0,900}c\.initiative =/.test(html) && !/_restartCombatant[\s\S]{0,900}c\.absent =/.test(html));
t('restart writes a combat-log marker', /Encounter restarted/.test(html));
// ── 35. Jump list (v1.94)
t('jump list present and self-closing', /function toggleJumpList/.test(html) && /function jumpToId\(id\) \{\n  closeJumpList\(\);/.test(html) && /data-action="toggleJumpList"/.test(html));
// Filtering must listen to `input`, not `keydown`: a keydown handler misses
// paste, autofill and dictation.
t('jump filter driven by the input event', /addEventListener\('input', renderJumpList\)/.test(html));
t('jump list height and position clamped to the screen', /o\.scrollEl\.style\.maxHeight = Math\.max\(140/.test(html) && /pop\.style\.left = Math\.round\(left\)/.test(html));
// ── 36. Popups escape the scrolling toolbar's clipping (v1.97)
// .toolbar-primary becomes overflow-x:auto / overflow-y:hidden below 900px, and
// an ancestor with hidden overflow CLIPS absolutely positioned descendants. Both
// popups live inside it, so on narrow screens only the sliver within the
// toolbar's own height painted: 1 of 16 More items and 0 jump rows reachable.
t('popups use fixed positioning to escape ancestor clipping', /\.jump-list\{position:fixed/.test(html) && /\.more-menu\{position:fixed/.test(html));
t('one shared popup anchoring helper', /function anchorPopupToButton\(pop, btn, opts\)/.test(html) && (html.match(/anchorPopupToButton\(/g)||[]).length >= 3);
t('popup z-index above the card list', /\.jump-list\{[^}]*z-index:620/.test(html) && /\.more-menu\{[^}]*z-index:610/.test(html));
// ── 37. Party passive scores (v1.98)
t('passives stored and normalised', /function _cleanPassives/.test(html) && /let xpPassives = \[\]/.test(html) && /passives: _cleanPassives/.test(html));
// Parties saved before v1.98 have no passives field; they must load blank, and
// clearing a field must store null rather than an empty object.
t('passives are backwards compatible', /xpPassives = pc\.party\.map\(p => _cleanPassives\(p\.passives\)\)/.test(html) && /if \(c\.passives === undefined\) c\.passives = null/.test(html));
t('passives shown read-only on player cards only', /c\.type === 'player' && c\.passives/.test(html) && /cb-passives/.test(html));
// ── AC and max HP on the roster (v1.105), same pattern as passives
t('roster AC/HP arrays kept in lock-step', /let xpAC = \[\]/.test(html) && /let xpHP = \[\]/.test(html) && /while \(xpAC\.length < xpLevels\.length\) xpAC\.push\(null\)/.test(html));
// v1.111: persistParty() saved only levels and names, so AC, HP and passives
// were blank after a relaunch even though the values were still on the cards.
t('party persistence includes AC, HP and passives', /ac: xpAC, hp: xpHP, passives: xpPassives/.test(html));
t('roster restore tolerates pre-v1.111 saves', /xpAC = _take\(_pp\.ac,/.test(html) && /while \(xpAC\.length < xpLevels\.length\) xpAC\.push\(null\)/.test(html));
// Blanks are filled from the matching card, but only blanks — a deliberate
// roster value must never be overwritten.
t('blank roster stats adopted from the player card', /function _adoptPlayerStats/.test(html) && /if \(xpAC\[i\] == null && Number\.isFinite\(\+p\.ac\)\)/.test(html) && /_adoptPlayerStats\(\);/.test(html));
// Parsed alignment was always discarded: a two-way `includes` match against the
// alignment <select> matched the blank "— choose —" option, because every
// string contains the empty string (v1.106).
t('alignment match skips the blank option', /const opts = \[\.\.\.alignEl\.options\]\.filter\(o => o\.value\.trim\(\) !== ''\)/.test(html));
// Homebrew routinely ends an ability name with ! or ? for flavour; the parser
// only accepted a full stop, which silently dropped whole Bonus Actions and
// Reactions sections (v1.112).
t('entry names may end with . ! or ?', /const ACTION_RE\s+= \/\^\(\[A-Z\]\.\*\?\)/.test(html) && /\[\.!\?\]/.test(html));
// v1.113: colon, spaced dash, markdown bold and name-on-its-own-line are all
// unambiguous and supported. A dash must be SPACED so hyphenated names
// ('Hit-and-Run') and recharge ranges ('Recharge 5-6') are untouched.
t('entry names accept colon, spaced dash and own-line forms', /\(\?:\[\.!\?\]\|:\|\\s\[/.test(html) && /ACTION_OWNLINE_RE/.test(html) && /function _nextLineIsProse/.test(html));
t('markdown emphasis stripped before matching', /replace\(\/\\\*\\\*\(\.\+\?\)\\\*\\\*\/g/.test(html));
// ── Backup reminder (v1.110): quiet, conditional, dismissible
// Safari clears script-writable storage after ~7 days without a visit, so the
// threshold must be shorter on WebKit than elsewhere.
t('backup nudge threshold is shorter on WebKit', /const limit = _isWebKit\(\) \? 5 : 30;/.test(html));
// It must never appear for someone with nothing saved.
t('backup nudge only when there is something to lose', /function _hasMaterialWorthSaving/.test(html) && /if \(!_hasMaterialWorthSaving\(\)\) return null;/.test(html));
t('backup nudge is dismissible, not a dialog', /function snoozeBackupNudge/.test(html) && /class="hpill backup-nudge"/.test(html) && !/backupNudge[\s\S]{0,120}mtzConfirm|backupNudge[\s\S]{0,120}mtzAlert/.test(html));
t('alignment prefers an exact match', /opts\.find\(o => o\.value\.trim\(\)\.toLowerCase\(\) === want\)/.test(html));
t('roster stats mirror onto the matching player by name', /function setXpStat/.test(html) && /c\.type === 'player' && \(c\.name \|\| ''\)\.trim\(\)\.toLowerCase\(\) === nm/.test(html));
// Raising max HP must not heal a wounded player; lowering it must not leave
// current HP above the new maximum.
t('max HP change respects current HP', /const wasFull = p\.currentHP >= p\.maxHP;/.test(html) && /p\.currentHP = wasFull \? num : Math\.min\(p\.currentHP, num\);/.test(html));
t('blank roster stats fall back to the card', /ac:    xpAC\[i\] \?\? \(p \? p\.ac : 10\)/.test(html) && /maxHP: xpHP\[i\] \?\? \(p \? p\.maxHP : 10\)/.test(html));
// The chip must look like the AC chip beside it, not floating text (v1.99),
// and the eye icon marks the values as PASSIVE so "PER 15" is not read as a
// modifier.
t('passive chip styled as a chip with an eye marker', /\.cb-passives\{[^}]*background:var\(--bg4\);[\s\S]{0,80}border:1px solid var\(--border2\)/.test(html) && /id="ico-eye"/.test(html) && /cbp-eye/.test(html));
t('passive chip has label/value hierarchy', /\.cbp-lbl\{font-size:9\.5px/.test(html) && /\.cbp-val\{font-size:14px/.test(html));
// ── 38. Condition timing: start vs end of turn (v1.100)
// 5e distinguishes "until the end of your next turn" from "until the start of
// your next turn"; the tracker only ever did the former.
t('conditions tick in two phases', /function _tickConditions\(c, phase\)/.test(html) && /_tickConditions\(cbs\[active\], 'end'\)/.test(html) && /_tickConditions\(alive\[ni\], 'start'\)/.test(html));
// Absent `when` must mean 'end', so existing saves and exports are untouched.
t('end-of-turn remains the default timing', /cond\.when\) \? cond\.when : 'end'/.test(html) && /if \(when === 'start'\) o\.when = 'start';/.test(html) && /const o = \{ n, dur \};/.test(html));
t('duration picker offers the timing choice', /id="durWhenStart"/.test(html) && /id="durWhenEnd"/.test(html));
// Repeat-save reminder (v1.100): optional, stored only when both parts are
// given, and it must pulse ONLY on the active card — a badge that pulses
// permanently becomes wallpaper.
t('repeat save stored only when complete', /const sv = \(ab && Number\.isFinite\(dcN\) && dcN > 0\) \? \{ ab, dc: dcN \} : null;/.test(html) && /if \(sv\) o\.save = sv;/.test(html));
t('save badge flashes only on the active card, and finitely', /\.cb\.active \.cond-save\{[^}]*animation:savePulse \.78s ease-in-out 4 alternate/.test(html) && !/^\.cond-save\{[^}]*animation/m.test(html));
t('save picker offers all six abilities', /durSaveAb/.test(html) && /value="STR"/.test(html) && /value="CHA"/.test(html) && /durSaveDC/.test(html));
// Popups must MEASURE themselves, never assume a size: the duration picker's
// hardcoded 160px height stopped being true the moment it grew a timing choice,
// putting its buttons off the bottom of the screen (v1.100).
t('small popups are measured and clamped, not hardcoded', /function placePopupNear\(pop, nearEl, opts\)/.test(html) && !/window\.innerWidth-220/.test(html) && !/usableHeight\(\)-160/.test(html));
t('popup placement flips rather than overflowing', /if \(left \+ pr\.width > vw - M\) left = r\.left - pr\.width - 6;/.test(html) && /if \(top \+ pr\.height > vh - M\) top = r\.top - pr\.height - 4;/.test(html));
// The expiry flash must be presentational only: ghosts live in a session array,
// never in the combatant, so saves, exports and undo are unaffected (v1.100).
t('expiry flash is session-only', /let _condGhosts = \[\]/.test(html) && /function condGhostsFor/.test(html) && !/c\.conditions[\s\S]{0,60}_condGhosts/.test(html));
t('expired conditions linger briefly then clear', /cond-ghost/.test(html) && /setTimeout\(\(\) => \{ _condGhosts = \[\]; render\(\); \}, 2600\)/.test(html));
// A literal \uXXXX escape is correct inside a JS string (it becomes the
// character) but renders as raw text in static HTML. v1.95 shipped "\u2630"
// on a button and "Filter by name\u2026" in a placeholder. Attribute values are
// the reliable place to catch it.
t('no literal unicode escapes in HTML attribute values', !/(title|placeholder|aria-label|alt)="[^"]*\\u[0-9a-fA-F]{4}/.test(html));
// Touch sizing must key off POINTER TYPE, not viewport width: an iPad in
// Safari's desktop mode reports ~992px, so a width-based rule never fires on
// the device that most needs larger targets (v1.96).
t('jump list sizes targets by pointer type', /@media \(pointer: coarse\)\{[\s\S]{0,220}\.jump-row\{min-height:44px/.test(html));
t('jump rows are separated to reduce mis-taps', /\.jump-rows\{[^}]*gap:2px/.test(html));
// One shared scroll path for the banner jump and the list, so both expand
// collapsed groups and reveal hidden defeated combatants identically.
t('single shared scroll-to-combatant helper', /function scrollToCombatant\(id\)/.test(html) && /function jumpToActive\(\) \{[\s\S]{0,220}scrollToCombatant\(cbs\[active\]\.id\)/.test(html));
// scrollIntoView scrolls EVERY scrollable ancestor including the document, which
// made the whole page jump on each turn advance. Scrolling must be confined to
// the list, and must not move at all when the card is already visible (v1.100).
t('turn advance scrolls the list only', /function _scrollListTo\(el, opts\)/.test(html) && /la\.scrollTo\(\{ top, behavior:/.test(html) && !/\.cb\.active'\);\s*if\(el\) el\.scrollIntoView/.test(html));
t('no scroll when the active card is already visible', /if \(fullyVisible && !o\.force\) return;/.test(html));
// Never rely on the browser to clamp a scroll target: Chromium does, Safari did
// not, and an out-of-range target scrolled past every card leaving the list
// blank near the end of the initiative order (v1.100).
t('scroll targets clamped to the scrollable range', /const maxScroll = Math\.max\(0, la\.scrollHeight - la\.clientHeight\);/.test(html) && /Math\.min\(Math\.max\(0, target\), maxScroll\)/.test(html));
// Turn scrolling must be INSTANT. Three code paths write this list's scroll
// position, and the global smooth-scroll rule turned each into an animation;
// those animations raced, and a long jump (end of the order, or wrapping back
// to the top) could be left stranded in blank space (v1.101).
t('turn scrolling is instant, not animated', /la\.scrollTo\(\{ top, behavior: 'auto' \}\)/.test(html) && !/behavior: reduce \? 'auto' : 'smooth'/.test(html));
// Safari can leave a scrolled container unpainted — cards present in the DOM
// at a valid position, but blank on screen until something invalidates paint.
// Resizing, nudging the scroll, or opening Web Inspector all fixed it, which is
// why the fault never appeared with the console open (v1.101).
t('list repaint nudged after scrolling', /function _nudgeRepaint/.test(html) && /_nudgeRepaint\(la\);/.test(html) && /el\.style\.opacity = .0\.999.;/.test(html));
// A scroll position can go out of range with no scroll at all — the content
// simply shrinks (ghosts fade, a group collapses, defeated are hidden). Chromium
// re-clamps eagerly; Safari left the list stranded past the end showing blank
// space. Observe the content and clamp, whatever the cause (v1.100).
t('list scroll guard clamps on content shrink', /function initListScrollGuard/.test(html) && /new ResizeObserver/.test(html) && /new MutationObserver/.test(html) && /initListScrollGuard\(\);/.test(html));
t('restored scroll position clamped too', /const _max = Math\.max\(0, _la0\.scrollHeight - _la0\.clientHeight\);/.test(html));
// The header collapses when the user scrolls down — right for a deliberate
// swipe, wrong for the tracker scrolling the list itself. On a tablet that made
// advancing a turn collapse the header and shift the whole layout (v1.100).
t('tracker-initiated scrolls do not collapse the header', /_autoScrollUntil = Date\.now\(\)/.test(html) && /if \(Date\.now\(\) < _autoScrollUntil\) \{ lastY = y; return; \}/.test(html));
// Safety net: after a turn advance, if no card is visible in the list, recover
// by scrolling the active one into view (v1.100).
t('recovers if the list ends up showing no cards', /const anyVisible = cards\.some/.test(html) && /_scrollListTo\(target, \{ centre: true, force: true \}\)/.test(html));
// focus() scrolls the element into view by default, which yanked the list.
t('focus restoration does not scroll', /el\.focus\(\{ preventScroll: true \}\)/.test(html));
// A plain scrollTop assignment ANIMATES under the global smooth-scroll rule,
// and needs a layout flush or maxScroll reads as 0 and clamps to the top.
t('scroll restore flushes layout and snaps', /void _la0\.scrollHeight;/.test(html) && /_la0\.scrollTo\(\{ top: _want, behavior: 'auto' \}\)/.test(html));
t('jump list reveals hidden or collapsed combatants', /collapsedGroups\.delete\(key\);[\s\S]{0,160}hideDead && c\.dead/.test(html));
t('more menu clamped into the viewport when opened', /function _clampMoreMenu/.test(html) && /_clampMoreMenu\(\);/.test(html) && /anchorPopupToButton\(menu, document\.getElementById\('moreMenuBtn'\)/.test(html));
// ── 33. About dialog has an obvious exit (v1.90)
t('About dialog has a corner close button', /class="welcome-close" data-action="dismissWelcome"/.test(html) && /\.welcome-close\{position:absolute/.test(html));
// "Start Empty" is meaningful on first run but reads as destructive when the
// same dialog is opened as About during a live encounter.
t('About relabels its dismiss button contextually', /function _setWelcomeMode/.test(html) && /\(mode === 'about'\) \? 'Close' : 'Start Empty'/.test(html) && /_setWelcomeMode\('about'\)/.test(html) && /_setWelcomeMode\('welcome'\)/.test(html));
// UI wiring must not hang off the database-load path (only one of two routes).
t('popup/resize init wired at DOM ready', (() => {
  // Position-based, not a character window: these must sit in the DOM-ready
  // wiring block (before the dispatchers are wired), NOT in the database-load
  // path — that path runs on only one of two routes, which is how the dev
  // diagnostic button shipped dead in v1.85.
  const init = html.indexOf('applySbMode(); initSbResize(); initPopupDragging();');
  const wire = html.indexOf("wireDispatcher(document.getElementById('cbSBPanel')");
  return init > -1 && wire > -1 && init < wire;
})());
if (buildKind === 'prod') t('dev diagnostic inert in prod build', /const STORAGE_NS = '';/.test(html));
t('per-card tie arrows still present (v1.79 must not replace them)', /data-action="moveCard"/.test(html) && /function moveCard\(id, dir\)/.test(html));
t('sample loader clears stale UI state', /selectedIds\.clear\(\); collapsedGroups\.clear\(\); combatLog = \[\];\s+\/\/ stale UI state/.test(html));
t('env dropdown wired once per load path', (html.match(/populateEnvDropdown\(\);/g)||[]).length === 2 && !/populateEnvDropdown\(\);\n\s*populateEnvDropdown\(\);/.test(html));
// ── 25. Spell-field defaults (v1.70 guard)
t('ensureCbDefaults completes spell fields before DB detection', /if \(!c\.spellSlots\) c\.spellSlots = \{\};[\s\S]{0,400}if \(c\.statSlug && dbReady/.test(html));
// ── 23. Sparse-combatant safety (v1.67 guards)
t('legendary guard is falsy-safe', /if \(!c\.legendaryMax\) return '';/.test(html) && !/c\.legendaryMax < 1/.test(html));
t('sample encounter completes fields via ensureCbDefaults', /loadSampleEncounter[\s\S]{0,1600}cbs\.forEach\(c => ensureCbDefaults\(c\)\)/.test(html));

// ── 13. Refresh preflight before destructive wipe (v1.52 guard)
const refreshFn = html.slice(html.indexOf('async function forceRefreshDBConfirmed'), html.indexOf('async function forceRefreshDBConfirmed') + 1200);
t('refresh checks reachability before idbClear', refreshFn.indexOf('open5eReachable') > -1 && refreshFn.indexOf('open5eReachable') < refreshFn.indexOf('idbClear'));

// ── v1.115: no inline event handlers; field dispatch closed in both directions
t('no inline on* event-handler attributes', !/\son[a-z]+=\\?["']/.test(html),
  (html.match(/\son[a-z]+=\\?["']/g) || []).slice(0, 5).join(' '));
const faBlock = html.slice(html.indexOf('const FIELD_ACTIONS = {'), html.indexOf('\n};', html.indexOf('const FIELD_ACTIONS = {')));
const faDefined = new Set((faBlock.match(/^\s{2}([a-zA-Z][A-Za-z0-9_]*):/gm) || []).map(x => x.trim().slice(0, -1)));
const faUndefined = [...new Set(fieldUses)].filter(a => !faDefined.has(a));
const faUnused = [...faDefined].filter(a => !fieldUses.includes(a));
t('every data-on-* names a FIELD_ACTIONS entry', faDefined.size > 0 && faUndefined.length === 0, faUndefined.join(', '));
t('every FIELD_ACTIONS entry is used', faUnused.length === 0, faUnused.join(', '));
t('field dispatcher wired for input, change and keydown',
  /\[\['input', 'onInput'\], \['change', 'onChange'\], \['keydown', 'onKey'\]\]\.forEach/.test(html));
// role="button" elements are already activated by the global keydown handler;
// a second per-element Enter handler made them fire twice (note editor, v1.114).
t('role=button elements carry no extra key handler',
  !/role="button"[^>]*data-on-key=|data-on-key="[^"]*"[^>]*role="button"/.test(html));
t('global role=button keyboard activator present',
  /t\.getAttribute\('role'\) !== 'button'\) return;[\s\S]{0,200}t\.click\(\);/.test(html));

// ── v1.115: skip-unchanged card rendering stays guarded
t('ensureCardEl skips identical HTML', /if \(el\._lastHTML !== html\) \{[\s\S]{0,400}?el\.innerHTML = html; el\._lastHTML = html;/.test(html));
t('typed-but-unapplied damage survives a card rebuild', /const typed = dIn \? dIn\.value : '';[\s\S]{0,160}if \(typed\) \{ const n = el\.querySelector\('\.dmg-in'\); if \(n\) n\.value = typed; \}/.test(html));
t('quickDmg clears the box before applying (no 6+3=63)', (() => {
  const f = html.slice(html.indexOf('function quickDmg('), html.indexOf('function quickDmg(') + 1200);
  const clr = f.indexOf("inp.value = '';"), app = f.indexOf('applyDmg(');
  return clr > -1 && app > -1 && clr < app;
})());
t('card MutationObserver watches listArea text + children',
  /_cardMO\.observe\(la, \{ childList: true, subtree: true, characterData: true \}\)/.test(html));
t('render drains outside-edit records before diffing', (() => {
  const r = html.indexOf('if (_cardMO) _markCardsFromRecords(_cardMO.takeRecords());');
  const ex = html.indexOf('const existing = {};', r);
  return r > -1 && ex > r && ex - r < 400;
})());
t('reconcileList discards its own mutation records', /function reconcileList[\s\S]{0,700}if \(_cardMO\) _cardMO\.takeRecords\(\);/.test(html));

// ── v1.115: dead code stays dead
const deadFns = ['addMonsterToCombat', 'addMonsterToGroup', 'exportEncounter', 'idbDel', 'minifySpell', 'openPartyConfigs'];
const revived = deadFns.filter(f => new RegExp('function ' + f + '\\(').test(html));
t('removed dead functions not reintroduced', revived.length === 0, revived.join(', '));

// ── v1.115: drag-reorder keeps the turn with the active combatant
t('cbDrop captures active id before splicing', (() => {
  const f = html.slice(html.indexOf('function cbDrop('), html.indexOf('function cbDrop(') + 2000);
  const cap = f.indexOf('const activeId = (active >= 0 && cbs[active]) ? cbs[active].id : -1;');
  return cap > -1 && cap < f.indexOf('cbs.splice(fromIdx, 1)');
})());
t('drag handlers delegated on listArea', /la\.addEventListener\('dragover',\s*cbDragOver\)/.test(html) &&
  /h\.addEventListener\('dragend', cbDragEnd, \{ once: true \}\)/.test(html));

// ── v1.115: optional damage types
t('one damage core for card and bulk paths', (() => {
  const body = n => html.slice(html.indexOf('function ' + n + '('), html.indexOf('function ' + n + '(') + 900);
  return /_dealDamage\(c, typedDamage\(c, amt, pick \|\| null\)\)/.test(body('applyDmg')) &&
         /_dealDamage\(/.test(body('bulkDmg')) && /_dealDamage\(/.test(body('bulkHalfDmg')) &&
         /_healCb\(/.test(body('bulkDmg')) && /_healCb\(/.test(body('applyDmg'));
})());
t('½ DMG is undoable', /function bulkHalfDmg\(\) \{[\s\S]{0,400}pushHistory\(\);/.test(html));
t('untyped damage is unchanged (typedDamage passthrough)', /const out = \{ amt, word: '', note: '', skipped: \[\] \};\s+if \(!pick\) return out;/.test(html));
t('qualified defences never auto-applied in bulk', /const plain = list => list\.some\(cl => !cl\.qual && cl\.types\.includes\(type\)\);/.test(html));
t('type button only where a type can matter', /function cardDmgTypeBtnHTML\(c\) \{\s+if \(!dmgModsFor\(c\)\) return '';/.test(html));
t('damage-type picks reset on turn advance', /_dmgPick = \{\}; resetBulkDmgType\(\); closeDmgTypePop\(\);/.test(html));
t('damage-type picks are never saved', !/function save\(\)[\s\S]{0,1500}_dmgPick/.test(html) && /let _dmgPick = \{\};/.test(html));
t('picker closes on Escape and blocks shortcuts', /e\.key==='Escape' && document\.getElementById\('dmgTypePop'\)\.classList\.contains\('on'\)\) \{ closeDmgTypePop\(\); return; \}/.test(html) &&
  /document\.getElementById\('dmgTypePop'\)\.classList\.contains\('on'\) \|\|\n\s+document\.getElementById\('logPanel'\)/.test(html));
t('bulk damage type select offers all 13 types + untyped', (() => {
  const m = html.match(/<select class="bulk-input bulk-type" id="bulkDmgType"[^>]*>([\s\S]*?)<\/select>/);
  return !!m && (m[1].match(/<option /g) || []).length === 14 && /<option value="">Untyped<\/option>/.test(m[1]);
})());

// ── v1.116: mini-shop link — Monster DB only, discreet, and untracked
t('shop link rendered from the Monster DB stat block only', (() => {
  const uses = (html.match(/\$\{shopLinkHTML\(m\)\}/g) || []).length;
  const sb = html.slice(html.indexOf('function showStatBlock('), html.indexOf('function linkSpells('));
  const inline = html.slice(html.indexOf('function buildInlineSB('), html.indexOf('function buildInlineSB(') + 6000);
  return uses === 1 && sb.includes('${shopLinkHTML(m)}') && !inline.includes('shopLink') &&
         !/function buildCardHTML[\s\S]{0,3000}shopLink/.test(html);
})());
t('shop link hidden in Wild Shape picking, with a photo, or when switched off',
  /if \(!m \|\| !shopLinksOn\(\) \|\| _transformTargetId \|\| hasMiniPhoto\(m\.slug\)\) return '';/.test(html));
t('shop link is a plain untracked link', (() => {
  const f = html.slice(html.indexOf('function shopLinkHTML('), html.indexOf('function toggleShopLinks('));
  return /const SHOP_SEARCH_URL = 'https:\/\/mitznsimz\.com\/search';/.test(html) &&
    /SHOP_SEARCH_URL \+ '\?q=' \+ encodeURIComponent\(q\) \+ '&type=product'/.test(f) &&
    /target="_blank" rel="noopener noreferrer"/.test(f) && !/utm_|fetch\(|sendBeacon|XMLHttpRequest/.test(f);
})());
t('no tracking parameters anywhere', !/utm_(source|medium|campaign)/.test(html));
t('shop links switch in More menu, remembered', /data-action="mToggleShopLinks" id="shopLinksBtn"/.test(html) &&
  /mToggleShopLinks:\(\) => \{ toggleShopLinks\(\); \}/.test(html) && /localStorage\.setItem\('enc_shopLinks'/.test(html) &&
  /loadFont\(\);\nsyncShopLinksBtn\(\);/.test(html));
t('custom monsters: mini search term round-trips', /id="cmMiniSearch"/.test(html) &&
  /mini_search: \(document\.getElementById\('cmMiniSearch'\)/.test(html) &&
  /if \(ms\) ms\.value = m\.mini_search \|\| '';/.test(html) && /'cmLegendaryDesc','cmMiniSearch'\]/.test(html));
t('DB stat block refreshes after a photo is added or removed',
  (html.match(/refreshOpenStatBlock\(slug\);/g) || []).length >= 2);
t('guide explains the shop link in the privacy section', /<b>The mini-shop link[\s\S]{0,600}no tracking code/.test(html));

// ── v1.117: concentration — one attack, one save; nothing lost
t('concentration DC: min 10, capped at 30 only under 2024 rules',
  /const dc = Math\.max\(10, Math\.floor\(total \/ 2\)\);\s+return xpRuleset === '2024' \? Math\.min\(30, dc\) : dc;/.test(html));
t('damage on an open check folds in; other creatures queue', /if \(fold\(_concOpen\)\) _concOpen\.parts\.push\(dmgAmt\);/.test(html) &&
  /else if \(_concOpen\) _concQueue\.push\(/.test(html));
t('Saved / Failed / Dismiss all move to the next queued check', ['concCheckDismiss', 'concCheckSave', 'concCheckFail'].every(f => {
  const b = html.slice(html.indexOf('function ' + f + '('), html.indexOf('function ' + f + '(') + 400);
  return /_nextConcCheck\(\);/.test(b);
}));
t('turn advance seals open concentration checks', /sealConcChecks\(\);\s+\/\/ later damage is a new source/.test(html));
t('the damage core passes damage taken, not a precomputed DC', /if \(c\.concentrating && c\.currentHP > 0\) showConcCheck\(c, amt\);/.test(html) && !/showConcCheck\(c, dc,/.test(html));
t('table ruleset remembered and synced after the markup loads', /localStorage\.setItem\('enc_xpRuleset', ruleset\)/.test(html) &&
  /document\.addEventListener\('DOMContentLoaded', _syncXPRulesetBtns\);/.test(html) && /\nloadXPRuleset\(\);\n/.test(html));

// ── v1.117: mobile review guards
t('exactly one page footer, none inside a dialog', (html.match(/class="app-footer"/g) || []).length === 1 &&
  !/id="cmModal"[\s\S]*?class="app-footer"[\s\S]*?id="welcomeModal"/.test(html));
t('concentration popup measures itself to fit', /function _placeConcCheck\(pop\)/.test(html) && /_placeConcCheck\(pop\);/.test(html) &&
  !/pop\.style\.top  = '120px';/.test(html));
t('list gap follows the bulk bar height', /_syncListForBulkBar\(\);\n\}/.test(html) && /new ResizeObserver\(\(\) => _syncListForBulkBar\(\)\)/.test(html));
t('stat blocks stack over the results on phones', /@media \(max-width: 650px\) \{[\s\S]{0,600}\.sbpanel\.sb-split \.sb-left, \.spell-panel\.sb-split \.sb-left\{display:none\}/.test(html));
t('form and XP grids can shrink on phones', /\.cm-grid\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(html) &&
  /\.xp-grid\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(html));
t('touch-sized More menu rows and concentration buttons', /@media \(pointer: coarse\)\{ \.more-menu-item\{min-height:40px\} \.conc-btn\{min-height:40px\} \}/.test(html));

// ── v1.118: the guide only sends people to More-menu items that exist.
// (It said "More ▾ → Save Encounter" long after that item became Quick Save.)
{
  const ms = html.indexOf('id="moreMenu"');
  const norm = t => t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/[^A-Za-z0-9 &()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const items = [...html.slice(ms, ms + 9000).matchAll(/class="more-menu-item[^"]*"[^>]*>([^<]*(?:<[^>]+>[^<]*)*?)<\/button>/g)].map(m => norm(m[1]));
  const guide = html.slice(html.indexOf('id="guideBody"'));
  const refs = [...new Set([...guide.matchAll(/More\s*(?:▾|▸)?\s*(?:→|▸|&gt;)\s*(?:<b>)?([^<.;,—(]{2,40})/g)].map(m => m[1].trim()))];
  const bad = refs.filter(r => { const n = norm(r); return !items.some(i => i.startsWith(n) || n.startsWith(i.split(' ').slice(0, 2).join(' '))); });
  t('guide names only More-menu items that exist', items.length > 10 && refs.length > 5 && bad.length === 0, bad.join(' | '));
}
t('guide does not say Quick Save fills the Encounters library',
  !/More → Quick Save\. (?:Saves everything|Next session: Encounters)/.test(html) && !/More → Quick Save at any point/.test(html));

console.log(`\nInvariants: ${pass} passed, ${fail} failed (${path.basename(target)} as ${buildKind})`);
process.exit(fail ? 1 : 0);

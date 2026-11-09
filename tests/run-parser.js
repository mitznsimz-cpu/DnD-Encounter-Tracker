#!/usr/bin/env node
/*
 * MitzNSimz Encounter Tracker — parser regression runner
 *
 * Extracts parseStatBlock() straight out of the single-file app and runs every
 * fixture in ./fixtures against ./expectations.json.
 *
 * Usage:
 *   node tests/run-parser.js               (tests ../index.html)
 *   node tests/run-parser.js path/to.html  (tests a specific build)
 *
 * Requires: Node only. No dependencies.
 *
 * This battery has caught two real shipping bugs:
 *  - the boundary-keyword truncation regression ("plus any six languages" -> cut)
 *  - fields swallowing the whole stat block in the D&D Beyond pipe format
 * Run it before every release that touches parseStatBlock or its helpers.
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(target)) {
  console.error(`Target not found: ${target}`);
  console.error('Pass a build explicitly: node tests/run-parser.js encounter_tracker_dev.html');
  process.exit(2);
}
const html = fs.readFileSync(target, 'utf8');

// ── extract parseStatBlock via brace-walk (regex-safe enough for this codebase)
function extractFunction(source, name) {
  const idx = source.indexOf('function ' + name);
  if (idx === -1) throw new Error(name + ' not found in target');
  let depth = 0, started = false, i = idx;
  while (i < source.length) {
    const c = source[i];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return source.slice(idx, i + 1); }
    i++;
  }
  throw new Error('unbalanced braces extracting ' + name);
}

let parseStatBlock;
try {
  // eslint-disable-next-line no-eval
  parseStatBlock = new Function(extractFunction(html, 'parseStatBlock') + '; return parseStatBlock;')();
} catch (e) {
  console.error('Could not extract parseStatBlock:', e.message);
  process.exit(2);
}

// ── run fixtures
const fixturesDir = path.join(__dirname, 'fixtures');
const expectations = JSON.parse(fs.readFileSync(path.join(__dirname, 'expectations.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];

for (const [file, exp] of Object.entries(expectations)) {
  const fixturePath = path.join(fixturesDir, file);
  if (!fs.existsSync(fixturePath)) { failures.push(`${file}: fixture file missing`); fail++; continue; }
  let p;
  try {
    p = parseStatBlock(fs.readFileSync(fixturePath, 'utf8'));
  } catch (e) { failures.push(`${file}: parser threw — ${e.message}`); fail++; continue; }

  const errs = [];
  const check = (label, ok, got) => { if (!ok) errs.push(`  ${label}: got ${JSON.stringify(got)}`); };

  for (const [key, want] of Object.entries(exp)) {
    if (key === 'actions_min')            check(`actions >= ${want}`, (p.actions||[]).length >= want, (p.actions||[]).length);
    else if (key === 'traits_min')        check(`traits >= ${want}`, (p.special_abilities||[]).length >= want, (p.special_abilities||[]).length);
    else if (key === 'bonus_actions_min') check(`bonus_actions >= ${want}`, (p.bonus_actions||[]).length >= want, (p.bonus_actions||[]).length);
    else if (key === 'reactions_min')     check(`reactions >= ${want}`, (p.reactions||[]).length >= want, (p.reactions||[]).length);
    else if (key === 'legendary_min')     check(`legendary >= ${want}`, (p.legendary_actions||[]).length >= want, (p.legendary_actions||[]).length);
    else if (key.endsWith('_not_contains')) {
      const field = key.slice(0, -'_not_contains'.length);
      check(`${field} NOT containing "${want}"`, !String(p[field]||'').includes(want), p[field]);
    }
    else if (key.endsWith('_contains')) {
      const field = key.slice(0, -'_contains'.length);
      check(`${field} contains "${want}"`, String(p[field]||'').includes(want), p[field]);
    }
    else check(`${key} === "${want}"`, String(p[key]) === String(want), p[key]);
  }

  if (errs.length) { fail++; failures.push(`${file}:\n${errs.join('\n')}`); }
  else pass++;
}

console.log(`\nParser regression: ${pass} passed, ${fail} failed (target: ${path.basename(target)})`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('✗ ' + f));
  process.exit(1);
}
console.log('✓ all fixtures clean');

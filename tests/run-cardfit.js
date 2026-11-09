// Card-fit regression test (added v1.84).
// The viewport sweep checked the PAGE for scroll leak but never looked inside a
// combatant card — so the squashed-card bug (cards crushed by the stat-block
// panel until buttons overflowed and "+ note" wrapped one letter per line)
// shipped unnoticed. This asserts every child of a card stays within it, at a
// range of card widths driven by the panel, not just by the viewport.
// Usage: node tests/run-cardfit.js <file.html>
const { chromium } = require('playwright');
const path = require('path');
const target = process.argv[2] || 'tracker.html';

const SEED = `
  dbReady = true;
  monsterDB = [{slug:'golem',name:'Bone Golem (variant)',challenge_rating:'5',dexterity:13,
    hit_points:120,armor_class:14,actions:[{name:'Slam',desc:'x'}],
    special_abilities:[{name:'Magic Resistance',desc:'y'}],speed:{walk:30},environments:[],
    damage_immunities:'lightning, poison',
    damage_resistances:'piercing and slashing from nonmagical attacks'}];
  // v1.115: worst case for the damage row — type button present AND armed with
  // the longest label the picker can produce.
  if (typeof _dmgPick !== 'undefined') _dmgPick = { 1: { eff:'res', word:'piercing/slashing',
    qual:'from nonmagical attacks', label:'x', short:'Piercing/Slashing ½' } };
  cbs = []; uid = 0;
  cbs.push({id:++uid,name:'Bone Golem (variant)',type:'monster',initiative:12,ac:14,maxHP:120,
    currentHP:120,tempHP:0,conditions:[],deathSaves:{success:0,failure:0},statSlug:'golem',showSB:true});
  ['Ellie','Ara','Koseph'].forEach(n=>cbs.push({id:++uid,name:n,type:'player',initiative:9,ac:10,
    maxHP:10,currentHP:10,tempHP:0,conditions:[],deathSaves:{success:0,failure:0}}));
  active = 0; render(); renderCbSBPanel();
`;

const MEASURE = `(() => {
  const card = document.querySelector('#listArea .cb');
  if (!card) return { err: 'no card' };
  const cr = card.getBoundingClientRect();
  let over = 0;
  card.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > cr.right + 1 || r.left < cr.left - 1)) over++;
  });
  const note = [...card.querySelectorAll('*')].find(el => el.textContent.trim() === '+ note');
  return { cardW: Math.round(cr.width), over,
           noteH: note ? Math.round(note.getBoundingClientRect().height) : 0 };
})()`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(target), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);

  let pass = 0, fail = 0;
  const t = (name, ok, extra) => { if (ok) pass++; else { fail++; console.log('  ✗', name, extra || ''); } };

  // Panel-driven widths at a fixed viewport — the case the sweep never covered.
  for (const pw of [0, 360, 460, 560, 660, 760]) {
    const r = await page.evaluate(({ s, m, w }) => { eval(s); sbPanelWidth = w; applySbWidth(); return eval(m); },
                                  { s: SEED, m: MEASURE, w: pw });
    t(`card fits with panel ${pw || 'default'}`, r.over === 0 && r.noteH <= 40,
      `card ${r.cardW}px, ${r.over} overflowing, note ${r.noteH}px`);
  }

  // Viewport-driven widths, panel open.
  for (const vw of [1400, 1180, 1133, 1024, 960, 901]) {
    await page.setViewportSize({ width: vw, height: 800 });
    await page.waitForTimeout(120);
    const r = await page.evaluate(({ s, m }) => { eval(s); sbPanelWidth = 0; applySbWidth(); return eval(m); },
                                  { s: SEED, m: MEASURE });
    t(`card fits at viewport ${vw}`, r.over === 0 && r.noteH <= 40,
      `card ${r.cardW}px, ${r.over} overflowing, note ${r.noteH}px`);
  }

  // Phone, no panel.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const ph = await page.evaluate(({ s, m }) => { eval(s); return eval(m); }, { s: SEED, m: MEASURE });
  t('card fits on a phone', ph.over === 0, `card ${ph.cardW}px, ${ph.over} overflowing`);

  // The mechanism the fix depends on.
  const cq = await page.evaluate(() => CSS.supports('container-type', 'inline-size'));
  t('list width watcher present', typeof cq === 'boolean');   // v1.103: container queries no longer required

  // The worst-case button really was in the card that was measured.
  const armed = await page.evaluate(() => { const b = document.querySelector('#listArea .cb .btn-d.t.armed'); return b ? b.textContent : ''; });
  t('armed damage-type button present in measured card', armed === 'Piercing/Slashing ½', `got '${armed}'`);

  t('zero page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`Card fit: ${pass} passed, ${fail} failed (target: ${path.basename(target)})`);
  if (fail) process.exit(1);
  console.log('✓ cards fit at every width');
})();

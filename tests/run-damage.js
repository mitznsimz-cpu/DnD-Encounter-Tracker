// Damage regression test (added v1.115).
// Every damage and healing button — card DMG/HEAL/Enter, bulk DMG All, ½ DMG,
// Heal All — now runs through one core (_dealDamage / _healCb), with optional
// damage types layered on top. This pins the behaviour that matters at the
// table: untyped damage unchanged, defences parsed and applied correctly,
// conditional defences never applied silently, and the bulk paths matching the
// card path (they had drifted: ½ DMG had no undo and killed death-save bosses).
// Usage: node tests/run-damage.js <file.html>
const { chromium } = require('playwright');
const path = require('path');
const target = process.argv[2] || 'tracker.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(target), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);

  const R = await page.evaluate(async () => {
    if (typeof parseDmgClauses !== 'function') return [['damage core present (v1.115+)', false, 'parseDmgClauses missing']];
    const res = [];
    const t = (name, ok, extra) => res.push([name, !!ok, extra || '']);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const J = x => JSON.stringify(x);
    const last = (n = 1) => combatLog.slice(-n).map(e => e.text);
    // Sections 1–6 record concentration checks instead of opening the popup;
    // section 7 restores the real one. (v1.117 signature: (c, damage) — the DC is concDC().)
    const _realConc = window.showConcCheck;
    window.showConcCheck = (c, a) => { window._cc.push([c.name, concDC(a), a]); };

    // ── 1. Parsing defence lines ────────────────────────────────────
    const P = [
      ['cold; bludgeoning, piercing, and slashing from nonmagical attacks',
       [{types:['cold'],qual:''},{types:['bludgeoning','piercing','slashing'],qual:'from nonmagical attacks'}]],
      ['fire, bludgeoning, piercing, and slashing from nonmagical attacks',          // custom-monster tags, comma-joined
       [{types:['fire'],qual:''},{types:['bludgeoning','piercing','slashing'],qual:'from nonmagical attacks'}]],
      ['Poison; Charmed, Exhaustion, Poisoned', [{types:['poison'],qual:''}]],        // 2024 combined line
      ['poison, poisoned',                      [{types:['poison'],qual:''}]],
      ['Necrotic, Psychic; Bludgeoning, Piercing, Slashing',
       [{types:['necrotic','psychic'],qual:''},{types:['bludgeoning','piercing','slashing'],qual:''}]],
      ['damage from spells',      [{types:[],qual:'damage from spells'}]],
      ['all damage except force', [{types:[],qual:'all damage except force'}]],
      ['fire (while in lava)',    [{types:['fire'],qual:'(while in lava)'}]],
      ['charmed, frightened', []], ['', []],
    ];
    P.forEach(([inp, exp]) => t('parse: ' + inp, J(parseDmgClauses(inp)) === J(exp), J(parseDmgClauses(inp))));
    t('parse: null is safe', J(parseDmgClauses(null)) === '[]');

    // ── World ───────────────────────────────────────────────────────
    const base = {challenge_rating:'1',dexterity:10,hit_points:100,hit_dice:'10d10',armor_class:12,actions:[],speed:{walk:30},
      environments:[],strength:10,constitution:10,intelligence:10,wisdom:10,charisma:10,size:'Medium',type:'x',alignment:'n'};
    monsterDB = [
      {...base, slug:'fire-el', name:'Fire Elemental', damage_immunities:'fire, poison',
               damage_resistances:'bludgeoning, piercing, and slashing from nonmagical attacks'},
      {...base, slug:'icething', name:'Ice Thing', damage_resistances:'cold, fire', damage_vulnerabilities:'fire'},
      {...base, slug:'mage', name:'Mage', damage_resistances:'damage from spells'},
      {...base, slug:'gob', name:'Gob'},
    ];
    dbReady = true;
    const mk = (id, name, slug, hp, x = {}) => ({ id, name, type:'monster', statSlug:slug, initiative:30-id, ac:12, maxHP:hp,
      currentHP:hp, tempHP:0, conditions:[], deathSaves:{success:0,failure:0}, ...x });
    const reset = () => {
      cbs = [ mk(1,'Fire Elemental','fire-el',100), mk(2,'Ice Thing','icething',100), mk(3,'Mage','mage',50),
              mk(4,'Goblin','gob',20), mk(5,'Boss','gob',10,{deathSavesEnabled:true}),
              {id:6,name:'Ellie',type:'player',initiative:1,ac:14,maxHP:30,currentHP:30,tempHP:0,conditions:[],deathSaves:{success:0,failure:0}} ];
      uid = 6; active = 0; combatLog = []; actionHistory = []; selectedIds.clear(); _dmgPick = {}; window._cc = [];
      render();
    };
    const C = id => cbs.find(x => x.id === id);

    // ── 2. Resolving a typed hit (bulk semantics) ──────────────────
    reset();
    const td = (id, amt, type) => typedDamage(C(id), amt, type ? { type } : null);
    t('untyped passes through', J(td(1, 14, null)) === J({ amt:14, word:'', note:'', skipped:[] }));
    t('immune → 0',             td(1, 14, 'fire').amt === 0);
    t('resistant → half, floor', td(2, 15, 'cold').amt === 7);
    t('resistant + vulnerable → half then double', td(2, 15, 'fire').amt === 14 && /resistant and vulnerable/.test(td(2, 15, 'fire').note));
    t('unlisted type → full',   td(4, 15, 'fire').amt === 15 && td(4, 15, 'fire').note === '');
    t('qualified defence not applied, but flagged', td(1, 10, 'slashing').amt === 10 && td(1, 10, 'slashing').skipped.length === 1,
      J(td(1, 10, 'slashing')));
    t('typeless defence ("damage from spells") flagged', td(3, 10, 'fire').amt === 10 && /damage from spells/.test(td(3, 10, 'fire').skipped[0] || ''));
    t('card pick: chosen line applied as-is', typedDamage(C(1), 15, { eff:'res', word:'bludgeoning/piercing/slashing', qual:'from nonmagical attacks' }).amt === 7);
    t('no defences → no type button', dmgModsFor(C(4)) === null && dmgModsFor(C(6)) === null);

    // ── 3. Untyped log text unchanged ──────────────────────────────
    reset();
    applyDmg(4, 6, false);
    t('untyped damage log unchanged', last()[0] === 'Goblin took 6 damage (14/20 HP)', last()[0]);
    applyDmg(4, 30, false);
    t('untyped kill log unchanged', last()[0] === '☠ Goblin defeated (30 damage)', last()[0]);

    // ── 4. The damage core ─────────────────────────────────────────
    reset(); C(1).tempHP = 5; C(1).concentrating = true;
    applyDmg(1, 20, false, { eff:'imm', word:'fire', qual:'' });
    t('immunity: no HP, no temp HP lost, no concentration check', C(1).currentHP === 100 && C(1).tempHP === 5 && window._cc.length === 0 && !C(1)._dmgTurn);
    t('immunity logged', /took no fire damage — immune, 20 ignored/.test(last()[0]), last()[0]);
    reset(); C(2).concentrating = true; C(2).tempHP = 4;
    applyDmg(2, 25, false, { eff:'res', word:'cold', qual:'' });
    t('resisted hit: half applied through temp HP', C(2).currentHP === 92 && C(2).tempHP === 0, C(2).currentHP + '/' + C(2).tempHP);
    t('concentration DC from damage actually taken', J(window._cc) === J([['Ice Thing', 10, 12]]), J(window._cc));
    t('temp HP absorption in the log', /took 12 cold damage — resistant, 25 halved; 4 absorbed by temp HP \(92\/100 HP\)/.test(last()[0]), last()[0]);
    t('per-turn tally counts damage taken', C(2)._dmgTurn === 12);

    // ── 5. Bulk paths match the card path ──────────────────────────
    reset();
    [1, 2, 4, 5].forEach(i => selectedIds.add(i));
    document.getElementById('bulkDmgType').value = 'fire';
    document.getElementById('bulkAmt').value = '20';
    bulkDmg(false);
    t('bulk fire: per-creature defences', C(1).currentHP === 100 && C(2).currentHP === 80 && C(4).currentHP === 0 && C(4).dead,
      [1,2,4].map(i => C(i).currentHP).join(','));
    t('bulk: death-save boss drops, not killed', C(5).currentHP === 0 && !C(5).dead);
    t('bulk: one undo step', actionHistory.length === 1);
    reset(); selectedIds.add(5);
    document.getElementById('bulkDmgType').value = '';
    document.getElementById('bulkAmt').value = '30';
    bulkHalfDmg();
    t('½ DMG: undoable', actionHistory.length === 1);
    t('½ DMG: death-save boss drops, not killed', C(5).currentHP === 0 && !C(5).dead);
    t('½ DMG: log marks the half', /took 15 damage — half of 30/.test(combatLog.map(e => e.text).join('\n')) || /half of 30/.test(last()[0]), last()[0]);
    reset(); const e = C(6); e.currentHP = 0; e.conditions = ['Unconscious']; e.deathSaves = { success:1, failure:2 };
    selectedIds.add(6); document.getElementById('bulkAmt').value = '7';
    bulkDmg(true);
    t('Heal All: same as card heal (saves reset, Unconscious removed)', e.currentHP === 7 && e.deathSaves.failure === 0 && !e.conditions.length);

    // ── 6. Card UI wiring ──────────────────────────────────────────
    reset(); await wait(30);
    t('type button on creatures with defences only',
      !!document.querySelector('.cb[data-id="1"] .btn-d.t') && !document.querySelector('.cb[data-id="4"] .btn-d.t') && !document.querySelector('.cb[data-id="6"] .btn-d.t'));
    const inp = document.getElementById('dmg_4'); inp.value = '6'; inp.focus();
    quickDmg(4, false); await wait(20);
    t('box empty after applying (no 6+3=63)', document.getElementById('dmg_4').value === '', document.getElementById('dmg_4').value);
    _dmgPick[1] = { eff:'imm', word:'fire', qual:'', label:'Fire (immune)', short:'Fire ×0' }; render(); await wait(20);
    t('armed pick shown on the card', document.querySelector('.cb[data-id="1"] .btn-d.t').textContent === 'Fire ×0');
    document.getElementById('dmg_1').value = '9'; render(); await wait(20);
    t('typed amount survives a card rebuild', document.getElementById('dmg_1').value === '9');
    quickDmg(1, false); await wait(20);
    t('pick is one hit only', !_dmgPick[1] && C(1).currentHP === 100 && document.querySelector('.cb[data-id="1"] .btn-d.t').textContent === 'Type ▾');
    _dmgPick[2] = { eff:'res', word:'cold', qual:'', label:'x', short:'Cold ½' };
    document.getElementById('bulkDmgType').value = 'cold';
    nextTurn(); await wait(20);
    t('turn advance clears picks and bulk type', !Object.keys(_dmgPick).length && document.getElementById('bulkDmgType').value === '');

    // ── 7. Concentration checks (v1.117): one attack = one save ────
    window.showConcCheck = _realConc;
    const pop = () => ({ on: document.getElementById('concCheckPop').classList.contains('on'),
      name: document.getElementById('concCheckName').textContent, dc: +document.getElementById('concCheckDCVal').textContent,
      id: document.getElementById('concCheckPop')._concId });
    const creset = () => { reset(); _concOpen = null; _concQueue = []; document.getElementById('concCheckPop').classList.remove('on');
      C(1).concentrating = true; C(2).concentrating = true; C(1).maxHP = C(1).currentHP = 500; C(2).maxHP = C(2).currentHP = 500; setXPRuleset('2014'); };
    creset();
    applyDmg(2, 15, false); applyDmg(2, 15, false, { eff:'res', word:'cold', qual:'' });
    t('two-part hit folds into one check', pop().name === 'Ice Thing took 15 + 7 = 22 damage' && pop().dc === 11, pop().name + ' DC ' + pop().dc);
    concCheckSave(); applyDmg(2, 8, false);
    t('after the check is resolved, the next hit is a new check', pop().name === 'Ice Thing took 8 damage');
    creset(); [1, 2].forEach(i => selectedIds.add(i));
    document.getElementById('bulkDmgType').value = ''; document.getElementById('bulkAmt').value = '28'; bulkDmg(false);
    t('AoE through two casters: second check queued, not lost', pop().id === 1 && _concQueue.length === 1 && _concQueue[0].id === 2);
    concCheckFail();
    t('failing one brings up the next', pop().id === 2 && !C(1).concentrating && pop().on);
    concCheckSave();
    t('queue empties and the popup closes', !pop().on);
    creset(); applyDmg(2, 12, false); selectedIds.clear(); nextTurn(); applyDmg(2, 12, false);
    t('turn advance seals the open check (later damage is a new source)', _concOpen.parts.length === 1 && _concQueue.length === 1);
    creset(); applyDmg(2, 80, false);
    t('2014: DC uncapped', pop().dc === 40, pop().dc);
    creset(); setXPRuleset('2024'); applyDmg(2, 80, false);
    t('2024: DC capped at 30', pop().dc === 30, pop().dc);
    t('ruleset is remembered', localStorage.getItem('enc_xpRuleset') === '2024');
    setXPRuleset('2014');
    return res;
  });

  let pass = 0, fail = 0;
  R.forEach(([name, ok, extra]) => { if (ok) pass++; else { fail++; console.log('  ✗', name, extra); } });
  if (errs.length) { fail++; console.log('  ✗ page errors:', errs.slice(0, 2).join(' | ')); } else pass++;
  await browser.close();
  console.log(`Damage: ${pass} passed, ${fail} failed (target: ${path.basename(target)})`);
  if (!fail) console.log('✓ damage core and types clean');
  process.exit(fail ? 1 : 0);
})();

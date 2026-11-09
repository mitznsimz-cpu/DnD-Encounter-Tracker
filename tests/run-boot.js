// Boot-path regression test (added v1.61, after the hideDead TDZ crash).
// The tracker calls render() during script evaluation when a saved encounter is
// restored — a code path NO after-load test exercises. This boots both builds
// with a realistic saved mid-combat state (players, a lair card, dead monsters,
// combat log, hide-defeated preference ON) and asserts: zero page errors, cards
// rendered, pills present, and the hide-defeated filter applied correctly.
// Usage: node tests/run-boot.js <file.html> [dev|prod]
const { chromium } = require('playwright');
const path = require('path');
const target = process.argv[2] || 'tracker.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1400,height:900} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  const url = 'file://' + path.resolve(target);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{
    const mk=(id,n,t,init,hp,dead)=>({id,name:n,type:t,initiative:init,ac:15,maxHP:hp,currentHP:dead?0:hp,dead:!!dead,tempHP:0,conditions:[],deathSaves:{success:0,failure:0},statSlug:null});
    const state={cbs:[mk(1,'Shayde','player',29,10,false), mk(2,'Cairn Thane — Lair','other',20,1,false), mk(3,'Cairn Thane','monster',5,161,false), mk(4,'Goblin 1','monster',3,7,true), mk(5,'Goblin 2','monster',3,7,true)],
                 round:13, active:0, uid:5, combatLog:[{type:'round',text:'━━ Round 13 begins ━━',round:13,ts:Date.now()}]};
    localStorage.setItem('enc_state', JSON.stringify(state));
    localStorage.setItem('enc_hide_dead','1');
  });
  errs.length = 0;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  const r = await page.evaluate(()=>{ try {
    return { cards: document.querySelectorAll('#listArea .cb').length,
             pills: (document.getElementById('hstats')||{children:{length:0}}).children.length,
             eyePill: !!document.querySelector('[data-action="toggleHideDead"]'),
             hideDeadVal: hideDead, cbsLen: cbs.length };
  } catch(e){ return { evalErr: e.message }; } });
  let pass = 0, fail = 0;
  const t = (name, ok, extra) => { if (ok) pass++; else { fail++; console.log('  ✗', name, extra||''); } };
  t('zero page errors on boot with saved state', errs.length === 0, errs.slice(0,2).join(' | '));
  t('script alive (globals reachable)', !r.evalErr, r.evalErr);
  t('state restored (5 combatants)', r.cbsLen === 5);
  t('hide-defeated pref restored', r.hideDeadVal === true);
  t('dead hidden at boot (3 of 5 visible)', r.cards === 3, 'cards=' + r.cards);
  t('stats pills rendered incl. eye pill', r.pills > 0 && r.eyePill === true);
  // Sample encounter WITH a loaded DB (v1.70): the sample's slugs must resolve
  // against a populated monsterDB — the exact combination that crashed v1.60–v1.69
  // (undefaulted spell fields hit Object.keys in the DB-linked detection branch).
  const s = await page.evaluate(()=>{
    dbReady = true;
    monsterDB = [
      { slug:'goblin', name:'Goblin', challenge_rating:'1/4', actions:[{name:'Scimitar',desc:'x'}], special_abilities:[], environments:[] },
      { slug:'goblin-boss', name:'Goblin Boss', challenge_rating:'1', actions:[{name:'Multiattack',desc:'x'}], special_abilities:[], environments:[] }
    ];
    let alerted = null; const oa = window.mtzAlert; window.mtzAlert = (t2)=>{ alerted = t2; };
    loadSampleEncounter();
    window.mtzAlert = oa;
    return { alerted, n: cbs.length, cards: document.querySelectorAll('#listArea .cb').length,
             fieldsOk: cbs.every(c => c.spellSlots && c.innateSpells && c.atWillSpells && c.xDayAbilities) };
  });
  t('sample loads with populated DB (no alert)', s.alerted === null, s.alerted);
  t('sample renders 7 cards with complete fields', s.n === 7 && s.cards === 7 && s.fieldsOk);

  // Mini-shop link (v1.116): Monster DB stat block only; never in combat, never
  // while picking a Wild Shape form, never with your own mini photo, off-switchable.
  const sh = await page.evaluate(async () => {
    if (typeof shopLinkHTML !== 'function') return { missing: true };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const link = () => { const a = document.querySelector('#sbContent .sb-shop-link'); return a ? a.getAttribute('href') : null; };
    monsterDB.push({ slug:'bone-golem', name:'Bone Golem (variant)', type:'construct', challenge_rating:'5', actions:[], special_abilities:[], environments:[] },
                   { slug:'c-hb', name:'Captain Brinemark', type:'humanoid', _custom:true, actions:[], special_abilities:[], environments:[] },
                   { slug:'c-hb2', name:'Bilge Rat', type:'beast', mini_search:'giant rat', _custom:true, actions:[], special_abilities:[], environments:[] });
    miniIndex = {};
    const o = {};
    showStatBlock('goblin'); await wait(20); o.db = link();
    showStatBlock('bone-golem'); await wait(20); o.suffix = link();
    showStatBlock('c-hb'); await wait(20); o.customType = link();
    showStatBlock('c-hb2'); await wait(20); o.customTerm = link();
    o.rel = (document.querySelector('#sbContent .sb-shop-link') || {}).rel;
    _transformTargetId = 1; showStatBlock('goblin'); await wait(20); o.transform = link(); _transformTargetId = null;
    miniIndex.goblin = { bytes: 1 }; showStatBlock('goblin'); await wait(20); o.photo = link(); delete miniIndex.goblin;
    toggleShopLinks(); showStatBlock('goblin'); await wait(20); o.off = link(); toggleShopLinks();
    render(); if (typeof renderCbSBPanel === 'function') renderCbSBPanel();
    o.combat = !!document.querySelector('#listArea .sb-shop-link, #cbSBPanel .sb-shop-link') || buildInlineSB(monsterDB[0]).includes('sb-shop');
    return o;
  });
  const S = 'https://mitznsimz.com/search?q=';
  t('shop link: Monster DB searches by name', sh.db === S + 'Goblin&type=product', sh.db || (sh.missing ? 'shopLinkHTML missing' : 'none'));
  t('shop link: "(variant)" suffix dropped', sh.suffix === S + 'Bone%20Golem&type=product', sh.suffix);
  t('shop link: custom monster uses its term, else its type', sh.customTerm === S + 'giant%20rat&type=product' && sh.customType === S + 'humanoid&type=product');
  t('shop link: opens a new tab, sends no referrer', sh.rel === 'noopener noreferrer');
  t('shop link: hidden in Wild Shape picking, with a photo, when off', sh.transform === null && sh.photo === null && sh.off === null);
  t('shop link: never in combat (cards, combat stat block)', sh.combat === false);
  await browser.close();
  console.log(`Boot test: ${pass} passed, ${fail} failed (target: ${path.basename(target)})`);
  if (fail) process.exit(1);
  console.log('✓ boot path clean');
})();

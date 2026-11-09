// buildCardHTML characterisation harness (added v1.63, before the decomposition).
// Runs buildCardHTML over ~20 synthetic combatant states covering every card
// section and compares SHA-256 hashes of the exact output against recorded
// goldens. The refactor's acceptance criterion is byte-identical output.
// Usage:  node tests/run-cardhtml.js <file.html>            (compare)
//         node tests/run-cardhtml.js <file.html> --record   (rewrite goldens)
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const target = process.argv[2] || 'tracker.html';
const record = process.argv.includes('--record');
const goldenPath = path.join(__dirname, 'goldens-cardhtml.json');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1400,height:900} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file://' + path.resolve(target), {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(400);
  const outputs = await page.evaluate(() => {
    // Fixed world state for determinism
    dbReady = true;
    monsterDB.push({slug:'harn-jarl', name:'Harn Jarl', hit_points:100, hit_dice:'10d10+40', armor_class:16,
      actions:[{name:'Smash (Recharge 5-6)',desc:'x'}], legendary_actions:[{name:'Move',desc:'x'}],
      legendary_desc:'can take 2 legendary actions',
      special_abilities:[{name:'Lair Action: Quake',desc:'x'},{name:'Multiattack',desc:'x'},{name:'Magic Resistance',desc:'x'}],
      damage_resistances:'cold', damage_immunities:'poison', condition_immunities:'charmed'});
    const base = (o) => Object.assign({
      id: 1, name:'Base', type:'monster', initiative:12, ac:14, maxHP:20, currentHP:20, tempHP:0,
      conditions:[], concentrating:false, note:'', dead:false, absent:false,
      deathSaves:{success:0,failure:0}, deathSavesEnabled:false, statSlug:null, showSB:false,
      reactionUsed:false, readyAction:{active:false,trigger:''},
      legendaryUsed:0, legendaryMax:0, lairUsed:0, lairMax:0, rechargeState:{},
      spellSlots:{}, innateSpells:{}, atWillSpells:[], xDayAbilities:{}
    }, o);
    const states = {
      plain_monster:      base({}),
      player_full:        base({id:2, name:'Shayde', type:'player', ac:18, deathSavesEnabled:true}),
      npc_conditions:     base({id:3, type:'npc', conditions:[{name:'Poisoned',duration:3},{name:'Prone',duration:null}]}),
      ally_temphp_note:   base({id:4, type:'ally', tempHP:5, note:'guarding the door'}),
      other_timer:        base({id:5, name:'Cloudkill', type:'other', initiative:15, maxHP:0, currentHP:0}),
      bloodied:           base({id:6, currentHP:8}),
      dead_monster:       base({id:7, dead:true, currentHP:0}),
      dying_player:       base({id:8, type:'player', currentHP:0, deathSavesEnabled:true, deathSaves:{success:1,failure:2}}),
      concentrating:      base({id:9, concentrating:true}),
      reaction_ready:     base({id:10, reactionUsed:true, readyAction:{active:true,trigger:'when the door opens'}}),
      db_linked_full:     base({id:11, name:'Harn Jarl', statSlug:'harn-jarl', maxHP:100, currentHP:100,
                                legendaryMax:2, legendaryUsed:1, lairMax:1,
                                rechargeState:{'Smash (Recharge 5-6)':{available:false, range:'5-6'}}}),
      lair_pip_available: base({id:12, name:'Harn Jarl', statSlug:'harn-jarl', lairMax:1}),
      lair_pip_used:      base({id:13, name:'Harn Jarl', statSlug:'harn-jarl', lairMax:1, lairUsed:1}),
      lair_card:          base({id:14, name:'Harn Jarl — Lair', type:'other', initiative:20, statSlug:'lair-harn-jarl', maxHP:1, currentHP:1}),
      spellcaster:        base({id:15, spellSlots:{1:{max:4,used:1},2:{max:3,used:3}}, atWillSpells:['Fire Bolt'],
                                innateSpells:{'Misty Step':{max:3,used:2}}}),
      xday_abilities:     base({id:16, xDayAbilities:{'Frightful Presence':{max:1,used:1}}}),
      legendary_full:     base({id:17, legendaryMax:3, legendaryUsed:0}),
      absent_combatant:   base({id:18, absent:true}),
      big_damage_turn:    base({id:19, _dmgTurn:12, currentHP:8}),
      long_name_max:      base({id:20, name:'Extraordinarily Long Named Creature Of Doom 3', currentHP:1, tempHP:9,
                                conditions:[{name:'Restrained',duration:2}], note:'x'.repeat(60)}),
      // Sparse literal — a combatant missing modern fields entirely (like the
      // sample encounter's hand-built goblins). Guards falsy-safe field checks:
      // must render NO empty LEG/LAIR labels, no spell tracker, no crashes.
      sparse_literal:     {id:21, name:'Old Goblin', type:'monster', initiative:7, ac:15, maxHP:7, currentHP:7,
                           tempHP:0, conditions:[], note:'', dead:false, deathSaves:{success:0,failure:0}, statSlug:null, showSB:false}
    };
    const out = {};
    for (const [label, c] of Object.entries(states)) {
      // world contexts that buildCardHTML reads live
      cbs = (label === 'lair_pip_used' || label === 'lair_pip_available') ? [c] :
            (label === 'db_linked_full') ? [c, states.lair_card] :   // lair card present → pip suppressed
            [c];
      for (const active of [false, true]) {
        active ? (window.active = 0) : (window.active = -1);
        const ctx = { isActive: active, pct: c.maxHP>0 ? (c.currentHP/c.maxHP)*100 : 0,
                      col: hpCol(c.currentHP, c.maxHP), isGrouped: false, key: '' };
        out[label + (active ? '@active' : '')] = buildCardHTML(c, ctx);
      }
    }
    // Damage type armed for the next hit (v1.115): label, colour class, a11y text.
    _dmgPick = { 11: { eff:'res', word:'cold', qual:'', label:'Cold (resistant)', short:'Cold ½' } };
    cbs = [states.db_linked_full];
    window.active = -1;
    out['dmg_type_armed'] = buildCardHTML(states.db_linked_full, { isActive:false, pct:100, col:hpCol(100,100), isGrouped:false, key:'' });
    _dmgPick = {};
    // grouped context variant
    const gc = states.plain_monster;
    cbs = [gc];
    out['plain_monster@grouped'] = buildCardHTML(gc, { isActive:false, pct:100, col:hpCol(20,20), isGrouped:true, key:'Base||12' });
    return out;
  });
  const hashes = {};
  for (const [k,v] of Object.entries(outputs)) hashes[k] = crypto.createHash('sha256').update(v).digest('hex').slice(0,16);
  if (record) {
    fs.writeFileSync(goldenPath, JSON.stringify(hashes, null, 2));
    fs.writeFileSync(path.join(__dirname, 'goldens-cardhtml-dump.json'), JSON.stringify(outputs, null, 1));
    console.log('Recorded ' + Object.keys(hashes).length + ' goldens');
  } else {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    let pass=0, fail=0;
    for (const k of Object.keys(golden)) {
      if (hashes[k] === golden[k]) pass++;
      else { fail++; console.log('  ✗ ' + k + ' changed'); }
    }
    for (const k of Object.keys(hashes)) if (!(k in golden)) { fail++; console.log('  ✗ new unexpected state ' + k); }
    console.log(`CardHTML goldens: ${pass} identical, ${fail} changed (target: ${path.basename(target)})`);
    if (errs.length) { console.log('page errors:', errs.slice(0,2)); process.exit(1); }
    if (fail) process.exit(1);
    console.log('✓ byte-identical');
  }
  await browser.close();
})();

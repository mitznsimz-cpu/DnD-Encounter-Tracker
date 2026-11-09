// Random-encounter generator band-adherence test (added v1.65).
// Seeds a synthetic CR-spread pool + fixed party, generates across every
// difficulty × shape × ruleset, and asserts each build's ADJUSTED XP classifies
// into the requested band (DMG 2014 thresholds+multiplier; 2024 budgets, no
// multiplier). Also asserts the budget scales with the configured party.
// Usage: node tests/run-generator.js <file.html>
const { chromium } = require('playwright');
const path = require('path');
const target = process.argv[2] || 'tracker.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1400,height:900} });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file://' + path.resolve(target), {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(400);
  const r = await page.evaluate(()=>{
    dbReady = true; genSources = [];
    const crs = ['1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13'];
    monsterDB = [];
    crs.forEach((cr,i)=>{ for(let k=0;k<4;k++) monsterDB.push({slug:`m${i}_${k}`, name:`M${i}_${k}`, challenge_rating:cr, environments:[]}); });
    const out = { cells: [], party: null };
    xpLevels = [5,5,5,5];
    for (const rs of ['2014','2024']) {
      xpRuleset = rs;
      for (const diff of ['easy','medium','hard','deadly']) {
        for (const type of ['any','horde','boss','boss_minions']) {
          document.getElementById('regenDifficulty').value = diff;
          document.getElementById('regenType').value = type;
          document.getElementById('regenEnv').value = '';
          let inBand = 0, total = 12;
          for (let i=0;i<total;i++) {
            generateEncounter();
            if (document.querySelector('.regen-result-title').textContent.toLowerCase().startsWith(diff)) inBand++;
          }
          out.cells.push({ key: rs+'/'+diff+'/'+type, inBand, total });
        }
      }
    }
    // party scaling: a level-2 trio vs a level-10 five must produce very different XP
    xpRuleset = '2014';
    document.getElementById('regenDifficulty').value = 'medium';
    document.getElementById('regenType').value = 'any';
    const adjFor = () => { generateEncounter(); return parseInt(document.querySelector('.regen-result-title').textContent.match(/([\d,]+) adj/)[1].replace(/,/g,'')); };
    xpLevels = [2,2,2];   const small = adjFor();
    xpLevels = [10,10,10,10,10]; const big = adjFor();
    out.party = { small, big, scales: big > small * 3 };
    return out;
  });
  let pass = 0, fail = 0;
  for (const c of r.cells) {
    // Tolerance: one statistical miss per cell (random rolls can rarely exhaust
    // the 14 build-retries). A systematic maths bug fails a cell outright.
    if (c.inBand >= c.total - 1) { pass++; if (c.inBand < c.total) console.log(`  ~ ${c.key}: ${c.inBand}/${c.total} (within tolerance)`); }
    else { fail++; console.log(`  ✗ ${c.key}: ${c.inBand}/${c.total} in band`); }
  }
  if (r.party.scales) pass++; else { fail++; console.log('  ✗ budget does not scale with party', JSON.stringify(r.party)); }
  if (errs.length) { fail++; console.log('  ✗ page errors:', errs.slice(0,2)); }
  await browser.close();
  console.log(`Generator: ${pass} passed, ${fail} failed (target: ${path.basename(target)})`);
  if (fail) process.exit(1);
  console.log('✓ band adherence + party scaling clean');
})();

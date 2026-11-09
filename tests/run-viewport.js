#!/usr/bin/env node
/*
 * MitzNSimz Encounter Tracker — viewport layout sweep (OPTIONAL, needs Playwright)
 *
 * Loads a build in headless Chromium at the standard viewport set with a sample
 * encounter, and asserts the layout invariants that have mattered historically:
 * zero page errors, all logos hydrated, no horizontal scroll-leak, More menu
 * fits the viewport, list reachable, saved-party cards contain their buttons.
 *
 * Usage:
 *   npm i -g playwright && npx playwright install chromium   (one-time)
 *   node tests/run-viewport.js path/to/build.html
 *
 * Known pre-existing exception (backlog): tablet widths 651-900px report a
 * header scroll-leak because the pre-combat header is wider than the viewport.
 * The sweep reports it as WARN, not FAIL, until that backlog item is done.
 */
const path = require('path');
const target = process.argv[2];
if (!target) { console.error('Usage: node tests/run-viewport.js path/to/build.html'); process.exit(2); }
const fileUrl = 'file://' + path.resolve(target);

const VIEWPORTS = [
  { w: 390,  h: 844,  l: 'phone-P'  },
  { w: 844,  h: 390,  l: 'phone-L'  },
  { w: 768,  h: 1024, l: 'tablet-P' },
  { w: 1366, h: 680,  l: 'laptop'   },
  { w: 1920, h: 1080, l: 'desktop'  },
];

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.error('Playwright not installed — see usage header.'); process.exit(2); }

  const browser = await chromium.launch();
  let fails = 0, warns = 0;

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { loadSampleEncounter(); } catch (e) {} });
    await page.waitForTimeout(200);

    const r = await page.evaluate(async () => {
      const logos = [...document.querySelectorAll('img.js-logo')].filter(i => i.src.startsWith('data:')).length;
      const leak  = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const la    = document.getElementById('listArea').getBoundingClientRect();
      toggleMoreMenu();
      await new Promise(r => setTimeout(r, 250)); // let rAF max-height apply
      const m = document.getElementById('moreMenu').getBoundingClientRect();
      toggleMoreMenu();
      // saved-party card containment
      setPartyConfigs([{ name: 'T', party: Array.from({length:7}, (_,i)=>({name:'Player'+i, level:5})) }]);
      openXP(); await new Promise(r => setTimeout(r, 250));
      const row = document.querySelector('.party-config-row');
      let bleeds = -1;
      if (row) {
        const rb = row.getBoundingClientRect();
        bleeds = [...row.querySelectorAll('.party-config-btn')]
          .filter(b => { const bb = b.getBoundingClientRect(); return bb.right > rb.right + 0.5 || bb.bottom > rb.bottom + 0.5; }).length;
      }
      closeModal('xpModal');

      // v1.117 — More menu: every visible item can be scrolled to and hit.
      // (The app sets scroll-behavior:smooth globally, so scroll instantly here.)
      toggleMoreMenu(); await new Promise(r => setTimeout(r, 250));
      const menu = document.getElementById('moreMenu'), mrect = menu.getBoundingClientRect();
      const menuUnreachable = [...menu.querySelectorAll('.more-menu-item, .accent-swatch')].filter(el => el.offsetParent).filter(el => {
        el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        const q = el.getBoundingClientRect(), hit = document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2);
        return !(hit && el.contains(hit) && q.bottom <= innerHeight + 1);
      }).map(el => el.textContent.trim().slice(0, 20));
      const menuContained = getComputedStyle(menu).overscrollBehaviorY === 'contain';
      toggleMoreMenu();

      // v1.117 — with the bulk bar open, the last combatant can still be scrolled clear of it.
      selectedIds.clear(); cbs.slice(0, 2).forEach(c => selectedIds.add(c.id)); render(); updateBulkBar();
      await new Promise(r => setTimeout(r, 120));
      const list = document.getElementById('listArea'); list.style.scrollBehavior = 'auto'; list.scrollTop = list.scrollHeight;
      await new Promise(r => setTimeout(r, 80));
      const lastCard = [...list.querySelectorAll('.cb')].pop();
      const bulkHides = lastCard ? Math.max(0, Math.round(lastCard.getBoundingClientRect().bottom - document.getElementById('bulkBar').getBoundingClientRect().top)) : 0;
      selectedIds.clear(); render(); updateBulkBar(); list.style.scrollBehavior = '';

      // v1.117 — the custom-monster dialog sits on screen (a stray footer once pushed it off the left edge).
      openCustomMonster(); await new Promise(r => setTimeout(r, 200));
      const cmr = document.querySelector('#cmModal .modal').getBoundingClientRect();
      // On screen AND centred: the stray footer pushed it sideways — off the left
      // edge on a phone, hugging the left on a laptop.
      const cmOnScreen = cmr.left >= -1 && cmr.right <= innerWidth + 1 && Math.abs(cmr.left - (innerWidth - cmr.right)) <= 2;
      window.__cmr = [Math.round(cmr.left), Math.round(cmr.right), innerWidth];
      document.getElementById('cmModal').classList.remove('on');

      return { logos, leak, listReachable: la.top < innerHeight, menuFits: m.bottom <= innerHeight + 1, bleeds,
               menuUnreachable, menuContained, bulkHides, cmOnScreen, cmr: window.__cmr };
    });

    const problems = [];
    if (errs.length)            problems.push(`pageErrors=${errs.length}`);
    if (r.logos !== 3)          problems.push(`logos=${r.logos}/3`);
    if (!r.listReachable)       problems.push('list unreachable');
    if (!r.menuFits)            problems.push('More menu overflows viewport');
    if (r.bleeds !== 0)         problems.push(`party-card button bleed=${r.bleeds}`);
    if (r.leak > 0) problems.push(`scroll-leak=${r.leak}px`);
    if (r.menuUnreachable.length) problems.push('More items unreachable: ' + r.menuUnreachable.join(' | '));
    if (!r.menuContained)       problems.push('More menu scroll can chain to the page');
    if (r.bulkHides > 0)        problems.push(`bulk bar hides last combatant by ${r.bulkHides}px`);
    if (!r.cmOnScreen)          problems.push('custom monster dialog off screen / off centre ' + JSON.stringify(r.cmr));

    const hardFails = problems.filter(p => !p.startsWith('WARN'));
    if (hardFails.length) fails++;
    console.log(`${hardFails.length ? '✗' : '✓'} ${vp.l} (${vp.w}x${vp.h})${problems.length ? ' — ' + problems.join(', ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(`\nViewport sweep: ${VIEWPORTS.length - fails}/${VIEWPORTS.length} clean, ${warns} known-warn`);
  process.exit(fails ? 1 : 0);
})();

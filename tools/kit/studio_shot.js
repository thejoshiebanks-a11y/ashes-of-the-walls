const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const p = await b.newPage({ viewport: { width: 800, height: 370 }, deviceScaleFactor: 1 });
  p.on('console', m => { const t = m.text(); if (/error|fail|warn|actors/i.test(t)) console.log('[page]', t.slice(0, 300)); });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 400)));
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('http://localhost:8765/index.html', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.STORY && window.STORY.debug && window.STORY.studio, null, { timeout: 120000 });
  console.log('story ready');
  const t0 = Date.now();
  await p.evaluate(async () => {
    const D = STORY.debug, ACT = D.ACT, G = D.G, ST = STORY.studio;
    await ACT.ensure(['mannequin', 'fuse_woman']); window.__actors.clear = () => {};
    [...document.body.children].forEach(e => { if (e.tagName !== 'CANVAS' && e.id !== 'sv-studio' && e.tagName !== 'SCRIPT') e.style.display = 'none'; });
    window.__freeze = false; window.__noTitan = true; window.__noOdm = true; window.__hideAvatar = true;
    let sp, gy; for (let i = 0; i < 120; i++) { try { sp = G.snap(-176.5, -186.5); gy = G.gh(sp.x, sp.z); break; } catch (e) { await new Promise(r => setTimeout(r, 1000)); } }
    G.teleport(sp.x + 14, sp.z + 14, 0, 0.1);
    ST.enter({ x: sp.x, z: sp.z, gy, yaw: Math.PI, h: 1.3 });
    window.__man = ACT.spawnMannequin(sp.x, sp.z, Math.PI, 1.3);
    window.__sp = sp;
  });
  console.log('studio on', Date.now() - t0);
  const shot = async n => { await p.waitForTimeout(1500); await p.screenshot({ path: `previews/st_${n}.png` }); console.log('shot', n, Date.now() - t0); };
  await shot('a');
  await p.evaluate(() => { const ST = STORY.studio; ST.focus('upper', { d: 1.8, yaw: -0.2 }); });
  await shot('b');
  await p.evaluate(async () => {
    const ST = STORY.studio, ACT = STORY.debug.ACT, sp = window.__sp;
    ST.focus('full', { d: 2.6 });
    const mk = () => ACT.spawnPlayer({ body: 'fuse_woman', look: { skin: 1, hair: 2, top: 0, bottom: 0, shoes: 0, height: 0.3, build: 0.5, headW: .5, headH: .5 }, wear: 1 }, sp.x, sp.z, Math.PI, false);
    window.__rev = ST.reveal(window.__man, mk, 6000);
  });
  await shot('c'); await shot('d');
  await b.close();
})();

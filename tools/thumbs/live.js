// long-lived headless page; evaluates cmd/<n>.js (page JS expression/async body) and writes cmd/<n>.out; screenshot via return value {shot:'name'}
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => fs.appendFileSync('cmd/errors.log', e.message.slice(0, 400) + '\n'));
  p.on('console', m => { if (/error|fail/i.test(m.text())) fs.appendFileSync('cmd/errors.log', '[c] ' + m.text().slice(0, 300) + '\n'); });
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await p.goto('http://localhost:8765/index.html', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.STORY && window.STORY.debug && window.STORY.studio && window.STORY.creatorKit, null, { timeout: 300000 });
  fs.writeFileSync('cmd/ready', '1'); const done = new Set();
  for (;;) {
    for (const f of fs.readdirSync('cmd').filter(f => /^\d+\.js$/.test(f) && !done.has(f)).sort()) {
      done.add(f); const n = f.replace('.js', ''); let out;
      try { const code = fs.readFileSync('cmd/' + f, 'utf8'); out = await p.evaluate(`(async()=>{${code}})()`);
        if (out && out.viewport) { await p.setViewportSize({ width: out.viewport[0], height: out.viewport[1] }); }
        if (out && out.shots) { for (const sh of out.shots) { if (sh.js) await p.evaluate(`(async()=>{${sh.js}})()`); await p.waitForTimeout(sh.wait || 1500); await p.screenshot({ path: 'previews/' + sh.name + '.png', clip: sh.clip }); } }
        else if (out && out.shot) { await p.waitForTimeout(out.wait || 2500); await p.screenshot({ path: 'previews/' + out.shot + '.png', clip: out.clip }); } } catch (e) { out = 'ERR ' + e.message.slice(0, 500); }
      fs.writeFileSync('cmd/' + n + '.out', typeof out === 'string' ? out : JSON.stringify(out));
    }
    await new Promise(r => setTimeout(r, 400));
  }
})();

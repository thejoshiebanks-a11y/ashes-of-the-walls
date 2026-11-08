// The cinematic effects: simulation is deterministic, bounded and finite; drawing never throws with a recording canvas.
global.window = global; global.STORY = {};
const mk = () => { const calls = []; const h = { get: (t, k) => k === 'calls' ? calls : (k === 'canvas' ? {} : (() => ({ addColorStop() {} }))), set: () => true }; return new Proxy({}, { get: (t, k) => k === 'calls' ? calls : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => { calls.push(k); }), set: () => true }); };
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => mk() }) };
const F = require('../js/story/fx.js'); let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const H = { project: (x, y, z) => ({ cx: x * 0.01, cy: (y - 20) * 0.01, cw: Math.max(0.5, (z + 80) * 0.01) }) };
const P = F.puffs(H); P.burst('smoke', [0, 10, 20], 60, { speed: 10, up: 8, l: 3 }); ok(P.ps.length === 60, 'burst makes puffs');
for (let i = 0; i < 400; i++) P.update(1 / 30); ok(P.ps.length === 0, 'every puff dies');
for (let i = 0; i < 2000; i++) P.add({ kind: 'steam', p: [0, 0, 0], l: 9 }); ok(P.ps.length <= 520, 'puff count is capped: ' + P.ps.length);
P.ps.length = 0; P.burst('fire', [0, 10, 20], 20, {}); P.update(0.1); ok(P.ps.every(q => q.p.every(Number.isFinite) && Number.isFinite(q.r)), 'puffs stay finite');
const g = mk(); P.draw(g, 800, 400, () => 0.5); ok(g.calls.includes('drawImage'), 'puffs are drawn'); const g2 = mk(); P.draw(g2, 800, 400, () => 0); ok(!g2.calls.includes('drawImage'), 'fully occluded puffs are not drawn');
const B = F.bolts(H); B.strike({ a: [0, 100, 40], b: [0, 0, 40], t0: 1, dur: 0.5 }); B.update(1.05); const g3 = mk(); B.draw(g3, 800, 400); ok(g3.calls.includes('stroke'), 'a bolt is drawn while it lives'); B.update(2); ok(B.list.length === 0, 'a bolt expires');
const PL = F.plasma(H); PL.set([0, 40, 40], 10, 1, 2); PL.update(1.8); const g4 = mk(); PL.draw(g4, 800, 400); ok(g4.calls.includes('fill'), 'plasma ball draws');
const SH = F.shocks(H); SH.add({ c: [0, 0, 40], t0: 0, life: 1 }); SH.update(0.4); const g5 = mk(); SH.draw(g5, 800, 400); ok(g5.calls.includes('stroke'), 'shock ring draws'); SH.update(2); ok(SH.list.length === 0, 'shock ring expires');
const FL = F.flashes(); FL.add({ t0: 0, dur: 0.5 }); FL.update(0.1); const g6 = mk(); FL.draw(g6, 800, 400); ok(g6.calls.includes('fillRect'), 'flash fills the screen');
const RY = F.rays(H); RY.set([0, 40, 40], 0, 1, 1); RY.update(0.3); const g7 = mk(); RY.draw(g7, 800, 400); ok(g7.calls.includes('fill'), 'god rays draw');
console.log('fx test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

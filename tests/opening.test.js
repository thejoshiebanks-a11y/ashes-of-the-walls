// Pure-logic tests for the opening: camera paths, scout formation and the cancellable timeline.
global.window = global; global.document = { addEventListener() {}, removeEventListener() {} };
global.STORY = { ui: { mount() {}, hideAll() {}, setTicker() {}, title() {}, splash: {} }, audio: {} };
require('../js/story/opening.js');
const OP = STORY.opening; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const finite = v => v.every(Number.isFinite);

// title camera: finite, bounded, never goes underground, drifts smoothly (no teleporting between frames)
let prev = null, maxStep = 0, minY = 1e9;
for (let t = 0; t <= 600; t += 0.05) {
  const p = OP.titlePose(t); ok(finite(p.pos) && finite(p.target) && Number.isFinite(p.fov), 'titlePose finite @' + t);
  minY = Math.min(minY, p.pos[1]);
  if (prev) maxStep = Math.max(maxStep, Math.hypot(p.pos[0] - prev[0], p.pos[1] - prev[1], p.pos[2] - prev[2])); prev = p.pos;
}
ok(minY > 30, 'aerial camera stays high: ' + minY.toFixed(1)); ok(maxStep < 1.5, 'title drift is smooth: ' + maxStep.toFixed(3));

// the wall cutscene: every shot must be valid, continuous enough, and look at the wall
const g = { x0: -42, front: -20, back: 6, top: 50 }, TL = OP.TL;
ok(TL.rumble < TL.ball && TL.ball < TL.strike && TL.strike < TL.grab && TL.grab < TL.headUp && TL.headUp < TL.reveal && TL.reveal < TL.end, 'beats are in order');
ok(TL.end >= 7 && TL.end <= 10, 'intro stays short: ' + TL.end + ' s');
const shots = new Set(); let prevC = null, cut = 0;
for (let t = 0; t <= TL.end; t += 0.05) {
  const c = OP.camAt(t, g); ok(finite(c.pos) && finite(c.target) && c.fov > 0.3 && c.fov < 1.3, 'camAt valid @' + t.toFixed(2)); shots.add(c.shot);
  ok(c.pos[1] > 0.5, 'camera above ground @' + t.toFixed(2));
  if (prevC && Math.hypot(c.pos[0] - prevC.pos[0], c.pos[1] - prevC.pos[1], c.pos[2] - prevC.pos[2]) > 12) cut++; prevC = c;
}
ok(shots.size === 4 && cut === 3, 'four shots with exactly three cuts: ' + [...shots] + ' cuts=' + cut);
const c0 = OP.colossalState(0), cg = OP.colossalState(TL.grab), ce = OP.colossalState(TL.reveal + 1);
ok(c0.reach === 0 && cg.reach > 0.99, 'arms start down, land on the wall at the grab'); ok(c0.lift < -20 && ce.lift > 0 && c0.show === false && ce.show === true, 'he starts hidden below the wall and ends heaved above it');
ok(ce.head > c0.head, 'the head lifts'); for (let t = 0; t <= TL.end; t += 0.1) { const s = OP.colossalState(t); ok(finite([s.reach, s.reachR, s.lean, s.head, s.grip, s.lift]), 'colossalState finite'); }
for (let t = 0; t <= TL.end; t += 0.05) { const k = OP.trauma(t); ok(k >= 0 && k <= 1, 'trauma 0..1'); }
ok(OP.trauma(TL.strike + 0.05) > 0.8 && OP.trauma(0) === 0, 'the strike shakes the camera hardest');
ok(OP.colossalState(TL.strike + 1).reach < 1 && OP.colossalState(TL.grab + 0.1).reachR < 0.4 && OP.colossalState(TL.grab + 1.5).reachR > 0.99, 'one hand grips first, then the other');
// the pose function only ever writes unit-ish finite directions
const pz = { d: new Float32Array(45) }; for (let i = 0; i < 15; i++) pz.d[i * 3 + 1] = -1; OP.cpose(pz, 1, 0.5, 0.2, 0.5, 0.3, 0.6); ok(finite(Array.from(pz.d)), 'cpose writes finite numbers');

// cancellable timeline: skip() resolves every pending wait immediately and later waits are instant
(async () => {
  const r = OP.newRun(), t0 = Date.now(); const w = r.wait(5000), w2 = r.wait(8000); r.skip(); await Promise.all([w, w2]); await r.wait(5000);
  ok(Date.now() - t0 < 500 && r.dead, 'skip resolves all waits at once');
  const r2 = OP.newRun(), s = Date.now(); await r2.wait(60); ok(Date.now() - s >= 50, 'un-skipped wait really waits');
  console.log('opening test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();

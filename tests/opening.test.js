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

// scouts: V formation, leader in front, all moving toward the gate (+z)
const L0 = OP.scoutPath(0, 0), L1 = OP.scoutPath(0, 3);
ok(L1[2] > L0[2], 'leader flies toward the gate');
for (const t of [0, 2, 5, 7]) {
  const l = OP.scoutPath(0, t), a = OP.scoutPath(1, t), b = OP.scoutPath(2, t);
  ok(finite(l) && finite(a) && finite(b), 'scoutPath finite @' + t);
  ok(a[2] <= l[2] && b[2] <= l[2], 'wingmen trail the leader @' + t);
  ok(Math.abs(a[0] - b[0]) > 2, 'wingmen spread apart @' + t);
}
// intro flyover camera: valid for the whole 7.3 s, ends close behind the leader
for (let t = 0; t <= 7.3; t += 0.1) { const c = OP.shotA(t); ok(finite(c.pos) && finite(c.target) && c.fov > 0.3 && c.fov < 1.6, 'shotA valid @' + t.toFixed(1)); }
const c0 = OP.shotA(0), c3 = OP.shotA(3), l3 = OP.scoutPath(0, 3);
ok(Math.hypot(c3.pos[0] - l3[0], c3.pos[1] - l3[1], c3.pos[2] - l3[2]) < Math.hypot(c0.pos[0] - OP.scoutPath(0, 0)[0], c0.pos[1] - OP.scoutPath(0, 0)[1], c0.pos[2] - OP.scoutPath(0, 0)[2]), 'camera dives in on the leader');

// cancellable timeline: skip() resolves every pending wait immediately and later waits are instant
(async () => {
  const r = OP.newRun(), t0 = Date.now(); const w = r.wait(5000), w2 = r.wait(8000); r.skip(); await Promise.all([w, w2]); await r.wait(5000);
  ok(Date.now() - t0 < 500 && r.dead, 'skip resolves all waits at once');
  const r2 = OP.newRun(), s = Date.now(); await r2.wait(60); ok(Date.now() - s >= 50, 'un-skipped wait really waits');
  console.log('opening test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();

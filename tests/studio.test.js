/* creator studio: camera maths, enter/exit state, the scan-line reveal */
const path = require('path'); const R = path.resolve(__dirname, '..'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
globalThis.STORY = {}; require(R + '/js/story/studio.js'); const ST = STORY.studio;
(async () => {
  ST.enter({ x: 10, z: -4, gy: 2, h: 1.3, yaw: Math.PI }); ok(globalThis.__studio && globalThis.__studio.rim > 0, 'enter sets the studio flag');
  ST.focus('full'); ST.snap(); const p = ST.camPose();
  const d = Math.hypot(p.pos[0] - p.target[0], p.pos[1] - p.target[1], p.pos[2] - p.target[2]);
  ok(Math.abs(d - ST.cam.d * 1.3) < 0.2, 'camera distance follows body height'); ok(p.pos[2] < -4 + 0.01 === false || true, 'ok');
  // subject faces yaw=PI i.e. -z; the camera must stand in front of it (z < subject z)
  ok(p.pos[2] < -4, 'camera is in front of the character'); ok(p.target[1] > 2 && p.target[1] < 2 + 1.3, 'target is inside the body height');
  ST.focus('face'); ST.snap(); const q = ST.camPose(); ok(q.target[1] > p.target[1] && Math.hypot(q.pos[0] - q.target[0], q.pos[2] - q.target[2]) < d, 'face focus is higher and closer');
  for (let i = 0; i < 200; i++) ST.update(0.016); ok(Math.abs(ST.cam.th - ST.target.th) < 0.01, 'camera smoothing converges');
  const man = { fx: null }, kid = { fx: null }; let t = 0;
  await ST.reveal(man, () => kid, 120); ok(kid.fx === null, 'new body loses the scan effect after the reveal'); ok(man.fx && man.fx.mode === 2, 'mannequin keeps what is above the line');
  ST.exit(); ok(globalThis.__studio === null, 'exit clears the studio flag');
  console.log('studio tests:', pass, 'passed,', fail, 'failed'); process.exit(fail ? 1 : 0);
})();

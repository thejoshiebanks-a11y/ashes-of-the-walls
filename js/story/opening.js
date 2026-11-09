/* Ashes of the Walls — the opening (v0.4).
   Studio gate and logo -> cinematic intro (Scouts over the district, the wall, the Colossal) -> title stamp -> aerial title screen.
   OWNER: the "opening" chat. Everything the player sees from the first tap until the menu lives in this file and css/opening.css.
   The 3D side goes through a small `host` object that main.js hands in, so this file never reaches into the engine itself. */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui, AU = S.audio, doc = root.document, OP = S.opening = {};
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, easeOut = t => 1 - Math.pow(1 - t, 3), sstep = (a, b, t) => ease(clamp((t - a) / (b - a), 0, 1));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ================= all the words (Japanese ones feed tools/build_jp_font.py) ================= */
  const T = {
    studio: 'JOSHIE SAMA', presents: 'PRESENTS',
    tap: 'Tap to begin', tapJp: 'タップして開始',
    legalJp: 'これは非公式・非営利のファンプロジェクトです。',
    year: '845', place: 'Shiganshina District', placeJp: 'シガンシナ区',
    caps: [['壁の内側で、僕らは生まれた。', 'Inside the walls, we were born.'], ['穏やかな日々は、嘘だった。', 'The calm days were a lie.'], ['空が、割れる。', 'The sky splits.']],
    stampJp: '壁の灰', sub: 'THREE DAYS BEFORE', subJp: '三日前',
    tagline: 'You were born behind the walls. You will die for what lies beyond them.',
    menu: [
      { act: 'new', en: 'Begin journey', jp: '旅立ち', desc: 'Live the last three days of Shiganshina District before the wall breaks.' },
      { act: 'continue', en: 'Load file', jp: '記録', desc: 'Continue from a saved file.' },
      { act: 'train', en: 'Training grounds', jp: '訓練兵団', desc: 'Opens in Act 2. Learn the gear before the Titans come.', locked: true },
      { act: 'options', en: 'Options', jp: '設定', desc: 'Sound, text speed and screen shake.' },
      { act: 'exit', en: 'Exit', jp: '終了', desc: 'Leave the walls for now.' }
    ],
    byline: 'A Joshie Sama production', bye: ['また、壁の向こうで。', 'See you beyond the wall.']
  };
  OP.T = T;

  /* ================= pure camera paths (unit tested) ================= */
  // The title camera drifts forever without ever repeating the same frame: three slow sines on every axis.
  OP.titlePose = function (t) {
    const a = Math.sin(t * 0.021), b = Math.sin(t * 0.013 + 1.3), c = Math.sin(t * 0.034 + 0.4);
    return { pos: [-96 + a * 34, 74 + c * 6, -332 + b * 26], target: [8 + b * 9, 38 + c * 2, -22 + a * 8], fov: 0.98 };
  };
  /* ---- the cutscene's pure timeline (unit tested). Times in seconds; g = the wall measured in the world: {x0, front, back, top} ----
     0 fade up, storm flickers  ->  ball: a golden sphere swells in the sky  ->  strike: bolt, whiteout, explosion  ->  grab: one hand clamps the wall top
     ->  headUp: he heaves up, steam pours  ->  reveal: face over the wall, roar  ->  end */
  const TL = OP.TL = { rumble: 0.8, ball: 1.8, strike: 3.8, grab: 5.6, headUp: 7.0, reveal: 9.0, end: 12.6 };
  const kk = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const K = OP.K = { liftHide: -27, liftGrab: -9, liftUp: 4, tzOff: 21, armU: [0.1, 0.34, 0.95], armF: [0.04, 0.24, 0.97], armU2: [0.1, -0.25, 0.95], armF2: [0.04, -0.3, 0.97], fd: [0, -0.4, 0.9], handX: 9, handY: 0.25, handZ: 2.4, hoverY: 15, hoverZ: 17, pole: [0.25, -0.9, -0.25], pn: [0, 1, -0.15], curlT: [0, -1.9, 1.0], curl: 1.3, height: 62, ballUp: 62 };   // the scene's tuning knobs
  OP.colossalState = function (t) {                          // how the Colossal moves: first one hand, then the other, then the heave and the head lifting
    const reach = easeOut(kk(t, TL.grab - 1.5, TL.grab)), reachR = easeOut(kk(t, TL.grab + 0.7, TL.grab + 1.7)), heave = ease(kk(t, TL.headUp - 0.3, TL.reveal + 0.7)), hid = kk(t, TL.strike + 0.4, TL.grab - 0.2);
    return { reach, reachR, press: heave, lean: 0.34 * reach + 0.06 * reachR - 0.14 * heave, head: -0.55 + 0.7 * ease(kk(t, TL.headUp + 0.5, TL.reveal + 1.2)), grip: kk(t, TL.grab - 0.4, TL.grab + 1.0), gripR2:0, gripR: kk(t, TL.grab + 0.9, TL.grab + 1.8), lift: OP.clipMode ? 0 : K.liftHide + (K.liftGrab - K.liftHide) * ease(hid) + (K.liftUp - K.liftGrab) * heave, show: t >= TL.strike + 0.05 };
  };
  /* Colossal2 is driven only by its own baked clips (no IK grip, no finger curl, no scripted heave): in = rise, skl01 = swat, jt_roar = roar. */
  OP.c2Seq = [['C2:in', TL.grab - 0.2, 51 / 30], ['C2:skl01', TL.grab - 0.2 + 51 / 30, 71 / 30], ['C2:jt_roar', TL.reveal + 0.5, 87 / 30]];
  OP.c2clip = function (t) {
    let r = ['C2:in', 0], idleT = 0.4 + t * 0.35;
    if (t < OP.c2Seq[0][1]) return { name: 'C2:in', t: 0 };
    for (const [n, st, L] of OP.c2Seq) if (t >= st && t < st + L) return { name: n, t: Math.min(t - st, L - 0.04) };
    const last = OP.c2Seq[2]; if (t >= last[1] + last[2]) return { name: 'C2:idle', t: idleT };
    return { name: 'C2:idle', t: idleT };
  };

  OP.trauma = function (t) {                                 // camera-shake energy 0..1: spikes on the strike, the grab, the roar
    const hit = (t0, p, d) => t < t0 ? 0 : p * Math.exp(-(t - t0) / d);
    return clamp(Math.max(0.12 * kk(t, TL.rumble, TL.strike), hit(TL.strike, 1, 0.7), hit(TL.grab, 0.6, 0.5), hit(TL.headUp, 0.3, 1.0) * kk(t, TL.headUp, TL.headUp + 0.4), hit(TL.reveal, 0.7, 0.7)), 0, 1);
  };
  OP.shotC = TL.strike + 2.1;                               // the camera cuts (through black) to the low front shot and then never cuts again
  OP.camAt = function (t, g) {                               // three shots: A street + sky, B the blast from above, C one long low crane from the hand to the face
    const m = (g.front + g.back) / 2, x0 = g.x0, top = g.top, F = g.front, hy = 0.93 * K.height + OP.colossalState(t).lift, S1 = TL.strike + 0.35;
    if (t < S1) { const k = ease(kk(t, 0, S1)); return { pos: [x0 + 9 - 7 * k, 3 + 3 * k, F - 70 + 16 * k], target: [x0, top + 4 + 16 * k, F + 20], fov: 1.0 - 0.2 * k, shot: 'A' }; }
    if (t < OP.shotC) { const k = kk(t, S1, OP.shotC); return { pos: [x0 - 36 + 10 * k, top + 8 + 3 * k, F - 56 + 4 * k], target: [x0 + 2, top + 14 - 4 * k, m + 24], fov: 0.95 - 0.08 * k, shot: 'B' }; }
    const rise = ease(kk(t, OP.shotC + 0.2, TL.reveal + 0.6)), up = ease(kk(t, TL.headUp - 0.5, TL.reveal + 0.5)), k2 = ease(kk(t, TL.reveal + 0.3, TL.end)), tz = m + K.tzOff;   // C: starts close and low under the gripping hand, then rises and pulls back until the face clears the wall edge
    return { pos: [x0 + 4 - 2 * rise - 2 * k2, 22 + 21 * rise + 3 * k2, F - 36 - 14 * rise + 6 * k2], target: [x0 - 1 + rise, top + 1 + (hy - 2 - top - 1) * up, m + (tz - m - 4) * up], fov: 0.88 - 0.28 * rise - 0.08 * k2, shot: 'C' };
  };

  /* ================= run control: one object that lets any wait be skipped ================= */
  /* The Colossal's pose for the wall scene. pz.d holds one direction per bone pair in the pelvis frame:
     0 L upper arm, 1 L forearm, 2 R upper arm, 3 R forearm, 8..11 spine, 12 neck, 13/14 clavicles.
     reach 0..1: arms swing forward and the hands come down onto the wall top; lean 0..1: he bends over the wall; head -1..1: chin down .. looking up. */
  OP.cpose = function (pz, reach, lean, head, grip, press, reachR) {
    if (reachR == null) reachR = reach;
    const D = pz.d, mix = (i, v, w) => { for (let c = 0; c < 3; c++) D[i * 3 + c] = D[i * 3 + c] * (1 - w) + v[c] * w; };
    const sp = Math.sin((grip || 0) * 3.14), tremble = (grip || 0) > 0 ? Math.sin(performance.now() * 0.03) * 0.015 * sp : 0;
        const pr = press || 0, U = OP.K.armU.map((v, i) => v + (OP.K.armU2[i] - v) * pr), F = OP.K.armF.map((v, i) => v + (OP.K.armF2[i] - v) * pr); mix(0, [U[0] + tremble, U[1], U[2]], reach); mix(1, [F[0], F[1], F[2] + tremble], reach);
    mix(2, [-U[0] - tremble, U[1], U[2]], reachR); mix(3, [-F[0], F[1], F[2] + tremble], reachR);
    const lz = 0.55 * lean; mix(9, [0, 0.9, lz], 1); mix(10, [0, 0.9, lz], 1); mix(11, [0, 0.92, lz * 0.8], 1);
    mix(12, [0, 0.95, 0.3 - head * 0.55 + lz * 0.2], 1);
  };
  /* Hands and fingers: each hand lies flat ON the wall top, wrist behind the edge, fingers curled over the front edge (never inside the stone).
     Uses the engine's hand-orientation (M.hr) and finger-curl (M.curl) systems. d* are in the pelvis frame (+z forward, +y up). */
  /* Arms by inverse kinematics: each wrist is driven to a point ON the wall top (hover point first, then down onto the stone), so the hands stay
     planted while the body heaves up. Works in the model frame (same as M.W), mapped from the world through the actor's position and scale. */
  OP.armIK = function (M, a, pz) {
    const g = a.geo, K = OP.K; if (!g || !M || !M.W || !a.scale) return false;
    const D = pz.d, sc = a.scale, V = (x, y, z) => [x, y, z], sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]], len = v => Math.hypot(v[0], v[1], v[2]), nrm = v => { const l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const inv = w => [(a.x - w[0]) / sc, (w[1] - a.vg) / sc, (a.z - w[2]) / sc], dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    for (const sd of ['L', 'R']) {
      const sg = sd === 'L' ? 1 : -1, iU = M.id('Bip001 ' + sd + ' UpperArm'), iF = M.id('Bip001 ' + sd + ' Forearm'), iH = M.id('Bip001 ' + sd + ' Hand'); if (iU < 0 || iF < 0 || iH < 0) continue;
      const rk = sd === 'L' ? a.reach || 0 : a.reachR != null ? a.reachR : a.reach || 0, e = rk * rk * (3 - 2 * rk), wgt = Math.min(1, rk * 3); if (wgt <= 0.001) continue;
      const p = i => [M.W[i][12], M.W[i][13], M.W[i][14]], S = p(iU), E0 = p(iF), Wr = p(iH), l1 = len(sub(E0, S)), l2 = len(sub(Wr, E0)); if (!(l1 > 1e-4 && l2 > 1e-4) || !isFinite(S[0] + E0[0] + Wr[0])) continue;
      const fx = g.x0 - sg * K.handX; let topY = g.top; try { const r = window.__world && window.__world.cast([fx, g.top + 40, g.front + K.handZ], [0, -1, 0], 120); if (r && r.t !== undefined && isFinite(r.t) && Math.abs(g.top + 40 - r.t - g.top) < 8) topY = g.top + 40 - r.t; } catch (e) { }
      const fin = [fx, topY + K.handY, g.front + K.handZ], hov = [fx, topY + K.hoverY, g.front + K.hoverZ];
      const Tw = [hov[0] + (fin[0] - hov[0]) * e, hov[1] + (fin[1] - hov[1]) * e, hov[2] + (fin[2] - hov[2]) * e]; Tw[1] += Math.sin(performance.now() * 0.03) * 0.04 * (a.grip || 0);
      let Tg = inv(Tw), d = sub(Tg, S), dl = len(d); const mx = (l1 + l2) * 0.985; if (dl > mx) { Tg = [S[0] + d[0] * mx / dl, S[1] + d[1] * mx / dl, S[2] + d[2] * mx / dl]; d = sub(Tg, S); dl = mx; }
      const dn = [d[0] / dl, d[1] / dl, d[2] / dl], aa = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa)), pole = nrm(K.pole.map((v, k) => k === 0 ? v * sg : v)), pd = dot(pole, dn);
      const pp = nrm([pole[0] - dn[0] * pd, pole[1] - dn[1] * pd, pole[2] - dn[2] * pd]), E = [S[0] + dn[0] * aa + pp[0] * h, S[1] + dn[1] * aa + pp[1] * h, S[2] + dn[2] * aa + pp[2] * h];
      const uN = nrm(sub(E, S)), fN = nrm(sub(Tg, E)), k1 = sd === 'L' ? 0 : 2, k2 = k1 + 1;
      for (let c = 0; c < 3; c++) { D[k1 * 3 + c] = D[k1 * 3 + c] * (1 - wgt) + uN[c] * wgt; D[k2 * 3 + c] = D[k2 * 3 + c] * (1 - wgt) + fN[c] * wgt; }
    }
    return true;
  };
  OP.hands = function (M, a) {
    if (!M || !M.hr || !M.curl || !M.W) return;
    try {
      const okLoc = l => l && [l.fd, l.ax, l.pn].every(v => v && v.every(Number.isFinite) && Math.hypot(v[0], v[1], v[2]) > 0.5);
      if (!okLoc(M.hr.loc && M.hr.loc.L) || !okLoc(M.hr.loc && M.hr.loc.R)) { window.__initHandLoc && window.__initHandLoc(M); if (!okLoc(M.hr.loc.L) || !okLoc(M.hr.loc.R)) { M.hr.on = false; return; } }
      const gl = a.grip || 0, gr = a.gripR || 0, hr = M.hr;
      if (gl <= 0.001 && gr <= 0.001) { hr.on = false; M.curl.aL = M.curl.aR = 0; return; }
      const K = OP.K;
      hr.on = true; hr.k = 1;
      const pL = K.pnL || K.pn, pR = K.pnR || K.pn; hr.ori = { L: { FD: K.fd.slice(), N: pL.slice() }, R: { FD: [-K.fd[0], K.fd[1], K.fd[2]], N: [-pR[0], pR[1], pR[2]] } };
      const iL = M.id('Bip001 L Hand'), iR = M.id('Bip001 R Hand'), i2 = M.id('Bip001 L Finger2');
      let hl = 1; if (iL >= 0 && i2 >= 0) hl = Math.hypot(M.W[i2][12] - M.W[iL][12], M.W[i2][13] - M.W[iL][13], M.W[i2][14] - M.W[iL][14]) || 1;
      const w = iL >= 0 ? M.W[iL] : null;
      M.curl.tg = w ? [w[12] + K.curlT[0] * hl, w[13] + K.curlT[1] * hl, w[14] + K.curlT[2] * hl] : M.curl.tg;
      M.curl.aL = K.curl * gl; M.curl.aR = K.curl * gr;
    } catch (e) { /* keep the arm pose only */ }
  };
  OP.newRun = function () {
    const r = { dead: false, waiters: [], timers: [] };
    r.wait = ms => new Promise(res => { if (r.dead) return res(); const id = setTimeout(res, ms); r.timers.push(id); r.waiters.push(res); });
    r.skip = () => { if (r.dead) return; r.dead = true; r.timers.forEach(clearTimeout); r.waiters.forEach(f => f()); r.waiters = []; };
    return r;
  };

  /* ================= DOM: fx layer, studio, intro stage ================= */
  let fxRoot, fxc, fxg, grain, grainG, studio, stage, cap, yearEl, skipEl, cutEl, bars, titleEl, lockEl, menuEl, descEl, bandEl, creditEl, verEl, built = false;
  const FX = OP.fx = { layers: new Set(), on: false, W: 0, H: 0, t: 0 };

  function hexSVG(cls) {                                     // the studio mark: a hexagon, grid halos and an H with a heartbeat crossbar
    const hexPts = r => [-90, -30, 30, 90, 150, 210].map(a => (120 + r * Math.cos(a * Math.PI / 180)).toFixed(1) + ',' + (120 + r * Math.sin(a * Math.PI / 180)).toFixed(1)).join(' ');
    return '<svg class="op-hex ' + (cls || '') + '" viewBox="0 0 240 240" aria-hidden="true"><defs>' +
      '<linearGradient id="opg' + (cls || '') + '" gradientUnits="userSpaceOnUse" x1="52" y1="42" x2="188" y2="198"><stop offset="0" stop-color="#a6e8ff"/><stop offset="1" stop-color="#4c93ff"/></linearGradient>' +
      '<linearGradient id="ops' + (cls || '') + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bfe9ff" stop-opacity="0"/><stop offset=".5" stop-color="#e8f7ff" stop-opacity=".9"/><stop offset="1" stop-color="#bfe9ff" stop-opacity="0"/></linearGradient>' +
      '<clipPath id="opc' + (cls || '') + '"><polygon points="' + hexPts(112) + '"/></clipPath></defs>' +
      '<g clip-path="url(#opc' + (cls || '') + ')" class="op-grid">' + [48, 84, 120, 156, 192].map(p => '<path d="M0 ' + p + 'H240M' + p + ' 0V240"/>').join('') + '</g>' +
      '<polygon class="op-h3" points="' + hexPts(112) + '" pathLength="1"/><polygon class="op-h2" points="' + hexPts(96) + '" pathLength="1"/>' +
      '<polygon class="op-h1" points="' + hexPts(78) + '" pathLength="1" stroke="url(#opg' + (cls || '') + ')"/>' +
      '<g class="op-H" stroke="url(#opg' + (cls || '') + ')"><path class="op-bar" d="M99 82V158" pathLength="1"/><path class="op-bar b" d="M141 82V158" pathLength="1"/><path class="op-pulse" d="M100 122H113L119 104L126 138L131 122H140" pathLength="1"/></g>' +
      '<g clip-path="url(#opc' + (cls || '') + ')"><polygon class="op-sweep" points="-30,0 16,0 -14,240 -60,240" style="fill:url(#ops' + (cls || '') + ')"/></g></svg>';
  }


  function crestSVG() {                                      // the game's crest: Wall Maria, Rose and Sina as three rings, split by a crack, an ember at the core, ash lifting off
    const ticks = '<circle class="cr-t" cx="130" cy="130" r="123" pathLength="96"/>';
    const flakes = [[176, 52, 9, -38], [196, 70, 6, -62], [160, 36, 5, -20], [206, 96, 4, -80], [184, 30, 4, -34], [214, 56, 5, -70], [150, 22, 3, -12]].map((f, i) => '<path class="cr-f" style="--dx:' + f[3] + 'px;--d:' + (i * 0.35).toFixed(2) + 's" d="M' + f[0] + ' ' + f[1] + 'l' + f[2] + ' -' + (f[2] * 0.45).toFixed(1) + 'l' + (f[2] * 0.5).toFixed(1) + ' ' + (f[2] * 0.9).toFixed(1) + 'l-' + f[2] + ' ' + (f[2] * 0.4).toFixed(1) + 'z"/>').join('');
    return '<svg class="op-crest" viewBox="0 0 260 260" aria-hidden="true"><defs>' +
      '<linearGradient id="crs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf7ec"/><stop offset=".45" stop-color="#b7b4ab"/><stop offset=".6" stop-color="#e9e3d2"/><stop offset="1" stop-color="#76736d"/></linearGradient>' +
      '<linearGradient id="cre" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset=".5" stop-color="#ff7a2e"/><stop offset="1" stop-color="#b3150d"/></linearGradient>' +
      '<radialGradient id="crg"><stop offset="0" stop-color="#ff8a3d" stop-opacity=".55"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient></defs>' +
      '<circle class="cr-glow" cx="130" cy="130" r="92" fill="url(#crg)"/>' + ticks +
      '<circle class="cr-r r1" cx="130" cy="130" r="108" pathLength="1"/><circle class="cr-r r2" cx="130" cy="130" r="82" pathLength="1"/><circle class="cr-r r3" cx="130" cy="130" r="56" pathLength="1"/>' +
      '<path class="cr-crack" d="M198 38L170 82L152 100L137 121L124 132L133 147L113 177L106 209L90 240" pathLength="1"/>' +
      '<g class="cr-core"><path class="cr-em" d="M130 100L152 130L130 160L108 130Z"/><path class="cr-sp" d="M130 112L141 130L130 148L119 130Z"/></g>' + flakes + '</svg>';
  }

  OP.mount = function () {
    if (built) return; built = true; const R = UI.R;
    // cinematic layers that sit above the world and below menus
    fxRoot = el('div', 'op-fx'); fxRoot.id = 'op-fx'; fxRoot.hidden = true;
    grain = el('canvas', 'op-grain'); grain.width = 220; grain.height = 124; grainG = grain.getContext && grain.getContext('2d');
    fxc = el('canvas', 'op-fxc'); fxg = fxc.getContext && fxc.getContext('2d');
    bars = el('div', 'op-bars', '<i></i><i></i>');
    fxRoot.append(el('div', 'op-grade'), fxc, el('div', 'op-vig'), grain, bars); R.append(fxRoot);
    R.append(el('div', '', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="op-rough" x="-5%" y="-8%" width="110%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></svg>'));
    // studio gate + logo
    studio = el('div', 'op-studio', '<div class="op-gate"><div class="op-gcrest">' + crestSVG() + '</div><h1 class="op-wm op-gwm"><span>ASHES</span><span>OF THE WALLS</span></h1><div class="op-kanji op-gk" lang="ja">' + T.stampJp + '</div><p class="op-tap">' + T.tap + '<i lang="ja">' + T.tapJp + '</i></p></div>' +
      '<div class="op-logo"><div class="op-mark">' + hexSVG('m') + '</div><p class="op-name">' + T.studio + '</p><p class="op-pres">' + T.presents + '</p>' +
      '<p class="op-legal"><span class="legal-en"></span><i lang="ja">' + T.legalJp + '</i></p></div>');
    studio.hidden = true; R.append(studio);
    // intro stage (captions, tags, skip) over the 3D world
    stage = el('div', 'op-stage'); stage.hidden = true;
    cap = el('div', 'op-cap', '<p class="jp" lang="ja"></p><p class="en"></p>'); yearEl = el('div', 'op-year', '<b>' + T.year + '</b><i></i><span lang="ja">' + T.placeJp + '</span><small>' + T.place + '</small>');
    skipEl = el('button', 'op-skip', 'Tap to skip'); skipEl.type = 'button'; cutEl = el('div', 'op-cut');
    stage.append(yearEl, cap, skipEl); R.append(stage, cutEl);
    buildTitle();
  };

  /* ---- fx loop: dust motes, steam, speed lines, scout wires, film grain ---- */
  let fxRaf = 0, fxLast = 0, grainT = 0, dust = [];
  FX.fit = () => { const r = fxRoot.getBoundingClientRect(), q = Math.min(1, 1100 / Math.max(1, r.width || 800)), W = Math.max(2, Math.round((r.width || 800) * q)), H = Math.max(2, Math.round((r.height || 400) * q)); FX.q = q; if (fxc.width !== W || fxc.height !== H) { fxc.width = W; fxc.height = H; dust = []; } FX.W = W; FX.H = H; };
  FX.start = () => {
    if (FX.on) return; FX.on = true; root.__lockScale = true; if (root.__E) root.__E.scale = 1; fxRoot.hidden = false; fxLast = performance.now(); FX.fit();
    const tick = now => {
      if (!FX.on) return; const dt = Math.min(0.05, (now - fxLast) / 1000); fxLast = now; FX.t += dt;
      if (fxRoot.clientWidth && fxc.width !== Math.round(fxRoot.clientWidth * Math.min(1, 1100 / fxRoot.clientWidth))) FX.fit();
      const g = fxg, W = FX.W, H = FX.H; if (g) { g.clearRect(0, 0, W, H); for (const f of FX.layers) { try { f(g, W, H, dt, FX.t); } catch (e) { console.warn('[opening] fx', e); } } }
      fxRaf = requestAnimationFrame(tick);
    };
    fxRaf = requestAnimationFrame(tick);
  };
  FX.stop = () => { FX.on = false; root.__lockScale = false; cancelAnimationFrame(fxRaf); if (fxRoot) fxRoot.hidden = true; FX.layers.clear(); };
  /* title mist: soft banks of fog drifting across the town and a few thin hearth-smoke columns that lean with the wind */
  let mistSpr = null, mist = [], smokeCols = [];
  const mistLayer = (g, W, H, dt) => {
    if (!mistSpr) { mistSpr = doc.createElement('canvas'); mistSpr.width = 256; mistSpr.height = 128; const m = mistSpr.getContext('2d'); for (let i = 0; i < 9; i++) { const x = 40 + Math.random() * 176, y = 40 + Math.random() * 48, r = 26 + Math.random() * 34, gr = m.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.34)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); m.fillStyle = gr; m.fillRect(0, 0, 256, 128); } }
    if (!mist.length) { mist = Array.from({ length: 11 }, (_, i) => ({ x: Math.random() * W * 1.3 - W * 0.15, y: H * (0.46 + 0.46 * (i / 10)) + (Math.random() - 0.5) * H * 0.06, w: W * (0.55 + Math.random() * 0.5), v: 5 + Math.random() * 9, a: 0.1 + Math.random() * 0.12, ph: Math.random() * 6.3 })); smokeCols = Array.from({ length: 7 }, () => ({ x: W * (0.12 + Math.random() * 0.8), y: H * (0.68 + Math.random() * 0.24), t: Math.random() * 7 })); }
    g.save(); g.globalCompositeOperation = 'source-over';
    for (const f of mist) { f.x -= f.v * dt * (W / 844); f.ph += dt * 0.25; if (f.x < -f.w) f.x = W + f.w * 0.1; g.globalAlpha = f.a * (0.75 + 0.25 * Math.sin(f.ph)); const h = f.w * 0.5; g.drawImage(mistSpr, f.x, f.y - h * 0.5 + Math.sin(f.ph) * 4, f.w, h); }
    g.fillStyle = 'rgba(205,195,180,1)';
    for (const c of smokeCols) { c.t += dt; if (c.t > 7) { c.t = 0; c.x = W * (0.12 + Math.random() * 0.8); c.y = H * (0.68 + Math.random() * 0.24); }
      for (let k = 0; k < 14; k++) { const q = c.t - k * 0.38; if (q < 0 || q > 6) continue; const u = q / 6, x = c.x + (u * u * 60 + Math.sin(q * 1.3 + c.x) * 3) * (W / 844), y = c.y - u * H * 0.22, r = (1.8 + u * 9) * (W / 844); g.globalAlpha = 0.2 * (1 - u) * Math.min(1, q * 2); g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); } }
    g.restore();
  };
  const dustLayer = (g, W, H, dt) => {                       // slow warm motes lit by the low sun
    if (!dust.length) dust = Array.from({ length: 54 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 2 + Math.random() * 7, r: 0.5 + Math.random() * 1.6, a: Math.random() * 6.3, hot: Math.random() < 0.35 }));
    g.globalCompositeOperation = 'lighter';
    for (const p of dust) {
      p.y -= p.v * dt * 0.6; p.x += (Math.sin(p.a += dt * 0.5) * 5 + 4) * dt; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; } if (p.x > W + 4) p.x = -4;
      g.globalAlpha = (p.hot ? 0.5 : 0.28) * (0.6 + 0.4 * Math.sin(p.a * 2)); g.fillStyle = p.hot ? '#ffb464' : '#f3e6cf'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.3); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  };
  const speedLines = until => (g, W, H) => {                  // radial anime speed lines, flickering on twos
    if (performance.now() > until) return; const n = 64, cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2, ph = Math.floor(performance.now() / 42);
    g.strokeStyle = '#fff'; for (let i = 0; i < n; i++) { const r = Math.sin((i + 1) * 91.7 + ph * 13.1) * 0.5 + 0.5, a = i / n * 6.2832 + r * 0.1, r0 = R * (0.22 + r * 0.3), r1 = R * (0.9 + r * 0.3); g.globalAlpha = 0.25 + r * 0.55; g.lineWidth = 0.6 + r * 2.4; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); }
    g.globalAlpha = 1;
  };
  const steamLayer = (H, x, y, z, until) => { const puffs = []; let acc = 0;   // soft white steam rising from a world point
    return (g, W, Hh, dt) => {
      const now = performance.now(), p = H.project && H.project(x, y, z), live = now < until; acc += dt;
      if (live && p && p.cw > 0 && acc > 0.05) { acc = 0; const sx = (p.cx / p.cw * 0.5 + 0.5) * W, sy = (1 - (p.cy / p.cw * 0.5 + 0.5)) * Hh, sc = clamp(260 / p.cw, 0.5, 3); for (let i = 0; i < 2; i++) puffs.push({ x: sx + (Math.random() - 0.5) * 70 * sc, y: sy + (Math.random() - 0.5) * 12, r: (8 + Math.random() * 16) * sc, vr: 18 + Math.random() * 20, vy: -(8 + Math.random() * 16), a: 0.5 }); }
      g.globalCompositeOperation = 'lighter';
      for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i]; q.r += q.vr * dt; q.y += q.vy * dt; q.a -= dt * 0.22; if (q.a <= 0) { puffs.splice(i, 1); continue; } const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r); gr.addColorStop(0, 'rgba(255,240,225,' + (q.a * 0.55).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,225,0)'); g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 6.3); g.fill(); }
      g.globalCompositeOperation = 'source-over';
    };
  };
  /* ================= fonts ================= */
  OP.fontsReady = () => {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    const want = ['600 24px Cinzel', '800 24px "Grenze Gotisch"', '900 24px "AoW JP"', '500 20px "AoW JP"', 'italic 400 18px Spectral'];
    return Promise.race([Promise.all(want.map(f => doc.fonts.load(f, f.includes('AoW') ? '壁の灰' : 'Ashes').catch(() => 0))), sleep(2600)]);
  };

  /* ================= studio: gate, then the mark ================= */
  OP.gate = function (cb, legal) {                           // black screen, one tap (the tap unlocks audio)
    mountOnce(); UI.hideAll(); studio.hidden = false; studio.className = 'op-studio gate'; studio.querySelector('.legal-en').textContent = legal || '';
    let done = false; const go = () => { if (done) return; done = true; studio.onpointerdown = null; doc.removeEventListener('keydown', onKey); cb(); };
    const onKey = e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); go(); } };
    studio.onpointerdown = go; doc.addEventListener('keydown', onKey);
  };
  OP.studio = async function (run) {
    studio.className = 'op-studio logo'; AU.logoSting();
    const skip = () => { if (performance.now() - t0 > 1200) run.skip(); }, t0 = performance.now(); studio.onpointerdown = skip; void studio.offsetWidth; studio.classList.add('go');
    await run.wait(5600); studio.classList.add('out'); await run.wait(run.dead ? 0 : 900);
    studio.onpointerdown = null; studio.hidden = true; studio.className = 'op-studio';
  };
  const mountOnce = () => { if (!built) OP.mount(); };

  /* ================= the cinematic intro ================= */
  const capShow = (i, big) => { const [jp, en] = T.caps[i]; cap.className = 'op-cap' + (big ? ' big' : ''); cap.querySelector('.jp').textContent = jp; cap.querySelector('.en').textContent = en; void cap.offsetWidth; cap.classList.add('in'); };
  const capHide = () => { cap.classList.add('out'); };
  OP.setBars = mode => { bars.dataset.mode = mode; };
  const debrisLayer = (H, state) => (g, W, Hh, dt) => {      // world-space rubble and dust, projected every frame
    const ps = state.ps; g.lineCap = 'round';
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i]; q.l -= dt; if (q.l <= 0) { ps.splice(i, 1); continue; }
      const px = q.p[0], py = q.p[1], pz = q.p[2]; q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; if (!q.dust) q.v[1] -= 24 * dt; else { q.v[0] *= 0.985; q.v[2] *= 0.985; q.r += q.gr * dt; }
      const a = H.project(q.p[0], q.p[1], q.p[2]); if (!a || a.cw <= 0.5) continue; const sx = (a.cx / a.cw * 0.5 + 0.5) * W, sy = (1 - (a.cy / a.cw * 0.5 + 0.5)) * Hh;
      const b = H.project(q.p[0], q.p[1] + q.r, q.p[2]); const px_r = Math.min(q.dust ? 70 : 16, Math.max(0.6, b ? Math.abs((b.cy / b.cw - a.cy / a.cw) * 0.5 * Hh) : 1));
      if (q.dust) { const al = Math.min(1, q.l / q.l0) * q.a, gr = g.createRadialGradient(sx, sy, 0, sx, sy, px_r); gr.addColorStop(0, 'rgba(206,190,160,' + (al * 0.6).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(206,190,160,0)'); g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, px_r, 0, 6.3); g.fill(); continue; }
      const o = H.project(px, py, pz); if (o && o.cw > 0.5) { const ox = (o.cx / o.cw * 0.5 + 0.5) * W, oy = (1 - (o.cy / o.cw * 0.5 + 0.5)) * Hh; g.strokeStyle = 'rgba(225,208,176,.22)'; g.lineWidth = Math.max(0.6, px_r * 0.5); g.beginPath(); g.moveTo(ox, oy); g.lineTo(sx, sy); g.stroke(); }
      q.rot += q.spin * dt; const c = Math.cos(q.rot) * px_r, sn = Math.sin(q.rot) * px_r;
      g.fillStyle = q.col; g.beginPath(); g.moveTo(sx - c, sy - sn); g.lineTo(sx + sn * 0.8, sy - c * 0.8); g.lineTo(sx + c, sy + sn); g.lineTo(sx - sn * 0.6, sy + c * 0.6); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,236,200,.35)'; g.lineWidth = 0.6; g.stroke();
    }
  };
  const burst = (state, c, n, spread, up, big, dust) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = Math.random() * spread;
      state.ps.push({ p: [c[0] + (Math.random() - 0.5) * 10, c[1] + Math.random() * 2, c[2] + (Math.random() - 0.5) * 6], v: [Math.cos(a) * sp * 0.5, up * (0.2 + Math.random()), Math.sin(a) * sp * 0.6 - sp * 0.35], r: big * (0.25 + Math.random() * 0.9), l: 3.4 + Math.random() * 2, l0: 5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 9, col: ['#6f665a', '#857a69', '#5a5249', '#9a8d76'][i % 4] });
    }
    for (let i = 0; i < dust; i++) { const a = Math.random() * 6.283; state.ps.push({ dust: 1, p: [c[0] + (Math.random() - 0.5) * 14, c[1] + Math.random() * 3, c[2] + (Math.random() - 0.5) * 8], v: [Math.cos(a) * 3, 2 + Math.random() * 3, Math.sin(a) * 3 - 3], r: 1.5 + Math.random() * 2, gr: 2 + Math.random() * 3, l: 2.5 + Math.random() * 2, l0: 4.5, a: 0.55 }); }
  };
  OP.intro = async function (run, H) {
    mountOnce(); UI.hideAll(); stage.hidden = false; stage.className = 'op-stage'; cutEl.className = 'op-cut on'; UI.fade.style.transitionDuration = '0s'; UI.fade.classList.remove('on'); OP.setBars('wide'); FX.start(); FX.layers.add(dustLayer);
    const has3D = !!H.has3D, TOTAL = TL.end * 1000, A = root.__actors, FXM = S.fx, R = Math.random;
    const g = has3D && H.geo ? H.geo() : { x0: -60, front: -20, back: 4, top: 50 };
    const hasFx = !!(FXM && has3D && H.project), ckey = A && A.has('colossal2') && OP.useC2 !== false ? 'colossal2' : 'colossal';
    let col = null, shot = '', cam = null, curT = 0; OP.clipMode = ckey === 'colossal2';
    const rub = { ps: [] }, wallMid = (g.front + g.back) / 2, handY = g.top + 1, hands = [[g.x0 - 9, handY, wallMid], [g.x0 + 9, handY, wallMid]];
    const CH = K.height, tz = wallMid + K.tzOff, gy = has3D ? H.gh(g.x0, tz) : 0, ballC = [g.x0, g.top + K.ballUp, tz], faceY = () => 0.93 * CH + OP.colossalState(curT).lift + gy;
    const puffs = hasFx ? FXM.puffs(H) : null, bolts = hasFx ? FXM.bolts(H) : null, plasma = hasFx ? FXM.plasma(H) : null, shocks = hasFx ? FXM.shocks(H) : null, flashes = hasFx ? FXM.flashes() : null, rays = hasFx ? FXM.rays(H) : null, storm = hasFx ? FXM.storm() : null;
    if (storm) storm.get = () => ({ a: 0.8 * (1 - kk(curT, 2.4, 4.4)) * kk(curT, 0, 0.6) + 0.1, warm: 0.9 * kk(curT, TL.strike + 0.2, TL.strike + 1.2) * (1 - 0.6 * kk(curT, 6, 9)) });
    if (has3D) {                                             // set the scene while the screen is still black
      S.actors.clearAll(); H.setHour(5.4); const c0 = OP.camAt(0, g); H.teleport(c0.pos[0], c0.pos[2]); H.cineOn(c0.pos, c0.target, c0.fov);
      if (A.has(ckey)) {
        const sc = S.actors.scaleFor ? S.actors.scaleFor(S.actors.bodyH ? S.actors.bodyH(ckey) : 5.254375, CH) : CH / 5.254375;
        col = A.add({ key: ckey, kind: 'titan', x: g.x0, z: tz, yaw: Math.PI, scale: sc, idle: ckey === 'colossal2' ? 'C2:idle' : 'T:Zombie Idle', clipT: 0.4, vg: gy + K.liftHide, poseFn: ckey === 'colossal2' ? undefined : (pz, a, M) => { OP.cpose(pz, a.reach || 0, a.lean || 0, a.head || 0, a.grip || 0, a.press || 0, a.reachR); try { OP.armIK(M, a, pz); } catch (e) { } OP.hands(M, a); } }); col._base = gy; col.hidden = true; col.geo = g;
      }
      FX.layers.add(debrisLayer(H, rub));
    }
    /* ---- the effects simulation: stepped from the timeline so a replay or a scrub looks identical ---- */
    let simT = 0; const acc = { fog: 0, fire: 0, smoke: 0, wall: 0, skin: 0, emb: 0 };
    const every = (k, rate, dt, fn) => { acc[k] += dt; const iv = 1 / rate; while (acc[k] > iv) { acc[k] -= iv; fn(); } };
    const emit = (t, dt) => {
      every('fog', 9, dt, () => puffs.add({ kind: 'dust', p: [g.x0 + (R() - 0.5) * 140, gy + 2, g.front - 6 - R() * 40], v: [3 + R() * 3, 0.3, 0.5], r: 9, gr: 2.2, l: 7, a: 0.3, fade: 0.35 }));
      if (t >= TL.strike && t < TL.strike + 1.1) every('fire', 40, dt, () => puffs.add({ kind: 'fire', p: [g.x0 + (R() - 0.5) * 8, gy + R() * 6, tz + (R() - 0.5) * 8], v: [(R() - 0.5) * 14, 30 + R() * 40, (R() - 0.5) * 14], r: 4 + R() * 4, gr: 10, l: 1.1 + R() * 0.7, a: 0.5, drag: 0.35, fade: 0.3 }));
      if (t >= TL.strike + 0.15 && t < TL.strike + 5) every('smoke', 30, dt, () => puffs.add({ kind: 'smoke', p: [g.x0 + (R() - 0.5) * 12, gy + R() * 12, tz + (R() - 0.5) * 10], v: [(R() - 0.5) * 9, 16 + R() * 16, (R() - 0.5) * 9], r: 7, gr: 7, l: 5.5, a: 0.85, drag: 0.55, fade: 0.3 }));
      if (t >= TL.grab - 0.2) every('wall', 6, dt, () => puffs.add({ kind: 'steam', p: [g.x0 + (R() - 0.5) * 90, g.top - 1, wallMid + (R() - 0.5) * 10], v: [0, 6 + R() * 4, -1], r: 2, gr: 1.6, l: 4.5, a: 0.3 }));
      if (t >= TL.headUp - 0.3) every('skin', 22, dt, () => puffs.add({ kind: 'steam', p: [g.x0 + (R() - 0.5) * 26, faceY() - 8 + R() * 12, tz + (R() - 0.5) * 8], v: [0, 5 + R() * 6, -R() * 3], r: 2, gr: 2.2, l: 3.5, a: 0.22 }));
      if (t >= TL.strike && t < TL.strike + 0.6) every('emb', 120, dt, () => puffs.add({ kind: 'ember', p: [g.x0 + (R() - 0.5) * 10, gy + 2 + R() * 6, tz + (R() - 0.5) * 8], v: [(R() - 0.5) * 50, 20 + R() * 50, (R() - 0.5) * 50], r: 1.3, gr: 0, l: 2.5 + R() * 2, a: 1, drag: 0.6, grav: -14 }));
    };
    const step = t => { let n = 0; while (simT < t - 1e-4 && n++ < 240) { const dt = Math.min(1 / 30, t - simT); simT += dt; emit(simT, dt); puffs.update(dt); } bolts.update(t); plasma.update(t); shocks.update(t); flashes.update(t); rays.update(t); };
    const occ = p => { if (!cam || p[2] <= g.front || cam.pos[2] >= g.front) return 1; const s = (g.front - cam.pos[2]) / (p[2] - cam.pos[2]), y = cam.pos[1] + (p[1] - cam.pos[1]) * s; return clamp((y - (g.top - 3)) / 4, 0, 1); };   // smoke behind the wall is hidden by it
    if (hasFx) FX.layers.add((gx, W, Hh) => {
      step(curT); storm.draw(gx, W, Hh); rays.draw(gx, W, Hh); puffs.draw(gx, W, Hh, occ);
      gx.save(); if (curT < TL.strike + 0.4 && cam) { const wp = FXM.toScreen(H, W, Hh, g.x0, g.top, g.front); if (wp) { gx.beginPath(); gx.rect(0, 0, W, Math.max(0, wp.y)); gx.clip(); } }   // the strike lives above the wall line
      shocks.draw(gx, W, Hh); plasma.draw(gx, W, Hh); bolts.draw(gx, W, Hh); gx.restore(); flashes.draw(gx, W, Hh);
    });
    await run.wait(60);
    if (run.dead) return cleanup();
    stage.classList.add('on'); cutEl.classList.add('slow'); cutEl.classList.remove('on'); setTimeout(() => cutEl.classList.remove('slow'), 1600);   // fade up from black
    AU.wind(0.1); AU.introScore(TL); const t0 = performance.now();
    const fired = {}, at = (s, key, fn) => { if (!fired[key] && T_ >= s * 1000) { fired[key] = 1; try { fn(); } catch (e) { console.warn('[opening] event', key, e); } } };
    let T_ = 0, pebT = 0;
    const sky = (t0s, a, b) => hasFx && bolts.strike({ a, b, t0: t0s, dur: 0.4, w: 1.6, forks: 3 });
    await new Promise(done => {
      const loop = now => {
        if (run.dead) return done(); T_ = root.__opT != null ? root.__opT * 1000 : now - t0; const t = T_ / 1000; curT = t;
        if (T_ >= TOTAL) return done();
        if (has3D) {
          const c = OP.camAt(t, g), tr = OP.trauma(t), sh = tr * tr * 1.3, n = t * 31; cam = c;
          H.cineOn([c.pos[0] + Math.sin(n) * sh, c.pos[1] + Math.sin(n * 1.7 + 1) * sh, c.pos[2] + Math.sin(n * 1.3 + 2) * sh * 0.5], [c.target[0] + Math.sin(n * 1.9) * sh * 1.5, c.target[1] + Math.sin(n * 2.3 + 1) * sh * 1.5, c.target[2]], c.fov);
          if (t > OP.shotC - 0.6 && t < OP.shotC) cutEl.classList.add('dip'); else if (cutEl.classList.contains('dip')) { cutEl.classList.add('slow'); cutEl.classList.remove('dip'); setTimeout(() => cutEl.classList.remove('slow'), 1000); } shot = c.shot;
          if (col) { const st = OP.colossalState(t); col.reach = st.reach; col.reachR = st.reachR; col.lean = st.lean; col.head = st.head; col.grip = st.grip; col.gripR = st.gripR; if (ckey === 'colossal2') { const c = OP.c2clip(t); col.idle = c.name; col.clipT = c.t; col.roarW = 0; } col.press = st.press; col.vg = col._base + st.lift; col.hidden = !st.show; }
          if (t > TL.rumble && t < TL.strike - 0.2 && t - pebT > 0.22) { pebT = t; burst(rub, [g.x0 + (R() - 0.5) * 80, g.top, g.front - 1], 2, 5, 3, 0.22, 0); }
        }
        // ---- the beats ----
        at(0.3, 'cap1', () => capShow(0)); at(TL.ball - 0.2, 'cap1h', capHide);
        at(TL.rumble, 'rum', () => { AU.rumble(TL.strike - TL.rumble + 0.5, 0.8); AU.gust(2.5); UI.shake(1100); });
        at(1.3, 'sh1', () => { if (hasFx) flashes.add({ peak: 0.24, dur: 0.4, col: [170, 200, 255], hold: 0.15 }); AU.thunder && AU.thunder(0.5); });
        at(1.35, 'sk1', () => sky(1.35, [g.x0 - 70, g.top + 90, tz + 120], [g.x0 - 45, g.top + 40, tz + 70]));
        at(TL.ball, 'ball', () => { if (hasFx) plasma.set(ballC, 17, TL.ball, TL.strike); AU.plasmaCharge && AU.plasmaCharge(TL.strike - TL.ball); capShow(2); });
        at(2.9, 'sh2', () => { if (hasFx) flashes.add({ peak: 0.32, dur: 0.35, col: [190, 214, 255], hold: 0.12 }); AU.thunder && AU.thunder(0.7); });
        at(3.0, 'sk2', () => sky(3.0, [g.x0 + 60, g.top + 100, tz + 90], [g.x0 + 20, g.top + 36, tz + 40]));
        at(TL.strike - 0.85, 'ld1', () => hasFx && bolts.strike({ a: [g.x0 - 40, g.top + 120, tz + 30], b: ballC, t0: TL.strike - 0.85, dur: 0.35, w: 2.2, forks: 4 }));
        at(TL.strike - 0.4, 'ld2', () => { if (hasFx) { bolts.strike({ a: [g.x0 + 50, g.top + 120, tz + 20], b: ballC, t0: TL.strike - 0.4, dur: 0.35, w: 2.6, forks: 4 }); flashes.add({ peak: 0.4, dur: 0.3, col: [255, 226, 160], hold: 0.1 }); } AU.thunder && AU.thunder(0.9); });
        at(TL.strike - 0.15, 'cap2h', capHide);
        at(TL.strike, 'strike', () => {
          if (hasFx) {
            bolts.strike({ a: [g.x0 + 6, g.top + 170, tz + 10], b: [g.x0, gy, tz], t0: TL.strike, dur: 0.7, w: 5.5, forks: 8 }); plasma.off();
            flashes.add({ peak: 1, dur: 1.15, hold: 0.28 }); shocks.add({ c: [g.x0, gy + 1, tz], v: 150, life: 1.8 }); rays.set([g.x0, gy + 30, tz], TL.strike, 1.6, 1);
            puffs.burst('steam', [g.x0, g.top - 6, tz], 36, { speed: 30, up: 6, r: 6, gr: 6, l: 4.5, a: 0.6, spread: [50, 10, 10], fz: 0.3, vz: 6 });
            puffs.burst('dust', [g.x0, gy + 3, tz], 30, { speed: 40, fz: 0.4, up: 3, r: 10, gr: 6, l: 5, a: 0.8, spread: [30, 2, 30] });
            puffs.burst('ember', [g.x0, gy + 4, tz], 70, { speed: 25, up: 40, r: 1.4, gr: 0, l: 3.5, a: 1, drag: 0.7, grav: -14, spread: [8, 4, 8] });
          }
          AU.boom(1.3); AU.thunder && AU.thunder(1.2, true); AU.debris(3.8, 0.6); UI.shake(1800); if (has3D) for (let i = 0; i < 3; i++) burst(rub, [g.x0 + (i - 1) * 24, g.top, g.front - 1], 8, 16, 18, 0.5, 3);
        });
        at(TL.strike + 0.9, 'cap3', () => capShow(1, true)); at(TL.grab - 0.1, 'cap3h', capHide);
        at(TL.grab - 0.08, 'slam', () => { AU.stoneCrack(); AU.boom(1.1); AU.debris(3.2, 0.6); AU.steam(3.4); UI.shake(1500); if (has3D) { burst(rub, hands[0], 16, 20, 22, 0.55, 7); if (hasFx) { flashes.add({ peak: 0.25, dur: 0.2 }); puffs.burst('dust', hands[0], 10, { speed: 10, up: 6, r: 2.5, gr: 2.5, l: 3, a: 0.45, spread: [4, 2, 4] }); } } });
        at(TL.grab + 0.9, 'slam2', () => { AU.thud(1.2); if (has3D) { burst(rub, hands[1], 10, 14, 16, 0.5, 5); if (hasFx) puffs.burst('dust', hands[1], 8, { speed: 10, up: 6, r: 2.5, gr: 2.5, l: 3, a: 0.45, spread: [4, 2, 4] }); } });
        at(TL.headUp, 'head', () => { AU.rumble(2.2, 0.55); AU.steam(2.8); UI.shake(1500); });
        at(TL.reveal, 'reveal', () => {
          AU.lightning(); AU.titanRoar(3.2); UI.shake(1800);
          if (hasFx) { flashes.add({ peak: 0.55, dur: 0.5 }); sky(TL.reveal, [g.x0 - 20, g.top + 120, tz + 60], [g.x0 - 10, faceY() + 14, tz + 10]); puffs.burst('steam', [g.x0, faceY() - 3, tz - 6], 30, { speed: 10, up: 3, vz: -24, r: 3, gr: 4, l: 2.5, a: 0.4, spread: [4, 3, 3] }); for (let i = 0; i < 4; i++) bolts.strike({ a: [g.x0 + (R() - 0.5) * 24, faceY() - 6 + R() * 10, tz - 4], b: [g.x0 + (R() - 0.5) * 40, faceY() - 14 + R() * 20, tz - 8], t0: TL.reveal + 0.1 + i * 0.07, dur: 0.18, w: 0.9, forks: 1 }); }
        });
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    // the impact frame, then a hard cut to black and one heartbeat of silence
    if (!run.dead) { doc.body.classList.add('op-invert'); setTimeout(() => doc.body.classList.remove('op-invert'), 96); UI.flash(260); UI.shake(1300); FX.layers.add(speedLines(performance.now() + 560)); await run.wait(140); }
    cutEl.classList.add('on'); cleanup(true); AU.wind(0); AU.stopMusic();
    if (!run.dead) { AU.heartbeat(); await run.wait(620); }
    function cleanup() { FX.layers.forEach(f => { if (f !== dustLayer) FX.layers.delete(f); }); if (col && A) A.remove(col.id); col = null; rub.ps.length = 0; stage.hidden = true; cap.className = 'op-cap'; }
    return run.dead ? 'skipped' : 'done';
  };

  /* ================= title: stamp, dock, menu ================= */
  function buildTitle() {
    const old = doc.getElementById('sv-title'); if (old) old.remove();
    titleEl = UI.addScreen('title', 'sv-title op-title', '');
    titleEl.dataset.state = 'docked';
    const shade = el('div', 'op-shade'), cover = el('div', 'op-cover');
    lockEl = el('div', 'op-lock', '<h1 class="op-wm"><span>ASHES</span><span>OF THE WALLS</span></h1><div class="op-kanji" lang="ja">' + T.stampJp + '</div><div class="op-rule"><i></i></div><p class="op-sub"><span lang="ja">' + T.subJp + '</span></p><p class="op-tag">' + T.tagline + '</p>');
    menuEl = el('nav', 'op-menu'); menuEl.setAttribute('aria-label', 'Main menu');
    T.menu.forEach((m, i) => {
      const b = el('button', 'op-item' + (m.locked ? ' locked' : ''), '<span class="op-slash"></span><span class="op-en">' + m.en + '</span><span class="op-jp" lang="ja">' + m.jp + '</span><small></small>');
      b.type = 'button'; b.dataset.act = m.act; b.style.setProperty('--i', i); if (m.locked) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('pointerenter', () => select(i, true)); b.addEventListener('focus', () => select(i, false)); b.addEventListener('click', () => activate(i)); menuEl.append(b);
    });
    descEl = el('aside', 'op-desc', '<b></b><span></span>');
    creditEl = el('p', 'op-credit'); verEl = el('span', 'op-ver'); const cb = el('button', 'op-cbtn', 'Credits<i lang="ja">制作</i>'); cb.type = 'button'; cb.onclick = () => UI._cb('credits');
    bandEl = el('footer', 'op-band', ''); const legal = el('p', 'op-fine'); bandEl.append(verEl, cb); bandEl._legal = legal;   // the credit lines and the legal text live in the Credits scene, not on the title
    titleEl.append(cover, shade, lockEl, menuEl, descEl, bandEl); titleEl._cover = cover; titleEl.hidden = true;
  }
  let sel = 0, titleLive = false;
  function items() { return [...menuEl.querySelectorAll('.op-item')]; }
  function select(i, byPointer) {
    const its = items(); if (i < 0 || i >= its.length || (i === sel && its[i].classList.contains('sel'))) return; if (its[i].hidden) return;
    sel = i; its.forEach((b, k) => { b.classList.toggle('sel', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    const m = T.menu[i], d = descEl; d.classList.remove('in'); void d.offsetWidth; d.querySelector('b').textContent = m.en; d.querySelector('span').textContent = m.act === 'continue' && its[i]._info ? its[i]._info : m.desc; d.classList.add('in');
    if (titleLive) { if (m.act === 'new') UI._cb('hoverBegin'); else AU.menuTick && AU.menuTick(); }
    if (!byPointer && its[i] !== doc.activeElement) its[i].focus({ preventScroll: true });
  }
  function activate(i) { const m = T.menu[i], b = items()[i]; if (!m || !titleLive) return; if (b.hidden) return; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); if (m.locked) return UI._cb('locked'); if (m.act === 'continue' && b.classList.contains('empty')) return UI.toast('No saved file yet.'); UI._cb(m.act); }
  doc.addEventListener('keydown', e => {
    if (!titleLive || !titleEl || titleEl.hidden || (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName))) return;
    const n = items().length; if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); select((sel + 1) % n); } else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); select((sel + n - 1) % n); } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); activate(sel); }
  });
  OP.ticker = function () { clearInterval(OP._iv); };           // the credit lines moved to the Credits scene; kept so main.js can still call it
  OP.fill = function (info) {                                // menu labels that depend on saves and version
    const its = items(), cont = its.find(b => b.dataset.act === 'continue'), fmt = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
    const lt = info && info.latest; cont.classList.toggle('empty', !lt); cont.querySelector('small').textContent = lt ? [lt.name, lt.quest || 'Prologue', fmt(lt.playSec)].filter(Boolean).join(', ') : 'No saved file';
    cont._info = lt ? 'Continue as ' + [lt.name, lt.quest || 'Prologue', fmt(lt.playSec)].filter(Boolean).join(', ') + '.' : 'No saved file yet.';
    verEl.textContent = 'v' + ((info && info.version) || '') + ' · prototype'; bandEl._legal.textContent = (S.data && S.data.credits ? S.data.credits.disclaimer + ' ' : '') + T.byline + '.';
  };

  // The title screen shown from the stamp onward. fromStamp: it is already on a black screen with the lockup centred.
  OP.showTitle = function (info, o) {
    mountOnce(); o = o || {}; UI.hideAll(); OP.fill(info); titleLive = false; titleEl.hidden = false; UI.show('title'); FX.start(); FX.layers.add(mistLayer); FX.layers.add(dustLayer); OP.setBars('title');
    titleEl.classList.remove('shown', 'slam', 'flip'); titleEl.dataset.state = o.stamp ? 'stamp' : 'docked'; titleEl._cover.style.transition = 'none'; titleEl._cover.style.opacity = o.stamp ? '1' : '0';
    items().forEach(b => b.classList.remove('sel')); sel = -1; menuEl.querySelector('.op-item[data-act="continue"]').hidden = false;
  };
  OP.stamp = async function (run) {                          // the title card slams in on black
    titleEl.classList.add('slam'); UI.flash(300); UI.shake(900); AU.stampHit(); AU.music('title'); AU.wind(0.05);
    const em = []; FX.layers.add((g, W, H, dt, t) => { if (!em.length && t) for (let i = 0; i < 46; i++) em.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H * 0.55 + (Math.random() - 0.5) * H * 0.2, vx: (Math.random() - 0.5) * 60, vy: -(20 + Math.random() * 60), r: 0.6 + Math.random() * 1.8, l: 1 + Math.random() * 1.6 }); g.globalCompositeOperation = 'lighter'; for (const p of em) { p.l -= dt; if (p.l <= 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; g.globalAlpha = clamp(p.l, 0, 1) * 0.8; g.fillStyle = '#ff9a45'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.3); g.fill(); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; });
    await run.wait(3300);
  };
  OP.dock = async function (run) {                           // lockup glides to its place, the black lifts, the menu rises
    const first = lockEl.getBoundingClientRect(); titleEl.dataset.state = 'docked'; const last = lockEl.getBoundingClientRect();
    const sx = first.width / Math.max(1, last.width), sy = first.height / Math.max(1, last.height), dx = first.left - last.left, dy = first.top - last.top;
    lockEl.style.transition = 'none'; lockEl.style.transformOrigin = '0 0'; lockEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')'; void lockEl.offsetWidth;
    const ms = run.dead ? 250 : 1500; lockEl.style.transition = 'transform ' + ms + 'ms cubic-bezier(.65,0,.2,1)'; lockEl.style.transform = 'none';
    titleEl._cover.style.transition = 'opacity ' + (ms + 500) + 'ms ease'; titleEl._cover.style.opacity = '0'; titleEl.classList.add('shown');
    FX.layers.forEach(f => { if (f !== dustLayer && f !== mistLayer) FX.layers.delete(f); });
    await sleep(ms + (run.dead ? 150 : 1100)); lockEl.style.transition = lockEl.style.transform = lockEl.style.transformOrigin = ''; titleLive = true; select(0);
  };
  OP.titleIn = async function () {                           // returning from the game: no stamp, just fade the menu in
    titleEl.classList.add('shown'); await sleep(900); titleLive = true; select(0);
  };
  OP.hideTitle = () => { titleLive = false; };

  /* ================= leaving ================= */
  OP.exitCard = async function () {
    titleLive = false; titleEl._cover.style.transition = 'opacity 1.2s ease'; titleEl._cover.style.opacity = '1'; AU.duck && AU.duck(0.05, 1.8); await sleep(1300);
    const c = el('div', 'op-bye', '<p lang="ja">' + T.bye[0] + '</p><p>' + T.bye[1] + '</p>'); UI.R.append(c); void c.offsetWidth; c.classList.add('in'); await sleep(3600); c.classList.remove('in'); await sleep(900); c.remove();
    AU.duck && AU.duck(1, 0.2); titleEl.hidden = true; titleEl.classList.remove('shown'); FX.stop();
  };

  /* ================= the whole opening, in order ================= */
  OP.runOpening = async function (H) {
    mountOnce(); FX.stop();
    OP.fontsReady();                                         // start loading fonts while the player reads "tap"
    const legal = (S.data && S.data.credits && S.data.credits.disclaimer) || '';
    OP.gate(async () => {
      AU.unlock(); AU.wind(0); const run = OP.newRun(), ensured = H.ensure(); const key = e => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') run.skip(); };
      OP.run = run; doc.addEventListener('keydown', key);
      try {
        await Promise.race([OP.fontsReady(), sleep(2800)]);
        await OP.studio(run); const skippedLogo = run.dead;
        // a skip in the logo only skips the logo: the cinematic still plays
        const run2 = OP.newRun(); OP.run = run2; const k2 = e => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') run2.skip(); };
        doc.removeEventListener('keydown', key); doc.addEventListener('keydown', k2); await ensured;
        FX.start();
        skipEl.onclick = () => run2.skip(); stage.onpointerdown = () => { if (performance.now() > 1400 + t0i) run2.skip(); }; const t0i = performance.now();
        const r = await OP.intro(run2, H); stage.onpointerdown = null; doc.removeEventListener('keydown', k2);
        await H.prepTitle(); OP.showTitle(H.info(), { stamp: true }); cutEl.classList.remove('on'); UI.fade.classList.remove('on');
        const run3 = OP.newRun(); const k3 = e => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') run3.skip(); }; doc.addEventListener('keydown', k3); titleEl.onpointerdown = () => run3.skip();
        if (r !== 'skipped') await OP.stamp(run3); else AU.music('title');
        titleEl.onpointerdown = null; doc.removeEventListener('keydown', k3); await OP.dock(run3); stage.hidden = true;
      } catch (e) { console.error('[opening] failed, going straight to the title', e); try { await H.prepTitle(); OP.showTitle(H.info()); await OP.titleIn(); } catch (e2) {} }
    }, legal);
  };

  /* ---- hooks into the existing UI ---- */
  const mountOld = UI.mount; UI.mount = function () { mountOld.apply(this, arguments); OP.mount(); };
  UI.setTicker = lines => OP.ticker(lines);
  UI.title = function (info) { OP.showTitle(info, {}); return OP.titleIn(); };
  UI.splash.gate = (cb, legal) => OP.gate(cb, legal);
  const hideOld = UI.hideAll; UI.hideAll = function () { hideOld.apply(this, arguments); const st = S.fsm && S.fsm.state; if (st && st !== 'title' && st !== 'intro') { titleLive = false; FX.stop(); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = OP;
})(typeof window !== 'undefined' ? window : globalThis);

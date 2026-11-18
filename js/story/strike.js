/* Ashes of the Walls — CREATOR OPENING: "the strike" (v2, cinematic rebuild).
   One clock drives everything, so the opening can be skipped, replayed and unit-tested:
     0.0  fade in on a very wide shot of the Shiganshina stage under a storm (slow push-in, bars, location card)
     1.2  sheet lightning in the clouds, rolling thunder, the light turns green-gold and heavy
     3.35 a thin "calling" bolt touches down on the stage
     4.7  THE STRIKE: a huge golden anime bolt from the clouds; the character falls inside it (motion-captured "Jumping Down"),
          the camera tilts down and tracks him all the way
     6.7  impact: hit-stop, white-out, ground shock rings, debris, speed lines, a wall of fog
     8.1  he rises out of the crouch (motion-captured "Crouch To Stand") as a black silhouette in the fog, backlit by after-flickers
     11.95 he walks to the camera in his underclothes while the fog thins; a flash and the sun breaking reveal him
     15.25 the camera settles into the close-up the studio opens on; the menus slide in
   S.strike.create(env) -> { active, update(dt) -> camera, draw(ctx, W, H), skip(), t }
   env: actor(), stage {x,z,gy,yaw}, audio, bodyHeight(key), showUI(), done(handoff), cast(o,d,max) (optional, keeps the camera out of buildings), gh(x,z) (optional)  */
(function (root) {
  'use strict';
  const S = root.STORY || (root.STORY = {}), K = {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3), fract = x => x - Math.floor(x);
  /* the timeline, seconds */
  const TM = { flick1: 1.25, flick2: 2.2, call: 3.35, strike: 4.7, fallLen: 2.0, land: 6.7, jdEnd: 8.14, standEnd: 11.51, flash2: 12.55, walk: 11.95, walkLen: 3.3, close: 15.25, ui: 15.7, end: 16.6 };
  TM.stand = TM.jdEnd; K.TM = TM;
  /* camera keyframes. dist and h are in 'hs' units (1 hs = 1/1.649 of the character's height, the creator's own unit); az is added to the stage yaw */
  const KF = [                                                                                  // centred on the stage axis (az .35 = the way he faces): looks up into the storm first, tips down with the bolt, then a slow push-in for the reveal and a pull back to the studio framing
    { t: 0.00, dist: 30, h: 19, el: -0.60, fov: 0.95, az: 0.35 },
    { t: 3.35, dist: 28, h: 15, el: -0.46, fov: 0.92, az: 0.35 },
    { t: 4.70, dist: 26, h: 11, el: -0.30, fov: 0.90, az: 0.35 },
    { t: 5.70, dist: 19, h: 4.2, el: -0.12, fov: 0.84, az: 0.35 },
    { t: 6.70, dist: 12, h: 1.5, el: -0.04, fov: 0.78, az: 0.33 },
    { t: 7.40, dist: 9.6, h: 1.05, el: -0.07, fov: 0.74, az: 0.30 },
    { t: 9.20, dist: 8.8, h: 1.0, el: -0.07, fov: 0.72, az: 0.30 },
    { t: 11.5, dist: 8.4, h: 1.05, el: -0.04, fov: 0.72, az: 0.30 },
    { t: 13.2, dist: 7.0, h: 1.1, el: -0.03, fov: 0.70, az: 0.30 },
    { t: 14.6, dist: 4.7, h: 1.3, el: -0.02, fov: 0.58, az: 0.28 },
    { t: 16.6, dist: 3.3, h: 1.2, el: -0.03, fov: 0.80, az: 0.26 }];
  const PR = ['dist', 'h', 'el', 'fov', 'az'];
  /* a cubic Hermite through the keys with finite-difference tangents: no stop-start at the keys, a soft ease at both ends */
  const kf = t => {
    t = clamp(t, 0, KF[KF.length - 1].t); let i = 0; while (i < KF.length - 2 && t > KF[i + 1].t) i++;
    const a = KF[i], b = KF[i + 1], h = b.t - a.t, s = (t - a.t) / h, s2 = s * s, s3 = s2 * s, o = {};
    for (const p of PR) {
      const tg = j => { if (j <= 0 || j >= KF.length - 1) return 0; return (KF[j + 1][p] - KF[j - 1][p]) / (KF[j + 1].t - KF[j - 1].t) * 0.8; };
      o[p] = (2 * s3 - 3 * s2 + 1) * a[p] + (s3 - 2 * s2 + s) * h * tg(i) + (-2 * s3 + 3 * s2) * b[p] + (s3 - s2) * h * tg(i + 1);
    }
    return o;
  };
  const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len: a => Math.hypot(a[0], a[1], a[2]), norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
  K.kf = kf;
  /* ---- the bolt: jagged midpoint displacement in 3D (stored as offsets from the straight line so the lower end can follow the falling character), with forks ---- */
  function makeBolt(rnd, p0, p1, o) {
    o = o || {}; const L0 = v3.len(v3.sub(p1, p0)), ax = v3.norm(v3.sub(p1, p0)), side = v3.norm(v3.cross(ax, [0.31, 0.12, 0.94])), up2 = v3.cross(ax, side);
    let pts = [[0, 0, 0], [1, 0, 0]];                                                             // [s along, offset side, offset up] with s in 0..1, offsets in units of L0
    for (let d = 0, off = (o.jag || 0.15); d < (o.depth || 7); d++, off *= 0.56) {
      const out = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], bias = d < 2 ? 1.4 : 1; out.push([(a[0] + b[0]) / 2 + (rnd() - 0.5) * off * 0.08, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 2 * off * 0.5 * bias, (a[2] + b[2]) / 2 + (rnd() - 0.5) * 2 * off * 0.5 * bias], b); }
      pts = out; }
    pts[0] = [0, 0, 0]; pts[pts.length - 1] = [1, 0, 0]; const br = [];
    const fork = (i0, len, ang, depth) => {                                                      // a fork leaves the trunk and wanders downwards
      const seg = [i0]; let p = i0.slice(), dir = [Math.cos(ang), Math.sin(ang) * 0.6 + 0.4, Math.sin(ang)]; const n = 10;
      for (let s = 0; s < n; s++) { dir = v3.norm([dir[0] + (rnd() - 0.5) * 0.9, dir[1] + (rnd() - 0.5) * 0.5 + 0.12, dir[2] + (rnd() - 0.5) * 0.9]); p = [p[0] + dir[0] * len / n * 0.5, p[1] + dir[1] * len / n, p[2] + dir[2] * len / n]; seg.push(p.slice());
        if (depth > 0 && s > 2 && rnd() < 0.2) fork(p, len * 0.45, ang + (rnd() - 0.5) * 2.2, depth - 1); }
      br.push({ seg, depth });
    };
    const nf = o.forks === undefined ? 7 : o.forks;
    for (let k = 0; k < nf; k++) { const i = 10 + Math.floor(rnd() * (pts.length - 22)); const a = pts[i]; fork([a[0], a[1], a[2]], (0.06 + rnd() * 0.14), (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 1.2), 1); }
    return { pts, br, L0, ax, side, up2, p0 };
  }
  /* world position of a stored bolt point for the current endpoints (offsets are scaled with the current length so the shape stays put while the end moves) */
  function boltPt(b, p0, p1, q) {
    const L = v3.len(v3.sub(p1, p0)) || 1, ax = v3.norm(v3.sub(p1, p0)), sd = v3.norm(v3.cross(ax, [0.31, 0.12, 0.94])), up = v3.cross(ax, sd);
    return [p0[0] + ax[0] * q[0] * L + sd[0] * q[1] * L + up[0] * q[2] * L, p0[1] + ax[1] * q[0] * L + sd[1] * q[1] * L + up[1] * q[2] * L, p0[2] + ax[2] * q[0] * L + sd[2] * q[1] * L + up[2] * q[2] * L];
  }
  /* bolt brightness after it starts: a hard first stroke, a dark gap, a second stroke, a third weaker one, then an ember glow */
  const BI = [[0, 0], [0.012, 1], [0.1, 1], [0.13, 0.15], [0.19, 0.1], [0.21, 1], [0.34, 0.95], [0.38, 0.25], [0.46, 0.18], [0.48, 0.8], [0.66, 0.55], [0.8, 0.25], [1.2, 0]];
  const inten = s => { if (s <= 0) return 0; for (let i = 1; i < BI.length; i++) if (s < BI[i][0]) return lerp(BI[i - 1][1], BI[i][1], (s - BI[i - 1][0]) / (BI[i][0] - BI[i - 1][0])); return 0; };
  /* ---- soft fog sprites (two variants of layered lobes) ---- */
  function fogSprites(doc) {
    if (!doc || !doc.createElement) return null; const out = [];
    for (let v = 0; v < 2; v++) {
      const c = doc.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'); if (!x) return null; const r = rng(77 + v * 31);
      for (let i = 0; i < 13; i++) { const px = 80 + (r() - 0.5) * 82, py = 80 + (r() - 0.5) * 50, rad = 24 + r() * 34, g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(206,198,190,.30)'); g.addColorStop(0.5, 'rgba(196,190,186,.14)'); g.addColorStop(1, 'rgba(190,186,184,0)'); x.fillStyle = g; x.fillRect(0, 0, 160, 160); }
      out.push(c);
    }
    return out;
  }
  K.create = function (env) {
    const st = env.stage, AU = env.audio || {}, doc = root.document, sprites = fogSprites(doc);
    const ST = { active: true, t: 0, rt: 0, shake: 0, sil: 1, W: 1, H: 1, cam: null, handoff: null, dk: 1 };
    const f = { x: Math.sin(st.yaw + 0.35), z: Math.cos(st.yaw + 0.35) };                       // the way the character faces (towards the camera)
    let a = env.actor(), U = 0.65, hs = 0.394; const flags = {}; let hold = 0;
    const setUnits = () => { a = env.actor(); if (a && a.baseScale) { U = a.baseScale * (env.bodyHeight ? env.bodyHeight(a.key) : 1.9486); hs = U / 1.649; } };
    setUnits();
    const P0 = () => { const L = 2.4 * U; return [st.x - f.x * L, st.z - f.z * L]; };
    ST.walkFrom = P0();
    if (a) { a.hidden = true; a.x = ST.walkFrom[0]; a.z = ST.walkFrom[1]; }
    const tint = m => { const t = ST.base ? ST.base(m) : null, d = 1 - ST.sil * 0.965; return t ? [t[0] * d, t[1] * d, t[2] * d, t[3]] : (ST.sil > 0.01 ? [d, d, d, 0] : null); };
    ST.tint = tint;
    const FALL_H = 24;                                                                          // the character starts this many hs above the ground, out of frame
    const flyAt = t => { if (t < TM.strike) return FALL_H * hs; if (t >= TM.land) return 0; const s = (t - TM.strike) / TM.fallLen; return Math.max(1e-4, FALL_H * hs * (1 - s * s)); };
    ST.flyAt = flyAt;
    const walkK = t => ease((t - TM.walk) / TM.walkLen);
    const charXZ = t => { const k = walkK(t); return [lerp(ST.walkFrom[0], st.x, k), lerp(ST.walkFrom[1], st.z, k)]; };
    /* ---- camera ---- */
    ST.shakeT = 0;
    function cameraAt(t, dt) {
      const k = kf(t), cx = charXZ(t); let ty = st.gy + k.h * hs;
      if (t > TM.strike - 0.3 && t < TM.land + 1.0) {                                           // tilt down with the falling character, then settle on the crouch
        const w = ease((t - (TM.strike - 0.3)) / 0.9) * (1 - ease((t - (TM.land - 0.5)) / 1.2)); ty = lerp(ty, st.gy + flyAt(Math.min(t, TM.land)) + 0.5 * U + 0.4 * hs, w * 0.85);
      }
      const az = st.yaw + k.az, ce = Math.cos(k.el), dirv = [Math.sin(az) * ce, Math.sin(k.el), Math.cos(az) * ce];
      const tgt0 = [cx[0], ty, cx[1]]; let dist = k.dist * hs;
      if (env.cast) {                                                                           // never put the lens inside a building: shorten the dolly when something is in the way
        let hit = null; try { hit = env.cast(tgt0, dirv, dist); } catch (e) { hit = null; }
        const want = hit && typeof hit.t === 'number' && hit.t < dist ? clamp((hit.t * 0.9) / dist, 0.3, 1) : 1;
        ST.dk += (want - ST.dk) * Math.min(1, (dt || 0.016) * (want < ST.dk ? 3.2 : 0.9));   // eased both ways: no snap when a wall comes between the lens and him
      }
      dist *= ST.dk;
      const s = ST.shake, tm = ST.rt, sw = 0.012 * hs * Math.min(1, dist / (8 * hs));            // a trace of hand-held drift, and the shake of the strike and the landing
      const nz = (f1, f2, ph) => Math.sin(tm * f1 + ph) * 0.6 + Math.sin(tm * f2 + ph * 2.3) * 0.4;            // smooth band-limited shake (no white noise: nothing jitters)
      const sx = nz(23, 37, 0.3) * s * hs * 0.32 + Math.sin(tm * 0.9) * sw, sy = nz(29, 41, 1.7) * s * hs * 0.26 + Math.sin(tm * 1.3 + 1) * sw, sz = nz(19, 31, 2.9) * s * hs * 0.32 + Math.sin(tm * 0.7 + 2) * sw;
      let pos = [tgt0[0] + dirv[0] * dist + sx, tgt0[1] + dirv[1] * dist + sy, tgt0[2] + dirv[2] * dist + sz];
      if (env.gh) { try { const g = env.gh(pos[0], pos[2]); if (isFinite(g) && pos[1] < g + 0.6 * hs) pos[1] = g + 0.6 * hs; } catch (e) { } }
      return { pos, target: [tgt0[0] + sx, tgt0[1] + sy, tgt0[2] + sz], fov: k.fov, dist: k.dist, h: k.h, el: k.el, az: k.az };
    }
    /* screen position (0..1) and depth of a world point through the camera just computed */
    function basis(c, asp) {
      const fz = v3.norm(v3.sub(c.target, c.pos)), r = v3.norm(v3.cross(fz, [0, 1, 0])), u = v3.cross(r, fz); return { p: c.pos, f: fz, r, u, th: Math.tan(c.fov / 2), asp };
    }
    function proj(B, p) {
      const v = v3.sub(p, B.p), z = v3.dot(v, B.f); if (z < 0.05) return null;
      return [0.5 + 0.5 * v3.dot(v, B.r) / (z * B.th * B.asp), 0.5 - 0.5 * v3.dot(v, B.u) / (z * B.th), z];
    }
    K.proj = proj; K.basis = basis;
    /* ---- storm light: the engine reads window.__storm every frame (see tod() in game.js) ---- */
    const storm = root.__storm = { dark: 0, flash: 0 };
    const bolts = [];                                                                            // { b, t0, kind }
    const ground = () => [ST.walkFrom[0], st.gy, ST.walkFrom[1]];
    const skyPoint = (r, h) => { const g = ground(); return [g[0] + (r() - 0.5) * 7 * hs - f.x * 6 * hs, g[1] + h * hs, g[2] + (r() - 0.5) * 7 * hs - f.z * 6 * hs]; };
    const rB = rng(20251107);
    let fogP = [], sparks = [], arcs = []; const mist = [];
    { const r = rng(5); for (let i = 0; i < 70; i++) mist.push({ x: (r() - 0.5) * 64, z: (r() - 0.5) * 64, y: r() * 0.9, s: 3 + r() * 6, a: 0.03 + r() * 0.04, rot: r() * 6, v: (r() - 0.5) * 0.2, k: i & 1 }); }
    function spawnBurst() {
      const r = rng(9); fogP.length = 0;
      for (let i = 0; i < 170; i++) { const th = r() * 6.283, sp = 3 + r() * 9; fogP.push({ x: Math.cos(th) * 0.6, z: Math.sin(th) * 0.6, y: r() * 0.5, vx: Math.cos(th) * sp * 0.8, vz: Math.sin(th) * sp * 0.8, vy: 0.1 + r() * 0.5, s: 1.3 + r() * 2.4, a: 0.04 + r() * 0.05, rot: r() * 6, age: 0, k: i & 1 }); }
      for (let i = 0; i < 60; i++) fogP.push({ x: (r() - 0.5) * 9, z: (r() - 0.5) * 9, y: r() * 0.9, vx: (r() - 0.5) * 0.9, vz: (r() - 0.5) * 0.9, vy: 0.15 + r() * 0.3, s: 2.2 + r() * 2.6, a: 0.04 + r() * 0.05, rot: r() * 6, age: 0, k: i & 1 });
      sparks.length = 0; for (let i = 0; i < 72; i++) { const th = r() * 6.283, sp = 4 + r() * 16; sparks.push({ p: [0, 0.1, 0], v: [Math.cos(th) * sp, 5 + r() * 13, Math.sin(th) * sp], life: 0.7 + r() * 1.1, age: 0, c: r() < 0.55 ? 0 : 1 }); }
    }
    function spawnArcs() { const r = rng(77); arcs.length = 0; for (let i = 0; i < 9; i++) { const th = r() * 6.283; arcs.push({ b: makeBolt(r, [0, 0, 0], [Math.cos(th) * (4 + r() * 8), 0, Math.sin(th) * (4 + r() * 8)], { depth: 5, jag: 0.12, forks: 1 }), th }); } }
    const thunder = (l, c) => { try { AU.thunder && AU.thunder(l, c); } catch (e) { } };
    /* ---- the clock ---- */
    ST.update = function (dt) {
      if (!ST.active) return null; dt = Math.min(0.05, dt || 0.016); ST.rt += dt; let sc = 1;
      if (hold > 0) { hold -= dt; sc = 0; } else if (ST.tLand >= 0 && ST.t - ST.tLand < 0.7) sc = lerp(0.3, 1, ease((ST.t - ST.tLand) / 0.7));   // hit-stop, then the slow-motion eases back to speed
      ST.t += dt * sc; const t = ST.t; setUnits(); a = env.actor();
      if (a) {
        if (a.tintFn !== ST.tint) { ST.base = a.tintFn; a.tintFn = ST.tint; }
        if (t >= TM.strike && !flags.fall) { flags.fall = 1; a.hidden = false; a.clipT = 0; a.forceClip = ['M:Jumping Down', 1]; }
        if (t >= TM.strike && t < TM.land) { a.clipT = Math.min(2.49, (t - TM.strike) * (1.47 / TM.fallLen)); a.fly = flyAt(t); }
        if (t >= TM.land && !flags.land) { flags.land = 1; a.fly = 0; }
        if (t >= TM.land && t < TM.jdEnd) a.clipT = Math.min(2.49, 1.47 + (t - TM.land) * (1.06 / (TM.jdEnd - TM.land)));
        if (t >= TM.jdEnd && !flags.rise) { flags.rise = 1; a.clipT = null; a.forceClip = ['M:Crouch To Stand', 1]; }
        if (t >= TM.standEnd && !flags.tall) { flags.tall = 1; a.forceClip = ['M:Idle', 1]; }
        if (t >= TM.walk && !flags.walk) { flags.walk = 1; const sp = (2.4 * U) / TM.walkLen, ls = sp / (U * 0.47); a.forceClip = ['M:Walking', clamp(ls / 1.6, 0.55, 1.5)]; }
        if (t >= TM.walk && t < TM.walk + TM.walkLen) { const xz = charXZ(t); a.x = xz[0]; a.z = xz[1]; }
        if (t >= TM.walk + TM.walkLen && !flags.idle) { flags.idle = 1; a.x = st.x; a.z = st.z; a.forceClip = ['M:Idle', 1]; }
        /* the silhouette: black until the fog has thinned, a lightning flash shows him for an instant, then the sun breaks and the skin comes up */
        const pulse = t > TM.flash2 && t < TM.flash2 + 0.3 ? 0.55 * (1 - ease((t - TM.flash2) / 0.3)) : 0;
        ST.sil = t < TM.land - 0.05 ? 1 : clamp(1 - ease((t - 13.1) / 1.6) - pulse, 0, 1);
      }
      /* beats */
      if (t >= TM.flick1 && !flags.f1) { flags.f1 = 1; ST.sheet = { t0: t, k: 0.5 }; thunder(0.35, false); }
      if (t >= TM.flick2 && !flags.f2) { flags.f2 = 1; ST.sheet = { t0: t, k: 0.75 }; thunder(0.5, false); }
      if (t >= TM.call && !flags.call) { flags.call = 1; bolts.push({ b: makeBolt(rB, skyPoint(rB, 70), ground(), { depth: 7, jag: 0.12, forks: 4 }), t0: t, kind: 'call', w: 0.55, end: ground() }); thunder(0.7, true); ST.shake = 0.5; }
      if (t >= TM.strike && !flags.s) { flags.s = 1; ST.tStrike = t; const sp = skyPoint(rB, 80); bolts.push({ b: makeBolt(rB, sp, ground(), { depth: 8, jag: 0.17, forks: 9 }), t0: t, kind: 'big', w: 1, follow: true, end: ground() }); { const e2 = [ground()[0] + 1.5 * hs, st.gy, ground()[2]], s2 = [sp[0] + 4 * hs, sp[1], sp[2] - 3 * hs]; bolts.push({ b: makeBolt(rB, s2, e2, { depth: 7, jag: 0.15, forks: 5 }), t0: t + 0.18, kind: 'twin', w: 0.6, end: e2 }); } ST.shake = 1.4; thunder(1, true); env.flash && env.flash(1.2); }
      if (t >= TM.land && !flags.l) { flags.l = 1; ST.tLand = t; hold = 0.09; ST.shake = 3.1; thunder(0.9, true); try { AU.blade && AU.blade(); AU.boom && AU.boom(0.9); AU.rumble && AU.rumble(2.2, 0.6); } catch (e) { } env.flash && env.flash(2); spawnBurst(); spawnArcs(); }
      for (const [tt, l, k] of [[7.0, 0.4, 0.55], [7.9, 0.55, 0.7], [9.3, 0.45, 0.5], [10.6, 0.6, 0.8]]) if (t >= tt && !flags['af' + tt]) { flags['af' + tt] = 1; ST.sheet = { t0: t, k }; thunder(l, false); if (k > 0.6) { const e3 = [ground()[0] + (rB() - 0.5) * 30 * hs - f.x * 8 * hs, st.gy, ground()[2] + (rB() - 0.5) * 30 * hs - f.z * 8 * hs]; bolts.push({ b: makeBolt(rB, skyPoint(rB, 80), e3, { depth: 7, jag: 0.14, forks: 3 }), t0: t, kind: 'far', w: 0.5, end: e3 }); } }
      if (t >= TM.flash2 && !flags.f3) { flags.f3 = 1; ST.sheet = { t0: t, k: 0.95 }; thunder(0.55, false); }
      if (t >= TM.ui && !flags.ui) { flags.ui = 1; env.showUI && env.showUI(); }
      ST.shake *= Math.exp(-dt * 3.6);
      /* storm light for the 3D scene */
      const dark = t < TM.land ? 0.62 * ease(t / 3.8) : 0.62 * (1 - ease((t - 9.0) / 5.6)), bi = ST.boltLevel(t);
      const sh = ST.sheet ? ST.sheet.k * Math.max(0, 1 - (t - ST.sheet.t0) / 0.42) * (0.65 + 0.35 * Math.sin((t - ST.sheet.t0) * 55)) : 0;
      const lan = ST.tLand >= 0 && t - ST.tLand < 0.9 ? 1 - ease((t - ST.tLand) / 0.9) : 0;
      storm.dark = dark; storm.flash = clamp(Math.max(bi * 0.95, sh * 0.8, lan), 0, 1);
      ST.flashK = storm.flash;
      const c = cameraAt(t, dt); ST.cam = c; ST.asp = (ST.W || 16) / (ST.H || 9);
      ST.B = basis(c, ST.asp);
      for (const p of fogP) { p.age += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt * 0.4; p.vx *= Math.exp(-dt * 1.05); p.vz *= Math.exp(-dt * 1.05); p.vy *= Math.exp(-dt * 0.8); }
      for (const m of mist) m.x += m.v * dt;
      for (const q of sparks) { q.age += dt; q.v[1] -= 22 * dt; q.p = [q.p[0] + q.v[0] * dt, Math.max(0, q.p[1] + q.v[1] * dt), q.p[2] + q.v[2] * dt]; if (q.p[1] <= 0) { q.v[1] *= -0.3; q.v[0] *= 0.7; q.v[2] *= 0.7; } }
      if (t >= TM.end) ST.finish(false);
      return c;
    };
    ST.tLand = -1; ST.tStrike = -1; ST.sheet = null;
    /* the combined brightness of all bolts now (drives the engine light) */
    const bLev = (b, t) => { let v = inten(t - b.t0); if (b.follow && t > b.t0 + 0.1) { const sus = (0.72 + 0.28 * Math.sin(t * 41) * Math.sin(t * 13 + 1)) * (1 - ease((t - (TM.land + 0.05)) / 0.4)); v = Math.max(v, sus); } return v * b.w; };
    ST.boltLevel = t => { let m = 0; for (const b of bolts) m = Math.max(m, bLev(b, t)); return m; };
    /* ---- drawing ---- */
    const fogAlpha = t => t < TM.land ? 0.3 + 0.35 * ease(t / TM.strike) : t < TM.jdEnd ? 1 : t < TM.walk ? lerp(1, 0.55, ease((t - TM.jdEnd) / 3.3)) : lerp(0.55, 0.0, ease((t - TM.walk) / 3.6));
    ST.fogAlpha = fogAlpha;
    const stroke = (ctx, P) => { ctx.beginPath(); let on = false; for (let i = 0; i < P.length; i++) { const p = P[i]; if (!p) { on = false; continue; } if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); } ctx.stroke(); };
    ST.draw = function (ctx, W, H) {
      if (!ST.active || !ctx) return; const t = ST.t, u = H / 100; ST.W = W; ST.H = H; const B = ST.B; if (!B) return; B.asp = W / H;
      const px = p => { const q = proj(B, p); return q ? [q[0] * W, q[1] * H, q[2]] : null; };
      const lvl = ST.flashK || 0, gnd = ground(), gp = px(gnd);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      /* sheet lightning: the cloud deck lights up gold from inside */
      if (ST.sheet) { const s = ST.sheet.k * Math.max(0, 1 - (t - ST.sheet.t0) / 0.42) * (0.65 + 0.35 * Math.sin((t - ST.sheet.t0) * 55)); if (s > 0.01) { const g = ctx.createLinearGradient(0, 0, 0, H * 0.75); g.addColorStop(0, 'rgba(255,214,120,' + (0.5 * s).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } }
      /* bolts */
      ctx.globalCompositeOperation = 'lighter';
      for (const bo of bolts) {
        const bi = bLev(bo, t); if (bi < 0.015) continue;
        const top = bo.b.p0, end = bo.follow && t < TM.land ? [gnd[0], gnd[1] + flyAt(t) + 0.45 * U, gnd[2]] : bo.end;       // the big bolt's tip is the falling character
        const jit = 0.004 * Math.sin(t * 90), P = bo.b.pts.map(q => px(boltPt(bo.b, top, end, [q[0], q[1] + (q[0] > 0.1 && q[0] < 0.9 ? jit : 0), q[2]])));
        if (P.filter(Boolean).length < 4) continue;
        const wk = bo.kind === 'big' ? 1.7 : 1, passes = [[11 * u * wk, 'rgba(255,150,30,' + (0.15 * bi) + ')'], [5.2 * u * wk, 'rgba(255,196,64,' + (0.34 * bi) + ')'], [2.3 * u * wk, 'rgba(255,236,150,' + (0.85 * bi) + ')'], [0.85 * u * wk, 'rgba(255,255,248,' + Math.min(1, bi * 1.1) + ')']];
        for (const [w, col] of passes) { ctx.lineWidth = Math.max(1, w * bo.w); ctx.strokeStyle = col; stroke(ctx, P); }
        for (const br of bo.b.br) {
          const BP = br.seg.map(q => px(boltPt(bo.b, top, end, q))); if (BP.filter(Boolean).length < 3) continue;
          const bw = br.depth ? 0.45 : 0.7; for (const [w, col] of passes.slice(1)) { ctx.lineWidth = Math.max(0.8, w * bw * bo.w); ctx.strokeStyle = col; stroke(ctx, BP); }
        }
        /* glow where it leaves the cloud and where it lands */
        const topP = P.find(Boolean); if (topP) { const R = 60 * u * bo.w, cy = Math.max(topP[1], 0), g = ctx.createRadialGradient(topP[0], cy, 0, topP[0], cy, R); g.addColorStop(0, 'rgba(255,230,150,' + (0.6 * bi) + ')'); g.addColorStop(1, 'rgba(255,160,40,0)'); ctx.fillStyle = g; ctx.fillRect(topP[0] - R, cy - R, R * 2, R * 2); }
        const foot = px(end); if (foot) { const R = 30 * u * bo.w, g = ctx.createRadialGradient(foot[0], foot[1], 0, foot[0], foot[1], R); g.addColorStop(0, 'rgba(255,255,235,' + (0.95 * bi) + ')'); g.addColorStop(0.3, 'rgba(255,205,90,' + (0.55 * bi) + ')'); g.addColorStop(1, 'rgba(255,140,30,0)'); ctx.fillStyle = g; ctx.fillRect(foot[0] - R, foot[1] - R, R * 2, R * 2); }
      }
      /* the falling character: a hot streak above him and a halo around him */
      if (t >= TM.strike - 0.05 && t < TM.land + 0.08) {
        const hp = px([gnd[0], gnd[1] + flyAt(Math.min(t, TM.land)) + 0.45 * U, gnd[2]]), s = clamp((t - TM.strike) / 0.15, 0, 1);
        if (hp) { const R = 17 * u * s, g = ctx.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], R); g.addColorStop(0, 'rgba(255,255,240,.9)'); g.addColorStop(0.3, 'rgba(255,214,110,.55)'); g.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g; ctx.fillRect(hp[0] - R, hp[1] - R, R * 2, R * 2);
          const tl = ctx.createLinearGradient(hp[0], hp[1], hp[0] - 4 * u, hp[1] - 55 * u); tl.addColorStop(0, 'rgba(255,240,170,.55)'); tl.addColorStop(1, 'rgba(255,170,50,0)'); ctx.strokeStyle = tl; ctx.lineWidth = 5 * u * s; ctx.beginPath(); ctx.moveTo(hp[0], hp[1]); ctx.lineTo(hp[0] - 4 * u, hp[1] - 55 * u); ctx.stroke(); }
      }
      /* the impact */
      if (ST.tLand >= 0 && gp) {
        const s = t - ST.tLand, rs = ST.rt;
        for (let r = 0; r < 2; r++) { const k = clamp((s - r * 0.12) / 1.5, 0, 1); if (k <= 0 || k >= 1) continue; const R = (2 + easeOut(k) * 24) * hs, N = 48, ring = []; for (let i = 0; i <= N; i++) { const th = i / N * 6.2832; ring.push(px([gnd[0] + Math.cos(th) * R, gnd[1] + 0.05 * hs, gnd[2] + Math.sin(th) * R])); }
          ctx.strokeStyle = 'rgba(255,225,140,' + (0.8 * (1 - k) * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = Math.max(1, (4.5 - k * 3.5) * u * 0.5); stroke(ctx, ring); }
        if (s < 0.9) { const k = 1 - s / 0.9, R = 24 * u * (0.6 + 0.4 * (1 - k)), g = ctx.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], R); g.addColorStop(0, 'rgba(255,245,200,' + (0.85 * k * k).toFixed(3) + ')'); g.addColorStop(0.4, 'rgba(255,190,80,' + (0.4 * k * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,120,20,0)'); ctx.fillStyle = g; ctx.fillRect(gp[0] - R, gp[1] - R, R * 2, R * 2); }
        if (s < 0.32) { const k = 1 - s / 0.32, cx = gp[0], cy = gp[1] - 0.3 * u * 10, r2 = rng(4); ctx.strokeStyle = 'rgba(255,248,220,' + (0.55 * k).toFixed(3) + ')'; for (let i = 0; i < 44; i++) { const an = i / 44 * 6.2832 + r2() * 0.1, r0 = (8 + r2() * 10) * u, r1 = r0 + (30 + r2() * 70) * u * (1 - k * 0.5); ctx.lineWidth = Math.max(1, (0.5 + r2() * 1.1) * u * 0.6); ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.8); ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1 * 0.8); ctx.stroke(); } }
        for (const ar of arcs) { const k = clamp(1 - (s - 0.02) / 0.6, 0, 1); if (k <= 0) continue; const P = ar.b.pts.map(q => px(boltPt(ar.b, [gnd[0], gnd[1] + 0.03 * hs, gnd[2]], [gnd[0] + (ar.b.p0 ? 0 : 0) + Math.cos(ar.th) * 6 * hs, gnd[1] + 0.03 * hs, gnd[2] + Math.sin(ar.th) * 6 * hs], q))); if (P.filter(Boolean).length < 3) continue;
          ctx.strokeStyle = 'rgba(255,210,100,' + (0.5 * k).toFixed(3) + ')'; ctx.lineWidth = Math.max(1, 2.2 * u * 0.5); stroke(ctx, P); ctx.strokeStyle = 'rgba(255,255,240,' + (0.9 * k).toFixed(3) + ')'; ctx.lineWidth = Math.max(0.8, 0.8 * u * 0.5); stroke(ctx, P); }
        for (const q of sparks) { if (q.age > q.life) continue; const a0 = px([gnd[0] + q.p[0] * hs * 0.35, gnd[1] + q.p[1] * hs * 0.35, gnd[2] + q.p[2] * hs * 0.35]), a1 = px([gnd[0] + (q.p[0] - q.v[0] * 0.03) * hs * 0.35, gnd[1] + (q.p[1] - q.v[1] * 0.03) * hs * 0.35, gnd[2] + (q.p[2] - q.v[2] * 0.03) * hs * 0.35]); if (!a0 || !a1) continue;
          const l = 1 - q.age / q.life; ctx.strokeStyle = q.c ? 'rgba(255,240,190,' + l.toFixed(3) + ')' : 'rgba(255,150,50,' + (l * 0.9).toFixed(3) + ')'; ctx.lineWidth = Math.max(1, 1.5 * u * 0.4 * l + 0.5); ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = 'source-over';
      /* fog: world-space sprites lying on the ground (a low mist from the start, a burst at the impact, thinning as he walks out). Sprites behind him are cut out around his body so the silhouette reads. */
      const fa = fogAlpha(t);
      if (sprites && fa > 0.004) {
        const lit = clamp(lvl, 0, 1), body = (() => { const c = charXZ(t), fl = (t < TM.land ? flyAt(t) : 0); const bpt = px([c[0], gnd[1] + fl + 0.5 * U, c[1]]); const d = proj(B, [c[0], gnd[1] + fl + 0.5 * U, c[1]]); return bpt && d ? { x: bpt[0], y: bpt[1], z: d[2], rx: 0.3 * U / (d[2] * B.th * B.asp) * 0.5 * W, ry: 0.62 * U / (d[2] * B.th) * 0.5 * H } : null; })();
        const list = []; const g0 = gnd;
        for (const m of mist) list.push({ p: [g0[0] + m.x * hs, g0[1] + m.y * hs, g0[2] + m.z * hs], s: m.s * hs, a: m.a * (t < TM.land ? 1 : 0.8), rot: m.rot, k: m.k });
        for (const p of fogP) list.push({ p: [g0[0] + p.x * hs, g0[1] + p.y * hs, g0[2] + p.z * hs], s: p.s * hs * (1 + Math.min(p.age, 4) * 0.22), a: p.a * clamp(1 - p.age / 14, 0, 1), rot: p.rot + p.age * 0.06, k: p.k });
        const items = []; for (const it of list) { const q = proj(B, it.p); if (!q) continue; items.push({ it, q }); }
        items.sort((A, Bq) => Bq.q[2] - A.q[2]);
        for (const { it, q } of items) {
          const sx = q[0] * W, sy = q[1] * H, sz = it.s / (q[2] * B.th * B.asp) * 0.5 * W; if (sz < 3 || sx < -sz || sx > W + sz) continue;
          let al = it.a * fa; if (body && q[2] > body.z - 0.02 * hs) { const dx = (sx - body.x) / (body.rx * 1.35), dy = (sy - body.y) / (body.ry * 1.25), dd = dx * dx + dy * dy; if (dd < 1) al *= 0.12 + 0.88 * dd; }
          if (al < 0.004) continue; ctx.globalAlpha = clamp(al, 0, 0.9); ctx.save(); ctx.translate(sx, sy); ctx.rotate(it.rot); ctx.drawImage(sprites[it.k], -sz * 0.5, -sz * 0.3, sz, sz * 0.6);
          if (lit > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(al * lit * 0.45, 0, 0.5); ctx.drawImage(sprites[it.k], -sz * 0.5, -sz * 0.3, sz, sz * 0.6); } ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        /* tint the fog: grey-blue in the dark, gold in the flashes (a flat wash over the ground band) */
        const tintA = fa * (0.04 + 0.12 * lit); if (gp && tintA > 0.004) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, gp[1] - H * 0.28, 0, gp[1] + H * 0.12); g.addColorStop(0, 'rgba(255,200,110,0)'); g.addColorStop(0.55, 'rgba(255,195,105,' + tintA.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = g; ctx.fillRect(0, gp[1] - H * 0.28, W, H * 0.4); ctx.globalCompositeOperation = 'source-over'; }
      }
      /* flashes */
      if (ST.tStrike >= 0 && t - ST.tStrike < 0.3) { const k = 1 - (t - ST.tStrike) / 0.3; ctx.fillStyle = 'rgba(255,238,190,' + (0.8 * k * k).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      if (ST.tLand >= 0) { const s = ST.rt - (ST.rtLand = ST.rtLand || ST.rt); if (s < 0.5) { const k = 1 - s / 0.5; ctx.fillStyle = 'rgba(255,246,215,' + (0.96 * k * k * k * k).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); if (s < 0.05) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; } } }
      if (t > TM.flash2 && t < TM.flash2 + 0.25) { ctx.fillStyle = 'rgba(255,236,180,' + (0.5 * (1 - (t - TM.flash2) / 0.25)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      /* the sun breaking through at the reveal: a warm wash from the upper left */
      if (t > 13.0) { const k = ease((t - 13.0) / 1.8) * (1 - ease((t - 15.6) / 0.9)); if (k > 0.01) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(W * 0.2, -H * 0.1, 0, W * 0.2, -H * 0.1, H * 1.4); g.addColorStop(0, 'rgba(255,205,120,' + (0.35 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; } }
      /* vignette, letterbox, fade-in, location card */
      { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,4,8,.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      { const bar = H * 0.085 * ease(t / 0.9) * (1 - ease((t - 15.7) / 0.8)); if (bar > 0.5) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); } }
      if (t < 1.1) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - ease(t / 1.1)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      if (t > 1.0 && t < 3.4 && ctx.fillText) { const k = ease((t - 1.0) / 0.7) * (1 - ease((t - 2.8) / 0.6)); if (k > 0.01) { ctx.globalAlpha = k; ctx.fillStyle = 'rgba(255,236,200,.92)'; ctx.font = '600 ' + Math.round(H * 0.052) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('SHIGANSHINA DISTRICT', W * 0.07, H * 0.84); ctx.font = '500 ' + Math.round(H * 0.03) + 'px Cinzel, Georgia, serif'; ctx.fillStyle = 'rgba(255,214,150,.8)'; ctx.fillText('WALL MARIA · AN EVENING OF STORM', W * 0.07, H * 0.84 + H * 0.05); ctx.globalAlpha = 1; } }
      ctx.restore();
    };
    ST.skip = function () { if (ST.active) { ST.finish(true); } };
    ST.finish = function (skipped) {
      if (!ST.active) return; const c = skipped ? cameraAt(TM.end, 0.016) : (ST.cam || cameraAt(TM.end, 0.016)); ST.active = false; ST.sil = 0; storm.dark = 0; storm.flash = 0; if (root.__storm === storm) root.__storm = null;
      if (a) { a.hidden = false; a.fly = 0; a.clipT = null; a.forceClip = null; a.x = st.x; a.z = st.z; if (a.tintFn === ST.tint) a.tintFn = ST.base || null; }
      const e = kf(TM.end); ST.handoff = { dist: e.dist, h: e.h, el: e.el, fov: e.fov, az: e.az }; env.done && env.done(ST.handoff, skipped);
    };
    return ST;
  };
  S.strike = K; if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(typeof window !== 'undefined' ? window : globalThis);

/* Ashes of the Walls — CREATOR OPENING: "the strike".
   A centred stage in Shiganshina under a storm. A bolt splits the sky and the default character falls inside it (the motion-captured "Jumping Down"),
   lands in a burst of light and fog, rises out of a crouch as a silhouette while the fog thins, walks to the camera in his underclothes, and the
   studio slides in from a close-up. Everything is driven by one clock so it can be skipped, replayed and tested.
   S.strike.create(env) -> { active, update(dt), draw(ctx, W, H), skip(), t }   env: actor(), stage, audio, showUI(), done(handoff)            */
(function (root) {
  'use strict';
  const S = root.STORY || (root.STORY = {}), K = {};
  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  /* the timeline, seconds */
  const TM = { storm: 0.0, flick1: 0.9, flick2: 1.55, strike: 2.25, fallLen: 1.47, land: 2.25 + 1.47, jdEnd: 2.25 + 2.5, stand: 2.25 + 2.5 + 3.4, walk: 8.1, walkLen: 3.1, close: 11.2, ui: 12.1, end: 12.9 };
  K.TM = TM;
  /* camera keyframes in the creator's own units: dist and h in 'hs' (1 hs = 1/1.649 of the character), az is added to the stage yaw */
  const KF = [
    { t: 0.0, dist: 9.6, h: 2.3, el: 0.10, fov: 0.92, az: 0.34, mv: 0 },
    { t: 2.25, dist: 8.3, h: 1.9, el: 0.09, fov: 0.92, az: 0.32, mv: 0 },
    { t: 3.2, dist: 7.0, h: 1.6, el: 0.05, fov: 0.90, az: 0.30, mv: 0 },
    { t: 3.72, dist: 5.6, h: 1.25, el: -0.02, fov: 0.86, az: 0.30, mv: 0 },
    { t: 5.0, dist: 4.5, h: 1.0, el: -0.03, fov: 0.80, az: 0.36, mv: 0 },
    { t: 8.0, dist: 3.9, h: 1.15, el: -0.02, fov: 0.78, az: 0.30, mv: 0 },
    { t: 11.2, dist: 3.5, h: 1.25, el: -0.02, fov: 0.74, az: 0.28, mv: 1 },
    { t: 12.1, dist: 2.3, h: 1.5, el: -0.01, fov: 0.24, az: 0.36, mv: 1 }];
  const kf = t => { let i = 0; while (i < KF.length - 2 && t > KF[i + 1].t) i++; const a = KF[i], b = KF[i + 1], k = ease((t - a.t) / (b.t - a.t)); const o = {}; for (const p of ['dist', 'h', 'el', 'fov', 'az', 'mv']) o[p] = lerp(a[p], b[p], k); return o; };
  const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  /* ---- the bolt: midpoint displacement with branches, two different return strokes ---- */
  function bolt(x0, y0, x1, y1, rnd, W) {
    const pts = [[x0, y0], [x1, y1]];
    for (let d = 0, off = W * 0.07; d < 7; d++, off *= 0.55) { const out = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], m = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 2 * off, (a[1] + b[1]) / 2 + (rnd() - 0.5) * off * 0.5]; out.push(m, b); } pts.length = 0; pts.push(...out); }
    pts[pts.length - 1] = [x1, y1]; const br = [];
    for (let i = 8; i < pts.length - 8; i += 6 + Math.floor(rnd() * 9)) { if (rnd() < 0.55) { const p = pts[i], dir = (rnd() < 0.5 ? -1 : 1), len = (0.05 + rnd() * 0.16) * W, seg = [p]; let x = p[0], y = p[1], ang = Math.PI / 2 + dir * (0.4 + rnd() * 0.7);
        for (let s = 0; s < 9; s++) { ang += (rnd() - 0.5) * 0.9; x += Math.cos(ang) * len / 9; y += Math.sin(ang) * len / 9; seg.push([x, y]); } br.push(seg); } }
    return { pts, br };
  }
  const path = (ctx, p) => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.stroke(); };
  /* the intensity of the bolt after the strike: a fast return stroke, a dark gap, a second stroke, then a slow glow */
  const BI = [[0, 0], [0.01, 1], [0.07, 1], [0.1, 0.18], [0.14, 0.12], [0.16, 1], [0.27, 0.95], [0.31, 0.3], [0.36, 0.2], [0.38, 0.75], [0.55, 0.5], [0.9, 0]];
  const inten = s => { if (s <= 0) return 0; for (let i = 1; i < BI.length; i++) if (s < BI[i][0]) return lerp(BI[i - 1][1], BI[i][1], (s - BI[i - 1][0]) / (BI[i][0] - BI[i - 1][0])); return 0; };
  /* ---- fog sprite: a few soft lobes ---- */
  function fogSprite(doc) {
    if (!doc || !doc.createElement) return null; const c = doc.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); if (!x) return null; const r = rng(77);
    for (let i = 0; i < 9; i++) { const px = 64 + (r() - 0.5) * 46, py = 64 + (r() - 0.5) * 34, rad = 26 + r() * 26, g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(196,206,226,.30)'); g.addColorStop(0.55, 'rgba(176,188,212,.13)'); g.addColorStop(1, 'rgba(160,174,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    return c;
  }
  K.create = function (env) {
    const st = env.stage, AU = env.audio || {}, doc = root.document, sprite = fogSprite(doc), ST = { active: true, t: 0, shake: 0, sil: 1, sky: 0, W: 1, H: 1, gp: [0, 0], cam: null, handoff: null, last: {} };
    const f = { x: Math.sin(st.yaw + 0.35), z: Math.cos(st.yaw + 0.35) };                        // the way the character faces (towards the camera)
    let a = env.actor(), U = 0.65, hs = 0.394, flags = {}, fogP = [], boltA = null, boltB = null, rndB = rng(2025), tStrike = -1, tLand = -1, base = null, started = false;
    const setUnits = () => { a = env.actor(); if (a && a.baseScale) { U = a.baseScale * (env.bodyHeight ? env.bodyHeight(a.key) : 1.9486); hs = U / 1.649; } };
    setUnits();
    const P0 = () => { const L = 2.4 * U; return [st.x - f.x * L, st.z - f.z * L]; };
    ST.walkFrom = P0();
    if (a) { a.hidden = true; a.x = ST.walkFrom[0]; a.z = ST.walkFrom[1]; }
    const tint = m => { const t = ST.base ? ST.base(m) : null, d = 1 - ST.sil * 0.96; return t ? [t[0] * d, t[1] * d, t[2] * d, t[3]] : (ST.sil > 0.01 ? [d, d, d, 0] : null); };
    ST.tint = tint;
    function cameraAt(t) {
      const k = kf(t), mv = ease((t - TM.walk) / TM.walkLen), tx = lerp(ST.walkFrom[0], st.x, k.mv > 0 ? Math.max(mv, ease(k.mv)) : mv), tz = lerp(ST.walkFrom[1], st.z, k.mv > 0 ? Math.max(mv, ease(k.mv)) : mv);
      const az = st.yaw + k.az, ce = Math.cos(k.el), dist = k.dist * hs, tgt = [tx, st.gy + k.h * hs, tz];
      const s = ST.shake, sx = (Math.random() - 0.5) * s * hs * 0.5, sy = (Math.random() - 0.5) * s * hs * 0.4, sz = (Math.random() - 0.5) * s * hs * 0.5;
      const pos = [tgt[0] + Math.sin(az) * ce * dist + sx, tgt[1] + Math.sin(k.el) * dist + sy, tgt[2] + Math.cos(az) * ce * dist + sz];
      return { pos, target: [tgt[0] + sx, tgt[1] + sy, tgt[2] + sz], fov: k.fov, dist: k.dist, h: k.h, el: k.el, az: k.az };
    }
    /* screen position of a world point for the camera just computed (the ground centre of the stage sits on the middle column) */
    function project(c, p) {
      const fz = [c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]], fl = Math.hypot(fz[0], fz[1], fz[2]) || 1; fz[0] /= fl; fz[1] /= fl; fz[2] /= fl;
      const up = [0, 1, 0], d = fz[1]; let u = [up[0] - fz[0] * d, up[1] - fz[1] * d, up[2] - fz[2] * d]; const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = u.map(v => v / ul);
      const v = [p[0] - c.pos[0], p[1] - c.pos[1], p[2] - c.pos[2]], z = v[0] * fz[0] + v[1] * fz[1] + v[2] * fz[2], y = v[0] * u[0] + v[1] * u[1] + v[2] * u[2], th = Math.tan(c.fov / 2) * Math.max(z, 1e-3);
      return [0.5, 0.5 - (y / th) * 0.5];
    }
    ST.update = function (dt) {
      if (!ST.active) return null; dt = Math.min(0.05, dt || 0.016); ST.t += dt; const t = ST.t; setUnits(); a = env.actor();
      if (a) {
        if (a.tintFn !== ST.tint) { ST.base = a.tintFn; a.tintFn = ST.tint; }
        if (t >= TM.strike && !flags.fall) { flags.fall = 1; a.hidden = false; a.clipT = 0; a.forceClip = ['M:Jumping Down', 1]; }
        if (t >= TM.strike && t < TM.land) { const s = (t - TM.strike) / TM.fallLen; a.clipT = Math.min(2.49, t - TM.strike); a.fly = Math.max(1e-4, 9.5 * hs * (1 - s * s)); }
        if (t >= TM.land && !flags.land) { flags.land = 1; a.fly = 0; }
        if (t >= TM.land && t < TM.jdEnd) a.clipT = Math.min(2.49, t - TM.strike);
        if (t >= TM.jdEnd && !flags.rise) { flags.rise = 1; a.clipT = null; a.forceClip = ['M:Crouch To Stand', 1]; }
        if (t >= TM.walk && !flags.walk) { flags.walk = 1; const sp = (2.4 * U) / TM.walkLen, ls = sp / (U * 0.47); a.forceClip = ['M:Walking', clamp(ls / 1.6, 0.55, 1.5)]; }
        if (t >= TM.walk && t < TM.walk + TM.walkLen) { const k = (t - TM.walk) / TM.walkLen; a.x = ST.walkFrom[0] + (st.x - ST.walkFrom[0]) * k; a.z = ST.walkFrom[1] + (st.z - ST.walkFrom[1]) * k; }
        if (t >= TM.walk + TM.walkLen && !flags.idle) { flags.idle = 1; a.x = st.x; a.z = st.z; a.forceClip = ['M:Idle', 1]; }
        ST.sil = t < TM.land ? 1 : 1 - ease((t - 5.9) / 2.6);                         // the silhouette fades in the thinning fog
      }
      if (t >= TM.flick1 && !flags.f1) { flags.f1 = 1; AU.thunder && AU.thunder(0.35, false); }
      if (t >= TM.flick2 && !flags.f2) { flags.f2 = 1; AU.thunder && AU.thunder(0.5, false); }
      if (t >= TM.strike && !flags.s) { flags.s = 1; tStrike = t; ST.shake = 1.2; AU.thunder && AU.thunder(1, true); env.flash && env.flash(1.2); }
      if (t >= TM.land && !flags.l) { flags.l = 1; tLand = t; ST.shake = 2.4; AU.thunder && AU.thunder(0.85, true); AU.blade && AU.blade(); env.flash && env.flash(2); spawnFog(); }
      if (t >= TM.ui && !flags.ui) { flags.ui = 1; env.showUI && env.showUI(); }
      ST.shake *= Math.exp(-dt * 4.2);
      const c = cameraAt(t); ST.cam = c; ST.gp = project(c, [ST.walkFrom[0], st.gy, ST.walkFrom[1]]);
      ST.gpc = project(c, [a ? a.x : st.x, st.gy, a ? a.z : st.z]); ST.gph = a ? project(c, [a.x, st.gy + ((a.fly || 0) + 0.55 * U), a.z]) : ST.gpc;
      if (t >= TM.end) ST.finish(false);
      return c;
    };
    function spawnFog() {
      const r = rng(9); fogP.length = 0;
      for (let i = 0; i < 110; i++) { const th = r() * 6.283, sp = 0.08 + r() * 0.34; fogP.push({ x: Math.cos(th) * 0.03, y: (r() - 0.5) * 0.03, vx: Math.cos(th) * sp * 1.5, vy: -0.004 - r() * 0.012, s: 0.18 + r() * 0.34, a: 0.13 + r() * 0.2, tall: 0, rot: r() * 6, age: 0 }); }
      for (let i = 0; i < 20; i++) fogP.push({ x: (r() - 0.5) * 0.14, y: -r() * 0.05, vx: (r() - 0.5) * 0.12, vy: -0.03 - r() * 0.05, s: 0.22 + r() * 0.3, a: 0.12 + r() * 0.2, tall: 1, rot: r() * 6, age: 0 });
    }
    const dens = t => t < TM.land ? clamp((t - 0.6) / 3, 0, 0.18) * 0.7 : t < TM.land + 0.55 ? lerp(0.15, 1, ease((t - TM.land) / 0.55)) : t < 5.9 ? 1 : t < 8.4 ? lerp(1, 0.16, ease((t - 5.9) / 2.5)) : lerp(0.16, 0, ease((t - 8.4) / 2.2));
    ST.dens = dens;
    ST.draw = function (ctx, W, H) {
      if (!ST.active || !ctx) return; const t = ST.t, u = H / 100; ST.W = W; ST.H = H;
      const gx = W * ST.gp[0], gy = H * ST.gp[1], bi = tStrike >= 0 ? inten(t - tStrike) : 0, flick = (t > TM.flick1 && t < TM.flick1 + 0.18) ? 0.28 : (t > TM.flick2 && t < TM.flick2 + 0.12 ? 0.4 : 0);
      ctx.save();
      /* the storm: a dark blue wash that opens up after the impact */
      const dark = t < TM.land ? 0.46 : lerp(0.36, 0, ease((t - TM.land) / 8)); ctx.fillStyle = 'rgba(7,10,22,' + dark.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      const sk = ctx.createLinearGradient(0, 0, 0, H * 0.7); sk.addColorStop(0, 'rgba(150,175,255,' + (flick * 0.5 + bi * 0.42).toFixed(3) + ')'); sk.addColorStop(1, 'rgba(150,175,255,0)'); ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
      /* the bolt */
      if (tStrike >= 0 && bi > 0.01 && t < tStrike + 0.95) {
        if (!boltA) { const r = rng(31337); boltA = bolt(W * (0.5 + (r() - 0.5) * 0.05), -H * 0.08, gx, gy, r, W); boltB = bolt(W * (0.5 + (r() - 0.5) * 0.04), -H * 0.08, gx, gy, r, W); }
        const B = ((t - tStrike) % 0.34) > 0.14 && (t - tStrike) > 0.14 && (t - tStrike) < 0.3 ? boltB : ((t - tStrike) > 0.3 ? boltB : boltA); B.pts[B.pts.length - 1] = [gx, gy];
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const pass = [[16 * u * 0.55, 'rgba(90,130,255,' + (0.1 * bi) + ')'], [8 * u * 0.5, 'rgba(140,175,255,' + (0.22 * bi) + ')'], [3.2 * u * 0.5, 'rgba(205,225,255,' + (0.6 * bi) + ')'], [1.3 * u * 0.5, 'rgba(255,255,255,' + bi + ')']];
        for (const [w, col] of pass) { ctx.lineWidth = Math.max(1, w); ctx.strokeStyle = col; path(ctx, B.pts); ctx.lineWidth = Math.max(0.8, w * 0.5); for (const b of B.br) path(ctx, b); }
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 24 * u), q = bi; g.addColorStop(0, 'rgba(255,255,255,' + (0.95 * q) + ')'); g.addColorStop(0.25, 'rgba(170,200,255,' + (0.5 * q) + ')'); g.addColorStop(1, 'rgba(80,120,255,0)'); ctx.fillStyle = g; ctx.fillRect(gx - 26 * u, gy - 26 * u, 52 * u, 52 * u);
        if (t < TM.land) { const hx = W * ST.gph[0], hy = H * ST.gph[1], g2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, 15 * u); g2.addColorStop(0, 'rgba(235,245,255,' + (0.8 * q) + ')'); g2.addColorStop(1, 'rgba(120,160,255,0)'); ctx.fillStyle = g2; ctx.fillRect(hx - 16 * u, hy - 16 * u, 32 * u, 32 * u); }
        ctx.globalCompositeOperation = 'source-over';
      }
      /* the impact: white-out, then a shock ring racing across the ground */
      if (tLand >= 0) { const s = t - tLand; if (s < 0.5) { ctx.fillStyle = 'rgba(235,242,255,' + (0.92 * (1 - ease(s / 0.5)) * (1 - ease(s / 0.5))).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
        if (s < 1.1) { const k = ease(s / 1.1), rx = (6 + k * 62) * u, ry = rx * 0.16; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,215,255,' + (0.7 * (1 - k)).toFixed(3) + ')'; ctx.lineWidth = Math.max(1, (3.2 - k * 2.4) * u * 0.5); ctx.beginPath(); ctx.ellipse(gx, gy, rx, ry, 0, 0, 6.283); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; } }
      else if (flick > 0) { ctx.fillStyle = 'rgba(200,215,255,' + (flick * 0.5) + ')'; ctx.fillRect(0, 0, W, H); }
      if (tStrike >= 0 && t - tStrike < 0.25) { ctx.fillStyle = 'rgba(225,235,255,' + (0.75 * (1 - (t - tStrike) / 0.25)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      /* fog: low ground mist before the strike, a burst at the impact, then it thins and drifts */
      const dn = dens(t);
      if (sprite && dn > 0.005) {
        const lit = clamp(bi * 0.9 + (tLand >= 0 && t - tLand < 0.5 ? 1 - (t - tLand) / 0.5 : 0), 0, 1), r0 = lerp(150, 235, lit), g0 = lerp(160, 244, lit), b0 = lerp(182, 255, lit);
        if (!fogP.length && t < TM.land) { const r = rng(5); for (let i = 0; i < 18; i++) fogP.push({ x: (r() - 0.5) * 1.5, y: 0.0 + r() * 0.06, vx: (r() - 0.5) * 0.03, vy: 0, s: 0.4 + r() * 0.5, a: 0.12 + r() * 0.16, tall: 0, rot: r() * 6, age: 0, mist: 1 }); }
        for (const p of fogP) {
          p.age += 0.016; if (!p.mist) { p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.vx *= 0.985; } else p.x += p.vx * 0.016; const px = gx + p.x * H, py = gy + (p.y - (p.tall ? p.age * 0.02 : 0)) * H, sz = p.s * H * (1 + Math.min(p.age, 3) * 0.12);
          ctx.globalAlpha = clamp(p.a * dn * (p.tall ? 0.8 : 1), 0, 0.92); ctx.save(); ctx.translate(px, py); ctx.rotate(p.rot + p.age * 0.05);
          ctx.drawImage(sprite, -sz * 0.6, -sz * 0.3, sz * 1.2, sz * 0.6); ctx.restore();
        }
        ctx.globalAlpha = 1; if (dn > 0.06) { ctx.fillStyle = 'rgba(' + (r0 | 0) + ',' + (g0 | 0) + ',' + (b0 | 0) + ',' + (0.1 * dn * (0.4 + lit)).toFixed(3) + ')'; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(0, gy - H * 0.3, W, H * 0.5); ctx.globalCompositeOperation = 'source-over'; }
      }
      ctx.restore();
    };
    ST.skip = function () { if (ST.active) { ST.finish(true); } };
    ST.finish = function (skipped) {
      if (!ST.active) return; const c = skipped ? cameraAt(TM.end) : (ST.cam || cameraAt(TM.end)); ST.active = false; ST.sil = 0;
      if (a) { a.hidden = false; a.fly = 0; a.clipT = null; a.forceClip = null; a.x = st.x; a.z = st.z; if (a.tintFn === ST.tint) a.tintFn = ST.base || null; }
      ST.handoff = { dist: c.dist, h: c.h, el: c.el, fov: c.fov, az: c.az }; env.done && env.done(ST.handoff, skipped);
    };
    return ST;
  };
  S.strike = K; if (typeof module !== 'undefined' && module.exports) module.exports = K;
})(typeof window !== 'undefined' ? window : globalThis);

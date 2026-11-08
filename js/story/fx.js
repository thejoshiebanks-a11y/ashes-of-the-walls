/* Ashes of the Walls — cinematic effects for the opening (S.fx)
 * Canvas 2D layers drawn over the WebGL world: sheet and forked lightning, a plasma ball, shockwave rings, world-space smoke / steam / fire,
 * god rays, flashes and a storm grade. Everything is simulated from an explicit time step (update(dt)) and only *drawn* by the layer,
 * so a cutscene can be scrubbed or replayed exactly. All positions are world metres, projected with host.project(x,y,z) -> {cx,cy,cw}. */
(function (root) {
  'use strict';
  const S = root.STORY || (root.STORY = {}), F = S.fx = {};
  const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), TAU = Math.PI * 2;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  /* ---------- soft sprites, painted once ---------- */
  const cache = {};
  const PAL = { steam: [[255, 255, 255, 0.34], [225, 232, 242, 0.3]], smoke: [[120, 104, 92, 0.34], [44, 40, 40, 0.38], [70, 62, 58, 0.34]], fire: [[255, 214, 120, 0.6], [255, 120, 40, 0.55]], dust: [[214, 196, 164, 0.34], [168, 150, 124, 0.3]], ember: [[255, 220, 150, 1], [255, 120, 30, 0.8]] };
  F.sprite = kind => {
    if (cache[kind]) return cache[kind];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = mulberry(kind.length * 977 + 13), pal = PAL[kind] || PAL.steam;
    const blobs = kind === 'ember' ? 1 : (kind === 'smoke' ? 22 : 14);
    for (let i = 0; i < blobs; i++) {
      const a = r() * TAU, d = kind === 'ember' ? 0 : r() * (kind === 'smoke' ? 30 : 20), x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.9, rad = kind === 'ember' ? 60 : (kind === 'smoke' ? 9 + r() * 15 : 14 + r() * 18), col = pal[i % pal.length];
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + col[3] + ')'); gr.addColorStop(0.55, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (col[3] * 0.45).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return cache[kind] = c;
  };
  const toScreen = (H, W, Hh, x, y, z) => { const p = H.project(x, y, z); if (!p || p.cw <= 0.3) return null; return { x: (p.cx / p.cw * 0.5 + 0.5) * W, y: (1 - (p.cy / p.cw * 0.5 + 0.5)) * Hh, w: p.cw }; };
  const pxPerM = (H, W, Hh, x, y, z, a) => { const b = H.project(x, y + 1, z); if (!b || b.cw <= 0.3) return 0; return Math.abs((b.cy / b.cw - a.cy / a.cw) * 0.5 * Hh); };
  F.toScreen = toScreen;

  /* ---------- world-space puffs: smoke, steam, fire, dust, embers ---------- */
  F.puffs = H => {
    const ps = [];
    return {
      ps,
      add(o) { const q = Object.assign({ v: [0, 0, 0], r: 3, gr: 2, l: 3, a: 0.8, kind: 'steam', rot: rnd() * TAU, spin: (rnd() - 0.5) * 0.7, drag: 0.6, grav: 0, fade: 0.25 }, o); q.l0 = q.l; q.p = q.p.slice(); q.v = q.v.slice(); if (ps.length < 520) ps.push(q); return q; },
      burst(kind, c, n, o) {                                  // n puffs thrown out from a world point: o = {speed, up, r, gr, l, a, spread:[x,y,z]}
        o = o || {}; const sp = o.spread || [6, 4, 6];
        for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = (o.speed || 12) * (0.3 + rnd() * 0.9); this.add({ kind, p: [c[0] + (rnd() - 0.5) * sp[0], c[1] + (rnd() - 0.5) * sp[1], c[2] + (rnd() - 0.5) * sp[2]], v: [Math.cos(a) * s * (o.fx == null ? 1 : o.fx) + (o.vx || 0), (o.up || 6) * (0.4 + rnd()), Math.sin(a) * s * (o.fz == null ? 1 : o.fz) + (o.vz || 0)], r: (o.r || 4) * (0.6 + rnd() * 0.8), gr: (o.gr || 3) * (0.6 + rnd()), l: (o.l || 3.5) * (0.7 + rnd() * 0.7), a: o.a || 0.8, drag: o.drag == null ? 0.5 : o.drag, grav: o.grav || 0, fade: o.fade || 0.25 }); }
      },
      update(dt) {
        for (let i = ps.length - 1; i >= 0; i--) {
          const q = ps[i]; q.l -= dt; if (q.l <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
          const k = Math.pow(q.drag, dt); q.v[0] *= k; q.v[1] = q.v[1] * k + q.grav * dt; q.v[2] *= k; q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; q.r += q.gr * dt; q.rot += q.spin * dt;
        }
      },
      draw(g, W, Hh, occ) {
        const vis = [];
        for (const q of ps) { const s = toScreen(H, W, Hh, q.p[0], q.p[1], q.p[2]); if (s) { q.s = s; vis.push(q); } }
        vis.sort((a, b) => b.s.w - a.s.w);
        for (const q of vis) {
          const age = q.l0 - q.l, al = q.a * clamp(age / (q.l0 * q.fade * 0.5), 0, 1) * clamp(q.l / (q.l0 * q.fade * 2), 0, 1) * (occ ? occ(q.p) : 1); if (al < 0.01) continue;
          const pp = pxPerM(H, W, Hh, q.p[0], q.p[1], q.p[2], { cy: 0, cw: 1 }); const b = H.project(q.p[0], q.p[1] + q.r, q.p[2]); const a0 = H.project(q.p[0], q.p[1], q.p[2]);
          const pr = clamp(Math.abs((b.cy / b.cw - a0.cy / a0.cw) * 0.5 * Hh), 1.5, Hh * 0.32); void pp;
          g.globalAlpha = Math.min(1, al * clamp((q.s.w - 16) / 40, 0, 1)); g.globalCompositeOperation = q.kind === 'fire' || q.kind === 'ember' ? 'lighter' : 'source-over';
          g.save(); g.translate(q.s.x, q.s.y); g.rotate(q.rot); g.drawImage(F.sprite(q.kind), -pr, -pr, pr * 2, pr * 2); g.restore();
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* ---------- lightning ---------- */
  const jag = (r, x0, y0, x1, y1, off, out, depth) => {            // midpoint displacement
    if (depth === 0) { out.push(x1, y1); return; }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, o = (r() - 0.5) * off;
    const cx = mx - dy / len * o, cy = my + dx / len * o; jag(r, x0, y0, cx, cy, off * 0.55, out, depth - 1); jag(r, cx, cy, x1, y1, off * 0.55, out, depth - 1);
  };
  const stroke = (g, pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  F.drawBolt = (g, r, ax, ay, bx, by, w, alpha, forks, tint) => {
    const main = [ax, ay]; jag(r, ax, ay, bx, by, Math.hypot(bx - ax, by - ay) * 0.32, main, 6); const t = tint || [255, 196, 90];
    const paths = [{ pts: main, w }];
    for (let f = 0; f < (forks || 0); f++) {
      const i = (2 + Math.floor(r() * (main.length / 2 - 6))) * 2, sx = main[i], sy = main[i + 1], ang = Math.atan2(by - ay, bx - ax) + (r() - 0.5) * 1.5, len = Math.hypot(bx - ax, by - ay) * (0.18 + r() * 0.3);
      const br = [sx, sy]; jag(r, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, len * 0.4, br, 4); paths.push({ pts: br, w: w * 0.55 });
    }
    g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
    for (const p of paths) { stroke(g, p.pts, p.w * 10, 'rgba(' + t[0] + ',' + (t[1] - 40) + ',' + t[2] + ',' + (alpha * 0.07).toFixed(3) + ')'); stroke(g, p.pts, p.w * 4.2, 'rgba(' + t[0] + ',' + t[1] + ',' + (t[2] + 30) + ',' + (alpha * 0.22).toFixed(3) + ')'); stroke(g, p.pts, p.w * 1.5, 'rgba(255,248,226,' + alpha.toFixed(3) + ')'); }
    g.globalCompositeOperation = 'source-over';
  };
  F.bolts = H => {
    const list = []; let T = 0;
    return {
      list,
      strike(o) { list.push(Object.assign({ w: 2.2, dur: 0.45, forks: 4, tint: null, t0: T }, o)); },     // o = {a:[x,y,z], b:[x,y,z], t0, dur, w, forks}
      update(t) { T = t; for (let i = list.length - 1; i >= 0; i--) if (T > list[i].t0 + list[i].dur) list.splice(i, 1); },
      draw(g, W, Hh) {
        for (const s of list) {
          const u = (T - s.t0) / s.dur; if (u < 0) continue; const fl = u < 0.12 ? 1 : u < 0.2 ? 0.3 : u < 0.3 ? 1 : u < 0.4 ? 0.55 : Math.max(0, (1 - u) * 0.9);
          if (fl <= 0.02) continue; const a = toScreen(H, W, Hh, s.a[0], s.a[1], s.a[2]), b = toScreen(H, W, Hh, s.b[0], s.b[1], s.b[2]); if (!a || !b) continue;
          const seed = Math.floor((T - s.t0) / 0.05) * 7919 + (s.seed || 1); const pxw = Math.max(0.8, s.w * Hh / 260);
          F.drawBolt(g, mulberry(seed), a.x, a.y, b.x, b.y, pxw, fl, s.forks, s.tint);
        }
      }
    };
  };

  /* ---------- the plasma ball (the golden sphere that precedes the strike) ---------- */
  F.plasma = H => {
    const st = { on: false, c: [0, 0, 0], R: 10, t0: 0, t1: 1, T: 0 };
    return {
      st, set(c, R, t0, t1) { st.on = true; st.c = c; st.R = R; st.t0 = t0; st.t1 = t1; }, off() { st.on = false; }, update(t) { st.T = t; },
      draw(g, W, Hh) {
        if (!st.on) return; const u = clamp((st.T - st.t0) / (st.t1 - st.t0), 0, 1), s = toScreen(H, W, Hh, st.c[0], st.c[1], st.c[2]); if (!s) return;
        const a0 = H.project(st.c[0], st.c[1], st.c[2]), b = H.project(st.c[0], st.c[1] + st.R, st.c[2]); const pr = Math.abs((b.cy / b.cw - a0.cy / a0.cw) * 0.5 * Hh) * (0.12 + 0.88 * u * u) * (1 + Math.sin(st.T * 40) * 0.04);
        g.globalCompositeOperation = 'lighter';
        let gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, pr * 3.2); gr.addColorStop(0, 'rgba(255,236,170,' + (0.5 * u).toFixed(3) + ')'); gr.addColorStop(0.4, 'rgba(255,160,50,' + (0.22 * u).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, pr * 3.2, 0, TAU); g.fill();
        gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, pr); gr.addColorStop(0, 'rgba(255,255,244,1)'); gr.addColorStop(0.45, 'rgba(255,226,140,.95)'); gr.addColorStop(0.85, 'rgba(255,150,40,.55)'); gr.addColorStop(1, 'rgba(255,110,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, pr, 0, TAU); g.fill();
        const r = mulberry(Math.floor(st.T * 24) * 131 + 5), n = Math.round(6 + 10 * u);                      // arcs crawling off the surface
        for (let i = 0; i < n; i++) { const an = r() * TAU, l = pr * (1.1 + r() * 1.7 * u); F.drawBolt(g, r, s.x + Math.cos(an) * pr * 0.8, s.y + Math.sin(an) * pr * 0.8, s.x + Math.cos(an + (r() - 0.5)) * l, s.y + Math.sin(an + (r() - 0.5)) * l, Math.max(0.7, pr * 0.03), 0.8 * u, 0); }
        g.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* ---------- shockwave rings on the ground ---------- */
  F.shocks = H => {
    const list = []; let T = 0;
    return {
      list, add(o) { list.push(Object.assign({ c: [0, 0, 0], v: 130, life: 1.6, t0: T, y: 0 }, o)); }, update(t) { T = t; for (let i = list.length - 1; i >= 0; i--) if (T > list[i].t0 + list[i].life) list.splice(i, 1); },
      draw(g, W, Hh) {
        g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
        for (const s of list) {
          const u = (T - s.t0) / s.life; if (u < 0) continue; const rad = s.v * (T - s.t0) * (1 - u * 0.3), al = Math.pow(1 - u, 1.4);
          for (const [k, w, a] of [[1, 14, 0.18], [1, 5, 0.55], [0.94, 2.5, 0.3]]) {
            g.beginPath(); let started = false;
            for (let i = 0; i <= 96; i++) { const an = i / 96 * TAU, p = toScreen(H, W, Hh, s.c[0] + Math.cos(an) * rad * k, s.c[1], s.c[2] + Math.sin(an) * rad * k); if (!p) { started = false; continue; } if (!started) { g.moveTo(p.x, p.y); started = true; } else g.lineTo(p.x, p.y); }
            g.strokeStyle = 'rgba(255,224,160,' + (a * al).toFixed(3) + ')'; g.lineWidth = w * Hh / 390; g.stroke();
          }
        }
        g.globalCompositeOperation = 'source-over';
      }
    };
  };

  /* ---------- screen-space: flashes, god rays, storm grade ---------- */
  F.flashes = () => {
    const list = []; let T = 0;
    return {
      list, add(o) { list.push(Object.assign({ t0: T, dur: 0.4, peak: 1, col: [255, 244, 214], hold: 0.1 }, o)); }, update(t) { T = t; for (let i = list.length - 1; i >= 0; i--) if (T > list[i].t0 + list[i].dur) list.splice(i, 1); },
      draw(g, W, Hh) {
        for (const f of list) { const u = (T - f.t0) / f.dur; if (u < 0) continue; const a = (u < f.hold ? 1 : Math.pow(1 - (u - f.hold) / (1 - f.hold), 2)) * f.peak; g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(' + f.col[0] + ',' + f.col[1] + ',' + f.col[2] + ',' + a.toFixed(3) + ')'; g.fillRect(0, 0, W, Hh); }
        g.globalCompositeOperation = 'source-over';
      }
    };
  };
  F.rays = H => {
    const st = { on: false, c: [0, 0, 0], t0: 0, dur: 1, power: 1, T: 0 };
    return {
      st, set(c, t0, dur, power) { st.on = true; st.c = c; st.t0 = t0; st.dur = dur; st.power = power || 1; }, update(t) { st.T = t; },
      draw(g, W, Hh) {
        if (!st.on) return; const u = (st.T - st.t0) / st.dur; if (u < 0 || u > 1) return; const s = toScreen(H, W, Hh, st.c[0], st.c[1], st.c[2]); if (!s) return; const al = Math.pow(1 - u, 1.6) * 0.16 * st.power, L = Math.hypot(W, Hh);
        g.globalCompositeOperation = 'lighter'; const n = 44;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + st.T * 0.12 + Math.sin(i * 12.9) * 0.1, wd = 0.012 + (i % 4) * 0.008; const gr = g.createLinearGradient(s.x, s.y, s.x + Math.cos(a) * L, s.y + Math.sin(a) * L); gr.addColorStop(0, 'rgba(255,226,150,' + al.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + Math.cos(a - wd) * L, s.y + Math.sin(a - wd) * L); g.lineTo(s.x + Math.cos(a + wd) * L, s.y + Math.sin(a + wd) * L); g.closePath(); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      }
    };
  };
  F.storm = () => {                                                // a dark, cold overcast that builds, then lifts to a warm, smoky glow. get(t) -> {a, warm}
    return { get: () => ({ a: 0, warm: 0 }), draw(g, W, Hh) { const s = this.get(); if (s.a > 0.01) { const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, 'rgba(8,12,26,' + s.a.toFixed(3) + ')'); gr.addColorStop(0.6, 'rgba(18,22,38,' + (s.a * 0.55).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(24,20,28,' + (s.a * 0.35).toFixed(3) + ')'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh); }
      if (s.warm > 0.01) { g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(W * 0.5, Hh * 0.45, 0, W * 0.5, Hh * 0.45, Math.hypot(W, Hh) * 0.6); gr.addColorStop(0, 'rgba(255,170,70,' + (0.22 * s.warm).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh); g.globalCompositeOperation = 'source-over'; } } };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
})(typeof window !== 'undefined' ? window : globalThis);

/* Ashes of the Walls — creator studio (v0.5): a dark cinematic stage for the registry.
   The district is not drawn while the studio is on (game.js studioBegin). The default mannequin idles in a spotlight, then a scan line
   sweeps up the body and your character appears beneath it. All camera moves are smoothed so they read as camera work, not UI. */
(function (root) {
  'use strict';
  const S = root.STORY, ST = S.studio = {};
  const doc = root.document, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  const FOCUS = {                                    // th: target height as a fraction of body height, d: camera distance in body heights
    full: { th: 0.5, d: 2.15, p: 0.03, yaw: 0.12 }, upper: { th: 0.7, d: 1.5, p: 0.03, yaw: 0.34 }, face: { th: 0.9, d: 0.82, p: 0.01, yaw: 0.55 },
    feet: { th: 0.12, d: 1.5, p: 0.1 }, wide: { th: 0.5, d: 3.6, p: 0.08 }, low: { th: 0.46, d: 2.3, p: -0.12 }
  };
  const C = ST.cam = { th: 0.5, d: 3.4, p: 0.1, yaw: 0, fov: 0.86, ofs: -0.2, sway: 0 };      // current (smoothed) camera
  let T = null, on = false, raf = 0, last = 0, el = null, parts = {}, subj = { x: 0, z: 0, gy: 0, h: 1.3, yaw: Math.PI };
  ST.target = Object.assign({}, C); ST.active = () => on;

  ST.focus = (name, o) => { const f = FOCUS[name] || FOCUS.full; Object.assign(ST.target, { th: f.th, d: f.d, p: f.p }, f.yaw != null ? { yaw: f.yaw } : {}, o || {}); };
  /* The menu panel covers the left of the screen: the subject is framed in the free area to its right (px = panel width in css pixels, 0 = whole screen). */
  ST.inset = px => { const W = Math.max(1, root.innerWidth || 1); inset = clamp((px || 0) / W, 0, 0.7); ST.target.ofs = -inset / 2; };
  let inset = 0;
  ST.snap = () => Object.assign(C, ST.target);
  ST.nudge = (dyaw, dp) => { ST.target.yaw += dyaw || 0; ST.target.p = clamp(ST.target.p + (dp || 0), -0.35, 0.6); };
  ST.setHeight = h => { subj.h = h; };

  /* The Paths: the glowing tree, the sand and the aurora behind the stage (assets/ui/paths.jpg plus a painted extension). Drawn by game.js studioBegin from this canvas. */
  function paintBackdrop(img) {
    if (!doc) return null; const W = 2048, H = 1024, cv = doc.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); if (!g) return null;
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#02030a'); sky.addColorStop(.38, '#07143a'); sky.addColorStop(.62, '#0d2a63'); sky.addColorStop(.78, '#17407f'); sky.addColorStop(1, '#040a1c'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(210,230,255,' + (0.15 + rnd() * 0.5) + ')'; const r = rnd() * 1.4 + .3; g.beginPath(); g.arc(rnd() * W, rnd() * H * .55, r, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'lighter'; g.filter = 'blur(14px)';
    for (let i = 0; i < 9; i++) { const x0 = W * (.08 + i * .105), top = H * (.02 + rnd() * .1), gr = g.createLinearGradient(0, top, 0, H * .6); const hue = i % 2 ? '90,170,255' : '130,110,255';
      gr.addColorStop(0, 'rgba(' + hue + ',0)'); gr.addColorStop(.35, 'rgba(' + hue + ',.30)'); gr.addColorStop(1, 'rgba(' + hue + ',0)'); g.strokeStyle = gr; g.lineWidth = 30 + rnd() * 50; g.beginPath(); g.moveTo(x0, top); g.bezierCurveTo(x0 + 120 * (rnd() - .5), H * .2, W * .5 + (x0 - W * .5) * .35, H * .3, W * .5, H * .43); g.stroke(); }
    g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    if (img && img.width) {                                                                  // the supplied Paths picture: centred, edges feathered into the painted sky
      const ih = H * 1.12, iw = ih * img.width / img.height, t = doc.createElement('canvas'); t.width = Math.ceil(iw); t.height = Math.ceil(ih); const q = t.getContext('2d'); q.drawImage(img, 0, 0, t.width, t.height);
      q.globalCompositeOperation = 'destination-in'; const m = q.createLinearGradient(0, 0, t.width, 0); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(.28, '#000'); m.addColorStop(.72, '#000'); m.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = m; q.fillRect(0, 0, t.width, t.height);
      g.drawImage(t, (W - iw) / 2, H * .02 - 0.04 * H);
    } else {
      const tr = g.createRadialGradient(W / 2, H * .42, 4, W / 2, H * .42, H * .34); tr.addColorStop(0, 'rgba(255,255,255,.95)'); tr.addColorStop(.25, 'rgba(170,215,255,.6)'); tr.addColorStop(1, 'rgba(60,110,255,0)'); g.fillStyle = tr; g.fillRect(0, 0, W, H);
    }
    for (let k = 0; k < 3; k++) { g.fillStyle = ['#0a1d46', '#07142f', '#040a1c'][k]; g.beginPath(); g.moveTo(0, H); const y0 = H * (.74 + k * .07); for (let x = 0; x <= W; x += 32) g.lineTo(x, y0 + Math.sin(x / 190 + k * 2.1) * 26 + Math.sin(x / 61 + k) * 7); g.lineTo(W, H); g.closePath(); g.fill(); }
    return cv;
  }
  function loadBackdrop() {
    const Z = root.__studio; if (!Z || Z.bgCanvas) return; Z.bgCanvas = paintBackdrop(null); Z.bgVer = 1;
    if (typeof root.Image === 'function') { const im = new root.Image(); im.onload = () => { const z = root.__studio; if (!z || z.lockBg) return; const c = paintBackdrop(im); if (c) { z.bgCanvas = c; z.bgVer++; } }; im.src = 'assets/ui/paths.jpg'; }
  }
  function build() {
    if (el || !doc) return; el = doc.createElement('div'); el.id = 'sv-studio'; el.setAttribute('aria-hidden', 'true');
    for (const k of ['halo', 'pool', 'vig', 'grain', 'cap']) { const d = doc.createElement('div'); d.className = 'st-' + k; el.appendChild(d); parts[k] = d; }
    doc.body.appendChild(el);
  }
  function project(p) {                              // world -> css pixels using the engine's current view-projection
    const E = root.__E; if (!E || !E.vp) return null; const m = E.vp, x = p[0], y = p[1], z = p[2], w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (w <= 0.001) return null;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w];
  }
  ST.camPose = () => {                               // pure: camera position/target from the smoothed state (unit-tested)
    const h = subj.h, a = subj.yaw + C.yaw + C.sway, d = C.d * h, cp = Math.cos(C.p), tx = subj.x, tz = subj.z, ty = subj.gy + C.th * h;
    const rx = Math.cos(a), rz = -Math.sin(a), sh = C.ofs * d * Math.tan(C.fov / 2) * 2 * ((root.innerWidth || 16) / Math.max(1, root.innerHeight || 9));
    const T3 = [tx + rx * sh, ty, tz + rz * sh];
    return { pos: [T3[0] + Math.sin(a) * cp * d, T3[1] + Math.sin(C.p) * d, T3[2] + Math.cos(a) * cp * d], target: T3, fov: C.fov };
  };
  ST.update = function (dt) {
    dt = Math.min(0.05, dt || 0.016); const k = 1 - Math.exp(-dt * 3.2);
    for (const key of ['th', 'd', 'p', 'yaw', 'fov', 'ofs']) C[key] = lerp(C[key], ST.target[key], k);
    const cp = ST.camPose(), CN = root.__cine; if (CN) { CN.on = true; CN.pos = cp.pos; CN.target = cp.target; CN.fov = cp.fov; }
    if (el) {                                         // the spotlight pool and halo follow the feet and the chest on screen
      const f = project([subj.x, subj.gy, subj.z]), ch = project([subj.x, subj.gy + subj.h * 0.6, subj.z]), W = root.innerWidth, H = root.innerHeight;
      if (f) { parts.pool.style.left = ((f[0] * 0.5 + 0.5) * W) + 'px'; parts.pool.style.top = ((0.5 - f[1] * 0.5) * H) + 'px'; }
      if (ch && root.__studio) { root.__studio.bgSx = ch[0] * 0.5; root.__studio.bgPar = C.yaw * 0.04; }
      if (ch) { parts.halo.style.left = ((ch[0] * 0.5 + 0.5) * W) + 'px'; parts.halo.style.top = ((0.5 - ch[1] * 0.5) * H) + 'px'; }
    }
  };
  function loop(now) { if (!on) return; const dt = (now - last) / 1000; last = now; ST.update(dt); raf = root.requestAnimationFrame(loop); }

  let prevScale = 0;
  ST.enter = function (o) {
    o = o || {}; subj = { x: o.x || 0, z: o.z || 0, gy: o.gy || 0, h: o.h || 1.3, yaw: o.yaw == null ? Math.PI : o.yaw }; build();
    root.__studio = { bg: [0.045, 0.05, 0.062], key: [0.55, 0.5, 0.7], sunC: [1.15, 1.0, 0.86], ambS: [0.34, 0.37, 0.46], ambG: [0.22, 0.18, 0.15], rim: 0.4, rimC: [0.55, 0.7, 0.95] };
    loadBackdrop();
    if (root.__E && root.__E.scale < 1) { prevScale = root.__E.scale; root.__E.scale = 1; }
    Object.assign(C, { th: 0.5, d: 4.6, p: -0.06, yaw: 0.5, fov: 0.86, ofs: -inset / 2, sway: 0 }); Object.assign(ST.target, C, { d: 3.2, p: 0.02, yaw: 0.14 });
    if (doc) doc.body.classList.add('sv-studio-on'); on = true; last = root.performance ? root.performance.now() : 0; ST.update(0.016);
    if (root.requestAnimationFrame) raf = root.requestAnimationFrame(loop);
  };
  ST.exit = function () {
    if (prevScale && root.__E) { root.__E.scale = prevScale; prevScale = 0; }
    on = false; if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf); root.__studio = null; if (root.__cine) root.__cine.on = false;
    if (doc) doc.body.classList.remove('sv-studio-on'); if (el && el.parentNode) el.parentNode.removeChild(el); el = null; parts = {};
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  ST.caption = async function (text, ms) { if (!parts.cap) return; parts.cap.textContent = text; parts.cap.classList.add('on'); await wait(ms || 2200); if (parts.cap) parts.cap.classList.remove('on'); await wait(500); };

  /* The scan: the mannequin keeps what is above the line, the new body what is below. mk() returns the new character actor. */
  ST.reveal = async function (mannequin, mk, ms) {
    const h = subj.h, band = Math.max(0.05, h * 0.045); ms = ms || 2600;
    const ch = mk(); if (!ch) { return; }
    mannequin.fx = { y: subj.gy - 0.2, mode: 2, band, glow: [0.45, 0.8, 1.0], rim: 1.1 }; ch.fx = { y: subj.gy - 0.2, mode: 1, band, glow: [0.45, 0.8, 1.0] };
    const t0 = root.performance.now(); let stop = false; ST.skipReveal = () => { stop = true };
    await new Promise(res => { const step = () => { const t = clamp((root.performance.now() - t0) / ms, 0, 1), y = subj.gy - 0.2 + ease(t) * (h + 0.4); mannequin.fx.y = y; ch.fx.y = y;
      if (t >= 1 || stop) return res(); root.requestAnimationFrame ? root.requestAnimationFrame(step) : setTimeout(step, 16); }; step(); });
    ch.fx = null; return ch;
  };

  /* Full opening beat for the registry. opts: {mannequin, mkChar, skip:()=>bool} */
  ST.intro = async function (o) {
    const man = o.mannequin; ST.focus('full', { d: 2.5, p: 0.0, yaw: 0.1 });
    ST.caption('In the Paths, every bloodline meets.', 2300); await wait(2700);
    ST.focus('upper', { d: 1.8, yaw: -0.18, p: 0.04 }); await wait(1500);
    ST.caption('Every child in the district is written down once.', 2200); await wait(900);
    ST.focus('full', { d: 2.3, yaw: 0.28, p: -0.02 });
    const ch = await ST.reveal(man, o.mkChar, 2800); if (o.removeMannequin) o.removeMannequin();
    ST.focus('full', { d: 2.1, yaw: 0.12, p: 0.03 }); await wait(700); return ch;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ST;
})(typeof window !== 'undefined' ? window : globalThis);

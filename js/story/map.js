/* Ashes of the Walls — district map: drawn from the real level data, pans and zooms with touch. */
(function (root) {
  'use strict';
  const S = root.STORY, M = S.map = {};
  const doc = root.document;
  let screenEl, cv, ctx, layer = null, view = { x: -60, z: -150, zoom: 1 }, ptrs = new Map(), pinch = null, src = null, raf = 0, drag = null, size = { w: 800, h: 400 };
  const BOUNDS = { x0: -385, x1: 385, z0: -510, z1: 245, ppm: 1.25 };

  M.build = function (UI) {
    const h = UI.h;
    cv = h('canvas', { class: 'sv-map-cv', 'aria-label': 'Map of Shiganshina District', role: 'img' });
    const zoomBtn = (t, f, lab) => h('button', { type: 'button', class: 'sv-ghost sv-map-z', 'aria-label': lab, onclick: f, text: t });
    screenEl = UI.addScreen('map', 'sv-map',
      cv,
      h('button', { type: 'button', class: 'sv-back sv-ghost', text: 'Close', onclick: () => UI._cb('closeMap') }),
      h('div', { class: 'sv-map-title' }, h('b', { text: 'Shiganshina District' }), h('span', { text: 'Wall Maria, year 845' })),
      h('div', { class: 'sv-map-ctl' }, zoomBtn('+', () => M.zoom(1.35), 'Zoom in'), zoomBtn('−', () => M.zoom(1 / 1.35), 'Zoom out'), zoomBtn('⌖', () => M.center(), 'Centre on me')),
      h('div', { class: 'sv-map-key' }, h('p', { class: 'sv-map-obj' }), h('p', { class: 'sv-map-hint', text: 'Drag to move. Pinch or use + and − to zoom.' })));
    ctx = cv.getContext && cv.getContext('2d');
    const down = e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch (x) {} if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vz: view.z }; if (ptrs.size === 2) { const p = [...ptrs.values()]; pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), z: view.zoom }; } };
    const move = e => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && pinch) { const p = [...ptrs.values()]; view.zoom = Math.max(0.5, Math.min(7, pinch.z * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / pinch.d)); }
      else if (drag) { const s = scale(); view.x = drag.vx - (e.clientX - drag.x) / s; view.z = drag.vz + (e.clientY - drag.y) / s; }
    };
    const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) drag = null; else { const p = [...ptrs.values()][0]; drag = { x: p.x, y: p.y, vx: view.x, vz: view.z }; } };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault && e.preventDefault(); M.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  };
  const scale = () => Math.min(size.w / (BOUNDS.x1 - BOUNDS.x0), size.h / (BOUNDS.z1 - BOUNDS.z0)) * 1.9 * view.zoom;
  M.zoom = f => { view.zoom = Math.max(0.5, Math.min(7, view.zoom * f)); };
  M.center = () => { const p = src && src.player(); if (p) { view.x = p.x; view.z = p.z; } };
  M.source = f => { src = f; };

  function buildLayer() {                                   // houses, canal and gate drawn once, then reused every frame
    const J = root.__PACK_JSON; if (!J || !doc.createElement) return null;
    const W = Math.ceil((BOUNDS.x1 - BOUNDS.x0) * BOUNDS.ppm), Hh = Math.ceil((BOUNDS.z1 - BOUNDS.z0) * BOUNDS.ppm), c = doc.createElement('canvas'); c.width = W; c.height = Hh;
    const g = c.getContext && c.getContext('2d'); if (!g) return null;
    const X = x => (x - BOUNDS.x0) * BOUNDS.ppm, Z = z => (BOUNDS.z1 - z) * BOUNDS.ppm;
    g.fillStyle = 'rgba(214,204,182,.34)';
    for (const hs of J.houseList || []) { g.save(); g.translate(X(hs[0]), Z(hs[1])); g.rotate(-hs[2]); g.fillRect(-4.2 * BOUNDS.ppm, -3 * BOUNDS.ppm, 8.4 * BOUNDS.ppm, 6 * BOUNDS.ppm); g.restore(); }
    const pts = J.canalPath && J.canalPath.pts;
    if (pts && pts.length) { g.strokeStyle = 'rgba(96,142,170,.75)'; g.lineWidth = 7 * BOUNDS.ppm; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); }
    g.strokeStyle = 'rgba(230,222,200,.85)'; g.lineWidth = 6 * BOUNDS.ppm; g.beginPath(); g.moveTo(X(-130), Z(2)); g.lineTo(X(130), Z(2)); g.stroke();   // the wall and its gate
    g.fillStyle = '#e0b255'; g.fillRect(X(-9), Z(6), 18 * BOUNDS.ppm, 8 * BOUNDS.ppm);
    return c;
  }
  function frame() {
    if (!screenEl || screenEl.hidden || !ctx) return;
    const r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { width: 800, height: 400 }, dpr = Math.min(2, root.devicePixelRatio || 1);
    if (r.width && (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr))) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    size = { w: r.width || 800, h: r.height || 400 }; const s = scale();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, size.w, size.h);
    const X = x => size.w / 2 + (x - view.x) * s, Z = z => size.h / 2 - (z - view.z) * s;
    ctx.strokeStyle = 'rgba(228,224,214,.05)'; ctx.lineWidth = 1; ctx.beginPath();                  // 100 m grid
    for (let x = Math.ceil(BOUNDS.x0 / 100) * 100; x <= BOUNDS.x1; x += 100) { ctx.moveTo(X(x), 0); ctx.lineTo(X(x), size.h); }
    for (let z = Math.ceil(BOUNDS.z0 / 100) * 100; z <= BOUNDS.z1; z += 100) { ctx.moveTo(0, Z(z)); ctx.lineTo(size.w, Z(z)); } ctx.stroke();
    if (layer) ctx.drawImage(layer, X(BOUNDS.x0), Z(BOUNDS.z1), (BOUNDS.x1 - BOUNDS.x0) * s, (BOUNDS.z1 - BOUNDS.z0) * s);
    const d = src && src.data(); const lab = (t, x, z, col, dy) => { ctx.font = 'italic 400 ' + Math.max(11, Math.min(15, 11 * view.zoom + 3)) + 'px Spectral, serif'; ctx.fillStyle = col || 'rgba(228,224,214,.8)'; ctx.textAlign = 'center'; ctx.fillText(t, X(x), Z(z) + (dy || -9)); };
    for (const p of S.data.world.places || []) { ctx.fillStyle = 'rgba(228,224,214,.55)'; ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 2.5, 0, 6.3); ctx.fill(); lab(p.name, p.x, p.z); }
    if (d) {
      for (const n of d.npcs) { ctx.fillStyle = 'rgba(143,178,204,.9)'; ctx.beginPath(); ctx.arc(X(n.x), Z(n.z), 3.4, 0, 6.3); ctx.fill(); if (view.zoom > 1.6) lab(n.name, n.x, n.z, '#b8cfe0', -8); }
      const t = performance.now() / 600;
      for (const o of d.objectives) { const x = X(o.x), y = Z(o.z), pr = 8 + 3 * Math.sin(t); ctx.strokeStyle = 'rgba(224,178,85,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, pr, 0, 6.3); ctx.stroke(); ctx.fillStyle = '#e0b255'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4.5, -4.5, 9, 9); ctx.restore(); lab(o.name, o.x, o.z, '#f0cf86', -16); }
      const p = d.player; if (p) { ctx.save(); ctx.translate(X(p.x), Z(p.z)); ctx.fillStyle = 'rgba(122,165,108,.3)'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.3); ctx.fill(); ctx.rotate(p.yaw); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 8); ctx.lineTo(0, 4); ctx.lineTo(-6.5, 8); ctx.closePath(); ctx.fill(); ctx.restore(); }
      const ob = screenEl.querySelector('.sv-map-obj'); if (ob) ob.textContent = d.objective ? 'Objective: ' + d.objective : 'No current objective.';
    }
    raf = requestAnimationFrame(frame);
  }
  M.open = function () { if (!layer) layer = buildLayer(); M.center(); view.zoom = 1.6; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  M.close = function () { cancelAnimationFrame(raf); };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);

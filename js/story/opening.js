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
  // Scouts: three in a V, flying toward the gate. The camera starts wide and high, then dives in behind the leader.
  const DIR = (() => { const d = [26, 0, 230], l = Math.hypot(d[0], d[2]); return [d[0] / l, 0, d[2] / l]; })(), RGT = [DIR[2], 0, -DIR[0]];
  OP.scoutPath = function (i, t) {                          // t seconds; returns [x, y, z] of scout i (0 = leader)
    const off = [[0, 0, 0], [-13, 3, -14], [13, 1.5, -19]][i] || [0, 0, 0], v = 52, s0 = [-118, 31, -352];
    return [s0[0] + DIR[0] * v * t + RGT[0] * off[0] + DIR[0] * off[2], s0[1] + off[1] + Math.sin(t * 1.7 + i) * 0.8, s0[2] + DIR[2] * v * t + RGT[2] * off[0] + DIR[2] * off[2]];
  };
  OP.shotA = function (t) {                                 // camera for the flyover; t in seconds
    const L = OP.scoutPath(0, t), k = easeOut(clamp(t / 2.4, 0, 1)), back = lerp(190, 46, k), up = lerp(78, 17, k), side = lerp(-30, 7, k);
    const pos = [L[0] - DIR[0] * back + RGT[0] * side, L[1] + up, L[2] - DIR[2] * back + RGT[2] * side];
    const look = [L[0] + DIR[0] * lerp(120, 70, k), lerp(38, L[1] + 4, k), L[2] + DIR[2] * lerp(120, 70, k)];
    return { pos, target: look, fov: lerp(1.0, 0.92, k) };
  };

  /* ================= run control: one object that lets any wait be skipped ================= */
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
    studio = el('div', 'op-studio', '<div class="op-gate"><div class="op-gatehex">' + hexSVG('g') + '</div><p class="op-tap">' + T.tap + '<i lang="ja">' + T.tapJp + '</i></p></div>' +
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
  FX.fit = () => { const r = fxRoot.getBoundingClientRect(), W = Math.max(2, Math.round((r.width || 800) / 2)), H = Math.max(2, Math.round((r.height || 400) / 2)); if (fxc.width !== W || fxc.height !== H) { fxc.width = W; fxc.height = H; dust = []; } FX.W = W; FX.H = H; };
  FX.start = () => {
    if (FX.on) return; FX.on = true; fxRoot.hidden = false; fxLast = performance.now(); FX.fit();
    const tick = now => {
      if (!FX.on) return; const dt = Math.min(0.05, (now - fxLast) / 1000); fxLast = now; FX.t += dt;
      if (fxc.width !== Math.round(fxRoot.clientWidth / 2) && fxRoot.clientWidth) FX.fit();
      const g = fxg, W = FX.W, H = FX.H; if (g) { g.clearRect(0, 0, W, H); for (const f of FX.layers) { try { f(g, W, H, dt, FX.t); } catch (e) { console.warn('[opening] fx', e); } } }
      if (grainG && now - grainT > 80) { grainT = now; const id = grainG.createImageData(grain.width, grain.height), d = id.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.random() * 20; } grainG.putImageData(id, 0, 0); }
      fxRaf = requestAnimationFrame(tick);
    };
    fxRaf = requestAnimationFrame(tick);
  };
  FX.stop = () => { FX.on = false; cancelAnimationFrame(fxRaf); if (fxRoot) fxRoot.hidden = true; FX.layers.clear(); };
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
  const wireLayer = (H, getWires) => (g, W, Hh) => {         // ODM wires: thin steel lines from each Scout to a roof anchor
    g.lineCap = 'round';
    for (const w of getWires()) {
      const a = H.project(w.a[0], w.a[1], w.a[2]), b = H.project(w.b[0], w.b[1], w.b[2]); if (!a || !b || a.cw <= 0 || b.cw <= 0) continue;
      const ax = (a.cx / a.cw * 0.5 + 0.5) * W, ay = (1 - (a.cy / a.cw * 0.5 + 0.5)) * Hh, bx = (b.cx / b.cw * 0.5 + 0.5) * W, by = (1 - (b.cy / b.cw * 0.5 + 0.5)) * Hh;
      g.strokeStyle = 'rgba(12,12,16,.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = 'rgba(255,235,205,.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(ax + 0.6, ay - 0.6); g.lineTo(bx + 0.6, by - 0.6); g.stroke();
    }
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
  OP.intro = async function (run, H) {
    mountOnce(); UI.hideAll(); stage.hidden = false; stage.className = 'op-stage'; cutEl.className = 'op-cut on'; UI.fade.style.transitionDuration = '0s'; UI.fade.classList.remove('on'); OP.setBars('wide'); FX.start(); FX.layers.add(dustLayer);
    const has3D = !!H.has3D, TOTAL = 7300; let actors = [], wires = [], colossal = null, base0 = 0, fired = {};
    const A = root.__actors, PLS = (A && A.PLS) || 1;
    if (has3D) {                                             // set the scene while the screen is still black
      H.setHour(5.7); const p0 = OP.shotA(0); H.teleport(p0.pos[0], p0.pos[2]); H.cineOn(p0.pos, p0.target, p0.fov);
      for (let i = 0; i < 3; i++) { const q = OP.scoutPath(i, 0), a = A.add({ key: 'levi', kind: 'levi', x: q[0], z: q[2], yaw: Math.atan2(DIR[0], DIR[2]), scale: PLS * 3.4, idle: ['L:Corkscrew Evade', 'L:Front Twist Flip', 'L:Stylish Flip'][i], fly: 40 }); a.static = false; actors.push(a); }
      FX.layers.add(wireLayer(H, () => wires));
    }
    await run.wait(60);
    if (run.dead) return cleanup();
    stage.classList.add('on'); cutEl.classList.add('slow'); cutEl.classList.remove('on'); setTimeout(() => cutEl.classList.remove('slow'), 1400);   // fade up from black
    AU.wind(0.06); AU.drone(8, 55); const t0 = performance.now();
    const at = (ms, key, fn) => { if (!fired[key] && T_ >= ms) { fired[key] = 1; try { fn(); } catch (e) { console.warn('[opening] event', key, e); } } };
    let T_ = 0, shot = '', steam = null, hopT = -9;
    const setShot = s => { if (shot === s) return; shot = s; if (!has3D) return;
      if (s === 'B') {                                       // street level: three children look up at the wall
        actors.forEach(a => A.remove(a.id)); actors = []; wires = []; FX.layers.delete(dustLayer);
        H.setHour(5.4); H.teleport(0, -56); S.actors.clearAll();
        for (const [id, ox] of [['eren', -1.3], ['armin', 0.05], ['mikasa', 1.2]]) { try { S.actors.spawnNpc(id, ox, -52, 0); } catch (e) {} }
        colossal = S.actors.spawnColossal(0, 22, Math.PI, 82); if (colossal) { base0 = colossal.y; colossal.y = base0 - 26; }
      }
      if (s === 'C') H.teleport(0, -40);
    };
    await new Promise(done => {
      const loop = now => {
        if (run.dead) return done(); T_ = now - t0; const t = T_ / 1000;
        if (T_ < 3400) {
          setShot('A'); if (has3D) { const c = OP.shotA(t); H.cineOn(c.pos, c.target, c.fov); for (let i = 0; i < 3; i++) { const q = OP.scoutPath(i, t), a = actors[i]; if (a) { a.x = q[0]; a.z = q[2]; a.fly = q[1] - H.gh(q[0], q[2]); } }
            if (t - hopT > 0.9) { hopT = t; wires = actors.map((a, i) => { const q = OP.scoutPath(i, t); return { a: [q[0], q[1] - 0.5, q[2]], b: [q[0] + DIR[0] * 30, Math.max(14, q[1] - 12), q[2] + DIR[2] * 30] }; }); }
            else wires = wires.map((w, i) => { const q = OP.scoutPath(i, t); return { a: [q[0], q[1] - 0.5, q[2]], b: w.b }; }); }
          at(150, 'clink', () => AU.clink()); at(420, 'w1', () => AU.whoosh(1.9)); at(520, 'cap1', () => capShow(0)); at(1500, 'w2', () => AU.whoosh(1.6)); at(3050, 'cap1h', capHide);
        } else if (T_ < 5800) {
          if (!fired.cut1) { fired.cut1 = 1; cutEl.classList.add('on'); setShot('B'); AU.wind(0.02); AU.heartbeat(); requestAnimationFrame(() => requestAnimationFrame(() => cutEl.classList.remove('on'))); }
          const k = (T_ - 3400) / 2400; if (has3D) { H.cineOn(lerp3([0, 1.25, -58], [0, 1.55, -53], easeOut(k)), lerp3([0, 34, 0], [0, 66, 24], ease(k)), lerp(1.02, 0.84, k)); if (colossal) colossal.y = base0 - 26 * (1 - sstep(0.5, 1, k)); }
          at(3700, 'cap2', () => capShow(1)); at(3500, 'riser', () => AU.riser(2.4)); at(4350, 'l1', () => { AU.lightning(); UI.flash(500); UI.shake(900); steam = steamLayer(H, 0, 52, 20, performance.now() + 2400); FX.layers.add(steam); AU.steam(2.4); });
          at(5250, 'th', () => { AU.thud(1.1); UI.shake(900); }); at(5400, 'cap2h', capHide);
        } else if (T_ < 6650) {
          setShot('C'); if (!fired.imp) { fired.imp = 1; impact(has3D ? H : null); }
          const k = (T_ - 5800) / 850; if (has3D) H.cineOn(lerp3([7, 52, -46], [3, 58, -30], k), lerp3([0, 66, 20], [0, 68, 20], k), lerp(0.62, 0.34, ease(k)));
          at(5900, 'cap3', () => capShow(2, true));
        } else { return done(); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    // hard cut to black, one heartbeat of silence
    cutEl.classList.add('on'); cleanup(true); AU.wind(0); AU.stopMusic();
    if (!run.dead) { AU.heartbeat(); await run.wait(560); }
    function impact(HH) {
      doc.body.classList.add('op-invert'); setTimeout(() => doc.body.classList.remove('op-invert'), 96); UI.flash(260); UI.shake(1300); AU.lightning(); AU.thud(1.6);
      FX.layers.add(speedLines(performance.now() + 560)); if (steam) FX.layers.delete(steam);
    }
    function cleanup(keepStage) { FX.layers.delete(dustLayer); actors.forEach(a => A && A.remove(a.id)); actors = []; wires = []; if (!keepStage) { stage.hidden = true; } else { stage.hidden = true; } cap.className = 'op-cap'; }
    return run.dead ? 'skipped' : 'done';
  };

  /* ================= title: stamp, dock, menu ================= */
  function buildTitle() {
    const old = doc.getElementById('sv-title'); if (old) old.remove();
    titleEl = UI.addScreen('title', 'sv-title op-title', '');
    titleEl.dataset.state = 'docked';
    const shade = el('div', 'op-shade'), cover = el('div', 'op-cover');
    lockEl = el('div', 'op-lock', '<h1 class="op-wm"><span>ASHES</span><span>OF THE WALLS</span></h1><div class="op-kanji" lang="ja">' + T.stampJp + '</div><div class="op-rule"><i></i></div><p class="op-sub">' + T.sub + '<span lang="ja">' + T.subJp + '</span></p><p class="op-tag">' + T.tagline + '</p>');
    menuEl = el('nav', 'op-menu'); menuEl.setAttribute('aria-label', 'Main menu');
    T.menu.forEach((m, i) => {
      const b = el('button', 'op-item' + (m.locked ? ' locked' : ''), '<span class="op-slash"></span><span class="op-en">' + m.en + '</span><span class="op-jp" lang="ja">' + m.jp + '</span><small></small>');
      b.type = 'button'; b.dataset.act = m.act; b.style.setProperty('--i', i); if (m.locked) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('pointerenter', () => select(i, true)); b.addEventListener('focus', () => select(i, false)); b.addEventListener('click', () => activate(i)); menuEl.append(b);
    });
    descEl = el('aside', 'op-desc', '<b></b><span></span>');
    creditEl = el('p', 'op-credit'); verEl = el('span', 'op-ver'); const cb = el('button', 'op-cbtn', 'Credits<i lang="ja">制作</i>'); cb.type = 'button'; cb.onclick = () => UI._cb('credits');
    bandEl = el('footer', 'op-band', ''); const legal = el('p', 'op-fine'); bandEl.append(creditEl, legal, verEl, cb); bandEl._legal = legal;
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
  OP.ticker = function (lines) {
    clearInterval(OP._iv); if (!creditEl) return; if (!lines || !lines.length) { creditEl.textContent = ''; return; } let i = 0;
    const show = () => { creditEl.classList.add('out'); setTimeout(() => { creditEl.textContent = lines[i++ % lines.length]; creditEl.classList.remove('out'); }, 420); };
    creditEl.textContent = lines[i++ % lines.length]; OP._iv = setInterval(show, 4600);
  };
  OP.fill = function (info) {                                // menu labels that depend on saves and version
    const its = items(), cont = its.find(b => b.dataset.act === 'continue'), fmt = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
    const lt = info && info.latest; cont.classList.toggle('empty', !lt); cont.querySelector('small').textContent = lt ? [lt.name, lt.quest || 'Prologue', fmt(lt.playSec)].filter(Boolean).join(', ') : 'No saved file';
    cont._info = lt ? 'Continue as ' + [lt.name, lt.quest || 'Prologue', fmt(lt.playSec)].filter(Boolean).join(', ') + '.' : 'No saved file yet.';
    verEl.textContent = 'v' + ((info && info.version) || '') + ' · prototype'; bandEl._legal.textContent = (S.data && S.data.credits ? S.data.credits.disclaimer + ' ' : '') + T.byline + '.';
  };

  // The title screen shown from the stamp onward. fromStamp: it is already on a black screen with the lockup centred.
  OP.showTitle = function (info, o) {
    mountOnce(); o = o || {}; UI.hideAll(); OP.fill(info); titleLive = false; titleEl.hidden = false; UI.show('title'); FX.start(); FX.layers.add(dustLayer); OP.setBars('title');
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
    FX.layers.forEach(f => { if (f !== dustLayer) FX.layers.delete(f); });
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
      AU.init(); AU.wind(0); const run = OP.newRun(), ensured = H.ensure(); const key = e => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') run.skip(); };
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

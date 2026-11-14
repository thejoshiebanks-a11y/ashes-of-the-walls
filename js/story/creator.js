/* Ashes of the Walls — CHARACTER CREATOR (V1).
   Layout and feel follow the design reference: header with crest and title, category list on the left, option panel in the middle,
   view controls + camera modes + character info on the right, BACK and CONFIRM along the bottom, the Shiganshina wall behind.
   The character is the real teen on the real engine; the camera glides between DEFAULT / CLOSE UP / FULL BODY and moves by itself
   when a category needs it (face, hair and eyes close in; body, clothing and gear pull back). Every option is applied live. */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui, T = S.teen, AU = S.audio, doc = root.document, h = UI.h;
  const CR = S.creator = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------- tiny inline icon set (24x24, currentColor) ---------- */
  const IC = {
    base: '<circle cx="12" cy="8" r="4.2"/><path d="M4 21c.6-4.6 3.6-7 8-7s7.4 2.4 8 7z"/>',
    face: '<path d="M6 9c0-4 2.6-6 6-6s6 2 6 6v3c0 4-2.6 7-6 7s-6-3-6-7z"/><circle cx="9.5" cy="10.5" r=".9"/><circle cx="14.5" cy="10.5" r=".9"/><path d="M10 15c1.2.8 2.8.8 4 0"/>',
    hair: '<path d="M5 13c-1-6 3-10 7-10s8 4 7 10c-2-1-3.5-3-4-5-2 2-6 3-10 5z"/><path d="M6 14c.4 2.4 2.4 4 6 4s5.6-1.6 6-4" opacity=".6"/>',
    eyes: '<path d="M2 12c2.6-4.6 6-7 10-7s7.4 2.4 10 7c-2.6 4.6-6 7-10 7S4.6 16.6 2 12z"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    body: '<path d="M8 3h8l3 5-2.2 2L16 9v12H8V9l-.8 1L5 8z"/>',
    clothing: '<path d="M9 3l3 2.4L15 3l5 3-2.2 4L16 9v12H8V9l-1.8 1L4 6z"/><path d="M12 5.4V21"/>',
    gear: '<path d="M4 20L16 8M20 20L8 8"/><path d="M14.5 3.5l6 .5.5 6-3 .2-4-4z"/><path d="M9.5 3.5l-6 .5-.5 6 3 .2 4-4z"/>',
    emblem: '<path d="M12 2.5l8 3v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10v-6z"/><path d="M12 7v10M8 11h8"/>',
    voice: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9c1.4 1.4 1.4 4.6 0 6M18.6 6.4c3 2.8 3 8.4 0 11.2"/>',
    options: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/>',
    move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    male: '<circle cx="10" cy="14" r="5.5"/><path d="M14 10l6-6M15 4h5v5"/>',
    female: '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V22M8.5 18.5h7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', ring: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/>'
  };
  const svg = (name, cls) => { const e = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'); e.setAttribute('viewBox', '0 0 24 24'); e.setAttribute('class', 'tc-i ' + (cls || '')); e.setAttribute('aria-hidden', 'true'); e.innerHTML = IC[name] || ''; return e; };
  const CRESTSVG = {                                          // original crests (not artwork from any franchise)
    tower: '<path d="M7 20V9l-1.5-1V4h2.2v1.6h1.5V4h1.6v1.6h1.5V4h2.2v4L13 9v11z"/><path d="M10.5 20v-4a1.5 1.5 0 0 1 3 0v4M3 20h18"/>',
    flame: '<path d="M12 3c1 3.4 5 5.4 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.4.2 1.4.8 2 1.6 2.4C10.2 8 10.6 5.4 12 3z"/><path d="M12 18a2.2 2.2 0 0 0 2.2-2.2c0-1.2-1.2-1.8-2.2-3-1 1.2-2.2 1.8-2.2 3A2.2 2.2 0 0 0 12 18z"/>',
    key: '<circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="1.4"/><path d="M11 11l9 9M16 16l-2 2M18.5 18.5l-2 2"/>',
    rose: '<circle cx="12" cy="10" r="2"/><path d="M12 8c-3 0-5 1.8-5 4.2S9 16 12 16s5-1.4 5-3.8M7.6 6.5C9 4.6 11 4 12 4s3 .6 4.4 2.5M12 16v5M12 19c-2 0-3-1-4-2M12 18c2 0 3-1 4-2"/>',
    anvil: '<path d="M3 8h13c3 0 4 1.6 5 3-3 0-4 1-5 2.5H13l1.5 3H17v2.5H7V16.5h2.5L11 13.5 8 11H3z"/>',
    feather: '<path d="M20 4C11 4 5.5 9 5 17l-1 3M5 17c6 0 10-3 12-9M9 14c2.5 0 5-1 7-4M7.6 16.6c2-.2 4-.8 5.6-2.4"/>'
  };
  const crestSvg = (id, cls) => { const e = svg('emblem', cls); e.setAttribute('class', 'tc-i ' + (cls || '')); e.innerHTML = CRESTSVG[T.CRESTS[id]] || CRESTSVG.tower; return e; };
  const SIL = [                                               // body-type silhouettes
    '<path d="M32 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM22 22h20l2 22-4 .6V74h-6V50h-4v24h-6V44.6L20 44z"/>',
    '<path d="M32 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM20 22h24l3 22-5 1V74h-7V50h-6v24h-7V45l-5-1z"/>',
    '<path d="M32 6a6.4 6.4 0 1 1 0 12.800A6.4 6.4 0 0 1 32 6zM17 22h30l4 24-6 1.4V74h-8V52h-6v22h-8V47.400L13 46z"/>',
    '<path d="M32 3a5.4 5.4 0 1 1 0 10.800A5.4 5.4 0 0 1 32 3zM22 17h20l2 25-4 .6V76h-6V50h-4v26h-6V42.600L20 42z"/>'];

  /* ---------- helpers ---------- */
  const el = (tag, cls, ...kids) => h(tag, { class: cls }, ...kids);
  const btn = (cls, onclick, ...kids) => h('button', { type: 'button', class: cls, onclick }, ...kids);
  const css = c => c.css || (c.c ? 'rgb(' + c.c.map(x => Math.round(x * 255)).join(',') + ')' : '#444');

  /* ---------- the screen ---------- */
  CR.open = async function (o, onDone, onCancel) {
    const cfg = o.cfg || {}, d = o.draft, L = d.look = T.norm(d.look), dest = o.destiny, stage = Object.assign({}, o.stage); stage.yaw += 3.24;   // the view is turned so the camera looks down the street toward the sunset: trees, sky and roofs behind him   // stage = { x, z, gy, yaw }
    const A = S.actors, R = UI.R;
    const root_ = el('section', 'tc'); root_.id = 'tc'; root_.setAttribute('aria-label', 'Character creator');
    let tab = 'base', camMode = 'default', manual = false, busy = false, turn = false, panMode = false, zoomLvl = 0, destroyed = false;

    /* ---- header ---- */
    const crestImg = h('img', { class: 'tc-crest-img', alt: '', src: 'assets/ui/emblem.svg', onerror: e => { e.target.replaceWith(crestMain()); } });
    function crestMain() { const w = el('div', 'tc-crest-main'); w.innerHTML = '<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M32 3l26 9v22c0 17-11 28-26 35C17 62 6 51 6 34V12z" fill="rgba(8,8,10,.8)" stroke="#d9c7a0" stroke-width="2"/><path d="M32 9l20 7v18c0 13-8.500 22-20 28C20 56 12 47 12 34V16z" fill="none" stroke="#d9c7a0" stroke-width=".8" opacity=".7"/><path d="M19 49V26l-2-1.400v-5h3.600v2.400h2.600v-2.400h3.800v2.400h2.600v-2.400h3.600v5L36 26v23z" fill="#c8191f" stroke="#e8d8b4" stroke-width="1" opacity=".95"/><path d="M27.500 49v-7a4.500 4.500 0 0 1 9 0v7" fill="#0b0b0e"/><path d="M44 17c0 5-3 6-3 10 0 2.500 1.500 4 3.500 4s3.500-1.500 3.500-4c0-3-2-4-2.500-6-.8 1.200-1.200 2-1.200 2.800C43.800 22 44 19.500 44 17z" fill="#e8a33c" stroke="#fff2c8" stroke-width=".6"/></svg>'; return w; }
    const header = el('header', 'tc-head', el('div', 'tc-crest', crestImg), el('div', 'tc-title', el('h1', '', 'CHARACTER CREATOR'), el('p', '', 'CREATE · CUSTOMISE · DEPLOY')), el('div', 'tc-brand', el('b', '', 'ASHES'), el('span', '', 'OF THE WALLS')));

    /* ---- left: categories ---- */
    const TABS = [['base', 'BASE'], ['face', 'FACE'], ['hair', 'HAIR'], ['eyes', 'EYES'], ['body', 'BODY'], ['clothing', 'CLOTHING'], ['gear', 'GEAR'], ['emblem', 'EMBLEM'], ['voice', 'VOICE'], ['options', 'OPTIONS'], ['random', 'RANDOMISE']];
    const nav = el('nav', 'tc-nav'); nav.setAttribute('role', 'tablist');
    const navBtns = {};
    for (const [id, label] of TABS) { const b = btn('tc-nb', () => (id === 'random' ? randomise() : setTab(id)), svg(id === 'random' ? 'dice' : id, 'tc-ni'), el('span', 'tc-nl', label)); b.dataset.t = id; b.setAttribute('role', 'tab'); nav.append(b); navBtns[id] = b; }
    const back = btn('tc-back', () => leave(false), el('span', 'tc-back-ring', svg('ring')), el('span', '', 'BACK'));

    /* ---- middle panel ---- */
    const panel = el('div', 'tc-panel'), panelBody = el('div', 'tc-pbody'); panel.append(panelBody);
    const confirm = btn('tc-confirm', () => finish(), el('span', 'tc-cx', svg('x')), el('span', 'tc-ct', 'CONFIRM'));

    /* ---- right: view control, camera modes, character info ---- */
    const vbtn = (id, icon, label, fn) => { const b = btn('tc-vb', fn, svg(icon), el('span', '', label)); b.dataset.v = id; return b; };
    const bRot = vbtn('rot', 'rotate', 'ROTATE', () => { turn = !turn; bRot.classList.toggle('on', turn); });
    const bZoom = vbtn('zoom', 'zoom', 'ZOOM', () => { zoomLvl = (zoomLvl + 1) % 3; cam.zoomT = [1, .78, .58][zoomLvl]; bZoom.classList.toggle('on', zoomLvl > 0); });
    const bMove = vbtn('move', 'move', 'MOVE', () => { panMode = !panMode; bMove.classList.toggle('on', panMode); });
    const bReset = vbtn('reset', 'reset', 'RESET', () => { cam.panX = cam.panY = 0; cam.zoomT = 1; zoomLvl = 0; turn = false; yawT = stage.yaw + .35; manual = false; [bRot, bZoom, bMove].forEach(b => b.classList.remove('on')); panMode = false; setCamMode(AUTO[tab] || 'default', false); });
    const viewCtl = el('div', 'tc-box tc-view', el('h3', '', 'VIEW CONTROL'), bRot, bZoom, bMove, bReset);
    const camBtns = {};
    const camBox = el('div', 'tc-box tc-cam', el('h3', '', 'CAMERA MODE'));
    for (const [id, label] of [['default', 'DEFAULT'], ['close', 'CLOSE UP'], ['full', 'FULL BODY']]) { const b = btn('tc-cb', () => { manual = true; setCamMode(id, true); }, el('span', 'tc-radio'), el('span', '', label)); b.dataset.c = id; camBox.append(b); camBtns[id] = b; }
    const iName = el('b', 'tc-in'), iGender = el('b', 'tc-ig'), iHeight = el('b', 'tc-ih'), iBuild = el('b', 'tc-ib'), iAff = el('b', 'tc-ia'), iCode = el('b', 'tc-ic');
    const crestSlot = el('div', 'tc-info-crest');
    const infoBox = el('div', 'tc-box tc-info', el('h3', '', 'CHARACTER INFO'), el('div', 'tc-info-row', el('div', 'tc-info-l', el('p', '', el('span', '', 'Name'), iName), el('p', '', el('span', '', 'Gender'), iGender), el('p', '', el('span', '', 'Height'), iHeight), el('p', '', el('span', '', 'Build'), iBuild), el('p', '', el('span', '', 'Affiliation'), iAff)), crestSlot));
    const quote = el('div', 'tc-quote');
    const quotes = (cfg.tips || ['Gas is life.']); quote.textContent = '“' + quotes[Math.floor(Math.random() * quotes.length)] + '”';
    const right = el('aside', 'tc-right', viewCtl, camBox);
    const lower = el('div', 'tc-lower', infoBox, quote);

    /* ---- stage layers: drag surface, light flash, particles, vignette ---- */
    const drag = el('div', 'tc-drag'); drag.setAttribute('aria-label', 'Preview. Drag to turn your character, pinch to zoom.');
    const vig = el('div', 'tc-vig'), flash = el('div', 'tc-flash'), fxc = h('canvas', { class: 'tc-fx', 'aria-hidden': 'true' });
    const hint = el('p', 'tc-hint', el('span', '', 'DRAG'), ' turn', el('span', '', 'PINCH'), ' zoom', el('span', '', 'ESC'), ' back');
    root_.append(vig, drag, fxc, flash, header, nav, back, panel, confirm, right, lower, hint);
    R.insertBefore(root_, UI.fade); root_.classList.add('in');
    const tcEls = [header, nav, back, panel, confirm, right, lower, hint];
    tcEls.forEach((e, i) => { e.style.setProperty('--d', (1200 + i * 120) + 'ms'); });

    /* ================= camera ================= */
    const GOLD = 17.65;                                          // the creator is always golden hour
    const PRE = {                                                // metres on the 1.65 m teen: dist = camera distance, h = height looked at, fov = vertical field
      default: { dist: 3.3, h: 1.2, el: -.03, fov: .8, az: .26 },
      close: { dist: 2.3, h: 1.5, el: -.01, fov: .24, az: .36 },
      full: { dist: 4.3, h: 1.0, el: .0, fov: .78, az: .2 } };
    const AUTO = { base: 'default', face: 'close', hair: 'close', eyes: 'close', body: 'full', clothing: 'full', gear: 'full', emblem: 'default', voice: 'default', options: 'default' };
    const cam = { dist: 5.5, h: 1.0, el: .45, fov: .8, az: .0, panX: 0, panY: 0, zoom: 1, zoomT: 1, shift: .0, t: PRE.default };
    let a = null, yaw = stage.yaw + .35, yawT = yaw, swing = 0, pop = 0, popT = 0, last = performance.now(), raf = 0, introT = 0;
    const actor = () => A.player;
    function setCamMode(id, fromUser) { camMode = id; cam.t = PRE[id]; for (const k in camBtns) camBtns[k].classList.toggle('on', k === id); if (!fromUser) manual = false; }
    function freeShift() {                                       // NDC x of the middle of the free area between the option panel and the right column
      if (CR.shotShift != null) return CR.shotShift;
      const W = innerWidth, pr = panel.getBoundingClientRect().right, rl = right.offsetParent && right.getBoundingClientRect().width ? right.getBoundingClientRect().left : W - 4;
      return Math.max(0, Math.min(.7, ((pr + rl) / 2 / W) * 2 - 1));
    }
    function camFrame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now; a = actor(); if (root.ODM) root.ODM.hour = GOLD;
      if (a) {
        const worldH = a.baseScale ? a.baseScale * T.bodyHeight(a.key) : .3, hs = worldH / T.bodyHeight('teen'), k = 1 - Math.exp(-dt * 4.2), t = cam.t;
        introT = Math.min(1, introT + dt / 4.2); const ik = ease(introT);
        cam.dist += (t.dist - cam.dist) * k; cam.h += (t.h - cam.h) * k; cam.el += (t.el - cam.el) * k; cam.fov += (t.fov - cam.fov) * k; cam.az += (t.az - cam.az) * k; cam.zoom += (cam.zoomT - cam.zoom) * k;
        const sh = freeShift(); cam.shift += (sh - cam.shift) * k;
        const intro = (1 - ik), dist = Math.max((cam.dist * cam.zoom + intro * 3.8) * hs, .36), el_ = cam.el + intro * .3, fov = cam.fov + intro * .32;
        const tgt = [stage.x, stage.gy + (cam.h + cam.panY * .4) * hs, stage.z], az = stage.yaw + cam.az + intro * 1.1, ce = Math.cos(el_);
        let pos = [tgt[0] + Math.sin(az) * ce * dist, tgt[1] + Math.sin(el_) * dist, tgt[2] + Math.cos(az) * ce * dist];
        // slide the view so the character sits in the free area to the right of the panels
        const f = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]], fl = Math.hypot(f[0], f[1], f[2]) || 1, fz = f.map(v => v / fl);
        const rx = [fz[2], 0, -fz[0]], rl = Math.hypot(rx[0], rx[2]) || 1, rr = [rx[0] / rl, 0, rx[2] / rl], halfW = Math.tan(fov / 2) * dist * (innerWidth / innerHeight);
        const off = (cam.shift + cam.panX * .35) * halfW;
        const cn = root.__cine; cn.on = true; cn.pos = [pos[0] + rr[0] * off, pos[1], pos[2] + rr[2] * off]; cn.target = [tgt[0] + rr[0] * off, tgt[1], tgt[2] + rr[2] * off]; cn.fov = fov;
        // turntable / drag / equip animation
        if (turn) yawT += dt * .9; yaw += (yawT - yaw) * (1 - Math.exp(-dt * 9)); swing *= Math.exp(-dt * 5.5);
        a.yaw = yaw + swing;
        if (popT > 0) { popT = Math.max(0, popT - dt); const p = 1 - popT / .42; pop = Math.sin(p * Math.PI) * (1 - p * .4) * .055; if (a.baseScale) a.scale = a.baseScale * (1 + pop); if (!popT && a.baseScale) a.scale = a.baseScale; }
      }
      parts(dt); if (!destroyed) raf = requestAnimationFrame(camFrame);
    }
    /* drag to turn (or pan in MOVE mode), pinch / wheel to zoom */
    { const pts = new Map(); let pinch = 0;
      drag.addEventListener('pointerdown', e => { try { drag.setPointerCapture(e.pointerId); } catch (x) { } pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p[0] - q[0], p[1] - q[1]); } });
      drag.addEventListener('pointermove', e => { const o = pts.get(e.pointerId); if (!o) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) { const [p, q] = [...pts.values()], dd = Math.hypot(p[0] - q[0], p[1] - q[1]); if (pinch) { cam.zoomT = Math.min(1.5, Math.max(.45, cam.zoomT * pinch / dd)); } pinch = dd; return; }
        if (panMode) { cam.panX = Math.max(-1, Math.min(1, cam.panX + (e.clientX - o[0]) * .004)); cam.panY = Math.max(-1, Math.min(1, cam.panY - (e.clientY - o[1]) * .006)); } else { yawT += (e.clientX - o[0]) * .012; turn = false; bRot.classList.remove('on'); } });
      const up = e => { pts.delete(e.pointerId); pinch = 0; }; drag.addEventListener('pointerup', up); drag.addEventListener('pointercancel', up);
      drag.addEventListener('wheel', e => { e.preventDefault(); cam.zoomT = Math.min(1.5, Math.max(.45, cam.zoomT * (1 + Math.sign(e.deltaY) * .07))); }, { passive: false }); }

    /* ================= equip effect: pop, swing, light burst, embers ================= */
    const P = []; let fctx = null;
    function fit() { fxc.width = innerWidth; fxc.height = innerHeight; fctx = fxc.getContext('2d'); }
    /* golden-hour birds: small flocks drifting across the sky, drawn on the overlay canvas (wing-flap + gentle glide) */
    const BIRDS = []; { const flocks = [[.10, .16, 1, 5], [.62, .09, -1, 4], [.35, .27, 1, 3]]; flocks.forEach(([fx0, fy0, dir, n], fi) => { for (let i = 0; i < n; i++) BIRDS.push({ x: fx0 + i * .035 * dir * -1 + Math.random() * .02, y: fy0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * .022 + Math.random() * .01, v: dir * (.022 + fi * .006 + Math.random() * .004), s: .55 + Math.random() * .5 + fi * .12, ph: Math.random() * 6.28, fr: 7 + Math.random() * 3, w: Math.random() * 6.28 }); }); }
    function birds(dt) {
      if (!fctx) return; const W = fxc.width, H = fxc.height, u = H / 100; fctx.save(); fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      for (const b of BIRDS) {
        b.x += b.v * dt; b.ph += b.fr * dt; b.w += dt * .7; if (b.x > 1.08) b.x = -.08; else if (b.x < -.08) b.x = 1.08;
        const x = b.x * W, y = (b.y + Math.sin(b.w) * .012) * H, sz = (1.0 + b.s * 1.7) * u, f = Math.sin(b.ph), up = f * sz * .75, dir = b.v > 0 ? 1 : -1;
        fctx.strokeStyle = 'rgba(38,26,22,' + (.55 + b.s * .3) + ')'; fctx.lineWidth = Math.max(1, sz * .2); fctx.beginPath();
        fctx.moveTo(x - sz, y - up * .9 + sz * .15); fctx.quadraticCurveTo(x - sz * .5, y - Math.abs(up) * .2 - sz * .32 - up * .5, x, y); fctx.quadraticCurveTo(x + sz * .5, y - Math.abs(up) * .2 - sz * .32 - up * .5, x + sz, y - up * .9 + sz * .15); fctx.stroke();
        fctx.fillStyle = 'rgba(38,26,22,.8)'; fctx.beginPath(); fctx.ellipse(x + dir * sz * .08, y + sz * .06, sz * .16, sz * .08, 0, 0, 6.283); fctx.fill();
      }
      fctx.restore();
    }
    function parts(dt) {
      if (!fctx) return; fctx.clearRect(0, 0, fxc.width, fxc.height); birds(dt); if (!P.length) return;
      for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += dt; if (p.t > p.life) { P.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 18 * dt; const q = 1 - p.t / p.life; fctx.globalAlpha = q * q; fctx.fillStyle = p.c; fctx.beginPath(); fctx.arc(p.x, p.y, p.r * (.4 + q * .6), 0, 6.283); fctx.fill(); }
      fctx.globalAlpha = 1;
    }
    function equipFx(strength) {
      const W = innerWidth, H = innerHeight, cx = W * (.5 + cam.shift * .5), cy = H * (camMode === 'close' ? .42 : .5);
      popT = .42; swing += (Math.random() < .5 ? -1 : 1) * .5 * (strength || 1);
      flash.style.setProperty('--x', cx + 'px'); flash.style.setProperty('--y', cy + 'px'); flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      const n = Math.round(26 * (strength || 1)), u = H / 100;
      for (let i = 0; i < n; i++) { const an = Math.random() * 6.283, sp = (6 + Math.random() * 16) * u; P.push({ x: cx + Math.cos(an) * 6 * u, y: cy + (Math.random() - .3) * 12 * u, vx: Math.cos(an) * sp * .5, vy: -Math.abs(Math.sin(an)) * sp * 1.1, r: (.35 + Math.random() * .6) * u * .6, life: .7 + Math.random() * .7, t: 0, c: Math.random() < .6 ? '#ffd99a' : '#ff7a3c' }); }
    }

    /* ================= state -> actor, info card ================= */
    const sync = () => { try { o.onChange && o.onChange(d); } catch (e) { console.warn('[creator] apply failed', e); } };
    function info() {
      iName.textContent = d.name.trim() || '—'; iGender.textContent = 'Male'; iHeight.textContent = T.heightCm(L) + ' cm'; iBuild.textContent = T.buildName(L); iAff.textContent = 'Civilian, Shiganshina'; iCode.textContent = T.code(L).toUpperCase();
      crestSlot.textContent = ''; if (L.showCrest !== 0) crestSlot.append(crestSvg(L.crest, 'tc-crest-sm'));
    }
    /* default character -> built-up reveal: clay mannequin, then skin and eyes, then hair, then clothes */
    const revT = []; function endReveal() { if (!T.reveal) return; T.reveal = null; revT.forEach(clearTimeout); revT.length = 0; sync(); }
    function startReveal() { T.reveal = { st: 0 }; sync(); [[1500, 1, .9], [2400, 2, 1], [3300, 3, 1.5]].forEach(([ms, st, fx]) => revT.push(setTimeout(() => { if (!T.reveal || destroyed) return; if (st >= 3) T.reveal = null; else T.reveal = { st }; sync(); equipFx(fx); AU.menuTick && AU.menuTick(); }, ms))); }
    function set(k, v, fx) { endReveal(); L[k] = v; sync(); info(); paint(); if (fx !== false) { equipFx(fx === 'big' ? 1.5 : 1); AU.menuTick && AU.menuTick(); } }
    function setMany(obj, fx) { endReveal(); const nb = obj.base !== undefined && obj.base !== L.base; Object.assign(L, obj); sync(); info(); if (nb) renderTab(); paint(); if (fx !== false) { equipFx(1.6); AU.menuTick && AU.menuTick(); } }

    /* ================= option widgets ================= */
    const sec = (title, ...kids) => el('section', 'tc-sec', title ? el('h4', '', title) : null, ...kids);
    const grid = (key, items, cls) => { const g = el('div', 'tc-grid ' + (cls || '')); items.forEach((it, i) => { const b = btn('tc-card' + (it.locked ? ' lock' : ''), () => pick(key, it.i !== undefined ? it.i : i, it), it.img ? h('img', { src: it.img, alt: it.name, loading: 'lazy', draggable: 'false', onerror: e => e.target.replaceWith(el('span', 'tc-ph', it.name)) }) : it.node || el('span', 'tc-ph', it.name), el('span', 'tc-tick', svg('check')), it.locked ? el('span', 'tc-lock', svg('lock')) : null); if (it.locked) b.dataset.note = it.note || ''; b.dataset.k = key; b.dataset.v = it.i !== undefined ? it.i : i; b.setAttribute('aria-label', it.name); b.title = ''; g.append(b); }); return g; };
    const pick = (key, i, it) => {
      if (key === 'preset') { setMany(Object.assign({}, T.preset(i), { crest: L.crest, gear: L.gear })); return; }
      if (it && it.locked) { toast2('Locked. ' + (it.note || 'Unlocks during missions')); return; }
      set(key, i, it && it.fx);
    };
    const sw = (key, cols, cls) => { const g = el('div', 'tc-sw ' + (cls || '')); cols.forEach((c, i) => { const b = btn('tc-s', () => set(key, i), el('i', '', '')); b.firstChild.style.background = css(c); b.dataset.k = key; b.dataset.v = i; b.setAttribute('aria-label', c.name); g.append(b); }); return g; };
    const slider = (key, label, fmt) => {
      const inp = h('input', { type: 'range', class: 'tc-range', min: 0, max: 100, step: 1, value: Math.round(L[key] * 100), 'aria-label': label });
      const val = el('b', 'tc-sv'), step = dd => () => { L[key] = Math.max(0, Math.min(1, L[key] + dd)); sync(); info(); paint(); popT = .3; };
      const upd = () => { val.textContent = fmt(L[key]); inp.value = Math.round(L[key] * 100); inp.style.setProperty('--p', Math.round(L[key] * 100) + '%'); };
      inp.addEventListener('input', () => { L[key] = inp.value / 100; sync(); info(); upd(); }); inp.addEventListener('change', () => { popT = .3; });
      const row = el('div', 'tc-row', el('label', '', label), btn('tc-ar', step(-.05), svg('left')), inp, btn('tc-ar', step(.05), svg('right')), val); row._upd = upd; row.dataset.s = key; upd(); return row;
    };
    const toggle = (key, label) => { const b = btn('tc-tog', () => set(key, L[key] ? 0 : 1), el('i', '', svg('check')), el('span', '', label)); b.dataset.k = key; b.dataset.tg = '1'; return b; };
    const chips = (key, items) => {
      const g = el('div', 'tc-chips');
      items.forEach((n, i) => {
        const onclick = () => {
          if (key === 'wear') { d.wear = i; sync(); paint(); equipFx(.8); }
          else if (key === 'voice') { d.voice = items[i].id; paint(); AU.menuTick && AU.menuTick(); }
        };
        const b = btn('tc-chip', onclick, n.name || n); b.dataset.k = key; b.dataset.v = i; g.append(b);
      });
      return g;
    };
    let toastT = 0; const tip = el('div', 'tc-tip'); root_.append(tip);
    function toast2(msg) { if (!msg) return; tip.textContent = msg; tip.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => tip.classList.remove('on'), 2400); }
    const thumb = (kind, i) => 'assets/teen/ui/' + kind + '_' + i + '.webp';

    /* ================= tab contents ================= */
    const TABV = {
      base() {
        const nameIn = h('input', { type: 'text', class: 'tc-input', id: 'tc-name', maxlength: 16, value: d.name, placeholder: 'Enter a name', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': 'Name' });
        nameIn.addEventListener('input', () => { d.name = nameIn.value; info(); nameIn.classList.remove('bad'); });
        const dice = btn('tc-mini', () => { const pool = (S.destiny && S.destiny.NAMES && S.destiny.NAMES.m) || ['Emil']; d.name = pool[Math.floor(Math.random() * pool.length)]; nameIn.value = d.name; info(); AU.menuTick && AU.menuTick(); }, svg('dice'));
        const pres = grid('preset', T.PRESETS.map((p, i) => ({ name: p.name, img: thumb('preset', i), fx: 'big', i, base: p.base || 0 })).filter(x => x.base === (L.base | 0)), 'tc-g5 presets');
        return [sec('NAME', el('div', 'tc-namerow', nameIn, dice)), sec('CHARACTER MODEL', el('div', 'tc-seg', ...[['Realistic', 0], ['Anime', 1]].map(([n, v]) => { const b = btn('tc-segb' + ((L.base | 0) === v ? ' on' : ''), () => { if ((L.base | 0) === v) return; const hs = T.hairsFor(v); setMany({ base: v, hair: hs.some(x => x.i === L.hair) ? L.hair : hs[0].i, outfit: 0, gear: 0 }); }, el('span', '', n)); b.dataset.k = 'base'; b.dataset.v = v; return b; }))), sec('BASE PRESETS', pres),
          sec('GENDER', el('div', 'tc-gender', btn('tc-g on', () => { }, svg('male'), el('span', '', 'MALE')), (() => { const b = btn('tc-g off', () => toast2('The young female base is not in this build yet.'), svg('female'), el('span', '', 'FEMALE'), el('span', 'tc-lock', svg('lock'))); return b; })())),
          sec('BODY TYPE', grid('bodyType', T.BODYTYPES.map((b, i) => { const n = el('span', 'tc-sil'); n.innerHTML = '<svg viewBox="0 0 64 80">' + SIL[i] + '</svg>'; return { name: b.name, node: n }; }), 'tc-g4 bodies')),
          sec('', slider('height', 'HEIGHT', v => T.heightCm({ height: v }) + ' cm'), slider('build', 'BUILD', v => Math.round(v * 100) + '%'), el('div', 'tc-row tc-swrow', el('label', '', 'SKIN TONE'), sw('skin', T.SKIN))),
          sec('PREVIEW OPTIONS', el('div', 'tc-togs', toggle('showCrest', 'Show Emblem')))];
      },
      face() { return [(L.base | 0) === 1 ? sec('FACE', el('p', 'tc-note', 'The anime model has one hand-painted face. Skin tone and head size are below.')) : sec('FACE SHAPE', grid('face', T.FACES.map((f, i) => ({ name: f.name, img: thumb('face', i) })), 'tc-g5')), sec('SKIN TONE', sw('skin', T.SKIN, 'big')), sec('HEAD', slider('head', 'HEAD SIZE', v => Math.round(T.headScale({ head: v }) * 100) + '%'))]; },
      hair() { return [sec('HAIR STYLE', grid('hair', T.hairsFor(L.base | 0).map(x => ({ name: (L.base | 0) === 1 && x.h.bname || x.h.name, img: thumb('hair', x.i), i: x.i })), 'tc-g5')), sec('HAIR COLOUR', sw('hairCol', T.HAIRCOL, 'big')), sec('', slider('shade', 'SHADE', v => v < .4 ? 'Darker' : v > .6 ? 'Lighter' : 'Natural'))]; },
      eyes() { return [sec('EYE COLOUR', sw('eyes', T.EYES, 'big round')), sec('', el('p', 'tc-note', 'All characters begin with black eyes and hair. Choose a colour any time.'))]; },
      body() { return [sec('BODY TYPE', grid('bodyType', T.BODYTYPES.map((b, i) => { const n = el('span', 'tc-sil'); n.innerHTML = '<svg viewBox="0 0 64 80">' + SIL[i] + '</svg>'; return { name: b.name, node: n }; }), 'tc-g4 bodies')),
        sec('', slider('height', 'HEIGHT', v => T.heightCm({ height: v }) + ' cm'), slider('build', 'BUILD', v => Math.round(v * 100) + '%'), slider('head', 'HEAD SIZE', v => Math.round(T.headScale({ head: v }) * 100) + '%'))]; },
      clothing() {
        const dye = (k, label) => el('div', 'tc-row tc-swrow', el('label', '', label), sw(k, T.DYE));
        return [sec('OUTFIT', grid('outfit', T.OUTFITS.map((x, i) => ({ name: x.name, img: thumb('outfit', i), locked: x.locked && !T.isUnlocked(x), note: x.note })), 'tc-g4 outfits tall')),
          sec('COLOURS (CASUAL ONLY)', dye('top', 'TOP'), dye('pants', 'TROUSERS'), dye('boots', 'BOOTS'), dye('accent', 'BELT & TRIM')),
          sec('WEAR', chips('wear', cfg.wear || ['Clean', 'Lived-in', 'Weathered'])), sec('', el('div', 'tc-togs', toggle('cloak', 'Show Cloak / Hood')))]; },
      gear() { return [sec('MANEUVER GEAR', grid('gear', [{ name: 'None', img: thumb('gear', 0) }, { name: 'ODM gear', img: thumb('gear', 1), locked: !T.gearUnlocked(), note: T.GEARLOCK.note }], 'tc-g4 tall')), sec('', el('p', 'tc-note', 'ODM gear unlocks after you finish training.'))]; },
      emblem() { return [sec('CREST', grid('crest', T.CRESTS.map((c, i) => { const n = el('span', 'tc-crestcard'); n.append(crestSvg(i, 'tc-crest-card')); return { name: T.CRESTNAMES[i], node: n }; }), 'tc-g5')), sec('', el('div', 'tc-togs', toggle('showCrest', 'Show on registry card')))]; },
      voice() { return [sec('VOICE', chips('voice', T.VOICES)), sec('', el('p', 'tc-note', 'How you sound when you speak up in conversation.'))]; },
      options() {
        const diffs = cfg.difficulties || [], cards = el('div', 'tc-diffs');
        diffs.forEach((df, i) => { const b = btn('tc-diff', () => { d.difficulty = df.id; paint(); AU.menuTick && AU.menuTick(); }, el('b', '', df.name), el('span', '', df.text)); b.dataset.k = 'difficulty'; b.dataset.v = df.id; cards.append(b); });
        const an = dest && dest.anchor ? dest.anchor : null;
        return [sec('DIFFICULTY', cards), an ? sec('REGISTRY FILE', el('p', 'tc-note', 'Family, lineage and your Anchor ' + (an.name ? '(' + an.name + ') ' : '') + 'are written down by the registry. They are not chosen.')) : null]; }
    };
    function renderTab() {
      panelBody.textContent = ''; const nodes = (TABV[tab] || TABV.base)(); for (const n of nodes) if (n) panelBody.append(n); panelBody.scrollTop = 0; panelBody.classList.remove('swap'); void panelBody.offsetWidth; panelBody.classList.add('swap'); paint();
    }
    /* selection state of every widget, from the draft */
    function paint() {
      root_.querySelectorAll('.tc-panel [data-k]').forEach(e => {
        const k = e.dataset.k; let on = false;
        if (e.dataset.tg) on = !!(k === 'showCrest' ? L.showCrest !== 0 : L[k]);
        else if (k === 'wear') on = d.wear === +e.dataset.v; else if (k === 'voice') on = d.voice === T.VOICES[+e.dataset.v].id; else if (k === 'difficulty') on = d.difficulty === e.dataset.v;
        else if (k === 'preset') on = false; else on = L[k] === +e.dataset.v;
        e.classList.toggle('on', on); e.setAttribute('aria-pressed', String(on));
      });
      root_.querySelectorAll('.tc-panel [data-s]').forEach(e => e._upd && e._upd());
    }
    function setTab(id) {
      if (id === tab && panelBody.childElementCount) return; tab = id; for (const k in navBtns) navBtns[k].classList.toggle('on', k === id);
      if (!manual) setCamMode(AUTO[id] || 'default'); else manual = false, setCamMode(AUTO[id] || 'default'); renderTab(); AU.menuTick && AU.menuTick();
    }
    function randomise() {
      if (busy) return; busy = true; navBtns.random.classList.add('on'); const seed = (Math.random() * 4294967296) >>> 0; const r = T.random(seed); r.crest = L.crest; setMany(r, true); equipFx(1.8); turn = false; yawT += Math.PI * 2 * (Math.random() < .5 ? 1 : -1) * .5;
      setTimeout(() => { busy = false; navBtns.random.classList.remove('on'); }, 600);
    }

    /* ================= finish / leave ================= */
    async function leave(ok) { if (destroyed) return; destroyed = true; T.reveal = null; revT.forEach(clearTimeout); cancelAnimationFrame(raf); removeEventListener('keydown', keys); removeEventListener('resize', fit); root_.classList.add('out'); await sleep(260); root_.remove(); ok ? onDone(d) : onCancel(); }
    function finish() {
      if (!d.name.trim()) { setTab('base'); const n = doc.getElementById('tc-name'); if (n) { n.classList.add('bad'); n.focus(); } confirm.classList.remove('shake'); void confirm.offsetWidth; confirm.classList.add('shake'); toast2('Enter a name to continue.'); return; }
      const O = T.OUTFITS[L.outfit]; if ((O && O.locked && !T.isUnlocked(O)) || (L.gear && !T.gearUnlocked())) { L.outfit = O && O.locked && !T.isUnlocked(O) ? 0 : L.outfit; L.gear = T.gearUnlocked() ? L.gear : 0; sync(); }
      AU.select && AU.select(); equipFx(2); confirm.classList.add('done'); setTimeout(() => leave(true), 520);
    }
    function keys(e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) { if (e.key === 'Enter') { e.target.blur(); } return; }
      const ids = TABS.map(t => t[0]).filter(t => t !== 'random'), i = ids.indexOf(tab);
      if (e.key === 'ArrowDown') { setTab(ids[(i + 1) % ids.length]); e.preventDefault(); } else if (e.key === 'ArrowUp') { setTab(ids[(i + ids.length - 1) % ids.length]); e.preventDefault(); }
      else if (e.key === 'Escape') leave(false); else if (e.key === 'Enter' && (!e.target || e.target === doc.body || e.target === root_ || e.target === drag)) finish(); else if (e.key === 'r' || e.key === 'R') randomise();
    }
    addEventListener('keydown', keys); addEventListener('resize', fit); fit();

    /* ================= start ================= */
    CR.state = { d, L, cam, skipIntro: () => { introT = 1; endReveal(); }, snap: () => { introT = 1; endReveal(); const t = cam.t; Object.assign(cam, { dist: t.dist, h: t.h, el: t.el, fov: t.fov, az: t.az, zoom: cam.zoomT, shift: freeShift() }); yaw = yawT; swing = 0; }, setYaw: v => { yaw = yawT = stage.yaw + v; swing = 0; },  get tab() { return tab; }, setTab, setCamMode, randomise, equipFx, finish, leave, root: root_ };
    info(); navBtns.base.classList.add('on'); setCamMode('default'); renderTab(); if (o.reveal === false) sync(); else startReveal();
    root.__cine.on = true; last = performance.now(); raf = requestAnimationFrame(camFrame);
    return CR.state;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CR;
})(typeof window !== 'undefined' ? window : globalThis);

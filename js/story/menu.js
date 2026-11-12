/* Ashes of the Walls — launch flow, game title screen and main menu (v0.9.0).
   boot -> loading -> studio logo -> 3D title (tap to continue) -> main menu (Jean, sunset Shiganshina).
   The Colossal cinematic is NOT part of launch any more: it plays after NEW GAME -> confirm -> character creator (see OP.cinematic in opening.js). */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui, AU = S.audio, OP = S.opening, doc = root.document, M = S.menu = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fmtTime = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };

  /* ---- the scene: golden-hour Shiganshina; Jean on a rooftop looking at the Wall ---- */
  const CFG = M.cfg = root.__menuCfg || {
    hour: 18.0,
    title: { pos: [-70, 30, -262], target: [6, 33, 0], fov: 0.82, drift: 7 },
    jean: { x: -141, z: -287, y: 8.4, yaw: 0.35, turn: 0, meters: 1.74 },
    menu: { pos: [-139.8, 9.6, -291.5], target: [-144.4, 10.0, -271.9], fov: 0.62 },
  };
  const BLEND = 4200;
  const D = { stage: 'off', t0: 0, blend: null, jean: null, live: false, sel: 0, items: [], modal: null, info: { latest: null, version: '' }, ready: false };
  const titlePose = t => {
    const c = CFG.title, d = [c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]], L = Math.hypot(d[0], d[1], d[2]), u = d.map(v => v / L), k = Math.sin(t * .045) * c.drift, side = Math.sin(t * .031) * c.drift * .35;
    return { pos: [c.pos[0] + u[0] * k + side, c.pos[1] + Math.sin(t * .05) * 1.4, c.pos[2] + u[2] * k], target: [c.target[0] + Math.sin(t * .04) * 4, c.target[1] + Math.sin(t * .06) * 1.2, c.target[2]], fov: c.fov * (1 + Math.sin(t * .03) * .015) };
  };
  const menuPose = t => {
    const c = CFG.menu; return { pos: [c.pos[0] + Math.sin(t * .21) * .05, c.pos[1] + Math.sin(t * .17) * .025, c.pos[2] + Math.cos(t * .19) * .04], target: [c.target[0] + Math.sin(t * .13) * .5, c.target[1] + Math.sin(t * .11) * .12, c.target[2]], fov: c.fov };
  };
  M.cam = function (now) {
    const t = (now - (D.t0 || now)) / 1000, a = titlePose(t);
    if (D.stage !== 'menu' && D.stage !== 'menu-sub' && !D.blend) return a;            // off / title / loading: always the title shot (never a glimpse of the menu scene)
    const b = menuPose(t); if (!D.blend) return b;
    const k = ease(clamp((now - D.blend) / BLEND, 0, 1)); if (k >= 1) return b;
    const arc = Math.sin(k * Math.PI) * 4.5;                                              // the move lifts a little over the roofs, then settles behind Jean
    return { pos: a.pos.map((v, i) => lerp(v, b.pos[i], k) + (i === 1 ? arc : 0)), target: a.target.map((v, i) => lerp(v, b.target[i], k)), fov: lerp(a.fov, b.fov, k) };
  };

  /* ---- DOM ---- */
  const wings = () => { let a = '', b = ''; for (let k = 0; k < 4; k++) { const tx = 1.5 + k * 1.7, ty = 3 + k * 3.6, y1 = 8 + k * 2.5; a += `M11 ${y1}L${tx} ${ty}L11 ${y1 + 3.2}Z`; b += `M13 ${y1}L${24 - tx} ${ty}L13 ${y1 + 3.2}Z`; } return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="' + a + b + '"/></svg>'; };
  const stroke = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const ICON = {
    new: wings(), continue: stroke('<polygon points="6 4 20 12 6 20 6 4"/>'),
    character: stroke('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    options: stroke('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    extras: stroke('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  };
  let root_, listEl, logoEl, tapEl, modalEl, canvas, cg, newsEl, loadEl, tagEl;
  function build() {
    if (root_) return; const R = UI.R;
    root_ = el('div', 'mn'); root_.hidden = true; root_.dataset.s = 'off';
    root_.innerHTML =
      '<div class="mn-shade"></div><canvas class="mn-fx" aria-hidden="true"></canvas>' +
      '<div class="mn-mark" aria-hidden="true">' + wings() + '</div>' +
      '<h1 class="mn-logo"><img src="assets/ui/game_logo.webp" alt="Ashes of the Walls" draggable="false"></h1>' +
      '<div class="mn-title" aria-label="Ashes of the Walls"><div class="mn-tlw"><img class="mn-tl" src="assets/ui/title_letters.webp" alt="Ashes of the Walls" draggable="false"></div><div class="mn-jp">壁の灰燼</div><i class="mn-rule"></i></div>' +
      '<button class="mn-tap" type="button"><span>Tap to continue</span></button>' +
      '<p class="mn-legal"></p>' +
      '<nav class="mn-list" role="menu" aria-label="Main menu"></nav>' +
      '<p class="mn-tag">Fight for Humanity…</p>' +
      '<aside class="mn-news"><img src="assets/ui/emblem.webp" alt="" draggable="false"><div><b>Welcome to Ashes of the Walls</b><span>Stand, fight, and protect what remains.</span></div></aside>' +
      '<footer class="mn-bar"><span class="mn-ver"></span><span class="mn-prompt"><kbd class="mn-key">⏎</kbd><em>Select</em></span></footer>' +
      '<div class="mn-modal" hidden></div>';
    const fx = root_.querySelector('.mn-fx'); canvas = fx; cg = fx.getContext('2d');
    listEl = root_.querySelector('.mn-list'); logoEl = root_.querySelector('.mn-logo'); tapEl = root_.querySelector('.mn-tap'); modalEl = root_.querySelector('.mn-modal'); newsEl = root_.querySelector('.mn-news'); tagEl = root_.querySelector('.mn-tag');
    root_.querySelector('.mn-legal').textContent = 'ASHES OF THE WALLS is an unofficial, non-commercial fan project.<br>Inspired by the manga “Attack on Titan” by Hajime Isayama, published by Kodansha. Not affiliated with or endorsed by its creators or publishers.<br>© 2026 Joshie Sama. All rights belong to their respective owners.';
    R.insertBefore(root_, UI.fade || null);
    tapEl.addEventListener('click', onTap); root_.addEventListener('pointerdown', e => { if (D.stage === 'title' && !e.target.closest('.mn-modal')) onTap(); });
    doc.addEventListener('keydown', onKey, true);
    root.addEventListener('resize', () => { sizeCanvas(); fit(); }); sizeCanvas();
  }
  function fit() {                                           // small landscape phones: never let the tagline collide with the list
    if (!root_ || !listEl || !tagEl) return; root_.classList.remove('tight'); const l = listEl.getBoundingClientRect(), t = tagEl.getBoundingClientRect(), b = root_.querySelector('.mn-bar').getBoundingClientRect();
    if (l.bottom > t.top - 6 || l.bottom > b.top - 4) root_.classList.add('tight');
  }
  const sizeCanvas = () => { if (!canvas) return; const d = Math.min(root.devicePixelRatio || 1, 1.5); canvas.width = Math.round(root.innerWidth * d); canvas.height = Math.round(root.innerHeight * d); canvas._d = d; };

  /* menu items depend on what exists: nothing leads nowhere */
  function buildItems() {
    const has = !!D.info.latest, defs = [['new', 'New Game'], has && ['continue', 'Continue'], has && ['character', 'Character'], ['options', 'Settings'], ['extras', 'Extras']].filter(Boolean);
    listEl.textContent = ''; D.items = [];
    defs.forEach(([act, label], i) => {
      const b = el('button', 'mn-item', '<i class="mn-ic">' + ICON[act] + '</i><i class="mn-em">' + wings() + '</i><span class="mn-t">' + label + '</span>' + (act === 'continue' ? '<small></small>' : '')); b.type = 'button'; b.dataset.act = act; b.style.setProperty('--i', i); b.setAttribute('role', 'menuitem');
      if (act === 'continue') { const l = D.info.latest; b.querySelector('small').textContent = [l.name, l.quest || 'Prologue', fmtTime(l.playSec)].filter(Boolean).join(' · '); }
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && D.stage === 'menu' && !D.modal) select(i, true); });
      b.addEventListener('click', () => { if (D.stage !== 'menu' || D.modal) return; select(i, false); activate(act); });
      listEl.append(b); D.items.push(b);
    });
    select(0, false, true);
    root_.querySelector('.mn-ver').textContent = 'v' + (D.info.version || '');
  }
  function promptGlyph() { const k = root_.querySelector('.mn-key'), e = root_.querySelector('.mn-prompt em'); if (D.pad) { k.textContent = 'A'; k.className = 'mn-key pad'; e.textContent = 'Select'; } else if (root.matchMedia && root.matchMedia('(pointer: coarse)').matches) { k.textContent = '☝'; k.className = 'mn-key touch'; e.textContent = 'Tap to select'; } else { k.textContent = '⏎'; k.className = 'mn-key'; e.textContent = 'Select'; } }
  function select(i, snd, silent) {
    i = (i + D.items.length) % D.items.length; if (i === D.sel && !silent && D.items[i].classList.contains('sel')) return;
    D.items.forEach((b, k) => { b.classList.toggle('sel', k === i); b.setAttribute('aria-selected', k === i); }); D.sel = i; if (snd) AU.hover();
  }

  /* ---- modals (new game confirm, character sheet, extras) ---- */
  function modal(o) {
    D.modal = o; modalEl.hidden = false; modalEl.textContent = '';
    const card = el('div', 'mn-card'); card.append(el('h2', '', o.title)); if (o.body) { const p = el('div', 'mn-body'); if (typeof o.body === 'string') p.textContent = o.body; else p.append(o.body); card.append(p); }
    const row = el('div', 'mn-btns'); o.buttons.forEach((bd, i) => { const b = el('button', 'mn-btn' + (bd.primary ? ' pri' : ''), bd.text); b.type = 'button'; b.onclick = () => { AU.select(); bd.run && bd.run(); }; b.onpointerenter = () => AU.hover(); row.append(b); if (i === (o.focus || 0)) setTimeout(() => b.focus?.({ preventScroll: true }), 30); });
    card.append(row); modalEl.append(card); void modalEl.offsetWidth; modalEl.classList.add('in'); root_.classList.add('dim');
  }
  function closeModal() { D.modal = null; modalEl.classList.remove('in'); root_.classList.remove('dim'); setTimeout(() => { if (!D.modal) modalEl.hidden = true; }, 220); }
  const kv = rows => { const t = el('dl', 'mn-kv'); rows.forEach(([k, v]) => { t.append(el('dt', '', k), el('dd', '', v)); }); return t; };
  const cap = s => (s || '').toString().replace(/^./, c => c.toUpperCase());

  const sub = () => { D.stage = 'menu-sub'; root_.hidden = true; };
  async function activate(act) {
    const F = S.flow; AU.select();
    if (act === 'new') return modal({ title: 'Begin a new game?', body: D.info.latest ? 'You will create a new character. Your existing saves are not touched and stay available under Continue.' : 'You will create your character, then the story begins.',
      buttons: [{ text: 'Begin', primary: true, run: async () => { closeModal(); await M.leave(true); F.newGame(); } }, { text: 'Back', run: closeModal }], focus: 1 });
    if (act === 'continue') { sub(); return F.openSaves(); }
    if (act === 'options') { sub(); return UI.optionsPanel(() => M.back()); }
    if (act === 'character') {
      let pl = null; try { const k = await F.latestKey(); const snap = k && await F.readSave(k); pl = snap && snap.state && snap.state.player; } catch (e) { }
      const l = D.info.latest || {};
      return modal({ title: pl ? pl.name : 'Character', body: pl ? kv([['Role', 'Recruit, Wall Maria'], ['Bloodline', cap(pl.bloodline && (pl.bloodline.name || pl.bloodline.id || pl.bloodline))], ['Difficulty', cap(pl.difficulty)], ['Progress', l.quest || 'Prologue'], ['Time played', fmtTime(l.playSec)]]) : 'No character found.', buttons: [{ text: 'Close', primary: true, run: closeModal }] });
    }
    if (act === 'extras') {
      const b = el('div', 'mn-sub'); const add = (t, d, f) => { const x = el('button', 'mn-row', '<b>' + t + '</b><span>' + d + '</span>'); x.type = 'button'; x.onclick = () => { AU.select(); f(); }; x.onpointerenter = () => AU.hover(); b.append(x); };
      add('Credits', 'Who made what, and the licences', () => { closeModal(); sub(); UI.credits(S.data.credits, () => M.back()); });
      add('Back up saves', 'Download all saves as a file', () => F.exportSaves());
      add('Restore saves', 'Load a backup file', () => F.importSaves());
      return modal({ title: 'Extras', body: b, buttons: [{ text: 'Close', primary: true, run: closeModal }] });
    }
  }

  /* ---- input ---- */
  function onKey(e) {
    if (!D.live || !root_ || root_.hidden) return; const k = e.code;
    if (D.stage === 'title') { if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); onTap(); } return; }
    if (D.stage !== 'menu') return;
    if (D.modal) { if (k === 'Escape') { e.preventDefault(); closeModal(); } return; }
    if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); select(D.sel + 1, true); } else if (k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); select(D.sel - 1, true); }
    else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); activate(D.items[D.sel].dataset.act); }
  }
  let padHeld = {}, padRaf = 0;
  function pollPad() {
    padRaf = D.live ? requestAnimationFrame(pollPad) : 0; const gp = (navigator.getGamepads && [...navigator.getGamepads()].find(Boolean)); if (!gp) return; if (!D.pad) { D.pad = true; promptGlyph(); }
    const on = (n, v) => { const was = padHeld[n]; padHeld[n] = v; return v && !was; }, ax = gp.axes[1] || 0, b = gp.buttons;
    const up = on('u', (b[12] && b[12].pressed) || ax < -.6), dn = on('d', (b[13] && b[13].pressed) || ax > .6), ok = on('a', b[0] && b[0].pressed), bk = on('b', b[1] && b[1].pressed);
    if (D.stage === 'title' && (ok || on('s', b[9] && b[9].pressed))) onTap();
    else if (D.stage === 'menu') { if (D.modal) { if (bk) closeModal(); return; } if (up) select(D.sel - 1, true); if (dn) select(D.sel + 1, true); if (ok) activate(D.items[D.sel].dataset.act); }
  }

  /* ---- stages ---- */
  const setStage = s => { D.stage = s; root_.dataset.s = s === 'menu-sub' ? 'menu' : s; };
  async function onTap() {
    if (D.stage !== 'title') return; D.stage = 'busy'; AU.unlock(); AU.select(); AU.wind(0.07); AU.music('title');
    D.blend = performance.now(); root_.classList.add('go'); tapEl.blur?.();
    await sleep(1900); setStage('menu'); fit(); root_.classList.add('menu-in'); await sleep(2200);
    D.items[D.sel] && D.items[D.sel].focus?.({ preventScroll: true });
  }
  M.back = function () {                                     // from options / credits / saves: straight back to the menu
    UI.hideAll(); root_.hidden = false; setStage('menu'); D.items[D.sel] && D.items[D.sel].focus?.({ preventScroll: true }); closeModal();
  };

  /* Jean */
  async function placeJean() {
    const J = CFG.jean; await root.__actors.loadModel('jean').catch(() => null); if (!root.__actors.has('jean')) return null;
    const a = root.__actors.add({ key: 'jean', kind: 'aot', x: J.x, z: J.z, yaw: J.yaw + (J.turn || 0), vg: J.y, skipRe: /weapon|sword|quiver|bow|heixian|jianto|gongjian|xinhao|juren|wuqi/i,
      scale: S.actors.scaleFor((root.__actors.bodyHeight && root.__actors.bodyHeight('jean')) || 1.74, J.meters), idle: 'J:idle', npcId: 'menu_jean' });
    a.wind = { dir: [-.8, -.6], str: 1, parts: { cape: { prim: 3, k: .26, top: 1.58, span: .64, flutter: .55 }, hair: { prim: 0, k: .05, top: 1.77, span: .2, flutter: .7 } } };
    a.poseFn = idlePose; D.jean = a; return a;
  }
  /* living idle: breathing, a slow weight shift, the head drifting along the skyline, the arms hanging loose (added on top of the baked idle clip) */
  function idlePose(pz, a) {
    const bi = root.__actors.bi; if (!bi) return; const t = performance.now() * .001, d = pz.d;
    const prev = idlePose.prev || (idlePose.prev = {}), add = (n, x, y, z) => { const k = bi('Bip001 ' + n); if (k === undefined) return; const i = k * 3, p = prev[k] || (prev[k] = [0, 0, 0]);       // the pose buffer can persist between frames: take back last frame's offset first so nothing accumulates
      d[i] += x - p[0]; d[i + 1] += y - p[1]; d[i + 2] += z - p[2]; p[0] = x; p[1] = y; p[2] = z; };
    const br = Math.sin(t * 1.55), sh = Math.sin(t * .23), look = Math.sin(t * .27) * .6 + Math.sin(t * .11 + 1) * .4;
    add('Spine', sh * .012, 0, br * .006); add('Spine1', sh * .01, 0, br * .008); add('Spine2', -sh * .006, br * .004, br * .012);
    add('Neck', look * .02, 0, 0); add('Head', look * .07, Math.sin(t * .19) * .012, Math.sin(t * .31) * .02 - br * .004);
    add('L Clavicle', 0, br * .012, 0); add('R Clavicle', 0, br * .012, 0);
    add('L UpperArm', Math.sin(t * .9) * .012, 0, Math.sin(t * 1.1 + 1) * .01); add('R UpperArm', Math.sin(t * .8 + 2) * .012, 0, Math.sin(t * 1.0) * .01);
    if (D.jean) { D.jean.vg = CFG.jean.y + br * .0035; D.jean.yaw = CFG.jean.yaw + (CFG.jean.turn || 0) + sh * .018; }
  }
  function removeJean() { if (D.jean) { root.__actors.remove(D.jean.id); D.jean = null; } }

  /* effects: birds + the foreground banner */
  let birds = [], nextBird = 3, fxT = 0, fxRaf = 0, lastFx = 0;
  function spawnFlock() { const n = 3 + (Math.random() * 4 | 0), y = .08 + Math.random() * .3, dir = Math.random() < .5 ? 1 : -1, sc = .6 + Math.random() * .8; for (let i = 0; i < n; i++) birds.push({ x: dir > 0 ? -.05 - i * .018 : 1.05 + i * .018, y: y + (Math.random() - .5) * .05 + i * .006, v: dir * (.03 + Math.random() * .015), s: sc * (.8 + Math.random() * .4), ph: Math.random() * 6 }); }
  function drawBird(g, x, y, s, ph) { const w = Math.sin(ph) * .9, L = 9 * s; g.beginPath(); g.moveTo(x - L, y - w * L * .8); g.quadraticCurveTo(x - L * .4, y - L * (.2 + w * .2), x, y); g.quadraticCurveTo(x + L * .4, y - L * (.2 + w * .2), x + L, y - w * L * .8); g.quadraticCurveTo(x + L * .4, y + L * .05, x, y + L * .15); g.quadraticCurveTo(x - L * .4, y + L * .05, x - L, y - w * L * .8); g.fill(); }
  let embers = []; const EMB = () => ({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .9, ph: Math.random() * 6.28, hot: Math.random() < .55 });
  function fxLoop(now) {
    fxRaf = D.live ? requestAnimationFrame(fxLoop) : 0; const dt = Math.min(.05, (now - (lastFx || now)) / 1000); lastFx = now; fxT += dt; if (!cg) return;
    const W = canvas.width, H = canvas.height, d = canvas._d || 1; cg.clearRect(0, 0, W, H);
    if ((nextBird -= dt) <= 0) { spawnFlock(); nextBird = 7 + Math.random() * 10; }
    if (!embers.length) for (let i = 0; i < 46; i++) embers.push(EMB());
    const gust = 1 + .5 * Math.sin(fxT * .8) + .25 * Math.sin(fxT * 2.1 + 1);
    for (const e of embers) {                                                          // drifting ash and embers: the wind carries them toward the screen's right, rising slowly
      e.x += (-.018 * e.z * gust) * -1 * dt + Math.sin(fxT * .7 + e.ph) * .0016 * e.z; e.y += (-.012 * e.z) * dt + Math.sin(fxT * 1.3 + e.ph) * .0012; e.ph += dt;
      if (e.x > 1.04 || e.y < -.05) { e.x = -.04; e.y = .3 + Math.random() * .75; }
      const r = (.7 + e.z * 1.5) * d, a = e.hot ? .55 : .35, g = cg.createRadialGradient(e.x * W, e.y * H, 0, e.x * W, e.y * H, r * 2.2);
      g.addColorStop(0, e.hot ? 'rgba(255,170,90,' + a + ')' : 'rgba(230,220,205,' + a * .8 + ')'); g.addColorStop(1, 'rgba(255,140,60,0)'); cg.fillStyle = g; cg.fillRect(e.x * W - r * 2.2, e.y * H - r * 2.2, r * 4.4, r * 4.4);
    }
    cg.fillStyle = 'rgba(12,10,10,.72)';
    birds = birds.filter(b => b.x > -.1 && b.x < 1.1); for (const b of birds) { b.x += b.v * dt; b.y += Math.sin(fxT * .6 + b.ph) * .0006; b.ph += dt * 9; drawBird(cg, b.x * W, b.y * H, b.s * d, b.ph); }
  }

  /* ---- public: run the whole launch ---- */
  async function loadAll(H) {
    const bar = loadEl.querySelector('i'); let p = 0, done = false; const tick = setInterval(() => { p = Math.min(.94, p + (1 - p) * .04); bar.style.transform = 'scaleX(' + p + ')'; }, 90);
    await Promise.all([OP.fontsReady ? Promise.race([OP.fontsReady(), sleep(2500)]) : 0, H.ensureMenu(), sleep(2600)]); clearInterval(tick); bar.style.transform = 'scaleX(1)'; await sleep(250);
  }
  M.run = async function (H) {
    build(); D.live = false; UI.hideAll(); UI.fade.classList.add('on');
    loadEl = el('div', 'mn-load', '<div class="mn-ka"><img src="assets/ui/key_art.webp" alt="" draggable="false"></div><div class="mn-lbar"><i></i></div>'); UI.R.insertBefore(loadEl, UI.fade); loadEl.style.opacity = '1';
    UI.fade.classList.remove('on'); await loadAll(H);
    loadEl.classList.add('out'); await sleep(500); loadEl.remove();
    // studio logo (blue identity, name only), 2-5 s
    const st = doc.querySelector('.op-studio'); st.querySelectorAll('.op-pres,.op-legal,.op-gate').forEach(n => n.remove()); st.hidden = false; st.className = 'op-studio logo q'; void st.offsetWidth;
    let skip = false; const sk = () => { skip = true; AU.unlock(); }; st.addEventListener('pointerdown', sk); doc.addEventListener('keydown', sk, { once: true });
    st.classList.add('go'); for (let i = 0; i < 40 && !(skip && i > 8); i++) await sleep(100);                           // ~4 s, tap skips after 0.8 s
    const cover = el('div', 'mn-cover'); UI.R.insertBefore(cover, UI.fade); D.cover = cover; void cover.offsetWidth; cover.classList.add('in');       // solid black from here until the title is fully placed: no glimpse of the scene
    st.classList.add('out'); const pre = H.prepMenu(); await sleep(800); st.hidden = true; st.remove(); await pre;
    await M.enter({ stage: 'title' });
  };

  /* title (stage 'title') or straight to the menu (returning from a screen) */
  M.enter = async function (o) {
    o = o || {}; build(); const H = S.openingHost; D.info = H.info(); try { root_.querySelector('.mn-legal').innerHTML = (S.data.credits && S.data.credits.disclaimer) || ''; } catch (e) { }
    buildItems(); promptGlyph(); D.t0 = performance.now(); D.blend = null; D.live = true; root_.hidden = false; root_.classList.remove('go', 'menu-in', 'dim'); closeModal(); modalEl.hidden = true;
    if (!D.jean) { try { await placeJean(); } catch (e) { console.warn('[menu] Jean unavailable', e); } }
    root.ODM.hour = CFG.hour; if (D.jean) { D.jean.x = CFG.jean.x; D.jean.z = CFG.jean.z; D.jean.vg = CFG.jean.y; } setStage(o.stage || 'title'); if (D.stage === 'menu') { D.blend = D.t0 - 5000; root_.classList.add('go', 'menu-in'); }
    if (!fxRaf) { lastFx = 0; fxRaf = requestAnimationFrame(fxLoop); } if (!padRaf) padRaf = requestAnimationFrame(pollPad);
    UI.fade.classList.remove('on'); await sleep(60); root_.classList.add('show'); fit();
    if (D.cover) { const c = D.cover; D.cover = null; void c.offsetWidth; c.classList.remove('in'); c.classList.add('out'); setTimeout(() => c.remove(), 2000); }
    if (D.stage === 'menu') { AU.wind(0.07); AU.music('title'); await sleep(900); D.items[D.sel] && D.items[D.sel].focus?.({ preventScroll: true }); }
  };
  M.showMenu = info => { if (info) D.info = Object.assign(D.info, info); return M.enter({ stage: 'menu' }); };
  M.leave = async function (fade) {                           // tidy everything the title scene created
    if (!D.live) return; if (fade) await UI.fadeTo(true, 650); D.live = false; D.stage = 'off';
    root_.classList.remove('show', 'go', 'menu-in', 'dim'); root_.hidden = true; birds = []; removeJean(); closeModal(); D.blend = null;
    root.__actors && root.__actors.clear && 0;
  };
  M.stage = () => D.stage; M.state = D;

  /* ---- hooks into the existing flow ---- */
  OP.runOpening = M.run; OP.hideTitle = () => { M.leave(false); };
  UI.title = info => M.showMenu(info);
  const showOld = UI.show; UI.show = function (id) { if (id === 'title' && D.live) return M.back(); return showOld.apply(this, arguments); };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);

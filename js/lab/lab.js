/* Character Lab: a controlled preview of a playable character on the real engine, real clips and real ground.
   Preview mode (default): the engine is frozen, the actor idles / walks / runs on a loop path, orbit camera follows.
   Drive mode: the engine's own player controller (keys / stick) moves the same actor, exactly as in the game. */
(function (root) {
  'use strict';
  const doc = root.document, $ = s => doc.querySelector(s), sleep = ms => new Promise(r => setTimeout(r, ms));
  const KEY = 'teen';
  // HEIGHT RULE (from the user): the teen is half the height of a Shiganshina door. A door there is ~0.70 x Levi's height (measured on the
  // user's screenshot: door 167 px vs Levi 252 px at almost the same depth, corrected for the 8% depth difference), so teen = 0.70 / 2 = 0.35 x Levi.
  const DOOR_OVER_LEVI = 0.70, TEEN_DOOR_DIVISOR = 2;
  const L = root.LAB = { key: KEY, mode: 'idle', cam: { az: 0, el: 0.1, dist: 2.45, h: 0.78, fov: 0.78 }, drive: false, ready: false, log: [] };
  const log = m => { L.log.push(m); console.info('[lab]', m); };
  const A = () => root.__actors, W = () => root.__world;

  const ok = () => !!(root.__ready && root.__E && root.__st && root.ODM && root.ODM.ready && root.__world && root.__actors && root.__actors.loadModel);
  async function waitReady() { for (let i = 0; i < 600 && !ok(); i++) await sleep(150); if (!ok()) throw new Error('engine did not finish loading'); }

  /* ---- a flat, unobstructed patch of ground for the preview ---- */
  function clearAt(x, z) {
    const w = W(), y = w.gh(x, z); if (!isFinite(y)) return false; if (w.inCanal && w.inCanal(x, z)) return false;
    if (w.cast([x, y + 1, z], [0, 1, 0], 6)) return false;
    for (let a = 0; a < 360; a += 30) { const d = [Math.cos(a * Math.PI / 180), 0, Math.sin(a * Math.PI / 180)]; if (w.cast([x, y + .8, z], d, 5)) return false; }
    for (let a = 0; a < 360; a += 45) { const yy = w.gh(x + Math.cos(a * Math.PI / 180) * 4, z + Math.sin(a * Math.PI / 180) * 4); if (!isFinite(yy) || Math.abs(yy - y) > .15) return false; }
    return true;
  }
  function findSpot() {
    const seeds = [[0, -38], [0, -20], [20, -30], [-20, -30], [0, 10], [30, 0], [-30, 0], [0, 40], [40, 40], [-40, 40], [60, -30], [-60, -30]];
    for (const [sx, sz] of seeds) for (let r = 0; r <= 40; r += 4) for (let a = 0; a < 360; a += 45) { const x = sx + Math.cos(a * Math.PI / 180) * r, z = sz + Math.sin(a * Math.PI / 180) * r; if (clearAt(x, z)) return [x, z]; }
    return [0, -38];
  }

  function leviHeight() { const M = root.__MDX && root.__MDX.levi; let lo = 1e9, hi = -1e9; for (const p of M.prims) { const a = p.pos0; for (let i = 1; i < a.length; i += 3) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } } return hi - lo; }
  /* ---- actor ---- */
  function spawn() {
    const info = root.__LAB.info[KEY], PLS = A().PLS, leviH = leviHeight() * PLS, doorH = DOOR_OVER_LEVI * leviH, targetH = doorH / TEEN_DOOR_DIVISOR, sc = targetH / info.bodyHeight;
    L.leviH = leviH; L.doorH = doorH; L.teenH = targetH;
    const [x, z] = L.spot;
    L.actor = A().add({ key: KEY, kind: 'rig', x, z, yaw: 0, scale: sc, look: null, speed: 0 });
    L.actor.tintFn = null; L.actor.speedK = (sc * info.bodyHeight) / 1.75; L.home = [x, z]; L.scale = sc; L.worldH = sc * info.bodyHeight;
    log('spawned ' + KEY + ' scale ' + sc.toFixed(3) + ' at ' + x.toFixed(1) + ',' + z.toFixed(1));
  }
  const PATH_R = 2.2, NWP = 16;
  function loopPath(speed) {
    const [cx, cz] = L.home, a = L.actor; a.walk = speed; a.pi = 0; a.wait = 0;
    // a circle that starts under the actor so the first leg is a normal step
    a.walk = speed * a.speedK; a.path = []; for (let i = 0; i < NWP; i++) { const t = (i / NWP) * Math.PI * 2; a.path.push([cx + Math.sin(t) * PATH_R, cz - PATH_R + Math.cos(t) * PATH_R]); }
    a.x = a.path[0][0]; a.z = a.path[0][1];
  }
  function setMode(m) {
    L.mode = m; const a = L.actor; if (!a) return;
    if (L.drive) return;
    if (m === 'idle') { a.path = null; a.walk = 0; a.x = L.home[0]; a.z = L.home[1]; }
    else loopPath(m === 'walk' ? 1.1 : 3.0);          // effective speeds: the game's actor clip thresholds are in 'human-size' units; speedK rescales them to his size          // 1.1 m/s -> 'Standard Walk'; 3.0 m/s -> 'Jog Forward' (engine thresholds in actorClip)
    doc.querySelectorAll('#labMain button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.a === m)));
  }

  /* ---- camera ---- */
  const PRESET = { full: { el: .1, dist: 2.45, h: .78 }, face: { el: .04, dist: 2.3, h: 1.33, fov: .2 }, side: { az: 1.5708, el: .08, dist: 2.45, h: .78 }, back: { az: 3.1416, el: .1, dist: 2.45, h: .78 } };
  function camUpdate() {
    const a = L.actor, c = L.cam; if (!a || L.drive) return;
    const gy = a.gy === undefined ? W().gh(a.x, a.z) : a.gy, hs = L.worldH / 1.52;
    const tgt = [a.x, gy + c.h * hs, a.z], yaw = (c.follow ? a.yaw : 0) + c.az;
    const d = Math.max(c.dist * hs, .36), ce = Math.cos(c.el), pos = [tgt[0] + Math.sin(yaw) * ce * d, tgt[1] + Math.sin(c.el) * d, tgt[2] + Math.cos(yaw) * ce * d];
    const cn = root.__cine; cn.on = true; cn.pos = pos; cn.target = tgt; cn.fov = c.fov;
  }
  function setCam(name) { const p = PRESET[name]; Object.assign(L.cam, { az: 0.0, fov: .78 }, p); L.cam.follow = name === 'side' || name === 'back' ? false : false; L.camName = name; }
  function bindInput() {
    const cv = $('#c'); let drag = null, pinch = null;
    const pts = new Map();
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p[0] - q[0], p[1] - q[1]); } });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; const o = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [p, q] = [...pts.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (pinch) L.cam.dist = Math.min(6, Math.max(.7, L.cam.dist * pinch / d)); pinch = d; return; }
      L.cam.az -= (e.clientX - o[0]) * .009; L.cam.el = Math.min(1.2, Math.max(-.15, L.cam.el + (e.clientY - o[1]) * .006));
    });
    const up = e => { pts.delete(e.pointerId); pinch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); L.cam.dist = Math.min(6, Math.max(.7, L.cam.dist * (1 + Math.sign(e.deltaY) * .08))); }, { passive: false });
    doc.querySelectorAll('#labMain button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.a)));
    doc.querySelectorAll('#labCam button').forEach(b => b.addEventListener('click', () => setCam(b.dataset.c)));
    let rot = 0;
    doc.querySelectorAll('#labRot button').forEach(b => {
      const s = () => { rot = +b.dataset.r; }, e = () => { rot = 0; };
      b.addEventListener('pointerdown', s); b.addEventListener('pointerup', e); b.addEventListener('pointerleave', e); b.addEventListener('pointercancel', e);
    });
    (function tick() { if (rot && L.actor && !L.drive && L.mode === 'idle') L.actor.yaw += rot * .045; requestAnimationFrame(tick); })();
    $('#bRef').addEventListener('click', toggleRef);
  }

  /* ---- customisation: which parts are visible (actor.skipRe), how they are coloured (actor.tintFn) and how the body is shaped (actor.morph) ----
     Every option is a real switch on real geometry, a real colour on the engine's tint path, or a real bone-length/thickness morph. A character is the combination. */
  const OUTFITS = ['Peasant', 'Ranger', 'Scout', 'Modern'], HAIRS = ['Messy', 'SimpleParted', 'Buzzed', 'Bowl', 'Side', 'Crew', 'Pomp'];
  const HAIR_NAMES = ['Messy', 'Parted', 'Buzzed', 'Bowl cut', 'Side part', 'Crew cut', 'Pompadour'];
  const C = (n, r, g, b) => [n, [r / 255, g / 255, b / 255]];
  const HAIRCOL = [C('Black', 22, 20, 22), C('Dark brown', 70, 44, 28), C('Brown', 112, 72, 42), C('Chestnut', 140, 78, 40), C('Auburn', 150, 60, 32), C('Ginger', 190, 90, 40), C('Blond', 220, 180, 100), C('Platinum', 235, 228, 205), C('Silver', 190, 195, 205), C('Navy', 36, 52, 110), C('Teal', 30, 130, 130), C('Rose', 205, 90, 130)];
  const EYECOL = [C('Black', 20, 16, 16), C('Dark brown', 80, 48, 28), C('Hazel', 130, 100, 40), C('Green', 60, 140, 80), C('Blue', 70, 110, 190), C('Grey', 130, 138, 150), C('Amber', 200, 140, 40), C('Violet', 130, 80, 180)];
  const SKIN = [C('Porcelain', 255, 255, 255), C('Fair', 255, 232, 214), C('Warm', 250, 215, 178), C('Olive', 226, 186, 140), C('Tan', 200, 150, 105), C('Brown', 150, 100, 70), C('Deep', 104, 68, 50)];
  const DYE = [['Original', null], C('Cream', 232, 220, 190), C('Brown', 118, 82, 52), C('Charcoal', 60, 60, 66), C('Forest', 52, 98, 58), C('Navy', 48, 66, 130), C('Crimson', 160, 40, 44), C('Ochre', 200, 150, 50), C('Plum', 110, 56, 120), C('Slate', 100, 116, 130), C('White', 240, 240, 240)];
  const BUILD = [['Average', 1], ['Short', .94], ['Tall', 1.06]];
  const STEP = [['Much less', .86], ['Less', .93], ['Average', 1], ['More', 1.07], ['Much more', 1.14]], HEAD = [['Small', .93], ['Average', 1], ['Large', 1.07]];
  // dye slot of every outfit part
  const SLOT = { top: ['Body', 'Arms', 'ArmsBracer'], pants: ['Legs'], boots: ['Feet', 'FeetBoots', 'Boots'], accent: ['AccPauldron', 'BodyBelt1', 'BodyBelt2', 'HeadHood', 'Cloak', 'Hands'] };
  const slotOf = m => { const part = m.replace(/^Outfit_[A-Za-z]+_/, ''); for (const k in SLOT) if (SLOT[k].includes(part)) return k; return null; };
  L.look = { outfit: 0, hair: 0, hairCol: 0, eyes: 0, skin: 0, top: 0, pants: 0, boots: 0, accent: 0, gear: 0, extra: 0, build: 0, head: 1, leg: 2, arm: 2, torso: 2, shoulder: 2, chest: 2, waist: 2, hip: 2 };
  const ST = () => STEP.map(x => x[0]);
  const ROWS = [['outfit', 'Outfit', () => OUTFITS.map(x => x === 'Scout' ? 'Scout Regiment (unlock)' : x), OUTFITS.length], ['hair', 'Hair style', () => HAIR_NAMES, HAIRS.length], ['hairCol', 'Hair colour', () => HAIRCOL.map(x => x[0]), HAIRCOL.length], ['eyes', 'Eye colour', () => EYECOL.map(x => x[0]), EYECOL.length], ['skin', 'Skin tone', () => SKIN.map(x => x[0]), SKIN.length],
    ['top', 'Top dye', () => DYE.map(x => x[0]), DYE.length], ['pants', 'Pants dye', () => DYE.map(x => x[0]), DYE.length], ['boots', 'Boots dye', () => DYE.map(x => x[0]), DYE.length], ['accent', 'Accent dye', () => DYE.map(x => x[0]), DYE.length],
    ['extra', 'Hood / cloak', () => ['Off', 'On'], 2], ['gear', 'ODM gear', () => ['Off', 'On'], 2], ['build', 'Height', () => BUILD.map(x => x[0]), BUILD.length], ['head', 'Head size', () => HEAD.map(x => x[0]), HEAD.length],
    ['leg', 'Leg length', ST, 5], ['arm', 'Arm length', ST, 5], ['torso', 'Torso length', ST, 5], ['shoulder', 'Shoulders', ST, 5], ['chest', 'Chest', ST, 5], ['waist', 'Waist', ST, 5], ['hip', 'Hips', ST, 5]];
  function applyLook() {
    const a = L.actor, k = L.look; if (!a) return;
    const outfit = OUTFITS[k.outfit], hair = 'Hair_' + HAIRS[k.hair], hood = outfit === 'Ranger' && k.extra, cloak = outfit === 'Scout' && k.extra;
    a.skipRe = { test: m => {
      if (m === 'Face' || m === 'Iris' || m === 'EyeShine' || m === 'Scalp' || m === 'Skull') return false;
      if (/^Face_\d$/.test(m)) return true;
      if (m.startsWith('Hair_')) return m !== hair || !!hood;                          // hair is hidden under a hood
      if (m === 'Outfit_Ranger_HeadHood') return !hood;
      if (m === 'Outfit_Scout_Cloak') return !cloak;
      if (m.startsWith('Outfit_')) return !m.startsWith('Outfit_' + outfit + '_') && m !== 'Outfit_' + outfit;
      if (m.startsWith('Gear_')) return !k.gear;
      return true; } };
    const hc = HAIRCOL[k.hairCol][1], ec = EYECOL[k.eyes][1], sk = SKIN[k.skin][1], dyes = { top: DYE[k.top][1], pants: DYE[k.pants][1], boots: DYE[k.boots][1], accent: DYE[k.accent][1] };
    a.tintFn = m => {
      if (m === 'Face') return k.skin ? [sk[0], sk[1], sk[2], 0] : null;
      if (m === 'Iris') return [ec[0], ec[1], ec[2], .82];
      if (m === 'Scalp' || m.startsWith('Hair_')) return [hc[0], hc[1], hc[2], .93];
      if (m.startsWith('Outfit_')) { const d = dyes[slotOf(m)]; return d ? [d[0], d[1], d[2], .62] : null; }
      return null; };
    a.scale = L.scale * BUILD[k.build][1]; a.headScale = HEAD[k.head][1];
    a.morph = { leg: STEP[k.leg][1], arm: STEP[k.arm][1], torso: STEP[k.torso][1], shoulder: STEP[k.shoulder][1], chest: STEP[k.chest][1], waist: STEP[k.waist][1], hip: STEP[k.hip][1] };
    L.desc = ROWS.map(r => r[2]()[k[r[0]]]).join('|'); L.code = ROWS.map(r => k[r[0]].toString(36)).join('');
    if (L.panel) L.panel.querySelectorAll('[data-v]').forEach(e => { const r = ROWS.find(q => q[0] === e.dataset.k); e.textContent = r[2]()[k[r[0]]]; });
  }
  const bump = (key, d) => { const r = ROWS.find(q => q[0] === key); L.look[key] = (L.look[key] + d + r[3]) % r[3]; applyLook(); };
  function randomise(seed) {
    let x = (seed == null ? Math.random() * 1e9 : seed) >>> 0; const rnd = n => { x = (Math.imul(x ^ x >>> 15, 2246822519) + 1013904223) >>> 0; x ^= x >>> 13; return (x >>> 8) % n; };
    for (const r of ROWS) L.look[r[0]] = rnd(r[3]); applyLook(); return L.code;
  }
  function bindLook() {
    const p = L.panel = doc.createElement('div'); p.id = 'labPanel'; p.hidden = true;
    p.innerHTML = ROWS.map(r => `<div class="row"><span>${r[1]}</span><button data-k="${r[0]}" data-d="-1" aria-label="Previous ${r[1]}">&#9664;</button><b data-k="${r[0]}" data-v></b><button data-k="${r[0]}" data-d="1" aria-label="Next ${r[1]}">&#9654;</button></div>`).join('') + '<div class="row"><button id="bRand" class="wide">Randomise</button></div>';
    $('#lab').appendChild(p);
    p.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'bRand') randomise(); else if (b.dataset.k) bump(b.dataset.k, +b.dataset.d); });
    $('#bLook').addEventListener('click', () => { p.hidden = !p.hidden; $('#bLook').setAttribute('aria-pressed', String(!p.hidden)); });
    applyLook();
  }
  async function toggleRef() {            // Levi beside him, at the exact scale the game gives Levi, to compare heights
    if (L.ref) { A().remove(L.ref.id); L.ref = null; $('#bRef').setAttribute('aria-pressed', 'false'); return; }
    await A().loadModel('levi'); const [x, z] = L.home, p = A().PLS;
    L.ref = A().add({ key: 'levi', kind: 'aot', x: x + .5 * L.leviH, z, yaw: 0, scale: p, look: null, speed: 0 });
    $('#bRef').setAttribute('aria-pressed', 'true');
  }
  function stats() {
    const e = $('#labStat'), a = L.actor, M = root.__MDX && root.__MDX[KEY]; if (!e) return;
    const info = root.__LAB.info[KEY], cn = a && a.an && a.an.cur || '';
    e.textContent = info.verts + ' v · ' + (L.fps || 0) + ' fps' + (cn ? ' · ' + cn : '');
  }

  async function main() {
    await waitReady();
    root.__noTitan = true; root.__noOdm = true; root.__hideAvatar = true; root.__freeze = true;
    root.__cine = root.__cine || { on: false, pos: [0, 5, 0], target: [0, 5, 1], fov: 1 };
    root.ODM.hour = 11.5;
    await A().loadModel('levi'); await A().loadModel(KEY); if (!A().has(KEY)) throw new Error(KEY + ' model failed to load');
    L.spot = findSpot(); const [x, z] = L.spot;
    root.ODM.tst.setH([x, W().gh(x, z) + A().HH + .05, z]);
    root.__freeze = false; await sleep(250); root.__freeze = true;              // let the world settle once, then hold it
    spawn(); setCam('full'); bindInput(); bindLook(); setMode('idle');
    const ui = $('#lab'); ui.hidden = false; const ld = $('#load'); if (ld) ld.style.display = 'none';
    let t0 = performance.now(), n = 0;
    (function loop(now) { n++; if (now - t0 > 500) { L.fps = Math.round(n * 1000 / (now - t0)); n = 0; t0 = now; stats(); } if (!L.drive) camUpdate(); requestAnimationFrame(loop); })(performance.now());
    L.ready = true; log('ready');
  }
  L.toggleRef = toggleRef; L.applyLook = applyLook; L.randomise = randomise; L.ROWS = ROWS; L.OUTFITS = OUTFITS; L.HAIRS = HAIRS; L.setMode = setMode; L.setCam = setCam; L.camUpdate = camUpdate;
  main().catch(e => { console.error(e); L.error = String(e && e.message || e); const m = $('#msg'); if (m) m.textContent = 'Lab failed: ' + L.error; });
})(window);

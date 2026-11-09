/* Ashes of the Walls — story main: wires the story layer into the live game.
   Flow: tap gate -> splash (silence, wind, a Titan's footstep, a crow) -> title over the dawn district ->
   Begin journey: cold open (the wall, lightning, the Colossal) -> the registry -> three days in Shiganshina -> the breach. */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui, SV = S.save, AU = S.audio, ACT = S.actors, DST = S.destiny, doc = root.document;
  const VERSION = root.__APP_VERSION || '0.3.0';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const once = ev => new Promise(res => { const off = S.on(ev, d => { off(); res(d); }); });
  const getJSON = u => fetch(u + '?v=' + VERSION).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  const tryA = (fn, tag) => { try { return fn(); } catch (e) { console.warn('[story] ' + (tag || 'actors') + ' failed', e); } };
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const anim = (ms, fn) => new Promise(res => { const t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / ms); try { fn(k); } catch (e) { console.warn(e); } k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); });

  // The game must not run ODM, Titans or physics until the story layer says so.
  root.__freeze = true; root.__noOdm = true; root.__noTitan = true; root.__hideAvatar = true;
  const CINE = root.__cine = { on: false, pos: [0, 5, 0], target: [0, 5, 1], fov: 1.1 };
  const cineOn = (pos, target, fov) => { CINE.on = true; CINE.pos = pos; CINE.target = target; CINE.fov = fov || 1.1; };
  const cineOff = () => { CINE.on = false; };
  let mode = null, resumeState = 'play', dlgNpc = null, titleT0 = 0, stage = null, dayBusy = false;
  const DAY_Q = { 2: 'd2_gate', 3: 'd3_last' }, DAY_NAME = { 1: ['Day 1', 'Dawn. Shiganshina District, year 845'], 2: ['Day 2', 'The gate'], 3: ['Day 3', 'The last good day'] };

  /* ================= game bridge ================= */
  const G = {
    ready: () => !!(root.__ready && root.__E && root.__st && root.ODM && root.ODM.ready && root.__world && root.__actors && doc.querySelector('#odm .lv')),
    pos: () => { const H = root.__world.H(); return { x: H[0], y: H[1], z: H[2] }; },
    gh: (x, z) => root.__world.gh(x, z),
    clearKeys() { const K = root.ODM.tst.K; for (const k in K) K[k] = false; },
    teleport(x, z, yaw, pitch) {
      root.ODM.tst.setH([x, G.gh(x, z) + root.__actors.HH + 0.05, z]);
      if (yaw != null) root.__st.wyaw = yaw; if (pitch != null) root.__st.wpitch = pitch;
    },
    clearAt(x, z) {
      const W = root.__world, y = W.gh(x, z);
      if (!isFinite(y)) return false;
      if (W.inCanal && W.inCanal(x, z)) return false;
      if (W.cast([x, y + 1, z], [0, 1, 0], 5)) return false;
      for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) if (W.cast([x, y + 1, z], d, 0.9)) return false;
      return true;
    },
    snap(x, z) {
      if (G.clearAt(x, z)) return { x, z, moved: 0 };
      for (let r = 1.5; r <= 16; r += 1.5) for (let a = 0; a < 360; a += 30) {
        const rx = x + Math.cos(a * Math.PI / 180) * r, rz = z + Math.sin(a * Math.PI / 180) * r;
        if (G.clearAt(rx, rz)) return { x: rx, z: rz, moved: r };
      }
      return { x, z, moved: -1 };
    },
    project(x, y, z) {
      const m = root.__E.vp; if (!m) return null;
      return { cx: m[0] * x + m[4] * y + m[8] * z + m[12], cy: m[1] * x + m[5] * y + m[9] * z + m[13], cw: m[3] * x + m[7] * y + m[11] * z + m[15] };
    }
  };
  const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
  async function settle(ms) { root.__freeze = false; await sleep(ms); applyFsm(); }

  /* ================= state machine side effects ================= */
  const HIDE_HUD = ['boot', 'intro', 'title', 'creator', 'credits', 'ending'];
  function applyFsm() {
    const st = S.fsm.state, b = doc.body;
    root.__freeze = st !== 'play' || mode === null;
    if (root.__freeze && G.ready()) G.clearKeys();
    b.className = b.className.replace(/\bsv-s-\S+/g, '').trim() + ' sv-s-' + st;
    b.classList.toggle('sv-hidehud', HIDE_HUD.includes(st) || mode === null);
    b.classList.toggle('sv-story', mode === 'story'); b.classList.toggle('sv-sandbox', mode === 'roam'); b.classList.toggle('sv-noodm', !!root.__noOdm);
    const playing = st === 'play' && mode !== null;
    UI.setHudButtons(playing);
    if (!playing) { UI.setTalk(null); UI.syncMarkers([]); UI.track.hidden = true; } else refreshTracker();
  }
  S.on('fsm', applyFsm);

  /* ================= effects the data can call ================= */
  S.registerEffect('toast', e => UI.toast(e.text));
  S.registerEffect('card', e => UI.card(e.title, e.sub, e.ms));
  S.registerEffect('flash', e => UI.flash(e.ms));
  S.registerEffect('shake', e => UI.shake(e.ms));
  S.registerEffect('save', () => doSave('auto'));
  S.registerEffect('scene', e => { const f = scenes[e.id]; if (f) f().catch(err => console.error('[story] scene failed', e.id, err)); else console.warn('[story] unknown scene', e.id); });

  /* ================= dialogue wiring (with a shoulder camera) ================= */
  function speakerActor(id) { return id === 'anchor' ? ACT.anchor : ACT.npcs[id]; }
  function dialogueCamera(charId) {
    const a = speakerActor(charId), p = ACT.player; if (!a || !p) return cineOff();
    const dx = a.x - p.x, dz = a.z - p.z, l = Math.hypot(dx, dz) || 1, d = [dx / l, dz / l], r = [d[1], -d[0]];
    const gy = G.gh(p.x, p.z), h = Math.max(1.15, Math.min(1.7, a.scale * 1.7 * 0.88));
    cineOn([p.x - d[0] * 1.15 + r[0] * 0.55, gy + 1.38, p.z - d[1] * 1.15 + r[1] * 0.55], [a.x - r[0] * 0.1, G.gh(a.x, a.z) + h, a.z - r[1] * 0.1], 0.98);
  }
  S.on('dialogue:start', () => { if (!S.fsm.is('dialogue')) { resumeState = S.fsm.is('cutscene') ? 'cutscene' : 'play'; S.fsm.set('dialogue'); } UI.dialogue.open(); if (resumeState === 'play' && mode === 'story' && dlgNpc) tryA(() => dialogueCamera(dlgNpc), 'camera'); });
  S.on('dialogue:line', l => { UI.dialogue.show(l); for (const id of [...Object.keys(ACT.npcs), 'anchor']) ACT.talking(id, l.speaker.id === id); });
  S.on('dialogue:choice', () => AU.select());
  S.on('dialogue:end', () => { UI.dialogue.close(); for (const id of [...Object.keys(ACT.npcs), 'anchor']) ACT.talking(id, false); if (resumeState === 'play') cineOff(); dlgNpc = null; if (S.fsm.is('dialogue')) S.fsm.set(resumeState); });

  /* ================= quests / tracker / autosave ================= */
  function refreshTracker() {
    const t = S.quests.tracked();
    if (t && mode === 'story' && S.fsm.is('play')) UI.setTracker(S.quests.def(t.quest).title, t.text); else UI.track.hidden = true;
  }
  S.on('quest:start', d => { if (mode === 'story') UI.toast('New: ' + d.def.title); refreshTracker(); autosaveSoon(); });
  S.on('quest:obj', () => { refreshTracker(); syncActors(); autosaveSoon(); });
  S.on('quest:complete', () => { refreshTracker(); autosaveSoon(); });
  let asT = 0; const autosaveSoon = () => { clearTimeout(asT); asT = setTimeout(() => { if (mode === 'story' && S.state.player) doSave('auto').catch(() => {}); }, 900); };
  function capture() { if (!G.ready()) return; const p = G.pos(); S.state.pos = { x: p.x, z: p.z, yaw: root.__st.wyaw }; S.state.clock.hour = root.ODM.hour; }
  async function doSave(slot) { if (mode !== 'story' || !S.state.player) return; capture(); return SV.write(slot); }
  doc.addEventListener('visibilitychange', () => { if (doc.hidden && mode === 'story' && S.fsm.is('play', 'paused')) doSave('auto').catch(() => {}); });

  /* ================= points, actors, markers ================= */
  function resolvePoints() {
    const W = S.world; W.resolved = {};
    for (const p of W.points()) { const s = G.snap(p.x, p.z); if (s.moved) console.info('[story] point', p.id, s.moved < 0 ? 'could not be snapped (check the map)' : 'moved ' + s.moved + ' m to clear geometry'); W.resolved[p.id] = { x: s.x, z: s.z }; }
  }
  const pointById = id => S.world.points().find(p => p.id === id);
  const nameOf = p => p.label || (p.char === 'anchor' ? S.speaker('anchor').name : (S.data.characters[p.char] || {}).name || p.id);
  const KIDS = [['eren', -1.25, 0.2], ['armin', 0.05, 1.05], ['mikasa', 1.2, 0.15]];
  async function ensureModels(keys) { try { await ACT.ensure(keys); } catch (e) { console.warn('[story] models unavailable, using markers only', e); } }
  async function spawnCast() {
    const pl = S.state.player; ACT.clearAll();
    const need = new Set(['fuse_man', 'fuse_woman', 'eren', 'armin', 'mikasa']); await ensureModels([...need]);
    tryA(() => {
      const me = G.pos(); ACT.spawnPlayer(pl, me.x, me.z, root.__st.wyaw, true);
      const at = id => { const q = S.world.pos(pointById(id)); return q; }, face = (q, ref) => yawTo(q.x, q.z, ref.x, ref.z);
      const ah = at('anchor_home'); ACT.spawnAnchor(pl, ah.x, ah.z, face(ah, me));
      for (const id of ['oswin', 'marta', 'hannes']) { const q = at(id); ACT.spawnNpc(id, q.x, q.z, face(q, me)); }
      const k = at('kids'); KIDS.forEach(([id, ox, oz]) => ACT.spawnNpc(id, k.x + ox, k.z + oz, yawTo(k.x + ox, k.z + oz, k.x, k.z + 0.2)));
    });
    syncActors();
  }
  function syncActors() {                                   // the Anchor stands wherever the story needs them
    if (!ACT.anchor || !S.world.points().length) return;
    const gate = pointById('anchor_gate'), home = pointById('anchor_home'), usegate = gate && S.world.convFor(gate), q = S.world.pos(usegate ? gate : home);
    ACT.anchor.x = q.x; ACT.anchor.z = q.z;
  }
  let wasPlaying = false, nTick = 0;
  function tick(dt, now) {
    if (S.fsm.is('title') && CINE.on) {                       // the creeping dawn camera
      const P = S.opening.titlePose((now - titleT0) / 1000 + 6);       // the aerial dawn drift (js/story/opening.js)
      CINE.pos = P.pos; CINE.target = P.target; CINE.fov = P.fov;
    }
    const playing = S.fsm.is('play') && mode !== null;
    if (!playing) { if (wasPlaying) { UI.syncMarkers([]); UI.setTalk(null); } wasPlaying = false; return; }
    wasPlaying = true; nTick++;
    if (mode !== 'story') return;
    S.state.playSec += dt;
    const me = G.pos(); S.world.tick(me.x, me.z);
    if (nTick % 20 === 0) { syncActors(); ACT.faceTowards(me.x, me.z, 9); }
    const near = S.world.nearest(me.x, me.z);
    UI.setTalk(near ? 'Talk to ' + nameOf(near.p) : null, () => startTalk(near)); UI._near = near;
    const W = innerWidth, Hh = innerHeight, marks = S.quests.markers(), list = [];
    for (const a of S.world.active()) {
      const p = a.p, q = S.world.pos(p), d = Math.hypot(q.x - me.x, q.z - me.z), obj = marks[p.id];
      if (!obj && d > 38) continue;
      const pr = G.project(q.x, G.gh(q.x, q.z) + 2.4, q.z); if (!pr) continue;
      let nx = pr.cx / pr.cw, ny = pr.cy / pr.cw, edge = false, x, y, ang = 0;
      if (pr.cw <= 0 || Math.abs(nx) > 1.02 || Math.abs(ny) > 1.02) {
        if (!obj) continue; if (pr.cw <= 0) { nx = -pr.cx; ny = -pr.cy; }
        let dx = nx, dy = -ny; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const s = Math.min((W / 2 - 46) / Math.max(Math.abs(dx), 1e-6), (Hh / 2 - 74) / Math.max(Math.abs(dy), 1e-6)); x = W / 2 + dx * s; y = Hh / 2 + dy * s; ang = Math.atan2(dx, -dy); edge = true;
      } else { x = (nx * 0.5 + 0.5) * W; y = (1 - (ny * 0.5 + 0.5)) * Hh; }
      list.push({ id: p.id, label: nameOf(p), x, y, ang, edge, dist: d, main: !!obj, talk: !obj && d < 25 });
    }
    UI.syncMarkers(list);
  }
  (function loop() { let last = performance.now(); const f = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; try { tick(dt, now); } catch (e) { console.error('[story] tick', e); } requestAnimationFrame(f); }; requestAnimationFrame(f); })();

  function startTalk(n) {
    if (!n || !S.fsm.is('play')) return;
    const me = G.pos(), q = S.world.pos(n.p); root.__st.wyaw = yawTo(me.x, me.z, q.x, q.z); dlgNpc = n.p.char === 'eren' && n.p.id === 'kids' ? 'armin' : n.p.char;
    if (ACT.player) ACT.player.yaw = yawTo(me.x, me.z, q.x, q.z);
    AU.hover(); S.dialogue.start(n.conv);
    if (!S.dialogue.active() && S.fsm.is('dialogue')) S.fsm.set('play');
  }

  /* ================= scenes ================= */
  const scenes = {
    async breach() {
      S.fsm.set('cutscene'); doc.body.classList.add('sv-letterbox'); UI.letterbox(true); AU.stopMusic(); AU.wind(0.02);
      await sleep(900); AU.thud(1); UI.shake(900); await sleep(1100);
      AU.lightning(); UI.flash(1200); UI.shake(1800); AU.crowd(5); AU.thud(1.2); await sleep(1500);
      const done = once('dialogue:end'); S.dialogue.start('breach_fate'); await done;
      doc.body.classList.remove('sv-letterbox'); UI.letterbox(false); cineOff();
      capture(); await doSave('auto').catch(() => {});
      const choice = { hand: 'You seized {anchor}\u2019s hand and ran.', ahead: 'You ran ahead and shouted for {anchor} to follow.', frozen: 'You froze, and the world kept moving.' }[S.flag('breach_choice')] || '';
      const view = { home: 'You told {anchor} the walls were enough.', beyond: 'You told {anchor} you would go beyond them someday.', deflect: 'You changed the subject.' }[S.flag('wall_view')] || '';
      S.fsm.set('ending');
      UI.endCard({ title: 'The wall breaks', lines: [view, choice, 'This is where the current build ends. The escape through Shiganshina comes next, and everything you chose has been saved.'].filter(Boolean) },
        [{ text: 'Keep exploring the district', run: () => { UI.hideAll(); S.fsm.set('play'); } }, { text: 'Return to title', run: () => showTitle() }]);
    }
  };

  /* ================= the three days ================= */
  S.on('day:change', async day => {
    if (mode !== 'story' || dayBusy) return; dayBusy = true;
    try {
      S.fsm.set('cutscene'); await UI.fadeTo(true, 900);
      const w = S.data.world, s = G.snap(w.start.x, w.start.z); G.teleport(s.x, s.z, 0.6, 0.08); root.ODM.hour = S.state.clock.hour;
      tryA(() => { const me = G.pos(); if (ACT.player) { ACT.player.x = me.x; ACT.player.z = me.z; } syncActors(); });
      if (DAY_Q[day]) S.quests.start(DAY_Q[day]);
      AU.music(day === 3 ? 'dread' : 'calm'); await settle(900); S.fsm.set('cutscene');
      await UI.fadeTo(false, 900); const nm = DAY_NAME[day] || ['Day ' + day, '']; await UI.card(nm[0], nm[1], 3000);
      await doSave('auto').catch(() => {}); S.fsm.set('play'); applyFsm();
    } finally { dayBusy = false; }
  });

  /* ================= opening: splash, title, cold open ================= */
  function tickerLines() {
    const out = [S.data.credits.disclaimer];
    for (const sec of S.data.credits.sections || []) if (sec.title === 'Models') for (const it of sec.items) out.push(it.what + ' \u2014 ' + [it.who, it.lic].filter(Boolean).join(', '));
    return out;
  }
  async function placeTitleShot() {
    const P = S.opening.titlePose(6), s = G.snap(P.pos[0], P.pos[2] + 150);   // keep the (hidden) player under the aerial camera so the town streams in
    root.__noTitan = true; root.__noOdm = true; root.__hideAvatar = true; ACT.clearAll();
    G.teleport(s.x, s.z, 0, 0.1); root.ODM.hour = 5.9; await settle(900);
  }
  async function showTitle(placed) {
    mode = null; S.fsm.set('title'); applyFsm(); cineOff();
    if (!placed) { await UI.fadeTo(true, 450); UI.hideAll(); await placeTitleShot(); } else UI.hideAll();
    titleT0 = performance.now(); const P = S.opening.titlePose(6); cineOn(P.pos, P.target, P.fov);
    UI.title({ version: VERSION, latest: await latestSave() }); UI.setTicker(tickerLines());
    AU.wind(0.07); AU.music('title');
    if (!placed) await UI.fadeTo(false, 900);
  }
  async function latestSave() { try { const k = await SV.latest(); if (k) return (await SV.list())[k]; } catch (e) { console.warn('[story] save list failed', e); } return null; }
  /* The opening (studio logo, cinematic intro, stamp, title) lives in js/story/opening.js. This host is all it knows about the engine. */
  let titleInfo = { version: VERSION, latest: null };
  const openingHost = {
    has3D: true,
    setHour: h => { root.ODM.hour = h; },
    teleport: (x, z) => { const q = G.snap(x, z); G.teleport(q.x, q.z, 0, 0.1); },
    cineOn, gh: (x, z) => G.gh(x, z),
    project: (x, y, z) => { const E = root.__E, m = E && E.vp; if (!m) return null; return { cx: m[0] * x + m[4] * y + m[8] * z + m[12], cy: m[1] * x + m[5] * y + m[9] * z + m[13], cw: m[3] * x + m[7] * y + m[11] * z + m[15] }; },
    ensure: () => ensureModels(['colossal2', 'colossal']),
    info: () => titleInfo,
    geo() {                                                 // where the wall really is (measured with rays), so the cutscene fits any wall change
      const W = root.__world, x0 = -60, f = W.cast([x0, 25, -400], [0, 0, 1], 800), b = W.cast([x0, 25, 400], [0, 0, -1], 800);
      const front = f ? -400 + f.t : -20, back = b ? 400 - b.t : front + 8, m = (front + back) / 2, h = W.cast([x0, 300, m], [0, -1, 0], 600);
      return { x0, front, back: Math.max(back, front + 2), top: h ? 300 - h.t : 50 };
    },
    async prepTitle() {                                    // everything the title needs, while the screen is black
      mode = null; S.fsm.set('title'); applyFsm(); ACT.removeColossal(); await placeTitleShot();
      titleT0 = performance.now(); const P = S.opening.titlePose(6); cineOn(P.pos, P.target, P.fov);
      titleInfo = { version: VERSION, latest: await latestSave() }; UI.setTicker(tickerLines()); AU.wind(0.07);
    }
  };
  S.openingHost = openingHost;
  async function opening() { S.fsm.set('intro'); applyFsm(); S.opening.runOpening(openingHost); }
  async function coldOpen() {                               // the cinematic now plays before the title (js/story/opening.js); here we only leave the menu
    mode = null; S.fsm.set('intro'); applyFsm(); S.opening.hideTitle(); AU.stopMusic(); AU.wind(0.03); UI.setTicker(null); UI.embers(false);
    await UI.fadeTo(true, 700); UI.hideAll(); ACT.clearAll(); await sleep(250);
  }

  /* ================= the registry ================= */
  const defaultDraft = () => ({ name: '', gender: 'f', body: 'fuse_woman', voice: 'steady', difficulty: 'soldier', wear: 1,
    look: { skin: 1, hair: 2, top: 0, bottom: 0, shoes: 0, height: 0.5, build: 0.5, headW: 0.5, headH: 0.5, eye: 0, scar: 0 } });
  const buildPlayer = (d, dest) => ({ name: d.name.trim(), gender: d.gender, body: d.body, voice: d.voice, difficulty: d.difficulty, wear: d.wear, look: Object.assign({}, d.look),
    bloodline: dest.bloodline, family: dest.family, destinySeed: dest.seed, anchor: Object.assign({}, dest.anchor) });
  async function openCreator() {
    AU.select(); await coldOpen();
    mode = null; S.fsm.set('creator'); applyFsm(); UI.hideAll();
    await UI.fadeTo(true, 10); await ensureModels(['fuse_man', 'fuse_woman']);
    const dest = DST.pending(), draft = defaultDraft(); draft.body = dest.anchor.gender === 'f' ? 'fuse_man' : 'fuse_woman';
    root.__noTitan = true; root.__noOdm = true; root.__hideAvatar = true; ACT.clearAll(); root.ODM.hour = 7.6;
    const sp = G.snap(-176.5, -186.5); G.teleport(sp.x + 14, sp.z + 14, 0, 0.1);
    const yaw0 = Math.PI, F = [Math.sin(yaw0), 0, Math.cos(yaw0)], Rr = [F[2], 0, -F[0]], gy = G.gh(sp.x, sp.z);
    cineOn([sp.x + F[0] * 3.1, gy + 1.15, sp.z + F[2] * 3.1], [sp.x + Rr[0] * 1.2, gy + 0.95, sp.z + Rr[2] * 1.2], 1.08);
    const mk = () => { tryA(() => { const pl = buildPlayer(draft, dest); if (!ACT.player) ACT.spawnPlayer(pl, sp.x, sp.z, yaw0, false); else ACT.updatePlayer(pl); }); };
    mk();
    tryA(() => { const pl = buildPlayer(draft, dest); ACT.spawnAnchor(pl, sp.x + Rr[0] * 0.95 - F[0] * 0.3, sp.z + Rr[2] * 0.95 - F[2] * 0.3, yaw0 + 0.25); });
    await settle(500); UI.hideAll(); AU.wind(0.04); AU.music('calm');
    UI.creator({ cfg: S.data.config, draft, destiny: dest }, d => { cineOff(); ACT.clearAll(); finishCreation(buildPlayer(d, dest), dest); }, () => { cineOff(); ACT.clearAll(); showTitle(); }, mk, dx => { if (ACT.player) ACT.player.yaw += dx; });
    await UI.fadeTo(false, 700);
  }
  async function finishCreation(player, dest) { DST.consume(); AU.blade(); await startNewGame(player); }

  /* ================= story start / load ================= */
  function setPlayerName(n) { const e = doc.querySelector('#odm .lv'); if (e) e.textContent = n; }
  async function enterStory(isNew) {
    await UI.fadeTo(true, 500); UI.hideAll(); UI.setTicker(null); UI.embers(false); cineOff();
    mode = 'story'; root.__noOdm = !S.flag('odm_unlocked'); root.__noTitan = !S.flag('titans_active'); root.__hideAvatar = true;
    setPlayerName((S.state.player && S.state.player.name || 'You').toUpperCase());
    resolvePoints();
    const w = S.data.world, st = S.state.pos; let x, z, yaw;
    if (isNew || !st) { const s = G.snap(w.start.x, w.start.z), a = S.world.resolved.anchor_home || { x: s.x + 5, z: s.z + 5 }; x = s.x; z = s.z; yaw = yawTo(x, z, a.x, a.z); S.state.clock.hour = w.start.hour; }
    else { x = st.x; z = st.z; yaw = st.yaw; }
    G.teleport(x, z, yaw, 0.08); root.ODM.hour = S.state.clock.hour;
    S.fsm.set('cutscene'); applyFsm();
    await spawnCast();
    await settle(1300); S.fsm.set('cutscene'); applyFsm();
    AU.music(S.state.day === 3 ? 'dread' : 'calm'); AU.wind(0.04);
    await UI.fadeTo(false, 900);
    if (isNew) {
      S.quests.start('d1_morning');
      const nm = DAY_NAME[1]; await UI.card(nm[0], nm[1], 3300);
      const done = once('dialogue:end'); S.dialogue.start('prologue_open'); await done;
      UI.toast('Walk to {anchor}. Tap Talk when the prompt appears.', 4200); await doSave('auto').catch(() => {});
    }
    S.fsm.set('play'); applyFsm();
  }
  async function startNewGame(player) { S.reset(); S.state.player = player; S.state.act = 'prologue'; S.state.clock.hour = S.data.world.start.hour; await enterStory(true); }
  async function loadSlot(slot) {
    try { const snap = await SV.read(slot); if (!snap) return UI.toast('That slot is empty.'); S.load(snap.state); S.fsm.stack.length = 0; await enterStory(false); }
    catch (e) { console.error(e); UI.toast('Could not load: ' + e.message); }
  }
  async function startRoam() {                                // kept for the Training Grounds later; not on the menu
    await UI.fadeTo(true, 500); UI.hideAll(); cineOff(); ACT.clearAll(); mode = 'roam'; root.__noOdm = false; root.__noTitan = false; root.__hideAvatar = false; setPlayerName('LEVI');
    G.teleport(0, -38, 0, 0.05); root.ODM.hour = 15; S.fsm.set('cutscene'); applyFsm(); await settle(1200); await UI.fadeTo(false, 700); S.fsm.set('play'); applyFsm();
  }

  /* ================= pause / options / journal / saves / map ================= */
  function openPause() { if (!S.fsm.is('play')) return; S.fsm.push('paused'); showPauseMenu(); }
  function closeOverlay() { UI.hideAll(); S.map.close(); S.fsm.pop('play'); }
  function showPauseMenu() {
    const items = [{ text: 'Resume', run: closeOverlay }];
    if (mode === 'story') items.push({ text: 'Map', run: openMapFromPause }, { text: 'Journal', run: () => UI.journal(showPauseMenu) }, { text: 'Save game', run: () => openSaves('save') }, { text: 'Load game', run: () => openSaves('load') });
    items.push({ text: 'Options', run: () => UI.optionsPanel(showPauseMenu) }, { text: 'Credits', run: () => UI.credits(S.data.credits, showPauseMenu) });
    if (mode === 'story') items.push({ text: 'I\u2019m stuck', hint: 'Moves you next to your current objective', run: fastTravel });
    items.push({ text: 'Return to title', hint: mode === 'story' ? 'Your progress is autosaved' : '', run: async () => { await doSave('auto').catch(() => {}); S.fsm.stack.length = 0; showTitle(); } });
    UI.pause(items);
  }
  async function openSaves(m, fromTitle) {
    const slots = await SV.list();
    UI.saves(m, slots, async slot => {
      if (m === 'save') { try { await doSave(slot); UI.toast('Game saved'); } catch (e) { UI.toast('Save failed: ' + e.message); } openSaves('save'); }
      else { UI.hideAll(); S.fsm.stack.length = 0; if (!fromTitle) S.fsm.set('play'); await loadSlot(slot); }
    }, fromTitle ? () => showTitle(true) : showPauseMenu);
  }
  function fastTravel() {
    const t = S.quests.tracked(); if (!t || !t.marker) { UI.toast('Nothing to travel to yet.'); return; }
    const p = pointById(t.marker); if (!p) return; const q = S.world.pos(p), s = G.snap(q.x - 1.8, q.z - 1.8);
    G.teleport(s.x, s.z, yawTo(s.x, s.z, q.x, q.z), 0.08); closeOverlay();
  }
  async function exportSaves() { try { const a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([await SV.exportAll()], { type: 'application/json' })); a.download = 'ashes-of-the-walls-saves.json'; a.click(); UI.toast('Backup downloaded'); } catch (e) { UI.toast('Export failed: ' + e.message); } }
  function importSaves() { const i = doc.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { await SV.importAll(await f.text()); UI.toast('Saves imported'); } catch (e) { UI.toast('Import failed: ' + e.message); } }; i.click(); }
  function openJournal() { if (!S.fsm.is('play')) return; S.fsm.push('journal'); UI.journal(closeOverlay); }
  S.map.source({ player: () => { const p = G.pos(); return { x: p.x, z: p.z }; }, data: () => {
    const me = G.pos(), t = S.quests.tracked(), pt = t && t.marker && pointById(t.marker), objs = [];
    if (pt) { const q = S.world.pos(pt); objs.push({ x: q.x, z: q.z, name: nameOf(pt) }); }
    const npcs = []; for (const id in ACT.npcs) npcs.push({ x: ACT.npcs[id].x, z: ACT.npcs[id].z, name: (S.data.characters[id] || {}).name || id }); if (ACT.anchor) npcs.push({ x: ACT.anchor.x, z: ACT.anchor.z, name: S.speaker('anchor').name });
    return { player: { x: me.x, z: me.z, yaw: ACT.player ? ACT.player.yaw : root.__st.wyaw }, npcs, objectives: objs, objective: t ? S.fmt(t.text) : '' };
  } });
  let mapFrom = 'hud';
  function openMap() { if (!S.fsm.is('play')) return; mapFrom = 'hud'; S.fsm.push('paused'); UI.show('map'); S.map.open(); }
  function openMapFromPause() { mapFrom = 'menu'; UI.show('map'); S.map.open(); }

  UI.handlers = {
    pause: openPause, journal: openJournal, map: openMap,
    closeMap: () => { S.map.close(); if (mapFrom === 'menu') showPauseMenu(); else closeOverlay(); },
    hover: () => AU.hover(), hoverBegin: () => AU.heartbeat(), locked: () => UI.toast('The training grounds open in Act 2.'),
    continue: () => { AU.select(); openSaves('load', true); },
    new: () => openCreator(),
    options: () => { AU.select(); UI.optionsPanel(() => UI.show('title')); },
    exit: async () => { AU.select(); await S.opening.exitCard(); AU.stopMusic(); AU.wind(0); opening(); },
    credits: () => { AU.select(); UI.credits(S.data.credits, () => { UI.show('title'); }); }
  };

  /* ================= keyboard ================= */
  root.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const st = S.fsm.state;
    if (st === 'dialogue') {
      if (['Space', 'Enter', 'KeyF', 'ArrowRight'].includes(e.code) && !doc.querySelector('.sv-choice')) { e.preventDefault(); UI.dialogue.tap(); }
      else if (/^Digit[1-4]$/.test(e.code)) UI.dialogue.choose(+e.code.slice(5) - 1);
      return;
    }
    if (st === 'play' && mode) {
      if ((e.code === 'KeyG' || e.code === 'Enter') && mode === 'story' && UI._near) startTalk(UI._near);
      else if (e.code === 'Escape' || e.code === 'KeyP') openPause();
      else if (e.code === 'KeyJ' && mode === 'story') openJournal();
      else if (e.code === 'KeyM' && mode === 'story') openMap();
    } else if (st === 'paused' && e.code === 'Escape') { if (UI.current() === 'pause') closeOverlay(); else if (UI.current() === 'map') UI._cb('closeMap'); else showPauseMenu(); }
    else if (st === 'journal' && e.code === 'Escape') closeOverlay();
  });

  /* ================= boot ================= */
  async function boot() {
    UI.mount(); S.map.build(UI); UI.fade.classList.add('on');
    const names = ['config', 'characters', 'quests', 'dialogue', 'world', 'credits', 'npcs'];
    const [config, characters, quests, dialogue, world, credits, npcs] = await Promise.all(names.map(n => getJSON('data/story/' + n + '.json')));
    S.data = { config, characters, quests, dialogue, world, credits, npcs };
    const backend = await SV.init(); console.info('[story] saves use', backend);
    for (let i = 0; i < 400 && !G.ready(); i++) await sleep(150);
    if (!G.ready()) throw new Error('The game did not finish loading.');
    S.fsm.set('intro'); applyFsm();
    ensureModels(['fuse_man', 'fuse_woman', 'colossal']);          // warm the model cache in the background
    await placeTitleShot(); document.documentElement.classList.remove('aow-boot'); await opening();          // the gate stays black until the first tap; the opening handles every fade after that
  }
  root.STORY.debug = { G, scenes, get mode() { return mode; }, startRoam, startNewGame, loadSlot, showTitle, coldOpen, openCreator, spawnCast, syncActors };
  boot().catch(err => { console.error('[story] boot failed', err); document.documentElement.classList.remove('aow-boot'); const m = doc.getElementById('msg'); if (m) m.textContent = 'Story layer failed: ' + err.message; UI.fade && UI.fade.classList.remove('on'); S.fsm.set('play'); mode = 'roam'; root.__freeze = false; root.__noOdm = false; root.__noTitan = false; root.__hideAvatar = false; });
})(typeof window !== 'undefined' ? window : globalThis);

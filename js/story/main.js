/* Ashes of the Walls — story main: wires the story layer into the live game. */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui, SV = S.save, doc = root.document;
  const VERSION = root.__APP_VERSION || '0.2.0';
  const HH = 0.9 * 0.54;                                   // avatar half-height used by game.js
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const once = ev => new Promise(res => { const off = S.on(ev, d => { off(); res(d); }); });
  const getJSON = u => fetch(u + '?v=' + VERSION).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });

  // The game must not run ODM, Titans or physics until the story layer says so.
  root.__freeze = true; root.__noOdm = true; root.__noTitan = true; root.__hideAvatar = true;
  let mode = null;                                         // 'story' | 'roam' | null (title)
  let resumeState = 'play';

  /* ================= game bridge ================= */
  const G = {
    ready: () => !!(root.__ready && root.__E && root.__st && root.ODM && root.ODM.ready && root.__world && doc.querySelector('#odm .lv')),
    pos: () => { const H = root.__world.H(); return { x: H[0], y: H[1], z: H[2] }; },
    gh: (x, z) => root.__world.gh(x, z),
    keys: () => root.ODM.tst.K,
    clearKeys() { const K = G.keys(); for (const k in K) K[k] = false; },
    teleport(x, z, yaw, pitch) {
      root.ODM.tst.setH([x, G.gh(x, z) + HH + 0.05, z]);
      if (yaw != null) root.__st.wyaw = yaw; if (pitch != null) root.__st.wpitch = pitch;
    },
    clearAt(x, z) {
      const W = root.__world, y = W.gh(x, z);
      if (!isFinite(y)) return false;
      if (W.inCanal && W.inCanal(x, z)) return false;
      if (W.cast([x, y + 1, z], [0, 1, 0], 5)) return false;                     // roof overhead
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
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      return { cx, cy, cw };
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
    b.classList.toggle('sv-hidehud', HIDE_HUD.includes(st));
    b.classList.toggle('sv-story', mode === 'story'); b.classList.toggle('sv-sandbox', mode === 'roam');
    b.classList.toggle('sv-noodm', !!root.__noOdm);
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

  /* ================= dialogue wiring ================= */
  S.on('dialogue:start', () => { if (!S.fsm.is('dialogue')) { resumeState = S.fsm.is('cutscene') ? 'cutscene' : 'play'; S.fsm.set('dialogue'); } UI.dialogue.open(); });
  S.on('dialogue:line', l => UI.dialogue.show(l));
  S.on('dialogue:end', () => { UI.dialogue.close(); if (S.fsm.is('dialogue')) S.fsm.set(resumeState); });

  /* ================= quests / tracker / autosave ================= */
  function refreshTracker() {
    const t = S.quests.tracked();
    if (t && mode === 'story' && S.fsm.is('play')) UI.setTracker(S.quests.def(t.quest).title, t.text); else UI.track.hidden = true;
  }
  S.on('quest:start', d => { if (mode === 'story') UI.toast('New: ' + d.def.title); refreshTracker(); autosaveSoon(); });
  S.on('quest:obj', () => { refreshTracker(); autosaveSoon(); });
  S.on('quest:complete', () => { refreshTracker(); autosaveSoon(); });
  let asT = 0; const autosaveSoon = () => { clearTimeout(asT); asT = setTimeout(() => { if (mode === 'story' && S.state.player) doSave('auto').catch(() => {}); }, 900); };
  function capture() {
    if (!G.ready()) return; const p = G.pos();
    S.state.pos = { x: p.x, z: p.z, yaw: root.__st.wyaw }; S.state.clock.hour = root.ODM.hour;
  }
  async function doSave(slot) { if (mode !== 'story' || !S.state.player) return; capture(); return SV.write(slot); }
  doc.addEventListener('visibilitychange', () => { if (doc.hidden && mode === 'story' && S.fsm.is('play', 'paused')) doSave('auto').catch(() => {}); });

  /* ================= points: resolve, markers, talking ================= */
  function resolvePoints() {
    const W = S.world; W.resolved = {};
    for (const p of W.points()) {
      const s = G.snap(p.x, p.z);
      if (s.moved) console.info('[story] point', p.id, s.moved < 0 ? 'could not be snapped (check the map)' : 'moved ' + s.moved + ' m to clear geometry');
      W.resolved[p.id] = { x: s.x, z: s.z };
    }
  }
  const nameOf = p => p.char === 'anchor' ? S.speaker('anchor').name : (S.data.characters[p.char] || {}).name || p.id;
  const groundY = {};                                      // cache per point
  let frameNo = 0, wasPlaying = false;
  function tick(dt) {
    const playing = S.fsm.is('play') && mode !== null;
    if (!playing) { if (wasPlaying) { UI.syncMarkers([]); UI.setTalk(null); } wasPlaying = false; return; }
    wasPlaying = true; frameNo++;
    if (mode !== 'story') return;
    S.state.playSec += dt;
    const me = G.pos(); S.world.tick(me.x, me.z);
    const near = S.world.nearest(me.x, me.z);
    UI.setTalk(near ? 'Talk to ' + nameOf(near.p) : null, () => startTalk(near));
    UI._near = near;
    // markers
    const W = innerWidth, Hh = innerHeight, marks = S.quests.markers(), list = [];
    for (const a of S.world.active()) {
      const p = a.p, q = S.world.pos(p), d = Math.hypot(q.x - me.x, q.z - me.z), obj = marks[p.id];
      if (!obj && d > 38) continue;
      if (groundY[p.id] === undefined) groundY[p.id] = G.gh(q.x, q.z);
      const pr = G.project(q.x, groundY[p.id] + 2.5, q.z); if (!pr) continue;
      let nx = pr.cx / pr.cw, ny = pr.cy / pr.cw, edge = false, x, y, ang = 0;
      if (pr.cw <= 0 || Math.abs(nx) > 1.02 || Math.abs(ny) > 1.02) {
        if (!obj) continue;                                 // only objectives get edge arrows
        if (pr.cw <= 0) { nx = -pr.cx; ny = -pr.cy; }
        let dx = nx, dy = -ny; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const sx = (W / 2 - 46) / Math.max(Math.abs(dx), 1e-6), sy = (Hh / 2 - 74) / Math.max(Math.abs(dy), 1e-6), s = Math.min(sx, sy);
        x = W / 2 + dx * s; y = Hh / 2 + dy * s; ang = Math.atan2(dx, -dy); edge = true;
      } else { x = (nx * 0.5 + 0.5) * W; y = (1 - (ny * 0.5 + 0.5)) * Hh; }
      list.push({ id: p.id, label: nameOf(p), x, y, ang, edge, dist: d, main: !!obj, talk: !obj && d < 25 });
    }
    UI.syncMarkers(list);
  }
  (function loop() { let last = performance.now(); const f = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; try { tick(dt); } catch (e) { console.error('[story] tick', e); } requestAnimationFrame(f); }; requestAnimationFrame(f); })();

  function startTalk(n) {
    if (!n || !S.fsm.is('play')) return;
    const me = G.pos(), q = S.world.pos(n.p);
    root.__st.wyaw = yawTo(me.x, me.z, q.x, q.z);           // face them
    S.dialogue.start(n.conv);
    if (!S.dialogue.active() && S.fsm.is('dialogue')) S.fsm.set('play');
  }

  /* ================= scenes ================= */
  const scenes = {
    async breach() {
      S.fsm.set('cutscene'); doc.body.classList.add('sv-letterbox'); UI.letterbox(true);
      await sleep(600); UI.shake(1600); UI.flash(1200); await sleep(1500);
      const done = once('dialogue:end'); S.dialogue.start('breach_fate'); await done;
      doc.body.classList.remove('sv-letterbox'); UI.letterbox(false);
      capture(); await doSave('auto').catch(() => {});
      const choice = { hand: 'You seized {anchor}\u2019s hand and ran.', ahead: 'You ran ahead and shouted for {anchor} to follow.', frozen: 'You froze, and the world kept moving.' }[S.flag('breach_choice')] || '';
      const view = { home: 'You told {anchor} the walls were enough.', beyond: 'You told {anchor} you would go beyond them someday.', deflect: 'You changed the subject.' }[S.flag('wall_view')] || '';
      S.fsm.set('ending');
      UI.endCard({ title: 'The wall breaks', lines: [view, choice, 'This is where the current build ends. The escape through Shiganshina comes next, and everything you chose has been saved.'].filter(Boolean) },
        [{ text: 'Keep exploring the district', run: () => { UI.hideAll(); S.fsm.set('play'); } },
         { text: 'Return to title', run: () => showTitle() }]);
    }
  };

  /* ================= flows ================= */
  async function placeTitleShot() {
    const t = S.data.world.titleShot, s = G.snap(t.x, t.z);
    root.__noTitan = true; root.__noOdm = true; root.__hideAvatar = true;
    G.teleport(s.x, s.z, t.yaw, t.pitch); root.ODM.hour = t.hour;
    await settle(1700);
  }
  async function showTitle(placed) {                       // placed: boot already composed the shot
    mode = null; S.fsm.set('title'); applyFsm();
    if (!placed) { await UI.fadeTo(true, 450); UI.hideAll(); await placeTitleShot(); } else UI.hideAll();
    let latest = null;
    try { const k = await SV.latest(); if (k) latest = (await SV.list())[k]; } catch (e) { console.warn('[story] save list failed', e); }
    UI.title({ version: VERSION, latest });
    if (!placed) await UI.fadeTo(false, 700);
  }
  function setPlayerName(n) { const e = doc.querySelector('#odm .lv'); if (e) e.textContent = n; }
  async function enterStory(isNew) {
    await UI.fadeTo(true, 500); UI.hideAll();
    mode = 'story'; root.__noOdm = !S.flag('odm_unlocked'); root.__noTitan = !S.flag('titans_active'); root.__hideAvatar = false;
    setPlayerName((S.state.player && S.state.player.name || 'You').toUpperCase());
    resolvePoints();
    const w = S.data.world, st = S.state.pos;
    let x, z, yaw;
    if (isNew || !st) {
      const s = G.snap(w.start.x, w.start.z), a = S.world.resolved.anchor_home || { x: s.x + 5, z: s.z + 5 };
      x = s.x; z = s.z; yaw = yawTo(x, z, a.x, a.z); S.state.clock.hour = w.start.hour;
    } else { x = st.x; z = st.z; yaw = st.yaw; }
    G.teleport(x, z, yaw, 0.08); root.ODM.hour = S.state.clock.hour;
    S.fsm.set('cutscene'); applyFsm();
    await settle(1500);
    S.fsm.set('cutscene'); applyFsm();
    await UI.fadeTo(false, 800);
    if (isNew) {
      S.quests.start('morning');
      await UI.card('Year 845', 'Shiganshina District, Wall Maria', 3400);
      const done = once('dialogue:end'); S.dialogue.start('prologue_open'); await done;
      UI.toast('Walk to {anchor}. Tap Talk when the prompt appears.', 4200);
      await doSave('auto').catch(() => {});
    }
    S.fsm.set('play'); applyFsm();
  }
  async function startNewGame(player) { S.reset(); S.state.player = player; S.state.act = 'prologue'; await enterStory(true); }
  async function loadSlot(slot) {
    try { const snap = await SV.read(slot); if (!snap) return UI.toast('That slot is empty.'); S.load(snap.state); S.fsm.stack.length = 0; await enterStory(false); }
    catch (e) { console.error(e); UI.toast('Could not load: ' + e.message); }
  }
  async function startRoam() {
    await UI.fadeTo(true, 500); UI.hideAll();
    mode = 'roam'; root.__noOdm = false; root.__noTitan = false; root.__hideAvatar = false; setPlayerName('LEVI');
    G.teleport(0, -38, 0, 0.05); root.ODM.hour = 15;
    S.fsm.set('cutscene'); applyFsm(); await settle(1200);
    await UI.fadeTo(false, 700); S.fsm.set('play'); applyFsm();
  }

  /* ================= pause / journal / saves ================= */
  function openPause() { if (!S.fsm.is('play')) return; S.fsm.push('paused'); showPauseMenu(); }
  function closeOverlay() { UI.hideAll(); S.fsm.pop('play'); }
  function showPauseMenu() {
    const items = [{ text: 'Resume', run: closeOverlay }];
    if (mode === 'story') items.push(
      { text: 'Journal', run: () => UI.journal(showPauseMenu) },
      { text: 'Save game', run: () => openSaves('save') },
      { text: 'Load game', run: () => openSaves('load') });
    items.push({ text: 'Settings', run: showSettings }, { text: 'Credits', run: () => UI.credits(S.data.credits, showPauseMenu) });
    if (mode === 'story') items.push({ text: 'I\u2019m stuck', hint: 'Moves you next to your current objective', run: fastTravel });
    items.push({ text: 'Return to title', hint: mode === 'story' ? 'Your progress is autosaved' : '', run: async () => { await doSave('auto').catch(() => {}); S.fsm.stack.length = 0; showTitle(); } });
    UI.pause(items);
  }
  function showSettings() { UI.settingsPanel(showPauseMenu, [{ text: 'Export saves', hint: 'Download a backup file', run: exportSaves }, { text: 'Import saves', hint: 'Restore from a backup file', run: importSaves }]); }
  async function openSaves(m) {
    const slots = await SV.list();
    UI.saves(m, slots, async slot => {
      if (m === 'save') { try { await doSave(slot); UI.toast('Game saved'); } catch (e) { UI.toast('Save failed: ' + e.message); } openSaves('save'); }
      else { UI.hideAll(); S.fsm.stack.length = 0; S.fsm.set('play'); await loadSlot(slot); }
    }, showPauseMenu);
  }
  function fastTravel() {
    const t = S.quests.tracked(); if (!t || !t.marker) { UI.toast('Nothing to travel to yet.'); return; }
    const p = S.world.points().find(p => p.id === t.marker); if (!p) return;
    const q = S.world.pos(p), s = G.snap(q.x - 1.8, q.z - 1.8);   // well inside the 4.5 m talk radius
    G.teleport(s.x, s.z, yawTo(s.x, s.z, q.x, q.z), 0.08); closeOverlay();
  }
  async function exportSaves() {
    try { const a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([await SV.exportAll()], { type: 'application/json' })); a.download = 'ashes-of-the-walls-saves.json'; a.click(); UI.toast('Backup downloaded'); }
    catch (e) { UI.toast('Export failed: ' + e.message); }
  }
  function importSaves() {
    const i = doc.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = async () => { const f = i.files[0]; if (!f) return; try { await SV.importAll(await f.text()); UI.toast('Saves imported'); } catch (e) { UI.toast('Import failed: ' + e.message); } };
    i.click();
  }
  function openJournal() { if (!S.fsm.is('play')) return; S.fsm.push('journal'); UI.journal(closeOverlay); }

  UI.handlers = {
    pause: openPause, journal: openJournal,
    continue: async () => { const k = await SV.latest(); if (k) loadSlot(k); },
    new: () => UI.creator(S.data.config, p => startNewGame(p), () => showTitle()),
    roam: startRoam,
    credits: () => UI.credits(S.data.credits, () => showTitle(true))
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
    } else if (st === 'paused' && e.code === 'Escape') { if (UI.current() === 'pause') closeOverlay(); else showPauseMenu(); }
    else if (st === 'journal' && e.code === 'Escape') closeOverlay();
  });

  /* ================= boot ================= */
  function loadingTicker() {
    const box = doc.querySelector('#load > div') || doc.getElementById('load'); if (!box) return;
    const t = doc.createElement('p'); t.id = 'sv-ticker'; box.appendChild(t);
    const lines = []; const cr = S.data.credits, cfg = S.data.config;
    for (const sec of cr.sections || []) for (const it of sec.items) lines.push(it.what + ' \u2014 ' + [it.who, it.lic].filter(Boolean).join(', '));
    (cfg.tips || []).forEach(x => lines.splice(Math.floor(Math.random() * (lines.length + 1)), 0, x));
    let i = 0; const next = () => { if (!t.isConnected) return; t.classList.add('out'); setTimeout(() => { t.textContent = lines[i++ % lines.length]; t.classList.remove('out'); }, 450); };
    t.textContent = lines[i++ % lines.length]; const iv = setInterval(() => { if (!t.isConnected) return clearInterval(iv); next(); }, 3400);
  }
  async function boot() {
    UI.mount(); UI.fade.classList.add('on');
    const [config, characters, quests, dialogue, world, credits] = await Promise.all(['config', 'characters', 'quests', 'dialogue', 'world', 'credits'].map(n => getJSON('data/story/' + n + '.json')));
    S.data = { config, characters, quests, dialogue, world, credits };
    loadingTicker();
    const backend = await SV.init(); console.info('[story] saves use', backend);
    for (let i = 0; i < 400 && !G.ready(); i++) await sleep(150);
    if (!G.ready()) throw new Error('The game did not finish loading.');
    S.fsm.set('intro'); applyFsm();
    await placeTitleShot();
    await UI.fadeTo(false, 400);
    await UI.intro(credits);
    await showTitle(true);
  }
  root.STORY.debug = { G, scenes, get mode() { return mode; }, startRoam, startNewGame, loadSlot, showTitle };
  boot().catch(err => { console.error('[story] boot failed', err); const m = doc.getElementById('msg'); if (m) m.textContent = 'Story layer failed: ' + err.message; UI.fade && UI.fade.classList.remove('on'); S.fsm.set('play'); mode = 'roam'; root.__freeze = false; root.__noOdm = false; root.__noTitan = false; root.__hideAvatar = false; });
})(typeof window !== 'undefined' ? window : globalThis);

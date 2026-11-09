/* Ashes of the Walls — story UI (DOM). Screens, dialogue plate, HUD pieces. */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui = {};
  const doc = root.document;

  const h = (tag, props, ...kids) => {
    const e = doc.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) { if (typeof v === 'function') e.addEventListener(k.slice(2), v); }
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : doc.createTextNode(String(c))); }
    return e;
  };
  UI.h = h;
  const fmtTime = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; };
  const fmtDate = t => { try { return new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } };

  /* ---------- settings ---------- */
  UI.settings = { textSpeed: 'normal', shake: true };
  const SPEED = { slow: 24, normal: 48, fast: 110, instant: 0 };
  try { Object.assign(UI.settings, JSON.parse(root.localStorage.getItem('ashes_settings') || '{}')); } catch (e) {}
  UI.saveSettings = () => { try { root.localStorage.setItem('ashes_settings', JSON.stringify(UI.settings)); } catch (e) {} };

  /* ---------- root + screens ---------- */
  let R, screens = {}, cur = null;
  UI.mount = function () {
    R = h('div', { id: 'sv-root' });
    doc.body.appendChild(R);
    UI.R = R;
    build(); buildScreens();
  };
  function screen(id, cls, ...kids) { const s = h('section', { class: 'sv-screen ' + (cls || ''), id: 'sv-' + id, hidden: true }, ...kids); R.appendChild(s); screens[id] = s; return s; }
  UI.show = function (id) { UI.hideAll(); const s = screens[id]; if (s) { s.hidden = false; cur = id; const f = s.querySelector('[data-focus]'); if (f) setTimeout(() => f.focus && f.focus({ preventScroll: true }), 30); } };
  UI.hideAll = function () { for (const k in screens) screens[k].hidden = true; cur = null; };
  UI.current = () => cur;
  const btn = (text, onclick, props) => h('button', Object.assign({ type: 'button', onclick }, props || {}), text);

  /* ---------- build static pieces ---------- */
  function build() {
    // HUD / overlay pieces
    UI.tap = h('div', { class: 'sv-tap', hidden: true }); R.appendChild(UI.tap);
    UI.marks = h('div', { class: 'sv-marks' }); R.appendChild(UI.marks);
    UI.track = h('div', { class: 'sv-track', hidden: true, 'aria-live': 'polite' }, h('span', { class: 'sv-track-q' }), h('span', { class: 'sv-track-o' })); R.appendChild(UI.track);
    UI.talk = h('button', { class: 'sv-talk', type: 'button', hidden: true, onclick: () => UI._talkCb && UI._talkCb() }, h('span', { class: 'sv-talk-k' }, 'G'), h('span', { class: 'sv-talk-t' })); R.appendChild(UI.talk);
    UI.btns = h('div', { class: 'sv-hudbtns', hidden: true },
      btn(h('span', { class: 'sv-ico sv-ico-pause' }), () => UI._cb('pause'), { 'aria-label': 'Menu', class: 'sv-hb sv-hb-pause' }),
      btn(h('span', { class: 'sv-ico sv-ico-book' }), () => UI._cb('journal'), { 'aria-label': 'Journal', class: 'sv-hb sv-hb-book' }),
      btn(h('span', { class: 'sv-ico sv-ico-map' }), () => UI._cb('map'), { 'aria-label': 'Map', class: 'sv-hb sv-hb-map' }));
    R.appendChild(UI.btns);
    UI.toastBox = h('div', { class: 'sv-toasts', 'aria-live': 'polite' }); R.appendChild(UI.toastBox);
    UI.bars = h('div', { class: 'sv-bars' }, h('i'), h('i')); R.appendChild(UI.bars);
    UI.flashEl = h('div', { class: 'sv-flash' }); R.appendChild(UI.flashEl);
    UI.cardEl = h('div', { class: 'sv-card', hidden: true }, h('h2'), h('p')); R.appendChild(UI.cardEl);
    UI.fade = h('div', { class: 'sv-fade' }); R.appendChild(UI.fade);
    UI.emberCv = h('canvas', { class: 'sv-embers', hidden: true, 'aria-hidden': 'true' }); R.insertBefore(UI.emberCv, R.firstChild);
    UI.tickerEl = h('p', { class: 'sv-ticker', 'aria-live': 'off' }); R.appendChild(UI.tickerEl);
    UI.stampEl = h('div', { class: 'sv-stamp', hidden: true }, h('h1'), h('p')); R.appendChild(UI.stampEl);

    // dialogue plate
    UI.dlg = h('div', { class: 'sv-dlg', hidden: true, role: 'dialog', 'aria-label': 'Conversation' },
      h('div', { class: 'sv-plate' },
        h('div', { class: 'sv-who' }, h('span', { class: 'sv-seal' }), h('span', { class: 'sv-name' })),
        h('p', { class: 'sv-line', 'aria-live': 'polite' }, h('span', { class: 'sv-vis' }), h('span', { class: 'sv-hid' })),
        h('div', { class: 'sv-choices' }),
        h('span', { class: 'sv-more', 'aria-hidden': 'true' })));
    R.appendChild(UI.dlg);
    UI.dlg.querySelector('.sv-plate').addEventListener('pointerdown', e => { if (e.target.closest('.sv-choices')) return; UI.dialogue.tap(); });
    UI.tap.addEventListener('pointerdown', () => { if (!UI.dlg.hidden) UI.dialogue.tap(); });
  }
  UI._cb = n => UI.handlers && UI.handlers[n] && UI.handlers[n]();

  /* ---------- dialogue plate ---------- */
  let typer = null;
  UI.dialogue = {
    open() { UI.dlg.hidden = false; UI.tap.hidden = false; },
    close() { UI.dlg.hidden = true; UI.tap.hidden = true; if (typer) typer.finish(true); typer = null; },
    show(line) {
      const plate = UI.dlg.querySelector('.sv-plate'), sp = line.speaker, narr = sp.id === 'narr';
      plate.classList.toggle('narr', narr); plate.classList.toggle('prompt', !line.text);
      plate.style.setProperty('--who', sp.color); plate.dataset.mood = line.mood || '';
      UI.dlg.querySelector('.sv-seal').textContent = sp.mono || '';
      UI.dlg.querySelector('.sv-name').textContent = sp.name;
      const vis = UI.dlg.querySelector('.sv-vis'), hid = UI.dlg.querySelector('.sv-hid'), box = UI.dlg.querySelector('.sv-choices'), more = UI.dlg.querySelector('.sv-more');
      box.textContent = ''; more.classList.remove('on'); plate.classList.remove('choosing');
      if (typer) typer.finish(true);
      const full = line.text || '';
      const showEnd = () => {
        more.classList.toggle('on', !line.choices);
        if (line.choices) {
          plate.classList.add('choosing');
          line.choices.forEach((c, i) => box.appendChild(h('button', { type: 'button', class: 'sv-choice', onclick: () => S.dialogue.choose(i) }, h('span', { class: 'sv-ck' }, String(i + 1)), h('span', { text: c.text }))));
          const f = box.querySelector('button'); if (f) f.focus({ preventScroll: true });
        }
      };
      const cps = SPEED[UI.settings.textSpeed] || 0;
      let i = 0, done = false, raf = 0, t0 = performance.now();
      const paint = n => { vis.textContent = full.slice(0, n); hid.textContent = full.slice(n); };
      const finish = silent => { if (done) return; done = true; cancelAnimationFrame(raf); paint(full.length); if (!silent) showEnd(); };
      typer = { finish, isDone: () => done };
      if (!cps || !full) { paint(full.length); done = true; showEnd(); return; }
      paint(0);
      const tick = now => { i = Math.floor((now - t0) / 1000 * cps); if (i >= full.length) return finish(); paint(i); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    },
    tap() { if (typer && !typer.isDone()) typer.finish(); else S.dialogue.advance(); },
    choose(n) { const b = UI.dlg.querySelectorAll('.sv-choice')[n]; if (b) b.click(); }
  };

  /* ---------- small HUD pieces ---------- */
  UI.toast = function (text, ms) {
    const t = h('div', { class: 'sv-toast', text: S.fmt(text) }); UI.toastBox.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms || 2600); setTimeout(() => t.remove(), (ms || 2600) + 500);
  };
  UI.card = function (title, sub, ms) {
    return new Promise(res => {
      const c = UI.cardEl; c.querySelector('h2').textContent = S.fmt(title); c.querySelector('p').textContent = S.fmt(sub || '');
      c.hidden = false; c.classList.remove('out'); void c.offsetWidth; c.classList.add('in');
      setTimeout(() => { c.classList.add('out'); setTimeout(() => { c.hidden = true; c.classList.remove('in', 'out'); res(); }, 700); }, ms || 3200);
    });
  };
  UI.letterbox = on => UI.bars.classList.toggle('on', !!on);
  UI.flash = ms => { const f = UI.flashEl; f.style.transition = 'none'; f.style.opacity = '1'; void f.offsetWidth; f.style.transition = 'opacity ' + (ms || 900) + 'ms ease-out'; f.style.opacity = '0'; };
  UI.shake = ms => { if (!UI.settings.shake) return; const c = doc.getElementById('c'); if (!c) return; c.classList.remove('sv-shake'); void c.offsetWidth; c.classList.add('sv-shake'); setTimeout(() => c.classList.remove('sv-shake'), ms || 900); };
  UI.fadeTo = (on, ms) => new Promise(res => { UI.fade.style.transitionDuration = (ms || 600) + 'ms'; UI.fade.classList.toggle('on', !!on); setTimeout(res, (ms || 600) + 30); });
  UI.setTracker = function (qTitle, text) {
    if (!text) { UI.track.hidden = true; return; }
    UI.track.querySelector('.sv-track-q').textContent = S.fmt(qTitle); UI.track.querySelector('.sv-track-o').textContent = S.fmt(text); UI.track.hidden = false;
  };
  UI.setTalk = function (label, cb) { UI._talkCb = cb; if (!label) { UI.talk.hidden = true; return; } UI.talk.querySelector('.sv-talk-t').textContent = label; UI.talk.hidden = false; };
  UI.setHudButtons = on => { UI.btns.hidden = !on; };

  /* markers: list of {id, label, x, y, vis, edge, ang, dist, main, talk} */
  const markEls = {};
  UI.syncMarkers = function (list) {
    const seen = {};
    for (const m of list) {
      seen[m.id] = 1; let e = markEls[m.id];
      if (!e) { e = markEls[m.id] = h('div', { class: 'sv-mark' }, h('i', { class: 'sv-mk-i' }), h('span', { class: 'sv-mk-t' }), h('span', { class: 'sv-mk-d' })); UI.marks.appendChild(e); }
      e.className = 'sv-mark' + (m.main ? ' main' : '') + (m.talk ? ' talk' : '') + (m.edge ? ' edge' : '');
      e.style.transform = 'translate(' + m.x.toFixed(1) + 'px,' + m.y.toFixed(1) + 'px)';
      e.querySelector('.sv-mk-i').style.transform = m.edge ? 'rotate(' + m.ang.toFixed(2) + 'rad)' : '';
      const t = e.querySelector('.sv-mk-t'); if (t.textContent !== m.label) t.textContent = m.label;
      e.querySelector('.sv-mk-d').textContent = m.dist != null ? Math.round(m.dist) + ' m' : '';
    }
    for (const id in markEls) if (!seen[id]) { markEls[id].remove(); delete markEls[id]; }
  };

  /* ---------- splash: parchment, ash and embers; audio is unlocked by the first tap ---------- */
  UI.addScreen = screen;
  let emberRaf = 0, embers = [];
  UI.embers = function (on) {
    const c = UI.emberCv; if (!c) return; cancelAnimationFrame(emberRaf); c.hidden = !on; if (!on || !c.getContext) return;
    const g = c.getContext('2d'); let W = 0, Hh = 0;
    const fit = () => { const r = c.getBoundingClientRect ? c.getBoundingClientRect() : { width: 800, height: 400 }; W = c.width = Math.max(2, Math.round((r.width || 800) / 2)); Hh = c.height = Math.max(2, Math.round((r.height || 400) / 2)); };
    fit(); embers = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * Hh, v: 4 + Math.random() * 10, r: 0.6 + Math.random() * 1.8, a: Math.random() * 6.3, ash: Math.random() < 0.6 }));
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.clearRect(0, 0, W, Hh);
      for (const e of embers) {
        e.y -= e.v * dt * (e.ash ? 0.5 : 1); e.x += Math.sin(e.a += dt * 0.8) * 6 * dt + 3 * dt; if (e.y < -4) { e.y = Hh + 4; e.x = Math.random() * W; } if (e.x > W + 4) e.x = -4;
        g.globalAlpha = e.ash ? 0.35 : 0.5 + 0.4 * Math.sin(e.a * 2); g.fillStyle = e.ash ? '#cfc8b8' : '#f0a24a'; g.beginPath(); g.arc(e.x, e.y, e.r, 0, 6.3); g.fill();
      }
      emberRaf = requestAnimationFrame(tick);
    };
    emberRaf = requestAnimationFrame(tick);
  };
  UI.splash = {
    gate(cb, legal) {                                       // "Tap to begin": the user gesture that starts audio
      const s = screens.splash, box = s.querySelector('.sv-splash-box'); UI.show('splash'); UI.embers(true); box.classList.remove('in');
      box.textContent = ''; box.append(h('h1', { text: 'Ashes of the Walls' }), h('p', { class: 'sv-splash-tap', text: 'Tap to begin' }), h('p', { class: 'sv-splash-legal', text: legal || '' })); void box.offsetWidth; box.classList.add('in');
      let done = false; const go = () => { if (done) return; done = true; s.onpointerdown = null; s.onkeydown = null; cb(); }; s.onpointerdown = go; s.tabIndex = 0; s.onkeydown = e => { if (e.code === 'Enter' || e.code === 'Space') go(); }; s.focus && s.focus();
    },
    say(text, ms, cls) {                                    // a line that fades in and out on the parchment
      return new Promise(res => { const box = screens.splash.querySelector('.sv-splash-box'); box.classList.remove('in'); box.textContent = ''; box.append(h('p', { class: 'sv-splash-line ' + (cls || ''), text })); void box.offsetWidth; box.classList.add('in'); setTimeout(() => { box.classList.remove('in'); setTimeout(res, 900); }, ms || 2600); });
    }
  };
  UI.stamp = function (text, sub) {                          // the title card slams onto a black screen
    const e = UI.stampEl; e.querySelector('h1').textContent = text; e.querySelector('p').textContent = sub || ''; e.hidden = false; e.classList.remove('slam', 'out'); void e.offsetWidth; e.classList.add('slam');
  };
  UI.unstamp = function () { const e = UI.stampEl; e.classList.add('out'); setTimeout(() => { e.hidden = true; e.classList.remove('slam', 'out'); }, 900); };
  UI.setTicker = function (lines) {
    const t = UI.tickerEl; if (!t) return; clearInterval(UI._tickIv); if (!lines || !lines.length) { t.textContent = ''; return; } let i = 0;
    const show = () => { t.classList.add('out'); setTimeout(() => { t.textContent = lines[i++ % lines.length]; t.classList.remove('out'); }, 500); }; t.textContent = lines[i++ % lines.length]; UI._tickIv = setInterval(show, 4200);
  };

  /* ---------- credits scene ---------- */
  UI.credits = function (cr, onBack) {
    const s = screens.credits, roll = s.querySelector('.sv-roll'); roll.textContent = '';
    roll.append(h('h2', { text: S.data.config.title || 'Ashes of the Walls' }));
    if (cr.director) roll.append(h('p', { class: 'sv-role' }, 'Created by ', h('b', { text: cr.director })));
    for (const sec of cr.sections || []) {
      roll.append(h('h3', { text: sec.title }));
      for (const it of sec.items) roll.append(h('p', { class: 'sv-cr-it' }, h('b', { text: it.what }), h('span', { text: [it.who, it.lic].filter(Boolean).join(', ') })));
    }
    roll.append(h('p', { class: 'sv-cr-note', text: cr.disclaimer }));
    UI.show('credits'); roll.style.animation = 'none'; void roll.offsetWidth;
    const dur = Math.max(30, roll.scrollHeight / 28); roll.style.animation = 'sv-roll ' + dur + 's linear forwards';
    s.querySelector('.sv-back').onclick = onBack;
  };

  /* ---------- title: chiselled stone menu over the dawn district ---------- */
  UI.title = function (info) {
    const s = screens.title, menu = s.querySelector('.sv-menu');
    s.querySelector('.sv-ver').textContent = 'Prototype ' + (info.version || '');
    const cont = s.querySelector('[data-act=continue]'); cont.hidden = !info.latest;
    if (info.latest) cont.querySelector('small').textContent = [info.latest.name, info.latest.quest || 'Prologue', fmtTime(info.latest.playSec)].filter(Boolean).join(', ');
    UI.show('title'); UI.embers(true);
    const first = !cont.hidden ? cont : menu.querySelector('[data-act=new]'); first.setAttribute('data-focus', ''); setTimeout(() => first.focus && first.focus({ preventScroll: true }), 60);
    s.classList.remove('rise'); void s.offsetWidth; s.classList.add('rise');
  };

  /* the registry (character creator) lives in creator.js */
  UI.screenEl = id => screens[id];

  /* ---------- pause / journal / saves ---------- */
  UI.pause = function (items) {
    const s = screens.pause, nav = s.querySelector('.sv-pnav'); nav.textContent = '';
    items.forEach((it, i) => nav.append(h('button', { type: 'button', class: 'sv-pbtn', onclick: it.run, 'data-focus': i === 0 ? '' : null }, it.text, it.hint ? h('small', { text: it.hint }) : null)));
    UI.show('pause');
  };
  UI.settingsPanel = function (back, extra) {
    const s = screens.pause, nav = s.querySelector('.sv-pnav'); nav.textContent = '';
    nav.append(h('div', { class: 'sv-row' }, h('label', { text: 'Text speed' }), h('div', { class: 'sv-chips' }, ['slow', 'normal', 'fast', 'instant'].map(k => h('button', { type: 'button', class: 'sv-chip', role: 'radio', 'aria-checked': String(UI.settings.textSpeed === k), onclick: () => { UI.settings.textSpeed = k; UI.saveSettings(); UI.settingsPanel(back, extra); }, text: k[0].toUpperCase() + k.slice(1) })))));
    nav.append(h('div', { class: 'sv-row' }, h('label', { text: 'Screen shake' }), h('div', { class: 'sv-chips' }, [[true, 'On'], [false, 'Off']].map(([v, t]) => h('button', { type: 'button', class: 'sv-chip', role: 'radio', 'aria-checked': String(UI.settings.shake === v), onclick: () => { UI.settings.shake = v; UI.saveSettings(); UI.settingsPanel(back, extra); }, text: t })))));
    (extra || []).forEach(it => nav.append(h('button', { type: 'button', class: 'sv-pbtn', onclick: it.run }, it.text, it.hint ? h('small', { text: it.hint }) : null)));
    nav.append(h('button', { type: 'button', class: 'sv-pbtn', onclick: back, 'data-focus': '' }, 'Back'));
    const f = nav.querySelector('[data-focus]'); if (f) f.focus({ preventScroll: true });
  };

  UI.optionsPanel = function (back) {
    const s = screens.pause, nav = s.querySelector('.sv-pnav'); nav.textContent = ''; const Au = S.audio;
    const range = (label, key) => h('div', { class: 'sv-row' }, h('label', { text: label }), h('input', { type: 'range', class: 'sv-range', min: 0, max: 100, value: Math.round(Au.settings[key] * 100), 'aria-label': label, oninput: e => Au.setVolume(key, +e.target.value / 100) }));
    nav.append(range('Master volume', 'vol'), range('Music', 'music'), range('Sound effects', 'sfx'));
    nav.append(h('div', { class: 'sv-row' }, h('label', { text: 'Sound' }), h('div', { class: 'sv-chips' }, [[false, 'On'], [true, 'Muted']].map(([v, t]) => h('button', { type: 'button', class: 'sv-chip', role: 'radio', 'aria-checked': String(!!Au.settings.muted === v), onclick: () => { Au.setMuted(v); UI.optionsPanel(back); }, text: t })))));
    nav.append(h('div', { class: 'sv-row' }, h('label', { text: 'Text speed' }), h('div', { class: 'sv-chips' }, ['slow', 'normal', 'fast', 'instant'].map(k => h('button', { type: 'button', class: 'sv-chip', role: 'radio', 'aria-checked': String(UI.settings.textSpeed === k), onclick: () => { UI.settings.textSpeed = k; UI.saveSettings(); UI.optionsPanel(back); }, text: k[0].toUpperCase() + k.slice(1) })))));
    nav.append(h('div', { class: 'sv-row' }, h('label', { text: 'Screen shake' }), h('div', { class: 'sv-chips' }, [[true, 'On'], [false, 'Off']].map(([v, t]) => h('button', { type: 'button', class: 'sv-chip', role: 'radio', 'aria-checked': String(UI.settings.shake === v), onclick: () => { UI.settings.shake = v; UI.saveSettings(); UI.optionsPanel(back); }, text: t })))));
    if (window.GFX && GFX.E) nav.append(h('div', { class: 'sv-row' }, h('label', { text: 'Graphics' }), h('div', { class: 'sv-chips' }, ['auto', 'low', 'medium', 'high', 'ultra'].map(k => h('button', { type: 'button', class: 'sv-chip', role: 'radio', 'aria-checked': String(k === 'auto' ? GFX.auto : (!GFX.auto && GFX.tier === k)), onclick: () => { GFX.set(k); UI.optionsPanel(back); }, text: k[0].toUpperCase() + k.slice(1) })))));
    nav.append(h('button', { type: 'button', class: 'sv-pbtn', onclick: back, 'data-focus': '' }, 'Back')); UI.show('pause'); const f = nav.querySelector('[data-focus]'); if (f) f.focus({ preventScroll: true });
  };

  UI.journal = function (onBack) {
    const s = screens.journal, q = s.querySelector('.sv-j-quests'), b = s.querySelector('.sv-j-bonds'); q.textContent = ''; b.textContent = '';
    const ids = Object.keys(S.state.quests);
    const order = ids.sort((a, c) => (S.quests.def(a).kind === 'main' ? 0 : 1) - (S.quests.def(c).kind === 'main' ? 0 : 1));
    const part = (title, list) => { if (!list.length) return; q.append(h('h3', { text: title })); list.forEach(id => { const d = S.quests.def(id), st = S.state.quests[id];
      q.append(h('article', { class: 'sv-q ' + st.status }, h('h4', { text: d.title }), h('p', { class: 'sv-q-s', text: S.fmt(d.summary || '') }),
        h('ul', {}, d.objectives.map(o => h('li', { class: st.done[o.id] ? 'done' : '' }, S.fmt(o.text)))))); }); };
    part('Active', order.filter(id => S.state.quests[id].status === 'active'));
    part('Finished', order.filter(id => S.state.quests[id].status === 'done'));
    if (!ids.length) q.append(h('p', { class: 'sv-empty', text: 'Nothing in the journal yet. Talk to people and the story will start writing itself.' }));
    const bonds = Object.keys(S.state.bonds);
    b.append(h('h3', { text: 'Bonds' }));
    if (!bonds.length) b.append(h('p', { class: 'sv-empty', text: 'No bonds yet. They grow from what you say and do.' }));
    bonds.forEach(id => { const sp = S.speaker(id), v = S.state.bonds[id]; b.append(h('div', { class: 'sv-bond' }, h('span', { class: 'sv-seal', style: { '--who': sp.color }, text: sp.mono }), h('span', { class: 'sv-bond-n', text: sp.name }), h('span', { class: 'sv-pips', role: 'img', 'aria-label': 'Bond ' + v }, Array.from({ length: 6 }, (_, i) => h('i', { class: i < v ? 'on' : '' }))))); });
    s.querySelector('.sv-back').onclick = onBack; UI.show('journal');
  };
  UI.saves = function (mode, slots, onPick, onBack) {      // mode: 'save' | 'load'
    const s = screens.saves; s.querySelector('h2').textContent = mode === 'save' ? 'Save game' : 'Load game';
    const list = s.querySelector('.sv-slots'); list.textContent = '';
    const names = { auto: 'Autosave', slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3' };
    for (const k of Object.keys(names)) {
      const info = slots[k], disabled = (mode === 'save' && k === 'auto') || (mode === 'load' && !info);
      list.append(h('button', { type: 'button', class: 'sv-slot', disabled, onclick: () => onPick(k) },
        h('b', { text: names[k] }), info ? h('span', { text: [info.name, info.quest, fmtTime(info.playSec)].filter(Boolean).join(', ') }) : h('span', { class: 'sv-empty', text: 'Empty' }),
        info ? h('small', { text: fmtDate(info.savedAt) }) : null));
    }
    s.querySelector('.sv-back').onclick = onBack; UI.show('saves');
  };
  UI.endCard = function (o, buttons) {
    const s = screens.ending; s.querySelector('h2').textContent = S.fmt(o.title); const p = s.querySelector('.sv-end-lines'); p.textContent = '';
    (o.lines || []).forEach(l => p.append(h('p', { text: S.fmt(l) })));
    const bx = s.querySelector('.sv-end-btns'); bx.textContent = ''; buttons.forEach((b, i) => bx.append(h('button', { type: 'button', class: 'sv-pbtn', onclick: b.run, 'data-focus': i === 0 ? '' : null }, b.text)));
    UI.show('ending');
  };

  /* ---------- static screens ---------- */
  function buildScreens() {
    screen('splash', 'sv-splash', h('div', { class: 'sv-splash-box' }));
    screen('title', 'sv-title',
      h('div', { class: 'sv-title-block' },
        h('h1', {}, h('span', { text: 'Ashes' }), h('span', { text: 'of the Walls' })), h('p', { class: 'sv-tag', text: 'You were born behind the walls. You will die for what lies beyond them.' }),
        h('nav', { class: 'sv-menu', 'aria-label': 'Main menu' },
          h('button', { type: 'button', class: 'sv-stone', 'data-act': 'continue', hidden: true, onclick: () => UI._cb('continue'), onpointerenter: () => UI._cb('hover'), onfocus: () => UI._cb('hover') }, 'Load file', h('small')),
          h('button', { type: 'button', class: 'sv-stone primary', 'data-act': 'new', onclick: () => UI._cb('new'), onpointerenter: () => UI._cb('hoverBegin'), onfocus: () => UI._cb('hoverBegin') }, 'Begin journey'),
          h('button', { type: 'button', class: 'sv-stone locked', 'data-act': 'train', 'aria-disabled': 'true', onclick: () => UI._cb('locked') }, 'Training grounds', h('small', { text: 'Opens in Act 2' })),
          h('button', { type: 'button', class: 'sv-stone', 'data-act': 'options', onclick: () => UI._cb('options'), onpointerenter: () => UI._cb('hover'), onfocus: () => UI._cb('hover') }, 'Options'),
          h('button', { type: 'button', class: 'sv-stone', 'data-act': 'credits', onclick: () => UI._cb('credits'), onpointerenter: () => UI._cb('hover'), onfocus: () => UI._cb('hover') }, 'Credits'))),
      h('p', { class: 'sv-ver' }));
    const ic = p => h('i', { class: 'cr-i', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + p + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
    const cam = (p, v, label, on) => h('button', { type: 'button', class: on ? 'on' : '', 'data-v': v, 'aria-label': label + ' camera', title: label }, ic(p), h('span', { text: label }));
    screen('creator', 'cr-root',
      h('div', { class: 'cr-stage', 'aria-label': 'Preview. Drag to turn your character.' }, h('div', { class: 'cr-cams', role: 'group', 'aria-label': 'Camera' },
        cam('M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 21l1.6-8L7 11l.8-2h8.4l.8 2-2.6 2 1.6 8', 'full', 'Body', true), cam('M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21c0-4.4 3-7 7-7s7 2.6 7 7', 'upper', 'Bust'), cam('M12 3c4 0 6.5 3 6.5 7.5S16 20 12 20s-6.5-5-6.5-9.5S8 3 12 3zM9 10v1.4M15 10v1.4M10 15c1.2 1 2.8 1 4 0', 'face', 'Face'),
        h('button', { type: 'button', class: 'cr-spin', 'aria-label': 'Turntable', title: 'Turntable' }, ic('M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4'), h('span', { text: 'Turn' })), h('button', { type: 'button', class: 'cr-hide', 'aria-label': 'Hide menu', title: 'Hide menu' }, ic('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'), h('span', { text: 'Hide' }))),
        h('p', { class: 'cr-hint', text: 'Drag to turn' })),
      h('div', { class: 'cr-left' }, h('header', { class: 'cr-top' }, h('i', { class: 'cr-logo' }), h('b', { text: 'Character Creation' }), h('span', { text: 'Shiganshina District Registry, year 845' })),
        h('div', { class: 'cr-main' }, h('nav', { class: 'cr-menu', role: 'tablist', 'aria-label': 'Categories' }), h('div', { class: 'cr-panel' }, h('div', { class: 'cr-ph' }, h('h2', { class: 'cr-ph-title' }), h('button', { type: 'button', class: 'cr-reset', 'aria-label': 'Reset this character' }, ic('M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4'), h('span', { text: 'Reset' }))), h('div', { class: 'cr-body' }))),
        h('footer', { class: 'cr-foot' }, h('button', { type: 'button', class: 'cr-back' }, ic('M15 5l-7 7 7 7'), h('span', { text: 'Back' })), h('button', { type: 'button', class: 'cr-next' }, h('span', { text: 'Continue' }), ic('M9 5l7 7-7 7')))));
    screen('pause', 'sv-pause', h('div', { class: 'sv-panel' }, h('h2', { text: 'Paused' }), h('nav', { class: 'sv-pnav' })));
    screen('journal', 'sv-journal', h('div', { class: 'sv-panel wide' }, h('h2', { text: 'Journal' }), h('div', { class: 'sv-j' }, h('div', { class: 'sv-j-quests' }), h('div', { class: 'sv-j-bonds' })), btn('Back', null, { class: 'sv-back sv-ghost' })));
    screen('saves', 'sv-saves', h('div', { class: 'sv-panel' }, h('h2'), h('div', { class: 'sv-slots' }), btn('Back', null, { class: 'sv-back sv-ghost' })));
    screen('credits', 'sv-credits', h('div', { class: 'sv-roll-wrap' }, h('div', { class: 'sv-roll' })), btn('Back', null, { class: 'sv-back sv-ghost' }));
    screen('ending', 'sv-ending', h('div', { class: 'sv-panel' }, h('h2'), h('div', { class: 'sv-end-lines' }), h('div', { class: 'sv-end-btns' })));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})(typeof window !== 'undefined' ? window : globalThis);

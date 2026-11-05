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
      btn(h('span', { class: 'sv-ico sv-ico-book' }), () => UI._cb('journal'), { 'aria-label': 'Journal', class: 'sv-hb sv-hb-book' }));
    R.appendChild(UI.btns);
    UI.toastBox = h('div', { class: 'sv-toasts', 'aria-live': 'polite' }); R.appendChild(UI.toastBox);
    UI.bars = h('div', { class: 'sv-bars' }, h('i'), h('i')); R.appendChild(UI.bars);
    UI.flashEl = h('div', { class: 'sv-flash' }); R.appendChild(UI.flashEl);
    UI.cardEl = h('div', { class: 'sv-card', hidden: true }, h('h2'), h('p')); R.appendChild(UI.cardEl);
    UI.fade = h('div', { class: 'sv-fade' }); R.appendChild(UI.fade);

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

  /* ---------- opening sequence (credits while loading) ---------- */
  UI.intro = function (cr) {
    return new Promise(res => {
      const s = screens.intro, box = s.querySelector('.sv-intro-box'); UI.show('intro');
      const slides = [{ k: 'note', t: cr.disclaimer }];
      for (const sec of cr.sections || []) slides.push({ k: 'sec', sec });
      let i = 0, timer = 0, ended = false;
      const end = () => { if (ended) return; ended = true; clearTimeout(timer); s.onpointerdown = null; res(); };
      const next = () => {
        if (ended) return;
        if (i >= slides.length) return end();
        const sl = slides[i++]; box.classList.remove('in'); void box.offsetWidth; box.textContent = '';
        if (sl.k === 'note') box.append(h('p', { class: 'sv-intro-note', text: sl.t }));
        else box.append(h('h3', { text: sl.sec.title }), ...sl.sec.items.map(it => h('p', { class: 'sv-intro-it' }, h('b', { text: it.what }), h('span', { text: [it.who, it.lic].filter(Boolean).join(', ') }))));
        box.classList.add('in'); timer = setTimeout(next, sl.k === 'note' ? 4200 : 2600);
      };
      s.onpointerdown = () => { clearTimeout(timer); next(); };
      s.querySelector('.sv-skip').onclick = e => { e.stopPropagation(); end(); };
      next();
    });
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

  /* ---------- title ---------- */
  UI.title = function (info) {
    const s = screens.title;
    s.querySelector('.sv-ver').textContent = 'Prototype build ' + (info.version || '');
    const cont = s.querySelector('[data-act=continue]');
    cont.hidden = !info.latest;
    if (info.latest) cont.querySelector('small').textContent = [info.latest.name, info.latest.quest || 'Prologue', fmtTime(info.latest.playSec)].filter(Boolean).join(', ');
    UI.show('title');
    const first = (!cont.hidden ? cont : s.querySelector('[data-act=new]')); first.setAttribute('data-focus', ''); setTimeout(() => first.focus({ preventScroll: true }), 40);
  };

  /* ---------- character creator ---------- */
  UI.creator = function (cfg, onDone, onCancel) {
    const s = screens.creator, body = s.querySelector('.sv-cr-body'), side = s.querySelector('.sv-steps');
    const d = { name: '', gender: 'f', build: 1, hair: 0, skin: 1, scar: 0, bloodline: 'common', anchor: { rel: 'sibling', name: '', gender: 'm' }, difficulty: 'soldier' };
    const steps = ['Who you are', 'Your blood', 'Your Anchor', 'Your resolve'];
    let step = 0;
    const chips = (opts, val, set, key) => h('div', { class: 'sv-chips', role: 'radiogroup' }, opts.map((o, i) => {
      const id = o.id !== undefined ? o.id : i, label = o.name || o;
      return h('button', { type: 'button', role: 'radio', class: 'sv-chip', 'aria-checked': String(val === id), onclick: () => { set(id); render(); } }, label);
    }));
    const swatches = (cols, val, set) => h('div', { class: 'sv-chips' }, cols.map((c, i) => h('button', { type: 'button', role: 'radio', 'aria-label': 'Option ' + (i + 1), 'aria-checked': String(val === i), class: 'sv-sw', style: { background: c }, onclick: () => { set(i); render(); } })));
    const row = (label, node) => h('div', { class: 'sv-row' }, h('label', { text: label }), node);
    const cards = (opts, val, set) => h('div', { class: 'sv-cards', role: 'radiogroup' }, opts.map(o => h('button', { type: 'button', role: 'radio', 'aria-checked': String(val === o.id), class: 'sv-card-opt', onclick: () => { set(o.id); render(); } }, h('b', { text: o.name }), o.tag ? h('em', { text: o.tag }) : null, h('span', { text: o.text || '' }))));
    const input = (val, ph, set, id) => h('input', { type: 'text', class: 'sv-input', id, maxlength: 16, value: val, placeholder: ph, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', oninput: e => { set(e.target.value); validate(); } });
    let nextBtn;
    const valid = () => step === 0 ? d.name.trim().length > 0 : step === 2 ? d.anchor.name.trim().length > 0 : true;
    function validate() { if (nextBtn) nextBtn.disabled = !valid(); }
    function render() {
      side.textContent = ''; steps.forEach((t, i) => side.append(h('li', { class: i === step ? 'on' : i < step ? 'done' : '', text: t })));
      body.textContent = '';
      if (step === 0) body.append(
        h('h2', { text: 'Who you are' }), h('p', { class: 'sv-lead', text: 'The world will remember a name. Choose the one you want it to remember.' }),
        row('Name', input(d.name, 'Your name', v => d.name = v, 'sv-in-name')),
        row('Pronouns', chips(cfg.genders, d.gender, v => d.gender = v)),
        row('Build', chips(cfg.builds.map((n, i) => ({ id: i, name: n })), d.build, v => d.build = v)),
        row('Hair', swatches(cfg.hair, d.hair, v => d.hair = v)), row('Skin', swatches(cfg.skin, d.skin, v => d.skin = v)),
        row('Scar', chips(cfg.scars.map((n, i) => ({ id: i, name: n })), d.scar, v => d.scar = v)));
      else if (step === 1) body.append(h('h2', { text: 'Your blood' }), h('p', { class: 'sv-lead', text: 'Permanent. Chosen once, carried to the end.' }), cards(cfg.bloodlines, d.bloodline, v => d.bloodline = v));
      else if (step === 2) body.append(
        h('h2', { text: 'Your Anchor' }), h('p', { class: 'sv-lead', text: 'One person you will not want to lose. What happens to them depends on you, and it is meant to hurt.' }),
        row('Who are they to you?', chips(cfg.anchorRelations, d.anchor.rel, v => d.anchor.rel = v)),
        row('Their name', input(d.anchor.name, 'Their name', v => d.anchor.name = v, 'sv-in-anchor')),
        row('Pronouns', chips(cfg.genders, d.anchor.gender, v => d.anchor.gender = v)));
      else body.append(
        h('h2', { text: 'Your resolve' }), h('p', { class: 'sv-lead', text: 'How hard should the world be on you?' }), cards(cfg.difficulties, d.difficulty, v => d.difficulty = v),
        h('p', { class: 'sv-sum' }, h('b', { text: d.name.trim() }), ', ' + (cfg.bloodlines.find(b => b.id === d.bloodline) || {}).name + ', bound to ', h('b', { text: d.anchor.name.trim() }), '.'));
      const back = s.querySelector('.sv-cr-back'), nb = s.querySelector('.sv-cr-next');
      back.textContent = step === 0 ? 'Cancel' : 'Back'; nb.textContent = step === steps.length - 1 ? 'Begin' : 'Continue'; nextBtn = nb; validate();
      body.scrollTop = 0;
    }
    s.querySelector('.sv-cr-back').onclick = () => { if (step === 0) onCancel(); else { step--; render(); } };
    s.querySelector('.sv-cr-next').onclick = () => {
      if (!valid()) return;
      if (step < steps.length - 1) { step++; render(); return; }
      const a = d.anchor;
      onDone({ name: d.name.trim(), gender: d.gender, build: d.build, hair: d.hair, skin: d.skin, scar: d.scar, bloodline: d.bloodline, difficulty: d.difficulty, anchor: { name: a.name.trim(), rel: a.rel, gender: a.gender } });
    };
    UI.show('creator'); render();
  };

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
    screen('intro', 'sv-intro', h('div', { class: 'sv-intro-box' }), btn('Skip', null, { class: 'sv-skip' }));
    screen('title', 'sv-title',
      h('div', { class: 'sv-title-block' },
        h('h1', { text: 'Ashes of the Walls' }), h('p', { class: 'sv-tag', text: 'You were born behind the walls. You will die for what lies beyond them.' }),
        h('nav', { class: 'sv-menu', 'aria-label': 'Main menu' },
          h('button', { type: 'button', 'data-act': 'continue', hidden: true, onclick: () => UI._cb('continue') }, 'Continue', h('small')),
          h('button', { type: 'button', 'data-act': 'new', onclick: () => UI._cb('new') }, 'New game'),
          h('button', { type: 'button', 'data-act': 'roam', onclick: () => UI._cb('roam') }, 'Free roam', h('small', { text: 'ODM test arena with a Titan' })),
          h('button', { type: 'button', 'data-act': 'credits', onclick: () => UI._cb('credits') }, 'Credits'))),
      h('p', { class: 'sv-ver' }));
    screen('creator', 'sv-creator',
      h('ol', { class: 'sv-steps', 'aria-label': 'Steps' }),
      h('div', { class: 'sv-cr-main' }, h('div', { class: 'sv-cr-body' }), h('div', { class: 'sv-cr-foot' }, btn('Back', null, { class: 'sv-cr-back sv-ghost' }), btn('Continue', null, { class: 'sv-cr-next sv-primary' }))));
    screen('pause', 'sv-pause', h('div', { class: 'sv-panel' }, h('h2', { text: 'Paused' }), h('nav', { class: 'sv-pnav' })));
    screen('journal', 'sv-journal', h('div', { class: 'sv-panel wide' }, h('h2', { text: 'Journal' }), h('div', { class: 'sv-j' }, h('div', { class: 'sv-j-quests' }), h('div', { class: 'sv-j-bonds' })), btn('Back', null, { class: 'sv-back sv-ghost' })));
    screen('saves', 'sv-saves', h('div', { class: 'sv-panel' }, h('h2'), h('div', { class: 'sv-slots' }), btn('Back', null, { class: 'sv-back sv-ghost' })));
    screen('credits', 'sv-credits', h('div', { class: 'sv-roll-wrap' }, h('div', { class: 'sv-roll' })), btn('Back', null, { class: 'sv-back sv-ghost' }));
    screen('ending', 'sv-ending', h('div', { class: 'sv-panel' }, h('h2'), h('div', { class: 'sv-end-lines' }), h('div', { class: 'sv-end-btns' })));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})(typeof window !== 'undefined' ? window : globalThis);

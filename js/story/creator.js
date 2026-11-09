/* Ashes of the Walls — the registry (v0.6): character creator.
   Layout follows the console-RPG creators: category list and option panel on the LEFT, the live character on the RIGHT, button hints along the bottom.
   One canonical rig, many people: 5 bodies, 8 face types, 8 hairstyles (mixable), 8 shape presets, 18 face sliders, 16 body sliders,
   natural colour sets plus a free picker, clothing layers. Everything is stored in draft.look as small values, so a save stays tiny. */
(function (root) {
  'use strict';
  const S = root.STORY, UI = S.ui, h = UI.h, A = S.actors, C = S.creatorKit = {};

  /* ---------- data ---------- */
  C.BASES = [['furlan', 'Furlan', 'Church boy'], ['isabel', 'Isabel', 'Merchant girl'], ['tomako', 'Tomako', 'Tall and lean'], ['loud', 'Loud', 'Small and bold'], ['anime', 'Aki', 'Quick and light']];
  C.KITS = [['furlan', 'Furlan'], ['isabel', 'Isabel'], ['tomako', 'Tomako'], ['loud', 'Loud'], ['anime', 'Aki'], ['akane', 'Akane'], ['medieval', 'Maren'], ['benimaru', 'Beni']];         // face and hairstyle kits (more are added by tools/kit/build_rig.py)
  C.FACE_GROUPS = [
    ['Head', [['headW', 'Head width', 'Narrow', 'Wide'], ['headH', 'Head length', 'Short', 'Long'], ['headD', 'Head depth', 'Flat', 'Deep']]],
    ['Jaw and cheeks', [['jawW', 'Jaw width', 'Narrow', 'Broad'], ['chinL', 'Chin length', 'Short', 'Long'], ['cheek', 'Cheeks', 'Hollow', 'Full']]],
    ['Eyes', [['eyeSize', 'Eye size', 'Small', 'Large'], ['eyeGap', 'Eye spacing', 'Close', 'Wide'], ['eyeY', 'Eye height', 'Low', 'High'], ['eyeTilt', 'Eye angle', 'Down', 'Up'], ['browY', 'Brow height', 'Low', 'High']]],
    ['Nose', [['noseW', 'Nose width', 'Narrow', 'Wide'], ['noseL', 'Nose length', 'Short', 'Long'], ['noseY', 'Nose height', 'Low', 'High']]],
    ['Mouth and ears', [['mouthW', 'Mouth width', 'Small', 'Wide'], ['mouthY', 'Mouth height', 'Low', 'High'], ['lips', 'Lips', 'Thin', 'Full'], ['earS', 'Ear spread', 'Flat', 'Out']]]
  ];
  C.BODY_GROUPS = [
    ['Frame', [['height', 'Height', 'Shorter', 'Taller', 'look'], ['build', 'Build', 'Slight', 'Sturdy', 'look'], ['torso', 'Torso length', 'Short', 'Long'], ['leg', 'Leg length', 'Short', 'Long'], ['arm', 'Arm length', 'Short', 'Long']]],
    ['Upper body', [['shoulder', 'Shoulders', 'Narrow', 'Broad'], ['chest', 'Chest', 'Slim', 'Deep'], ['waist', 'Waist', 'Slim', 'Wide'], ['upperArm', 'Upper arms', 'Thin', 'Thick'], ['foreArm', 'Forearms', 'Thin', 'Thick'], ['neckT', 'Neck width', 'Thin', 'Thick']]],
    ['Lower body', [['hip', 'Hip width', 'Narrow', 'Wide'], ['hipT', 'Hip depth', 'Slim', 'Full'], ['thigh', 'Thighs', 'Thin', 'Thick'], ['calf', 'Calves', 'Thin', 'Thick']]],
    ['Hands and feet', [['hand', 'Hands', 'Small', 'Large'], ['foot', 'Feet', 'Small', 'Large'], ['neck', 'Neck length', 'Short', 'Long']]]
  ];
  C.FACE_PRESETS = [
    ['Soft', { headW: .2, cheek: .5, eyeSize: .4, jawW: -.3, chinL: -.2, noseL: -.3, lips: .2 }], ['Round', { headW: .5, headH: -.3, cheek: .6, eyeSize: .2, noseW: .2, jawW: .1, chinL: -.3 }],
    ['Sharp', { headW: -.3, headH: .3, jawW: -.2, chinL: .5, cheek: -.5, eyeTilt: .5, eyeSize: -.1, noseL: .4, browY: -.2 }], ['Open', { eyeSize: .6, eyeGap: .4, eyeY: .2, browY: .3, mouthW: .3, lips: .3, cheek: .2 }],
    ['Narrow', { headW: -.5, headH: .4, eyeGap: -.3, noseW: -.4, noseL: .3, mouthW: -.3, jawW: -.4, earS: -.2 }], ['Strong', { jawW: .6, chinL: .3, browY: -.4, noseW: .3, headW: .2, cheek: -.1, lips: -.2 }],
    ['Gentle', { eyeSize: .5, eyeTilt: -.3, browY: .2, noseL: -.4, noseW: -.2, lips: .4, mouthW: -.1, chinL: -.3 }], ['Keen', { eyeSize: -.3, eyeGap: -.2, eyeTilt: .3, browY: -.3, noseL: .3, jawW: .2, mouthW: -.2, lips: -.3 }]
  ];
  C.BODY_PRESETS = [
    ['Slight', { build: .2, shoulder: -.4, chest: -.4, waist: -.3, upperArm: -.5, thigh: -.4, hand: -.2 }], ['Lanky', { height: .8, leg: .6, arm: .5, torso: .1, build: .25, chest: -.3, thigh: -.3, hand: .3, foot: .3 }],
    ['Even', {}], ['Sturdy', { build: .75, shoulder: .3, chest: .3, upperArm: .3, thigh: .3 }],
    ['Stocky', { height: .25, leg: -.5, torso: .2, build: .85, chest: .5, waist: .4, thigh: .5, neckT: .4 }], ['Wiry', { build: .35, upperArm: -.2, foreArm: .3, calf: .2, hand: .3, shoulder: .1, waist: -.4 }]
  ];
  { const amp = list => list.forEach(p => { for (const k in p[1]) p[1][k] = Math.max(-1, Math.min(1, Math.round(p[1][k] * 1.7 * 100) / 100)); }); amp(C.FACE_PRESETS); amp(C.BODY_PRESETS); }   // presets must read at a glance in the thumbnails
  /* left menu: [id, label, camera focus] */
  C.MENU = [['file', 'Registry', 'upper'], ['base', 'Base', 'full'], ['face', 'Face', 'face'], ['hair', 'Hair', 'face'], ['skin', 'Skin', 'upper'], ['body', 'Body', 'full'], ['wear', 'Clothing', 'full'], ['dest', 'The file', 'upper']];

  /* ---------- pure helpers (unit-tested) ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  C.val = (d, grp, k) => { if (grp === 'look') { const v = d.look[k]; return (v == null ? .5 : v) * 2 - 1; } const o = d.look[grp === 'b' ? 'body' : 'face'] || {}; return o[k] || 0; };
  C.set = (d, k, grp, v) => { v = clamp(+v || 0, -1, 1); if (grp === 'look') d.look[k] = (v + 1) / 2; else { const o = d.look[grp === 'b' ? 'body' : 'face'] = d.look[grp === 'b' ? 'body' : 'face'] || {}; if (Math.abs(v) < 0.02) delete o[k]; else o[k] = Math.round(v * 100) / 100; } };
  C.randomise = (d, cfg, D, rand) => {
    rand = rand || Math.random; const r = n => Math.floor(rand() * n), g = () => (rand() + rand() + rand() - 1.5) / 1.5 * 0.85, L = d.look, P = A.PAL;
    L.face = {}; L.body = {}; for (const [, rows] of C.FACE_GROUPS) for (const [k] of rows) { const v = g(); if (Math.abs(v) > .05) L.face[k] = Math.round(v * 100) / 100; }
    for (const [, rows] of C.BODY_GROUPS) for (const row of rows) { const k = row[0]; if (row[4] === 'look') L[k] = clamp(.5 + g() * .5, 0, 1); else { const v = g(); if (Math.abs(v) > .05) L.body[k] = Math.round(v * 100) / 100; } }
    d.body = 'base_' + C.BASES[r(C.BASES.length)][0]; L.fk = C.KITS[r(C.KITS.length)][0]; L.hk = C.KITS[r(C.KITS.length)][0]; L.hide = [];
    Object.assign(L, { skin: r(P.skin.length), hair: rand() < .35 ? -1 : r(P.hair.length), top: rand() < .3 ? -1 : r(P.top.length), bottom: rand() < .3 ? -1 : r(P.bottom.length), shoes: rand() < .3 ? -1 : r(P.shoes.length), eye: r(cfg.eyes.length) }); L.cust = {}; return d;
  };
  C.reset = d => { const L = d.look; L.face = {}; L.body = {}; L.height = .5; L.build = .5; L.cust = {}; L.hide = []; return d; };
  const rgb = c => 'rgb(' + c.map(x => Math.round(clamp(x, 0, 1) * 255)).join(',') + ')';
  const hex = c => '#' + c.map(x => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  const unhex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  C.hex = hex; C.unhex = unhex;

  /* small schematic portraits: the fallback when a rendered thumbnail is missing */
  const f1 = n => Math.round(n * 10) / 10;
  C.faceGlyph = (v, skin, hair) => {
    v = v || {}; const g = k => v[k] || 0, w = 15 + g('headW') * 2.2, hh = 19 + g('headH') * 2.4, jw = 11 + g('jawW') * 3.2, ch = 52 + g('chinL') * 3;
    const ex = 7 + g('eyeGap') * 2, ey = 31 - g('eyeY') * 2, es = 2.3 + g('eyeSize') * 1, tl = g('eyeTilt') * 1.8, by = ey - 5.5 - g('browY') * 2;
    const nw = 1.8 + g('noseW') * 1.1, nl = 40 + g('noseL') * 1.8 - g('noseY') * 1.6, my = 46.5 - g('mouthY') * 1.8, mw = 5 + g('mouthW') * 1.8, lp = 1.2 + g('lips') * 1, ear = 2 + g('earS') * 1.4;
    const fc = rgb(skin || [.9, .75, .62]), hc = rgb(hair || [.3, .2, .1]);
    const face = 'M' + f1(32 - w) + ' 30C' + f1(32 - w) + ' ' + f1(30 - hh) + ' ' + f1(32 + w) + ' ' + f1(30 - hh) + ' ' + f1(32 + w) + ' 30C' + f1(32 + w) + ' 40 ' + f1(32 + jw) + ' ' + f1(ch - 5) + ' 32 ' + f1(ch) + 'C' + f1(32 - jw) + ' ' + f1(ch - 5) + ' ' + f1(32 - w) + ' 40 ' + f1(32 - w) + ' 30Z';
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="' + f1(32 - w - ear * .5) + '" cy="35" rx="' + f1(ear) + '" ry="4.5" fill="' + fc + '"/><ellipse cx="' + f1(32 + w + ear * .5) + '" cy="35" rx="' + f1(ear) + '" ry="4.5" fill="' + fc + '"/>' +
      '<path d="' + face + '" fill="' + fc + '"/><path d="M' + f1(32 - w - 1) + ' 32C' + f1(32 - w - 2) + ' ' + f1(26 - hh) + ' ' + f1(32 + w + 2) + ' ' + f1(26 - hh) + ' ' + f1(32 + w + 1) + ' 32C' + f1(32 + w - 3) + ' 22 ' + f1(32 - w + 3) + ' 22 ' + f1(32 - w - 1) + ' 32Z" fill="' + hc + '"/>' +
      [-1, 1].map(sg => '<ellipse cx="' + f1(32 + sg * ex) + '" cy="' + f1(ey - sg * tl * .3) + '" rx="' + f1(es) + '" ry="' + f1(es * .6) + '" fill="#241a14"/><path d="M' + f1(32 + sg * (ex - 3)) + ' ' + f1(by + sg * tl * .2) + 'L' + f1(32 + sg * (ex + 3)) + ' ' + f1(by - sg * tl * .5) + '" stroke="' + hc + '" stroke-width="1.3" stroke-linecap="round"/>').join('') +
      '<path d="M32 ' + f1(ey + 2) + 'L32 ' + f1(nl - 1) + 'M' + f1(32 - nw) + ' ' + f1(nl) + 'L' + f1(32 + nw) + ' ' + f1(nl) + '" stroke="#0006" stroke-width="1.1" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + f1(32 - mw) + ' ' + f1(my) + 'Q32 ' + f1(my + lp * 2) + ' ' + f1(32 + mw) + ' ' + f1(my) + '" stroke="#7a3b32" stroke-width="' + f1(1 + lp * .35) + '" stroke-linecap="round" fill="none"/></svg>';
  };
  C.bodyGlyph = (b, lk) => {
    b = b || {}; lk = lk || {}; const g = k => b[k] || 0, H = 50 + (lk.height || 0) * 4, top = 60 - H, sh = 10 + g('shoulder') * 3 + g('chest') * 1.2 + (lk.build || 0) * 2, wa = 6 + g('waist') * 1.6 + (lk.build || 0) * 2, hp = 7.5 + g('hip') * 2 + g('thigh') * 1.2,
      nk = top + 10, wy = top + H * .5, ar = 16 + g('arm') * 4, ft = 60;
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor"><circle cx="32" cy="' + f1(top + 4.5) + '" r="4.6"/>' +
      '<path d="M' + f1(32 - sh) + ' ' + f1(nk) + 'Q32 ' + f1(nk - 3) + ' ' + f1(32 + sh) + ' ' + f1(nk) + 'L' + f1(32 + wa) + ' ' + f1(wy) + 'L' + f1(32 + hp) + ' ' + f1(wy + 7) + 'L' + f1(32 + hp * .45) + ' ' + ft + 'L32 ' + f1(ft - 2) + 'L' + f1(32 - hp * .45) + ' ' + ft + 'L' + f1(32 - hp) + ' ' + f1(wy + 7) + 'L' + f1(32 - wa) + ' ' + f1(wy) + 'Z"/>' +
      '<rect x="' + f1(32 - sh - 3.6) + '" y="' + f1(nk) + '" width="3.2" height="' + f1(ar) + '" rx="1.6"/><rect x="' + f1(32 + sh + .4) + '" y="' + f1(nk) + '" width="3.2" height="' + f1(ar) + '" rx="1.6"/></g></svg>';
  };

  /* ---------- icons (24px line icons, one stroke weight) ---------- */
  const ICON = {
    camBody: 'M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 21l1.6-8L7 11l.8-2h8.4l.8 2-2.6 2 1.6 8', camBust: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 21c0-4.4 3-7 7-7s7 2.6 7 7', camFace: 'M12 3c4 0 6.5 3 6.5 7.5S16 20 12 20s-6.5-5-6.5-9.5S8 3 12 3zM9 10v1.4M15 10v1.4M10 15c1.2 1 2.8 1 4 0',
    turn: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', back: 'M15 5l-7 7 7 7', dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01', reset: 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4'
  };
  const ico = (k, cls) => h('i', { class: 'cr-i' + (cls ? ' ' + cls : ''), html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[k] + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' });

  /* ---------- the screen ---------- */
  UI.creator = function (opts, onDone, onCancel, onChange, onRotate) {
    const s = UI.screenEl('creator'), body = s.querySelector('.cr-body'), menu = s.querySelector('.cr-menu'), head = s.querySelector('.cr-ph-title'), D = S.destiny, cfg = opts.cfg, d = opts.draft, L = d.look, P = A.PAL;
    L.face = L.face || {}; L.body = L.body || {}; L.cust = L.cust || {}; L.hide = L.hide || []; if (!/^base_/.test(d.body || '')) d.body = 'base_isabel';
    let tab = 0, nextBtn; const ST = S.studio, focus = n => { try { ST && ST.focus && ST.focus(n); } catch (e) {} };
    const touch = () => { onChange && onChange(d); validate(); };
    const valid = () => d.name.trim().length > 0;
    function validate() { if (nextBtn) nextBtn.disabled = !valid(); }
    const baseId = () => d.body.replace(/^base_/, '');
    const fk = () => L.fk || baseId(), hk = () => L.hk || baseId();

    /* thumbnails: rendered from the engine (tools/kit/thumbs.js); the schematic is the fallback */
    const thumb = (name, fallback) => { const w = h('span', { class: 'cr-th' }); const im = h('img', { alt: '', decoding: 'async' }); im.onload = () => { w.textContent = ''; w.append(im); }; im.onerror = () => { w.innerHTML = fallback ? fallback() : ''; }; im.src = 'assets/ui/thumbs/' + name + '.webp'; if (fallback) w.innerHTML = fallback(); return w; };
    const card = (nm, label, on, fn, fb) => h('button', { type: 'button', role: 'radio', class: 'cr-card' + (on ? ' on' : ''), 'aria-checked': String(on), 'aria-label': label, title: label, onclick: fn }, thumb(nm, fb), h('b', { text: label }));
    const grid = (cards, cls) => h('div', { class: 'cr-grid ' + (cls || ''), role: 'radiogroup' }, cards);
    const sect = (t, ...kids) => h('section', { class: 'cr-sect' }, h('h3', { text: t }), ...kids);

    const sliderRow = (grp, k, label, lo, hi) => {
      const cur = C.val(d, grp, k), out = h('output', { class: 'cr-val', text: Math.round(cur * 100) });
      const inp = h('input', { type: 'range', class: 'cr-range', min: -100, max: 100, step: 1, value: Math.round(cur * 100), 'aria-label': label + ': ' + lo + ' to ' + hi,
        oninput: e => { C.set(d, k, grp, +e.target.value / 100); out.textContent = Math.round(+e.target.value); row.classList.toggle('mod', Math.abs(+e.target.value) > 1); touch(); } });
      const row = h('div', { class: 'cr-sl' + (Math.abs(cur) > .01 ? ' mod' : '') }, h('div', { class: 'cr-sl-top' }, h('label', { text: label, ondblclick: () => { inp.value = 0; inp.dispatchEvent(new root.Event('input')); } }), out),
        h('div', { class: 'cr-track' }, inp, h('i', { class: 'cr-ticks', 'aria-hidden': 'true' })), h('div', { class: 'cr-ends' }, h('span', { text: lo }), h('span', { text: hi })));
      return row;
    };
    const sliders = (groups, grp) => groups.map(g => sect(g[0], ...g[1].map(r => sliderRow(r[4] === 'look' ? 'look' : grp, r[0], r[1], r[2], r[3]))));
    const stepper = (label, items, idx, fn) => h('div', { class: 'cr-step' }, h('label', { text: label }), h('div', { class: 'cr-step-box' }, h('button', { type: 'button', 'aria-label': 'Previous ' + label, onclick: () => fn((idx + items.length - 1) % items.length) }, '‹'), h('span', { text: items[idx] }), h('button', { type: 'button', 'aria-label': 'Next ' + label, onclick: () => fn((idx + 1) % items.length) }, '›')));
    const swatches = (list, key, label, native) => { const cu = L.cust[key], cur = L[key] == null ? (native ? -1 : 0) : L[key];
      return h('div', { class: 'cr-sws', role: 'radiogroup', 'aria-label': label },
        native ? h('button', { type: 'button', role: 'radio', class: 'cr-sw cr-native', title: 'Original', 'aria-label': label + ' original', 'aria-checked': String(!cu && cur < 0), onclick: () => { delete L.cust[key]; L[key] = -1; touch(); render(true); } }, h('span', { text: 'Orig' })) : null,
        list.map((c, i) => h('button', { type: 'button', role: 'radio', class: 'cr-sw', title: c[0], 'aria-label': label + ' ' + c[0], 'aria-checked': String(!cu && cur === i), style: { background: rgb(c[1]) }, onclick: () => { delete L.cust[key]; L[key] = i; touch(); render(true); } })),
        h('label', { class: 'cr-sw cr-cust' + (cu ? ' on' : ''), title: 'Any colour', 'aria-label': label + ' custom colour', style: cu ? { background: rgb(cu) } : {} }, h('span', { text: '+' }),
          h('input', { type: 'color', value: hex(cu || (cur >= 0 && list[cur] ? list[cur][1] : [.5, .4, .3])), oninput: e => { L.cust[key] = unhex(e.target.value); touch(); e.target.parentNode.classList.add('on'); e.target.parentNode.style.background = e.target.value; }, onchange: () => render(true) }))); };
    const row = (label, node, note) => h('div', { class: 'cr-row' }, h('label', { text: label }), node, note ? h('small', { class: 'cr-note', text: note }) : null);
    const chips = (list, get, set) => h('div', { class: 'cr-chips', role: 'radiogroup' }, list.map((o, i) => { const id = o.id !== undefined ? o.id : i, label = o.name || o; return h('button', { type: 'button', role: 'radio', class: 'cr-chip', 'aria-checked': String(get() === id), onclick: () => { set(id); touch(); render(true); } }, label); }));

    function render(keep) {
      const sy = keep ? body.scrollTop : 0, id = C.MENU[tab][0];
      menu.textContent = ''; C.MENU.forEach((m, i) => menu.append(h('button', { type: 'button', role: 'tab', class: 'cr-mi' + (i === tab ? ' on' : ''), 'aria-selected': String(i === tab), onclick: () => { if (i > 0 && !valid()) { tab = 0; render(); return; } tab = i; render(); } }, h('i', { class: 'cr-dia' }), h('span', { text: m[1] }))));
      menu.append(h('button', { type: 'button', class: 'cr-mi cr-rand', onclick: () => { C.randomise(d, cfg, D); touch(); render(true); } }, h('i', { class: 'cr-dia' }), h('span', { text: 'Random' })));
      head.textContent = C.MENU[tab][1]; body.textContent = ''; if (!keep) focus(C.MENU[tab][2]);
      const skin = P.skin[L.skin == null || L.skin < 0 ? 2 : L.skin][1];
      if (id === 'file') body.append(h('p', { class: 'cr-lead', text: 'The registry clerk dips a pen. Every child in the district is written down once.' }),
        row('Name', h('input', { type: 'text', class: 'cr-input', id: 'sv-in-name', maxlength: 16, value: d.name, placeholder: 'Your name', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', oninput: e => { d.name = e.target.value; touch(); } })),
        row('Pronouns', chips(cfg.genders, () => d.gender, v => { d.gender = v; })), row('Voice', chips(cfg.voices, () => d.voice, v => { d.voice = v; }), 'How you sound when you speak up.'));
      else if (id === 'base') {
        body.append(sect('Body type', grid(C.BASES.map(b => card('base_' + b[0], b[1], d.body === 'base_' + b[0], () => { d.body = 'base_' + b[0]; L.hide = []; touch(); render(true); }, () => C.bodyGlyph({}, {}))), 'g3')),
          sect('Proportions', ...[['height', 'Height', 'Shorter', 'Taller'], ['build', 'Build', 'Slight', 'Sturdy']].map(r => sliderRow('look', r[0], r[1], r[2], r[3]))));
      } else if (id === 'face') {
        body.append(sect('Face type', grid(C.KITS.map(k => card('face_' + k[0], k[1], fk() === k[0], () => { L.fk = k[0]; touch(); render(true); }, () => C.faceGlyph({}, skin))), 'g3')),
          sect('Shape preset', grid(C.FACE_PRESETS.map((p, i) => card('shape_' + i, p[0], false, () => { L.face = Object.assign({}, p[1]); touch(); render(true); }, () => C.faceGlyph(p[1], skin))), 'g4')), ...sliders(C.FACE_GROUPS, 'f'));
      } else if (id === 'hair') {
        body.append(sect('Hairstyle', grid(C.KITS.map(k => card('hair_' + k[0], k[1], hk() === k[0], () => { L.hk = k[0]; touch(); render(true); }, () => C.faceGlyph({}, skin, L.hair >= 0 ? P.hair[L.hair][1] : null))), 'g3')),
          sect('Hair and brow colour', swatches(P.hair, 'hair', 'Hair colour', true)));
      } else if (id === 'skin') {
        body.append(sect('Skin tone', swatches(P.skin, 'skin', 'Skin tone', false)), sect('Eyes', h('p', { class: 'cr-note', text: 'Eye colour is part of each face type. Choose another face type on the Face page to change the eyes.' })),
          sect('Marks', row('Scars', chips(cfg.scars, () => L.scar, v => { L.scar = v; }), 'Recorded now. They are painted onto the face in an upcoming update.')));
      } else if (id === 'body') {
        body.append(sect('Frame preset', grid(C.BODY_PRESETS.map((p, i) => card('body_' + i, p[0], false, () => { L.body = {}; for (const k in p[1]) { if (k === 'height' || k === 'build') L[k] = clamp(.5 + p[1][k] / 2, 0, 1); else L.body[k] = p[1][k]; } if (!('height' in p[1])) L.height = .5; if (!('build' in p[1])) L.build = .5; touch(); render(true); }, () => C.bodyGlyph(p[1], { height: p[1].height || 0, build: p[1].build || 0 }))), 'g3')), ...sliders(C.BODY_GROUPS, 'b'));
      } else if (id === 'wear') {
        const info = S.actors.partsOf ? S.actors.partsOf(d.body) : [];
        body.append(h('p', { class: 'cr-lead', text: 'What your family could afford. Clothes can change later in the story.' }),
          ...(info.length ? [sect('Layers', h('div', { class: 'cr-chips' }, info.map(pn => h('button', { type: 'button', role: 'switch', class: 'cr-chip', 'aria-checked': String(!L.hide.includes(pn)), onclick: () => { const i = L.hide.indexOf(pn); if (i >= 0) L.hide.splice(i, 1); else L.hide.push(pn); touch(); render(true); } }, pn.replace('Top2', 'Outer layer').replace('Top', 'Shirt').replace('Bottom', 'Trousers')))))] : []),
          sect('Colours', row('Top', swatches(P.top, 'top', 'Top colour', true)), row('Bottom', swatches(P.bottom, 'bottom', 'Bottom colour', true)), row('Shoes', swatches(P.shoes, 'shoes', 'Shoe colour', true))),
          sect('Condition', h('div', { class: 'cr-chips', role: 'radiogroup' }, cfg.wear.map((w, i) => h('button', { type: 'button', role: 'radio', class: 'cr-chip', 'aria-checked': String(d.wear === i), onclick: () => { d.wear = i; touch(); render(true); } }, w)))));
      } else {
        const dest = opts.destiny, fam = D.family(dest.family), bl = D.info(dest.bloodline === 'ackerman' ? 'common' : dest.bloodline), an = dest.anchor;
        const relTxt = { sibling: an.gender === 'f' ? 'your sister' : 'your brother', parent: an.gender === 'f' ? 'your mother' : 'your father', friend: 'your closest friend', cousin: 'your cousin' }[an.rel];
        body.append(h('p', { class: 'cr-lead', text: 'Some things are not chosen. They are written down for you.' }),
          h('dl', { class: 'cr-file' }, h('dt', { text: 'Family' }), h('dd', {}, h('b', { text: fam.name }), h('span', { text: fam.text })), h('dt', { text: 'Lineage' }), h('dd', {}, h('b', { text: bl.name }), h('span', { text: bl.text })),
            h('dt', { text: 'Your Anchor' }), h('dd', {}, h('b', { text: an.name + ', ' + relTxt }), h('span', { text: 'The one person you will not want to lose. What becomes of them is up to you.' }))),
          sect('How hard should the world be?', h('div', { class: 'cr-diffs' }, cfg.difficulties.map(o => h('button', { type: 'button', role: 'radio', 'aria-checked': String(d.difficulty === o.id), class: 'cr-diff', onclick: () => { d.difficulty = o.id; render(true); } }, h('b', { text: o.name }), h('span', { text: o.text }))))),
          h('p', { class: 'cr-sum' }, h('b', { text: d.name.trim() || 'You' }), ', of Shiganshina, year 845.'));
      }
      const back = s.querySelector('.cr-back'); nextBtn = s.querySelector('.cr-next');
      back.querySelector('span').textContent = tab === 0 ? 'Cancel' : 'Back'; nextBtn.querySelector('span').textContent = tab === C.MENU.length - 1 ? 'Stamp the file' : 'Continue'; validate(); body.scrollTop = sy;
    }
    s.querySelector('.cr-back').onclick = () => { if (tab === 0) onCancel(); else { tab--; render(); } };
    s.querySelector('.cr-next').onclick = () => { if (!valid()) { tab = 0; render(); return; } if (tab < C.MENU.length - 1) { tab++; render(); return; } onDone(d); };
    s.querySelector('.cr-reset').onclick = () => { C.reset(d); touch(); render(true); };
    const leftEl = s.querySelector('.cr-left'), fit = () => { try { ST && ST.inset && ST.inset(s.classList.contains('cr-uihide') ? 0 : leftEl.getBoundingClientRect().right - 12); } catch (e) {} };
    s.querySelector('.cr-hide').onclick = () => { s.classList.toggle('cr-uihide'); fit(); }; if (root.addEventListener) root.addEventListener('resize', fit);
    s.querySelectorAll('.cr-cams button[data-v]').forEach(b => { b.onclick = () => { focus(b.dataset.v); s.querySelectorAll('.cr-cams button[data-v]').forEach(x => x.classList.toggle('on', x === b)); }; });
    let spin = false; const spinBtn = s.querySelector('.cr-spin'); spinBtn.onclick = () => { spin = !spin; spinBtn.classList.toggle('on', spin); }; const tick = () => { if (spin && onRotate) onRotate(0.012); if (s.isConnected && !s.hidden) root.requestAnimationFrame(tick); }; root.requestAnimationFrame && root.requestAnimationFrame(tick);
    const stage = s.querySelector('.cr-stage'); let px = null, py = null;
    stage.onpointerdown = e => { px = e.clientX; py = e.clientY; try { stage.setPointerCapture(e.pointerId); } catch (x) {} };
    stage.onpointermove = e => { if (px != null) { if (onRotate) onRotate((e.clientX - px) * 0.012); if (ST && ST.nudge) ST.nudge(0, -(e.clientY - py) * 0.002); px = e.clientX; py = e.clientY; } };
    stage.onpointerup = stage.onpointercancel = () => { px = null; };
    UI.embers(false); UI.show('creator'); render(); fit(); onChange && onChange(d);
  };
  C.ico = ico; C.ICON = ICON;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);

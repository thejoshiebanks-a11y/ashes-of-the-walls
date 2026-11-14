/* Ashes of the Walls — the young character foundation (V1).
   One skinned, animated teen on the engine's canonical Bip001 rig (assets/teen/*, built by tools/teen/build_modular.py).
   Everything the creator offers is a real switch on real geometry (actor.skipRe), a real colour on the engine's tint path (actor.tintFn)
   or a real scale (actor.scale / actor.wide / actor.headScale). A character is a `look` object of small integers and 0..1 sliders,
   so it saves as JSON and is rebuilt identically on load. */
(function (root) {
  'use strict';
  const S = root.STORY, T = S.teen = {};
  const C = (n, r, g, b) => ({ name: n, c: [r / 255, g / 255, b / 255], css: 'rgb(' + r + ',' + g + ',' + b + ')' });

  /* ---------- the catalogue ---------- */
  T.OUTFITS = [                                          // medieval civilian first; Scout Regiment is earned in the story
    { id: 'Peasant', name: 'Casual', locked: false },
    { id: 'Ranger', name: 'Armour', locked: true, flag: 'ranger_unlocked', note: 'Unlocks during missions' },
    { id: 'Scout', name: 'ODM Uniform', locked: true, flag: 'scout_unlocked', note: 'Unlocks during missions' }];
  T.GEARLOCK = { flag: 'odm_unlocked', note: 'Unlocks after you finish training' };
  T.gearUnlocked = () => !!(S.flag && S.flag(T.GEARLOCK.flag));
  T.HAIR = [{ id: 'Messy', name: 'Messy', bases: [0] }, { id: 'Buzzed', name: 'Buzzed', bases: [0] }, { id: 'BH0', name: 'Anime fringe', bases: [0, 1], bname: 'Short fringe' }, { id: 'BH1', name: 'Anime layered', bases: [0, 1], bname: 'Classic' }, { id: 'Bald', name: 'Shaved', bases: [0, 1] }];
  T.hairsFor = b => T.HAIR.map((h, i) => ({ h, i })).filter(x => x.h.bases.indexOf(b) >= 0);
  T.FACES = ['Soft', 'Round', 'Sharp', 'Broad', 'Long'].map((n, i) => ({ id: i ? 'Face_' + i : 'Face', name: n }));;
  T.HAIRCOL = [C('Black', 24, 21, 22), C('Dark brown', 58, 42, 32), C('Brown', 92, 66, 48), C('Chestnut', 116, 80, 56), C('Auburn', 128, 64, 46), C('Ginger', 168, 94, 52), C('Blond', 200, 170, 112), C('Ash blond', 180, 166, 138)];
  T.EYES = [C('Black', 22, 18, 18), C('Dark brown', 82, 50, 30), C('Hazel', 132, 102, 42), C('Green', 62, 138, 82), C('Blue', 72, 112, 188), C('Grey', 134, 142, 154), C('Amber', 198, 140, 42)];
  T.SKIN = [C('Natural', 255, 255, 255), C('Warm', 250, 232, 214), C('Olive', 224, 205, 176), C('Tan', 200, 178, 152), C('Golden', 176, 150, 122), C('Brown', 150, 126, 108), C('Deep', 106, 90, 80)];   // multipliers on the teen's own skin, kept close to neutral so the hue stays natural
  T.DYE = [{ name: 'Original', c: null, css: 'linear-gradient(135deg,#8d7a5a 50%,#4b3f2c 50%)' }, C('Cream', 232, 220, 190), C('Brown', 118, 82, 52), C('Charcoal', 64, 64, 70), C('Forest', 52, 98, 58), C('Navy', 48, 66, 130), C('Crimson', 160, 40, 44), C('Ochre', 200, 150, 50), C('Plum', 110, 56, 120), C('Slate', 100, 116, 130), C('Bone', 240, 236, 226)];
  T.BODYTYPES = [{ name: 'Slight', h: .35, b: .2 }, { name: 'Average', h: .5, b: .5 }, { name: 'Sturdy', h: .46, b: .85 }, { name: 'Tall', h: .85, b: .4 }];
  T.VOICES = [{ id: 'gentle', name: 'Gentle' }, { id: 'steady', name: 'Steady' }, { id: 'bold', name: 'Bold' }, { id: 'sharp', name: 'Sharp' }];
  T.CRESTS = ['tower', 'flame', 'key', 'rose', 'anvil', 'feather'];
  T.CRESTNAMES = ['The Wall', 'The Ember', 'The Key', 'The Rose', 'The Anvil', 'The Feather'];
  T.DEF = { base: 0, face: 0, outfit: 0, hair: 0, hairCol: 0, shade: .5, eyes: 0, skin: 0, top: 0, pants: 0, boots: 0, accent: 0, gear: 0, cloak: 1, crest: 0, showCrest: 1, height: .5, build: .5, head: .5, bodyType: 1 };

  /* ---------- sizes ---------- */
  const DOOR_OVER_LEVI = 0.70, DOOR_DIVISOR = 2;           // the player is (door height / 2). The door is read from the reference screenshot (~0.70 x Levi).
  T.baseMeters = () => 0.65;                      // = the children NPCs (half their former height); see docs/CHARACTER_CREATOR.md
  const clamp01 = v => Math.max(0, Math.min(1, v == null ? .5 : v));
  T.heightFactor = L => 0.92 + clamp01(L.height) * 0.16;   // 0.92 .. 1.08 of the base height
  T.heightCm = L => Math.round(152 * T.heightFactor(L));    // registry height: 152 cm is the base teen
  T.wide = L => 0.9 + clamp01(L.build) * 0.22;
  T.headScale = L => 0.93 + clamp01(L.head) * 0.14;
  T.buildName = L => { const b = clamp01(L.build); return b < .3 ? 'Slight' : b < .62 ? 'Average' : b < .85 ? 'Sturdy' : 'Heavy-set'; };
  T.meters = L => T.baseMeters() * T.heightFactor(L);
  T.isUnlocked = o => !o.locked || !!(o.flag && S.flag && S.flag(o.flag));
  T.norm = L => { const k = Object.assign({}, T.DEF, L || {}); const o = T.OUTFITS[k.outfit]; if (!o) k.outfit = 0; if (!T.FACES[k.face]) k.face = 0; if (!T.HAIR[k.hair]) k.hair = 0; k.base = k.base === 1 ? 1 : 0; if (T.HAIR[k.hair].bases.indexOf(k.base) < 0) k.hair = T.hairsFor(k.base)[0].i; return k; };

  /* ---------- loading ---------- */
  let info = null, loading = null;
  T.info = () => info;
  const infos = {};
  T.bodyHeight = key => (infos[key || 'teen'] && infos[key || 'teen'].bodyHeight) || (key === 'boy' ? 1.888 : 1.649);
  T.keyFor = L => (L && L.base === 1) ? 'boy' : 'teen';          // base 0 = the young teen, base 1 = the anime boy
  T.ready = () => !!(root.__actors && root.__actors.has('teen') && (root.__actors.has('boy') || T.boyFailed));
  T.load = function () {
    if (T.ready()) return Promise.resolve(true);
    if (loading) return loading;
    loading = (async () => {
      const v = '?v=' + (root.__APP_VERSION || ''), B = 'assets/teen/';
      const j = async n => (await fetch(B + n + v)).json(), b = async n => new Uint8Array(await (await fetch(B + n + v)).arrayBuffer());
      const one = async key => {
        const P = 'assets/' + key + '/', jj = async n => (await fetch(P + n + v)).json(), bb = async n => new Uint8Array(await (await fetch(P + n + v)).arrayBuffer());
        const [meta, bin, inf] = await Promise.all([jj(key + '.meta.json'), bb(key + '.bin'), jj(key + '.info.json')]);
        const tex = []; for (let i = 0; i < (inf.tex || 0); i++) tex.push(await bb(key + '.t' + i + '.webp'));
        root.__MODELS = root.__MODELS || {}; root.__MODELS[key] = { meta, bin, tex }; infos[key] = inf; if (key === 'teen') info = inf;
        await root.__actors.loadModel(key); };
      await one('teen'); try { await one('boy'); } catch (e) { T.boyFailed = true; console.warn('[teen] second base unavailable', e); } return true;
    })().catch(e => { loading = null; throw e; });
    return loading;
  };

  /* ---------- look -> actor ---------- */
  const SLOT = { top: ['Body', 'Tops'], pants: ['Legs', 'Bottoms'], boots: ['Feet', 'FeetBoots', 'Boots', 'Shoes'], accent: ['AccPauldron', 'BodyBelt1', 'BodyBelt2', 'HeadHood', 'Cloak', 'Hands', 'Collar'] };
  const slotOf = m => { const part = m.replace(/^Outfit_[A-Za-z]+_/, ''); for (const k in SLOT) if (SLOT[k].includes(part)) return k; return null; };
  const shadeMul = s => 0.62 + clamp01(s) * 0.76;          // hair shade slider: 0.62 (darker) .. 1.38 (lighter)
  const mulc = (c, m) => [Math.min(1, c[0] * m), Math.min(1, c[1] * m), Math.min(1, c[2] * m)];
  T.apply = function (a, look, wear) {
    const k = T.norm(look), O = T.OUTFITS[k.outfit], outfit = O.id, hair = 'Hair_' + T.HAIR[k.hair].id, bald = T.HAIR[k.hair].id === 'Bald', face = T.FACES[k.face].id;
    const rv = T.reveal ? T.reveal.st : 3;                    // creator intro: 0 clay mannequin, 1 skin + eyes, 2 hair, 3 everything
    const hood = rv > 2 && outfit === 'Ranger' && k.cloak, cloak = rv > 2 && outfit === 'Scout' && k.cloak;
    const boy = a.key === 'boy';
    a.skipRe = { test: m => {
      if (boy) {
        if (m === 'Iris' || m === 'EyeHL') return rv < 1;
        if (m === 'Hair_B0Back') return bald || !!hood || rv < 2 || ['BH0', 'Buzzed'].indexOf(T.HAIR[k.hair].id) >= 0;   // his own hair: short, or with the long back hair
        if (m.startsWith('Hair_')) return bald || !!hood || rv < 2;
        if (m.startsWith('Gear_')) return true;                 // boy: ODM gear is locked until training (and not fitted to this base)
        if (m.startsWith('Outfit_')) return m.indexOf('Outfit_Modern') !== 0;   // boy wears his native Casual clothes only
        return false; }
      if (m === 'Skull') return false;
      if (m === 'Iris' || m === 'EyeShine') return rv < 1;
      if (m === 'Scalp') return bald || rv < 2;
      if (m === 'Face' || m.startsWith('Face_')) return m !== face;
      if (m.startsWith('Hair_')) return (m !== hair && m !== hair + 'Back') || !!hood || rv < 2;                                   // hair is hidden under a hood
      if (m === 'Outfit_Ranger_HeadHood') return !hood;
      if (m === 'Outfit_Scout_Cloak') return !cloak;
      if (m.startsWith('Outfit_')) return rv < 3 ? m !== 'Outfit_Modern' : !m.startsWith('Outfit_' + outfit + '_');
      if (m.startsWith('Gear_')) return !k.gear || rv < 3;
      return true; } };
    const wm = S.actors.wearMul ? S.actors.wearMul(wear || 0) : 1;
    const hc = mulc(T.HAIRCOL[k.hairCol].c, shadeMul(k.shade)), ec = T.EYES[k.eyes].c, sk = T.SKIN[k.skin].c;
    const casual = boy || outfit === 'Peasant';               // colours apply to Casual only; the other outfits keep their own look
    const dyes = casual ? { top: T.DYE[k.top].c, pants: T.DYE[k.pants].c, boots: T.DYE[k.boots].c, accent: T.DYE[k.accent].c } : {};
    const CLAY = [.78, .76, .73, .92];
    a.tintFn = m => {
      if (rv < 3 && m === 'Outfit_Modern') return CLAY;
      if (boy) {
        if (m === 'Skin_Face' || m === 'Skin_Body') return rv < 1 ? CLAY : (k.skin ? [sk[0], sk[1], sk[2], 0] : null);
        if (m === 'Iris') return [ec[0], ec[1], ec[2], .82];
        if (m.startsWith('Hair_')) return [hc[0], hc[1], hc[2], .93];
        if (m.startsWith('Outfit_')) { if (rv < 3) return CLAY; const d = dyes[slotOf(m)]; return d ? [d[0] * wm, d[1] * wm, d[2] * wm, .5] : (wm < 1 ? [wm, wm, wm, 0] : null); }
        return null; }
      if (rv < 1 && (m === 'Face' || m.startsWith('Face_') || m === 'Skull')) return CLAY;
      if (m === 'Face' || m.startsWith('Face_') || m === 'Skull') return k.skin ? [sk[0], sk[1], sk[2], 0] : null;
      if (m === 'Iris') return [ec[0], ec[1], ec[2], .82];
      if (m === 'Scalp' || m.startsWith('Hair_')) return [hc[0], hc[1], hc[2], .93];
      if (m.startsWith('Outfit_')) { const d = dyes[slotOf(m)]; return d ? [d[0] * wm, d[1] * wm, d[2] * wm, .5] : (wm < 1 ? [wm, wm, wm, 0] : null); }
      return null; };
    const meters = T.meters(k);
    a.baseScale = meters / T.bodyHeight(a.key); a.scale = a.baseScale; a.wide = T.wide(k); a.headScale = T.headScale(k) * (boy ? 0.96 : 1);
    a.speedK = meters / 1.75;                               // clip speed is divided by this (see docs: optional game.js one-liner)
    if (a.isPlayer && T.loco) T.loco.setCamera(true);
    a.look = null; a.teen = k; return { meters, look: k };
  };

  /* ---------- variation ---------- */
  T.rng = seed => { let x = (seed == null ? Math.random() * 4294967296 : seed) >>> 0; return () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const WCOL = [24, 22, 18, 10, 8, 8, 6, 4], WEYE = [14, 28, 18, 10, 14, 10, 6], WSKIN = [10, 18, 22, 18, 14, 10, 8];
  const wpick = (w, r) => { const tot = w.reduce((s, x) => s + x, 0); let q = r() * tot; for (let i = 0; i < w.length; i++) { q -= w[i]; if (q < 0) return i; } return w.length - 1; };
  T.random = function (seed) {                       // medieval-civilian styled, natural colours weighted like a real town
    const r = T.rng(seed), n = (m) => Math.floor(r() * m), L = Object.assign({}, T.DEF);
    L.base = r() < .35 ? 1 : 0; L.outfit = r() < .72 ? 0 : 1; L.face = n(T.FACES.length); L.hair = r() < .06 ? T.HAIR.length - 1 : n(T.HAIR.length - 1); L.hairCol = wpick(WCOL, r); L.shade = .25 + r() * .5; L.eyes = wpick(WEYE, r); L.skin = wpick(WSKIN, r);
    L.top = r() < .45 ? 0 : 1 + n(T.DYE.length - 1); L.pants = r() < .5 ? 0 : 1 + n(T.DYE.length - 1); L.boots = r() < .6 ? 0 : 1 + n(T.DYE.length - 1); L.accent = r() < .5 ? 0 : 1 + n(T.DYE.length - 1);
    L.height = r(); L.build = r(); L.head = .2 + r() * .6; L.crest = n(T.CRESTS.length); L.bodyType = n(T.BODYTYPES.length); L.cloak = r() < .5 ? 1 : 0;
    return L;
  };
  T.PRESETS = [                                            // eight curated starting characters (their thumbnails are rendered by the engine)
    { name: 'Farm boy', look: { face: 0, hair: 0, hairCol: 1, eyes: 1, skin: 3, outfit: 0, top: 2, pants: 3, boots: 2, accent: 0, height: .55, build: .6, head: .5, bodyType: 2 } },
    { name: 'Baker’s son', look: { face: 1, hair: 3, hairCol: 2, eyes: 2, skin: 2, outfit: 0, top: 1, pants: 2, boots: 3, accent: 7, height: .4, build: .75, head: .55, bodyType: 2 } },
    { name: 'Scholar', look: { face: 2, hair: 3, hairCol: 0, eyes: 4, skin: 1, outfit: 0, top: 5, pants: 3, boots: 3, accent: 1, height: .5, build: .25, head: .45, bodyType: 0 } },
    { name: 'Street runner', look: { face: 3, hair: 1, hairCol: 3, eyes: 3, skin: 4, outfit: 0, top: 3, pants: 2, boots: 2, accent: 6, height: .62, build: .35, head: .5, bodyType: 0 } },
    { name: 'Garrison child', look: { face: 4, hair: 3, hairCol: 0, eyes: 0, skin: 2, outfit: 0, top: 4, pants: 2, boots: 2, accent: 0, height: .7, build: .5, head: .5, bodyType: 3 } },
    { name: 'Ginger tinker', look: { face: 1, hair: 0, hairCol: 5, eyes: 3, skin: 1, outfit: 0, top: 7, pants: 2, boots: 2, accent: 2, height: .35, build: .45, head: .55, bodyType: 1 } },
    { name: 'Wayfarer', look: { face: 2, hair: 2, hairCol: 4, eyes: 6, skin: 5, outfit: 0, top: 0, pants: 0, boots: 0, accent: 0, height: .6, build: .4, head: .5, cloak: 1, bodyType: 3 } },
    { name: 'Wall-watcher', look: { face: 3, hair: 1, hairCol: 6, eyes: 5, skin: 0, outfit: 0, top: 9, pants: 3, boots: 3, accent: 8, height: .45, build: .5, head: .5, bodyType: 1 } },
    { name: 'Kai', base: 1, look: { base: 1, hair: 3, hairCol: 0, eyes: 1, skin: 1, top: 0, pants: 0, boots: 0, accent: 0, height: .5, build: .45, head: .5 } },
    { name: 'Ren', base: 1, look: { base: 1, hair: 2, hairCol: 1, eyes: 4, skin: 1, top: 5, pants: 3, boots: 3, accent: 0, height: .45, build: .4, head: .5 } },
    { name: 'Tobi', base: 1, look: { base: 1, hair: 2, hairCol: 6, eyes: 3, skin: 2, top: 4, pants: 2, boots: 2, accent: 7, height: .4, build: .6, head: .52 } },
    { name: 'Sora', base: 1, look: { base: 1, hair: 3, hairCol: 4, eyes: 6, skin: 0, top: 6, pants: 3, boots: 3, accent: 0, height: .55, build: .35, head: .5 } }
  ];
  T.preset = i => Object.assign({}, T.DEF, T.PRESETS[i].look);
  T.code = L => { const k = T.norm(L); return ['base', 'outfit', 'hair', 'hairCol', 'eyes', 'skin', 'top', 'pants', 'boots', 'accent'].map(x => k[x].toString(36)).join('') + '-' + [k.shade, k.height, k.build, k.head].map(x => Math.round(clamp01(x) * 35).toString(36)).join(''); };

  /* ---------- locomotion: stride-matched gait, run clip, camera scale (needs tools/apply_game_patches.js once) ---------- */
  const LOCO = T.loco = { LEG: 0.42, CAM_K: 0.5, CAM_H: -0.04, PACE: { walk: 0.55, jog: 1.25, sprint: 2.3 } };
  // stance-foot speed of each clip in leg-lengths per second at rate 1 (measured from the clip data with tools/anim/stride.py)
  LOCO.GAITS = [{ clip: 'L:Standard Walk', s: 1.25, lo: 0.6, hi: 1.6, upTo: 1.9 }, { clip: 'L:Jog Forward', s: 2.0, lo: 0.8, hi: 1.6, upTo: 3.0 }, { clip: 'L:Run Mixamo', s: 5.3, lo: 0.5, hi: 1.5, upTo: 99 }];
  LOCO.pick = (sp, leg) => {                           // -> [clip, playback rate] so the planted foot moves with the ground
    const ls = sp / Math.max(0.05, leg);
    for (const g of LOCO.GAITS) if (ls < g.upTo) return [g.clip, Math.max(g.lo, Math.min(g.hi, ls / g.s))];
    return null; };
  LOCO.speedMap = v => v <= 0.8 ? v * LOCO.PACE.walk / 0.8 : v <= 2.5 ? LOCO.PACE.walk + (v - 0.8) * (LOCO.PACE.jog - LOCO.PACE.walk) / 1.7 : LOCO.PACE.jog + (v - 2.5) * (LOCO.PACE.sprint - LOCO.PACE.jog) / 2.4;
  LOCO.install = async function () {
    if (typeof window === 'undefined' || !root.fetch) return;
    root.__actorClip = (a, sp) => {
      if (!(sp > 0.25) || !root.__actors) return null;
      const bh = (a.key === 'teen' || a.key === 'boy') ? T.bodyHeight(a.key) : (root.__actors.bodyHeight(a.key) || 1.75); if (!a.scale) return null;
      const r = LOCO.pick(sp, a.scale * bh * (a.key === 'boy' ? 0.47 : LOCO.LEG)); return r && (r[0] !== 'L:Run Mixamo' || (root.__AN && root.__AN.meta.clips[r[0]])) ? r : (r ? ['L:Jog Forward', Math.min(1.5, r[1] * 2.6)] : null); };
    root.__spdMap = LOCO.speedMap;
    const v = '?v=' + (root.__APP_VERSION || '');
    const J = await (await fetch('data/story/run_clip.json' + v)).json(); let n = 0;
    while (!root.__AN && n++ < 400) await new Promise(r => setTimeout(r, 150));
    const AN = root.__AN; if (!AN || AN.meta.clips[J.name]) return;
    const bin = atob(J.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const add = new Int16Array(u8.buffer), old = AN.i16, all = new Int16Array(old.length + add.length); all.set(old); all.set(add, old.length);
    AN.meta.clips[J.name] = { n: J.n, fps: J.fps, o: old.length * 2 }; AN.i16 = all; };
  LOCO.setCamera = on => { root.__camK = on ? LOCO.CAM_K : 1; root.__camH = on ? LOCO.CAM_H : undefined; };
  if (typeof window !== 'undefined') LOCO.install().catch(e => console.warn('[loco]', e));
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);

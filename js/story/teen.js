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
  /* One anime body, one skeleton, six heads. Every base shares the same slim, fitted body (tools/teen/compose.py) so every outfit fits every base
     and every animation drives every base; what makes a base is its head, its own face, its skin tone and its signature hair. All six accept every face, hairstyle and outfit. */
  T.BASES = [
    { key: 'boy', name: 'Kuro', note: 'Calm eyes · short dark fringe', face: 0, hair: 'B0' },
    { key: 'dragon', name: 'Ryu', note: 'Fierce eyes · spiked crop', face: 1, hair: 'D0' },
    { key: 'beauty', name: 'Haru', note: 'Gentle eyes · soft side-swept', face: 2, hair: 'Y0' },
    { key: 'lad', name: 'Midori', note: 'Bright eyes · wavy layers', face: 3, hair: 'L0' },
    { key: 'nin', name: 'Kage', note: 'Sly eyes · long tail fringe', face: 4, hair: 'N0' },
    { key: 'blen', name: 'Aoi', note: 'Soft eyes · layered crop', face: 5, hair: 'F0' },
    { key: 'girl', g: 'f', name: 'Sakura', note: 'Soft eyes · side-swept bob', face: 0, hair: 'FA0' },
    { key: 'girl', g: 'f', name: 'Hana', note: 'Bright eyes · long fringe', face: 1, hair: 'FB0' },
    { key: 'girl', g: 'f', name: 'Yuki', note: 'Calm eyes · long flowing hair', face: 2, hair: 'FC0' },
    { key: 'girl', g: 'f', name: 'Rin', note: 'Soft eyes · short crop', face: 0, hair: 'FD0' },
    { key: 'girl', g: 'f', name: 'Mio', note: 'Bright eyes · bob and hairband', face: 1, hair: 'FE0' }];
  T.isFemale = L => (T.BASES[(L && L.base) | 0] || {}).g === 'f';
  T.OUTFITS = [                                          // medieval only. Casual outfits are dyeable; armour and the uniform are earned in the story
    { id: 'Under', name: 'Underclothes', locked: false, dye: true },
    { id: 'Peasant', name: 'Village clothes', locked: false, dye: true, g: 'm' },
    { id: 'Ranger', name: 'Traveller armour', locked: true, flag: 'ranger_unlocked', note: 'Unlocks during missions', g: 'm' },
    { id: 'Scout', name: 'Scout Regiment', locked: true, flag: 'scout_unlocked', note: 'Unlocks during missions', g: 'm' },
    { id: 'Dragon', name: 'Dragon-guard vest', locked: false, dye: true, legs: true, g: 'm' },
    { id: 'Ninja', name: 'Shinobi garb', locked: false, dye: true, legs: true, g: 'm' },
    { id: 'Gown', name: 'Noble gown', locked: false, dye: true, g: 'f' },
    { id: 'Adventurer', name: 'Wayfarer corset', locked: false, dye: true, g: 'f' },
    { id: 'Maid', name: 'Maid dress', locked: false, dye: true, g: 'f' }];
  T.GEARLOCK = { flag: 'odm_unlocked', note: 'Unlocks after you finish training' };
  T.gearUnlocked = () => !!(S.flag && S.flag(T.GEARLOCK.flag));
  T.HAIR = [{ id: 'B0', name: 'Short fringe', f: 'B0', k: 'B0Back' }, { id: 'D0', name: 'Spiked crop', f: 'D0', k: 'D0Back' },
    { id: 'Y0', name: 'Side-swept', f: 'Y0', k: 'Y0Back' }, { id: 'L0', name: 'Wavy layers', f: 'L0', k: 'L0Back' },
    { id: 'C0', name: 'Shaggy', f: 'C0' }, { id: 'N0', name: 'Long fringe', f: 'N0', k: 'N0Back' },
    { id: 'F0', name: 'Layered crop', f: 'F0', k: 'F0Back' }, { id: 'Bald', name: 'Shaved', bald: true },
    { id: 'FA0', name: 'Side-swept bob', f: 'FA0', k: 'FA0Back', g: 'f' }, { id: 'FB0', name: 'Long fringe', f: 'FB0', k: 'FB0Back', g: 'f' }, { id: 'FC0', name: 'Flowing locks', f: 'FC0', k: 'FC0Back', g: 'f' },
    { id: 'FD0', name: 'Short crop', f: 'FD0', k: 'FD0Back', g: 'f' }, { id: 'FE0', name: 'Bob and band', f: 'FE0', k: 'FE0Back', g: 'f' },
    { id: 'FF0', name: 'Soft cropped bob', f: 'FF0', k: 'FF0Back', g: 'f' },
    { id: 'FG0', name: 'Straight hime cut', f: 'FG0', k: 'FG0Back', g: 'f' }, { id: 'FH0', name: 'Cat-ear bob and braids', f: 'FH0', k: 'FH0Back', g: 'f' }];
  T.baseOf = L => T.BASES[(L && L.base) | 0] || T.BASES[0];
  T.hairsFor = b => { const f = (T.BASES[b | 0] || T.BASES[0]).g === 'f'; return T.HAIR.map((h, i) => ({ h, i })).filter(x => x.h.bald || (x.h.g === 'f') === f); };
  T.outfitsFor = b => { const g = (T.BASES[b | 0] || T.BASES[0]).g || 'm'; return T.OUTFITS.map((o, i) => ({ o, i })).filter(x => !x.o.g || x.o.g === g); };
  T.baseHair = b => Math.max(0, T.HAIR.findIndex(h => h.f === (T.BASES[b | 0] || T.BASES[0]).hair));
  T.FACES = ['Calm', 'Fierce', 'Gentle', 'Bright', 'Sly', 'Soft'].map((n, i) => ({ id: 'Face' + i, name: n }));
  T.facesFor = b => (T.BASES[b | 0] || T.BASES[0]).g === 'f' ? T.FACES.slice(0, 3).map((f, i) => ({ id: f.id, name: ['Soft', 'Bright', 'Calm'][i], i })) : T.FACES.map((f, i) => ({ id: f.id, name: f.name, i }));
  T.HAIRCOL = [C('Black', 24, 21, 22), C('Dark brown', 58, 42, 32), C('Brown', 92, 66, 48), C('Chestnut', 116, 80, 56), C('Auburn', 128, 64, 46), C('Ginger', 168, 94, 52), C('Blond', 200, 170, 112), C('Ash blond', 180, 166, 138), C('Silver', 190, 192, 204), C('Crimson', 150, 30, 40), C('Midnight', 30, 38, 84), { name: 'Original', c: null, css: 'linear-gradient(135deg,#c93030 33%,#3a3a3a 33% 66%,#4ec9a0 66%)' }];   // 'Original' keeps the colour the model was painted with
  T.EYES = [C('Black', 22, 18, 18), C('Dark brown', 82, 50, 30), C('Hazel', 132, 102, 42), C('Green', 62, 138, 82), C('Blue', 72, 112, 188), C('Grey', 134, 142, 154), C('Amber', 198, 140, 42)];
  T.SKIN = [C('Natural', 255, 255, 255), C('Warm', 250, 232, 214), C('Olive', 224, 205, 176), C('Tan', 200, 178, 152), C('Golden', 176, 150, 122), C('Brown', 150, 126, 108), C('Deep', 106, 90, 80), C('Sun', 238, 203, 176)];   // multipliers on the teen's own skin, kept close to neutral so the hue stays natural
  T.BOXCOL = [{ name: 'Black', c: null, css: '#16161a' }, C('Charcoal', 70, 70, 76), C('Navy', 44, 58, 112), C('Crimson', 150, 36, 42), C('Forest', 48, 92, 56), C('Brown', 104, 74, 50), C('Plum', 100, 52, 110), C('Bone', 226, 220, 208)];   // the underclothes have their own palette (black first) and never touch the casual outfit's colours
  T.DYE = [{ name: 'Original', c: null, css: 'linear-gradient(135deg,#8d7a5a 50%,#4b3f2c 50%)' }, C('Cream', 232, 220, 190), C('Brown', 118, 82, 52), C('Charcoal', 64, 64, 70), C('Forest', 52, 98, 58), C('Navy', 48, 66, 130), C('Crimson', 160, 40, 44), C('Ochre', 200, 150, 50), C('Plum', 110, 56, 120), C('Slate', 100, 116, 130), C('Bone', 240, 236, 226)];
  T.BODYTYPES = [{ name: 'Slight', h: .35, b: .2 }, { name: 'Average', h: .5, b: .5 }, { name: 'Sturdy', h: .46, b: .85 }, { name: 'Tall', h: .85, b: .4 }];
  T.VOICES = [{ id: 'gentle', name: 'Gentle' }, { id: 'steady', name: 'Steady' }, { id: 'bold', name: 'Bold' }, { id: 'sharp', name: 'Sharp' }];
  T.CRESTS = ['tower', 'flame', 'key', 'rose', 'anvil', 'feather'];
  T.CRESTNAMES = ['The Wall', 'The Ember', 'The Key', 'The Rose', 'The Anvil', 'The Feather'];
  T.DEF = { v: 3, base: 0, face: 0, outfit: 0, hair: 0, hairCol: 0, shade: .5, eyes: 0, skin: 7, top: 0, pants: 0, under: 0, boots: 0, accent: 0, gear: 0, cloak: 1, crest: 0, showCrest: 1, height: .5, build: .5, head: .5, bodyType: 1 };

  /* ---------- sizes ---------- */
  const DOOR_OVER_LEVI = 0.70, DOOR_DIVISOR = 2;           // the player is (door height / 2). The door is read from the reference screenshot (~0.70 x Levi).
  T.baseMeters = () => 0.65;                      // = the children NPCs (half their former height); see docs/CHARACTER_CREATOR.md
  const clamp01 = v => Math.max(0, Math.min(1, v == null ? .5 : v));
  T.heightFactor = L => 0.92 + clamp01(L.height) * 0.16;   // 0.92 .. 1.08 of the base height
  T.heightCm = L => Math.round((T.isFemale(L) ? 151 : 158) * T.heightFactor(L));    // registry height: 158 cm is the base boy
  T.wide = L => 0.9 + clamp01(L.build) * 0.22;
  T.headScale = L => 0.93 + clamp01(L.head) * 0.14;
  T.buildName = L => { const b = clamp01(L.build); return b < .3 ? 'Slight' : b < .62 ? 'Average' : b < .85 ? 'Sturdy' : 'Heavy-set'; };
  T.meters = L => T.baseMeters() * T.heightFactor(L);
  T.isUnlocked = o => !o.locked || !!(o.flag && S.flag && S.flag(o.flag));
  T.norm = L => {
    const src = L || {}, k = Object.assign({}, T.DEF, src);
    if ((src.v == null && src.hairCol != null) || (src.v != null && src.v < 3)) {                                                    // saves from before the single-body rebuild: keep base, colours, sliders; remap the removed ids
      const oldBase = k.base | 0; k.base = oldBase < 4 ? oldBase : 0; k.face = Math.min(5, k.face | 0);
      const oh = ['B0', 'B0', 'D0', 'D0', 'Y0', 'Y0', 'L0', 'L0', 'C0', 'C0', 'Bald'][k.hair | 0] || 'B0'; k.hair = Math.max(0, T.HAIR.findIndex(h => h.id === oh || h.f === oh));
      const oo = ['Under', 'Peasant', 'Peasant', 'Ranger', 'Scout'][k.outfit | 0]; k.outfit = Math.max(0, T.OUTFITS.findIndex(o => o.id === oo)); k.v = 3; }
    if (!T.BASES[k.base]) k.base = 0;
    if (!T.FACES[k.face]) k.face = 0; if (!T.HAIR[k.hair]) k.hair = 0; if (!T.OUTFITS[k.outfit]) k.outfit = 0; if (!T.BOXCOL[k.under]) k.under = 0;
    { const g = (T.BASES[k.base].g) || 'm'; if (g === 'f' && k.face > 2) k.face = 0;
      if (!T.hairsFor(k.base).some(x => x.i === k.hair)) k.hair = T.baseHair(k.base);
      if (!T.outfitsFor(k.base).some(x => x.i === k.outfit)) k.outfit = 0; }
    return k; };

  /* ---------- loading (each base is its own pack in assets/<key>/, fetched on demand) ---------- */
  const infos = {}, loadP = {};
  T.info = () => infos.boy || null;
  T.bodyHeight = key => (infos[key || 'boy'] && infos[key || 'boy'].bodyHeight) || 1.9486;
  T.keyFor = L => T.baseOf(L).key;
  T.has = key => !!(root.__actors && root.__actors.has(key));
  T.ready = () => T.has('boy');
  /* a pack is ~50 small files: fetch them a few at a time and retry, so one dropped request on a mobile connection can't fail the whole model */
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const grab = async (url, json) => { let err; for (let a = 0; a < 4; a++) { try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return json ? await r.json() : new Uint8Array(await r.arrayBuffer()); } catch (e) { err = e; await pause(350 * (a + 1)); } }
    throw new Error('could not download ' + url.split('?')[0] + ' (' + ((err && err.message) || err) + ')'); };
  const pool = async (n, limit, fn) => { const out = new Array(n); let next = 0; await Promise.all(Array.from({ length: Math.min(limit, n) }, async () => { for (;;) { const i = next++; if (i >= n) return; out[i] = await fn(i); } })); return out; };
  const one = key => loadP[key] || (loadP[key] = (async () => {
    if (T.has(key)) return true;
    const v = '?v=' + (root.__APP_VERSION || ''), P = 'assets/' + key + '/', jj = n => grab(P + n + v, true), bb = n => grab(P + n + v, false);
    const [meta, inf] = await Promise.all([jj(key + '.meta.json'), jj(key + '.info.json')]); const bin = await bb(key + '.bin');
    const tex = await pool(inf.tex || 0, 6, i => bb(key + '.t' + i + '.webp'));
    root.__MODELS = root.__MODELS || {}; root.__MODELS[key] = { meta, bin, tex }; infos[key] = inf;
    await root.__actors.loadModel(key); if (!T.has(key)) throw new Error('the model "' + key + '" could not be built on this device'); return true; })().catch(e => { delete loadP[key]; T.lastError = e && e.message || String(e); throw e; }));
  T.load = async function (keys) {                    // the default base always; plus any others asked for
    await one('boy'); const more = (keys || T.want || []).filter(k => k !== 'boy' && T.BASES.some(b => b.key === k));
    for (const k of more) { try { await one(k); } catch (e) { console.warn('[teen] base unavailable:', k, e); } } return true; };
  T.want = [];
  T.preloadAll = () => { };          // bases load when picked: six packs at once is too much texture memory for a phone

  /* ---------- look -> actor ---------- */
  const SLOT = { top: ['Body', 'Tops', 'Lining'], pants: ['Legs', 'Bottoms'], boots: ['Feet', 'FeetBoots', 'Boots', 'Shoes'], accent: ['AccPauldron', 'BodyBelt1', 'BodyBelt2', 'HeadHood', 'Cloak', 'Hands', 'Collar', 'Sash'] };
  const slotOf = m => { const part = m.replace(/^Outfit_[A-Za-z]+_/, ''); for (const k in SLOT) if (SLOT[k].includes(part)) return k; return null; };
  const shadeMul = s => 0.62 + clamp01(s) * 0.76;          // hair shade slider: 0.62 (darker) .. 1.38 (lighter)
  const mulc = (c, m) => [Math.min(1, c[0] * m), Math.min(1, c[1] * m), Math.min(1, c[2] * m)];
  const FACEP = /^Face(\d)_(\w+)$/;
  T.apply = function (a, look, wear) {
    const k = T.norm(look), O = T.OUTFITS[k.outfit], outfit = O.id, H = T.HAIR[k.hair], B = T.baseOf(k);
    const rv = T.reveal ? T.reveal.st : 3;                    // creator intro: 0 clay mannequin, 1 skin + eyes, 2 hair, 3 everything
    const hood = rv > 2 && outfit === 'Ranger' && k.cloak, cloak = rv > 2 && outfit === 'Scout' && k.cloak;
    const clayOutfit = 'Under', gearOn = !!k.gear && T.gearUnlocked();
    a.skipRe = { test: m => {
      if (m === 'Skin_Neck') return false;
      if (m === 'Skin_Body') return rv >= 3 && outfit !== clayOutfit;      // bare body with the boxers; a body pressed in under the cloth for every other outfit
      if (m === 'Skin_BodyD') return !(rv >= 3 && outfit !== clayOutfit);
      if (m === 'Skin_BodyL') return !(rv >= 3 && O.legs);                  // bare shins for the outfits whose trousers stop at the calf
      const f = FACEP.exec(m); if (f) return +f[1] !== k.face || (/^(Iris|EyeHL)$/.test(f[2]) && rv < 1);
      if (m.startsWith('Hair_')) { if (rv < 2 || hood) return true; if (H.bald) return true; return m !== 'Hair_' + H.f && m !== 'Hair_' + H.k; }
      if (m.startsWith('Gear_')) return !(gearOn && rv >= 3);
      if (m === 'Outfit_Ranger_HeadHood') return !hood || outfit !== 'Ranger';
      if (m === 'Outfit_Scout_Cloak') return !cloak || outfit !== 'Scout';
      if (m.startsWith('Outfit_')) return rv < 3 ? !m.startsWith('Outfit_' + clayOutfit + '_') : !m.startsWith('Outfit_' + outfit + '_');
      return true; } };
    const wm = S.actors.wearMul ? S.actors.wearMul(wear || 0) : 1;
    const hc = T.HAIRCOL[k.hairCol].c ? mulc(T.HAIRCOL[k.hairCol].c, shadeMul(k.shade)) : null, ec = T.EYES[k.eyes].c, sk = T.SKIN[k.skin].c;
    const dyes = O.dye ? { top: T.DYE[k.top].c, pants: T.DYE[k.pants].c, boots: T.DYE[k.boots].c, accent: T.DYE[k.accent].c } : {};   // colours recolour the casual outfits only, never armour or the uniform
    const CLAY = [.78, .76, .73, .92];
    a.tintFn = m => {
      if (m === 'Skin_Body' || m === 'Skin_BodyD' || m === 'Skin_BodyL' || m === 'Skin_Neck' || /^Face\d_Skin$/.test(m)) return rv < 1 ? CLAY : (k.skin ? [sk[0], sk[1], sk[2], 0] : null);
      if (/^Face\d_Iris$/.test(m)) return [ec[0], ec[1], ec[2], .82];
      if (m.startsWith('Hair_')) return hc ? [hc[0], hc[1], hc[2], .93] : (wm < 1 ? [wm, wm, wm, 0] : null);
      if (m.startsWith('Outfit_')) { if (rv < 3) return CLAY; if (m === 'Outfit_Under_Bottoms' || m === 'Outfit_Under_Tops') { const bc = T.BOXCOL[k.under].c; return bc ? [bc[0] * wm, bc[1] * wm, bc[2] * wm, .5] : [.34 * wm, .34 * wm, .36 * wm, 0]; }   // plain black boxers (dark charcoal cotton in the pack itself) until a colour is picked
 const d = dyes[slotOf(m)]; return d ? [d[0] * wm, d[1] * wm, d[2] * wm, .5] : (wm < 1 ? [wm, wm, wm, 0] : null); }
      return null; };
    const meters = T.meters(k);
    a.live = true; a.baseScale = meters / T.bodyHeight(a.key); a.scale = a.baseScale; a.wide = T.wide(k); a.headScale = T.headScale(k) * 0.96;
    a.speedK = meters / 1.75;                               // clip speed is divided by this (see docs: optional game.js one-liner)
    if (a.isPlayer && T.loco) T.loco.setCamera(true);
    a.look = null; a.teen = k; return { meters, look: k };
  };

  /* ---------- variation ---------- */
  T.rng = seed => { let x = (seed == null ? Math.random() * 4294967296 : seed) >>> 0; return () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const WCOL = [24, 22, 18, 10, 8, 8, 6, 4, 3, 3, 3, 8], WEYE = [14, 28, 18, 10, 14, 10, 6], WSKIN = [10, 18, 22, 18, 14, 10, 8, 20];
  const wpick = (w, r) => { const tot = w.reduce((s, x) => s + x, 0); let q = r() * tot; for (let i = 0; i < w.length; i++) { q -= w[i]; if (q < 0) return i; } return w.length - 1; };
  T.random = function (seed) {
    const r = T.rng(seed), n = (m) => Math.floor(r() * m), L = Object.assign({}, T.DEF);
    L.base = n(T.BASES.length);
    const ho = T.hairsFor(L.base), oo = T.outfitsFor(L.base).filter(x => !x.o.locked);
    { const nb = ho.filter(x => !x.h.bald); L.hair = r() < .04 ? ho.find(x => x.h.bald).i : nb[n(nb.length)].i; } L.outfit = oo[n(oo.length)].i; L.face = n(T.facesFor(L.base).length);
    L.hairCol = wpick(WCOL, r); L.shade = .25 + r() * .5; L.eyes = wpick(WEYE, r); L.skin = wpick(WSKIN, r);
    L.top = r() < .45 ? 0 : 1 + n(T.DYE.length - 1); L.pants = r() < .5 ? 0 : 1 + n(T.DYE.length - 1); L.boots = r() < .6 ? 0 : 1 + n(T.DYE.length - 1); L.accent = r() < .5 ? 0 : 1 + n(T.DYE.length - 1);
    L.height = r(); L.build = r(); L.head = .2 + r() * .6; L.crest = n(T.CRESTS.length); L.bodyType = n(T.BODYTYPES.length); L.cloak = r() < .5 ? 1 : 0;
    return L;
  };
  T.preset = i => T.norm(Object.assign({}, T.DEF, { base: i | 0, face: T.BASES[i | 0] ? T.BASES[i | 0].face : 0, hair: T.baseHair(i | 0) }));   // a base's own face and signature hair
  T.code = L => { const k = T.norm(L); return ['base', 'face', 'outfit', 'hair', 'hairCol', 'eyes', 'skin', 'top', 'pants', 'boots', 'accent'].map(x => k[x].toString(36)).join('') + '-' + [k.shade, k.height, k.build, k.head].map(x => Math.round(clamp01(x) * 35).toString(36)).join(''); };

  /* ---------- locomotion: stride-matched gait, run clip, camera scale (needs tools/apply_game_patches.js once) ---------- */
  const LOCO = T.loco = { LEG: 0.42, CAM_K: 0.5, CAM_H: -0.04, PACE: { walk: 0.55, jog: 1.45, sprint: 2.1 } };
  // stance-foot speed of each clip in leg-lengths per second at rate 1 (measured from the clip data with tools/anim/stride.py)
  LOCO.GAITS = [{ clip: 'L:Standard Walk', s: 1.25, lo: 0.6, hi: 1.6, upTo: 1.9 }, { clip: 'L:Jog Forward', s: 2.0, lo: 0.8, hi: 1.6, upTo: 3.0 }, { clip: 'L:Run Mixamo', s: 5.3, lo: 0.5, hi: 2.0, upTo: 99 }];
  LOCO.pick = (sp, leg) => {                           // -> [clip, playback rate] so the planted foot moves with the ground
    const ls = sp / Math.max(0.05, leg);
    for (const g of LOCO.GAITS) if (ls < g.upTo) return [g.clip, Math.max(g.lo, Math.min(g.hi, ls / g.s))];
    return null; };
  LOCO.speedMap = v => v <= 0.8 ? v * LOCO.PACE.walk / 0.8 : v <= 2.5 ? LOCO.PACE.walk + (v - 0.8) * (LOCO.PACE.jog - LOCO.PACE.walk) / 1.7 : LOCO.PACE.jog + (v - 2.5) * (LOCO.PACE.sprint - LOCO.PACE.jog) / 2.4;
  LOCO.install = async function () {
    if (typeof window === 'undefined' || !root.fetch) return;
    root.__actorClip = (a, sp) => {
      const teen = T.BASES.some(b => b.key === a.key), has = n => root.__AN && root.__AN.meta.clips[n];
      if (teen && has('M:Idle')) {                         // everyday life for every creator character: the upright motion-captured set (stride-matched to the body)
        if (!(sp > 0.25)) return a.idle ? null : [(a.mood === 'calm' && has('M:Breathing Idle')) ? 'M:Breathing Idle' : 'M:Idle', 1];
        if (!a.scale) return null; const ls = sp / (a.scale * T.bodyHeight(a.key) * 0.47);
        if (has('M:Standard_Walk') && has('M:Standard_Run')) return ls < 2.6 ? ['M:Standard_Walk', Math.max(0.4, Math.min(1.35, ls / 1.55))] : ['M:Standard_Run', Math.max(0.7, Math.min(1.35, ls / 3.85))];   // the reference Mixamo Standard Walk / Standard Run, played as captured; rate = ground speed / the clip's measured stance-foot speed (walk 1.55, run 3.85 leg-lengths/s)
        return ls < 2.6 ? ['M:Walking', Math.max(0.4, Math.min(1.35, ls / 1.9))] : ['M:Running', Math.max(0.62, Math.min(1.3, ls / 4.75))]; }   // rates = ground speed / the clip's measured stance-foot speed (walk 1.9, run 4.75 leg-lengths per second), so the planted foot never skates and the legs never spin
      if (!(sp > 0.25) || !root.__actors) return null;
      const bh = T.BASES.some(b => b.key === a.key) ? T.bodyHeight(a.key) : (root.__actors.bodyHeight(a.key) || 1.75); if (!a.scale) return null;
      const r = LOCO.pick(sp, a.scale * bh * 0.47); return r && (r[0] !== 'L:Run Mixamo' || (root.__AN && root.__AN.meta.clips[r[0]])) ? r : (r ? ['L:Jog Forward', Math.min(1.5, r[1] * 2.6)] : null); };
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

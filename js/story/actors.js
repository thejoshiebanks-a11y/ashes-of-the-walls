/* Ashes of the Walls — story actors: loads converted models and places the cast, the player and the Colossal. */
(function (root) {
  'use strict';
  const S = root.STORY, A = S.actors = {};
  const BEARD = /beard|moustache|mustache/i;
  let info = null, pack = null, loading = null; A.npcs = {}; A.player = null; A.anchor = null; A.colossal = null;

  /* ---- pure helpers (unit-tested) ---- */
  A.scaleFor = (bodyHeight, meters) => meters / Math.max(0.1, bodyHeight);
  A.wearMul = w => [1, 0.9, 0.78][w || 0] || 1;
  A.applyWear = (col, w) => { if (!col) return col; const m = A.wearMul(w), g = (col[0] + col[1] + col[2]) / 3; return col.map(c => (c * 0.85 + g * 0.15) * m); };   // wear dulls and darkens
  /* ---- palettes (absolute colours, 0..1). null in a look means "the model's own colour". ---- */
  const c3 = (r, g, b) => [r / 255, g / 255, b / 255];
  A.PAL = {
    skin: [['Porcelain', c3(245, 214, 194)], ['Fair', c3(237, 199, 168)], ['Light', c3(224, 178, 143)], ['Warm', c3(204, 153, 112)], ['Olive', c3(184, 138, 97)], ['Tan', c3(158, 112, 77)], ['Brown', c3(122, 82, 56)], ['Deep', c3(87, 56, 41)]],
    hair: [['Black', c3(18, 15, 15)], ['Dark brown', c3(44, 28, 20)], ['Brown', c3(82, 52, 28)], ['Chestnut', c3(115, 69, 36)], ['Auburn', c3(128, 51, 26)], ['Ginger', c3(173, 77, 31)], ['Blonde', c3(204, 163, 87)], ['Platinum', c3(230, 214, 173)], ['Ash', c3(89, 84, 77)], ['Grey', c3(148, 148, 148)], ['White', c3(225, 225, 230)]],
    top: [['Oat', c3(199, 179, 140)], ['Umber', c3(102, 71, 46)], ['Olive', c3(92, 97, 56)], ['Forest', c3(46, 77, 56)], ['Navy', c3(41, 51, 82)], ['Slate', c3(87, 102, 117)], ['Rust', c3(140, 66, 41)], ['Wine', c3(97, 36, 41)], ['Cream', c3(219, 209, 179)], ['Charcoal', c3(51, 51, 56)]],
    bottom: [['Oat', c3(199, 179, 140)], ['Umber', c3(102, 71, 46)], ['Olive', c3(92, 97, 56)], ['Navy', c3(41, 51, 82)], ['Slate', c3(87, 102, 117)], ['Charcoal', c3(51, 51, 56)], ['Cream', c3(219, 209, 179)]],
    shoes: [['Dark leather', c3(48, 32, 22)], ['Black', c3(26, 24, 24)], ['Tan', c3(120, 84, 52)], ['Grey', c3(90, 90, 92)]]
  };
  A.RIG = { bases: ['furlan', 'isabel', 'tomako', 'loud', 'anime'], kits: ['furlan', 'isabel', 'tomako', 'loud', 'anime', 'akane', 'medieval', 'benimaru'], models: [] };
  A.RIG.models = A.RIG.bases.map(b => 'base_' + b).concat(A.RIG.kits.map(k => 'head_' + k));
  A.rigKey = k => /^base_/.test(k || '') ? k : (/woman/.test(k || '') ? 'base_isabel' : 'base_furlan');
  A.kit = (v, key) => 'head_' + (v || String(key).replace(/^base_/, ''));
  A.hideRe = L => L && L.hide && L.hide.length ? new RegExp('^(' + L.hide.join('|') + ')$') : null;
  /* Wardrobe hook: p.outfit picks a clothing set. 'commoner' = the model's own clothes (recoloured by the registry choices). Later sets override the colours
     (colour-level today; new mesh layers such as the jacket and ODM harness attach to the same rig when those assets exist). Set S.state.player.outfit = 'scout'. */
  A.OUTFITS = { commoner: null, scout: { top: [0.30, 0.36, 0.28], bottom: [0.80, 0.76, 0.66], shoes: [0.16, 0.11, 0.08] } };
  A.playerLook = p => {
    const L = p.look || {}, w = p.wear || 0, cu = L.cust || {}, o = A.OUTFITS[p.outfit || 'commoner'] || {};
    const pick = (k, list) => { if (cu[k]) return cu[k]; const i = L[k]; return i == null || i < 0 || !list[i] ? null : list[i][1]; };
    const wr = c => c ? A.applyWear(c, w) : null;
    return { skin: cu.skin || A.PAL.skin[L.skin == null || L.skin < 0 ? 2 : Math.min(L.skin, 7)][1], hair: pick('hair', A.PAL.hair), top: wr(o.top || pick('top', A.PAL.top)), bottom: wr(o.bottom || pick('bottom', A.PAL.bottom)), shoes: o.shoes || pick('shoes', A.PAL.shoes) };
  };
  A.playerParams = p => {                              // all visual numbers for a created character
    const L = p.look || {}, h = 1.3 * (0.92 + (L.height == null ? 0.5 : L.height) * 0.16), width = 0.92 + (L.build == null ? 0.5 : L.build) * 0.18;
    const hw = 0.94 + (L.headW == null ? 0.5 : L.headW) * 0.12, hh = 0.94 + (L.headH == null ? 0.5 : L.headH) * 0.12;
    return { meters: h, width, head: 1.36 * (hw + hh) / 2, look: A.playerLook(p), morph: A.bodyMorph(L.body), face: A.faceMorph(L.face) };
  };
  /* Body sliders are -1..1 (0 = the child baseline). A child is short in the legs and arms, big in the head, soft in the neck; the sliders move around that. */
  const CHILD = { leg: .84, arm: .9, torso: .93, neck: .9, hand: 1.1, foot: 1.08 };
  const RANGE = { leg: .16, arm: .16, torso: .14, shoulder: .18, hip: .18, neck: .2, hand: .18, foot: .15, thigh: .22, calf: .2, upperArm: .22, foreArm: .2, chest: .18, waist: .2, hipT: .18, neckT: .2 };
  A.BODY_KEYS = Object.keys(RANGE); A.FACE_KEYS = ['headW', 'headH', 'headD', 'jawW', 'chinL', 'cheek', 'eyeSize', 'eyeGap', 'eyeY', 'eyeTilt', 'browY', 'noseW', 'noseL', 'noseY', 'mouthW', 'mouthY', 'lips', 'earS'];
  A.bodyMorph = b => { const m = Object.assign({}, CHILD); for (const k in RANGE) { const v = Math.max(-1, Math.min(1, +(b && b[k]) || 0)); m[k] = (m[k] || 1) * (1 + v * RANGE[k]); } return m; };
  A.faceMorph = f => { if (!f) return null; const o = {}; let any = false; for (const k of A.FACE_KEYS) { const v = Math.max(-1, Math.min(1, +f[k] || 0)); if (v) { o[k] = v; any = true; } } return any ? o : null; };

  /* ---- model loading ---- */
  async function init() {
    if (info) return;
    const v = '?v=' + (root.__APP_VERSION || '');
    info = await (await fetch('data/npc_models.json' + v)).json();
    const buf = await (await fetch('assets/npc.pack' + v)).arrayBuffer(), hl = new DataView(buf).getUint32(0, true);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl; pack = {};
    for (const k in hdr) pack[k] = new Uint8Array(buf, base + hdr[k][0], hdr[k][1]);
  }
  A.ensure = async function (keys, onProgress) {
    if (!loading) loading = init().catch(e => { loading = null; throw e; }); await loading;
    let n = 0; root.__MODELS = root.__MODELS || {};
    for (const key of keys) {
      if (root.__actors.has(key)) { n++; continue; }
      const d = info[key]; if (!d) { console.warn('[actors] unknown model', key); continue; }
      root.__MODELS[key] = { meta: d.meta, bin: pack[key + '.bin'], tex: Array.from({ length: d.ntex }, (_, i) => pack[key + '.t' + i]) };
      await root.__actors.loadModel(key); if (onProgress) onProgress(++n / keys.length);
    }
  };
  A.partsOf = key => (info && info[key] && info[key].info && info[key].info.parts) || [];
  const bodyH = key => info && info[key] ? info[key].info.bodyHeight : 1.7;

  /* ---- spawning ---- */
  A.clearNpcs = () => { for (const id in A.npcs) root.__actors.remove(A.npcs[id].id); A.npcs = {}; if (A.anchor) { root.__actors.remove(A.anchor.id); A.anchor = null; } };
  A.clearAll = () => { root.__actors.clear(false); A.npcs = {}; A.player = null; A.anchor = null; A.colossal = null; };
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  A.spawnNpc = function (id, x, z, yaw) {
    const d = S.data.npcs[id]; if (!d) return null; let key = d.model, extra = {};
    if (/^fuse_/.test(key)) {                           // townsfolk are built from the same modular rig as the player, never the old civilian models
      const h = hash(id), fem = /woman/.test(key), pool = fem ? ['isabel', 'tomako', 'anime'] : ['furlan', 'loud'], b = pool[h % pool.length];
      key = 'base_' + b; extra = { kind: 'rig', faceKit: 'head_' + b, hairKit: 'head_' + A.RIG.kits[(h >>> 3) % A.RIG.kits.length], morph: A.bodyMorph(null), look: { skin: A.PAL.skin[h % 8][1], hair: null, top: null, bottom: null, shoes: null } };
      if (!root.__actors.has(key) || !root.__actors.has(extra.faceKit) || !root.__actors.has(extra.hairKit)) return null;
    } else if (!root.__actors.has(key)) return null;
    const a = root.__actors.add(Object.assign({ key, kind: d.kind, x, z, yaw: yaw || 0, scale: A.scaleFor(bodyH(key), d.height), look: d.look, headScale: d.head || 1, wide: d.width || 1, idle: d.idle, npcId: id }, extra));
    A.npcs[id] = a; return a;
  };
  A.anchorParams = function (pl) {
    const D = S.destiny, an = pl.anchor, adult = an.rel === 'parent', sd = an.look || 1, fem = an.gender === 'f' || (an.gender !== 'm' && sd % 2 === 0);
    const pool = fem ? ['isabel', 'tomako', 'anime'] : ['furlan', 'loud'], b = pool[sd % pool.length];
    const look = D.look(sd), h = adult ? 1.66 + (look.height - 1) * 0.5 : 1.28 + (look.height - 1) * 0.6;
    return { key: 'base_' + b, faceKit: 'head_' + b, hairKit: 'head_' + A.RIG.kits[(sd * 3 + 1) % A.RIG.kits.length], meters: h, look: { skin: A.PAL.skin[sd % 8][1], hair: null, top: null, bottom: null, shoes: null }, adult };
  };
  A.spawnAnchor = function (pl, x, z, yaw) {
    const P = A.anchorParams(pl); if (!root.__actors.has(P.key) || !root.__actors.has(P.faceKit)) return null;
    const a = root.__actors.add({ key: P.key, kind: 'rig', faceKit: P.faceKit, hairKit: root.__actors.has(P.hairKit) ? P.hairKit : P.faceKit, x, z, yaw: yaw || 0, scale: A.scaleFor(bodyH(P.key), P.meters), look: P.look,
      headScale: P.adult ? 1 : 1.32, morph: A.bodyMorph(null), npcId: 'anchor' });
    A.anchor = a; return a;
  };
  const rigSpec = pl => { const key = A.rigKey(pl.body), L = pl.look || {}; return { key, faceKit: A.kit(L.fk, key), hairKit: A.kit(L.hk, key) }; };
  A.spawnPlayer = function (pl, x, z, yaw, isPlayer) {
    const R = rigSpec(pl); if (!root.__actors.has(R.key) || !root.__actors.has(R.faceKit) || !root.__actors.has(R.hairKit)) return null;
    const P = A.playerParams(pl);
    if (A.player) root.__actors.remove(A.player.id);
    const a = root.__actors.add({ key: R.key, kind: 'rig', faceKit: R.faceKit, hairKit: R.hairKit, x: x || 0, z: z || 0, yaw: yaw || 0, scale: A.scaleFor(bodyH(R.key), P.meters), look: P.look, headScale: P.head, wide: P.width, morph: P.morph, face: P.face, skipRe: A.hideRe(pl.look), isPlayer: !!isPlayer });
    a.tintFn = null; A.player = a; return a;
  };
  A.updatePlayer = function (pl) {                      // live creator preview
    if (!A.player) return; const P = A.playerParams(pl), R = rigSpec(pl);
    if (A.player.key !== R.key || A.player.faceKit !== R.faceKit || A.player.hairKit !== R.hairKit) { const { x, z, yaw, isPlayer } = A.player; return A.spawnPlayer(pl, x, z, yaw, isPlayer); }
    Object.assign(A.player, { scale: A.scaleFor(bodyH(R.key), P.meters), look: P.look, headScale: P.head, wide: P.width, morph: P.morph, face: P.face, skipRe: A.hideRe(pl.look) }); A.player.tintFn = null;
  };
  A.spawnMannequin = function (x, z, yaw, meters) {             // the creator's default body: the uploaded human model on the canonical rig
    if (!root.__actors.has('mannequin')) return null; A.mannequin = root.__actors.add({ key: 'mannequin', kind: 'mannequin', x, z, yaw: yaw || 0, scale: A.scaleFor(bodyH('mannequin'), meters || 1.3), morph: A.bodyMorph(null) }); return A.mannequin;
  };
  A.removeMannequin = () => { if (A.mannequin) { root.__actors.remove(A.mannequin.id); A.mannequin = null; } };
  A.spawnColossal = function (x, z, yaw, meters) {
    if (!root.__actors.has('colossal')) return null;
    const sc = A.scaleFor(bodyH('colossal'), meters || 60), ymin = info && info.colossal ? info.colossal.info.bodyYmin : 0;
    A.colossal = root.__actors.add({ key: 'colossal', static: true, kind: 'titan', x, y: -ymin * sc, z, yaw, scale: sc }); return A.colossal;
  };
  A.bodyH = bodyH; A.ymin = key => info && info[key] ? info[key].info.bodyYmin : 0;
  A.removeColossal = () => { if (A.colossal) { root.__actors.remove(A.colossal.id); A.colossal = null; } };
  A.talking = (id, on) => { const a = id === 'anchor' ? A.anchor : A.npcs[id]; if (a) a.talking = !!on; };
  A.faceTowards = (px, pz, range) => {                  // idle NPCs turn to look at a nearby player
    for (const id in A.npcs) { const a = A.npcs[id]; a.lookAt = Math.hypot(a.x - px, a.z - pz) < (range || 9) ? [px, pz] : null; }
    if (A.anchor) A.anchor.lookAt = Math.hypot(A.anchor.x - px, A.anchor.z - pz) < (range || 9) ? [px, pz] : null;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);

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
  A.playerLook = p => {
    const L = p.look || {}, w = p.wear || 0, D = S.destiny;
    return { skin: D.SKIN[L.skin || 0] || D.SKIN[1], hair: D.HAIR[L.hair || 0] || D.HAIR[2], top: A.applyWear(D.TOP[L.top || 0], w), bottom: A.applyWear(D.BOTTOM[L.bottom || 0], w), shoes: D.SHOES[L.shoes || 0] };
  };
  A.playerParams = p => {                              // all visual numbers for a created character
    const L = p.look || {}, h = 1.3 * (0.92 + (L.height == null ? 0.5 : L.height) * 0.16), width = 0.92 + (L.build == null ? 0.5 : L.build) * 0.18;
    const hw = 0.94 + (L.headW == null ? 0.5 : L.headW) * 0.12, hh = 0.94 + (L.headH == null ? 0.5 : L.headH) * 0.12;
    return { meters: h, width, head: 1.1 * (hw + hh) / 2, look: A.playerLook(p) };
  };

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
    if (keys.includes('teen')) { await S.teen.load(); keys = keys.filter(k => k !== 'teen'); }
    if (!keys.length) return;
    if (!loading) loading = init().catch(e => { loading = null; throw e; }); await loading;
    let n = 0; root.__MODELS = root.__MODELS || {};
    for (const key of keys) {
      if (root.__actors.has(key)) { n++; continue; }
      const d = info[key]; if (!d) { console.warn('[actors] unknown model', key); continue; }
      root.__MODELS[key] = { meta: d.meta, bin: pack[key + '.bin'], tex: Array.from({ length: d.ntex }, (_, i) => pack[key + '.t' + i]) };
      await root.__actors.loadModel(key); if (onProgress) onProgress(++n / keys.length);
    }
  };
  const bodyH = key => (key === 'teen' || key === 'boy') ? S.teen.bodyHeight(key) : info && info[key] ? info[key].info.bodyHeight : 1.7;

  /* ---- spawning ---- */
  A.clearNpcs = () => { for (const id in A.npcs) root.__actors.remove(A.npcs[id].id); A.npcs = {}; if (A.anchor) { root.__actors.remove(A.anchor.id); A.anchor = null; } };
  A.clearAll = () => { root.__actors.clear(false); A.npcs = {}; A.player = null; A.anchor = null; A.colossal = null; };
  A.spawnNpc = function (id, x, z, yaw) {
    const d = S.data.npcs[id]; if (!d || !root.__actors.has(d.model)) return null;
    const a = root.__actors.add({ key: d.model, kind: d.kind, x, z, yaw: yaw || 0, scale: A.scaleFor(bodyH(d.model), d.height), look: d.look, headScale: d.head || 1, wide: d.width || 1, idle: d.idle, npcId: id, walk: d.walk || Math.min(1.1, 1.35 * 0.42 * d.height),
      skipRe: d.kind === 'fuse' ? null : undefined });
    A.npcs[id] = a; return a;
  };
  A.anchorParams = function (pl) {
    const D = S.destiny, an = pl.anchor, adult = an.rel === 'parent', key = an.gender === 'm' ? 'fuse_man' : an.gender === 'f' ? 'fuse_woman' : (an.look % 2 ? 'fuse_man' : 'fuse_woman');
    const look = D.look(an.look || 1), h = adult ? 1.66 + (look.height - 1) * 0.5 : 1.28 + (look.height - 1) * 0.6;
    return { key, meters: h, look, adult };
  };
  A.spawnAnchor = function (pl, x, z, yaw) {
    const P = A.anchorParams(pl); if (!root.__actors.has(P.key)) return null;
    const a = root.__actors.add({ key: P.key, kind: 'fuse', x, z, yaw: yaw || 0, scale: A.scaleFor(bodyH(P.key), P.meters), look: { skin: P.look.skin, hair: P.look.hair, top: P.look.top, bottom: P.look.bottom, shoes: P.look.shoes },
      headScale: P.adult ? 1 : 1.1, wide: P.look.width, skipRe: P.adult && pl.anchor.gender === 'm' && (pl.anchor.look % 3 === 0) ? null : BEARD, npcId: 'anchor' });
    A.anchor = a; return a;
  };
  A.spawnPlayer = function (pl, x, z, yaw, isPlayer) {
    const key = pl.body || 'fuse_woman'; if (!root.__actors.has(key)) return null;
    if (key === 'teen') {                                  // the young character foundation (js/story/teen.js); look.base picks the model
      const mk = S.teen.keyFor(pl.look), k2 = root.__actors.has(mk) ? mk : 'teen';
      if (A.player) root.__actors.remove(A.player.id);
      const a = root.__actors.add({ key: k2, kind: 'rig', x: x || 0, z: z || 0, yaw: yaw || 0, scale: 1, isPlayer: !!isPlayer }); S.teen.apply(a, pl.look, pl.wear); A.player = a; return a;
    }
    const P = A.playerParams(pl); if (S.teen && S.teen.loco) S.teen.loco.setCamera(false);
    if (A.player) root.__actors.remove(A.player.id);
    const a = root.__actors.add({ key, kind: 'fuse', x: x || 0, z: z || 0, yaw: yaw || 0, scale: A.scaleFor(bodyH(key), P.meters), look: P.look, headScale: P.head, wide: P.width, skipRe: BEARD, isPlayer: !!isPlayer });
    a.tintFn = null; A.player = a; return a;
  };
  A.updatePlayer = function (pl) {                      // live creator preview
    if (!A.player) return; const key = pl.body || 'fuse_woman';
    if (key === 'teen') { const mk = S.teen.keyFor(pl.look); if (A.player.key === mk || (mk === 'boy' && !root.__actors.has('boy'))) { S.teen.apply(A.player, pl.look, pl.wear); return A.player; } const { x, z, yaw, isPlayer } = A.player; return A.spawnPlayer(pl, x, z, yaw, isPlayer); }
    const P = A.playerParams(pl);
    if (A.player.key !== key) { const { x, z, yaw, isPlayer } = A.player; return A.spawnPlayer(pl, x, z, yaw, isPlayer); }
    Object.assign(A.player, { scale: A.scaleFor(bodyH(key), P.meters), look: P.look, headScale: P.head, wide: P.width }); A.player.tintFn = null;
  };
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

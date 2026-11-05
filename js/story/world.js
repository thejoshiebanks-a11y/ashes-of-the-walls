/* Ashes of the Walls — story world: talk points and trigger zones (no DOM). */
(function (root) {
  'use strict';
  const S = root.STORY;
  const W = S.world = {
    resolved: {},                                    // id -> {x,z} after collision snapping
    points: () => S.data.world.points || [],
    pos(p) { return W.resolved[p.id] || { x: p.x, z: p.z }; },
    convFor(p) {
      if (p.show && !S.expr(p.show)) return null;
      for (const t of p.talk || []) if (S.expr(t.if)) return t.conv;
      return null;
    },
    active() { const o = []; for (const p of W.points()) { const c = W.convFor(p); if (c) o.push({ p, conv: c }); } return o; },
    nearest(x, z) {
      let best = null;
      for (const a of W.active()) {
        const q = W.pos(a.p), d = Math.hypot(q.x - x, q.z - z);
        if (d <= (a.p.r || 4.5) && (!best || d < best.d)) best = { p: a.p, conv: a.conv, d };
      }
      return best;
    },
    tick(x, z) {                                     // fire zone effects when the player enters
      for (const zn of S.data.world.zones || []) {
        const key = 'zone_' + zn.id;
        if (zn.once && S.state.flags[key]) continue;
        if (Math.hypot(zn.x - x, zn.z - z) <= zn.r) { S.state.flags[key] = true; S.apply(zn.fx); }
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);

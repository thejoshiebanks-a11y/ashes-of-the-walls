/* Ashes of the Walls — saves. IndexedDB first, then localStorage, then memory. */
(function (root) {
  'use strict';
  const S = root.STORY;
  const DB = 'ashes_of_the_walls', STORE = 'saves';

  function idbBackend(idb) {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = idb.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('idb open failed'));
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), os = t.objectStore(STORE), rq = fn(os);
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    }));
    return { name: 'indexeddb', get: k => tx('readonly', o => o.get(k)), set: (k, v) => tx('readwrite', o => o.put(v, k)), del: k => tx('readwrite', o => o.delete(k)), keys: () => tx('readonly', o => o.getAllKeys()) };
  }
  function lsBackend(ls) {
    const P = 'ashes_save_';
    return {
      name: 'localstorage',
      get: async k => { const v = ls.getItem(P + k); return v ? JSON.parse(v) : undefined; },
      set: async (k, v) => { ls.setItem(P + k, JSON.stringify(v)); },
      del: async k => { ls.removeItem(P + k); },
      keys: async () => { const o = []; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k.startsWith(P)) o.push(k.slice(P.length)); } return o; }
    };
  }
  function memBackend() {
    const m = new Map();
    return { name: 'memory', get: async k => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); }, keys: async () => [...m.keys()] };
  }

  const SV = S.save = {
    backend: null,
    SLOTS: ['auto', 'slot1', 'slot2', 'slot3'],
    async init(env) {
      env = env || root;
      const tries = [];
      if (env.indexedDB) tries.push(() => idbBackend(env.indexedDB));
      try { if (env.localStorage) { env.localStorage.setItem('__t', '1'); env.localStorage.removeItem('__t'); tries.push(() => lsBackend(env.localStorage)); } } catch (e) {}
      tries.push(memBackend);
      for (const mk of tries) {
        try { const b = mk(); await b.keys(); SV.backend = b; return b.name; } catch (e) { console.warn('[save] backend failed, trying next', e); }
      }
    },
    snapshot(extra) {
      const st = JSON.parse(JSON.stringify(S.state));
      const p = st.player || {};
      return { v: S.VERSION, savedAt: Date.now(), name: p.name || '', act: st.act, quest: S.fmt((S.quests.tracked() || {}).text || ''), playSec: Math.round(st.playSec), state: st, extra: extra || null };
    },
    async write(slot, extra) { const snap = SV.snapshot(extra); await SV.backend.set(slot, snap); S.emit('save:written', { slot }); return snap; },
    async read(slot) { const s = await SV.backend.get(slot); if (s && s.v > S.VERSION) throw new Error('Save is from a newer version'); return s; },
    async remove(slot) { await SV.backend.del(slot); },
    async list() { const out = {}; for (const k of SV.SLOTS) { const s = await SV.backend.get(k); if (s) out[k] = { savedAt: s.savedAt, name: s.name, act: s.act, quest: s.quest, playSec: s.playSec }; } return out; },
    async latest() { const l = await SV.list(); let best = null; for (const k in l) if (!best || l[k].savedAt > l[best].savedAt) best = k; return best; },
    async exportAll() { const o = {}; for (const k of SV.SLOTS) { const s = await SV.backend.get(k); if (s) o[k] = s; } return JSON.stringify({ game: 'ashes-of-the-walls', v: S.VERSION, saves: o }); },
    async importAll(json) { const o = JSON.parse(json); if (o.game !== 'ashes-of-the-walls') throw new Error('Not an Ashes of the Walls backup'); for (const k in o.saves) if (SV.SLOTS.includes(k)) await SV.backend.set(k, o.saves[k]); }
  };
  SV._backends = { idbBackend, lsBackend, memBackend };
  if (typeof module !== 'undefined' && module.exports) module.exports = SV;
})(typeof window !== 'undefined' ? window : globalThis);

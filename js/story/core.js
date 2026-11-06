/* Ashes of the Walls — story core (no DOM). Events, state, expressions, effects, quests. */
(function (root) {
  'use strict';
  const S = root.STORY = root.STORY || {};
  S.VERSION = 1;                      // save-format version

  /* ---------- event bus ---------- */
  const H = {};
  S.on = (e, f) => { (H[e] = H[e] || []).push(f); return () => S.off(e, f); };
  S.off = (e, f) => { const a = H[e]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } };
  S.emit = (e, d) => {
    for (const f of (H[e] || []).slice()) { try { f(d); } catch (err) { console.error('[story] handler error on', e, err); } }
    if (S.quests) S.quests._onEvent(e);
  };

  /* ---------- state ---------- */
  S.data = { config: {}, characters: {}, quests: {}, dialogue: {}, world: {}, credits: {} };
  const fresh = () => ({ v: S.VERSION, player: null, flags: {}, bonds: {}, quests: {}, clock: { hour: 7.0 }, day: 1, pos: null, act: 'prologue', playSec: 0, created: Date.now() });
  S.state = fresh();
  S.reset = () => { S.state = fresh(); S.emit('state:reset'); };
  S.load = (snap) => { S.state = Object.assign(fresh(), JSON.parse(JSON.stringify(snap))); S.emit('state:loaded'); };

  S.flag = k => S.state.flags[k];
  S.setFlag = (k, v) => { S.state.flags[k] = v; S.emit('flag:' + k, v); };
  S.bond = id => S.state.bonds[id] || 0;
  S.addBond = (id, n) => {
    const v = Math.max(-5, Math.min(10, S.bond(id) + n));
    S.state.bonds[id] = v; S.emit('bond', { id, value: v, delta: n });
  };

  /* ---------- game state machine ---------- */
  const STATES = ['boot', 'intro', 'title', 'creator', 'play', 'dialogue', 'cutscene', 'paused', 'journal', 'saves', 'credits', 'ending'];
  S.fsm = {
    state: 'boot', prev: null, stack: [],
    is(...a) { return a.includes(S.fsm.state); },
    set(next) {
      if (!STATES.includes(next)) throw new Error('Unknown state ' + next);
      const from = S.fsm.state; if (from === next) return;
      S.fsm.prev = from; S.fsm.state = next; S.emit('fsm', { from, to: next });
    },
    push(next) { S.fsm.stack.push(S.fsm.state); S.fsm.set(next); },      // modal overlay on top of current state
    pop(fallback) { S.fsm.set(S.fsm.stack.pop() || fallback || 'play'); }
  };

  /* ---------- pronouns / speakers ---------- */
  const PRON = { m: { he: 'he', him: 'him', his: 'his', He: 'He' }, f: { he: 'she', him: 'her', his: 'her', He: 'She' }, x: { he: 'they', him: 'them', his: 'their', He: 'They' } };
  const REL = { sibling: { m: 'brother', f: 'sister', x: 'sibling' }, parent: { m: 'father', f: 'mother', x: 'parent' }, friend: { m: 'friend', f: 'friend', x: 'friend' }, cousin: { m: 'cousin', f: 'cousin', x: 'cousin' } };
  S.pron = (g, k) => (PRON[g] || PRON.x)[k];
  const anchorOf = () => (S.state.player && S.state.player.anchor) || { name: 'Anchor', rel: 'friend', gender: 'x' };
  S.speaker = id => {
    const p = S.state.player;
    if (id === 'player') return { id, name: (p && p.name) || 'You', color: '#8fa7b8', mono: ((p && p.name) || 'Y')[0].toUpperCase(), faction: 'player' };
    if (id === 'anchor') { const a = anchorOf(); return { id, name: a.name, color: '#c9a45c', mono: (a.name || 'A')[0].toUpperCase(), faction: 'anchor' }; }
    if (!id || id === 'narr') return { id: 'narr', name: '', color: '#8a8f94', mono: '', faction: 'narr' };
    const c = S.data.characters[id];
    return c ? { id, name: c.name, color: S.data.config.factionColors && S.data.config.factionColors[c.faction] || '#8a8f94', mono: c.mono || c.name[0], faction: c.faction, tier: c.tier }
             : { id, name: id, color: '#8a8f94', mono: id[0] ? id[0].toUpperCase() : '?', faction: 'civilian' };
  };

  /* ---------- expressions (safe, no eval) ---------- */
  const cache = {};
  function tokenize(src) {
    const t = [], re = /\s*(?:(\d+(?:\.\d+)?)|('([^']*)'|"([^"]*)")|([A-Za-z_][A-Za-z0-9_.]*)|(&&|\|\||==|!=|>=|<=|[><!()]))/y;
    let m; re.lastIndex = 0;
    while (re.lastIndex < src.length) {
      const at = re.lastIndex; m = re.exec(src);
      if (!m) { if (/^\s*$/.test(src.slice(at))) break; throw new Error('Bad expression: ' + src); }
      if (m[1] !== undefined) t.push({ k: 'n', v: parseFloat(m[1]) });
      else if (m[2] !== undefined) t.push({ k: 's', v: m[3] !== undefined ? m[3] : m[4] });
      else if (m[5] !== undefined) {
        const w = m[5];
        if (w === 'and') t.push({ k: 'o', v: '&&' }); else if (w === 'or') t.push({ k: 'o', v: '||' }); else if (w === 'not') t.push({ k: 'o', v: '!' });
        else if (w === 'true') t.push({ k: 'n', v: true }); else if (w === 'false') t.push({ k: 'n', v: false });
        else t.push({ k: 'i', v: w });
      } else t.push({ k: 'o', v: m[6] });
    }
    return t;
  }
  function parse(src) {
    const t = tokenize(src); let i = 0;
    const peek = () => t[i], eat = () => t[i++], isOp = v => t[i] && t[i].k === 'o' && t[i].v === v;
    function or() { let a = and(); while (isOp('||')) { eat(); const b = and(), l = a; a = c => !!(l(c) || b(c)); } return a; }
    function and() { let a = not(); while (isOp('&&')) { eat(); const b = not(), l = a; a = c => !!(l(c) && b(c)); } return a; }
    function not() { if (isOp('!')) { eat(); const x = not(); return c => !x(c); } return cmp(); }
    function cmp() {
      const a = prim();
      const o = t[i];
      if (o && o.k === 'o' && ['==', '!=', '>=', '<=', '>', '<'].includes(o.v)) {
        eat(); const b = prim();
        return c => { const x = a(c), y = b(c); switch (o.v) { case '==': return x == y; case '!=': return x != y; case '>=': return x >= y; case '<=': return x <= y; case '>': return x > y; default: return x < y; } };
      }
      return a;
    }
    function prim() {
      const k = eat(); if (!k) throw new Error('Unexpected end: ' + src);
      if (k.k === 'n' || k.k === 's') return () => k.v;
      if (k.k === 'i') return () => S.lookup(k.v);
      if (k.k === 'o' && k.v === '(') { const e = or(); if (!isOp(')')) throw new Error('Missing ) in ' + src); eat(); return e; }
      throw new Error('Unexpected "' + k.v + '" in ' + src);
    }
    const f = or(); if (i < t.length) throw new Error('Trailing tokens in ' + src); return f;
  }
  S.lookup = path => {
    const st = S.state, p = path.split('.');
    switch (p[0]) {
      case 'bond': return S.bond(p[1]);
      case 'quest': { const q = st.quests[p[1]]; return q ? q.status : 'none'; }
      case 'obj': { const q = st.quests[p[1]]; return !!(q && q.done && q.done[p[2]]); }
      case 'player': { const pl = st.player || {}; return p[1] === 'anchor' ? (pl.anchor || {})[p[2]] : pl[p[1]]; }
      case 'hour': return st.clock.hour;
      case 'day': return st.day;
      case 'act': return st.act;
      default: { const v = st.flags[path]; return v === undefined ? false : v; }
    }
  };
  S.expr = (src, fallback) => {
    if (src === undefined || src === null || src === '') return fallback === undefined ? true : fallback;
    let f = cache[src]; if (!f) f = cache[src] = parse(src);
    return !!f();
  };

  /* ---------- text templating ---------- */
  S.fmt = text => String(text == null ? '' : text).replace(/\{([A-Za-z_][A-Za-z0-9_.:]*)\}/g, (m, k) => {
    const pl = S.state.player || {}, a = anchorOf();
    if (k === 'player') return pl.name || 'you';
    if (k.startsWith('player.')) return S.pron(pl.gender, k.slice(7)) || m;
    if (k === 'anchor') return a.name;
    if (k === 'anchor.rel') return (REL[a.rel] || REL.friend)[a.gender] || 'friend';
    if (k.startsWith('anchor.')) return S.pron(a.gender, k.slice(7)) || m;
    if (k.startsWith('flag:')) return String(S.lookup(k.slice(5)));
    return m;
  });

  /* ---------- effects ---------- */
  const FX = {};
  S.registerEffect = (op, fn) => { FX[op] = fn; };
  S.apply = list => {
    if (!list) return;
    for (const e of (Array.isArray(list) ? list : [list])) {
      if (e.if && !S.expr(e.if)) continue;
      const f = FX[e.op];
      if (!f) { console.warn('[story] unknown effect op', e.op); continue; }
      try { f(e); } catch (err) { console.error('[story] effect failed', e, err); }
    }
  };
  FX.set = e => S.setFlag(e.key, e.value === undefined ? true : e.value);
  FX.add = e => S.setFlag(e.key, (Number(S.flag(e.key)) || 0) + (e.value === undefined ? 1 : e.value));
  FX.bond = e => S.addBond(e.id, e.value === undefined ? 1 : e.value);
  FX.emit = e => S.emit(e.event, e.data);
  FX['quest.start'] = e => S.quests.start(e.id);
  FX['quest.obj'] = e => S.quests.objDone(e.id, e.obj);
  FX['quest.done'] = e => S.quests.complete(e.id);
  FX['quest.fail'] = e => S.quests.fail(e.id);
  FX.day = e => { S.state.day = e.value; S.state.clock.hour = (S.data.config.start || {}).hour || 7; S.emit('day:change', e.value); };
  FX.hour = e => { S.state.clock.hour = e.value; S.emit('clock', e.value); };
  // UI-level ops (card, toast, scene, save, shake…) are registered by the UI/main layer.

  /* ---------- quests ---------- */
  const Q = S.quests = {
    def: id => S.data.quests[id],
    status: id => { const q = S.state.quests[id]; return q ? q.status : 'none'; },
    start(id) {
      const d = Q.def(id); if (!d) return console.warn('[story] unknown quest', id);
      if (S.state.quests[id]) return;
      S.state.quests[id] = { status: 'active', done: {}, t: Date.now() };
      S.emit('quest:start', { id, def: d }); S.apply(d.onStart);
    },
    objDone(id, obj) {
      const q = S.state.quests[id], d = Q.def(id);
      if (!q || q.status !== 'active' || !d || q.done[obj]) return;
      if (!d.objectives.some(o => o.id === obj)) return console.warn('[story] unknown objective', id, obj);
      q.done[obj] = true; S.emit('quest:obj', { id, obj, def: d });
      const req = d.objectives.filter(o => !o.optional);
      if (req.every(o => q.done[o.id])) Q.complete(id);
    },
    complete(id) {
      const q = S.state.quests[id], d = Q.def(id);
      if (!q || q.status !== 'active') return;
      q.status = 'done'; S.emit('quest:complete', { id, def: d }); S.apply(d.onComplete);
    },
    fail(id) { const q = S.state.quests[id]; if (q && q.status === 'active') { q.status = 'failed'; S.emit('quest:fail', { id }); } },
    active() { return Object.keys(S.state.quests).filter(id => S.state.quests[id].status === 'active'); },
    // the objective a HUD should show for a quest (first undone; all must be sequential-aware)
    current(id) {
      const q = S.state.quests[id], d = Q.def(id); if (!q || !d) return null;
      const o = d.objectives.find(o => !q.done[o.id]); return o ? Object.assign({ quest: id }, o) : null;
    },
    // main quest first, then side quests, in definition order
    tracked() {
      const ids = Q.active().sort((a, b) => ((Q.def(a).kind === 'main') ? 0 : 1) - ((Q.def(b).kind === 'main') ? 0 : 1));
      return ids.length ? Q.current(ids[0]) : null;
    },
    // all objective markers the world should highlight
    markers() { const m = {}; for (const id of Q.active()) { const o = Q.current(id); if (o && o.marker) m[o.marker] = Object.assign({ quest: id, main: Q.def(id).kind === 'main' }, o); } return m; },
    _onEvent(e) {
      for (const id of Q.active()) {
        const d = Q.def(id), q = S.state.quests[id];
        for (const o of d.objectives) if (o.on === e && !q.done[o.id]) Q.objDone(id, o.id);
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);

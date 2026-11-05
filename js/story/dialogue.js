/* Ashes of the Walls — dialogue runner (no DOM). Emits dialogue:line / dialogue:end. */
(function (root) {
  'use strict';
  const S = root.STORY;
  const D = S.dialogue = {
    cur: null,
    active() { return !!D.cur; },
    start(convId) {
      const conv = S.data.dialogue[convId];
      if (!conv) { console.warn('[story] unknown conversation', convId); return false; }
      if (D.cur) D.end(true);
      D.cur = { id: convId, conv, node: null, steps: 0 };
      S.emit('dialogue:start', { id: convId });
      D._enter(conv.start);
      return true;
    },
    _resolve(next) {                       // "node" | "conv:other" | "conv:other.node"
      if (typeof next === 'string' && next.startsWith('conv:')) {
        const [cid, nid] = next.slice(5).split('.'); const conv = S.data.dialogue[cid];
        if (!conv) { console.warn('[story] unknown conv link', next); return null; }
        D.cur.conv = conv; D.cur.id = cid; return nid || conv.start;
      }
      return next;
    },
    _enter(nodeId) {
      const c = D.cur; if (!c) return;
      for (;;) {
        if (++c.steps > 400) { console.error('[story] dialogue loop guard tripped in', c.id); return D.end(); }
        nodeId = D._resolve(nodeId);
        const n = nodeId && c.conv.nodes[nodeId];
        if (!n) return D.end();
        if (n.branch) { const b = n.branch.find(b => S.expr(b.if)); if (!b) return D.end(); nodeId = b.next; continue; }
        c.node = n; c.nodeId = nodeId;
        S.apply(n.fx);
        const choices = n.choices ? n.choices.map((ch, i) => ({ i, ch })).filter(x => S.expr(x.ch.if)) : null;
        if (!n.t && !choices) { if (n.next && !n.end) { nodeId = n.next; continue; } return D.end(); }
        c.visible = choices;
        S.emit('dialogue:line', {
          speaker: S.speaker(n.s), text: S.fmt(n.t || ''), mood: n.mood || null,
          choices: choices ? choices.map(x => ({ text: S.fmt(x.ch.t) })) : null, conv: c.id
        });
        return;
      }
    },
    advance() {
      const c = D.cur; if (!c || !c.node) return;
      if (c.visible) return;                       // must choose
      if (c.node.end || !c.node.next) return D.end();
      D._enter(c.node.next);
    },
    choose(idx) {
      const c = D.cur; if (!c || !c.visible || !c.visible[idx]) return;
      const ch = c.visible[idx].ch;
      S.emit('dialogue:choice', { conv: c.id, node: c.nodeId, text: ch.t });
      S.apply(ch.fx);
      if (!D.cur) return;                          // an effect may have ended the dialogue
      if (ch.next) D._enter(ch.next); else D.end();
    },
    end(silent) {
      const c = D.cur; if (!c) return; D.cur = null;
      const key = 'talked_' + c.id; S.state.flags[key] = (Number(S.state.flags[key]) || 0) + 1;
      if (!silent) { S.emit('dialogue:end', { id: c.id }); S.emit('talk:' + c.id); }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);

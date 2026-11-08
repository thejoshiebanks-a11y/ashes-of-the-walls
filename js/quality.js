/* Ashes of the Walls: graphics quality foundation (Phase 1).
   Loaded between engine.js and viewer.js. It never replaces the renderer; it only drives knobs the engine already has
   (E.dpr, E.scale, E.lodScale, shadow size, cascade count) and watches frame time.
   Tiers: LOW, MEDIUM, HIGH, ULTRA. Tier is chosen from real capabilities (memory, cores, screen, GL limits) as a starting guess,
   then confirmed or corrected by sustained frame-time measurement. The GPU name is only a veto for software renderers.
   Everything is reversible: GFX.off() restores the old behaviour. */
(function () {
  'use strict';
  const KEY = 'aow.gfx';
  const TIERS = {
    //            dprCap  scaleMin scaleMax shadowPx cascades lod   aniso  msaa  post (reserved for phase 2)
    low:    { dprCap: 1.25, scaleMin: 0.5,  scaleMax: 0.85, shadowPx: 1024, cascades: 1, lod: 0.75, aniso: 2,  msaa: false, post: 0 },
    medium: { dprCap: 1.6,  scaleMin: 0.55, scaleMax: 1.0,  shadowPx: 2048, cascades: 2, lod: 0.9,  aniso: 4,  msaa: false, post: 1 },
    high:   { dprCap: 2.0,  scaleMin: 0.6,  scaleMax: 1.0,  shadowPx: 3072, cascades: 2, lod: 1.0,  aniso: 8,  msaa: true,  post: 2 },
    ultra:  { dprCap: 2.5,  scaleMin: 0.7,  scaleMax: 1.0,  shadowPx: 4096, cascades: 2, lod: 1.15, aniso: 16, msaa: true,  post: 3 }
  };
  const ORDER = ['low', 'medium', 'high', 'ultra'];
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { v == null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, v); } catch (e) { } }
  };
  const nav = navigator, mobile = /Mobi|Android|iPhone|iPad/i.test(nav.userAgent) || ('ontouchstart' in window && innerWidth < 900);

  /* ---- capability probe (no rendering): returns {score 0..10, notes} ---- */
  function probe(gl) {
    const n = []; let sc = mobile ? 4 : 7;
    const mem = nav.deviceMemory, cores = nav.hardwareConcurrency || 4, px = screen.width * screen.height * Math.pow(window.devicePixelRatio || 1, 2);
    if (mem) { sc += mem >= 8 ? 1.5 : mem >= 4 ? 0.5 : -1.5; n.push('mem' + mem); }
    sc += cores >= 8 ? 1 : cores <= 4 ? -1 : 0; n.push('cores' + cores);
    if (px > 4.2e6) sc -= 1; n.push('px' + Math.round(px / 1e5) / 10 + 'M');
    if (gl) {
      const mt = gl.getParameter(gl.MAX_TEXTURE_SIZE), ms = gl.getParameter(gl.MAX_SAMPLES), fl = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
      if (mt < 8192) sc -= 1; if (ms < 4) sc -= 0.5; if (!fl) sc -= 0.5; n.push('tex' + mt, 'msaa' + ms, fl ? 'float' : 'nofloat');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info'), r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|llvmpipe|software|basic render/i.test(r)) { sc = Math.min(sc, 1); n.push('software'); }   // the only thing the GPU name decides
    }
    return { score: Math.max(0, Math.min(10, sc)), notes: n.join(' ') };
  }
  const tierFromScore = s => s >= 8.5 ? 'ultra' : s >= 6 ? 'high' : s >= 3.5 ? 'medium' : 'low';

  /* ---- frame-time monitor: ring buffer + percentiles + long-term baseline for thermal drift ---- */
  class Monitor {
    constructor(n = 240) { this.n = n; this.buf = new Float32Array(n); this.i = 0; this.cnt = 0; this.total = 0; this.jank = 0; this.base = null; this.baseBuf = []; this.t0 = performance.now(); this.hist = []; this.lastHist = 0; this.target = 16.7; this.refresh = 16.7; this.minDt = 99; }
    push(ms) {
      if (ms > 250 || ms <= 0) return;                    // tab switch / pause: not a real frame
      this.buf[this.i] = ms; this.i = (this.i + 1) % this.n; this.cnt = Math.min(this.cnt + 1, this.n); this.total++;
      if (ms < this.minDt && this.total > 20) this.minDt = ms;
      if (ms > this.target * 1.6) this.jank++;
    }
    stats(window_ = this.n) {
      const c = Math.min(this.cnt, window_); if (c < 8) return null; const a = [];
      for (let k = 0; k < c; k++) a.push(this.buf[(this.i - 1 - k + this.n * 2) % this.n]); a.sort((x, y) => x - y);
      const avg = a.reduce((s, v) => s + v, 0) / c, q = p => a[Math.min(c - 1, Math.floor(c * p))];
      return { n: c, avg, med: q(0.5), p90: q(0.9), p99: q(0.99), fps: 1000 / avg };
    }
  }

  const GFX = window.GFX = {
    TIERS, ORDER, tier: 'medium', auto: true, E: null, mon: new Monitor(), enabled: true, scale: 1, log: [], lock: false,
    cfg() { return TIERS[this.tier]; },
    /* before the GL context exists: should the default framebuffer be multisampled? (explicit LOW/MEDIUM choice turns it off; phase 2 replaces it with FXAA) */
    wantAA() { const q = new URLSearchParams(location.search).get('gfx'), t = ORDER.indexOf(q) >= 0 ? q : store.get(); return TIERS[t] ? TIERS[t].msaa : true; },
    /* called once, right after the engine exists */
    init(E) {
      this.E = E; const q = new URLSearchParams(location.search).get('gfx'), saved = store.get();
      const pr = this.cap = probe(E.gl); let t = ORDER.indexOf(q) >= 0 ? q : ORDER.indexOf(saved) >= 0 ? saved : null;
      this.auto = !t; if (!t) t = tierFromScore(pr.score);
      if (mobile && t === 'ultra' && this.auto) t = 'high';
      this.startTier = t; this.apply(t, true); this.note('init tier=' + t + ' score=' + pr.score.toFixed(1) + ' (' + pr.notes + ') auto=' + this.auto);
      document.addEventListener('visibilitychange', () => { this.hold = 3; });
      return this;
    },
    note(s) { this.log.push(((performance.now() / 1000) | 0) + 's ' + s); if (this.log.length > 60) this.log.shift(); try { console.log('[GFX]', s); } catch (e) { } },
    /* apply a tier to the engine. Safe to call at any time. */
    apply(name, silent) {
      const E = this.E; if (!E || !TIERS[name]) return; this.tier = name; const c = TIERS[name];
      E.dpr = Math.min(window.devicePixelRatio || 1, c.dprCap); E.lodScale = c.lod * (E.mobile ? 0.95 : 1); E.cascades = c.cascades; E.quality = name;
      if (E.setShadowSize) E.setShadowSize(c.shadowPx);
      E.aniso && (E.anisoMax = c.aniso);
      this.scale = Math.min(Math.max(this.scale || 1, c.scaleMin), c.scaleMax); if (name === 'low') this.scale = Math.min(this.scale, 0.8);
      E.scale = this.scale; this.hold = 3; this.upOK = 0; this.downOK = 0; this.red = null; this.mon.capped = false; this.mon.cnt = 0; this.mon.base = null; this.mon.baseBuf = [];
      if (!silent) this.note('tier -> ' + name);
      window.dispatchEvent(new CustomEvent('gfxtier', { detail: { tier: name, cfg: c } }));
    },
    /* the player's explicit choice. 'auto' returns control to the measurement loop */
    set(name) { if (name === 'auto') { store.set(null); this.auto = true; this.apply(tierFromScore(this.cap.score)); return; } this.auto = false; store.set(name); this.apply(name); },
    off() { this.enabled = false; if (this.E) { this.E.scale = 1; this.E.cascades = 2; } },
    /* per frame: pass the real frame delta in seconds */
    update(dt) {
      const m = this.mon; if (!this.enabled || !this.E) return; m.push(dt * 1000);
      if (m.minDt < 99) { m.refresh = Math.max(7, Math.min(40, m.minDt)); if (!m.capped) m.target = 16.7; }   // aim for 60 fps; a cap (30 Hz low-power mode) is detected below, not guessed
      this.since = (this.since || 0) + dt; if (this.since < 0.5) return; this.since = 0;
      if (this.hold > 0) { this.hold -= 0.5; return; }
      const s = m.stats(120); if (!s) return; const c0 = this.cfg(), T = m.target, lk = window.__lockScale, c = lk ? Object.assign({}, c0, { scaleMin: Math.max(c0.scaleMin, 0.9) }) : c0;   // cinematics keep full sharpness
      if (lk && this.scale < c.scaleMin) { this.scale = c.scaleMin; this.E.scale = this.scale; }
      // baseline + thermal drift: first sustained 8 s after a tier change becomes the baseline
      if (!m.base) { m.baseBuf.push(s.med); if (m.baseBuf.length >= 16) { m.base = m.baseBuf.slice().sort((a, b) => a - b)[8]; this.note('baseline ' + m.base.toFixed(1) + 'ms @' + this.tier + ' scale ' + this.scale.toFixed(2)); } }
      else if (s.med > m.base * 1.3 && !this.thermal) { this.thermal = true; this.note('sustained slowdown vs baseline (' + s.med.toFixed(1) + ' vs ' + m.base.toFixed(1) + 'ms): thermal throttle likely'); }
      else if (s.med < m.base * 1.1) this.thermal = false;
      // adaptive resolution
      const E = this.E;
      if (s.p90 > T * 1.3) {
        this.upOK = 0; this.downOK++;
        if (this.scale > c.scaleMin + 1e-3) {
          const r = this.red || (this.red = { med: s.med, scale: this.scale, n: 0 }); r.n++;
          if (r.n >= 3 && s.med > r.med * 0.92 && !m.capped) {   // shrinking the picture changed nothing: the display is capped (30 Hz low-power mode), not the GPU
            m.capped = true; m.target = s.med * 1.08; this.scale = r.scale; E.scale = this.scale; this.red = null; this.hold = 2; this.note('frame rate capped by the system at ~' + (1000 / s.med).toFixed(0) + ' fps; resolution restored'); return;
          }
          this.scale = Math.max(c.scaleMin, this.scale - (s.p90 > T * 2 ? 0.1 : 0.05)); E.scale = this.scale; this.hold = 1; this.downOK = 0; }
        else if (this.auto && this.downOK >= 12 && ORDER.indexOf(this.tier) > 0) { this.apply(ORDER[ORDER.indexOf(this.tier) - 1]); this.note('auto-dropped: still slow at minimum resolution'); }
      } else if (s.p90 < T * 0.92 && s.avg < T * 0.85) {
        this.downOK = 0; this.upOK++;
        if (this.upOK >= 6) {
          this.upOK = 0;
          if (this.scale < c.scaleMax - 1e-3) { this.scale = Math.min(c.scaleMax, this.scale + 0.025); E.scale = this.scale; }
          else if (this.auto && !this.thermal && ORDER.indexOf(this.tier) < ORDER.indexOf(mobile ? 'high' : 'ultra') && (this.upLock || 0) < performance.now()) { this.apply(ORDER[ORDER.indexOf(this.tier) + 1]); this.upLock = performance.now() + 60000; this.note('auto-raised: headroom confirmed'); }
        }
      } else { this.upOK = 0; if (s.p90 <= T * 1.1) this.downOK = 0; }
    },
    /* text for the on-screen stats element and honest reports */
    line() { const s = this.mon.stats(120); if (!s) return this.tier.toUpperCase(); const E = this.E; return Math.round(s.fps) + ' fps ' + s.avg.toFixed(1) + 'ms p90 ' + s.p90.toFixed(0) + ' · ' + this.tier.toUpperCase() + (this.auto ? ' auto' : '') + ' · ' + (E ? E.canvas.width + '×' + E.canvas.height : '') + (this.thermal ? ' · THROTTLE' : ''); },
    report() { const s = this.mon.stats(), E = this.E, m = this.mon; return JSON.stringify({ tier: this.tier, auto: this.auto, scale: +this.scale.toFixed(3), res: E ? E.canvas.width + 'x' + E.canvas.height : null, dpr: E && E.dpr, shadow: E && E.sm && E.sm[0].S, cascades: E && E.cascades, fps: s && +s.fps.toFixed(1), avgMs: s && +s.avg.toFixed(2), p90: s && +s.p90.toFixed(2), p99: s && +s.p99.toFixed(2), jank: m.jank, frames: m.total, baselineMs: m.base && +m.base.toFixed(2), thermal: !!this.thermal, refreshMs: +m.refresh.toFixed(1), cap: this.cap, log: this.log.slice(-12) }); },
    probe, tierFromScore, mobile
  };
})();

/* Ashes of the Walls — procedural audio (Web Audio). No sample files, so no licences to track.
   Everything is synthesised: wind, Titan footsteps, crows, heartbeat, ODM steel, bells, strings. */
(function (root) {
  'use strict';
  const S = root.STORY, A = S.audio = {};
  let ctx = null, master, sfxBus, musBus, rev, windN = null, noiseBuf = null, musicTimer = 0, musicOn = null;
  const store = { vol: 0.8, music: 0.7, sfx: 0.9, muted: false };
  try { Object.assign(store, JSON.parse(root.localStorage.getItem('ashes_audio') || '{}')); } catch (e) {}
  const save = () => { try { root.localStorage.setItem('ashes_audio', JSON.stringify(store)); } catch (e) {} };
  A.settings = store;

  A.init = function () {                         // must be called from a user gesture
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = store.muted ? 0 : store.vol; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = store.sfx; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = store.music; musBus.connect(master);
    // shared hall reverb from generated noise
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev = ctx.createConvolver(); rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  };
  A.ready = () => !!ctx && ctx.state === 'running';
  A.setVolume = (k, v) => { store[k] = v; if (!ctx) return save(); if (k === 'vol') master.gain.value = store.muted ? 0 : v; if (k === 'music') musBus.gain.value = v; if (k === 'sfx') sfxBus.gain.value = v; save(); };
  A.setMuted = m => { store.muted = !!m; if (ctx) master.gain.value = m ? 0 : store.vol; save(); };

  const now = () => ctx.currentTime;
  const noise = (loop) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; return s; };
  const env = (g, t, a, d, peak, end) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end || 0.0001, t + a + d); };
  const out = (node, wet, bus) => { node.connect(bus || sfxBus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(rev); } };
  const osc = (type, f, t0, t1) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); o.stop(t1); return o; };
  const safe = fn => function () { if (!ctx) return; try { return fn.apply(null, arguments); } catch (e) { console.warn('[audio]', e); } };

  // ---- continuous wind (low, scraping against stone)
  A.wind = safe(function (level) {
    if (!windN) {
      const n = noise(true), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.7; g.gain.value = 0.0001;
      lfo.frequency.value = 0.11; lg.gain.value = 240; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      n.connect(bp); bp.connect(g); g.connect(sfxBus); n.start(); windN = { g, bp };
    }
    windN.g.gain.cancelScheduledValues(now()); windN.g.gain.linearRampToValueAtTime(Math.max(0.0001, level), now() + 2.5);
  });

  // ---- one-shots
  A.thud = safe(function (power) {                // distant Titan footstep: sub-bass + rumble
    const t = now(), p = power == null ? 1 : power, g = ctx.createGain(), o = osc('sine', 62, t, t + 1.6);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.9); env(g, t, 0.012, 1.3, 0.95 * p); o.connect(g); out(g, 0.5);
    const n = noise(), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 160; env(ng, t, 0.01, 0.8, 0.5 * p);
    n.connect(lp); lp.connect(ng); out(ng, 0.4); n.start(t); n.stop(t + 1.2);
  });
  A.crow = safe(function () {
    const t0 = now();
    [0, 0.34, 0.66].forEach((d, i) => {
      const t = t0 + d, g = ctx.createGain(), bp = ctx.createBiquadFilter(), o = osc('sawtooth', 760 - i * 40, t, t + 0.3), v = ctx.createOscillator(), vg = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(480, t + 0.26); v.frequency.value = 55; vg.gain.value = 60; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + 0.3);
      bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.8; env(g, t, 0.02, 0.24, 0.16); o.connect(bp); bp.connect(g); out(g, 0.6);
    });
  });
  A.heartbeat = safe(function () {
    const t = now(); [0, 0.17].forEach((d, i) => { const g = ctx.createGain(), o = osc('sine', 58, t + d, t + d + 0.3); o.frequency.exponentialRampToValueAtTime(40, t + d + 0.2); env(g, t + d, 0.01, 0.22, i ? 0.5 : 0.8); o.connect(g); out(g, 0.15); });
  });
  A.clink = safe(function () {                    // gas canister locking into the harness
    const t = now(), n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 4; env(g, t, 0.002, 0.07, 0.35);
    n.connect(bp); bp.connect(g); out(g, 0.1); n.start(t); n.stop(t + 0.1);
    [2380, 3710, 5200].forEach((f, i) => { const og = ctx.createGain(), o = osc('sine', f, t, t + 0.25); env(og, t, 0.001, 0.12 + i * 0.03, 0.12 / (i + 1)); o.connect(og); out(og, 0.2); });
  });
  A.blade = safe(function () {                    // steel drawn from a scabbard
    const t = now(), n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'bandpass'; hp.Q.value = 2.2; hp.frequency.setValueAtTime(1800, t); hp.frequency.exponentialRampToValueAtTime(7200, t + 0.22);
    env(g, t, 0.01, 0.2, 0.4); n.connect(hp); hp.connect(g); out(g, 0.2); n.start(t); n.stop(t + 0.3);
  });
  A.whoosh = safe(function (dur) {                // pressurised gas, rising
    dur = dur || 1.6; const t = now(), n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); out(g, 0.25); n.start(t); n.stop(t + dur + 0.1);
  });
  A.lightning = safe(function () {                // electrical crack, then bass shockwave
    const t = now(), n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 2200; env(g, t, 0.001, 0.5, 1);
    n.connect(hp); hp.connect(g); out(g, 0.5); n.start(t); n.stop(t + 0.7);
    const g2 = ctx.createGain(), o = osc('sine', 78, t + 0.05, t + 3); o.frequency.exponentialRampToValueAtTime(24, t + 2.2); env(g2, t + 0.05, 0.02, 2.4, 1.1); o.connect(g2); out(g2, 0.7);
    const n2 = noise(), lp = ctx.createBiquadFilter(), g3 = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 260; env(g3, t + 0.05, 0.02, 2.2, 0.9); n2.connect(lp); lp.connect(g3); out(g3, 0.6); n2.start(t); n2.stop(t + 2.6);
  });
  A.screech = safe(function () {                  // violin screech for the title stamp
    const t = now(), g = ctx.createGain(), lp = ctx.createBiquadFilter(), v = ctx.createOscillator(), vg = ctx.createGain();
    const o = osc('sawtooth', 1320, t, t + 1.7); o.frequency.exponentialRampToValueAtTime(2050, t + 0.5); o.frequency.exponentialRampToValueAtTime(1800, t + 1.6);
    v.frequency.value = 6; vg.gain.value = 22; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + 1.7);
    lp.type = 'lowpass'; lp.frequency.value = 5200; env(g, t, 0.03, 1.5, 0.28); o.connect(lp); lp.connect(g); out(g, 0.7);
  });
  A.bell = safe(function (f) {
    f = f || 196; const t = now(); [1, 2.76, 5.4, 8.9].forEach((m, i) => { const g = ctx.createGain(), o = osc('sine', f * m, t, t + 5); env(g, t, 0.004, 4.5 / (i + 1), 0.3 / (i + 1)); o.connect(g); out(g, 0.7); });
  });
  A.crowd = safe(function (dur) {                 // panic: layered noise swells and wood splintering
    dur = dur || 3; const t = now(), n = noise(true), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); n.connect(bp); bp.connect(g); out(g, 0.3); n.start(t); n.stop(t + dur + 0.1);
    for (let i = 0; i < 6; i++) { const tt = t + 0.3 + Math.random() * (dur - 0.6), s = noise(), h = ctx.createBiquadFilter(), gg = ctx.createGain(); h.type = 'bandpass'; h.frequency.value = 1500 + Math.random() * 2500; h.Q.value = 3; env(gg, tt, 0.002, 0.12, 0.3); s.connect(h); h.connect(gg); out(gg, 0.2); s.start(tt); s.stop(tt + 0.2); }
  });
  A.hover = () => A.clink();
  A.select = () => A.blade();
  A.step = safe(function () { const t = now(), n = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 500; env(g, t, 0.004, 0.09, 0.18); n.connect(lp); lp.connect(g); out(g, 0.05); n.start(t); n.stop(t + 0.14); });

  // ---- generative music: a lonely cello and a distant voice in D minor, never repeating exactly
  const SC = { title: { bass: [73.4, 87.3, 65.4, 55, 73.4, 98], lead: [293.7, 349.2, 329.6, 440, 392, 261.6], gap: [6.5, 9], lvl: 0.55 },
               calm: { bass: [98, 73.4, 87.3, 65.4], lead: [392, 440, 349.2, 293.7], gap: [8, 12], lvl: 0.35 },
               dread: { bass: [55, 58.3, 55, 51.9], lead: [233, 220, 207.7, 233], gap: [5, 8], lvl: 0.5 } };
  function note(f, t, dur, type, lvl, wet) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(), v = ctx.createOscillator(), vg = ctx.createGain(), o1 = osc(type, f, t, t + dur + 0.3), o2 = osc(type, f * 1.004, t, t + dur + 0.3);
    v.frequency.value = 5.2; vg.gain.value = f * 0.006; v.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency); v.start(t); v.stop(t + dur + 0.3);
    lp.type = 'lowpass'; lp.frequency.value = type === 'sawtooth' ? 900 : 2400; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(lp); o2.connect(lp); lp.connect(g); out(g, wet, musBus);
  }
  A.music = function (name) {
    if (!ctx) return; if (musicOn === name) return; musicOn = name; clearTimeout(musicTimer);
    if (!name) return; const sc = SC[name]; if (!sc) return; let i = 0;
    const play = () => {
      if (musicOn !== name) return; const t = now() + 0.05;
      try {
        note(sc.bass[i % sc.bass.length], t, 7, 'sawtooth', sc.lvl * 0.5, 0.5);
        if (i % 2 === 1 || name === 'title') note(sc.lead[(i * 2) % sc.lead.length], t + 1.2, 5.5, 'triangle', sc.lvl * 0.45, 0.9);
        if (i % 3 === 2) note(sc.lead[(i + 3) % sc.lead.length] * 2, t + 3.4, 4, 'sine', sc.lvl * 0.2, 1);
        if (name === 'title') { A.choir(i % 2 ? [130.8, 196, 261.6, 311.1] : [146.8, 220, 293.7, 349.2], 11, 0.9); if (i % 3 === 1) A.bell(98); }
      } catch (e) {}
      i++; musicTimer = setTimeout(play, (sc.gap[0] + Math.random() * (sc.gap[1] - sc.gap[0])) * 1000);
    };
    play();
  };
  A.stopMusic = () => { musicOn = null; clearTimeout(musicTimer); };
  A.duck = (v, s) => { if (ctx) { musBus.gain.cancelScheduledValues(now()); musBus.gain.linearRampToValueAtTime(v * store.music, now() + (s || 0.4)); } };

  /* ---- opening additions (v0.4): studio sting, risers, steam, a drone, choir pad, stamp hit ---- */
  A.logoSting = safe(function () {                // studio sting: sub bloom, glassy shimmer, a clean hit as the mark closes
    const t = now(), g = ctx.createGain(), o = osc('sine', 49, t, t + 4.4);
    o.frequency.exponentialRampToValueAtTime(41, t + 3.6); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.3); o.connect(g); out(g, 0.3);
    [523.25, 784, 1046.5, 1568, 2093, 3136].forEach((f, i) => { const sg = ctx.createGain(), so = osc('sine', f * (1 + i * 0.0007), t + 0.1 * i, t + 4.2); sg.gain.setValueAtTime(0.0001, t + 0.1 * i); sg.gain.linearRampToValueAtTime(0.05 / (1 + i * 0.35), t + 1.9); sg.gain.exponentialRampToValueAtTime(0.0001, t + 4.1); so.connect(sg); out(sg, 0.8); });
    const n = noise(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + 1.9);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.22, t + 1.85); ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.3); n.connect(bp); bp.connect(ng); out(ng, 0.4); n.start(t); n.stop(t + 2.4);
    const th = t + 1.9, hg = ctx.createGain(), ho = osc('sine', 98, th, th + 2.4); ho.frequency.exponentialRampToValueAtTime(36, th + 1.6); env(hg, th, 0.006, 2, 0.8); ho.connect(hg); out(hg, 0.5);
    [1318.5, 2637, 3951].forEach((f, i) => { const pg = ctx.createGain(), po = osc('sine', f, th, th + 3); env(pg, th, 0.002, 2.4 - i * 0.4, 0.14 / (i + 1)); po.connect(pg); out(pg, 0.9); });
  });
  A.riser = safe(function (dur) {                 // tension swell into a cut
    dur = dur || 3; const t = now(), n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), o = osc('sawtooth', 73.4, t, t + dur + 0.1), lp = ctx.createBiquadFilter(), og = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(220, t); bp.frequency.exponentialRampToValueAtTime(5800, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + dur * 0.96); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05); n.connect(bp); bp.connect(g); out(g, 0.25); n.start(t); n.stop(t + dur + 0.1);
    o.frequency.exponentialRampToValueAtTime(293.7, t + dur); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.95); og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05); o.connect(lp); lp.connect(og); out(og, 0.4);
  });
  A.steam = safe(function (dur) {                 // a Titan venting heat
    dur = dur || 2.4; const t = now(), n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); n.connect(hp); hp.connect(g); out(g, 0.45); n.start(t); n.stop(t + dur + 0.1);
  });
  A.drone = safe(function (dur, f) {              // low strings swelling underneath a scene
    dur = dur || 6; f = f || 73.4; const t = now(); [1, 1.5, 2].forEach((m, i) => {
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(), o = osc('sawtooth', f * m, t, t + dur + 0.4), o2 = osc('sawtooth', f * m * 1.005, t, t + dur + 0.4);
      lp.type = 'lowpass'; lp.frequency.value = 520 + i * 260; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 / (1 + i * 0.5), t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      o.connect(lp); o2.connect(lp); lp.connect(g); out(g, 0.5, musBus);
    });
  });
  A.stampHit = safe(function () {                 // the title card landing: impact, steel, violin
    A.thud(1.5); A.screech();
    const t = now(), g = ctx.createGain(), o = osc('sine', 58, t, t + 3); o.frequency.exponentialRampToValueAtTime(30, t + 2); env(g, t, 0.01, 2.6, 1); o.connect(g); out(g, 0.6);
    [311, 487, 905, 1430].forEach((f, i) => { const cg = ctx.createGain(), co = osc('triangle', f, t, t + 2.4); env(cg, t, 0.002, 1.8 - i * 0.3, 0.16 / (1 + i * 0.4)); co.connect(cg); out(cg, 0.7); });
  });
  A.menuTick = safe(function () {                 // a soft steel tick for moving through the menu
    const t = now(), n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 5; env(g, t, 0.002, 0.05, 0.16);
    n.connect(bp); bp.connect(g); out(g, 0.05); n.start(t); n.stop(t + 0.08);
  });
  function choirVoice(f, t, dur, lvl) {           // an "ah" vowel: two detuned saws through formant filters
    const g = ctx.createGain(), mix = ctx.createGain(), o1 = osc('sawtooth', f, t, t + dur + 0.5), o2 = osc('sawtooth', f * 1.006, t, t + dur + 0.5), v = ctx.createOscillator(), vg = ctx.createGain();
    v.frequency.value = 4.6; vg.gain.value = f * 0.007; v.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency); v.start(t); v.stop(t + dur + 0.5); o1.connect(mix); o2.connect(mix);
    [[650, 1, 6], [1080, 0.55, 8], [2650, 0.18, 10]].forEach(([fr, gn, q]) => { const bp = ctx.createBiquadFilter(), fg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q; fg.gain.value = gn; mix.connect(bp); bp.connect(fg); fg.connect(g); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + dur * 0.42); g.gain.linearRampToValueAtTime(0.0001, t + dur); out(g, 0.95, musBus);
  }
  A.choir = safe(function (notes, dur, lvl) { const t = now() + 0.05; (notes || [146.8, 220, 293.7, 349.2]).forEach((f, i) => choirVoice(f, t + i * 0.35, dur || 11, (lvl || 0.9) / (1 + i * 0.25))); });
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);

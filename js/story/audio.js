/* Ashes of the Walls — procedural audio (Web Audio). No sample files, so no licences to track.
   Everything is synthesised: wind, Titan footsteps, crows, heartbeat, ODM steel, bells, strings. */
(function (root) {
  'use strict';
  const S = root.STORY, A = S.audio = {};
  let ctx = null, master, comp, sfxBus, musBus, rev, windN = null, noiseBuf = null, musicTimer = 0, musicOn = null;
  const LOUD = 1.9;                                // overall make-up gain: everything is synthesised quietly, a compressor keeps the peaks in check
  const store = { vol: 0.85, music: 0.8, sfx: 0.95, muted: false };
  try { Object.assign(store, JSON.parse(root.localStorage.getItem('ashes_audio') || '{}')); } catch (e) {}
  const save = () => { try { root.localStorage.setItem('ashes_audio', JSON.stringify(store)); } catch (e) {} };
  A.settings = store;

  A.init = function () {                         // must be called from a user gesture
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = store.muted ? 0 : store.vol * LOUD; if (ctx.createDynamicsCompressor) { comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 4.5; comp.attack.value = 0.004; comp.release.value = 0.22; master.connect(comp); comp.connect(ctx.destination); } else master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = store.sfx; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = store.music; musBus.connect(master);
    // shared hall reverb from generated noise
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev = ctx.createConvolver(); rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.55; rev.connect(rg); rg.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  };
  /* iPhones keep Web Audio silent while the ringer switch is on silent, and only start it from a real touch.
     So on every gesture: ask Safari for "playback" audio, loop a silent <audio> element (media audio ignores the switch), resume the context and play one empty buffer. */
  let silentEl = null;
  const silentWav = () => { const n = 8000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); }; w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) b[44 + i] = 128 + (i % 2); return URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); };
  A.unlock = function () {
    try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'playback'; } catch (e) {}
    try { if (!silentEl && root.document && root.URL && root.Blob) { silentEl = root.document.createElement('audio'); silentEl.src = silentWav(); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.preload = 'auto'; } if (silentEl) { const p = silentEl.play(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
    A.init(); if (!ctx) return false;
    try { if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch (e) {}
    return ctx.state === 'running';
  };
  if (root.document && root.document.addEventListener) ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach(ev => root.document.addEventListener(ev, () => { if (!ctx || ctx.state !== 'running') A.unlock(); }, { capture: true, passive: true }));
  A.ready = () => !!ctx && ctx.state === 'running';
  A.setVolume = (k, v) => { store[k] = v; if (!ctx) return save(); if (k === 'vol') master.gain.value = store.muted ? 0 : v * LOUD; if (k === 'music') musBus.gain.value = v; if (k === 'sfx') sfxBus.gain.value = v; save(); };
  A.setMuted = m => { store.muted = !!m; if (ctx) master.gain.value = m ? 0 : store.vol * LOUD; save(); };

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
    if (!name) return; if (name === 'title') return A.titleScore(); const sc = SC[name]; if (!sc) return; let i = 0;
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

  /* ============ v0.5: an orchestral score and big sound effects (all synthesised, no files) ============ */
  const mhz = m => 440 * Math.pow(2, (m - 69) / 12);
  const sweepEnv = (g, t, a, hold, r, peak) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r); };
  function taiko(t, lvl, f0) {                    // a big drum: pitch-dropping skin plus a slap of noise
    f0 = f0 || 92; const o = osc('sine', f0, t, t + 1.1), g = ctx.createGain(), o2 = osc('triangle', f0 * 2.1, t, t + 0.4), g2 = ctx.createGain(), n = noise(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.5); env(g, t, 0.004, 0.9, lvl); env(g2, t, 0.002, 0.22, lvl * 0.35); o.connect(g); o2.connect(g2); out(g, 0.5, musBus); out(g2, 0.3, musBus);
    lp.type = 'lowpass'; lp.frequency.value = 1400; env(ng, t, 0.002, 0.12, lvl * 0.55); n.connect(lp); lp.connect(ng); out(ng, 0.35, musBus); n.start(t); n.stop(t + 0.2);
  }
  function strings(notes, t, dur, lvl, att, bright) {   // a string section: three detuned saws per note, slow bow, light vibrato
    notes.forEach((m, k) => { const f = mhz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), v = ctx.createOscillator(), vg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = (bright || 1700) + f * 0.6; lp.Q.value = 0.4;
      v.frequency.value = 5.1 + k * 0.17; vg.gain.value = f * 0.005; v.connect(vg); v.start(t); v.stop(t + dur + 0.6);
      [-9, 0, 9].forEach(c => { const o = osc('sawtooth', f, t, t + dur + 0.6); o.detune.value = c; vg.connect(o.frequency); o.connect(lp); });
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl / Math.sqrt(notes.length), t + Math.min(att || dur * 0.4, dur)); g.gain.setValueAtTime(lvl / Math.sqrt(notes.length), t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5); lp.connect(g); out(g, 0.55, musBus); });
  }
  function brass(m, t, dur, lvl, scoop) {         // a horn section: saw + square, filter opens with the swell
    const f = mhz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), o1 = osc('sawtooth', f * (scoop ? 0.94 : 1), t, t + dur + 0.4), o2 = osc('square', f * 0.5, t, t + dur + 0.4), g2 = ctx.createGain(), o3 = osc('sawtooth', f * 1.004, t, t + dur + 0.4);
    if (scoop) { o1.frequency.linearRampToValueAtTime(f, t + 0.1); o3.frequency.linearRampToValueAtTime(f * 1.004, t + 0.1); }
    lp.type = 'lowpass'; lp.Q.value = 1.1; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(2300, t + Math.min(0.5, dur * 0.6)); lp.frequency.linearRampToValueAtTime(900, t + dur);
    g2.gain.value = 0.4; o2.connect(g2); g2.connect(lp); o1.connect(lp); o3.connect(lp); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + 0.09); g.gain.setValueAtTime(lvl * 0.85, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25); lp.connect(g); out(g, 0.45, musBus);
  }
  function cello(m, t, dur, lvl) {                // short bowed low note, the driving ostinato
    const f = mhz(m), g = ctx.createGain(), lp = ctx.createBiquadFilter(), o = osc('sawtooth', f, t, t + dur + 0.1), o2 = osc('sawtooth', f * 1.005, t, t + dur + 0.1); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    env(g, t, 0.015, dur, lvl); o.connect(lp); o2.connect(lp); lp.connect(g); out(g, 0.3, musBus);
  }
  function cymbal(t, lvl, dur) {                  // crash: bright noise with a long tail
    dur = dur || 2.6; const n = noise(true), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 5200; env(g, t, 0.004, dur, lvl); n.connect(hp); hp.connect(g); out(g, 0.5, musBus); n.start(t); n.stop(t + dur + 0.1);
  }
  const PROG = [[50, 53, 57, 62], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]];     // Dm, Bb, Gm, A
  const MEL = [[[69, 0, 1.5], [67, 1.5, 0.5], [65, 2, 1], [69, 3, 1]], [[74, 0, 2], [72, 2, 1], [70, 3, 1]], [[69, 0, 1.5], [67, 1.5, 0.5], [70, 2, 1], [74, 3, 1]], [[73, 0, 2], [76, 2, 1], [69, 3, 1]],
               [[74, 0, 1], [77, 1, 1], [76, 2, 1], [74, 3, 1]], [[74, 0, 1.5], [72, 1.5, 0.5], [70, 2, 2]], [[70, 0, 1], [69, 1, 1], [67, 2, 1], [65, 3, 1]], [[64, 0, 2], [69, 2, 2]]];
  A.titleScore = safe(function () {               // the title theme: strings, a cello drive, taiko, horns and choir. D minor, 84 bpm
    const B = 60 / 84; let bar = 0;
    const play = () => {
      if (musicOn !== 'title') return; const t = now() + 0.08, ch = PROG[bar % 4], big = (bar % 8) >= 4, root = ch[0];
      strings(ch.concat([ch[3] + 12]), t, B * 4, big ? 0.34 : 0.26, B * 1.4, 1500);
      for (let k = 0; k < 8; k++) cello(root + [0, 0, 7, 0, 12, 7, 0, 7][k], t + k * B * 0.5, B * 0.42, big ? 0.16 : 0.1);
      taiko(t, 0.5, 78); taiko(t + B * 2, 0.36, 92); if (big) { taiko(t + B * 1, 0.22, 110); taiko(t + B * 3, 0.3, 110); }
      if (bar % 4 === 3) for (let k = 0; k < 6; k++) taiko(t + B * (3 + k / 6), 0.12 + k * 0.05, 100);
      MEL[bar % 8].forEach(([m, b, d]) => brass(m + (big ? 0 : -12), t + b * B, d * B * 0.94, big ? 0.17 : 0.1, true));
      if (big) A.choir(ch.slice(1).map(mhz).map(f => f * 2), B * 4, 0.55);
      if (bar % 8 === 0) { A.bell(mhz(50)); cymbal(t, 0.07, 3.4); }
      bar++; musicTimer = setTimeout(play, B * 4000 - 250);
    };
    play();
  });
  /* ---- the opening cue: a hit at every beat of the cutscene. T = timeline offsets in seconds from now ---- */
  A.introScore = safe(function (T) {
    const t0 = now() + 0.05, at = s => t0 + s;
    strings([38, 45, 50], at(0), T.strike - 0.2, 0.18, T.strike * 0.8, 700);                                    // a held low D, a storm gathering
    for (let s = T.rumble; s < T.strike; s += 0.5) taiko(at(s), 0.06 + (s - T.rumble) / (T.strike - T.rumble) * 0.22, 55);
    strings([50, 57, 62, 65], at(T.ball), T.strike - T.ball, 0.22, (T.strike - T.ball) * 0.8, 900);            // the ball swells: tension strings climb
    [74, 77, 81].forEach((m, k) => brass(m, at(T.ball + 0.3 + k * 0.45), 0.7, 0.1 + k * 0.03, true));
    taiko(at(T.strike), 1, 58); taiko(at(T.strike) + 0.02, 0.7, 44); cymbal(at(T.strike), 0.22, 3.6); brass(50, at(T.strike), 2.6, 0.22); brass(57, at(T.strike), 2.6, 0.18);   // the strike
    strings([50, 57, 62, 65, 69], at(T.strike + 0.6), T.grab - T.strike, 0.26, (T.grab - T.strike) * 0.7, 900);
    taiko(at(T.grab), 0.85, 60); cymbal(at(T.grab), 0.12, 2.4);                                                 // the hand clamps the wall
    [0, 1, 2, 3].forEach(k => { const m = [62, 65, 69, 74][k]; brass(m, at(T.headUp + k * 0.5), 1.2, 0.15 + k * 0.03, true); });
    for (let s = T.headUp; s < T.reveal; s += 0.25) taiko(at(s), 0.1 + (s - T.headUp) / (T.reveal - T.headUp) * 0.3, 80);
    A.choir([293.7, 349.2, 440, 587.3], 5.5, 0.9);
    taiko(at(T.reveal), 1, 66); taiko(at(T.reveal) + 0.01, 0.7, 49); cymbal(at(T.reveal), 0.22, 4);             // the face
    [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65]].forEach((c, k) => strings(c, at(T.reveal + k * 1.5), 2, 0.34, 0.3, 2400));
    [74, 77, 76, 74, 72, 70, 69, 74].forEach((m, k) => brass(m, at(T.reveal + 0.2 + k * 0.38), 0.55, 0.2, true));
    const B = 0.25; for (let s = T.reveal + 1.2; s < T.end - 0.3; s += B) { const k = Math.round((s - T.reveal) / B); cello([50, 57, 62, 57][k % 4], at(s), B * 0.8, 0.14); if (k % 2 === 0) taiko(at(s), 0.26, 100); }
    taiko(at(T.end), 1.1, 62); taiko(at(T.end) + 0.015, 0.8, 44); cymbal(at(T.end), 0.24, 3);
  });
  A.thunder = safe(function (lvl, crack) {        // thunder: a bright crack (if close), a long rolling rumble and a wash of low noise
    lvl = lvl || 0.7; const t = now(), n = noise(true), lp = ctx.createBiquadFilter(), g = ctx.createGain(), o = osc('sine', 52, t, t + 3.2), og = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(crack ? 1800 : 600, t); lp.frequency.exponentialRampToValueAtTime(110, t + 2.8); sweepEnv(g, t, 0.02, 0.5, 2.4, lvl * 0.9); n.connect(lp); lp.connect(g); out(g, 0.35); n.start(t); n.stop(t + 3);
    o.frequency.exponentialRampToValueAtTime(30, t + 2.4); env(og, t + 0.05, 0.05, 2.6, lvl * 0.7); o.connect(og); out(og, 0.5);
    if (crack) { const c = noise(), hp = ctx.createBiquadFilter(), cg = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 2400; env(cg, t, 0.001, 0.14, lvl * 0.8); c.connect(hp); hp.connect(cg); out(cg, 0.2); c.start(t); c.stop(t + 0.3); }
  });
  A.plasmaCharge = safe(function (dur) {          // an electric whine climbing, with a crackling hiss
    dur = dur || 1.4; const t = now(), o = osc('sawtooth', 120, t, t + dur + 0.1), o2 = osc('sine', 240, t, t + dur + 0.1), g = ctx.createGain(), bp = ctx.createBiquadFilter(), n = noise(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(1800, t + dur); o2.frequency.exponentialRampToValueAtTime(3600, t + dur); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08); o.connect(bp); o2.connect(bp); bp.connect(g); out(g, 0.3);
    hp.type = 'highpass'; hp.frequency.value = 4200; ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.2, t + dur); ng.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08); n.connect(hp); hp.connect(ng); out(ng, 0.3); n.start(t); n.stop(t + dur + 0.2);
  });
  /* ---- sound effects ---- */
  A.rumble = safe(function (dur, lvl) {           // the ground shaking: sub tones, a tremor and filtered rock noise
    dur = dur || 3; lvl = lvl || 0.7; const t = now(), o = osc('sine', 34, t, t + dur + 0.2), o2 = osc('sine', 47, t, t + dur + 0.2), g = ctx.createGain(), tr = ctx.createOscillator(), tg = ctx.createGain(), n = noise(true), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    tr.frequency.value = 9; tg.gain.value = 0.35; tr.connect(tg); tg.connect(g.gain); tr.start(t); tr.stop(t + dur + 0.2); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(lvl, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(g); o2.connect(g); out(g, 0.3);
    lp.type = 'lowpass'; lp.frequency.value = 220; ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(lvl * 0.9, t + dur * 0.6); ng.gain.linearRampToValueAtTime(0.0001, t + dur); n.connect(lp); lp.connect(ng); out(ng, 0.2); n.start(t); n.stop(t + dur + 0.2);
  });
  A.stoneCrack = safe(function () {               // masonry splitting: a sharp crack, a grinding scrape and falling gravel
    const t = now(); [[1800, 0.7], [700, 0.9], [260, 1]].forEach(([f, l], i) => { const n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.4; env(g, t + i * 0.012, 0.002, 0.18 + i * 0.12, 0.5 * l); n.connect(bp); bp.connect(g); out(g, 0.3); n.start(t); n.stop(t + 0.8); });
    const sc = noise(true), lp = ctx.createBiquadFilter(), sg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(160, t + 1.6); sweepEnv(sg, t, 0.05, 0.3, 1.3, 0.45); sc.connect(lp); lp.connect(sg); out(sg, 0.4); sc.start(t); sc.stop(t + 1.9);
  });
  A.debris = safe(function (dur, lvl) {           // rocks and rubble pattering down
    dur = dur || 3; lvl = lvl || 0.5; const t = now(); for (let i = 0; i < Math.round(dur * 16); i++) { const at = t + Math.pow(Math.random(), 0.7) * dur, n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 250 + Math.random() * 2400; bp.Q.value = 2 + Math.random() * 4; env(g, at, 0.001, 0.05 + Math.random() * 0.12, lvl * (0.2 + Math.random() * 0.8) * (1 - (at - t) / dur * 0.6)); n.connect(bp); bp.connect(g); out(g, 0.3); n.start(at); n.stop(at + 0.25); }
    A.thud(0.5);
  });
  A.boom = safe(function (lvl) { lvl = lvl || 1; const t = now(), o = osc('sine', 80, t, t + 3.5), g = ctx.createGain(); o.frequency.exponentialRampToValueAtTime(26, t + 1.6); env(g, t, 0.006, 3, lvl); o.connect(g); out(g, 0.6); const n = noise(), lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 600; env(ng, t, 0.003, 0.7, lvl * 0.6); n.connect(lp); lp.connect(ng); out(ng, 0.5); n.start(t); n.stop(t + 1); });
  A.odmFire = safe(function () {                  // grapple launch: a gas "tsh", then the wire singing taut
    const t = now(), n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 3200; env(g, t, 0.003, 0.16, 0.5); n.connect(hp); hp.connect(g); out(g, 0.25); n.start(t); n.stop(t + 0.3);
    const o = osc('sawtooth', 900, t + 0.04, t + 0.5), og = ctx.createGain(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = 1800; o.frequency.exponentialRampToValueAtTime(2600, t + 0.4); env(og, t + 0.04, 0.005, 0.3, 0.12); o.connect(bp); bp.connect(og); out(og, 0.3);
    const th = osc('triangle', 180, t + 0.3, t + 0.9), tg = ctx.createGain(); th.frequency.exponentialRampToValueAtTime(70, t + 0.7); env(tg, t + 0.3, 0.002, 0.4, 0.3); th.connect(tg); out(tg, 0.2);   // the hook biting stone
  });
  A.odmReel = safe(function (dur) {               // wire reeling in: a whirring ratchet over a hiss of gas, passing by
    dur = dur || 1.6; const t = now(), o = osc('sawtooth', 120, t, t + dur), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), bp = ctx.createBiquadFilter(), n = noise(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    o.frequency.linearRampToValueAtTime(320, t + dur * 0.5); o.frequency.linearRampToValueAtTime(190, t + dur); lfo.frequency.value = 38; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + dur); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
    g.gain.value = 0.5; const pk = ctx.createGain(); sweepEnv(pk, t, dur * 0.35, dur * 0.1, dur * 0.55, 0.18); o.connect(bp); bp.connect(g); g.connect(pk); out(pk, 0.2);
    hp.type = 'highpass'; hp.frequency.value = 2600; sweepEnv(ng, t, dur * 0.3, 0.1, dur * 0.6, 0.2); n.connect(hp); hp.connect(ng); out(ng, 0.25); n.start(t); n.stop(t + dur + 0.1);
  });
  A.titanRoar = safe(function (dur) {             // a vast, hoarse bellow: low saws through a sweeping vowel filter, torn with noise
    dur = dur || 3.2; const t = now(), mix = ctx.createGain(), g = ctx.createGain();
    [55, 55.7, 110, 82.5].forEach((f, i) => { const o = osc('sawtooth', f, t, t + dur + 0.3); o.frequency.setValueAtTime(f * 1.25, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + dur); o.connect(mix); });
    const n = noise(true), nb = ctx.createBiquadFilter(), ng = ctx.createGain(); nb.type = 'bandpass'; nb.frequency.value = 700; nb.Q.value = 0.6; ng.gain.value = 0.9; n.connect(nb); nb.connect(ng); ng.connect(mix); n.start(t); n.stop(t + dur + 0.3);
    [[320, 1, 5], [900, 0.8, 6], [2200, 0.3, 8]].forEach(([fr, gn, q]) => { const bp = ctx.createBiquadFilter(), fg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(fr * 0.7, t); bp.frequency.linearRampToValueAtTime(fr * 1.3, t + dur * 0.35); bp.frequency.linearRampToValueAtTime(fr * 0.6, t + dur); bp.Q.value = q; fg.gain.value = gn; mix.connect(bp); bp.connect(fg); fg.connect(g); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.35); g.gain.setValueAtTime(0.9, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); out(g, 0.5);
  });
  A.gust = safe(function (dur) { dur = dur || 2; const t = now(), n = noise(true), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1600, t + dur * 0.5); bp.frequency.exponentialRampToValueAtTime(400, t + dur); sweepEnv(g, t, dur * 0.4, 0.1, dur * 0.5, 0.35); n.connect(bp); bp.connect(g); out(g, 0.3); n.start(t); n.stop(t + dur + 0.1); });
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);

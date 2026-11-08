// Runs every v0.5 audio function against a permissive fake AudioContext to catch typos and bad arguments (safe() would otherwise swallow them).
const warns = []; const cw = console.warn; console.warn = (...a) => { warns.push(a.join(' ')); };
const node = () => new Proxy(function () {}, { get: (t, k) => k === 'value' ? 0 : k === 'then' ? undefined : (k === 'getChannelData' ? () => new Float32Array(64) : node()), set: () => true, apply: () => node() });
const ctx = new Proxy({ currentTime: 1, sampleRate: 44100, state: 'running', destination: node() }, { get: (t, k) => k in t ? t[k] : (k === 'createBuffer' ? () => ({ getChannelData: () => new Float32Array(64) }) : () => node()) });
global.window = global; global.AudioContext = function () { return ctx; }; global.STORY = {}; global.localStorage = { getItem: () => null, setItem() {} };
const A = require('../js/story/audio.js'); let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
ok(A.init() === true, 'init'); const T = { rumble: 0.5, ball: 1.2, strike: 2.6, grab: 3.7, headUp: 4.7, reveal: 6.5, end: 9.4 };
const calls = [['introScore', [T]], ['rumble', [3, 0.7]], ['stoneCrack', []], ['debris', [3, 0.5]], ['boom', [1]], ['odmFire', []], ['odmReel', [1.6]], ['titanRoar', [3]], ['thunder', [1, true]], ['thunder', [0.5]], ['plasmaCharge', [1.4]], ['gust', [2]], ['logoSting', []], ['stampHit', []], ['riser', [3]], ['steam', [2]], ['drone', [5]], ['choir', []], ['menuTick', []], ['heartbeat', []], ['whoosh', [1]], ['lightning', []]];
for (const [fn, args] of calls) { warns.length = 0; try { A[fn].apply(A, args); } catch (e) { ok(false, fn + ' threw ' + e.message); } ok(warns.length === 0, fn + ' warned: ' + warns[0]); }
warns.length = 0; A.music('title'); ok(warns.length === 0, 'titleScore warned: ' + warns[0]); A.stopMusic(); A.setVolume('vol', 0.5); A.setMuted(true); A.setMuted(false);
console.warn = cw; console.log('audio_new test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

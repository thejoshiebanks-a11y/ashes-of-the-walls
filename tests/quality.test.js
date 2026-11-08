// Phase 1 tests: tiers, probe, adaptive controller, monitor. Runs in plain node with a fake engine.
global.window = global; global.navigator = { userAgent: 'iPhone Mobi', hardwareConcurrency: 6, deviceMemory: undefined }; global.screen = { width: 844, height: 390 };
global.innerWidth = 844; global.devicePixelRatio = 3; global.location = { search: '' }; const mem = {}; global.localStorage = { getItem: k => mem[k] || null, setItem: (k, v) => mem[k] = v, removeItem: k => delete mem[k] };
global.document = { addEventListener() { } }; global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail } }; window.dispatchEvent = () => { }; global.performance = { now: (() => { let t = 0; return () => (t += 16) })() };
require('../js/quality.js'); let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)) };
const gl = { MAX_TEXTURE_SIZE: 1, MAX_SAMPLES: 2, getParameter: p => p === 1 ? 8192 : 4, getExtension: () => null };
const glSw = { MAX_TEXTURE_SIZE: 1, MAX_SAMPLES: 2, getParameter: p => p === 1 ? 8192 : p === 77 ? 'SwiftShader' : 4, getExtension: e => e === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 77 } : null };
const mk = () => ({ gl, canvas: { width: 800, height: 400 }, mobile: true, scale: 1, dpr: 3, lodScale: 1, setShadowSize(s) { this.sh = s }, sm: [{ S: 1024 }] });
const G = window.GFX; ok(G.ORDER.length === 4 && G.TIERS.low.shadowPx < G.TIERS.ultra.shadowPx && G.TIERS.low.cascades === 1, 'tier table');
ok(G.probe(glSw).score <= 1, 'software renderer is capped');
ok(G.tierFromScore(9) === 'ultra' && G.tierFromScore(7) === 'high' && G.tierFromScore(4) === 'medium' && G.tierFromScore(1) === 'low', 'score to tier');
const E = mk(); G.init(E); ok(G.ORDER.includes(G.tier), 'init picks a tier'); ok(E.dpr <= G.TIERS[G.tier].dprCap, 'dpr capped'); ok(E.sh === G.TIERS[G.tier].shadowPx, 'shadow size applied');
G.set('low'); ok(E.cascades === 1 && E.sh === 1024 && !G.auto && mem['aow.gfx'] === 'low', 'low tier: one cascade, 1024, saved'); ok(G.wantAA() === false, 'low turns MSAA off at next boot');
G.set('high'); ok(E.cascades === 2 && E.sh === 3072, 'high tier'); G.set('auto'); ok(G.auto && !mem['aow.gfx'], 'auto clears the saved choice');
// adaptive: GPU-bound slowness (frame time falls as the picture shrinks) -> scale falls to the floor, then the tier drops (auto)
G.set('high'); G.auto = true; G.hold = 0; const t0 = G.scale; for (let i = 0; i < 1500; i++) G.update(0.02 + 0.03 * G.scale * G.scale); ok(G.scale >= G.TIERS[G.tier].scaleMin - 1e-9, 'never below the floor'); ok(G.tier !== 'high', 'sustained slowness at the floor drops the tier ' + G.tier);
// a system frame-rate cap (30 Hz low-power): shrinking changes nothing, so resolution is restored and the tier is kept
G.set('high'); G.auto = true; G.hold = 0; G.scale = 1; G.E.scale = 1; for (let i = 0; i < 1500; i++) G.update(0.0333); ok(G.tier === 'high' && G.scale >= 0.85 && G.mon.capped, 'cap detected, tier kept, scale ' + G.scale.toFixed(2));
// headroom: fast frames at 8ms raise scale back, but explicit choice never changes tier
G.set('medium'); G.hold = 0; G.scale = 0.6; E.scale = 0.6; for (let i = 0; i < 1200; i++) G.update(0.0167 * 0.5); ok(G.scale > 0.6, 'headroom raises scale'); ok(G.tier === 'medium', 'explicit tier is never auto-changed');
window.__lockScale = true; G.hold = 0; G.scale = 0.6; for (let i = 0; i < 40; i++) G.update(0.0167); ok(G.scale >= 0.9, 'cinematic lock keeps scale >= 0.9'); window.__lockScale = false;
// monitor: ignores pauses, reports percentiles
const M = new (G.mon.constructor)(); for (let i = 0; i < 100; i++) M.push(i < 90 ? 16 : 40); M.push(900); const s = M.stats(); ok(s && s.n === 100 && s.p99 >= 40 && s.med === 16, 'monitor percentiles, pause ignored');
ok(JSON.parse(G.report()).tier === G.tier, 'report is valid JSON'); G.off(); ok(E.scale === 1, 'off() restores');
console.log('quality test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

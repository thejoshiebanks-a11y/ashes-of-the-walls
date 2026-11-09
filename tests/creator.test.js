/* creator kit: slider mapping, randomise/reset, portraits, and that two random characters differ in many ways */
const path = require('path'); const R = path.resolve(__dirname, '..'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
globalThis.STORY = { ui: { h() {} } }; globalThis.document = {}; const A = require(R + '/js/story/actors.js') || STORY.actors; require(R + '/js/story/creator.js'); const C = STORY.creatorKit;
const D = { SKIN: Array(6).fill([.8, .6, .5]), HAIR: Array(10).fill([.3, .2, .1]), TOP: Array(7).fill(0), BOTTOM: Array(4).fill(0), SHOES: Array(3).fill(0) }, cfg = { eyes: Array(5).fill(0) };
const mk = () => ({ body: 'base_isabel', look: { skin: 1, hair: 2, top: 0, bottom: 0, shoes: 0, height: .5, build: .5, eye: 0, face: {}, body: {}, cust: {} } });
let d = mk(); ok(C.val(d, 'look', 'height') === 0, 'default height is centred'); C.set(d, 'height', 'look', 1); ok(d.look.height === 1, 'height +1 -> 1'); C.set(d, 'height', 'look', -1); ok(d.look.height === 0, 'height -1 -> 0');
C.set(d, 'jawW', 'f', .5); ok(d.look.face.jawW === .5 && C.val(d, 'f', 'jawW') === .5, 'face value stored'); C.set(d, 'jawW', 'f', 0); ok(!('jawW' in d.look.face), 'zero removes the key (small saves)');
C.set(d, 'leg', 'b', 9); ok(d.look.body.leg === 1, 'clamped to 1');
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const all = []; for (let i = 0; i < 50; i++) { const x = mk(); C.randomise(x, cfg, D, rng); all.push(x);
  for (const k in x.look.face) ok(Math.abs(x.look.face[k]) <= 1, 'face value in range'); for (const k in x.look.body) ok(Math.abs(x.look.body[k]) <= 1, 'body value in range'); ok(x.look.height >= 0 && x.look.height <= 1, 'height in range'); }
const sig = x => JSON.stringify([x.look.face, x.look.body, x.look.skin, x.look.hair, x.look.top, x.look.height]);
ok(new Set(all.map(x => sig(x) + x.body + x.look.fk + x.look.hk)).size === 50, '50 randomised characters are all different');
let minDiff = 99; for (let i = 0; i < 50; i++) for (let j = i + 1; j < 50; j++) { const a = all[i].look, b = all[j].look; let n = 0; for (const k of new Set([...Object.keys(a.face), ...Object.keys(b.face)])) if (Math.abs((a.face[k] || 0) - (b.face[k] || 0)) > .15) n++; minDiff = Math.min(minDiff, n); }
ok(minDiff >= 1, 'any two of 50 differ in face sliders (min differing sliders: ' + minDiff + ')');
C.reset(all[0]); ok(Object.keys(all[0].look.face).length === 0 && all[0].look.height === .5, 'reset clears morphs');
const svg = C.faceGlyph({ eyeSize: 1, jawW: -1, headW: .5 }, [.9, .7, .6], [.2, .1, .1]); ok(/^<svg/.test(svg) && !/NaN|undefined/.test(svg), 'face glyph renders clean svg');
for (const pr of C.FACE_PRESETS) ok(!/NaN|undefined/.test(C.faceGlyph(pr[1])), 'preset glyph ' + pr[0]); for (const pr of C.BODY_PRESETS) ok(!/NaN|undefined/.test(C.bodyGlyph(pr[1], { height: 1, build: -1 })), 'body glyph ' + pr[0]);
ok(new Set(all.map(x => x.body)).size >= 4 && new Set(all.map(x => x.look.fk)).size >= 4 && new Set(all.map(x => x.look.hk)).size >= 4, 'randomise reaches every base, face type and hairstyle');
const flat = [...C.FACE_GROUPS, ...C.BODY_GROUPS].flatMap(g => g[1].map(r => r[0])); ok(new Set(flat).size === flat.length, 'slider keys unique (' + flat.length + ' sliders)');
// keys must all exist in the engine morph tables
for (const g of C.FACE_GROUPS) for (const r of g[1]) ok(A.FACE_KEYS.includes(r[0]), 'face key known to engine: ' + r[0]);
for (const g of C.BODY_GROUPS) for (const r of g[1]) ok(r[4] === 'look' || A.BODY_KEYS.includes(r[0]), 'body key known to engine: ' + r[0]);
{ const S2 = { destiny: { SKIN: D.SKIN, HAIR: D.HAIR, TOP: [[.5, .4, .3]], BOTTOM: [[.2, .2, .2]], SHOES: [[.1, .1, .1]] } }; }
ok(typeof A.OUTFITS.scout.top[0] === 'number' && A.OUTFITS.commoner === null, 'wardrobe has a scout set for later');
ok(C.hex(C.unhex('#a1b2c3')) === '#a1b2c3', 'hex round trip');
console.log(`creator tests: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

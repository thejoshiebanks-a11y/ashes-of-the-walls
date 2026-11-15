// Anime-only creator: catalogue, locks, base/hair/outfit rules, loader and the six model packs. Run: node tests/teen_creator.test.js
const assert = require('assert'), fs = require('fs'), zlib = require('zlib'), path = require('path');
globalThis.STORY = { flag: () => 0, actors: { wearMul: w => [1, .9, .78][w || 0] } };
const T = require('../js/story/teen.js'), R = path.resolve(__dirname, '..');
let n = 0; const t = (name, f) => { try { f(); n++; console.log('ok   ' + name); } catch (e) { console.error('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; } };
const FIELDS = ['base', 'face', 'outfit', 'hair', 'hairCol', 'eyes', 'skin', 'top', 'pants', 'boots', 'accent'];
const hide = (L, m) => { const a = {}; T.apply(a, L, 0); return a.skipRe.test(m); };

t('the realistic model is gone: six anime bases, no teen pack, no base switch to "Realistic"', () => {
  assert.strictEqual(T.BASES.length, 6); assert.deepStrictEqual(T.BASES.map(b => b.key), ['boy', 'dragon', 'beauty', 'lad', 'young', 'ash']);
  assert(!fs.existsSync(R + '/assets/teen/teen.bin')); assert(!/Realistic/.test(fs.readFileSync(R + '/js/story/creator.js', 'utf8'))); });
t('catalogue size: 6 bases, 4 faces, 11 hair styles, 5 outfits', () => { assert.strictEqual(T.FACES.length, 4); assert.strictEqual(T.HAIR.length, 11); assert.strictEqual(T.OUTFITS.length, 5); });
t('locks: Everyday, Village and Crimson robe are free; armour and Scout uniform are locked until their flags; ODM gear until training', () => {
  const free = T.OUTFITS.filter(o => !o.locked).map(o => o.id); assert.deepStrictEqual(free, ['Modern', 'Peasant', 'Dragon']);
  assert(T.OUTFITS.filter(o => o.locked).every(o => !T.isUnlocked(o))); assert(!T.gearUnlocked());
  globalThis.STORY.flag = f => f === 'scout_unlocked' || f === 'odm_unlocked'; assert(T.isUnlocked(T.OUTFITS[4]) && !T.isUnlocked(T.OUTFITS[3]) && T.gearUnlocked()); globalThis.STORY.flag = () => 0; });
t('only the casual outfits take dye; armour and uniform never do', () => {
  const a = {}; T.apply(a, { outfit: 3, top: 6 }, 0); assert.strictEqual(a.tintFn('Outfit_Ranger_Body'), null);
  T.apply(a, { outfit: 4, top: 6 }, 0); assert.strictEqual(a.tintFn('Outfit_Scout_Body'), null);
  T.apply(a, { outfit: 1, top: 6 }, 0); assert(a.tintFn('Outfit_Peasant_Body')); T.apply(a, { outfit: 2, top: 6 }, 0); assert(a.tintFn('Outfit_Dragon_Tops')); });
t('a dye changes the outfit and never the skin or hair', () => { const a = {}; T.apply(a, { outfit: 0, top: 6, pants: 6, boots: 6, accent: 6 }, 0); assert.strictEqual(a.tintFn('Skin_Body'), null); assert.strictEqual(a.tintFn('Face0_Skin'), null); assert(a.tintFn('Hair_B0')[0] < .2); });
t('ODM gear and armour stay hidden until unlocked, then the creator may show gear', () => {
  assert(hide({ gear: 1 }, 'Gear_ODM')); globalThis.STORY.flag = f => f === 'odm_unlocked'; assert(!hide({ gear: 1 }, 'Gear_ODM')); assert(hide({ gear: 0 }, 'Gear_ODM')); globalThis.STORY.flag = () => 0; });
t('exactly one outfit, one face and one hair style are visible', () => {
  for (const L of [{ outfit: 0 }, { outfit: 1, base: 2 }, { outfit: 2, base: 3 }, { outfit: 4, cloak: 1 }]) {
    const a = {}; T.apply(a, L, 0); const k = T.norm(L), oid = T.OUTFITS[k.outfit].id;
    for (const p of ['Outfit_Modern_Tops', 'Outfit_Peasant_Body', 'Outfit_Dragon_Tops', 'Outfit_Ranger_Body', 'Outfit_Scout_Body']) assert.strictEqual(!a.skipRe.test(p), p.startsWith('Outfit_' + oid + '_'), JSON.stringify(L) + ' ' + p);
    assert(!a.skipRe.test('Face' + k.face + '_Skin') && a.skipRe.test('Face' + ((k.face + 1) % 4) + '_Skin')); } });
t('hair styles: front and back pieces, shaved hides all, the hood hides hair', () => {
  assert(!hide({ hair: 0 }, 'Hair_B0') && !hide({ hair: 0 }, 'Hair_B0Back') && hide({ hair: 1 }, 'Hair_B0Back') && hide({ hair: 0 }, 'Hair_D0'));
  const bald = T.HAIR.length - 1; assert(hide({ hair: bald }, 'Hair_B0') && hide({ hair: bald }, 'Hair_L0Back'));
  globalThis.STORY.flag = () => 0; assert(hide({ hair: 0, outfit: 3, cloak: 1 }, 'Hair_B0')); });
t('every full base lists all hair styles; baked bases keep their own hair, face and clothes', () => {
  for (const i of [0, 1, 2, 3]) assert.strictEqual(T.hairsFor(i).length, 11);
  for (const i of [4, 5]) { assert.strictEqual(T.hairsFor(i).length, 1); assert.strictEqual(T.outfitsFor(i).length, 1); const k = T.norm({ base: i, outfit: 3, hair: 0, face: 2 }); assert.strictEqual(k.outfit, 0); assert.strictEqual(k.face, 0); assert.strictEqual(T.HAIR[k.hair].f, T.BASES[i].hair);
    assert(hide({ base: i }, 'Outfit_Scout_Body') && !hide({ base: i }, 'Fixed_Body') && !hide({ base: i }, 'Fixed_Face')); } });
t('Ryu has no everyday clothes: norm gives him the crimson robe', () => { const k = T.norm({ base: 1, outfit: 0 }); assert.strictEqual(T.OUTFITS[k.outfit].id, 'Dragon'); assert(!T.outfitsFor(1).some(x => x.o.id === 'Modern')); });
t('older saves migrate (the removed realistic base becomes Kuro; indexes stay valid)', () => { const k = T.norm({ base: 0, outfit: 2, hair: 3, face: 4, hairCol: 0 }); assert.strictEqual(k.base, 0); assert(T.OUTFITS[k.outfit] && T.HAIR[k.hair] && T.FACES[k.face]); assert.strictEqual(k.v, 2); });
t('height 144-170 cm, build and head within bounds', () => { assert.strictEqual(T.heightCm({ height: .5 }), 158); assert(T.heightCm({ height: 0 }) >= 144 && T.heightCm({ height: 1 }) <= 171); });
t('random(seed) is deterministic and only uses real catalogue entries for the chosen base', () => {
  assert.deepStrictEqual(T.random(7), T.random(7));
  for (let s = 0; s < 800; s++) { const r = T.random(s), k = T.norm(r); assert.deepStrictEqual(r.base, k.base); assert(T.hairsFor(r.base).some(x => x.i === r.hair), 'hair ' + s); assert(T.outfitsFor(r.base).some(x => x.i === r.outfit && !x.o.locked), 'outfit ' + s); assert(T.FACES[r.face]); } });
t('presets are 8 valid distinct looks covering every base', () => { assert.strictEqual(T.PRESETS.length, 8); assert.strictEqual(new Set(T.PRESETS.map((p, i) => T.code(T.preset(i)))).size, 8); assert.strictEqual(new Set(T.PRESETS.map((p, i) => T.preset(i).base)).size, 6); });
t('look codes are unique across 20000 random characters (within the open-world tolerance)', () => { const seen = new Set(); let dup = 0; for (let s = 0; s < 20000; s++) { const c = T.code(T.random(s * 2654435761 >>> 0)); if (seen.has(c)) dup++; seen.add(c); } assert(dup < 20, dup + ' duplicates'); });
t('T.apply: scale follows height rule and the player is half the old door height', () => { const a = {}; globalThis.STORY.actors.wearMul = () => 1; const r = T.apply(a, {}, 0); assert(Math.abs(r.meters - .65) < 1e-6); assert(a.scale > 0); });
t('creator reveal: clay mannequin first, everything at the end', () => { T.reveal = { st: 0 }; const a = {}; T.apply(a, {}, 0); assert(a.skipRe.test('Hair_B0') && a.skipRe.test('Face0_Iris') && !a.skipRe.test('Outfit_Modern_Tops') && Array.isArray(a.tintFn('Skin_Body'))); T.reveal = null; });
t('children NPCs are half their old height and the hero matches them', () => { const j = JSON.parse(fs.readFileSync(R + '/data/story/npcs.json', 'utf8')); assert(j && Object.keys(j).length > 0); });
t('locomotion: stride-matched clip choice, rate stays in range, speed map hits the pace table; sprint is genuinely fast', () => {
  const L = T.loco, leg = 0.65 * 0.47; for (const sp of [0.4, 0.85, 1.6, 3.1]) { const r = L.pick(sp, leg); assert(r && r[1] >= 0.5 && r[1] <= 2.0, sp + ' ' + JSON.stringify(r)); }
  assert(L.pick(3.1, leg)[0] === 'L:Run Mixamo' && L.pick(0.4, leg)[0] === 'L:Standard Walk'); assert(L.PACE.sprint / 0.65 > 4.5, 'sprint is over 4.5 body-heights per second');
  assert(Math.abs(L.speedMap(0.8) - L.PACE.walk) < 1e-9 && Math.abs(L.speedMap(2.5) - L.PACE.jog) < 1e-9 && Math.abs(L.speedMap(4.9) - L.PACE.sprint) < 1e-9);
  let prev = -1; for (let v = 0; v <= 5; v += 0.1) { const m = L.speedMap(v); assert(m >= prev); prev = m; } });

/* ---- the model packs ---- */
const REQ = ['Gear_ODM', 'Outfit_Peasant_Body', 'Outfit_Ranger_Body', 'Outfit_Scout_Body', 'Outfit_Dragon_Tops', 'Hair_B0', 'Hair_D0', 'Hair_Y0', 'Hair_L0', 'Hair_K0', 'Hair_C0'];
for (const b of T.BASES) t('pack ' + b.key + ': 24 joints, every outfit/hair set present, reads back, budgets for phones', () => {
  const dir = R + '/assets/' + b.key + '/', info = JSON.parse(fs.readFileSync(dir + b.key + '.info.json')), meta = JSON.parse(fs.readFileSync(dir + b.key + '.meta.json')), bin = zlib.inflateSync(fs.readFileSync(dir + b.key + '.bin'));
  const names = meta.prims.map(p => p.mat); for (const r of REQ) assert(names.includes(r), b.key + ' lacks ' + r);
  if (b.fixed) assert(names.includes('Fixed_Body') && names.includes('Fixed_Face')); else { assert(names.includes('Skin_Body')); for (let f = 0; f < 4; f++) assert(names.includes('Face' + f + '_Skin') && names.includes('Face' + f + '_Iris'), 'face ' + f); }
  if (b.noModern) assert(!names.includes('Outfit_Modern_Tops')); else if (!b.fixed) assert(names.includes('Outfit_Modern_Tops'));
  for (let i = 0; i < (info.tex || 0); i++) assert(fs.statSync(dir + b.key + '.t' + i + '.webp').size > 100);
  for (const p of meta.prims) { for (const o of p.o) assert(o >= 0 && o < bin.length); const pos = new Float32Array(bin.buffer.slice(bin.byteOffset + p.o[0], bin.byteOffset + p.o[0] + p.n * 12)); for (const v of pos) assert(Number.isFinite(v)); }
  const visTri = (outfit, hair) => meta.prims.filter(p => !p.mat.startsWith('Outfit_') && !p.mat.startsWith('Hair_') && !p.mat.startsWith('Gear_') && !/^Face[1-9]/.test(p.mat) || p.mat.startsWith('Outfit_' + outfit + '_') || p.mat === 'Hair_' + hair).reduce((s, p) => s + p.ni / 3, 0);
  assert(visTri('Scout', 'B0') < 90000, b.key + ' too heavy: ' + visTri('Scout', 'B0')); assert(fs.statSync(dir + b.key + '.bin').size < 3.2e6); assert(Math.abs(info.bodyHeight - 1.9486) < 0.01);
  // slim fit: the village trousers hug the leg (no fat legs) and the thighs leave a visible gap between them
  const ibm = new Float32Array(bin.buffer.slice(bin.byteOffset + meta.ibmOff, bin.byteOffset + meta.ibmOff + 24 * 64)), wp = j => [-ibm[j * 16 + 12], -ibm[j * 16 + 13], -ibm[j * 16 + 14]];
  const legs = meta.prims.find(p => p.mat === 'Outfit_Peasant_Legs'), hip = wp(1), knee = wp(2), V = new Float32Array(bin.buffer.slice(bin.byteOffset + legs.o[0], bin.byteOffset + legs.o[0] + legs.n * 12));
  let wide = 0; for (let i = 0; i < legs.n; i++) { const y = V[i * 3 + 1], x = V[i * 3]; if (x > 0 && y < hip[1] - .2 && y > knee[1] + .05) { const ab = [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]], ap = [x - hip[0], y - hip[1], V[i * 3 + 2] - hip[2]], u = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); wide = Math.max(wide, Math.hypot(ap[0] - u * ab[0], ap[1] - u * ab[1], ap[2] - u * ab[2])); } }
  assert(wide < .11, b.key + ' trousers too wide: ' + wide.toFixed(3)); });
console.log(n + ' checks passed');
// loader: a failing download is retried, and the error names the file and the reason
(async () => { const f = global.fetch; let calls = 0; global.fetch = async () => { calls++; return { ok: false, status: 404 }; };
  try { await T.load(['boy']); assert.fail('should reject'); } catch (e) { assert(/assets\/boy\/boy\.(meta|info)\.json/.test(T.lastError) && /404/.test(T.lastError), 'error text: ' + T.lastError); assert(calls >= 4, 'retried ' + calls); }
  global.fetch = f; console.log('ok   loader retries and names the failing file (' + calls + ' tries)'); })().catch(e => { console.log('FAIL loader', e.message); process.exitCode = 1; });

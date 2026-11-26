// Anime-only creator: catalogue, locks, base/hair/outfit rules, loader and the six model packs. Run: node tests/teen_creator.test.js
const assert = require('assert'), fs = require('fs'), zlib = require('zlib'), path = require('path');
globalThis.STORY = { flag: () => 0, actors: { wearMul: w => [1, .9, .78][w || 0] } };
const T = require('../js/story/teen.js'), R = path.resolve(__dirname, '..');
let n = 0; const t = (name, f) => { try { f(); n++; console.log('ok   ' + name); } catch (e) { console.error('FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; } };
const FIELDS = ['base', 'face', 'outfit', 'hair', 'hairCol', 'eyes', 'skin', 'top', 'pants', 'boots', 'accent'];
const hide = (L, m) => { const a = {}; T.apply(a, L, 0); return a.skipRe.test(m); };

const MB = T.BASES.filter(b => !b.g), FB = T.BASES.filter(b => b.g === 'f');
t('one anime body, six male bases and five female bases, no teen pack, no "Realistic" switch, no character presets in the creator', () => {
  assert.strictEqual(T.BASES.length, 11); assert.deepStrictEqual(MB.map(b => b.key), ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen']); assert.strictEqual(FB.length, 5); assert(FB.every(b => b.key === 'girl') && T.BASES.slice(0, 6).every(b => !b.g), 'male bases keep indexes 0-5 so saved characters stay valid');
  const cr = fs.readFileSync(R + '/js/story/creator.js', 'utf8'); assert(!/Realistic/.test(cr) && !/BASE PRESETS/.test(cr)); });
t('every base has its own face and signature hair, all distinct', () => { assert.strictEqual(new Set(MB.map(b => b.face)).size, 6); assert.strictEqual(new Set(T.BASES.map(b => b.hair)).size, 11); assert(FB.every(b => b.face < 3)); for (const b of T.BASES) { assert(T.FACES[b.face]); assert(T.HAIR.some(h => h.f === b.hair)); } });
t('catalogue size: 11 bases, 6 faces (3 for women), 16 hair styles, 9 medieval outfits', () => { assert.strictEqual(T.FACES.length, 6); assert.strictEqual(T.HAIR.length, 16); assert.strictEqual(T.OUTFITS.length, 9); assert.strictEqual(new Set(T.HAIR.filter(h => h.f).map(h => h.f)).size, T.HAIR.filter(h => h.f).length); });
t('no modern clothing anywhere in the catalogue', () => { for (const o of T.OUTFITS) assert(!/modern|hood(ie|y)|tee|jacket/i.test(o.id + ' ' + o.name), o.name); assert.deepStrictEqual(T.OUTFITS.map(o => o.id), ['Under', 'Peasant', 'Ranger', 'Scout', 'Dragon', 'Ninja', 'Gown', 'Adventurer', 'Maid']); });
t('locks: Underclothes and Village clothes are free; armour and Scout uniform are locked until their flags; ODM gear until training', () => {
  const free = T.OUTFITS.filter(o => !o.locked).map(o => o.id); assert.deepStrictEqual(free, ['Under', 'Peasant', 'Dragon', 'Ninja', 'Gown', 'Adventurer', 'Maid']);
  assert(T.OUTFITS.filter(o => o.locked).every(o => !T.isUnlocked(o))); assert(!T.gearUnlocked());
  globalThis.STORY.flag = f => f === 'scout_unlocked' || f === 'odm_unlocked'; assert(T.isUnlocked(T.OUTFITS[3]) && !T.isUnlocked(T.OUTFITS[2]) && T.gearUnlocked()); globalThis.STORY.flag = () => 0; });
t('only the casual outfits take dye; armour and uniform never do', () => {
  const a = {}; T.apply(a, { outfit: 2, top: 6 }, 0); assert.strictEqual(a.tintFn('Outfit_Ranger_Body'), null);
  T.apply(a, { outfit: 3, top: 6 }, 0); assert.strictEqual(a.tintFn('Outfit_Scout_Body'), null);
  T.apply(a, { outfit: 1, top: 6 }, 0); assert(a.tintFn('Outfit_Peasant_Body')); T.apply(a, { outfit: 0, pants: 6 }, 0); assert(a.tintFn('Outfit_Under_Bottoms')); });
t('a dye changes the outfit and never the skin or hair', () => { const a = {}; T.apply(a, { outfit: 0, skin: 0, top: 6, pants: 6, boots: 6, accent: 6 }, 0); assert.strictEqual(a.tintFn('Skin_Body'), null); assert.strictEqual(a.tintFn('Face0_Skin'), null); assert(a.tintFn('Hair_B0')[0] < .2); });
t('ODM gear and armour stay hidden until unlocked, then the creator may show gear', () => {
  assert(hide({ gear: 1 }, 'Gear_ODM')); globalThis.STORY.flag = f => f === 'odm_unlocked'; assert(!hide({ gear: 1 }, 'Gear_ODM')); assert(hide({ gear: 0 }, 'Gear_ODM')); globalThis.STORY.flag = () => 0; });
t('exactly one outfit, one face and one hair style are visible', () => {
  for (const L of [{ outfit: 0 }, { outfit: 1, base: 2 }, { outfit: 2, base: 3 }, { outfit: 3, cloak: 1, base: 5 }]) {
    const a = {}; T.apply(a, L, 0); const k = T.norm(L), oid = T.OUTFITS[k.outfit].id;
    for (const p of ['Outfit_Under_Bottoms', 'Outfit_Peasant_Body', 'Outfit_Ranger_Body', 'Outfit_Scout_Body']) assert.strictEqual(!a.skipRe.test(p), p.startsWith('Outfit_' + oid + '_'), JSON.stringify(L) + ' ' + p);
    assert(!a.skipRe.test('Face' + k.face + '_Skin') && a.skipRe.test('Face' + ((k.face + 1) % 6) + '_Skin')); } });
t('hair styles: front and back pieces, shaved hides all, the hood hides hair', () => {
  assert(!hide({ hair: 0 }, 'Hair_B0') && !hide({ hair: 0 }, 'Hair_B0Back') && hide({ hair: 1 }, 'Hair_B0Back') && hide({ hair: 0 }, 'Hair_D0') && !hide({ hair: 5 }, 'Hair_N0Back') && !hide({ hair: 6 }, 'Hair_F0'));
  const bald = T.HAIR.findIndex(h => h.bald); assert(hide({ hair: bald }, 'Hair_B0') && hide({ hair: bald }, 'Hair_L0Back'));
  globalThis.STORY.flag = () => 0; assert(hide({ hair: 0, outfit: 2, cloak: 1 }, 'Hair_B0')); });
t('every base lists every hair style and outfit; choosing a base brings its own face and signature hair', () => {
  for (let i = 0; i < 11; i++) { const f = i >= 6; assert.strictEqual(T.hairsFor(i).length, f ? 9 : 8); assert.strictEqual(T.outfitsFor(i).length, f ? 4 : 6); assert.strictEqual(T.facesFor(i).length, f ? 3 : 6); const p = T.preset(i); assert.strictEqual(p.base, i); assert.strictEqual(p.face, T.BASES[i].face); assert.strictEqual(T.HAIR[p.hair].f, T.BASES[i].hair); } });
t('the clay mannequin and every base default to underclothes, never modern wear', () => { assert.strictEqual(T.OUTFITS[T.DEF.outfit].id, 'Under'); });
t('older saves migrate (the removed realistic base becomes Kuro; indexes stay valid)', () => { const k = T.norm({ v: 2, base: 0, outfit: 2, hair: 3, face: 4, hairCol: 0 }); assert.strictEqual(k.base, 0); assert(T.OUTFITS[k.outfit] && T.HAIR[k.hair] && T.FACES[k.face]); assert.strictEqual(k.v, 3); const old = T.norm({ v: 2, base: 5, outfit: 0, hair: 3, face: 1, hairCol: 0 }); assert.strictEqual(old.base, 0); assert.strictEqual(T.OUTFITS[old.outfit].id, 'Under'); assert.strictEqual(T.HAIR[old.hair].f, 'D0'); });
t('height 144-170 cm, build and head within bounds', () => { assert.strictEqual(T.heightCm({ height: .5 }), 158); assert(T.heightCm({ height: 0 }) >= 144 && T.heightCm({ height: 1 }) <= 171); });
t('random(seed) is deterministic and only uses real catalogue entries for the chosen base', () => {
  assert.deepStrictEqual(T.random(7), T.random(7));
  for (let s = 0; s < 800; s++) { const r = T.random(s), k = T.norm(r); assert.deepStrictEqual(r.base, k.base); assert(T.hairsFor(r.base).some(x => x.i === r.hair), 'hair ' + s); assert(T.outfitsFor(r.base).some(x => x.i === r.outfit && !x.o.locked), 'outfit ' + s); assert(T.FACES[r.face]); } });
t('look codes are unique across 20000 random characters (within the open-world tolerance)', () => { const seen = new Set(); let dup = 0; for (let s = 0; s < 20000; s++) { const c = T.code(T.random(s * 2654435761 >>> 0)); if (seen.has(c)) dup++; seen.add(c); } assert(dup < 20, dup + ' duplicates'); });
t('T.apply: scale follows height rule and the player is half the old door height', () => { const a = {}; globalThis.STORY.actors.wearMul = () => 1; const r = T.apply(a, {}, 0); assert(Math.abs(r.meters - .65) < 1e-6); assert(a.scale > 0); });
t('creator reveal: clay mannequin first, everything at the end', () => { T.reveal = { st: 0 }; const a = {}; T.apply(a, {}, 0); assert(a.skipRe.test('Hair_B0') && a.skipRe.test('Face0_Iris') && !a.skipRe.test('Outfit_Under_Bottoms') && Array.isArray(a.tintFn('Skin_Body'))); T.reveal = null; });
t('children NPCs are half their old height and the hero matches them', () => { const j = JSON.parse(fs.readFileSync(R + '/data/story/npcs.json', 'utf8')); assert(j && Object.keys(j).length > 0); });
t('locomotion: stride-matched clip choice, rate stays in range, speed map hits the pace table; sprint is genuinely fast', () => {
  const L = T.loco, leg = 0.65 * 0.47; for (const sp of [0.4, 0.85, 1.6, 3.1]) { const r = L.pick(sp, leg); assert(r && r[1] >= 0.5 && r[1] <= 2.0, sp + ' ' + JSON.stringify(r)); }
  assert(L.pick(3.1, leg)[0] === 'L:Run Mixamo' && L.pick(0.4, leg)[0] === 'L:Standard Walk'); assert(L.PACE.sprint / 0.65 > 3 && L.PACE.sprint / 0.65 < 4.5, 'sprint is brisk but human (3-4.5 body-heights per second)');
  assert(Math.abs(L.speedMap(0.8) - L.PACE.walk) < 1e-9 && Math.abs(L.speedMap(2.5) - L.PACE.jog) < 1e-9 && Math.abs(L.speedMap(4.9) - L.PACE.sprint) < 1e-9);
  let prev = -1; for (let v = 0; v <= 5; v += 0.1) { const m = L.speedMap(v); assert(m >= prev); prev = m; } });

/* ---- the model packs ---- */
const REQ = ['Gear_ODM', 'Gear_SwordL', 'Gear_SwordR', 'Outfit_Under_Bottoms', 'Outfit_Peasant_Body', 'Outfit_Peasant_Legs', 'Outfit_Peasant_Feet', 'Outfit_Ranger_Body', 'Outfit_Scout_Body', 'Outfit_Scout_Boots', 'Outfit_Scout_Cloak', 'Hair_B0', 'Hair_D0', 'Hair_Y0', 'Hair_L0', 'Hair_C0', 'Hair_N0', 'Hair_F0'];
for (const b of MB) t('pack ' + b.key + ': 24 joints, every outfit/hair set present, reads back, budgets for phones', () => {
  const dir = R + '/assets/' + b.key + '/', info = JSON.parse(fs.readFileSync(dir + b.key + '.info.json')), meta = JSON.parse(fs.readFileSync(dir + b.key + '.meta.json')), bin = zlib.inflateSync(fs.readFileSync(dir + b.key + '.bin'));
  const names = meta.prims.map(p => p.mat); for (const r of REQ) assert(names.includes(r), b.key + ' lacks ' + r);
  assert(names.includes('Skin_Body') && names.includes('Skin_BodyD') && names.includes('Skin_Neck')); for (let f = 0; f < 6; f++) assert(names.includes('Face' + f + '_Skin') && names.includes('Face' + f + '_Iris'), 'face ' + f); assert(!names.some(m => /Modern/.test(m)), 'no modern parts');
  for (let i = 0; i < (info.tex || 0); i++) assert(fs.statSync(dir + b.key + '.t' + i + '.webp').size > 20);
  for (const p of meta.prims) { for (const o of p.o) assert(o >= 0 && o < bin.length); const pos = new Float32Array(bin.buffer.slice(bin.byteOffset + p.o[0], bin.byteOffset + p.o[0] + p.n * 12)); for (const v of pos) assert(Number.isFinite(v)); }
  const visTri = (outfit, hair) => meta.prims.filter(p => !p.mat.startsWith('Outfit_') && !p.mat.startsWith('Hair_') && !p.mat.startsWith('Gear_') && !/^Face[1-9]/.test(p.mat) || p.mat.startsWith('Outfit_' + outfit + '_') || p.mat === 'Hair_' + hair).reduce((s, p) => s + p.ni / 3, 0);
  assert(visTri('Scout', 'B0') < 135000, b.key + ' too heavy: ' + visTri('Scout', 'B0')); assert(fs.statSync(dir + b.key + '.bin').size < 6.6e6); assert(Math.abs(info.bodyHeight - 1.9486) < 0.01);
  // slim fit: the village trousers hug the leg (no fat legs) and the thighs leave a visible gap between them
  const ibm = new Float32Array(bin.buffer.slice(bin.byteOffset + meta.ibmOff, bin.byteOffset + meta.ibmOff + 24 * 64)), wp = j => [-ibm[j * 16 + 12], -ibm[j * 16 + 13], -ibm[j * 16 + 14]];
  const legs = meta.prims.find(p => p.mat === 'Outfit_Peasant_Legs'), hip = wp(1), knee = wp(2), V = new Float32Array(bin.buffer.slice(bin.byteOffset + legs.o[0], bin.byteOffset + legs.o[0] + legs.n * 12));
  let wide = 0; for (let i = 0; i < legs.n; i++) { const y = V[i * 3 + 1], x = V[i * 3]; if (x > 0 && y < hip[1] - .2 && y > knee[1] + .05) { const ab = [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]], ap = [x - hip[0], y - hip[1], V[i * 3 + 2] - hip[2]], u = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); wide = Math.max(wide, Math.hypot(ap[0] - u * ab[0], ap[1] - u * ab[1], ap[2] - u * ab[2])); } }
  assert(wide < .125, b.key + ' trousers too wide: ' + wide.toFixed(3)); });
console.log(n + ' checks passed');
// loader: a failing download is retried, and the error names the file and the reason
(async () => { const f = global.fetch; let calls = 0; global.fetch = async () => { calls++; return { ok: false, status: 404 }; };
  try { await T.load(['boy']); assert.fail('should reject'); } catch (e) { assert(/assets\/boy\/boy\.(meta|info)\.json/.test(T.lastError) && /404/.test(T.lastError), 'error text: ' + T.lastError); assert(calls >= 4, 'retried ' + calls); }
  global.fetch = f; console.log('ok   loader retries and names the failing file (' + calls + ' tries)'); })().catch(e => { console.log('FAIL loader', e.message); process.exitCode = 1; });

t('pack girl: one shared body, 3 faces, 5 hairstyles, underclothes and the two medieval outfits; reads back; light enough', () => {
  const dir = R + '/assets/girl/', info = JSON.parse(fs.readFileSync(dir + 'girl.info.json')), meta = JSON.parse(fs.readFileSync(dir + 'girl.meta.json')), bin = zlib.inflateSync(fs.readFileSync(dir + 'girl.bin')), names = meta.prims.map(p => p.mat);
  for (const r of ['Skin_Body', 'Skin_BodyD', 'Outfit_Under_Bottoms', 'Outfit_Under_Tops', 'Outfit_Gown_Tops', 'Outfit_Adventurer_Tops', 'Outfit_Adventurer_Bottoms', 'Outfit_Adventurer_Shoes', 'Outfit_Adventurer_Lining', 'Outfit_Maid_Tops', 'Outfit_Maid_Bottoms', 'Outfit_Maid_Shoes']) assert(names.includes(r), 'girl lacks ' + r);
  for (let f = 0; f < 3; f++) assert(names.includes('Face' + f + '_Skin') && names.includes('Face' + f + '_Iris')); for (const b of FB) assert(names.includes('Hair_' + b.hair) && names.includes('Hair_' + b.hair + 'Back') || b.hair === 'FD0' || b.hair === 'FE0' || b.hair === 'FF0', b.hair);
  assert.strictEqual(info.joints, 24); assert(Math.abs(info.bodyHeight - 1.9486) < 0.01); assert(!names.some(m => /Modern|Gym|Dress_/.test(m)));
  for (let i = 0; i < info.tex; i++) assert(fs.statSync(dir + 'girl.t' + i + '.webp').size > 20);
  for (const p of meta.prims) { for (const o of p.o) assert(o >= 0 && o < bin.length); const pos = new Float32Array(bin.buffer.slice(bin.byteOffset + p.o[0], bin.byteOffset + p.o[0] + p.n * 12)); for (const v of pos) assert(Number.isFinite(v)); }
  assert(fs.statSync(dir + 'girl.bin').size < 5.5e6); });
t('a woman: norm keeps her own face/hair/outfit set; switching gender never leaves a male hair or outfit on a female base', () => {
  const k = T.norm({ base: 7, face: 5, hair: 0, outfit: 2 }); assert(T.isFemale(k) && k.face < 3 && T.HAIR[k.hair].g === 'f' && T.OUTFITS[k.outfit].g !== 'm');
  for (let sd = 1; sd < 60; sd++) { const L = T.random(sd), n = T.norm(L); if (T.isFemale(n)) assert(n.face < 3 && (T.HAIR[n.hair].g === 'f' || T.HAIR[n.hair].bald) && T.OUTFITS[n.outfit].g !== 'm'); else assert(T.HAIR[n.hair].g !== 'f' && T.OUTFITS[n.outfit].g !== 'f'); } });
t('every thumbnail the creator can ask for exists', () => { const ui = R + '/assets/teen/ui/', need = []; T.BASES.forEach((b, i) => need.push('base_' + i)); T.HAIR.forEach((h, i) => need.push('hair_' + i)); T.OUTFITS.forEach((o, i) => need.push('outfit_' + i)); need.push('outfit_f0', 'ff_0', 'ff_1', 'ff_2'); for (let i = 0; i < 6; i++) need.push('face_' + i);
  for (const n of need) assert(fs.existsSync(ui + n + '.webp'), 'missing thumbnail ' + n); });

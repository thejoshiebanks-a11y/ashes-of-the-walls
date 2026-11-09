// v0.8 district patch integrity: new houses, landmark, gate plug, texture refs, binary layout.
const fs = require('fs'), zlib = require('zlib'); let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
const J = JSON.parse(fs.readFileSync(__dirname + '/../data/district.json')), bin = zlib.inflateSync(fs.readFileSync(__dirname + '/../assets/district.bin'));
ok(bin.length === J.vbytes + J.ibytes + J.nInst * 64, 'binary length matches header');
ok(J.vbytes === J.vc * 36 && J.ibytes === J.ic * 4, 'vertex/index counts match bytes');
for (const d of J.draws) { const g = J.geoms[d.g]; if (!g) { ok(false, 'draw has geom ' + d.g); continue; } if (d.g.startsWith('h8_') || d.g.startsWith('lm_') || d.g === 'gate_plug') { ok(g.v + g.vn <= J.vc && g.i + g.in <= J.ic, 'geom range ' + d.g); ok(g.mat >= 0 && g.mat < J.mats.length, 'mat ' + d.g); for (const c of d.chunks) ok(c.o + c.n <= J.nInst, 'chunk range ' + d.g); } }
const idx = new Uint32Array(bin.buffer, bin.byteOffset + J.vbytes, J.ic); for (const k in J.geoms) if (k.startsWith('h8_') || k.startsWith('lm_') || k === 'gate_plug') { const g = J.geoms[k]; let mx = 0; for (let i = g.i; i < g.i + g.in; i++) mx = Math.max(mx, idx[i]); ok(mx < g.vn, 'indices local ' + k); }
ok(['h8_v1_0', 'h8_v2_0', 'h8_v3_0', 'h8_v4_0'].every(k => J.geoms[k]), 'four townhouse variants');
ok(J.draws.filter(d => d.g.startsWith('lm_')).length >= 7, 'landmark has its parts');
ok(!J.draws.some(d => ['house1', 'house1b', 'house1c', 'house2', 'house3', 'house4'].includes(d.g)), 'old house types 1-4 replaced');
const hdr = fs.readFileSync(__dirname + '/../assets/textures.pack'), hl = hdr.readUInt32LE(0), TH = JSON.parse(hdr.slice(4, 4 + hl).toString());
for (const t of J.tex) ok(TH[t.file], 'texture in pack ' + t.file);
for (const m of J.mats) ok(m.tex < J.tex.length && m.norm < J.tex.length, 'material texture index ' + m.name);
console.log('district v0.8 test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);

"""Bake a glb's own animation clips into the game's clip format and append them to assets/models.pack + data/models.json.
   python3 tools/add_glb_clips.py model.glb --prefix C2: [--only roar,atk01]
Clip layout (int16): n*45 bone-pair directions (/32767, model frame de-rotated by the pelvis), n*4 pelvis quaternion w,x,y,z (/32767), n pelvis height ratio (/10000)."""
import sys, os, json, zlib, struct, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from gltf_reader import GLTF
ap = argparse.ArgumentParser(); ap.add_argument('glb'); ap.add_argument('--prefix', default='C2:'); ap.add_argument('--only', default=''); ap.add_argument('--root', default=os.path.join(os.path.dirname(__file__), '..'))
a = ap.parse_args(); R = a.root
g = GLTF(a.glb); j = g.j; nodes = j['nodes']; par = g.parents()
sk = j['skins'][0]; joints = sk['joints']
import re
nm = {n: re.sub(r'_\d+$', '', nodes[n].get('name', '')) for n in joints}
byname = {v: k for k, v in nm.items()}
mj = json.load(open(R + '/data/models.json')); pairs = mj['anims']['meta']['pairs']
def trs(n, tr=None, ro=None, sc=None):
    nd = nodes[n]
    if 'matrix' in nd and tr is None and ro is None and sc is None and not any(k in nd for k in ('translation', 'rotation', 'scale')): return np.array(nd['matrix'], float).reshape(4, 4).T
    t = tr if tr is not None else nd.get('translation', [0, 0, 0]); r = ro if ro is not None else nd.get('rotation', [0, 0, 0, 1]); s = sc if sc is not None else nd.get('scale', [1, 1, 1])
    x, y, z, w = r; M = np.eye(4)
    M[:3, :3] = np.array([[1 - 2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1 - 2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1 - 2*(x*x+y*y)]]) * np.array(s)[None, :]
    M[:3, 3] = t; return M
def worlds(over):
    cache = {}
    def w(n):
        if n in cache: return cache[n]
        o = over.get(n, {}); M = trs(n, o.get('t'), o.get('r'), o.get('s'))
        cache[n] = (w(par[n]) @ M) if n in par else M; return cache[n]
    return w
def slerp(a, b, t):
    a = np.array(a); b = np.array(b); d = a @ b
    if d < 0: b = -b; d = -d
    if d > 0.9995: r = a + (b - a) * t
    else:
        th = np.arccos(d); r = (np.sin((1 - t) * th) * a + np.sin(t * th) * b) / np.sin(th)
    return r / np.linalg.norm(r)
def sample(anim, t):
    over = {}
    for ch in anim['channels']:
        s = anim['samplers'][ch['sampler']]; ti = g.accessor(s['input']).reshape(-1); v = g.accessor(s['output'])
        n = ch['target']['node']; p = ch['target']['path']
        i = int(np.searchsorted(ti, t, side='right') - 1); i = max(0, min(i, len(ti) - 1)); i2 = min(i + 1, len(ti) - 1)
        k = 0 if i2 == i else float(np.clip((t - ti[i]) / (ti[i2] - ti[i]), 0, 1))
        val = slerp(v[i], v[i2], k) if p == 'rotation' else v[i] * (1 - k) + v[i2] * k
        over.setdefault(n, {})[{'translation': 't', 'rotation': 'r', 'scale': 's'}[p]] = val
    return over
pel = byname['Bip001 Pelvis']
w0 = worlds({}); Rrest = w0(pel)[:3, :3]; Rrest = Rrest / np.linalg.norm(Rrest, axis=0); ypel0 = w0(pel)[1, 3]
def qfrom(Rm):
    t = np.trace(Rm)
    if t > 0: s = np.sqrt(t + 1) * 2; w, x, y, z = s / 4, (Rm[2, 1] - Rm[1, 2]) / s, (Rm[0, 2] - Rm[2, 0]) / s, (Rm[1, 0] - Rm[0, 1]) / s
    elif Rm[0, 0] > Rm[1, 1] and Rm[0, 0] > Rm[2, 2]: s = np.sqrt(1 + Rm[0, 0] - Rm[1, 1] - Rm[2, 2]) * 2; w, x, y, z = (Rm[2, 1] - Rm[1, 2]) / s, s / 4, (Rm[0, 1] + Rm[1, 0]) / s, (Rm[0, 2] + Rm[2, 0]) / s
    elif Rm[1, 1] > Rm[2, 2]: s = np.sqrt(1 + Rm[1, 1] - Rm[0, 0] - Rm[2, 2]) * 2; w, x, y, z = (Rm[0, 2] - Rm[2, 0]) / s, (Rm[0, 1] + Rm[1, 0]) / s, s / 4, (Rm[1, 2] + Rm[2, 1]) / s
    else: s = np.sqrt(1 + Rm[2, 2] - Rm[0, 0] - Rm[1, 1]) * 2; w, x, y, z = (Rm[1, 0] - Rm[0, 1]) / s, (Rm[0, 2] + Rm[2, 0]) / s, (Rm[1, 2] + Rm[2, 1]) / s, s / 4
    q = np.array([w, x, y, z]); q /= np.linalg.norm(q); return q if q[0] >= 0 else -q
pk = os.path.join(R, 'assets/models.pack'); b = open(pk, 'rb').read(); hl = struct.unpack('<I', b[:4])[0]; hdr = json.loads(b[4:4 + hl]); base = 4 + hl
files = {k: b[base + o:base + o + l] for k, (o, l) in hdr.items()}
old = bytearray(zlib.decompress(files['anims.bin']))
only = [s for s in a.only.split(',') if s]; added = {}
for an in j['animations']:
    name = an['name'].replace('juren_jt_anim_', 'jt_').replace('juren_anim_', '')
    if only and name not in only and an['name'] not in only: continue
    dur = max(g.accessor(s['input']).max() for s in an['samplers']); n = int(round(dur * 30)) + 1
    D = np.zeros((n, 45), np.float32); Q = np.zeros((n, 4), np.float32); Y = np.zeros(n, np.float32)
    for f in range(n):
        w = worlds(sample(an, min(f / 30, dur))); Rp = w(pel)[:3, :3]; Rp = Rp / np.linalg.norm(Rp, axis=0)
        qrel = Rp @ Rrest.T
        Q[f] = qfrom(qrel); Y[f] = w(pel)[1, 3] / ypel0
        for pi, (p, c) in enumerate(pairs):
            if p not in byname or c not in byname: continue
            d = w(byname[c])[:3, 3] - w(byname[p])[:3, 3]; d = d / (np.linalg.norm(d) + 1e-9); D[f, pi * 3:pi * 3 + 3] = qrel.T @ d
    blob = np.concatenate([np.round(D.reshape(-1) * 32767), np.round(Q.reshape(-1) * 32767), np.round(Y * 10000)]).astype('<i2').tobytes()
    key = a.prefix + name; added[key] = {'n': n, 'fps': 30, 'o': len(old)}; old += blob; print(key, n, 'frames')
files['anims.bin'] = zlib.compress(bytes(old), 9)
mj['anims']['meta']['clips'].update(added); json.dump(mj, open(R + '/data/models.json', 'w'), separators=(',', ':'))
hdr = {}; off = 0; body = b''
for k, v in files.items(): hdr[k] = [off, len(v)]; off += len(v); body += v
h = json.dumps(hdr, separators=(',', ':')).encode(); open(pk, 'wb').write(struct.pack('<I', len(h)) + h + body)

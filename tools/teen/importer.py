"""Load any Bip001-rigged glTF/GLB (game rips) into our 24-joint pack primitives without throwing materials away.
Canonicalises orientation from the skeleton itself (up = pelvis->head, +x = character's left thigh) and scales to the common head height."""
import sys, os, re, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import build_bases as BB
from build_bases import GLTF, OUT, SHORT, strip, smooth_normals, tex_image, HEAD_Y

def load_bip(path, cap=1024, only=None, flipmesh=False):
    g = GLTF(path); j = g.j; par = g.parents(); sk = j['skins'][0]; jn = sk['joints']
    ib = g.accessor(sk['inverseBindMatrices']).reshape(-1, 4, 4); P0 = np.array([np.linalg.inv(m.T)[:3, 3] for m in ib])
    names = [strip(j['nodes'][n]['name']) for n in jn]; first = {}
    for i, n in enumerate(names): first.setdefault(n, i)
    rev = {o: i for i, o in enumerate(OUT) if o in first}
    def kept(i):
        n = jn[i]
        while True:
            b = strip(j['nodes'][n]['name'])
            if b in rev: return rev[b]
            if n not in par: return 0
            n = par[n]
    remap = np.array([kept(i) for i in range(len(jn))])
    wp = np.zeros((24, 3))
    for oi, o in enumerate(OUT):
        if o in first: wp[oi] = P0[first[o]]
    # canonical frame
    up = wp[17] - wp[0]; up /= np.linalg.norm(up); side = wp[1] - wp[5]; side -= up * (side @ up); side /= np.linalg.norm(side)
    fwd = np.cross(side, up)          # x(side) cross y(up) = z: right-handed with side=+x, up=+y
    Rm = np.stack([side, up, fwd])    # rows -> new axes
    raw = []; texs = []; tmap = {}
    for mesh in j['meshes']:
        for pr in mesh['primitives']:
            mi = pr['material']; mname = j['materials'][mi]['name']
            if only and not re.search(only, mname): continue
            at = pr['attributes']
            if 'JOINTS_0' not in at: continue
            P = g.accessor(at['POSITION']).astype(np.float64); F = g.accessor(pr['indices']).astype(np.int64).reshape(-1, 3)
            UV = g.accessor(at['TEXCOORD_0']).astype(np.float32); J4 = g.accessor(at['JOINTS_0']).astype(np.int64); W4 = g.accessor(at['WEIGHTS_0']).astype(np.float64)
            ti = None; im = tex_image(g, mi, cap)
            if im is not None:
                if mi not in tmap: texs.append(im); tmap[mi] = len(texs) - 1
                ti = tmap[mi]
            tj = remap[J4]; jj = np.zeros((len(P), 4), np.int64); ww = np.zeros((len(P), 4))
            for v in range(len(P)):
                acc = {}
                for k in range(4):
                    if W4[v, k] > 0: acc[int(tj[v, k])] = acc.get(int(tj[v, k]), 0) + W4[v, k]
                if not acc: acc = {0: 1.0}
                tot = sum(acc.values())
                for k, (t, w) in enumerate(sorted(acc.items(), key=lambda x: -x[1])[:4]): jj[v, k] = t; ww[v, k] = w / tot
            raw.append(dict(mat=mname, tex=ti, pos=P, uv=UV, jj=jj, ww=ww, ix=F.reshape(-1)))
    wp = wp @ Rm.T
    for p in raw: p['pos'] = p['pos'] @ Rm.T
    if flipmesh:      # meshes baked upside-down against the skeleton (fbx2glb on some FBX): rotate 180deg about x
        top = max(p['pos'][:, 1].max() for p in raw)
        for p in raw: p['pos'] = np.stack([p['pos'][:, 0], top - p['pos'][:, 1], -p['pos'][:, 2]], 1); p['ix'] = p['ix'].reshape(-1, 3)[:, ::-1].reshape(-1)
    allv = np.concatenate([p['pos'] for p in raw]); ymin = min(allv[:, 1].min(), wp[:, 1].min()); wp[:, 1] -= ymin
    s = HEAD_Y / wp[17][1]; wp *= s
    for p in raw:
        p['pos'] = (p['pos'] - [0, ymin, 0]) * s; p['nrm'] = smooth_normals(p['pos'], p['ix'].reshape(-1, 3)); p['srctex'] = p['tex']
    wp[18] = wp[17] + [0, .24, .02]; wp[19] = wp[17] + [0, 0, .10]
    return raw, wp, texs, s

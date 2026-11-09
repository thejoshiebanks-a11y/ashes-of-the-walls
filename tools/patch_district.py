#!/usr/bin/env python3
"""v0.8.0 district patcher (run once; originals are backed up by the caller).
  - replaces house types 1-4 with the four anime medieval houses (anime_medieval_house.glb), keeping every instance position/yaw
  - adds the player's house (medieval_house_anime_based) as a landmark, replacing one house near the gate square
  - adds a hidden stone 'plug' inside the gate complex so no see-through slits remain
usage: patch_district.py HOUSES.glb LANDMARK_DIR(scene.gltf+textures/)   (run from the repo root)"""
import sys, io, json, zlib, struct, math, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from gltf_reader import GLTF

def world(g):
    par = {}
    for i, n in enumerate(g.j['nodes']):
        for c in n.get('children', []): par[c] = i
    def W(i):
        M = g.node_local(i); return (W(par[i]) @ M) if i in par else M
    return W

def prims(g):
    W = world(g); out = {}
    for i, n in enumerate(g.j['nodes']):
        if 'mesh' not in n: continue
        M = W(i)
        for p in g.j['meshes'][n['mesh']]['primitives']:
            P = g.accessor(p['attributes']['POSITION']).astype(np.float64)
            N = g.accessor(p['attributes']['NORMAL']).astype(np.float64)
            uv = g.accessor(p['attributes']['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2), np.float32)
            idx = g.accessor(p['indices']).reshape(-1).astype(np.uint32)
            Nw = N @ np.linalg.inv(M[:3, :3]); Nw /= np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-9)
            out[n['name']] = dict(P=P @ M[:3, :3].T + M[:3, 3], N=Nw, uv=uv, idx=idx, mat=p.get('material'))
    return out

def xform(pr, s, rot90, cx, cz, y0):
    P = pr['P'].copy(); N = pr['N'].copy()
    P[:, 0] -= cx; P[:, 2] -= cz; P[:, 1] -= y0
    if rot90:                                        # (x,z) -> (z,-x)
        P = np.stack([P[:, 2], P[:, 1], -P[:, 0]], 1); N = np.stack([N[:, 2], N[:, 1], -N[:, 0]], 1)
    return P * s, N

class Out:
    def __init__(s, j): s.j = j; s.vb = []; s.ib = []; s.inst = []; s.vn = j['vc']; s.in_ = j['ic']; s.ni = j['nInst']
    def geom(s, name, P, N, uv, idx, mat):
        v = np.zeros((len(P), 36), np.uint8)
        v[:, 0:12] = P.astype(np.float32).view(np.uint8).reshape(-1, 12); v[:, 12:24] = N.astype(np.float32).view(np.uint8).reshape(-1, 12)
        v[:, 24:32] = uv.astype(np.float32).view(np.uint8).reshape(-1, 8); v[:, 32:36] = 255
        s.vb.append(v.tobytes()); s.ib.append(idx.astype(np.uint32).tobytes())
        s.j['geoms'][name] = dict(v=s.vn, vn=len(P), i=s.in_, **{'in': len(idx)}, mat=mat, bb=[float(x) for x in list(P.min(0)) + list(P.max(0))])
        s.vn += len(P); s.in_ += len(idx)
    def instance(s, row):                              # row: 16 floats
        s.inst.append(np.asarray(row, np.float32).tobytes()); s.ni += 1; return s.ni - 1

def jpg(im, size, q, path_key, texpack, alpha=False):
    im = im.convert('RGBA' if alpha else 'RGB')
    if im.size[0] > size: im = im.resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    if alpha: im.save(b, 'PNG', optimize=True)
    else: im.save(b, 'JPEG', quality=q, optimize=True)
    texpack[path_key] = b.getvalue(); return path_key

def main(glb, ldir):
    j = json.load(open('data/district.json')); raw = zlib.decompress(open('assets/district.bin', 'rb').read())
    vb = raw[:j['vbytes']]; ib = raw[j['vbytes']:j['vbytes'] + j['ibytes']]; inst = raw[j['vbytes'] + j['ibytes']:]
    hdr = open('assets/textures.pack', 'rb').read(); hl = struct.unpack('<I', hdr[:4])[0]; th = json.loads(hdr[4:4 + hl]); tb = hdr[4 + hl:]
    texpack = {k: tb[o:o + l] for k, (o, l) in th.items()}
    O = Out(j); nmats = len(j['mats']); ntex = len(j['tex'])
    def add_tex(key, srgb=True, alpha=False):
        j['tex'].append(dict(file=key, alpha=alpha, **({} if srgb else {'srgb': False}))); return len(j['tex']) - 1
    def add_mat(name, tex, norm=-1, cut=0.0, color=(1, 1, 1)):
        j['mats'].append(dict(name=name, tex=tex, color=list(color), cut=cut, dbl=True, spec=0.0, norm=norm, uvs=1.0, kind=0)); return len(j['mats']) - 1
    # ---------- the four townhouses ----------
    g = GLTF(glb); pr = prims(g); imgs = {}
    for i, im in enumerate(g.j['images']):
        d, _ = g.view_bytes(im['bufferView']); imgs[i] = Image.open(io.BytesIO(d))
    VAR = {  # key: (old types, [prim names], scale, rot90)
        'v1': (['house1', 'house1b', 'house1c'], ['Object_4', 'Object_6'], 7.2, False),
        'v2': (['house2', 'house2b', 'house2c'], ['Object_8', 'Object_10'], 8.5, False),
        'v3': (['house3', 'house3b', 'house3c'], ['Object_12'], 8.0, True),
        'v4': (['house4', 'house4b', 'house4c'], ['Object_14', 'Object_16'], 9.5, True)}
    matcache = {}
    def house_mat(mi):
        if mi in matcache: return matcache[mi]
        gm = g.j['materials'][mi]; ti = g.j['textures'][gm['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
        t = add_tex(jpg(imgs[ti], 768, 80, 'tex/h8_%s.jpg' % gm['name'].lower(), texpack)); matcache[mi] = add_mat('h8_' + gm['name'], t); return matcache[mi]
    draws_new = []; keep = []
    old_by_g = {d['g']: d for d in j['draws']}
    for vk, (olds, names, s, rot) in VAR.items():
        ps = [pr[n] for n in names]; allp = np.concatenate([p['P'] for p in ps]); lo, hi = allp.min(0), allp.max(0)
        cx, cz, y0 = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, lo[1] + 0.012
        parts = []
        for k, (n, p) in enumerate(zip(names, ps)):
            P, N = xform(p, s, rot, cx, cz, y0); gname = 'h8_%s_%d' % (vk, k); O.geom(gname, P, N, p['uv'], p['idx'], house_mat(p['mat'])); parts.append(gname)
        for og in olds:
            d = old_by_g.get(og)
            if not d: continue
            for pg in parts:
                nd = {k: v for k, v in d.items() if k != 'chunks'}; nd['g'] = pg; nd['chunks'] = d['chunks']; draws_new.append(nd)
            d['_drop'] = True
    j['draws'] = [d for d in j['draws'] if not d.get('_drop')] + draws_new
    # ---------- landmark: the player's house ----------
    lg = GLTF(os.path.join(ldir, 'scene.gltf')); lp = prims(lg); L = lg.j
    def limg(ti): return Image.open(os.path.join(ldir, L['images'][L['textures'][ti]['source']]['uri']))
    tkey = {}
    def lmat(mi):
        m = L['materials'][mi]; pb = m['pbrMetallicRoughness']; nm = m['name'].lower()
        if 'baseColorTexture' not in pb: return add_mat('lm_' + nm, -1, color=pb.get('baseColorFactor', [.1, .1, .1])[:3])
        alpha = m.get('alphaMode') == 'MASK'
        t = add_tex(jpg(limg(pb['baseColorTexture']['index']), 512 if alpha else 1024, 82, 'tex/lm_%s%s' % (nm, '.png' if alpha else '.jpg'), texpack, alpha), True, alpha)
        n = -1
        if 'normalTexture' in m: n = add_tex(jpg(limg(m['normalTexture']['index']), 512, 86, 'tex/lm_%s_n.jpg' % nm, texpack), False)
        return add_mat('lm_' + nm, t, n, 0.45 if alpha else 0.0)
    allp = np.concatenate([p['P'] for p in lp.values()]); lo, hi = allp.min(0), allp.max(0); cx, cz, y0 = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2, lo[1] + 0.05
    lparts = []
    for n, p in lp.items():
        P, N = xform(p, 1.0, False, cx, cz, y0); gname = 'lm_' + n.lower(); O.geom(gname, P, N, p['uv'], p['idx'], lmat(p['mat'])); lparts.append(gname)
    # find the host instance (a house4 near the gate square) and swap it
    IA = np.frombuffer(bytearray(inst), dtype=np.float32).reshape(-1, 16).copy()
    host = None
    for d in j['draws']:
        if d['g'].startswith('h8_v4'):
            for ch in d['chunks']:
                for k in range(ch['n']):
                    m = IA[ch['o'] + k]
                    if abs(m[3] - 21.8) < 0.5 and abs(m[11] + 86.7) < 0.5: host = ch['o'] + k
    if host is None: raise SystemExit('host house not found')
    m = IA[host].copy(); IA[host, [0, 1, 2, 4, 5, 6, 8, 9, 10]] = 0
    LS = 1.0; row = m.copy()
    for a in (0, 1, 2, 4, 5, 6, 8, 9, 10): row[a] *= LS
    row[12:16] = [1, 1, 1, 1]
    ni = O.instance(row); bb = [float(m[3]) - 12, -1.0, float(m[11]) - 12, float(m[3]) + 12, 14.0, float(m[11]) + 12]
    for pg in lparts: j['draws'].append(dict(g=pg, lod='houseLOD3', lodDist=140.0, chunks=[dict(bb=bb, o=ni, n=1)]))
    # ---------- plug inside the gate complex ----------
    x0, x1, y0b, y1, z0, z1 = -46, 46, 24, 46, 3, 12
    cp = np.array([[x, y, z] for x in (x0, x1) for y in (y0b, y1) for z in (z0, z1)], float)
    faces = [([0, 1, 3, 2], (-1, 0, 0)), ([4, 6, 7, 5], (1, 0, 0)), ([0, 4, 5, 1], (0, -1, 0)), ([2, 3, 7, 6], (0, 1, 0)), ([0, 2, 6, 4], (0, 0, -1)), ([1, 5, 7, 3], (0, 0, 1))]
    P = []; N = []; I = []
    for q, nrm in faces:
        b = len(P); P += [cp[i] for i in q]; N += [nrm] * 4; I += [b, b + 1, b + 2, b, b + 2, b + 3]
    wall_mat = next(i for i, m_ in enumerate(j['mats']) if m_['name'] == 'wall')
    O.geom('gate_plug', np.array(P), np.array(N, float), np.zeros((len(P), 2), np.float32), np.array(I), wall_mat)
    pi = O.instance([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1])
    j['draws'].append(dict(g='gate_plug', chunks=[dict(bb=[x0, y0b, z0, x1, y1, z1], o=pi, n=1)]))
    # ---------- write ----------
    j['vbytes'] = len(vb) + sum(len(x) for x in O.vb); j['ibytes'] = len(ib) + sum(len(x) for x in O.ib); j['nInst'] = O.ni; j['vc'] = O.vn; j['ic'] = O.in_
    binb = vb + b''.join(O.vb) + ib + b''.join(O.ib) + IA.tobytes() + b''.join(O.inst)
    assert len(binb) == j['vbytes'] + j['ibytes'] + j['nInst'] * 64
    open('assets/district.bin', 'wb').write(zlib.compress(binb, 9)); json.dump(j, open('data/district.json', 'w'), separators=(',', ':'))
    hdr = {}; body = b''
    for k, v in texpack.items(): hdr[k] = [len(body), len(v)]; body += v
    hb = json.dumps(hdr, separators=(',', ':')).encode(); open('assets/textures.pack', 'wb').write(struct.pack('<I', len(hb)) + hb + body)
    print('houses patched; geoms', len(j['geoms']), 'mats', len(j['mats']), 'tex', len(j['tex']), 'bin', len(binb))
if __name__ == '__main__': main(sys.argv[1], sys.argv[2])

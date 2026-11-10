#!/usr/bin/env python3
"""v0.8.2: hidden stone plugs inside the wall on both sides of the main gate, so no see-through cracks remain.
Run from the repo root on the already patched district (appends to data/district.json + assets/district.bin)."""
import json, zlib
import numpy as np
j = json.load(open('data/district.json')); raw = zlib.decompress(open('assets/district.bin', 'rb').read())
vb = raw[:j['vbytes']]; ib = raw[j['vbytes']:j['vbytes'] + j['ibytes']]; inst = raw[j['vbytes'] + j['ibytes']:]
wall = next(i for i, m in enumerate(j['mats']) if m['name'] == 'wall')
BOXES = [(-52, -28, -3, 46, 3, 12), (28, 52, -3, 46, 3, 12), (-43, -38, 45, 49.5, 3, 12)]
faces = [([0, 1, 3, 2], (-1, 0, 0)), ([4, 6, 7, 5], (1, 0, 0)), ([0, 4, 5, 1], (0, -1, 0)), ([2, 3, 7, 6], (0, 1, 0)), ([0, 2, 6, 4], (0, 0, -1)), ([1, 5, 7, 3], (0, 0, 1))]
nv, ni, nin = j['vc'], j['ic'], j['nInst']; V = []; I = []; N = []
for k, (x0, x1, y0, y1, z0, z1) in enumerate(BOXES):
    cp = np.array([[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], float); P = []; Nn = []; Ix = []
    for q, nrm in faces:
        b = len(P); P += [cp[i] for i in q]; Nn += [nrm] * 4; Ix += [b, b + 1, b + 2, b, b + 2, b + 3]
    P = np.array(P); v = np.zeros((len(P), 36), np.uint8)
    v[:, 0:12] = P.astype(np.float32).view(np.uint8).reshape(-1, 12); v[:, 12:24] = np.array(Nn, np.float32).view(np.uint8).reshape(-1, 12); v[:, 32:36] = 255
    V.append(v.tobytes()); I.append(np.array(Ix, np.uint32).tobytes()); name = 'gate_plug_%d' % k
    j['geoms'][name] = dict(v=nv, vn=len(P), i=ni, mat=wall, bb=[float(x) for x in list(P.min(0)) + list(P.max(0))], **{'in': len(Ix)}); nv += len(P); ni += len(Ix)
    inst += np.array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1], np.float32).tobytes()
    j['draws'].append(dict(g=name, chunks=[dict(bb=[x0, y0, z0, x1, y1, z1], o=nin, n=1)])); nin += 1
vb += b''.join(V); ib += b''.join(I)
j.update(vbytes=len(vb), ibytes=len(ib), nInst=nin, vc=nv, ic=ni)
open('assets/district.bin', 'wb').write(zlib.compress(vb + ib + inst, 9)); json.dump(j, open('data/district.json', 'w'), separators=(',', ':')); print('plugs added', len(BOXES))

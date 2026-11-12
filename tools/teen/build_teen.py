#!/usr/bin/env python3
"""Young teen male foundation: teen-character-rigged.glb -> engine model format.

    python3 tools/teen/build_teen.py path/to/teen-character-rigged.glb assets/teen [--faces 100000]

What it does (each step is a deliberate decision, see docs/CHARACTER_FOUNDATION_V1.md):
 1. reads the 177k-vertex / 300k-triangle skinned mesh,
 2. decimates it with tools/teen/decimate (quadric collapse that never touches UV seams, blends skin weights),
 3. rebuilds smooth normals on welded positions (no lighting seams),
 4. renames the 24 joints to the Bip001 names the game's direction-based animation retargeting drives,
 5. rebuilds the skeleton in metres from the glTF inverse-bind matrices with identity joint rotations (rest pose == bind pose),
 6. writes teen.bin / teen.meta.json / teen.t0.webp / teen.info.json.
"""
import argparse, json, os, struct, subprocess, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from gltf_reader import GLTF
from engine_model import write_model

NAMES = {'Hips': 'Bip001 Pelvis', 'Spine02': 'Bip001 Spine', 'Spine01': 'Bip001 Spine1', 'Spine': 'Bip001 Spine2', 'neck': 'Bip001 Neck', 'Head': 'Bip001 Head',
         'head_end': 'Bip001 HeadNub', 'headfront': 'Bip001 HeadFront',
         'LeftShoulder': 'Bip001 L Clavicle', 'LeftArm': 'Bip001 L UpperArm', 'LeftForeArm': 'Bip001 L Forearm', 'LeftHand': 'Bip001 L Hand',
         'RightShoulder': 'Bip001 R Clavicle', 'RightArm': 'Bip001 R UpperArm', 'RightForeArm': 'Bip001 R Forearm', 'RightHand': 'Bip001 R Hand',
         'LeftUpLeg': 'Bip001 L Thigh', 'LeftLeg': 'Bip001 L Calf', 'LeftFoot': 'Bip001 L Foot', 'LeftToeBase': 'Bip001 L Toe0',
         'RightUpLeg': 'Bip001 R Thigh', 'RightLeg': 'Bip001 R Calf', 'RightFoot': 'Bip001 R Foot', 'RightToeBase': 'Bip001 R Toe0'}

def decimate(P, UV, J, W, F, target):
    exe = os.path.join(HERE, 'decimate')
    if not os.path.exists(exe): subprocess.check_call(['g++', '-O2', '-o', exe, os.path.join(HERE, 'decimate.cpp')])
    tmp_in, tmp_out = os.path.join(HERE, '_in.bin'), os.path.join(HERE, '_out.bin')
    with open(tmp_in, 'wb') as f:
        f.write(struct.pack('<II', len(P), len(F))); f.write(P.astype(np.float32).tobytes()); f.write(UV.astype(np.float32).tobytes()); f.write(J.astype(np.uint8).tobytes()); f.write(W.astype(np.float32).tobytes()); f.write(F.astype(np.uint32).tobytes())
    r = subprocess.run([exe, tmp_in, tmp_out, str(target)], capture_output=True, text=True); print(r.stderr.strip())
    d = open(tmp_out, 'rb').read(); nv, nf = struct.unpack('<II', d[:8]); o = 8
    def take(dt, n):
        nonlocal o
        a = np.frombuffer(d, dt, n, o).copy(); o += a.nbytes; return a
    P2 = take(np.float32, nv * 3).reshape(-1, 3); UV2 = take(np.float32, nv * 2).reshape(-1, 2); J2 = take(np.uint8, nv * 4).reshape(-1, 4); W2 = take(np.float32, nv * 4).reshape(-1, 4); F2 = take(np.uint32, nf * 3).reshape(-1, 3)
    os.remove(tmp_in); os.remove(tmp_out); return P2, UV2, J2, W2, F2

def smooth_normals(P, F):
    key = np.round(P.astype(np.float64) * 1e5).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); acc = np.zeros((inv.max() + 1, 3))
    for k in range(3): np.add.at(acc, inv[F[:, k]], fn)
    n = acc[inv]; return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('glb'); ap.add_argument('out'); ap.add_argument('--faces', type=int, default=100000); ap.add_argument('--key', default='teen'); ap.add_argument('--tex', type=int, default=2048)
    a = ap.parse_args(); g = GLTF(a.glb); j = g.j; os.makedirs(a.out, exist_ok=True)
    pr = j['meshes'][0]['primitives'][0]; at = pr['attributes']
    P = g.accessor(at['POSITION']).astype(np.float32); UV = g.accessor(at['TEXCOORD_0']).astype(np.float32); J = g.accessor(at['JOINTS_0']).astype(np.uint8); W = g.accessor(at['WEIGHTS_0']).astype(np.float32); F = g.accessor(pr['indices']).reshape(-1, 3).astype(np.uint32)
    print('source: %d verts, %d tris' % (len(P), len(F)))
    if a.faces and a.faces < len(F): P, UV, J, W, F = decimate(P, UV, J, W, F, a.faces)
    N = smooth_normals(P, F)
    sk = j['skins'][0]; joints = sk['joints']; idx = {n: i for i, n in enumerate(joints)}; par = g.parents()
    names = [NAMES[j['nodes'][n]['name']] for n in joints]; parents = [idx.get(par.get(n), -1) for n in joints]
    ibm = g.accessor(sk['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
    world_pos = np.array([np.linalg.inv(m)[:3, 3] for m in ibm])        # bind-pose joint positions in metres (mesh space)
    # texture
    bt = j['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']; im = j['images'][j['textures'][bt]['source']]
    import io; data, _ = g.view_bytes(im['bufferView']); img = Image.open(io.BytesIO(data)).convert('RGB')
    if img.width > a.tex: img = img.resize((a.tex, a.tex), Image.LANCZOS)
    prim = dict(mat='Body', tex=0, pos=P, nrm=N, uv=UV, jj=J.astype(np.int64), ww=W.astype(np.float64), ix=F.reshape(-1).astype(np.int64))
    meta, info, binz, texb = write_model(a.out, a.key, names, parents, world_pos, [prim], [img])
    open(os.path.join(a.out, a.key + '.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(a.out, a.key + '.meta.json'), 'w'), separators=(',', ':'))
    open(os.path.join(a.out, a.key + '.t0.webp'), 'wb').write(texb[0]); info['pelvis'] = world_pos[names.index('Bip001 Pelvis')].tolist(); info['head'] = world_pos[names.index('Bip001 Head')].tolist()
    json.dump(info, open(os.path.join(a.out, a.key + '.info.json'), 'w'), indent=1)
    print('wrote', a.out, '| %d verts %d tris | height %.3f m | bin %d KB | tex %d KB' % (info['verts'], len(F), info['height'], info['bin_kb'], len(texb[0]) // 1024))
if __name__ == "__main__": main()

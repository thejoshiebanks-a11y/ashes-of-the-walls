"""Write a skinned model in the game's engine format (same layout as convert_model.py)."""
import io, json, os, zlib
import numpy as np
from PIL import Image

def write_model(out, key, names, parents, world_pos, prims, textures, root_name_hint=None):
    """names/parents: joint lists (parents index or -1). world_pos: Jx3 rest joint positions (identity rotations).
    prims: list of dict(mat, tex(index|None), pos Nx3, nrm Nx3, uv Nx2, jj Nx4 int, ww Nx4 float, ix flat int).
    textures: list of PIL images. Returns (meta, info)."""
    J = len(names); wp = np.asarray(world_pos, np.float64)
    loc = np.zeros((J, 16), np.float32); ibm = np.zeros((J, 16), np.float32)
    for i in range(J):
        t = wp[i] - (wp[parents[i]] if parents[i] >= 0 else 0)
        m = np.eye(4); m[:3, 3] = t; loc[i] = m.T.reshape(16)
        m = np.eye(4); m[:3, 3] = -wp[i]; ibm[i] = m.T.reshape(16)
    chunks = [loc.tobytes(), ibm.tobytes()]; off = J * 128; meta_prims = []
    def put(b):
        nonlocal off
        o = off; chunks.append(b); off += len(b); return o
    for p in prims:
        n = len(p['pos']); ww = np.asarray(p['ww'], np.float64); s = ww.sum(1, keepdims=True); s[s == 0] = 1; ww = ww / s
        w8 = np.round(ww * 255).astype(np.int64); w8[np.arange(n), w8.argmax(1)] += 255 - w8.sum(1)
        nrm = np.zeros((n, 4), np.int8); nrm[:, :3] = np.clip(np.round(np.asarray(p['nrm']) * 127), -127, 127)
        o = [put(np.asarray(p['pos'], np.float32).tobytes()), put(nrm.tobytes()), put(np.asarray(p['uv'], np.float32).tobytes()),
             put(np.asarray(p['jj']).astype(np.uint8).tobytes()), put(w8.astype(np.uint8).tobytes()),
             put(np.asarray(p['ix']).astype(np.uint32 if n >= 65536 else np.uint16).tobytes())]
        meta_prims.append({'n': n, 'ni': int(len(p['ix'])), 'mat': p['mat'], 'tex': p.get('tex'), 'o': o})
    binz = zlib.compress(b''.join(chunks), 9)
    meta = {'name': key, 'joints': J, 'parents': [int(x) for x in parents], 'names': names, 'prims': meta_prims,
            'rootW': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'locOff': 0, 'ibmOff': J * 64}
    texb = []
    for im in textures:
        b = io.BytesIO(); im.convert('RGBA').save(b, 'WEBP', quality=88, method=4); texb.append(b.getvalue())
    allp = np.concatenate([np.asarray(p['pos']) for p in prims])
    info = {'key': key, 'bodyHeight': float(allp[:, 1].max() - allp[:, 1].min()), 'bodyYmin': float(allp[:, 1].min()), 'joints': J,
            'prims': len(prims), 'tex': len(texb), 'verts': int(sum(len(p['pos']) for p in prims)),
            'height': float(allp[:, 1].max() - allp[:, 1].min()), 'ymin': float(allp[:, 1].min()), 'unit': 1.0, 'bin_kb': len(binz) // 1024}
    return meta, info, binz, texb

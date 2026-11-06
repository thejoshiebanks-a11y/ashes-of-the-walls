#!/usr/bin/env python3
"""Convert a skinned glTF/GLB into the engine's model format.

Output (in --out): <key>.bin (zlib), <key>.meta.json, <key>.t<N>.webp
Format: [loc J*16 f32][ibm J*16 f32] then per primitive:
        pos f32*3n, nrm i8*4n, uv f32*2n, joints u8*4n, weights u8*4n, indices u16/u32.
The skeleton is rebuilt from the inverse-bind matrices so that rest pose == bind pose.
"""
import argparse, io, json, os, re, struct, sys, zlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltf_reader import GLTF

MIXAMO = {'Hips': 'Pelvis', 'Spine': 'Spine', 'Spine1': 'Spine1', 'Spine2': 'Spine2', 'Neck': 'Neck', 'Head': 'Head',
          'Shoulder': 'Clavicle', 'Arm': 'UpperArm', 'ForeArm': 'Forearm', 'Hand': 'Hand', 'UpLeg': 'Thigh', 'Leg': 'Calf', 'Foot': 'Foot', 'ToeBase': 'Toe0'}

def mixamo_name(n):
    n = re.sub(r'_\d+$', '', n)
    m = re.match(r'(?:mixamorig\d*[:_])?(Left|Right)?(.+)$', n)
    if not m: return n
    side, core = m.group(1), m.group(2)
    if core not in MIXAMO: return n
    if core == 'Hips': return 'Bip001 Pelvis'
    return 'Bip001 ' + ({'Left': 'L ', 'Right': 'R '}.get(side, '')) + MIXAMO[core]

def mat_from_cols(a): return np.array(a, np.float64).reshape(4, 4).T

def convert(path, key, out, max_tex=1024, rename=None, prune=None, unit=None, drop_mat=None, verbose=True):
    g = GLTF(path); j = g.j
    sk = j['skins'][0]; joints = list(sk['joints']); J0 = len(joints)
    par = g.parents(); idx = {n: i for i, n in enumerate(joints)}
    names = [j['nodes'][n].get('name', 'joint%d' % i) for i, n in enumerate(joints)]
    if rename == 'mixamo': names = [mixamo_name(n) for n in names]
    parents = [idx.get(par.get(n), -1) for n in joints]
    ibm = g.accessor(sk['inverseBindMatrices']).astype(np.float64)

    # --- collect skinned primitives (mesh index order, like the original converter)
    prims = []
    skinned_nodes = [i for i, nd in enumerate(j['nodes']) if nd.get('skin') == 0 and 'mesh' in nd]
    for mi in sorted(set(j['nodes'][i]['mesh'] for i in skinned_nodes)):
        for pr in j['meshes'][mi]['primitives']:
            a = pr['attributes']
            if 'JOINTS_0' not in a or pr.get('mode', 4) != 4: continue
            mat = j['materials'][pr['material']] if 'material' in pr else {}
            mname = mat.get('name', 'mat%d' % mi)
            if drop_mat and re.search(drop_mat, mname): continue
            pos = g.accessor(a['POSITION']).astype(np.float32)
            nrm = g.accessor(a['NORMAL']).astype(np.float32) if 'NORMAL' in a else np.tile([0, 1, 0], (len(pos), 1)).astype(np.float32)
            uv = g.accessor(a['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in a else np.zeros((len(pos), 2), np.float32)
            jj = g.accessor(a['JOINTS_0']).astype(np.int64)
            ww = g.accessor(a['WEIGHTS_0']).astype(np.float64)
            ix = g.accessor(pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(pos))
            prims.append(dict(mat=mat, mname=mname, pos=pos, nrm=nrm, uv=uv, jj=jj, ww=ww, ix=ix))
    if not prims: raise SystemExit('no skinned primitives in ' + path)

    # --- units: cm -> m when the model is obviously centimetres
    allp = np.concatenate([p['pos'] for p in prims]); height = float(allp[:, 1].max() - allp[:, 1].min())
    k = unit if unit else (0.01 if height > 20 else 1.0)

    # --- joint pruning (bone texture holds 128 joints)
    keep = np.ones(J0, bool)
    if prune or J0 > 128:
        used = np.zeros(J0, bool)
        for p in prims:
            m = p['ww'] > 0; used[np.unique(p['jj'][m])] = True
        keep = used.copy()
        for i in range(J0):
            if used[i]:
                a = parents[i]
                while a >= 0 and not keep[a]: keep[a] = True; a = parents[a]
    # still too many? fold the least-influential leaf joints into their parents
    def fold_until_fit():
        while keep.sum() > 128:
            infl = np.zeros(J0)
            for p in prims:
                np.add.at(infl, p['jj'].reshape(-1), p['ww'].reshape(-1))
            child_count = np.zeros(J0, int)
            for i in range(J0):
                if keep[i] and parents[i] >= 0: child_count[parents[i]] += 1
            leaves = [i for i in range(J0) if keep[i] and child_count[i] == 0 and parents[i] >= 0]
            v = min(leaves, key=lambda i: infl[i]); a = parents[v]
            while a >= 0 and not keep[a]: a = parents[a]
            for p in prims: p['jj'] = np.where(p['jj'] == v, a, p['jj'])
            keep[v] = False
    if keep.sum() > 128: fold_until_fit()
    remap = -np.ones(J0, int); order = [i for i in range(J0) if keep[i]]
    for new, old in enumerate(order): remap[old] = new
    J = len(order)
    if J > 128: raise SystemExit('%s: %d joints after pruning (max 128)' % (key, J))
    def np_parent(i):
        a = parents[i]
        while a >= 0 and not keep[a]: a = parents[a]
        return remap[a] if a >= 0 else -1
    parents2 = [int(np_parent(i)) for i in order]; names2 = [names[i] for i in order]

    # --- skeleton: a faithful dump of the glTF (node local transforms + inverse-bind matrices), which is
    # what glTF defines as the correct rendered shape. Only a unit change (cm -> m) is applied, as a similarity
    # transform so skinning stays exact: W' = S W S^-1 (translations scaled), ibm' = S ibm S^-1.
    Wn = {}
    def world(i):
        if i in Wn: return Wn[i]
        L = g.node_local(joints[i]); Wn[i] = L if parents[i] < 0 else world(parents[i]) @ L; return Wn[i]
    def scaled(M):
        M = M.copy(); M[:3, 3] *= k; return M
    loc = []; ibm2 = []
    for n, i in enumerate(order):
        p = parents2[n]
        L = world(i) if p < 0 else np.linalg.inv(world(order[p])) @ world(i)
        loc.append(scaled(L).T.reshape(16)); ibm2.append(scaled(ibm[i].reshape(4, 4).T).T.reshape(16))
    loc = np.array(loc, np.float32); ibm2 = np.array(ibm2, np.float32)

    # --- textures (deduped by source image; solid colours become 4x4 swatches)
    tex_list = []; tex_key = {}
    def tex_for(mat):
        pbr = dict(mat.get('pbrMetallicRoughness', {}))
        sg = (mat.get('extensions') or {}).get('KHR_materials_pbrSpecularGlossiness')
        if sg:
            if 'diffuseTexture' in sg: pbr['baseColorTexture'] = sg['diffuseTexture']
            if 'diffuseFactor' in sg: pbr['baseColorFactor'] = sg['diffuseFactor']
        bt = pbr.get('baseColorTexture')
        if bt is not None:
            ti = j['textures'][bt['index']]; src = ti.get('source')
            if src in tex_key: return tex_key[src]
            im = j['images'][src]
            if 'uri' in im:
                data = open(os.path.join(g.dir, im['uri'].replace('%20', ' ')), 'rb').read()
            else:
                data, _ = g.view_bytes(im['bufferView'])
            img = Image.open(io.BytesIO(data)).convert('RGBA')
            if max(img.size) > max_tex:
                s = max_tex / max(img.size); img = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)
            buf = io.BytesIO(); img.save(buf, 'WEBP', quality=88, method=4); tex_list.append(buf.getvalue()); tex_key[src] = len(tex_list) - 1
            return tex_key[src]
        f = pbr.get('baseColorFactor')
        if f is not None and any(abs(c - 1) > .02 for c in f[:3]):
            ck = ('c',) + tuple(round(c, 3) for c in f)
            if ck in tex_key: return tex_key[ck]
            img = Image.new('RGBA', (4, 4), tuple(int(max(0, min(1, c)) ** (1 / 2.2) * 255) for c in f[:3]) + (255,))
            buf = io.BytesIO(); img.save(buf, 'WEBP', quality=95); tex_list.append(buf.getvalue()); tex_key[ck] = len(tex_list) - 1
            return tex_key[ck]
        return None

    # --- binary
    chunks = [loc.tobytes(), ibm2.tobytes()]; off = J * 64 * 2; meta_prims = []
    def put(b):
        nonlocal off
        o = off; chunks.append(b); off += len(b); return o
    for p in prims:
        n = len(p['pos']); jj = p['jj']; ww = p['ww'].copy()
        if (keep == False).any():
            jj = np.where(keep[jj], remap[jj], 0)
            # weights on dropped joints were zero by construction of 'used'
        s = ww.sum(1, keepdims=True); s[s == 0] = 1; ww = ww / s
        w8 = np.round(ww * 255).astype(np.int64)
        diff = 255 - w8.sum(1); w8[np.arange(n), w8.argmax(1)] += np.where(w8.sum(1) > 0, diff, 0)
        pos = (p['pos'] * k).astype(np.float32)
        nrm = np.zeros((n, 4), np.int8); nrm[:, :3] = np.clip(np.round(p['nrm'] * 127), -127, 127)
        o = []
        o.append(put(pos.tobytes())); o.append(put(nrm.tobytes())); o.append(put(p['uv'].astype(np.float32).tobytes()))
        o.append(put(jj.astype(np.uint8).tobytes())); o.append(put(w8.astype(np.uint8).tobytes()))
        o.append(put(p['ix'].astype(np.uint32 if n >= 65536 else np.uint16).tobytes()))
        meta_prims.append({'n': n, 'ni': int(len(p['ix'])), 'mat': p['mname'], 'tex': tex_for(p['mat']), 'o': o})
    binz = zlib.compress(b''.join(chunks), 9)
    meta = {'name': key, 'joints': J, 'parents': parents2, 'names': names2, 'prims': meta_prims,
            'rootW': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'locOff': 0, 'ibmOff': J * 64}
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, key + '.bin'), 'wb').write(binz)
    json.dump(meta, open(os.path.join(out, key + '.meta.json'), 'w'), separators=(',', ':'))
    for i, t in enumerate(tex_list): open(os.path.join(out, '%s.t%d.webp' % (key, i)), 'wb').write(t)
    # model extents (after unit scale) for scaling NPCs to a target height
    allp = np.concatenate([p['pos'] for p in prims]) * k
    body = [p for p in prims if not re.search(r'weapon|sword|ODM|gangsheng|quiver|bow|juren|heixian', p['mname'], re.I)] or prims
    bp = np.concatenate([p['pos'] for p in body]) * k
    info = {'key': key, 'bodyHeight': float(bp[:, 1].max() - bp[:, 1].min()), 'bodyYmin': float(bp[:, 1].min()), 'joints': J, 'prims': len(prims), 'tex': len(tex_list), 'verts': int(sum(len(p['pos']) for p in prims)),
            'height': float(allp[:, 1].max() - allp[:, 1].min()), 'ymin': float(allp[:, 1].min()), 'unit': k, 'bin_kb': len(binz) // 1024}
    json.dump(info, open(os.path.join(out, key + '.info.json'), 'w'))
    if verbose: print(info)
    return meta, info

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('--key', required=True); ap.add_argument('--out', default='converted')
    ap.add_argument('--rename', choices=['mixamo']); ap.add_argument('--prune', action='store_true'); ap.add_argument('--unit', type=float)
    ap.add_argument('--drop-mat'); ap.add_argument('--max-tex', type=int, default=1024)
    a = ap.parse_args(); convert(a.src, a.key, a.out, a.max_tex, a.rename, a.prune, a.unit, a.drop_mat)

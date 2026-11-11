#!/usr/bin/env python3
"""Convert a skinned binary-FBX character (mesh + skeleton + one animation) into a GLB that tools/convert_model.py and
tools/add_glb_clips.py understand.   python3 tools/fbx2glb.py in.fbx out.glb --tex DIR --map 'hair=hair_tex.png,body=body_tex.png,...'
Meshes are baked into the bind pose (the cluster's own Transform), joints get inverse-bind = inverse(TransformLink),
animation is sampled at 30 fps into local translation/rotation channels."""
import sys, os, re, json, struct, argparse, io
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbxparse import parse

KT = 46186158000.0
def nm(c): return c.props[1].split('\x00')[0]
def rotm(e, order='XYZ'):
    r = np.radians(e); out = np.eye(3)
    def ax(a, t):
        c, s = np.cos(t), np.sin(t)
        return {'X': np.array([[1, 0, 0], [0, c, -s], [0, s, c]]), 'Y': np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]), 'Z': np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])}[a]
    M = np.eye(3)
    for a in order: M = ax(a, r['XYZ'.index(a)]) @ M          # FBX default XYZ order: X applied first
    return M
def quat(R):
    t = np.trace(R)
    if t > 0: s = np.sqrt(t + 1) * 2; q = [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, s / 4]
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]: s = np.sqrt(1 + R[0, 0] - R[1, 1] - R[2, 2]) * 2; q = [s / 4, (R[0, 1] + R[1, 0]) / s, (R[0, 2] + R[2, 0]) / s, (R[2, 1] - R[1, 2]) / s]
    elif R[1, 1] > R[2, 2]: s = np.sqrt(1 + R[1, 1] - R[0, 0] - R[2, 2]) * 2; q = [(R[0, 1] + R[1, 0]) / s, s / 4, (R[1, 2] + R[2, 1]) / s, (R[0, 2] - R[2, 0]) / s]
    else: s = np.sqrt(1 + R[2, 2] - R[0, 0] - R[1, 1]) * 2; q = [(R[0, 2] + R[2, 0]) / s, (R[1, 2] + R[2, 1]) / s, s / 4, (R[1, 0] - R[0, 1]) / s]
    q = np.array(q); return q / np.linalg.norm(q)

SHARED = {}
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('fbx'); ap.add_argument('out'); ap.add_argument('--tex', required=True)
    ap.add_argument('--map', required=True, help='materialSubstring=texture.png,...'); ap.add_argument('--meshes', default='role_rang_diaocha,role_sanli_diaocha_zhuangbei')
    ap.add_argument('--anim', default='idle'); ap.add_argument('--fps', type=int, default=30)
    a = ap.parse_args()
    root, ver = parse(a.fbx); ob = root.first('Objects'); byid = {c.props[0]: c for c in ob.children}
    conns = [(c.props[1], c.props[2], c.props[3] if len(c.props) > 3 else '') for c in root.first('Connections').children if c.props[0] == 'OO' or c.props[0] == 'OP']
    models = {c.props[0]: c for c in ob.children if c.name == 'Model'}
    parent = {}
    for s, d, p in conns:
        if s in models and d in models: parent[s] = d
    def P(m, key, default):
        pr = m.first('Properties70')
        for p in (pr.children if pr else []):
            if p.props[0] == key: return np.array(p.props[4:7], float) if len(p.props) >= 7 else p.props[4]
        return np.array(default, float)
    def lcl(m, ov=None):
        ov = ov or {}
        t = ov.get('T', P(m, 'Lcl Translation', [0, 0, 0])); r = ov.get('R', P(m, 'Lcl Rotation', [0, 0, 0])); s = ov.get('S', P(m, 'Lcl Scaling', [1, 1, 1]))
        pre = P(m, 'PreRotation', [0, 0, 0]); post = P(m, 'PostRotation', [0, 0, 0])
        M = np.eye(4); R = rotm(pre) @ rotm(r) @ rotm(post).T
        M[:3, :3] = R @ np.diag(s); M[:3, 3] = t; return M
    # ---- joints = every cluster bone
    skins = {c.props[0]: c for c in ob.children if c.name == 'Deformer' and c.props[2] == 'Skin'}
    clusters = {c.props[0]: c for c in ob.children if c.name == 'Deformer' and c.props[2] == 'Cluster'}
    geo_of = {}; cl_of_skin = {}; bone_of_cl = {}; skin_of_geo = {}
    for s, d, p in conns:
        if s in byid and d in byid:
            if byid[s].name == 'Geometry' and d in models: geo_of[d] = s
            if s in clusters and d in skins: cl_of_skin.setdefault(d, []).append(s)
            if s in skins and byid[d].name == 'Geometry': skin_of_geo[d] = s
            if d in clusters and s in models: bone_of_cl[d] = s
    wanted = a.meshes.split(',')
    jointset = {}                                                    # model id -> index
    for mid, m in models.items():
        if nm(m) in wanted and mid in geo_of and geo_of[mid] in skin_of_geo:
            for cid in cl_of_skin[skin_of_geo[geo_of[mid]]]:
                b = bone_of_cl.get(cid)
                if b: jointset.setdefault(b, None)
    SKIP = ('Bip001', 'role_rang_diaocha_skin', 'role_rang_diaocha_show')
    for b in list(jointset):                                          # keep chain parents (twist/forearm bones) but not the root chain
        x = parent.get(b)
        while x is not None and models[x].props[2] == 'LimbNode' and nm(models[x]) not in SKIP:
            jointset.setdefault(x, None); x = parent.get(x)
    # the bind pose is the clusters' TransformLink (the stored Lcl values are the last animated pose, not the bind)
    G = np.eye(4); link = {}
    raw = {}
    for cid, c in clusters.items():
        b = bone_of_cl.get(cid)
        if b: raw[b] = np.array(c.first('TransformLink').props[0], float).reshape(4, 4).T
    pel = [b for b in jointset if nm(models[b]) == 'Bip001 Pelvis'][0]; P0 = raw[pel][:3, 3].copy()
    Ry = np.eye(4)                                                    # the FBX is already Y-up with the arms along x; only recentre
    T0 = np.eye(4); T0[0, 3] = -P0[0]; T0[2, 3] = -P0[2]; G = Ry @ T0
    for b, M in raw.items(): link[b] = G @ M
    def depth(b):
        d = 0
        while b in parent: b = parent[b]; d += 1
        return d
    jorder = sorted(jointset, key=depth); jidx = {b: i for i, b in enumerate(jorder)}
    kpar = {}
    for b in jorder:
        p = parent.get(b)
        while p is not None and p not in jidx: p = parent.get(p)
        kpar[b] = p
    for b in jorder:                                                  # bones without a cluster (forearms): parent's orientation, child's position
        if b in link: continue
        kid = [k for k in jorder if kpar[k] == b and k in link][0]; M = link[kpar[b]].copy(); M[:3, 3] = link[kid][:3, 3]; link[b] = M
    print('joints', len(jorder))
    nodes = []; top = []; kids = {i: [] for i in range(len(jorder))}
    for b in jorder:
        L = (np.linalg.inv(link[kpar[b]]) if kpar[b] is not None else np.eye(4)) @ link[b]; q = quat(L[:3, :3] / np.linalg.norm(L[:3, :3], axis=0))
        nodes.append({'name': nm(models[b]), 'translation': [float(x) for x in L[:3, 3]], 'rotation': [float(x) for x in q]})
        if kpar[b] is None: top.append(jidx[b])
        else: kids[jidx[kpar[b]]].append(jidx[b])
    for i, k in kids.items():
        if k: nodes[i]['children'] = k
    # ---- meshes
    bin_ = bytearray(); views = []; accs = []; prims_by_mat = []
    def add(arr, ctype, typ, target=None, norm=False):
        arr = np.ascontiguousarray(arr); off = len(bin_); bin_.extend(arr.tobytes()); 
        while len(bin_) % 4: bin_.append(0)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes}); acc = {'bufferView': len(views) - 1, 'componentType': ctype, 'count': int(len(arr)), 'type': typ}
        if typ == 'VEC3' and ctype == 5126: acc['min'] = [float(x) for x in arr.min(0)]; acc['max'] = [float(x) for x in arr.max(0)]
        if typ == 'SCALAR' and ctype == 5126 and arr.size: acc['min'] = [float(arr.min())]; acc['max'] = [float(arr.max())]
        accs.append(acc); return len(accs) - 1
    mapping = [kv.split('=') for kv in a.map.split(',')]
    images = []; textures = []; materials = []; matidx = {}
    def mat_for(name):
        for sub, fn in mapping:
            if sub in name:
                if fn not in matidx:
                    im = Image.open(os.path.join(a.tex, fn)).convert('RGBA')
                    if fn.endswith('hair_tex.png') is False: im.putalpha(255)       # only hair uses its alpha (strand cut-outs)
                    buf = io.BytesIO(); im.save(buf, 'PNG'); off = len(bin_); bin_.extend(buf.getvalue())
                    while len(bin_) % 4: bin_.append(0)
                    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(buf.getvalue())}); images.append({'bufferView': len(views) - 1, 'mimeType': 'image/png'}); textures.append({'source': len(images) - 1})
                    m = {'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': len(textures) - 1}, 'metallicFactor': 0, 'roughnessFactor': 0.9}}
                    if fn.endswith('hair_tex.png'): m['alphaMode'] = 'MASK'
                    materials.append(m); matidx[fn] = len(materials) - 1
                return matidx[fn]
        return None
    meshes = []; mesh_nodes = []
    for mid, m in models.items():
        if nm(m) not in wanted or mid not in geo_of: continue
        g = byid[geo_of[mid]]; sk = byid[skin_of_geo[geo_of[mid]]]
        V = np.array(g.first('Vertices').props[0], float).reshape(-1, 3); PV = np.array(g.first('PolygonVertexIndex').props[0], np.int64)
        # polygons -> triangles (fan); keep polygon-vertex indices
        starts = [0]; polys = []; cur = []
        for i, v in enumerate(PV):
            cur.append(i)
            if v < 0: polys.append(cur); cur = []
        vi = np.where(PV < 0, -PV - 1, PV)
        def layer(name, dname, iname):
            le = g.first(name)
            if not le: return None
            mp = le.first('MappingInformationType').props[0]; rf = le.first('ReferenceInformationType').props[0]
            d = np.array(le.first(dname).props[0], float); ix = le.first(iname)
            d = d.reshape(len(d) // (3 if dname == 'Normals' else 2), -1) if dname in ('Normals', 'UV') else d
            idx = np.array(ix.props[0], np.int64) if ix is not None and rf == 'IndexToDirect' else None
            return mp, d, idx
        NR = layer('LayerElementNormal', 'Normals', 'NormalsIndex'); UVl = layer('LayerElementUV', 'UV', 'UVIndex')
        def per_pv(L, dim):
            mp, d, idx = L
            if mp == 'ByPolygonVertex': return (d[idx] if idx is not None else d)
            if mp == 'ByVertex' or mp == 'ByVertice': return (d[vi] if idx is None else d[idx[vi]])
            raise SystemExit('mapping ' + mp)
        nrm = per_pv(NR, 3); uv = per_pv(UVl, 2)
        mle = g.first('LayerElementMaterial'); mmp = mle.first('MappingInformationType').props[0]; mats_ = np.array(mle.first('Materials').props[0], np.int64)
        polymat = np.zeros(len(polys), np.int64) if mmp == 'AllSame' else mats_
        # bind transform + weights
        cls = cl_of_skin[sk.props[0]]; W = {}
        Mb = None
        for cid in cls:
            c = clusters[cid]; b = bone_of_cl.get(cid)
            if b is None or b not in jidx: continue
            Mb = np.array(c.first('Transform').props[0], float).reshape(4, 4).T
            ii = c.first('Indexes'); ww = c.first('Weights')
            if ii is None: continue
            for i_, w_ in zip(ii.props[0], ww.props[0]): W.setdefault(int(i_), []).append((jidx[b], float(w_)))
        if SHARED.get('Mb') is not None: Mb = SHARED['Mb']                    # all meshes share the first mesh's bind frame
        else: SHARED['Mb'] = Mb
        Mb = G @ Mb; Vw = (Mb[:3, :3] @ V.T).T + Mb[:3, 3]
        Nw = (Mb[:3, :3] @ nrm.T).T; Nw /= np.linalg.norm(Nw, axis=1, keepdims=True) + 1e-9
        J = np.zeros((len(V), 4), np.uint16); Wt = np.zeros((len(V), 4), np.float32)
        for vtx, lst in W.items():
            lst = sorted(lst, key=lambda x: -x[1])[:4]; s = sum(w for _, w in lst) or 1
            for k, (j_, w_) in enumerate(lst): J[vtx, k] = j_; Wt[vtx, k] = w_ / s
        # the mesh's bind matrix can sit in a different frame than the bone links (yawed by a multiple of 90 deg): find it from the skin weights themselves
        bcent = {}
        for vtx, lst in W.items():
            j_, w_ = max(lst, key=lambda x: x[1])
            if w_ > .6: bcent.setdefault(j_, []).append(vtx)
        cj = [(np.mean(Vw[v], 0), link[jorder[j_]][:3, 3]) for j_, v in bcent.items() if len(v) >= 15]
        best = SHARED.get('best')
        for kq in range(4 if best is None else 0):
            a_ = kq * np.pi / 2; c_, s_ = np.cos(a_), np.sin(a_); Rm = np.array([[c_, 0, s_], [0, 1, 0], [-s_, 0, c_]])
            t_ = np.mean([p - Rm @ c for c, p in cj], 0); err = sum(np.linalg.norm(Rm @ c + t_ - p) for c, p in cj)
            if best is None or err < best[0]: best = (err, Rm, t_, kq * 90)
        SHARED['best'] = best
        print('  mesh-to-skeleton yaw', best[3], 'deg, residual', round(best[0] / max(1, len(cj)), 3), 'per bone, shift', best[2].round(2))
        Vw = (best[1] @ Vw.T).T + best[2]; Nw = (best[1] @ Nw.T).T
        prims = []
        for mi in sorted(set(polymat.tolist())):
            tri = []
            for pi, pl in enumerate(polys):
                if polymat[pi] != mi: continue
                for k in range(1, len(pl) - 1): tri += [pl[0], pl[k], pl[k + 1]]
            tri = np.array(tri, np.int64)
            if not len(tri): continue
            # expand to unique (vertex, normal, uv) vertices
            key = np.concatenate([vi[tri][:, None].astype(float), np.round(Nw[tri], 4), np.round(uv[tri], 5)], 1)
            u, inv = np.unique(key, axis=0, return_inverse=True); first = np.zeros(len(u), np.int64); first[inv[::-1]] = np.arange(len(inv))[::-1]
            sel = tri[first]; cv = vi[sel]
            pos = Vw[cv].astype(np.float32); nr = Nw[sel].astype(np.float32); tc = uv[sel].astype(np.float32); tc[:, 1] = 1 - tc[:, 1]
            mname = [c_.props[1].split('\x00')[0] for s_, d_, p_ in conns if d_ == mid and s_ in byid and byid[s_].name == 'Material' for c_ in [byid[s_]]]
            mname = mname[int(mi)] if int(mi) < len(mname) else 'mat'
            mt = mat_for(mname)
            if mt is None: print('  skip material', mname); continue
            pr = {'attributes': {'POSITION': add(pos, 5126, 'VEC3'), 'NORMAL': add(nr, 5126, 'VEC3'), 'TEXCOORD_0': add(tc, 5126, 'VEC2'), 'JOINTS_0': add(J[cv], 5123, 'VEC4'), 'WEIGHTS_0': add(Wt[cv], 5126, 'VEC4')},
                  'indices': add(inv.astype(np.uint32).reshape(-1), 5125, 'SCALAR'), 'material': mt}
            prims.append(pr); print('  ', nm(m), mname, len(pos), 'verts', len(tri) // 3, 'tris')
        meshes.append({'name': nm(m), 'primitives': prims}); nodes.append({'name': nm(m), 'mesh': len(meshes) - 1, 'skin': 0}); mesh_nodes.append(len(nodes) - 1)
    ibm = np.array([np.linalg.inv(link[b]).T.reshape(16) for b in jorder], np.float32)
    ibm_acc = add(ibm.reshape(-1, 16), 5126, 'MAT4')
    # ---- animation
    stack = [c for c in ob.children if c.name == 'AnimationCurveNode']; curves = {c.props[0]: c for c in ob.children if c.name == 'AnimationCurve'}
    cn = {c.props[0]: c for c in stack}; chan = {}                    # model id -> {'T': {X:curve,...}}
    for s, d, p in conns:
        if s in curves and d in cn and p: chan.setdefault(d, {})[p.split('|')[-1]] = curves[s]
    tgt = {}
    for c in root.first('Connections').children:
        if c.props[0] == 'OP' and c.props[1] in cn and c.props[2] in models:
            k = {'Lcl Translation': 'T', 'Lcl Rotation': 'R', 'Lcl Scaling': 'S'}.get(c.props[3]); 
            if k: tgt.setdefault(c.props[2], {})[k] = c.props[1]
    tmax = 0
    def ev(curve, t):
        ks = np.array(curve.first('KeyTime').props[0], float) / KT; vs = np.array(curve.first('KeyValueFloat').props[0], float); return float(np.interp(t, ks, vs))
    for cid, ch in chan.items():
        for cv in ch.values(): tmax = max(tmax, float(np.array(cv.first('KeyTime').props[0], float).max() / KT))
    n = int(round(tmax * a.fps)) + 1; times = np.arange(n) / a.fps; print('animation', tmax, 's', n, 'frames,', len(tgt), 'animated nodes')
    samplers = []; channels = []
    tin = add(times.astype(np.float32).reshape(-1, 1), 5126, 'SCALAR')
    bindloc = {b: (np.linalg.inv(link[kpar[b]]) if kpar[b] is not None else np.eye(4)) @ link[b] for b in jorder}
    chainids = set(jorder)
    for b in jorder:
        x = parent.get(b)
        while x is not None: chainids.add(x); x = parent.get(x)
    order_all = sorted(chainids, key=depth)
    Tj = {b: np.zeros((n, 3)) for b in jorder}; Rj = {b: np.zeros((n, 4)) for b in jorder}
    Cfix = np.eye(4)                                                  # the animation's world frame may be yawed against the bind pose (FBX root nodes): remove that
    for f in range(n):
        W = {}
        for mid in order_all:
            m = models[mid]; pw = W.get(parent.get(mid), G if parent.get(mid) not in chainids else None)
            if parent.get(mid) is None: pw = G
            if mid in tgt:
                ov = {}
                for k, cnid in tgt[mid].items():
                    base = P(m, {'T': 'Lcl Translation', 'R': 'Lcl Rotation', 'S': 'Lcl Scaling'}[k], [0, 0, 0]).copy(); cc = chan.get(cnid, {})
                    for i_, ax in enumerate('XYZ'):
                        if ('d|' + ax) in cc or ax in cc: base[i_] = ev(cc.get('d|' + ax, cc.get(ax)), times[f])
                    ov[k] = base
                W[mid] = pw @ lcl(m, ov)
            elif mid in jidx:
                kp = kpar[mid]; W[mid] = (W[kp] @ bindloc[mid]) if kp is not None else (W[parent[mid]] @ lcl(m)) if False else (pw @ lcl(m))
            else: W[mid] = pw @ lcl(m)
        if f == 0:
            tl = [b for b in jorder if nm(models[b]) == 'Bip001 L Thigh'][0]; tr_ = [b for b in jorder if nm(models[b]) == 'Bip001 R Thigh'][0]; va = (W[tl][:3, 3] - W[tr_][:3, 3]); vb = (link[tl][:3, 3] - link[tr_][:3, 3]); ang = np.arctan2(vb[0], vb[2]) - np.arctan2(va[0], va[2]); print('animation yaw vs bind (deg):', round(float(np.degrees(ang)), 1))
            c, sn = np.cos(ang), np.sin(ang); Cfix[:3, :3] = np.array([[c, 0, sn], [0, 1, 0], [-sn, 0, c]]); Cfix[:3, 3] = link[pel][:3, 3] - Cfix[:3, :3] @ W[pel][:3, 3]; Cfix[1, 3] = 0
        for k_ in list(W): W[k_] = Cfix @ W[k_]
        for b in jorder:
            L = (np.linalg.inv(W[kpar[b]]) if kpar[b] is not None else np.eye(4)) @ W[b]
            Tj[b][f] = L[:3, 3]; q = quat(L[:3, :3] / np.linalg.norm(L[:3, :3], axis=0))
            if f and np.dot(q, Rj[b][f - 1]) < 0: q = -q
            Rj[b][f] = q
    for b in jorder:
        samplers.append({'input': tin, 'output': add(Tj[b].astype(np.float32), 5126, 'VEC3'), 'interpolation': 'LINEAR'}); channels.append({'sampler': len(samplers) - 1, 'target': {'node': jidx[b], 'path': 'translation'}})
        samplers.append({'input': tin, 'output': add(Rj[b].astype(np.float32), 5126, 'VEC4'), 'interpolation': 'LINEAR'}); channels.append({'sampler': len(samplers) - 1, 'target': {'node': jidx[b], 'path': 'rotation'}})
    gl_ = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': top + mesh_nodes}], 'nodes': nodes, 'skins': [{'joints': list(range(len(jorder))), 'inverseBindMatrices': ibm_acc, 'skeleton': top[0]}],
           'meshes': meshes, 'materials': materials, 'textures': textures, 'images': images, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(bin_)}],
           'animations': [{'name': a.anim, 'samplers': samplers, 'channels': channels}]}
    js = json.dumps(gl_, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4); bb = bytes(bin_) + b'\0' * (-len(bin_) % 4)
    open(a.out, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(bb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bb), 0x004E4942) + bb)
    print('wrote', a.out, len(js) + len(bb), 'bytes')
main()

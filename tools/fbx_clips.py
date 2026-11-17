#!/usr/bin/env python3
"""Bake animation-only Character-Creator-skeleton FBX files (CC_Base_* bones) into the game's direction clip format and append them to
assets/models.pack + data/models.json.   python3 tools/fbx_clips.py --prefix M: file1.fbx file2.fbx ...
Same clip layout as add_glb_clips.py: n*45 bone-pair directions in the pelvis frame, n*4 pelvis quaternion, n pelvis height ratio."""
import sys, os, json, zlib, struct, argparse
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbxparse import parse
def rotm(e, order='XYZ'):
    r = np.radians(e)
    def ax(a, t):
        c, s = np.cos(t), np.sin(t)
        return {'X': np.array([[1, 0, 0], [0, c, -s], [0, s, c]]), 'Y': np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]]), 'Z': np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])}[a]
    M = np.eye(3)
    for a in order: M = ax(a, r['XYZ'.index(a)]) @ M
    return M
KT = 46186158000.0
MAP = {'Bip001 Pelvis': 'CC_Base_Pelvis', 'Bip001 Spine': 'CC_Base_Waist', 'Bip001 Spine1': 'CC_Base_Spine01', 'Bip001 Spine2': 'CC_Base_Spine02', 'Bip001 Neck': 'CC_Base_NeckTwist01', 'Bip001 Head': 'CC_Base_Head',
       'Bip001 L Clavicle': 'CC_Base_L_Clavicle', 'Bip001 L UpperArm': 'CC_Base_L_Upperarm', 'Bip001 L Forearm': 'CC_Base_L_Forearm', 'Bip001 L Hand': 'CC_Base_L_Hand',
       'Bip001 R Clavicle': 'CC_Base_R_Clavicle', 'Bip001 R UpperArm': 'CC_Base_R_Upperarm', 'Bip001 R Forearm': 'CC_Base_R_Forearm', 'Bip001 R Hand': 'CC_Base_R_Hand',
       'Bip001 L Thigh': 'CC_Base_L_Thigh', 'Bip001 L Calf': 'CC_Base_L_Calf', 'Bip001 L Foot': 'CC_Base_L_Foot', 'Bip001 R Thigh': 'CC_Base_R_Thigh', 'Bip001 R Calf': 'CC_Base_R_Calf', 'Bip001 R Foot': 'CC_Base_R_Foot'}
def nm(c): return c.props[1].split('\x00')[0]
def qfrom(Rm):
    t = np.trace(Rm)
    if t > 0: s = np.sqrt(t + 1) * 2; w, x, y, z = s / 4, (Rm[2, 1] - Rm[1, 2]) / s, (Rm[0, 2] - Rm[2, 0]) / s, (Rm[1, 0] - Rm[0, 1]) / s
    elif Rm[0, 0] > Rm[1, 1] and Rm[0, 0] > Rm[2, 2]: s = np.sqrt(1 + Rm[0, 0] - Rm[1, 1] - Rm[2, 2]) * 2; w, x, y, z = (Rm[2, 1] - Rm[1, 2]) / s, s / 4, (Rm[0, 1] + Rm[1, 0]) / s, (Rm[0, 2] + Rm[2, 0]) / s
    elif Rm[1, 1] > Rm[2, 2]: s = np.sqrt(1 + Rm[1, 1] - Rm[0, 0] - Rm[2, 2]) * 2; w, x, y, z = (Rm[0, 2] - Rm[2, 0]) / s, (Rm[0, 1] + Rm[1, 0]) / s, s / 4, (Rm[1, 2] + Rm[2, 1]) / s
    else: s = np.sqrt(1 + Rm[2, 2] - Rm[0, 0] - Rm[1, 1]) * 2; w, x, y, z = (Rm[1, 0] - Rm[0, 1]) / s, (Rm[0, 2] + Rm[2, 0]) / s, (Rm[1, 2] + Rm[2, 1]) / s, s / 4
    q = np.array([w, x, y, z]); q /= np.linalg.norm(q); return q if q[0] >= 0 else -q
def load(path):
    root, ver = parse(path); ob = root.first('Objects'); byid = {c.props[0]: c for c in ob.children}
    models = {c.props[0]: c for c in ob.children if c.name == 'Model'}; conns = [(c.props[0], c.props[1], c.props[2], c.props[3] if len(c.props) > 3 else '') for c in root.first('Connections').children]
    parent = {s: d for k, s, d, p in conns if s in models and d in models}
    curves = {c.props[0]: c for c in ob.children if c.name == 'AnimationCurve'}; cn = {c.props[0] for c in ob.children if c.name == 'AnimationCurveNode'}
    chan = {}
    for k, s, d, p in conns:
        if s in curves and d in cn and p: chan.setdefault(d, {})[p.split('|')[-1]] = curves[s]
    tgt = {}
    for k, s, d, p in conns:
        if k == 'OP' and s in cn and d in models and p in ('Lcl Translation', 'Lcl Rotation', 'Lcl Scaling'): tgt.setdefault(d, {})[{'Lcl Translation': 'T', 'Lcl Rotation': 'R', 'Lcl Scaling': 'S'}[p]] = s
    clusters = [c for c in ob.children if c.name == 'Deformer' and c.props[2] == 'Cluster']; bone_of_cl = {s: d for k, s, d, p in conns if s in {c.props[0] for c in clusters} and d in models} if False else {}
    for k, s, d, p in conns:
        if d in {c.props[0] for c in clusters} and s in models: bone_of_cl[d] = s
    bind = {}
    for c in clusters:
        b = bone_of_cl.get(c.props[0])
        if b is not None: bind[nm(models[b])] = np.array(c.first('TransformLink').props[0], float).reshape(4, 4).T
    return dict(models=models, parent=parent, chan=chan, tgt=tgt, bind=bind)
def P(m, key, default):
    pr = m.first('Properties70')
    for p in (pr.children if pr else []):
        if p.props[0] == key: return np.array(p.props[4:7], float) if len(p.props) >= 7 else p.props[4]
    return np.array(default, float)
def lcl(m, ov):
    t = ov.get('T', P(m, 'Lcl Translation', [0, 0, 0])); r = ov.get('R', P(m, 'Lcl Rotation', [0, 0, 0])); s = ov.get('S', P(m, 'Lcl Scaling', [1, 1, 1]))
    pre = P(m, 'PreRotation', [0, 0, 0]); post = P(m, 'PostRotation', [0, 0, 0]); M = np.eye(4); M[:3, :3] = (rotm(pre) @ rotm(r) @ rotm(post).T) @ np.diag(s); M[:3, 3] = t; return M
def ev(curve, t): return float(np.interp(t, np.array(curve.first('KeyTime').props[0], float) / KT, np.array(curve.first('KeyValueFloat').props[0], float)))
def run(path, prefix, pairs, ystand=None):
    A = load(path); models, parent, chan, tgt = A['models'], A['parent'], A['chan'], A['tgt']; byname = {nm(m): i for i, m in models.items()}
    need = set(byname[v] for v in MAP.values() if v in byname)
    chain = set(need)
    for b in list(need):
        x = parent.get(b)
        while x is not None: chain.add(x); x = parent.get(x)
    depth = lambda b: 0 if b not in parent else 1 + depth(parent[b])
    order = sorted(chain, key=depth)
    tmax = max(float(np.array(cv.first('KeyTime').props[0], float).max() / KT) for ch in chan.values() for cv in ch.values()); n = int(round(tmax * 30)) + 1
    def worlds(t):
        W = {}
        for mid in order:
            ov = {}
            for k, cnid in tgt.get(mid, {}).items():
                base = P(models[mid], {'T': 'Lcl Translation', 'R': 'Lcl Rotation', 'S': 'Lcl Scaling'}[k], [0, 0, 0]).copy(); cc = chan.get(cnid, {})
                for i_, ax in enumerate('XYZ'):
                    if ax in cc: base[i_] = ev(cc[ax], t)
                ov[k] = base
            M = lcl(models[mid], ov); W[mid] = (W[parent[mid]] @ M) if parent.get(mid) in W else M
        return W
    pel = byname[MAP['Bip001 Pelvis']]
    Wr = worlds(0.0)                                      # rest frame = upright, facing +z, yawed to match the clip's first frame (pelvis tilt stays in the clip)
    hip = Wr[byname['CC_Base_L_Thigh']][:3, 3] - Wr[byname['CC_Base_R_Thigh']][:3, 3]; yaw = np.arctan2(-hip[2], hip[0]); c_, s_ = np.cos(yaw), np.sin(yaw)
    Rrest = np.array([[c_, 0, s_], [0, 1, 0], [-s_, 0, c_]])
    out = {}
    D = np.zeros((n, 45), np.float32); Q = np.zeros((n, 4), np.float32); Y = np.zeros(n, np.float32); y0 = ystand
    for f in range(n):
        W = worlds(min(f / 30, tmax)); Rp = W[pel][:3, :3] / np.linalg.norm(W[pel][:3, :3], axis=0)
        if y0 is None: y0 = W[pel][1, 3]
        qrel = Rp @ Rrest.T; Q[f] = qfrom(qrel); Y[f] = W[pel][1, 3] / y0
        for pi, (p, c) in enumerate(pairs):
            if MAP[p] not in byname or MAP[c] not in byname: continue
            d = W[byname[MAP[c]]][:3, 3] - W[byname[MAP[p]]][:3, 3]; d = d / (np.linalg.norm(d) + 1e-9); D[f, pi * 3:pi * 3 + 3] = qrel.T @ d
    return n, D, Q, Y, y0
if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--prefix', default='M:'); ap.add_argument('--root', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); ap.add_argument('--dry', action='store_true')
    a = ap.parse_args(); R = a.root
    mj = json.load(open(R + '/data/models.json')); pairs = mj['anims']['meta']['pairs']
    pk = os.path.join(R, 'assets/models.pack'); b = open(pk, 'rb').read(); hl = struct.unpack('<I', b[:4])[0]; hdr = json.loads(b[4:4 + hl]); base = 4 + hl
    files = {k: b[base + o:base + o + l] for k, (o, l) in hdr.items()}; old = bytearray(zlib.decompress(files['anims.bin'])); added = {}
    ys = run([f for f in a.files if os.path.basename(f).startswith('Idle')][0], a.prefix, pairs)[4]      # standing pelvis height = the plain Idle
    for fp in a.files:
        n, D, Q, Y, _ = run(fp, a.prefix, pairs, ys); name = os.path.splitext(os.path.basename(fp))[0]
        print(name, n, 'frames  pelvis-up-dir y at f0:', np.round(D[0, 24:27], 3), ' L thigh->calf:', np.round(D[0, 12:15], 3), ' Y range', Y.min().round(3), Y.max().round(3))
        blob = np.concatenate([np.round(D.reshape(-1) * 32767), np.round(Q.reshape(-1) * 32767), np.round(Y * 10000)]).astype('<i2').tobytes()
        key = a.prefix + name; added[key] = {'n': n, 'fps': 30, 'o': len(old)}; old += blob
    if not a.dry:
        files['anims.bin'] = zlib.compress(bytes(old), 9); mj['anims']['meta']['clips'].update(added); json.dump(mj, open(R + '/data/models.json', 'w'), separators=(',', ':'))
        hdr = {}; off = 0; body = b''
        for k, v in files.items(): hdr[k] = [off, len(v)]; off += len(v); body += v
        h = json.dumps(hdr, separators=(',', ':')).encode(); open(pk, 'wb').write(struct.pack('<I', len(h)) + h + body)

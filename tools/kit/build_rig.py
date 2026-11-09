"""Build the creator's modular characters from the uploaded models.

Every character is ONE canonical Bip001 rig (the one the game's animation system drives) plus swappable parts:
  base_<name>  headless body + clothing layers, skinned to the canonical skeleton (VRM rigs are remapped, XPS rigs already are Bip001)
  head_<name>  a rigid head kit (face skin + eyes + brows + mouth, and hair), in a normalised head space, one joint
At runtime the game fits any kit onto any base (game.js buildHead), so faces and hairstyles mix freely with every body.

usage: build_rig.py <scratchpad> <out dir>"""
import sys, os, re, io, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import xps as XPS
from engine_model import write_model
from build_mannequin import canonical_skeleton, KEEP

SP = None
SKIN_RE = re.compile(r'Face_\d+_SKIN|Face_00_SKIN', re.I)

# ---------------------------------------------------------------- glTF (VRM) reader
def load_glb(path):
    sys.path.insert(0, os.path.join(SP, 'scripts'))
    from gltf_reader import GLTF
    g = GLTF(path); j = g.j; cache = {}
    def img(mat):
        pbr = mat.get('pbrMetallicRoughness', {}); bt = pbr.get('baseColorTexture')
        if bt is None:
            f = pbr.get('baseColorFactor', [.7, .7, .7, 1]); return Image.new('RGBA', (8, 8), tuple(int(c * 255) for c in f[:3]) + (255,))
        src = j['textures'][bt['index']]['source']
        if src not in cache:
            im = j['images'][src]; data = open(os.path.join(g.dir, im['uri']), 'rb').read() if 'uri' in im else g.view_bytes(im['bufferView'])[0]
            cache[src] = Image.open(io.BytesIO(data)).convert('RGBA')
        return cache[src]
    sk = j.get('skins', [None])[0]; jn = [j['nodes'][i].get('name', '') for i in sk['joints']] if sk else []
    jpos = None
    if sk:
        ibm = g.accessor(sk['inverseBindMatrices']).reshape(-1, 4, 4).astype(np.float64); jpos = np.array([np.linalg.inv(m.T)[:3, 3] for m in ibm])   # joint bind position = translation of inverse(IBM); VRM arm bones are rotated
    par_node = g.parents(); joint_nodes = sk['joints'] if sk else []; nodeidx = {n: i for i, n in enumerate(joint_nodes)}
    jpar = [nodeidx.get(par_node[n], -1) if par_node[n] is not None and par_node[n] >= 0 else -1 for n in joint_nodes]
    parts = []
    for ni, nd in enumerate(j['nodes']):
        if 'mesh' not in nd: continue
        for pr in j['meshes'][nd['mesh']]['primitives']:
            a = pr['attributes']; P = g.accessor(a['POSITION']).astype(np.float64)
            N = g.accessor(a['NORMAL']).astype(np.float64) if 'NORMAL' in a else np.zeros_like(P)
            UV = g.accessor(a['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in a else np.zeros((len(P), 2))
            ix = g.accessor(pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(P))
            mat = j['materials'][pr['material']] if 'material' in pr else {}
            JJ = g.accessor(a['JOINTS_0']).astype(np.int64) if 'JOINTS_0' in a else None; WW = g.accessor(a['WEIGHTS_0']).astype(np.float64) if 'WEIGHTS_0' in a else None
            if 'skin' not in nd:
                W = g.world(ni, par_node); P = (W[:3, :3] @ P.T).T + W[:3, 3]; N = (W[:3, :3] @ N.T).T
            parts.append(dict(name=mat.get('name', nd.get('name', '')), P=P, N=N, UV=UV, F=ix.reshape(-1, 3), J=JJ, W=WW, img=img(mat), mat=mat))
    return dict(parts=parts, jn=jn, jpos=jpos, jpar=jpar)

# ---------------------------------------------------------------- helpers
def small(im, m):
    if max(im.size) > m: im = im.resize((m, m) if im.size[0] == im.size[1] else (m, int(im.size[1] * m / im.size[0])), Image.LANCZOS)
    return im
def skin_base(img, UV, P=None):
    """mean colour (0..1) of the texels a skin mesh actually uses; the runtime divides the chosen skin colour by this so every skin reads the same"""
    a = np.asarray(img.convert('RGB'), np.float64) / 255; h, w = a.shape[:2]
    u = np.clip((UV[:, 0] % 1) * (w - 1), 0, w - 1).astype(int); v = np.clip((UV[:, 1] % 1) * (h - 1), 0, h - 1).astype(int)
    c = a[v, u]; lum = c.mean(1); keep = lum > .25
    return [float(x) for x in (c[keep].mean(0) if keep.sum() > 20 else c.mean(0))]
def normals(P, F):
    N = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(N, F[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
def sub_mesh(part, tri_mask):
    F = part['F'][tri_mask]; used = np.unique(F); remap = -np.ones(len(part['P']), np.int64); remap[used] = np.arange(len(used))
    q = {k: (part[k][used] if part.get(k) is not None and k in ('P', 'N', 'UV', 'J', 'W') else part.get(k)) for k in part}; q['F'] = remap[F]; return q

class Pack:
    def __init__(s): s.tex = []; s.key = {}
    def add(s, im, size):
        k = (id(im), size)
        if k not in s.key: s.key[k] = len(s.tex); s.tex.append(small(im, size))
        return s.key[k]

def save(out, key, names, par, wp, prims, texs, extra):
    meta, info, binz, texb = write_model(out, key, names, par, wp, prims, texs); info.update(extra); meta['kit'] = dict(extra, sb=[p.get('sb') for p in prims])
    os.makedirs(out, exist_ok=True); open(os.path.join(out, key + '.bin'), 'wb').write(binz)
    json.dump(meta, open(os.path.join(out, key + '.meta.json'), 'w'), separators=(',', ':')); json.dump(info, open(os.path.join(out, key + '.info.json'), 'w'), separators=(',', ':'))
    for i, t in enumerate(texb): open(os.path.join(out, '%s.t%d.webp' % (key, i)), 'wb').write(t)
    print('%-16s %6d verts %2d tex %5d KB  %s' % (key, info['verts'], info['tex'], info['bin_kb'] + sum(len(t) for t in texb) // 1024, [p['mat'] for p in prims]))

# ---------------------------------------------------------------- canonical mapping for VRM rigs
VMAP = {'Hips': 'Pelvis', 'Spine': 'Spine', 'Chest': 'Spine1', 'UpperChest': 'Spine2', 'Neck': 'Neck', 'Head': 'Head'}
for s, S in (('L', 'L'), ('R', 'R')):
    VMAP.update({s + '_Shoulder': S + ' Clavicle', s + '_UpperArm': S + ' UpperArm', s + '_LowerArm': S + ' Forearm', s + '_Hand': S + ' Hand', s + '_UpperLeg': S + ' Thigh', s + '_LowerLeg': S + ' Calf', s + '_Foot': S + ' Foot'})
    for fi, fn in enumerate(['Thumb', 'Index', 'Middle', 'Ring', 'Little']):
        for k, suf in ((1, ''), (2, '1'), (3, '2')): VMAP['%s_%s%d' % (s, fn, k)] = '%s Finger%d%s' % (S, fi, suf)
def vrm_canon(vn):
    m = re.match(r'J_Bip_([CLR]_\w+?)_\d+$', vn)
    k = m.group(1)[2:] if m and m.group(1).startswith('C_') else (m.group(1) if m else None)
    return 'Bip001 ' + VMAP[k] if k in VMAP else None

def build_vrm(name, path, out, hair_re, label):
    G = load_glb(path); cn, cpar, cpos = canonical_skeleton(); cid = {n: i for i, n in enumerate(cn)}
    jn = G['jn']; jp = G['jpos']; jpar = G['jpar']
    vmap = {}
    for i, n in enumerate(jn):
        c = vrm_canon(n)
        if c in cid: vmap[c] = i
    # facing: forward is the side the foot extends toward; flip so the model faces +Z
    P = np.concatenate([p['P'] for p in G['parts']]); flip = 1.0
    heel = jp[vmap['Bip001 L Foot']]; face = [p for p in G['parts'] if re.search('FaceMouth|Face_00_SKIN', p['name'])]
    fz = np.concatenate([p['P'] for p in face])[:, 2].mean(); hz = jp[vmap['Bip001 Head']][2]
    if fz < hz - 0.001: flip = -1.0
    lx = jp[vmap['Bip001 L UpperArm']][0] * flip
    if lx < 0: print('  WARNING', name, 'left side is -x after facing fix; mirroring not implemented')
    def fl(A): A = A.copy(); A[..., 0] *= flip; A[..., 2] *= flip; return A
    jp = fl(jp)
    # canonical skeleton positions from the model (missing joints: scaled canonical offsets from the parent)
    sc = (jp[vmap['Bip001 Head']][1] - 0) / (cpos[cid['Bip001 Head']][1] - 0 if cpos[cid['Bip001 Head']][1] else 1)
    pos = np.zeros_like(cpos)
    for n, i in cid.items():
        if n in vmap: pos[i] = jp[vmap[n]]
    for n, i in cid.items():
        if n in vmap: continue
        p = cpar[i]; pos[i] = pos[p] + (cpos[i] - cpos[p]) * sc if p >= 0 else cpos[i] * sc
    # canonical weights: every VRM joint maps to itself or its nearest mapped ancestor
    to_c = {}
    for i, n in enumerate(jn):
        a = i
        while a >= 0 and vrm_canon(jn[a]) not in cid: a = jpar[a]
        to_c[i] = cid[vrm_canon(jn[a])] if a >= 0 else cid['Bip001 Pelvis']
    tc = np.array([to_c[i] for i in range(len(jn))])
    # head anchor + skin top
    headb = pos[cid['Bip001 Head']]
    parts = G['parts']; texp = Pack()
    skin_face = [p for p in parts if re.search('Face_00_SKIN', p['name'])]
    top = max(fl(p['P'])[:, 1].max() for p in skin_face); H = top - headb[1]
    bprims = []; hprims = []; ptexb = Pack(); ptexh = Pack(); parts_info = []; sbody = None
    for p in parts:
        n = p['name']; Pp = fl(p['P']); Nn = fl(p['N'])
        isface = bool(re.search(r'Face|Eye', n)); ishair = bool(re.search(hair_re, n)); isbody = re.search(r'Body_00_SKIN', n)
        if isface or ishair:
            # head kit: rigid, normalised: origin at the head joint, unit = head height
            cls = 'Body.face' if SKIN_RE.search(n) else ('Hair' if ishair else re.sub(r'N00_\d+_\d+_|_Instance.*', '', n))
            if 'FaceBrow' in n: cls = 'Hair.brow'
            elif 'Eyeline' in n: cls = 'Hair.lash'
            elif 'FaceMouth' in n: cls = 'Mouth'
            elif 'EyeIris' in n: cls = 'Eye.iris'
            elif 'EyeWhite' in n: cls = 'Eye.white'
            elif 'EyeHighlight' in n: cls = 'Eye.hl'
            Pk = (Pp - headb) / H
            m = {'mat': cls, 'pos': Pk, 'nrm': Nn, 'uv': p['UV'], 'F': p['F']}
            hprims.append((m, p['img'], p)); continue
        # body parts
        if isbody: cls = 'Body'
        elif re.search('Bottoms', n): cls = 'Bottom'
        elif re.search('Tops', n): cls = 'Top'
        elif re.search('Shoes', n): cls = 'Shoes'
        else: cls = 'Top2'
        JJ = tc[p['J']]; WW = p['W'].copy()
        # merge duplicate canonical joints per vertex
        jj = np.zeros((len(Pp), 4), np.int64); ww = np.zeros((len(Pp), 4))
        for v in range(len(Pp)):
            acc = {}
            for k in range(4):
                if WW[v, k] > 0: acc[JJ[v, k]] = acc.get(JJ[v, k], 0) + WW[v, k]
            for k, (b, w) in enumerate(sorted(acc.items(), key=lambda t: -t[1])[:4]): jj[v, k] = b; ww[v, k] = w
        bprims.append(dict(mat=cls, tex=ptexb.add(p['img'], 1024 if cls != 'Body' else 512), pos=Pp, nrm=Nn, uv=p['UV'], jj=jj, ww=ww, ix=p['F'].reshape(-1), sb=skin_base(p['img'], p['UV']) if cls == 'Body' else None))
    # feet on the ground
    allp = np.concatenate([p['pos'] for p in bprims]); dy = -allp[:, 1].min()
    for p in bprims: p['pos'] = p['pos'] + np.array([0, dy, 0])
    pos[:, 1] += dy; headb2 = headb + np.array([0, dy, 0])
    cls_seen = []
    for p in bprims:
        if p['mat'] not in ('Body', 'Shoes'): parts_info.append(p['mat'])
    info_b = dict(bodyHeight=float(headb2[1] + H), head=[float(x) for x in headb2], headH=float(H), parts=sorted(set(parts_info)), label=label)
    for p in bprims: p['sb'] = p.get('sb')
    save(out, 'base_' + name, cn, cpar, pos, bprims, ptexb.tex, info_b)
    write_kit(out, 'head_' + name, hprims, H, label, ptexh)

def write_kit(out, key, hprims, H, label, ptex, skin_only_top=None):
    """hprims: list of (mesh dict, image, source part) already in head space (origin head joint, unit = head height)"""
    prims = []; skinp = [m for m, _, _ in hprims if m['mat'] == 'Body.face']
    allsk = np.concatenate([m['pos'] for m in skinp]); lo = allsk.min(0); hi = allsk.max(0)
    for m, im, p in hprims:
        P = m['pos']; F = m['F']
        # drop neck triangles of the face mesh below the head joint (the body supplies the neck)
        keep = np.ones(len(F), bool)
        if m['mat'] == 'Body.face': keep = (P[F][:, :, 1].max(1) > -0.06)
        F2 = F[keep]; used = np.unique(F2); rm = -np.ones(len(P), np.int64); rm[used] = np.arange(len(used))
        sb = skin_base(im, m['uv']) if m['mat'] == 'Body.face' else None
        mx = {1: 1024}.get(1)
        size = 1024 if m['mat'].startswith(('Body', 'Hair')) and not m['mat'].startswith('Hair.') else 512
        prims.append(dict(mat=m['mat'], tex=ptex.add(im, size), pos=P[used], nrm=m['nrm'][used], uv=m['uv'][used], jj=np.zeros((len(used), 4), np.int64), ww=np.tile([1., 0, 0, 0], (len(used), 1)), ix=rm[F2].reshape(-1), sb=sb))
    skp = [p for p in prims if p['mat'] == 'Body.face']; sk = np.concatenate([p['pos'] for p in skp]); lo = sk.min(0); hi = sk.max(0)
    info = dict(label=label, hw=float((hi[0] - lo[0]) / 2), cx=float((hi[0] + lo[0]) / 2), zmin=float(lo[2]), hd=float(hi[2] - lo[2]), ymin=float(lo[1]), ytop=float(hi[1]))
    save(out, key, ['Head'], [-1], np.zeros((1, 3)), prims, ptex.tex, info)

def build_xps(name, d, pat, out, label):
    x = XPS.read_xps(os.path.join(SP, d, 'xps.xps')); B = x['bones']
    names = [b[0] for b in B]; par = [b[1] for b in B]; pos = np.array([b[2] for b in B], np.float64); hi = names.index('Bip001 Head'); headb = pos[hi].copy()
    ptexb = Pack(); ptexh = Pack(); bprims = []; hprims = []; ymin = min(m['P'][:, 1].min() for m in x['meshes'] if not re.search('knife|weapon|bomb', m['name'], re.I))
    _ac = {}
    def atlas(n):
        if n not in _ac: _ac[n] = Image.open(os.path.join(SP, d, pat % n)).convert('RGBA')
        return _ac[n]
    face = [m for m in x['meshes'] if re.search('face', m['name'], re.I)][0]; top = face['P'][:, 1].max(); H = top - headb[1]
    for m in x['meshes']:
        n = m['name']
        if re.search('knife|weapon|bomb|blade', n, re.I): continue
        P = m['P'].astype(np.float64); N = m['N'].astype(np.float64); F = m['F'].astype(np.int64)
        if re.search('face', n, re.I):
            hprims.append(({'mat': 'Body.face', 'pos': (P - headb) / H, 'nrm': N, 'uv': m['UV'], 'F': F}, atlas('face'), None))
        elif re.search('hair', n, re.I):
            hprims.append(({'mat': 'Hair', 'pos': (P - headb) / H, 'nrm': N, 'uv': m['UV'], 'F': F}, atlas('hair'), None))
        else:
            cls = 'Body' if re.search('hand|arm', n, re.I) else ('Shoes' if 'boot' in n.lower() else 'Top')
            im = atlas('body'); bprims.append(dict(mat=cls, tex=ptexb.add(im, 1024), pos=P, nrm=N, uv=m['UV'], jj=np.clip(m['BI'], 0, len(names) - 1), ww=m['BW'], ix=F.reshape(-1), sb=skin_base(im, m['UV']) if cls == 'Body' else None))
    dy = -ymin
    for p in bprims: p['pos'] = p['pos'] + np.array([0, dy, 0])
    pos[:, 1] += dy; headb2 = headb + np.array([0, dy, 0])
    save(out, 'base_' + name, names, par, pos, bprims, ptexb.tex, dict(bodyHeight=float(headb2[1] + H), head=[float(v) for v in headb2], headH=float(H), parts=[], label=label))
    write_kit(out, 'head_' + name, hprims, H, label, ptexh)


def static_kit(name, path, out, label, face_re, hair_re, eye_re=None, cut=None):
    """head kit from a model that has no skeleton: the head joint is estimated from the face skin box using the ratios measured on the rigged VRM models"""
    G = load_glb(path); parts = G['parts']; C_Y, C_Z = 0.15, -0.18
    sk = [p for p in parts if re.search(face_re, p['name'])][0]
    if cut is not None:                                    # face lives inside the body mesh: keep only triangles above the neck line
        F = sk['F']; sk = sub_mesh(sk, sk['P'][F][:, :, 1].min(1) > cut)
    P = sk['P']; top = P[:, 1].max(); chin = P[:, 1].min(); hy = chin + C_Y * (top - chin); H = top - hy
    cx = (P[:, 0].min() + P[:, 0].max()) / 2; hz = (P[:, 2].min() + P[:, 2].max()) / 2 + C_Z * (top - chin); headb = np.array([cx, hy, hz])
    hprims = []; ptex = Pack()
    def kp(q): return dict(pos=(q['P'] - headb) / H, nrm=q['N'], uv=q['UV'], F=q['F'])
    hprims.append((dict(kp(sk), mat='Body.face'), sk['img'], sk))
    for q in parts:
        n = q['name']
        if q is not sk and re.search(hair_re, n) and (cut is None or q['P'][:, 1].min() > cut - 0.2):
            hprims.append((dict(kp(q), mat='Hair'), q['img'], q))
        elif q is not sk and eye_re and re.search(eye_re, n):
            cls = 'Mouth' if 'Mouth' in n else 'Hair.brow' if 'Brow' in n else 'Hair.lash' if re.search('Eyeline|Eyelash', n) else 'Eye.white' if 'EyeWhite' in n else 'Eye.hl' if 'Highlight' in n else 'Eye.iris' if 'Iris' in n else 'Eye'
            hprims.append((dict(kp(q), mat=cls), q['img'], q))
    write_kit(out, 'head_' + name, hprims, H, label, ptex)

if __name__ == '__main__':
    SP = sys.argv[1]; out = sys.argv[2]; only = sys.argv[3:] 
    jobs = {
      'furlan': lambda: build_xps('furlan', 'ex_church/AoTWA - Furlan Church', 'role_falan_%s_tex.png', out, 'Furlan'),
      'isabel': lambda: build_xps('isabel', 'ex_isabel/AoTWA - Isabel Magnolia', 'role_yishabeier_%s_tex.png', out, 'Isabel'),
      'tomako': lambda: build_vrm('tomako', os.path.join(SP, 'models/tomako.glb'), out, r'Hair', 'Tomako'),
      'loud': lambda: build_vrm('loud', os.path.join(SP, 'models/loud.glb'), out, r'Hair', 'Loud'),
      'akane': lambda: static_kit('akane', os.path.join(SP, 'models/akane.glb'), out, 'Akane', r'Face_00_SKIN', r'Hair', r'Eye|FaceMouth|FaceBrow|FaceEye'),
      'medieval': lambda: static_kit('medieval', os.path.join(SP, 'models/medieval_girl.glb'), out, 'Medieval', r'face_mat', r'hair_mat', r'^eyes$'),
      'benimaru': lambda: static_kit('benimaru', os.path.join(SP, 'models/benimaru.glb'), out, 'Benimaru', r'^Body$', r'^Hair$', None, cut=0.09),
      'anime': lambda: build_vrm('anime', os.path.join(SP, 'models/anime3d.glb'), out, r'Hair', 'Anime'),
    }
    for k, f in jobs.items():
        if not only or k in only: f()

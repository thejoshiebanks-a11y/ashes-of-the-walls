"""Build the anime-boy bases used by the character creator.
  python3 tools/teen/build_bases.py --src <folder with the 5 supplied models> --boy assets/boy --out assets
Reads the supplied models (VRoid-style .glb/.gltf rigs), converts each to the engine's 24-joint Bip001 skeleton (same as build_boy.py),
re-fits the shared outfits (Village, Traveller armour, Scout uniform, ODM gear, red Dragon robe) and trades hairstyles between bases,
then writes assets/<key>/<key>.{bin,meta.json,info.json,tN.webp}. The original anime boy pack (assets/boy) is read, extended and rewritten."""
import argparse, io, json, os, re, sys, zlib
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gltf_reader import GLTF
from engine_model import write_model
from fit_outfit import Fit
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

OUT = ['Bip001 Pelvis', 'Bip001 L Thigh', 'Bip001 L Calf', 'Bip001 L Foot', 'Bip001 L Toe0', 'Bip001 R Thigh', 'Bip001 R Calf', 'Bip001 R Foot', 'Bip001 R Toe0', 'Bip001 Spine', 'Bip001 Spine1', 'Bip001 Spine2',
       'Bip001 L Clavicle', 'Bip001 L UpperArm', 'Bip001 L Forearm', 'Bip001 L Hand', 'Bip001 Neck', 'Bip001 Head', 'Bip001 HeadNub', 'Bip001 HeadFront', 'Bip001 R Clavicle', 'Bip001 R UpperArm', 'Bip001 R Forearm', 'Bip001 R Hand']
PARENTS = [-1, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 12, 13, 14, 11, 16, 17, 17, 11, 20, 21, 22]
SHORT = [o[7:] for o in OUT]
VRM = dict(zip(SHORT, ['J_Bip_C_Hips', 'J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg', 'J_Bip_L_Foot', 'J_Bip_L_ToeBase', 'J_Bip_R_UpperLeg', 'J_Bip_R_LowerLeg', 'J_Bip_R_Foot', 'J_Bip_R_ToeBase', 'J_Bip_C_Spine', 'J_Bip_C_Chest', 'J_Bip_C_UpperChest',
                       'J_Bip_L_Shoulder', 'J_Bip_L_UpperArm', 'J_Bip_L_LowerArm', 'J_Bip_L_Hand', 'J_Bip_C_Neck', 'J_Bip_C_Head', None, None, 'J_Bip_R_Shoulder', 'J_Bip_R_UpperArm', 'J_Bip_R_LowerArm', 'J_Bip_R_Hand']))
MIX = dict(zip(SHORT, ['Hips', 'Left leg', 'Left knee', 'Left ankle', 'Left toe', 'Right leg', 'Right knee', 'Right ankle', 'Right toe', 'Spine', 'Chest', None,
                       'Left shoulder', 'Left arm', 'Left elbow', 'Left wrist', 'Neck', 'Head', None, None, 'Right shoulder', 'Right arm', 'Right elbow', 'Right wrist']))
CC = dict(zip(SHORT, ['CC_Base_Pelvis', 'CC_Base_L_Thigh', 'CC_Base_L_Calf', 'CC_Base_L_Foot', 'CC_Base_L_ToeBase', 'CC_Base_R_Thigh', 'CC_Base_R_Calf', 'CC_Base_R_Foot', 'CC_Base_R_ToeBase', 'CC_Base_Waist', 'CC_Base_Spine01', 'CC_Base_Spine02',
                      'CC_Base_L_Clavicle', 'CC_Base_L_Upperarm', 'CC_Base_L_Forearm', 'CC_Base_L_Hand', 'CC_Base_NeckTwist01', 'CC_Base_Head', None, None, 'CC_Base_R_Clavicle', 'CC_Base_R_Upperarm', 'CC_Base_R_Forearm', 'CC_Base_R_Hand']))
HEAD_Y = 1.6565551757812   # head joint height of the original anime boy: every base is scaled to it so the animation set behaves identically

MODELS = {
    'dragon': ('anime_boy_dragon_guider.glb', VRM, 'vrm', 'D0'),
    'beauty': ('anime_model_beuatiful_boy_rigged/scene.gltf', MIX, 'y', 'Y0'),
    'lad': ('anime_model_boy_rigged/scene.gltf', MIX, 'y', 'L0'),
    'young': ('young_boy.glb', VRM, 'vrm', 'K0'),
    'ash': ('character_boy_2_fbx/scene.gltf', CC, 'cc', 'C0'),
}
MATS = [('HairBack', 'HairBack'), ('Hair_00_HAIR', 'Hair'), ('Body_00_SKIN', 'Skin_Body'), ('Face_00_SKIN', 'Skin_Face'), ('EyeWhite', 'EyeWhite'), ('EyeIris', 'Iris'), ('EyeHighlight', 'EyeHL'),
        ('FaceBrow', 'Brow'), ('FaceEyeline', 'Eyeline'), ('FaceEyelash', 'Eyeline'), ('FaceMouth', 'Mouth'), ('Tops', 'Tops'), ('Bottoms', 'Bottoms'), ('Shoes', 'Shoes'), ('Onepiece', 'Collar')]

def strip(n): return re.sub(r'_\d+$', '', n)
def smooth_normals(P, F):
    N = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(N, F[:, k], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def xf_fn(mode):
    if mode == 'vrm': return lambda P: P * np.array([-1., 1., -1.])
    if mode == 'cc': return lambda P: np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1) * 0.01
    return lambda P: P

def tex_image(g, mi, cap):
    m = g.j['materials'][mi]; bc = (m.get('pbrMetallicRoughness') or {}).get('baseColorTexture') or ((m.get('extensions') or {}).get('KHR_materials_pbrSpecularGlossiness') or {}).get('diffuseTexture')
    if not bc: return None
    im_ = g.j['images'][g.j['textures'][bc['index']]['source']]
    if 'bufferView' in im_: im = Image.open(io.BytesIO(g.view_bytes(im_['bufferView'])[0]))
    else: im = Image.open(os.path.join(g.dir, im_['uri'].replace('%20', ' ')))
    im = im.convert('RGBA')
    if max(im.size) > cap: s = cap / max(im.size); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    return im

def convert(path, table, mode, cap=512):
    g = GLTF(path); j = g.j; par = g.parents(); sk = j['skins'][0]; jn = sk['joints']; xf = xf_fn(mode)
    ib = g.accessor(sk['inverseBindMatrices']).reshape(-1, 4, 4); P0 = np.array([np.linalg.inv(m.T)[:3, 3] for m in ib])
    names = [strip(j['nodes'][n]['name']) for n in jn]; first = {}
    for i, n in enumerate(names): first.setdefault(n, i)
    rev = {}
    for oi, s in enumerate(SHORT):
        v = table.get(s)
        if v and v in first: rev[v] = oi
    def kept(i):
        n = jn[i]
        while True:
            b = strip(j['nodes'][n]['name'])
            if b in rev: return rev[b]
            if n not in par: return 0
            n = par[n]
    remap = np.array([kept(i) for i in range(len(jn))])
    wp = np.zeros((24, 3))
    for oi, s in enumerate(SHORT):
        v = table.get(s)
        if v and v in first: wp[oi] = g.world(jn[first[v]], par)[:3, 3] if mode == 'cc' else xf(P0[first[v]][None])[0]   # (the CC export has blank inverse-bind matrices on some joints)
    if not table['Spine2']: wp[11] = (wp[10] + wp[16]) / 2
    raw = []; texs = []; tmap = {}
    for mesh in j['meshes']:
        for pr in mesh['primitives']:
            mi = pr['material']; mname = j['materials'][mi]['name']
            key = next((v for k, v in MATS if k in mname), None)
            if key is None: print('  skip', mname); continue
            at = pr['attributes']; P = xf(g.accessor(at['POSITION']).astype(np.float64)); F = g.accessor(pr['indices']).astype(np.int64).reshape(-1, 3)
            if mode == 'vrm': F = F[:, ::-1]
            UV = g.accessor(at['TEXCOORD_0']).astype(np.float32); J4 = g.accessor(at['JOINTS_0']).astype(np.int64); W4 = g.accessor(at['WEIGHTS_0']).astype(np.float64)
            ti = None; im = tex_image(g, mi, cap)
            if im is not None:
                if mi not in tmap: texs.append(im); tmap[mi] = len(texs) - 1
                ti = tmap[mi]
            jj = np.zeros((len(P), 4), np.int64); ww = np.zeros((len(P), 4)); tj = remap[J4]
            for v in range(len(P)):
                acc = {}
                for k in range(4):
                    if W4[v, k] > 0: acc[int(tj[v, k])] = acc.get(int(tj[v, k]), 0) + W4[v, k]
                if not acc: acc = {0: 1.0}
                for k, (t, w) in enumerate(sorted(acc.items(), key=lambda x: -x[1])[:4]): jj[v, k] = t; ww[v, k] = w
            raw.append(dict(key=key, mname=mname, tex=ti, pos=P, uv=UV, jj=jj, ww=ww, ix=F.reshape(-1)))
    allv = np.concatenate([p['pos'] for p in raw]); ymin = allv[:, 1].min(); wp[:, 1] -= ymin
    s = HEAD_Y / wp[17][1]; wp *= s
    for p in raw:
        p['pos'] = (p['pos'] - [0, ymin, 0]) * s; p['nrm'] = smooth_normals(p['pos'], p['ix'].reshape(-1, 3))
    wp[18] = wp[17] + [0, .24, .02]; wp[19] = wp[17] + [0, 0, .10]
    return raw, wp, texs

def split_merged(raw, wp):
    body = [p for p in raw if p['key'] == 'Skin_Body'][0]; F = body['ix'].reshape(-1, 3); P = body['pos']
    k = np.round(P * 2e3).astype(np.int64); _, inv = np.unique(k, axis=0, return_inverse=True); inv = inv.ravel(); n = inv.max() + 1
    A = coo_matrix((np.ones(len(F) * 2), (np.r_[inv[F[:, 0]], inv[F[:, 1]]], np.r_[inv[F[:, 1]], inv[F[:, 2]]])), shape=(n, n))
    nc, lab = connected_components(A, directed=False); fl = lab[inv[F[:, 0]]]
    cy = np.array([P[np.unique(F[fl == c])][:, 1].mean() if (fl == c).any() else 0 for c in range(nc)])
    ishair = (cy > wp[17][1] - 0.01)[fl]
    out = [p for p in raw if p is not body]
    def sub(mask, key):
        f = F[mask]; used = np.unique(f); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
        d = dict(body); d['key'] = key; d['pos'] = P[used]; d['nrm'] = body['nrm'][used]; d['uv'] = body['uv'][used]; d['jj'] = body['jj'][used]; d['ww'] = body['ww'][used]; d['ix'] = remap[f].reshape(-1); return d
    out.append(sub(ishair, 'Hair')); out.append(sub(~ishair, 'Fixed_Body'))
    for p in out:
        if p['key'] == 'Mouth': p['key'] = 'Fixed_Face'
    print('  merged mesh: %d components, hair tris %d, rest %d' % (nc, ishair.sum(), (~ishair).sum()))
    return out

def name_native(raw, hid, outfit):
    res = []
    for p in raw:
        k = p['key']
        if k == 'Hair': m = 'Hair_' + hid
        elif k == 'HairBack': m = 'Hair_' + hid + 'Back'
        elif k in ('Tops', 'Bottoms', 'Shoes', 'Collar'): m = 'Outfit_%s_%s' % (outfit, k)
        else: m = k
        d = dict(p); d['mat'] = m; d['srctex'] = p['tex']; res.append(d)
    return res

def read_pack(d, key):
    meta = json.load(open(os.path.join(d, key + '.meta.json'))); raw = zlib.decompress(open(os.path.join(d, key + '.bin'), 'rb').read())
    ibm = np.frombuffer(raw, '<f4', 24 * 16, meta['ibmOff']).reshape(24, 16); wp = -ibm[:, 12:15].astype(np.float64)
    texs = {}; prims = []
    for p in meta['prims']:
        n = p['n']; o = p['o']
        P = np.frombuffer(raw, '<f4', n * 3, o[0]).reshape(-1, 3).astype(np.float64); NR = np.frombuffer(raw, 'i1', n * 4, o[1]).reshape(-1, 4)[:, :3] / 127.
        UV = np.frombuffer(raw, '<f4', n * 2, o[2]).reshape(-1, 2).astype(np.float32); J = np.frombuffer(raw, 'u1', n * 4, o[3]).reshape(-1, 4).astype(np.int64); W = np.frombuffer(raw, 'u1', n * 4, o[4]).reshape(-1, 4) / 255.
        F = np.frombuffer(raw, '<u4' if n >= 65536 else '<u2', p['ni'], o[5]).astype(np.int64)
        t = p.get('tex')
        if t is not None and t not in texs: texs[t] = Image.open(os.path.join(d, '%s.t%d.webp' % (key, t))).convert('RGBA')
        prims.append(dict(mat=p['mat'], srctex=t, pos=P, nrm=NR, uv=UV, jj=J, ww=W, ix=F))
    return prims, wp, texs

def refit(prims, wp_src, wp_tgt):
    S = {n: wp_src[i] for i, n in enumerate(OUT)}; B = {n: wp_tgt[i] for i, n in enumerate(OUT)}
    Q = {'pelvis': 'Pelvis', 'neck_01': 'Neck', 'Head': 'Head', 'upperarm_l': 'L UpperArm', 'lowerarm_l': 'L Forearm', 'hand_l': 'L Hand', 'upperarm_r': 'R UpperArm', 'lowerarm_r': 'R Forearm', 'hand_r': 'R Hand',
         'thigh_l': 'L Thigh', 'calf_l': 'L Calf', 'foot_l': 'L Foot', 'ball_l': 'L Toe0', 'thigh_r': 'R Thigh', 'calf_r': 'R Calf', 'foot_r': 'R Foot', 'ball_r': 'R Toe0'}
    fit = Fit({q: S['Bip001 ' + t] for q, t in Q.items()}, B, head_M=np.eye(3))
    fit.sx = (B['Bip001 L UpperArm'][0] - B['Bip001 R UpperArm'][0]) / (S['Bip001 L UpperArm'][0] - S['Bip001 R UpperArm'][0])
    fit.sy = (B['Bip001 Neck'][1] - B['Bip001 Pelvis'][1]) / (S['Bip001 Neck'][1] - S['Bip001 Pelvis'][1]); fit.sz = 1.0
    fit.q0 = S['Bip001 Pelvis']; fit.t0 = B['Bip001 Pelvis']
    res = []
    for p in prims:
        P = p['pos']; n = len(P); J = p['jj']; W = p['ww']
        infl = [[(OUT[J[i, k]], W[i, k]) for k in range(4) if W[i, k] > 0] for i in range(n)]
        P2, infl2 = fit.apply(P, infl, mapper=lambda q: q)
        jj = np.zeros((n, 4), np.int64); ww = np.zeros((n, 4))
        for i, lst in enumerate(infl2):
            for k, (t, w) in enumerate(lst[:4]): jj[i, k] = OUT.index(t); ww[i, k] = w
        d = dict(p); d['pos'] = P2; d['nrm'] = smooth_normals(P2, np.asarray(p['ix']).reshape(-1, 3)); d['jj'] = jj; d['ww'] = ww; res.append(d)
    return res

def inflate(prims, body, margin=0.026, reach=0.12):
    """keep clothes outside the skin: any outfit vertex that ended up inside (or too close to) this base's body mesh is pushed out along the body normal,
    then the push is smoothed over the clothing mesh so nothing spikes. (The body textures have underwear painted on, which showed through otherwise.)"""
    from scipy.spatial import cKDTree
    if body is None: return prims
    bp = body['pos']; bn = body['nrm']; tree = cKDTree(bp); res = []
    for p in prims:
        P = p['pos']; d, idx = tree.query(P, k=4); w = 1.0 / (d + 1e-4); w /= w.sum(1, keepdims=True)
        bpt = (bp[idx] * w[..., None]).sum(1); nn = (bn[idx] * w[..., None]).sum(1); nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9
        sd = ((P - bpt) * nn).sum(1); push = np.where((d[:, 0] < reach) & (sd < margin), margin - sd, 0.0).clip(0, 0.06)
        disp = nn * push[:, None]
        F = np.asarray(p['ix']).reshape(-1, 3); nv = len(P); a = np.concatenate([F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]); b = np.concatenate([F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]])
        cnt = np.bincount(a, minlength=nv).astype(float) + 1e-9
        for _ in range(2):
            acc = np.zeros_like(disp); np.add.at(acc, a, disp[b]); disp = np.maximum(disp * .5 + .5 * acc / cnt[:, None], disp * .0) if False else disp * .5 + .5 * acc / cnt[:, None]
        disp = disp + nn * np.maximum(0, (margin * .6 - (((P + disp) - bpt) * nn).sum(1)) * (push > 0))[:, None]      # smoothing must not bring a vertex back under the skin
        q = dict(p); q['pos'] = P + disp; q['nrm'] = smooth_normals(q['pos'], F); res.append(q)
    return res

def move_hair(prims, wp_src, wp_tgt):
    off = wp_tgt[17] - wp_src[17]; res = []
    for p in prims:
        d = dict(p); d['pos'] = p['pos'] + off; res.append(d)
    return res

FACE_SRC = ['boy', 'dragon', 'beauty', 'lad']          # face 0..3 = the faces of these four VRoid-style bases (the two baked models keep their own fixed face)
FACE_PART = {'Skin_Face': 'Skin', 'EyeWhite': 'EyeWhite', 'Iris': 'Iris', 'EyeHL': 'EyeHL', 'Brow': 'Brow', 'Eyeline': 'Eyeline', 'Mouth': 'Mouth'}

def mean_skin(im):
    a = np.asarray(im.convert('RGBA')).reshape(-1, 4).astype(np.float64); a = a[a[:, 3] > 200]
    if not len(a): return np.array([230., 200., 180.])
    lum = a[:, :3] @ [.299, .587, .114]; lo, hi = np.percentile(lum, [35, 92]); a = a[(lum >= lo) & (lum <= hi)]     # skin only: leave out lines, shadows and highlights
    return a[:, :3].mean(0)

def tone_match(face_im, face_ref, body_ref):
    """recolour a transplanted face skin so it meets the new body at the neck: per-channel gain = body skin mean / its own body skin mean"""
    g = np.clip(body_ref / np.maximum(face_ref, 1), .7, 1.4); a = np.asarray(face_im.convert('RGBA')).astype(np.float64)
    a[..., :3] = np.clip(a[..., :3] * g, 0, 255); return Image.fromarray(a.astype(np.uint8), 'RGBA')

def face_set(prims, tex, k):
    return [dict(p, mat='Face%d_%s' % (k, FACE_PART[p['mat']])) for p in prims if p['mat'] in FACE_PART]

def assemble(key, extras, wp, outdir):
    """extras: list of (prim dict with 'srctex', texture-dict {srctex: PIL})"""
    textures = []; prims = []; cache = {}
    for p, tx in extras:
        d = dict(p); t = p.get('srctex')
        if t is not None:
            ck = id(tx[t])
            if ck not in cache: textures.append(tx[t]); cache[ck] = len(textures) - 1
            d['tex'] = cache[ck]
        else: d['tex'] = None
        prims.append(d)
    os.makedirs(outdir, exist_ok=True)
    meta, info, binz, texb = write_model(outdir, key, OUT, PARENTS, wp, prims, textures)
    open(os.path.join(outdir, key + '.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(outdir, key + '.meta.json'), 'w'), separators=(',', ':'))
    for f in os.listdir(outdir):
        if re.match(re.escape(key) + r'\.t\d+\.webp$', f): os.remove(os.path.join(outdir, f))
    for i, b in enumerate(texb): open(os.path.join(outdir, '%s.t%d.webp' % (key, i)), 'wb').write(b)
    info['bodyHeight'] = 1.9486433267593384
    info['pelvis'] = wp[0].tolist(); info['head'] = wp[17].tolist(); info['hip'] = float(wp[0][1])
    info['prim_stats'] = {m['mat']: [m['n'], m['ni'] // 3] for m in meta['prims']}
    json.dump(info, open(os.path.join(outdir, key + '.info.json'), 'w'), indent=1)
    print('%-7s bin %4d KB  tex %2d (%d KB)  prims %2d  bodyHeight %.3f' % (key, info['bin_kb'], len(texb), sum(len(t) for t in texb) // 1024, len(prims), info['bodyHeight']))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--src', required=True); ap.add_argument('--boy', default='assets/boy'); ap.add_argument('--out', default='assets'); ap.add_argument('--cap', type=int, default=512); a = ap.parse_args()
    boy_prims, boy_wp, boy_tex = read_pack(a.boy, 'boy')
    boy_orig = [p for p in boy_prims if not p['mat'].startswith('Outfit_Dragon') and not re.match(r'Hair_(?!B0)', p['mat'])]
    shared = [p for p in boy_orig if (p['mat'].startswith('Outfit_') and not p['mat'].startswith('Outfit_Modern')) or p['mat'].startswith('Gear_')]
    bases = {}
    for key, (rel, table, mode, hid) in MODELS.items():
        print('converting', key)
        raw, wp, texs = convert(os.path.join(a.src, rel), table, mode, a.cap)
        if key in ('young', 'ash'): raw = split_merged(raw, wp)
        bases[key] = dict(own=name_native(raw, hid, 'Dragon' if key == 'dragon' else 'Modern'), wp=wp, tex=dict(enumerate(texs)))
    dragon_robe = [p for p in bases['dragon']['own'] if p['mat'].startswith('Outfit_Dragon')]
    dwp, dtex = bases['dragon']['wp'], bases['dragon']['tex']
    srcs = {'boy': (boy_orig, boy_wp, boy_tex)}
    for key, b in bases.items(): srcs[key] = (b['own'], b['wp'], b['tex'])
    hairs = {k: ([p for p in v[0] if p['mat'].startswith('Hair_')], v[1], v[2]) for k, v in srcs.items()}
    def body_tone(prims, tex):
        sb = [p for p in prims if p['mat'] == 'Skin_Body']; return mean_skin(tex[sb[0]['srctex']]) if sb and sb[0].get('srctex') is not None else None
    def own_face_tone(prims, tex):
        sf = [p for p in prims if p['mat'] == 'Skin_Face']; return mean_skin(tex[sf[0]['srctex']]) if sf and sf[0].get('srctex') is not None else None
    def hair_extras(key, wp):
        return [(p, htx) for hk, (hp, hwp, htx) in hairs.items() if hk != key for p in move_hair(hp, hwp, wp)]
    def face_extras(key, prims, wp, tex):
        """all four faces on a base that has a separable face; the base's own face stays untouched, the others are moved to its head and tone-matched to its body"""
        out = []; bt = body_tone(prims, tex)
        for k, fk in enumerate(FACE_SRC):
            fp, fwp, ftx = srcs[fk]
            part = face_set(fp, ftx, k)
            if fk != key: part = move_hair(part, fwp, wp)
            ft = own_face_tone(fp, ftx); newtex = dict(ftx)
            for p in part:
                if p['mat'].endswith('_Skin') and p.get('srctex') is not None and bt is not None and ft is not None and (fk != key or True):
                    newtex = dict(newtex); newtex[p['srctex']] = tone_match(ftx[p['srctex']], ft, bt)
            out += [(p, newtex) for p in part]
        return out
    def notface(prims): return [p for p in prims if p['mat'] not in FACE_PART]
    boy_body = next(p for p in boy_orig if p['mat'] == 'Skin_Body')
    def fix_worn(prims, body): return inflate([p for p in prims if p['mat'].startswith('Outfit_') and not p['mat'].startswith('Outfit_Modern')], body)
    boy_keep = [p for p in notface(boy_orig) if not (p['mat'].startswith('Outfit_') and not p['mat'].startswith('Outfit_Modern'))]
    ex = [(p, boy_tex) for p in boy_keep] + [(p, boy_tex) for p in fix_worn(boy_orig, boy_body)] + face_extras('boy', boy_orig, boy_wp, boy_tex)
    ex += [(p, dtex) for p in fix_worn(refit(dragon_robe, dwp, boy_wp), boy_body)] + hair_extras('boy', boy_wp)
    assemble('boy', ex, boy_wp, os.path.join(a.out, 'boy'))
    for key, b in bases.items():
        wp = b['wp']; face_ok = key in FACE_SRC
        ex = [(p, b['tex']) for p in (notface(b['own']) if face_ok else b['own'])]          # native body, hair, clothes (+ the fixed face of the baked models)
        if face_ok: ex += face_extras(key, b['own'], wp, b['tex'])
        body = next((p for p in b['own'] if p['mat'] == 'Skin_Body'), None)
        gear = [p for p in refit(shared, boy_wp, wp) if p['mat'].startswith('Gear_')]
        ex += [(p, boy_tex) for p in inflate([p for p in refit(shared, boy_wp, wp) if p['mat'].startswith('Outfit_')], body)] + [(p, boy_tex) for p in gear]     # Village / Traveller / Scout + ODM gear
        if key != 'dragon': ex += [(p, dtex) for p in inflate(refit(dragon_robe, dwp, wp), body)]
        ex += hair_extras(key, wp)
        assemble(key, ex, wp, os.path.join(a.out, key))
if __name__ == '__main__': main()

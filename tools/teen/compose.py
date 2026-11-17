"""Compose one base pack: new anime body (+ this base's own head/face/hair) + real garments (Levi scout kit, Furlan casual, boxers, armour)."""
import sys, os, pickle, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import build_bases as BB, importer as I, body_v4 as B4
from build_bases import smooth_normals
NECK = .026                                              # the head sits this much higher than on the donor rigs: a longer, freer neck above every collar
def wnorm(P, F):
    key = np.round(P * 1e4).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
    N = np.zeros((inv.max() + 1, 3)); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(N, inv[F[:, k]], fn)
    N = N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12); return N[inv]

S = os.environ['S']
def sub(p, mask_faces, mat=None):
    F = p['ix'].reshape(-1, 3)[mask_faces]; used = np.unique(F); rm = -np.ones(len(p['pos']), np.int64); rm[used] = np.arange(len(used))
    d = dict(p); d['pos'] = p['pos'][used]; d['nrm'] = p['nrm'][used]; d['uv'] = p['uv'][used]; d['jj'] = p['jj'][used]; d['ww'] = p['ww'][used]; d['ix'] = rm[F].reshape(-1)
    if mat: d['mat'] = mat
    return d
def centroid(p): return p['pos'][p['ix'].reshape(-1, 3)].mean(1)
def retex(prims, T, tag, texlist):
    """move a source's textures into the shared dict under unique ids"""
    base = {'L': 100, 'F': 200}[tag]
    for i, im in enumerate(texlist): T[base + i] = im
    for p in prims:
        if p.get('tex') is not None: p['srctex'] = base + p['tex']
    return prims

_cache = {}
def donors():
    if 'd' in _cache: return _cache['d']
    lv, wpl, ltx, _ = I.load_bip(S + '/n2/levi/scene.gltf'); fu, wpf, ftx, _ = I.load_bip(S + '/n2/furlan.glb', flipmesh=True)
    b = [p for p in fu if len(p['pos']) == 3080][0]['pos']; m = b[(b[:, 1] > .45) & (b[:, 1] < .75) & (b[:, 0] > .02)]
    _cache['d'] = (lv, wpl, ltx, fu, wpf, ftx); return _cache['d']

def new_body(skin_rgb):
    if 'body' not in _cache:
        P = pickle.load(open(S + '/w/g12/tmp/body.pkl', 'rb')); _cache['body'] = P
    body, wp = copy.deepcopy(_cache['body'][0]), _cache['body'][1]
    F = body['ix'].reshape(-1, 3); c = body['pos'][F].mean(1)
    body = sub(body, c[:, 1] < 1.60); P = body['pos']
    # neck: tuck the top of the neck a little inside the head piece's neck so the two never z-fight
    ax = np.array([0, 0, np.median(P[(P[:, 1] > 1.5) & (P[:, 1] < 1.6) & (np.abs(P[:, 0]) < .1)][:, 2])])
    t = np.clip((P[:, 1] - 1.52) / .08, 0, 1) * (np.abs(P[:, 0]) < .12)
    P[:, 0] *= 1 - .08 * t; P[:, 2] = ax[2] + (P[:, 2] - ax[2]) * (1 - .08 * t)
    P[:, 1] += NECK * np.clip((P[:, 1] - 1.50) / .10, 0, 1)                           # stretch the neck column up
    body['nrm'] = wnorm(P, body['ix'].reshape(-1, 3)); body['mat'] = 'Skin_Body'; body['srctex'] = 900
    return body

def clip_y(p, y0, keep_above=True):
    """cut a skinned prim at a plane y=y0 (exact straight edge): triangles are split, attributes interpolated, weights taken from the nearer vertex"""
    P = p['pos']; F = p['ix'].reshape(-1, 3); sg = (P[:, 1] - y0) * (1 if keep_above else -1)
    pos = [*P]; nrm = [*p['nrm']]; uv = [*p['uv']]; jj = [*p['jj']]; ww = [*p['ww']]; cache = {}
    def mid(a, b):
        k = (min(a, b), max(a, b))
        if k in cache: return cache[k]
        t = sg[a] / (sg[a] - sg[b]); i = len(pos); pos.append(P[a] + (P[b] - P[a]) * t); nrm.append(p['nrm'][a] * (1 - t) + p['nrm'][b] * t); uv.append(p['uv'][a] * (1 - t) + p['uv'][b] * t)
        n_ = a if t < .5 else b; jj.append(p['jj'][n_]); ww.append(p['ww'][n_]); cache[k] = i; return i
    tri = []
    for f in F:
        ins = [sg[v] >= 0 for v in f]; n = sum(ins)
        if n == 3: tri.append(tuple(f))
        elif n == 0: continue
        elif n == 1:
            i = ins.index(True); a, b, c = f[i], f[(i + 1) % 3], f[(i + 2) % 3]; tri.append((a, mid(a, b), mid(a, c)))
        else:
            i = ins.index(False); a, b, c = f[i], f[(i + 1) % 3], f[(i + 2) % 3]; ab = mid(a, b); ac = mid(a, c); tri.append((b, c, ac)); tri.append((b, ac, ab))
    tri = np.array(tri, np.int64); used = np.unique(tri); rm = -np.ones(len(pos), np.int64); rm[used] = np.arange(len(used))
    d = dict(p); d['pos'] = np.array(pos)[used]; d['nrm'] = np.array(nrm)[used]; d['uv'] = np.array(uv, np.float32)[used]; d['jj'] = np.array(jj)[used]; d['ww'] = np.array(ww)[used]; d['ix'] = rm[tri].reshape(-1); return d

def boxers(body, T):
    F = body['ix'].reshape(-1, 3); c = body['pos'][F].mean(1)
    m = (c[:, 1] > .70) & (c[:, 1] < 1.2) & (np.abs(c[:, 0]) < .2)
    p = sub(body, m, 'Outfit_Under_Bottoms'); p = clip_y(clip_y(p, .79, True), 1.04, False); n = p['nrm']
    ease = .007 + .006 * np.clip((.90 - p['pos'][:, 1]) / .12, 0, 1)   # tight but separate
    p['pos'] = p['pos'] + n * ease[:, None]
    # waistband: gather the top rim slightly
    T[901] = cloth_tex((176, 158, 126)); p['srctex'] = 901
    # uv: planar cylindrical so the cloth weave reads evenly
    th = np.arctan2(p['pos'][:, 0], p['pos'][:, 2]); p['uv'] = np.stack([np.abs(th) / np.pi, (p['pos'][:, 1] - .76) / .3], 1).astype(np.float32)
    p['nrm'] = smooth_normals(p['pos'], p['ix'].reshape(-1, 3)); return p
def cloth_tex(col, w=128, h=128, seed=7):
    r = np.random.RandomState(seed); y, x = np.mgrid[0:h, 0:w]
    a = np.array(col, float)[None, None, :] * (1 + (np.sin(x * 2.1) * np.sin(y * 2.1) * .06 + r.randn(h, w) * .025))[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')

def align_z(prims, body, lo=.08, hi=1.58, step=.05):
    """slide a donor garment front/back, height by height, so it is centred on this body (the donor was tailored to a differently-posed spine)"""
    ys = np.arange(lo, hi, step); G = np.concatenate([p['pos'] for p in prims]); Bp = body['pos']; dz = []; yy = []
    for y in ys:
        g = G[(np.abs(G[:, 1] - y) < step) & (np.abs(G[:, 0]) < .16)]; b = Bp[(np.abs(Bp[:, 1] - y) < step) & (np.abs(Bp[:, 0]) < .16)]
        if len(g) < 8 or len(b) < 8: continue
        dz.append((b[:, 2].max() + b[:, 2].min()) / 2 - (g[:, 2].max() + g[:, 2].min()) / 2); yy.append(y)
    dz = np.array(dz)
    for _ in range(4): dz[1:-1] = (dz[:-2] + 2 * dz[1:-1] + dz[2:]) / 4
    for p in prims: p['pos'] = p['pos'] + np.stack([np.zeros(len(p['pos'])), np.zeros(len(p['pos'])), np.interp(p['pos'][:, 1], yy, dz)], 1)

def align_legs_x(prims, body, step=.05):
    """centre each garment leg on the body's leg (per side, per height) in x as well"""
    G = np.concatenate([p['pos'] for p in prims]); Bp = body['pos']
    for sd in (1, -1):
        ys = []; dx = []
        for y in np.arange(.06, .95, step):
            g = G[(np.abs(G[:, 1] - y) < step) & (G[:, 0] * sd > .0)]; b = Bp[(np.abs(Bp[:, 1] - y) < step) & (Bp[:, 0] * sd > .0)]
            if len(g) < 8 or len(b) < 8: continue
            ys.append(y); dx.append((b[:, 0].max() + b[:, 0].min()) / 2 - (g[:, 0].max() + g[:, 0].min()) / 2)
        dx = np.array(dx)
        for _ in range(4): dx[1:-1] = (dx[:-2] + 2 * dx[1:-1] + dx[2:]) / 4
        for p in prims:
            m = (p['pos'][:, 0] * sd > 0) & (p['pos'][:, 1] < .98); w = np.clip((1.0 - p['pos'][:, 1]) / .12, 0, 1)
            p['pos'][:, 0] += np.where(m, np.interp(p['pos'][:, 1], ys, dx) * w, 0)

def shift_by_joints(prims, wp_src, wp_tgt):
    """conform a donor garment to another skeleton of the same rig: every vertex moves by the weighted translation of its joints"""
    off = wp_tgt - wp_src; res = []
    for p in prims:
        d = dict(p); d['pos'] = p['pos'] + (off[p['jj']] * p['ww'][..., None]).sum(1); d['nrm'] = smooth_normals(d['pos'], p['ix'].reshape(-1, 3)); res.append(d)
    return res

def scout(T, body):
    lv, wpl, ltx, fu, wpf, ftx = donors(); lv = retex(copy.deepcopy(lv), T, 'L', ltx); out = []
    mp = {'body_1.0': 'Outfit_Scout_Body', 'boots': 'Outfit_Scout_Boots', 'Cloak': 'Outfit_Scout_Cloak', '-ODM': 'Gear_ODM', 'SwordL': 'Gear_SwordL', 'SwordR': 'Gear_SwordR'}
    for p in lv:
        k = next((v for kk, v in mp.items() if kk in p['mat']), None)
        if k is None: continue
        p = dict(p); p['mat'] = k; out.append(p)
    tight = [p for p in out if p['mat'] in ('Outfit_Scout_Body', 'Outfit_Scout_Boots')]
    align_legs_x([p for p in out if p['mat'] in ('Outfit_Scout_Body','Outfit_Scout_Boots')], body)
    fixed = BB.inflate(tight, body, margin=.012, reach=.14)
    for p, q in zip(tight, fixed): p.update(q)
    return out

def casual(T, body):
    lv, wpl, ltx, fu, wpf, ftx = donors(); fu = retex(copy.deepcopy(fu), T, 'F', ftx); out = []
    fu = shift_by_joints([p for p in fu if 'face' not in p['mat'] and 'hair' not in p['mat']], wpf, wpl)
    align_z(fu, body); align_legs_x(fu, body)
    for p in fu:
        c = centroid(p)
        if p['pos'].shape[0] == 3080:     # vest + shirt + breeches in one mesh: split so top and trousers dye separately
            out.append(sub(p, c[:, 1] >= 1.075, 'Outfit_Peasant_Body')); out.append(sub(p, c[:, 1] < 1.075, 'Outfit_Peasant_Legs'))
        elif p['pos'].shape[0] == 980: q = dict(p); q['mat'] = 'Outfit_Peasant_Feet'; out.append(q)
    tight = [p for p in out]; fixed = BB.inflate(tight, body, margin=.014, reach=.14)
    for p, q in zip(tight, fixed): p.update(q)
    return out

def tuck_body(body, garments, depth=.010, near=.03, inside=.004):
    """wherever the body surface pokes through (or sits closer than `inside` to) a garment surface, press it inward along its normal"""
    from scipy.spatial import cKDTree
    G = np.concatenate([g['pos'] for g in garments]); GN = np.concatenate([g['nrm'] for g in garments]); tree = cKDTree(G)
    P = body['pos']; d, i = tree.query(P, k=1); sd = ((P - G[i]) * GN[i]).sum(1)     # signed distance along the garment normal (+ = outside the cloth)
    push = np.where((d < near) & (sd > -inside), np.minimum(sd + inside, depth), 0)
    F = body['ix'].reshape(-1, 3); n = len(P); a = np.r_[F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]; b = np.r_[F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]]; cnt = np.maximum(np.bincount(a, minlength=n), 1)
    for _ in range(10):
        acc = np.zeros(n); np.add.at(acc, a, push[b]); push = np.maximum(.4 * push + .6 * acc / cnt, 0) * 1.0 if False else (.4 * push + .6 * acc / cnt)
    push = np.minimum(push, depth)
    out = dict(body); out['pos'] = P - body['nrm'] * push[:, None]; out['nrm'] = wnorm(out['pos'], body['ix'].reshape(-1, 3)); return out

def head_parts(pr, wpo, wpl):
    """this base's own head/face/hair, carried over unchanged but moved into the new rig's frame (head joint differs by a few cm)"""
    d = wpl[17] - wpo[17]; out = []
    for p in pr:
        m = p['mat']
        if m == 'Skin_Body':
            c = centroid(p); sel = (c[:, 1] > 1.545) & (np.abs(c[:, 0]) < .3)
            if sel.any(): q = sub(p, sel)
            else: continue
        elif m.startswith('Face') or m.startswith('Hair_'): q = dict(p)
        else: continue
        q = dict(q); q['pos'] = q['pos'] + d; out.append(q)
    return out

def armour(pr, T, body, wpo, wpl):
    """the Traveller armour kit (made for the earlier VRoid frame): move it onto the new rig, centre it on the body, press it clear of the skin"""
    ps = [dict(p) for p in pr if p['mat'].startswith('Outfit_Ranger_') and p['mat'] != 'Outfit_Ranger_HeadHood']
    ps = shift_by_joints(ps, wpo, wpl); align_z(ps, body); align_legs_x(ps, body)
    fixed = BB.inflate(ps, body, margin=.012, reach=.14)
    for p, q in zip(ps, fixed): p.update(q)
    hood = [dict(p) for p in pr if p['mat'] == 'Outfit_Ranger_HeadHood']
    for h in hood: h['pos'] = h['pos'] + (wpl[17] - wpo[17])
    return ps + hood

def build_pack(key, src, out_dir, outfits=('scout', 'casual', 'armour')):
    pr, wpo, tx0 = BB.read_pack(os.path.join(src, key), key)
    sk = BB.mean_skin(tx0[0]); T = dict(tx0); T[900] = Image.new('RGBA', (8, 8), tuple(int(v) for v in sk) + (255,))
    lv, wpl, ltx, fu, wpf, ftx = donors()
    body = new_body(sk); sc = scout(T, body); ca = casual(T, body); ar = armour(pr, T, body, wpo, wpl)
    garments = [p for p in sc + ca if p['mat'] in ('Outfit_Scout_Body', 'Outfit_Scout_Boots', 'Outfit_Peasant_Body', 'Outfit_Peasant_Legs', 'Outfit_Peasant_Feet', 'Outfit_Ranger_Body', 'Outfit_Ranger_Legs', 'Outfit_Ranger_FeetBoots')]
    body = tuck_body(body, garments)
    parts = [body, boxers(body, T)] + head_parts(pr, wpo, wpl) + sc + ca + ar
    wp = wpl.copy(); wp[18] = wpo[18] + (wpl[17] - wpo[17]); wp[19] = wpo[19] + (wpl[17] - wpo[17])
    BB.assemble(key, [(p, T) for p in parts], wp, out_dir)
    return parts

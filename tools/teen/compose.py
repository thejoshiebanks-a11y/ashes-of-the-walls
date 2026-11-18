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
    body = clip_y(body, 1.625, False); P = body['pos']                              # an exact straight cut (no stair-stepped teeth at the neck)
    # (the neck of the reference body is tapered to meet the head piece in mkbody.body_from_ref: no tuck or stretch needed here)
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
    m = (c[:, 1] > .70) & (c[:, 1] < 1.25) & (np.abs(c[:, 0]) < .2)
    p = sub(body, m, 'Outfit_Under_Bottoms'); p = clip_y(clip_y(p, .78, True), WAIST, False); n = p['nrm']
    ease = .007 + .006 * np.clip((.90 - p['pos'][:, 1]) / .12, 0, 1) + .004 * np.clip((p['pos'][:, 1] - (WAIST - .045)) / .045, 0, 1)   # tight but separate; the waistband sits a little proud
    p['pos'] = p['pos'] + n * ease[:, None]
    # waistband: gather the top rim slightly
    T[901] = boxer_tex(); p['srctex'] = 901
    # uv: planar cylindrical so the cloth weave reads evenly
    th = np.arctan2(p['pos'][:, 0], p['pos'][:, 2]); p['uv'] = np.stack([np.abs(th) / np.pi * .5 + .0, np.clip((p['pos'][:, 1] - .78) / (WAIST - .78), 0, 1)], 1).astype(np.float32)
    p['nrm'] = smooth_normals(p['pos'], p['ix'].reshape(-1, 3)); return p
WAIST = 1.125                                            # top of the boxers: the waistband sits at the waist, just under the navel
def boxer_tex(w=128, h=256):
    """plain cotton boxers: weave + a darker, ribbed waistband across the top 11% of the uv height, a stitched hem at the bottom"""
    r = np.random.RandomState(11); y, x = np.mgrid[0:h, 0:w]; base = np.array((62, 62, 68), float)
    a = base[None, None, :] * (1 + (np.sin(x * 2.1) * np.sin(y * 2.1) * .05 + r.randn(h, w) * .02))[..., None]
    v = y / h                                             # last image rows = uv v 1 = the waist
    for flip in (0,):
        band = (v > .885); a[band] = np.array((96, 84, 70), float) * (1 + (np.sin(x[band] * 1.6) * .10) + r.randn(int(band.sum())) * .02)[:, None]
        a[(v > .878) & (v <= .885)] *= .78                  # band seam
        a[(v < .035)] *= .86                                # hem
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
TIGHT = ('Outfit_Scout_Body', 'Outfit_Scout_Boots', 'Outfit_Peasant_Body', 'Outfit_Peasant_Legs', 'Outfit_Peasant_Feet', 'Outfit_Ranger_Body', 'Outfit_Ranger_Legs', 'Outfit_Ranger_Arms', 'Outfit_Ranger_ArmsBracer',
         'Outfit_Ranger_FeetBoots', 'Outfit_Ranger_BodyBelt1', 'Outfit_Ranger_BodyBelt2', 'Outfit_Ranger_AccPauldron')
def reweight(garments, body, k=8):
    """skin weights of every fitted garment are copied from the body surface beneath it (inverse-distance over the k nearest body vertices),
    so cloth always moves exactly with the skin: no sleeve stretching to the elbow, no spikes at the wrist, no shoulder sliding out of a sleeve"""
    from scipy.spatial import cKDTree
    n = len(body['pos']); D = np.zeros((n, 24))
    for c in range(4): np.add.at(D, (np.arange(n), body['jj'][:, c]), body['ww'][:, c])
    tree = cKDTree(body['pos'])
    def drop_bridge(g):
        # a few cloth faces bridge the crotch from one thigh to the other: they would be stretched into a web between the legs in every stride, so they are dropped
        L = (np.isin(g['jj'], [1, 2, 3, 4]) * g['ww']).sum(1); R = (np.isin(g['jj'], [5, 6, 7, 8]) * g['ww']).sum(1); t = R - L; F = g['ix'].reshape(-1, 3); ft = t[F]; P = g['pos'][F].mean(1)
        keep = ~(((ft.max(1) - ft.min(1)) > .45) & (np.abs(P[:, 0]) < .12) & (P[:, 1] > .5) & (P[:, 1] < 1.05))
        if (~keep).any(): g['ix'] = F[keep].reshape(-1).astype(g['ix'].dtype)
    for g in garments:
        if g['mat'] not in TIGHT: drop_bridge(g); continue
        d, ix = tree.query(g['pos'], k=k); w = 1 / (d + .004) ** 2; w /= w.sum(1, keepdims=True)
        A = (w[:, :, None] * D[ix]).sum(1)
        # relax the copied weights over the cloth itself (welded by position): neighbouring cloth vertices never get wildly different bone mixes, so no tiny edge is stretched into a spike
        key = np.round(g['pos'] * 2e3).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); m = inv.max() + 1; Fv = inv[g['ix'].reshape(-1, 3)]
        ea = np.r_[Fv[:, 0], Fv[:, 1], Fv[:, 2], Fv[:, 1], Fv[:, 2], Fv[:, 0]]; eb = np.r_[Fv[:, 1], Fv[:, 2], Fv[:, 0], Fv[:, 0], Fv[:, 1], Fv[:, 2]]; cn = np.maximum(np.bincount(ea, minlength=m), 1)[:, None]
        Aw = np.zeros((m, 24)); np.add.at(Aw, inv, A); Aw /= np.maximum(np.bincount(inv, minlength=m), 1)[:, None]
        for _ in range(3):
            S2 = np.zeros((m, 24)); np.add.at(S2, ea, Aw[eb]); Aw = .5 * Aw + .5 * S2 / cn
        A = Aw[inv]; jj = np.argsort(-A, axis=1)[:, :4]; ww = np.take_along_axis(A, jj, 1); ww /= ww.sum(1, keepdims=True)
        g['jj'] = jj.astype(g['jj'].dtype); g['ww'] = ww.astype(g['ww'].dtype); drop_bridge(g)
    return garments
def _ss(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def shoulder_warp(P, dx=.030, dy=.028):
    """one smooth map applied to every vertex and every joint: pulls the arms in by `dx`, drops the shoulder girdle by `dy` and slopes the trapezius,
    so the shoulders are narrower and lower (a human ~2.2 head-widths wide) while skin, clothes and skeleton stay exactly consistent"""
    P = np.array(P, float, copy=True); ax = np.abs(P[:, 0]); y = P[:, 1]; sg = np.sign(P[:, 0])
    gy = _ss((y - 1.30) / .16) * (1 - _ss((y - 1.60) / .06))                           # only the shoulder/arm band; neck, head, torso untouched
    drop = dy * _ss((ax - .03) / .13) * gy; shift = dx * _ss((ax - .10) / .13) * gy
    P[:, 1] -= drop; P[:, 0] -= sg * shift; return P
def _gauss(x, s): return np.exp(-.5 * (x / s) ** 2)
def relief(body, amp=1.5):
    """sculpted anatomy on the bare body: collarbones, pectorals with a lower edge, sternum groove, 6-pack with tendon grooves and linea alba, iliac V-lines,
    obliques, back muscles (spine groove, scapulae, lats) and deltoid/biceps definition; displacement along the normal, slim and anime-clean"""
    P = body['pos']; N = body['nrm']; x = P[:, 0]; y = P[:, 1]; z = P[:, 2]; ax = np.abs(x); fr = np.clip((N[:, 2] - .15) / .5, 0, 1); bk = np.clip((-N[:, 2] - .15) / .5, 0, 1)
    d = np.zeros(len(P))
    tz = (ax < .16) & (y > 1.05) & (y < 1.56)
    # --- front
    pec = _gauss(ax - .052, .042) * _gauss(y - 1.405, .030); d += .0085 * pec * fr
    d -= .0030 * _gauss(y - 1.366, .006) * _gauss(ax - .05, .05) * fr * (ax < .11)                  # lower pectoral edge
    d -= .0040 * _gauss(ax, .0055) * _ss((y - 1.33) / .03) * (1 - _ss((y - 1.47) / .03)) * fr        # sternum groove
    d += .0035 * _gauss(y - (1.508 + .12 * (ax - .02)), .009) * _ss((ax - .015) / .02) * (1 - _ss((ax - .11) / .03)) * fr   # collarbones
    for r in range(3):                                                                              # abs: three rows of paired blocks
        yr = 1.150 + .063 * r; d += .0062 * _gauss(ax - .031, .016) * _gauss(y - yr, .0215) * fr
    d -= .0022 * _gauss(ax, .0045) * _ss((y - 1.10) / .03) * (1 - _ss((y - 1.355) / .02)) * fr     # linea alba
    for r in range(4): d -= .0016 * _gauss(ax - .03, .028) * _gauss(y - (1.1185 + .063 * r), .004) * fr   # tendon grooves
    d += .0045 * _gauss(ax - .092, .016) * _gauss(y - 1.215, .075) * fr * (ax > .05)               # obliques / serratus flank
    d -= .0030 * _gauss(ax - (.045 + (1.115 - y) * 1.1) , .008) * (y < 1.125) * (y > 1.045) * fr    # iliac V-lines
    # --- back
    d += .0050 * _gauss(ax - .060, .038) * _gauss(y - 1.405, .045) * bk                             # scapulae / rhomboids
    d -= .0040 * _gauss(ax, .006) * _ss((y - 1.08) / .04) * (1 - _ss((y - 1.52) / .03)) * bk        # spine groove
    d += .0040 * _gauss(ax - .085, .030) * _gauss(y - 1.27, .06) * bk                               # lats
    d += .0030 * _gauss(ax - .03, .02) * _gauss(y - 1.12, .035) * bk                                # erector columns
    # --- arms (deltoid cap, biceps / forearm definition), side-agnostic along the limb axis
    ar = (ax > .15) & (ax < .64) & (y > 1.48) & (y < 1.60)
    d += .0040 * _gauss(ax - .205, .035) * _gauss(y - 1.545, .035) * (N[:, 1] > -.2)                # deltoid
    d *= amp; out = dict(body); out['pos'] = P + N * d[:, None] * (tz | (ax >= .15))[:, None]
    out['nrm'] = wnorm(out['pos'], body['ix'].reshape(-1, 3)); return out
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

def tuck_body(body, garments, depth=.030, near=.05, inside=.005, passes=2, fade=True):
    """wherever the body surface pokes through (or sits closer than `inside` to) a garment surface, press it inward along its normal"""
    from scipy.spatial import cKDTree
    for _p in range(passes - 1): body = tuck_body(body, garments, depth, near, inside, 1, fade)
    G = np.concatenate([g['pos'] for g in garments]); GN = np.concatenate([g['nrm'] for g in garments]); tree = cKDTree(G)
    P = body['pos']; d, i = tree.query(P, k=1); sd = ((P - G[i]) * GN[i]).sum(1)     # signed distance along the garment normal (+ = outside the cloth)
    push = np.where((d < near) & (sd > -inside), np.minimum(sd + inside, depth), 0)
    F = body['ix'].reshape(-1, 3); n = len(P); a = np.r_[F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]; b = np.r_[F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]]; cnt = np.maximum(np.bincount(a, minlength=n), 1)
    for _ in range(10):
        acc = np.zeros(n); np.add.at(acc, a, push[b]); push = np.maximum(.4 * push + .6 * acc / cnt, 0) * 1.0 if False else (.4 * push + .6 * acc / cnt)
    push = np.minimum(push, depth) * (np.clip((P[:, 1] - .24) / .14, 0, 1) if fade else 1)          # never below the ankle: bare feet and ankles stay exactly as modelled
    out = dict(body); out['pos'] = P - body['nrm'] * push[:, None]; out['nrm'] = wnorm(out['pos'], body['ix'].reshape(-1, 3)); return out

def inflate_garments(garments, body, margin=.0035, near=.06):
    """fit the clothes to the body (not the body to the clothes): wherever a cloth vertex lies inside, or closer than `margin` to, the skin, it is pressed outward along the skin normal.
    The body keeps its exact anime shape (clean feet, ankles, calves); the cloth only puffs by the few millimetres it needs, spread smoothly over the cloth"""
    from scipy.spatial import cKDTree
    tree = cKDTree(body['pos']); BP = body['pos']; BN = body['nrm']; moved = 0
    for g in garments:
        if g['mat'] not in TIGHT or len(g['pos']) == 0: continue
        P = g['pos']; d, ix = tree.query(P, k=3); w = 1 / (d + 1e-3); w /= w.sum(1, keepdims=True)
        bp = (BP[ix] * w[..., None]).sum(1); bn = (BN[ix] * w[..., None]).sum(1); bn /= np.maximum(np.linalg.norm(bn, axis=1, keepdims=True), 1e-9)
        sd = ((P - bp) * bn).sum(1); push0 = np.where(d[:, 0] < near, np.maximum(margin - sd, 0), 0); push = push0.copy()
        key = np.round(P * 2e3).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); m = inv.max() + 1; Fv = inv[g['ix'].reshape(-1, 3)]
        ea = np.r_[Fv[:, 0], Fv[:, 1], Fv[:, 2], Fv[:, 1], Fv[:, 2], Fv[:, 0]]; eb = np.r_[Fv[:, 1], Fv[:, 2], Fv[:, 0], Fv[:, 0], Fv[:, 1], Fv[:, 2]]; cn = np.maximum(np.bincount(ea, minlength=m), 1)
        pv = np.zeros(m); np.add.at(pv, inv, push0); pv /= np.maximum(np.bincount(inv, minlength=m), 1); p0 = pv.copy()
        for _ in range(5): S2 = np.zeros(m); np.add.at(S2, ea, pv[eb]); pv = np.maximum(p0, .5 * pv + .5 * S2 / cn)
        push = pv[inv]; g['pos'] = P + bn * push[:, None]; moved += int((push > 5e-4).sum())
        if 'nrm' in g: g['nrm'] = wnorm(g['pos'], g['ix'].reshape(-1, 3))
    print('inflate_garments: %d cloth vertices eased outward' % moved)
    return garments

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

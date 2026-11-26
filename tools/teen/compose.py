import os
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
        band = (v > .885); a[band] = np.array((78, 78, 86), float) * (1 + (np.sin(x[band] * 1.6) * .10) + r.randn(int(band.sum())) * .02)[:, None]
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
        loose = g['mat'].endswith('_Bottoms') and g['mat'][7:].split('_')[0] in ('Dragon', 'Ninja')      # the loose trousers are skinned from the legs beneath them like every other garment (a pelvis-bound crotch panel ballooned in a run)
        if g['mat'] not in TIGHT and not loose: drop_bridge(g); continue
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
    d -= .0032 * _gauss(ax, .0095) * _ss((y - 1.33) / .03) * (1 - _ss((y - 1.47) / .03)) * fr        # sternum groove
    d += .0035 * _gauss(y - (1.508 + .12 * (ax - .02)), .009) * _ss((ax - .015) / .02) * (1 - _ss((ax - .11) / .03)) * fr   # collarbones
    for r in range(3):                                                                              # abs: three rows of paired blocks
        yr = 1.150 + .063 * r; d += .0062 * _gauss(ax - .031, .016) * _gauss(y - yr, .0215) * fr
    d -= .0018 * _gauss(ax, .0085) * _ss((y - 1.10) / .03) * (1 - _ss((y - 1.355) / .02)) * fr     # linea alba
    for r in range(4): d -= .0016 * _gauss(ax - .03, .028) * _gauss(y - (1.1185 + .063 * r), .004) * fr   # tendon grooves
    d += .0045 * _gauss(ax - .092, .016) * _gauss(y - 1.215, .075) * fr * (ax > .05)               # obliques / serratus flank
    d -= .0030 * _gauss(ax - (.045 + (1.115 - y) * 1.1) , .008) * (y < 1.125) * (y > 1.045) * fr    # iliac V-lines
    # --- back
    d += .0050 * _gauss(ax - .060, .038) * _gauss(y - 1.405, .045) * bk                             # scapulae / rhomboids
    d -= .0028 * _gauss(ax, .0115) * _ss((y - 1.08) / .04) * (1 - _ss((y - 1.52) / .03)) * bk        # spine groove (wider than the mesh spacing: a narrower cut aliased into a hairline)
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

def swap_sleeves(p, body, scale=.90, off=.007, x0=.20, xs=.14, ylow=1.40, xend=.585):
    """replace a donor garment's own sleeves (they float, fold, double up and let the arm show) with smooth sleeves grown from our body's arm surface: same cloth uv, the arm's own weights, a clean cuff ring"""
    th = lambda y: np.where(y > 1.40, xs, x0)
    F = p['ix'].reshape(-1, 3); c = p['pos'][F].mean(1); slv = (np.abs(c[:, 0]) > th(c[:, 1])) & (np.abs(c[:, 0]) < .75) & (c[:, 1] > ylow)
    pure = slv & (np.abs(c[:, 0]) > .30) & (c[:, 1] > 1.43); uvs = np.median(p['uv'][F[pure if pure.sum() > 5 else slv]].reshape(-1, 2), axis=0); top = sub(p, ~slv)
    BF = body['ix'].reshape(-1, 3); bV = body['pos'][BF]; bc = bV.mean(1); am = (np.abs(bc[:, 0]) > th(bc[:, 1])) & (np.abs(bV[:, :, 0]).max(1) < xend) & (bc[:, 1] > 1.2) & (bc[:, 1] < 1.65)
    arm = sub(body, am, p['mat']); AP = arm['pos'].copy(); lim = np.abs(AP[:, 0]) > x0
    for sg in (-1, 1):
        for a in np.arange(x0, .60, .025):
            mk = lim & (np.sign(AP[:, 0]) == sg) & (np.abs(AP[:, 0]) >= a) & (np.abs(AP[:, 0]) < a + .025)
            if mk.sum() > 3: cc = AP[mk][:, 1:].mean(0); AP[mk, 1:] = cc + (AP[mk][:, 1:] - cc) * (1 - (1 - scale) * (lambda t: t * t * (3 - 2 * t))(min(max((a - .20) / .12, 0), 1)))
    arm['pos'] = AP + arm['nrm'] * (off + .006 * (1 - np.clip((np.abs(AP[:, 0]) - .14) / .15, 0, 1)) + .006 * np.exp(-((np.abs(AP[:, 0]) - .40) / .09) ** 2))[:, None]; arm['uv'] = np.tile(uvs, (len(AP), 1)).astype(arm['uv'].dtype)      # + a small lift over the elbow so the bone never shows through a bent arm
    cl = np.abs(arm['pos'][:, 0]) > xend - .04; arm['pos'][cl, 0] = np.sign(arm['pos'][cl, 0]) * (xend - .04)      # every rim vertex lands on one plane: a clean cuff ring
    n0 = len(top['pos'])
    for k in ('pos', 'nrm', 'uv', 'jj', 'ww'): top[k] = np.concatenate([top[k], arm[k]])
    top['ix'] = np.concatenate([top['ix'], arm['ix'] + n0]).astype(top['ix'].dtype); top['nrm'] = wnorm(top['pos'], top['ix'].reshape(-1, 3)).astype(top['nrm'].dtype)
    for k in ('tex', 'srctex'):
        if k in p: top[k] = p[k]
    return top

def relax_hands(body, kn=.745, tip=.855, yc=1.545, tmax=34.0):
    """the donor hand is a flat board with the fingers stretched out in one plane: the fingers get a relaxed natural curl toward the palm (progressive from the knuckles, the thumb stays free), so a hanging hand reads as a hand and not as a paddle"""
    P = body['pos'].copy(); ax = np.abs(P[:, 0]); d = ax - kn; m = (d > 0) & (P[:, 1] > 1.40) & (ax < tip + .02)
    zr = (P[:, 2] - .035) / .11                                   # 0 = thumb side edge .. 1 = little-finger side
    th = np.deg2rad(tmax) * np.clip(d / (tip - kn), 0, 1.1) ** 1.25 * (.55 + .45 * np.clip(zr, 0, 1))      # the little finger curls more, as in a resting hand
    dy = P[:, 1] - yc; cth, sth = np.cos(th), np.sin(th)
    nd = d * cth + dy * sth; ny = -d * sth + dy * cth
    P[m, 0] = np.sign(P[m, 0]) * (kn + nd[m]); P[m, 1] = yc + ny[m]
    out = dict(body); out['pos'] = P.astype(body['pos'].dtype); out['nrm'] = wnorm(P, body['ix'].reshape(-1, 3)).astype(body['nrm'].dtype); return out

def arm_tube(body, uvs, tpl, xa, xb, scale=.90, off=.007, x0=.20):
    """a smooth sleeve / cuff grown from our own arm surface between |x|=xa..xb (same method as swap_sleeves); cloth uv fixed to one swatch, template prim tpl supplies mat and textures"""
    BF = body['ix'].reshape(-1, 3); bV = body['pos'][BF]; bc = bV.mean(1)
    am = (np.abs(bc[:, 0]) > xa) & (np.abs(bV[:, :, 0]).max(1) < xb) & (bc[:, 1] > 1.2) & (bc[:, 1] < 1.65)
    arm = sub(body, am, tpl['mat']); AP = arm['pos'].copy()
    for sg in (-1, 1):
        for a in np.arange(xa, xb, .025):
            mk = (np.sign(AP[:, 0]) == sg) & (np.abs(AP[:, 0]) >= a) & (np.abs(AP[:, 0]) < a + .025)
            if mk.sum() > 3: cc = AP[mk][:, 1:].mean(0); AP[mk, 1:] = cc + (AP[mk][:, 1:] - cc) * (1 - (1 - scale) * (lambda t: t * t * (3 - 2 * t))(min(max((a - x0) / .12, 0), 1)))
    arm['pos'] = AP + arm['nrm'] * (off + .006 * (1 - np.clip((np.abs(AP[:, 0]) - .14) / .15, 0, 1)))[:, None]; arm['uv'] = np.tile(uvs, (len(AP), 1)).astype(arm['uv'].dtype)
    cl = np.abs(arm['pos'][:, 0]) > xb - .04; arm['pos'][cl, 0] = np.sign(arm['pos'][cl, 0]) * (xb - .04)
    arm['nrm'] = wnorm(arm['pos'], arm['ix'].reshape(-1, 3)).astype(arm['nrm'].dtype)
    for k in ('tex', 'srctex'):
        if k in tpl: arm[k] = tpl[k]
    return arm

def casual(T, body):
    lv, wpl, ltx, fu, wpf, ftx = donors(); fu = retex(copy.deepcopy(fu), T, 'F', ftx); out = []
    fu = shift_by_joints([p for p in fu if 'face' not in p['mat'] and 'hair' not in p['mat']], wpf, wpl)
    align_z(fu, body); align_legs_x(fu, body)
    for p in fu:
        c = centroid(p)
        if p['pos'].shape[0] == 3080:     # vest + shirt + breeches in one mesh: split so top and trousers dye separately
            top = swap_sleeves(sub(p, c[:, 1] >= 1.075, 'Outfit_Peasant_Body'), body, scale=.80, off=.012, x0=.17, xs=.12, ylow=1.2)
            out.append(top); out.append(sub(p, c[:, 1] < 1.075, 'Outfit_Peasant_Legs'))
        elif p['pos'].shape[0] == 980: q = dict(p); q['mat'] = 'Outfit_Peasant_Feet'; out.append(q)
    tight = [p for p in out if p['mat'] != 'Outfit_Peasant_Body']; fixed = BB.inflate(tight, body, margin=.014, reach=.14)      # the waistcoat and shirt are interleaved layers: pushing them out of the body one by one swapped their order (jagged shirt shards through the vest), so the top keeps the donor's own layering
    for p, q in zip(tight, fixed): p.update(q)
    return out

def limbs(body, amp=1.0):
    """legs, arms and neck anatomy (reference: lean athletic anime build): quadriceps with the vastus sweep, kneecap, calf bellies, tapered ankles, shin crest, hamstrings,
    biceps/triceps, forearm bulge to a slim wrist, sternocleidomastoid cords and stronger collarbones; displacement along the normal"""
    P = body['pos']; N = body['nrm']; x = P[:, 0]; y = P[:, 1]; z = P[:, 2]; ax = np.abs(x); fr = np.clip((N[:, 2] + .1) / .6, 0, 1); bk = np.clip((-N[:, 2] + .1) / .6, 0, 1)
    d = np.zeros(len(P)); leg = (y < 1.0) & (ax > .015)
    lx = ax - .085                                                                                       # leg axis
    d += .0075 * _gauss(y - .80, .085) * _gauss(lx + .004, .045) * fr * leg                              # quadriceps (rectus)
    d += .0040 * _gauss(y - .72, .10) * _gauss(lx - .040, .022) * leg * np.clip(N[:, 0] * np.sign(x) * 2, 0, 1)   # vastus lateralis sweep
    d += .0030 * _gauss(y - .66, .035) * _gauss(lx + .035, .018) * fr * leg                              # vastus medialis teardrop
    d += .0050 * _gauss(y - .50, .022) * _gauss(lx, .022) * fr * leg                                     # kneecap
    d -= .0030 * _gauss(y - .445, .016) * fr * leg                                                        # groove below the knee
    d += .0100 * _gauss(y - .375, .055) * _gauss(lx - .004, .040) * bk * leg                             # calf belly
    d += .0040 * _gauss(y - .33, .06) * _gauss(lx - .02, .02) * leg * np.clip(N[:, 0] * np.sign(x) * 2, 0, 1)    # outer gastrocnemius
    d += .0028 * _gauss(y - .30, .09) * _gauss(lx + .002, .014) * fr * leg                               # shin crest
    d += .0040 * _gauss(y - .80, .09) * _gauss(lx, .040) * bk * leg                                      # hamstrings
    d -= .0045 * _gauss(y - .095, .040) * leg                                                             # slim ankle
    d += .0030 * _gauss(y - .98, .03) * _gauss(lx, .05) * bk * leg                                       # glute fold
    arm = (ax > .20) & (ax < .64) & (y > 1.35) & (y < 1.62); ut = np.clip(N[:, 1] * 2 + .3, 0, 1)
    d += .0055 * _gauss(ax - .31, .050) * arm * np.clip(N[:, 1] * 1.5 + N[:, 2] * 1.0, 0, 1)              # biceps
    d += .0045 * _gauss(ax - .31, .055) * arm * np.clip(-N[:, 1] * 1.5 - N[:, 2] * .8, 0, 1)              # triceps
    d += .0050 * _gauss(ax - .445, .045) * arm                                                            # forearm bulge
    d -= .0050 * _ss((ax - .50) / .06) * (1 - _ss((ax - .64) / .05)) * arm                                # slim wrist
    d -= .0030 * _gauss(ax - .385, .014) * arm                                                            # elbow crease
    nk = (ax < .09) & (y > 1.50) & (y < 1.60); sc = _gauss(ax - (.018 + (y - 1.52) * .62), .008) * _ss((y - 1.515) / .02) * (1 - _ss((y - 1.585) / .015))
    d += .0020 * sc * fr * nk                                                                              # sternocleidomastoid cords (front V)
    d += .0008 * _gauss(y - (1.508 + .12 * (ax - .02)), .010) * _ss((ax - .015) / .02) * (1 - _ss((ax - .12) / .03)) * fr   # collarbones, stronger
    out = dict(body); out['pos'] = P + N * (d * amp)[:, None]; out['nrm'] = wnorm(out['pos'], body['ix'].reshape(-1, 3)); return out

def subdivide(p, region):
    """conforming midpoint subdivision of the faces picked by region(face centroids): the shoulder/neck/chest surface was 13-21 mm per edge, too coarse for anatomy to read; split edges are shared with the neighbours, so there are no cracks"""
    F = p['ix'].reshape(-1, 3).astype(np.int64); P = p['pos']; n = len(P); sel = region(P[F].mean(1))
    E = np.stack([np.minimum(F[:, [0, 1, 2]], F[:, [1, 2, 0]]), np.maximum(F[:, [0, 1, 2]], F[:, [1, 2, 0]])], -1).reshape(-1, 2)
    key = E[:, 0] * n + E[:, 1]; uk, inv = np.unique(key, return_inverse=True)
    _, wid = np.unique(np.round(P, 5), axis=0, return_inverse=True); wid = wid.reshape(-1); WE = np.sort(wid[E], 1); wk = WE[:, 0] * n + WE[:, 1]; uw, iw = np.unique(wk, return_inverse=True)
    fw = np.zeros(len(uw), bool); fw[iw[np.repeat(sel, 3)]] = True; flag = np.zeros(len(uk), bool); flag[inv[fw[iw]]] = True       # the flag is shared across uv/normal seams (duplicate vertices), so no cracks open there
    ua, ub = uk // n, uk % n; mid = np.where(flag, n + np.cumsum(flag) - 1, -1)
    sp = flag.reshape(-1)[inv].reshape(-1, 3); m = mid[inv].reshape(-1, 3)
    A, B = ua[flag], ub[flag]; q = dict(p)
    q['pos'] = np.concatenate([P, (P[A] + P[B]) / 2]); q['uv'] = np.concatenate([p['uv'], (p['uv'][A] + p['uv'][B]) / 2]).astype(p['uv'].dtype)
    nn = p['nrm'][A] + p['nrm'][B]; q['nrm'] = np.concatenate([p['nrm'], nn / np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-9)]).astype(p['nrm'].dtype)
    jj = np.zeros((len(A), 4), p['jj'].dtype); ww = np.zeros((len(A), 4), p['ww'].dtype)
    for i in range(len(A)):
        d = {}
        for k in range(4):
            d[int(p['jj'][A[i], k])] = d.get(int(p['jj'][A[i], k]), 0) + float(p['ww'][A[i], k]) / 2; d[int(p['jj'][B[i], k])] = d.get(int(p['jj'][B[i], k]), 0) + float(p['ww'][B[i], k]) / 2
        it = sorted(d.items(), key=lambda t: -t[1])[:4]; s = sum(v for _, v in it) or 1
        for k, (j, v) in enumerate(it): jj[i, k] = j; ww[i, k] = v / s
    q['jj'] = np.concatenate([p['jj'], jj]); q['ww'] = np.concatenate([p['ww'], ww])
    v0, v1, v2 = F[:, 0], F[:, 1], F[:, 2]; m0, m1, m2 = m[:, 0], m[:, 1], m[:, 2]; s0, s1, s2 = sp[:, 0], sp[:, 1], sp[:, 2]; cnt = sp.sum(1); out = [F[cnt == 0]]
    def add(mask, a, b, c): 
        if mask.any(): out.append(np.stack([a[mask], b[mask], c[mask]], 1))
    k = cnt == 3; add(k, v0, m0, m2); add(k, m0, v1, m1); add(k, m2, m1, v2); add(k, m0, m1, m2)
    k = (cnt == 1) & s0; add(k, v0, m0, v2); add(k, m0, v1, v2)
    k = (cnt == 1) & s1; add(k, v1, m1, v0); add(k, m1, v2, v0)
    k = (cnt == 1) & s2; add(k, v2, m2, v1); add(k, m2, v0, v1)
    k = (cnt == 2) & s0 & s1; add(k, m0, v1, m1); add(k, v0, m0, m1); add(k, v0, m1, v2)
    k = (cnt == 2) & s1 & s2; add(k, m1, v2, m2); add(k, v0, v1, m1); add(k, v0, m1, m2)
    k = (cnt == 2) & s2 & s0; add(k, m2, v0, m0); add(k, m0, v1, v2); add(k, m0, v2, m2)
    q['ix'] = np.concatenate(out).reshape(-1).astype(p['ix'].dtype); q['nrm'] = wnorm(q['pos'], q['ix'].reshape(-1, 3)).astype(p['nrm'].dtype); return q

def shoulder_anatomy(body, amp=.8):
    """neck-shoulder-chest structure after the reference: suprasternal notch, clavicles with their grooves, sternocleidomastoid cords, trapezius edge, acromion, separated deltoid with the delto-pectoral groove"""
    P = body['pos']; N = body['nrm']; x = P[:, 0]; y = P[:, 1]; ax = np.abs(x); sg = np.sign(x)
    fr = np.clip((N[:, 2] + .05) / .45, 0, 1); bk = np.clip((-N[:, 2] + .05) / .45, 0, 1); up = np.clip(N[:, 1] * 2.2, 0, 1); d = np.zeros(len(P))
    d -= .0075 * _gauss(ax, .013) * _gauss(y - 1.512, .011) * fr                                                         # suprasternal notch
    yc = 1.512 + .10 * ax; cl = _ss((ax - .014) / .012) * (1 - _ss((ax - .165) / .02))
    d += .0022 * _gauss(y - yc, .0105) * cl * (fr + up * .4); d -= .0016 * _gauss(y - (yc - .019), .011) * cl * fr; d -= .0012 * _gauss(y - (yc + .021), .012) * cl * (fr + up * .5)   # clavicle + grooves
    xc = .020 + (y - 1.522) * .33; sm_ = _ss((y - 1.516) / .012) * (1 - _ss((y - 1.583) / .014))
    d += .0042 * _gauss(ax - xc, .0085) * sm_ * fr; d -= .0016 * _gauss(ax - xc - .019, .008) * sm_ * fr; d -= .0016 * _gauss(ax, .009) * sm_ * fr               # sternocleidomastoid cords + throat
    yt = 1.596 - .34 * (ax - .05); d += .0018 * _gauss(y - yt, .014) * _ss((ax - .05) / .02) * (1 - _ss((ax - .17) / .02)) * np.clip(up + bk * .5, 0, 1)            # trapezius edge
    d += .0090 * _gauss(ax - .225, .055) * _gauss(y - 1.505, .040) * (1 - bk * .4) * (N[:, 1] * 0 + 1)                    # deltoid mass
    d -= .0016 * _gauss(ax - .158, .014) * _ss((y - 1.43) / .02) * (1 - _ss((y - 1.53) / .02)) * fr                      # delto-pectoral groove
    d += .0018 * _gauss(ax - .182, .014) * _gauss(y - 1.557, .012) * up                                                  # acromion
    d += .0015 * _gauss(ax - .06, .035) * _gauss(y - 1.43, .035) * bk                                                     # upper-back trapezius / rhomboid plate
    out = dict(body); out['pos'] = P + N * (d * amp)[:, None]; out['nrm'] = wnorm(out['pos'], body['ix'].reshape(-1, 3)); return out

def skin_uv(body):
    """bake form shading into the skin: the body has no unwrap, so each vertex points at a column of a small gradient atlas (u = cavity/curvature occlusion, v = blush) - cavities (armpits, groin, between ribs, collar hollows, finger gaps) go warm and deep,
    ridges catch light, elbows/knees/knuckles/fingertips/nipples/shoulders blush. Weld-aware, so UV seams cannot show."""
    import scipy.sparse as sps
    P = body['pos'].astype(np.float64); N = body['nrm'].astype(np.float64); F = body['ix'].reshape(-1, 3); n = len(P)
    _, wid = np.unique(np.round(P, 5), axis=0, return_inverse=True); wid = wid.reshape(-1); nw = wid.max() + 1
    E = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]; E = wid[E]; E = E[E[:, 0] != E[:, 1]]; E = np.r_[E, E[:, ::-1]]
    A = sps.coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(nw, nw)).tocsr(); A.data[:] = 1; Dn = sps.diags(1 / np.maximum(np.asarray(A.sum(1)).reshape(-1), 1)) @ A
    cnt = np.bincount(wid, minlength=nw)[:, None]; Pw = np.zeros((nw, 3)); np.add.at(Pw, wid, P); Pw /= cnt; Nw = np.zeros((nw, 3)); np.add.at(Nw, wid, N); Nw /= np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-9)
    L = Dn @ Pw - Pw; h = np.asarray(np.sqrt(((Dn @ Pw - Pw) ** 2).sum(1))).reshape(-1) + 1e-6; h2 = np.asarray(Dn @ h).reshape(-1) ** 2 + 1e-8
    cf = (L * Nw).sum(1) / h2
    for _ in range(5): cf = Dn @ cf                                                                       # fine curvature (positive = concave)
    Ps = Pw.copy()
    for _ in range(18): Ps = Ps + .6 * (Dn @ Ps - Ps)
    occ = ((Ps - Pw) * Nw).sum(1)                                                                                        # broad cavity depth (metres)
    u = .62 - .07 * np.tanh(cf * .8) - .28 * np.clip(occ / .016, -.2, 1.0); u = np.clip(u, .06, .94)
    x = Pw[:, 0]; y = Pw[:, 1]; z = Pw[:, 2]; ax = np.abs(x); fr = np.clip((Nw[:, 2] + .2) / .6, 0, 1); g = lambda a, s: np.exp(-.5 * (a / s) ** 2)
    b = .45 * g(y - .50, .045) * g(ax - .085, .06) * fr + .55 * g(ax - .385, .035) * (y > 1.3) + .35 * g(ax - .21, .04) * g(y - 1.53, .04)       # knees, elbows, shoulders
    b += .7 * np.clip((ax - .66) / .09, 0, 1) * (y > 1.2) + .6 * g(ax - .078, .016) * g(y - 1.395, .016) * fr + .5 * np.clip((.05 - y) / .04, 0, 1) * (y < .08)   # fingers, nipples, toes
    b = np.clip(b, 0, 1)
    out = dict(body); out['uv'] = np.stack([.03 + .94 * u[wid], .03 + .94 * b[wid]], 1).astype(body['uv'].dtype)
    # the carved grooves (spine, scapula edge) are narrower than the mesh: their sliver faces caught the light as hairlines. Normals are relaxed over the welded surface so the shading stays continuous
    P = out['pos'].astype(float); F = out['ix'].reshape(-1, 3); k = np.round(P * 2e4).astype(np.int64); _, inv = np.unique(k, axis=0, return_inverse=True); inv = inv.ravel(); m = inv.max() + 1
    Fv = inv[F]; ea = np.r_[Fv[:, 0], Fv[:, 1], Fv[:, 2], Fv[:, 1], Fv[:, 2], Fv[:, 0]]; eb = np.r_[Fv[:, 1], Fv[:, 2], Fv[:, 0], Fv[:, 0], Fv[:, 1], Fv[:, 2]]
    N = np.zeros((m, 3)); np.add.at(N, inv, out['nrm'].astype(float)); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9); cn = np.maximum(np.bincount(ea, minlength=m), 1)[:, None]
    for _ in range(4):
        S2 = np.zeros((m, 3)); np.add.at(S2, ea, N[eb]); N = .4 * N + .6 * S2 / cn; N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    out['nrm'] = N[inv].astype(body['nrm'].dtype)
    first = np.full(m, -1, np.int64); first[inv[::-1]] = np.arange(len(inv))[::-1]; src = first[inv]          # vertices doubled on the seam had different bone weights and tore apart as soon as the body moved: they now share their first twin's weights
    out['jj'] = out['jj'][src]; out['ww'] = out['ww'][src]; return out

def skin_atlas(c0, w=128, h=64):
    c0 = np.array(c0, float)[:3]; u = np.linspace(0, 1, w)[None, :, None]; v = np.linspace(0, 1, h)[:, None, None]
    dark = c0 * np.array([.86, .72, .68]); light = np.minimum(255, c0 * np.array([1.02, 1.04, 1.05])); rosy = np.array([1.0, .86, .84])
    col = np.where(u < .5, dark + (c0 - dark) * (u / .5), c0 + (light - c0) * ((u - .5) / .5)); col = col * (1 + (rosy - 1) * v)
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')

def slim_arms(body, upper=.84, fore=.90, x0=.19):
    """slimmer arms: each arm cross-section is drawn in toward its own centre line (the shoulder cap and the hand are left alone)"""
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    P = body['pos'].copy(); ax = np.abs(P[:, 0]); out = dict(body)
    for sg in (-1, 1):
        for a in np.arange(x0 - .02, .72, .02):
            mk = (np.sign(P[:, 0]) == sg) & (ax >= a) & (ax < a + .02) & (P[:, 1] > 1.3)
            if mk.sum() < 4: continue
            k = (upper + (fore - upper) * sm((a - .35) / .2)); k = 1 - (1 - k) * sm((a - x0) / .08) * (1 - sm((a - .58) / .1))
            cc = P[mk][:, 1:].mean(0); P[mk, 1:] = cc + (P[mk][:, 1:] - cc) * k
    out['pos'] = P; out['nrm'] = wnorm(P, body['ix'].reshape(-1, 3)); return out

def shoulder_slope(body):
    """one long, even slope from the side of the neck to the acromion (the reference): the old surface climbed to a trapezius mound and then dropped off a cliff to a flat shelf at the arm, which read as a hunch.
    The top envelope is measured on the mesh itself and the shoulder girdle is lifted to a designed profile; the neck column and the arm are untouched."""
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    P = body['pos'].copy(); ax = np.abs(P[:, 0]); y = P[:, 1]
    tx = np.array([.05, .08, .10, .12, .14, .16, .18, .20, .22, .26, .30, .34, .40]); ty = np.array([1.606, 1.592, 1.583, 1.574, 1.566, 1.559, 1.553, 1.548, 1.543, 1.534, 1.526, 1.520, 1.518])
    bins = np.arange(0, .46, .015); env = np.zeros(len(bins) - 1)
    for i in range(len(env)):
        k = (ax >= bins[i]) & (ax < bins[i + 1]) & (y > 1.45) & (P[:, 2] > -.25); env[i] = P[k][:, 1].max() if k.any() else 9
    mid = (bins[:-1] + bins[1:]) / 2; lift = np.clip(np.interp(mid, tx, ty) - env, 0, .05) * (mid > .075) * (mid < .40)
    for _ in range(3): lift[1:-1] = (lift[:-2] + 2 * lift[1:-1] + lift[2:]) / 4
    dy = np.interp(ax, mid, lift) * sm((y - 1.44) / .07) * (1 - sm((ax - .36) / .06)) * sm((ax - .07) / .03)
    P[:, 1] += dy; out = dict(body); out['pos'] = P; out['nrm'] = wnorm(P, body['ix'].reshape(-1, 3)); return out

def trapezius(body, rise=.004):
    """the trapezius climbs to the base of the neck (reference: neck short, shoulder line a steep, even slope), shoulders rounded and evenly widened"""
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    P = body['pos'].copy(); ax = np.abs(P[:, 0]); y = P[:, 1]
    g = np.exp(-.5 * ((ax - .115) / .055) ** 2) * sm((y - 1.50) / .05) * (1 - sm((y - 1.60) / .03)) * (1 - sm((ax - .17) / .06))
    P[:, 1] += rise * g
    import scipy.sparse as sps
    F = body['ix'].reshape(-1, 3); E = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]; E = np.r_[E, E[:, ::-1]]; n = len(P)
    A = sps.coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)).tocsr(); A.data[:] = 1; Dn = sps.diags(1 / np.maximum(np.asarray(A.sum(1)).reshape(-1), 1)) @ A
    wm = .6 * sm((y - 1.44) / .04) * (1 - sm((ax - .24) / .05)) * (1 - sm((y - 1.575) / .02) * (ax < .075))      # smooth the shoulder girdle; the neck column itself is left exactly as it was
    for _ in range(10): P = P + wm[:, None] * (Dn @ P - P)
    out = dict(body); out['pos'] = P; out['nrm'] = wnorm(P, body['ix'].reshape(-1, 3)); return out

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
    push = np.minimum(push, depth) * (np.clip((P[:, 1] - .24) / .14, 0, 1) if fade else 1) * (1 - np.clip((np.abs(P[:, 0]) - .17) / .04, 0, 1) * np.clip((P[:, 1] - 1.25) / .05, 0, 1))      # arms are not tucked (only shrunk afterwards): no braided arm          # never below the ankle: bare feet and ankles stay exactly as modelled
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

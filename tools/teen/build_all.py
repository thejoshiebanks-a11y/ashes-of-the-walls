"""Build every base pack of the v3 character system.
 common (identical for every base): the new anime body, boxers, Levi scout kit + ODM gear, Furlan casual, traveller armour
 per base: its own head piece, skin tone, its own face, and a shared library of 6 faces and 8 hair styles transplanted onto every head."""
import sys, os, copy, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import build_bases as BB, compose as C
from build_bases import mean_skin, tone_match, move_hair, face_set, FACE_PART, assemble

S = os.environ['S']; OLD = S + '/w/g10/assets'; NEWDIR = S + '/nb/New base boy/'
BASES = ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen']      # face k = native face of BASES[k]
NEWM = {'nin': ('anime_boy_ninja_character_-_fully_rigged.glb', 'N0'), 'blen': ('anime_boy_for_blender..glb', 'F0')}
OFF = {k: 1000 * (i + 1) for i, k in enumerate(BASES)}

def dropflange(p):
    """the head piece of the old bodies ends in a collar flange (trapezius stump); the new body has its own smooth trapezius, so the flange would hover above it: keep only the neck column"""
    if p['mat'] != 'Skin_Body': return p
    P = p['pos']; bad = (np.abs(P[:, 0]) > .0615) & (P[:, 1] < 1.60); return C.sub(p, ~bad[p['ix'].reshape(-1, 3)].any(1))      # every triangle touching the flange goes; the neck tube (|x| <= .06) and the jaw stay
def load_sources():
    src = {}
    for k in ('boy', 'dragon', 'beauty', 'lad'):
        pr, wp, tx = BB.read_pack(os.path.join(OLD, k), k)
        head = [p for p in C.head_parts(pr, wp, wp) if p['mat'] == 'Skin_Body']            # head piece (no shift)
        faces = {int(p['mat'][4]): p for p in pr if False}
        head = [dropflange(p) for p in head]
        src[k] = dict(wp=wp, tx=tx, head=head, prims=pr)
    for k, (f, hid) in NEWM.items():
        raw, wp, texs = BB.convert(NEWDIR + f, BB.VRM, 'vrm', 512); own = BB.name_native(raw, hid, 'X'); tx = dict(enumerate(texs))
        body = [p for p in own if p['mat'] == 'Skin_Body'][0]; c = C.centroid(body); sel = (c[:, 1] > 1.545) & (np.abs(c[:, 0]) < .3)
        head = [C.sub(body, sel)]
        head = [dropflange(p) for p in head]
        src[k] = dict(wp=wp, tx=tx, head=head, prims=own, hid=hid)
    return src

def with_tex(prims, tx, off, T):
    out = []
    for p in prims:
        q = dict(p)
        if p.get('srctex') is not None: T[off + p['srctex']] = tx[p['srctex']]; q['srctex'] = off + p['srctex']
        out.append(q)
    return out

def strip_collar(q, d, T):
    """two of the donor hairstyles carry the donor's white head-and-neck dummy inside the hair: the neck part stuck out under the chin as a black collar (the dummy takes the hair colour). Faces below the jaw that are skin-white in the hair map, and anything hanging in front of the throat, are removed; the scalp cap above the jaw stays"""
    F = q['ix'].reshape(-1, 3); c = q['pos'][F].mean(1)
    bad = (c[:, 1] < d[1] - .057) & (np.abs(c[:, 0] - d[0]) < .11) & (c[:, 2] > d[2] + .009)
    t = q.get('srctex')
    if t is not None and t in T:
        im = np.asarray(T[t].convert('RGBA'), float) / 255; h, w = im.shape[:2]; uv = q['uv']
        l = (im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)][:, :3] @ np.array([.299, .587, .114]))[F].mean(1)
        bad |= (c[:, 1] < d[1] - .028) & (l > .7)
    if not bad.any(): return q
    k = C.sub(q, ~bad, q['mat'])
    for key in q:
        if key not in k: k[key] = q[key]
    return k

def hair_norm(parts, T):
    """the game dyes hair as tint x (luma*1.6+.05): a hair map whose own brightness is dark (or a flat untextured hair) would swallow every colour.
    Re-base every hair map to a mid-grey luma (keeping its strand/highlight structure and alpha) so each style takes the whole dye range."""
    done = {}
    for p in parts:
        if not p['mat'].startswith('Hair_'): continue
        t = p.get('srctex')
        if t is None:
            if 39999 not in T: T[39999] = Image.new('RGBA', (8, 8), (132, 132, 132, 255))
            p['srctex'] = 39999; continue
        if t in done: continue
        im = np.asarray(T[t].convert('RGBA'), float) / 255; l = im[..., :3] @ np.array([.299, .587, .114]); a = im[..., 3] > .5
        m = float(l[a].mean()) if a.any() else .3; sd = float(l[a].std()) if a.any() else .1
        nl = np.clip(.50 + (l - m) * min(2.4, max(1.0, .17 / max(sd, 1e-3))), .06, .98)             # mean .50, contrast raised if the map is flat
        out = np.concatenate([np.repeat(nl[..., None], 3, 2), im[..., 3:]], 2)
        T[t] = Image.fromarray((out * 255).astype(np.uint8), 'RGBA'); done[t] = 1

def shrink_dressed(bd, wp):
    """the skin worn under clothes is also drawn in 14% around each leg and 12% around each arm (hands and feet excepted): under any outfit it can no longer show through at a seam while the limbs bend; the bare body is never touched"""
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    P = bd['pos'].copy(); x, y = P[:, 0], P[:, 1]; sg = np.where(x >= 0, 1., -1.)
    for side, (a, b, c) in ((1., (1, 2, 3)), (-1., (5, 6, 7))):
        ys = [wp[c][1], wp[b][1], wp[a][1]]; cx = np.interp(y, ys, [wp[c][0], wp[b][0], wp[a][0]]); cz = np.interp(y, ys, [wp[c][2], wp[b][2], wp[a][2]])
        m = (sg == side) & (y < 1.02) & (np.abs(x) > .012); k = 1 - .14 * sm((1.0 - y) / .08) * sm((y - .16) / .1)
        P[m, 0] = cx[m] + (x[m] - cx[m]) * k[m]; P[m, 2] = cz[m] + (P[m, 2] - cz[m]) * k[m]
    f = (y < .07); P[f, 1] = y[f] * (1 - .2 * sm((.07 - y[f]) / .05))
    ax = np.abs(x); kk = 1 - .12 * sm((ax - .12) / .08) * (1 - sm((ax - .46) / .1)); m = (y > 1.3) & (ax > .12)
    P[m, 1] = wp[13][1] + (P[m, 1] - wp[13][1]) * kk[m]; P[m, 2] = wp[13][2] + (P[m, 2] - wp[13][2]) * kk[m]
    bd = dict(bd); bd['pos'] = P; bd['nrm'] = C.wnorm(P, bd['ix'].reshape(-1, 3)).astype(bd['nrm'].dtype); return bd

def fit_sleeves(prims, bd, mats=('Outfit_Scout_Body', 'Outfit_Ranger_Arms', 'Outfit_Ranger_ArmsBracer', 'Outfit_Ranger_AccPauldron')):
    """the donor jackets' sleeves hang ~3 cm higher / further back than our arm and are no wider: the skin showed beside them. Per x-slice, each sleeve is moved onto the arm's own centre line and widened to clear it."""
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    P = bd['pos']; ax = np.abs(P[:, 0]); edges = np.arange(.17, .70, .03); mid = (edges[:-1] + edges[1:]) / 2; cs, rs = [], []
    for a, b in zip(edges[:-1], edges[1:]):
        k = (ax >= a) & (ax < b) & (P[:, 1] > 1.2); q = P[k][:, 1:]; c = q.mean(0); cs.append(c); rs.append(np.linalg.norm(q - c, axis=1).mean())
    cs = np.array(cs); rs = np.array(rs); out = []
    for p in prims:
        if p['mat'] not in mats: out.append(p); continue
        V = p['pos'].copy(); ax = np.abs(V[:, 0]); w = sm((ax - .17) / .10) * (1 - sm((ax - .60) / .08)) * (V[:, 1] > 1.2) * (V[:, 1] < 1.8)
        for sg in (1, -1):
            for i, (a, b) in enumerate(zip(edges[:-1], edges[1:])):
                k = (np.sign(V[:, 0]) == sg) & (ax >= a) & (ax < b) & (w > .02)
                if k.sum() < 6: continue
                cg = V[k][:, 1:].mean(0); rg = max(np.linalg.norm(V[k][:, 1:] - cg, axis=1).mean(), 1e-3)
                f = 1 + (max(1., (rs[i] * 1.12 + .007) / rg) - 1) * w[k]
                d = (V[k][:, 1:] - cg) * f[:, None]; V[k, 1:] = cg + d + (cs[i] - cg) * w[k][:, None]
        q = dict(p); q['pos'] = V; q['nrm'] = C.wnorm(V, p['ix'].reshape(-1, 3)).astype(p['nrm'].dtype); out.append(q)
    return out

def ranger_lining(ar, body, T):
    """the ranger tunic is an open, torn mesh: a dark-green lining grown from the torso surface sits just under it so the skin can never show through the holes"""
    out = []
    for p in ar:
        if p['mat'] != 'Outfit_Ranger_Body': out.append(p); continue
        im = np.asarray(T[p['srctex']].convert('RGB')).astype(float); h, w = im.shape[:2]; uv = p['uv']
        px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]
        k = (px[:, 1] > px[:, 0] * 1.25) & (px[:, 1] > px[:, 2] * 1.25) & (px[:, 1] < 120)
        uvs = np.median(uv[k], axis=0) if k.sum() > 5 else uv.mean(0)
        BF = body['ix'].reshape(-1, 3); bc = body['pos'][BF].mean(1); m = (bc[:, 1] > 1.10) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .19)
        L = C.sub(body, m, p['mat']); L['pos'] = L['pos'] + L['nrm'] * .006; L['uv'] = np.tile(uvs, (len(L['pos']), 1)).astype(L['uv'].dtype)
        n0 = len(p['pos']); q = dict(p)
        for kk in ('pos', 'nrm', 'uv', 'jj', 'ww'): q[kk] = np.concatenate([p[kk], L[kk]])
        q['ix'] = np.concatenate([p['ix'], L['ix'] + n0]).astype(p['ix'].dtype); out.append(q)
    return out

def ranger_sleeves(ar, body, T):
    """the donor ranger sleeves and bracers are spiky, torn and leave the shoulder bare: replaced by clean sleeves and cuffs grown from our own arm (green cloth, brown leather taken from the tunic texture)"""
    bod = [p for p in ar if p['mat'] == 'Outfit_Ranger_Body'][0]
    im = np.asarray(T[bod['srctex']].convert('RGB')).astype(float); h, w = im.shape[:2]; uv = bod['uv']
    px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]
    kg = (px[:, 1] > px[:, 0] * 1.25) & (px[:, 1] > px[:, 2] * 1.25) & (px[:, 1] < 120); kb = (px[:, 0] > px[:, 1] * 1.25) & (px[:, 1] > px[:, 2] * 1.15) & (px[:, 0] > 70) & (px[:, 0] < 170)
    ug = np.median(uv[kg], axis=0) if kg.sum() > 5 else uv.mean(0); ub = np.median(uv[kb], axis=0) if kb.sum() > 5 else ug
    out = []
    for p in ar:
        if p['mat'] == 'Outfit_Ranger_Arms': out.append(C.arm_tube(body, ug, p, .15, .52, .90, .007))
        elif p['mat'] == 'Outfit_Ranger_ArmsBracer': out.append(C.arm_tube(body, ub, p, .43, .585, .90, .013))
        elif p['mat'] == 'Outfit_Ranger_AccPauldron': out.append(C.arm_tube(body, ub, p, .17, .34, 1.0, .017))
        else: out.append(p)
    return out

def keep_neck(bd, orig):
    """tuck_body presses the dressed skin 4.5 cm under the cloth; at the throat that collapsed the neck into a faceted pyramid showing through every open collar: the neck column and its base keep the untucked, smooth shape"""
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1))
    P = bd['pos'].copy(); O = orig['pos']; assert len(P) == len(O)
    w = sm((np.abs(O[:, 1]) - 1.47) / .05) * (1 - sm((np.abs(O[:, 0]) - .075) / .05)); P = P * (1 - w[:, None]) + O * w[:, None]
    bd = dict(bd); bd['pos'] = P.astype(bd['pos'].dtype); bd['nrm'] = C.wnorm(P, bd['ix'].reshape(-1, 3)).astype(bd['nrm'].dtype); return bd

def smooth_neck(b):
    """The body's neck was a steep cone that met the vertical head-piece tube at a hard angle: a visible ring where 'the neck was attached'. Taubin (shrink-free) Laplacian smoothing of the funnel band (y 1.565-1.625), weld-aware and fading to zero at both edges, turns the cone into a concave trumpet that arrives vertical, so the surfaces flow into each other."""
    import scipy.sparse as sps
    P = b['pos'].astype(np.float64); F = b['ix'].reshape(-1, 3); n = len(P)
    _, wid = np.unique(np.round(P, 5), axis=0, return_inverse=True); wid = wid.reshape(-1); nw = wid.max() + 1
    E = wid[np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]]; E = E[E[:, 0] != E[:, 1]]; E = np.r_[E, E[:, ::-1]]
    A = sps.coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(nw, nw)).tocsr(); A.data[:] = 1; D = sps.diags(1 / np.maximum(np.asarray(A.sum(1)).reshape(-1), 1)) @ A
    cnt = np.bincount(wid, minlength=nw)[:, None]; Pw = np.zeros((nw, 3)); np.add.at(Pw, wid, P); Pw /= cnt
    sm = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1)); y = Pw[:, 1]
    y0 = float(os.environ.get('NB0', '1.560')); w = sm((y - y0) / .02) * (1 - sm((y - 1.610) / .02)); w = w[:, None]
    Q = Pw.copy()
    for _ in range(40):
        Q = Q + .55 * w * (D @ Q - Q); Q = Q + (-.58) * w * (D @ Q - Q)
    P2 = Q[wid]; b = dict(b); b['pos'] = P2.astype(b['pos'].dtype); b['nrm'] = C.wnorm(P2, b['ix'].reshape(-1, 3)).astype(b['nrm'].dtype); return b

YN = 1.575                                                    # height where the body's neck funnel hands over to the head piece's neck tube
def cutneck(b, yn=YN):
    """the funnel above yn is removed (its top edge was ragged and stood proud of the tube); neck_bridge() lofts the tube down onto the funnel surface at yn instead"""
    F = b['ix'].reshape(-1, 3); Pc = b['pos'][F].mean(1)
    return C.sub(b, ~((Pc[:, 1] > yn + float(os.environ.get('CUTUP', '.014'))) & (np.abs(Pc[:, 0]) < float(os.environ.get('CUTX', '.10')))))

def neck_bridge(q, body, yn=YN):
    """A bridge strip loft: the tube's open lower ring is joined to a ring lying ON the body's funnel at yn (same angle, taken from the funnel surface), so the neck is one continuous surface from the shoulders to the head (no ledge, no sawtooth, no overlap)"""
    F = q['ix'].reshape(-1, 3); ec = {}
    for f in F:
        for a, b_ in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])): k = (min(a, b_), max(a, b_)); ec[k] = ec.get(k, 0) + 1
    Pq = q['pos']; _, wid = np.unique(np.round(Pq, 5), axis=0, return_inverse=True); wid = wid.reshape(-1); adj = {}
    for (a, b_), n in ec.items():
        if n == 1: adj.setdefault(wid[a], set()).add(wid[b_]); adj.setdefault(wid[b_], set()).add(wid[a])
    if not adj: return q
    low = min(adj, key=lambda w_: Pq[np.where(wid == w_)[0][0], 1]); seen = {low}; st_ = [low]                        # the ring is the boundary loop that holds the lowest boundary vertex (the head piece also has open seams up its sides: those are not part of it)
    while st_:
        for w2 in adj[st_.pop()]:
            if w2 not in seen: seen.add(w2); st_.append(w2)
    bv = sorted({v for (a, b_), n in ec.items() if n == 1 for v in (a, b_) if wid[v] in seen and Pq[v, 1] < Pq[[np.where(wid == low)[0][0]], 1][0] + .016})
    if len(bv) < 8: return q
    P = q['pos']; c = P[bv][:, [0, 2]].mean(0); th = np.arctan2(P[bv, 2] - c[1], P[bv, 0] - c[0]); o = np.argsort(th); bv = np.array(bv)[o]; th = th[o]
    UV = q['uv'].astype(np.float64); i = 0                                                                  # a UV seam doubles the ring's vertices at one place: order each coincident pair so the texture coordinate never jumps across a strip quad
    while i < len(bv) - 1:
        if np.linalg.norm(P[bv[i]] - P[bv[i + 1]]) < 1e-6:
            pr = UV[bv[i - 1]] if i > 0 else UV[bv[-1]]; nx = UV[bv[i + 2]] if i + 2 < len(bv) else UV[bv[0]]
            c0 = np.abs(UV[bv[i]] - pr).sum() + np.abs(UV[bv[i + 1]] - nx).sum(); c1 = np.abs(UV[bv[i + 1]] - pr).sum() + np.abs(UV[bv[i]] - nx).sum()
            if c1 < c0: bv[i], bv[i + 1] = bv[i + 1], bv[i]
            i += 2
        else: i += 1
    B = body['pos']; m = (np.abs(B[:, 1] - yn) < .005) & (np.abs(B[:, 0]) < float(os.environ.get('CUTX', '.10')) + .005); S_ = B[m]; ts = np.arctan2(S_[:, 2] - c[1], S_[:, 0] - c[0]); rs = np.hypot(S_[:, 2] - c[1], S_[:, 0] - c[0])
    nb = 72; ed = np.linspace(-np.pi, np.pi, nb + 1); rb = np.full(nb, np.nan)
    for k in range(nb):
        s_ = (ts >= ed[k]) & (ts < ed[k + 1])
        if s_.any(): rb[k] = rs[s_].max()
    ok = ~np.isnan(rb); tc = (ed[:-1] + ed[1:]) / 2; rr = np.interp(th, np.r_[tc[ok] - 2 * np.pi, tc[ok], tc[ok] + 2 * np.pi], np.r_[rb[ok], rb[ok], rb[ok]]) - .0015
    rr = np.maximum(rr, np.hypot(P[bv, 2] - c[1], P[bv, 0] - c[0]) + .004)
    new = np.stack([c[0] + rr * np.cos(th), np.full(len(th), yn), c[1] + rr * np.sin(th)], 1)
    kd = __import__('scipy.spatial', fromlist=['cKDTree']).cKDTree(B); _, ni = kd.query(new)
    n0 = len(P); n = len(bv); idx = np.arange(n0, n0 + n)
    tri = []
    for i in range(n):
        a, b_ = bv[i], bv[(i + 1) % n]; c_, d_ = idx[(i + 1) % n], idx[i]
        tri += [[a, b_, c_], [a, c_, d_]]
    tri = np.array(tri); fn = np.cross(np.r_[P, new][tri[:, 1]] - np.r_[P, new][tri[:, 0]], np.r_[P, new][tri[:, 2]] - np.r_[P, new][tri[:, 0]]); out = np.r_[P, new][tri].mean(1) - np.array([c[0], 1.58, c[1]]) * np.array([1, 0, 1]) + np.array([0, .08, 0])
    flip = (fn * out).sum(1) < 0; tri[flip] = tri[flip][:, ::-1]
    d = dict(q); d['pos'] = np.r_[P, new]; d['nrm'] = np.r_[q['nrm'], body['nrm'][ni]].astype(q['nrm'].dtype); d['uv'] = np.r_[q['uv'], q['uv'][bv]]
    d['jj'] = np.r_[q['jj'], body['jj'][ni]]; d['ww'] = np.r_[q['ww'], body['ww'][ni]]; d['ix'] = np.r_[q['ix'], tri.reshape(-1)].astype(q['ix'].dtype); return d   # the strip's lower ring is skinned exactly like the funnel it lies on (so it can never come away from it when the head pitches or turns); its upper ring keeps the tube's own weights; d['ix'] = np.r_[q['ix'], tri.reshape(-1)].astype(q['ix'].dtype); return d

def snapneck(q, body):
    """the head piece's neck tube must never stand proud of the body's neck: below y 1.615 its half-width is held 3 mm inside the body's own neck (fading out above), so the tube's lower rim is
    hidden inside the body and the two surfaces simply cross -- no wings, no collar ledge"""
    Fq = q['ix'].reshape(-1, 3); q = C.sub(q, ~(q['pos'][Fq][:, :, 1].min(1) < 1.594))                 # the tube's flared lower skirt goes; its rim now starts inside the body
    B = body['pos']; P = q['pos'].copy(); ys = np.arange(1.50, 1.70, .004); hw = []
    for y in ys:
        s = B[(np.abs(B[:, 1] - y) < .006) & (np.abs(B[:, 0]) < .1)]; hw.append(np.abs(s[:, 0]).max() if len(s) > 3 else np.nan)
    hw = np.array(hw); ok = ~np.isnan(hw); hwy = np.interp(P[:, 1], ys[ok], hw[ok]); f = np.clip((1.618 - P[:, 1]) / .008, 0, 1); f = f * f * (3 - 2 * f)
    lim = np.minimum(np.abs(P[:, 0]), np.maximum(hwy - float(os.environ.get('HIN', '.001')), .02)); P[:, 0] = np.sign(P[:, 0]) * (np.abs(P[:, 0]) * (1 - f) + lim * f)
    if os.environ.get('DBGNECK'):
        for y in np.arange(1.55, 1.70, .01):
            f_ = lambda A: (lambda t: (np.abs(t[:, 0]).max(), t[:, 2].min(), t[:, 2].max(), len(t)) if len(t) else None)(A[(np.abs(A[:, 1] - y) < .005) & (np.abs(A[:, 0]) < .12)])
            print('y %.2f body' % y, f_(B), 'tube', f_(q['pos']))
    zlo = []; zhi = []
    for y in ys:                                                                                      # depth: the tube's back/front rim must also sit inside the body's neck, or a wedge of sky shows behind the nape
        s_ = B[(np.abs(B[:, 1] - y) < .006) & (np.abs(B[:, 0]) < .06)]; zlo.append(s_[:, 2].min() if len(s_) > 3 else np.nan); zhi.append(s_[:, 2].max() if len(s_) > 3 else np.nan)
    zlo = np.array(zlo); zhi = np.array(zhi); ok2 = ~np.isnan(zlo); zl = np.interp(P[:, 1], ys[ok2], zlo[ok2]) + float(os.environ.get('HIN', '.001')); zh = np.interp(P[:, 1], ys[ok2], zhi[ok2]) - float(os.environ.get('HIN', '.001'))
    P[:, 2] = P[:, 2] * (1 - f) + np.clip(P[:, 2], zl, np.maximum(zh, zl + .02)) * f
    q = dict(q); q['pos'] = P; N = C.wnorm(P, q['ix'].reshape(-1, 3))
    # shading weld: where the tube crosses the body's neck its normals are taken from the body's surface (nearest body vertex), fading out up the neck, so there is no lighting crease at the join
    from scipy.spatial import cKDTree
    m = (B[:, 1] > 1.50) & (B[:, 1] < 1.72) & (np.abs(B[:, 0]) < .12); Bn = body['nrm'][m].astype(np.float64); kd = cKDTree(B[m]); _, ni = kd.query(P)
    g = np.clip((1.645 - P[:, 1]) / .035, 0, 1); g = (g * g * (3 - 2 * g))[:, None]; N2 = N * (1 - g) + Bn[ni] * g; N2 /= np.maximum(np.linalg.norm(N2, axis=1, keepdims=True), 1e-9)
    q['nrm'] = N2.astype(q['nrm'].dtype); return q

def warp_all(parts, w2):
    out = []
    for p in parts:
        q = dict(p); P0 = q['pos']; P1 = C.shoulder_warp(P0).astype(P0.dtype)
        if np.abs(P1 - P0).max() > 5e-4: q['pos'] = P1; q['nrm'] = C.wnorm(P1, q['ix'].reshape(-1, 3)).astype(q['nrm'].dtype)
        out.append(q)
    return out, C.shoulder_warp(w2)

def build(key, src, common, wpl, out_root):
    s = src[key]; T = {}; tone = {}
    for k in BASES:                                   # skin tone of each source's body
        sb = [p for p in src[k]['head'] if p['mat'] == 'Skin_Body'][0]; tone[k] = mean_skin(src[k]['tx'][sb['srctex']])
    bt = tone[key]; wp = s['wp']; d_tgt = wpl[17] + np.array([0, C.NECK, 0])
    parts = []
    # --- body in this base's skin colour
    T[900] = Image.new('RGBA', (8, 8), tuple(int(v) for v in bt) + (255,)); body = dict(common['body']); body['srctex'] = 902; parts.append(body)
    bd = shrink_dressed(common['body_d'], wpl); bd = C.sub(bd, ~(bd['pos'][bd['ix'].reshape(-1, 3)][:, :, 1].max(1) < .98)); bd['srctex'] = 902; bd['mat'] = 'Skin_BodyD'; parts.append(bd)      # every outfit covers the legs completely, so this skin (pressed in under the clothes, used whenever an outfit is worn; the bare body is used with the boxers) starts at the hips and nothing can show through trousers or boots. Same skin, pressed in under the clothes: used whenever an outfit is worn (the bare body is used with the boxers)
    # lower legs for the outfits that leave them uncovered (cropped trousers, shorts): the bare legs, drawn in under cloth (like the dressed skin) and blending to the true bare leg from the knee down, so shoes and bare shins match the body exactly
    bare = common['body']; shr = shrink_dressed(bare, wpl); smc = lambda t: (lambda c: c * c * (3 - 2 * c))(np.clip(t, 0, 1)); Pb = bare['pos']; wblend = smc((Pb[:, 1] - .30) / .30)[:, None]
    bl = dict(bare); bl['pos'] = Pb + (shr['pos'] - Pb) * wblend; bl['nrm'] = C.wnorm(bl['pos'], bl['ix'].reshape(-1, 3)).astype(bare['nrm'].dtype); bl = C.sub(bl, bl['pos'][bl['ix'].reshape(-1, 3)][:, :, 1].max(1) < .56); bl['srctex'] = 902; bl['mat'] = 'Skin_BodyL'; parts.append(bl)
    # --- head piece (native)
    for p in with_tex(s['head'], s['tx'], OFF[key], T):
        q = dict(p); q['pos'] = q['pos'] + (d_tgt - wp[17]); q = neck_bridge(snapneck(q, body), body) if (q['mat'] == 'Skin_Body' and len(q['pos']) < 2000) else q
        if q['mat'] == 'Skin_Body' and len(q['pos']) < 2000: q = dict(q); q['mat'] = 'Skin_Neck'
        parts.append(q)
    # --- six faces: Face k = native face of BASES[k]
    for k, fk in enumerate(BASES):
        fs = src[fk]; own = [p for p in fs['prims'] if p['mat'] in FACE_PART] if fk in NEWM else [p for p in fs['prims'] if p['mat'].startswith('Face%d_' % k)]
        for p in own:
            q = dict(p); mat = ('Face%d_%s' % (k, FACE_PART[p['mat']])) if fk in NEWM else p['mat']; q['mat'] = mat; tx = fs['tx']
            q['pos'] = q['pos'] + (d_tgt - fs['wp'][17])
            if p.get('srctex') is not None:
                im = tx[p['srctex']]
                if mat.endswith('_Skin') and fk != key: im = tone_match(im, tone[fk], bt)
                elif mat.endswith('_Skin') and fk == key and fk in NEWM: im = im
                T[OFF[fk] + 500 + p['srctex'] + (0 if fk == key else 0) + (7000 if (fk != key and mat.endswith('_Skin')) else 0) + (100 * ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen'].index(key) if (fk != key and mat.endswith('_Skin')) else 0)] = im
                q['srctex'] = OFF[fk] + 500 + p['srctex'] + (7000 if (fk != key and mat.endswith('_Skin')) else 0) + (100 * ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen'].index(key) if (fk != key and mat.endswith('_Skin')) else 0)
            parts.append(q)
    # --- hair library (boy pack carries B0 C0 D0 K0 L0 Y0 + backs; plus the two new models)
    hp = [p for p in src['boy']['prims'] if p['mat'].startswith('Hair_')]
    for p in with_tex(hp, src['boy']['tx'], 20000, T): q = dict(p); q['pos'] = q['pos'] + (d_tgt - src['boy']['wp'][17]); parts.append(strip_collar(q, d_tgt, T))
    for nk in NEWM:
        hn = [p for p in src[nk]['prims'] if p['mat'].startswith('Hair_')]
        for p in with_tex(hn, src[nk]['tx'], OFF[nk] + 8000, T): q = dict(p); q['pos'] = q['pos'] + (d_tgt - src[nk]['wp'][17]); parts.append(strip_collar(q, d_tgt, T))
    # --- shared garments
    for p in common['garments']:
        q = dict(p); parts.append(q)
    T.update(common['T'])
    hair_norm(parts, T)
    wpo = wp.copy(); w2 = wpl.copy(); w2[18] = wp[18] + (d_tgt - wp[17]); w2[19] = wp[19] + (d_tgt - wp[17]); w2[17] = wpl[17]
    parts, w2 = warp_all(parts, w2)
    assemble(key, [(p, T) for p in parts], w2, os.path.join(out_root, key))

def hip_trim(p):
    """A boy's hips are as wide as his waist: the donor trousers flare to a 38 cm hip band (a female silhouette). Bring the hip band in to the body's own width (+1.8 cm cloth), smoothly, and take a little off the belt/vest hem so the belt line stays continuous."""
    P = p['pos'].copy(); y = P[:, 1]
    if p['mat'] in ('Outfit_Peasant_Legs', 'Outfit_Ranger_Legs'):
        cap = np.interp(y, [.84, .90, .96, 1.04, 1.10, 1.16], [9, .160, .156, .155, .150, .150])
        hw = np.zeros(len(P))
        for i, yy in enumerate(np.unique(np.round(y, 2))):
            pass
        ys = np.arange(.80, 1.20, .01); H = np.array([np.abs(P[(y >= v - .035) & (y < v + .035), 0]).max() if ((y >= v - .035) & (y < v + .035)).any() else 0 for v in ys]); hw = np.interp(y, ys, H)
        sc = np.clip(cap / np.maximum(hw, 1e-6), .80, 1.0); sc = np.where(y < .84, 1.0, sc)
        P[:, 0] *= sc
    elif p['mat'] == 'Outfit_Peasant_Body':
        t = np.clip((1.14 - y) / .07, 0, 1); P[:, 0] *= 1 - .075 * t * t * (3 - 2 * t)
    p['pos'] = P; return p


def under_sleeves(b, k=.13, x0=.20, x1=.60):
    """the skin worn under sleeves: the arm is drawn in radially by `k` (about 5 mm) between shoulder and wrist so the muscle relief never pokes through the cloth as specks; hands and the bare body are untouched"""
    P = b['pos'].copy(); ax = np.abs(P[:, 0]); m = (ax > x0 - .02) & (ax < x1 + .04) & (P[:, 1] > 1.30) & (P[:, 1] < 1.70)
    if not m.any(): return b
    for sg in (1, -1):
        sel = m & (P[:, 0] * sg > 0)
        if not sel.any(): continue
        xs = np.arange(x0 - .02, x1 + .04, .02); cy = np.full(len(xs), np.nan); cz = cy.copy()
        for i, x in enumerate(xs):
            q = P[sel & (np.abs(ax - x) < .015)]
            if len(q) > 5: cy[i] = (q[:, 1].max() + q[:, 1].min()) / 2; cz[i] = (q[:, 2].max() + q[:, 2].min()) / 2
        ok = ~np.isnan(cy)
        if ok.sum() < 3: continue
        yc = np.interp(ax[sel], xs[ok], cy[ok]); zc = np.interp(ax[sel], xs[ok], cz[ok])
        f = np.clip((ax[sel] - (x0 - .02)) / .06, 0, 1) * np.clip((x1 + .04 - ax[sel]) / .06, 0, 1); f = f * f * (3 - 2 * f) * k
        P[sel, 1] = yc + (P[sel, 1] - yc) * (1 - f); P[sel, 2] = zc + (P[sel, 2] - zc) * (1 - f)
    q = dict(b); q['pos'] = P; return q

def common_parts():
    pr, wpo, tx0 = BB.read_pack(os.path.join(OLD, 'boy'), 'boy')
    lv, wpl, ltx, fu, wpf, ftx = C.donors(); T = {}
    sk = mean_skin(tx0[0]); T[900] = Image.new('RGBA', (8, 8), tuple(int(v) for v in sk) + (255,))
    body = C.relax_hands(C.new_body(sk)); body_c = C.slim_arms(C.shoulder_slope(body)); body = C.subdivide(body, lambda c: (c[:, 1] > 1.38) & (np.abs(c[:, 0]) < .30)); body = C.subdivide(body, lambda c: (c[:, 1] > 1.46) & (np.abs(c[:, 0]) < .27)); body = C.slim_arms(C.shoulder_slope(body)); body_c = C.subdivide(body_c, lambda c: (c[:, 1] > 1.46) & (np.abs(c[:, 0]) < .20)); body_c = C.slim_arms(C.shoulder_slope(body_c)); sc = C.scout(T, body); ca = C.casual(T, body); ar = C.armour(pr, T, body, wpo, wpl)
    bdf = shrink_dressed(body, wpl); sc = [C.swap_sleeves(p, body, scale=.90, off=.007, x0=.20, xs=.14, ylow=1.40) if p['mat'] == 'Outfit_Scout_Body' else p for p in sc]; ar = fit_sleeves(ar, bdf)
    for p in ar:
        if p.get('srctex') is not None: T[30000 + p['srctex']] = tx0[p['srctex']]; p['srctex'] = 30000 + p['srctex']
    ar = ranger_lining(ar, body, T); ar = ranger_sleeves(ar, body, T)
    import outfits_new as NO; nw = NO.new_outfits(T, body, wpl) if os.environ.get('NEWOUT', '1') == '1' else []
    # armour textures live in the boy pack's texture table: pull them in under unique ids
    gar = [p for p in sc + ca + ar + nw if p['mat'] in ('Outfit_Scout_Body', 'Outfit_Scout_Boots', 'Outfit_Peasant_Body', 'Outfit_Peasant_Legs', 'Outfit_Peasant_Feet', 'Outfit_Ranger_Body', 'Outfit_Ranger_Legs', 'Outfit_Ranger_FeetBoots') or p['mat'] in C.TIGHT]
    gar += [p for p in nw if p not in gar]
    for p in gar: hip_trim(p)
    body_pre = C.trapezius(C.relief(body, amp=float(os.environ.get('RELIEF', '2.2')))); body = C.shoulder_anatomy(C.limbs(body_pre));       # the sculpted anatomy is for the bare body; the pressed-in skin under clothes keeps the smooth shape so ridges never poke through cloth
    body_d = C.tuck_body(C.trapezius(C.relief(body_c, amp=float(os.environ.get('RELIEF', '2.2')))), gar, depth=.045, inside=float(os.environ.get("INSIDE","0.02")), passes=2, fade=False); C.reweight(sc + ca + ar + nw, body); body_d = keep_neck(body_d, C.trapezius(C.relief(body_c, amp=float(os.environ.get('RELIEF', '2.2'))))); bx = C.boxers(body, T)
    body = cutneck(smooth_neck(body)); body_d = under_sleeves(cutneck(smooth_neck(body_d)))
    T[902] = C.skin_atlas(sk); body = C.skin_uv(body); body_d = C.skin_uv(body_d)
    return dict(body=body, body_d=body_d, garments=[bx] + sc + ca + ar + nw, T=T), wpl

if __name__ == '__main__':
    out = sys.argv[1]; keys = sys.argv[2:] or BASES
    src = load_sources(); common, wpl = common_parts()
    for k in keys: build(k, src, common, wpl, out)

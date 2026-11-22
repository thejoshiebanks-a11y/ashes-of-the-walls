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
    w = sm((y - 1.560) / .02) * (1 - sm((y - 1.610) / .02)); w = w[:, None]
    Q = Pw.copy()
    for _ in range(40):
        Q = Q + .55 * w * (D @ Q - Q); Q = Q + (-.58) * w * (D @ Q - Q)
    P2 = Q[wid]; b = dict(b); b['pos'] = P2.astype(b['pos'].dtype); b['nrm'] = C.wnorm(P2, b['ix'].reshape(-1, 3)).astype(b['nrm'].dtype); return b

def snapneck(q, body):
    """the head piece's neck tube must never stand proud of the body's neck: below y 1.615 its half-width is held 3 mm inside the body's own neck (fading out above), so the tube's lower rim is
    hidden inside the body and the two surfaces simply cross -- no wings, no collar ledge"""
    Fq = q['ix'].reshape(-1, 3); q = C.sub(q, ~(q['pos'][Fq][:, :, 1].min(1) < 1.594))                 # the tube's flared lower skirt goes; its rim now starts inside the body
    B = body['pos']; P = q['pos'].copy(); ys = np.arange(1.50, 1.70, .004); hw = []
    for y in ys:
        s = B[(np.abs(B[:, 1] - y) < .006) & (np.abs(B[:, 0]) < .1)]; hw.append(np.abs(s[:, 0]).max() if len(s) > 3 else np.nan)
    hw = np.array(hw); ok = ~np.isnan(hw); hwy = np.interp(P[:, 1], ys[ok], hw[ok]); f = np.clip((1.618 - P[:, 1]) / .008, 0, 1); f = f * f * (3 - 2 * f)
    lim = np.minimum(np.abs(P[:, 0]), np.maximum(hwy - .006, .02)); P[:, 0] = np.sign(P[:, 0]) * (np.abs(P[:, 0]) * (1 - f) + lim * f)
    zlo = []; zhi = []
    for y in ys:                                                                                      # depth: the tube's back/front rim must also sit inside the body's neck, or a wedge of sky shows behind the nape
        s_ = B[(np.abs(B[:, 1] - y) < .006) & (np.abs(B[:, 0]) < .06)]; zlo.append(s_[:, 2].min() if len(s_) > 3 else np.nan); zhi.append(s_[:, 2].max() if len(s_) > 3 else np.nan)
    zlo = np.array(zlo); zhi = np.array(zhi); ok2 = ~np.isnan(zlo); zl = np.interp(P[:, 1], ys[ok2], zlo[ok2]) + .006; zh = np.interp(P[:, 1], ys[ok2], zhi[ok2]) - .006
    P[:, 2] = P[:, 2] * (1 - f) + np.clip(P[:, 2], zl, np.maximum(zh, zl + .02)) * f
    q = dict(q); q['pos'] = P; q['nrm'] = C.wnorm(P, q['ix'].reshape(-1, 3)).astype(q['nrm'].dtype); return q

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
    # --- head piece (native)
    for p in with_tex(s['head'], s['tx'], OFF[key], T):
        q = dict(p); q['pos'] = q['pos'] + (d_tgt - wp[17]); q = snapneck(q, body) if (q['mat'] == 'Skin_Body' and len(q['pos']) < 2000) else q
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


def common_parts():
    pr, wpo, tx0 = BB.read_pack(os.path.join(OLD, 'boy'), 'boy')
    lv, wpl, ltx, fu, wpf, ftx = C.donors(); T = {}
    sk = mean_skin(tx0[0]); T[900] = Image.new('RGBA', (8, 8), tuple(int(v) for v in sk) + (255,))
    body = C.relax_hands(C.new_body(sk)); body_c = C.slim_arms(C.shoulder_slope(body)); body = C.subdivide(body, lambda c: (c[:, 1] > 1.38) & (np.abs(c[:, 0]) < .30)); body = C.subdivide(body, lambda c: (c[:, 1] > 1.46) & (np.abs(c[:, 0]) < .27)); body = C.slim_arms(C.shoulder_slope(body)); body_c = C.subdivide(body_c, lambda c: (c[:, 1] > 1.46) & (np.abs(c[:, 0]) < .20)); body_c = C.slim_arms(C.shoulder_slope(body_c)); sc = C.scout(T, body); ca = C.casual(T, body); ar = C.armour(pr, T, body, wpo, wpl)
    bdf = shrink_dressed(body, wpl); sc = [C.swap_sleeves(p, body, scale=.90, off=.007, x0=.20, xs=.14, ylow=1.40) if p['mat'] == 'Outfit_Scout_Body' else p for p in sc]; ar = fit_sleeves(ar, bdf)
    for p in ar:
        if p.get('srctex') is not None: T[30000 + p['srctex']] = tx0[p['srctex']]; p['srctex'] = 30000 + p['srctex']
    ar = ranger_lining(ar, body, T); ar = ranger_sleeves(ar, body, T)
    # armour textures live in the boy pack's texture table: pull them in under unique ids
    gar = [p for p in sc + ca + ar if p['mat'] in ('Outfit_Scout_Body', 'Outfit_Scout_Boots', 'Outfit_Peasant_Body', 'Outfit_Peasant_Legs', 'Outfit_Peasant_Feet', 'Outfit_Ranger_Body', 'Outfit_Ranger_Legs', 'Outfit_Ranger_FeetBoots')]
    for p in gar: hip_trim(p)
    body_pre = C.trapezius(C.relief(body, amp=float(os.environ.get('RELIEF', '2.2')))); body = C.shoulder_anatomy(C.limbs(body_pre));       # the sculpted anatomy is for the bare body; the pressed-in skin under clothes keeps the smooth shape so ridges never poke through cloth
    body_d = C.tuck_body(C.trapezius(C.relief(body_c, amp=float(os.environ.get('RELIEF', '2.2')))), gar, depth=.045, inside=float(os.environ.get("INSIDE","0.02")), passes=2, fade=False); C.reweight(sc + ca + ar, body); body_d = keep_neck(body_d, C.trapezius(C.relief(body_c, amp=float(os.environ.get('RELIEF', '2.2'))))); bx = C.boxers(body, T)
    body = smooth_neck(body); body_d = smooth_neck(body_d)
    T[902] = C.skin_atlas(sk); body = C.skin_uv(body); body_d = C.skin_uv(body_d)
    return dict(body=body, body_d=body_d, garments=[bx] + sc + ca + ar, T=T), wpl

if __name__ == '__main__':
    out = sys.argv[1]; keys = sys.argv[2:] or BASES
    src = load_sources(); common, wpl = common_parts()
    for k in keys: build(k, src, common, wpl, out)

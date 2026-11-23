"""Extra male outfits taken from the uploaded 'dragon guider' and 'ninja' models: tops, trousers and shoes are lifted off the donor, conformed to our shared slim body (joint-matched, re-centred, sleeves regrown from our own arm, hips trimmed, pressed out of the skin) and skinned from the body beneath them, exactly like the other outfits.
Material names are Outfit_<Id>_<Part>, which is all the creator needs (parts Tops/Bottoms/Shoes are the top/pants/boots dye slots)."""
import os, numpy as np
from PIL import Image
import build_bases as BB, compose as C

A = os.environ.get('NEWOUT_DIR', '/mnt/user-data/attachments/1cc8b787-6a44-5c68-b863-72a90e02eb6d')
DONORS = [
    # id, file, texture offset, {prim vertex count: part name}, sleeve end x (T-pose arm), sleeve thickness scale, cuff/wrap band (x lo, x hi, arm end x)
    ('Dragon', '4e1db34a-anime_boy_dragon_guider.glb', 60000, {386: 'Collar', 1614: 'Tops', 788: 'Bottoms', 468: 'Shoes'}, .77, 1.0, (.655, .735, .775)),
    ('Ninja', 'aefe6b70-anime_boy_ninja_character_-_fully_rigged.glb', 61000, {374: 'Collar', 1323: 'Tops', 45: 'Sash', 756: 'Bottoms', 248: 'Shoes'}, .66, 1.0, (.62, .745, .785)),
]

def trim_hips(p, cap_pts):
    """donor trousers flare to a female hip band; bring each height's half-width in to the body's own width plus cloth"""
    P = p['pos'].copy(); y = P[:, 1]; ys = np.arange(.80, 1.20, .01)
    H = np.array([np.abs(P[(y >= v - .035) & (y < v + .035), 0]).max() if ((y >= v - .035) & (y < v + .035)).any() else 0 for v in ys]); hw = np.interp(y, ys, H)
    cap = np.interp(y, [c[0] for c in cap_pts], [c[1] for c in cap_pts]); sc = np.clip(cap / np.maximum(hw, 1e-6), .78, 1.0); sc = np.where(y < .84, 1.0, sc); P[:, 0] *= sc; p['pos'] = P; return p

def slim_legs(p, body, margin=.014, keep=.28):
    """baggy trouser legs are drawn in around the body's own legs: radius = body radius + margin, keeping `keep` of the donor's extra drape; fades out into the hip"""
    P = p['pos'].copy(); B = body['pos']
    for sg in (1, -1):
        ys = np.arange(.04, 1.02, .03); cx = []; cz = []; rb = []
        for y in ys:
            b = B[(np.abs(B[:, 1] - y) < .03) & (B[:, 0] * sg > .015) & (np.abs(B[:, 0]) < .30)]
            if len(b) < 5: cx.append(np.nan); cz.append(np.nan); rb.append(np.nan); continue
            c = [(b[:, 0].max() + b[:, 0].min()) / 2, (b[:, 2].max() + b[:, 2].min()) / 2]; cx.append(c[0]); cz.append(c[1]); rb.append(max((b[:, 0].max() - b[:, 0].min()), (b[:, 2].max() - b[:, 2].min())) / 2)
        cx, cz, rb = map(np.array, (cx, cz, rb)); ok = ~np.isnan(cx); ys2 = ys[ok]
        m = (P[:, 0] * sg > .012) & (P[:, 1] < 1.04) & (P[:, 1] > .02)
        if not m.any(): continue
        y = P[m, 1]; ccx = np.interp(y, ys2, cx[ok]); ccz = np.interp(y, ys2, cz[ok]); rbb = np.interp(y, ys2, rb[ok])
        dx = P[m, 0] - ccx; dz = P[m, 2] - ccz; r = np.hypot(dx, dz) + 1e-9; tgt = rbb + margin; rn = np.where(r > tgt, tgt + (r - tgt) * keep, r)
        w = np.clip((1.04 - y) / .10, 0, 1); w = w * w * (3 - 2 * w); rn = r + (rn - r) * w
        P[m, 0] = ccx + dx * rn / r; P[m, 2] = ccz + dz * rn / r
    q = dict(p); q['pos'] = P; q['nrm'] = BB.smooth_normals(P, p['ix'].reshape(-1, 3)).astype(p['nrm'].dtype); return q

def slim_torso(p, body, margin=.024):
    """jackets flare below the waist: each height's half-width is held to the body's own plus cloth"""
    P = p['pos'].copy(); B = body['pos']; y = P[:, 1]; ys = np.arange(.86, 1.34, .02)
    hb = np.array([np.abs(B[(np.abs(B[:, 1] - v) < .03) & (np.abs(B[:, 0]) < .30)][:, 0]).max() for v in ys])
    hg = np.array([np.abs(P[(np.abs(y - v) < .03) & (np.abs(P[:, 0]) < .40)][:, 0]).max() if ((np.abs(y - v) < .03) & (np.abs(P[:, 0]) < .40)).any() else 0 for v in ys])
    k = np.interp(y, ys, np.minimum(1, (hb + margin) / np.maximum(hg, 1e-6))); k = np.where(y < .86, k[y < .86].min() if (y < .86).any() else 1, k); k = np.where(y > 1.34, 1, k)
    zb = np.array([(B[(np.abs(B[:, 1] - v) < .03) & (np.abs(B[:, 0]) < .30)][:, 2].max() - B[(np.abs(B[:, 1] - v) < .03) & (np.abs(B[:, 0]) < .30)][:, 2].min()) / 2 for v in ys]); P[:, 0] *= k
    q = dict(p); q['pos'] = P; q['nrm'] = BB.smooth_normals(P, p['ix'].reshape(-1, 3)).astype(p['nrm'].dtype); return q

def keep_x(p, lo, hi):
    F = p['ix'].reshape(-1, 3); c = np.abs(p['pos'][F].mean(1)[:, 0]); return C.sub(p, (c >= lo) & (c <= hi))

def lining(p, body, T, tag):
    """the donor jackets have cut-outs (shoulders, back, side, chest) that would show bare skin; a thin layer grown from the torso in the jacket's own base colour sits under them"""
    im = np.asarray(T[p['srctex']].convert('RGB')).astype(float); h, w = im.shape[:2]; uv = p['uv']
    px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]; med = np.median(px, axis=0)
    uvs = uv[np.argmin(np.abs(px - med).sum(1))]
    BF = body['ix'].reshape(-1, 3); bc = body['pos'][BF].mean(1); m = (bc[:, 1] > 1.02) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .20) | ((bc[:, 1] > 1.36) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .30))
    L = C.sub(body, m, 'Outfit_%s_Lining' % tag); L['pos'] = L['pos'] + L['nrm'] * .005; L['uv'] = np.tile(uvs, (len(L['pos']), 1)).astype(L['uv'].dtype); L['srctex'] = p['srctex']; L['tex'] = p.get('tex')
    return L

def opaque(im):
    """donor garment textures carry transparent gaps (unused atlas area that some faces touch): every transparent pixel takes the colour of the nearest cloth pixel, so cloth is never see-through"""
    from scipy.ndimage import distance_transform_edt
    a = np.array(im.convert('RGBA')); m = a[..., 3] < 128
    if m.any() and not m.all():
        _, (iy, ix) = distance_transform_edt(m, return_indices=True); a[m, :3] = a[iy[m], ix[m], :3]
    a[..., 3] = 255; return Image.fromarray(a, 'RGBA')
def _bnd(p, tag):
    if not os.environ.get('DBG') or not p['mat'].endswith('_Bottoms'): return
    P = p['pos']; F = p['ix'].reshape(-1, 3); key = np.round(P * 1e4).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); Fv = inv[F]
    e = np.sort(np.r_[Fv[:, [0, 1]], Fv[:, [1, 2]], Fv[:, [2, 0]]], axis=1); u, c = np.unique(e, axis=0, return_counts=True); print('DBG', p['mat'], tag, len(F), 'bnd', (c == 1).sum())
def new_outfits(T, body, wpl):
    out = []
    for oid, fn, off, parts, sxe, ssc, band in DONORS:
        raw, wp, texs = BB.convert(os.path.join(A, fn), BB.VRM, 'vrm', 512); pr = []
        for p in raw:
            nm = parts.get(len(p['pos']))
            if p['key'] in ('Tops', 'Bottoms', 'Shoes', 'Collar') and nm:
                d = dict(p); d['mat'] = 'Outfit_%s_%s' % (oid, nm); d['srctex'] = off + p['tex']; T[off + p['tex']] = (opaque(texs[p['tex']]) if nm in ('Tops', 'Bottoms') else texs[p['tex']]); pr.append(d)
        [_bnd(p, 'raw') for p in pr]; pr = C.shift_by_joints(pr, wp, wpl); C.align_z(pr, body); C.align_legs_x(pr, body); [_bnd(p, 'aligned') for p in pr]
        res = []
        for p in pr:
            if p['mat'].endswith('_Bottoms'):
                p = p if os.environ.get('NOTRIM') else trim_hips(p, [(.84, 9), (.90, .160), (.96, .156), (1.04, .155), (1.10, .150), (1.16, .150)]); p = p if os.environ.get('NOSLIM') else slim_legs(p, body, margin=.011, keep=.15)
            elif p['mat'].endswith('_Collar'):
                p = keep_x(C.swap_sleeves(p, body, scale=ssc, off=.013, x0=.20, xs=.14, ylow=1.0, xend=band[2]), band[0], band[1])      # the donor's flared cuff / arm wrap, re-made as a snug band on our own arm
            elif p['mat'].endswith('_Tops'):
                p = C.swap_sleeves(p, body, scale=ssc, off=.009, x0=.20, xs=.14, ylow=1.0, xend=sxe); p = slim_torso(p, body); res.append(lining(p, body, T, oid))
            _bnd(p, 'final'); res.append(p)
        out += res
    C.TIGHT = tuple(C.TIGHT) + tuple(p['mat'] for p in out)
    return out

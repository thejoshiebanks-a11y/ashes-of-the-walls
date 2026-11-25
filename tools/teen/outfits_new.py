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
    px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]
    lum = px.sum(1); lo, hi = np.percentile(lum, [55, 90]); sel = (lum >= lo) & (lum <= hi); red = (px[:, 0] > px[:, 1] + 50) & (px[:, 0] > px[:, 2] + 50) & (lum > 120)
    if red.sum() > 200: sel = red       # red garments (Dragon) are lined in their own red, not the grey of the trim
    med = np.median(px[sel], axis=0)      # the body colour of the garment (not its black trim and not its highlights)
    uvs = uv[sel][np.argmin(np.abs(px[sel] - med).sum(1))]
    BF = body['ix'].reshape(-1, 3); bc = body['pos'][BF].mean(1); m = (bc[:, 1] > 1.02) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .24) | ((bc[:, 1] > 1.24) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .32))
    L = C.sub(body, m, 'Outfit_%s_Lining' % tag); L['pos'] = L['pos'] + L['nrm'] * .006; L['uv'] = np.tile(uvs, (len(L['pos']), 1)).astype(L['uv'].dtype); L['srctex'] = p['srctex']; L['tex'] = p.get('tex')
    L = smooth_edges(L, 'y', lambda Q: (Q[:, 1] > 1.50) & (Q[:, 1] < 1.62), win=7, reach=.02, arc='x')      # the upper edge of the lining is cut as a clean line under the collar/neckline
    return L


def smooth_edges(p, axis, sel, win=9, reach=.05, arc=None):
    """ragged (frayed) cut edges of the donor cloth are re-cut clean: every boundary loop is walked around its circumference, the coordinate along `axis` is median+mean filtered, and the cloth just inside the edge follows smoothly, so hems and cuffs are crisp and even. sel(P)->bool picks which boundary vertices belong to an edge to clean"""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    from scipy.spatial import cKDTree
    P = p['pos'].copy(); F = p['ix'].reshape(-1, 3); key = np.round(P * 1e4).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); Fv = inv[F]
    e = np.sort(np.r_[Fv[:, [0, 1]], Fv[:, [1, 2]], Fv[:, [2, 0]]], axis=1); u, c = np.unique(e, axis=0, return_counts=True); b = u[c == 1]
    if not len(b): return p
    n = inv.max() + 1; pos = np.zeros((n, 3)); pos[inv] = P; bv = np.unique(b); ok = np.zeros(n, bool); ok[bv] = sel(pos[bv])
    b = b[ok[b[:, 0]] & ok[b[:, 1]]]
    if not len(b): return p
    g = coo_matrix((np.ones(len(b)), (b[:, 0], b[:, 1])), shape=(n, n)); _, lab = connected_components(g, directed=False)
    ax = {'x': 0, 'y': 1, 'z': 2}[axis]; oth = [i for i in range(3) if i != ax]; delta_w = np.zeros(n); used = []
    for l in set(lab[np.unique(b)]):
        vs = np.unique(b[lab[b[:, 0]] == l]); 
        if len(vs) < 8: continue
        q = pos[vs]; ctr = q[:, oth].mean(0); ang = np.arctan2(q[:, oth[1]] - ctr[1], q[:, oth[0]] - ctr[0]) if arc is None else q[:, {'x': 0, 'y': 1, 'z': 2}[arc]]; o = np.argsort(ang); vs = vs[o]; y = pos[vs, ax]; m = len(vs); w = min(win, m // 2 * 2 - 1) if m > 3 else 1
        yy = np.r_[y, y, y] if arc is None else np.r_[np.full(m, y[0]), y, np.full(m, y[-1])]; med = np.array([np.median(yy[m + i - w // 2: m + i + w // 2 + 1]) for i in range(m)])
        mm_ = np.r_[med, med, med] if arc is None else np.r_[np.full(m, med[0]), med, np.full(m, med[-1])]; sm = np.array([np.mean(mm_[m + i - w // 2: m + i + w // 2 + 1]) for i in range(m)])
        delta_w[vs] = sm - y; used.append(vs)
    if not used: return p
    bi = np.concatenate(used); tree = cKDTree(pos[bi][:, :]); d, j = tree.query(P, k=1); dl = delta_w[bi][j]; wgt = np.clip(1 - d / reach, 0, 1); wgt = wgt * wgt * (3 - 2 * wgt)
    isb = np.zeros(len(P), bool); isb[np.isin(inv, bi)] = True; wgt = np.where(isb, 1.0, wgt)
    P[:, ax] += dl * wgt; q = dict(p); q['pos'] = P; q['nrm'] = BB.smooth_normals(P, p['ix'].reshape(-1, 3)).astype(p['nrm'].dtype); return q

def repaint_panels(p, T, xmax=.17, ylo=1.30, yhi=1.66):
    """the donor's black chest bib and back flap are loose, irregular layers; they are repainted with the garment's own red brocade so the vest reads as one clean garment (black sleeves, collar ring and frog buttons stay)"""
    from scipy.ndimage import binary_erosion, binary_dilation
    im = T[p['srctex']].convert('RGBA'); a = np.asarray(im).astype(float); h, w = a.shape[:2]; uv = p['uv']; P = p['pos']
    cx = np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1); cy = np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1); px = a[cy, cx, :3]
    black = px.sum(1) < 200; red = (px[:, 0] > px[:, 1] + 40) & (px[:, 0] > px[:, 2] + 40)
    sel = black & (np.abs(P[:, 0]) < xmax) & (P[:, 1] > ylo) & (P[:, 1] < yhi)
    if not sel.any() or not red.any(): return p
    cover = np.zeros((h, w), bool); cover[cy[red], cx[red]] = True; cover = binary_dilation(cover, iterations=8) & (a[..., 3] > 250); solid = binary_erosion(a[..., 3] > 250, iterations=2); S_ = 24; best = None; mean = np.median(px[red], axis=0)
    for y0 in range(0, h - S_, 6):
        for x0 in range(0, w - S_, 6):
            if solid[y0:y0 + S_, x0:x0 + S_].all() and cover[y0:y0 + S_, x0:x0 + S_].mean() > .9:
                blk = a[y0:y0 + S_, x0:x0 + S_, :3].reshape(-1, 3); d = np.abs(blk.mean(0) - mean).sum() + .3 * blk.std(0).sum()
                if best is None or d < best[0]: best = (d, x0, y0)
    if best is None: return p
    _, x0, y0 = best; q = dict(p); nuv = uv.copy().astype(float)
    nuv[sel, 0] = x0 / w + (S_ / w) * 0.9 * ((P[sel, 0] * 9) % 1) + .05 * S_ / w; nuv[sel, 1] = y0 / h + (S_ / h) * 0.9 * ((P[sel, 1] * 9 + P[sel, 2] * 4) % 1) + .05 * S_ / h
    q['uv'] = nuv.astype(uv.dtype); return q

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
        res = []; tops_ref = None; pr = sorted(pr, key=lambda q: 0 if q['mat'].endswith('_Tops') else 1)
        for p in pr:
            if p['mat'].endswith('_Bottoms'):
                p = p if os.environ.get('NOTRIM') else trim_hips(p, [(.84, 9), (.90, .160), (.96, .156), (1.04, .155), (1.10, .150), (1.16, .150)]); p = p if os.environ.get('NOSLIM') else slim_legs(p, body, margin=.011, keep=.15)
            elif p['mat'].endswith('_Collar'):
                if oid == 'Dragon' and tops_ref is not None:
                    Fc = p['ix'].reshape(-1, 3); cc = p['pos'][Fc].mean(1); mb = (cc[:, 1] < 1.585) & (np.abs(cc[:, 0]) < .17)
                    if mb.any():
                        bib = C.sub(p, mb, 'Outfit_Dragon_Bib'); bib['uv'] = np.tile(tops_ref['uv0'], (len(bib['pos']), 1)).astype(bib['uv'].dtype); bib['srctex'] = tops_ref['srctex']; bib['tex'] = tops_ref['tex']; res.append(bib); p = C.sub(p, ~mb, p['mat'])
                p = keep_x(C.swap_sleeves(p, body, scale=ssc, off=.013, x0=.20, xs=.14, ylow=1.0, xend=band[2]), band[0], band[1])      # the donor's flared cuff / arm wrap, re-made as a snug band on our own arm
            elif p['mat'].endswith('_Tops'):
                p = C.swap_sleeves(p, body, scale=ssc, off=float(os.environ.get('SLOFF', '.012')), x0=.20, xs=.14, ylow=1.0, xend=sxe); p = slim_torso(p, body); L_ = lining(p, body, T, oid); res.append(L_); tops_ref = dict(uv0=L_['uv'][0], srctex=L_['srctex'], tex=L_['tex']); p = repaint_panels(p, T) if oid == 'Dragon' else p
            if p['mat'].endswith('_Bottoms'): p = smooth_edges(p, 'y', lambda Q: Q[:, 1] < .62, win=11, reach=.05)     # trouser hems
            elif p['mat'].endswith('_Tops'): p = smooth_edges(p, 'y', lambda Q: (Q[:, 1] < 1.12) & (Q[:, 1] > .80), win=13, reach=.05)      # jacket hem
            elif p['mat'].endswith('_Collar') and oid == 'Ninja': p = smooth_edges(p, 'x', lambda Q: np.ones(len(Q), bool), win=9, reach=.03)       # wrist wrap
            _bnd(p, 'final'); res.append(p)
        out += res
    C.TIGHT = tuple(C.TIGHT) + tuple(p['mat'] for p in out)
    return out

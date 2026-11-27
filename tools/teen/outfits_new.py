"""Extra male outfits taken from the uploaded 'dragon guider' and 'ninja' models: tops, trousers and shoes are lifted off the donor, conformed to our shared slim body (joint-matched, re-centred, sleeves regrown from our own arm, hips trimmed, pressed out of the skin) and skinned from the body beneath them, exactly like the other outfits.
Material names are Outfit_<Id>_<Part>, which is all the creator needs (parts Tops/Bottoms/Shoes are the top/pants/boots dye slots)."""
import os, numpy as np
from PIL import Image
import build_bases as BB, compose as C

A = os.environ.get('NEWOUT_DIR', '/mnt/user-data/attachments/1cc8b787-6a44-5c68-b863-72a90e02eb6d')
FAITH = os.environ.get('FAITH', '1') == '1'
DONORS = [
    # id, file, texture offset, {prim vertex count: part name}, sleeve end x (T-pose arm), sleeve thickness scale, cuff/wrap band (x lo, x hi, arm end x)
    ('Dragon', '4e1db34a-anime_boy_dragon_guider.glb', 60000, {386: 'Collar', 1614: 'Tops', 788: 'Bottoms', 468: 'Shoes'}, .77, 1.0, (.655, .735, .775)),
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
            b = B[(np.abs(B[:, 1] - y) < .03) & (B[:, 0] * sg > .015) & (np.abs(B[:, 0]) < .19)]
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
    hb = np.array([np.abs(B[(np.abs(B[:, 1] - v) < .03) & (np.abs(B[:, 0]) < .19)][:, 0]).max() for v in ys])
    hg = np.array([np.abs(P[(np.abs(y - v) < .03) & (np.abs(P[:, 0]) < .40)][:, 0]).max() if ((np.abs(y - v) < .03) & (np.abs(P[:, 0]) < .40)).any() else 0 for v in ys])
    k = np.interp(y, ys, np.minimum(1, (hb + margin) / np.maximum(hg, 1e-6))); k = np.where(y < .86, k[y < .86].min() if (y < .86).any() else 1, k); k = np.where(y > 1.34, 1, k)
    zb = np.array([(B[(np.abs(B[:, 1] - v) < .03) & (np.abs(B[:, 0]) < .19)][:, 2].max() - B[(np.abs(B[:, 1] - v) < .03) & (np.abs(B[:, 0]) < .19)][:, 2].min()) / 2 for v in ys]); P[:, 0] *= k
    q = dict(p); q['pos'] = P; q['nrm'] = BB.smooth_normals(P, p['ix'].reshape(-1, 3)).astype(p['nrm'].dtype); return q

def keep_x(p, lo, hi):
    F = p['ix'].reshape(-1, 3); c = np.abs(p['pos'][F].mean(1)[:, 0]); return C.sub(p, (c >= lo) & (c <= hi))

def _lmask(body, xa=.52):
    BF = body['ix'].reshape(-1, 3); bc = body['pos'][BF].mean(1).copy()
    ax = np.abs(bc[:, 0]); armz = (bc[:, 1] > 1.38) & (bc[:, 1] < 1.62) & (ax < xa); 
    m = (bc[:, 1] > 1.02) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .24) | (bc[:, 1] > 1.24) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .32)
    m = (m | ((armz) | ((bc[:, 1] >= 1.62) & (bc[:, 1] < 1.72) & (np.abs(bc[:, 0]) > .11) & (np.abs(bc[:, 0]) < .40))))
    return m


def relining(garments, body_d):
    """the lining is regrown from the FINAL dressed body (Skin_BodyD) so it always sits just outside it: no skin can show between lining and cloth"""
    for g in garments:
        if not g['mat'].endswith('_Lining'): continue
        xe = float(os.environ.get('XE', .95 if 'Dragon' in g['mat'] else .56)); xc = float(os.environ.get('XC', .67 if 'Dragon' in g['mat'] else .52))
        L = C.sub(body_d, _lmask(body_d, xc), g['mat']); L['pos'] = L['pos'] + L['nrm'] * .009
        am = (L['pos'][:, 1] > 1.36) & (np.abs(L['pos'][:, 0]) > xe); L['pos'][am, 0] = np.sign(L['pos'][am, 0]) * xe      # long arm triangles are cut off where the sleeve ends
        pass
        L['uv'] = np.tile(g['uv'][0], (len(L['pos']), 1)).astype(g['uv'].dtype)
        for k, v in g.items():
            if k not in L: L[k] = v
        L['srctex'] = g['srctex']; L['tex'] = g.get('tex', L.get('tex'))
        g.clear(); g.update(L)


def lining(p, body, T, tag):
    """the donor jackets have cut-outs (shoulders, back, side, chest) that would show bare skin; a thin layer grown from the torso in the jacket's own base colour sits under them"""
    im = np.asarray(T[p['srctex']].convert('RGB')).astype(float); h, w = im.shape[:2]; uv = p['uv']
    px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]
    lum = px.sum(1); lo, hi = np.percentile(lum, [55, 90]); sel = (lum >= lo) & (lum <= hi); red = (px[:, 0] > px[:, 1] + 50) & (px[:, 0] > px[:, 2] + 50) & (lum > 120)
    if red.sum() > 200: sel = red       # red garments (Dragon) are lined in their own red, not the grey of the trim
    med = np.median(px[sel], axis=0)      # the body colour of the garment (not its black trim and not its highlights)
    uvs = uv[sel][np.argmin(np.abs(px[sel] - med).sum(1))]
    BF = body['ix'].reshape(-1, 3); bc = body['pos'][BF].mean(1); m = (bc[:, 1] > 1.02) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .24) | ((bc[:, 1] > 1.24) & (bc[:, 1] < 1.56) & (np.abs(bc[:, 0]) < .32))
    if FAITH: m = (m | (((bc[:, 1] > 1.38) & (bc[:, 1] < 1.62) & (np.abs(bc[:, 0]) < .52)) | ((bc[:, 1] >= 1.62) & (bc[:, 1] < 1.72) & (np.abs(bc[:, 0]) > .11) & (np.abs(bc[:, 0]) < .40)))) & ~((bc[:, 2] > 0) & (np.abs(bc[:, 0]) < .19) & (bc[:, 1] > 1.0) & (bc[:, 1] < 1.47))      # the jacket's own front (frog buttons, placket) stays uncovered
    L = C.sub(body, m, 'Outfit_%s_Lining' % tag); L['pos'] = L['pos'] + L['nrm'] * (.006 + (.010 * np.clip((np.abs(L['pos'][:, 0]) - .15) / .10, 0, 1) * np.clip((L['pos'][:, 1] - 1.28) / .06, 0, 1) if FAITH else 0))[:, None]; L['uv'] = np.tile(uvs, (len(L['pos']), 1)).astype(L['uv'].dtype); L['srctex'] = p['srctex']; L['tex'] = p.get('tex')
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
def shrinkwrap(p, body, caps=((1.1, .050), (.9, .046), (.78, .040), (.62, .042), (.40, .040), (.0, .036))):
    """loose cloth that hangs far from the body (the crotch drape and the flared thighs of the donor trousers) is pulled in to a soft-fit distance of the body surface, so
    that when the legs swing in a run nothing stretches into a bell or a balloon between them: every vertex stays within a few centimetres of the skin it is weighted to"""
    from scipy.spatial import cKDTree
    tr = cKDTree(body['pos']); X = p['pos'].astype(np.float64); d, i = tr.query(X); cap = np.interp(X[:, 1], [c[0] for c in caps][::-1], [c[1] for c in caps][::-1])
    k = np.where(d > cap, cap / np.maximum(d, 1e-9), 1.0); B = body['pos'][i]; p['pos'] = (B + (X - B) * k[:, None]).astype(p['pos'].dtype); return p


def body_trousers(body, T, tag, rgb, tid, hem=.075, top=1.0, n=32):
    """clean trousers lofted around our own legs (no frayed donor edges, no seams): at every height each leg's cross-section is measured on the body and an ellipse of loose-fit cloth is grown around it (snug at the hip, roomy at the knee, drawn in at the ankle, soft pleats); in the thigh the two legs overlap along the inner seam so no sliver of skin shows between them. Skin weights are copied from the nearest body vertex"""
    from scipy.spatial import cKDTree
    B = body['pos'].astype(np.float64); ys = np.arange(hem, top + 1e-6, .02); rings = []; ang = np.linspace(0, 2 * np.pi, n, endpoint=False)
    prof = lambda y: np.interp(y, [hem, .20, .45, .62, .85, top], [.026, .024, .034, .036, .030, .014])
    def ring(sg, y, prev):
        sel = (np.abs(B[:, 1] - y) < .014) & (B[:, 0] * sg > -.012) & (np.abs(B[:, 0]) < .19)
        if sel.sum() < 6: return prev
        q = B[sel]; xo = (q[:, 0] * sg).max(); xi = (q[:, 0] * sg).min(); z0, z1 = q[:, 2].min(), q[:, 2].max()
        pr = prof(y); xi2 = max(xi - pr, .004) if y > .50 else xi - pr; xo2 = xo + pr; rx = (xo2 - xi2) / 2; cx = sg * (xo2 + xi2) / 2; rz = (z1 - z0) / 2 + pr; cz = (z0 + z1) / 2
        return (cx, cz, rx, rz)
    from scipy.ndimage import gaussian_filter1d
    P = []; UV = []; F = []; side = []
    for sg in (1, -1):
        prev = None; base = len(P); RR = []
        for y in ys:
            prev = ring(sg, y, prev); RR.append(prev)
        RR = gaussian_filter1d(np.array(RR, float), 1.6, axis=0, mode='nearest')
        for k, y in enumerate(ys):
            cx, cz, rx, rz = RR[k]
            hw = np.clip((y - hem) / .10, 0, 1) * np.clip((.95 - y) / .1, 0, 1); pl = .0035 * np.sin(6 * ang + y * 9) * hw
            hm = 1 + (0.0 if y > hem + .02 else -.035)
            for a, pa in zip(ang, pl): P.append([cx + (rx + pa) * np.cos(a) * hm, y, cz + (rz + pa) * np.sin(a) * hm])
            UV += [[(a / (2 * np.pi)) * .9 + .05, np.clip((y - hem) / (top - hem), 0, 1) * .9 + .05] for a in ang]
        for k in range(len(ys) - 1):
            for a in range(n):
                a2 = (a + 1) % n; i0 = base + k * n + a; i1 = base + k * n + a2; i2 = base + (k + 1) * n + a; i3 = base + (k + 1) * n + a2
                F += [[i0, i2, i1], [i1, i2, i3]] if sg > 0 else [[i0, i1, i2], [i1, i3, i2]]
    P = np.array(P); F = np.array(F); nn = BB.smooth_normals(P, F); tr = cKDTree(B); _, nb = tr.query(P)
    cen = np.array([0, P[:, 1].mean(), 0]); outw = np.mean(np.sum(nn * (P - cen), 1)) > 0
    if not outw: F = F[:, [0, 2, 1]]; nn = BB.smooth_normals(P, F)
    q = {k: v for k, v in body.items()}; dt = body['pos'].dtype
    q.update(pos=P.astype(dt), nrm=nn.astype(body['nrm'].dtype), uv=np.array(UV).astype(body['uv'].dtype), ix=F.reshape(-1).astype(body['ix'].dtype), jj=body['jj'][nb], ww=body['ww'][nb], mat='Outfit_%s_Bottoms' % tag)
    t = np.zeros((64, 64, 4), np.uint8); v = np.linspace(0, 1, 64)[:, None]; u = np.arange(64)[None, :]
    wv = 1 + .05 * np.sin(u * 1.9) * np.cos(v * 40) + .03 * np.sin(v * 70 + u); col = np.array(rgb, float)
    for ch in range(3): t[..., ch] = np.clip(col[ch] * wv * np.where(v < .05, .55, 1) * np.where((v > .045) & (v < .075), .8, 1), 0, 255)
    t[..., 3] = 255; T[tid] = Image.fromarray(t, 'RGBA'); q['srctex'] = tid; q['tex'] = tid; return q


def drop_tiny(p, n=12):
    """stray little islands of cloth (a triangle or two left over from the donor) are removed"""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    P = p['pos']; F = p['ix'].reshape(-1, 3); key = np.round(P * 1e4).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); Fv = inv[F]; m = inv.max() + 1
    e = np.r_[Fv[:, [0, 1]], Fv[:, [1, 2]]]; g = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(m, m)); _, lab = connected_components(g, directed=False)
    cnt = np.bincount(lab[Fv[:, 0]], minlength=lab.max() + 1); keep = cnt[lab[Fv[:, 0]]] >= n
    return p if keep.all() else C.sub(p, keep, p['mat'])


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
            if p['mat'].endswith('_Bottoms') and oid == 'Ninja' and not os.environ.get('NINJA_DONOR_LEGS'):
                im = np.asarray(T[p['srctex']].convert('RGB')).astype(float).reshape(-1, 3); lum = im.sum(1); sel = (lum > np.percentile(lum, 35)) & (lum < np.percentile(lum, 92)); rgb = np.median(im[sel], 0)
                p = body_trousers(body, T, 'Ninja', rgb, 62000); res.append(p); continue
            if p['mat'].endswith('_Bottoms'):
                p = p if os.environ.get('NOTRIM') else trim_hips(p, [(.84, 9), (.90, .160), (.96, .156), (1.04, .155), (1.10, .150), (1.16, .150)]); p = p if os.environ.get('NOSLIM') else slim_legs(p, body, margin=.011, keep=.15); p = shrinkwrap(p, body)
            elif p['mat'].endswith('_Collar') and FAITH:
                pass      # the donor's own collar and cuffs are kept exactly as modelled
            elif p['mat'].endswith('_Collar'):
                if oid == 'Dragon' and tops_ref is not None:
                    Fc = p['ix'].reshape(-1, 3); cc = p['pos'][Fc].mean(1); mb = (cc[:, 1] < 1.585) & (np.abs(cc[:, 0]) < .17)
                    if mb.any():
                        bib = C.sub(p, mb, 'Outfit_Dragon_Bib'); bib['uv'] = np.tile(tops_ref['uv0'], (len(bib['pos']), 1)).astype(bib['uv'].dtype); bib['srctex'] = tops_ref['srctex']; bib['tex'] = tops_ref['tex']; res.append(bib); p = C.sub(p, ~mb, p['mat'])
                p = keep_x(C.swap_sleeves(p, body, scale=ssc, off=.013, x0=.20, xs=.14, ylow=1.0, xend=band[2]), band[0], band[1])      # the donor's flared cuff / arm wrap, re-made as a snug band on our own arm
            elif p['mat'].endswith('_Tops') and FAITH:
                L_ = lining(p, body, T, oid); res.append(L_)      # the donor jacket is kept as modelled (flared sleeves, frog buttons, cuffs); a thin red lining only closes its shoulder/back cut-outs
            elif p['mat'].endswith('_Tops'):
                p = C.swap_sleeves(p, body, scale=ssc, off=float(os.environ.get('SLOFF', '.012')), x0=.20, xs=.14, ylow=1.0, xend=sxe); p = slim_torso(p, body); L_ = lining(p, body, T, oid); res.append(L_); tops_ref = dict(uv0=L_['uv'][0], srctex=L_['srctex'], tex=L_['tex']); p = repaint_panels(p, T) if oid == 'Dragon' else p
            if p['mat'].endswith('_Bottoms'): p = smooth_edges(p, 'y', lambda Q: Q[:, 1] < .62, win=11, reach=.05)     # trouser hems
            elif p['mat'].endswith('_Tops'): p = smooth_edges(p, 'y', lambda Q: (Q[:, 1] < 1.12) & (Q[:, 1] > .80), win=13, reach=.05)      # jacket hem
            elif p['mat'].endswith('_Collar') and oid == 'Ninja': p = smooth_edges(p, 'x', lambda Q: np.ones(len(Q), bool), win=9, reach=.03)       # wrist wrap
            if p['mat'].endswith('_Sash'): continue      # the donor's loose sash tails are flat strips that hang through the trousers: the jacket's own tied wrap is kept
            p = drop_tiny(p)
            _bnd(p, 'final'); res.append(p)
        out += res
    C.TIGHT = tuple(C.TIGHT) + tuple(p['mat'] for p in out)
    return out

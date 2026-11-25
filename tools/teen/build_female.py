"""The young woman pack (assets/girl): one shared anime body (the VRoid dancer's), five faces, hairstyles from every donor, black underclothes and the medieval outfits.
usage: python3 -I build_female.py <outdir>   (needs the uploaded girl models unzipped under $S/gz)"""
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_bases as BB, compose as C, outfits_new as NO
from PIL import Image
S = os.environ['S']; G = os.path.join(S, 'gz', 'Anime Girl characters')
SRC = [('dancer', 'anime_dancer_-_fully_rigged_3d_model.glb', BB.VRM, 'vrm'), ('fit', 'anime_fitness_girl_with_glasses.glb', BB.VRM, 'vrm'), ('ag', 'x_anime_girl_rigged_anime_model/scene.gltf', BB.MIX, 'y'),
       ('g3', 'character_girl_3_fbx.glb', BB.CC, 'cc'), ('g4', 'character_girl_4_fbx.glb', BB.CC, 'cc'),
       ('witch', 'x_medieval_witch_girl/scene.gltf', BB.RPM, 'y'), ('warr', 'x_medieval_warrior_girl/scene.gltf', BB.CC, 'ycm')]
FACES = ['dancer', 'fit', 'ag']                   # face 0..2
HAIRS = [('dancer', 'FA'), ('fit', 'FB'), ('ag', 'FC'), ('g3', 'FD'), ('g4', 'FE')]        # donor, id prefix  (id + '0')
def load():
    d = {}
    for key, rel, tb, mode in SRC:
        raw, wp, texs = BB.convert(os.path.join(G, rel), tb, mode, 512)
        if key in ('g3', 'g4'): raw = BB.split_merged(raw, wp)
        d[key] = (raw, wp, dict(enumerate(texs)))
    return d
def bridge_torso(body, Tbody=None):
    """the donor body has no skin between the waist and the bust (it was hidden under the dress): the two open rings (waist and underside of the bust) are found by walking the open edges, both are resampled by angle around the body axis and lofted together with a smooth strip of rows, so the belly and ribs are one continuous skin"""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    P = body['pos']; F = body['ix'].reshape(-1, 3); key = np.round(P * 1e4).astype(np.int64); u, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1); Fv = inv[F]
    e = np.sort(np.r_[Fv[:, [0, 1]], Fv[:, [1, 2]], Fv[:, [2, 0]]], axis=1); ue, cnt = np.unique(e, axis=0, return_counts=True); b = ue[cnt == 1]
    n = len(u); g = coo_matrix((np.ones(len(b)), (b[:, 0], b[:, 1])), shape=(n, n)); _, lab = connected_components(g, directed=False); pos = P[first]; loops = []
    for l in set(lab[np.unique(b)]):
        vs = np.unique(b[lab[b[:, 0]] == l]); q = pos[vs]
        if len(vs) >= 12 and 1.15 < q[:, 1].mean() < 1.50 and np.abs(q[:, 0]).max() < .25: loops.append((q[:, 1].mean(), vs))
    loops.sort(key=lambda t: t[0]); print('torso loops', [(round(float(a), 3), len(v)) for a, v in loops])
    if len(loops) != 2: return body
    lo, hi = loops[0][1], loops[1][1]; cz = float(np.r_[pos[lo][:, 2], pos[hi][:, 2]].mean())
    adj = {}
    for a_, b_ in b: adj.setdefault(a_, []).append(b_); adj.setdefault(b_, []).append(a_)
    def order(ids):                                  # walk the open edge from vertex to vertex (not by angle: the rim is not star-shaped at the front)
        ids = list(ids); st = min(ids, key=lambda v: np.arctan2(pos[v][0], pos[v][2] - cz)); seq = [st]; prev = None; cur = st
        while True:
            nx = [v for v in adj[cur] if v != prev and v in set(ids)]
            if not nx or nx[0] == st: break
            prev, cur = cur, nx[0]; seq.append(cur)
            if len(seq) > len(ids): break
        seq = np.array(seq); a = np.unwrap(np.arctan2(pos[seq][:, 0], pos[seq][:, 2] - cz))
        if a[-1] < a[0]: seq = seq[::-1]; a = np.unwrap(np.arctan2(pos[seq][:, 0], pos[seq][:, 2] - cz))
        return first[seq], a
    L, la = order(lo); H, ha = order(hi); M = 120; rows = 5; th = np.linspace(-np.pi, np.pi, M, endpoint=False)
    def resample(ids, a):
        pp = P[np.r_[ids, ids[:1]]]; seg = np.linalg.norm(np.diff(pp, axis=0), axis=1); t = np.r_[0, np.cumsum(seg)] / seg.sum(); tt = np.linspace(0, 1, M, endpoint=False)
        pos_ = np.stack([np.interp(tt, t, pp[:, k]) for k in range(3)], 1); ang = np.arctan2(pos_[:, 0], pos_[:, 2] - cz); return pos_, ids[np.clip(np.searchsorted(t, tt, side='right') - 1, 0, len(ids) - 1)], ang
    A, nl, angA = resample(L, la); B, nh, angB = resample(H, ha)
    # rotate the upper rim so that its first sample lies at the same angle as the waist rim's, then both run the same way around
    sh = int(np.argmin(np.abs(np.angle(np.exp(1j * (angB - angA[0])))))); B = np.roll(B, -sh, axis=0); nh = np.roll(nh, -sh)
    if np.sign(np.diff(np.unwrap(angA))[:5].sum()) != np.sign(np.diff(np.unwrap(np.roll(angB, -sh)))[:5].sum()): B = np.r_[B[:1], B[:0:-1]]; nh = np.r_[nh[:1], nh[:0:-1]]
    pos_rows = []; src_rows = []; nrm_rows = []
    for r in range(-1, rows + 2):
        s_ = min(1, max(0, r / rows)); sm = s_ * s_ * (3 - 2 * s_); pos_rows.append(A * (1 - sm) + B * sm + np.array([0, -.02 if r < 0 else .012 if r > rows else 0, 0])); src_rows.append(nl if s_ < .5 else nh)
        nl_n = sum(np.roll(body['nrm'][nl], k, axis=0) for k in range(-6, 7)); nh_n = sum(np.roll(body['nrm'][nh], k, axis=0) for k in range(-6, 7))          # smoothed around the body so the shading has no streaks
        nr = nl_n / 13 * (1 - sm) + nh_n / 13 * sm; nrm_rows.append(nr / np.maximum(np.linalg.norm(nr, axis=1, keepdims=True), 1e-9))
    X = np.concatenate(pos_rows); src = np.concatenate(src_rows); NR = np.concatenate(nrm_rows); n0 = len(P); tri = []
    for r in range(rows + 2):
        a_ = n0 + r * M + np.arange(M); b_ = n0 + (r + 1) * M + np.arange(M)
        for k in range(M): k2 = (k + 1) % M; tri.append((a_[k], a_[k2], b_[k])); tri.append((a_[k2], b_[k2], b_[k]))
    T3 = np.array(tri); XX = np.concatenate([P, X])
    nrm_ = np.cross(XX[T3[:, 1]] - XX[T3[:, 0]], XX[T3[:, 2]] - XX[T3[:, 0]]); cen = XX[T3].mean(1); rad = cen - np.array([0, 0, cz]); rad[:, 1] = 0
    flip = (nrm_ * rad).sum(1) > 0; T3[flip] = T3[flip][:, ::-1]                     # the donor body winds inward
    # the strip carries one solid skin texel: the two rings sit on different parts of the donor skin atlas, and a strip stretched across the atlas would hit its transparent gaps
    from scipy.ndimage import binary_erosion
    tx = np.asarray(Tbody.convert('RGBA')); hh, ww_ = tx.shape[:2]; solid = binary_erosion(tx[..., 3] > 250, iterations=6); cand = body['uv'][np.r_[L, H]]
    okc = np.array([solid[min(int(v % 1 * hh), hh - 1), min(int(u_ % 1 * ww_), ww_ - 1)] for u_, v in cand])
    if okc.any(): cand = cand[okc]
    else: ys, xs = np.nonzero(solid); k = len(ys) // 2; cand = np.array([[xs[k] / ww_, ys[k] / hh]])
    u0 = cand[0]; d = dict(body)
    d['pos'] = XX.astype(P.dtype); d['nrm'] = np.concatenate([body['nrm'], NR]).astype(body['nrm'].dtype)
    for k in ('jj', 'ww'): d[k] = np.concatenate([body[k], body[k][src]]).astype(body[k].dtype)
    d['uv'] = np.concatenate([body['uv'], np.tile(u0, (len(X), 1))]).astype(body['uv'].dtype)
    d['ix'] = np.r_[body['ix'], T3.reshape(-1)].astype(body['ix'].dtype); return d
def trim_top(p, y=1.80):
    """the donor face skin runs up over the crown; above the hairline the hair cap and the body dome take over"""
    F = p['ix'].reshape(-1, 3); cc = p['pos'][F].mean(1); keep = (cc[:, 1] <= y) & ~((cc[:, 1] > y - .035) & (np.abs(cc[:, 0]) > .05))
    q = dict(p); q['ix'] = F[keep].reshape(-1).astype(p['ix'].dtype); return q
def scalp(hp, htx, body):
    """the strand cards of the donor hairstyles leave gaps: a thin hair shell covers the crown and the back of the skull (down to the nape), tapering to nothing at its lower edge, and carries a patch of the hairstyle's own strand texture (so it shades and dyes exactly like the hair, with no flat patches). It is merged into the back piece of the hairstyle, hairline and ears stay free"""
    from scipy.ndimage import binary_erosion
    F = body['ix'].reshape(-1, 3); c = body['pos'][F].mean(1)
    m = ((c[:, 1] > 1.79) | ((c[:, 2] < -.015) & (c[:, 1] > 1.66)) | ((c[:, 1] > 1.765) & (np.abs(c[:, 0]) > .05))) & (c[:, 1] < 1.95)
    cap = C.sub(body, m)
    tgt = max(hp, key=lambda p: len(p['pos'])); im = htx[tgt['srctex']].convert('RGBA'); a = np.asarray(im).astype(float); h, w = a.shape[:2]
    from scipy.ndimage import binary_dilation
    solid = binary_erosion(a[..., 3] > 250, iterations=3); S_ = 32; best = None
    uvt = tgt['uv']; cx = np.clip((uvt[:, 0] % 1 * w).astype(int), 0, w - 1); cy = np.clip((uvt[:, 1] % 1 * h).astype(int), 0, h - 1)
    cover = np.zeros((h, w), bool); cover[cy, cx] = True; cover = binary_dilation(cover, iterations=10) & (a[..., 3] > 250)      # only texels that this hairstyle really uses (not its headband or other atlas parts)
    ref = a[cy, cx]; ref = ref[ref[:, 3] > 250][:, :3]; mean = np.median(ref, axis=0) if len(ref) else a[solid][:, :3].mean(0)
    for y0 in range(0, h - S_, 8):
        for x0 in range(0, w - S_, 8):
            if solid[y0:y0 + S_, x0:x0 + S_].all() and cover[y0:y0 + S_, x0:x0 + S_].mean() > .9:
                blk = a[y0:y0 + S_, x0:x0 + S_, :3].reshape(-1, 3); d = np.abs(blk.mean(0) - mean).sum() + .5 * blk.std(0).sum()
                if best is None or d < best[0]: best = (d, x0, y0)
    if best is None: ys, xs = np.nonzero(solid); k = len(ys) // 2; best = (0, int(xs[k]) - 4, int(ys[k]) - 4); S_ = 8
    _, x0, y0 = best; P0 = cap['pos']
    u = x0 / w + (S_ / w) * (((P0[:, 0] + .1) / .2) % 1) * .9 + .05 * S_ / w; v = y0 / h + (S_ / h) * (((P0[:, 1] * 6 + P0[:, 2] * 3) % 1)) * .9 + .05 * S_ / h
    ymin = 1.66; tap = np.clip((P0[:, 1] - ymin) / .10, 0, 1); tap = tap * tap * (3 - 2 * tap)
    pos = P0 - cap['nrm'] * (.004 + .016 * tap)[:, None]; ix = cap['ix'].astype(np.int64) + len(tgt['pos'])
    out = dict(tgt)
    for k in ('pos', 'nrm', 'jj', 'ww'): out[k] = np.concatenate([tgt[k], pos if k == 'pos' else cap[k]]).astype(tgt[k].dtype)
    out['uv'] = np.concatenate([tgt['uv'], np.c_[u, v]]).astype(tgt['uv'].dtype); out['ix'] = np.concatenate([tgt['ix'], ix]).astype(tgt['ix'].dtype)
    return [out if p is tgt else p for p in hp]
def under(body, T):
    F = body['ix'].reshape(-1, 3); c = body['pos'][F].mean(1); out = []
    tex = np.zeros((8, 8, 4), np.uint8); tex[..., :3] = (54, 54, 60); tex[..., 3] = 255; T[901] = Image.fromarray(tex, 'RGBA')
    by = body['pos'][F][:, :, 1]; m = (by.max(1) > .90) & (by.min(1) < 1.135) & (np.abs(c[:, 0]) < .21)
    p = C.clip_y(C.clip_y(C.sub(body, m, 'Outfit_Under_Bottoms'), .90, True), 1.135, False)
    n = -p['nrm']; ease = .006 + .004 * np.clip((p['pos'][:, 1] - 1.05) / .08, 0, 1); p['pos'] = p['pos'] + n * ease[:, None]; p['srctex'] = 901; out.append(p)
    m = (by.max(1) > 1.31) & (by.min(1) < 1.46) & (np.abs(c[:, 0]) < .24)
    q = C.clip_y(C.clip_y(C.sub(body, m, 'Outfit_Under_Tops'), 1.31, True), 1.45, False); n = -q['nrm']; q['pos'] = q['pos'] + n * .013; q['srctex'] = 901; out.append(q)
    for p in out: p['uv'] = np.zeros_like(p['uv']); p['nrm'] = BB.smooth_normals(p['pos'], p['ix'].reshape(-1, 3))
    return out
def main(out):
    d = load(); raw0, wp, tex0 = d['dancer']; pr0 = BB.name_native(raw0, 'FA0', 'Gown'); body = next(p for p in pr0 if p['mat'] == 'Skin_Body'); body = bridge_torso(body, tex0[body['srctex']]); pr0 = [body if p['mat'] == 'Skin_Body' else p for p in pr0]
    T = dict(tex0); ex = []
    ex.append((body, tex0)); ex.append((dict(body, mat='Skin_BodyD'), tex0))        # the dressed-skin layer the game switches to under any outfit
    bt = BB.mean_skin(tex0[body['srctex']])
    for k, fk in enumerate(FACES):
        fraw, fwp, ftx = d[fk]; fp = BB.name_native(fraw, 'x', 'x'); part = BB.face_set(fp, ftx, k)
        if fk != 'dancer': part = BB.move_hair(part, fwp, wp)
        ft = BB.mean_skin(ftx[next(p for p in fp if p['mat'] == 'Skin_Face')['srctex']]); newtex = dict(ftx)
        for p in part:
            if p['mat'].endswith('_Skin'): newtex[p['srctex']] = BB.tone_match(ftx[p['srctex']], ft, bt)
        part = [trim_top(p) if p['mat'].endswith('_Skin') else p for p in part]; ex += [(p, newtex) for p in part]
    for dk, pre in HAIRS:
        hraw, hwp, htx = d[dk]; hp = [p for p in BB.name_native(hraw, pre + '0', 'x') if p['mat'].startswith('Hair_')]
        hp = BB.move_hair(hp, hwp, wp); hp = scalp(hp, htx, body); ex += [(p, htx) for p in hp]
    ex += [(p, T) for p in under(body, T)]
    gown = [p for p in pr0 if p['mat'].startswith('Outfit_Gown_')]; ex += [(p, tex0) for p in gown]
    for dk, oid in (('witch', 'Adventurer'),):
        oraw, owp, otx = d[dk]; op = C.shift_by_joints(BB.name_native([r for r in oraw if r['key'] in ('Tops', 'Bottoms', 'Shoes')], 'x', oid), owp, wp)
        otx = dict(otx)
        for p in op: otx[p['srctex']] = NO.opaque(otx[p['srctex']])
        tp = next(p for p in op if p['mat'].endswith('_Tops')); im = np.asarray(otx[tp['srctex']].convert('RGB')).astype(float); h, w = im.shape[:2]; uv = tp['uv']
        px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]; med = np.median(px, axis=0); uvs = uv[np.argmin(np.abs(px - med).sum(1))]
        BF = body['ix'].reshape(-1, 3); bc = body['pos'][BF].mean(1); by = body['pos'][BF][:, :, 1]; lm = (by.max(1) > 1.12) & (by.min(1) < 1.45) & (np.abs(bc[:, 0]) < .18)
        L = C.clip_y(C.clip_y(C.sub(body, lm, 'Outfit_%s_Lining' % oid), 1.12, True), 1.45, False); L['pos'] = L['pos'] - L['nrm'] * .011; L['uv'] = np.tile(uvs, (len(L['pos']), 1)).astype(L['uv'].dtype); L['srctex'] = tp['srctex']; L['nrm'] = BB.smooth_normals(L['pos'], L['ix'].reshape(-1, 3)); op.append(L)
        ex += [(p, otx) for p in op]
    BB.assemble('girl', ex, wp, out)
if __name__ == '__main__': main(sys.argv[1])

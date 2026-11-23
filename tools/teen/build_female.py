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
def bridge_torso(body, y0=1.20, y1=1.34, y2=1.44):
    """the donor body has no skin between the waist and the bust (it was hidden under the dress): sew the two open rings together with a strip of triangles"""
    P = body['pos']; F = body['ix'].reshape(-1, 3); key = np.round(P * 1e4).astype(np.int64); u, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1); Fv = inv[F]
    e = np.sort(np.r_[Fv[:, [0, 1]], Fv[:, [1, 2]], Fv[:, [2, 0]]], axis=1); ue, cnt = np.unique(e, axis=0, return_counts=True); b = ue[cnt == 1]
    yv = P[first][:, 1]; xv = P[first][:, 0]; zv = P[first][:, 2]
    def ring(lo, hi):
        ids = np.unique(b[(yv[b[:, 0]] > lo) & (yv[b[:, 0]] < hi) & (yv[b[:, 1]] > lo) & (yv[b[:, 1]] < hi) & (np.abs(xv[b[:, 0]]) < .25) & (np.abs(xv[b[:, 1]]) < .25)])
        return ids
    lo = ring(y0, y1 - .04); hi = ring(y1 - .02, y2)
    print('torso rings', len(lo), len(hi), 'y', yv[lo].mean() if len(lo) else None, yv[hi].mean() if len(hi) else None)
    if len(lo) < 8 or len(hi) < 8: return body
    cx, cz = 0.0, float(np.r_[zv[lo], zv[hi]].mean())
    def order(ids): a = np.arctan2(xv[ids] - cx, zv[ids] - cz); o = np.argsort(a); return ids[o], a[o]
    L, la = order(lo); H, ha = order(hi); tri = []; i = j = 0; n, m = len(L), len(H)
    while i < n or j < m:
        a_i = la[i % n] + (2 * np.pi if i >= n else 0); a_j = ha[j % m] + (2 * np.pi if j >= m else 0)
        nl = la[(i + 1) % n] + (2 * np.pi if i + 1 >= n else 0) if i < n else 9e9; nh = ha[(j + 1) % m] + (2 * np.pi if j + 1 >= m else 0) if j < m else 9e9
        if i < n and (j >= m or nl <= nh): tri.append((L[i % n], L[(i + 1) % n], H[j % m])); i += 1
        else: tri.append((L[i % n], H[(j + 1) % m], H[j % m])); j += 1
    rep = first; T3 = np.array([[rep[a], rep[b_], rep[c]] for a, b_, c in tri])
    nrm = np.cross(P[T3[:, 1]] - P[T3[:, 0]], P[T3[:, 2]] - P[T3[:, 0]]); cen = P[T3].mean(1); rad = cen - np.array([0, 0, cz]); rad[:, 1] = 0
    flip = (nrm * rad).sum(1) > 0; T3[flip] = T3[flip][:, ::-1]                       # the donor body winds inward
    d = dict(body); d['ix'] = np.r_[body['ix'], T3.reshape(-1)].astype(body['ix'].dtype)
    d['nrm'] = BB.smooth_normals(P, d['ix'].reshape(-1, 3)); return d
def trim_top(p, y=1.80):
    """the donor face skin runs up over the crown; above the hairline the hair cap and the body dome take over"""
    F = p['ix'].reshape(-1, 3); keep = p['pos'][F].mean(1)[:, 1] <= y
    q = dict(p); q['ix'] = F[keep].reshape(-1).astype(p['ix'].dtype); return q
def scalp(hp, htx, body):
    """the strand cards of the donor hairstyles leave gaps; a thin dome in the hair's own colour sits on the crown (hairline and forehead stay free) and is merged into the back piece, so it is hidden/dyed with the hairstyle"""
    F = body['ix'].reshape(-1, 3); c = body['pos'][F].mean(1); m = (c[:, 1] > 1.79) & (c[:, 1] < 1.95)
    cap = C.sub(body, m)
    tgt = next((p for p in hp if p['mat'].endswith('Back')), hp[0]); im = np.asarray(htx[tgt['srctex']].convert('RGBA')).astype(float); h, w = im.shape[:2]; uv = tgt['uv']
    px = im[np.clip((uv[:, 1] % 1 * h).astype(int), 0, h - 1), np.clip((uv[:, 0] % 1 * w).astype(int), 0, w - 1)]; ok = px[:, 3] > 200; px = px[ok][:, :3]; uvk = uv[ok]
    med = np.median(px, axis=0); u0 = uvk[np.argmin(np.abs(px - med).sum(1))]
    pos = cap['pos'] - cap['nrm'] * .02; ix = cap['ix'].astype(np.int64) + len(tgt['pos'])
    out = dict(tgt)
    for k in ('pos', 'nrm', 'jj', 'ww'): out[k] = np.concatenate([tgt[k], pos if k == 'pos' else cap[k]]).astype(tgt[k].dtype)
    out['uv'] = np.concatenate([tgt['uv'], np.tile(u0, (len(pos), 1))]).astype(tgt['uv'].dtype); out['ix'] = np.concatenate([tgt['ix'], ix]).astype(tgt['ix'].dtype)
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
    d = load(); raw0, wp, tex0 = d['dancer']; pr0 = BB.name_native(raw0, 'FA0', 'Gown'); body = next(p for p in pr0 if p['mat'] == 'Skin_Body'); body = bridge_torso(body); pr0 = [body if p['mat'] == 'Skin_Body' else p for p in pr0]
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

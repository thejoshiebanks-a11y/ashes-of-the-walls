#!/usr/bin/env python3
"""Build the modular teen character (one engine model, one 24-joint skeleton, many switchable parts).

  python3 tools/teen/build_modular.py --glb teen-character-rigged.glb --fbx <Source/FBX dir> --tex <Source/Textures dir> \
          --core <AOT_Character_Core_Pack dir> --out assets/teen [--faces 100000]

Parts written (prim material names are the switches the game uses via actor.skipRe / actor.tintFn):
  Face, Iris                      the teen's own head and eyes (kept from his glb)
  Hair_Messy                      his original hair, split off the head as its own shell
  Hair_SimpleParted / Hair_Buzzed / Hair_Long / Hair_Buns      Quaternius hair fitted to his head
  Outfit_Modern                   his original modern clothes + hands/arms/legs (everything below the head)
  Outfit_Peasant_{Body,Arms,Legs,Feet}, Outfit_Ranger_{...}    Quaternius medieval outfits fitted to his skeleton
  Gear_ODM, Gear_SwordL, Gear_SwordR   Levi's ODM gear re-fitted to his proportions
"""
import argparse, glob, io, json, os, struct, sys, zlib
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from gltf_reader import GLTF
from engine_model import write_model
from build_teen import NAMES, decimate, smooth_normals
import fbx_skin, fit_outfit

FACE_Y = 1.31                                   # head/neck cut height (just above the shirt collar line)
PEEL = 10
SLIVER = 1e9                                    # (sliver shaving also eats eyelids: disabled)

def tex_sample(tex, uv):
    H, W = tex.shape[:2]; u = np.clip((uv[:, 0] % 1 * W).astype(int), 0, W - 1); v = np.clip((uv[:, 1] % 1 * H).astype(int), 0, H - 1); return tex[v, u].astype(float)

def weld(pos, uv, vidx, tris):
    """expand polygon corners -> welded (vertex,uv) arrays"""
    key = np.c_[vidx, np.round(uv * 1e5).astype(np.int64)]; _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    return first, inv[tris.reshape(-1)] if False else inv

def prim_from_corners(P3, UVc, vidx, tris, jj_v, ww_v, mat, tex):
    """P3: per-source-vertex positions; UVc: per-corner uv; vidx: per-corner source vertex; tris: corner triples."""
    key = np.c_[vidx, np.round(UVc * 1e5).astype(np.int64)]; _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    sv = vidx[first]; pos = P3[sv]; uv = UVc[first]; ix = inv[tris.reshape(-1)].reshape(-1, 3)
    ok = (ix[:, 0] != ix[:, 1]) & (ix[:, 1] != ix[:, 2]) & (ix[:, 0] != ix[:, 2]); ix = ix[ok]
    return dict(mat=mat, tex=tex, pos=pos.astype(np.float32), nrm=smooth_normals(pos.astype(np.float64), ix), uv=uv.astype(np.float32), jj=jj_v[sv], ww=ww_v[sv], ix=ix.reshape(-1))

def subset(P, N, UV, J, W, F, sel, mat, tex):
    f = F[sel]; used = np.unique(f); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
    return dict(mat=mat, tex=tex, pos=P[used], nrm=N[used], uv=UV[used], jj=J[used].astype(np.int64), ww=W[used].astype(np.float64), ix=remap[f].reshape(-1))

def refine_face(P, F, face, head):
    """colour alone leaves orange highlight strands of the hair in the face shell: keep only the main edge-connected face component and peel 1-neighbour fringe"""
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    key = np.round(P.astype(np.float64) * 1e5).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1); Fw = inv[F]
    E = np.concatenate([Fw[:, [0, 1]], Fw[:, [1, 2]], Fw[:, [2, 0]]]); E.sort(1); T3 = np.tile(np.arange(len(F)), 3)
    ek = E[:, 0].astype(np.int64) * (inv.max() + 1) + E[:, 1]; order = np.argsort(ek, kind='stable'); ek = ek[order]; T3 = T3[order]
    same = ek[1:] == ek[:-1]; A, B = T3[:-1][same], T3[1:][same]           # triangle pairs sharing an edge
    face = face.copy()
    for _ in range(PEEL):                                                 # peel face triangles with <=1 face neighbour (removes the spiky remains of the hair cut)
        nb = np.bincount(np.r_[A[face[B]], B[face[A]]], minlength=len(F)); face &= nb >= 2
    e1, e2, e3 = P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 1]], P[F[:, 0]] - P[F[:, 2]]
    area2 = np.linalg.norm(np.cross(e1, e2), axis=1) + 1e-12; lmax2 = np.max([(e1 ** 2).sum(1), (e2 ** 2).sum(1), (e3 ** 2).sum(1)], axis=0); sliver = lmax2 / area2 > SLIVER
    for _ in range(6):                                                    # the hair cut leaves long thin slivers on the edge: shave them off
        nb = np.bincount(np.r_[A[face[B]], B[face[A]]], minlength=len(F)); face &= ~((nb < 3) & sliver)
    sel = face[A] & face[B]; g = coo_matrix((np.ones(sel.sum()), (A[sel], B[sel])), shape=(len(F), len(F))); nc, lab = connected_components(g, directed=False)
    cnt = np.bincount(lab[face]); main = cnt.argmax(); return face & (lab == main)


def head_shell(prims, head_joint, uv, y_lo=1.27, y_hi=1.47, y_top=1.604, inset=.008, nphi=72, ny=34):
    """closed skull + nape surface of revolution, fitted INSIDE the face shell (so the face always wins where it exists) and following the default
    ellipsoid / neck taper where the face shell has holes (back and sides of the head, back of the neck). y_hi: top of the strip, y_lo: bottom."""
    from scipy.ndimage import distance_transform_edt, gaussian_filter
    z0 = -0.012; ys = np.linspace(y_lo, y_top, ny); ph = np.linspace(-np.pi, np.pi, nphi, endpoint=False)
    face = np.vstack([p['pos'].astype(np.float64) for p in prims if p['mat'] == 'Face' or p['mat'].startswith('Face_')])
    body = [p for p in prims if p['mat'] == 'Outfit_Modern'][0]['pos'].astype(np.float64); neck = body[(body[:, 1] > 1.20) & (body[:, 1] < 1.31)]
    nr = np.hypot(neck[:, 0], neck[:, 2] - z0); nrx = np.percentile(np.abs(neck[:, 0]), 90) * .93
    def default(y, f):                                                                     # (rx, rz) at height y
        e = np.sqrt(np.clip(1 - ((y - 1.487) / (y_top - 1.487)) ** 2, 0, 1)); rx = .094 * e; rz = .101 * e
        t = np.clip((1.45 - y) / .15, 0, 1); t = t * t * (3 - 2 * t)                       # taper to the neck below the ears
        rx = np.where(y > 1.487, rx, np.where(y >= 1.45, .094, .094 * (1 - t) + nrx * t)); rz = np.where(y > 1.487, rz, np.where(y >= 1.45, .101, .101 * (1 - t) + nrx * 1.05 * t)); return rx, rz
    R = np.full((ny, nphi), np.inf)
    for pts, ins in ((face, inset), (neck, .002)):
        dx, dz = pts[:, 0], pts[:, 2] - z0; yi = np.clip(np.round((pts[:, 1] - y_lo) / (y_top - y_lo) * (ny - 1)).astype(int), 0, ny - 1)
        pj = np.round((np.arctan2(dz, dx) + np.pi) / (2 * np.pi) * nphi).astype(int) % nphi; r = np.hypot(dx, dz) - ins
        np.minimum.at(R, (yi, pj), r)
    has = np.isfinite(R) & (R > .02); idx = distance_transform_edt(~has, return_distances=True, return_indices=True); dist, ind = idx[0], idx[1]
    fill = R[ind[0], ind[1]]; fill = np.where(np.isfinite(fill), fill, .09)
    rx, rz = default(ys[:, None], 0); rx = np.maximum(rx, 2e-4); rz = np.maximum(rz, 2e-4); rd = (rx * rz) / np.sqrt((rz * np.cos(ph)[None]) ** 2 + (rx * np.sin(ph)[None]) ** 2)     # ellipse radius along each azimuth
    w = np.exp(-(dist / 5.) ** 2); Rf = np.where(has, R, w * fill + (1 - w) * rd); Rf = np.minimum(Rf, np.where(has, 9, np.maximum(rd * 1.0, fill)))
    Rf = gaussian_filter(Rf, (1.0, 1.5), mode=('nearest', 'wrap')); Rf = np.where(has, np.minimum(Rf, R + .0005), Rf)
    top = ny - 1; e_top = np.sqrt(np.clip(1 - ((ys - 1.487) / (y_top - 1.487)) ** 2, 0, 1)); Rf = np.minimum(Rf, np.maximum(rd, .003) * 1.02 + 0 * Rf)
    pos = []; 
    for i, y in enumerate(ys):
        for k, f in enumerate(ph): pos.append([Rf[i, k] * np.cos(f), y, z0 + Rf[i, k] * np.sin(f)])
    pos = np.array(pos); ix = []
    for i in range(ny - 1):
        for k in range(nphi):
            k2 = (k + 1) % nphi; a, b, c, d = i * nphi + k, i * nphi + k2, (i + 1) * nphi + k, (i + 1) * nphi + k2; ix += [(a, c, b), (b, c, d)]
    ix = np.array(ix); n = len(pos); jj = np.zeros((n, 4), np.int64); ww = np.zeros((n, 4)); jj[:, 0] = head_joint; ww[:, 0] = 1
    def mk(sel_y0, mat, grow, tex):
        keep = pos[ix][:, :, 1].min(1) >= sel_y0 - 1e-6; i2 = ix[keep]; u = np.unique(i2); rm = -np.ones(n, np.int64); rm[u] = np.arange(len(u)); p2 = pos[u].copy()
        c = np.array([0, p2[:, 1].mean(), z0]); out = p2 - np.array([0, 0, z0]); out[:, 1] = 0; out = out / (np.linalg.norm(out, axis=1, keepdims=True) + 1e-9); p2 = p2 + out * grow
        return dict(mat=mat, tex=tex, pos=p2.astype(np.float32), nrm=smooth_normals(p2, rm[i2]), uv=np.tile(np.asarray(uv, np.float32), (len(u), 1)), jj=jj[u], ww=ww[u], ix=rm[i2].reshape(-1))
    return mk

def skull_cap(head_joint, uv, c=(-0.004, 1.487, -0.012), r=(0.109, 0.108, 0.119), nu=40, nv=22):
    th = np.linspace(0, np.pi * .5 + .45, nv); ph = np.linspace(0, 2 * np.pi, nu, endpoint=False)           # from the crown down to below the equator
    pos = [np.array([c[0], c[1] + r[1], c[2]])]; ring = []
    for t in th[1:]:
        row = []
        for f in ph:
            q = np.array([c[0] + r[0] * np.sin(t) * np.cos(f), c[1] + r[1] * np.cos(t), c[2] + r[2] * np.sin(t) * np.sin(f)]); row.append(len(pos)); pos.append(q)
        ring.append(row)
    ix = []
    for k in range(nu): ix.append((0, ring[0][k], ring[0][(k + 1) % nu]))
    for a, b in zip(ring[:-1], ring[1:]):
        for k in range(nu):
            k2 = (k + 1) % nu; ix += [(a[k], b[k], b[k2]), (a[k], b[k2], a[k2])]
    pos = np.array(pos); ix = np.array(ix); keep = ~((pos[ix][:, :, 2].mean(1) > 0.035) & (pos[ix][:, :, 1].mean(1) < 1.545))   # not over the forehead / face
    ix = ix[keep]; ix = ix[:, ::-1] if False else ix
    n = len(pos); jj = np.zeros((n, 4), np.int64); ww = np.zeros((n, 4)); jj[:, 0] = head_joint; ww[:, 0] = 1
    return dict(mat='Scalp', tex=0, pos=pos.astype(np.float32), nrm=smooth_normals(pos, ix), uv=np.tile(np.asarray(uv, np.float32), (n, 1)), jj=jj, ww=ww, ix=ix.reshape(-1))

def infl_to_arrays(infl, tidx):
    n = len(infl); jj = np.zeros((n, 4), np.int64); ww = np.zeros((n, 4))
    for i, lst in enumerate(infl):
        for k, (t, w) in enumerate(lst[:4]): jj[i, k] = tidx[t]; ww[i, k] = w
        if not lst: ww[i, 0] = 1
    return jj, ww

def read_pack(path):
    d = open(path, 'rb').read(); hl = struct.unpack('<I', d[:4])[0]; h = json.loads(d[4:4 + hl]); b = 4 + hl
    return {k: d[b + o:b + o + l] for k, (o, l) in h.items()}


def make_eye_tex():
    """128x64: left 64x64 = grey iris (pupil, fibres, limbal ring; tinted at runtime), right half = plain white (catch-light)"""
    n = 64; y, x = np.mgrid[:n, :n]; x = (x + .5) / n * 2 - 1; y = (y + .5) / n * 2 - 1; r = np.hypot(x, y); ang = np.arctan2(y, x)
    g = 150 + 60 * np.clip((r - .35) / .5, 0, 1) + 14 * np.sin(ang * 17) * np.clip((r - .3) / .3, 0, 1)
    g = np.where(r < .36, 22, g); g = np.where(r > .80, g * np.clip(1 - (r - .8) / .2, .25, 1), g)
    img = np.zeros((n, 128), np.uint8); img[:, :n] = np.clip(g, 0, 255); img[:, n:] = 255
    return Image.fromarray(img).convert('RGB')

def eye_prims(P, F, iris, head_j, ti, R=.0112, SQ=.76, SEG=20):
    """clean round irises (+ catch-lights) in front of the painted eyes; centres come from the teen's own painted iris patches"""
    pts = P[F[iris]].reshape(-1, 3); out_i = []; out_s = []
    for side in (-1, 1):
        q = pts[np.sign(pts[:, 0]) == side]; c = q.mean(0)
        def ring(rad, dz, uv0, uvs, dy=0., dx=0.):
            th = np.linspace(0, 2 * np.pi, SEG, endpoint=False); xs, ys = np.cos(th) * rad, np.sin(th) * rad
            ys = np.where(ys > 0, ys * SQ, ys)                                   # the upper lid covers the top of the iris
            pos = np.vstack([[c[0] + dx, c[1] + dy, 0.]] + [[c[0] + dx + a, c[1] + dy + b, 0.] for a, b in zip(xs, ys)])
            for k in range(len(pos)): d = np.hypot(q[:, 0] - pos[k, 0], q[:, 1] - pos[k, 1]); pos[k, 2] = q[d < .014, 2].max() + dz if (d < .014).any() else c[2] + dz
            uv = np.vstack([[uv0]] + [[uv0[0] + np.cos(t) * uvs[0], uv0[1] - np.sin(t) * uvs[1]] for t in th])
            ix = np.array([[0, 1 + k, 1 + (k + 1) % SEG] for k in range(SEG)]); return pos, uv, ix
        for lst, rad, dz, uv0, uvs, dy, dx in ((out_i, R, .0012, (.25, .5), (.25, .5), 0., 0.), (out_s, .0026, .0020, (.75, .5), (0., 0.), .0050, -.0036)):
            pos, uv, ix = ring(rad, dz, uv0, uvs, dy, dx); lst.append((pos, uv, ix))
    def pack(lst, mat):
        pos = np.vstack([p for p, _, _ in lst]); uv = np.vstack([u for _, u, _ in lst]); ix = np.vstack([i + k * len(lst[0][0]) for k, (_, _, i) in enumerate(lst)])
        n = len(pos); jj = np.zeros((n, 4), np.int64); jj[:, 0] = head_j; ww = np.zeros((n, 4)); ww[:, 0] = 1
        nrm = np.tile([0., 0., 1.], (n, 1)); return dict(mat=mat, tex=ti, pos=pos.astype(np.float32), nrm=nrm.astype(np.float32), uv=uv.astype(np.float32), jj=jj, ww=ww, ix=ix.reshape(-1))
    return [pack(out_i, 'Iris'), pack(out_s, 'EyeShine')]

def main():
    ap = argparse.ArgumentParser()
    for a in ('glb', 'fbx', 'tex', 'core', 'out'): ap.add_argument('--' + a, required=True)
    ap.add_argument('--faces', type=int, default=100000); ap.add_argument('--levi-pack', default='assets/models.pack'); ap.add_argument('--levi-json', default='data/models.json')
    ap.add_argument('--boy-hair', default=None, help='anime boy GLB: its modelled hair is re-fitted onto the teen head as Hair_BH0 (fringe) and Hair_BH1 (+ back hair)'); ap.add_argument('--hair-M', default='1.35,1.02,1.2'); ap.add_argument('--style-scale', default='SimpleParted=.9,.92,.92;Buns=.78,.9,.9;Long=.84,.95,.9'); ap.add_argument('--hair-off', default='0,0,0.004'); ap.add_argument('--hair-sheet', default=''); ap.add_argument('--hair-picks', default='0,1,2,3,4,5,6,7')
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    # ---------------- teen
    g = GLTF(a.glb); j = g.j; pr = j['meshes'][0]['primitives'][0]; at = pr['attributes']
    P = g.accessor(at['POSITION']).astype(np.float32); UV = g.accessor(at['TEXCOORD_0']).astype(np.float32); J = g.accessor(at['JOINTS_0']).astype(np.uint8); W = g.accessor(at['WEIGHTS_0']).astype(np.float32); F = g.accessor(pr['indices']).reshape(-1, 3).astype(np.uint32)
    print('teen source %d verts / %d tris' % (len(P), len(F)))
    if a.faces < len(F): P, UV, J, W, F = decimate(P, UV, J, W, F, a.faces)
    N = smooth_normals(P.astype(np.float64), F)
    sk = j['skins'][0]; joints = sk['joints']; idx = {n: i for i, n in enumerate(joints)}; par = g.parents()
    names = [NAMES[j['nodes'][n]['name']] for n in joints]; parents = [idx.get(par.get(n), -1) for n in joints]; tidx = {n: i for i, n in enumerate(names)}
    ibm = g.accessor(sk['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
    wp = np.array([np.linalg.inv(m)[:3, 3] for m in ibm]); T = {n: wp[i] for i, n in enumerate(names)}
    bt = j['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']; im = j['images'][j['textures'][bt]['source']]
    base = Image.open(io.BytesIO(g.view_bytes(im['bufferView'])[0])).convert('RGB'); base_np = np.array(base)
    textures = [base.resize((2048, 2048), Image.LANCZOS) if base.width > 2048 else base]; texid = {'teen': 0}
    def add_tex(key, img, size):
        if key in texid: return texid[key]
        if max(img.size) > size: img = img.resize((size, int(img.height * size / img.width)) if img.width >= img.height else (int(img.width * size / img.height), size), Image.LANCZOS)
        textures.append(img.convert('RGB')); texid[key] = len(textures) - 1; return texid[key]
    # classify head triangles: hair shell (brown strands) vs face (skin, eyes, brows)
    C = np.mean([tex_sample(base_np, p) for p in (UV[F].mean(1), .6 * UV[F][:, 0] + .2 * UV[F][:, 1] + .2 * UV[F][:, 2], .2 * UV[F][:, 0] + .6 * UV[F][:, 1] + .2 * UV[F][:, 2], .2 * UV[F][:, 0] + .2 * UV[F][:, 1] + .6 * UV[F][:, 2])], 0)
    head = (P[F][:, :, 1] > FACE_Y).all(1); hair = head & (C[:, 0] < 140) & (C[:, 1] < 90) & (C[:, 2] < 70) & (C[:, 0] > C[:, 1]) & (C[:, 1] >= C[:, 2] * .9)
    cen = P[F].mean(1); blue = head & ~hair & (C[:, 2] > C[:, 0] + 8) & (C[:, 2] > 100)
    ezone = (cen[:, 1] > 1.43) & (cen[:, 1] < 1.53) & (np.abs(cen[:, 0]) < .075) & (cen[:, 2] > .06)
    iris = head & ~hair & ezone & (C[:, 0] - C[:, 2] < 20)                                    # iris/pupil patches (the eyes are painted on a low-poly patch)
    collar = head & ~hair & ~iris & (cen[:, 1] < 1.40) & (C[:, 2] >= C[:, 0] - 4)                                             # remnants of his blue T-shirt collar: dropped
    head &= ~collar
    mzone = (np.abs(cen[:, 0]) < .05) & (cen[:, 1] > 1.37) & (cen[:, 1] < 1.43) & (cen[:, 2] > .07)
    brown = head & ~hair & ~ezone & ~mzone & (cen[:, 1] < 1.46) & ~((C[:, 0] > 196) & (C[:, 1] > 130))       # brown hair-strand texels left on the jaw / sideburn / neck edge
    ref = refine_face(P, F, head & ~hair & ~brown, head); iris = iris & ref; face = ref; hair = head & ~ref & ~brown; modern = ~(head | collar)
    dropped = brown & ~ref
    print('triangles: face %d iris %d hair %d body %d' % (face.sum(), iris.sum(), hair.sum(), modern.sum()))
    eye_ti = add_tex('eye', make_eye_tex(), 128)
    prims = [subset(P, N, UV, J, W, F, face, 'Face', 0), subset(P, N, UV, J, W, F, hair, 'Hair_Messy', 0), subset(P, N, UV, J, W, F, modern, 'Outfit_Modern', 0)]
    prims += eye_prims(P, F, iris, tidx['Bip001 Head'], eye_ti)
    # a smooth skull cap closes the open back of the head and hides the jagged hair-cut edges; it takes the hair colour
    # ---------------- Quaternius reference skeleton (T-pose) + fitters
    Qg = GLTF(os.path.join(a.core, 'Base/Male/Superhero_Male_FullBody.gltf')); qs = Qg.j['skins'][0]; qibm = Qg.accessor(qs['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
    Q = {Qg.j['nodes'][n]['name']: np.linalg.inv(m)[:3, 3] for n, m in zip(qs['joints'], qibm)}
    SS = {kv.split('=')[0]: np.array([float(x) for x in kv.split('=')[1].split(',')]) for kv in a.style_scale.split(';') if '=' in kv}; HC = np.array([0, 1.50, -.01])
    hm = np.diag([float(x) for x in a.hair_M.split(',')]); ho = [float(x) for x in a.hair_off.split(',')]
    FIT = fit_outfit.Fit(Q, T, head_M=hm, head_off=ho)
    # outfits
    for outfit, texname, size in (('Peasant', 'T_Peasant_BaseColor.png', 1024), ('Ranger', 'T_Ranger_BaseColor.png', 1024)):
        ti = add_tex(outfit, Image.open(os.path.join(a.tex, texname)), size)
        for part in fbx_skin.read_parts(os.path.join(a.fbx, 'Male_%s.fbx' % outfit)):
            Pg = np.c_[part['P'][:, 0], part['P'][:, 2], -part['P'][:, 1]]            # FBX Z-up -> Y-up (verified against the glTF joint list)
            P2, infl = FIT.apply(Pg, part['infl']); jj, ww = infl_to_arrays(infl, tidx)
            nm = part['name'].split('.')[0].replace('Male_%s_' % outfit, '').replace('Male_%s' % outfit, 'Full')
            uvc = part['uv'] * [1, -1] + [0, 1]
            prims.append(prim_from_corners(P2, uvc, part['vidx'], part['tris'], jj, ww, 'Outfit_%s_%s' % (outfit, nm.replace('_', '')), ti))
    # hair
    hair_img = None; hair_ti = 0
    for hname in ('Buzzed',):
        hg = GLTF(os.path.join(a.core, 'Hair/Hair_%s.gltf' % hname)); hj = hg.j; hp = hj['meshes'][0]['primitives'][0]; ha = hp['attributes']
        hP = hg.accessor(ha['POSITION']).astype(np.float64); hUV = hg.accessor(ha['TEXCOORD_0']).astype(np.float32); hJ = hg.accessor(ha['JOINTS_0']).astype(int); hW = hg.accessor(ha['WEIGHTS_0']).astype(float); hF = hg.accessor(hp['indices']).reshape(-1, 3)
        qn = [hj['nodes'][n]['name'] for n in hj['skins'][0]['joints']]
        infl = [[(qn[hJ[i, k]], hW[i, k]) for k in range(4) if hW[i, k] > 0] for i in range(len(hP))]
        P2, infl2 = FIT.apply(hP, infl); jj, ww = infl_to_arrays(infl2, tidx)
        if hname in SS: P2 = (P2 - HC) * SS[hname] + HC                            # per-style fit: Quaternius hair is built for adult heads
        bti = hj['materials'][hp['material']]['pbrMetallicRoughness']['baseColorTexture']['index']; uri = hj['images'][hj['textures'][bti]['source']]['uri']
        ti = add_tex('hair:' + os.path.basename(uri), Image.open(os.path.normpath(os.path.join(a.core, 'Hair', uri))), 1024)
        if hair_img is None: hair_img = textures[ti]; hair_ti = ti
        prims.append(dict(mat='Hair_' + hname, tex=ti, pos=P2.astype(np.float32), nrm=smooth_normals(P2, hF.astype(np.int64)), uv=hUV, jj=jj, ww=ww, ix=hF.reshape(-1).astype(np.int64)))
    # ---- five base faces: smooth jaw / cheek / nose changes of his own face shell (zero at the neck cut and away from the eyes so the seam and irises stay put)
    fc = [p for p in prims if p['mat'] == 'Face'][0]
    def fvar(k, jaw_w, chin_dy, chin_dz, cheek, nose_dz, nose_w):
        q = dict(fc); q['mat'] = 'Face_%d' % k; p = fc['pos'].astype(np.float64).copy(); y = p[:, 1]
        low = np.clip((1.435 - y) / .09, 0, 1) ** 1.3 * np.clip((y - 1.312) / .03, 0, 1)             # lower-face weight
        p[:, 0] *= 1 + jaw_w * low + cheek * np.exp(-((y - 1.42) / .04) ** 2) * (np.abs(p[:, 2]) < .2)
        chin = np.exp(-((y - 1.345) / .03) ** 2) * np.exp(-(p[:, 0] / .035) ** 2) * np.clip((y - 1.312) / .02, 0, 1)
        p[:, 1] += chin_dy * chin; p[:, 2] += chin_dz * chin
        nz = np.exp(-((y - 1.435) / .02) ** 2) * np.exp(-(p[:, 0] / .012) ** 2) * (p[:, 2] > .05)
        p[:, 2] += nose_dz * nz; p[:, 0] *= 1 + nose_w * nz
        q['pos'] = p.astype(np.float32); prims.append(q)
    fvar(1, .07, .004, -.002, .02, .003, .15)       # soft / round
    fvar(2, -.10, -.010, .007, -.01, .002, -.1)     # sharp, pointed chin
    fvar(3, .02, .000, .000, .045, -.002, .2)       # broad
    fvar(4, -.03, -.016, .002, -.02, .006, -.05)    # long
    # ---- anime-leaning face skin: smooth the photographic skin but keep the painted brows / lids / lips (edge-preserving), soft cel-like shading steps
    from scipy.ndimage import gaussian_filter, sobel
    b = np.asarray(textures[0], float); sm = np.stack([gaussian_filter(b[..., c], 2.2) for c in range(3)], -1)
    lum = b.mean(-1); gm = np.hypot(sobel(gaussian_filter(lum, 1.0), 0), sobel(gaussian_filter(lum, 1.0), 1)); keep = np.clip(gm / 38., 0, 1)[..., None]
    sk = sm * (1 - keep) + b * keep; L = sk.mean(-1, keepdims=True); q8 = np.round(L / 26.) * 26.; sk = sk + (q8 - L) * .35            # gentle posterise
    sk = np.clip(L + (sk - L) * .96, 0, 255)                                                                                    # slightly cleaner colour
    # forehead above the brows carries painted hair-edge detail in the photo texture: repaint it as plain skin so a bald head (and any short hairline) never shows hair marks
    from PIL import ImageDraw
    fcp = [q for q in prims if q['mat'] == 'Face'][0]; H_, W_ = sk.shape[:2]; mk_ = Image.new('L', (W_, H_), 0); dr = ImageDraw.Draw(mk_); fy = fcp['pos'][:, 1]
    for t_ in fcp['ix'].reshape(-1, 3):
        if fy[t_].mean() > 1.497: dr.polygon([(float(fcp['uv'][i][0] % 1 * W_), float(fcp['uv'][i][1] % 1 * H_)) for i in t_], fill=255)
    am_ = Image.new('L', (W_, H_), 0); da_ = ImageDraw.Draw(am_)
    for t_ in fcp['ix'].reshape(-1, 3):
        if fy[t_].max() < 1.49 and fy[t_].min() > 1.33: da_.polygon([(float(fcp['uv'][i][0] % 1 * W_), float(fcp['uv'][i][1] % 1 * H_)) for i in t_], fill=255)
    hard = (np.asarray(mk_, float) > 127)[..., None]; known = ((np.asarray(am_, float) > 127)[..., None] & ~hard).astype(float)                         # normalised convolution: fill from the surrounding skin so the repaint has no edge
    fillc = (sk * known).reshape(-1, 3).sum(0) / max(known.sum(), 1.)                                           # mean colour of the real face skin
    soft = gaussian_filter(hard[..., 0].astype(float), 2.5)[..., None]; sk = sk * (1 - soft) + fillc * soft
    skc = sk[np.clip((fcp['uv'][:, 1] % 1 * H_).astype(int), 0, H_ - 1), np.clip((fcp['uv'][:, 0] % 1 * W_).astype(int), 0, W_ - 1)].mean(0)
    face_ti = add_tex('face_anime', Image.fromarray(sk.astype(np.uint8)), 2048)
    for p in prims:
        if p['mat'] == 'Face' or p['mat'].startswith('Face_'): p['tex'] = face_ti
    # closed skull + nape: 'Skull' (skin, always on, so no angle ever shows a hole) and 'Scalp' (hair colour, only the crown/back above the hairline, hidden when bald)
    ha = np.asarray(hair_img.convert('L'), float); med = np.median(ha); yy, xx = np.nonzero(np.abs(ha - med) < 4); k = len(yy) // 2
    fu = [fp for fp in prims if fp['mat'] == 'Face'][0]['uv']; fm = np.asarray(textures[face_ti].convert('RGB'), float)
    fpp = [fp for fp in prims if fp['mat'] == 'Face'][0]['pos']; chk = np.nonzero((fpp[:, 1] > 1.38) & (fpp[:, 1] < 1.45) & (np.abs(fpp[:, 0]) < .045) & (fpp[:, 2] > .06))[0]
    cols = tex_sample(fm, fu); medc = cols.mean(0); okc = np.nonzero(fpp[:, 1] > 1.37)[0]; bi = okc[np.argmin(np.abs(cols[okc] - medc).sum(1))]; skin_uv = fu[bi]
    mk = head_shell(prims, tidx['Bip001 Head'], skin_uv)
    prims.append(mk(0, 'Skull', 0., face_ti))
    sc = head_shell(prims, tidx['Bip001 Head'], ((xx[k] + .5) / ha.shape[1], (yy[k] + .5) / ha.shape[0]))(1.468, 'Scalp', .0025, hair_ti); prims.append(sc)

    # ---- clean male hair styles built as thin caps over his own skull shell (same fit, so they can never float or leave a gap): hairline, thickness and lift per style
    sk_p = [q for q in prims if q['mat'] == 'Skull'][0]; hu = sc['uv'][0]
    def hair_cap(mat, fringe, side, back, thick, vol, lift_front=0., part=0., ear=.025):
        P = sk_p['pos'].astype(np.float64).copy(); dx, dz = P[:, 0], P[:, 2] + .012; ph = np.arctan2(dz, dx); al = np.abs(((ph - np.pi / 2) + np.pi) % (2 * np.pi) - np.pi)    # al: angle from the front 0..pi
        sm = lambda t: t * t * (3 - 2 * t); t = sm(np.clip(al / np.pi, 0, 1))
        hl = fringe + (back - fringe) * t + ear * np.exp(-((al - 1.55) / .5) ** 2) + part * np.sin(ph - np.pi / 2) * np.exp(-(al / 1.0) ** 2)      # hairline height per azimuth (ear dip, parting)
        rad = np.stack([dx, dz], 1); rad = rad / (np.linalg.norm(rad, axis=1, keepdims=True) + 1e-9)
        top = np.clip((P[:, 1] - 1.50) / .1, 0, 1); th = thick + vol * top + .004 * np.clip((P[:, 1] - hl) / .02, 0, 1)
        P[:, 0] += rad[:, 0] * th; P[:, 2] += rad[:, 1] * th; P[:, 1] += lift_front * np.exp(-(al / .8) ** 2) * top + vol * .6 * top
        low = P[:, 1] < hl; P[low, 1] = hl[low]                                         # clamp the lower edge onto the hairline (degenerate triangles are dropped below)
        ix = sk_p['ix'].reshape(-1, 3); ok = ~(low[ix].all(1)); ix2 = ix[ok]; keep = np.unique(ix2); rm = -np.ones(len(P), np.int64); rm[keep] = np.arange(len(keep)); P2 = P[keep]
        prims.append(dict(mat=mat, tex=sc['tex'], pos=P2.astype(np.float32), nrm=smooth_normals(P2, rm[ix2]), uv=np.tile(np.asarray(hu, np.float32), (len(keep), 1)), jj=sk_p['jj'][keep], ww=sk_p['ww'][keep], ix=rm[ix2].reshape(-1)))
    # ---- anime hair shells (hair_sheet.py): each is fitted OUTSIDE his head (face shell + skull) so it can never cut through, opening on the face side
    if a.hair_sheet and a.hair_picks:
        from hair_sheet import shells
        from scipy.spatial import cKDTree
        hp = [p_ for p_ in prims if p_['mat'] == 'Skull' or p_['mat'] == 'Face' or p_['mat'].startswith('Face_')]; HP = np.vstack([p_['pos'] for p_ in hp]).astype(np.float64)
        C0 = np.array([0, 1.50, -.012]); HV = HP - C0; HR = np.linalg.norm(HV, axis=1); HD = HV / HR[:, None]
        def outer_r(D):                                                       # outermost head radius along each direction
            tr = cKDTree(HD); k = 12; dist, ii = tr.query(D, k=k); return HR[ii].max(1)
        ramp = Image.fromarray(np.tile((np.linspace(.35, 1., 128) ** .85 * 255).astype(np.uint8)[None, :, None], (4, 1, 3)))
        ramp_ti = add_tex('hair_ramp', ramp, 128)
        picks = [int(x) for x in a.hair_picks.split(',')]; sh = shells(a.hair_sheet)
        for pi_, si in enumerate(picks):
            S_ = sh[si]; Pn = S_['P'].astype(np.float64); Nn = smooth_normals(Pn, S_['F']); Vn = Pn / (np.linalg.norm(Pn, axis=1, keepdims=True) + 1e-9)
            inner = (Nn * Vn).sum(1) < -.25                                   # inner (skull-facing) surface of the shell
            Dn = Pn / np.linalg.norm(Pn, axis=1, keepdims=True); rr = np.linalg.norm(Pn, axis=1); ro = outer_r(Dn)
            ratio = rr[inner] / ro[inner]; s0 = 1.03 / max(np.percentile(ratio, 4), .3); s0 = float(np.clip(s0, .9, 1.35))
            Pf = Pn * s0 + C0 + np.array([0, .006, -.002]); Nf = smooth_normals(Pf, S_['F'])
            lum = S_['lum']; lum = (lum - lum.mean()) / (lum.std() + 1e-6); yy = (Pn[:, 1] - Pn[:, 1].min()) / (np.ptp(Pn[:, 1]) + 1e-9)
            sv = np.clip(.5 + .13 * lum + .30 * (yy - .5) + .12 * np.clip(Nf[:, 1], 0, 1), .02, .98)   # anime shade: lighter crown, darker lower strands, strand variation from the source texture
            jj = np.zeros((len(Pf), 4), np.int64); jj[:, 0] = tidx['Bip001 Head']; ww = np.zeros((len(Pf), 4)); ww[:, 0] = 1
            prims.append(dict(mat='Hair_AH%d' % pi_, tex=ramp_ti, pos=Pf.astype(np.float32), nrm=Nf, uv=np.stack([sv, np.full(len(sv), .5)], 1).astype(np.float32), jj=jj, ww=ww, ix=S_['F'].reshape(-1)))
            print('anime hair', si, '->', 'Hair_AH%d' % pi_, 'scale %.3f' % s0, len(Pf), 'verts', len(S_['F']), 'tris')
    if a.boy_hair:                                                              # the VRoid hair of the anime boy, scaled onto the teen head (modelled fringe + back hair, no hollow shells)
        bg = GLTF(a.boy_hair); bj = bg.j; hidx = tidx['Bip001 Head']; sc = .915; src0 = np.array([0, 1.604, .015]); dst0 = np.array([0, 1.356, .016])
        for me in bj['meshes']:
            for pr in me['primitives']:
                mn = bj['materials'][pr['material']]['name']; front = 'Hair_00_HAIR' in mn; back = 'HairBack' in mn
                if not (front or back): continue
                at = pr['attributes']; bh_P = bg.accessor(at['POSITION']).astype(np.float64); bh_F = bg.accessor(pr['indices']).astype(np.int64).reshape(-1, 3); bh_UV = bg.accessor(at['TEXCOORD_0']).astype(np.float32)
                bh_P2 = ((bh_P - src0) * sc + dst0); bh_P2[:, 0] *= 1.03; bh_P2[:, 2] *= 1.03
                bh_Nn = np.zeros_like(bh_P2); bh_fn = np.cross(bh_P2[bh_F[:, 1]] - bh_P2[bh_F[:, 0]], bh_P2[bh_F[:, 2]] - bh_P2[bh_F[:, 0]])
                for bh_kk in range(3): np.add.at(bh_Nn, bh_F[:, bh_kk], bh_fn)
                bh_Nn = (bh_Nn / (np.linalg.norm(bh_Nn, axis=1, keepdims=True) + 1e-12)).astype(np.float32)
                bh_im, = [Image.open(io.BytesIO(bg.view_bytes(bj['images'][bj['textures'][bj['materials'][pr['material']]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]['bufferView'])[0]))]
                bh_ti = add_tex('boyhair_' + ('b' if back else 'f'), bh_im, 512); bh_jj = np.zeros((len(bh_P2), 4), np.int64); bh_ww = np.zeros((len(bh_P2), 4)); bh_ww[:, 0] = 1; bh_jj[:, 0] = hidx
                for nm in (['Hair_BH0', 'Hair_BH1'] if front else ['Hair_BH1Back']):
                    prims.append(dict(mat=nm, tex=bh_ti, pos=bh_P2.astype(np.float32), nrm=bh_Nn, uv=bh_UV, jj=bh_jj, ww=bh_ww, ix=bh_F.reshape(-1))); print('boy hair', nm, len(bh_P2), 'verts')
    # ---------------- Levi's ODM gear, re-fitted
    mj = json.load(open(a.levi_json))['models']['levi']; lm = mj['meta']; pk = read_pack(a.levi_pack); lb = zlib.decompress(pk['levi.bin']); LJ = lm['joints']
    lib = np.frombuffer(lb, '<f4', LJ * 16, lm['ibmOff']).reshape(LJ, 4, 4); lnames = [n.rsplit('_', 1)[0] if n.rsplit('_', 1)[-1].isdigit() else n for n in lm['names']]
    lpos = {n: np.linalg.inv(lib[i].T)[:3, 3] for i, n in enumerate(lnames)}
    role = {'pelvis': 'Pelvis', 'neck_01': 'Neck', 'Head': 'Head', 'upperarm_l': 'L UpperArm', 'lowerarm_l': 'L Forearm', 'hand_l': 'L Hand', 'upperarm_r': 'R UpperArm', 'lowerarm_r': 'R Forearm', 'hand_r': 'R Hand',
            'thigh_l': 'L Thigh', 'calf_l': 'L Calf', 'foot_l': 'L Foot', 'ball_l': 'L Toe0', 'thigh_r': 'R Thigh', 'calf_r': 'R Calf', 'foot_r': 'R Foot', 'ball_r': 'R Toe0', 'spine_01': 'Spine', 'spine_02': 'Spine1', 'spine_03': 'Spine2', 'clavicle_l': 'L Clavicle', 'clavicle_r': 'R Clavicle'}
    LQ = {k: lpos['Bip001 ' + v] for k, v in role.items()}; LF = fit_outfit.Fit(LQ, T)
    lpar = lm['parents']
    def lmap(i):
        while i >= 0:
            if lnames[i] in tidx: return lnames[i]
            i = lpar[i]
        return 'Bip001 Pelvis'
    name2t = {lnames[i]: lmap(i) for i in range(LJ)}
    for pi_, gname, size in ((2, 'Gear_ODM', 1024), (3, 'Gear_SwordL', 1024), (4, 'Gear_SwordR', 1024), (5, 'Outfit_Scout_Body', 1024), (6, 'Outfit_Scout_Boots', 1024), (9, 'Outfit_Scout_Hands', 1024), (0, 'Outfit_Scout_Cloak', 1024)):
        p = lm['prims'][pi_]; n = p['n']; o = p['o']
        gP = np.frombuffer(lb, '<f4', n * 3, o[0]).reshape(-1, 3).astype(np.float64); gUV = np.frombuffer(lb, '<f4', n * 2, o[2]).reshape(-1, 2).astype(np.float32)
        gJ = np.frombuffer(lb, 'u1', n * 4, o[3]).reshape(-1, 4); gW = np.frombuffer(lb, 'u1', n * 4, o[4]).reshape(-1, 4) / 255.
        gF = np.frombuffer(lb, '<u4' if n >= 65536 else '<u2', p['ni'], o[5]).reshape(-1, 3).astype(np.int64)
        infl = [[(lnames[gJ[i, k]], gW[i, k]) for k in range(4) if gW[i, k] > 0] for i in range(n)]
        P2, infl2 = LF.apply(gP, infl, mapper=lambda q: name2t.get(q, 'Bip001 Pelvis')); jj, ww = infl_to_arrays(infl2, tidx)
        ti = add_tex('levi_t%d' % p['tex'], Image.open(io.BytesIO(pk['levi.t%d' % p['tex']])), size)
        prims.append(dict(mat=gname, tex=ti, pos=P2.astype(np.float32), nrm=smooth_normals(P2, gF), uv=gUV, jj=jj, ww=ww, ix=gF.reshape(-1)))
    if os.environ.get('AOTW_DUMP'): np.savez(os.environ['AOTW_DUMP'], **{'%s|pos' % p['mat']: p['pos'] for p in prims}, **{'%s|ix' % p['mat']: p['ix'] for p in prims})
    # ---------------- write
    meta, info, binz, texb = write_model(a.out, 'teen', names, parents, wp, prims, textures)
    info['bodyHeight'] = float(P[:, 1].max() - P[:, 1].min()); info['height'] = info['bodyHeight']; info['ymin'] = float(P[:, 1].min()); info['bodyYmin'] = info['ymin']
    open(os.path.join(a.out, 'teen.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(a.out, 'teen.meta.json'), 'w'), separators=(',', ':'))
    for i, b in enumerate(texb): open(os.path.join(a.out, 'teen.t%d.webp' % i), 'wb').write(b)
    for f in glob.glob(os.path.join(a.out, 'teen.t*.webp')):
        if int(os.path.basename(f)[6:-5]) >= len(texb): os.remove(f)
    groups = {'face': ['Face', 'Face_1', 'Face_2', 'Face_3', 'Face_4', 'Iris', 'EyeShine', 'Scalp', 'Skull'], 'hair': [m['mat'] for m in meta['prims'] if m['mat'].startswith('Hair_')], 'gear': [m['mat'] for m in meta['prims'] if m['mat'].startswith('Gear_')],
              'outfits': {o: [m['mat'] for m in meta['prims'] if m['mat'].startswith('Outfit_' + o)] for o in ('Modern', 'Peasant', 'Ranger', 'Scout')}}
    info['groups'] = groups; info['prim_stats'] = {m['mat']: [m['n'], m['ni'] // 3] for m in meta['prims']}; info['textures'] = texid
    info['pelvis'] = T['Bip001 Pelvis'].tolist(); info['head'] = T['Bip001 Head'].tolist()
    json.dump(info, open(os.path.join(a.out, 'teen.info.json'), 'w'), indent=1)
    json.dump({'models': ['teen']}, open(os.path.join(a.out, 'characters.json'), 'w'))
    print(json.dumps(info['prim_stats'], indent=0)); print('bin %d KB, %d textures (%s KB)' % (info['bin_kb'], len(texb), [len(t) // 1024 for t in texb]))
if __name__ == '__main__': main()

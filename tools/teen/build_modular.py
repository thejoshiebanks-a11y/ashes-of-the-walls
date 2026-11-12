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

def main():
    ap = argparse.ArgumentParser()
    for a in ('glb', 'fbx', 'tex', 'core', 'out'): ap.add_argument('--' + a, required=True)
    ap.add_argument('--faces', type=int, default=100000); ap.add_argument('--levi-pack', default='assets/models.pack'); ap.add_argument('--levi-json', default='data/models.json')
    ap.add_argument('--hair-M', default='1.35,1.02,1.2'); ap.add_argument('--hair-off', default='0,0,0.004')
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
    ref = refine_face(P, F, head & ~hair & ~brown, head); iris = iris & ref; face = ref & ~iris; hair = head & ~ref & ~brown; modern = ~(head | collar)
    dropped = brown & ~ref
    print('triangles: face %d iris %d hair %d body %d' % (face.sum(), iris.sum(), hair.sum(), modern.sum()))
    prims = [subset(P, N, UV, J, W, F, face, 'Face', 0), subset(P, N, UV, J, W, F, iris, 'Iris', 0), subset(P, N, UV, J, W, F, hair, 'Hair_Messy', 0), subset(P, N, UV, J, W, F, modern, 'Outfit_Modern', 0)]
    # a smooth skull cap closes the open back of the head and hides the jagged hair-cut edges; it takes the hair colour
    # ---------------- Quaternius reference skeleton (T-pose) + fitters
    Qg = GLTF(os.path.join(a.core, 'Base/Male/Superhero_Male_FullBody.gltf')); qs = Qg.j['skins'][0]; qibm = Qg.accessor(qs['inverseBindMatrices']).astype(np.float64).reshape(-1, 4, 4).transpose(0, 2, 1)
    Q = {Qg.j['nodes'][n]['name']: np.linalg.inv(m)[:3, 3] for n, m in zip(qs['joints'], qibm)}
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
    for hname in ('SimpleParted', 'Buzzed', 'BuzzedFemale', 'Long', 'Buns'):
        hg = GLTF(os.path.join(a.core, 'Hair/Hair_%s.gltf' % hname)); hj = hg.j; hp = hj['meshes'][0]['primitives'][0]; ha = hp['attributes']
        hP = hg.accessor(ha['POSITION']).astype(np.float64); hUV = hg.accessor(ha['TEXCOORD_0']).astype(np.float32); hJ = hg.accessor(ha['JOINTS_0']).astype(int); hW = hg.accessor(ha['WEIGHTS_0']).astype(float); hF = hg.accessor(hp['indices']).reshape(-1, 3)
        qn = [hj['nodes'][n]['name'] for n in hj['skins'][0]['joints']]
        infl = [[(qn[hJ[i, k]], hW[i, k]) for k in range(4) if hW[i, k] > 0] for i in range(len(hP))]
        P2, infl2 = FIT.apply(hP, infl); jj, ww = infl_to_arrays(infl2, tidx)
        bti = hj['materials'][hp['material']]['pbrMetallicRoughness']['baseColorTexture']['index']; uri = hj['images'][hj['textures'][bti]['source']]['uri']
        ti = add_tex('hair:' + os.path.basename(uri), Image.open(os.path.normpath(os.path.join(a.core, 'Hair', uri))), 1024)
        if hair_img is None: hair_img = textures[ti]; hair_ti = ti
        prims.append(dict(mat='Hair_' + hname, tex=ti, pos=P2.astype(np.float32), nrm=smooth_normals(P2, hF.astype(np.int64)), uv=hUV, jj=jj, ww=ww, ix=hF.reshape(-1).astype(np.int64)))
    # the scalp cap shares the hair texture (a median-brightness texel) so it takes the hair colour exactly like the hair styles
    ha = np.asarray(hair_img.convert('L'), float); med = np.median(ha); yy, xx = np.nonzero(np.abs(ha - med) < 4); k = len(yy) // 2
    cap = skull_cap(tidx['Bip001 Head'], ((xx[k] + .5) / ha.shape[1], (yy[k] + .5) / ha.shape[0])); cap['tex'] = hair_ti; prims.append(cap)
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
    # ---------------- write
    meta, info, binz, texb = write_model(a.out, 'teen', names, parents, wp, prims, textures)
    info['bodyHeight'] = float(P[:, 1].max() - P[:, 1].min()); info['height'] = info['bodyHeight']; info['ymin'] = float(P[:, 1].min()); info['bodyYmin'] = info['ymin']
    open(os.path.join(a.out, 'teen.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(a.out, 'teen.meta.json'), 'w'), separators=(',', ':'))
    for i, b in enumerate(texb): open(os.path.join(a.out, 'teen.t%d.webp' % i), 'wb').write(b)
    for f in glob.glob(os.path.join(a.out, 'teen.t*.webp')):
        if int(os.path.basename(f)[6:-5]) >= len(texb): os.remove(f)
    groups = {'face': ['Face', 'Iris', 'Scalp'], 'hair': [m['mat'] for m in meta['prims'] if m['mat'].startswith('Hair_')], 'gear': [m['mat'] for m in meta['prims'] if m['mat'].startswith('Gear_')],
              'outfits': {o: [m['mat'] for m in meta['prims'] if m['mat'].startswith('Outfit_' + o)] for o in ('Modern', 'Peasant', 'Ranger', 'Scout')}}
    info['groups'] = groups; info['prim_stats'] = {m['mat']: [m['n'], m['ni'] // 3] for m in meta['prims']}; info['textures'] = texid
    info['pelvis'] = T['Bip001 Pelvis'].tolist(); info['head'] = T['Bip001 Head'].tolist()
    json.dump(info, open(os.path.join(a.out, 'teen.info.json'), 'w'), indent=1)
    json.dump({'models': ['teen']}, open(os.path.join(a.out, 'characters.json'), 'w'))
    print(json.dumps(info['prim_stats'], indent=0)); print('bin %d KB, %d textures (%s KB)' % (info['bin_kb'], len(texb), [len(t) // 1024 for t in texb]))
if __name__ == '__main__': main()

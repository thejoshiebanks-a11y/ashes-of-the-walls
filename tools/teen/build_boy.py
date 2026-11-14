"""Second character base: the VRoid-style anime boy (anime_character_model_-_boy.glb, 158 Mixamo-named joints) converted to the engine's
24-joint Bip001 skeleton so every animation, the creator tints and the outfit system work on him exactly like on the teen.
  python3 tools/teen/build_boy.py --glb anime_character_model_-_boy.glb --out assets/boy
Joints: every weight on a joint that is not one of the 24 is moved to its nearest kept ancestor (fingers -> Hand, hair/cloth bones -> Head/Spine...).
The cat ears (and hood strings) are dropped. Texture size is capped so the whole base stays small."""
import argparse, io, json, os, re, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from gltf_reader import GLTF
from engine_model import write_model

KEEP = ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'Spine', 'Spine1', 'Spine2',
        'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'Neck', 'Head', 'HeadTop_End', 'HeadFront', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']
OUT = ['Bip001 Pelvis', 'Bip001 L Thigh', 'Bip001 L Calf', 'Bip001 L Foot', 'Bip001 L Toe0', 'Bip001 R Thigh', 'Bip001 R Calf', 'Bip001 R Foot', 'Bip001 R Toe0', 'Bip001 Spine', 'Bip001 Spine1', 'Bip001 Spine2',
       'Bip001 L Clavicle', 'Bip001 L UpperArm', 'Bip001 L Forearm', 'Bip001 L Hand', 'Bip001 Neck', 'Bip001 Head', 'Bip001 HeadNub', 'Bip001 HeadFront', 'Bip001 R Clavicle', 'Bip001 R UpperArm', 'Bip001 R Forearm', 'Bip001 R Hand']
PARENTS = [-1, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 12, 13, 14, 11, 16, 17, 17, 11, 20, 21, 22]
MATS = {'Body_00_SKIN': 'Skin_Body', 'Face_00_SKIN': 'Skin_Face', 'EyeWhite': 'EyeWhite', 'EyeIris': 'Iris', 'EyeHighlight': 'EyeHL', 'FaceBrow': 'Brow', 'FaceEyeline': 'Eyeline', 'FaceMouth': 'Mouth',
        'Hair_00_HAIR': 'Hair_B0', 'HairBack': 'Hair_B0Back', 'Tops': 'Outfit_Modern_Tops', 'Bottoms': 'Outfit_Modern_Bottoms', 'Shoes': 'Outfit_Modern_Shoes', 'Onepiece': 'Outfit_Modern_Collar'}
DROP = ('CatEar',)

def base(n): return re.sub(r'_\d+$', '', n.split(':')[-1])

def smooth_normals(P, F):
    N = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(N, F[:, k], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def transfer(teen_dir, wp, prims, textures):
    """Re-fit the teen's Peasant / Ranger / Scout outfits and ODM gear onto the boy's (T-pose, taller) skeleton with the same bone-frame fit the outfits
    were originally made with (fit_outfit.Fit): limbs get shortest-arc rotations + length ratios, the torso an anisotropic warp."""
    import zlib
    from fit_outfit import Fit
    meta = json.load(open(os.path.join(teen_dir, 'teen.meta.json'))); raw = zlib.decompress(open(os.path.join(teen_dir, 'teen.bin'), 'rb').read())
    ib = np.frombuffer(raw, '<f4', 24 * 16, meta['ibmOff']).reshape(24, 16); tw = -ib[:, 12:15].astype(np.float64); names = meta['names']
    T = {n: tw[i] for i, n in enumerate(names)}; B = {n: wp[i] for i, n in enumerate(OUT)}
    Q = {'pelvis': 'Pelvis', 'neck_01': 'Neck', 'Head': 'Head', 'upperarm_l': 'L UpperArm', 'lowerarm_l': 'L Forearm', 'hand_l': 'L Hand', 'upperarm_r': 'R UpperArm', 'lowerarm_r': 'R Forearm', 'hand_r': 'R Hand',
         'thigh_l': 'L Thigh', 'calf_l': 'L Calf', 'foot_l': 'L Foot', 'ball_l': 'L Toe0', 'thigh_r': 'R Thigh', 'calf_r': 'R Calf', 'foot_r': 'R Foot', 'ball_r': 'R Toe0'}
    fit = Fit({q: T['Bip001 ' + t] for q, t in Q.items()}, B, head_M=np.eye(3) * 1.08)
    fit.sx = (B['Bip001 L UpperArm'][0] - B['Bip001 R UpperArm'][0]) / (T['Bip001 L UpperArm'][0] - T['Bip001 R UpperArm'][0]) * 1.04
    fit.sy = (B['Bip001 Neck'][1] - B['Bip001 Pelvis'][1]) / (T['Bip001 Neck'][1] - T['Bip001 Pelvis'][1]); fit.sz = 1.0
    fit.q0 = T['Bip001 Pelvis']; fit.t0 = B['Bip001 Pelvis']
    tex_ids = {}
    for p in meta['prims']:
        if not (p['mat'].startswith('Outfit_') and not p['mat'].startswith('Outfit_Modern')) and not p['mat'].startswith('Gear_'): continue
        n = p['n']; o = p['o']
        P = np.frombuffer(raw, '<f4', n * 3, o[0]).reshape(-1, 3).astype(np.float64); UV = np.frombuffer(raw, '<f4', n * 2, o[2]).reshape(-1, 2).astype(np.float32)
        J = np.frombuffer(raw, 'u1', n * 4, o[3]).reshape(-1, 4); W = np.frombuffer(raw, 'u1', n * 4, o[4]).reshape(-1, 4) / 255.
        F = np.frombuffer(raw, '<u4' if n >= 65536 else '<u2', p['ni'], o[5]).astype(np.int64).reshape(-1, 3)
        infl = [[(names[J[i, k]], W[i, k]) for k in range(4) if W[i, k] > 0] for i in range(n)]
        P2, infl2 = fit.apply(P, infl, mapper=lambda q: q)
        jj = np.zeros((n, 4), np.int64); ww = np.zeros((n, 4))
        for i, lst in enumerate(infl2):
            for k, (t, w) in enumerate(lst[:4]): jj[i, k] = OUT.index(t); ww[i, k] = w
        ti = p.get('tex')
        if ti is not None:
            if ti not in tex_ids: textures.append(Image.open(os.path.join(teen_dir, 'teen.t%d.webp' % ti)).convert('RGBA')); tex_ids[ti] = len(textures) - 1
            ti = tex_ids[ti]
        prims.append(dict(mat=p['mat'], tex=ti, pos=P2.astype(np.float32), nrm=smooth_normals(P2, F).astype(np.float32), uv=UV, jj=jj, ww=ww, ix=F.reshape(-1)))
        print('re-fitted', p['mat'], n)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--glb', required=True); ap.add_argument('--out', default='assets/boy'); ap.add_argument('--tex', type=int, default=512); ap.add_argument('--teen', default=None, help='built teen model folder: its outfits/gear are re-fitted onto the boy'); a = ap.parse_args()
    g = GLTF(a.glb); j = g.j; par = g.parents(); sk = j['skins'][0]; jn = sk['joints']
    ib = g.accessor(sk['inverseBindMatrices']).reshape(-1, 4, 4); P0 = np.array([np.linalg.inv(m.T)[:3, 3] for m in ib])
    jname = [base(j['nodes'][n]['name']) for n in jn]; node2i = {n: i for i, n in enumerate(jn)}
    first = {}
    for i, n in enumerate(jname): first.setdefault(n, i)
    # 158 skin joints -> index (0..23) of the nearest kept ancestor
    def kept_of(skin_i):
        n = jn[skin_i]
        while True:
            b = base(j['nodes'][n]['name'])
            if b in KEEP: return KEEP.index(b)
            if n not in par: return 0
            n = par[n]
    remap = np.array([kept_of(i) for i in range(len(jn))])
    wp = np.zeros((24, 3))
    for k, nm in enumerate(KEEP):
        if nm in first: wp[k] = P0[first[nm]]
    wp[KEEP.index('HeadTop_End')] = wp[KEEP.index('Head')] + [0, .24, .02]; wp[KEEP.index('HeadFront')] = wp[KEEP.index('Head')] + [0, 0, .10]
    print('skeleton', {OUT[i]: wp[i].round(3).tolist() for i in (0, 1, 3, 13, 17)})
    textures, tmap = [], {}
    def tex_of(mi):
        m = j['materials'][mi]; bc = m['pbrMetallicRoughness'].get('baseColorTexture')
        if not bc: return None
        src = j['textures'][bc['index']]['source']
        if src in tmap: return tmap[src]
        data, _ = g.view_bytes(j['images'][src]['bufferView']); im = Image.open(io.BytesIO(data)).convert('RGBA')
        if max(im.size) > a.tex: s = a.tex / max(im.size); im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        textures.append(im); tmap[src] = len(textures) - 1; return tmap[src]
    prims = []
    for mesh in j['meshes']:
        for pr in mesh['primitives']:
            mname = j['materials'][pr['material']]['name']
            if any(d in mname for d in DROP): print('drop', mname); continue
            key = next((v for k, v in MATS.items() if k in mname), None)
            if key is None: print('skip', mname); continue
            at = pr['attributes']; P = g.accessor(at['POSITION']).astype(np.float64); F = g.accessor(pr['indices']).astype(np.int64).reshape(-1, 3)
            UV = g.accessor(at['TEXCOORD_0']).astype(np.float32); J4 = g.accessor(at['JOINTS_0']).astype(np.int64); W4 = g.accessor(at['WEIGHTS_0']).astype(np.float64)
            N = g.accessor(at['NORMAL']).astype(np.float64) if 'NORMAL' in at else smooth_normals(P, F)
            jj = np.zeros((len(P), 4), np.int64); ww = np.zeros((len(P), 4))
            for v in range(len(P)):
                acc = {}
                for k in range(4):
                    if W4[v, k] > 0: t = int(remap[J4[v, k]]); acc[t] = acc.get(t, 0) + W4[v, k]
                for k, (t, w) in enumerate(sorted(acc.items(), key=lambda x: -x[1])[:4]): jj[v, k] = t; ww[v, k] = w
            prims.append(dict(mat=key, tex=tex_of(pr['material']), pos=P.astype(np.float32), nrm=N.astype(np.float32), uv=UV, jj=jj, ww=ww, ix=F.reshape(-1)))
            print(key, len(P), 'verts', len(F), 'tris', 'tex', prims[-1]['tex'])
    if a.teen: transfer(a.teen, wp, prims, textures)
    os.makedirs(a.out, exist_ok=True)
    meta, info, binz, texb = write_model(a.out, 'boy', OUT, PARENTS, wp, prims, textures)
    open(os.path.join(a.out, 'boy.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(a.out, 'boy.meta.json'), 'w'), separators=(',', ':'))
    for i, b in enumerate(texb): open(os.path.join(a.out, 'boy.t%d.webp' % i), 'wb').write(b)
    info['pelvis'] = wp[0].tolist(); info['head'] = wp[17].tolist()
    info['groups'] = {'face': ['Skin_Face', 'EyeWhite', 'Iris', 'EyeHL', 'Brow', 'Eyeline', 'Mouth'], 'hair': ['Hair_B0', 'Hair_B0Back'], 'gear': [m['mat'] for m in meta['prims'] if m['mat'].startswith('Gear_')], 'outfits': {o: [m['mat'] for m in meta['prims'] if m['mat'].startswith('Outfit_' + o)] for o in ('Modern', 'Peasant', 'Ranger', 'Scout')}}
    info['prim_stats'] = {m['mat']: [m['n'], m['ni'] // 3] for m in meta['prims']}
    json.dump(info, open(os.path.join(a.out, 'boy.info.json'), 'w'), indent=1)
    print('bin %d KB, %d textures (%s KB), bodyHeight %.3f' % (info['bin_kb'], len(texb), [len(t) // 1024 for t in texb], info['bodyHeight']))
if __name__ == '__main__': main()

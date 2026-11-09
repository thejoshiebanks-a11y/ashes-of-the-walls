"""Build the creator mannequin: the uploaded human body mesh, auto-skinned to the canonical Bip001 skeleton (taken from the AoTWA
rig, which the game's animation system already drives). Output: out/mannequin.{bin,meta.json,info.json,t0.webp}"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
import xps as XPS
from preview import glb_parts
from engine_model import write_model

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = re.compile(r'^Bip001 (Pelvis|Spine|Spine1|Spine2|Neck|Head|[LR] (Clavicle|UpperArm|Forearm|Hand|Finger[0-4][12]?|Thigh|Calf|Foot|Toe0))$')

def canonical_skeleton():
    x = XPS.read_xps(os.path.join(SP, 'ex_church/AoTWA - Furlan Church/xps.xps')); B = x['bones']
    keep = [i for i, b in enumerate(B) if KEEP.match(b[0])]
    idx = {i: n for n, i in enumerate(keep)}; names = []; par = []; pos = []
    for i in keep:
        a = B[i][1]
        while a >= 0 and a not in idx: a = B[a][1]
        names.append(B[i][0]); par.append(idx[a] if a >= 0 else -1); pos.append(B[i][2])
    return names, par, np.array(pos, np.float64)

def rot_about(v, c, axis, ang):
    k = axis / np.linalg.norm(axis); d = v - c; ca, sa = np.cos(ang), np.sin(ang)
    return c + d * ca + np.cross(k, d) * sa + k * (k @ d) * (1 - ca)

def clay_texture(S=512):
    """Warm ivory clay with soft low-frequency mottling: reads as a sculpted mannequin under the stage lights (the source texture is an atlas, not skin)."""
    rng = np.random.default_rng(7); base = np.array([212, 205, 194], np.float64)
    lo = np.kron(rng.normal(0, 1, (16, 16)), np.ones((S // 16, S // 16))); from scipy.ndimage import gaussian_filter
    lo = gaussian_filter(lo, S / 24); hi = gaussian_filter(rng.normal(0, 1, (S, S)), 0.8)
    img = base[None, None, :] + (lo * 5 + hi * 2.2)[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')

def build(out):
    names, par, jp = canonical_skeleton(); J = len(names); nid = {n: i for i, n in enumerate(names)}
    part = glb_parts(os.path.join(SP, 'models/body.glb'))[0]; P = part['P'].copy(); H0 = P[:, 1].max() - P[:, 1].min()
    P[:, 1] -= P[:, 1].min()
    # normals: recompute from the surface
    F = part['F']; N = np.zeros_like(P); fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    for k in range(3): np.add.at(N, F[:, k], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    # 1. scale the skeleton to the mesh height, keep it centred on x=0
    head_top = 1.836; s = H0 / head_top; jp = jp * s
    # 2. the mesh is in an A-pose, the rig in a T-pose: swing each arm chain about its shoulder to match the mesh arm
    for side, sg in (('L', 1), ('R', -1)):
        sh = jp[nid['Bip001 %s UpperArm' % side]].copy(); hand = jp[nid['Bip001 %s Hand' % side]]
        m = (P[:, 0] * sg > sh[0] * sg + .12) & (P[:, 1] < sh[1] + .05)           # arm vertices
        far = P[m]; far = far[np.argsort(-far[:, 0] * sg)[:max(30, len(far) // 60)]]; tip = far.mean(0)   # outermost = fingertips
        d_t = tip - sh; d_t /= np.linalg.norm(d_t); d_r = hand - sh; d_r /= np.linalg.norm(d_r)
        ang = (np.arctan2(d_t[1], d_t[0] * sg) - np.arctan2(d_r[1], d_r[0] * sg)) * sg      # swing in the xy plane
        chain = [i for i in range(J) if re.match(r'Bip001 %s (UpperArm|Forearm|Hand|Finger)' % side, names[i])]
        for i in chain: jp[i] = rot_about(jp[i], sh, np.array([0, 0, 1.0]), ang)
    # 3. auto-weights: distance to bone segments, top 4, smoothed over the mesh
    segs = []
    for i in range(J):
        if par[i] < 0: continue
        segs.append((par[i], jp[par[i]], jp[i]))     # segment belongs to the parent bone
    leafs = [i for i in range(J) if i not in set(par)]
    for i in leafs:
        d = jp[i] - jp[par[i]]; segs.append((i, jp[i], jp[i] + d * .4))
    W = np.zeros((len(P), J))
    def segd(p, a, b):
        ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab + 1e-12), 0, 1); return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)
    D = np.stack([segd(P, a, b) for _, a, b in segs], 1)
    owner = np.array([o for o, _, _ in segs])
    for v in range(len(P)):
        d = D[v]; order = np.argsort(d)[:8]; best = d[order[0]]; acc = {}
        for k in order:
            if d[k] > best * 1.9 + .01: continue
            acc[owner[k]] = max(acc.get(owner[k], 0), 1.0 / (d[k] + .012) ** 3)
        for o, w in acc.items(): W[v, o] = w
    W /= W.sum(1, keepdims=True)
    # laplacian smoothing through mesh edges
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
    from scipy.sparse import coo_matrix
    A = coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(P), len(P))).tocsr(); A.data[:] = 1; deg = np.asarray(A.sum(1)).ravel()
    for _ in range(4): W = .5 * W + .5 * (A @ W) / np.maximum(deg, 1)[:, None]
    top = np.argsort(-W, 1)[:, :4]; jj = top.astype(np.int64); ww = np.take_along_axis(W, top, 1)
    from PIL import Image
    prim = dict(mat='mannequin', tex=0, pos=P, nrm=N, uv=part['UV'], jj=jj, ww=ww, ix=F.reshape(-1))
    meta, info, binz, texb = write_model(out, 'mannequin', names, par, jp, [prim], [clay_texture()])
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'mannequin.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(out, 'mannequin.meta.json'), 'w'), separators=(',', ':'))
    json.dump(info, open(os.path.join(out, 'mannequin.info.json'), 'w'))
    for i, t in enumerate(texb): open(os.path.join(out, 'mannequin.t%d.webp' % i), 'wb').write(t)
    np.save(os.path.join(out, 'mannequin_joints.npy'), jp)
    print(info); return names, jp, P

if __name__ == '__main__': build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(SP, 'out'))

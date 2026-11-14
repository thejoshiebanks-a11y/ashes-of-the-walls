"""Anime hair sheet ('anime hair-02' by paintoheaven, CC-BY-4.0): one glTF holding 8 separate hair shells (~65-77k vertices each).
Each shell is welded (the AI mesh is UV-fragmented), decimated, re-oriented (opening faces +Z, up +Y) and returned with a per-vertex shade value.
Returns a list of dict(P, F, shade) in the shell's own centred frame, ready to be fitted to a head."""
import os, sys, numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from gltf_reader import GLTF
from build_teen import decimate

def _load(path):
    g = GLTF(path); j = g.j; nodes = j['nodes']; par = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []): par[c] = i
    def world(i):
        M = g.node_local(i); return world(par[i]) @ M if i in par else M
    P, U, F, off = [], [], [], 0
    for i, n in enumerate(nodes):
        if 'mesh' not in n: continue
        W = world(i)
        for pr in j['meshes'][n['mesh']]['primitives']:
            p = g.accessor(pr['attributes']['POSITION']).astype(float); uv = g.accessor(pr['attributes']['TEXCOORD_0']).astype(float); ix = g.accessor(pr['indices']).reshape(-1, 3).astype(np.int64)
            P.append((W[:3, :3] @ p.T).T + W[:3, 3]); U.append(uv); F.append(ix + off); off += len(p)
    tex = j['images'][0]['uri'] if 'uri' in j['images'][0] else None
    img = Image.open(os.path.join(os.path.dirname(path), tex.replace('%20', ' '))).convert('L')
    return np.vstack(P), np.vstack(U), np.vstack(F), np.asarray(img, float) / 255

def shells(path, target=5000):
    P, U, F, tex = _load(path); th, tw = tex.shape
    lum = tex[np.clip(((1 - U[:, 1]) % 1 * th).astype(int), 0, th - 1), np.clip((U[:, 0] % 1 * tw).astype(int), 0, tw - 1)]
    key = np.round(P * 40000).astype(np.int64); _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.reshape(-1)
    Pw = P[first]; lw = np.zeros(len(first)); np.add.at(lw, inv, lum); lw /= np.bincount(inv); Fw = inv[F]; Fw = Fw[(Fw[:, 0] != Fw[:, 1]) & (Fw[:, 1] != Fw[:, 2]) & (Fw[:, 0] != Fw[:, 2])]
    E = np.vstack([Fw[:, [0, 1]], Fw[:, [1, 2]]]); n = len(Pw); nc, lab = connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)), directed=False)
    cnt = np.bincount(lab); big = [c for c in np.argsort(-cnt) if cnt[c] > 5000]
    out = []
    for c in sorted(big, key=lambda c: (round(Pw[lab == c][:, 2].mean(), 2), Pw[lab == c][:, 1].mean())):          # stable order: sheet rows then columns
        vi = np.nonzero(lab == c)[0]; rm = -np.ones(n, np.int64); rm[vi] = np.arange(len(vi)); Fi = rm[Fw[(lab[Fw] == c).all(1)]]
        p = Pw[vi]; uv = np.stack([lw[vi], np.zeros(len(vi))], 1).astype(np.float32); J = np.zeros((len(vi), 4), np.uint8); W = np.zeros((len(vi), 4), np.float32); W[:, 0] = 1
        P2, UV2, _, _, F2 = decimate(p.astype(np.float32), uv, J, W, Fi.astype(np.uint32), target)
        ctr = (P2.min(0) + P2.max(0)) / 2; P2 = P2 - ctr
        R = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)                                                       # sheet: up +z, opening toward -y  ->  up +Y, opening toward +Z
        out.append(dict(P=(P2 @ R.T), F=F2.reshape(-1, 3), lum=UV2[:, 0].copy()))
    return out

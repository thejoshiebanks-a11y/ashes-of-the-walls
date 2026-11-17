"""New default body: the 'Anime male base body' (CC-BY, pat1) conformed to the game's 24-joint rig:
orient -> raise the A-pose arms to the rig's T-pose -> warp proportions to the rig -> skin weights transferred from the professionally skinned donor characters."""
import sys, os, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.spatial import cKDTree
from gltf_reader import GLTF
import build_bases as BB

SM = lambda t: t * t * (3 - 2 * np.clip(t, 0, 1)) if False else (np.clip(t, 0, 1) ** 2 * (3 - 2 * np.clip(t, 0, 1)))

def load_base(path):
    g = GLTF(path); j = g.j; par = g.parents()
    for ni, nd in enumerate(j['nodes']):
        if 'mesh' not in nd: continue
        for p in j['meshes'][nd['mesh']]['primitives']:
            if j['materials'][p['material']]['name'] != 'skin.001': continue
            W = g.world(ni, par); P = g.accessor(p['attributes']['POSITION']).astype(np.float64); P = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
            UV = g.accessor(p['attributes']['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in p['attributes'] else np.zeros((len(P), 2), np.float32)
            F = g.accessor(p['indices']).astype(np.int64).reshape(-1, 3)
            return P, UV, F

# ---- A-pose measurements (base units, before orientation).  front faces -z in the source.
def orient(P):
    P = P.copy(); P[:, 0] *= -1; P[:, 2] *= -1          # face +z (rotate 180deg about y)
    P[:, 2] -= 1.35 * -1 if False else -1.35 * -1 * 0   # (centre set below)
    return P

def build(path, wp_t, donors):
    P, UV, F = load_base(path)
    P[:, 0] *= -1; P[:, 2] *= -1
    zc = np.median(P[(P[:, 1] > 11) & (P[:, 1] < 13) & (np.abs(P[:, 0]) < 1.5)][:, 2]); P[:, 2] -= zc
    P[:, 1] -= P[:, 1].min()
    # ---------- raise arms: A-pose (~42deg) -> T-pose.  Arm membership: beyond the torso silhouette, below the shoulder line, smooth blend near the shoulder.
    piv = {1: np.array([2.35, 16.85]), -1: np.array([-2.35, 16.85])}
    ang = np.radians(42.0)
    out = P.copy()
    for s in (1, -1):
        m = (P[:, 0] * s > 1.2) & (P[:, 1] < 18.2) & (P[:, 1] > 10.5)
        d = (P[:, 0] - piv[s][0]) * s                       # distance outward from the pivot
        # blend 0 at x<=1.9 (inside torso/shoulder) to 1 at x>=3.2
        w = np.where(m, SM((np.abs(P[:, 0]) - 1.9) / 1.3), 0.)
        # rotation about the pivot (in x-y plane): raise the arm tip by +ang
        c, sn = np.cos(ang * w), np.sin(ang * w)
        dx = (P[:, 0] - piv[s][0]); dy = (P[:, 1] - piv[s][1])
        # for s=+1 arm points down-right: rotate counter-clockwise (+); mirror for s=-1
        rx = dx * c - s * dy * sn * 1.0; ry = dy * c + s * dx * sn * 1.0
        out[:, 0] = np.where(m, piv[s][0] + rx, out[:, 0]); out[:, 1] = np.where(m, piv[s][1] + ry, out[:, 1])
    P = out
    return P, UV, F, piv

YB = [0, 9.95, 17.3, 18.6, 30.0]; YT = [0, .92, 1.55, 1.62, 1.62 + 11.4 * .0732]
SXB = [0, 10.0, 12.6, 15.5, 30]; SXV = [.0888, .0888, .080, .076, .076]
def warp(P, piv, ytorso=None):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    a = np.clip(SM((np.abs(x) - 1.9) / 1.3), 0, 1) * ((y > 10.5) & (y < 18.4) & (np.abs(x) > 1.2))
    yt = np.interp(y, YB, YT); sx = np.interp(y, SXB, SXV)
    ya = 1.545 + (y - piv[1][1]) * .0888
    xt = x * sx
    pivT = abs(piv[1][0]) * np.interp(16.85, SXB, SXV)
    xa = np.sign(x) * (pivT + (np.abs(x) - abs(piv[1][0])) * .080)
    zs = np.interp(y, [0, 10, 13, 16, 30], [.0888, .086, .074, .070, .070])
    Q = np.stack([(1 - a) * xt + a * xa, (1 - a) * yt + a * ya, z * zs], 1)
    return Q, a

def transfer_weights(Q, donors, k=6):
    """skin weights for the body: nearest vertices of the donor characters (same rig, T-pose) -> distance weighted"""
    pts = np.concatenate([d['pos'] for d in donors]); J = np.concatenate([d['jj'] for d in donors]); W = np.concatenate([d['ww'] for d in donors])
    tree = cKDTree(pts); dist, idx = tree.query(Q, k=k)
    jj = np.zeros((len(Q), 4), np.int64); ww = np.zeros((len(Q), 4))
    for i in range(len(Q)):
        acc = {}; wt = 1.0 / (dist[i] + 2e-3) ** 2
        for t, w in zip(idx[i], wt):
            for kk in range(4):
                if W[t, kk] > 0: acc[int(J[t, kk])] = acc.get(int(J[t, kk]), 0) + w * W[t, kk]
        tot = sum(acc.values())
        for kk, (j, v) in enumerate(sorted(acc.items(), key=lambda kv: -kv[1])[:4]): jj[i, kk] = j; ww[i, kk] = v
        ww[i] /= ww[i].sum()
    return jj, ww

def smooth_weights(Q, F, jj, ww, it=3):
    """a few Laplacian passes over the mesh graph so the transfer has no noise"""
    n = len(Q); a = np.r_[F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]]; b = np.r_[F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]]
    D = np.zeros((n, 24)); 
    for k in range(4): np.add.at(D, (np.arange(n), jj[:, k]), ww[:, k])
    cnt = np.bincount(a, minlength=n).astype(float)
    for _ in range(it):
        acc = np.zeros_like(D); np.add.at(acc, a, D[b]); D = .5 * D + .5 * acc / np.maximum(cnt, 1)[:, None]
    jj2 = np.argsort(-D, axis=1)[:, :4]; ww2 = np.take_along_axis(D, jj2, 1); ww2 /= ww2.sum(1, keepdims=True)
    return jj2, ww2

def _ext(pts, ax):    # robust transverse extents of a point set along the two transverse axes
    lo = np.percentile(pts[:, ax], 3, axis=0); hi = np.percentile(pts[:, ax], 97, axis=0); return lo, hi

def fit_to_donors(Q, donors, margin=.006, kmin=.62, kmax=1.06, centre=True):
    """slim the body to sit inside the donors' clothes: per slice, scale the body about its own centre so its half-extents are donor half-extents minus a margin."""
    D = np.concatenate([d['pos'] for d in donors]); Q = Q.copy()
    def slice_fit(sel_q, sel_d, ax_t, centre_to_donor=False, smooth=None):
        pass
    out = Q.copy()
    # ---- legs: slices in y, per side
    for s in (1, -1):
        qy = Q[:, 1]; legq = (Q[:, 0] * s > .01) & (qy < .93)
        legd = (D[:, 0] * s > .01) & (D[:, 1] < .93)
        ys = np.arange(0.0, .95, .04); ks = []
        for y in ys:
            mq = legq & (np.abs(qy - y) < .025); md = legd & (np.abs(D[:, 1] - y) < .03)
            if mq.sum() < 6 or md.sum() < 6: ks.append(None); continue
            bq = Q[mq]; bd = D[md]; cq = np.array([(bq[:, 0].max() + bq[:, 0].min()) / 2, (bq[:, 2].max() + bq[:, 2].min()) / 2]); rq = np.array([(bq[:, 0].max() - bq[:, 0].min()) / 2, (bq[:, 2].max() - bq[:, 2].min()) / 2])
            cd = np.array([(bd[:, 0].max() + bd[:, 0].min()) / 2, (bd[:, 2].max() + bd[:, 2].min()) / 2]); rd = np.array([(bd[:, 0].max() - bd[:, 0].min()) / 2, (bd[:, 2].max() - bd[:, 2].min()) / 2])
            k = np.clip((rd - margin) / rq, kmin, kmax); ks.append((y, cq, cd, k))
        ok = [k for k in ks if k is not None]
        yv = np.array([k[0] for k in ok]); kx = np.array([k[3][0] for k in ok]); kz = np.array([k[3][1] for k in ok])
        for arr in (kx, kz):
            for _ in range(6): arr[1:-1] = (arr[:-2] + 2 * arr[1:-1] + arr[2:]) / 4
        cqx = np.array([k[1][0] for k in ok]); cqz = np.array([k[1][1] for k in ok]); cdx = np.array([k[2][0] for k in ok]); cdz = np.array([k[2][1] for k in ok])
        sel = legq
        yy = Q[sel, 1]; fx = np.interp(yy, yv, kx); fz = np.interp(yy, yv, kz); cx = np.interp(yy, yv, cqx); cz = np.interp(yy, yv, cqz); dx_ = np.interp(yy, yv, cdx); dz_ = np.interp(yy, yv, cdz)
        sh = .35 if centre else 0.
        out[sel, 0] = (cx + (dx_ - cx) * sh) + (Q[sel, 0] - cx) * fx; out[sel, 2] = (cz + (dz_ - cz) * sh) + (Q[sel, 2] - cz) * fz
    # ---- arms: slices in |x|, per side (transverse = y,z)
    for s_ in (1, -1):
        sel = (Q[:, 0] * s_ > .20) & (Q[:, 1] > 1.35); seld = (D[:, 0] * s_ > .20) & (D[:, 1] > 1.35)
        xs = np.arange(.21, .78, .04); rows = []
        for x in xs:
            mq = sel & (np.abs(np.abs(Q[:, 0]) - x) < .025); md = seld & (np.abs(np.abs(D[:, 0]) - x) < .03)
            if mq.sum() < 6 or md.sum() < 6: continue
            bq = Q[mq]; bd = D[md]
            rq = np.array([(bq[:, 1].max() - bq[:, 1].min()) / 2, (bq[:, 2].max() - bq[:, 2].min()) / 2]); rd = np.array([(bd[:, 1].max() - bd[:, 1].min()) / 2, (bd[:, 2].max() - bd[:, 2].min()) / 2])
            cq = np.array([(bq[:, 1].max() + bq[:, 1].min()) / 2, (bq[:, 2].max() + bq[:, 2].min()) / 2]); cd = np.array([(bd[:, 1].max() + bd[:, 1].min()) / 2, (bd[:, 2].max() + bd[:, 2].min()) / 2])
            rows.append((x, np.clip((rd - margin) / rq, kmin, kmax), cq, cd))
        if not rows: continue
        xv = np.array([r[0] for r in rows]); ky = np.array([r[1][0] for r in rows]); kz = np.array([r[1][1] for r in rows]); cy = np.array([r[2][0] for r in rows]); cz = np.array([r[2][1] for r in rows])
        for arr in (ky, kz):
            for _ in range(3): arr[1:-1] = (arr[:-2] + 2 * arr[1:-1] + arr[2:]) / 4
        ax = np.abs(Q[sel, 0]); fy = np.interp(ax, xv, ky); fz = np.interp(ax, xv, kz); ccy = np.interp(ax, xv, cy); ccz = np.interp(ax, xv, cz)
        ddy = np.interp(ax, xv, np.array([r[3][0] if centre else r[2][0] for r in rows])); ddz = np.interp(ax, xv, np.array([r[3][1] if centre else r[2][1] for r in rows]))
        out[sel, 1] = ddy + (Q[sel, 1] - ccy) * fy; out[sel, 2] = ddz + (Q[sel, 2] - ccz) * fz
    return out
    # ---- torso: slices in y between the crotch and the shoulders (transverse = x half-width, z)
    selt = (np.abs(Q[:, 0]) < .21) & (Q[:, 1] > .93) & (Q[:, 1] < 1.52); seld = (np.abs(D[:, 0]) < .21) & (D[:, 1] > .93) & (D[:, 1] < 1.52)
    ys = np.arange(.96, 1.5, .04); rows = []
    for y in ys:
        mq = selt & (np.abs(Q[:, 1] - y) < .025); md = seld & (np.abs(D[:, 1] - y) < .03)
        if mq.sum() < 10 or md.sum() < 10: continue
        bq = Q[mq]; bd = D[md]
        rq = np.array([np.abs(bq[:, 0]).max(), (bq[:, 2].max() - bq[:, 2].min()) / 2]); rd = np.array([np.percentile(np.abs(bd[:, 0]), 96), (np.percentile(bd[:, 2], 96) - np.percentile(bd[:, 2], 4)) / 2])
        cq = (bq[:, 2].max() + bq[:, 2].min()) / 2; cd = (np.percentile(bd[:, 2], 96) + np.percentile(bd[:, 2], 4)) / 2
        rows.append((y, np.clip((rd - margin) / rq, kmin, 1.02), cq, cd))
    if rows:
        yv = np.array([r[0] for r in rows]); kx = np.array([r[1][0] for r in rows]); kz = np.array([r[1][1] for r in rows]); cq = np.array([r[2] for r in rows]); cd = np.array([r[3] for r in rows])
        for arr in (kx, kz, cq, cd):
            for _ in range(3): arr[1:-1] = (arr[:-2] + 2 * arr[1:-1] + arr[2:]) / 4
        yy = Q[selt, 1]; fx = np.interp(yy, yv, kx); fz = np.interp(yy, yv, kz); cqi = np.interp(yy, yv, cq); cdi = np.interp(yy, yv, cd)
        out[selt, 0] = Q[selt, 0] * fx; out[selt, 2] = (cdi if centre else cqi) + (Q[selt, 2] - cqi) * fz
    return out

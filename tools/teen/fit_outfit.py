"""Fit Quaternius outfit parts (65-joint adult rig, T-pose) onto the 24-joint teen skeleton (A-pose).
Nothing is scaled blindly: the torso/shoulders use a measured anisotropic warp, limbs use per-bone length ratios and
shortest-arc bone rotations, the head uses a head-size ratio. Skin weights are re-mapped Q-joint -> teen-joint by name."""
import numpy as np

Q2T = {'root': 'Pelvis', 'pelvis': 'Pelvis', 'spine_01': 'Spine', 'spine_02': 'Spine1', 'spine_03': 'Spine2', 'neck_01': 'Neck', 'Head': 'Head',
       'clavicle_l': 'L Clavicle', 'upperarm_l': 'L UpperArm', 'lowerarm_l': 'L Forearm', 'hand_l': 'L Hand',
       'clavicle_r': 'R Clavicle', 'upperarm_r': 'R UpperArm', 'lowerarm_r': 'R Forearm', 'hand_r': 'R Hand',
       'thigh_l': 'L Thigh', 'calf_l': 'L Calf', 'foot_l': 'L Foot', 'ball_l': 'L Toe0', 'ball_leaf_l': 'L Toe0',
       'thigh_r': 'R Thigh', 'calf_r': 'R Calf', 'foot_r': 'R Foot', 'ball_r': 'R Toe0', 'ball_leaf_r': 'R Toe0'}
def qname_to_teen(q):
    if q in Q2T: return 'Bip001 ' + Q2T[q]
    for side in ('l', 'r'):
        if q.endswith('_' + side) and any(q.startswith(f) for f in ('index', 'middle', 'pinky', 'ring', 'thumb')): return 'Bip001 %s Hand' % side.upper()
    return 'Bip001 Pelvis'
WARP_JOINTS = {'Bip001 Pelvis', 'Bip001 Spine', 'Bip001 Spine1', 'Bip001 Spine2', 'Bip001 Neck', 'Bip001 L Clavicle', 'Bip001 R Clavicle'}

def arc(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b); v = np.cross(a, b); c = float(a @ b)
    if c < -0.9999: return np.diag([1., -1., -1.])
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]); return np.eye(3) + k + k @ k / (1 + c)

class Fit:
    def __init__(self, qpos, tpos, head_M=None, head_off=(0, 0, 0)):
        """qpos: {quaternius joint name: pos}, tpos: {teen joint name: pos}"""
        self.q, self.t = qpos, tpos
        Qp = lambda n: np.asarray(qpos[n], float); Tp = lambda n: np.asarray(tpos['Bip001 ' + n], float)
        self.sx, self.sy, self.sz = 0.72, (Tp('Neck')[1] - Tp('Pelvis')[1]) / (Qp('neck_01')[1] - Qp('pelvis')[1]), 0.70
        self.q0 = Qp('pelvis'); self.t0 = Tp('Pelvis')
        self.frames = {}
        def chain(name, qa, qb, ta, tb, ref=None):
            R = arc(Qp(qb) - Qp(qa), Tp(tb) - Tp(ta)); s = np.linalg.norm(Tp(tb) - Tp(ta)) / np.linalg.norm(Qp(qb) - Qp(qa))
            self.frames['Bip001 ' + name] = (Qp(qa), Tp(ta), s * R)
        for S, sd in (('L', 'l'), ('R', 'r')):
            chain(S + ' UpperArm', 'upperarm_' + sd, 'lowerarm_' + sd, S + ' UpperArm', S + ' Forearm')
            chain(S + ' Forearm', 'lowerarm_' + sd, 'hand_' + sd, S + ' Forearm', S + ' Hand')
            self.frames['Bip001 %s Hand' % S] = (Qp('hand_' + sd), Tp(S + ' Hand'), self.frames['Bip001 %s Forearm' % S][2])
            chain(S + ' Thigh', 'thigh_' + sd, 'calf_' + sd, S + ' Thigh', S + ' Calf')
            chain(S + ' Calf', 'calf_' + sd, 'foot_' + sd, S + ' Calf', S + ' Foot')
            chain(S + ' Foot', 'foot_' + sd, 'ball_' + sd, S + ' Foot', S + ' Toe0')
            self.frames['Bip001 %s Toe0' % S] = (Qp('ball_' + sd), Tp(S + ' Toe0'), self.frames['Bip001 %s Foot' % S][2])
        self.frames['Bip001 Head'] = (Qp('Head'), Tp('Head') + np.asarray(head_off, float), np.eye(3) * 1.4 if head_M is None else np.asarray(head_M, float))
    def warp(self, P):
        o = np.empty_like(P); o[:, 0] = P[:, 0] * self.sx; o[:, 1] = self.t0[1] + (P[:, 1] - self.q0[1]) * self.sy; o[:, 2] = self.t0[2] + (P[:, 2] - self.q0[2]) * self.sz; return o
    def apply(self, P, infl, mapper=None):
        """P [N,3]; infl: per vertex list of (sourceJointName, w); mapper: source joint name -> teen joint name (default: Quaternius names).
        Returns new P and per-vertex list of (teenJointName, w), max 4."""
        mapper = mapper or qname_to_teen
        out = np.zeros_like(P); ninf = []
        Pw = self.warp(P)
        for i, lst in enumerate(infl):
            acc = {}
            for q, w in lst:
                if w <= 1e-4: continue
                t = mapper(q); acc[t] = acc.get(t, 0) + w
            if not acc: acc = {'Bip001 Pelvis': 1.0}
            tot = sum(acc.values()); p = np.zeros(3)
            for t, w in acc.items():
                w /= tot; acc[t] = w
                if t in WARP_JOINTS or t not in self.frames: p += w * Pw[i]
                else:
                    qa, ta, M = self.frames[t]; p += w * (ta + M @ (P[i] - qa))
            out[i] = p; ninf.append(sorted(acc.items(), key=lambda kv: -kv[1])[:4])
        return out, ninf

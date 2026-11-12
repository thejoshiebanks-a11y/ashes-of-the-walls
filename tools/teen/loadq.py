import sys, numpy as np
sys.path.insert(0, 'tools')
from gltf_reader import GLTF
def q_joints(path):
    g = GLTF(path); j = g.j; sk = j['skins'][0]
    ibm = g.accessor(sk['inverseBindMatrices']).astype(float).reshape(-1, 4, 4).transpose(0, 2, 1)
    return {j['nodes'][n]['name']: np.linalg.inv(m)[:3, 3] for n, m in zip(sk['joints'], ibm)}

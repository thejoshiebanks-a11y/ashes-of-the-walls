"""Skinned-mesh extraction from the Quaternius/Unity binary FBX outfit parts (no Blender needed).
read_parts(path) -> list of dict(name, material, texture, pos[N,3] (metres, Y-up, bind pose), uv[N,2], tri[M,3], infl: per-vertex list of (limbName, weight))
"""
import os, numpy as np
from fbx_reader import parse, find

def _s(b): return b.split(b'\x00')[0].decode('latin1')
def _mat(p): return np.array(p, float).reshape(4, 4).T

def read_parts(path, unit=1.0):
    ver, top = parse(path)
    ob = find(top, 'Objects')[0][2]; cn = find(top, 'Connections')[0][2]
    by = {n[1][0]: n for n in ob if n[1] and isinstance(n[1][0], (int, np.integer))}
    kids = {}
    for c in cn:
        if c[1][0] == b'OO': kids.setdefault(c[1][2], []).append(c[1][1])        # parent -> children
    parent_of = {}
    for c in cn:
        if c[1][0] == b'OO': parent_of.setdefault(c[1][1], []).append(c[1][2])
    def kid(n, name): return [k for k in n[2] if k[0] == name]
    parts = []
    for g in [n for n in ob if n[0] == 'Geometry' and n[1][2] == b'Mesh']:
        gid = g[1][0]; V = kid(g, 'Vertices')[0][1][0].reshape(-1, 3) * unit; PV = kid(g, 'PolygonVertexIndex')[0][1][0]
        # polygon-vertex -> triangles (fan)
        tris = []; cur = []; corner = []
        for i, ix in enumerate(PV):
            cur.append(i); 
            if ix < 0:
                for k in range(1, len(cur) - 1): tris.append((cur[0], cur[k], cur[k + 1]))
                cur = []
        tris = np.array(tris); vidx = np.where(PV < 0, ~PV, PV)
        uvn = kid(g, 'LayerElementUV'); uv = None
        if uvn:
            u = kid(uvn[0], 'UV')[0][1][0].reshape(-1, 2); ui = kid(uvn[0], 'UVIndex')
            uv = u[ui[0][1][0]] if ui else u[np.arange(len(PV))]
        # skin
        model = [m for m in parent_of.get(gid, []) if m in by and by[m][0] == 'Model'][0]
        skin = [k for k in kids.get(gid, []) if k in by and by[k][0] == 'Deformer' and by[k][1][2] == b'Skin']
        infl = [[] for _ in range(len(V))]; Tm = np.eye(4); links = {}
        if skin:
            for cl in [k for k in kids.get(skin[0], []) if k in by and by[k][0] == 'Deformer']:
                node = by[cl]; ix = kid(node, 'Indexes'); w = kid(node, 'Weights')
                limb = [k for k in kids.get(cl, []) if k in by and by[k][0] == 'Model'][0]
                if not ix: continue
                Tm = _mat(kid(node, 'Transform')[0][1][0])
                links[_s(by[limb][1][1])] = (_mat(kid(node, 'TransformLink')[0][1][0]), _mat(kid(node, 'Transform')[0][1][0]))
                for a, b in zip(ix[0][1][0], w[0][1][0]): infl[int(a)].append((_s(by[limb][1][1]), float(b)))
        P = V
        # material / texture
        mats = [k for k in kids.get(model, []) if k in by and by[k][0] == 'Material']
        mat = _s(by[mats[0]][1][1]) if mats else ''; tex = ''
        if mats:
            for t in kids.get(mats[0], []):
                if t in by and by[t][0] == 'Texture' and _s(by[t][1][1]).startswith('base_color'):
                    rf = kid(by[t], 'RelativeFilename') or kid(by[t], 'FileName'); tex = os.path.basename(rf[0][1][0].decode('latin1').replace('\\', '/'))
        parts.append(dict(name=_s(g[1][1]), material=mat, texture=tex, P=P, vidx=vidx, tris=tris, uv=uv, infl=infl, links=links, Tm=Tm))
    return parts

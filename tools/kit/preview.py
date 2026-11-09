"""Software preview of GLB/XPS models: front+side view with texture sampling per triangle. Usage: preview.py out.png file..."""
import sys, os, io, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from gltf_reader import GLTF
import xps as XPS

def glb_parts(path):
    g = GLTF(path); j = g.j; par = g.parents(); out = []
    cache = {}
    def img(mat):
        pbr = mat.get('pbrMetallicRoughness', {}); bt = pbr.get('baseColorTexture')
        if bt is None:
            f = pbr.get('baseColorFactor', [.7,.7,.7,1]); return Image.new('RGB', (4, 4), tuple(int(c * 255) for c in f[:3]))
        src = j['textures'][bt['index']]['source']
        if src in cache: return cache[src]
        im = j['images'][src]
        data = open(os.path.join(g.dir, im['uri']), 'rb').read() if 'uri' in im else g.view_bytes(im['bufferView'])[0]
        cache[src] = Image.open(io.BytesIO(data)).convert('RGBA'); return cache[src]
    for ni, nd in enumerate(j['nodes']):
        if 'mesh' not in nd: continue
        W = g.world(ni, par)
        for pr in j['meshes'][nd['mesh']]['primitives']:
            a = pr['attributes']; P = g.accessor(a['POSITION']).astype(np.float64)
            if 'skin' in nd: M = np.eye(4)
            else: M = W
            P = (M[:3, :3] @ P.T).T + M[:3, 3]
            UV = g.accessor(a['TEXCOORD_0']) if 'TEXCOORD_0' in a else np.zeros((len(P), 2))
            ix = g.accessor(pr['indices']).reshape(-1).astype(np.int64) if 'indices' in pr else np.arange(len(P))
            mat = j['materials'][pr['material']] if 'material' in pr else {}
            out.append(dict(name=mat.get('name', nd.get('name')), P=P, UV=UV, F=ix.reshape(-1, 3), img=img(mat), skinned='skin' in nd))
    return out

def xps_parts(path):
    x = XPS.read_xps(path); d = os.path.dirname(path); out = []
    for m in x['meshes']:
        if re.search('knife|weapon|bomb|blade', m['name'], re.I): continue
        tn = m['tex'][0][0] if m['tex'] else None
        p = os.path.join(d, tn) if tn else None
        im = Image.open(p).convert('RGBA') if p and os.path.exists(p) else Image.new('RGB', (4, 4), (180, 150, 130))
        out.append(dict(name=m['name'], P=m['P'].astype(np.float64), UV=m['UV'], F=m['F'].astype(np.int64), img=im, skinned=True))
    return out

def render(parts, view, S=520, hflip=False):
    allp = np.concatenate([p['P'] for p in parts]); lo = allp.min(0); hi = allp.max(0); H = hi[1] - lo[1]
    sc = S * .92 / H; cx = (lo[0] + hi[0]) / 2; cz = (lo[2] + hi[2]) / 2
    im = Image.new('RGB', (S, S), (22, 24, 30)); dr = ImageDraw.Draw(im); tris = []
    for p in parts:
        P = p['P']; X = P[:, 0] - cx; Z = P[:, 2] - cz
        if view == 'side': X, Z = Z, -X
        sx = S / 2 + X * sc; sy = S * .96 - (P[:, 1] - lo[1]) * sc; zz = Z
        arr = np.asarray(p['img']); h, w = arr.shape[:2]
        for f in p['F']:
            a, b, c = f
            n = np.cross(P[b] - P[a], P[c] - P[a])
            z = (zz[a] + zz[b] + zz[c]) / 3
            u = (p['UV'][a] + p['UV'][b] + p['UV'][c]) / 3
            col = arr[int((u[1] % 1) * (h - 1)), int((u[0] % 1) * (w - 1))][:3]
            tris.append((z, [(sx[a], sy[a]), (sx[b], sy[b]), (sx[c], sy[c])], tuple(int(v) for v in col)))
    tris.sort(key=lambda t: t[0])
    for z, pts, col in tris: dr.polygon(pts, fill=col)
    return im, H

if __name__ == '__main__':
    out = sys.argv[1]; files = sys.argv[2:]; tiles = []
    for f in files:
        parts = xps_parts(f) if f.endswith('.xps') else glb_parts(f)
        a, H = render(parts, 'front'); print(os.path.basename(f), 'height', round(H, 3), 'parts', [(p['name'], len(p['P'])) for p in parts][:20])
        tiles.append(a)
    W = Image.new('RGB', (520 * len(tiles), 520))
    for i, t in enumerate(tiles): W.paste(t, (520 * i, 0))
    W.save(out)

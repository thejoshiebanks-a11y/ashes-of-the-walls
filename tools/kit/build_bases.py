"""Convert the uploaded XPS characters (Furlan Church, Isabel Magnolia) into engine bases on the canonical Bip001 rig.
Weapons/bombs are dropped. Materials are renamed to the game's tint classes: Body (skin: face, hands, arms), material (clothes), Hair, Shoes.
Usage: build_bases.py <scratch dir containing ex_church/ ex_isabel/> <out dir>"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import xps as XPS
from engine_model import write_model

SPEC = {
 'base_furlan': ('ex_church/AoTWA - Furlan Church', 'role_falan_%s_tex.png'),
 'base_isabel': ('ex_isabel/AoTWA - Isabel Magnolia', 'role_yishabeier_%s_tex.png'),
}
DROP = re.compile(r'knife|weapon|bomb|gun|blade', re.I)
def classify(n):
    n = n.lower()
    if 'hair' in n: return 'Hair', 'hair'
    if 'face' in n: return 'Body', 'face'
    if 'hand' in n or 'arm' in n: return 'Body', 'body'      # hands/arms use the body atlas
    if 'boot' in n: return 'Shoes', 'body'
    return 'material', 'body'

def build(key, scratch, out):
    d, pat = SPEC[key]; x = XPS.read_xps(os.path.join(scratch, d, 'xps.xps')); B = x['bones']
    names = [b[0] for b in B]; par = [b[1] for b in B]; pos = np.array([b[2] for b in B], np.float64)
    prims = []; texs = []; tmap = {}
    for m in x['meshes']:
        if DROP.search(m['name']): continue
        mat, atlas = classify(m['name'])
        if atlas not in tmap:
            im = Image.open(os.path.join(scratch, d, pat % atlas)).convert('RGBA')
            if max(im.size) > 1024: im = im.resize((1024, 1024), Image.LANCZOS)
            tmap[atlas] = len(texs); texs.append(im)
        BI = np.clip(m['BI'], 0, len(names) - 1)
        prims.append(dict(mat=mat, tex=tmap[atlas], pos=m['P'], nrm=m['N'], uv=m['UV'], jj=BI, ww=m['BW'], ix=m['F'].reshape(-1)))
    # feet on the ground, centred
    allp = np.concatenate([p['pos'] for p in prims]); dy = -allp[:, 1].min(); dx = -(allp[:, 0].min() + allp[:, 0].max()) / 2
    for p in prims: p['pos'] = p['pos'] + np.array([dx * 0, dy, 0], np.float32)
    pos[:, 1] += dy
    meta, info, binz, texb = write_model(out, key, names, par, pos, prims, texs)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, key + '.bin'), 'wb').write(binz); json.dump(meta, open(os.path.join(out, key + '.meta.json'), 'w'), separators=(',', ':'))
    json.dump(info, open(os.path.join(out, key + '.info.json'), 'w'))
    for i, t in enumerate(texb): open(os.path.join(out, '%s.t%d.webp' % (key, i)), 'wb').write(t)
    print(key, info['verts'], 'verts', info['tex'], 'tex', 'h=%.2f' % info['bodyHeight'], 'bin %dKB' % info['bin_kb'], [p['mat'] for p in prims])

if __name__ == '__main__':
    for k in SPEC: build(k, sys.argv[1], sys.argv[2])

import sys, json
import numpy as np
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); faces = np.load(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].endswith('.npy') else None
keys = [k for k in d if k != 'rest']; S = 360
cols = [('rest', d['rest'])] + [(k, f) for k in keys for f in [None]]
tiles = []
def draw(parts, view='front'):
    P = np.concatenate([np.array(p).reshape(-1, 3) for p in parts]); im = Image.new('RGB', (S, S), (20, 20, 26)); dr = ImageDraw.Draw(im)
    sc = S * .9 / 1.9
    X = P[:, 0] if view == 'front' else P[:, 2]; zz = P[:, 2] if view == 'front' else -P[:, 0]
    order = np.argsort(zz)
    for i in order[::2]:
        x = S / 2 + X[i] * sc; y = S * .96 - P[i, 1] * sc; c = int(90 + 120 * (zz[i] - zz.min()) / (np.ptp(zz) + 1e-6)); dr.rectangle([x, y, x + 1.6, y + 1.6], fill=(c, c, c))
    return im
rows = []
row = [draw(d['rest']), draw(d['rest'], 'side')]
for k in keys:
    for fi in (0, 2):
        row.append(draw(d[k][fi], 'side'))
sheet = Image.new('RGB', (S * min(len(row), 6), S * ((len(row) + 5) // 6)))
for i, t in enumerate(row): sheet.paste(t, (S * (i % 6), S * (i // 6)))
sheet.save(sys.argv[-1] if sys.argv[-1].endswith('.png') else 'previews/pose.png')

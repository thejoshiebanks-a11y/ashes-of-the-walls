#!/usr/bin/env python3
"""Add a kit model (assets/kit/<key>.*) to assets/npc.pack and data/npc_models.json. Usage: add_to_npc_pack.py mannequin"""
import json, os, struct, sys
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); key = sys.argv[1]
pk = os.path.join(root, 'assets', 'npc.pack'); b = open(pk, 'rb').read(); hl = struct.unpack('<I', b[:4])[0]
hdr = json.loads(b[4:4 + hl]); base = 4 + hl; items = [(k, b[base + o:base + o + n]) for k, (o, n) in hdr.items() if not (k == key + '.bin' or k.startswith(key + '.t'))]
kd = os.path.join(root, 'assets', 'kit'); info = json.load(open(os.path.join(kd, key + '.info.json'))); meta = json.load(open(os.path.join(kd, key + '.meta.json')))
items.append((key + '.bin', open(os.path.join(kd, key + '.bin'), 'rb').read()))
for i in range(info['tex']): items.append(('%s.t%d' % (key, i), open(os.path.join(kd, '%s.t%d.webp' % (key, i)), 'rb').read()))
h = {}; off = 0
for k, v in items: h[k] = [off, len(v)]; off += len(v)
hb = json.dumps(h, separators=(',', ':')).encode()
with open(pk, 'wb') as f:
    f.write(struct.pack('<I', len(hb))); f.write(hb)
    for k, v in items: f.write(v)
nj = os.path.join(root, 'data', 'npc_models.json'); d = json.load(open(nj)); d[key] = {'meta': meta, 'ntex': info['tex'], 'info': info, 'role': sys.argv[2] if len(sys.argv) > 2 else 'mannequin'}
json.dump(d, open(nj, 'w'), separators=(',', ':')); print('added', key, os.path.getsize(pk) // 1024, 'KB')

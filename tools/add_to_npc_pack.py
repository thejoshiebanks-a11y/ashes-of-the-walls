#!/usr/bin/env python3
"""Add one converted model (output of convert_model.py) to assets/npc.pack and data/npc_models.json without rebuilding the others.
Usage: python3 tools/add_to_npc_pack.py CONVERTED_DIR KEY [role]"""
import json, os, struct, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d, key, role = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else 'titan')
pp = os.path.join(root, 'assets', 'npc.pack'); b = open(pp, 'rb').read(); hl = struct.unpack('<I', b[:4])[0]; hdr = json.loads(b[4:4 + hl]); body = b[4 + hl:]
items = [(k, body[o:o + n]) for k, (o, n) in hdr.items() if not (k == key + '.bin' or k.startswith(key + '.t'))]
items.append((key + '.bin', open(os.path.join(d, key + '.bin'), 'rb').read())); info = json.load(open(os.path.join(d, key + '.info.json'))); meta = json.load(open(os.path.join(d, key + '.meta.json')))
for i in range(info['tex']): items.append(('%s.t%d' % (key, i), open(os.path.join(d, '%s.t%d.webp' % (key, i)), 'rb').read()))
h2 = {}; off = 0
for k, v in items: h2[k] = [off, len(v)]; off += len(v)
hb = json.dumps(h2, separators=(',', ':')).encode()
with open(pp, 'wb') as f:
    f.write(struct.pack('<I', len(hb))); f.write(hb)
    for k, v in items: f.write(v)
mp = os.path.join(root, 'data', 'npc_models.json'); m = json.load(open(mp)); m[key] = {'meta': meta, 'ntex': info['tex'], 'info': info, 'role': role}
json.dump(m, open(mp, 'w'), separators=(',', ':')); print('added', key, os.path.getsize(pp) // 1024, 'KB')

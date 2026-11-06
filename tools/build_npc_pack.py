#!/usr/bin/env python3
"""Convert every model in tools/models_manifest.json and pack them for the game.
Usage: python3 tools/build_npc_pack.py /path/to/extracted/models
Writes assets/npc.pack and data/npc_models.json."""
import json, os, struct, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert_model import convert
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
man = json.load(open(os.path.join(root, 'tools', 'models_manifest.json')))
tmp = tempfile.mkdtemp(); items = []; models = {}
for key, spec in man['models'].items():
    meta, info = convert(os.path.join(src, spec['path']), key, tmp, rename=spec.get('rename'), verbose=False)
    items.append((key + '.bin', open(os.path.join(tmp, key + '.bin'), 'rb').read()))
    for i in range(info['tex']): items.append(('%s.t%d' % (key, i), open(os.path.join(tmp, '%s.t%d.webp' % (key, i)), 'rb').read()))
    models[key] = {'meta': meta, 'ntex': info['tex'], 'info': info, 'role': spec.get('role', '')}
    print(key, info['joints'], 'joints', info['bin_kb'], 'KB')
hdr = {}; off = 0
for k, b in items: hdr[k] = [off, len(b)]; off += len(b)
h = json.dumps(hdr, separators=(',', ':')).encode()
with open(os.path.join(root, 'assets', 'npc.pack'), 'wb') as f:
    f.write(struct.pack('<I', len(h))); f.write(h)
    for k, b in items: f.write(b)
json.dump(models, open(os.path.join(root, 'data', 'npc_models.json'), 'w'), separators=(',', ':'))
print('npc.pack', os.path.getsize(os.path.join(root, 'assets', 'npc.pack')) // 1024, 'KB')

import sys, json
sys.path.insert(0, sys.argv[0].rsplit('/',1)[0])
from gltf_reader import GLTF
import numpy as np
for p in sys.argv[1:]:
    g = GLTF(p); j = g.j
    print('=====', p.split('/')[-1])
    print(' nodes', len(j['nodes']), 'meshes', len(j.get('meshes',[])), 'skins', len(j.get('skins',[])), 'mats', len(j.get('materials',[])), 'tex', len(j.get('textures',[])), 'imgs', len(j.get('images',[])), 'anims', len(j.get('animations',[])))
    print(' ext', j.get('extensionsUsed'))
    for si, s in enumerate(j.get('skins',[])):
        names=[j['nodes'][x].get('name') for x in s['joints']]
        print(' skin',si,'joints',len(names), names[:6], '...')
    for mi, m in enumerate(j.get('meshes',[])):
        for pi, pr in enumerate(m['primitives']):
            a = pr['attributes']; pos = g.accessor(a['POSITION']); 
            tg = pr.get('targets',[])
            tn = m.get('extras',{}).get('targetNames')
            print('  mesh',mi,m.get('name'),'prim',pi,'verts',len(pos),'mat',j['materials'][pr['material']]['name'] if 'material' in pr else None,'morphs',len(tg), (tn or [])[:40], 'attrs', list(a.keys()), 'y', round(float(pos[:,1].min()),3), round(float(pos[:,1].max()),3))

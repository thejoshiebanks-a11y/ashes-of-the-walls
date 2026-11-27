import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import build_bases as BB, compose as C, numpy as np
S='/tmp/claude-0/-home-claude/1cc8b787-6a44-5c68-b863-72a90e02eb6d/scratchpad'
def mikasa():
    m0=BB.MATS
    BB.MATS=[('diaocha_body_mat','Tops'),('diaocha_foot_mat','Shoes'),('skin_mat','MSkin'),('zhuangbei','Gear')]
    raw,wp,texs=BB.convert(S+'/mk/scene.gltf',dict(zip(BB.SHORT,BB.OUT)),'y',512); BB.MATS=m0
    for p in raw:
        if p['key']=='Tops': p['pos']=p['pos']-np.array([0,0,.75])     # this garment mesh sits 0.75 m in front of the rest of the model in the export
    for i in (0,9,11,12,13,14,15,20,21,22,23): wp[i,2]=-.02       # these inverse-bind joints carry a stray 0.7 m depth offset: put them back on the body's axis
    wp[10,2]=-.01
    for s,(a,b) in (('L',(13,15)),('R',(21,23))): wp[a+1,:]=(wp[a]+wp[b])/2
    return raw,wp,dict(enumerate(texs))
if __name__=='__main__':
    raw,wp,tx=mikasa()
    prims,twp,ttx=BB.read_pack(S+'/g18/assets/girl','girl')
    body=next(p for p in prims if p['mat']=='Skin_Body')
    op=C.shift_by_joints(BB.name_native(raw,'x','FScout'),wp,twp)
    fx=BB.inflate([p for p in op if p['mat'] in('Outfit_FScout_Tops','Outfit_FScout_Shoes')],dict(body,nrm=-body['nrm']),margin=float(os.environ.get('MG','.010')),reach=float(os.environ.get('RC','.25')))
    for p,q in zip([p for p in op if p['mat'] in('Outfit_FScout_Tops','Outfit_FScout_Shoes')],fx): p.update(q)
    ex=[(body,ttx)]+[(p,tx) for p in op if p['mat'] in('Outfit_FScout_Tops','Outfit_FScout_Shoes')]
    BB.assemble('girl',ex,twp,S+'/pr/pa')

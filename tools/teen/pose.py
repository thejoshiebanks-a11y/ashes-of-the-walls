# pose.py <assetsdir> <key> <outdir> <regex> <armdeg> : dump a pack in a posed state (arms lowered) using CPU skinning, for the standalone viewer
import sys,os,json,re
sys.path.insert(0,'/tmp/claude-0/-home-claude/1cc8b787-6a44-5c68-b863-72a90e02eb6d/scratchpad/w/g12/tools/teen')
import numpy as np
from build_bases import read_pack, PARENTS
d,key,out,rx,deg=sys.argv[1:6]; rx=re.compile(rx); deg=float(deg)
prims,wp,texs=read_pack(os.path.join(d,key),key)
def rz(a): c,s=np.cos(a),np.sin(a); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
R=[np.eye(3) for _ in range(24)]
a=np.radians(deg)
R[13]=rz(-a); R[21]=rz(a)         # upper arms lowered
R[14]=rz(-np.radians(10)); R[22]=rz(np.radians(10))
# FK
Wm=[None]*24
for j in range(24):
    loc=wp[j]-(wp[PARENTS[j]] if PARENTS[j]>=0 else 0)
    M=np.eye(4); M[:3,:3]=R[j]; M[:3,3]=loc
    Wm[j]=M if PARENTS[j]<0 else Wm[PARENTS[j]]@M
Sk=[]
for j in range(24):
    ib=np.eye(4); ib[:3,3]=-wp[j]; Sk.append(Wm[j]@ib)
Sk=np.array(Sk)
os.makedirs(out,exist_ok=True); info=[]; buf=bytearray()
for p in prims:
    if not rx.search(p['mat']): continue
    P=p['pos']; ph=np.c_[P,np.ones(len(P))]; Q=np.zeros_like(P)
    for k in range(4):
        Q+=p['ww'][:,k:k+1]*np.einsum('nij,nj->ni',Sk[p['jj'][:,k]],ph)[:,:3]
    N=p['nrm']; Qn=np.zeros_like(P)
    for k in range(4): Qn+=p['ww'][:,k:k+1]*np.einsum('nij,nj->ni',Sk[p['jj'][:,k]][:,:3,:3],N)
    Qn/=np.maximum(np.linalg.norm(Qn,axis=1,keepdims=True),1e-9)
    e=dict(mat=p['mat'],tex=p['srctex'],n=len(P),ni=len(p['ix']))
    for nm,arr in (('p',Q.astype('<f4')),('n',Qn.astype('<f4')),('uv',p['uv'].astype('<f4')),('ix',np.asarray(p['ix']).astype('<u4'))): e[nm]=len(buf); buf+=arr.tobytes()
    info.append(e)
    if p['srctex'] is not None and not os.path.exists(f'{out}/t{p["srctex"]}.png'): texs[p['srctex']].save(f'{out}/t{p["srctex"]}.png')
open(f'{out}/buf.bin','wb').write(buf); json.dump(dict(prims=info,wp=wp.tolist()),open(f'{out}/info.json','w'))

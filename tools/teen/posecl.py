# posecl.py <gameroot> <key> <outdir> <regex> <clip> <frame> : dump a pack posed with a clip frame (direction-based, like M.pose) for the standalone viewer
import sys,os,json,re,struct,zlib
sys.path.insert(0,'/tmp/claude-0/-home-claude/1cc8b787-6a44-5c68-b863-72a90e02eb6d/scratchpad/w/g12/tools/teen')
import numpy as np
from build_bases import read_pack, PARENTS
R_,key,out,rx,clip,fr=sys.argv[1:7]; rx=re.compile(rx); fr=int(fr)
mj=json.load(open(R_+'/data/models.json'));pairs=mj['anims']['meta']['pairs'];c=mj['anims']['meta']['clips'][clip]
b=open(R_+'/assets/models.pack','rb').read();hl=struct.unpack('<I',b[:4])[0];hdr=json.loads(b[4:4+hl]);base=4+hl
o,l=hdr['anims.bin'];ab=zlib.decompress(b[base+o:base+o+l]);n=c['n'];arr=np.frombuffer(ab,dtype='<i2',offset=c['o'],count=n*50)/32767.
D=arr[:n*45].reshape(n,45)[fr%n].reshape(15,3);Q=arr[n*45:n*49].reshape(n,4)[fr%n]
prims,wp,texs=read_pack(os.path.join(R_,'assets',key),key)
meta=json.load(open(f'{R_}/assets/{key}/{key}.meta.json'));names=meta['names']
def nrm(v): return v/max(np.linalg.norm(v),1e-9)
def arc(a,t):
    v=np.cross(a,t);c=a@t;
    if c<-.9999: return -np.eye(3)*0+np.diag([1,-1,-1])
    K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);return np.eye(3)+K+K@K/(1+c)
tg={}
for k,(a_,b_) in enumerate(pairs):
    x,y,z=D[k]
    if 'Thigh' in a_ or 'Calf' in a_:
        sd=1 if ' L ' in a_ else -1; inw=x*sd; old=sd*(inw*.12 if inw>0 else inw*.35); x=sd*.03
    elif re.search('Spine|Neck|Pelvis',a_): x*=.15
    tg[names.index(a_)]=nrm(np.array([x,y,z]))
kid={names.index(a_):names.index(b_) for a_,b_ in pairs}
Wm=[None]*24
for j in range(24):
    loc=wp[j]-(wp[PARENTS[j]] if PARENTS[j]>=0 else 0)
    M=np.eye(4);M[:3,3]=loc
    W=M if PARENTS[j]<0 else Wm[PARENTS[j]]@M
    if j in tg and j in kid:
        k=kid[j];ld=wp[k]-wp[j];cur=nrm(W[:3,:3]@ld);W=W.copy();W[:3,:3]=arc(cur,tg[j])@W[:3,:3]
    Wm[j]=W
w,x,y,z=Q;Rq=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
Sk=[]
for j in range(24):
    ib=np.eye(4);ib[:3,3]=-wp[j];Sk.append(Wm[j]@ib)
Sk=np.array(Sk)
os.makedirs(out,exist_ok=True);info=[];buf=bytearray()
for p in prims:
    if not rx.search(p['mat']): continue
    P=p['pos'];ph=np.c_[P,np.ones(len(P))];Qp=np.zeros_like(P)
    for k in range(4): Qp+=p['ww'][:,k:k+1]*np.einsum('nij,nj->ni',Sk[p['jj'][:,k]],ph)[:,:3]
    N=p['nrm'];Qn=np.zeros_like(P)
    for k in range(4): Qn+=p['ww'][:,k:k+1]*np.einsum('nij,nj->ni',Sk[p['jj'][:,k]][:,:3,:3],N)
    Qp=Qp@Rq.T;Qn=Qn@Rq.T;Qn/=np.maximum(np.linalg.norm(Qn,axis=1,keepdims=True),1e-9)
    e=dict(mat=p['mat'],tex=p['srctex'],n=len(P),ni=len(p['ix']))
    for nm,a2 in (('p',Qp.astype('<f4')),('n',Qn.astype('<f4')),('uv',p['uv'].astype('<f4')),('ix',np.asarray(p['ix']).astype('<u4'))): e[nm]=len(buf);buf+=a2.tobytes()
    info.append(e)
    if p['srctex'] is not None and not os.path.exists(f'{out}/t{p["srctex"]}.png'): texs[p['srctex']].save(f'{out}/t{p["srctex"]}.png')
open(f'{out}/buf.bin','wb').write(buf);json.dump(dict(prims=info,wp=wp.tolist()),open(f'{out}/info.json','w'))

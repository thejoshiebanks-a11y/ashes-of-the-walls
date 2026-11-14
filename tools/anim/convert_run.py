"""Mixamo run (glTF) -> engine direction clip (15 bone-pair dirs/frame in the pelvis frame + root quat (w,x,y,z) in heading frame + root bob).
usage: convert_run.py scene.gltf out.npz"""
import json,sys,numpy as np
gl,out=sys.argv[1],sys.argv[2]
import os; bp=os.path.join(os.path.dirname(gl),'scene.bin')
j=json.load(open(gl)); buf=open(bp,'rb').read()
def acc(i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    return np.frombuffer(buf,np.float32,a['count']*n,bv.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],n)
nodes=j['nodes']; par={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
an=j['animations'][0]; tr={}
for ch in an['channels']:
    s=an['samplers'][ch['sampler']]; t=ch['target']; tr[(t['node'],t['path'])]=(acc(s['input'])[:,0],acc(s['output']))
names=[n.get('name') or '' for n in nodes]
def slerp(a,b,t):
    d=a@b
    if d<0: b=-b; d=-d
    if d>.9995: r=a+(b-a)*t; return r/np.linalg.norm(r)
    th=np.arccos(d); return (np.sin((1-t)*th)*a+np.sin(t*th)*b)/np.sin(th)
def sample(path,i,time):
    T,V=tr[(i,path)]; time=time%(T[-1]) if T[-1]>0 else 0
    k=max(0,min(len(T)-2,np.searchsorted(T,time,'right')-1)); u=(time-T[k])/max(1e-9,T[k+1]-T[k])
    return slerp(V[k],V[k+1],u) if path=='rotation' else V[k]*(1-u)+V[k+1]*u
def qm(q):
    x,y,z,w=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def local(i,t):
    n=nodes[i]; tt=np.array(n.get('translation',[0,0,0]),float); q=np.array(n.get('rotation',[0,0,0,1]),float); s=np.array(n.get('scale',[1,1,1]),float)
    if (i,'translation') in tr: tt=sample('translation',i,t)
    if (i,'rotation') in tr: q=sample('rotation',i,t)
    if (i,'scale') in tr: s=sample('scale',i,t)
    M=np.eye(4); M[:3,:3]=qm(q)*s; M[:3,3]=tt; return M
def world(i,t,c):
    if i in c: return c[i]
    M=local(i,t)
    if i in par: M=world(par[i],t,c)@M
    c[i]=M; return M
def find(sub): return next(i for i,n in enumerate(names) if sub in n)
ID={'Hips':find('Hips'),'Spine':find('Spine_'),'Spine1':find('Spine1_'),'Spine2':find('Spine2_'),'Neck':find('Neck_'),'Head':find('Head_'),
 'LC':find('LeftShoulder'),'LU':find('LeftArm_'),'LF':find('LeftForeArm'),'LH':find('LeftHand_'),'RC':find('RightShoulder'),'RU':find('RightArm_'),'RF':find('RightForeArm'),'RH':find('RightHand_'),
 'LT':find('LeftUpLeg'),'LK':find('LeftLeg_'),'LA':find('LeftFoot'),'RT':find('RightUpLeg'),'RK':find('RightLeg_'),'RA':find('RightFoot')}
# engine pair order
PAIRS=[('LU','LF'),('LF','LH'),('RU','RF'),('RF','RH'),('LT','LK'),('LK','LA'),('RT','RK'),('RK','RA'),('Hips','Spine'),('Spine','Spine1'),('Spine1','Spine2'),('Spine2','Neck'),('Neck','Head'),('LC','LU'),('RC','RU')]
def qfromM(M):
    t=np.trace(M)
    if t>0: s=np.sqrt(t+1)*2; w=s/4; x=(M[2,1]-M[1,2])/s; y=(M[0,2]-M[2,0])/s; z=(M[1,0]-M[0,1])/s
    else:
        i=np.argmax(np.diag(M)); a,b,c=[(1,2,0),(2,0,1),(0,1,2)][i] if False else (0,1,2)
        if M[0,0]>M[1,1] and M[0,0]>M[2,2]: s=np.sqrt(1+M[0,0]-M[1,1]-M[2,2])*2; w=(M[2,1]-M[1,2])/s; x=s/4; y=(M[0,1]+M[1,0])/s; z=(M[0,2]+M[2,0])/s
        elif M[1,1]>M[2,2]: s=np.sqrt(1+M[1,1]-M[0,0]-M[2,2])*2; w=(M[0,2]-M[2,0])/s; x=(M[0,1]+M[1,0])/s; y=s/4; z=(M[1,2]+M[2,1])/s
        else: s=np.sqrt(1+M[2,2]-M[0,0]-M[1,1])*2; w=(M[1,0]-M[0,1])/s; x=(M[0,2]+M[2,0])/s; y=(M[1,2]+M[2,1])/s; z=s/4
    q=np.array([w,x,y,z]); return q/np.linalg.norm(q)
N=16; dur=float(max(v[0][-1] for v in tr.values()))
D=[];Q=[];Y=[];FOOT=[];HIP=[]
for f in range(N+1):
    t=(f%N)/N*dur; c={}; P={k:world(i,t,c)[:3,3] for k,i in ID.items()}
    up_axis=np.array([0,1,0.])
    # world 'up' : Mixamo/Sketchfab gltf is y-up already (root scale handled by world transforms)
    x=P['LT']-P['RT']; x/=np.linalg.norm(x); yv=P['Spine1']-P['Hips']; yv=yv-x*(yv@x); yv/=np.linalg.norm(yv); z=np.cross(x,yv)
    Mf=np.stack([x,yv,z],1)                         # columns = pelvis frame axes in world
    # heading frame: forward = horizontal projection of z ; x_h = up x fwd
    fw=z.copy(); fw[1]=0; fw/=np.linalg.norm(fw); xh=np.cross(up_axis,fw); Mh=np.stack([xh,up_axis,fw],1)
    Rrel=Mh.T@Mf; yaw=np.arctan2(Rrel[0,2],Rrel[2,2]); cy,sy=np.cos(yaw),np.sin(yaw)
    Mfy=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])    # yaw-only root: lean/roll live in the bone directions, so the engine's pivot never swings the body
    Q.append(qfromM(Mfy))
    row=[]
    for a,b in PAIRS:
        v=P[b]-P[a]; v=Mfy.T@(Mh.T@v); row+=list(v/np.linalg.norm(v))
    D.append(row); HIP.append(P['Hips']-P['Hips']*np.array([1,0,1])); FOOT.append([Mh.T@(P['LA']-P['Hips']),Mh.T@(P['RA']-P['Hips'])]); Y.append(P['Hips'][1])
D=np.array(D);Q=np.array(Q);Y=np.array(Y);FOOT=np.array(FOOT)
leg=np.linalg.norm(world(ID['LK'],0,{})[:3,3]-world(ID['LT'],0,{})[:3,3])+np.linalg.norm(world(ID['LA'],0,{})[:3,3]-world(ID['LK'],0,{})[:3,3])
print('frames',len(D),'dur',dur,'leg',leg,'hip y',Y.min(),Y.max(),Y.mean())
def wrest(i):
    n=nodes[i]; M=np.eye(4); M[:3,:3]=qm(np.array(n.get('rotation',[0,0,0,1]),float))*np.array(n.get('scale',[1,1,1]),float); M[:3,3]=n.get('translation',[0,0,0])
    return wrest(par[i])@M if i in par else M
Yrest=wrest(ID['Hips'])[1,3]; ankle_rest=wrest(ID['LA'])[1,3]; print('rest hips',Yrest,'ankle',ankle_rest)
Yn=(Y-Yrest)/Yrest
np.savez(out,Yn=Yn,D=D,Q=Q,Y=Y,FOOT=FOOT,leg=leg,dur=dur)

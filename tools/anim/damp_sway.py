"""Calms the left/right body sway of the converted Mixamo loops (pelvis yaw/roll swing, spine lateral lean) while keeping the forward lean, legs and arms exactly as captured.
usage: damp_sway.py <root> clip:kYaw:kRoll:kSpine:lessLeanDegrees ...   (k = fraction of the captured swing that is kept)"""
import json,zlib,struct,sys,numpy as np
R0=sys.argv[1]; mj=json.load(open(R0+'/data/models.json')); cl=mj['anims']['meta']['clips']
pk=R0+'/assets/models.pack'; b=open(pk,'rb').read(); hl=struct.unpack('<I',b[:4])[0]; hdr=json.loads(b[4:4+hl]); base=4+hl
files={k:b[base+o:base+o+l] for k,(o,l) in hdr.items()}; an=np.frombuffer(zlib.decompress(files['anims.bin']),'<i2').copy()
def M(q):
    w,x,y,z=q/np.linalg.norm(q); return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def Q(Rm):
    t=np.trace(Rm)
    if t>0: s=np.sqrt(t+1)*2; return np.array([s/4,(Rm[2,1]-Rm[1,2])/s,(Rm[0,2]-Rm[2,0])/s,(Rm[1,0]-Rm[0,1])/s])
    i=np.argmax(np.diag(Rm))
    if i==0: s=np.sqrt(1+Rm[0,0]-Rm[1,1]-Rm[2,2])*2; return np.array([(Rm[2,1]-Rm[1,2])/s,s/4,(Rm[0,1]+Rm[1,0])/s,(Rm[0,2]+Rm[2,0])/s])
    if i==1: s=np.sqrt(1+Rm[1,1]-Rm[0,0]-Rm[2,2])*2; return np.array([(Rm[0,2]-Rm[2,0])/s,(Rm[0,1]+Rm[1,0])/s,s/4,(Rm[1,2]+Rm[2,1])/s])
    s=np.sqrt(1+Rm[2,2]-Rm[0,0]-Rm[1,1])*2; return np.array([(Rm[1,0]-Rm[0,1])/s,(Rm[0,2]+Rm[2,0])/s,(Rm[1,2]+Rm[2,1])/s,s/4])
def Ry(a): c,s=np.cos(a),np.sin(a); return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def axis(ax,a):
    ax=ax/np.linalg.norm(ax); K=np.array([[0,-ax[2],ax[1]],[ax[2],0,-ax[0]],[-ax[1],ax[0],0]]); return np.eye(3)+np.sin(a)*K+(1-np.cos(a))*K@K
for spec in sys.argv[2:]:
    name,ky,kr,ks,dp=spec.rsplit(':',4); ky,kr,ks,dp=float(ky),float(kr),float(ks),np.radians(float(dp));  RX=np.array([[1,0,0],[0,np.cos(-dp),-np.sin(-dp)],[0,np.sin(-dp),np.cos(-dp)]]); c=cl[name]; n=c['n']; off=c['o']//2
    D=an[off:off+n*45].reshape(n,45)/32767.; Qa=an[off+n*45:off+n*49].reshape(n,4)/32767.
    Rs=[M(q) for q in Qa]; yaw=np.array([np.arctan2(r[0,2],r[2,2]) for r in Rs]); ym=np.angle(np.mean(np.exp(1j*yaw)))
    Wd=np.array([[r@d[i*3:i*3+3] for i in range(15)] for r,d in zip(Rs,D)])      # world (heading-frame) dirs
    xm=Wd[:,8:13,0].mean(0)
    for f in range(n-1):
        r=RX@Rs[f]; dy=np.arctan2(np.sin(yaw[f]-ym),np.cos(yaw[f]-ym)); r2=Ry(-(1-ky)*dy)@r
        ru=np.arctan2(-r2[0,1],r2[1,1]); r3=axis(r2[:,2],(1-kr)*ru)@r2 if False else axis(r2[:,2],-(1-kr)*ru)@r2   # roll about forward axis (mean roll ~0)
        W=Wd[f].copy()
        for i in (8,9,10,11,12,13,14): W[i]=RX@W[i]      # torso, neck and collar bones are tilted up with the pelvis; legs and arms stay as captured
        for i in range(8,13):
            v=W[i].copy(); v[0]=xm[i-8]+(v[0]-xm[i-8])*ks; W[i]=v/np.linalg.norm(v)
        for i in range(15): D[f,i*3:i*3+3]=r3.T@W[i]
        Qa[f]=Q(r3)
    D[n-1]=D[0]; Qa[n-1]=Qa[0]
    an[off:off+n*45]=np.round(D.reshape(-1)*32767); an[off+n*45:off+n*49]=np.round(Qa.reshape(-1)*32767)
    print(name,'yaw keep',ky,'roll keep',kr,'spine lateral keep',ks)
files['anims.bin']=zlib.compress(an.tobytes(),9)
hdr={};o=0;body=b''
for k,v in files.items(): hdr[k]=[o,len(v)];o+=len(v);body+=v
h=json.dumps(hdr,separators=(',',':')).encode(); open(pk,'wb').write(struct.pack('<I',len(h))+h+body)

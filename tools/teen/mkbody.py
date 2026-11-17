import sys,os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np, body_v4 as B, importer as I, build_bases as BB
S=os.environ['S']
def taubin(Q,F,it=45,lam=.5,mu=-.53):
    """volume-preserving smoothing over the position-welded mesh: removes the creases and the armpit web that the arm raise and the per-slice fit left behind"""
    key=np.round(Q*1e4).astype(np.int64); _,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.reshape(-1); n=inv.max()+1
    E=np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]); a,b=inv[E[:,0]],inv[E[:,1]]; m=a!=b; a,b=a[m],b[m]
    A=np.concatenate([a,b]); Bv=np.concatenate([b,a]); deg=np.bincount(A,minlength=n).astype(float)
    W=np.zeros(n); np.add.at(W,inv,0); y=Q[:,1]; ax=np.abs(Q[:,0])
    w=np.clip((y-.75)/.1,0,1)*np.where(ax>.62,.35,1.0)*np.where(y>1.55,.0,1.0)        # torso, shoulders, arms; feet/head untouched, hands gently
    P=np.zeros((n,3)); cnt=np.bincount(inv,minlength=n)[:,None]; np.add.at(P,inv,Q); P/=cnt
    wv=np.zeros(n); np.add.at(wv,inv,w); wv/=cnt[:,0]
    for i in range(it):
        for f in (lam,mu):
            S=np.zeros((n,3)); np.add.at(S,A,P[Bv]); S/=np.maximum(deg,1)[:,None]; P=P+f*wv[:,None]*(S-P)
    return Q+(P[inv]-Q*0-np.zeros_like(Q))-Q*0 - (np.zeros_like(Q)) if False else (P[inv])
def knn_smooth(Q,jj,ww,k=14,it=40,lam=.65):
    """smooth skin weights over a nearest-neighbour graph (not the mesh edges): the base body is built from separate shells that overlap at the shoulders,
    and copying weights from clothing left patches; neighbours in space must move together"""
    from scipy.spatial import cKDTree
    n=len(Q); D=np.zeros((n,24))
    for c in range(4): np.add.at(D,(np.arange(n),jj[:,c]),ww[:,c])
    d,ix=cKDTree(Q).query(Q,k=k); w=np.exp(-(d/(d[:,1:].mean()+1e-9))**2); w/=w.sum(1,keepdims=True)
    reg=(np.abs(Q[:,0])>.08)&(Q[:,1]>1.2)&(Q[:,1]<1.62)                          # shoulders and upper arms need the most blending
    lm=np.where(reg,lam,.25)[:,None]
    for _ in range(it): D=(1-lm)*D+lm*(w[:,:,None]*D[ix]).sum(1)
    jj2=np.argsort(-D,axis=1)[:,:4]; ww2=np.take_along_axis(D,jj2,1); ww2/=ww2.sum(1,keepdims=True); return jj2,ww2
def shoulder_ramp(Q,jj,ww):
    """over the top of the shoulder the arm's influence fades in gradually from the neck side (clavicle / spine) to the deltoid, so lowering an arm never drags a flange of trapezius out sideways"""
    n=len(Q); D=np.zeros((n,24))
    for c in range(4): np.add.at(D,(np.arange(n),jj[:,c]),ww[:,c])
    for sg,arm,cl in ((1,[13,14,15],12),(-1,[21,22,23],20)):
        ax=sg*Q[:,0]; m=(ax>.06)&(Q[:,1]>1.38)&(Q[:,1]<1.66)
        f=np.clip((ax-.085)/.10,0,1); f=f*f*(3-2*f); A=D[:,arm].sum(1)
        hg=np.clip((Q[:,1]-1.40)/.08,0,1); hg=hg*hg*(3-2*hg); hg=np.where(ax>.21,1.0,hg)      # below the armpit line keep the original (torso-side) weights
        newA=np.where(m,f*hg+A*(1-hg),A)                                                       # inside the cap region the arm share follows the ramp exactly: 0 at the neck side, 1 over the deltoid
        oth=np.ones(24,bool); oth[arm]=False; O=D[:,oth].sum(1)
        D[:,arm]*=np.where(A>1e-9,newA/np.maximum(A,1e-9),0)[:,None]; D[:,13]+=np.where(A<=1e-9,newA,0)
        D[:,oth]*=np.where(O>1e-9,(1-newA)/np.maximum(O,1e-9),0)[:,None]; D[:,cl]+=np.where(O<=1e-9,(1-newA)*.65,0); D[:,11]+=np.where(O<=1e-9,(1-newA)*.35,0)
    jj2=np.argsort(-D,axis=1)[:,:4]; ww2=np.take_along_axis(D,jj2,1); ww2/=ww2.sum(1,keepdims=True); return jj2,ww2
def pit_smooth(Q,jj,ww,k=36,it=120):
    """the armpit is where a lowered arm stretches the skin: blend the weights hard across it so the stretch spreads into a soft fold instead of a flat sheet"""
    from scipy.spatial import cKDTree
    n=len(Q); D=np.zeros((n,24))
    for c in range(4): np.add.at(D,(np.arange(n),jj[:,c]),ww[:,c])
    m=(np.abs(Q[:,0])>.09)&(np.abs(Q[:,0])<.27)&(Q[:,1]>1.30)&(Q[:,1]<1.50)
    d,ix=cKDTree(Q).query(Q,k=k); w=np.exp(-(d/(d[:,1:].mean()+1e-9))**2); w/=w.sum(1,keepdims=True)
    for _ in range(it): D=np.where(m[:,None],.35*D+.65*(w[:,:,None]*D[ix]).sum(1),D)
    jj2=np.argsort(-D,axis=1)[:,:4]; ww2=np.take_along_axis(D,jj2,1); ww2/=ww2.sum(1,keepdims=True); return jj2,ww2
def vol_smooth(Q,F,vox=.0025,sig=2.3,box=(-.56,.56,1.27,1.66,-.12,.22)):
    """the base body is built from separate overlapping shells; where they meet at the shoulders their rims stand out as a ragged lip.
    Rasterise the shoulder/arm region to a filled volume, blur it (thin lips vanish, real forms stay), and slide every vertex there onto the smooth iso-surface."""
    from scipy import ndimage as nd
    x0,x1,y0,y1,z0,z1=box; nx,ny,nz=[int(round((b-a)/vox)) for a,b in((x0,x1),(y0,y1),(z0,z1))]
    o=np.array([x0,y0,z0]); vol=np.zeros((nx,ny,nz),bool)
    tri=Q[F]; c=tri.mean(1); sel=((c[:,0]>x0)&(c[:,0]<x1)&(c[:,1]>y0)&(c[:,1]<y1)&(c[:,2]>z0)&(c[:,2]<z1)); T=tri[sel]
    g=np.array([(i/8,j/8) for i in range(9) for j in range(9-i)]); w=np.c_[g,1-g.sum(1)]
    for a in range(0,len(T),4000):
        pts=np.einsum('kt,ntd->nkd',w,T[a:a+4000]).reshape(-1,3); ix=np.floor((pts-o)/vox).astype(int)
        m=((ix>=0)&(ix<[nx,ny,nz])).all(1); ix=ix[m]; vol[ix[:,0],ix[:,1],ix[:,2]]=True
    vol=nd.binary_dilation(vol,iterations=2); fill=np.zeros_like(vol)
    for j in range(ny): fill[:,j,:]|=nd.binary_fill_holes(vol[:,j,:])
    for i in range(nx): fill[i,:,:]|=nd.binary_fill_holes(vol[i,:,:])
    fill=nd.binary_erosion(fill|vol,iterations=2); f=nd.gaussian_filter(fill.astype(np.float32),sig); gx,gy,gz=np.gradient(f,vox)
    R=Q.copy(); ix=((Q-o)/vox)
    reg=((Q[:,0]>x0+.02)&(Q[:,0]<x1-.02)&(Q[:,1]>y0+.02)&(Q[:,1]<y1-.02)&(Q[:,2]>z0+.01)&(Q[:,2]<z1-.01))
    # fade the correction in/out so it never leaves a step: full strength over the shoulder cap + upper arm, none at the wrist, torso or head
    ax=np.abs(Q[:,0]); wgt=np.clip((ax-.06)/.08,0,1)*np.clip((.52-ax)/.08,0,1)*np.clip((Q[:,1]-1.28)/.05,0,1)*np.clip((1.66-Q[:,1])/.04,0,1)*reg
    for _ in range(6):
        ii=((R-o)/vox).T; fv=nd.map_coordinates(f,ii,order=1,mode='nearest'); G=np.stack([nd.map_coordinates(q,ii,order=1,mode='nearest') for q in(gx,gy,gz)],1)
        gn=(G**2).sum(1)+1e-9; step=(.5-fv)[:,None]*G/gn[:,None]   # f>.5 inside: move so that f -> .5
        step=np.clip(step,-.01,.01); R=R+step*wgt[:,None]
    return R
def make():
    P,UV,F,piv=B.build(S+'/n2/base.glb',None,None)
    Q,a=B.warp(P,piv); Q[:,2]+=.03
    lv,wp,_,_=I.load_bip(S+'/n2/levi/scene.gltf'); fu,_,_,_=I.load_bip(S+'/n2/furlan.glb',flipmesh=True)
    don=[p for p in lv if any(k in p['mat'] for k in('body','boots','hands','face'))]
    Q=B.fit_to_donors(Q,[p for p in lv if any(k in p['mat'] for k in('body','boots','hands'))],margin=.010,kmin=.72)
    import compose as C
    fu2=[dict(p,pos=p['pos'].copy()) for p in fu if 'face' not in p['mat'] and 'hair' not in p['mat'] and len(p['pos'])!=1594]
    C.align_z(fu2,dict(pos=Q))
    Q=B.fit_to_donors(Q,fu2,margin=.004,kmin=.85,kmax=1.0,centre=False)
    Q=taubin(Q,F); Q=vol_smooth(Q,F); Q=taubin(Q,F,it=70)
    jj,ww=B.transfer_weights(Q,don); jj,ww=B.smooth_weights(Q,F,jj,ww,3); jj,ww=knn_smooth(Q,jj,ww); jj,ww=shoulder_ramp(Q,jj,ww); jj,ww=pit_smooth(Q,jj,ww)
    body=dict(mat='Skin_Body',pos=Q,uv=UV,ix=F.reshape(-1),jj=jj,ww=ww,srctex=None)
    return graft_hands(body,[p for p in lv if 'hands' in p['mat']][0],XC=.65),wp
def sub_faces(p,keepv):
    Fv=p['ix'].reshape(-1,3); kf=keepv[Fv].all(1); idx=np.cumsum(keepv)-1; q={}
    for k in('pos','uv','jj','ww'): q[k]=p[k][keepv]
    q['ix']=idx[Fv[kf]].reshape(-1); q['mat']=p['mat']; q['srctex']=p.get('srctex'); return q
def graft_hands(body,hand,XC=.65):
    """the base model's hands are malformed; cut the body at the wrist and grow a properly shaped hand (Levi donor) out of it: cuff radius and axis matched, blended over 14 cm"""
    keep=np.abs(body['pos'][:,0])<XC; b=sub_faces(body,keep); H=hand['pos'].copy(); pieces=[]
    for sg in(1,-1):
        m=(sg*H[:,0]>.5)
        ring=sg*b['pos'][:,0]; rb=(ring>XC-.05); cb=b['pos'][rb]; ca=cb[:,1:].mean(0); rbm=np.linalg.norm(cb[:,1:]-ca,axis=1).mean()
        hr=m&(sg*H[:,0]<.615); ch=H[hr][:,1:].mean(0); rh=np.linalg.norm(H[hr][:,1:]-ch,axis=1).mean()
        t=np.clip((sg*H[:,0]-.60)/.14,0,1); t=t*t*(3-2*t)
        f=(rbm/rh)*(1-t)+t; Hn=H.copy(); rel=H[:,1:]-ch; Hn[:,1:]=ca+rel*f[:,None]+(ch-ch)*0
        Hn[:,1:]=np.where(m[:,None],Hn[:,1:],H[:,1:]); H=np.where(m[:,None],Hn,H)
    hp=dict(pos=H,uv=np.full((len(H),2),.5,np.float32),jj=hand['jj'],ww=hand['ww'],ix=hand['ix'],mat='Skin_Body',srctex=None)
    n0=len(b['pos']); out=dict(mat='Skin_Body',srctex=None)
    for k in('pos','uv','jj','ww'): out[k]=np.concatenate([b[k],hp[k]])
    out['ix']=np.concatenate([b['ix'],np.asarray(hp['ix'])+n0]); out['nrm']=__import__('compose').wnorm(out['pos'],out['ix'].reshape(-1,3)); return out
if __name__=='__main__':
    body,wp=make(); print(body['pos'].min(0),body['pos'].max(0))
    import pickle; pickle.dump((body,wp),open(S+'/w/g12/tmp/body.pkl','wb'))

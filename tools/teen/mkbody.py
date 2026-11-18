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
def taubin_local(Q,F):
    """a last light relaxation over the sculpted region only (shoulders, collar, upper arms): irons out any residual ripple, leaves the rest alone"""
    Z=taubin(Q,F,it=14); ax=np.abs(Q[:,0]); w=np.clip((Q[:,1]-1.25)/.05,0,1)*np.clip((1.62-Q[:,1])/.04,0,1)*np.clip((.52-ax)/.06,0,1)
    return Q+(Z-Q)*w[:,None]
def taubin_ref(Q,F):
    """two very light volume-preserving passes: the reference is already smooth; this only removes the faint facets of its decimation"""
    key=np.round(Q*1e4).astype(np.int64); _,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.reshape(-1); n=inv.max()+1
    E=np.concatenate([F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]]); a,b=inv[E[:,0]],inv[E[:,1]]; m=a!=b; a,b=a[m],b[m]; A=np.concatenate([a,b]); Bv=np.concatenate([b,a]); deg=np.bincount(A,minlength=n).astype(float)
    P=np.zeros((n,3)); cnt=np.bincount(inv,minlength=n)[:,None]; np.add.at(P,inv,Q); P/=cnt; wv=np.clip((np.abs(Q[:,1]-.2)-0)/.2,0,1)[:1]*0+1
    for i in range(6):
        for f in(.4,-.42):
            S=np.zeros((n,3)); np.add.at(S,A,P[Bv]); S/=np.maximum(deg,1)[:,None]; P=P+f*(S-P)
    return P[inv]
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
def _closest_on_tris(P,V,F,k=10):
    """closest point on a triangle soup for every query point (vectorised Ericson); candidates = triangles with the k nearest centroids"""
    from scipy.spatial import cKDTree
    C=V[F].mean(1); tree=cKDTree(C); _,ix=tree.query(P,k=k)
    A=V[F[ix,0]]; Bv=V[F[ix,1]]; Cc=V[F[ix,2]]; p=P[:,None,:]
    ab=Bv-A; ac=Cc-A; ap=p-A; d1=(ab*ap).sum(-1); d2=(ac*ap).sum(-1); bp=p-Bv; d3=(ab*bp).sum(-1); d4=(ac*bp).sum(-1); cp=p-Cc; d5=(ab*cp).sum(-1); d6=(ac*cp).sum(-1)
    vc=d1*d4-d3*d2; vb=d5*d2-d1*d6; va=d3*d6-d5*d4
    den=np.where(np.abs(va+vb+vc)<1e-18,1e-18,va+vb+vc); v=vb/den; w=vc/den
    Q=A+ab*v[...,None]+ac*w[...,None]
    # barycentric clamp by projecting onto the triangle edges when outside (iterative clamp is enough for near-surface queries)
    u=1-v-w; out=(u<0)|(v<0)|(w<0)
    def seg(a,b):
        t=np.clip(((p-a)*(b-a)).sum(-1)/np.maximum(((b-a)**2).sum(-1),1e-18),0,1); return a+(b-a)*t[...,None]
    e1=seg(A,Bv); e2=seg(Bv,Cc); e3=seg(Cc,A); cand=np.stack([e1,e2,e3],0); dd=((cand-p)**2).sum(-1); best=cand[dd.argmin(0),np.arange(P.shape[0])[:,None],np.arange(k)[None,:]]
    Q=np.where(out[...,None],best,Q); d=((Q-p)**2).sum(-1); j=d.argmin(1); return Q[np.arange(len(P)),j],np.sqrt(d[np.arange(len(P)),j])
def ref_wrap(Q,F,jj,ww,wp,deg=35.,maxd=.04):
    """the shoulders, collar, chest and arms are slid onto the smooth surface of the supplied reference body (anime_male_base_body.glb): the reference is posed
    like ours (arms down), found by nearest surface point, and the small displacement is carried back to the bind pose through the skinning rotation"""
    from scipy.spatial import cKDTree
    PAR=BB.PARENTS; a=np.radians(deg)
    def rz(t): c,s=np.cos(t),np.sin(t); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
    R=[np.eye(3) for _ in range(24)]; R[13]=rz(-a); R[21]=rz(a); R[14]=rz(-np.radians(10)); R[22]=rz(np.radians(10))
    Wm=[None]*24
    for j in range(24):
        M=np.eye(4); M[:3,:3]=R[j]; M[:3,3]=wp[j]-(wp[PAR[j]] if PAR[j]>=0 else 0); Wm[j]=M if PAR[j]<0 else Wm[PAR[j]]@M
    Sk=np.array([Wm[j]@np.block([[np.eye(3),-wp[j][:,None]],[np.zeros((1,3)),np.ones((1,1))]]) for j in range(24)])
    ph=np.c_[Q,np.ones(len(Q))]; QA=np.zeros_like(Q); Rb=np.zeros((len(Q),3,3))
    for k in range(4): QA+=ww[:,k:k+1]*np.einsum('nij,nj->ni',Sk[jj[:,k]],ph)[:,:3]; Rb+=ww[:,k,None,None]*Sk[jj[:,k]][:,:3,:3]
    z=np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),'ref_body.npz')); V=z['P'].astype(float)*[-1,1,-1]; RF=z['F']
    V=(V+[0,.0368,0])*(1.8955/(V[:,1].max()+.0368))
    sl=lambda X:(X[:,1]>1.15)&(X[:,1]<1.45)&(np.abs(X[:,0])<.12)
    V[:,2]+=(QA[sl(QA)][:,2].min()+QA[sl(QA)][:,2].max())/2-(V[sl(V)][:,2].min()+V[sl(V)][:,2].max())/2
    CP,dist=_closest_on_tris(QA,V,RF); D=CP-QA
    D[dist>maxd]=0                                                                      # where the two bodies disagree by more than 4 cm (armpit web etc.) trust ours
    # smooth the displacement field over the surface (nearest-neighbour graph) so the move is one continuous sculpt, not a per-vertex snap
    d,ix=cKDTree(QA).query(QA,k=14); w=np.exp(-(d/(d[:,1:].mean()+1e-9))**2); w/=w.sum(1,keepdims=True)
    for _ in range(10): D=(w[:,:,None]*D[ix]).sum(1)
    ax=np.abs(Q[:,0]); y=QA[:,1]
    rg=np.clip((y-1.02)/.10,0,1)                                                         # torso above the hips
    rg=rg*np.clip((.58-ax)/.07,0,1)                                                      # fades out before the wrist (the hand graft keeps its cuff)
    tf=np.clip((1.56-Q[:,1])/.12,0,1); sa=np.clip((ax-.09)/.05,0,1); wgt=rg*(tf*(1-sa)+sa)                  # neck column stays ours so it meets the head piece exactly
    wgt=np.clip(wgt,0,1); wgt=wgt*wgt*(3-2*wgt)
    DT=np.einsum('nji,nj->ni',Rb,D)                                                       # back to the bind pose (R^T d)
    print('ref_wrap: moved',int((wgt*np.linalg.norm(DT,axis=1)>1e-4).sum()),'verts, mean',float((wgt*np.linalg.norm(DT,axis=1)).mean()*1000),'mm, max',float((wgt*np.linalg.norm(DT,axis=1)).max()*1000),'mm')
    return Q+DT*wgt[:,None]

def _skin_mats(wp,deg,elbow=0.):
    PAR=BB.PARENTS; a=np.radians(deg)
    def rz(t): c,s=np.cos(t),np.sin(t); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
    R=[np.eye(3) for _ in range(24)]; R[13]=rz(-a); R[21]=rz(a); R[14]=rz(-np.radians(elbow)); R[22]=rz(np.radians(elbow))
    Wm=[None]*24
    for j in range(24):
        M=np.eye(4); M[:3,:3]=R[j]; M[:3,3]=wp[j]-(wp[PAR[j]] if PAR[j]>=0 else 0); Wm[j]=M if PAR[j]<0 else Wm[PAR[j]]@M
    return np.array([Wm[j]@np.block([[np.eye(3),-wp[j][:,None]],[np.zeros((1,3)),np.ones((1,1))]]) for j in range(24)])
XZS=float(os.environ.get('XZS','1.12'))
def body_from_ref(Q,F,jj,ww,wp,Ltip):
    """the whole body below the neck is the supplied reference mesh (anime_male_base_body.glb): one clean, smooth surface instead of overlapping shells.
    It is scaled to our height, its arm lengthened/shortened to our arm, skinned by copying the weights of our own body (nearest vertices, in the lowered-arm pose both share),
    and carried back to the bind pose through the inverse skinning matrix. Returns pos, faces, jj, ww."""
    from scipy.spatial import cKDTree
    CM=os.environ.get('BODYREF','ref')=='c'
    z=np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),'ref_body_c.npz' if CM else 'ref_body.npz')); V=z['P'].astype(float)*[-1,1,-1]; RF=z['F'].astype(np.int64)
    key=np.round(z['P'].astype(float)*1e4).astype(np.int64); _,first,inv=np.unique(key,axis=0,return_index=True,return_inverse=True); inv=inv.reshape(-1)     # weld the UV-seam duplicates: one vertex per position, so no cracks when posed
    V=V[first]; RF=inv[RF]; RF=RF[(RF[:,0]!=RF[:,1])&(RF[:,1]!=RF[:,2])&(RF[:,0]!=RF[:,2])]
    if CM:      # anime_base_character_-_male_1 (T-pose, 1.70 m): piecewise height map feet->hips->shoulder->neck onto our skeleton, uniform 1.12 width scale
        V[:,1]-=V[:,1].min(); V[:,1]=np.interp(V[:,1],[0,.953,1.339,1.433,1.733],[0,1.062,1.516,1.600,1.870]); V[:,[0,2]]*=XZS
    else: V=(V+[0,.0368,0])*(1.8955/(V[:,1].max()+.0368))
    S0=wp[13].copy()
    # ref arm: direction shoulder->fingertip
    tip=V[V[:,0]>V[:,0].max()-.03].mean(0); dv=tip-S0; deg=float(np.degrees(np.arctan2(-dv[1],dv[0]))); Lr=np.hypot(dv[0],dv[1]); r=(Ltip-S0[0])/Lr; print('ref arm angle',deg,'len',Lr,'ours',Ltip-S0[0],'ratio',r)
    Sk=_skin_mats(wp,deg,0.); ph=np.c_[Q,np.ones(len(Q))]; QA=np.zeros_like(Q)
    for k in range(4): QA+=ww[:,k:k+1]*np.einsum('nij,nj->ni',Sk[jj[:,k]],ph)[:,:3]
    sl=lambda X:(X[:,1]>1.15)&(X[:,1]<1.45)&(np.abs(X[:,0])<.12)
    V[:,2]+=(QA[sl(QA)][:,2].min()+QA[sl(QA)][:,2].max())/2-(V[sl(V)][:,2].min()+V[sl(V)][:,2].max())/2
    d=dv/np.linalg.norm(dv)
    for sg in(1,-1):                                                                     # lengthen / shorten each arm along its own axis (smooth ramp at the shoulder so the torso never moves)
        sel=sg*V[:,0]>S0[0]-.02; P=V[sel]*[sg,1,1]; m=np.clip((P[:,0]-S0[0])/.05,0,1); a=(P[:,:2]-S0[:2])@d[:2]; P[:,:2]+=d[None,:2]*((r-1)*a*m)[:,None]; V[sel]=P*[sg,1,1]
    cV=V[RF].mean(1); keep=(cV[:,1]<1.625)      # the reference's own chin/jaw hangs lower than ours: those front-of-neck triangles are left out
    RFk=RF[keep]; used=np.unique(RFk); remap=-np.ones(len(V),np.int64); remap[used]=np.arange(len(used)); Vk=V[used]; Fk=remap[RFk]
    # weights: nearest 6 of our posed vertices (inverse distance)
    tr=cKDTree(QA); dd,ix=tr.query(Vk,k=6); w=1/(dd+2e-3)**2; w/=w.sum(1,keepdims=True)
    Dm=np.zeros((len(Vk),24))
    for c in range(4):
        for t in range(6): np.add.at(Dm,(np.arange(len(Vk)),jj[ix[:,t],c]),w[:,t]*ww[ix[:,t],c])
    j2=np.argsort(-Dm,axis=1)[:,:4]; w2=np.take_along_axis(Dm,j2,1); w2/=w2.sum(1,keepdims=True)
    M=np.zeros((len(Vk),4,4))
    for k in range(4): M+=w2[:,k,None,None]*Sk[j2[:,k]]
    T=np.einsum('nij,nj->ni',np.linalg.inv(M),np.c_[Vk,np.ones(len(Vk))])[:,:3]
    # neck: the reference neck is thinner than the neck tube of our (smaller, anime) head piece, which starts at y ~ 1.568. Below that the neck is widened smoothly to the tube's size, so the two meet
    # with no ledge; above it the body neck simply stays inside the tube. A radial weight keeps the trapezius and shoulders untouched.
    sm=lambda x:(lambda t:t*t*(3-2*t))(np.clip(x,0,1)); y=T[:,1]
    nc=(np.abs(y-1.60)<.008)&(np.abs(T[:,0])<.075)&(T[:,2]<.095)
    hw_r=np.abs(T[nc][:,0]).max(); z0,z1=T[nc][:,2].min(),T[nc][:,2].max(); zc_r=(z0+z1)/2; zd_r=(z1-z0)/2
    hw_t,zc_t,zd_t=.064,.043,.047; print('neck ref hw %.3f zc %.3f zd %.3f -> %.3f %.3f %.3f'%(hw_r,zc_r,zd_r,hw_t,zc_t,zd_t))
    r=np.hypot(T[:,0],T[:,2]-zc_r); wr=1-sm((r-.06)/.07); g=sm((y-1.47)/.09)*wr
    kx=hw_t/hw_r; kz=zd_t/zd_r; tp=1-.30*sm((y-1.585)/.04)                  # wider than the head's neck tube where the tube begins (hides its rim), narrowing to inside the tube above
    T=T.copy(); T[:,0]*=(1+(kx-1)*g)*(1-(1-tp)*wr); T[:,2]=zc_r+(zc_t-zc_r)*g+(T[:,2]-zc_r)*(1+(kz-1)*g)*(1-(1-tp)*wr)
    zmax=np.interp(T[:,1],[1.56,1.575,1.605,1.64],[9,.108,.076,.076]); fr=(np.abs(T[:,0])<.08)&(T[:,2]>zc_t)               # the reference's low-hanging jaw/throat is folded back inside the head's neck tube (no hole, no ledge)
    T[:,2]=np.where(fr,np.minimum(T[:,2],zmax),T[:,2])
    sr=sm((T[:,1]-1.604)/.02)*(np.abs(T[:,0])<.08); T[:,0]*=1-.14*sr; T[:,2]=np.where(T[:,2]>zc_t-.0,T[:,2]-(T[:,2]-zc_t)*.10*sr,T[:,2])      # rim of the body neck drawn well inside the head's tube
    return T,Fk,j2,w2

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
    Q0=Q.copy()
    jj,ww=B.transfer_weights(Q,don); jj,ww=B.smooth_weights(Q,F,jj,ww,3); jj,ww=knn_smooth(Q,jj,ww); jj,ww=shoulder_ramp(Q,jj,ww); jj,ww=pit_smooth(Q,jj,ww)
    hand=[p for p in lv if 'hands' in p['mat']][0]
    T,Fk,jj,ww=body_from_ref(Q,F,jj,ww,wp,float(np.abs(hand['pos'][:,0]).max()))
    jj,ww=B.smooth_weights(T,Fk,jj,ww,8); jj,ww=knn_smooth(T,jj,ww); jj,ww=shoulder_ramp(T,jj,ww); jj,ww=pit_smooth(T,jj,ww)
    T=taubin_ref(T,Fk)
    import compose as C
    body=dict(mat='Skin_Body',pos=T,uv=np.full((len(T),2),.5,np.float32),ix=Fk.reshape(-1),jj=jj,ww=ww,srctex=None); body['nrm']=C.wnorm(T,Fk)
    return body,wp
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

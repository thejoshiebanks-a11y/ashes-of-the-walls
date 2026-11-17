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
    Q=taubin(Q,F)
    jj,ww=B.transfer_weights(Q,don); jj,ww=B.smooth_weights(Q,F,jj,ww,3)
    return dict(mat='Skin_Body',pos=Q,uv=UV,ix=F.reshape(-1),jj=jj,ww=ww,nrm=__import__('compose').wnorm(Q,F),srctex=None),wp
if __name__=='__main__':
    body,wp=make(); print(body['pos'].min(0),body['pos'].max(0))
    import pickle; pickle.dump((body,wp),open(S+'/w/g12/tmp/body.pkl','wb'))

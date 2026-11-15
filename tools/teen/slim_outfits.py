import sys,os,re,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from build_bases import read_pack, smooth_normals, OUT, assemble
LEG={'L':[1,2,3,4],'R':[5,6,7,8]}
BODY_RX=re.compile(r'^(Skin_Body|Fixed_Body)$'); CLOTH_RX=re.compile(r'^Outfit_')
def polyline(wp,side):
    j=LEG[side]; return np.array([wp[j[0]],wp[j[1]],wp[j[2]],wp[j[3]]])
def project(P,poly):
    """closest point on the 3-segment polyline; returns (t in [0,3), closest point)"""
    best_d=np.full(len(P),1e9); best_t=np.zeros(len(P)); best_c=np.zeros_like(P)
    for s in range(3):
        a=poly[s]; b=poly[s+1]; ab=b-a; u=np.clip(((P-a)@ab)/(ab@ab),0,1); c=a+u[:,None]*ab; d=np.linalg.norm(P-c,axis=1)
        m=d<best_d; best_d[m]=d[m]; best_t[m]=s+u[m]; best_c[m]=c[m]
    return best_t,best_c,best_d
def leg_side(p):
    """per vertex weight to the left / right leg joints"""
    J=p['jj']; W=p['ww']; wl=np.zeros(len(J)); wr=np.zeros(len(J))
    for k in range(4):
        wl+=np.where(np.isin(J[:,k],LEG['L']),W[:,k],0); wr+=np.where(np.isin(J[:,k],LEG['R']),W[:,k],0)
    return wl,wr
def body_radius(body,wp,side,bins=48):
    P=body['pos']; wl,wr=leg_side(body); w=wl if side=='L' else wr; m=w>.6
    poly=polyline(wp,side); t,c,d=project(P[m],poly); R=np.zeros(bins); 
    for i in range(bins):
        sel=(t>=i*3/bins)&(t<(i+1)*3/bins)
        R[i]=np.percentile(d[sel],92) if sel.sum()>8 else (R[i-1] if i else .06)
    # light smoothing
    k=np.ones(5)/5; Rp=np.pad(R,2,mode='edge'); return np.convolve(Rp,k,'valid')
def slim(prims,wp,body,margin=(.010,.014,.024),verbose=False):
    """pull leg cloth in towards the leg axis so trousers/boots hug the leg (cap = body radius + margin; margin thigh/shin/foot)"""
    out=[]; Rs={s:body_radius(body,wp,s) for s in 'LR'}; bins=len(Rs['L'])
    for p in prims:
        if not CLOTH_RX.match(p['mat']) or p['mat'].startswith('Outfit_Scout_Cloak') or 'Hood' in p['mat']: out.append(p); continue
        wl,wr=leg_side(p); P=p['pos'].copy(); n=len(P); changed=0
        for side,w in (('L',wl),('R',wr)):
            m=w>.35
            if not m.any(): continue
            poly=polyline(wp,side); t,c,d=project(P[m],poly); bi=np.clip((t/3*bins).astype(int),0,bins-1); R=Rs[side][bi]
            mg=np.where(t<1,margin[0],np.where(t<2,margin[1],margin[2]))
            cap=R+mg; ratio=np.where(d>cap,cap/np.maximum(d,1e-6),1.0)
            # blend in over the leg-weight so the waist keeps its shape
            bl=np.clip((w[m]-.35)/.4,0,1); ratio=1-(1-ratio)*bl
            v=P[m]; P[m]=c+(v-c)*ratio[:,None]; changed+=(ratio<.999).sum()
        q=dict(p); q['pos']=P
        F=np.asarray(p['ix']).reshape(-1,3); q['nrm']=smooth_normals(P,F); out.append(q)
        if verbose: print('  ',p['mat'],'pulled',changed,'of',n)
    return out
def slim_body(body,wp,f=.86):
    """slimmer legs: radial scale about each leg axis (blended by leg weight so the hips keep their shape)"""
    P=body['pos'].copy(); wl,wr=leg_side(body)
    for side,w in (('L',wl),('R',wr)):
        m=w>.3
        if not m.any(): continue
        t,c,d=project(P[m],polyline(wp,side)); bl=np.clip((w[m]-.3)/.4,0,1)
        # ankle/foot are left alone (shoes, toes): taper the effect out past the ankle
        fall=np.clip((2.35-t)/.5,0,1); k=1-(1-f)*bl*fall
        P[m]=c+(P[m]-c)*k[:,None]
    q=dict(body); q['pos']=P; q['nrm']=smooth_normals(P,np.asarray(body['ix']).reshape(-1,3)); return q
def flare_hems(prims,wp,texs):
    """upper garments hang OUTSIDE the trousers: tunic / skirt hems are pushed out radially (no trousers poking through the hem)"""
    out=[]; cx=wp[0][0]; cz=wp[0][2]
    for p in prims:
        m=p['mat']; P=p['pos'].copy()
        if m in ('Outfit_Peasant_Body','Outfit_Ranger_Body','Outfit_Scout_Body','Outfit_Dragon_Tops'):
            y=P[:,1]; hem=wp[0][1]+.06
            sel=y<hem
            if m=='Outfit_Scout_Body':
                im=np.asarray(texs[p['srctex']].convert('RGB')).astype(float); h,w,_=im.shape
                u=(p['uv'][:,0]%1*(w-1)).astype(int); v=(p['uv'][:,1]%1*(h-1)).astype(int); lum=im[v,u]@[.299,.587,.114]
                sel&=(lum<95)&(y>wp[0][1]-.45)
            k=np.clip((hem-y)/.14,0,1); k=k*k*(3-2*k); k=np.where(sel,k,0)*.034
            d=np.stack([P[:,0]-cx,np.zeros(len(P)),P[:,2]-cz],1); r=np.linalg.norm(d,axis=1,keepdims=True); d=d/np.maximum(r,1e-6)
            P=P+d*k[:,None]
        q=dict(p); q['pos']=P; q['nrm']=smooth_normals(P,np.asarray(p['ix']).reshape(-1,3)); out.append(q)
    return out

if __name__=='__main__':
    d,key,outd=sys.argv[1:4]
    prims,wp,texs=read_pack(os.path.join(d,key),key)
    body=next(p for p in prims if BODY_RX.match(p['mat']))
    sb=slim_body(body,wp); prims=[sb if p is body else p for p in prims]
    new=flare_hems(slim(prims,wp,sb,verbose=True),wp,texs)
    assemble(key,[(p,texs) for p in new],wp,outd)

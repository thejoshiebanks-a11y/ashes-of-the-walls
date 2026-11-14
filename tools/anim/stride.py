import numpy as np,sys
def qM(q):
    w,x,y,z=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def feet(D,Q,Yn,hipH=1.0,th=.5,ca=.5,hx=.09,loop=True):
    """foot (ankle) positions in heading frame relative to ground below pelvis; unit = leg length 1; hipH = pelvis height/leg"""
    out=[]
    for d,q,y in zip(D,Q,Yn):
        M=qM(q); r=[]
        for side,(i1,i2),sx in (('L',(12,15),1),('R',(18,21),-1)):
            t=d[i1:i1+3]; c=d[i2:i2+3]; p=M@(np.array([sx*hx,0,0])+t*th+c*ca)
            r.append(p+np.array([0,hipH*(1+y),0]))
        out.append(r)
    return np.array(out)   # frames,2,3
def stats(F,fps=30,n=None):
    n=len(F)-1; T=n/fps; res=[]
    for s in range(2):
        z=F[:n,s,2]; y=F[:n,s,1]; dz=np.gradient(np.r_[z[-1],z,z[0]])[1:-1]*fps/1.0 if False else (np.roll(z,-1)-np.roll(z,1))/2*fps
        low=y<=np.percentile(y,35); res.append((-np.median(dz[low]),np.std(dz[low]),y.min(),y.max()-y.min(),z.max()-z.min()))
    return res,T
if __name__=='__main__':
    exec(open('an_dec.py').read().split("if __name__")[0].replace("print(","(lambda *a:0)("))
    for nm in ('L:Standard Walk','L:Jog Forward','L:Sprint'):
        d,q,y=clip(nm); F=feet(d,q,y); r,T=stats(F); print(nm,'cycle',round(T,3),'stance speed (leg/s)',[round(x[0],2) for x in r],'sd',[round(x[1],2) for x in r],'lift',[round(x[3],2) for x in r],'steps/s',round(2/T,2) if 'Walk' in nm else '')
    z=np.load('anim/run.npz'); F=feet(z['D'],z['Q'],z['Yn']); r,T=stats(F); print('mixamo run cycle',T,'stance',[round(x[0],2) for x in r],'sd',[round(x[1],2) for x in r],'lift',[round(x[3],2) for x in r])

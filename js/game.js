(function(){
'use strict';
const P={g:18,reel:28,reelSp:16,boost:15,gasUse:12,gasRegen:7,drag:.05,dragFree:.14,steer:8,fovBase:1.12,fovGain:.55,maxLen:95,walk:.8,jog:2.5,sprint:4.9,jump:4.7,swim:1.7};
const PLS=.54,HH=.9*PLS,SC=.56,RAD=.26,SPAWN=[0,0,-38],WY=-3.5,BEDY=-6.2;
const SPH=[];let decals=[],dodgeT=0,bloodOv=0,aimD=0,lastWall=null,flipT=0,rollT=0,bu=[0,1,0],hitMsgT=0,hold=[false,false],slashT=0,slashCD=0,slow=1,slowT=0,hour=15.2,blades=4,dur=100,landT=0,fireT=[0,0],msg='',msgT=0,kills=0,hudTick=0;
let E,st,A=null,on=false,H=[0,1,0],v=[0,0,0],gas=100,grounded=true,hk=[{on:false},{on:false}],cam={pos:[0,5,0],target:[0,5,1],fov:1.12},face=[0,0,1],lean=0,spd=0,fov=1.12,shake=0,prev=[0,0,0];
const K={},T={reel:0,out:0,gas:0,brake:0};let sv=[0,0],parts=[],hud=null,aimOK=[false,false],tick=0;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),nrm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function gh(x,z){const Tn=E.J.terrain;if(!Tn)return 0;let h=0;for(const b of Tn.bumps){const d2=((x-b[0])**2+(z-b[1])**2)/(b[2]*b[2]);if(d2<1)h+=b[3]*(1-d2)**2}
 for(const t of Tn.terr){const u=x-t.c[0],w=-(z-t.c[1]);if(w>=t.v0&&w<=t.v1){const q=Math.max(0,Math.min(1,(t.hu+.8-Math.abs(u))/1.6));if(q>0)h=Math.max(h,t.H*Math.min(1,(w-t.v0)/t.L)*q)}}return h}
// ---------- world triangles (anchor + collision surfaces)
function build(){const J=E.J,vf=new Float32Array(E._vb.buffer,E._vb.byteOffset,J.vbytes>>2),ib=E._ib,inst=E._inst;
 const skip=/^(tuft|flower|figure|boat|wt_|canal_bed|canal_fence|canal_cop|mill_cl|mk_sack|prop_sacks|mk_stall_[2-8]$)/;
 const CS=24,GW=70,O=-840,cells=new Map(),I=[];
 for(const d of J.draws){if(d.over)continue;const g=J.geoms[d.g],m=J.mats[g.mat];g.nm=d.g;if(m.kind>=2||m.cut>0||skip.test(d.g))continue;const b=g.bb;
  if(Math.max(b[3]-b[0],b[4]-b[1],b[5]-b[2])<.9)continue;g.lo=b.slice(0,3);g.hi=b.slice(3);
  for(const c of d.chunks)for(let k=0;k<c.n;k++){const o=(c.o+k)*16,lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
   for(let q=0;q<8;q++){const x=q&1?b[3]:b[0],y=q&2?b[4]:b[1],z=q&4?b[5]:b[2];
    for(let r=0;r<3;r++){const w=inst[o+r*4]*x+inst[o+r*4+1]*y+inst[o+r*4+2]*z+inst[o+r*4+3];if(w<lo[r])lo[r]=w;if(w>hi[r])hi[r]=w}}
   const id=I.length;I.push({g,o,lo,hi,inv:null});
   for(let ix=Math.floor((lo[0]-O)/CS);ix<=Math.floor((hi[0]-O)/CS);ix++)for(let iz=Math.floor((lo[2]-O)/CS);iz<=Math.floor((hi[2]-O)/CS);iz++){if(ix<0||iz<0||ix>=GW||iz>=GW)continue;const key=ix+iz*GW;let l=cells.get(key);if(!l)cells.set(key,l=[]);l.push(id)}}}
 A={vf,ib,inst,I,cells,CS,GW,O,stamp:new Int32Array(I.length),sc:0}}
function inv(o){const m=A.inst,a=m[o],b=m[o+1],c=m[o+2],d=m[o+4],e=m[o+5],f=m[o+6],g=m[o+8],h=m[o+9],i=m[o+10];
 const A0=e*i-f*h,A1=c*h-b*i,A2=b*f-c*e,det=a*A0+d*A1+g*A2||1e-9,s=1/det;
 return[A0*s,A1*s,A2*s,(f*g-d*i)*s,(a*i-c*g)*s,(c*d-a*f)*s,(d*h-e*g)*s,(b*g-a*h)*s,(a*e-b*d)*s,m[o+3],m[o+7],m[o+11]]}
function slab(o,d,lo,hi,tm){let t0=0,t1=tm;for(let k=0;k<3;k++){const di=d[k];if(Math.abs(di)<1e-9){if(o[k]<lo[k]||o[k]>hi[k])return false}else{let a=(lo[k]-o[k])/di,b=(hi[k]-o[k])/di;if(a>b){const q=a;a=b;b=q}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false}}return true}
function cast(o,d,maxT){const a0=cast0(o,d,maxT),b0=SPH.length?sph(o,d,a0?a0.t:maxT):null;return b0||a0}
function cast0(o,d,maxT){const a=A,{CS,GW,O}=a;a.sc++;const cand=[],ns=Math.ceil(maxT/6);
 for(let s=0;s<=ns;s++){const t=Math.min(maxT,s*6),ix=Math.floor((o[0]+d[0]*t-O)/CS),iz=Math.floor((o[2]+d[2]*t-O)/CS);if(ix<0||iz<0||ix>=GW||iz>=GW)continue;
  const l=a.cells.get(ix+iz*GW);if(l)for(const id of l)if(a.stamp[id]!==a.sc){a.stamp[id]=a.sc;cand.push(id)}}
 let best=maxT,bi=-1,bk=-1;const vf=a.vf,ib=a.ib;
 for(const id of cand){const it=a.I[id];if(!slab(o,d,it.lo,it.hi,best))continue;if(!it.inv)it.inv=inv(it.o);const M=it.inv;
  const qx=o[0]-M[9],qy=o[1]-M[10],qz=o[2]-M[11];const lo_=[M[0]*qx+M[1]*qy+M[2]*qz,M[3]*qx+M[4]*qy+M[5]*qz,M[6]*qx+M[7]*qy+M[8]*qz],
  ld=[M[0]*d[0]+M[1]*d[1]+M[2]*d[2],M[3]*d[0]+M[4]*d[1]+M[5]*d[2],M[6]*d[0]+M[7]*d[1]+M[8]*d[2]];
  const g=it.g;if(!slab(lo_,ld,g.lo,g.hi,best))continue;const ox=lo_[0],oy=lo_[1],oz=lo_[2],dx=ld[0],dy=ld[1],dz=ld[2],e=g.i+g.in;
  for(let k=g.i;k<e;k+=3){const i0=(g.v+ib[k])*9,i1=(g.v+ib[k+1])*9,i2=(g.v+ib[k+2])*9,ax=vf[i0],ay=vf[i0+1],az=vf[i0+2];
   const e1x=vf[i1]-ax,e1y=vf[i1+1]-ay,e1z=vf[i1+2]-az,e2x=vf[i2]-ax,e2y=vf[i2+1]-ay,e2z=vf[i2+2]-az;
   const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;if(det>-1e-9&&det<1e-9)continue;const idt=1/det;
   const tx=ox-ax,ty=oy-ay,tz=oz-az,u=(tx*px+ty*py+tz*pz)*idt;if(u<0||u>1)continue;
   const qx2=ty*e1z-tz*e1y,qy2=tz*e1x-tx*e1z,qz2=tx*e1y-ty*e1x,w=(dx*qx2+dy*qy2+dz*qz2)*idt;if(w<0||u+w>1)continue;
   const t=(e2x*qx2+e2y*qy2+e2z*qz2)*idt;if(t>1e-4&&t<best){best=t;bi=id;bk=k}}}
 if(bi<0)return null;const it=a.I[bi],m=a.inst,g=it.g,W=[];
 for(let j=0;j<3;j++){const i0=(g.v+ib[bk+j])*9,x=vf[i0],y=vf[i0+1],z=vf[i0+2];W.push([m[it.o]*x+m[it.o+1]*y+m[it.o+2]*z+m[it.o+3],m[it.o+4]*x+m[it.o+5]*y+m[it.o+6]*z+m[it.o+7],m[it.o+8]*x+m[it.o+9]*y+m[it.o+10]*z+m[it.o+11]])}
 let n=nrm(cross([W[1][0]-W[0][0],W[1][1]-W[0][1],W[1][2]-W[0][2]],[W[2][0]-W[0][0],W[2][1]-W[0][1],W[2][2]-W[0][2]]));if(dot(n,d)>0)n=[-n[0],-n[1],-n[2]];
 return{t:best,p:[o[0]+d[0]*best,o[1]+d[1]*best,o[2]+d[2]*best],n,nm:g.nm}}

function sph(o,d,mx){let best=mx,r=null;for(const q of SPH){const L=[q.c[0]-o[0],q.c[1]-o[1],q.c[2]-o[2]],tc=dot(L,d);if(tc<0)continue;const d2=dot(L,L)-tc*tc;if(d2>q.r*q.r)continue;const t=tc-Math.sqrt(q.r*q.r-d2);if(t>1e-3&&t<best){best=t;const p=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t];r={t,p,n:nrm([p[0]-q.c[0],p[1]-q.c[1],p[2]-q.c[2]]),titan:q.nape?'nape':'body'}}}return r}
// ---------- gameplay
function dirYP(yaw,pit){const c=Math.cos(pit);return[Math.sin(yaw)*c,Math.sin(pit),Math.cos(yaw)*c]}
function aim(i){const yw=st.wyaw+(i?-.06:.06),pt=st.wpitch,cp=cam.pos,dc=len([H[0]-cp[0],H[1]-cp[1],H[2]-cp[2]]);
 const tries=[[0,0],[0,.12],[.12,0],[-.12,0],[0,-.1],[.2,.15],[-.2,.15],[0,.28],[.3,0],[-.3,0]];let best=null;
 for(const [dy,dp] of tries){const d=dirYP(yw+dy,pt+dp),o=[cp[0]+d[0]*dc,cp[1]+d[1]*dc,cp[2]+d[2]*dc],h=cast(o,d,P.maxLen+10);
  if(h){const dist=len([h.p[0]-H[0],h.p[1]-H[1],h.p[2]-H[2]]);if(dist<=P.maxLen&&dist>2){const sc=dist+Math.hypot(dy,dp)*60-Math.max(0,Math.min(25,h.p[1]-H[1]))*.8;if(!best||sc<best.sc)best={h,sc,dist};if(!dy&&!dp)break}}}
 return best}
function fire(i){if(window.__noOdm)return;cling=0;const b=aim(i);if(!b){hk[i]={on:false,miss:.3};return}let h=b.h;{const dd=nrm([h.p[0]-H[0],h.p[1]-H[1],h.p[2]-H[2]]),c2=cast(H,dd,b.dist-.05);if(c2){h=c2;b.dist=c2.t}}const a=[h.p[0]+h.n[0]*.12,h.p[1]+h.n[1]*.12,h.p[2]+h.n[2]*.12];
 hk[i]={on:true,a,n:h.n,len:b.dist,age:0,tt:Math.min(.45,.04+b.dist/200),att:false,tg:h.titan};if(h.titan){let bq=null,bd_=1e9;for(const q of SPH){const dd=Math.hypot(a[0]-q.c[0],a[1]-q.c[1],a[2]-q.c[2])-q.r;if(dd<bd_){bd_=dd;bq=q}}if(bq){hk[i].sp=bq;hk[i].off=[a[0]-bq.c[0],a[1]-bq.c[1],a[2]-bq.c[2]]}}fireT[i]=.4;{const o=ropeOrigin(i),n=nrm([a[0]-o[0],a[1]-o[1],a[2]-o[2]]);burst(o,n,[1,1,1],3,6,.14,.4,-1,.65,.8,3.5)}}
function gasPuff(o,n){burst(o,n,[1,1,1],1,3.4,.26,.55,-.4,.5,3.6,0);burst(o,n,[.93,.95,.99],1,1.5,.42,1.7,-.9,.26,4.2,0);if(tick%2===0)burst(o,n,[1,1,1],1,6.5,.14,.22,0,.55,1.4,0)}
function canalD(x,z){const pts=E.J.canalPath.pts;let best=1e9,bx=0,bz=0;for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),cx=a[0]+dx*t,cz=a[1]+dz*t,d=Math.hypot(x-cx,z-cz);if(d<best){best=d;bx=cx;bz=cz}}return{d:best,cx:bx,cz:bz}}
const canalHW=(x,z)=>(x>-190&&x<258&&z>-104&&z<2.5)?7.9:5.9;
function inCanal(x,z){if(!E.J.canalPath)return false;if(x<-400||x>400||z<-140||z>250)return false;const c=canalD(x,z);return c.d<canalHW(x,z)}
function floorY(){const h=cast([H[0],H[1]+.5,H[2]],[0,-1,0],40);const g=gh(H[0],H[2]);let y=h?Math.max(g,h.p[1]):g;if(inCanal(H[0],H[2])){if(!(h&&h.nm==='bridges'&&h.p[1]>-1.2))y=BEDY}return y}
function splash(p,n,pw){const k=Math.min(1,pw/12);burst(p,[0,1,0],[.82,.9,.96],6+Math.floor(14*k),2+4*k,.16,.9,-9,.75,2.2,0);burst(p,[0,1,0],[1,1,1],3+Math.floor(8*k),1.5+3*k,.3,1.1,-3,.5,3,0)}
function step(dt){if(lastWall)lastWall.t+=dt;
 if(cling>0){cling-=dt;if(T.gas||K.ShiftLeft||K.Space){cling=0}else{v=[0,0,0];grounded=false;return}}
 if(vlt){vlt.t+=dt;const u=Math.min(1,vlt.t/vlt.d),e=u*u*(3-2*u);H=[vlt.a[0]+(vlt.b[0]-vlt.a[0])*e,vlt.a[1]+(vlt.b[1]-vlt.a[1])*(1-Math.pow(1-u,2.2))+Math.sin(u*Math.PI)*.35,vlt.a[2]+(vlt.b[2]-vlt.a[2])*e];v=[vlt.vx*u,2.5*(1-u),vlt.vz*u];grounded=false;if(u>=1){v=[vlt.vx,2,vlt.vz];vlt=null}return}
 for(const h of hk)if(h.on&&!h.att){h.age+=dt;if(h.age>=h.tt){h.att=true;yankT=1;h.len=Math.max(3,len([h.a[0]-H[0],h.a[1]-H[1],h.a[2]-H[2]]));const n=nrm([h.a[0]-H[0],h.a[1]-H[1],h.a[2]-H[2]]);for(let k=0;k<3;k++)v[k]+=n[k]*3.5;h.wob=1.3;const imp=Math.max(0,-(v[0]*0+0)+len(v));const nrmA=h.n||[0,1,0];if(!h.tg&&Math.random()<.22+Math.min(.5,imp/70)){debris(h.a,nrmA,2+Math.floor(imp/9),.6+imp/40);burst(h.a,nrmA,[.7,.66,.6],4,2.5,.3,.6,-.6,.4)}else burst(h.a,nrmA,[.75,.72,.66],2,1.5,.2,.4,-.6,.3);if(Math.random()<.5)burst(h.a,nrmA,[1,.86,.5],4,8,.045,.22,12,1,.1,3);shake=Math.min(1,shake+.18+imp/120)}}
 const cy=st.wyaw,fw=[Math.sin(cy),0,Math.cos(cy)],rt=[-Math.cos(cy),0,Math.sin(cy)];
 const mf=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0)-sv[1],ms=(K.KeyD||K.ArrowRight?1:0)-(K.KeyA||K.ArrowLeft?1:0)+sv[0];const ml=Math.hypot(mf,ms),mn=ml>1?1/ml:1;
 const wish=[(fw[0]*mf+rt[0]*ms)*mn,0,(fw[2]*mf+rt[2]*ms)*mn],hooked=(hk[0].on&&hk[0].att)||(hk[1].on&&hk[1].att);
 const reel=K.Space||T.reel||hooked,out=K.ControlLeft||K.KeyC||T.out,gasOn=!window.__noOdm&&(((K.ShiftLeft||K.ShiftRight)&&!grounded)||T.gas)&&gas>0,brake=K.KeyX||T.brake;gasFx=!!gasOn;
 if(grounded&&!hooked){const sprint=K.ShiftLeft||K.ShiftRight||ml>.93&&!(K.KeyW||K.KeyA||K.KeyS||K.KeyD),sp=ml<.04?0:ml<.4?P.walk*(ml/.4):sprint?P.sprint:ml<.92||(K.KeyW||K.KeyA||K.KeyS||K.KeyD)?P.jog:P.sprint,wd=ml>1e-3?[wish[0]/(ml>1?1:ml)*1,0,wish[2]/(ml>1?1:ml)*1]:[0,0,0],tv=[wd[0]*sp,0,wd[2]*sp],k=Math.min(1,dt*(ml>.05?7:9));
  const hs=Math.hypot(v[0],v[2]);if(dodgeT>0){dodgeT-=dt}else if(hs>P.sprint+2){const f=Math.exp(-dt*1.4);v[0]*=f;v[2]*=f}else{v[0]+=(tv[0]-v[0])*k;v[2]+=(tv[2]-v[2])*k}
  if(K.Space&&!T.jumped){v[1]=P.jump;grounded=false}}
 else{v[1]-=P.g*dt;const s=hooked?P.steer*1.6:P.steer;v[0]+=wish[0]*s*dt;v[2]+=wish[2]*s*dt}
 if(hooked&&len(v)>12&&tick%2===0){const q=nrm(v);burst([H[0]+q[0]*.6,H[1]+q[1]*.6,H[2]+q[2]*.6],[-q[0],-q[1],-q[2]],[1,1,1],1,6,.06,.26,0,.1,.2,5)}
 for(const h of hk)if(h.on&&h.sp&&titan&&!titan.dead){h.a=[h.sp.c[0]+h.off[0],h.sp.c[1]+h.off[1],h.sp.c[2]+h.off[2]]}
 {const th=hk.find(h=>h.on&&h.att&&h.tg&&h.sp);if(th&&titan&&!titan.dead&&!grounded&&!grab){const N=SPH.find(q=>q.nape);if(N){const F_=[Math.sin(titan.yaw),0,Math.cos(titan.yaw)],Tn=[N.c[0]-F_[0]*1.15,N.c[1]+.35,N.c[2]-F_[2]*1.15],dd_=[Tn[0]-H[0],Tn[1]-H[1],Tn[2]-H[2]],dl=len(dd_);if(dl>.6){const ac=Math.min(1,dl/5)*(gasOn?34:20);for(let k=0;k<3;k++)v[k]+=dd_[k]/dl*ac*dt}}}}
 for(const h of hk)if(h.on&&h.att){const d0=[h.a[0]-H[0],h.a[1]-H[1],h.a[2]-H[2]],d=len(d0),n=[d0[0]/d,d0[1]/d,d0[2]/d];h.age+=dt;
  if(reel&&d>(h.tg?3.2:(h.n&&h.n[1]<.55)?2.4:6)){h.len=Math.max(h.tg?2.6:4,Math.min(h.len,d)-P.reelSp*dt);const bo=h.age<h.tt+.5?1.5:1;for(let k=0;k<3;k++)v[k]+=n[k]*P.reel*bo*dt;const vs=len(v);if(vs>34){for(let k=0;k<3;k++)v[k]*=34/vs}{if(h.n&&h.n[1]<.55&&!h.tg){const vm=8+d*1.6,vs2=len(v);if(vs2>vm)for(let k=0;k<3;k++)v[k]*=vm/vs2}}}
  else if(reel&&!h.tg&&!h.arr&&d<=((h.n&&h.n[1]<.55)?2.4:6)){h.arr=true;const nn=h.n||[0,1,0],hv=nrm([v[0],0,v[2]]),roof=nn[1]>=.55,led=!roof&&!cast([h.a[0]+nn[0]*.1,h.a[1]+1.8,h.a[2]+nn[2]*.1],[-nn[0],0,-nn[2]],2.5);
   if(!roof&&!led){cling=2.4;clingN=nn;v=[0,0,0];h.on=false;burst(h.a,nn,[.8,.76,.7],4,2,.3,.5,-.4,.3);shake=.4}
   else{v[1]=Math.max(v[1]*.6,led?7.5:5.5);v[0]+=hv[0]*(led?4:2.5);v[2]+=hv[2]*(led?4:2.5);burst(h.a,nn,[.8,.76,.7],3,2,.3,.5,-.4,.3);h.on=false;const sm=Math.hypot(v[0],v[2]);if(sm>9&&!pend&&!LV.one)pend=[pick(['L:Front Flip','L:Stylish Flip']),1.5]}}
  if(out)h.len=Math.min(P.maxLen,h.len+P.reelSp*dt)}
 if(gasOn){const d=dirYP(st.wyaw,st.wpitch),d2=nrm([d[0],d[1]+.6,d[2]]);for(let k=0;k<3;k++)v[k]+=d2[k]*P.boost*dt;gas=Math.max(0,gas-P.gasUse*dt);shake=Math.min(1,shake+dt*2);
  {const cy=st.wyaw,sd=[Math.cos(cy)*.1,0,-Math.sin(cy)*.1];for(const g of[1,-1]){const o=[H[0]+sd[0]*g-d[0]*.25,H[1]-.07,H[2]+sd[2]*g-d[2]*.25];gasPuff(o,[-d[0],-d[1]*.4-.15,-d[2]])}}}else shake=Math.max(0,shake-dt*3);
 if(brake&&gas>0){const f=Math.exp(-dt*3);for(let k=0;k<3;k++)v[k]*=f;gas=Math.max(0,gas-6*dt)}
 const kd=hooked?P.drag:(grounded?.02:P.dragFree),sp=len(v);let f=Math.exp(-dt*(kd+(sp>30?(sp-30)*.08:0)));for(let k=0;k<3;k++)v[k]*=f;
 if((grounded||swimming)&&gas<100)gas=Math.min(100,gas+P.gasRegen*dt);
 // move + collide
 const L=len(v)*dt;if(L>1e-4){const dn=nrm(v),h=probe(dn,L+RAD);if(h&&h.t<L+RAD){const k=h.t-RAD;if(k>0)for(let j=0;j<3;j++)H[j]+=dn[j]*k;const vn=dot(v,h.n);let vault=0,hv0=null;if(h.n[1]<.55&&-vn>2.2&&(hooked||!grounded)){hv0=nrm([v[0],0,v[2]]);for(const off of[1.3,2.5,3.8,5.2,7]){if(!cast([H[0],H[1]+off,H[2]],hv0,2.6)){vault=off;break}}}
  if(vault){vlt={t:0,d:.45,a:H.slice(),b:[H[0]+hv0[0]*1.5,H[1]+vault+1.1,H[2]+hv0[2]*1.5],vx:hv0[0]*6.5,vz:hv0[2]*6.5};pend=['L:Front Flip',1.6];burst(h.p,h.n,[.75,.72,.66],3,2,.3,.5,-.4,.3)}else for(let j=0;j<3;j++){v[j]-=h.n[j]*vn*1.1}
  for(let j=0;j<3;j++)H[j]+=h.n[j]*.02;if(!vault)lastWall={n:h.n,t:0};if(!vault&&-vn>20&&!pend)pend=['L:Wall Crash',1.4];if(!vault&&-vn>14){shake=Math.min(1,-vn/30);if(Math.random()<.35+Math.min(.5,-vn/50)){debris(h.p,h.n,3+Math.floor(-vn/8),-vn/22);burst(h.p,h.n,[.7,.66,.6],5,3,.4,.8,-.5,.4)}}}else for(let j=0;j<3;j++)H[j]+=v[j]*dt}
 // ropes
 for(const h of hk)if(h.on&&h.att){const d0=[h.a[0]-H[0],h.a[1]-H[1],h.a[2]-H[2]],d=len(d0),n=[d0[0]/d,d0[1]/d,d0[2]/d];
  if(d>h.len){for(let j=0;j<3;j++)H[j]=h.a[j]-n[j]*h.len;const vn=dot(v,n);if(vn<0)for(let j=0;j<3;j++)v[j]-=n[j]*vn}
  if(d>P.maxLen+5)h.on=false;else if(tick%2===0&&d>2.5){const b=(h.tg?cast0:cast)(H,n,d-1.3);if(b)h.on=false}}
 // ground

 swimming=false;
 if(!vlt&&cling<=0&&inCanal(H[0],H[2])){const hh=cast([H[0],H[1]+.5,H[2]],[0,-1,0],40),onBr=hh&&hh.nm==='bridges'&&hh.p[1]>-1.2;
  if(!onBr&&H[1]-HH*.4<WY+.3){swimming=true;
   if(!wasSw){wasSw=true;splash([H[0],WY+.05,H[2]],null,-v[1]);v[1]*=.1;v[0]*=.45;v[2]*=.45;pend=null;LV.one=false;grab=null;msg='IN THE CANAL — SWIM TO THE BANK, JUMP TO CLIMB OUT';msgT=2.8;shake=Math.min(1,shake+.4)}
   const sp_=Math.hypot(v[0],v[2]);let wx=wish[0],wz=wish[2];const ml_=Math.hypot(wx,wz);if(ml_>1e-3){v[0]+=wx*7*dt;v[2]+=wz*7*dt}const f_=Math.exp(-dt*(ml_>.05?1.6:3.2));v[0]*=f_;v[2]*=f_;const sp2=Math.hypot(v[0],v[2]);if(sp2>P.swim){v[0]*=P.swim/sp2;v[2]*=P.swim/sp2}
   const tgY=WY+HH*.62+Math.sin(performance.now()*.003)*.025;v[1]+=((tgY-H[1])*40-v[1]*7)*dt;H[1]+=v[1]*dt;
   if(tick%3===0&&sp2>.3)burst([H[0],WY+.04,H[2]],[0,1,0],[.85,.92,1],1,.9,.1,.6,-2.5,.5,2.4,0);if(tick%9===0)burst([H[0],WY+.03,H[2]],[0,1,0],[.9,.95,1],1,.3,.2,1,0,.3,4,0);
   const cD=canalD(H[0],H[2]),hw=canalHW(H[0],H[2]),toB=hw-cD.d;
   if(toB<2.2&&(K.Space||T.reel||ml_>.3&&true)&&(K.Space||T.reel||toB<1.1)){let nx=H[0]-cD.cx,nz=H[2]-cD.cz;const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;const tx=cD.cx+nx*(hw+1.3),tz=cD.cz+nz*(hw+1.3);if(ml_>.05&&(wx*nx+wz*nz)>-.1||K.Space||T.reel){vlt={t:0,d:.95,a:H.slice(),b:[tx,gh(tx,tz)+HH+.04,tz],vx:0,vz:0};pend=['L:Climbing Up Wall',1.9];swimming=false;burst([H[0],WY+.05,H[2]],[0,1,0],[.85,.92,1],8,2.5,.2,.8,-6,.7,2,0)}}
  }}
 if(!swimming)wasSw=false; const fy=floorY();if(!swimming&&H[1]-HH<=fy+.03){const imp=-v[1];if(!grounded&&imp>8){if(imp>11&&imp<34&&len([v[0],0,v[2]])>4.5){rollT=.55;pend=['L:Sprinting Forward Roll',1.35]}else if(imp>=34)pend=['L:Falling Flat Impact',1.4];else if(imp>20)pend=['L:Hard Landing',1.5];else{landT=Math.min(.5,.2+imp*.014);pend=['L:Falling To Landing',1.7]}if(imp>12)burst([H[0],H[1]-HH+.1,H[2]],[0,1,0],[.72,.64,.5],Math.min(10,3+imp*.25),2.5,.45,1,-.4,.4);if(imp>22)debris([H[0],H[1]-HH+.1,H[2]],[0,1,0],4,1)}H[1]=fy+HH;if(v[1]<0)v[1]=0;if(imp>30&&!brake){v[0]*=.5;v[2]*=.5;shake=1}grounded=true}else grounded=false;
 blockStep();if(H[1]<-20)respawn()}
function probe(dn,mx){const sd=nrm(cross(dn,[0,1,0])),sp=len(v);let best=cast(H,dn,mx);if(sp<.5)return best;
 const offs=[[sd[0]*.24,0,sd[2]*.24],[-sd[0]*.24,0,-sd[2]*.24],[0,-.38,0],[0,.34,0]];
 for(const o of offs){const h=cast([H[0]+o[0],H[1]+o[1],H[2]+o[2]],dn,mx);if(h&&(!best||h.t<best.t))best=h}return best}
function respawn(){if(titan&&titan.state==='grab'){titan.state='idle';titan.notice=-2;titan.cd=3}cling=0;vlt=null;swimming=false;wasSw=false;lockOn=false;LVHIDE=null;H=[SPAWN[0],gh(SPAWN[0],SPAWN[2])+HH+.05,SPAWN[2]];v=[0,0,0];hk=[{on:false},{on:false}];hold=[false,false];gas=100;grounded=true;grab=null;if(st){st.wyaw=0;st.wpitch=.05}}
// ---------- camera
let lastYaw=0,userYawT=0;
function grabCam(dt){const T=titan,g=grab,F=[Math.sin(T.yaw),0,Math.cos(T.yaw)],Lf=[Math.cos(T.yaw),0,-Math.sin(T.yaw)],C=g.fr?g.fr.C:H,hd=titanBone('Bip001 Head'),t=g.t,side=g.side||(g.side=(Math.random()<.5?1:-1));let ang,dist,hh,fv,tg;
 if(g.kind==='slam'){ang=side*(1.15-.2*Math.min(1,t/1.5));dist=5.6;hh=1.5;fv=.95;tg=[(C[0]+T.x)/2,Math.max(C[1],1.6)*.8+.5,(C[2]+T.z)/2]}
 else{const eat=g.kind==='bite'?sm01(GRB.raise0-.2,GRB.raise1,t):0,fin=g.kind==='bite'?sm01(GRB.bites[4]+.6,GRB.bites[4]+1.4,t):0;ang=side*(.5+.2*Math.sin(t*.3)+.1*eat);dist=(3.6-.3*Math.min(1,t/2.5))*(1-.2*eat)+fin*2.4;hh=.35+.2*eat;fv=.82-.1*eat;const bd=g.kind==='bite'?Math.max(0,1-Math.abs(t-GRB.bites[Math.min(4,g.n||0)])*2):0;dist*=1-.1*bd;tg=lp3(C,[hd[0]+F[0]*.15,hd[1]-.3,hd[2]+F[2]*.15],.45*eat+.15)}
 const want=[tg[0]+(F[0]*Math.cos(ang)+Lf[0]*Math.sin(ang))*dist,tg[1]+hh,tg[2]+(F[2]*Math.cos(ang)+Lf[2]*Math.sin(ang))*dist];let to=[want[0]-tg[0],want[1]-tg[1],want[2]-tg[2]];const L=len(to);to=[to[0]/L,to[1]/L,to[2]/L];const h=cast(tg,to,L+.3),tm=h?Math.max(.9,h.t-.4):L,tp=[tg[0]+to[0]*tm,tg[1]+to[1]*tm,tg[2]+to[2]*tm],k=1-Math.exp(-dt*(t<.3?20:6));
 for(let j=0;j<3;j++)cam.pos[j]+=(tp[j]-cam.pos[j])*k;{const gy=gh(cam.pos[0],cam.pos[2])+.4;if(cam.pos[1]<gy)cam.pos[1]=gy}const sh=shake*.03;cam.pos[0]+=(Math.random()-.5)*sh;cam.pos[1]+=(Math.random()-.5)*sh;
 cam.target=tg;fov+=(fv-fov)*Math.min(1,dt*3);cam.fov=fov;camDist=len([cam.pos[0]-H[0],cam.pos[1]-H[1],cam.pos[2]-H[2]]);st.wyaw=Math.atan2(tg[0]-cam.pos[0],tg[2]-cam.pos[2]);
 const q=window.ODM&&window.ODM.dbg;if(q){cam.pos=[H[0]+q[0],H[1]+q[1],H[2]+q[2]];cam.target=q.length>3?[q[3],q[4],q[5]]:[H[0],H[1]+.2,H[2]];cam.fov=.6;camDist=9}}
function camUpdate(dt){if(grab&&titan&&grab.fr){grabCam(dt);return}const sp=len(v);if(Math.abs(st.wyaw-lastYaw)>1e-5)userYawT=performance.now();if(sp>14&&!grab&&!lockOn&&performance.now()-userYawT>1500&&(hk[0].on||hk[1].on||!grounded)){const vy=Math.atan2(v[0],v[2]);let dy=vy-st.wyaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));st.wyaw+=dy*Math.min(1,dt*1.1)*Math.min(1,(sp-14)/18)}lastYaw=st.wyaw;const yaw=st.wyaw,pit=st.wpitch,d=dirYP(yaw,pit),dist=(grab?5.4:2.9)+Math.min(2.8,sp*.05),rt=[-Math.cos(yaw),0,Math.sin(yaw)],pv=[H[0],H[1]+.3,H[2]];
 let want=[pv[0]-d[0]*dist+rt[0]*.32,pv[1]-d[1]*dist+.28,pv[2]-d[2]*dist+rt[2]*.32];if(grab&&titan){const Ft=[Math.sin(titan.yaw),0,Math.cos(titan.yaw)],Rt=[Math.cos(titan.yaw),0,-Math.sin(titan.yaw)],sl=grab.kind==='slam',az=sl?1.25+.25*Math.sin(grab.t*.8):.42*Math.sin(grab.t*.38)+(grab.kind==='bite'?.22*grab.m:0),R_=sl?6.4:2.8,dy=sl?1.3:.05+.15*Math.sin(grab.t*.5);want=[pv[0]+(Ft[0]*Math.cos(az)+Rt[0]*Math.sin(az))*R_,pv[1]+dy,pv[2]+(Ft[2]*Math.cos(az)+Rt[2]*Math.sin(az))*R_]}let to=[want[0]-pv[0],want[1]-pv[1],want[2]-pv[2]];const L=len(to);to=[to[0]/L,to[1]/L,to[2]/L];
 let tm=L;for(const o of[[0,0,0],[rt[0]*.45,0,rt[2]*.45],[-rt[0]*.45,0,-rt[2]*.45],[0,.4,0],[0,-.35,0]]){const h=cast([pv[0]+o[0],pv[1]+o[1],pv[2]+o[2]],to,L+.3);if(h)tm=Math.min(tm,h.t-.35)}tm=Math.max(.45,tm);
 const tgt=[pv[0]+to[0]*tm,pv[1]+to[1]*tm,pv[2]+to[2]*tm],k=1-Math.exp(-dt*(grounded?30:Math.max(8,18-sp*.15)));for(let j=0;j<3;j++)cam.pos[j]+=(tgt[j]-cam.pos[j])*k;
 {const dv=[cam.pos[0]-pv[0],cam.pos[1]-pv[1],cam.pos[2]-pv[2]],dl=len(dv)||1,dn=[dv[0]/dl,dv[1]/dl,dv[2]/dl],h=cast(pv,dn,dl+.1);if(h&&h.t<dl+.05){const t2=Math.max(.45,h.t-.35);for(let j=0;j<3;j++)cam.pos[j]=pv[j]+dn[j]*t2}}
 for(const q of SPH){const dx=cam.pos[0]-q.c[0],dy=cam.pos[1]-q.c[1],dz=cam.pos[2]-q.c[2],dd=Math.hypot(dx,dy,dz),m=q.r+.5;if(dd<m&&dd>1e-3){const f=(m-dd)/dd;cam.pos[0]+=dx*f;cam.pos[1]+=dy*f;cam.pos[2]+=dz*f}}
 {let g=gh(cam.pos[0],cam.pos[2])+.55;if(swimming)g=Math.min(g,WY+.5);if(cam.pos[1]<g)cam.pos[1]=g}
 const tf=P.fovBase+Math.min(1,sp/70)*P.fovGain;fov+=(tf-fov)*Math.min(1,dt*4);
 const sh=shake*(.035+Math.min(.04,sp*.0005));cam.pos[0]+=(Math.random()-.5)*sh;cam.pos[1]+=(Math.random()-.5)*sh;
 cam.target=[H[0]+d[0]*20,H[1]+.6+d[1]*20,H[2]+d[2]*20];if(titan&&!titan.dead&&!grab){const N=SPH.find(q=>q.nape);if(N){const dd=Math.hypot(N.c[0]-H[0],N.c[2]-H[2]),pr=Math.max(0,Math.min(1,(32-dd)/24))*.32;for(let k=0;k<3;k++)cam.target[k]+=(N.c[k]-cam.target[k])*pr;fov+=(.06*pr)}}if(grab&&titan){const hd=titanBone('Bip001 Head');cam.target=[H[0]*.6+hd[0]*.4,H[1]*.6+hd[1]*.4+.2,H[2]*.6+hd[2]*.4];st.wyaw=Math.atan2(cam.target[0]-cam.pos[0],cam.target[2]-cam.pos[2]);fov+=((grab.kind==='slam'?.95:.82)-fov)*.1}cam.fov=fov;camDist=len([cam.pos[0]-H[0],cam.pos[1]-H[1],cam.pos[2]-H[2]]);
 const q=window.ODM&&window.ODM.dbg;if(q){cam.pos=[H[0]+q[0],H[1]+q[1],H[2]+q[2]];cam.target=q.length>3?[q[3],q[4],q[5]]:[H[0],H[1]+.2,H[2]];cam.fov=.6;camDist=9}}
// ---------- animation clips (retargeted from the uploaded Mixamo packs)
let AN=null,pend=null;
async function loadAnims(){const D=window.__ANIMS;if(!D)return;const bin=await new Response(new Blob([b64u8(D.bin)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();AN={meta:D.meta,i16:new Int16Array(bin),pi:{}};D.meta.pairs.forEach((p,i)=>AN.pi[p[0]]=i);AN.mir=D.meta.pairs.map(p=>{const n=p[0].indexOf(' L ')>=0?p[0].replace(' L ',' R '):p[0].indexOf(' R ')>=0?p[0].replace(' R ',' L '):p[0];return AN.pi[n]})}
const clipLen=n=>AN&&AN.meta.clips[n]?(AN.meta.clips[n].n-1)/30:1;
function mirrorPose(o){const m=AN.mir,t=o.d.slice();for(let i=0;i<m.length;i++){const j=m[i];o.d[i*3]=-t[j*3];o.d[i*3+1]=t[j*3+1];o.d[i*3+2]=t[j*3+2]}o.q=[o.q[0],o.q[1],-o.q[2],-o.q[3]]}
function newPose(){return{d:new Float32Array(45),q:[1,0,0,0],y:0}}
function clipPose(name,t,loop,o){const c=AN.meta.clips[name];if(!c){return}const n=c.n;let f=t*30;if(loop)f=f%(n-1);else f=Math.min(f,n-1);const i0=Math.floor(f),i1=loop?((i0+1)%(n-1)):Math.min(n-1,i0+1),k=f-i0,b=c.o/2,Q=b+n*45,Y=b+n*49,s=AN.i16;
 for(let j=0;j<45;j++)o.d[j]=(s[b+i0*45+j]*(1-k)+s[b+i1*45+j]*k)/32767;let q=[0,0,0,0],l=0;for(let j=0;j<4;j++){q[j]=(s[Q+i0*4+j]*(1-k)+s[Q+i1*4+j]*k)/32767;l+=q[j]*q[j]}l=Math.sqrt(l)||1;o.q=q.map(x=>x/l);o.y=(s[Y+i0]*(1-k)+s[Y+i1]*k)/10000}
function blendPose(a,b,w,o){for(let j=0;j<45;j++)o.d[j]=a.d[j]*(1-w)+b.d[j]*w;let d=a.q[0]*b.q[0]+a.q[1]*b.q[1]+a.q[2]*b.q[2]+a.q[3]*b.q[3],sg=d<0?-1:1,q=[0,0,0,0],l=0;for(let j=0;j<4;j++){q[j]=a.q[j]*(1-w)+b.q[j]*w*sg;l+=q[j]*q[j]}l=Math.sqrt(l)||1;o.q=q.map(x=>x/l);o.y=a.y*(1-w)+b.y*w}
class Anim{constructor(){this.cur=null;this.t=0;this.loop=true;this.rate=1;this.prev=null;this.pt=0;this.f=1;this.fd=.15;this.one=false;this.A=newPose();this.B=newPose();this.O=newPose()}
 play(n,loop,rate,fd,mir){if(n===this.cur&&loop&&this.loop&&!!mir===!!this.mir)return;this.pmir=this.mir;this.mir=!!mir;this.prev=this.cur;this.pt=this.t;this.cur=n;this.t=0;this.loop=loop;this.rate=rate||1;this.f=0;this.fd=fd||.15;this.one=!loop}
 done(){return this.one&&this.t>=clipLen(this.cur)-.02}
 get(dt,proc){if(!AN||!this.cur)return null;this.t+=dt*this.rate;if(this.f<1)this.f=Math.min(1,this.f+dt/this.fd);const sm=(n,t,l,o,m)=>{n==='FLIGHT'?proc(o):n==='GAIT'?gaitProc(o):n==='HELD'?heldProc(o):n==='SWIM'?swimProc(o):clipPose(n,t,l,o);if(m)mirrorPose(o)};sm(this.cur,this.t,this.loop,this.A,this.mir);
  if(this.f<1&&this.prev){sm(this.prev,this.pt,true,this.B,this.pmir);const w=this.f*this.f*(3-2*this.f);blendPose(this.B,this.A,w,this.O);return this.O}return this.A}}
function toDirs(p,up){up=up||0;const D={};for(const pr of AN.meta.pairs){const nm=pr[0],i=AN.pi[nm]*3;let x=p.d[i],y=p.d[i+1],z=p.d[i+2];if(nm.indexOf('Thigh')>=0||nm.indexOf('Calf')>=0){const sd=nm.indexOf(' L ')>=0?1:-1,inw=x*sd,old=sd*(inw>0?inw*.12:inw*.35);x=old*(1-up)+sd*.03*up}else if(up>0&&/Spine|Neck|Pelvis/.test(nm)){x*=1-.85*up}D[nm]=[x,y,z]}return D}
function relModel(R,U,F,o,p,py){const [w,x,y,z]=p.q,m=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
 if(p.k>0){const Fx=[m[2],m[5],m[8]],R0=[m[0],m[3],m[6]];let R1=cross([0,1,0],Fx);const l1=len(R1);if(l1>.2){R1=[R1[0]/l1,R1[1]/l1,R1[2]/l1];let Rb=[R0[0]+(R1[0]-R0[0])*p.k,R0[1]+(R1[1]-R0[1])*p.k,R0[2]+(R1[2]-R0[2])*p.k];const dF=dot(Rb,Fx);Rb=nrm([Rb[0]-Fx[0]*dF,Rb[1]-Fx[1]*dF,Rb[2]-Fx[2]*dF]);const Ub=cross(Fx,Rb);m[0]=Rb[0];m[3]=Rb[1];m[6]=Rb[2];m[1]=Ub[0];m[4]=Ub[1];m[7]=Ub[2]}}
 const col=(a,b,c)=>[R[0]*a+U[0]*b+F[0]*c,R[1]*a+U[1]*b+F[1]*c,R[2]*a+U[2]*b+F[2]*c],Rn=col(m[0],m[3],m[6]),Un=col(m[1],m[4],m[7]),Fn=col(m[2],m[5],m[8]),sh=col(-py*m[1],py-py*m[4],-py*m[7]);
 return modelMat(Rn,Un,Fn,[o[0]+sh[0]+U[0]*p.y*py,o[1]+sh[1]+U[1]*p.y*py,o[2]+sh[2]+U[2]*p.y*py],1)}
// ---------- skinned models (Levi, titan)
const MD={};let gp=null;
const b64u8=b=>{if(b instanceof Uint8Array)return b;const t=atob(b),a=new Uint8Array(t.length);for(let i=0;i<t.length;i++)a[i]=t.charCodeAt(i);return a};
const m4=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o};
function arc(a,b){const v=cross(a,b),c=dot(a,b);if(c<-.9999){const p=Math.abs(a[0])<.9?[1,0,0]:[0,1,0],u=nrm(cross(a,p));return[2*u[0]*u[0]-1,2*u[0]*u[1],2*u[0]*u[2],2*u[0]*u[1],2*u[1]*u[1]-1,2*u[1]*u[2],2*u[0]*u[2],2*u[1]*u[2],2*u[2]*u[2]-1]}
 const k=1/(1+c),x=v[0],y=v[1],z=v[2];return[1+k*(-y*y-z*z),-z+k*x*y,y+k*x*z,z+k*x*y,1+k*(-x*x-z*z),-x+k*y*z,-y+k*x*z,x+k*y*z,1+k*(-x*x-y*y)]}
function rotW(w,A,ang){const c=Math.cos(ang),s=Math.sin(ang),x=A[0],y=A[1],z=A[2],Rr=[c+x*x*(1-c),x*y*(1-c)-z*s,x*z*(1-c)+y*s,y*x*(1-c)+z*s,c+y*y*(1-c),y*z*(1-c)-x*s,z*x*(1-c)-y*s,z*y*(1-c)+x*s,c+z*z*(1-c)];for(let k=0;k<3;k++){const a=w[k*4],b=w[k*4+1],d=w[k*4+2];w[k*4]=Rr[0]*a+Rr[1]*b+Rr[2]*d;w[k*4+1]=Rr[3]*a+Rr[4]*b+Rr[5]*d;w[k*4+2]=Rr[6]*a+Rr[7]*b+Rr[8]*d}}
async function loadModel(key){const D=window.__MODELS&&window.__MODELS[key];if(!D||!gl)return;const meta=D.meta;
 const bin=await new Response(new Blob([b64u8(D.bin)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
 const J=meta.joints,M={J,par:meta.parents,names:meta.names,prims:[],tex:[],W:[],rootW:new Float32Array(meta.rootW),aims:{}};
 M.loc=new Float32Array(bin.slice(meta.locOff,meta.locOff+J*64));M.ibm=new Float32Array(bin.slice(meta.ibmOff,meta.ibmOff+J*64));
 M.kids=meta.parents.map(()=>[]);meta.parents.forEach((p,i)=>{if(p>=0)M.kids[p].push(i)});
 const ord=[],vis=(i)=>{ord.push(i);M.kids[i].forEach(vis)};meta.parents.forEach((p,i)=>{if(p<0)vis(i)});M.order=ord;
 M.id=n=>M.names.findIndex(x=>x===n||x.startsWith(n+'_'));
 const mk=(t,d,u)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b};
 for(const p of meta.prims){const o=p.o,n=p.n,sl=(a,l)=>bin.slice(a,a+l);const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const at=(loc,buf,sz,ty,nm,int,str)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(loc);int?gl.vertexAttribIPointer(loc,sz,ty,0,0):gl.vertexAttribPointer(loc,sz,ty,nm,str||0,0)};
  at(gp.a.p,mk(0,new Float32Array(sl(o[0],n*12))),3,gl.FLOAT,false);at(gp.a.n,mk(0,new Int8Array(sl(o[1],n*4))),3,gl.BYTE,true,false,4);at(gp.a.uv,mk(0,new Float32Array(sl(o[2],n*8))),2,gl.FLOAT,false);
  at(gp.a.jj,mk(0,new Uint8Array(sl(o[3],n*4))),4,gl.UNSIGNED_BYTE,false,true);at(gp.a.ww,mk(0,new Uint8Array(sl(o[4],n*4))),4,gl.UNSIGNED_BYTE,true);
  const u32=n>=65536,ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,u32?new Uint32Array(sl(o[5],p.ni*4)):new Uint16Array(sl(o[5],p.ni*2)),gl.STATIC_DRAW);
  gl.bindVertexArray(null);M.prims.push({vao,ni:p.ni,ty:u32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,tex:p.tex,mat:p.mat})}
 for(const b of D.tex){const bm=await createImageBitmap(new Blob([b64u8(b)],{type:'image/webp'})),t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bm);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);{const an=gl.getExtension('EXT_texture_filter_anisotropic');if(an)gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,8)}M.tex.push(t)}
 const bt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,bt);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,4,128,0,gl.RGBA,gl.FLOAT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);M.bt=bt;M.S=new Float32Array(J*16);
 const pairs=AN?AN.meta.pairs:[]; M.ac={};for(const [a,b] of pairs){const i=M.id(a),k=M.id(b);if(i>=0&&k>=0)M.ac[i]=k}
 M.pose=(dirs)=>{ // dirs: {boneName: [x,y,z]} (pelvis frame); legs get roll + flat-foot constraints
  const tg={};for(const k in dirs){const i=M.id(k);if(i>=0)tg[i]=nrm(dirs[k])}
  for(const i of M.order){let L=M.loc.subarray(i*16,i*16+16);{const ci=M.lcIdx&&M.lcIdx[i];if(ci&&M.lc[ci.side]>0){const a=ci.sg*ci.ang*M.lc[ci.side]*(1+.08*(1-(M.lcA||0))*Math.sin((M.lcT||0)*2.4+i*.9)),c_=Math.cos(a),s_=Math.sin(a),R4=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);if(ci.ax===0){R4[5]=c_;R4[6]=s_;R4[9]=-s_;R4[10]=c_}else if(ci.ax===1){R4[0]=c_;R4[2]=-s_;R4[8]=s_;R4[10]=c_}else{R4[0]=c_;R4[1]=s_;R4[4]=-s_;R4[5]=c_}L=m4(L,R4)}}const P=M.par[i]<0?M.rootW:M.W[M.par[i]],w=m4(P,L);M.W[i]=w;const t=tg[i];
   if(t&&M.ac[i]!==undefined){const k=M.ac[i],lx=M.loc[k*16+12],ly=M.loc[k*16+13],lz=M.loc[k*16+14],cur=nrm([w[0]*lx+w[4]*ly+w[8]*lz,w[1]*lx+w[5]*ly+w[9]*lz,w[2]*lx+w[6]*ly+w[10]*lz]),R=arc(cur,t);
    for(let c=0;c<3;c++){const x=w[c*4],y=w[c*4+1],z=w[c*4+2];w[c*4]=R[0]*x+R[1]*y+R[2]*z;w[c*4+1]=R[3]*x+R[4]*y+R[5]*z;w[c*4+2]=R[6]*x+R[7]*y+R[8]*z}
    const fl=M.fl&&M.fl[i];if(fl){const fc=[w[0]*fl[0]+w[4]*fl[1]+w[8]*fl[2],w[1]*fl[0]+w[5]*fl[1]+w[9]*fl[2],w[2]*fl[0]+w[6]*fl[1]+w[10]*fl[2]],fd=nrm(cross(t,[1,0,0])),pc=[fc[0]-t[0]*dot(fc,t),fc[1]-t[1]*dot(fc,t),fc[2]-t[2]*dot(fc,t)],pd=[fd[0]-t[0]*dot(fd,t),fd[1]-t[1]*dot(fd,t),fd[2]-t[2]*dot(fd,t)];
     if(len(pc)>.2&&len(pd)>.2){const ang=Math.atan2(dot(t,cross(pc,pd)),dot(pc,pd)),c_=Math.cos(ang),s_=Math.sin(ang),kx=t[0],ky=t[1],kz=t[2],Rr=[c_+kx*kx*(1-c_),kx*ky*(1-c_)-kz*s_,kx*kz*(1-c_)+ky*s_,ky*kx*(1-c_)+kz*s_,c_+ky*ky*(1-c_),ky*kz*(1-c_)-kx*s_,kz*kx*(1-c_)-ky*s_,kz*ky*(1-c_)+kx*s_,c_+kz*kz*(1-c_)];
      for(let c=0;c<3;c++){const x=w[c*4],y=w[c*4+1],z=w[c*4+2];w[c*4]=Rr[0]*x+Rr[1]*y+Rr[2]*z;w[c*4+1]=Rr[3]*x+Rr[4]*y+Rr[5]*z;w[c*4+2]=Rr[6]*x+Rr[7]*y+Rr[8]*z}}}}
   else if(M.footR&&M.footR[i]){ // flat foot: rest orientation, pitched with the shin
    const sh=tg[M.par[i]]||[0,-1,0],th=Math.atan2(-sh[2],-sh[1])*.6,c_=Math.cos(th),s_=Math.sin(th),r0=M.footR[i];
    // Rx(th) * rest
    for(let c=0;c<3;c++){const x=r0[c*3],y=r0[c*3+1],z=r0[c*3+2];w[c*4]=x;w[c*4+1]=c_*y-s_*z;w[c*4+2]=s_*y+c_*z}}
   {const hr=M.hr;if(hr&&hr.on&&hr.ori&&(i===hr.iL||i===hr.iR)){const sd=i===hr.iL?'L':'R',o=hr.ori[sd],lc=hr.loc[sd];if(o&&lc){const cv=q=>[w[0]*q[0]+w[4]*q[1]+w[8]*q[2],w[1]*q[0]+w[5]*q[1]+w[9]*q[2],w[2]*q[0]+w[6]*q[1]+w[10]*q[2]],ap=R=>{for(let c=0;c<3;c++){const x=w[c*4],y=w[c*4+1],z=w[c*4+2];w[c*4]=R[0]*x+R[1]*y+R[2]*z;w[c*4+1]=R[3]*x+R[4]*y+R[5]*z;w[c*4+2]=R[6]*x+R[7]*y+R[8]*z}};
 const f0=cv(lc.fd),tf=nrm([f0[0]+(o.FD[0]-f0[0])*hr.k,f0[1]+(o.FD[1]-f0[1])*hr.k,f0[2]+(o.FD[2]-f0[2])*hr.k]);ap(arc(f0,tf));
 let pn=cv(lc.pn);const dn=dot(pn,tf);pn=nrm([pn[0]-tf[0]*dn,pn[1]-tf[1]*dn,pn[2]-tf[2]*dn]);const dN=dot(o.N,tf),Nn=nrm([o.N[0]-tf[0]*dN,o.N[1]-tf[1]*dN,o.N[2]-tf[2]*dN]),ang=Math.atan2(dot(tf,cross(pn,Nn)),dot(pn,Nn));rotW(w,tf,ang*hr.k);M.curl.ax[sd]=nrm(cv(lc.ax))}}}
   {const fg=M.fing&&M.fing[i];if(fg&&M.curl&&M.curl.tg){const am=fg.sd==='L'?M.curl.aL:M.curl.aR;if(am>.01){const ch=M.kids[i][0];let lx=0,ly=0,lz=0;if(ch!==undefined){lx=M.loc[ch*16+12];ly=M.loc[ch*16+13];lz=M.loc[ch*16+14]}
     const fdir=nrm([w[0]*lx+w[4]*ly+w[8]*lz,w[1]*lx+w[5]*ly+w[9]*lz,w[2]*lx+w[6]*ly+w[10]*lz]),A_=M.curl.ax[fg.sd],tv=[M.curl.tg[0]-w[12],M.curl.tg[1]-w[13],M.curl.tg[2]-w[14]],sg=dot(cross(A_,fdir),tv)>=0?1:-1,base=fg.f===0?[.45,.6,.5]:[.95,1.2,.95];rotW(w,A_,sg*base[fg.s]*am)}}}
   if(M.cutB&&M.cutB.indexOf(i)>=0)for(let k=0;k<12;k++)w[k]=0}
  for(let i=0;i<M.J;i++)M.S.set(m4(M.W[i],M.ibm.subarray(i*16,i*16+16)),i*16)};
 M.pose({});{const pi=M.id('Bip001 Pelvis');M.py=pi>=0?M.W[pi][13]:.9}
 M.mask=(names)=>{const a=new Float32Array(128),go=i=>{a[i]=1;M.kids[i].forEach(go)};for(const n of names){const i=M.id(n);if(i>=0)go(i)}return a};
 M.fl={};M.footR={};for(const nm of['Bip001 L Thigh','Bip001 R Thigh','Bip001 L Calf','Bip001 R Calf']){const i=M.id(nm);if(i>=0){const w=M.W[i];M.fl[i]=[w[2],w[6],w[10]]}}
 for(const nm of['Bip001 L Foot','Bip001 R Foot']){const i=M.id(nm);if(i>=0){const w=M.W[i];M.footR[i]=[w[0],w[1],w[2],w[4],w[5],w[6],w[8],w[9],w[10]]}}
 M.low=['Bip001 L Foot','Bip001 R Foot','Bip001 L Toe0','Bip001 R Toe0','Bip001 L Hand','Bip001 R Hand','Bip001 Head','Bip001 Pelvis'].map(n=>M.id(n)).filter(i=>i>=0);
 M.fing={};M.lc={L:0,R:0};M.lcIdx={};if(key==='levi'){const cd={"Bip001 L Finger0":[2,1],"Bip001 L Finger01":[2,1],"Bip001 L Finger02":[2,1],"Bip001 L Finger1":[0,-1],"Bip001 L Finger11":[0,-1],"Bip001 L Finger12":[0,-1],"Bip001 L Finger2":[0,-1],"Bip001 L Finger21":[0,-1],"Bip001 L Finger22":[0,-1],"Bip001 L Finger3":[0,-1],"Bip001 L Finger31":[0,-1],"Bip001 L Finger32":[0,-1],"Bip001 L Finger4":[0,-1],"Bip001 L Finger41":[0,-1],"Bip001 L Finger42":[0,-1],"Bip001 R Finger0":[2,-1],"Bip001 R Finger01":[2,-1],"Bip001 R Finger02":[2,-1],"Bip001 R Finger1":[0,-1],"Bip001 R Finger11":[0,-1],"Bip001 R Finger12":[0,-1],"Bip001 R Finger2":[0,-1],"Bip001 R Finger21":[0,-1],"Bip001 R Finger22":[0,-1],"Bip001 R Finger3":[0,-1],"Bip001 R Finger31":[0,-1],"Bip001 R Finger32":[0,-1],"Bip001 R Finger4":[0,-1],"Bip001 R Finger41":[0,-1],"Bip001 R Finger42":[0,-1]};for(const nm in cd){const i=M.id(nm);if(i>=0)M.lcIdx[i]={ax:cd[nm][0],sg:cd[nm][1],side:nm.indexOf(' L ')>=0?'L':'R',ang:(/Finger0\d?$/.test(nm)?.75:1.15)*({'1':.82,'2':.94,'3':1.04,'4':1.12}[(nm.match(/Finger(\d)/)||[])[1]]||1)}}}M.curl={aL:0,aR:0,tg:null,ax:{L:[0,0,1],R:[0,0,1]}};M.hr={iL:M.id('Bip001 L Hand'),iR:M.id('Bip001 R Hand'),A:{},fd:{},tg:{},on:false,ori:{},loc:{}};
 for(const sd of['L','R'])for(let f=0;f<5;f++){const nms=['Bip001 '+sd+' Finger'+f,'Bip001 '+sd+' Finger'+f+'1','Bip001 '+sd+' Finger'+f+'2'];nms.forEach((nm,s)=>{const id=M.id(nm);if(id>=0)M.fing[id]={sd,f,s}})}
 MD[key]=M}
let gfE=0;
function groundFixL(M,mm,gy,standing,sc,gait,dt){if(!M.low)return;if(!gait){gfE=0;return groundFix(M,mm,gy,standing,sc)}let mn=1e9;for(const i of M.low){const w=M.W[i],y=mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13];if(y<mn)mn=y}
 const mar=(M.py||1)*.075*sc;let sh=Math.max(-1.2,Math.min(1.2,gy+mar-mn));dt=Math.min(.05,dt||.016);gfE=Math.max(sh,gfE-.2*dt);if(!(gfE>-1.2))gfE=sh;mm[13]+=Math.max(sh,gfE)}
function groundFix(M,mm,gy,standing,sc){sc=sc||1;if(!M.low)return;let mn=1e9;for(const i of M.low){const w=M.W[i],y=mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13];if(y<mn)mn=y}
 const mar=(M.py||1)*.075*sc;let sh=gy+mar-mn;if(standing)sh=Math.max(-1.2,Math.min(1.2,sh));else if(sh<0)sh=0;mm[13]+=sh}
const ZMASK=new Float32Array(128);
function drawModel(M,model,mode,S,mask,skipRe){if(!M)return;gl.useProgram(gp.p);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,M.bt);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,4,M.J,gl.RGBA,gl.FLOAT,S||M.S);gl.uniform1i(gp.u.umode,mode||0);gl.uniform4fv(gp.u.mk,mask||ZMASK);
 gl.uniform1i(gp.u.bones,1);gl.uniform1i(gp.u.tex,0);gl.uniformMatrix4fv(gp.u.vp,false,E.vp);gl.uniformMatrix4fv(gp.u.model,false,model);gl.uniform3fv(gp.u.sun,E.sunDir||[.4,.8,.3]);{const L=E.light||{};gl.uniform3fv(gp.u.sunC,L.sunC||[2,2,2]);gl.uniform3fv(gp.u.ambS,L.ambS||[.4,.5,.7]);gl.uniform3fv(gp.u.ambG,L.ambG||[.4,.3,.2])}gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);
 for(const p of M.prims){if(skipRe&&skipRe.test(p.mat))continue;gl.activeTexture(gl.TEXTURE0);const t=p.tex!==null&&p.tex!==undefined?M.tex[p.tex]:null;gl.bindTexture(gl.TEXTURE_2D,t||M.tex[0]);gl.uniform1f(gp.u.hasT,t?1:0);gl.uniform3f(gp.u.col,.07,.06,.06);{const tt=M.tintFn?M.tintFn(p.mat):null;gl.uniform3f(gp.u.tint,tt?tt[0]:1,tt?tt[1]:1,tt?tt[2]:1);gl.uniform1f(gp.u.tmode,tt&&tt[3]?1:0)}gl.bindVertexArray(p.vao);gl.drawElements(gl.TRIANGLES,p.ni,p.ty,0)}gl.bindVertexArray(null)}
function modelMat(R,U,F,o,sc){const s=sc||1;return new Float32Array([R[0]*s,R[1]*s,R[2]*s,0,U[0]*s,U[1]*s,U[2]*s,0,F[0]*s,F[1]*s,F[2]*s,0,o[0],o[1],o[2],1])}
function initSkin(){const sh=(t,c)=>{const x=gl.createShader(t);gl.shaderSource(x,c);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(x));return x};
 const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,`#version 300 es
in vec3 p;in vec3 n;in vec2 uv;in uvec4 jj;in vec4 ww;uniform mat4 vp,model;uniform sampler2D bones;uniform vec4 mk[32];out vec3 vn;out vec2 vu;out float vmk;
mat4 B(uint j){int r=int(j);return mat4(texelFetch(bones,ivec2(0,r),0),texelFetch(bones,ivec2(1,r),0),texelFetch(bones,ivec2(2,r),0),texelFetch(bones,ivec2(3,r),0));}
void main(){mat4 s=B(jj.x)*ww.x+B(jj.y)*ww.y+B(jj.z)*ww.z+B(jj.w)*ww.w;vec4 w=model*(s*vec4(p,1.));vn=mat3(model)*(mat3(s)*n);vu=uv;float m=0.;for(int k=0;k<4;k++){int j=int(jj[k]);m+=ww[k]*mk[j>>2][j&3];}vmk=m;gl_Position=vp*w;}`));
 gl.attachShader(p,sh(gl.FRAGMENT_SHADER,`#version 300 es
precision mediump float;in vec3 vn;in vec2 vu;in float vmk;uniform int umode;uniform sampler2D tex;uniform vec3 sun,col,sunC,ambS,ambG;uniform float hasT;uniform vec3 tint;uniform float tmode;out vec4 o;
void main(){if(umode==1&&vmk>.5)discard;if(umode==2&&vmk<.5)discard;vec4 c=hasT>.5?texture(tex,vu):vec4(col,1.);if(c.a<.4)discard;if(tmode>.5){float l_=dot(c.rgb,vec3(.299,.587,.114));c.rgb=tint*(l_*1.6+.05);}else c.rgb*=tint;vec3 N=normalize(vn);if(!gl_FrontFacing)N=-N;float d=dot(N,normalize(sun));float wr=clamp(d*.5+.5,0.,1.);float b=.42+.62*wr*wr;vec3 amb=mix(ambG,ambS,N.y*.5+.5);float rim=pow(1.-clamp(abs(N.z)*.0+.35,0.,1.),2.)*0.;o=vec4(c.rgb*(b*sunC*.36+amb*.7+.05),1.);}`));
 gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(p));
 gp={p,a:{},u:{}};for(const k of['p','n','uv','jj','ww'])gp.a[k]=gl.getAttribLocation(p,k);for(const k of['vp','model','bones','tex','sun','col','hasT','sunC','ambS','ambG','umode','mk','tint','tmode'])gp.u[k]=gl.getUniformLocation(p,k);gl.useProgram(p);gl.uniform3f(gp.u.tint,1,1,1);gl.uniform1f(gp.u.tmode,0);
 loadAnims().then(()=>loadModel('levi')).then(()=>loadModel('titan')).then(setupTitan).catch(e=>console.error('model load',e))}

let dodgeSide=1,yankT=0,armedT=0,armK=0,limbs=[],LVHIDE=null,trail=[],lastLeviMM=null;
function spawnLimb(M,mm,names,pivotName,vel0,sc){const mask=M.mask(names),pi=M.id(pivotName);if(pi<0)return;const w=M.W[pi],piv=[w[12],w[13],w[14]],B=[mm[0],mm[1],mm[2],mm[4],mm[5],mm[6],mm[8],mm[9],mm[10]],pos=[mm[0]*piv[0]+mm[4]*piv[1]+mm[8]*piv[2]+mm[12],mm[1]*piv[0]+mm[5]*piv[1]+mm[9]*piv[2]+mm[13],mm[2]*piv[0]+mm[6]*piv[1]+mm[10]*piv[2]+mm[14]];
 const ax=nrm([Math.random()-.5,Math.random()-.5,Math.random()-.5]);let cap=null;{const ch=M.kids[pi][0];if(ch!==undefined){const wc=M.W[ch],dv=[wc[12]-w[12],wc[13]-w[13],wc[14]-w[14]],l=len(dv);if(l>.01)cap={d:[dv[0]/l,dv[1]/l,dv[2]/l],r:Math.min(1.1,Math.max(.16,l*.2))}}}
 limbs.push({M,S:new Float32Array(M.S),mask,piv,B,pos,vel:vel0,ax,w:5+Math.random()*5,rest:false,t:0,r:(sc||1)*.5,cap});if(limbs.length>10)limbs.shift();return mask}
function limbStep(dt){for(let i=limbs.length-1;i>=0;i--){const L=limbs[i];if(L.eat!==undefined&&(L.eat-=dt)<=0){blood(L.pos,[0,1,0],6);limbs.splice(i,1)}}
 for(const L of limbs){L.t+=dt;if(L.carry){const c=L.carry;c.t+=dt;if(!c.from)c.from=L.pos.slice();const e=Math.min(1,c.t/c.dur),mp=mouthPos();L.pos=[c.from[0]+(mp[0]-c.from[0])*e,c.from[1]+(mp[1]-c.from[1])*e+Math.sin(e*Math.PI)*.12,c.from[2]+(mp[2]-c.from[2])*e];L.sc=1-.85*e;if(e>=1)L.eat=0;continue}if(L.rest)continue;L.vel[1]-=18*dt;for(let k=0;k<3;k++)L.pos[k]+=L.vel[k]*dt;
  if(L.w>.05){const a=L.w*dt,c=Math.cos(a),s_=Math.sin(a),[x,y,z]=L.ax,Rr=[c+x*x*(1-c),x*y*(1-c)-z*s_,x*z*(1-c)+y*s_,y*x*(1-c)+z*s_,c+y*y*(1-c),y*z*(1-c)-x*s_,z*x*(1-c)-y*s_,z*y*(1-c)+x*s_,c+z*z*(1-c)],B=L.B;for(let j=0;j<3;j++){const bx=B[j*3],by=B[j*3+1],bz=B[j*3+2];B[j*3]=Rr[0]*bx+Rr[1]*by+Rr[2]*bz;B[j*3+1]=Rr[3]*bx+Rr[4]*by+Rr[5]*bz;B[j*3+2]=Rr[6]*bx+Rr[7]*by+Rr[8]*bz}}
  const g=gh(L.pos[0],L.pos[2])+L.r*.55;if(L.pos[1]<g){L.pos[1]=g;L.vel[1]*=-.25;L.vel[0]*=.55;L.vel[2]*=.55;L.w*=.5;if(Math.hypot(L.vel[0],L.vel[1],L.vel[2])<.8){L.rest=true;L.w=0;decals.push({x:L.pos[0],z:L.pos[2],r:.3,t:0,rot:Math.random()*6.28,k:0,big:1,grow:1})}}}
 for(const d of decals)if(d.grow&&d.r<1.1)d.r+=dt*.18}
function drawLimbs(){for(const L of limbs){const sc_=L.sc||1,B=sc_===1?L.B:L.B.map(x=>x*sc_),pv=L.piv,mm=new Float32Array([B[0],B[1],B[2],0,B[3],B[4],B[5],0,B[6],B[7],B[8],0,L.pos[0]-(B[0]*pv[0]+B[3]*pv[1]+B[6]*pv[2]),L.pos[1]-(B[1]*pv[0]+B[4]*pv[1]+B[7]*pv[2]),L.pos[2]-(B[2]*pv[0]+B[5]*pv[1]+B[8]*pv[2]),1]);drawModel(L.M,mm,2,L.S,L.mask);if(L.cap){const sc=len([B[0],B[1],B[2]]),dw=[B[0]*L.cap.d[0]+B[3]*L.cap.d[1]+B[6]*L.cap.d[2],B[1]*L.cap.d[0]+B[4]*L.cap.d[1]+B[7]*L.cap.d[2],B[2]*L.cap.d[0]+B[5]*L.cap.d[1]+B[8]*L.cap.d[2]];cutCap(L.pos,nrm([-dw[0],-dw[1],-dw[2]]),L.cap.r*sc,L.t*0+3.1)}}}
function cutCap(c,n,r,seed){const a=Math.abs(n[1])<.9?[0,1,0]:[1,0,0],t1=nrm(cross(n,a)),t2=cross(n,t1),N=20,ly=[[1,[.6,.33,.27],.004],[.9,[.46,.07,.08],.008],[.66,[.33,.035,.045],.012],[.24,[.86,.82,.7],.016]];
 for(const [rf,col,off] of ly){const C=[c[0]+n[0]*off,c[1]+n[1]*off,c[2]+n[2]*off];for(let i=0;i<N;i++){const a0=i/N*6.2832,a1=(i+1)/N*6.2832,j0=1+.1*Math.sin(i*2.3+seed)*(rf>.5?1:.4),j1=1+.1*Math.sin((i+1)*2.3+seed)*(rf>.5?1:.4),sh=.8+.35*Math.abs(Math.sin(i*1.7+seed*.7)),
  p0=[C[0]+(t1[0]*Math.cos(a0)+t2[0]*Math.sin(a0))*r*rf*j0,C[1]+(t1[1]*Math.cos(a0)+t2[1]*Math.sin(a0))*r*rf*j0,C[2]+(t1[2]*Math.cos(a0)+t2[2]*Math.sin(a0))*r*rf*j0],
  p1=[C[0]+(t1[0]*Math.cos(a1)+t2[0]*Math.sin(a1))*r*rf*j1,C[1]+(t1[1]*Math.cos(a1)+t2[1]*Math.sin(a1))*r*rf*j1,C[2]+(t1[2]*Math.cos(a1)+t2[2]*Math.sin(a1))*r*rf*j1];tri(C,p0,p1,[col[0]*sh,col[1]*sh,col[2]*sh,1],1)}}}


const GRB={bites:[4.7,6.5,8.3,10.1,11.9],raise0:2.5,raise1:3.8};
function sm01(a,b,x){const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u)}
const lp3=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
function eatDip(t){let e=0,ch=0,gulp=0;const B=GRB.bites;for(let k=0;k<B.length;k++){const tb=B[k];e=Math.max(e,sm01(tb-.8,tb-.1,t)*(1-sm01(tb+.02,tb+.55,t)));if(t>tb&&k<B.length-1)ch+=Math.sin((t-tb)*14)*Math.exp(-(t-tb)*1.7)*.16}
 const tg=B[B.length-1]+.7;gulp=sm01(tg,tg+.45,t)*(1-sm01(tg+.9,tg+1.5,t));if(t>B[B.length-1])ch+=Math.sin((t-B[B.length-1])*12)*Math.exp(-(t-B[B.length-1])*1.4)*.2;return{e,ch,gulp}}
function eatBody(D){const g=grab;if(!g||g.kind==='slam')return;const q=g.kind==='bite'?eatDip(g.t):{e:0,ch:0,gulp:0},add=(n,dz)=>{const d=D[n];if(!d)return;D[n]=nrm([d[0],d[1],d[2]+dz])};
 const lean=q.e*.5-q.gulp*.4+q.ch*.3+(g.kind==='choke'?.05*Math.sin(g.t*5.5):0);add('Bip001 Spine',lean*.28);add('Bip001 Spine1',lean*.34);add('Bip001 Spine2',lean*.36);add('Bip001 Neck',lean*.6+q.e*.25)}
function gripFrame(){const T=titan,g=grab,F=[Math.sin(T.yaw),0,Math.cos(T.yaw)],Lf=[Math.cos(T.yaw),0,-Math.sin(T.yaw)],fy=T.fy===undefined?gh(T.x,T.z):T.fy,hd=T.hd0||titanBone('Bip001 Head'),up=[0,1,0],t=g.t;
 let C,Ux,Fx=[-F[0],0,-F[2]],s=.17,FD;const wrap=sm01(.08,.6,t),hold=[hd[0]+F[0]*.8,hd[1]-1.0,hd[2]+F[2]*.8];
 if(g.kind==='slam'){const top=[T.x+F[0]*.1,fy+4.5,T.z+F[2]*.1],gx=T.x+F[0]*1.75,gz=T.z+F[2]*1.75,gr=[gx,gh(gx,gz)+.5,gz],a=sm01(.45,1.15,t),b=Math.pow(sm01(1.15,1.6,t),1.6);
  C=lp3(lp3(hold,top,a),gr,b);Ux=nrm(lp3(lp3(up,nrm([-F[0]*.35,.9,-F[2]*.35]),a),nrm([F[0]*.95,-.25,F[2]*.95]),b));Fx=nrm(lp3(Fx,[-F[0]*.3,-.95,-F[2]*.3],b));FD=nrm(lp3([F[0]*.9,.3,F[2]*.9],[F[0]*.4,.85,F[2]*.4],a))}
 else{const rr=g.kind==='bite'?sm01(GRB.raise0,GRB.raise1,t):0,mo=[hd[0]+F[0]*.66,hd[1]-.34,hd[2]+F[2]*.66];C=lp3(hold,mo,rr);Ux=nrm([-F[0]*(.12+.4*rr),1,-F[2]*(.12+.4*rr)]);
  const sq=g.kind==='choke'?(.5+.5*Math.sin(t*5.5)):(rr<.01?.4*Math.pow(Math.max(0,Math.sin(t*2.2)),2):0);s=.17-.025*sq;FD=nrm([F[0]*.85,.22+.5*rr,F[2]*.85]);g.rr=rr}
 const jit=(.35+Math.min(1,g.esc||0))*.011;C=[C[0]+Math.sin(t*23)*jit,C[1]+Math.sin(t*19+1)*jit,C[2]+Math.sin(t*17+2)*jit];C[1]-=(g.rec||0)*.035;
 return{C,U:Ux,Fl:Fx,Lf,F,s,FD,wrap}}
function gore(p,n,c){burst(p,n,[.42,.015,.02],c,7,.045,.8,19,.95,.2,3.4);burst(p,n,[.5,.03,.04],Math.ceil(c/5),2.5,.1,.7,2,.35,1.2)}
function gripPoint(){return grab&&grab.fr?grab.fr.C:H}
function gripUp(){return grab&&grab.fr?grab.fr.U:[0,1,0]}
function mouthPos(){const T=titan,h=titanBone('Bip001 Head'),F=[Math.sin(T.yaw),0,Math.cos(T.yaw)];return[h[0]+F[0]*.2,h[1]-.1,h[2]+F[2]*.2]}
function holdArms(T,M,D){const g=grab,fr=gripFrame(),m=T.mm;g.fr=fr;
 const b_=Math.min(1,g.t/.5),e_=b_*b_*(3-2*b_),Cc=lp3(g.p0||fr.C,fr.C,e_);H=[Cc[0],Cc[1],Cc[2]];v=[0,0,0];
 const toM=w=>{const x=w[0]-m[12],y=w[1]-m[13],z=w[2]-m[14];return[m[0]*x+m[1]*y+m[2]*z,m[4]*x+m[5]*y+m[6]*z,m[8]*x+m[9]*y+m[10]*z]},toD=w=>nrm([m[0]*w[0]+m[1]*w[1]+m[2]*w[2],m[4]*w[0]+m[5]*w[1]+m[6]*w[2],m[8]*w[0]+m[9]*w[1]+m[10]*w[2]]),sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],ad=(a,b,k)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
 const wI=Math.min(1,g.t/.32),wt=wI*wI*(3-2*wI);M.hr.k=wt;M.hr.on=true;const FDm=toD(fr.FD),Cm=toM(Cc);M.curl.tg=Cm;
 const sEff=fr.s+.2*(1-sm01(.05,.5,g.t));
 for(const sd of['L','R']){if(T.cut[sd])continue;const sg=sd==='L'?1:-1,iU=M.id('Bip001 '+sd+' UpperArm'),iF=M.id('Bip001 '+sd+' Forearm'),iH=M.id('Bip001 '+sd+' Hand'),iP=M.id('Bip001 '+sd+' Finger2');if(iU<0||iF<0||iH<0||iP<0)continue;
  const pos=i=>[M.W[i][12],M.W[i][13],M.W[i][14]],S=pos(iU),E0=pos(iF),Wr=pos(iH),l1=len(sub(E0,S)),l2=len(sub(Wr,E0)),Lp=.62*len(sub(pos(iP),Wr));
  const Pw=[Cc[0]+fr.Lf[0]*sg*sEff,Cc[1]+fr.Lf[1]*sg*sEff+.09,Cc[2]+fr.Lf[2]*sg*sEff],Pm=toM(Pw),Nw=[-fr.Lf[0]*sg,-fr.Lf[1]*sg,-fr.Lf[2]*sg],Nm=toD(Nw),Gs=ad(Pm,FDm,-Lp);
  const pole=nrm([sg*.8,-.3,.5]),solve=Tg=>{let d=sub(Tg,S),dl=len(d);const mxl=(l1+l2)*.985;if(dl>mxl){Tg=ad(S,d,mxl/dl);d=sub(Tg,S);dl=mxl}const dn=[d[0]/dl,d[1]/dl,d[2]/dl],a=(l1*l1-l2*l2+dl*dl)/(2*dl),h=Math.sqrt(Math.max(0,l1*l1-a*a));let pp=sub(pole,[dn[0]*dot(pole,dn),dn[1]*dot(pole,dn),dn[2]*dot(pole,dn)]);pp=nrm(pp);return{E:ad(ad(S,dn,a),pp,h),Tg}};
  const r=solve(Gs),uN=nrm(sub(r.E,S)),fN=nrm(sub(r.Tg,r.E)),k1='Bip001 '+sd+' UpperArm',k2='Bip001 '+sd+' Forearm',bl=(a,b)=>nrm([a[0]+(b[0]-a[0])*wt,a[1]+(b[1]-a[1])*wt,a[2]+(b[2]-a[2])*wt]);
  D[k1]=bl(D[k1],uN);D[k2]=bl(D[k2],fN);M.hr.ori[sd]={FD:FDm,N:Nm}}
 M.pose(D)}

function slamBody(D,t){const sm=(a,b,x)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u)},lean=t<1.15?-.05-.35*sm(.45,1.15,t):-.4+1.7*Math.pow(Math.min(1,(t-1.15)/.45),1.7),add=(n,dz)=>{const d=D[n];if(!d)return;D[n]=nrm([d[0],d[1],d[2]+dz])};
 add('Bip001 Spine',lean*.3);add('Bip001 Spine1',lean*.35);add('Bip001 Spine2',lean*.35);add('Bip001 Neck',lean*.12);const fx=Math.max(0,lean),th=.7*fx,kn=1.0*fx;
 for(const [nm,sg] of[['L',1],['R',-1]]){D['Bip001 '+nm+' Thigh']=[.03*sg,-Math.cos(th),Math.sin(th)];D['Bip001 '+nm+' Calf']=[.03*sg,-Math.cos(th-kn),Math.sin(th-kn)]}}

function titanBone(name){const T=titan,M=T.M,i=M.id(name);if(i<0||!T.mm)return[T.x,0,T.z];const w=M.W[i],m=T.mm;return[m[0]*w[12]+m[4]*w[13]+m[8]*w[14]+m[12],m[1]*w[12]+m[5]*w[13]+m[9]*w[14]+m[13],m[2]*w[12]+m[6]*w[13]+m[10]*w[14]+m[14]]}
function palmPos(sd){sd=sd||'R';const a=titanBone('Bip001 '+sd+' Hand'),b=titanBone('Bip001 '+sd+' Finger2');return[a[0]+(b[0]-a[0])*.62,a[1]+(b[1]-a[1])*.62,a[2]+(b[2]-a[2])*.62]}

const SEVK={armL:'L',armR:'R',legL:'LL',legR:'LR',head:'H'},CUTB={L:'Bip001 L Forearm',R:'Bip001 R Forearm',LL:'Bip001 L Calf',LR:'Bip001 R Calf',H:'Bip001 Neck'},SEVTH={L:26,R:26,LL:36,LR:36,H:44},SEVHP={L:14,R:14,LL:20,LR:20,H:70};
function drawStumps(T){const M=T.M;for(const k in T.cut){if(!T.cut[k])continue;const bn=CUTB[k],i=M.id(bn);if(i<0)continue;const ch=M.kids[i][0];if(ch===undefined)continue;const p=titanBone(bn),q=titanBone(M.names[ch].replace(/_\d+$/,'')),d=[q[0]-p[0],q[1]-p[1],q[2]-p[2]],l=len(d);if(l<.01)continue;cutCap(p,[d[0]/l,d[1]/l,d[2]/l],Math.min(1.1,Math.max(.16,l*.2)),k.charCodeAt(0))}}
function woundAdd(T,hit,away,pow){return;const M=T.M,m=T.mm,bi=hit.bi;if(bi===undefined||bi<0||!m)return;const dn=nrm([H[0]-hit.c[0],H[1]-hit.c[1],H[2]-hit.c[2]]),sp_=[hit.c[0]+dn[0]*hit.r*.92,hit.c[1]+dn[1]*hit.r*.92,hit.c[2]+dn[2]*hit.r*.92],v_=[sp_[0]-m[12],sp_[1]-m[13],sp_[2]-m[14]],ml=[m[0]*v_[0]+m[1]*v_[1]+m[2]*v_[2],m[4]*v_[0]+m[5]*v_[1]+m[6]*v_[2],m[8]*v_[0]+m[9]*v_[1]+m[10]*v_[2]],w=M.W[bi],d_=[ml[0]-w[12],ml[1]-w[13],ml[2]-w[14]];
 T.wounds.push({bi,bl:[w[0]*d_[0]+w[1]*d_[1]+w[2]*d_[2],w[4]*d_[0]+w[5]*d_[1]+w[6]*d_[2],w[8]*d_[0]+w[9]*d_[1]+w[10]*d_[2]],ax:nrm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),len:.22+pow*.2,t:0});if(T.wounds.length>16)T.wounds.shift()}
function drawWounds(T,dt){return;const M=T.M,m=T.mm,c=cam.pos;for(let i=T.wounds.length-1;i>=0;i--){const q=T.wounds[i];q.t+=dt;if(q.t>40){T.wounds.splice(i,1);continue}const w=M.W[q.bi];if(!w)continue;
  const pm=[w[12]+w[0]*q.bl[0]+w[4]*q.bl[1]+w[8]*q.bl[2],w[13]+w[1]*q.bl[0]+w[5]*q.bl[1]+w[9]*q.bl[2],w[14]+w[2]*q.bl[0]+w[6]*q.bl[1]+w[10]*q.bl[2]],am=[w[0]*q.ax[0]+w[4]*q.ax[1]+w[8]*q.ax[2],w[1]*q.ax[0]+w[5]*q.ax[1]+w[9]*q.ax[2],w[2]*q.ax[0]+w[6]*q.ax[1]+w[10]*q.ax[2]],
  P=[m[0]*pm[0]+m[4]*pm[1]+m[8]*pm[2]+m[12],m[1]*pm[0]+m[5]*pm[1]+m[9]*pm[2]+m[13],m[2]*pm[0]+m[6]*pm[1]+m[10]*pm[2]+m[14]],ax=nrm([m[0]*am[0]+m[4]*am[1]+m[8]*am[2],m[1]*am[0]+m[5]*am[1]+m[9]*am[2],m[2]*am[0]+m[6]*am[1]+m[10]*am[2]]),tc=nrm([c[0]-P[0],c[1]-P[1],c[2]-P[2]]),ww=nrm(cross(ax,tc)),hl=q.len*.5,hw=.02+q.len*.022,o=[tc[0]*.03,tc[1]*.03,tc[2]*.03];
  const Q=(h_,w_,col,k)=>quad([P[0]-ax[0]*h_-ww[0]*w_+o[0]*k,P[1]-ax[1]*h_-ww[1]*w_+o[1]*k,P[2]-ax[2]*h_-ww[2]*w_+o[2]*k],[P[0]+ax[0]*h_-ww[0]*w_+o[0]*k,P[1]+ax[1]*h_-ww[1]*w_+o[1]*k,P[2]+ax[2]*h_-ww[2]*w_+o[2]*k],[P[0]+ax[0]*h_+ww[0]*w_+o[0]*k,P[1]+ax[1]*h_+ww[1]*w_+o[1]*k,P[2]+ax[2]*h_+ww[2]*w_+o[2]*k],[P[0]-ax[0]*h_+ww[0]*w_+o[0]*k,P[1]-ax[1]*h_+ww[1]*w_+o[1]*k,P[2]-ax[2]*h_+ww[2]*w_+o[2]*k],col);
  Q(hl,hw,[.22,.02,.03,1],1);Q(hl*.92,hw*.45,[.5,.04,.05,1],2)}}
function capAt(M,mm,boneName,col){const i=M.id(boneName);if(i<0)return;const w=M.W[i],p=[mm[0]*w[12]+mm[4]*w[13]+mm[8]*w[14]+mm[12],mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13],mm[2]*w[12]+mm[6]*w[13]+mm[10]*w[14]+mm[14]],bx=nrm([mm[0],mm[1],mm[2]]),by=nrm([mm[4],mm[5],mm[6]]),bz=nrm([mm[8],mm[9],mm[10]]),s_=len([mm[0],mm[1],mm[2]]);box(p,.2*s_,.2*s_,.2*s_,bx,by,bz,col)}
let titan=null,grab=null;
function setupTitan(){const M=MD.titan;if(!M)return;const x=-11,z=-17;titan={hp:150,max:150,showT:0,napeHits:0,M,x,z,yaw:Math.atan2(0-x,-38-z),t:0,state:'idle',ph:0,dead:false,fall:0,cut:{L:false,R:false,LL:false,LR:false,H:false},dmg:{},cutAge:{},wounds:[],down:false,cd:0,stun:0,notice:0,mm:null};
 const mk=(b,r,tag,off)=>{const q={c:[0,0,0],r,r0:r,nape:tag==='nape',tag:tag||'body',bi:M.id(b),off:off||[0,0,0]};SPH.push(q)};
 mk('Bip001 Head',.62,'head',[0,.05,.05]);mk('Bip001 Neck',.36,'nape',[0,.1,-.3]);mk('Bip001 Spine1',1.15,'body',[0,.1,0]);mk('Bip001 Pelvis',1,'body');
 for(const sd of['L','R']){mk('Bip001 '+sd+' Thigh',.62,'leg'+sd,[0,-.35,0]);mk('Bip001 '+sd+' UpperArm',.5,'arm'+sd,[0,0,0]);mk('Bip001 '+sd+' Calf',.5,'leg'+sd,[0,-.2,0]);mk('Bip001 '+sd+' Forearm',.58,'arm'+sd)}
 placeTitan(0);initHandLoc(M);{const hr=M.hr;for(const sd of['L','R']){const iH=M.id('Bip001 '+sd+' Hand'),i1=M.id('Bip001 '+sd+' Finger1'),i4=M.id('Bip001 '+sd+' Finger4');if(iH<0||i1<0||i4<0)continue;const w=M.W[iH],A=nrm([M.W[i4][12]-M.W[i1][12],M.W[i4][13]-M.W[i1][13],M.W[i4][14]-M.W[i1][14]]);hr.A[sd]=[A[0]*w[0]+A[1]*w[1]+A[2]*w[2],A[0]*w[4]+A[1]*w[5]+A[2]*w[6],A[0]*w[8]+A[1]*w[9]+A[2]*w[10]]}}}
function initHandLoc(M){for(const sd of['L','R']){const iH=M.id('Bip001 '+sd+' Hand'),i2=M.id('Bip001 '+sd+' Finger2'),i1=M.id('Bip001 '+sd+' Finger1'),i4=M.id('Bip001 '+sd+' Finger4');if(iH<0||i2<0||i1<0||i4<0)continue;const w=M.W[iH],P=i=>[M.W[i][12],M.W[i][13],M.W[i][14]],lo=q=>nrm([q[0]*w[0]+q[1]*w[1]+q[2]*w[2],q[0]*w[4]+q[1]*w[5]+q[2]*w[6],q[0]*w[8]+q[1]*w[9]+q[2]*w[10]]),d=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],fd=lo(d(P(i2),P(iH))),ax=lo(d(P(i4),P(i1)));M.hr.loc[sd]={fd,ax,pn:nrm(cross(fd,ax))}}}
const TN=new Anim();
function titanY(T,dt){let tg=gh(T.x,T.z),wade=false;if(inCanal(T.x,T.z)){const h=cast([T.x,6,T.z],[0,-1,0],20);if(h&&h.nm==='bridges'&&h.p[1]>-1.2)tg=Math.max(tg,h.p[1]);else{tg=BEDY;wade=true}}
 if(T.fy===undefined)T.fy=tg;const was=T.wade;T.wade=wade;if(wade&&!was){splash([T.x,WY+.05,T.z],null,14);shake=Math.max(shake,.5)}
 if(wade&&tick%3===0)burst([T.x+(Math.random()-.5)*1.6,WY+.05,T.z+(Math.random()-.5)*1.6],[0,1,0],[.85,.92,1],1,1.2,.14,.7,-3,.5,2.2,0);
 T.fy+=(tg-T.fy)*Math.min(1,(dt||.016)*(tg<T.fy?9:3.2));if(Math.abs(tg-T.fy)<.01)T.fy=tg;return T.fy}
function placeTitan(dt){const T=titan,M=T.M,y=titanY(T,dt),F=[Math.sin(T.yaw),0,Math.cos(T.yaw)],U=[0,1,0],R=nrm(cross(U,F));
 const st_=T.state;let nm,lp=true,rate=1,fd=.2;
 if(T.dead){nm='T:Zombie Death';lp=false;rate=1;fd=.1}
 else if(T.down){nm='T:Zombie Dying';lp=false;rate=1;fd=.15}
 else if(T.atk){nm=T.atk.clip;lp=false;rate=T.atk.rate;fd=.12}
 else if(st_==='grab'&&grab){nm='T:Zombie Idle';lp=true;rate=.6;fd=.15}
 else if(T.stun>0&&T.state==='chase'){nm='T:Zombie Reaction Hit';lp=false;rate=1.0;fd=.06}
 else if(st_==='chase'){const sp=T.spd||3;if(sp>6){nm='T:Running';rate=sp/7.5}else{nm='T:Zombie Walk';rate=Math.max(.7,sp/2.6)}}
 else nm='T:Zombie Idle';
 if(T.atk&&!T.atk.pl){T.atk.pl=1;TN.cur=null}
 if(TN.cur!==nm)TN.play(nm,lp,rate,fd);TN.rate=rate;
 let p=TN.get(dt,()=>{});if(!p)p=newPose();if(window.__tclip){const c=window.__tclip;p=newPose();clipPose(c[0],c[1],false,p);if(c[2])mirrorPose(p)}M.cutB=[];p.k=(!T.atk&&!grab&&!T.dead&&!T.down&&/Idle|Walk|Running/.test(TN.cur||''))?1:0;
 {const mc=M.curl;let aL=0,aR=0;if(grab&&T.state==='grab'){aL=aR=(window.__curlK||.95)*sm01(.1,.6,grab.t)*(grab.kind==='choke'?.92+.1*Math.sin(grab.t*5.5):1)}else if(T.atk&&T.atk.grab){const f=Math.min(1,Math.max(0,(T.atk.t-.25)/Math.max(.2,T.atk.hits[0]-.25)));aL=aR=f}
  mc.aL+=(aL-mc.aL)*Math.min(1,dt*9);mc.aR+=(aR-mc.aR)*Math.min(1,dt*9);const pm=T.mm;if(pm){const vv=[H[0]-pm[12],H[1]-pm[13],H[2]-pm[14]];mc.tg=[pm[0]*vv[0]+pm[1]*vv[1]+pm[2]*vv[2],pm[4]*vv[0]+pm[5]*vv[1]+pm[6]*vv[2],pm[8]*vv[0]+pm[9]*vv[1]+pm[10]*vv[2]]}
  for(const sd of['L','R']){const a=M.id('Bip001 '+sd+' Finger1'),b=M.id('Bip001 '+sd+' Finger4');if(a>=0&&b>=0&&M.W[a]&&M.W[b])mc.ax[sd]=nrm([M.W[b][12]-M.W[a][12],M.W[b][13]-M.W[a][13],M.W[b][14]-M.W[a][14]])}}
 const D_=toDirs(p,p.k);M.hr.on=false;const gr_=grab&&T.state==='grab'&&!T.dead&&!T.down;if(gr_&&grab.kind==='slam')slamBody(D_,grab.t);
 if(gr_){M.pose(D_);T.mm=relModel(R,U,F,[T.x,y,T.z],p,M.py||2);groundFix(M,T.mm,y,true);T.hd0=titanBone('Bip001 Head');eatBody(D_)}
 M.pose(D_);T.mm=relModel(R,U,F,[T.x,y,T.z],p,M.py||2);groundFix(M,T.mm,y,!T.dead&&!T.down&&TN.cur!=='T:Zombie Death');if(gr_)holdArms(T,M,D_);const m=T.mm;
 for(const q of SPH){if(q.bi===undefined||q.bi<0)continue;const w=M.W[q.bi],l=[w[12]+q.off[0],w[13]+q.off[1],w[14]+q.off[2]];q.c=[m[0]*l[0]+m[4]*l[1]+m[8]*l[2]+m[12],m[1]*l[0]+m[5]*l[1]+m[9]*l[2]+m[13],m[2]*l[0]+m[6]*l[1]+m[10]*l[2]+m[14]];
  const sk=SEVK[q.tag];if(sk)q.r=T.cut[sk]?.01:q.r0}}
function handPos(){const T=titan,M=T.M,i=M.id('Bip001 R Hand'),w=M.W[i],m=T.mm;return[m[0]*w[12]+m[4]*w[13]+m[8]*w[14]+m[12],m[1]*w[12]+m[5]*w[13]+m[9]*w[14]+m[13],m[2]*w[12]+m[6]*w[13]+m[10]*w[14]+m[14]]}
function relHook(i){if(hk[i].on&&hk[i].att&&len(v)>10){for(let k=0;k<3;k++)v[k]*=1.1}hk[i]={on:false}}
function wallKick(){pend=[pick(['L:Front Flip','L:Stylish Flip','L:Corkscrew Evade','L:Front Twist Flip']),1.15];const n=lastWall.n;v[0]+=n[0]*9;v[1]=Math.max(v[1],0)+7.5;v[2]+=n[2]*9;flipT=.75;lastWall=null;hk=[{on:false},{on:false}];burst([H[0],H[1],H[2]],n,[.7,.66,.6],4,2.5,.3,.5,-.5,.4)}
function mash(){if(grab)grab.esc=Math.min(1.2,grab.esc+.14)}
function titanSteer(T,dt,sp,want){const cs=(y,h)=>cast0([T.x,gh(T.x,T.z)+h,T.z],[Math.sin(y),0,Math.cos(y)],sp*dt+3.4);let best=null;
 for(const o of[0,.45,-.45,.9,-.9,1.4,-1.4,2.1]){const y=want+o;if(!cs(y,1.1)&&!cs(y,3)){best=y;break}}
 if(best===null)return false;let dy=best-T.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));T.yaw+=dy*Math.min(1,dt*3.4);T.x+=Math.sin(T.yaw)*sp*dt;T.z+=Math.cos(T.yaw)*sp*dt;T.ph+=dt*sp*1.5;return true}
const ATK={swat:{clip:'T:Zombie Attack',rate:1.5,dur:1.7,hits:[.72],dmg:56,kb:15},combo:{clip:'T:Zombie Attack (1)',rate:2.5,dur:1.85,hits:[.7],dmg:48,kb:13},head:{clip:'T:Zombie Headbutt',rate:1.7,dur:1.5,hits:[.5],dmg:50,kb:12},slam:{clip:'T:Grab And Slam',rate:1.5,dur:1.2,hits:[.6],grab:'slam'},reach:{clip:'T:Picking Up',rate:1.3,dur:1.3,hits:[.95],grab:'bite'},choke:{clip:'T:Superhuman Choke Lift',rate:1.5,dur:1.3,hits:[.9],grab:'choke'}};
function titanSteer(T,dt,sp,want){const cs=(y,h)=>cast0([T.x,gh(T.x,T.z)+h,T.z],[Math.sin(y),0,Math.cos(y)],sp*dt+3.4);let best=null;
 for(const o of[0,.45,-.45,.9,-.9,1.4,-1.4,2.1]){const y=want+o;if(!cs(y,1.1)&&!cs(y,3)){best=y;break}}
 if(best===null)return false;let dy=best-T.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));T.yaw+=dy*Math.min(1,dt*3.4);T.x+=Math.sin(T.yaw)*sp*dt;T.z+=Math.cos(T.yaw)*sp*dt;T.ph+=dt*sp*1.5;return true}
function titanHit(T,A,d,py,iframes){if(iframes||grab)return;
 if(A.grab){const pa=palmPos('L'),pb=palmPos('R'),dA=Math.hypot(pa[0]-H[0],pa[1]-H[1],pa[2]-H[2]),dB=Math.hypot(pb[0]-H[0],pb[1]-H[1],pb[2]-H[2]),dd=Math.min(dA,dB),hnd=dA<dB?'L':'R';if(dd<3.2&&py<4.2){T.state='grab';T.atk=null;grab={t:0,esc:0,kind:A.grab,n:0,m:0,p0:H.slice(),hand:hnd};LVHIDE=null;hk=[{on:false},{on:false}];v=[0,0,0];msg=A.grab==='choke'?'CHOKED — MASH / SLASH THE HAND':'GRABBED — MASH / SLASH THE HAND';msgT=4}else{msg='THE TITAN MISSED';msgT=1;T.cd=1.2}return}
 let hd=1e9;for(const nm of['Bip001 L Hand','Bip001 R Hand','Bip001 Head']){const q=titanBone(nm);hd=Math.min(hd,Math.hypot(q[0]-H[0],q[1]-H[1],q[2]-H[2]))}
 if(hd>(A.k==='head'?3.1:2.9)||(A.aoe&&py>2.6)){msg='DODGED!';msgT=.7;return}
 const a=nrm([H[0]-T.x,0,H[2]-T.z]);v=[a[0]*A.kb,A.aoe?7:5,a[2]*A.kb];grounded=false;hk=[{on:false},{on:false}];gas=Math.max(0,gas-12);hp=Math.max(0,hp-A.dmg);shake=1;msg=A.aoe?'GROUND SLAM!':'HIT!';msgT=1;pend=[pick(['L:Standing React Large From Right','L:Standing React Large Gut']),1.3];burst(H,[0,1,0],[.8,.75,.7],6,3,.3,.6,0,.4);if(A.aoe){dust([T.x+Math.sin(T.yaw)*3.5,gh(T.x,T.z)+.3,T.z+Math.cos(T.yaw)*3.5],14);debris([T.x+Math.sin(T.yaw)*3.5,gh(T.x,T.z)+.3,T.z+Math.cos(T.yaw)*3.5],[0,1,0],6,1.2)}}
function titanUpdate(dt){const T=titan;if(!T)return;T.t+=dt;const dx=H[0]-T.x,dz=H[2]-T.z,d=Math.hypot(dx,dz),py=H[1]-HH-gh(T.x,T.z),iframes=dodgeCD>.75||dodgeT>0;T.showT=Math.max(0,(T.showT||0)-dt);
 if(T.dead){T.dtm=(T.dtm||0)+dt;if(T.dtm<7&&Math.random()<dt*10)steam([T.x+(Math.random()-.5)*2,gh(T.x,T.z)+1.2+Math.random()*1.5,T.z+(Math.random()-.5)*2],2)}
 else{titanCuts(T,dt);T.cd-=dt;T.stun-=dt;if(T.hp<T.max&&T.hp>0&&T.cd<-2)T.hp=Math.min(T.max,T.hp+dt*1.2);
  if(T.state==='idle'){if(d<50){T.notice+=dt;if(T.notice>.8)T.state='chase'}}
  else if(T.state==='chase'){
   if(T.down){T.spd=0}else if(T.atk){const A=T.atk;A.t+=dt;let dy=Math.atan2(dx,dz)-T.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));T.yaw+=dy*Math.min(1,dt*(A.turn||2.2));
    if(A.h===0){const wd_=A.grab?1.5:A.k==='head'?2.3:2.6;if(d>wd_){const stp=Math.min(d-wd_,Math.min(8,(d-wd_)/.12)*dt);T.x+=dx/d*stp;T.z+=dz/d*stp}}
    while(A.h<A.hits.length&&A.t>=A.hits[A.h]){A.h++;titanHit(T,A,d,py,iframes);if(T.state!=='chase')break}
    if(T.state==='chase'&&A.t>=A.dur){T.atk=null;T.cd=Math.max(T.cd,.4+Math.random()*.8);if(d<6&&T.hp<T.max*.7&&Math.random()<.45)T.cd=.05}}
   else if(T.stun<=0){let want=Math.atan2(dx,dz);const run=d>13?5.2:0,en=1+.3*Math.max(0,1-T.hp/T.max),lg=(T.cut.LL?1:0)+(T.cut.LR?1:0),sp=en*(3.8+run)*(1-.4*lg)*(T.cut.L&&T.cut.R?.8:1)*(T.wade?.55:1);T.spd=sp;
    if(d>3.4){if(!titanSteer(T,dt,sp,want)){T.spd=0;let dy=want-T.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));T.yaw+=dy*Math.min(1,dt*2)}}else{let dy=want-T.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));T.yaw+=dy*Math.min(1,dt*4);T.spd=0}
    let fdy=Math.atan2(dx,dz)-T.yaw;fdy=Math.abs(Math.atan2(Math.sin(fdy),Math.cos(fdy)));
    if(T.evT>0){T.evT-=dt;T.x+=T.evx*9*dt;T.z+=T.evz*9*dt}else{T.evCD=(T.evCD||0)-dt;if(T.evCD<=0&&len(v)>16&&d<15&&d>5&&Math.random()<dt*2){const sg=Math.random()<.5?1:-1,px=-dz/d*sg,pz_=dx/d*sg;if(!cast0([T.x,gh(T.x,T.z)+1.5,T.z],[px,0,pz_],4)){T.evT=.35;T.evx=px;T.evz=pz_;T.evCD=3.5}}}
    if(T.cd<=0&&d<7&&fdy>=.9&&py>-2&&!T.atk){T.atk=Object.assign({k:'swat',t:0,h:0,turn:6},ATK.swat)}
    else if(T.cd<=0&&d<10&&fdy<.9){const r=Math.random();let k;
     if(py>2.6)k=d<7?(r<.55?'swat':'combo'):null;
     else if(d<5.6)k=r<.12?'reach':r<.22?'choke':r<.4?'slam':r<.64?'combo':r<.86?'swat':'head';
     else k=r<.6?'head':null;
     if(k){const A=ATK[k];T.atk=Object.assign({k,t:0,h:0},A);if(A.grab){msg='DODGE THE GRAB!';msgT=.9}}}}}
  else if(T.state==='grab'&&grab){const g=grab;g.t+=dt;g.esc=Math.max(0,g.esc-dt*.09);g.rec=Math.max(0,(g.rec||0)-dt*3.5);bloodOv=Math.min(bloodOv,.2);
   if(g.kind==='choke'&&g.t>5.2){g.kind='bite';g.n=0;g.t=GRB.raise0-.5;msg='THE TITAN BRINGS YOU TO ITS MOUTH…';msgT=2.2}
   if(g.kind==='choke'){hp=Math.max(0,hp-dt*5);if(Math.floor(g.t*1.6)!==Math.floor((g.t-dt)*1.6)){gore(H,[0,1,0],6);shake=Math.max(shake,.4)}}
   if(g.kind==='bite'&&g.n>0&&tick%3===0&&!g.eaten){const mp=mouthPos();burst(mp,[0,-1,0],[.5,.02,.03],1,.5,.05,.9,12,.9,.2,0)}
   if(g.esc>=1&&g.n<3){hp=Math.max(1,hp-25);const a=nrm([-dx,0,-dz]);v=[a[0]*9,5,a[2]*9];grab=null;LVHIDE=null;T.state='chase';T.stun=1.1;T.cd=3.2;grounded=false;burst(H,[0,1,0],[.8,.8,.8],8,3,.4,.8,0,.4);msg='ESCAPED';msgT=1.5}
   else if(g.kind==='bite'){if(g.n<GRB.bites.length&&g.t>GRB.bites[g.n]){tearLevi(g.n);g.n++;hp=Math.max(1,hp-hpMax*.14)}
    if(g.n>=GRB.bites.length&&g.t>GRB.bites[GRB.bites.length-1]+2.6){burst(H,[0,1,0],[.5,.02,.03],26,6,.12,1,14,.9);pend=['L:Two Handed Sword Death',1.2];grab=null;LVHIDE=null;T.state='idle';T.notice=-2;T.cd=3;msg='DEVOURED — back to the gate';msgT=3;hp=hpMax;respawn()}}
   else if(g.kind==='slam'&&g.t>=1.6)slamImpact(T)}
 }
 placeTitan(dt)}
function slamImpact(T){const a=nrm([H[0]-T.x,0,H[2]-T.z]);grab=null;LVHIDE=null;T.state='chase';T.stun=1;T.cd=2.6;T.atk=null;hp=Math.max(1,hp-hpMax*.22);v=[a[0]*6,3,a[2]*6];grounded=false;pend=['L:Falling Flat Impact',1.4];const gp=[H[0],gh(H[0],H[2])+.2,H[2]];dust(gp,34);debris(gp,[0,1,0],18,2.2);blood(gp,[0,1,0],14);for(let i=0;i<18;i++){const an=i/18*6.283,nn=[Math.cos(an),.18,Math.sin(an)];burst([gp[0]+nn[0]*.5,gp[1]+.1,gp[2]+nn[2]*.5],nn,[.72,.64,.52],2,5.5,.55,1.5,-.6,.55,3.2,0)}debris([gp[0]+a[0]*1.2,gp[1],gp[2]+a[2]*1.2],[0,1,0],10,2.6);shake=1;bloodOv=Math.max(bloodOv,.6);slow=.35;slowT=.45;msg='SLAMMED INTO THE GROUND!';msgT=2}
function titanCuts(T,dt){for(const k in T.cut){if(!T.cut[k]){if(T.dmg[k])T.dmg[k]=Math.max(0,T.dmg[k]-dt*4);continue}T.cutAge[k]=(T.cutAge[k]||0)+dt;const bn=CUTB[k];if(T.cutAge[k]<8&&Math.random()<dt*18)blood(titanBone(bn),[0,-1,0],2);if(k!=='H'&&T.cutAge[k]>26){T.cut[k]=false;T.dmg[k]=0;steam(titanBone(bn),10);if(T.down&&!(T.cut.LL&&T.cut.LR))T.down=false}}}
function releaseGrab(away){grab=null;LVHIDE=null;const T=titan;T.state='chase';T.stun=1.4;v=[away[0]*-6,4,away[2]*-6];grounded=false}
function sliceAt(T,hit,away,sp,killT){const k=SEVK[hit.tag],pow=.9+Math.min(1.7,sp/11);T.dmg[k]=(T.dmg[k]||0)+pow*14;T.hp-=pow*3;woundAdd(T,hit,away,pow);blood(hit.c,away,8+Math.floor(pow*8));shake=Math.max(shake,.35+pow*.2);T.showT=7;
 if(T.dmg[k]>=SEVTH[k]){T.cut[k]=true;T.cutAge[k]=0;T.dmg[k]=0;const bn=CUTB[k],pp=titanBone(bn);spawnLimb(T.M,T.mm,[bn],bn,[away[0]*(2+pow*2)+(Math.random()-.5)*2,3+pow*2,away[2]*(2+pow*2)+(Math.random()-.5)*2],1.3);blood(pp,away,34);steam(pp,6);slow=.4;slowT=.4;shake=.9;T.hp-=SEVHP[k];T.stun=1;T.atk=null;
  msg=k==='H'?'DECAPITATED':k.length===2?'LEG SEVERED':'ARM SEVERED';msgT=1.6;if(grab&&k==='R')releaseGrab(away);
  if(T.cut.LL&&T.cut.LR&&!T.dead){T.down=true;T.atk=null;if(grab)releaseGrab(away)}
  if(k==='H'||T.hp<=0)killT()}
 else{msg=pow>1.2?'DEEP CUT — HIT AGAIN':'CUT';msgT=1;if(!T.atk&&Math.random()<.25)T.stun=.5}}

const TEAR=[['Bip001 R UpperArm','THE TITAN BITES OFF YOUR ARM…'],['Bip001 L UpperArm','…AND THE OTHER ARM'],['Bip001 R Thigh','IT TEARS OFF YOUR LEG'],['Bip001 L Thigh','…PIECE BY PIECE']];
function tearLevi(n){const M=MD.levi;if(!M||!lastLeviMM)return;const mp=mouthPos(),F=[Math.sin(titan.yaw),0,Math.cos(titan.yaw)];grab.rec=1;
 if(n<4){const nm=TEAR[n][0];spawnLimb(M,lastLeviMM,[nm],nm,[0,0,0],.5);const lm=limbs[limbs.length-1];if(lm){lm.carry={t:0,dur:.6};lm.w=3}LVHIDE=M.mask(TEAR.slice(0,n+1).map(x=>x[0]));msg=TEAR[n][1];msgT=2.4}else{grab.eaten=true;msg='DEVOURED';msgT=2.5}
 gore(mp,[F[0]*.5,-.6,F[2]*.5],30+n*4);gore(mp,[F[0],-.2,F[2]],14);gore(H,[0,.3,0],10);burst(mp,[0,-1,0],[.92,.9,.82],3,2,.04,.8,16,1,.1,0);bloodOv=Math.min(.3,bloodOv+.15);shake=Math.max(shake,.7)}
function drawLeviStumps(M,mm){for(let k=0;k<Math.min(grab.n||0,4);k++){const bn=TEAR[k][0],i=M.id(bn);if(i<0)continue;const ch=M.kids[i][0];if(ch===undefined)continue;const w=M.W[i],wc=M.W[ch],tw=(a,b,c)=>[mm[0]*a+mm[4]*b+mm[8]*c+mm[12],mm[1]*a+mm[5]*b+mm[9]*c+mm[13],mm[2]*a+mm[6]*b+mm[10]*c+mm[14]],p=tw(w[12],w[13],w[14]),q=tw(wc[12],wc[13],wc[14]);cutCap(p,nrm([q[0]-p[0],q[1]-p[1],q[2]-p[2]]),.04,k+1)}}
function slash(){if(window.__noOdm)return;armedT=8;if(grab&&slashCD<=0&&blades>0){slashCD=.5;slashT=.38;dur-=10;grab.esc=Math.min(1.2,grab.esc+.34);pend=['L:Sword And Shield Slash',1.6];const hp_=handPos();blood(hp_,[0,1,0],10);shake=.6;return}if(slashCD>0||grab||blades<=0)return;slashCD=.55;slashT=.38;pend=[pick(grounded?['L:Sword And Shield Slash','L:Thrust Slash','L:Standing Melee Attack 360 Low']:['L:Standing Melee Attack 360 Low','L:Standing Melee Run Jump Attack','L:Sword And Shield Slash']),1.5];const sp=len(v);let hit=null,bd=1e9;
 const dist=q=>Math.hypot(q.c[0]-H[0],q.c[1]-H[1],q.c[2]-H[2])-q.r;for(const q of SPH)if(q.nape&&dist(q)<5&&H[1]>q.c[1]-1.5)hit=q;
 if(!hit){const cp=cam.pos,fw=nrm([cam.target[0]-cp[0],cam.target[1]-cp[1],cam.target[2]-cp[2]]);let bs=1e9;for(const q of SPH){if(!(q.tag[0]==='a'||q.tag[0]==='l'||q.tag==='head')||q.r<.05)continue;const dd=dist(q);if(dd>5.5)continue;const tv=nrm([q.c[0]-cp[0],q.c[1]-cp[1],q.c[2]-cp[2]]),ang=Math.acos(Math.max(-1,Math.min(1,dot(fw,tv)))),sc=ang*8+dd*.25;if(sc<bs){bs=sc;hit=q}}}
 if(!hit)for(const q of SPH){const dd=dist(q);if(dd<4.2&&dd<bd){bd=dd;hit=q}}
 if(!hit||!titan||titan.dead)return;const T=titan,away=nrm([hit.c[0]-H[0],0,hit.c[2]-H[2]]);dur-=16;T.showT=7;if(dur<=0){blades--;dur=100;msg=blades?'BLADE BROKE — NEW BLADE':'OUT OF BLADES — RESET TO RESUPPLY';msgT=2}
 const killT=()=>{T.dead=true;T.atk=null;T.dtm=0;kills++;slow=.25;slowT=.9;shake=1;blood(hit.c,away,36);steam(hit.c,12);msg='TITAN DOWN';msgT=2.5;if(grab)grab=null;T.state='dead'};
 if(hit.nape&&sp>5.5){T.napeHits=(T.napeHits||0)+1;T.hp-=T.napeHits>=2?100:65;blood(hit.c,away,26);steam(hit.c,6);shake=1;if(T.hp<=0){killT()}else{T.stun=1.7;T.atk=null;if(grab){grab=null;T.state='chase'}slow=.35;slowT=.5;msg='NAPE WOUNDED — FINISH IT!';msgT=2.2}}
 else if(SEVK[hit.tag]&&!T.cut[SEVK[hit.tag]]){sliceAt(T,hit,away,sp,killT)}
 else{T.hp-=7;blood(hit.c,away,10);shake=Math.max(shake,.4);if(!T.atk&&Math.random()<.3)T.stun=.6;msg=hit.nape?'TOO SLOW — NEED MORE SPEED FOR THE NAPE':'GLANCING HIT — AIM FOR THE NAPE';msgT=1.8;if(T.hp<=0)killT()}}
// ---------- overlay renderer
let gl,prog,vao,vbo,vbuf=[],vfx=[],tgt=null;
function initGL(){gl=E.gl;const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x};prog=gl.createProgram();
 gl.attachShader(prog,sh(gl.VERTEX_SHADER,'#version 300 es\nin vec3 p;in vec4 c;in vec2 u;uniform mat4 m;out vec4 v;out vec2 w;void main(){v=c;w=u;gl_Position=m*vec4(p,1.);}'));
 gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,'#version 300 es\nprecision mediump float;in vec4 v;in vec2 w;uniform float fx;out vec4 o;void main(){float a=v.a;if(fx>.5){float r=length(w*2.-1.);a*=smoothstep(1.,.15,r);if(a<.01)discard;}o=vec4(v.rgb,a);}'));gl.linkProgram(prog);
 vao=gl.createVertexArray();gl.bindVertexArray(vao);vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,1<<21,gl.DYNAMIC_DRAW);
 const l=gl.getAttribLocation(prog,'p'),c=gl.getAttribLocation(prog,'c'),u=gl.getAttribLocation(prog,'u');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,36,0);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(c,4,gl.FLOAT,false,36,12);gl.enableVertexAttribArray(u);gl.vertexAttribPointer(u,2,gl.FLOAT,false,36,28);gl.bindVertexArray(null);initSkin()}
const LD=nrm([.4,.8,.3]);
function tri(a,b,c,col,sh,u0,u1,u2){const s=sh===undefined?1:sh,B=tgt||vbuf,al=col[3]===undefined?1:col[3],U=[u0||[0,0],u1||[0,0],u2||[0,0]];let k=0;for(const q of[a,b,c]){B.push(q[0],q[1],q[2],col[0]*s,col[1]*s,col[2]*s,al,U[k][0],U[k][1]);k++}}
function quad(a,b,c,d,col,n,uv){const s=n?.55+.45*Math.max(0,dot(n,LD)):1;if(uv==='flat'){const f=[.5,.5];tri(a,b,c,col,s,f,f,f);tri(a,c,d,col,s,f,f,f);return}tri(a,b,c,col,s,uv&&[0,0],uv&&[1,0],uv&&[1,1]);tri(a,c,d,col,s,uv&&[0,0],uv&&[1,1],uv&&[0,1])}
function box(c,hx,hy,hz,R,U,F,col){const pt=(sx,sy,sz)=>[c[0]+R[0]*hx*sx+U[0]*hy*sy+F[0]*hz*sz,c[1]+R[1]*hx*sx+U[1]*hy*sy+F[1]*hz*sz,c[2]+R[2]*hx*sx+U[2]*hy*sy+F[2]*hz*sz];
 const p=[pt(-1,-1,-1),pt(1,-1,-1),pt(1,1,-1),pt(-1,1,-1),pt(-1,-1,1),pt(1,-1,1),pt(1,1,1),pt(-1,1,1)];
 quad(p[0],p[1],p[2],p[3],col,F.map(x=>-x));quad(p[4],p[5],p[6],p[7],col,F);quad(p[0],p[1],p[5],p[4],col,U.map(x=>-x));quad(p[3],p[2],p[6],p[7],col,U);quad(p[0],p[3],p[7],p[4],col,R.map(x=>-x));quad(p[1],p[2],p[6],p[5],col,R)}
function rock(p,s,ang,col,seed){const N=7,J=i=>.78+.42*Math.abs(Math.sin(seed*7.3+i*2.1)),V=[],g=.5+.12*Math.abs(Math.sin(seed*3));for(let i=0;i<N;i++){const a=i/N*6.2832+seed+ang*.3,r=s*J(i);V.push([p[0]+Math.cos(a)*r,p[1]+s*.15*Math.sin(i*3+seed),p[2]+Math.sin(a)*r])}const T=[p[0]+s*.2*Math.sin(seed),p[1]+s*.75*J(9),p[2]+s*.1*Math.cos(seed)],B=[p[0],p[1]-s*.5*J(8),p[2]];for(let i=0;i<N;i++){const a=V[i],b=V[(i+1)%N],sh=.5+.55*Math.abs(Math.sin(seed*2+i*1.9)),c=[g*sh,g*sh,(g+.03)*sh,1];tri(T,a,b,c,1);tri(B,b,a,[c[0]*.6,c[1]*.6,c[2]*.6,1],1)}}
function burst(p,n,col,cnt,spd,sz,life,g,al,gr,str){for(let i=0;i<cnt;i++){if(parts.length>1600)break;const L=life*(.6+Math.random()*.7);parts.push({p:p.slice(),v:[n[0]*spd*.7+(Math.random()-.5)*spd,n[1]*spd*.7+(Math.random()-.5)*spd,n[2]*spd*.7+(Math.random()-.5)*spd],l:L,l0:L,c:col,s:sz*(.7+Math.random()*.6),g,a:al===undefined?1:al,gr:gr===undefined?1.6:gr,str:str||0})}}
function debris(p,n,cnt,pw){for(let i=0;i<cnt;i++){if(parts.length>900)break;const L=1.6+Math.random()*1.4,sz=.05+Math.random()*.07*Math.min(pw,1.6);parts.push({sol:true,p:p.slice(),v:[n[0]*(2+Math.random()*5*pw)+(Math.random()-.5)*4,n[1]*(2+Math.random()*3)+Math.random()*3*pw,n[2]*(2+Math.random()*5*pw)+(Math.random()-.5)*4],l:L,l0:L,c:[.52+Math.random()*.1,.52+Math.random()*.1,.55+Math.random()*.08],s:sz,g:20,a:1,gr:0,ang:Math.random()*6.28,spin:(Math.random()-.5)*14})}}
const blood=(p,n,c)=>{burst(p,n,[.42,.015,.02],c||16,8,.07,.85,19,.95,.2,3.4);burst(p,n,[.5,.03,.04],Math.ceil((c||16)/3),3.2,.45,1.1,1.5,.32,1.6);bloodOv=Math.min(1,bloodOv+(c||16)/36)},steam=(p,c)=>burst(p,[0,1,0],[.96,.96,.97],c||6,2.4,.85,2.8,-2.4,.34,1.9),dust=(p,c)=>burst(p,[0,1,0],[.72,.64,.5],c||8,3,.5,1.2,-.4,.4,1.5);
function ropeLine(a,b,col,wmin,sag,wob,seed){const dd=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=len(dd),n=Math.max(10,Math.min(48,Math.ceil(L/1.1))),cp=cam.pos,d0=nrm(dd);
 let w1=cross(d0,[0,1,0]);w1=len(w1)<.05?[1,0,0]:nrm(w1);const w2=cross(w1,d0),tm=performance.now()*.001,amp=(wob||0)*Math.min(1,.35+L/45),sd=seed||0;
 const Q=[];for(let i=0;i<=n;i++){const t=i/n,e=Math.sin(t*Math.PI),ph=tm*13+sd*3.1,o1=(Math.sin(t*8.6-ph)+Math.sin(t*15.3-ph*1.6)*.4)*amp*e,o2=Math.cos(t*6.9-ph*1.2)*amp*.8*e;
  Q.push([a[0]+dd[0]*t+w1[0]*o1+w2[0]*o2,a[1]+dd[1]*t-4*sag*t*(1-t)+w1[1]*o1+w2[1]*o2,a[2]+dd[2]*t+w1[2]*o1+w2[2]*o2])}
 for(let i=1;i<=n;i++){const pr=Q[i-1],q=Q[i],dr=nrm([q[0]-pr[0],q[1]-pr[1],q[2]-pr[2]]),tc=nrm([cp[0]-pr[0],cp[1]-pr[1],cp[2]-pr[2]]),w=nrm(cross(dr,tc)),dist=len([cp[0]-pr[0],cp[1]-pr[1],cp[2]-pr[2]]),hw=Math.max(wmin,dist*.0009);
  const edge=[.05,.05,.06],sf=hw*1.45,so=dist*.003;
  quad([pr[0]-w[0]*sf,pr[1]-w[1]*sf,pr[2]-w[2]*sf],[pr[0]+w[0]*sf,pr[1]+w[1]*sf,pr[2]+w[2]*sf],[q[0]+w[0]*sf,q[1]+w[1]*sf,q[2]+w[2]*sf],[q[0]-w[0]*sf,q[1]-w[1]*sf,q[2]-w[2]*sf],edge);
  const o=[tc[0]*so,tc[1]*so,tc[2]*so];const cc=i%2?col:[col[0]*2.6+.05,col[1]*2.6+.055,col[2]*2.6+.065];quad([pr[0]-w[0]*hw+o[0],pr[1]-w[1]*hw+o[1],pr[2]-w[2]*hw+o[2]],[pr[0]+w[0]*hw+o[0],pr[1]+w[1]*hw+o[1],pr[2]+w[2]*hw+o[2]],[q[0]+w[0]*hw+o[0],q[1]+w[1]*hw+o[1],q[2]+w[2]*hw+o[2]],[q[0]-w[0]*hw+o[0],q[1]-w[1]*hw+o[1],q[2]-w[2]*hw+o[2]],cc)}
 const gt=(performance.now()*.0011+sd*.37)%1,gi=Math.min(n,Math.floor(gt*n)),gp=Q[gi];tgt=vfx;const r=nrm(cross(nrm([cp[0]-gp[0],cp[1]-gp[1],cp[2]-gp[2]]),[0,1,0])),gs=Math.max(.03,len([cp[0]-gp[0],cp[1]-gp[1],cp[2]-gp[2]])*.0024);
 quad([gp[0]-r[0]*gs,gp[1]-gs,gp[2]-r[2]*gs],[gp[0]+r[0]*gs,gp[1]-gs,gp[2]+r[2]*gs],[gp[0]+r[0]*gs,gp[1]+gs,gp[2]+r[2]*gs],[gp[0]-r[0]*gs,gp[1]+gs,gp[2]-r[2]*gs],[1,1,1,.7],null,true);tgt=null}
function ropeOrigin(i){const cy=st.wyaw,sx=i?-.14:.14;return[H[0]+Math.cos(cy)*sx,H[1]-.06,H[2]-Math.sin(cy)*sx]}

function drawBoxes(dt){const sp=len(v),hs=Math.hypot(v[0],v[2]);if(hs>2){const t=1-Math.exp(-dt*8);face[0]+=(v[0]/hs-face[0])*t;face[2]+=(v[2]/hs-face[2])*t}else{const t=1-Math.exp(-dt*5);face[0]+=(Math.sin(st.wyaw)-face[0])*t;face[2]+=(Math.cos(st.wyaw)-face[2])*t}
 const fl=nrm([face[0],0,face[2]]),tl=grounded?0:Math.min(1.25,sp/38*1.25);lean+=(tl-lean)*Math.min(1,dt*6);
 const U=nrm([fl[0]*Math.sin(lean),Math.cos(lean),fl[2]*Math.sin(lean)]),F=nrm([fl[0]*Math.cos(lean)-0*0,-Math.sin(lean),fl[2]*Math.cos(lean)]),R=nrm(cross(U,F));
 const o=[H[0],H[1]-HH*Math.cos(lean*.5)+0,H[2]],at=(x,y,z)=>[o[0]+R[0]*x*SC+U[0]*y*SC+F[0]*z*SC,o[1]+R[1]*x*SC+U[1]*y*SC+F[1]*z*SC,o[2]+R[2]*x*SC+U[2]*y*SC+F[2]*z*SC];
 const dk=[.17,.17,.2],sk=[.9,.78,.65],jk=[.42,.36,.26],wh=[.9,.9,.86],gr=[.22,.35,.23],st2=[.55,.58,.62],bl=[.08,.08,.08];
 box(at(-.11,.42,0),.07*SC,.42*SC,.08*SC,R,U,F,dk);box(at(.11,.42,0),.07*SC,.42*SC,.08*SC,R,U,F,dk);
 box(at(0,1.05,0),.2*SC,.28*SC,.11*SC,R,U,F,jk);box(at(0,1.2,.1),.1*SC,.1*SC,.01*SC,R,U,F,wh);
 box(at(0,1.52,0),.1*SC,.11*SC,.1*SC,R,U,F,sk);box(at(0,1.62,-.01),.105*SC,.055*SC,.108*SC,R,U,F,bl);
 const sw=.5+lean*.4;box(at(-.27,1.08,.1*sw),.05*SC,.26*SC,.05*SC,R,U,F,jk);box(at(.27,1.08,.1*sw),.05*SC,.26*SC,.05*SC,R,U,F,jk);
 box(at(0,1.0,-.16-lean*.06),.24*SC,.42*SC,.02*SC,R,U,F,gr);box(at(-.16,.85,-.12),.07*SC,.06*SC,.07*SC,R,U,F,st2);box(at(.16,.85,-.12),.07*SC,.06*SC,.07*SC,R,U,F,st2)}
let cling=0,clingN=[0,0,0],vlt=null,dtFx=.016,camDist=9,BAS=[[1,0,0],[0,1,0],[0,0,1]];const LV=new Anim();let wasG=true,flipPick=0;
const pick=a=>a[Math.floor(Math.random()*a.length)];
function levi_ev(n,rate,fd){LV.play(n,false,rate,fd)}

let gaitPh=0,swimPh=0,swimming=false,wasSw=false,gasFx=false;
function gaitW(u){const sm=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},w0=1-sm((u-2.2)/1.8),w2=sm((u-5.2)/2.6);return[w0,(1-w0)*(1-w2),(1-w0)*w2]}
function gaitRate(u){const G=gaitKeys(u),m=G.m,pr=6.2832*u/(1.55+.51*Math.max(0,u-1.4))*1.08;const f=p=>{const h=(2+(cr(G.h,p)-2)*m)*.01745,k=(4+(cr(G.k,p)-4)*m)*.01745;return .43*(Math.sin(h)+Math.sin(h-k))};const S=Math.max(.05,(f(0)-f(G.s))/(G.s*6.2832));return Math.max(3.2,Math.min(14.5,u/S))}
function cr(a,p){p=(((p%1)+1)%1)*10;const i=Math.floor(p),t=p-i,g=j=>a[(j+10)%10],p0=g(i-1),p1=g(i),p2=g(i+1),p3=g(i+2);return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)}
const GK=[{h:[27,27,19,7,-5,-11,-11,-3,9,21],k:[5,17,12,6,8,24,45,64,48,15],g:1,e0:20,ek:.7,L:.04,s:.6,xs:.2,xf:.14},
 {h:[26,14,0,-12,-22,-8,20,42,48,40],k:[14,35,25,15,28,70,100,105,85,45],g:1.15,e0:88,ek:.2,L:.2,s:.42,xs:.15,xf:.08},
 {h:[30,18,2,-16,-28,-10,25,60,68,50],k:[22,42,30,20,32,95,130,122,85,40],g:1.2,e0:92,ek:.25,L:.4,s:.35,xs:.12,xf:.05}];
function gaitKeys(u){const W=gaitW(u),G={h:new Array(10).fill(0),k:new Array(10).fill(0),g:0,e0:0,ek:0,L:0,s:0,xs:0,xf:0,hm:0};for(let c=0;c<3;c++){const w=W[c],P=GK[c];for(let i=0;i<10;i++){G.h[i]+=P.h[i]*w;G.k[i]+=P.k[i]*w}for(const q of['g','e0','ek','L','s','xs','xf'])G[q]+=P[q]*w}G.hm=G.h.reduce((a,b)=>a+b,0)/10;const x=Math.max(0,Math.min(1,u/1.1));G.m=x*x*(3-2*x);return G}
function gaitProc(o){clipPose('L:Unarmed Idle',0,true,o);const hs=window.__gv!==undefined?window.__gv:Math.hypot(v[0],v[2]),gp_=window.__gp!==undefined?window.__gp:gaitPh,u=Math.min(8,hs/PLS),G=gaitKeys(u),m=G.m,D=.01745,set=(nm,x,y,z)=>{const i=AN.pi[nm]*3,l=Math.hypot(x,y,z)||1;o.d[i]=x/l;o.d[i+1]=y/l;o.d[i+2]=z/l};
 const lk=Math.min(1,landT/.35),L=G.L*m+.4*lk;symTorso(o,0,0,0);
 const sw=Math.sin(gp_)*(.03+.04*Math.min(1,u/6))*m;
 set('Bip001 Pelvis',sw*.6,1,.7*L);set('Bip001 Spine',-sw*.8,1,L);set('Bip001 Spine1',-sw*.4,1,L*1.02);set('Bip001 Spine2',sw*.3,1,L*.96);set('Bip001 Neck',0,1,L*.5);
 for(const sd of[1,-1]){const nm=sd>0?'L':'R',p=gp_/6.2832+(sd>0?0:.5);
  let th=(2+(cr(G.h,p)-2)*m)*D,kn=(4+(cr(G.k,p)-4)*m)*D;th=th*(1-.6*lk)+.75*lk;kn=kn*(1-.6*lk)+1.35*lk;
  set('Bip001 '+nm+' Thigh',.03*sd,-Math.cos(th),Math.sin(th));const ca=th-kn;set('Bip001 '+nm+' Calf',.03*sd,-Math.cos(ca),Math.sin(ca));
  const dev=(cr(G.h,p)-2)-(G.hm-2)*1,ph2=(dev*m)*G.g,phi=(-ph2+4*m)*D,el=((6+(G.e0-6)*m)+G.ek*Math.max(0,phi/D)*m)*D;
  set('Bip001 '+nm+' UpperArm',G.xs*sd,-Math.cos(phi),Math.sin(phi));const fa=phi+el;set('Bip001 '+nm+' Forearm',G.xf*sd,-Math.cos(fa),Math.sin(fa));
  const i=AN.pi['Bip001 '+nm+' Clavicle']*3;o.d[i+2]+=-.1*Math.cos(p*6.2832)*m*sd*-1;const l=Math.hypot(o.d[i],o.d[i+1],o.d[i+2]);o.d[i]/=l;o.d[i+1]/=l;o.d[i+2]/=l}
 o.q=[1,0,0,0];o.y=-.16*Math.min(1,landT/.35)}
function symTorso(o,fw,sw,nk){const set=(nm,x,y,z)=>{const i=AN.pi[nm]*3,l=Math.hypot(x,y,z)||1;o.d[i]=x/l;o.d[i+1]=y/l;o.d[i+2]=z/l};nk=nk===undefined?-.18:nk;
 set('Bip001 Pelvis',sw*.5,1,fw*.35);set('Bip001 Spine',-sw*.7,1,fw*.45);set('Bip001 Spine1',-sw*.3,1,fw*.3);set('Bip001 Spine2',sw*.2,1,fw*.2);set('Bip001 Neck',0,1,fw*nk);set('Bip001 L Clavicle',.985,.13,-.1);set('Bip001 R Clavicle',-.985,.13,-.1)}
function heldProc(o){clipPose('L:Unarmed Idle',0,true,o);const g=grab,t=performance.now()*.001,en=g?Math.max(.25,1-.2*(g.n||0)):1,es=en*(.6+.4*Math.min(1,g?g.esc+.3:0)),set=(nm,x,y,z)=>{const i=AN.pi[nm]*3,l=Math.hypot(x,y,z)||1;o.d[i]=x/l;o.d[i+1]=y/l;o.d[i+2]=z/l};
 symTorso(o,-.1,Math.sin(t*6)*.05*es,.2);
 for(const sd of[1,-1]){const nm=sd>0?'L':'R',ph=sd>0?0:1.7,a=Math.sin(t*9+ph)*es,b=Math.cos(t*7.3+ph)*es;
  set('Bip001 '+nm+' UpperArm',sd*(.45+.35*a),-.55+.3*b,.35+.3*a);set('Bip001 '+nm+' Forearm',sd*(.3+.3*a),-.4+.4*b,.8+.2*a);
  const th=(.35+.25*Math.sin(t*8.5+ph)*es)*.6,kn=(.5+.45*Math.max(0,Math.sin(t*8.5+ph+1))*es)*.5;set('Bip001 '+nm+' Thigh',.06*sd,-Math.cos(th),Math.sin(th));set('Bip001 '+nm+' Calf',.04*sd,-Math.cos(th-kn),Math.sin(th-kn)*.6)}
 o.q=[1,0,0,0];o.y=0}
function swimProc(o){clipPose('L:Unarmed Idle',0,true,o);const ph=swimPh,set=(nm,x,y,z)=>{const i=AN.pi[nm]*3,l=Math.hypot(x,y,z)||1;o.d[i]=x/l;o.d[i+1]=y/l;o.d[i+2]=z/l},mv=Math.min(1,Math.hypot(v[0],v[2])/1.2);
 for(const sd of[1,-1]){const nm=sd>0?'L':'R',p=ph+(sd>0?0:Math.PI),r=.5+.5*mv,q=p;
  set('Bip001 '+nm+' UpperArm',.28*sd,Math.cos(q)*r+(1-r)*.2,Math.sin(q)*r);set('Bip001 '+nm+' Forearm',.2*sd,Math.cos(q+.7)*r+(1-r)*.3,Math.sin(q+.7)*r+(1-r)*.2);
  const q2=p*2+(sd>0?0:1.7),th=(.2+.5*mv)*Math.sin(q2)+.12,kn=.65+(.3+.5*mv)*Math.sin(q2-1.1);set('Bip001 '+nm+' Thigh',.05*sd,-Math.cos(th),Math.sin(th));set('Bip001 '+nm+' Calf',.04*sd,-Math.cos(th-kn),Math.sin(th-kn))}
 symTorso(o,.05*Math.sin(ph*2),Math.sin(ph)*.06*(.4+mv),0);set('Bip001 Neck',0,.9,-.4);
 o.q=[Math.cos(.62),Math.sin(.62),0,0];o.y=0}
let FPS={w:[1,0,0,0,0],t:0,pv:[0,0,0],acc:0};
function flightState(){const hooked=(hk[0].on&&hk[0].att)||(hk[1].on&&hk[1].att),now=performance.now()*.001,dt=Math.min(.05,Math.max(0,now-FPS.t));FPS.t=now;const tg=[0,0,0,0,0];
 if(gasFx&&!grounded)tg[4]=1;else if(hooked)tg[1]=1;else if(v[1]<-5)tg[2]=1;else if(v[1]>1.2)tg[3]=1;else tg[0]=1;
 const k=Math.min(1,dt*6);for(let i=0;i<5;i++)FPS.w[i]+=(tg[i]-FPS.w[i])*k;
 if(dt>.002){const Fx=[face[0],0,face[2]],af=dot([v[0]-FPS.pv[0],v[1]-FPS.pv[1],v[2]-FPS.pv[2]],Fx)/dt;FPS.pv=v.slice();FPS.acc+=(Math.max(-40,Math.min(40,af))-FPS.acc)*Math.min(1,dt*4)}
 return{hooked,now,w:FPS.w,acc:FPS.acc}}
function legsFlight(S,sd,a){const w=S.w,t=S.now,ph=sd>0?0:2.2;let th=0,kn=0,sp=.04;const sw1=Math.sin(t*1.9+ph),sw2=Math.sin(t*3.3+ph*1.7);
 th+=w[0]*(.14+.18*sw1);kn+=w[0]*(.45+.25*sw2);
 th+=w[1]*(-.2-.3*a+.28*sw1-S.acc*.006+(sd>0?.12:-.1)*Math.sin(t*4.4)+(sd>0?.6:.38)*yankT);kn+=w[1]*(.5+.4*a+.15*sw2+.9*yankT);
 th+=w[2]*((sd>0?.6:-.15)+.45*Math.sin(t*7+ph));kn+=w[2]*(.95+.45*Math.sin(t*7+ph+1));sp+=w[2]*.16;
 const rise=Math.max(0,Math.min(1,v[1]/4.5));th+=w[3]*((sd>0?.9:.45)*rise+.3*(1-rise)+.14*Math.sin(t*5+ph));kn+=w[3]*((sd>0?1.55:1.0)*rise+.5*(1-rise)+.2*Math.sin(t*5.7+ph+1));
 th+=w[4]*(-.42+.14*sw1+(sd>0?.1:-.06));kn+=w[4]*(.35+.22*sw2);sp-=w[4]*.02;return{th,kn,sp}}
function flightProc(o){clipPose('L:Unarmed Idle',0,true,o);const S=flightState(),sp=len(v),a=Math.min(1,sp/16),t=S.now,set=(nm,x,y,z)=>{const i=AN.pi[nm]*3,l=Math.hypot(x,y,z)||1;o.d[i]=x/l;o.d[i+1]=y/l;o.d[i+2]=z/l};
 const mx=(g,r)=>[g[0]+(r[0]-g[0])*a,g[1]+(r[1]-g[1])*a,g[2]+(r[2]-g[2])*a];
 for(const sd of[1,-1]){const nm=sd>0?'L':'R',idx=sd>0?0:1,ph=sd>0?0:1.9,L=legsFlight(S,sd,a);
  let ua=mx([.16*sd,-1,0],[.3*sd,-.85,-.3]),fa=mx([.1*sd,-.8,.4],[.1*sd,-.3,.95]);ua[2]+=.12*Math.sin(t*2.3+ph);fa[1]+=.1*Math.sin(t*3.1+ph);
  const fl=(!grounded&&!S.hooked&&v[1]<-4)?Math.min(1,(-v[1]-4)/8):0;if(fl){ua=[sd,-.1+.25*Math.sin(t*7+ph),.1+.2*Math.cos(t*6+ph)];fa=[sd,-.1+.2*Math.sin(t*8+ph),.1]}
  if((fireT[idx]>0||(hk[idx].on&&hk[idx].att))&&hk[idx].on){const w=nrm([hk[idx].a[0]-H[0],hk[idx].a[1]-H[1],hk[idx].a[2]-H[2]]),k=fireT[idx]>0?Math.min(1,fireT[idx]/.15):.5,lw=[dot(w,BAS[0]),dot(w,BAS[1]),dot(w,BAS[2])];ua=ua.map((x,j)=>x+(lw[j]-x)*k);fa=fa.map((x,j)=>x+(lw[j]-x)*k)}
  const [u0,u1,u2]=nrm(ua),[f0,f1,f2]=nrm(fa);set('Bip001 '+nm+' UpperArm',u0,u1,u2);set('Bip001 '+nm+' Forearm',f0,f1,f2);
  set('Bip001 '+nm+' Thigh',L.sp*sd,-Math.cos(L.th),Math.sin(L.th));set('Bip001 '+nm+' Calf',.04*sd,-Math.cos(L.th-L.kn),Math.sin(L.th-L.kn))}
 symTorso(o,.1+.3*a+.1*S.w[4]+.28*yankT+.08*Math.sin(t*1.6),Math.sin(t*2.1)*.05*a+(S.hooked?Math.sin(t*3.2)*.03:0),-.4);o.q=[1,0,0,0];o.y=0}
function overlayLegs(pz,wg){const S=flightState(),a=Math.min(1,len(v)/16);for(const sd of[1,-1]){const nm=sd>0?'L':'R',L=legsFlight(S,sd,a);for(const [b,dir] of[['Thigh',[L.sp*sd,-Math.cos(L.th),Math.sin(L.th)]],['Calf',[.04*sd,-Math.cos(L.th-L.kn),Math.sin(L.th-L.kn)]]]){const i=AN.pi['Bip001 '+nm+' '+b]*3,c=[pz.d[i],pz.d[i+1],pz.d[i+2]],n=nrm([c[0]+(dir[0]-c[0])*wg,c[1]+(dir[1]-c[1])*wg,c[2]+(dir[2]-c[2])*wg]);pz.d[i]=n[0];pz.d[i+1]=n[1];pz.d[i+2]=n[2]}}}


function secondary(M,mm,D,dt){dt=Math.min(.033,Math.max(.001,dt));if(!M.sec){const ch=[['Bone001','Bone002','Bone003','Bone004'],['Bone001(mirrored)','Bone002(mirrored)','Bone003(mirrored)','Bone004(mirrored)'],['Bone008','Bone009','Bone010','Bone011'],['Bone008(mirrored)','Bone009(mirrored)','Bone010(mirrored)','Bone011(mirrored)']];M.sec=ch.map((nm,ci)=>({nm,id:nm.map(n=>M.id(n)),hair:ci>=2,P:null,Q:null}));for(const c of M.sec)for(let j=0;j<3;j++)if(c.id[j]>=0&&c.id[j+1]>=0)M.ac[c.id[j]]=c.id[j+1]}
 const sx=len([mm[0],mm[1],mm[2]])||1,Rn=[mm[0]/sx,mm[1]/sx,mm[2]/sx],Un=[mm[4]/sx,mm[5]/sx,mm[6]/sx],Fn=[mm[8]/sx,mm[9]/sx,mm[10]/sx],toW=w=>[mm[0]*w[12]+mm[4]*w[13]+mm[8]*w[14]+mm[12],mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13],mm[2]*w[12]+mm[6]*w[13]+mm[10]*w[14]+mm[14]];let any=false;
 for(const c of M.sec){if(c.id.some(i=>i<0))continue;const A=c.id.map(i=>toW(M.W[i]));if(!c.P||Math.hypot(c.P[0][0]-A[0][0],c.P[0][1]-A[0][1],c.P[0][2]-A[0][2])>1.5){c.P=A.map(x=>x.slice());c.Q=A.map(x=>x.slice())}
  const damp=Math.pow(c.hair?.84:.9,dt*60),g=(c.hair?4:8)*dt*dt,kk=c.hair?[0,.42,.3,.25]:[0,.34,.2,.12];
  for(let j=1;j<4;j++){const P=c.P[j],Q=c.Q[j],n=[0,0,0];for(let k=0;k<3;k++)n[k]=P[k]+(P[k]-Q[k])*damp+(A[j][k]-P[k])*kk[j];n[1]-=g;c.Q[j]=P;c.P[j]=n}c.P[0]=A[0];
  for(let it=0;it<2;it++)for(let j=0;j<3;j++){const rest=len([A[j+1][0]-A[j][0],A[j+1][1]-A[j][1],A[j+1][2]-A[j][2]]),d=[c.P[j+1][0]-c.P[j][0],c.P[j+1][1]-c.P[j][1],c.P[j+1][2]-c.P[j][2]],l=len(d)||1e-6,cr=(l-rest)/l;for(let k=0;k<3;k++){if(j===0)c.P[1][k]-=d[k]*cr;else{c.P[j][k]+=d[k]*cr*.5;c.P[j+1][k]-=d[k]*cr*.5}}}
  for(let j=0;j<3;j++){const d=nrm([c.P[j+1][0]-c.P[j][0],c.P[j+1][1]-c.P[j][1],c.P[j+1][2]-c.P[j][2]]);D[c.nm[j]]=[dot(d,Rn),dot(d,Un),dot(d,Fn)]}any=true}
 if(any)M.pose(D)}
function drawAvatar(dt){const M=MD.levi;if(!M||!AN)return drawBoxes(dt);const sp=len(v),hs=Math.hypot(v[0],v[2]),hooked=(hk[0].on&&hk[0].att)||(hk[1].on&&hk[1].att);
 if(hs>(grounded||swimming?.25:2)){const t=1-Math.exp(-dt*(swimming?5:9));face[0]+=(v[0]/hs-face[0])*t;face[2]+=(v[2]/hs-face[2])*t}else{const t=1-Math.exp(-dt*5);face[0]+=(Math.sin(st.wyaw)-face[0])*t;face[2]+=(Math.cos(st.wyaw)-face[2])*t}
  yankT=Math.max(0,yankT-dt*1.7);slashT=Math.max(0,slashT-dt);slashCD=Math.max(0,slashCD-dt);landT=Math.max(0,landT-dt);fireT[0]=Math.max(0,fireT[0]-dt);fireT[1]=Math.max(0,fireT[1]-dt);flipT=Math.max(0,flipT-dt);rollT=Math.max(0,rollT-dt);
 // events -> one-shot clips
 if(pend){levi_ev(pend[0],pend[1],.1);pend=null}
 
 wasG=grounded;
 if(LV.one&&LV.done())LV.one=false;
 if(grounded&&hs>.12&&!LV.one){const u_=Math.max(.3,Math.min(8,hs/PLS));gaitPh+=gaitRate(u_)*dt}if(swimming)swimPh+=dt*(2.6+Math.min(3,hs*2.2));
 if(!LV.one){if(grab)LV.play('HELD',true,1,.2);else if(swimming)LV.play('SWIM',true,1,.3);else if(grounded){if(hs<.12)LV.play('L:Unarmed Idle',true,1,.25);else LV.play('GAIT',true,1,.22)}else if(cling>0)LV.play('L:Hanging Idle',true,1,.2);else LV.play('FLIGHT',true,1,.2)}
 const k=(grab||grounded||LV.one||cling>0)?0:Math.min(.55,Math.max(0,(sp-6)/30)),vh=sp>1?nrm(v):[0,1,0],tU=(grab&&grab.fr)?grab.fr.U:nrm([vh[0]*k,(1-k)+vh[1]*k,vh[2]*k]),bt=Math.min(1,dt*(grab?14:8));bu=nrm([bu[0]+(tU[0]-bu[0])*bt,bu[1]+(tU[1]-bu[1])*bt,bu[2]+(tU[2]-bu[2])*bt]);
 let fl=(grab&&grab.fr)?grab.fr.Fl:nrm([face[0],0,face[2]]);const U=bu,cd=[fl[0]*(1-k),fl[1]*(1-k)-k,fl[2]*(1-k)],dd=dot(cd,U);let F=nrm([cd[0]-U[0]*dd,cd[1]-U[1]*dd,cd[2]-U[2]*dd]);if(len(F)<.3)F=nrm(cross(U,[1,0,0]));const R=nrm(cross(U,F));
 BAS=[R,U,F];const pz=LV.get(dt,flightProc);if(!pz)return drawBoxes(dt);armedT=Math.max(0,armedT-dt);if(titan&&!titan.dead&&Math.hypot(H[0]-titan.x,H[2]-titan.z)<42)armedT=Math.max(armedT,2.5);if(grab)armedT=Math.max(armedT,2);{const was=armK>.35;armK+=((armedT>0?1:0)-armK)*Math.min(1,dt*(armedT>0?9:5));if(!was&&armK>.35&&armedT>0){const hp_=[H[0],H[1]+.1,H[2]];burst(hp_,[0,1,0],[.9,.95,1],5,2.5,.05,.25,0,.9,.3,4)}handCurl(M,dt)}if(!grounded&&!swimming&&LV.one&&!grab&&!/Crash|Climb|Impact|Carried|Roll|Death|Landing|Hanging/.test(LV.cur||''))overlayLegs(pz,.55);pz.k=(grounded&&!grab&&LV.cur&&/Idle|Walk|Jog|Sprint|GAIT/.test(LV.cur))?1:0;const dirs0=toDirs(pz,pz.k);M.pose(dirs0);const o=[H[0]-U[0]*HH,H[1]-U[1]*HH,H[2]-U[2]*HH],mm_=relModel(R.map(x=>x*PLS),U.map(x=>x*PLS),F.map(x=>x*PLS),o,pz,.9);if(grounded&&!grab&&!vlt)groundFixL(M,mm_,H[1]-HH,!(LV.one&&/Flip|Corkscrew|Jump|Crash|Climb/.test(LV.cur||'')),PLS,pz.k===1&&!LV.one,dt);secondary(M,mm_,dirs0,dt);lastLeviMM=mm_;if(!(camDist<.75)&&!(grab&&grab.eaten)){drawModel(M,mm_,LVHIDE?1:0,null,LVHIDE,armK>.4?null:/Sword/);if(grab&&LVHIDE)drawLeviStumps(M,mm_)}trailStep(dt,M,mm_)}

// ================= story actors: NPCs, the child player, static props (Colossal) =================
// Any model converted by tools/convert_model.py can be posed with the shared Mixamo-derived clip set.
const ACTORS=[];let ACT_ID=1;
const ACT_GEAR=/weapon|sword|odm|gangsheng|quiver|bow|heixian|juren|pifeng|wuqi|zhuangbei|xinhao|jianto|gongjian/i;
function actClass(a,mat){const m=mat.toLowerCase();
 if(/hair|beard|moustache|mustache|brow|lash/.test(m))return'hair';
 if(a.kind==='fuse'){if(/^body$/.test(m))return'skin';if(/shoe|boot/.test(m))return'shoes';if(/bottom|pant|trouser/.test(m))return'bottom';return'top'}
 if(/face|skin/.test(m))return'skin';if(/foot|boot|shoe/.test(m))return'shoes';return'top'}
function actTint(a){return mat=>{const L=a.look;if(!L)return null;const c=actClass(a,mat),col=L[c];if(!col)return null;return c==='skin'?[col[0],col[1],col[2],0]:[col[0],col[1],col[2],1]}}
function actorClip(a,sp){
 if(a.pose==='crouch')return['L:Crouch Idle',1];
 if(a.pose==='fall')return[AN.meta.clips['L:Falling Idle']?'L:Falling Idle':'L:Unarmed Idle',1];
 if(sp>3.4)return['L:Sprint',Math.min(1.5,.55+sp/7)];
 if(sp>1.5)return['L:Jog Forward',Math.min(1.4,.5+sp/4.5)];
 if(sp>.25)return['L:Standard Walk',Math.min(1.5,.4+sp/1.7)];
 return[a.idle||'L:Unarmed Idle',1]}
function drawActors(dt){
 if(!AN||!gl||!ACTORS.length)return;dt=Math.min(.05,dt||.016);
 for(const a of ACTORS){
  const M=MD[a.key];if(!M||a.hidden)continue;
  if(a.isPlayer){const sp=Math.hypot(v[0],v[2]);a.x=H[0];a.z=H[2];a.gy=H[1]-HH;
    if(sp>.4){const ty=Math.atan2(v[0],v[2]);let d=ty-a.yaw;while(d>Math.PI)d-=6.2832;while(d<-Math.PI)d+=6.2832;a.yaw+=d*Math.min(1,dt*9)}
    a.speed=grounded?sp:0;if(!grounded&&!swimming)a.pose='fall';else if(a.pose==='fall')a.pose=null}
  else{
   if(a.path&&a.path.length&&!a.talking){const w=a.path[a.pi%a.path.length];
    if(a.wait>0){a.wait-=dt;a.speed=0}else{const dx=w[0]-a.x,dz=w[1]-a.z,d=Math.hypot(dx,dz);
     if(d<.35){a.pi++;a.wait=w[2]||0;a.speed=0}else{const sp=a.walk||1.1,st=Math.min(d,sp*dt);a.x+=dx/d*st;a.z+=dz/d*st;a.speed=sp;let q=Math.atan2(dx,dz)-a.yaw;while(q>Math.PI)q-=6.2832;while(q<-Math.PI)q+=6.2832;a.yaw+=q*Math.min(1,dt*6)}}}
   else a.speed=0;
   if(a.lookAt){let q=Math.atan2(a.lookAt[0]-a.x,a.lookAt[1]-a.z)-a.yaw;while(q>Math.PI)q-=6.2832;while(q<-Math.PI)q+=6.2832;a.yaw+=q*Math.min(1,dt*4)}
   a.gy=a.gy===undefined?gh(a.x,a.z):a.gy+(gh(a.x,a.z)-a.gy)*Math.min(1,dt*10)}
  if(Math.hypot(a.x-H[0],a.z-H[2])>170&&!a.isPlayer)continue;
  if(!a.static){
   if(!a.an){a.an=new Anim();a.ph=Math.random()*5}
   const [cn,rt]=actorClip(a,a.speed||0);a.an.play(cn,true,rt,.25);if(a.clipT!=null){a.an.t=a.clipT;a.an.rate=0;a.an.f=1}/* a.clipT: scrub a clip by time (opening cutscene) */
   const pz=a.an.get(dt,()=>{});if(!pz)continue;pz.k=1;if(a.poseFn)a.poseFn(pz,a,M);/* a.poseFn: edit the pose before it is drawn */
   if(a.talking){const t=a.ph=(a.ph||0)+dt;const g=Math.sin(t*2.3)*.5+.5;const r=AN.pi['Bip001 R Forearm'];if(r!==undefined&&a.talkGest!==false){const i=r*3;pz.d[i+1]+=g*.45;pz.d[i]-=g*.18}}
   const hs=a.headScale||1,hi=M.hi===undefined?(M.hi=M.id('Bip001 Head')):M.hi;let sv=null;
   if(hs!==1&&hi>=0){sv=M.loc.slice(hi*16,hi*16+12);for(let k=0;k<12;k++)if(k%4<3)M.loc[hi*16+k]*=hs}
   M.pose(toDirs(pz,1));if(sv)M.loc.set(sv,hi*16);
   const sc=a.scale,wd=a.wide||1,U=[0,1,0],F=[Math.sin(a.yaw),0,Math.cos(a.yaw)],R=nrm(cross(U,F)),o=[a.x,a.gy+(a.fly||0),a.z];
   const mm=relModel(R.map(x=>x*sc*wd),U.map(x=>x*sc),F.map(x=>x*sc*wd),o,pz,M.py);if(a.vg!==undefined){if(M.low){let mn=1e9;for(const i of M.low){const w=M.W[i],y=mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13];if(y<mn)mn=y}mm[13]+=a.vg+(M.py||1)*.075*sc-mn}}else if(!a.fly)groundFix(M,mm,a.gy,true,sc);/* a.vg: a virtual ground height, unclamped (the opening sinks or heaves the Colossal) *//* a.fly: metres above ground, used by the opening for flying Scouts */
   M.tintFn=a.tintFn||(a.tintFn=actTint(a));drawModel(M,mm,0,null,null,a.skipRe||(a.kind==='aot'?ACT_GEAR:null));
  }else{
   M.pose({});const sc=a.scale,U=[0,1,0],F=[Math.sin(a.yaw),0,Math.cos(a.yaw)],R=nrm(cross(U,F)),mm=modelMat(R,U,F,[a.x,a.y||0,a.z],sc);
   M.tintFn=null;drawModel(M,mm,0,null,null,a.skipRe||null)}}}
window.__initHandLoc=initHandLoc;window.__actors={
 list:ACTORS,
 add(d){const a=Object.assign({id:ACT_ID++,x:0,z:0,yaw:0,scale:PLS,kind:'aot',look:null,pi:0,wait:0,speed:0},d);ACTORS.push(a);return a},
 remove(id){const i=ACTORS.findIndex(a=>a.id===id);if(i>=0)ACTORS.splice(i,1)},
 clear(keepPlayer){for(let i=ACTORS.length-1;i>=0;i--)if(!(keepPlayer&&ACTORS[i].isPlayer))ACTORS.splice(i,1)},
 has:k=>!!MD[k],keys:()=>Object.keys(MD),
 bodyHeight:k=>MD[k]&&MD[k].bodyHeight,
 loadModel:async(key)=>{const M=await loadModel(key);return M},
 PLS,HH,LEVI_H:1.62};
function cyl(c,r,h,Rx,Ux,Fx,col,seg){seg=seg||8;const pt=(a,y)=>{const cx=Math.cos(a)*r,cz=Math.sin(a)*r;return[c[0]+Rx[0]*cx+Ux[0]*y+Fx[0]*cz,c[1]+Rx[1]*cx+Ux[1]*y+Fx[1]*cz,c[2]+Rx[2]*cx+Ux[2]*y+Fx[2]*cz]};
 for(let i=0;i<seg;i++){const a0=i/seg*6.2832,a1=(i+1)/seg*6.2832,am=(a0+a1)/2,n=[Rx[0]*Math.cos(am)+Fx[0]*Math.sin(am),Rx[1]*Math.cos(am)+Fx[1]*Math.sin(am),Rx[2]*Math.cos(am)+Fx[2]*Math.sin(am)];quad(pt(a0,-h),pt(a1,-h),pt(a1,h),pt(a0,h),col,n);tri(pt(a0,h),pt(a1,h),[c[0]+Ux[0]*h,c[1]+Ux[1]*h,c[2]+Ux[2]*h],col,1)}}
function drawBoatDetails(){const E_=E,xs=E_.boatXf;if(!xs||!xs.length)return;const t=performance.now()*.001;
 for(const b of xs){if(Math.hypot(b.px-H[0],b.pz-H[2])>150)continue;const R=b.R,Rx=[R[0][0],R[1][0],R[2][0]],Ux=[R[0][1],R[1][1],R[2][1]],Fx=[R[0][2],R[1][2],R[2][2]],P=(x,y,z)=>[R[0][0]*x+R[0][1]*y+R[0][2]*z+b.px,R[1][0]*x+R[1][1]*y+R[1][2]*z+b.py,R[2][0]*x+R[2][1]*y+R[2][2]*z+b.pz];
  const B=(x,y,z,hx,hy,hz,col)=>box(P(x,y,z),hx,hy,hz,Rx,Ux,Fx,col),C=(x,y,z,r,h,col,s)=>cyl(P(x,y,z),r,h,Rx,Ux,Fx,col,s),wood=[.46,.3,.17],dk=[.24,.15,.09],iron=[.12,.12,.14],rope=[.62,.5,.32],fl=.5+.5*Math.sin(t*9+b.ph*3);
  const lamp=(x,y,z,s,col)=>{const sw=Math.sin(t*1.7+b.ph+z)*.05;B(x+sw,y,z,s*.55,s*.8,s*.55,[col[0]*(.85+.2*fl),col[1]*(.85+.2*fl),col[2]*(.85+.2*fl)]);B(x+sw,y+s*.95,z,s*.4,s*.1,s*.4,iron);B(x+sw,y-s*.95,z,s*.4,s*.1,s*.4,iron)};
  if(!b.row){
   // eave lanterns with hanging cords
   for(let z=-6.5;z<=6.6;z+=2.17)for(const sx of[-1,1]){B(sx*2.02,4.05,z,.015,.2,.015,rope);lamp(sx*2.02,3.7,z,.26,sx>0?[1.6,.55,.25]:[1.6,.95,.45])}
   // roof ridge details: finial boxes, lantern masts, flag
   B(0,4.95,7.7,.08,.22,.08,dk);B(0,4.95,-7.7,.08,.22,.08,dk);B(0,5.1,-12.6,.05,1.3,.05,dk);B(0,6.1,-11.9,.015,.35,.65,[.75,.12,.1]);
   // hull fenders and bollards
   for(let z=-11;z<=11;z+=3.7)for(const sx of[-1,1]){C(sx*3.98,.7,z,.22,.28,rope,6);B(sx*3.86,1.5,z,.12,.55,.12,dk)}
   for(const z of[-13.2,13.2])for(const sx of[-1,1]){C(sx*1.8,2.45,z,.2,.3,iron,6)}
   // bow deck cargo: crates, barrels, coiled rope, lantern post
   B(-1.5,2.7,11.9,.55,.45,.55,wood);B(-1.5,3.35,11.9,.45,.2,.45,[.52,.35,.2]);B(-.6,2.62,12.4,.42,.38,.42,[.4,.27,.15]);B(1.6,2.62,12.2,.5,.4,.5,wood);
   C(.4,2.85,12.1,.36,.64,[.4,.26,.14],8);C(.4,2.5,12.1,.375,.05,iron,8);C(.4,3.2,12.1,.375,.05,iron,8);C(1.2,2.8,11.2,.3,.58,[.36,.24,.13],8);C(1.2,2.55,11.2,.315,.04,iron,8);C(1.2,3.05,11.2,.315,.04,iron,8);
   for(let k=0;k<4;k++)C(-2.3,2.28+k*.07,12.2,.62-k*.03,.04,rope,10);
   B(2.7,3.0,13.1,.07,.85,.07,dk);lamp(2.7,4.1,13.1,.3,[1.7,1.15,.5]);B(-2.7,3.0,13.1,.07,.85,.07,dk);lamp(-2.7,4.1,13.1,.3,[1.7,1.15,.5]);
   // stern deck: oar rack, water barrels, tiller
   B(2.5,2.3,-14.6,.05,.1,1.4,dk);B(-2.5,2.3,-14.6,.05,.1,1.4,dk);B(0,2.35,-15.2,.06,.06,1.8,[.5,.36,.2]);C(-1.6,2.75,-14.7,.34,.6,[.38,.25,.14],8);C(1.6,2.75,-14.7,.34,.6,[.38,.25,.14],8);B(0,2.7,-15.9,.3,.5,.05,[.18,.12,.08]);
   // interior seen through glass: low tables, cushions, lamps, shelves
   for(const z of[-5.2,-.4,4.4]){B(0,1.18,z,1.05,.1,.8,[.35,.22,.12]);for(const sx of[-.9,.9])for(const sz of[-.65,.65])B(sx,.95,z+sz,.06,.2,.06,dk);
    B(-1.2,1.0,z,.4,.12,.4,[.55,.12,.12]);B(1.2,1.0,z,.4,.12,.4,[.15,.2,.5]);B(0,1.0,z-1.15,.4,.12,.35,[.5,.4,.12]);B(0,1.0,z+1.15,.4,.12,.35,[.12,.35,.3]);
    lamp(0,1.52,z,.17,[1.8,1.2,.55]);B(.45,1.34,z+.2,.1,.06,.1,[.8,.8,.82]);B(-.4,1.35,z-.25,.07,.07,.07,[.7,.25,.2])}
   for(const sx of[-1,1])for(let z=-11;z<=11;z+=2.2){B(sx*3.15,1.55,z,.12,.07,.9,dk);B(sx*3.1,1.8,z,.08,.16,.1,[.6,.55,.42])}
   B(0,3.6,0,.03,.4,.03,iron);
  }else{
   // row boat: thwarts, oars, bow lantern, rope, basket
   B(0,.62,-1.4,.82,.05,.18,wood);B(0,.62,.2,.82,.05,.18,wood);B(0,.62,1.7,.7,.05,.16,wood);
   for(const sx of[-1,1]){const a=Math.sin(t*1.1+b.ph+sx)*.05;B(sx*1.1,.9,-.2+a,.035,.035,.95,[.55,.4,.22]);B(sx*1.1,.88,.95+a,.1,.02,.25,[.5,.35,.2])}
   B(0,.95,2.7,.04,.6,.04,dk);lamp(0,1.75,2.7,.2,[1.8,1.2,.55]);for(let k=0;k<3;k++)C(.3,.7+k*.05,-2.2,.38-k*.04,.03,rope,8);
   C(-.4,.85,-2.3,.28,.2,[.55,.42,.2],8);B(0,.7,2.1,.3,.12,.3,[.36,.24,.14])}
 }}
function handCurl(M,dt){const t_=performance.now()*.001,hsx=Math.hypot(v[0],v[2])/PLS,run=grounded&&!swimming?Math.min(1,Math.max(0,(hsx-1.2)/2.8)):0,air=!grounded&&!swimming;M.lcS=M.lcS||[.25,.25];
 for(let i=0;i<2;i++){let t=.24+.05*Math.sin(t_*1.3+i*2.1);t+=(.8-t)*run;if(swimming)t=.2+.15*Math.sin(t_*6+i*3);else if(air){t=.32;if(hk[i].on)t=.92;if(fireT[i]>0)t=.98;if(gasFx)t=Math.max(t,.82)}if(landT>0||rollT>0)t=Math.max(t,.72);t+=(1-t)*armK;const c=M.lcS[i];M.lcS[i]+=(t-c)*Math.min(1,dt*(t>c?18:11))}M.lcT=t_;M.lcA=armK;M.lc.L=M.lcS[0];M.lc.R=M.lcS[1];pressureFx(dt);if(grounded&&hsx>4&&tick%5===0){const q=nrm([v[0],0,v[2]]);burst([H[0]-q[0]*.3,H[1]-HH+.05,H[2]-q[2]*.3],[-q[0]*.3,.6,-q[2]*.3],[.74,.66,.5],2,1.2,.16,.7,-.2,.35)}}
let pfx=null,pfT=0;
function pressureFx(dt){if(!pfx)pfx=document.querySelector('#odm .vg');if(!pfx)return;pfT+=dt;const low=Math.max(0,1-hp/(hpMax*.45)),chase=titan&&!titan.dead&&titan.state!=='idle'?Math.max(0,1-Math.hypot(H[0]-titan.x,H[2]-titan.z)/16):0,I=Math.min(1,Math.max(low,chase*.55,grab?1:0)),beat=.5+.5*Math.sin(pfT*(3+5*I));const a=I*(.28+.3*beat);pfx.style.background=I>.02?'radial-gradient(ellipse at center,rgba(0,0,0,0) '+(52-18*I*beat).toFixed(0)+'%,rgba(120,8,4,'+a.toFixed(2)+') 100%)':''}
let FB=null;
function buildFB(){const J=E.J,vf=A.vf,ib=A.ib,inst=A.inst,re=/^(canal_fence|mk_stall_[2-8]$|prop_sacks|mk_sack)/,CS=4,G=new Map();FB={G,CS};
 for(const d of J.draws){if(!re.test(d.g))continue;const g=J.geoms[d.g];for(const c of d.chunks)for(let k=0;k<c.n;k++){const o=(c.o+k)*16,w=i=>{const x=vf[i],y=vf[i+1],z=vf[i+2];return[inst[o]*x+inst[o+1]*y+inst[o+2]*z+inst[o+3],inst[o+4]*x+inst[o+5]*y+inst[o+6]*z+inst[o+7],inst[o+8]*x+inst[o+9]*y+inst[o+10]*z+inst[o+11]]};
  for(let q=g.i;q<g.i+g.in;q+=3){const a=w((g.v+ib[q])*9),b=w((g.v+ib[q+1])*9),c2=w((g.v+ib[q+2])*9),y0=Math.min(a[1],b[1],c2[1]),y1=Math.max(a[1],b[1],c2[1]);if(y1<.4)continue;
   const t={nm:d.g,a:[a[0],a[2]],b:[b[0],b[2]],c:[c2[0],c2[2]],y0,y1},x0=Math.min(a[0],b[0],c2[0])-.5,x1=Math.max(a[0],b[0],c2[0])+.5,z0=Math.min(a[2],b[2],c2[2])-.5,z1=Math.max(a[2],b[2],c2[2])+.5;
   for(let ix=Math.floor(x0/CS);ix<=Math.floor(x1/CS);ix++)for(let iz=Math.floor(z0/CS);iz<=Math.floor(z1/CS);iz++){const key=ix*100003+iz;let l=G.get(key);if(!l)G.set(key,l=[]);l.push(t)}}}}}
function segD(p,a,b){const abx=b[0]-a[0],abz=b[1]-a[1],l2=abx*abx+abz*abz||1e-9;let u=((p[0]-a[0])*abx+(p[1]-a[1])*abz)/l2;u=u<0?0:u>1?1:u;const qx=a[0]+abx*u,qz=a[1]+abz*u;return[Math.hypot(p[0]-qx,p[1]-qz),qx,qz]}
function blockStep(){if(!A||cling>0||vlt)return;if(!FB)buildFB();const r=.34,foot=H[1]-HH;
 for(let pass=0;pass<2;pass++){const l=FB.G.get(Math.floor(H[0]/FB.CS)*100003+Math.floor(H[2]/FB.CS));if(l)for(const t of l){if(foot>t.y1-.08||H[1]+.5<t.y0)continue;const p=[H[0],H[2]];
   const sa=segD(p,t.a,t.b),sb=segD(p,t.b,t.c),sc=segD(p,t.c,t.a);let m=sa;if(sb[0]<m[0])m=sb;if(sc[0]<m[0])m=sc;
   const ins=((t.b[0]-t.a[0])*(p[1]-t.a[1])-(t.b[1]-t.a[1])*(p[0]-t.a[0]))>=0===(((t.c[0]-t.b[0])*(p[1]-t.b[1])-(t.c[1]-t.b[1])*(p[0]-t.b[0]))>=0)&&(((t.c[0]-t.b[0])*(p[1]-t.b[1])-(t.c[1]-t.b[1])*(p[0]-t.b[0]))>=0)===(((t.a[0]-t.c[0])*(p[1]-t.c[1])-(t.a[1]-t.c[1])*(p[0]-t.c[0]))>=0);
   if(m[0]<r||ins){let nx=H[0]-m[1],nz=H[2]-m[2],nl=Math.hypot(nx,nz);if(nl<1e-4){nx=-v[0];nz=-v[2];nl=Math.hypot(nx,nz)||1}nx/=nl;nz/=nl;const pen=ins?r+m[0]:r-m[0];H[0]+=nx*pen;H[2]+=nz*pen;const vn=v[0]*nx+v[2]*nz;if(vn<0){v[0]-=nx*vn;v[2]-=nz*vn}}}}
 for(let k=0;k<6;k++){const a=k*1.0472,d=[Math.cos(a),0,Math.sin(a)],h=cast0([H[0],H[1]-.05,H[2]],d,.42);if(h&&h.t<.3&&Math.abs(h.n[1])<.6){const pen=.3-h.t;H[0]-=d[0]*pen*.85;H[2]-=d[2]*pen*.85;const vn=v[0]*d[0]+v[2]*d[2];if(vn>0){v[0]-=d[0]*vn;v[2]-=d[2]*vn}}}}
function trailStep(dt,M,mm){const sl=LV.cur&&LV.one&&/Slash|Melee|Thrust|Great/.test(LV.cur);for(const t of trail)t.t+=dt;while(trail.length&&trail[0].t>.28)trail.shift();
 if(sl){const hi=M.id('Bip001 R Hand'),fi=M.id('Bip001 R Forearm');if(hi>=0&&fi>=0){const W=M.W,w=(i)=>[mm[0]*W[i][12]+mm[4]*W[i][13]+mm[8]*W[i][14]+mm[12],mm[1]*W[i][12]+mm[5]*W[i][13]+mm[9]*W[i][14]+mm[13],mm[2]*W[i][12]+mm[6]*W[i][13]+mm[10]*W[i][14]+mm[14]],h=w(hi),f=w(fi),d=nrm([h[0]-f[0],h[1]-f[1],h[2]-f[2]]);{const tip=[h[0]+d[0]*.9,h[1]+d[1]*.9,h[2]+d[2]*.9];trail.push({a:[h[0]+d[0]*.55,h[1]+d[1]*.55,h[2]+d[2]*.55],b:tip,t:0});if(tick%2===0)burst(tip,[0,.2,0],[1,.92,.7],1,3,.04,.18,8,.9,.2,3)}}}}
function drawFx(dt){dtFx=dt;try{drawBoatDetails()}catch(e){window.__boatErr=e.message}const c=cam.pos,t=cam.target,fw=nrm([t[0]-c[0],t[1]-c[1],t[2]-c[2]]);
 for(let i=0;i<2;i++){const h=hk[i];if(!h.on)continue;const o=ropeOrigin(i);let e=h.a,sag=0;
  if(!h.att){const k=Math.min(1,h.age/h.tt);e=[o[0]+(h.a[0]-o[0])*k,o[1]+(h.a[1]-o[1])*k,o[2]+(h.a[2]-o[2])*k]}else{const d=len([h.a[0]-o[0],h.a[1]-o[1],h.a[2]-o[2]]);sag=Math.max(0,(h.len-d))*.35;sag=Math.min(sag,3);sag=Math.max(sag,Math.abs(Math.sin(h.age*42))*Math.exp(-(h.age-h.tt)*6)*.22)}
  h.wob=(h.wob||0)*Math.exp(-dtFx*.95);const wb=(h.att?h.wob+.025+Math.min(.14,len(v)*.0035)+Math.min(.5,Math.max(0,h.len-len([h.a[0]-o[0],h.a[1]-o[1],h.a[2]-o[2]]))*.09):.45);
  ropeLine(o,e,[.07,.075,.09],.0036,sag,wb,i);const dr=nrm([e[0]-o[0],e[1]-o[1],e[2]-o[2]]),tc=nrm([c[0]-e[0],c[1]-e[1],c[2]-e[2]]),w=nrm(cross(dr,tc)),u=nrm(cross(w,dr));
  box(e,.008,.008,.04,w,u,dr,[.6,.62,.67]);for(const sg of[-1,1]){box([e[0]+dr[0]*.03+w[0]*.014*sg,e[1]+dr[1]*.03+w[1]*.014*sg,e[2]+dr[2]*.03+w[2]*.014*sg],.003,.004,.03,w,u,dr,[.5,.52,.57]);box([e[0]+dr[0]*.03+u[0]*.014*sg,e[1]+dr[1]*.03+u[1]*.014*sg,e[2]+dr[2]*.03+u[2]*.014*sg],.004,.003,.03,w,u,dr,[.5,.52,.57])}}
 const r=nrm(cross(fw,[0,1,0])),up=cross(r,fw);tgt=vfx;
 for(let i=parts.length-1;i>=0;i--){const q=parts[i];q.l-=dt;if(q.l<=0){parts.splice(i,1);continue}q.p[0]+=q.v[0]*dt;q.p[1]+=q.v[1]*dt;q.p[2]+=q.v[2]*dt;q.v[1]-=q.g*dt;const k=Math.exp(-dt*1.2);q.v[0]*=k;q.v[2]*=k;if(q.g>0&&q.p[1]<gh(q.p[0],q.p[2])){if(q.c[0]>.3&&q.c[1]<.1&&q.a>.6&&decals.length<260&&Math.random()<.8)decals.push({x:q.p[0],z:q.p[2],r:.07+Math.random()*.26,t:0,rot:Math.random()*6.28,k:0});q.v[1]*=-.2;q.p[1]=gh(q.p[0],q.p[2])+.02;if(q.c[0]>.3&&q.c[1]<.1)q.l=Math.min(q.l,.15)}
  if(q.sol){q.ang+=q.spin*dt;tgt=null;const c_=Math.cos(q.ang),s_=Math.sin(q.ang);rock(q.p,q.s*.6,q.ang,q.c,q.seed||(q.seed=Math.random()*9));tgt=vfx;if(q.p[1]<gh(q.p[0],q.p[2])+q.s){q.v[1]*=-.3;q.v[0]*=.6;q.v[2]*=.6;q.spin*=.5;q.p[1]=gh(q.p[0],q.p[2])+q.s}continue}
  const f=q.l/q.l0,s=q.s*(1+(1-f)*q.gr),al=q.a*Math.min(1,f*1.6),p=q.p,col=[q.c[0],q.c[1],q.c[2],al];
  if(q.str){const vl=len(q.v);if(vl>.3){const vd=[q.v[0]/vl,q.v[1]/vl,q.v[2]/vl],tc=nrm([c[0]-p[0],c[1]-p[1],c[2]-p[2]]),w=nrm(cross(vd,tc)),hl=s*q.str*Math.min(1.6,.5+vl*.12),hw=s*.6;
   quad([p[0]-vd[0]*hl-w[0]*hw,p[1]-vd[1]*hl-w[1]*hw,p[2]-vd[2]*hl-w[2]*hw],[p[0]+vd[0]*hl-w[0]*hw,p[1]+vd[1]*hl-w[1]*hw,p[2]+vd[2]*hl-w[2]*hw],[p[0]+vd[0]*hl+w[0]*hw,p[1]+vd[1]*hl+w[1]*hw,p[2]+vd[2]*hl+w[2]*hw],[p[0]-vd[0]*hl+w[0]*hw,p[1]-vd[1]*hl+w[1]*hw,p[2]-vd[2]*hl+w[2]*hw],col,null,true);continue}}
  quad([p[0]-r[0]*s-up[0]*s,p[1]-r[1]*s-up[1]*s,p[2]-r[2]*s-up[2]*s],[p[0]+r[0]*s-up[0]*s,p[1]+r[1]*s-up[1]*s,p[2]+r[2]*s-up[2]*s],[p[0]+r[0]*s+up[0]*s,p[1]+r[1]*s+up[1]*s,p[2]+r[2]*s+up[2]*s],[p[0]-r[0]*s+up[0]*s,p[1]-r[1]*s+up[1]*s,p[2]-r[2]*s+up[2]*s],col,null,true)}
 tgt=vfx;for(let i=1;i<trail.length;i++){const p=trail[i-1],q=trail[i],al=.6*Math.pow(Math.max(0,1-q.t/.28),2);quad(p.a,p.b,q.b,q.a,[.88,.95,1,al],null,'flat')}
 for(let i=decals.length-1;i>=0;i--){const d=decals[i];d.t+=dt;if(d.t>110){decals.splice(i,1);continue}if(d.k<1)d.k=Math.min(1,d.k+dt*2);const al=Math.min(.82,.9*(1-Math.max(0,d.t-85)/25)),y=gh(d.x,d.z)+.035,r=d.r*(.6+.4*d.k)*(d.big||1),c_=Math.cos(d.rot)*r,s_=Math.sin(d.rot)*r;
  quad([d.x-c_-s_,y,d.z-s_+c_],[d.x+c_-s_,y,d.z+s_+c_],[d.x+c_+s_,y,d.z+s_-c_],[d.x-c_+s_,y,d.z-s_-c_],[.32,.015,.02,al],null,true)}
 tgt=null}function flush(){if(!vbuf.length&&!vfx.length)return;gl.useProgram(prog);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.uniformMatrix4fv(gl.getUniformLocation(prog,'m'),false,E.vp);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);const fxu=gl.getUniformLocation(prog,'fx'),MAXF=(1<<21)/4;
 if(vbuf.length){const f=new Float32Array(vbuf.length>MAXF?vbuf.slice(0,MAXF):vbuf);gl.bufferSubData(gl.ARRAY_BUFFER,0,f);gl.uniform1f(fxu,0);gl.drawArrays(gl.TRIANGLES,0,f.length/9)}
 if(vfx.length){const f=new Float32Array(vfx.length>MAXF?vfx.slice(0,MAXF):vfx);gl.bufferSubData(gl.ARRAY_BUFFER,0,f);gl.uniform1f(fxu,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,f.length/9);gl.depthMask(true);gl.disable(gl.BLEND)}
 gl.bindVertexArray(null);vbuf=[];vfx=[]}
// ---------- HUD
let hp=320,hpMax=320,lockOn=false,dodgeCD=0,supplyCD=0,mini=null,miniCtx=null;
function dodge(){if(window.__noOdm||dodgeCD>0||grab)return;dodgeCD=1.1;const cy=st.wyaw,fw=[Math.sin(cy),0,Math.cos(cy)],rt=[-Math.cos(cy),0,Math.sin(cy)];let mf=(K.KeyW?1:0)-(K.KeyS?1:0)-sv[1],ms=(K.KeyD?1:0)-(K.KeyA?1:0)+sv[0];if(Math.hypot(mf,ms)<.2){mf=-1;ms=0}const l=Math.hypot(mf,ms),d=[(fw[0]*mf+rt[0]*ms)/l,0,(fw[2]*mf+rt[2]*ms)/l];
 const sgn=ms>.2?1:ms<-.2?-1:(dodgeSide=-dodgeSide);d[0]=rt[0]*sgn;d[2]=rt[2]*sgn;if(grounded){const fwd=true;v[0]=d[0]*5;v[2]=d[2]*5;v[1]=fwd?0:2.2;if(!fwd)grounded=false;dodgeT=.5;face[0]=d[0];face[2]=d[2];pend=['L:Sprinting Forward Roll',1.45];slow=.7;slowT=.18;fov+=.12}else{v[0]+=d[0]*5.5;v[2]+=d[2]*5.5;pend=['L:Sprinting Forward Roll',1.45];rollT=.5;slow=.7;slowT=.18}burst([H[0],H[1]-.3,H[2]],[-d[0],.2,-d[2]],[.8,.76,.7],3,1.4,.15,.5,-.3,.3)}
function bladeSwap(){if(blades>1&&dur<100){blades--;dur=100;msg='BLADE REPLACED';msgT=1.2}else if(dur>=100){msg='BLADES FULL';msgT=1}else{msg='NO SPARE BLADES';msgT=1.2}}
function supply(){if(supplyCD>0){msg='SUPPLY ON COOLDOWN';msgT=1.2;return}if(!grounded){msg='LAND TO RESUPPLY';msgT=1.2;return}supplyCD=20;blades=4;dur=100;gas=100;hp=hpMax;msg='RESUPPLIED';msgT=1.5}
const IC={hook:'<svg viewBox="0 0 48 48"><path d="M24 6v20M14 20c0 8 4 14 10 14s10-6 10-14M12 26l5-6M36 26l-5-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="38" r="3" fill="#fff"/></svg>',dodge:'<svg viewBox="0 0 48 48"><path d="M10 18h12M6 26h14M12 34h10M30 12a4 4 0 1 0 .1 0M26 20l8 4 6-6M34 24l-4 8 6 6M26 20l-4 8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',gas:'<svg viewBox="0 0 48 48"><rect x="16" y="12" width="16" height="26" rx="6" fill="none" stroke="#fff" stroke-width="3"/><path d="M21 12V8h6v4M20 22h8" stroke="#fff" stroke-width="3" fill="none"/></svg>',blade:'<svg viewBox="0 0 48 48"><path d="M12 38L24 8l12 30M18 38l6-16 6 16" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>',jump:'<svg viewBox="0 0 48 48"><path d="M10 28l14-12 14 12M10 38l14-12 14 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',lock:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="3" fill="#fff"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="#fff" stroke-width="3"/></svg>',atk:'<svg viewBox="0 0 48 48"><path d="M8 40L34 10l5 3L14 44zM40 40L14 10 9 13l25 31zM30 12l8-6 3 5-7 6" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>',bag:'<svg viewBox="0 0 48 48"><path d="M14 18c0-6 4-10 10-10s10 4 10 10v20H14zM14 26h20M20 18h8" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>'};
function ui(){const bp=(x,y,r)=>`right:${((1846-x-r)/1846*100).toFixed(2)}vw;bottom:${((852-y-r)/852*100).toFixed(2)}vh;width:${(2*r/852*100).toFixed(2)}vh;height:${(2*r/852*100).toFixed(2)}vh`;
 const css=document.createElement('style');css.textContent=`body.odm #title,body.odm #tr,body.odm #stats,body.odm #bInfo,body.odm #panel,body.odm #ctl,body.odm #scaleT,body.odm #bot,body.odm #row1,body.odm #rail,body.odm #cross{display:none!important}
body.odm #c{filter:saturate(1.34) contrast(1.13) brightness(1.04)}
#odm{position:fixed;inset:0;pointer-events:none;z-index:6;font:600 13px system-ui,sans-serif;color:#fff;display:none;-webkit-user-select:none;user-select:none}body.odm #odm{display:block}
#odm canvas.fx{position:absolute;inset:0;width:100%;height:100%}
#odm .vg{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(10,6,0,.38) 100%)}
#odm .pf{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);top:calc(env(safe-area-inset-top,0px) + 10px);width:9.6vh;height:9.6vh;border-radius:50%;border:.5vh solid #cfd4d8;background:#14181c url(assets/ui/levi_portrait.webp) center/cover;box-shadow:0 0 0 .3vh #000a,0 .6vh 1.4vh #000a}
#odm .lv{position:absolute;left:calc(env(safe-area-inset-left,0px) + 8vh);top:calc(env(safe-area-inset-top,0px) + 9.4vh);font:700 2.5vh Georgia,serif;background:#1a2230;padding:.2vh 1.4vh;transform:skewX(-14deg);border:1px solid #fff4}
#odm .bars{position:absolute;left:calc(env(safe-area-inset-left,0px) + 11vh);top:calc(env(safe-area-inset-top,0px) + 1.6vh);width:34vw;max-width:340px;padding:1vh 1.4vh 1vh 2.2vh;background:linear-gradient(90deg,rgba(10,20,40,.85),rgba(10,20,40,.55));clip-path:polygon(0 0,100% 0,92% 100%,0 100%)}
#odm .br{position:relative;height:1.7vh;margin:.7vh 0;transform:skewX(-20deg);background:#0006;border:1px solid #fff3;overflow:hidden}#odm .br b{display:block;height:100%;width:100%}#odm .hp b{background:linear-gradient(#ff6b5a,#d31a14)}#odm .gs b{background:linear-gradient(#5fc2ff,#1573d6)}
#odm .bn{position:absolute;right:8%;font-size:2.2vh;text-shadow:0 1px 2px #000;font-family:Georgia,serif}#odm .hp+.bn{top:1.2vh}#odm .gs+.bn{top:4.3vh}
#odm .bl{position:absolute;left:calc(env(safe-area-inset-left,0px) + 20vh);top:calc(env(safe-area-inset-top,0px) + 11.6vh);font-size:2.6vh;font-family:Georgia,serif;text-shadow:0 1px 3px #000;white-space:nowrap}#odm .bl i{display:inline-block;width:.8vh;height:2.4vh;margin-right:.5vh;background:#e4ebf2;transform:skewX(-16deg);vertical-align:-.3vh}#odm .bl i.d{background:#e8795f}#odm .bl i.x{opacity:.25}
#odm .ms{position:absolute;left:calc(env(safe-area-inset-left,0px) + 0px);top:calc(env(safe-area-inset-top,0px) + 17.6vh);width:46vw;max-width:470px;padding:1.2vh 2vh 1.2vh 2.4vh;background:linear-gradient(90deg,rgba(70,8,8,.85),rgba(0,0,0,0));border-left:.5vh solid #d02820;font-family:Georgia,serif}#odm .ms h4{margin:0;color:#ff4a3a;font-size:2.7vh}#odm .ms p{margin:.3vh 0 0;font-size:3vh;color:#f6f1e6;text-shadow:0 1px 3px #000}
#odm .mm{position:absolute;right:calc(env(safe-area-inset-right,0px) + 9.5vh);top:calc(env(safe-area-inset-top,0px) + 6.6vh);width:34vh;height:25vh;border:.45vh solid #8a8f93;border-radius:1.2vh;overflow:hidden;background:#202a18;box-shadow:0 .5vh 1.4vh #000a}#odm .mm canvas{width:100%;height:100%;display:block}
#odm .cp{position:absolute;font:700 2.4vh Georgia,serif;text-shadow:0 1px 3px #000}
#odm .ck{position:absolute;right:calc(env(safe-area-inset-right,0px) + 11vh);top:calc(env(safe-area-inset-top,0px) + 1.4vh);padding:.4vh 1.8vh;font:700 2.7vh Georgia,serif;background:#0007;border:1px solid #fff4;border-radius:.6vh;letter-spacing:.05em}
#odm .sd{position:absolute;right:calc(env(safe-area-inset-right,0px) + 1.4vh);width:7.6vh;height:7.6vh;border-radius:1.4vh;border:.3vh solid #fff8;background:#10161ccc;pointer-events:auto;display:flex;align-items:center;justify-content:center;touch-action:none}#odm .sd svg{width:60%;height:60%}
#odm .rt{position:absolute;left:50%;top:46%;width:9.4vh;height:9.4vh;margin:-4.7vh;border:.35vh dashed rgba(255,255,255,.85);border-radius:50%;animation:rts 9s linear infinite;transition:border-color .15s,background .15s}#odm .rt.ok{border-color:#9dffb0;background:rgba(157,255,176,.12)}#odm .rt.lk{border-color:#ff5448;background:rgba(255,84,72,.15)}@keyframes rts{to{transform:rotate(360deg)}}
#odm .rd{position:absolute;left:50%;top:46%;width:.7vh;height:.7vh;margin:-.35vh;background:#fff;border-radius:50%}#odm .xl,#odm .xr{position:absolute;top:46%;width:1.1vh;height:1.1vh;margin:-.55vh;border-radius:50%;background:#fff5;border:1px solid #fff8}#odm .xl{left:calc(50% - 7.4vh)}#odm .xr{left:calc(50% + 7.4vh)}#odm .xl.ok,#odm .xr.ok{background:#7dff9a}
#odm .xd{position:absolute;left:50%;top:calc(46% + 6.2vh);transform:translateX(-50%);font-size:2vh;text-shadow:0 1px 3px #000;font-family:Georgia,serif}
#odm .tb{position:absolute;left:57%;top:calc(env(safe-area-inset-top,0px) + 1.4vh);transform:translateX(-50%);width:24vw;max-width:260px;text-align:center;font:700 2.1vh Georgia,serif;letter-spacing:.12em;text-shadow:0 1px 3px #000;opacity:0;transition:opacity .3s}#odm .tb.on{opacity:1}#odm .tb div{height:1.5vh;margin-top:.4vh;background:#0009;border:1px solid #fff6;transform:skewX(-20deg);overflow:hidden}#odm .tb b{display:block;height:100%;width:100%;background:linear-gradient(#ff8a4a,#c2300e)}
#odm .tip{position:absolute;left:50%;top:21%;transform:translateX(-50%);text-align:center;font:700 3.3vh Georgia,serif;letter-spacing:.04em;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .25s;white-space:nowrap}#odm .tip.on{opacity:1}
#odm .esc{position:absolute;left:50%;top:30%;width:34vh;height:1.6vh;margin-left:-17vh;background:#0008;border:1px solid #fff6;border-radius:1vh;overflow:hidden;display:none}#odm .esc b{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffb35c,#ff5a3a)}
#odm .bt button{box-shadow:0 .5vh 1.5vh #000b,inset 0 .3vh .8vh #ffffff30,inset 0 -.6vh 1vh #00000060;position:absolute;pointer-events:auto;border-radius:50%;border:.4vh solid rgba(235,240,245,.75);background:radial-gradient(circle at 50% 35%,rgba(70,76,84,.62),rgba(14,18,22,.72));color:#fff;font:700 1.8vh system-ui;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}#odm .bt button svg{width:46%;height:46%}#odm .bt button span{font-size:1.9vh;letter-spacing:.03em;margin-top:-.2vh}#odm .bt button.on{background:radial-gradient(circle at 50% 35%,rgba(150,255,170,.6),rgba(30,90,50,.7))}#odm .bt button small{position:absolute;top:34%;left:50%;font-size:1.5vh;opacity:.9}
#odm .bt .atk{border-color:#ff4a3e;background:radial-gradient(circle at 50% 35%,rgba(210,40,32,.78),rgba(70,6,6,.85));box-shadow:0 0 2vh #ff2a1e88,inset 0 0 1.4vh #ff6a5e66}
#odm .bg{position:absolute;pointer-events:auto;left:calc(env(safe-area-inset-left,0px) + 3vh);bottom:calc(env(safe-area-inset-bottom,0px) + 4vh);width:10vh;height:10vh;border-radius:50%;border:.4vh solid rgba(235,240,245,.6);background:#10161caa;display:flex;align-items:center;justify-content:center}#odm .bg svg{width:56%;height:56%}
#odm .menu{position:absolute;right:calc(env(safe-area-inset-right,0px) + 11vh);top:calc(env(safe-area-inset-top,0px) + 3vh);background:rgba(10,14,12,.92);border:1px solid #fff3;border-radius:12px;padding:10px;display:none;pointer-events:auto;min-width:230px;z-index:9}#odm .menu.on{display:block}#odm .menu button{display:block;width:100%;margin:5px 0;padding:10px;border-radius:8px;border:1px solid #fff3;background:#ffffff14;color:#fff;font:600 14px system-ui;text-align:left}#odm .menu p{margin:8px 0 0;font-size:10px;opacity:.6;line-height:1.4}
body.odm #stick{display:block!important;opacity:.82;left:calc(env(safe-area-inset-left,0px) + 3.2vh)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 3.2vh)!important;width:27vh!important;height:27vh!important;border:.35vh solid #fff6!important;background:radial-gradient(circle,#ffffff14 0%,#00000040 100%)!important;box-shadow:0 0 2vh #0008 inset}body.odm #stick i{width:11vh!important;height:11vh!important;margin:-5.5vh!important;background:radial-gradient(circle at 35% 30%,#ffffffcc,#9aa0a6aa)!important;box-shadow:0 .4vh 1.2vh #000a}#odm .bg{left:calc(env(safe-area-inset-left,0px) + 33vh)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 4vh)!important;top:auto!important}`;document.head.appendChild(css);
 const d=document.createElement('div');d.id='odm';
 d.innerHTML=`<div class="vg"></div><canvas class="fx"></canvas><div class="pf"></div><div class="lv">LEVI</div><div class="bars"><div class="br hp"><b></b></div><span class="bn hpn">320/320</span><div class="br gs"><b></b></div><span class="bn gsn">100/100</span></div><div class="bl"></div>
<div class="ms"><h4>! Mission</h4><p class="mt"></p></div>
<div class="mm"><canvas width="340" height="250"></canvas></div><span class="cp" style="right:calc(env(safe-area-inset-right,0px) + 25vh);top:calc(env(safe-area-inset-top,0px) + 1vh)">N</span><span class="cp" style="right:calc(env(safe-area-inset-right,0px) + 25vh);top:calc(env(safe-area-inset-top,0px) + 32vh)">S</span><span class="cp" style="right:calc(env(safe-area-inset-right,0px) + 44.4vh);top:calc(env(safe-area-inset-top,0px) + 17vh)">W</span><span class="cp" style="right:calc(env(safe-area-inset-right,0px) + 5.5vh);top:calc(env(safe-area-inset-top,0px) + 17vh)">E</span>
<div class="ck">15:00</div><div class="sd" data-m="pause" style="top:calc(env(safe-area-inset-top,0px) + 1.2vh)"><svg viewBox="0 0 24 24"><path d="M7 4v16M17 4v16" stroke="#fff" stroke-width="4"/></svg></div><div class="sd" data-m="pause" style="top:calc(env(safe-area-inset-top,0px) + 10vh)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" stroke="#fff" stroke-width="2.5"/></svg></div><div class="sd" data-m="viewer" style="top:calc(env(safe-area-inset-top,0px) + 18.8vh)"><svg viewBox="0 0 24 24"><path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16" fill="none" stroke="#fff" stroke-width="2"/></svg></div>
<div class="tb"><span>ABNORMAL TITAN</span><div><b></b></div></div><div class="rt"></div><div class="rd"></div><div class="xl"></div><div class="xr"></div><div class="xd"></div><div class="tip"></div><div class="esc"><b></b></div>
<div class="bg" data-s="bag">${IC.bag}</div>
<div class="bt"><button data-h="1" style="${bp(1590,498,64)}">${IC.hook}<span>HOOK</span><small>R</small></button><button data-h="0" style="${bp(1442,505,50)}">${IC.hook}<span>HOOK</span><small>L</small></button><button data-a="dodge" style="${bp(1757,484,52)}">${IC.dodge}<span>DODGE</span></button><button data-t="gas" style="${bp(1430,654,52)}">${IC.gas}<span>GAS</span></button><button data-a="blade" style="${bp(1552,640,52)}">${IC.blade}<span>BLADE</span></button><button data-j="1" style="${bp(1328,746,58)}">${IC.jump}<span>JUMP</span></button><button data-a="lock" style="${bp(1496,758,48)}">${IC.lock}<span>LOCK ON</span></button><button class="atk" data-a="atk" style="${bp(1725,672,88)}">${IC.atk}<span>ATTACK</span></button><button data-t="brake" style="${bp(1215,700,34)}"><span style="font-size:1.4vh">BRAKE</span></button></div>
<div class="menu"><button data-m="resume">Resume</button><button data-m="reset">Reset position and supplies</button><button data-m="skip">Skip time +3 h</button><button data-m="viewer">Map viewer (leave game)</button><p>Tap L / R to fire a hook, tap again to release; hooks reel in automatically. Keys: Q/E hooks, Space jump, Shift gas, X brake, F attack, Z dodge, B blade, R lock-on, T reset.<br>Models: “Levi Ackerman rig” and “AOTWA Fat Titan” by Prime Slayer3D (Sketchfab), CC-BY 4.0. Animations: Mixamo.</p></div>`;
 document.body.appendChild(d);const q=c=>d.querySelector(c);
 hud={tb:q('.tb'),tbb:q('.tb b'),xd:q('.xd'),gb:q('.gs b'),hb:q('.hp b'),hn:q('.hpn'),gn:q('.gsn'),l:q('.xl'),r:q('.xr'),rt:q('.rt'),cv:q('canvas.fx'),bl:q('.bl'),ck:q('.ck'),tip:q('.tip'),esc:q('.esc'),escb:q('.esc b'),menu:q('.menu'),mt:q('.mt'),mm:q('.mm canvas')};miniCtx=hud.mm.getContext('2d');
 const act=n=>{if(n==='atk')slash();else if(n==='dodge')dodge();else if(n==='blade')bladeSwap();else if(n==='lock')toggleLock()};
 d.querySelectorAll('.sd,.menu button').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const m=b.dataset.m;if(m==='pause')hud.menu.classList.toggle('on');else{hud.menu.classList.remove('on');if(m==='reset'){respawn();blades=4;dur=100;hp=hpMax;if(titan)resetTitan()}else if(m==='skip')hour=(hour+3)%24;else if(m==='viewer')setOn(false)}}));
 d.querySelector('.bg').addEventListener('pointerdown',e=>{e.preventDefault();supply()});
 d.querySelectorAll('.bt button').forEach(b=>{const s=b.dataset;
  if(s.h!==undefined){const i=+s.h;b.addEventListener('pointerdown',e=>{e.preventDefault();mash();if(hk[i].on){relHook(i);b.classList.remove('on')}else if(!grab){fire(i);b.classList.add('on')}})}
  else if(s.t){const dn=e=>{e.preventDefault();T[s.t]=1;b.classList.add('on')},up=()=>{T[s.t]=0;b.classList.remove('on')};b.addEventListener('pointerdown',dn);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)}
  else if(s.j)b.addEventListener('pointerdown',e=>{e.preventDefault();mash();if(cling>0){cling=0;v=[clingN[0]*7,8,clingN[2]*7]}else if(grounded&&!grab){v[1]=P.jump;grounded=false}else if(!grounded&&lastWall&&lastWall.t<.3&&len(v)>4)wallKick();else hk=[{on:false},{on:false}]});
  else if(s.a)b.addEventListener('pointerdown',e=>{e.preventDefault();act(s.a)})});
 const m=document.querySelector('#mWalk').parentNode,b=document.createElement('button');b.id='mOdm';b.textContent='ODM';b.setAttribute('aria-pressed','false');m.appendChild(b);b.addEventListener('click',()=>setOn(true));
 for(const id of['mOrbit','mWalk','rail'])document.getElementById(id).addEventListener('click',()=>{if(on)setOn(false)},true);
 addEventListener('keydown',e=>{if(!on)return;K[e.code]=true;if(e.code==='KeyQ'&&!e.repeat){mash();if(hk[0].on)relHook(0);else if(!grab)fire(0)}if(e.code==='KeyE'&&!e.repeat){mash();if(hk[1].on)relHook(1);else if(!grab)fire(1)}if(e.code==='Space'&&!e.repeat){mash();if(!grounded&&lastWall&&lastWall.t<.3&&len(v)>4)wallKick()}if(e.code==='KeyF')slash();if(e.code==='KeyZ')dodge();if(e.code==='KeyB')bladeSwap();if(e.code==='KeyR')toggleLock();if(e.code==='KeyT')respawn();if(e.code==='Space')e.preventDefault();if(/^Digit|^Tab/.test(e.code))setOn(false)},true);
 addEventListener('keyup',e=>{K[e.code]=false});
 const stk=document.getElementById('stick');let sp=null;const sm=e=>{const r=stk.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width/2),y=(e.clientY-r.top-r.height/2)/(r.height/2);const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}sv=[x,y]};
 stk.addEventListener('pointerdown',e=>{sp=e.pointerId;sm(e)});stk.addEventListener('pointermove',e=>{if(e.pointerId===sp)sm(e)});const se=e=>{if(e.pointerId===sp){sp=null;sv=[0,0]}};stk.addEventListener('pointerup',se);stk.addEventListener('pointercancel',se)}
function toggleLock(){if(lockOn){lockOn=false;msg='LOCK OFF';msgT=.8;return}if(titan&&!titan.dead){lockOn=true;msg='LOCKED ON';msgT=.9}else{msg='NO TARGET';msgT=1}}
function lockStep(dt){if(!lockOn)return;if(!titan||titan.dead){lockOn=false;return}const nq=SPH.find(q=>q.nape);if(!nq)return;const tx=nq.c[0]-cam.pos[0],ty=nq.c[1]-cam.pos[1],tz=nq.c[2]-cam.pos[2],hd=Math.hypot(tx,tz);if(hd>110){lockOn=false;return}
 let dy=Math.atan2(tx,tz)-st.wyaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));st.wyaw+=dy*Math.min(1,dt*5);st.wpitch+=(Math.atan2(ty,hd)-st.wpitch)*Math.min(1,dt*5)}
function buildMini(){if(mini||!A)return;const c=document.createElement('canvas');c.width=c.height=1000;const x=c.getContext('2d');x.fillStyle='#6d8450';x.fillRect(0,0,1000,1000);
 for(const it of A.I){const lo=it.lo,hi=it.hi,w=hi[0]-lo[0],dd=hi[2]-lo[2],hh=hi[1]-lo[1];if(w>40||dd>40){x.strokeStyle='#4c4a42';x.lineWidth=7;x.strokeRect(500-hi[0],500-hi[2],w,dd);continue}if(hh<1.5)continue;x.fillStyle=hh>7?'#a8643f':'#8a6244';x.fillRect(500-hi[0],500-hi[2],w,dd)}
 mini=c}
function drawMini(){if(!mini)return;const c=hud.mm,x=miniCtx,w=c.width,h=c.height,win=95,wh=win*h/w;x.fillStyle='#2a3320';x.fillRect(0,0,w,h);x.drawImage(mini,500-H[0]-win,500-H[2]-wh,win*2,wh*2,0,0,w,h);const sx=w/(win*2);
 const dot=(px,pz,col,r)=>{const X=(H[0]-px)*sx+w/2,Y=(H[2]-pz)*sx*-1+h/2;x.fillStyle=col;x.beginPath();x.arc(X,Y,r,0,6.283);x.fill();x.strokeStyle='#000a';x.lineWidth=1.5;x.stroke()};
 if(titan&&!titan.dead&&!window.__noTitan)dot(titan.x,titan.z,'#ff2a22',7);for(let i=0;i<2;i++)if(hk[i].on){dot(hk[i].a[0],hk[i].a[2],'#fff',3)}
 const a=Math.atan2(-Math.sin(st.wyaw),-Math.cos(st.wyaw));x.save();x.translate(w/2,h/2);x.rotate(a+Math.PI/2*0);x.fillStyle='#4cb4ff';x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.moveTo(0,-14);x.lineTo(-9,10);x.lineTo(0,5);x.lineTo(9,10);x.closePath();x.fill();x.stroke();x.restore()}
function resetTitan(){if(!titan)return;limbs.length=0;Object.assign(titan,{hp:150,max:150,napeHits:0,showT:0,atk:null,x:-11,z:-17,yaw:Math.atan2(11,-21),state:'idle',dead:false,fall:0,dtm:0,swat:0,lunge:0,reach:0,cut:{L:false,R:false,LL:false,LR:false,H:false},dmg:{},cutAge:{},wounds:[],down:false,cd:0,stun:0,notice:0});grab=null;LVHIDE=null}
function setOn(f){if(f&&!on){if(!A)build();if(!gl)initGL();document.getElementById('mWalk').click();on=true;document.body.classList.remove('viewer');document.body.classList.add('odm');respawn();cam.pos=[H[0]-Math.sin(st.wyaw)*5,H[1]+2,H[2]-Math.cos(st.wyaw)*5];buildMini();document.getElementById('mOdm').setAttribute('aria-pressed','true');document.getElementById('mWalk').setAttribute('aria-pressed','false')}
 else if(!f&&on){on=false;document.body.classList.remove('odm');document.body.classList.add('viewer');document.getElementById('mOdm').setAttribute('aria-pressed','false');E.light=E.light;E.setPreset('golden')}}
// ---------- time of day: 24 h = 90 real minutes (1 game hour = 3.75 min)
const NIGHT={sun:[.3,.55,.35],sunC:[.2,.25,.42],ambS:[.07,.09,.17],ambG:[.04,.04,.07],skyH:[.07,.09,.17],skyZ:[.01,.02,.08],cl0:[.07,.09,.16],cl1:[.18,.2,.3],fogC:[.06,.08,.15],halo:[.25,.3,.45]};
let DAYP=null,GOLP=null,DUSK=null;
function tod(dt){if(!DAYP){const cur=E.preset;E.setPreset('day');DAYP=E.light;E.setPreset('golden');GOLP=E.light;DUSK=Object.assign({},GOLP,{sun:[GOLP.sun[0],.2,GOLP.sun[2]],sunC:[2.2,1.25,.75],skyH:[1,.62,.45],fogC:[.9,.62,.5],halo:[1.3,.7,.4],cl1:[1,.65,.5],ambS:[.38,.36,.45]});E.setPreset(cur)}
 hour=(hour+dt*24/5400)%24;const K_=[[0,NIGHT],[4.6,NIGHT],[5.9,DUSK],[7.6,GOLP],[9.2,DAYP],[15.3,DAYP],[17.2,GOLP],[18.8,DUSK],[20.2,NIGHT],[24,NIGHT]];let i=1;while(i<K_.length-1&&hour>K_[i][0])i++;
 const a=K_[i-1],b=K_[i],t=Math.max(0,Math.min(1,(hour-a[0])/(b[0]-a[0]))),k=t*t*(3-2*t),L={};for(const key in a[1])L[key]=a[1][key].map((x,j)=>x+(b[1][key][j]-x)*k);
 const az=(hour-12)*Math.PI/12*.85,sx=L.sun[0],sz=L.sun[2],c=Math.cos(az),s_=Math.sin(az);L.sun=[sx*c+sz*s_,L.sun[1],-sx*s_+sz*c];E.light=L;E.sunDir=nrm(L.sun);E.preset=(hour>5.5&&hour<8.5)||(hour>16.8&&hour<19.2)?'golden':'day'}
function hudUpdate(dt){const sp=len(v);dodgeCD=Math.max(0,dodgeCD-dt);supplyCD=Math.max(0,supplyCD-dt);hud.gb.style.width=gas+'%';hud.gn.textContent=Math.round(gas)+'/100';hud.hb.style.width=(hp/hpMax*100)+'%';hud.hn.textContent=Math.ceil(hp)+'/'+hpMax;
 if(tick%8===0||tick<4){hud.bl.innerHTML=Array.from({length:3},(_,i)=>'<i class="'+(i<Math.min(3,blades)?(i===Math.min(3,blades)-1&&dur<35?'d':''):'x')+'"></i>').join('')+' ×'+blades+' &nbsp;·&nbsp; '+kills+' Kills';const hh=Math.floor(hour),mm=Math.floor((hour-hh)*60);hud.ck.textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');hud.mt.textContent=titan&&!titan.dead?'Eliminate the Titan near the gate!':'Titan eliminated. Await further orders.'}
 msgT=Math.max(0,msgT-dt);hud.tip.textContent=msg;hud.tip.classList.toggle('on',msgT>0);hud.esc.style.display=grab?'block':'none';if(grab)hud.escb.style.width=Math.min(100,grab.esc*100)+'%';
 if(tick%6===0){aimOK=[0,1].map(i=>{if(hk[i].on){if(i===0||!hk[0].on)aimD=len([hk[i].a[0]-H[0],hk[i].a[1]-H[1],hk[i].a[2]-H[2]]);return true}const d=dirYP(st.wyaw+(i?-.06:.06),st.wpitch),dc=len([H[0]-cam.pos[0],H[1]-cam.pos[1],H[2]-cam.pos[2]]),h=cast([cam.pos[0]+d[0]*dc,cam.pos[1]+d[1]*dc,cam.pos[2]+d[2]*dc],d,P.maxLen+10);if(!h)return false;const dd=len([h.p[0]-H[0],h.p[1]-H[1],h.p[2]-H[2]]);if(i===0)aimD=dd;return dd<=P.maxLen});
  hud.l.classList.toggle('ok',aimOK[0]);hud.r.classList.toggle('ok',aimOK[1]);hud.rt.classList.toggle('ok',aimOK[0]||aimOK[1]);hud.xd.textContent=(aimOK[0]||aimOK[1])?Math.round(aimD)+' m':''}
 hud.rt.classList.toggle('lk',lockOn);drawMini();{const T=window.__noTitan?null:titan,on_=T&&!T.dead&&(T.showT>0||lockOn||Math.hypot(H[0]-T.x,H[2]-T.z)<45);hud.tb.classList.toggle('on',!!on_);if(T)hud.tbb.style.width=Math.max(0,T.hp/T.max*100)+'%'}
 const c=hud.cv,w=c.width=innerWidth,h=c.height=innerHeight,x=c.getContext('2d');x.clearRect(0,0,w,h);if(sp>26){const a=Math.min(.55,(sp-26)/60),n=26;x.strokeStyle='rgba(255,255,255,'+a+')';x.lineWidth=1.6;for(let i=0;i<n;i++){const an=Math.random()*6.283,r0=Math.min(w,h)*(.34+Math.random()*.2),r1=r0+Math.min(w,h)*(.07+Math.random()*.12);x.beginPath();x.moveTo(w/2+Math.cos(an)*r0,h*.46+Math.sin(an)*r0);x.lineTo(w/2+Math.cos(an)*r1,h*.46+Math.sin(an)*r1);x.stroke()}}
 if(slow<1){x.fillStyle='rgba(0,0,0,.22)';x.fillRect(0,0,w,h*.08);x.fillRect(0,h*.92,w,h*.08)}
 if(bloodOv>0){bloodOv=Math.max(0,bloodOv-dt*.5);const g=x.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.7);g.addColorStop(0,'rgba(120,0,0,0)');g.addColorStop(1,'rgba(120,0,0,'+(.55*bloodOv)+')');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='rgba(110,0,0,'+(.5*bloodOv)+')';for(let i=0;i<9;i++){const px=(Math.sin(i*12.9)*.5+.5)*w,py=(Math.sin(i*7.1+2)*.5+.5)*h*.6;x.beginPath();x.ellipse(px,py,w*.025,w*.045,Math.sin(i)*.6,0,6.283);x.fill()}}
 if(hp<hpMax*.3){x.fillStyle='rgba(180,0,0,'+(.15+.1*Math.sin(tick*.2))+')';x.fillRect(0,0,w,h)}}
function init(){E=window.__E;st=window.__st;ui();setTimeout(()=>setOn(true),60);const R0=E.render.bind(E);
 E.render=function(c,dt){if(!on)return R0(c,dt);dt=Math.min(.05,dt);tick++;if(slowT>0){slowT-=dt;if(slowT<=0)slow=1}const fz=!!window.__freeze,gd=fz?0:dt*slow;if(!fz){tod(dt);lockStep(dt)}if(hp<=0){hp=hpMax;msg='DOWN — back to the gate';msgT=2.5;respawn();blades=4;dur=100}
  if(grab||fz){}else{const n=gd>.026?2:1;for(let i=0;i<n;i++)step(gd/n)}
  if(!fz){if(!window.__noTitan)titanUpdate(gd);camUpdate(gd)}{const cn=window.__cine;if(cn&&cn.on){cam.pos=cn.pos.slice();cam.target=cn.target.slice();cam.fov=cn.fov||cam.fov;fov=cn.fov||fov}}if(!window.__noR0)R0(cam,dt);if(!window.__hideAvatar)drawAvatar(gd);try{drawActors(dt)}catch(e){if(!window.__actErr){window.__actErr=1;console.error('[actors]',e)}}if(titan&&!window.__noTitan){const T=titan,cn=Object.keys(T.cut).filter(k=>T.cut[k]).map(k=>CUTB[k]),hm=cn.length?T.M.mask(cn):null;drawModel(T.M,T.mm,hm?1:0,null,hm);drawStumps(T);drawWounds(T,gd)}if(!fz)limbStep(gd);drawLimbs();drawFx(gd);flush();hudUpdate(dt)}}
if(typeof document!=='undefined'){const iv=setInterval(()=>{if(window.__ready&&window.__E){clearInterval(iv);init()}},250);window.__gfTest=(spd,secs)=>{const M=MD.levi,o=newPose(),sv_=v,pg=gaitPh,out=[];v=[0,0,spd];for(let i=0;i<secs*60;i++){gaitPh+=gaitRate(spd/PLS)*(1/60);gaitProc(o);o.k=1;M.pose(toDirs(o,1));const mm=relModel([PLS,0,0],[0,PLS,0],[0,0,PLS],[0,HH*0,0],o,.9);groundFixL(M,mm,0,true,PLS,true,1/60);const g=n=>{const w=M.W[M.id('Bip001 '+n)];return mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13]};out.push([g('Pelvis'),g('L Foot'),g('R Foot'),g('Head')])}v=sv_;gaitPh=pg;return out};window.__world={FB:()=>{if(!FB)buildFB();return FB},setV:q=>{v=q},cast:(o,d,t)=>cast(o,d,t),gh:(x,z)=>gh(x,z),inCanal:(x,z)=>inCanal(x,z),A:()=>A,E:()=>E,H:()=>H,setH:p=>{H=p;v=[0,0,0]},V:()=>v,swim:()=>swimming,gr:()=>grounded,J:()=>E.J};window.__gaitTest=(ph,spd)=>{const M=MD.levi,o=newPose(),sv_=v,pg=gaitPh;gaitPh=ph;v=[0,0,spd];gaitProc(o);v=sv_;gaitPh=pg;o.k=1;M.pose(toDirs(o,1));const g=n=>{const w=M.W[M.id('Bip001 '+n)];return[w[12],w[13],w[14]].map(x=>+x.toFixed(4))};return{LF:g('L Foot'),RF:g('R Foot'),LT:g('L Toe0'),RT:g('R Toe0'),LK:g('L Calf'),RK:g('R Calf'),LTh:g('L Thigh'),RTh:g('R Thigh'),P:g('Pelvis'),H:g('Head'),py:M.py,LH:g('L Hand'),RH:g('R Hand')}};window.ODM={tst:{gp:()=>grab?gripPoint():null,pm:()=>titan.palmMid,hb:n=>titanBone(n),SPH,titan:()=>titan,T_:T,lh:()=>{const M=MD.levi;if(!M||!lastLeviMM)return null;const mm=lastLeviMM,w=M.W[M.id('Bip001 Head')];return{head:mm[1]*w[12]+mm[5]*w[13]+mm[9]*w[14]+mm[13],feet:H[1]-HH,gp:gaitPh}},cast:(o,d,m)=>cast(o,d,m),floorY,inCanal,canalD,sw:()=>swimming,hh:()=>H,K,setH:p=>{H=p;v=[0,0,0]},setV:q=>{v=q.slice()},fire,slash:()=>slash(),relHook,getHK:()=>hk,grabNow:k=>{const T=titan;T.state='grab';T.atk=null;grab={t:0,esc:0,kind:k,n:0,m:0};LVHIDE=null;hk=[{on:false},{on:false}]},gt:t=>{if(grab)grab.t=t},sliceTag:(tag,sp)=>{const q=SPH.find(s=>s.tag===tag);if(!q)return 'no sphere';sliceAt(titan,q,[0,0,1],sp,()=>{});return titan.cut},clipPose,newPose,toDirs,get AN(){return AN},TN,LV,face:()=>face,setYaw:y=>{st.wyaw=y},setHour:h=>{hour=h},palmPos,mouthPos,titanBone,get cam(){return cam},get grab(){return grab}},P,md:MD,get ready(){return!!titan},get titan(){return titan},get grab(){return grab},set hour(h){hour=h},get hour(){return hour},get spheres(){return SPH},get limbs(){return limbs},get blades(){return blades},get kills(){return kills},get state(){return{H,v,gas,hk}}}}
if(typeof module!=='undefined')module.exports={setE:(e,s)=>{E=e;st=s},build,cast,step,respawn,get:()=>({H,v,gas,hk,grounded}),fire,setCam:c=>{cam=c},K,P,gh};
})();

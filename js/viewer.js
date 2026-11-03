(function(){
const {Engine,V3}=AotEngine;const $=id=>document.getElementById(id);
const canvas=$('c');const rays=$('rays');let E;
const touch=matchMedia('(pointer:coarse)').matches;if(touch)document.body.classList.add('touch');
function fail(m){$('msg').textContent=m;$('load').querySelector('p').textContent='Cannot start'}
try{E=new Engine(canvas,{preserve:true,mobile:/lite/.test(location.search)?true:undefined})}catch(e){fail('This viewer needs WebGL 2. Try a recent Chrome, Safari or Firefox.');return}
E.dpr=Math.min(devicePixelRatio||1,E.mobile?2.2:2.5);if(E.mobile)E.shadowFar=200;
let st={mode:'orbit',target:[10,0,-170],yaw:2.2,pitch:.62,dist:520,pos:[0,1.7,-16],wyaw:Math.PI,wpitch:0,wy:1.7,fly:false};
let tween=null,keys={},stickV=[0,0],cur=null,collide=null,views=[];
function rect(){return collide.rect}
function gh(x,z){const T=E.J.terrain;if(!T)return 0;let h=0;for(const b of T.bumps){const d2=((x-b[0])**2+(z-b[1])**2)/(b[2]*b[2]);if(d2<1)h+=b[3]*(1-d2)**2}
 for(const t of T.terr){const u=x-t.c[0],v=-(z-t.c[1]);if(v>=t.v0&&v<=t.v1){const w=Math.max(0,Math.min(1,(t.hu+.8-Math.abs(u))/1.6));if(w>0)h=Math.max(h,t.H*Math.min(1,(v-t.v0)/t.L)*w)}}return h}
function isBlocked(x,z){if(!collide||st.fly)return false;const ix=Math.floor(x-collide.rect[0]),iz=Math.floor(z-collide.rect[1]);
 if(ix<0||iz<0||ix>=collide.n||iz>=collide.n)return false;const i=iz*collide.n+ix;return (collide.bits[i>>3]>>(7-(i&7)))&1}
function blockedR(x,z,r){return isBlocked(x,z)||isBlocked(x+r,z)||isBlocked(x-r,z)||isBlocked(x,z+r)||isBlocked(x,z-r)}
function camOrbit(){const cp=Math.cos(st.pitch);return{pos:[st.target[0]+st.dist*Math.sin(st.yaw)*cp,st.target[1]+st.dist*Math.sin(st.pitch),st.target[2]+st.dist*Math.cos(st.yaw)*cp],target:st.target.slice(),dist:st.dist}}
function camWalk(){const cp=Math.cos(st.wpitch);const p=[st.pos[0],st.wy,st.pos[2]];return{pos:p,target:[p[0]+Math.sin(st.wyaw)*cp,p[1]+Math.sin(st.wpitch),p[2]+Math.cos(st.wyaw)*cp],dist:30,walk:true}}
function curCam(){return st.mode==='walk'?camWalk():camOrbit()}
function setMode(m){if(m===st.mode)return;
 if(m==='walk'){let x=st.target[0],z=st.target[2];st.fly=false;if(st.dist>200||blockedR(x,z,.5)){x=0;z=-16}
  st.pos=[x,0,z];st.wy=gh(x,z)+1.7;st.wyaw=st.yaw+Math.PI;st.wpitch=-.05;}
 else{const c=camWalk();st.target=[c.pos[0]+Math.sin(st.wyaw)*30,Math.max(0,c.pos[1]-8),c.pos[2]+Math.cos(st.wyaw)*30];st.yaw=st.wyaw+Math.PI;st.pitch=.45;st.dist=40;st.fly=false}
 st.mode=m;document.body.classList.toggle('walk',m==='walk');ui()}
function ui(){$('mOrbit').setAttribute('aria-pressed',st.mode==='orbit');$('mWalk').setAttribute('aria-pressed',st.mode==='walk')}
function goView(i){const v=views[i];cur=i;[...$('rail').children].forEach((b,k)=>b.setAttribute('aria-pressed',k===i));
 const from=curCam(),to={pos:v.p.slice(),target:v.t.slice()};
 tween={t:0,dur:1.5,from,to,v};
}
function finishTween(){const v=tween.v,p=v.p,t=v.t,f=[t[0]-p[0],t[1]-p[1],t[2]-p[2]],l=Math.hypot(...f);
 if(p[1]<6||v.fly||v.walk){st.mode='walk';st.fly=!!v.fly;st.pos=[p[0],0,p[2]];st.wy=p[1];st.wyaw=Math.atan2(f[0],f[2]);st.wpitch=Math.asin(f[1]/l);document.body.classList.add('walk')}
 else{st.mode='orbit';st.fly=false;st.target=t.slice();st.dist=l;st.yaw=Math.atan2(-f[0],-f[2]);st.pitch=Math.asin(-f[1]/l);document.body.classList.remove('walk')}
 ui();tween=null}
// ---------- input
const ptrs=new Map();let lastPinch=0,lastMid=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,b:e.button,shift:e.shiftKey});tween=null;canvas.focus();
 if(ptrs.size===2){const [a,b]=[...ptrs.values()];lastPinch=Math.hypot(a.x-b.x,a.y-b.y);lastMid=[(a.x+b.x)/2,(a.y+b.y)/2]}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(ptrs.size===1){
  if(st.mode==='orbit'&&(p.b===2||p.shift||e.shiftKey))pan(dx,dy);
  else if(st.mode==='orbit'){st.yaw-=dx*.0055;st.pitch=Math.min(1.5,Math.max(.03,st.pitch+dy*.0055))}
  else{st.wyaw-=dx*.0042*(touch?1.3:1);st.wpitch=Math.min(1.4,Math.max(-1.4,st.wpitch-dy*.0042*(touch?1.3:1)))}
 }else if(ptrs.size===2&&st.mode==='orbit'){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const mid=[(a.x+b.x)/2,(a.y+b.y)/2];
  if(lastPinch)st.dist=Math.min(1500,Math.max(6,st.dist*lastPinch/d));lastPinch=d;if(lastMid)pan(mid[0]-lastMid[0],mid[1]-lastMid[1]);lastMid=mid}});
function up(e){ptrs.delete(e.pointerId);lastPinch=0;lastMid=null}
canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
canvas.addEventListener('wheel',e=>{e.preventDefault();tween=null;if(st.mode==='orbit')st.dist=Math.min(1500,Math.max(6,st.dist*Math.exp(e.deltaY*.0012)));else{const f=-e.deltaY*.01;moveWalk(Math.sin(st.wyaw)*f,Math.cos(st.wyaw)*f)}},{passive:false});
function pan(dx,dy){const k=st.dist*.0014;const r=[Math.cos(st.yaw),-Math.sin(st.yaw)],f=[-Math.sin(st.yaw),-Math.cos(st.yaw)];
 st.target[0]-=r[0]*dx*k-f[0]*dy*k;st.target[2]-=r[1]*dx*k-f[1]*dy*k}
function moveWalk(mx,mz){const r=.5;let x=st.pos[0],z=st.pos[2];
 if(!blockedR(x+mx,z+mz,r)){x+=mx;z+=mz}else if(!blockedR(x+mx,z,r))x+=mx;else if(!blockedR(x,z+mz,r))z+=mz;st.pos[0]=x;st.pos[2]=z}
addEventListener('keydown',e=>{keys[e.code]=true;if(/^Digit[1-9]$/.test(e.code)){const i=+e.code.slice(5)-1;if(views[i])goView(i)}
 if(e.code==='KeyF')$('tFig').click();if(e.code==='Tab'){e.preventDefault();setMode(st.mode==='walk'?'orbit':'walk')}});
addEventListener('keyup',e=>{keys[e.code]=false});addEventListener('blur',()=>{keys={}});
// joystick
const stick=$('stick'),knob=stick.firstElementChild;let sp=null;
stick.addEventListener('pointerdown',e=>{sp=e.pointerId;stick.setPointerCapture(sp);sm(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===sp)sm(e)});
function se(e){if(e.pointerId===sp){sp=null;stickV=[0,0];knob.style.transform=''}}stick.addEventListener('pointerup',se);stick.addEventListener('pointercancel',se);
function sm(e){const r=stick.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width/2),y=(e.clientY-r.top-r.height/2)/(r.height/2);const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}stickV=[x,y];knob.style.transform=`translate(${x*36}px,${y*36}px)`}
// UI wiring
$('mOrbit').onclick=()=>setMode('orbit');$('mWalk').onclick=()=>setMode('walk');
$('tFig').onclick=function(){const on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);setHidden()};
$('tLt').onclick=function(){const on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);E.setPreset(on?'golden':'day')};
$('tOv').onclick=function(){const on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);E.over=on?1:0};
$('tSh').onclick=function(){const on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);E.shadowOn=on};
function setHidden(){E.hidden=new Set();if($('tFig').getAttribute('aria-pressed')!=='true')E.hidden.add('figure')}
$('bInfo').onclick=function(){const on=!$('panel').classList.contains('on');$('panel').classList.toggle('on',on);this.setAttribute('aria-expanded',on)};
$('ctl').innerHTML=touch?'<li><b>Orbit:</b> drag to turn, pinch to zoom, two fingers to pan.</li><li><b>Walk:</b> left stick to move, drag the view to look.</li><li>Tap a viewpoint at the bottom to jump there.</li>':
 '<li><b>Orbit:</b> drag to turn, wheel to zoom, right-drag or <kbd>Shift</kbd>+drag to pan, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move the focus.</li><li><b>Walk:</b> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to move, <kbd>Shift</kbd> to run, drag to look.</li><li><kbd>Tab</kbd> switches mode, <kbd>1</kbd>&ndash;<kbd>9</kbd> jump to viewpoints, <kbd>F</kbd> toggles the scale figures.</li>';
// ---------- loop
let last=performance.now(),fps=60,acc=0,nf=0,slow=0;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
 if(!window.__ready)return;
 if(tween){tween.t+=dt/tween.dur;const k=Math.min(1,tween.t),s=k*k*(3-2*k);const a=tween.from,b=tween.to;
  const lerp=(p,q)=>[p[0]+(q[0]-p[0])*s,p[1]+(q[1]-p[1])*s,p[2]+(q[2]-p[2])*s];
  // arc upward during long moves
  const pos=lerp(a.pos,b.pos),far=Math.hypot(a.pos[0]-b.pos[0],a.pos[2]-b.pos[2]);pos[1]+=Math.sin(k*Math.PI)*Math.min(60,far*.12);
  const tg=lerp(a.target,b.target);
  E.render({pos,target:tg,fov:1.0,dist:Math.max(30,Math.hypot(pos[0]-tg[0],pos[1]-tg[1],pos[2]-tg[2])),walk:false},dt);if(k>=1)finishTween();
 }else{
  const sh=keys.ShiftLeft||keys.ShiftRight;
  if(st.mode==='walk'){let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-stickV[1],s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+stickV[0];
   const l=Math.hypot(f,s);if(l>1){f/=l;s/=l}const sp=(sh||Math.hypot(...stickV)>.9?9:4.6)*(st.fly?6:1)*dt;
   const fx=Math.sin(st.wyaw),fz=Math.cos(st.wyaw),rx=Math.cos(st.wyaw),rz=-Math.sin(st.wyaw);
   if(f||s)moveWalk((fx*f+rx*s)*sp,(fz*f+rz*s)*sp);
   if(st.fly){if(keys.KeyE||keys.Space)st.wy+=sp*.7;if(keys.KeyQ)st.wy=Math.max(3,st.wy-sp*.7)}
   if(!st.fly){const ty=gh(st.pos[0],st.pos[2])+1.7;st.wy+=(ty-st.wy)*Math.min(1,dt*10)}}
  else{const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),s=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
   if(f||s){const k=st.dist*.9*dt;st.target[0]+=(-Math.sin(st.yaw)*f+Math.cos(st.yaw)*s)*k*-1;st.target[2]+=(-Math.cos(st.yaw)*f-Math.sin(st.yaw)*s)*k*-1}
   st.target[0]=Math.max(-380,Math.min(380,st.target[0]));st.target[2]=Math.max(-520,Math.min(240,st.target[2]))}
  const c=curCam();if(st.mode==='orbit'&&c.pos[1]<2){st.pitch=Math.asin(Math.max(0,(2-st.target[1])/st.dist))}
  c.fov=st.mode==='walk'?1.12:.95;E.render(c,dt)}

 {const vp=E.vp,c=E.camPos;if(vp&&c){const s=E.sunDir,px=c[0]+s[0]*3000,py=c[1]+s[1]*3000,pz=c[2]+s[2]*3000;
  const cw=vp[3]*px+vp[7]*py+vp[11]*pz+vp[15];const cx=vp[0]*px+vp[4]*py+vp[8]*pz+vp[12],cy=vp[1]*px+vp[5]*py+vp[9]*pz+vp[13];
  const W=innerWidth,Hh=innerHeight;let ro=0,sx=W/2,sy=Hh*.2;
  if(cw>0){let nx=cx/cw,ny=cy/cw;const ex=Math.max(0,Math.abs(nx)-1),ey=Math.max(0,Math.abs(ny)-1);const off=Math.hypot(ex,ey);
   sx=(nx*.5+.5)*W;sy=(1-(ny*.5+.5))*Hh;sx=Math.max(-W*.3,Math.min(W*1.3,sx));sy=Math.max(-Hh*.3,Math.min(Hh*1.3,sy));ro=Math.max(0,1-off*1.25)*(E.preset==='golden'?.85:.35)}
  rays.style.setProperty('--sx',sx+'px');rays.style.setProperty('--sy',sy+'px');rays.style.setProperty('--ro',ro.toFixed(3));rays.style.setProperty('--ra',(Math.sin(E.time*.05)*3).toFixed(2)+'deg')}}
 acc+=dt;nf++;if(acc>.6){fps=nf/acc;acc=0;nf=0;$('stats').textContent=Math.round(fps)+' fps \u00b7 '+Math.round(E.tris/1000)+'k tris \u00b7 '+(E.lastCalls||0)+' calls';
  if(fps<26&&E.scale>.55){slow++;if(slow>2){E.scale=Math.max(.55,E.scale-.1);slow=0}}else slow=0}}
requestAnimationFrame(frame);
// ---------- boot
E.load('./',(m,p)=>{$('msg').textContent=m;$('bar').firstElementChild.style.width=(p*100)+'%'}).then(()=>{
 const c=E.J.collide;const raw=atob(c.bits);const bits=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bits[i]=raw.charCodeAt(i);collide={rect:c.rect,n:c.n,bits};
 views=E.J.views;const rail=$('rail');
 views.forEach((v,i)=>{const b=document.createElement('button');b.innerHTML='<b>'+(i+1)+' \u00b7 '+v.n+'</b><span>'+v.d+'</span>';b.onclick=()=>goView(i);rail.appendChild(b)});
 const w=E.J.world;$('scaleT').innerHTML=[['Player (reference figure)','1.75 m'],['Typical house','7.7\u201312.6 m'],['Bell tower','32 m'],['Keep tower','61 m'],['Wall height','50 m'],['Wall thickness','14.7 m'],['Wall buttress spacing','24.9 m'],['Wall to player','28.6\u00d7'],['District','520 \u00d7 420 m'],['Houses placed',w.houses+'']].map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
 setHidden();E.setPreset('golden');
 const q=new URLSearchParams(location.search);
 const first=0;const v=views[first];cur=first;rail.children[first].setAttribute('aria-pressed','true');
 {const p=v.p,t=v.t,f=[t[0]-p[0],t[1]-p[1],t[2]-p[2]],l=Math.hypot(...f);st.target=t.slice();st.dist=l;st.yaw=Math.atan2(-f[0],-f[2]);st.pitch=Math.asin(-f[1]/l)}
 $('load').classList.add('done');setTimeout(()=>$('load').remove(),800);
 window.__skip=()=>{if(tween)tween.t=1};window.__ready=true;window.__st=st;window.__go=goView;window.__E=E;
}).catch(e=>{console.error(e);fail('Could not load the district data ('+(e&&e.message||e)+').')});
})();

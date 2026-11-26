// The player jump: reference Jump.fbx clip (M:Jump) scrubbed by the real flight time, landing absorbed, no walking on air afterwards.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert');
const R=path.resolve(__dirname,'..'),src=fs.readFileSync(R+'/js/game.js','utf8');
let pass=0;const t=(n,f)=>{f();pass++;console.log('ok  ',n)};
const i0=src.indexOf('{const JC=a.live'),i1=src.indexOf("else if(a.pose==='fall')a.pose=null}}",i0);assert(i0>0&&i1>i0,'jump block found');
const block=src.slice(i0,i1+"else if(a.pose==='fall')a.pose=null}".length);
const run=new Function('a','st','dt','sp','AN','P','H','HH','floorY',`let {grounded,swimming,grab,cling,hk,v}=st;${block};return a;`);
const mj=JSON.parse(fs.readFileSync(R+'/data/models.json','utf8')),AN={meta:mj.anims.meta},P={g:18,jump:4.7};
t('M:Jump is in the clip table (66 frames @30)',()=>{const c=AN.meta.clips['M:Jump'];assert(c&&c.n===66&&c.fps===30)});
t('pelvis curve of the clip: crouch, rise, contact near frame 39, absorb, recover',()=>{
  const b=fs.readFileSync(R+'/assets/models.pack'),hl=b.readUInt32LE(0),h=JSON.parse(b.slice(4,4+hl)),[o,l]=h['anims.bin'],d=new Int16Array(zlib.inflateSync(b.slice(4+hl+o,4+hl+o+l)).buffer.slice(0));
  const c=AN.meta.clips['M:Jump'],Y=f=>d[c.o/2+c.n*49+f]/1e4;assert(Y(16)<.85&&Y(30)>1.2&&Math.abs(Y(39)-1)<.03&&Y(44)<.95&&Math.abs(Y(65)-1)<.03)});
function sim(vy,ground,moving){const a={live:true,isPlayer:true},st={grounded:true,swimming:false,grab:null,cling:0,hk:[{on:false},{on:false}],v:[0,0,0]},dt=1/60,log=[];let y=0,vv=vy,air=true;
  for(let k=0;k<120;k++){ if(k===0){st.grounded=false;st.v[1]=vy} else if(!st.grounded){vv-=P.g*dt;y+=vv*dt;st.v[1]=vv;if(y<=ground&&vv<0){y=ground;st.grounded=true;st.v[1]=0}}
    run(a,st,dt,moving?3:0,AN,P,[0,y+1,0],1,()=>ground);log.push({g:st.grounded,fc:a.forceClip&&a.forceClip[0],f:a.clipT!=null?Math.round(a.clipT*30):null,pose:a.pose,s:a.jS})}
  return {a,log}}
t('a normal jump: frames 21..39 in the air, landing 39..53, then released',()=>{const {a,log}=sim(4.7,0,false);
  const air=log.filter(x=>!x.g),land=log.filter(x=>x.g&&x.fc==='M:Jump');assert(air.length>20&&air.every(x=>x.fc==='M:Jump'&&x.f>=21&&x.f<=39&&x.pose!=='fall'),'air frames');
  assert(air[0].f<=22&&air[air.length-1].f>=36,'sweeps the whole air phase');assert(land.length>=20&&land[0].f>=39&&land[land.length-1].f<=53,'landing frames');
  assert(!a.forceClip&&a.clipT==null&&!a.jS&&!a.fade,'clip released: normal walking resumes on the ground')});
t('landing while moving hands over to the gait quickly (<0.25 s)',()=>{const {log}=sim(4.7,0,true);const land=log.filter(x=>x.g&&x.fc==='L:Unarmed Jump Running');assert(land.length>0&&land.length<=15)});
t('a runner leaps with the running-jump clip over its own frames 12..32, a standing jump keeps M:Jump',()=>{const {log}=sim(4.7,0,true),air=log.filter(x=>!x.g&&x.fc);assert(air.length>20&&air.every(x=>x.fc==='L:Unarmed Jump Running'&&x.f>=12&&x.f<=32),'run leap frames');assert(air[0].f<=13&&air[air.length-1].f>=30);const s2=sim(4.7,0,false).log.filter(x=>!x.g&&x.fc);assert(s2.every(x=>x.fc==='M:Jump'))});
t('hopping off a ledge (no jump impulse) uses the falling pose, not the jump clip',()=>{const a={live:true,isPlayer:true},st={grounded:false,swimming:false,grab:null,cling:0,hk:[{on:false},{on:false}],v:[0,-2,0]};for(let k=0;k<30;k++)run(a,st,1/60,2,AN,P,[0,5,0],1,()=>0);assert(a.pose==='fall'&&!a.forceClip)});
t('a tiny terrain bump (grounded flickers for 2 frames) does not trigger anything',()=>{const a={live:true,isPlayer:true},st={grounded:false,swimming:false,grab:null,cling:0,hk:[{on:false},{on:false}],v:[0,0,0]};run(a,st,1/60,2,AN,P,[0,5,0],1,()=>0);run(a,st,1/60,2,AN,P,[0,5,0],1,()=>0);st.grounded=true;run(a,st,1/60,2,AN,P,[0,5,0],1,()=>0);assert(!a.pose&&!a.forceClip)});
t('hooked in the air hands control back to the flight code',()=>{const {a}=sim(4.7,0,false);const st={grounded:false,swimming:false,grab:null,cling:0,hk:[{on:true},{on:false}],v:[0,3,0]};const b={live:true,isPlayer:true};run(b,st,1/60,0,AN,P,[0,5,0],1,()=>0);assert(!b.forceClip)});
t('the contact pose (frame 39) is only reached when the feet are on the floor, for short, tall and ledge jumps',()=>{
  for(const [vy,ground] of [[4.7,0],[4.7,-3],[4.7,-8],[6,0],[3.2,0]]){const {log}=sim(vy,ground,false);const air=log.filter(x=>!x.g&&x.fc==='M:Jump');
    assert(air.length>5);const late=air.filter(x=>x.f>=37);const lastAir=air[air.length-1];assert(lastAir.f>=36,'reaches contact before touchdown '+vy+' '+ground);
    assert(air.slice(0,air.length-12).every(x=>x.f<=34),'no early landing pose while still high '+vy+'/'+ground+' '+air.slice(0,air.length-12).map(x=>x.f).join(','))}});
t('frames never run backwards or jump in the air phase',()=>{const {log}=sim(4.7,-4,false);const f=log.filter(x=>!x.g&&x.fc==='M:Jump').map(x=>x.f);for(let i=1;i<f.length;i++)assert(f[i]>=f[i-1]-0&&f[i]-f[i-1]<=2,'smooth '+f[i-1]+'>'+f[i])});
console.log('jump tests:',pass,'passed');

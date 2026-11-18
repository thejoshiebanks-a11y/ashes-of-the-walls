// Poses every converted model with the game's REAL loadModel/pose/clip code (stub GL) and checks the skinned result.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');
const R=path.resolve(__dirname,'..'); const src=fs.readFileSync(R+'/js/game.js','utf8');
function grab(startRe){ // balanced-brace extraction of a top-level function/class/const-arrow
  const m=startRe.exec(src); if(!m) throw new Error('not found: '+startRe); let i=src.indexOf('{',m.index+m[0].length-1), d=0, q=null;
  for(let k=i;k<src.length;k++){const c=src[k]; if(q){ if(c==='\\'){k++;continue} if(c===q)q=null; continue}
    if(c==='"'||c==="'"||c==='`'){q=c;continue} if(c==='{')d++; else if(c==='}'){d--; if(d===0) return src.slice(m.index,k+1)}}
  throw new Error('unbalanced '+startRe)}
const line=re=>{const m=re.exec(src); if(!m) throw new Error('no line '+re); const e=src.indexOf('\n',m.index); return src.slice(m.index,e<0?src.length:e)};
const code=[line(/const dot=/), line(/const cross=/), line(/const m4=/), grab(/function arc\(/), grab(/function rotW\(/), grab(/function modelMat\(/), grab(/function relModel\(/), grab(/function groundFix\(M,mm/), grab(/function newPose\(/), grab(/function clipPose\(/),
  grab(/function blendPose\(/), line(/const clipLen=/), grab(/function toDirs\(/), grab(/function mirrorPose\(/), grab(/class Anim\{/), grab(/async function loadAnims\(/), grab(/async function loadModel\(/),
  line(/const b64u8=/), 'const MD={};let AN=null,gp={u:{},a:{}};const ZMASK=new Float32Array(128);'].join('\n');
const gl=new Proxy({},{get:(t,k)=>k==='TEXTURE_2D'||typeof k==='symbol'?1:(...a)=>({})});
const g=JSON.parse(fs.readFileSync(R+'/data/models.json','utf8')); const npc=JSON.parse(fs.readFileSync(R+'/data/npc_models.json','utf8'));
function packFile(f){const b=fs.readFileSync(f),hl=b.readUInt32LE(0),h=JSON.parse(b.slice(4,4+hl)),base=4+hl,o={};for(const k in h)o[k]=new Uint8Array(b.buffer.slice(b.byteOffset+base+h[k][0],b.byteOffset+base+h[k][0]+h[k][1]));return o}
const mp=packFile(R+'/assets/models.pack'), np=packFile(R+'/assets/npc.pack');
const MODELS={}; for(const k in g.models){MODELS[k]={meta:g.models[k].meta,bin:mp[k+'.bin'],tex:Array.from({length:g.models[k].ntex},(_,i)=>mp[k+'.t'+i])}}
for(const k in npc){MODELS[k]={meta:npc[k].meta,bin:np[k+'.bin'],tex:Array.from({length:npc[k].ntex},(_,i)=>np[k+'.t'+i])}}
const _bk=process.argv[2]||'boy';{const P='assets/'+_bk+'/',m=JSON.parse(fs.readFileSync(R+'/'+P+_bk+'.meta.json')),inf=JSON.parse(fs.readFileSync(R+'/'+P+_bk+'.info.json'));MODELS[_bk]={meta:m,bin:new Uint8Array(fs.readFileSync(R+'/'+P+_bk+'.bin')),tex:Array.from({length:inf.tex||0},()=>new Uint8Array(4))}}
MODELS.__ANIMS={meta:g.anims.meta,bin:mp['anims.bin']};
const ctx={console,Math,Float32Array,Uint8Array,Uint16Array,Uint32Array,Int16Array,Int8Array,Response,Blob,DecompressionStream,atob:s=>Buffer.from(s,'base64').toString('binary'),gl,createImageBitmap:async()=>({}),
  window:{__MODELS:MODELS,__ANIMS:{meta:g.anims.meta,bin:mp['anims.bin']}},E:{},ArrayBuffer};
vm.createContext(ctx);
vm.runInContext(code+'\nthis.api={loadModel,loadAnims,MD,toDirs,relModel,groundFix,Anim,newPose,clipPose,getAN:()=>AN,nrm,cross};',ctx);

(async()=>{const A=ctx.api;await A.loadAnims();const key=_bk;await A.loadModel(key);const M=A.MD[key];if(!M){console.log('no model');return}
 const hi=M.id('Bip001 Head'),ni=M.id('Bip001 Neck'),si=M.id('Bip001 Spine2');
 const ax=(W,c)=>[W[c*4],W[c*4+1],W[c*4+2]];
 const rep=(lab,q)=>{const mm=q?A.relModel([1,0,0],[0,1,0],[0,0,1],[0,0,0],q,M.py):[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];const wv=v=>[mm[0]*v[0]+mm[4]*v[1]+mm[8]*v[2],mm[1]*v[0]+mm[5]*v[1]+mm[9]*v[2],mm[2]*v[0]+mm[6]*v[1]+mm[10]*v[2]];const pitch=v=>(Math.atan2(v[2],v[1])*57.3).toFixed(1);const sp=ax(M.W[si],1),pe=ax(M.W[0],1);console.log(lab.padEnd(22),'WORLD pitch(+fwd) head',pitch(wv(ax(M.W[hi],1))),'neck',pitch(wv(ax(M.W[ni],1))),'spine2',pitch(wv(sp)),'pelvis',pitch(wv(pe)));return;const W=M.W[hi];const up=ax(W,1),fw=ax(W,2);const Wn=M.W[ni];const nu=ax(Wn,1);const pit=v=>Math.atan2(-v[2],v[1])*57.3, rol=v=>Math.atan2(v[0],v[1])*57.3;
  // head 'up' axis tilt: pitch forward (+z fwd?) print raw both
  console.log(lab.padEnd(22),'head up',up.map(v=>v.toFixed(3)).join(','),'fwd',fw.map(v=>v.toFixed(3)).join(','),'neck up',nu.map(v=>v.toFixed(3)).join(','),'headY',W[13].toFixed(3),'headZ',W[14].toFixed(3))};

 const gsrc=fs.readFileSync(R+'/js/game.js','utf8');const a0=gsrc.indexOf('const _clamp='),b0=gsrc.indexOf('const ZMASK=');const E2={camPos:[0,1.2*.39,3.3*.39]};
 const lib=new Function('E',gsrc.slice(a0,b0)+';return {liveHead,liveHair};')(E2);
 M.hi=hi;M.nkI=ni;const an2=new A.Anim();const mmv=(q)=>A.relModel([1,0,0],[0,1,0],[0,0,1],[0,0,0],q,M.py);
 const hp=(mm)=>{const w=M.W[hi],v=[w[4],w[5],w[6]];const y=mm[1]*v[0]+mm[5]*v[1]+mm[9]*v[2],z=mm[2]*v[0]+mm[6]*v[1]+mm[10]*v[2];return Math.atan2(z,y)*57.3};
 for(const clip of ['M:Idle','M:Breathing Idle','M:Walking','M:Running']){an2.cur=null;an2.play(clip,true,1,.01);const act={x:0,z:0,yaw:0,speed:/Walk/.test(clip)?1.2:/Run/.test(clip)?4:0,gy:0,live:true,lookCam:true,scale:.39*1.649/1.9486*1,baseScale:.65};let mn=1e9,mx=-1e9,sm=0,n=0;const seq=[];
  for(let i=0;i<600;i++){const q=an2.get(1/60,()=>{});q.k=1;const dirs=A.toDirs(q,1);M.adj=lib.liveHead(act,M,1/60);M.pose(dirs);M.adj=null;const mm=mmv(q);lib.liveHair(act,M,mm,1/60,.39,[1,0,0],[0,1,0],[0,0,1]);const pv=hp(mm);if(i>120){mn=Math.min(mn,pv);mx=Math.max(mx,pv);sm+=pv;n++}if(i%60==0)seq.push(pv.toFixed(0))}
  console.log('LIVE',clip.padEnd(18),'head pitch deg (+fwd/down) min',mn.toFixed(1),'max',mx.toFixed(1),'mean',(sm/n).toFixed(1),seq.join(' '))}
 M.pose({});rep('rest');
 const an=new A.Anim();
 for(const clip of ['M:Idle','M:Breathing Idle','M:Walking','M:Running','M:Talking','M:Crouch To Stand']){an.cur=null;an.play(clip,true,1,.01);an.get(0,()=>{});for(const t of [0.3,0.9,1.5]){an.t=t;const q=an.get(0,()=>{});q.k=1;M.pose(A.toDirs(q,1));rep(clip+' '+t,q)}}
})().catch(e=>{console.error('CRASH',e);process.exit(2)});

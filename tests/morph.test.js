// Morph engine test: real loadModel/pose + morph block (stub GL).
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');
const R=path.resolve(__dirname,'..'); const src=fs.readFileSync(R+'/js/game.js','utf8');
function grab(startRe){ // balanced-brace extraction of a top-level function/class/const-arrow
  const m=startRe.exec(src); if(!m) throw new Error('not found: '+startRe); let i=src.indexOf('{',m.index+m[0].length-1), d=0, q=null;
  for(let k=i;k<src.length;k++){const c=src[k]; if(q){ if(c==='\\'){k++;continue} if(c===q)q=null; continue}
    if(c==='"'||c==="'"||c==='`'){q=c;continue} if(c==='{')d++; else if(c==='}'){d--; if(d===0) return src.slice(m.index,k+1)}}
  throw new Error('unbalanced '+startRe)}
const line=re=>{const m=re.exec(src); if(!m) throw new Error('no line '+re); const e=src.indexOf('\n',m.index); return src.slice(m.index,e<0?src.length:e)};
const a0=src.indexOf('const MORPH_DEF'),a1=src.indexOf('function drawActors(');
const code=[line(/const dot=/), line(/const cross=/), line(/const m4=/), grab(/function arc\(/), grab(/function modelMat\(/), grab(/function relModel\(/), grab(/function groundFix\(M,mm/), grab(/function newPose\(/), grab(/function clipPose\(/),
  grab(/function blendPose\(/), line(/const clipLen=/), grab(/function toDirs\(/), grab(/function mirrorPose\(/), grab(/class Anim\{/), grab(/async function loadAnims\(/), grab(/async function loadModel\(/),
  line(/const b64u8=/), src.slice(a0,a1),'const MD={};let AN=null,gp={u:{},a:{}};const ZMASK=new Float32Array(128);'].join('\n');
const gl=new Proxy({},{get:(t,k)=>k==='TEXTURE_2D'||typeof k==='symbol'?1:(...a)=>({})});
const g=JSON.parse(fs.readFileSync(R+'/data/models.json','utf8')); const npc=JSON.parse(fs.readFileSync(R+'/data/npc_models.json','utf8'));
function packFile(f){const b=fs.readFileSync(f),hl=b.readUInt32LE(0),h=JSON.parse(b.slice(4,4+hl)),base=4+hl,o={};for(const k in h)o[k]=new Uint8Array(b.buffer.slice(b.byteOffset+base+h[k][0],b.byteOffset+base+h[k][0]+h[k][1]));return o}
const mp=packFile(R+'/assets/models.pack'), np=packFile(R+'/assets/npc.pack');
const MODELS={}; for(const k in g.models){MODELS[k]={meta:g.models[k].meta,bin:mp[k+'.bin'],tex:Array.from({length:g.models[k].ntex},(_,i)=>mp[k+'.t'+i])}}
for(const k in npc){MODELS[k]={meta:npc[k].meta,bin:np[k+'.bin'],tex:Array.from({length:npc[k].ntex},(_,i)=>np[k+'.t'+i])}}
MODELS.__ANIMS={meta:g.anims.meta,bin:mp['anims.bin']};
const ctx={console,Math,Float32Array,Uint8Array,Uint16Array,Uint32Array,Int16Array,Int8Array,Response,Blob,DecompressionStream,atob:s=>Buffer.from(s,'base64').toString('binary'),gl,createImageBitmap:async()=>({}),
  window:{__MODELS:MODELS,__ANIMS:{meta:g.anims.meta,bin:mp['anims.bin']}},E:{},ArrayBuffer};
vm.createContext(ctx);
vm.runInContext(code+'\nthis.api={applyMorph,applyFace,faceDisp,FACE_FIELDS,loadModel,loadAnims,MD,toDirs,relModel,groundFix,Anim,newPose,clipPose,getAN:()=>AN,nrm,cross};',ctx);

let pass=0,fail=0; const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};
(async()=>{
 const A=ctx.api; await A.loadAnims();
 for(const key of ['mannequin','fuse_woman','fuse_man']){
  if(!MODELS[key])continue; await A.loadModel(key); const M=A.MD[key];
  const pos=()=>{const o={};M.pose({});const f=n=>{const i=M.id('Bip001 '+n);return[M.S[i*16+12],M.S[i*16+13],M.S[i*16+14]]};return f};
  const tip=(n)=>{M.pose({});const i=M.id('Bip001 '+n);
    // joint world position = column 3 of the pose matrix times its inverse bind => use S*ibm origin; fall back to S translation
    return M.S.slice(i*16+12,i*16+15)};
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  A.applyMorph(M,null); M.pose({}); const base=Array.from(M.S);
  const bone=(n)=>{const i=M.id('Bip001 '+n);return M.S.slice(i*16,i*16+16)};
  // 1) reset is exact
  A.applyMorph(M,{leg:1.2}); M.pose({}); const changed=M.S.some((v,i)=>Math.abs(v-base[i])>1e-6); ok(changed,key+' leg morph changes skin matrices');
  A.applyMorph(M,null); M.pose({}); ok(M.S.every((v,i)=>Math.abs(v-base[i])<1e-6),key+' morph resets exactly');
  // 2) leg length scales foot height in pose space
  const ext1=()=>{let mn=1e9,mx=-1e9;for(const p of M.prims){if(/hair|weapon|odm/i.test(p.mat))continue;for(let i=0;i<p.n;i+=3){let y=0;for(let k=0;k<4;k++){const w=p.ww[i*4+k]/255;if(!w)continue;const b=p.jj[i*4+k]*16,S=M.S;y+=w*(S[b+1]*p.pos0[i*3]+S[b+5]*p.pos0[i*3+1]+S[b+9]*p.pos0[i*3+2]+S[b+13])}mn=Math.min(mn,y);mx=Math.max(mx,y)}}return mx-mn};
  const hh=mo=>{A.applyMorph(M,mo);M.pose({});return ext1()};
  const h0=hh(null),hL=hh({leg:1.2}),hS=hh({leg:.85}),hT=hh({torso:1.2}),hA=hh({arm:1.3});
  ok(hL>h0+.05,key+` longer legs taller (${h0.toFixed(2)}->${hL.toFixed(2)})`);ok(hS<h0-.05,key+' shorter legs shorter');ok(hT>h0+.02,key+' longer torso taller');ok(Math.abs(hA-h0)<.06,key+' arm length keeps height');
  A.applyMorph(M,null);
  // 3) no NaN with extreme settings
  const ext={};for(const k in ctx.window.__morph?.MORPH_DEF||{})ext[k]=1.4;
  A.applyMorph(M,{leg:1.3,arm:.8,torso:1.2,shoulder:1.2,hip:1.3,neck:.8,hand:1.3,foot:1.3,thigh:1.3,calf:.8,upperArm:1.3,foreArm:.8,chest:1.3,waist:.8,hipT:1.3,neckT:.8}); M.pose({});
  ok(M.S.every(Number.isFinite),key+' extreme body morph finite'); A.applyMorph(M,null);
  // 4) face field: symmetric, bounded, identity at 0
  const o=[0,0,0]; const f0={}; A.FACE_FIELDS.forEach(k=>f0[k]=0);
  A.faceDisp(f0,.4,.55,.7,o); ok(o.every(v=>v===0),'zero face = no displacement');
  for(const k of A.FACE_FIELDS){const f={...f0,[k]:1},g={...f0,[k]:-1};
    for(const [u,v,w] of [[.34,.57,.8],[0,.3,.85],[.9,.5,.2],[-.34,.57,.8],[0,.15,.8]]){
      A.faceDisp(f,u,v,w,o);ok(o.every(Number.isFinite)&&Math.hypot(...o)<.35,`${k} bounded at ${u},${v},${w}`);
      const p=o.slice();A.faceDisp(f,-u,v,w,o);ok(Math.abs(p[0]+o[0])<1e-9&&Math.abs(p[1]-o[1])<1e-9&&Math.abs(p[2]-o[2])<1e-9,`${k} mirror symmetric at ${u},${v},${w}`)}
    A.faceDisp(f,.34,.57,.8,o);const a1=o.slice();A.faceDisp(g,.34,.57,.8,o);ok(a1.every((v,i)=>Math.abs(v+o[i])<1e-9),k+' is linear/odd')}
  // 5) applyFace uploads displaced head verts only and restores
  const uploads=[];const gl0=ctx.gl.bufferSubData;
  let moved=0,total=0; const hd=ctx.window.__morph&&ctx.window.__morph.headInfo?null:null;
  A.applyFace(M,{...f0,headW:1,jawW:-1,eyeSize:1}); ok(M.hd&&!M.hd.none&&M.hd.per.some(a=>a.length>50),key+' head vertices found ('+(M.hd&&M.hd.per.reduce((s,a)=>s+a.length,0))+')');
  A.applyFace(M,null); ok(M.fk==='','face reset key');
 }
 console.log(`morph tests: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});

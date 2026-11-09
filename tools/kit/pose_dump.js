// Poses every converted model with the game's REAL loadModel/pose/clip code (stub GL) and checks the skinned result.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');
const R=process.argv[2]; const src=fs.readFileSync(R+'/js/game.js','utf8');
function grab(startRe){ // balanced-brace extraction of a top-level function/class/const-arrow
  const m=startRe.exec(src); if(!m) throw new Error('not found: '+startRe); let i=src.indexOf('{',m.index+m[0].length-1), d=0, q=null;
  for(let k=i;k<src.length;k++){const c=src[k]; if(q){ if(c==='\\'){k++;continue} if(c===q)q=null; continue}
    if(c==='"'||c==="'"||c==='`'){q=c;continue} if(c==='{')d++; else if(c==='}'){d--; if(d===0) return src.slice(m.index,k+1)}}
  throw new Error('unbalanced '+startRe)}
const line=re=>{const m=re.exec(src); if(!m) throw new Error('no line '+re); const e=src.indexOf('\n',m.index); return src.slice(m.index,e<0?src.length:e)};
const code=[line(/const dot=/), line(/const cross=/), line(/const m4=/), grab(/function arc\(/), grab(/function modelMat\(/), grab(/function relModel\(/), grab(/function groundFix\(M,mm/), grab(/function newPose\(/), grab(/function clipPose\(/),
  grab(/function blendPose\(/), line(/const clipLen=/), grab(/function toDirs\(/), grab(/function mirrorPose\(/), grab(/class Anim\{/), grab(/async function loadAnims\(/), grab(/async function loadModel\(/),
  line(/const b64u8=/), 'const MD={};let AN=null,gp={u:{},a:{}};const ZMASK=new Float32Array(128);'].join('\n');
const gl=new Proxy({},{get:(t,k)=>k==='TEXTURE_2D'||typeof k==='symbol'?1:(...a)=>({})});
const g=JSON.parse(fs.readFileSync(R+'/data/models.json','utf8')); const npc=JSON.parse(fs.readFileSync(R+'/data/npc_models.json','utf8'));
function packFile(f){const b=fs.readFileSync(f),hl=b.readUInt32LE(0),h=JSON.parse(b.slice(4,4+hl)),base=4+hl,o={};for(const k in h)o[k]=new Uint8Array(b.buffer.slice(b.byteOffset+base+h[k][0],b.byteOffset+base+h[k][0]+h[k][1]));return o}
const mp=packFile(R+'/assets/models.pack'), np=packFile(R+'/assets/npc.pack');
const MODELS={}; for(const k in g.models){MODELS[k]={meta:g.models[k].meta,bin:mp[k+'.bin'],tex:Array.from({length:g.models[k].ntex},(_,i)=>mp[k+'.t'+i])}}
for(const k in npc){MODELS[k]={meta:npc[k].meta,bin:np[k+'.bin'],tex:Array.from({length:npc[k].ntex},(_,i)=>np[k+'.t'+i])}}
const OUT=process.argv[3];const _bm=k=>({meta:JSON.parse(fs.readFileSync(OUT+'/'+k+'.meta.json','utf8')),bin:new Uint8Array(fs.readFileSync(OUT+'/'+k+'.bin')),tex:[]});
for(const k of (process.argv[4]||'mannequin').split(',')){MODELS[k]=_bm(k);npc[k]={meta:MODELS[k].meta,ntex:0,info:{}}}
MODELS.__ANIMS={meta:g.anims.meta,bin:mp['anims.bin']};
const ctx={console,Math,Float32Array,Uint8Array,Uint16Array,Uint32Array,Int16Array,Int8Array,Response,Blob,DecompressionStream,atob:s=>Buffer.from(s,'base64').toString('binary'),gl,createImageBitmap:async()=>({}),
  window:{__MODELS:MODELS,__ANIMS:{meta:g.anims.meta,bin:mp['anims.bin']}},E:{},ArrayBuffer};
vm.createContext(ctx);
vm.runInContext(code+'\nthis.api={loadModel,loadAnims,MD,toDirs,relModel,groundFix,Anim,newPose,clipPose,getAN:()=>AN,nrm,cross};',ctx);
let pass=0,fail=0; const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};
(async()=>{
 const A=ctx.api; await A.loadAnims(); await A.loadModel('levi');
 const key=(process.argv[4]||'mannequin').split(',')[0]; await A.loadModel(key); const M=A.MD[key]; const D=MODELS[key];
 const bin=zlib.inflateSync(Buffer.from(D.bin)); const meta=D.meta; const out={};
 const clips=(process.argv[5]||'L:Unarmed Idle,L:Standard Walk,L:Jog Forward,L:Sprint').split(',');
 const skinAll=()=>{const res=[];for(const p of meta.prims){const pos=new Float32Array(bin.buffer.slice(bin.byteOffset+p.o[0],bin.byteOffset+p.o[0]+p.n*12)),jj=bin.slice(p.o[3],p.o[3]+p.n*4),ww=bin.slice(p.o[4],p.o[4]+p.n*4);const o=new Float32Array(p.n*3);
   for(let i=0;i<p.n;i++){let x=0,y=0,z=0;for(let k=0;k<4;k++){const w=ww[i*4+k]/255;if(!w)continue;const S=M.S,b=jj[i*4+k]*16,px=pos[i*3],py=pos[i*3+1],pz=pos[i*3+2];x+=w*(S[b]*px+S[b+4]*py+S[b+8]*pz+S[b+12]);y+=w*(S[b+1]*px+S[b+5]*py+S[b+9]*pz+S[b+13]);z+=w*(S[b+2]*px+S[b+6]*py+S[b+10]*pz+S[b+14])}o[i*3]=x;o[i*3+1]=y;o[i*3+2]=z}res.push(Array.from(o,v=>+v.toFixed(4)))}return res};
 M.pose({});out.rest=skinAll();
 for(const c of clips){const fr=[];for(const t of [0,.25,.5,.75]){const o=A.newPose();A.clipPose(c,t,true,o);o.k=1;M.pose(A.toDirs(o,1));fr.push(skinAll())}out[c]=fr}
 fs.writeFileSync(process.argv[6]||'out/posed.json',JSON.stringify(out));console.log('ok',Object.keys(out));
})();
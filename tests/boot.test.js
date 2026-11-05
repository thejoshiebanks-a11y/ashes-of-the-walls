const fs=require('fs'),path=require('path');
const root=require('path').resolve(__dirname,'..');
global.window=global; 
const els={msg:{textContent:''},bar:{firstElementChild:{style:{}}}};
const loaded=[];
global.document={getElementById:id=>els[id]||null,querySelector:()=>({textContent:''}),
 createElement:()=>({}),body:{appendChild:s=>{loaded.push(s.src);setTimeout(()=>s.onload&&s.onload(),0)}}};
global.fetch=async(u)=>{const p=path.join(root,String(u).split('?')[0]);
  if(!fs.existsSync(p)) throw new Error('404 '+u);
  const b=fs.readFileSync(p);
  return new Response(b);};
require(root+'/js/boot.js');
setTimeout(async()=>{
 console.log('scripts injected in order:',loaded.map(x=>x.split('?')[0]).join(' -> '));
 const J=window.__PACK_JSON;
 const buf=await window.__packBuf();
 console.log('district buf',buf.byteLength,'expected',J.vbytes+J.ibytes+J.nInst*64, buf.byteLength===J.vbytes+J.ibytes+J.nInst*64?'OK':'MISMATCH');
 // every texture the engine requests
 const need=[...J.tex.map(t=>t.file),J.ctl.file,J.ctl.hole,...J.detail];
 let bad=0;for(const n of need){const r=await window.fetch('./'+n);const b=await (await r.blob()).arrayBuffer();if(!b.byteLength){bad++;console.log('empty',n)}}
 console.log('textures served',need.length,'bad',bad);
 // models + anims inflate
 for(const k of Object.keys(window.__MODELS)){const m=window.__MODELS[k];
  const out=await new Response(new Blob([m.bin]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  console.log('model',k,'bin->',out.byteLength,'tex',m.tex.length,m.tex.map(t=>t.length).join(','));}
 const a=await new Response(new Blob([window.__ANIMS.bin]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
 console.log('anims inflate',a.byteLength);
 // non-texture fetch passes through
 try{await window.fetch('data/nothing.json')}catch(e){console.log('passthrough ok:',e.message)}
},1500);

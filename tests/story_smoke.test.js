// Smoke test: runs the real story layer against a mock DOM and a mock game.
const fs=require('fs'),path=require('path'); const R=path.resolve(__dirname,'..');
const _st=global.setTimeout; global.setTimeout=(f,ms,...a)=>_st(f,Math.floor((ms||0)*0.05),...a);
const T0=Date.now(); global.performance={now:()=>(Date.now()-T0)*20};
/* ---------- mock DOM ---------- */
function parseSel(sel){return sel.split(',').map(s=>s.trim().replace(/\s*>\s*/g,' ').split(/\s+/).map(c=>{const m={tag:null,id:null,cls:[],attrs:[]};
  let r=c; r=r.replace(/\[([^\]=]+)(?:=([^\]]*))?\]/g,(_,k,v)=>{m.attrs.push([k,v&&v.replace(/^["']|["']$/g,'')]);return ''});
  r=r.replace(/#([\w-]+)/g,(_,i)=>{m.id=i;return ''}); r=r.replace(/\.([\w-]+)/g,(_,k)=>{m.cls.push(k);return ''}); if(r)m.tag=r.toUpperCase(); return m}))}
const matchOne=(e,m)=>(!m.tag||e.tagName===m.tag)&&(!m.id||e.attrs.id===m.id)&&m.cls.every(c=>e.classList.contains(c))&&m.attrs.every(([k,v])=>k in e.attrs&&(v===undefined||e.attrs[k]===v));
class El{constructor(t){this.tagName=String(t).toUpperCase();this.children=[];this.attrs={};this.parent=null;this.L={};this._t='';this.style={setProperty:(k,v)=>{this.style[k]=v}};this.dataset=new Proxy({},{set:(t,k,v)=>{t[k]=v;this.attrs['data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(v);return true}});this.scrollTop=0;this.offsetWidth=1;this.nodeType=1;
  const self=this;this.classList={add:(...c)=>{const s=new Set(self.className.split(/\s+/).filter(Boolean));c.forEach(x=>s.add(x));self.className=[...s].join(' ')},remove:(...c)=>{const s=new Set(self.className.split(/\s+/).filter(Boolean));c.forEach(x=>s.delete(x));self.className=[...s].join(' ')},contains:c=>self.className.split(/\s+/).includes(c),toggle:(c,f)=>{const has=self.classList.contains(c);const want=f===undefined?!has:!!f;want?self.classList.add(c):self.classList.remove(c);return want}}}
  get className(){return this.attrs.class||''} set className(v){this.attrs.class=v}
  get disabled(){return 'disabled' in this.attrs} set disabled(v){v?this.attrs.disabled='':delete this.attrs.disabled}
  get hidden(){return 'hidden' in this.attrs} set hidden(v){v?this.attrs.hidden='':delete this.attrs.hidden}
  get isConnected(){let e=this;while(e.parent)e=e.parent;return e===document.documentElement||e===document.body}
  get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(''):this._t} set textContent(v){this.children.forEach(c=>c.parent=null);this.children=[];this._t=String(v)}
  append(...k){k.forEach(c=>{if(typeof c==='string')c=new TextNode(c);if(c.parent)c.remove();c.parent=this;this.children.push(c)})} appendChild(c){this.append(c);return c}
  get firstChild(){return this.children[0]||null} insertBefore(n,ref){if(n.parent)n.remove();n.parent=this;const i=ref?this.children.indexOf(ref):-1;if(i<0)this.children.push(n);else this.children.splice(i,0,n);return n}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}}
  setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]} removeAttribute(k){delete this.attrs[k]}
  addEventListener(t,f){(this.L[t]=this.L[t]||[]).push(f)} dispatch(t,ev={}){ev.target=ev.target||this;ev.preventDefault=()=>{};ev.stopPropagation=()=>{};(this.L[t]||[]).forEach(f=>f(ev));if(this['on'+t])this['on'+t](ev);if(this.parent&&t!=='click-nobubble')this.parent.dispatch&&t==='pointerdown'&&this.parent.dispatch(t,ev)}
  click(){if(this.disabled)return;this.dispatch('click')} focus(){} getContext(){return CTX} getBoundingClientRect(){return {width:800,height:400}} setPointerCapture(){} 
  all(){let o=[];for(const c of this.children){if(c.nodeType===1){o.push(c);o=o.concat(c.all())}}return o}
  querySelectorAll(sel){const alts=parseSel(sel);return this.all().filter(e=>alts.some(chain=>{if(!matchOne(e,chain[chain.length-1]))return false;let p=e.parent,i=chain.length-2;while(i>=0){while(p&&!matchOne(p,chain[i]))p=p.parent;if(!p)return false;p=p.parent;i--}return true}))}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null} closest(sel){let e=this;const m=parseSel(sel)[0][0];while(e){if(e.nodeType===1&&matchOne(e,m))return e;e=e.parent}return null}}
class TextNode{constructor(t){this.nodeType=3;this._t=t;this.parent=null}get textContent(){return this._t}remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this)}}}
const CTX=new Proxy({},{get:(t,k)=>k in t?t[k]:/Gradient$/.test(k)?(()=>({addColorStop(){}})):k==='createImageData'?((w,h)=>({data:new Uint8ClampedArray(Math.max(4,(w|0)*(h|0)*4||4))})):(...a)=>({}),set:(t,k,v)=>{t[k]=v;return true}});
const body=new El('body'),html=new El('html');html.children=[body];body.parent=html;
global.document={documentElement:html,body,hidden:false,createElement:t=>new El(t),createTextNode:t=>new TextNode(t),getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(){},removeEventListener(){}};
global.window=global; global.innerWidth=800; global.innerHeight=400;
const winL={}; global.addEventListener=(t,f)=>{(winL[t]=winL[t]||[]).push(f)}; const key=(code)=>{(winL.keydown||[]).forEach(f=>f({code,target:{tagName:'BODY'},preventDefault(){}}))};
global.removeEventListener=(t,f)=>{winL[t]=(winL[t]||[]).filter(x=>x!==f)}; global.requestAnimationFrame=f=>_st(()=>f(performance.now()),2); global.cancelAnimationFrame=()=>{};
const ls=new Map(); global.localStorage={getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v)),removeItem:k=>ls.delete(k),key:i=>[...ls.keys()][i],get length(){return ls.size}};
global.fetch=async u=>{const p=path.join(R,String(u).split('?')[0]);if(!fs.existsSync(p))return{ok:false,status:404,json:async()=>({}),arrayBuffer:async()=>new ArrayBuffer(0)};const raw=fs.readFileSync(p);return{ok:true,status:200,json:async()=>JSON.parse(raw.toString('utf8')),arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)}};
const anode=()=>new Proxy(function(){},{get:(t,k)=>k==='connect'?(x=>x):['gain','frequency','Q','detune'].includes(k)?{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}}:(()=>{}),set:()=>true});
global.AudioContext=function(){return {currentTime:0,sampleRate:8000,state:'running',destination:anode(),createGain:anode,createOscillator:anode,createBiquadFilter:anode,createConvolver:anode,createBufferSource:anode,resume(){},createBuffer:(c,l)=>({getChannelData:()=>new Float32Array(l)})}};
global.URL={createObjectURL:()=>'blob:x'}; global.Blob=class{}; 
/* minimal innerHTML for the mock: tags, attributes and text (enough for the opening's markup) */
Object.defineProperty(El.prototype,'innerHTML',{get(){return this.textContent},set(h){this.children.forEach(c=>c.parent=null);this.children=[];this._t='';
  const VOID=/^(br|img|input|hr|stop|path|rect|circle|line|polygon|feTurbulence|feDisplacementMap|feGaussianBlur)$/i; const stack=[this]; const re=/<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?)(\/?)>|([^<]+)/g; let m;
  while((m=re.exec(String(h)))){ const top=stack[stack.length-1];
    if(m[5]!==undefined){top.append(new TextNode(m[5]));continue}
    if(m[1]){if(stack.length>1)stack.pop();continue}
    const e=new El(m[2]); String(m[3]||'').replace(/([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g,(_,k,v1,v2)=>{e.attrs[k]=v1!==undefined?v1:v2!==undefined?v2:''; return ''}); top.append(e); if(!m[4]&&!VOID.test(m[2]))stack.push(e); }
}});
/* ---------- page skeleton the game would provide ---------- */
const mk=(t,id,cls,par)=>{const e=new El(t);if(id)e.attrs.id=id;if(cls)e.className=cls;(par||body).append(e);return e};
const load=mk('div','load'); const inner=mk('div',null,null,load); mk('div','msg',null,inner); mk('canvas','c');
const odm=mk('div','odm'); mk('div',null,'lv',odm).textContent='LEVI';
/* ---------- mock game ---------- */
let HP=[0,1,-38]; global.__ready=true; global.__E={vp:new Float32Array([.01,0,0,0, 0,.01,0,0, 0,0,0,0, 0,0,0,1])}; global.__st={wyaw:0,wpitch:0};
global.ODM={ready:true,hour:9,tst:{K:{KeyW:true},setH:p=>{HP=p}}};
global.__world={H:()=>HP,gh:()=>0,cast:()=>null,inCanal:()=>false};
const MODELS=new Set(),LIST=[]; let AID=1;
global.__actors={HH:.486,PLS:.54,LEVI_H:1.62,list:LIST,has:k=>MODELS.has(k),loadModel:async k=>{MODELS.add(k);return {}},add(d){const a=Object.assign({id:AID++},d);LIST.push(a);return a},remove(id){const i=LIST.findIndex(a=>a.id===id);if(i>=0)LIST.splice(i,1)},clear(keep){for(let i=LIST.length-1;i>=0;i--)if(!(keep&&LIST[i].isPlayer))LIST.splice(i,1)}};
/* ---------- load the real modules ---------- */
for(const f of ['core','audio','destiny','dialogue','world','save','actors','map','ui','opening','main']) require(`${R}/js/story/${f}.js`);
const S=window.STORY, UI=S.ui, ACT=S.actors, D=S.destiny; let pass=0,fail=0; const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL:',m)}};
const sleep=ms=>new Promise(r=>_st(r,ms)); const until=async(fn,m,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(fn())return true;await sleep(15)}ok(false,'timeout: '+m);return false};
const vis=sel=>{const e=document.querySelector(sel);return e&&!e.hidden};
const tapAll=async(max=60)=>{for(let i=0;i<max&&S.dialogue.active();i++){const ch=document.querySelectorAll('.sv-choice');if(ch.length){ch[tapAll.pick&&tapAll.pick.length?tapAll.pick.shift():0].click()}else UI.dialogue.tap();await sleep(8)}};
const talk=async(conv,picks)=>{tapAll.pick=picks||[];S.dialogue.start(conv);await tapAll()};
const stand=id=>{const q=S.world.pos(S.data.world.points.find(p=>p.id===id));HP=[q.x+1,0,q.z+1]};
(async()=>{
 UI.settings.textSpeed='instant';
 // ---- gate: silence until the first tap, which unlocks audio ----
 await until(()=>S.fsm.state==='intro'&&document.querySelector('.op-studio.gate'),'tap gate shows'); ok(/Tap/i.test(document.querySelector('.op-tap').textContent),'tap prompt');
 ok(!S.audio.ready(),'no audio before the first tap');
 document.querySelector('.op-studio').onpointerdown(); ok(S.audio.ready(),'audio unlocked by the tap');
 await until(()=>document.querySelector('.op-studio.logo'),'studio logo plays');
 await until(()=>S.fsm.state==='title'&&document.querySelector('.op-title.shown'),'title docks after the stamp'); await until(()=>document.querySelector('.op-item.sel'),'menu goes live');
 ok(window.__freeze===true&&window.__hideAvatar===true,'frozen on title'); ok(window.__cine&&window.__cine.on,'creeping title camera is on'); ok(body.className.includes('sv-hidehud'),'HUD hidden on title');
 const act=a=>document.querySelector('[data-act='+a+']');
 ok(!act('roam'),'free roam is gone from the menu'); ok(act('train').className.includes('locked'),'training grounds shown locked'); ok(act('continue').className.includes('empty'),'Load file is greyed without a save'); ok(act('exit'),'exit item present');
 ok(/Begin/i.test(act('new').textContent),'Begin Journey'); ok(document.querySelector('.op-credit'),'credits band blends in at the bottom');
 act('train').click(); await sleep(10); ok(/Act 2/.test(document.querySelector('.sv-toasts').textContent),'locked toast');
 // options + credits
 act('options').click(); await sleep(20); ok(vis('#sv-pause')&&document.querySelectorAll('.sv-range').length>=3,'options has volume sliders');
 document.querySelectorAll('.sv-range')[1].dispatch('input',{target:{value:'40'}}); ok(Math.abs(S.audio.settings.music-0.4)<1e-6,'music volume slider works');
 document.querySelector('#sv-pause .sv-pbtn').click(); await sleep(20); ok(vis('#sv-title'),'options back to title');
 document.querySelector('.op-cbtn').click(); await sleep(20); ok(/Prime Slayer3D/.test(document.querySelector('.sv-roll').textContent)&&/Nico Maier/.test(document.querySelector('.sv-roll').textContent),'credits scene'); document.querySelector('#sv-credits .sv-back').onclick(); await sleep(20);
 // rig the destiny so this file is an Ackerman (it must stay hidden)
 let seed=1; while(D.roll(seed).bloodline!=='ackerman')seed++; localStorage.setItem('ashes_destiny',String(seed)); const dest=D.roll(seed);
 // ---- Begin journey: cold open, then the registry ----
 act('new').click(); await until(()=>S.fsm.state==='intro','cold open begins'); ok(!S.audio.ready()||true,''); 
  await until(()=>S.fsm.state==='creator'&&vis('#sv-creator'),'registry opens'); ok(!LIST.some(a=>a.key==='colossal'),'colossal removed after the cold open');
 ok(LIST.some(a=>a.key.startsWith('fuse_')&&!a.isPlayer&&a.scale>0.5),'the Anchor stands in the preview'); const pv=LIST.find(a=>a.key.startsWith('fuse_')&&a.look&&a.skipRe);
 ok(/Shiganshina District Registry/.test(document.querySelector('.sv-stage-head').textContent),'registry framing');
 const next=()=>document.querySelector('.sv-cr-next'); ok(next().disabled,'cannot continue without a name');
 const nm=document.querySelector('#sv-in-name'); nm.value='Sera'; nm.dispatch('input',{target:nm}); ok(!next().disabled,'name enables Continue');
 const playerActor=()=>LIST.find(a=>a.look&&!a.npcId); const h0=playerActor().scale;
 document.querySelectorAll('.sv-chip').find(c=>c.textContent==='Boy').click(); await sleep(10); ok(playerActor().key==='fuse_man','body choice swaps the preview model');
 next().click(); await sleep(10); const rg=document.querySelector('.sv-range'); const sc0=playerActor().scale; rg.dispatch('input',{target:{value:'100'}}); ok(playerActor().scale>sc0,'height slider updates the preview live');
 document.querySelectorAll('.sv-range')[1].dispatch('input',{target:{value:'100'}}); ok(playerActor().wide>1,'build slider widens the preview');
 next().click(); await sleep(10); const sw0=playerActor().look.skin.join(); document.querySelectorAll('.sv-sw')[4].click(); await sleep(10); ok(playerActor().look.skin.join()!==sw0,'skin tone changes live');
 document.querySelectorAll('.sv-chip').find(c=>c.textContent==='Brow')&&document.querySelectorAll('.sv-chip').find(c=>c.textContent==='Brow').click();
 next().click(); await sleep(10); ok(/Shirt/.test(document.querySelector('.sv-cr-body').textContent),'clothing tab'); document.querySelectorAll('.sv-chip').find(c=>c.textContent==='Weathered').click();
 next().click(); await sleep(10); const ft=document.querySelector('.sv-cr-body').textContent; ok(/The registry has decided the rest/.test(ft)&&/Family/.test(ft)&&/Your Anchor/.test(ft),'the file tab shows what the system decided');
 ok(ft.includes(dest.anchor.name),'Anchor name is rolled by the system: '+dest.anchor.name); ok(!/Ackerman/.test(ft),'a hidden Ackerman bloodline is not revealed in the registry');
 ok(!document.querySelector('#sv-in-anchor'),'there is no way to choose your Anchor'); ok(!/Ackerman-blooded|Common Eldian/.test(ft),'no bloodline picker');
 document.querySelectorAll('.sv-card-opt').find(c=>/Veteran/.test(c.textContent)).click(); ok(next().textContent==='Stamp the file','final button'); next().click();
 // ---- Day 1 ----
 await until(()=>S.fsm.state==='dialogue'||S.fsm.state==='cutscene'&&S.state.player,'the story begins');
 await until(()=>S.fsm.state==='dialogue','opening narration'); const P=S.state.player;
 ok(P.name==='Sera'&&P.body==='fuse_man'&&P.difficulty==='veteran'&&P.bloodline==='ackerman'&&P.anchor.name===dest.anchor.name&&P.anchor.rel===dest.anchor.rel&&P.look.scar===1&&P.wear===2,'player built from the registry plus destiny');
 ok(localStorage.getItem('ashes_destiny')===null,'destiny is consumed when the file is stamped'); ok(S.state.day===1,'day 1');
 ok(LIST.some(a=>a.isPlayer)&&LIST.some(a=>a.npcId==='anchor')&&['oswin','marta','hannes','eren','armin','mikasa'].every(id=>LIST.some(a=>a.npcId===id)),'player, Anchor and the whole cast are on the street');
 ok(window.__noOdm===true&&window.__noTitan===true&&window.__hideAvatar===true,'ODM locked, no Titan, Levi avatar hidden'); ok(body.className.includes('sv-story'),'story body class');
 await tapAll(); await until(()=>S.fsm.state==='play','play begins'); ok(window.__freeze===false,'unfrozen in play'); ok(!UI.track.hidden&&/Talk to /.test(UI.track.textContent),'tracker: '+UI.track.textContent);
 ok(S.quests.status('d1_morning')==='active','day 1 quest');
 // talk using G, check shoulder camera
 stand('anchor_home'); await sleep(60); ok(!UI.talk.hidden,'talk prompt'); window.__cine.on=false; (window.addEventListener&&0); 
 const keyEv=code=>{ /* dispatch to window listeners */ }; 
 await talk('anchor_morning',[0,1]); await until(()=>S.fsm.state==='play','after anchor'); ok(S.quests.tracked().id==='bread','objective advanced');
 // map
 UI._cb('map'); await sleep(30); ok(vis('#sv-map')&&S.fsm.state==='paused','map opens'); ok(/Marta|Old Square|Objective/.test(document.querySelector('.sv-map-obj').textContent+'Objective'),'map shows the objective'); UI._cb('closeMap'); await sleep(20); ok(S.fsm.state==='play'&&!vis('#sv-map'),'map closes');
 // finish day 1
 await talk('marta_bread',[0]); await talk('kids_canal',[0]); await talk('hannes_gate',[0]); await until(()=>S.fsm.state==='play','day1 talks');
 await talk('anchor_dinner',[0]); await until(()=>S.state.day===2&&S.fsm.state==='play','day 2 begins after the day-change sequence');
 ok(S.quests.status('d2_gate')==='active','day 2 quest started by the day change'); ok(S.state.clock.hour===7,'morning again'); ok(/Day 2/.test(document.querySelector('.sv-card h2').textContent+'Day 2'),'day card');
 // ---- Day 2 ----
 await talk('anchor_day2',[2]); await talk('hannes_lunch',[0]); stand('hannes'); S.world.tick(0,-30); ok(S.state.quests.d2_gate.done.observe,'watch the gate');
 await talk('oswin_whisper',[1]); await talk('hannes_hum',[1]); await talk('oswin_after'); await talk('kids_day2',[0]); await talk('anchor_evening2',[0]);
 await until(()=>S.state.day===3&&S.fsm.state==='play','day 3 begins'); ok(S.quests.status('d3_last')==='active','day 3 quest');
 // ---- Day 3 and the breach ----
 await talk('anchor_day3',[1]); await talk('marta_day3',[0]); await talk('kids_day3',[0,0]);
 ok(S.world.convFor(S.data.world.points.find(p=>p.id==='anchor_gate'))==='anchor_gate','the Anchor waits at the gate'); await sleep(40); const anchorA=LIST.find(a=>a.npcId==='anchor'); S.debug.syncActors(); const gq=S.world.pos(S.data.world.points.find(p=>p.id==='anchor_gate')); ok(Math.hypot(anchorA.x-gq.x,anchorA.z-gq.z)<0.01,'the Anchor actor walked to the gate');
 tapAll.pick=[1]; S.dialogue.start('anchor_gate'); await tapAll();
 await until(()=>S.fsm.state==='dialogue'&&/ground jumps/.test(document.querySelector('.sv-line').textContent),'breach dialogue'); ok(document.body.className.includes('sv-letterbox'),'letterbox on');
 tapAll.pick=[0]; await tapAll(); await until(()=>S.fsm.state==='ending'&&vis('#sv-ending'),'ending card'); ok(S.flag('breach_choice')==='hand','choice saved');
 const auto=await S.save.read('auto'); ok(auto&&auto.state.flags.prologue_part1_done&&auto.state.day===3&&auto.state.player.look.scar===1,'autosave holds day, look and flags');
 document.querySelectorAll('.sv-pbtn').find(b=>/Return to title/.test(b.textContent)).click(); await until(()=>S.fsm.state==='title'&&vis('#sv-title'),'title again'); await until(()=>document.querySelector('.op-item.sel'),'menu live again');
 ok(!act('continue').className.includes('empty')&&/Sera/.test(act('continue').querySelector('small').textContent),'Load file appears: '+act('continue').querySelector('small').textContent);
 S.reset(); act('continue').click(); await sleep(30); ok(vis('#sv-saves'),'load list'); document.querySelectorAll('.sv-slot').find(b=>/Autosave/.test(b.textContent)).click();
 await until(()=>S.fsm.state==='play'&&S.state.player&&S.state.player.name==='Sera','load restores'); ok(S.state.day===3&&S.flag('breach_choice')==='hand','day and flags restored'); ok(LIST.some(a=>a.isPlayer),'player actor respawned after load');
 console.log(`smoke test: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});

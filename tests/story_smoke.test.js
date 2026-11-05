// Smoke test: runs the real story layer against a mock DOM and a mock game.
const fs=require('fs'),path=require('path'); const R=path.resolve(__dirname,'..');
const _st=global.setTimeout; global.setTimeout=(f,ms,...a)=>_st(f,Math.floor((ms||0)*0.06),...a);
/* ---------- mock DOM ---------- */
function parseSel(sel){return sel.split(',').map(s=>s.trim().replace(/\s*>\s*/g,' ').split(/\s+/).map(c=>{const m={tag:null,id:null,cls:[],attrs:[]};
  let r=c; r=r.replace(/\[([^\]=]+)(?:=([^\]]*))?\]/g,(_,k,v)=>{m.attrs.push([k,v]);return ''});
  r=r.replace(/#([\w-]+)/g,(_,i)=>{m.id=i;return ''}); r=r.replace(/\.([\w-]+)/g,(_,k)=>{m.cls.push(k);return ''}); if(r)m.tag=r.toUpperCase(); return m}))}
const matchOne=(e,m)=>(!m.tag||e.tagName===m.tag)&&(!m.id||e.attrs.id===m.id)&&m.cls.every(c=>e.classList.contains(c))&&m.attrs.every(([k,v])=>k in e.attrs&&(v===undefined||e.attrs[k]===v));
class El{constructor(t){this.tagName=String(t).toUpperCase();this.children=[];this.attrs={};this.parent=null;this.L={};this._t='';this.style={setProperty:(k,v)=>{this.style[k]=v}};this.dataset={};this.scrollTop=0;this.offsetWidth=1;this.nodeType=1;
  const self=this;this.classList={add:(...c)=>{const s=new Set(self.className.split(/\s+/).filter(Boolean));c.forEach(x=>s.add(x));self.className=[...s].join(' ')},remove:(...c)=>{const s=new Set(self.className.split(/\s+/).filter(Boolean));c.forEach(x=>s.delete(x));self.className=[...s].join(' ')},contains:c=>self.className.split(/\s+/).includes(c),toggle:(c,f)=>{const has=self.classList.contains(c);const want=f===undefined?!has:!!f;want?self.classList.add(c):self.classList.remove(c);return want}}}
  get className(){return this.attrs.class||''} set className(v){this.attrs.class=v}
  get disabled(){return 'disabled' in this.attrs} set disabled(v){v?this.attrs.disabled='':delete this.attrs.disabled}
  get hidden(){return 'hidden' in this.attrs} set hidden(v){v?this.attrs.hidden='':delete this.attrs.hidden}
  get isConnected(){let e=this;while(e.parent)e=e.parent;return e===document.documentElement||e===document.body}
  get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(''):this._t} set textContent(v){this.children.forEach(c=>c.parent=null);this.children=[];this._t=String(v)}
  append(...k){k.forEach(c=>{if(typeof c==='string')c=new TextNode(c);if(c.parent)c.remove();c.parent=this;this.children.push(c)})} appendChild(c){this.append(c);return c}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}}
  setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]} removeAttribute(k){delete this.attrs[k]}
  addEventListener(t,f){(this.L[t]=this.L[t]||[]).push(f)} dispatch(t,ev={}){ev.target=ev.target||this;ev.preventDefault=()=>{};ev.stopPropagation=()=>{};(this.L[t]||[]).forEach(f=>f(ev));if(this['on'+t])this['on'+t](ev);if(this.parent&&t!=='click-nobubble')this.parent.dispatch&&t==='pointerdown'&&this.parent.dispatch(t,ev)}
  click(){if(this.disabled)return;this.dispatch('click')} focus(){} 
  all(){let o=[];for(const c of this.children){if(c.nodeType===1){o.push(c);o=o.concat(c.all())}}return o}
  querySelectorAll(sel){const alts=parseSel(sel);return this.all().filter(e=>alts.some(chain=>{if(!matchOne(e,chain[chain.length-1]))return false;let p=e.parent,i=chain.length-2;while(i>=0){while(p&&!matchOne(p,chain[i]))p=p.parent;if(!p)return false;p=p.parent;i--}return true}))}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null} closest(sel){let e=this;const m=parseSel(sel)[0][0];while(e){if(e.nodeType===1&&matchOne(e,m))return e;e=e.parent}return null}}
class TextNode{constructor(t){this.nodeType=3;this._t=t;this.parent=null}get textContent(){return this._t}remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this)}}}
const body=new El('body'),html=new El('html');html.children=[body];body.parent=html;
global.document={documentElement:html,body,hidden:false,createElement:t=>new El(t),createTextNode:t=>new TextNode(t),getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(){}};
global.window=global; global.innerWidth=800; global.innerHeight=400;
const winL={}; global.addEventListener=(t,f)=>{(winL[t]=winL[t]||[]).push(f)}; const key=(code)=>{(winL.keydown||[]).forEach(f=>f({code,target:{tagName:'BODY'},preventDefault(){}}))};
global.requestAnimationFrame=f=>_st(()=>f(performance.now()),2); global.cancelAnimationFrame=()=>{};
const ls=new Map(); global.localStorage={getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v)),removeItem:k=>ls.delete(k),key:i=>[...ls.keys()][i],get length(){return ls.size}};
global.fetch=async u=>{const p=path.join(R,String(u).split('?')[0]);if(!fs.existsSync(p))return{ok:false,status:404,json:async()=>({})};const b=fs.readFileSync(p,'utf8');return{ok:true,status:200,json:async()=>JSON.parse(b)}};
global.URL={createObjectURL:()=>'blob:x'}; global.Blob=class{}; 
/* ---------- page skeleton the game would provide ---------- */
const mk=(t,id,cls,par)=>{const e=new El(t);if(id)e.attrs.id=id;if(cls)e.className=cls;(par||body).append(e);return e};
const load=mk('div','load'); const inner=mk('div',null,null,load); mk('div','msg',null,inner); mk('canvas','c');
const odm=mk('div','odm'); mk('div',null,'lv',odm).textContent='LEVI';
/* ---------- mock game ---------- */
let HP=[0,1,-38]; global.__ready=true; global.__E={vp:new Float32Array([.01,0,0,0, 0,.01,0,0, 0,0,0,0, 0,0,0,1])}; global.__st={wyaw:0,wpitch:0};
global.ODM={ready:true,hour:9,tst:{K:{KeyW:true},setH:p=>{HP=p}}};
global.__world={H:()=>HP,gh:()=>0,cast:()=>null,inCanal:()=>false};
/* ---------- load the real modules ---------- */
for(const f of ['core','dialogue','world','save','ui','main']) require(`${R}/js/story/${f}.js`);
const S=window.STORY, UI=S.ui; let pass=0,fail=0; const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL:',m)}};
const sleep=ms=>new Promise(r=>_st(r,ms)); const until=async(fn,m,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){if(fn())return true;await sleep(15)}ok(false,'timeout: '+m);return false};
const vis=sel=>{const e=document.querySelector(sel);return e&&!e.hidden};
const tapAll=async(max=40)=>{ // run a conversation to its end
  for(let i=0;i<max&&S.dialogue.active();i++){const ch=document.querySelectorAll('.sv-choice');if(ch.length){ch[tapAll.pick&&tapAll.pick.length?tapAll.pick.shift():0].click()}else UI.dialogue.tap();await sleep(8)}};
(async()=>{
 UI.settings.textSpeed='instant';
 // boot -> intro -> title
 await until(()=>S.fsm.state==='intro'&&vis('#sv-intro'),'intro shows'); ok(true,'');
 ok(/Unofficial|unofficial/.test(document.querySelector('.sv-intro-note')?.textContent||''),'disclaimer shown first');
 document.querySelector('.sv-skip').onclick({stopPropagation(){}});
 await until(()=>S.fsm.state==='title'&&vis('#sv-title'),'title shows');
 ok(window.__freeze===true,'frozen on title'); ok(window.__noTitan&&window.__noOdm&&window.__hideAvatar,'title flags');
 ok(document.querySelector('[data-act=continue]').hidden,'no Continue without a save');
 ok(body.className.includes('sv-hidehud'),'HUD hidden on title');
 // credits screen
 document.querySelector('[data-act=credits]').click(); await sleep(20); ok(vis('#sv-credits'),'credits open');
 ok(/Nico Maier/.test(document.querySelector('.sv-roll').textContent),'credits list Torhaus author'); ok(/Prime Slayer3D/.test(document.querySelector('.sv-roll').textContent),'credits list rig author');
 document.querySelector('#sv-credits .sv-back').onclick(); await until(()=>S.fsm.state==='title'&&vis('#sv-title'),'back to title');
 // creator
 document.querySelector('[data-act=new]').click(); await sleep(20); ok(vis('#sv-creator'),'creator open');
 const next=()=>document.querySelector('.sv-cr-next'); ok(next().disabled,'Continue disabled with empty name');
 const nm=document.querySelector('#sv-in-name'); nm.value='Sera'; nm.dispatch('input',{target:nm}); ok(!next().disabled,'enabled after name');
 document.querySelectorAll('.sv-chip').find(c=>c.textContent==='She / her').click(); next().click(); await sleep(10);
 ok(/Your blood/.test(document.querySelector('.sv-cr-body').textContent),'step 2 blood');
 document.querySelectorAll('.sv-card-opt').find(c=>/Scholar/.test(c.textContent)).click(); next().click(); await sleep(10);
 ok(next().disabled,'anchor name required');
 const an=document.querySelector('#sv-in-anchor'); an.value='Kael'; an.dispatch('input',{target:an});
 document.querySelectorAll('.sv-chip').find(c=>c.textContent==='He / him').click(); next().click(); await sleep(10);
 ok(next().textContent==='Begin','last step says Begin'); ok(/Sera/.test(document.querySelector('.sv-sum').textContent)&&/Kael/.test(document.querySelector('.sv-sum').textContent),'summary');
 document.querySelectorAll('.sv-card-opt').find(c=>/Veteran/.test(c.textContent)).click(); next().click();
 // new game: card -> narration
 await until(()=>S.fsm.state==='dialogue','opening narration'); ok(S.state.player&&S.state.player.name==='Sera'&&S.state.player.bloodline==='scholar'&&S.state.player.difficulty==='veteran'&&S.state.player.anchor.name==='Kael'&&S.state.player.anchor.gender==='m','player built from creator: '+JSON.stringify(S.state.player));
 ok(document.querySelector('#odm .lv').textContent==='SERA','HUD name set'); ok(window.__noOdm===true&&window.__noTitan===true,'ODM+Titan locked in story');
 ok(body.className.includes('sv-story')&&body.className.includes('sv-noodm'),'story body classes');
 await tapAll(); await until(()=>S.fsm.state==='play','play after narration'); ok(window.__freeze===false,'unfrozen in play');
 ok(S.quests.status('morning')==='active','main quest started'); ok(!UI.track.hidden&&/Talk to Kael/.test(UI.track.textContent),'tracker shows objective: '+UI.track.textContent);
 await sleep(60); ok(S.state.pos===null||true,'');
 // walk to anchor, talk with G
 const A=S.world.resolved.anchor_home; HP=[A.x+1,0,A.z+1]; await sleep(60);
 ok(!UI.talk.hidden&&/Talk to Kael/.test(UI.talk.textContent),'talk prompt near anchor: '+UI.talk.textContent);
 ok(document.querySelectorAll('.sv-mark').length>=1,'marker drawn');
 key('KeyG'); await until(()=>S.fsm.state==='dialogue','dialogue starts via G');
 ok(/There you are/.test(document.querySelector('.sv-line').textContent),'anchor line shown'); ok(document.querySelector('.sv-name').textContent==='Kael','speaker name');
 tapAll.pick=[0,1]; await tapAll(); await until(()=>S.fsm.state==='play','back to play');
 ok(S.quests.tracked().id==='bread','objective advanced'); ok(UI.track.textContent.includes('Marta'),'tracker updated'); ok(S.flag('temperament')==='dreamer','choice recorded');
 ok(S.quests.status('duty')==='active','side quest');
 // journal + pause
 key('KeyJ'); await sleep(20); ok(S.fsm.state==='journal'&&vis('#sv-journal'),'journal opens'); ok(/An ordinary morning/.test(document.querySelector('.sv-j-quests').textContent),'journal lists quest'); ok(/Kael/.test(document.querySelector('.sv-j-bonds').textContent),'journal lists bond');
 key('Escape'); await sleep(20); ok(S.fsm.state==='play'&&!vis('#sv-journal'),'journal closes');
 key('Escape'); await sleep(20); ok(S.fsm.state==='paused'&&vis('#sv-pause'),'pause opens'); ok(window.__freeze===true,'paused freezes');
 const pb=t=>document.querySelectorAll('.sv-pbtn').find(b=>b.textContent.startsWith(t));
 pb('Save game').click(); await sleep(30); ok(vis('#sv-saves'),'save screen'); document.querySelectorAll('.sv-slot').find(b=>/Slot 1/.test(b.textContent)).click(); await sleep(60);
 ok(!!(await S.save.read('slot1')),'manual save written');
 document.querySelector('#sv-saves .sv-back').onclick(); await sleep(20); pb('I’m stuck').click(); await sleep(30);
 ok(S.fsm.state==='play','stuck -> back in play'); const Mp=S.world.resolved.marta; ok(Math.hypot(HP[0]-Mp.x,HP[2]-Mp.z)<8,'teleported near Marta');
 // Marta, kids, hannes, anchor_gate
 await sleep(60); key('KeyG'); await until(()=>S.fsm.state==='dialogue','marta talk'); tapAll.pick=[0]; await tapAll(); await until(()=>S.fsm.state==='play','after marta');
 ok(S.quests.status('dreamers')==='active','dreamers started'); ok(S.quests.tracked().id==='gate','next objective gate');
 for(const [pid,pick] of [['kids',[0]],['hannes',[0]]]){const P=S.world.resolved[pid];HP=[P.x+1,0,P.z+1];await sleep(60);key('KeyG');await until(()=>S.fsm.state==='dialogue',pid+' talk');tapAll.pick=pick;await tapAll();await until(()=>S.fsm.state==='play','after '+pid)}
 ok(S.quests.status('dreamers')==='done'&&S.quests.status('duty')==='done','side quests done');
 const G2=S.world.resolved.anchor_gate; HP=[G2.x+1,0,G2.z+1]; await sleep(60); ok(!UI.talk.hidden,'gate anchor talk available');
 key('Enter'); await until(()=>S.fsm.state==='dialogue','anchor_gate'); tapAll.pick=[1]; await tapAll();
 // breach scene
 await until(()=>S.fsm.state==='cutscene'||S.fsm.state==='dialogue','breach begins');
 await until(()=>S.fsm.state==='dialogue'&&/ground jumps/.test(document.querySelector('.sv-line').textContent),'breach dialogue'); ok(document.body.className.includes('sv-letterbox'),'letterbox on');
 tapAll.pick=[0]; await tapAll(); await until(()=>S.fsm.state==='ending'&&vis('#sv-ending'),'ending card');
 ok(/take|took|seized|Seized/i.test(document.querySelector('.sv-end-lines').textContent),'ending recaps choice: '+document.querySelector('.sv-end-lines').textContent.slice(0,120));
 ok(S.flag('breach_choice')==='hand'&&S.flag('wall_view')==='beyond','flags persisted');
 // autosave exists; return to title; Continue
 const auto=await S.save.read('auto'); ok(auto&&auto.state.flags.prologue_part1_done,'autosave after breach');
 document.querySelectorAll('.sv-pbtn').find(b=>/Return to title/.test(b.textContent)).click(); await until(()=>S.fsm.state==='title'&&vis('#sv-title'),'title again');
 const cont=document.querySelector('[data-act=continue]'); ok(!cont.hidden,'Continue now visible'); ok(/Sera/.test(cont.querySelector('small').textContent),'continue shows save meta: '+cont.querySelector('small').textContent);
 S.reset(); cont.click(); await until(()=>S.fsm.state==='play'&&S.state.player&&S.state.player.name==='Sera','continue restores'); ok(S.flag('breach_choice')==='hand','flags restored after Continue'); ok(S.quests.status('morning')==='done','quests restored');
 // pause -> roam from title
 key('Escape'); await sleep(20); document.querySelectorAll('.sv-pbtn').find(b=>/Return to title/.test(b.textContent)).click(); await until(()=>S.fsm.state==='title','title 3');
 document.querySelector('[data-act=roam]').click(); await until(()=>S.fsm.state==='play'&&window.STORY.debug.mode==='roam','roam');
 ok(window.__noOdm===false&&window.__noTitan===false,'roam unlocks ODM+Titan'); ok(document.querySelector('#odm .lv').textContent==='LEVI','HUD name restored'); ok(body.className.includes('sv-sandbox'),'sandbox class'); ok(!UI.btns.hidden,'menu button visible in roam');
 console.log(`smoke test: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});

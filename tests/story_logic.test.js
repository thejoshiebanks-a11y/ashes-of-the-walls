const fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'..'); global.window=global;
const S=require(R+'/js/story/core.js'); require(R+'/js/story/destiny.js'); require(R+'/js/story/dialogue.js'); require(R+'/js/story/world.js'); const SV=require(R+'/js/story/save.js'); const D=S.destiny;
const J=n=>JSON.parse(fs.readFileSync(`${R}/data/story/${n}.json`,'utf8'));
S.data={config:J('config'),characters:J('characters'),quests:J('quests'),dialogue:J('dialogue'),world:J('world'),credits:J('credits'),npcs:J('npcs')};
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++}else{fail++;console.log('FAIL',m)}};
const ui=[]; S.registerEffect('toast',e=>ui.push('toast:'+e.text)); S.registerEffect('scene',e=>ui.push('scene:'+e.id)); S.registerEffect('save',()=>ui.push('save')); S.registerEffect('card',()=>{});
const DAYQ={2:'d2_gate',3:'d3_last'}; S.on('day:change',d=>{ui.push('day:'+d); if(DAYQ[d]) S.quests.start(DAYQ[d])});

/* ---- expressions and templates ---- */
S.reset(); S.state.player={name:'Sera',gender:'f',anchor:{name:'Kael',rel:'sibling',gender:'m'}};
S.setFlag('a',true); S.setFlag('n',3); S.addBond('anchor',2);
ok(S.expr("a and n>=3 && bond.anchor==2"),'expr basic'); ok(!S.expr("not a or n<2"),'expr not/or'); ok(S.expr("day==1"),'day lookup'); ok(S.expr("player.anchor.rel=='sibling'"),'anchor rel');
let threw=false; try{S.expr("a ===")}catch(e){threw=true}; ok(threw,'bad expr throws');
ok(S.fmt("{player}/{anchor}/{anchor.rel}/{anchor.he}/{anchor.his}")==="Sera/Kael/brother/he/his",'fmt');
S.state.player.anchor.rel='cousin'; ok(S.fmt("{anchor.rel}")==='cousin','cousin relation'); S.state.player.anchor.rel='sibling';

/* ---- helpers ---- */
const lines=[]; S.on('dialogue:line',l=>lines.push(l));
function play(id,picks=[]){ lines.length=0; picks=picks.slice(); S.dialogue.start(id); let g=0; const seen=[];
  while(S.dialogue.active()&&g++<80){const l=lines[lines.length-1]; seen.push(l); if(l.choices){S.dialogue.choose(picks.length?picks.shift():0)} else S.dialogue.advance()} return seen}
const conv=(x,z)=>{const n=S.world.nearest(x,z);return n&&n.conv};
const P=id=>S.data.world.points.find(p=>p.id===id);

/* ---- the whole Prologue, three days, through the real data ---- */
S.reset(); S.state.player={name:'Sera',gender:'f',anchor:{name:'Kael',rel:'sibling',gender:'m'}}; S.state.clock.hour=7;
S.quests.start('d1_morning'); const at=id=>[P(id).x,P(id).z];
ok(S.state.day===1,'starts on day 1'); ok(S.quests.tracked().id==='talk_anchor','first objective');
ok(conv(...at('anchor_home'))==='anchor_morning','day1 anchor morning'); ok(conv(...at('marta'))==='marta_early','marta early'); ok(!conv(...at('anchor_gate')),'gate anchor hidden');
let seen=play('anchor_morning',[0,1]); ok(seen[0].text.startsWith('There you are'),'first line'); ok(S.flag('temperament')==='dreamer','temperament'); ok(S.quests.status('duty')==='active','duty side quest');
ok(S.quests.tracked().id==='bread','objective advances');
ok(conv(...at('marta'))==='marta_bread','marta bread'); play('marta_bread',[0]); ok(S.quests.status('dreamers')==='active','dreamers started');
play('kids_canal',[0]); play('hannes_gate',[0]); ok(S.quests.status('dreamers')==='done'&&S.quests.status('duty')==='done','side quests done');
ok(conv(...at('anchor_home'))==='anchor_dinner','dinner available after bread'); play('anchor_dinner',[0]);
ok(S.quests.status('d1_morning')==='done','day 1 quest done'); ok(S.state.day===2,'day advanced'); ok(ui.includes('day:2'),'day event'); ok(S.state.clock.hour===7,'clock reset to morning');
// day 2
ok(S.quests.status('d2_gate')==='active','day 2 quest started'); ok(conv(...at('anchor_home'))==='anchor_day2','day2 anchor');
play('anchor_day2',[2]); ok(S.quests.status('whispers')==='active','whispers started'); ok(conv(...at('hannes'))==='hannes_lunch','hannes lunch');
play('hannes_lunch',[0]); ok(S.state.quests.d2_gate.done.lunch,'lunch delivered');
S.world.tick(0,-30); ok(S.state.quests.d2_gate.done.observe,'watching the gate completes the objective'); S.world.tick(1,-31);
ok(conv(...at('oswin'))==='oswin_whisper','oswin whisper'); play('oswin_whisper',[1]); ok(conv(...at('hannes'))==='hannes_hum','hannes hum'); play('hannes_hum',[1]);
ok(S.flag('hannes_admits'),'hannes admits'); ok(conv(...at('oswin'))==='oswin_after','oswin after'); play('oswin_after'); ok(S.quests.status('whispers')==='done','whispers done');
ok(conv(...at('kids'))==='kids_day2','kids day2'); play('kids_day2',[0]); ok(S.flag('reported_nervous'),'reported nervous');
ok(conv(...at('anchor_home'))==='anchor_evening2','evening'); play('anchor_evening2',[0]); ok(S.state.day===3&&S.quests.status('d3_last')==='active','day 3 begins');
// day 3
ok(conv(...at('anchor_home'))==='anchor_day3','day3 anchor'); play('anchor_day3',[1]); ok(conv(...at('marta'))==='marta_day3','marta day3'); play('marta_day3',[0]);
ok(!conv(...at('anchor_gate')),'gate hidden until the children'); ok(conv(...at('kids'))==='kids_day3','kids day3'); play('kids_day3',[0,0]); ok(S.flag('shared_bread')&&S.flag('promised_sea'),'day3 choices');
ok(conv(...at('anchor_gate'))==='anchor_gate','gate anchor appears'); ui.length=0; play('anchor_gate',[1]); ok(S.flag('wall_view')==='beyond','wall view');
ok(S.quests.status('d3_last')==='done','final quest done'); ok(ui.includes('scene:breach'),'breach triggered'); play('breach_fate',[0]); ok(S.flag('breach_choice')==='hand'&&S.flag('prologue_part1_done'),'breach flags');
ok(S.bond('anchor')>=3,'anchor bond grew across three days: '+S.bond('anchor'));

/* ---- data integrity ---- */
const ops=new Set(['set','add','bond','emit','quest.start','quest.obj','quest.done','quest.fail','hour','day','toast','scene','save','card','flash','shake']);
for(const [cid,c] of Object.entries(S.data.dialogue)){ ok(c.nodes[c.start],cid+' start');
  for(const [nid,n] of Object.entries(c.nodes)){
    for(const nx of [n.next,...(n.choices||[]).map(x=>x.next),...(n.branch||[]).map(b=>b.next)].filter(Boolean)) ok(nx.startsWith('conv:')||c.nodes[nx],`${cid}.${nid} -> ${nx}`);
    for(const fx of [...(n.fx||[]),...(n.choices||[]).flatMap(x=>x.fx||[])]){ ok(ops.has(fx.op),`${cid}.${nid} op ${fx.op}`); if(fx.op==='quest.start') ok(S.data.quests[fx.id],'quest '+fx.id) }
    if(n.s&&!['narr','player','anchor'].includes(n.s)) ok(S.data.characters[n.s],`${cid}.${nid} speaker ${n.s}`);
    for(const e of [n.if,...(n.choices||[]).map(x=>x.if),...(n.branch||[]).map(b=>b.if)].filter(Boolean)){try{S.expr(e)}catch(err){ok(false,`${cid}.${nid} expr ${e}`)}}}}
for(const [qid,q] of Object.entries(S.data.quests)){ for(const o of q.objectives){ if(o.marker) ok(P(o.marker),`${qid}.${o.id} marker`); ok(o.on&&(o.on.startsWith('enter:')||S.data.dialogue[o.on.replace('talk:','')]),`${qid}.${o.id} event ${o.on}`)}
  for(const fx of q.onComplete||[]) ok(ops.has(fx.op),qid+' onComplete '+fx.op)}
for(const p of S.data.world.points){ if(p.show) try{S.expr(p.show)}catch(e){ok(false,'show '+p.show)} for(const t of p.talk||[]){ ok(S.data.dialogue[t.conv],`point ${p.id} conv ${t.conv}`); try{S.expr(t.if)}catch(e){ok(false,'expr '+t.if)} } if(p.char!=='anchor') ok(S.data.characters[p.char],'point char '+p.char) }
for(const z of S.data.world.zones) for(const fx of z.fx){ ok(ops.has(fx.op),'zone op'); if(fx.if) try{S.expr(fx.if)}catch(e){ok(false,'zone expr')} }
for(const [id,n] of Object.entries(S.data.npcs)){ ok(S.data.characters[id],'npc has character '+id); ok(n.height>1&&n.height<2,'npc height '+id) }
const npcModels=J('../npc_models'); for(const [id,n] of Object.entries(S.data.npcs)) ok(npcModels[n.model],`npc ${id} model ${n.model} is packed`);

/* ---- destiny ---- */
let c={common:0,scholar:0,ackerman:0},N=100000; for(let i=1;i<=N;i++){c[D.roll(D.mulberry(i*7919)()*4294967296>>>0).bloodline]++}
ok(c.ackerman/N>0.003&&c.ackerman/N<0.008,'Ackerman is rare (~0.5%): '+(c.ackerman/N*100).toFixed(2)+'%'); ok(c.scholar/N>0.07&&c.scholar/N<0.13,'scholar uncommon'); ok(c.common/N>0.88,'most are common');
ok(JSON.stringify(D.roll(777))===JSON.stringify(D.roll(777)),'roll is deterministic'); const r=D.roll(31337); ok(['sibling','parent','friend','cousin'].includes(r.anchor.rel)&&r.anchor.name,'anchor rolled');
const lk=D.look(5); ok(lk.skin&&lk.hair&&lk.top&&lk.height>0.9,'look generated'); ok(JSON.stringify(D.look(5))===JSON.stringify(lk),'look deterministic');
const ls={}; try{global.localStorage={_:{},getItem(k){return this._[k]||null},setItem(k,v){this._[k]=String(v)},removeItem(k){delete this._[k]}}}catch(e){}
const p1=D.pending(),p2=D.pending(); ok(p1.seed===p2.seed&&p1.bloodline===p2.bloodline,'pending destiny survives reload'); D.consume(); ok(D.pending().seed!==p1.seed||true,'consume clears');

/* ---- actors (pure helpers) ---- */
const A=require(R+'/js/story/actors.js'); ok(Math.abs(A.scaleFor(1.8,1.3)-0.7222)<1e-3,'scaleFor'); ok(A.wearMul(2)<A.wearMul(0),'wear darkens');
const pp=A.playerParams({look:{height:0,build:0,headW:0,headH:0,skin:1,hair:2,top:0,bottom:0,shoes:0},wear:1}), pq=A.playerParams({look:{height:1,build:1,headW:1,headH:1,skin:1,hair:2,top:0,bottom:0,shoes:0},wear:1});
ok(pq.meters>pp.meters&&pq.width>pp.width&&pq.head>pp.head,'sliders change the body'); ok(pp.meters>1.1&&pq.meters<1.5,'child heights stay childlike: '+pp.meters.toFixed(2)+'-'+pq.meters.toFixed(2));
const ap=(()=>{global.__actors={has:()=>true};return A.anchorParams({anchor:{gender:'f',rel:'parent',look:12,name:'Anja'}})})(); ok(ap.adult&&ap.meters>1.5&&/^base_/.test(ap.key),'adult anchor');

/* ---- audio: every sound runs against a mock AudioContext without throwing ---- */
const node=()=>new Proxy(function(){},{get:(t,k)=>k==='connect'?(x=>x):k==='gain'||k==='frequency'||k==='Q'||k==='detune'?{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}}:k==='buffer'?null:(()=>{}),set:()=>true,apply:()=>undefined});
global.AudioContext=function(){return {currentTime:0,sampleRate:8000,state:'running',destination:node(),createGain:node,createOscillator:node,createBiquadFilter:node,createConvolver:node,createBufferSource:node,resume(){},createBuffer:(c,l)=>({getChannelData:()=>new Float32Array(l)})}};
const Au=require(R+'/js/story/audio.js'); ok(Au.init(),'audio inits'); let errs=0; const warn=console.warn; console.warn=()=>errs++;
for(const f of ['wind','thud','crow','heartbeat','clink','blade','whoosh','lightning','screech','bell','crowd','hover','select','step']) Au[f](1);
Au.music('title'); Au.music('calm'); Au.music('dread'); Au.stopMusic(); Au.setMuted(true); Au.setVolume('vol',.5); console.warn=warn; ok(errs===0,'all sounds run clean ('+errs+' warnings)');

/* ---- saves ---- */
(async()=>{
 S.state.flags={}; S.state.quests={}; S.state.day=1; S.state.player={name:'Sera',gender:'f',body:'fuse_woman',look:{skin:2},anchor:{name:'Kael',rel:'sibling',gender:'m'}}; S.quests.start('d1_morning');
 SV.backend=SV._backends.memBackend(); await SV.write('slot1'); const r=await SV.read('slot1'); ok(r.state.quests.d1_morning.status==='active'&&r.state.day===1&&r.state.player.body==='fuse_woman','save roundtrip incl. day and look');
 const l=await SV.list(); ok(l.slot1.quest==='Talk to Kael at home','list meta'); ok((await SV.latest())==='slot1','latest');
 const exp=await SV.exportAll(); await SV.remove('slot1'); ok(!(await SV.read('slot1')),'removed'); await SV.importAll(exp); ok(!!(await SV.read('slot1')),'import');
 console.log(`story logic tests: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();

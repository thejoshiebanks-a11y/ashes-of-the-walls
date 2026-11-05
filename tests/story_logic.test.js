const fs=require('fs'),path=require('path');
const R=require('path').resolve(__dirname,'..');
const S=require(R+'/js/story/core.js'); require(R+'/js/story/dialogue.js'); require(R+'/js/story/world.js'); const SV=require(R+'/js/story/save.js');
const J=n=>JSON.parse(fs.readFileSync(`${R}/data/story/${n}.json`,'utf8'));
S.data={config:J('config'),characters:J('characters'),quests:J('quests'),dialogue:J('dialogue'),world:J('world'),credits:J('credits')};
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++}else{fail++;console.log('FAIL',m)}};
const ui=[]; S.registerEffect('toast',e=>ui.push('toast:'+e.text)); S.registerEffect('scene',e=>ui.push('scene:'+e.id)); S.registerEffect('save',e=>ui.push('save'));

// ---- expressions
S.reset(); S.state.player={name:'Sera',gender:'f',anchor:{name:'Kael',rel:'sibling',gender:'m'}};
S.setFlag('a',true); S.setFlag('n',3); S.addBond('anchor',2);
ok(S.expr("a and n>=3 && bond.anchor==2"),'expr basic'); ok(!S.expr("not a or n<2"),'expr not/or');
ok(S.expr("player.anchor.rel=='sibling'"),'expr player.anchor.rel'); ok(S.expr("missing_flag==false"),'unset flag false');
ok(S.expr("(a or b) and not c"),'parens'); let threw=false; try{S.expr("a ===")}catch(e){threw=true}; ok(threw,'bad expr throws');
ok(S.fmt("{player} and {anchor} ({anchor.rel}, {anchor.he}/{anchor.his}) {player.his}")==="Sera and Kael (brother, he/his) her",'fmt: '+S.fmt("{player} and {anchor} ({anchor.rel}, {anchor.he}/{anchor.his}) {player.his}"));

// ---- play a conversation helper
const lines=[]; S.on('dialogue:line',l=>lines.push(l));
function play(id,picks=[]){ lines.length=0; S.dialogue.start(id); let g=0; const seen=[];
  while(S.dialogue.active()&&g++<60){ const l=lines[lines.length-1]; seen.push(l); if(l.choices){ const p=picks.shift(); if(p===undefined){ok(false,'ran out of picks in '+id+' at '+l.text);break} S.dialogue.choose(p)} else S.dialogue.advance() } return seen }

// ---- full prologue through the real data
S.reset(); S.state.player={name:'Sera',gender:'f',anchor:{name:'Kael',rel:'sibling',gender:'m'}};
S.quests.start('morning');
ok(S.quests.tracked().id==='talk_anchor','first objective');
let w=S.world.nearest(-174,-177); ok(w&&w.conv==='anchor_morning','anchor point conv '+JSON.stringify(w&&w.conv));
ok(S.world.nearest(-66,-83)&&S.world.nearest(-66,-83).conv==='marta_early','marta early before anchor');
ok(!S.world.nearest(-5,-46),'anchor_gate hidden early');
let seen=play('anchor_morning',[0,1]);
ok(seen[0].text.startsWith('There you are'),'first line'); ok(seen.some(l=>/Sera/.test(l.text)),'sibling branch used {player}');
ok(S.flag('temperament')==='dreamer','temperament set'); ok(S.bond('anchor')===1+1+0,'bond anchor '+S.bond('anchor'));
ok(S.quests.status('duty')==='active','side quest started by dialogue');
ok(S.state.quests.morning.done.talk_anchor,'objective auto-complete via talk event');
ok(S.quests.tracked().id==='bread','next objective'); ok(ui.includes('toast:Follow the marker to the Old Square.'),'toast effect fired');
ok(S.world.nearest(-66,-83).conv==='marta_bread','marta bread available after anchor');
seen=play('marta_bread',[0]); ok(seen.some(l=>/Kael must have been kind/.test(l.text)),'bond branch (bond>=1): '+seen.map(l=>l.text).join('|').slice(0,200));
ok(S.quests.status('dreamers')==='active','dreamers started'); ok(S.flag('marta_kind'),'marta kind');
ok(S.world.nearest(-66,-83).conv==='marta_idle','marta idle after');
ok(S.world.nearest(-5,-46)&&S.world.nearest(-5,-46).conv==='anchor_gate','anchor_gate visible after bread');
seen=play('kids_canal',[0]); ok(S.flag('kids_ally'),'kids ally'); ok(S.quests.status('dreamers')==='done','side quest done');
seen=play('hannes_gate',[0]); ok(S.flag('hannes_doubt'),'hannes doubt'); ok(S.quests.status('duty')==='done','duty done');
ui.length=0; seen=play('anchor_gate',[1]); ok(S.flag('wall_view')==='beyond','wall view');
ok(S.quests.status('morning')==='done','main quest done'); ok(ui.includes('scene:breach'),'breach scene triggered by quest completion');
seen=play('breach_fate',[0]); ok(S.flag('breach_choice')==='hand','breach choice'); ok(S.flag('prologue_part1_done'),'part1 done'); ok(ui.includes('save'),'save effect');
ok(seen.some(l=>l.choices&&/Seize Kael/.test(l.choices[0].text)),'choice text templated');
ok(S.flag('talked_anchor_gate')===1,'talked counter');

// zones
S.state.flags={}; let hits=0; S.on('enter:gate_square',()=>hits++); S.world.tick(0,-38); S.world.tick(1,-39); ok(hits===1,'zone fires once');

// ---- all conversations reference valid nodes/speakers/effects
const ops=new Set(['set','add','bond','emit','quest.start','quest.obj','quest.done','quest.fail','hour','toast','scene','save','card']);
for(const [cid,c] of Object.entries(S.data.dialogue)){
  ok(c.nodes[c.start],cid+' start exists');
  for(const [nid,n] of Object.entries(c.nodes)){
    const nexts=[n.next,...(n.choices||[]).map(x=>x.next),...(n.branch||[]).map(b=>b.next)].filter(Boolean);
    for(const nx of nexts) ok(nx.startsWith('conv:')||c.nodes[nx],`${cid}.${nid} -> ${nx} missing`);
    for(const fx of [...(n.fx||[]),...(n.choices||[]).flatMap(x=>x.fx||[])]) ok(ops.has(fx.op),`${cid}.${nid} unknown op ${fx.op}`);
    if(n.s&&!['narr','player','anchor'].includes(n.s)) ok(S.data.characters[n.s],`${cid}.${nid} unknown speaker ${n.s}`);
    for(const e of [n.if,...(n.choices||[]).map(x=>x.if),...(n.branch||[]).map(b=>b.if)].filter(Boolean)) { try{S.expr(e)}catch(err){ok(false,`${cid}.${nid} bad expr ${e}`)} }
  }
}
for(const [qid,q] of Object.entries(S.data.quests)) for(const o of q.objectives){ if(o.marker) ok(S.data.world.points.some(p=>p.id===o.marker),`${qid}.${o.id} marker ${o.marker} missing`); }
for(const p of S.data.world.points){ for(const t of p.talk||[]){ ok(S.data.dialogue[t.conv],`point ${p.id} conv ${t.conv} missing`); try{S.expr(t.if)}catch(e){ok(false,'bad expr '+t.if)} } if(p.char&&p.char!=='anchor') ok(S.data.characters[p.char],'point char '+p.char) }

// ---- saves: memory, localStorage-like, fake IndexedDB
(async()=>{
 S.state.flags={}; S.state.quests={}; S.quests.start('morning');
 const mem=SV._backends.memBackend(); SV.backend=mem;
 await SV.write('slot1'); const r=await SV.read('slot1'); ok(r.state.quests.morning.status==='active','save roundtrip'); ok(r.name==='Sera','save meta name');
 const l=await SV.list(); ok(l.slot1&&l.slot1.quest==='Talk to Kael at home','list meta '+(l.slot1&&l.slot1.quest));
 ok((await SV.latest())==='slot1','latest');
 const exp=await SV.exportAll(); await SV.remove('slot1'); ok(!(await SV.read('slot1')),'removed'); await SV.importAll(exp); ok(!!(await SV.read('slot1')),'import restore');
 let bad=false; try{await SV.importAll('{"game":"x"}')}catch(e){bad=true}; ok(bad,'import rejects foreign file');
 // fake IDB
 const store=new Map();
 const req=(fn)=>{const r={};setTimeout(()=>{try{r.result=fn();r.onsuccess&&r.onsuccess()}catch(e){r.error=e;r.onerror&&r.onerror()}},0);return r};
 const fakeIDB={open:()=>{const r={};setTimeout(()=>{r.result={createObjectStore(){},transaction:()=>({objectStore:()=>({get:k=>req(()=>store.get(k)),put:(v,k)=>req(()=>{store.set(k,v);return k}),delete:k=>req(()=>{store.delete(k)}),getAllKeys:()=>req(()=>[...store.keys()])})})};r.onupgradeneeded&&r.onupgradeneeded();r.onsuccess&&r.onsuccess()},0);return r}};
 const name=await SV.init({indexedDB:fakeIDB}); ok(name==='indexeddb','picks indexeddb: '+name);
 await SV.write('auto'); ok((await SV.read('auto')).name==='Sera','idb roundtrip'); ok(store.has('auto'),'idb stored');
 const n2=await SV.init({}); ok(n2==='memory','falls back to memory');
 // load restores state
 S.load((await SV.read('auto')?? {state:{}}).state||{}); 
 console.log(`story logic tests: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})();

#!/usr/bin/env node
/* Applies the small, exact-match hooks the new locomotion + camera need to js/game.js. Safe to run twice (already-applied hooks are skipped).
 * Every hook is inert unless the story layer sets it, so Levi / the free-roam mode behave exactly as before.
 *   node tools/apply_game_patches.js [path/to/js/game.js] */
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'js', 'game.js');
let s = fs.readFileSync(file, 'utf8'); const orig = s; let applied = 0, skipped = 0, failed = 0;
const P = [
 ['speed map', 'tv=[wd[0]*sp,0,wd[2]*sp]', 'tv=[wd[0]*(window.__spdMap?window.__spdMap(sp):sp),0,wd[2]*(window.__spdMap?window.__spdMap(sp):sp)]', 'window.__spdMap'],
 ['gait hook', "if(sp>3.4)return['L:Sprint'", "{const r_=window.__actorClip&&window.__actorClip(a,sp);if(r_)return r_}\n if(sp>3.4)return['L:Sprint'", 'window.__actorClip'],
 ['playback rate follows speed', 'a.an.play(cn,true,rt,.25);', 'a.an.play(cn,true,rt,.25);a.an.rate=rt;', 'a.an.rate=rt'],
 ['expose AN', 'AN={meta:D.meta,i16:new Int16Array(bin),pi:{}};', 'AN={meta:D.meta,i16:new Int16Array(bin),pi:{}};window.__AN=AN;', 'window.__AN=AN'],
 ['camera distance', 'dist=(grab?5.4:2.9)+Math.min(2.8,sp*.05),rt=[-Math.cos(yaw),0,Math.sin(yaw)],pv=[H[0],H[1]+.3,H[2]];', 'dist=((grab?5.4:2.9)+Math.min(2.8,sp*.05))*(window.__camK||1),rt=[-Math.cos(yaw),0,Math.sin(yaw)],pv=[H[0],H[1]+(window.__camH!==undefined?window.__camH:.3),H[2]];', 'window.__camK||1'],
 ['camera offset', 'want=[pv[0]-d[0]*dist+rt[0]*.32,pv[1]-d[1]*dist+.28,pv[2]-d[2]*dist+rt[2]*.32];', 'want=[pv[0]-d[0]*dist+rt[0]*.32*(window.__camK||1),pv[1]-d[1]*dist+.28*(window.__camK||1),pv[2]-d[2]*dist+rt[2]*.32*(window.__camK||1)];', '.28*(window.__camK||1)'],
 ['camera clearance', 'tm=Math.max(.45,tm);', 'tm=Math.max(.45*(window.__camK||1),tm);', 'tm=Math.max(.45*(window.__camK||1)'],
 ['camera floor', '{let g=gh(cam.pos[0],cam.pos[2])+.55;', '{let g=gh(cam.pos[0],cam.pos[2])+.55*(window.__camK||1);', '+.55*(window.__camK||1)'],
];
for (const [name, a, b, mark] of P) {
  if (s.includes(mark)) { skipped++; console.log('  already applied: ' + name); continue; }
  const n = s.split(a).length - 1;
  if (n !== 1) { failed++; console.log('  !! could not apply "' + name + '" (found ' + n + ' matches) — your game.js differs; send me that line'); continue; }
  s = s.replace(a, () => b); applied++; console.log('  applied: ' + name);
}
if (s !== orig) { fs.writeFileSync(file + '.bak', orig); fs.writeFileSync(file, s); }
console.log(applied + ' applied, ' + skipped + ' already there, ' + failed + ' failed' + (s !== orig ? ' (backup: ' + path.basename(file) + '.bak)' : ''));
// children NPCs: half their height (only while they are still at the old size, so re-running does nothing)
try {
  const np = path.join(path.dirname(file), '..', 'data', 'story', 'npcs.json'), n = JSON.parse(fs.readFileSync(np, 'utf8')); let ch = 0;
  for (const k of ['eren', 'armin', 'mikasa']) if (n[k] && n[k].height > 1) { n[k].height = Math.round(n[k].height / 2 * 1000) / 1000; ch++; }
  if (ch) { fs.writeFileSync(np, JSON.stringify(n, null, 1)); console.log('  halved the height of ' + ch + ' children in data/story/npcs.json'); } else console.log('  children already at half height');
} catch (e) { console.log('  !! npcs.json not updated: ' + e.message); failed++; }
process.exit(failed ? 1 : 0);

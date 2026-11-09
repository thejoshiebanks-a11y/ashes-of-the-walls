/* Page code for the thumbnail harness (run through tools/thumbs/live.js). Prepares a neutral grey studio, hides the creator UI and defines window.__th(o). */
const D = STORY.debug, ACT = D.ACT, G = D.G, ST = STORY.studio, S = STORY, C = S.creatorKit;
window.__actors.clear = () => {}; window.__noTitan = true; window.__noOdm = true; window.__hideAvatar = true;
const st = document.createElement('style'); st.textContent = '[class*="op-"]{display:none!important}#sv-studio{display:none!important}.cr-root{display:none!important}'; document.head.appendChild(st);
let sp, gy; for (let i = 0; i < 120; i++) { try { sp = G.snap(-176.5, -186.5); gy = G.gh(sp.x, sp.z); break; } catch (e) { await new Promise(r => setTimeout(r, 1000)); } }
G.teleport(sp.x + 14, sp.z + 14, 0, 0.1);
const draft = { name: 'T', gender: 'f', body: 'base_isabel', voice: 'steady', difficulty: 'soldier', wear: 1, look: { skin: 2, hair: -1, top: -1, bottom: -1, shoes: -1, fk: null, hk: null, hide: [], height: .5, build: .5, eye: 0, scar: 0, face: {}, body: {}, cust: {} } };
window.__draft = draft; const dest = S.destiny.pending();
const bp = () => Object.assign({}, draft, { look: JSON.parse(JSON.stringify(draft.look)), bloodline: dest.bloodline, family: dest.family, anchor: dest.anchor });
ST.enter({ x: sp.x, z: sp.z, gy, yaw: Math.PI, h: ACT.playerParams(bp()).meters });
window.__mk = () => { const pl = bp(); if (!ACT.player) ACT.spawnPlayer(pl, sp.x, sp.z, Math.PI, false); else ACT.updatePlayer(pl); ST.setHeight(ACT.playerParams(pl).meters); };
const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 22, 2, 32, 30, 48); gr.addColorStop(0, '#9aa1a8'); gr.addColorStop(1, '#4b5157'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
window.__studio.bgCanvas = cv; window.__studio.lockBg = true; window.__studio.bgVer = 99; window.__studio.bgSx = 0; window.__studio.bgPar = 0; window.__studio.sunC = [1.5, 1.32, 1.12]; window.__studio.ambS = [.4, .42, .5]; window.__studio.rim = .25;
window.__th = o => {
  const L = draft.look; draft.body = 'base_' + o.base; draft.gender = o.base === 'furlan' || o.base === 'loud' ? 'm' : 'f';
  Object.assign(L, { fk: o.fk, hk: o.hk, skin: o.skin == null ? 2 : o.skin, hair: -1, top: -1, bottom: -1, shoes: -1, height: .5, build: .5, hide: [], cust: {}, face: o.face || {}, body: {} });
  for (const k in (o.bod || {})) { if (k === 'height' || k === 'build') L[k] = Math.max(0, Math.min(1, .5 + o.bod[k] / 2)); else L.body[k] = o.bod[k]; }
  window.__mk(); ST.inset(0); ST.focus(o.view, { yaw: o.yaw, ofs: 0, d: o.d, th: o.th, p: o.p }); ST.snap();
};
await S.ui.fadeTo(false, 10);
return 'setup ok';

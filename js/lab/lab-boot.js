/* Character Lab boot: the same data/pack loading as js/boot.js, but it only starts the engine + game (no story layer),
   adds the new character models from assets/teen/, then starts js/lab/lab.js. Nothing in js/boot.js is changed. */
(function () {
  'use strict';
  const VERSION = '0.8.0-lab';
  window.__APP_VERSION = VERSION;
  const $ = id => document.getElementById(id);
  const say = (m, p) => { const e = $('msg'); if (e) e.textContent = m; const b = $('bar'); if (b && b.firstElementChild && p != null) b.firstElementChild.style.width = (p * 100) + '%'; };
  const fail = e => { console.error(e); say('Could not start: ' + (e && e.message || e), null); window.__labError = String(e && e.message || e); };
  const U = u => u + '?v=' + VERSION;
  const fetchRaw = window.fetch.bind(window);
  const getJSON = async u => { const r = await fetchRaw(U(u)); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };
  const getBytes = async u => { const r = await fetchRaw(U(u)); if (!r.ok) throw new Error(u + ' ' + r.status); return new Uint8Array(await r.arrayBuffer()); };
  async function getPack(url) {
    const buf = await (await fetchRaw(U(url))).arrayBuffer();
    const hl = new DataView(buf).getUint32(0, true);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
    const base = 4 + hl, out = {};
    for (const k in hdr) out[k] = new Uint8Array(buf, base + hdr[k][0], hdr[k][1]);
    return out;
  }
  async function boot() {
    say('Reading data files…', 0.02);
    const [district, models, texPack, modelPack, distBin] = await Promise.all([
      getJSON('data/district.json'), getJSON('data/models.json'), getPack('assets/textures.pack'), getPack('assets/models.pack'),
      fetchRaw(U('assets/district.bin')).then(r => r.arrayBuffer())]);
    window.__PACK_JSON = district;
    window.__packBuf = async () => new Response(new Blob([distBin]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
    window.fetch = function (u, o) {
      const k = String(u).replace(/^\.\//, ''), b = texPack[k];
      if (b) return Promise.resolve(new Response(new Blob([b], { type: k.endsWith('.png') ? 'image/png' : k.endsWith('.webp') ? 'image/webp' : 'image/jpeg' })));
      return fetchRaw(u, o);
    };
    window.__ANIMS = { meta: models.anims.meta, bin: modelPack['anims.bin'] };
    window.__MODELS = {};
    for (const k in models.models) { const m = models.models[k], tex = []; for (let i = 0; i < m.ntex; i++) tex.push(modelPack[k + '.t' + i]); window.__MODELS[k] = { meta: m.meta, bin: modelPack[k + '.bin'], tex }; }
    say('Reading the character…', 0.2);
    const cat = await getJSON('assets/teen/characters.json');            // which character files exist
    window.__LAB = { catalog: cat, info: {} };
    for (const c of cat.models) {
      const [meta, bin, info] = await Promise.all([getJSON('assets/teen/' + c + '.meta.json'), getBytes('assets/teen/' + c + '.bin'), getJSON('assets/teen/' + c + '.info.json')]);
      const tex = []; for (let i = 0; i < (info.tex || 0); i++) tex.push(await getBytes('assets/teen/' + c + '.t' + i + '.webp'));
      window.__MODELS[c] = { meta, bin, tex }; window.__LAB.info[c] = info;
    }
    for (const f of ['js/engine.js', 'js/viewer.js', 'js/game.js', 'js/lab/lab.js']) {
      if (f === 'js/game.js') {   // one-line runtime patch (game.js on disk is NOT modified): actor clip speed/thresholds are divided by actor.speedK so a small character walks without foot-sliding
        const src = await (await fetchRaw(U(f))).text(), key = 'function actorClip(a,sp){';
        if (src.indexOf(key) < 0) throw new Error('game.js: actorClip not found');
        await new Promise(res => { const s = document.createElement('script'); s.textContent = src.replace(key, key + 'sp/=a.speedK||1;') + '\n//# sourceURL=js/game.js'; document.body.appendChild(s); res(); });
        continue;
      }
      say('Loading ' + f.split('/').pop() + '…', 0.3);
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = U(f); s.onload = res; s.onerror = () => rej(new Error('failed to load ' + f)); document.body.appendChild(s); });
    }
  }
  boot().catch(fail);
})();

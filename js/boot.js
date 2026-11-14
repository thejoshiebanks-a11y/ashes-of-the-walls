/* Ashes of the Walls — boot loader
 * Fetches data + binary packs, exposes them under the same globals the engine
 * already expects, then starts engine.js -> viewer.js -> game.js in order. */
(function () {
  'use strict';
  const VERSION = '0.9.7';
  window.__APP_VERSION = VERSION;            // bump on every release to bust the GitHub Pages cache
  const $ = id => document.getElementById(id);
  const say = (m, p) => {
    const e = $('msg'); if (e) e.textContent = m;
    const b = $('bar'); if (b && b.firstElementChild && p != null) b.firstElementChild.style.width = (p * 100) + '%';
  };
  const fail = e => {
    console.error(e);
    say('Could not start: ' + (e && e.message || e), null);
    const p = document.querySelector('#load p'); if (p) p.textContent = 'Error';
  };
  const U = u => u + '?v=' + VERSION;

  // Pack format: [u32 headerLen][JSON header {name:[offset,length]}][bytes]
  async function getPack(url) {
    const buf = await (await fetchRaw(U(url))).arrayBuffer();
    const hl = new DataView(buf).getUint32(0, true);
    const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
    const base = 4 + hl, out = {};
    for (const k in hdr) out[k] = new Uint8Array(buf, base + hdr[k][0], hdr[k][1]);
    return out;
  }
  const fetchRaw = window.fetch.bind(window);
  const getJSON = async u => (await fetchRaw(U(u))).json();

  async function boot() {
    say('Reading data files…', 0.01);
    const [district, models, texPack, modelPack, distBin] = await Promise.all([
      getJSON('data/district.json'), getJSON('data/models.json'),
      getPack('assets/textures.pack'), getPack('assets/models.pack'),
      fetchRaw(U('assets/district.bin')).then(r => r.arrayBuffer())
    ]);

    // engine reads these globals
    window.__PACK_JSON = district;
    window.__packBuf = async () => {
      const ds = new Response(new Blob([distBin]).stream().pipeThrough(new DecompressionStream('deflate')));
      return await ds.arrayBuffer();
    };
    // textures are served to the engine's fetch('tex/…') calls straight from the pack
    window.fetch = function (u, o) {
      const k = String(u).replace(/^\.\//, '');
      const b = texPack[k];
      if (b) {
        const m = k.endsWith('.png') ? 'image/png' : k.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        return Promise.resolve(new Response(new Blob([b], { type: m })));
      }
      return fetchRaw(u, o);
    };
    window.__ANIMS = { meta: models.anims.meta, bin: modelPack['anims.bin'] };
    window.__MODELS = {};
    for (const k in models.models) {
      const m = models.models[k], tex = [];
      for (let i = 0; i < m.ntex; i++) tex.push(modelPack[k + '.t' + i]);
      window.__MODELS[k] = { meta: m.meta, bin: modelPack[k + '.bin'], tex };
    }

    // scripts must run in order: engine -> viewer (starts E.load) -> game -> story layer
    const SCRIPTS = ['js/engine.js', 'js/post.js', 'js/quality.js', 'js/viewer.js', 'js/game.js',
      'js/story/core.js', 'js/story/audio.js', 'js/story/destiny.js', 'js/story/dialogue.js', 'js/story/world.js', 'js/story/save.js', 'js/story/teen.js', 'js/story/actors.js', 'js/story/map.js', 'js/story/ui.js', 'js/story/creator.js', 'js/story/fx.js', 'js/story/opening.js', 'js/story/menu.js', 'js/story/main.js'];
    for (const f of SCRIPTS) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = U(f); s.onload = res; s.onerror = () => rej(new Error('failed to load ' + f));
        document.body.appendChild(s);
      });
    }
  }
  boot().catch(fail);
})();

/* Ashes of the Walls — destiny: the parts of your life the registry decides for you.
   Bloodline, family and Anchor are rolled by the system, never chosen. Weights follow the world of the story:
   most people in the walls are ordinary Eldians; scholarly families are uncommon; an Ackerman is extremely rare. */
(function (root) {
  'use strict';
  const S = root.STORY, D = S.destiny = {};

  D.BLOODLINES = [                                   // weights sum to 1000
    { id: 'common', w: 897, name: 'Eldian of the walls', text: 'An ordinary family of Wall Maria. Nothing in your blood sets you apart.' },
    { id: 'scholar', w: 98, name: 'A scholar’s child', text: 'Your family kept books and asked questions. You read early, and you notice things.' },
    { id: 'ackerman', w: 5, name: 'Ackerman', text: 'An old, hunted bloodline. It sleeps in you until something wakes it.' }];        // 0.5%: about 1 in 200
  D.FAMILIES = [
    { id: 'farm', w: 26, name: 'Farm family', text: 'Your people worked the fields outside the Shiganshina walls.' },
    { id: 'baker', w: 12, name: 'Bakers and cooks', text: 'You grew up with flour on your hands.' },
    { id: 'merchant', w: 18, name: 'Merchants', text: 'Your family trades at the canal market.' },
    { id: 'soldier', w: 14, name: 'A Garrison family', text: 'Someone in your house wears the rose of the Garrison.' },
    { id: 'craft', w: 16, name: 'Craftsmen', text: 'Carpenters, smiths and tanners: your hands were taught early.' },
    { id: 'orphan', w: 6, name: 'Taken in by neighbours', text: 'You have no parents on record. The street raised you.' },
    { id: 'healer', w: 8, name: 'A healer’s household', text: 'Your family tends the sick of the district.' }];
  D.RELATIONS = [{ id: 'sibling', w: 38 }, { id: 'friend', w: 30 }, { id: 'parent', w: 20 }, { id: 'cousin', w: 12 }];
  D.NAMES = { f: ['Lena', 'Anja', 'Elsa', 'Greta', 'Liese', 'Nora', 'Mara', 'Hilde', 'Ilka', 'Rosa', 'Britta', 'Wilma'], m: ['Tobias', 'Mirek', 'Henrik', 'Jonas', 'Kasper', 'Oskar', 'Lukas', 'Anselm', 'Bruno', 'Emil', 'Falk', 'Gerd'] };

  D.mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  D.pick = (list, rnd) => { const tot = list.reduce((s, x) => s + x.w, 0); let r = rnd() * tot; for (const x of list) { r -= x.w; if (r < 0) return x; } return list[list.length - 1]; };
  D.seed = () => { try { const a = new Uint32Array(1); (root.crypto || {}).getRandomValues(a); return a[0]; } catch (e) { return (Math.random() * 4294967296) >>> 0; } };

  /* roll(seed) is deterministic so a refreshed page cannot re-roll the same file */
  D.roll = function (seed) {
    const rnd = D.mulberry(seed), bl = D.pick(D.BLOODLINES, rnd), fam = D.pick(D.FAMILIES, rnd), rel = D.pick(D.RELATIONS, rnd).id;
    const ag = rnd() < 0.5 ? 'f' : 'm', anchor = { rel, gender: ag, name: D.NAMES[ag][Math.floor(rnd() * D.NAMES[ag].length)], look: Math.floor(rnd() * 1e9) };
    if (rel === 'parent' && rnd() < 0.5) anchor.name = anchor.name; // parents may share the surname feel; kept simple
    return { seed, bloodline: bl.id, family: fam.id, anchor };
  };
  /* persisted until the file is stamped, so cancelling or reloading cannot be used to fish for a rare bloodline */
  D.pending = function () {
    let seed = null;
    try { seed = parseInt(root.localStorage.getItem('ashes_destiny'), 10); } catch (e) {}
    if (!seed || isNaN(seed)) { seed = D.seed(); try { root.localStorage.setItem('ashes_destiny', String(seed)); } catch (e) {} }
    return D.roll(seed);
  };
  D.consume = () => { try { root.localStorage.removeItem('ashes_destiny'); } catch (e) {} };
  D.info = id => D.BLOODLINES.find(b => b.id === id) || D.BLOODLINES[0];
  D.family = id => D.FAMILIES.find(f => f.id === id) || D.FAMILIES[0];

  /* ---- appearance: deterministic looks for any seed (Anchor, crowds, extras) ---- */
  D.SKIN = [[1.0, 0.93, 0.88], [0.93, 0.8, 0.7], [0.82, 0.66, 0.54], [0.7, 0.54, 0.43], [0.58, 0.43, 0.35], [0.46, 0.34, 0.29]];
  D.HAIR = [[0.1, 0.08, 0.07], [0.22, 0.14, 0.09], [0.36, 0.22, 0.12], [0.5, 0.33, 0.17], [0.62, 0.38, 0.16], [0.72, 0.52, 0.26], [0.82, 0.68, 0.4], [0.55, 0.52, 0.5], [0.78, 0.78, 0.78], [0.45, 0.16, 0.1]];
  D.TOP = [[0.55, 0.42, 0.3], [0.45, 0.5, 0.4], [0.62, 0.58, 0.48], [0.4, 0.45, 0.55], [0.55, 0.3, 0.26], [0.35, 0.32, 0.3], [0.7, 0.62, 0.45]];
  D.BOTTOM = [[0.28, 0.24, 0.2], [0.35, 0.3, 0.25], [0.22, 0.25, 0.3], [0.3, 0.3, 0.26]];
  D.SHOES = [[0.2, 0.14, 0.1], [0.3, 0.2, 0.12], [0.14, 0.12, 0.12]];
  D.look = function (seed, o) {
    o = o || {}; const r = D.mulberry(seed);
    const take = list => list[Math.floor(r() * list.length)];
    return { skin: o.skin || take(D.SKIN), hair: o.hair || take(D.HAIR), top: o.top || take(D.TOP), bottom: o.bottom || take(D.BOTTOM), shoes: o.shoes || take(D.SHOES),
             height: o.height || 0.96 + r() * 0.1, width: o.width || 0.94 + r() * 0.12, headW: 0.94 + r() * 0.12, headH: 0.94 + r() * 0.12 };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);

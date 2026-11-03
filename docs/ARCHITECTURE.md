# Architecture (as built, v0.1.0)

The blueprint assumed Three.js + Rapier. The game actually runs on a custom WebGL2 engine with its own
grid-based collision and rope solver. We keep it. Where the blueprint and this file disagree, this file wins.

## Boot order
boot.js fetches data/district.json, data/models.json, assets/textures.pack, assets/models.pack,
assets/district.bin, sets the globals the engine expects, then loads engine.js, viewer.js, game.js in order.

| Global | Source | Used by |
|---|---|---|
| window.__PACK_JSON | data/district.json | engine (district layout, materials, collide grid) |
| window.__packBuf() | assets/district.bin (deflate) | engine (vertex/index/instance buffers) |
| fetch('tex/…') | assets/textures.pack | engine (served from memory) |
| window.__MODELS | assets/models.pack + data/models.json | game (skinned Levi, Titan) |
| window.__ANIMS | assets/models.pack (anims.bin) | game (Mixamo-derived clips) |

## Pack format (textures.pack, models.pack)
[u32 LE header length][JSON header {name:[offset,length]}][raw bytes]

## Models are NOT glTF at runtime
Skinned models are stored in a custom deflate-compressed binary plus meta JSON (joints, parents, prims,
inverse bind matrices) and webp textures. New characters must go through a converter (glTF/FBX -> this format).
That converter is the next tooling task.

## Known debt
- game.js is one 130 KB file; split into player / titan / fx / hud / world as features land.
- No audio, saves, dialogue, quests or story state yet.

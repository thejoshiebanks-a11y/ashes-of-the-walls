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

## Story layer (v0.2.0)
Loaded after game.js: core (events, state machine, expressions, quests), dialogue, world, save, ui, main. See docs/STORY_SYSTEMS.md.
The story layer drives the game through window flags: `__freeze`, `__noOdm`, `__noTitan`, `__hideAvatar`, and reads `__world`, `__st`, `__E.vp`, `ODM`.
The player avatar is still the Levi model until the model converter and character models arrive.

## Actors and models (v0.3.0)
tools/convert_model.py turns any glTF/GLB with a skin into the engine format (a faithful dump of node transforms, inverse-bind matrices and vertices, only converting centimetres to metres). tools/build_npc_pack.py converts everything listed in tools/models_manifest.json into assets/npc.pack (lazy-loaded) and data/npc_models.json.
Mixamo-skeleton models are renamed to the Bip001 bone names so the game's direction-based animation retargeting drives them. game.js exposes `window.__actors` (add, remove, clear, loadModel). Per-prim tint (multiply for skin, luminance recolour for hair and clothes) is a shader uniform set through `M.tintFn`.
`window.__cine` ({on,pos,target,fov}) overrides the camera for cutscenes, the title and the registry preview.
tests/actor_pose.test.js runs the game's real loadModel and pose code (stub GL) against every converted model.

## Known debt
- game.js is one 130 KB file; split into player / titan / fx / hud / world as features land.
- No audio yet. Story NPCs are markers until character models are converted. Title-shot camera and NPC spots need a tuning pass in a real browser.

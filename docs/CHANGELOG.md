# Changelog
## 0.8.1
- Intro Colossal: only two clips now, `C2:in` (rise) then `C2:jt_roar`; the swat is gone. Title screen: removed the old version label and ticker that overlapped the Credits button.
## 0.8.0: Gate-centred opening, new houses, landmark home, closer realism
- **Opening**: Colossal2 and the strike are now centred on the main gate (x=0). The camera can never go under the terrain. The intro waits for the Titan models before frame one. A hidden stone plug inside the gate complex closes the see-through slit in the wall.
- **Houses**: `tools/patch_district.py` replaced house types 1-4 (all instances, original positions and yaw kept) with the four anime medieval townhouses from `anime_medieval_house.glb` (`h8_v1..v4`). Types 5-8 stay for variety.
- **Landmark**: your `medieval_house_anime_based` model (stairs, wood, brick, roof, walls, plants with alpha, normal maps) stands at about x=21.8, z=-86.7 (replaces one big house on the south row). This is the character's home.
- **Ground**: close-range rounded cobbles with dark joints, pebbles on dirt, blade-scale grass breakup (fade with distance).
- **Music**: drop `intro.mp3` / `title.mp3` (or .m4a/.ogg/.wav) into `assets/music/` and they play instead of the built-in score. The built-in score is original, in the same genre; I cannot reproduce the real "Shinzou wo Sasageyo" (copyrighted).
- Tests: `tests/district_v08.test.js`.
## 0.7.0: Clip-driven Colossal, post pipeline, sky, masonry, Titan shading, AoT-style score
- **Intro Colossal2 is driven only by its own clips**: `C2:in` (rise), `C2:skl01` (swat), `C2:jt_roar` (roar), `C2:idle` between. No IK grip, no finger curl, no scripted heave. (`OP.c2Seq`, `OP.c2clip`; the old Colossal still uses the IK path.)
- **Phase 2, post pipeline** (`js/post.js`, new): scene renders into an off-screen colour + depth texture; bloom (bright pass, 3-4 level chain), sun light shafts (screen-space, depth-masked to the sky), SSAO-lite (ULTRA), FXAA, one finishing grade, vignette, film grain. Tiers: LOW off, MEDIUM FXAA+vignette+grain, HIGH +bloom+shafts, ULTRA +SSAO. ACES stays only in the scene shaders (never applied again). MSAA is gone (FXAA replaces it). `E.deferPost` lets game.js draw actors and FX into the scene target before `E.endPost()`. Fallbacks: shader/FBO failure turns post off and the old direct path returns. `?post=0` disables it.
- **Phase 3, sky**: two cloud layers with domain-warped billows, sun-side lit rims and dark undersides, sunset horizon glow, dusty-rose opposite horizon; forward-scatter glow and more height haze on distant scenery. Fog uses a cheap gradient (no cloud noise per pixel).
- **Phase 4, masonry** (`stoneFx` in the main shader): wall blocks, house bricks, stone blocks with mortar, per-block tone, chipped corners, hairline cracks, stains, damp mossy foot, bump lighting; fades with distance. Optional real textures: put `assets/stone_albedo.jpg` and `assets/stone_normal.jpg` in the repo and they are blended in (triplanar).
- **Phase 5, Titan skin**: SSS-style warm terminator, fresnel rim (sun and sky), wet specular, albedo-driven fibre contrast; full strength on Titans and Colossal/Armored, light on people.
- **Audio**: new drive layer in the intro and title (galloping string ostinato, snare rolls, heroic horn line, choir stabs), original writing in the genre.
- Tests: `tests/post.test.js` (16). Version 0.7.0.
## 0.6.0: Colossal 2, graphics foundation (phase 1)
- **colossal2 is now the intro Titan.** Its bones were named like `Bip001 Pelvis_51`, so the game's rig could not find them; the names are fixed in `data/npc_models.json` and its real height (0.257) replaces the wrong 0.36. Its own clips (roar, atk01, atk02, hit, die, idle, in, skl01, jt_*) are baked into the game's clip format by `tools/add_glb_clips.py` and are in `assets/models.pack` as `C2:*`. The intro plays `C2:idle`, then `C2:jt_roar` at the reveal, with the hands planted on the wall by IK. Set `STORY.opening.useC2 = false` to fall back to the old Colossal.
- **Graphics phase 1** (`js/quality.js`): LOW/MEDIUM/HIGH/ULTRA tiers, capability probe, adaptive resolution, frame-time monitor (p90/p99, jank, thermal baseline, 30 Hz cap detection), per-tier shadow size and cascades (LOW = one cascade). Options > Graphics chooses a tier or Auto. `?gfx=low` also works. `GFX.report()` prints the numbers. Engine changes are small: `setShadowSize`, `cascades`, `antialias` option, aniso cap.
- Tests: `tests/quality.test.js` (19 checks); `tests/actor_pose.test.js` no longer skips colossal2's body mesh.
## 0.5.2: Slower, grip fix, title polish
- Crest: the glowing crack now runs through the centre of the emblem.
- Studio logo: mark, JOSHIE SAMA, PRESENTS, then the legal line, in a single column with no overlap.
- Intro retimed to 12.6 s. Three shots, two cuts; the B to C change now dips through black (0.55 s) instead of a 2-frame flash. The last shot is one continuous low crane from the hand to the face.
- Colossal hands: arm IK plants each wrist on the real stone height under it (cast), palm down, fingers curled over the front edge. Each hand rests on top of the wall with the fingers curled over the front edge (uses the engine hand orientation and finger curl through `OP.hands`, tuned by `OP.K.fd/pn/curlT/curl`). game.js passes the model `M` to `a.poseFn` and exposes `__initHandLoc`.
- Stamp: English "Three days before" removed (Japanese only). Title: the date line is hidden once docked so nothing overlaps the Begin Journey card.
- Title: drifting mist banks and hearth-smoke columns over the town.
- Audio: `AU.unlock()` on every gesture; iOS audioSession "playback" plus a silent looping audio element so the sound is not muted by the ringer switch.
## 0.5.0: Logo gate, the Colossal at the wall, a full score
- Boot: pure black until the story layer takes over. No loading text and no test arena any more (the canvas and game HUD stay hidden with the `aow-boot` class on <html>). Only a hairline progress bar shows low on the screen.
- New crest on the tap screen: Wall Maria, Rose and Sina as three rings, split by a glowing crack, an ember at the core, ash lifting off, with the ASHES OF THE WALLS wordmark and 壁の灰 under it.
- Intro rebuilt as a 9.4 s breach teaser (js/story/fx.js + opening.js): fade up from black, storm flicker and sky bolts, a golden plasma ball swells above the wall, a lightning strike with whiteout, shockwave ring, fireball, embers, steam and smoke rolling over the wall (hidden correctly by the wall), then one hand clamps the wall top, the other follows, he heaves up and the face rises over the edge with a roar, steam and skin arcs. Camera shake, god rays and a storm grade. No Scouts or arena. Effects canvas is now near full resolution.
- Title: all credit and legal text removed from the title screen (it lives in the Credits scene). Credits button stays bottom right.
- Sharper image: dynamic resolution is locked to 90 percent or better during the opening and title (it used to fall to 55 percent, which looked blurry), and the grain layer is gone. New golden-hour grade with a low sun glare.
- Audio: master make-up gain plus a compressor (it was too quiet). New orchestral title theme (strings, cello drive, taiko, horns, choir), a scored intro cue, and new effects: rumble, stone crack, debris, boom, ODM fire and reel, Titan roar, gusts.
- Engine hooks (game.js): a.clipT scrubs a clip, a.poseFn edits a pose, a.vg sets a virtual ground. viewer.js: __lockScale. Camera starts with a valid target (it threw errors before the game started).
- Tests: opening.test.js covers the new timeline (camAt, colossalState, trauma, cpose); new fx.test.js covers the effects; audio gained thunder and plasmaCharge.
## 0.4.0: The opening, rebuilt (js/story/opening.js, css/opening.css)
- Tap gate in black with a Japanese and English prompt. The first tap unlocks audio.
- Studio mark: the hexagon "H" is drawn in SVG with a light sweep and the name JOSHIE SAMA, with a procedural sting (no audio files).
- Cinematic intro of about 7 seconds. Shot A: three Scouts in a V formation fly over the district with ODM wires and the camera dives in behind the leader. Shot B: street level with Eren, Armin and Mikasa while the Colossal rises over the wall with lightning and steam. Shot C: impact frame, flash, speed lines, hard cut to black and a heartbeat. Wipe captions appear in Japanese with English glosses. Tap, Space, Enter or Esc skips.
- Title stamp: the wordmark Ashes of the Walls and 壁の灰 slam onto black, then the lockup docks (FLIP animation) into the title layout over the aerial dawn camera (three-sine drift around Shiganshina).
- Menu in the Wings of Freedom manner: skewed slash selection, a description card for the hovered item, heartbeat on Begin Journey, locked Training Grounds, Load file greyed without a save, and an Exit card ("See you beyond the wall"). Credits sit in a slim band at the bottom like the AoT2 fine print. Keyboard: arrows, W/S, Enter, Space.
- Japanese text uses a Noto Serif CJK JP subset (assets/fonts/aow-jp-*.woff, SIL OFL). Latin display fonts are Cinzel and Grenze Gotisch from Google Fonts, with fallbacks.
- Added to the audio module: logoSting, riser, steam, drone, stampHit, menuTick, a formant choir pad and a title bell.
- game.js: one-line hook so actors can fly (a.fly). main.js: openingHost, a new title camera, an exit handler. coldOpen is now only the fade-out into the creator.
- Tests: story_smoke updated for the new flow (mock DOM now supports innerHTML), new tests/opening.test.js.
## 0.3.0: Opening, registry, living cast
- Opening: tap gate, parchment splash with drifting ash, silence and wind, a distant Titan footstep and a crow. Title over the fog-shrouded dawn district with a slowly creeping camera, chiselled stone menu (Begin journey, Load file, Training grounds, Options, Credits), heartbeat on Begin, steel clink elsewhere. Credits now blend in as a slim line at the bottom of the title.
- Cold open: black, gas canisters, the camera rockets up the wall, lightning, the Colossal Titan rises over the wall, the title is stamped onto black with a violin screech, then "Three days before".
- All audio is synthesised live (wind, footsteps, crows, heartbeat, steel, bells, a generative cello and voice). No sound files, no licences.
- Registry creator: in-universe, with a live 3D preview of you and your Anchor. Name, voice, pronouns, body, height and build sliders, head shape, skin, hair, eyes, scars (recorded), clothing colours and wear.
- Destiny: bloodline, family and Anchor are rolled by the system and cannot be chosen. Ackerman is 0.5% (about 25 per 5,000 players) and stays hidden. The roll is seeded and persisted so reloading cannot re-roll it.
- Model converter and 11 converted models (Eren, Mikasa, Armin, Sasha, Annie, Reiner, Bertholdt, two civilian bodies, Colossal, Armored). Any converted model can be posed with the game's own animation set.
- Real characters in the world: you, your Anchor and the cast stand in Shiganshina, face you as you pass, and gesture while they talk. A shoulder camera frames every conversation.
- Three in-game days before the breach, with a day clock, 3 main quests and 4 side quests, 25 conversations.
- District map (pan, zoom, objective, NPCs), opened from the HUD or with M.
- Free roam removed from the menu. ODM, Titan and combat code are untouched and ready for the Training Grounds.
- game.js: per-prim tinting, actor drawing, cinematic camera, Colossal prop. Free-roam ODM behaviour is unchanged.
## 0.2.0: Story backbone
- New: opening sequence, title screen over the live district, character creator (name, pronouns, look, bloodline, Anchor, difficulty).
- New: dialogue engine with choices, conditions and effects; quest journal; bond meters; talk prompts and objective markers; chapter cards; letterbox, flash and shake.
- New: saves (autosave plus 3 slots, backup export/import), pause menu, settings, credits scene, rotating credits on the loading screen.
- New: playable Prologue part 1: a morning in Shiganshina, three side conversations, the gate, the first view of the breach and a saved choice.
- Free roam keeps the original ODM test arena with the Titan.
- game.js: small hooks (freeze, ODM lock, Titan hide, avatar hide). No gameplay changes in free roam.
## 0.1.0
- Split the single 14.9 MB HTML into index.html, css, js, data and binary asset packs (11 MB total).
- Replaced base64 blobs with real binary files. Added boot.js loader. No gameplay changes.

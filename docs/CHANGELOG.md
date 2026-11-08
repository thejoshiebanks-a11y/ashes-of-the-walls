# Changelog
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

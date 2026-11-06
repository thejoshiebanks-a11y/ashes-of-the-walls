# Changelog
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

# Character Creator v2 — what changed

## 1. Scale + camera
* Children NPCs (Eren, Armin, Mikasa) are exactly **half** their old height (`data/story/npcs.json`). The creator hero is `T.baseMeters() = 0.65`, i.e. the same height as them (±10 % with the HEIGHT slider).
* The third-person camera is scaled for a small hero: `window.__camK` (distance, shoulder offset, floor clearance) and `window.__camH` (look-at height) are set by `teen.js` while the player is the teen/boy and reset for every other body. Levi / free-roam is untouched (`__camK` is undefined → factor 1).

## 2. Hair
* Old cap styles removed. New list: Messy, Buzzed, **Curly, Short curls, Bob & fringe** (from *anime hair-02* by paintoheaven, CC-BY, credited in-game), Shaved.
* The sheet's meshes are AI hollow shells (~590 k vertices). `tools/teen/hair_sheet.py` welds, decimates to ~5 k triangles, orients and fits each onto the closed skull (`Skull`/`Scalp` prims) so no hole shows. Wild sweep and Spiky were dropped because their silhouettes were ragged.

## 3. Second base — anime boy
* `assets/boy/*`, built by `tools/teen/build_boy.py` from *Anime Character Model – Boy* (VR Avatars, CC-BY). 158 joints → our 24 Bip001 joints (weights moved to the nearest kept ancestor), **cat ears removed**, 14 textures capped at 512 px.
* Our Peasant / Ranger / Scout outfits and the ODM gear are re-fitted onto him with the same bone-frame fit the teen uses (`fit_outfit.Fit`). His own clothes are the "Modern" (pre-reveal) set.
* Creator → BASE tab → **CHARACTER MODEL**. Same colour pickers (skin, eyes, hair, dyes), same animations.
* Limits: he has one hairstyle (any style except Shaved shows it, coloured by the hair colour), one face, and the outfit fit is a warp — expect small clipping on extreme body-type settings.

## 4. Walk / run
* **Root cause of the "gliding":** `Anim.play()` ignores the rate when the clip does not change, so the playback rate was frozen at the moment of the last clip switch, and the speed table was Levi's (≈ 11 leg-lengths per second for a 0.65 hero). Legs moved at a fixed pace while the body slid.
* `window.__actorClip` (installed by `teen.js`) now chooses the clip from the actor's *own* leg length and returns a playback rate = ground speed / (stance-foot speed of the clip × leg length). A one-line patch makes the engine apply the rate every frame.
* Run = the **speedster Mixamo run** converted by `tools/anim/convert_run.py` into `data/story/run_clip.json` (17 frames, loops). Lean/roll live in the bone directions and the root bob is baked so the planted foot sits on the floor (checked numerically: lowest ankle = rest ankle height).
* Teen/boy ground speeds (world units/s): walk 0.4, jog 0.85, sprint 1.6 (`T.loco.PACE`). Levi keeps his own speeds. If the map feels too big, raise `PACE`; legs will then run faster than natural — that is the trade-off.
* `anxious_pack.glb` only contains an idle, so it could not serve as the walk/run reference.

## Install (Codespace terminal, repo root)
```
unzip -o ../aotw_character_creator_v2.zip
node tools/apply_game_patches.js          # 8 small hooks in js/game.js (backup: js/game.js.bak), safe to re-run
node tests/teen_creator.test.js && node tests/teen_foundation.test.js
git add -A && git commit -m "Character creator v2: scale, anime hair, anime boy base, stride-matched run" && git push
```
Hard-refresh the Pages site (or bump `?v=`) once so the browser fetches the new assets.

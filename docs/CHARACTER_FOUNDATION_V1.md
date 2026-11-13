# Young Character Foundation V1 (lab build 0.8.0-lab)

Open `character-lab.html` (not the game). It loads the real engine (engine.js, viewer.js, game.js), the real animation retargeting and the real Shiganshina district, and puts ONE teen on a flat patch. Nothing in the existing game files is modified.

Run in the Codespace: `python3 -m http.server 8000` and open `/character-lab.html` (port 8000, Safari landscape). Tests: `node tests/teen_foundation.test.js`.

## What was built
One skinned, animated teen (24 Bip001 joints) with switchable parts, all on one skeleton:
- Outfits: Peasant (default, medieval), Ranger, Scout Regiment (unlockable; cloak optional), Modern (the clothes baked into the source asset). Slot dyes for top / pants / boots / accent.
- Hair: Messy, Parted, Buzzed, Cropped, Long, Buns. All hair, eyes and skin start black / dark and can be recoloured (12 hair colours, 8 eye colours, 7 skin tones).
- Gear: Levi's ODM harness and two swords, refitted to the teen's skeleton (shown only when switched on).
- Variation: build (3), head size (3), step length (5), height and 7 body sliders, face/hair/eye/skin colour, outfit dyes. `LAB.randomise(seed)` drove the 10-character test sheet: all 10 differ in hair, outfit, colours, gear and proportions.
- Animation: the engine's own idle/walk/run clips, retargeted onto his skeleton. Foot sliding is removed by scaling the clip speed to his size (actor.speedK).

## Height rule
Teen = (Shiganshina door height) / 2. The door is estimated from your screenshot at 0.70 x Levi, so the teen is 0.35 x Levi: Levi 0.875 u, door 0.6125 u, teen 0.306 u (measured in the engine). This is an estimate, not geometry measured from the door. Change `DOOR_OVER_LEVI` at the top of `js/lab/lab.js` if the real door differs.

## Teen audit (Phase 2)
Source GLB: 1.649 m, 24 Mixamo-style joints (A-pose), one baked material, modern clothes and messy hair fused into one shell, no underbody. 300k triangles (decimated to about 100k with a seam-locked quadric decimator). The face is a hollow mask with an open skull back, so a scalp cap was added. The shoulder "blue thing" was a blue collar texture on the shell; it is removed.

## Quaternius compatibility (Phases 4-5)
Quaternius rigs have 65 joints; the teen has 24. Outfits and hair are re-fitted by a torso/shoulder warp plus per-joint chain frames, with skin weights remapped by joint name (fingers go to the hand). Peasant, Ranger and Scout fit the body and stay attached in idle/walk/run. Remaining flaws: slightly stiff cloak, some jagged skin edge at the jaw/ears.

## Gabi / female (Phase 6): NOT done
Gabi stays a separate canon character. A young female base needs its own dedicated body; an adult must not be scaled down. Not started this milestone.

## Not tested / limits
- Visual tests ran headless (SwiftShader) in a desktop Chromium, not on your iPhone.
- Walk/run was inspected on screenshots, not on a device.
- The teen's own clips were not converted; the engine's clips drive him.
- Eyes: clean round irises (pupil, limbal ring) plus a white catch-light sit in front of the teen's painted eyes; colour is a runtime tint. They do not blink or look around.
- Non-Messy hairstyles come from adult Quaternius hair, scaled per style to his head (`--style-scale` in build_modular.py). Checked in front closeups only; side/back views are small in my previews.
- NOT wired into New Game: the lab is a separate page (character-lab.html). The in-game creator is unchanged until I can see your current js/story files.
- The player controller speeds and capsule are not rescaled; there is no Drive mode.
- Camera near plane 0.3 limits extreme close-ups.
- Optional permanent fix: in game.js `actorClip`, add `sp/=a.speedK||1;` (the lab applies this at runtime).

## Credits / changelog text to paste
CREDITS: Quaternius Modular/Superhero packs (CC0); Young teen foundation GLB (licence NOT confirmed, needs source); Levi gear (existing game asset).
CHANGELOG 0.8.0-lab: character-lab.html + assets/teen + tools/teen + tests/teen_foundation.test.js.

## Rebuild
`python3 tools/teen/build_modular.py --glb <teen-character-rigged.glb> --fbx <Source/FBX> --tex <Source/Textures> --core <AOT_Character_Core_Pack> --out assets/teen`

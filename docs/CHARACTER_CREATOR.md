# Character Creator (New Game) - what is in this drop

New Game now opens the **Character Creator** on the young teen base. Layout follows the reference: Cinzel-style header with crest, left category list
(BASE, FACE, HAIR, EYES, BODY, CLOTHING, GEAR, EMBLEM, VOICE, OPTIONS, RANDOMISE), centre panel, right column (VIEW CONTROL, CAMERA MODE, CHARACTER INFO), BACK / CONFIRM.

## Scene
- Always golden hour (ODM.hour is locked to 17.65 while the creator is open), Shiganshina street behind him (houses, stairs, trees, sky), birds flying across the sky (overlay canvas).
- Opening: the camera sweeps in from a wide high shot while he is built up on stage: grey clay default character -> skin + eyes -> hair -> clothes, each step with the equip flash / embers. Touching any control ends the build-up at once.
- Camera modes Default / Close up / Full body, rotate (drag), zoom (pinch/wheel), move, reset; every equip pops + swings him.

## Character
- 5 face shapes (Soft, Round, Sharp, Broad, Long) - real geometry variants of his own face shell, plus height / build / head size / skin tone / 8 curated presets. Random characters always differ.
- 8 hair options: Messy, Parted, Buzzed, Bowl cut, Side part, Crew cut, Pompadour, Shaved. The four new styles are caps built on his own skull shell, so they fit his head by construction. Hair and eyes start black and can be recoloured.
- Closed head: a skin 'Skull' shell (crown to nape, fitted inside the face shell) is always present, so no hair, outfit or angle can show a hole. Shaved = just that shell.
- Face skin texture is smoothed (edge-preserving, soft shading steps) for a 3D-anime look. Eyes are larger procedural irises with a catch-light.
- Medieval civilian outfits by default (Peasant, Ranger); Scout Regiment is an unlockable option (flag `scout_unlocked`). Dyes, wear, cloak, ODM gear supported.
- Height rule: Shiganshina door height / 2 (shorter than Levi).

## Install (Codespace)
    cd /workspaces/ashes-of-the-walls
    unzip -o aotw_character_creator_v1.zip
    node tests/teen_foundation.test.js && node tests/teen_creator.test.js
    python3 -m http.server 8000      # open /index.html -> New Game
    git add -A && git commit -m "Character creator" && git push
Optional foot-slide fix in game.js: `sed -i 's/function actorClip(a,sp){/function actorClip(a,sp){sp\/=a.speedK||1;/' js/game.js`

## Honest limits
- Overwrites js/boot.js, js/story/main.js, js/story/actors.js and index.html with copies based on the files you sent; if you changed them since, merge by hand (the edits are small: boot.js script list + VERSION, main.js openCreator/spawnCast/defaultDraft/buildPlayer, actors.js 'teen' branches, index.html creator.css link).
- Not tested on an iPhone. Tested in desktop Chromium (software GL) at 667x240 and 844x390, via STORY.debug.openCreator() (not by tapping the menu).
- Girush_Fair_Skin_Variant could not be used: it is a .blend plus textures only and no Blender is available here. Export a GLB/FBX and it can be evaluated.
- The female base is shown locked (no suitable base was built). The Emblem tab saves the crest to the registry card only (not painted on clothes). Height in cm is a cosmetic mapping. The player controller is not rescaled.
- Hair styles are smooth caps (clean anime blocks, not strand-modelled). A bald head may show faint texture marks on the forehead under strong light.
- The Wings of Freedom crest and AoT logo are not drawn; an original crest is used. Drop your own SVG at assets/ui/emblem.svg to replace it.
- The camera near plane (0.3) limits extreme close-ups.

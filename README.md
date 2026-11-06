# Ashes of the Walls (working title)

Browser 3D action game: ODM gear, Titans, and a story that starts in Shiganshina.
Custom WebGL2 engine, no dependencies. Fan project, non-commercial.

## Run
GitHub Pages: Settings > Pages > Deploy from branch > `main` / root. Open the Pages URL.
Local: `python3 -m http.server 8000` then open http://localhost:8000
(Opening index.html straight from a file will NOT work: the game fetches its data files.)

## Layout
    index.html          page + HUD markup
    css/style.css       all styles
    js/boot.js          loads data, then starts engine -> viewer -> game
    js/engine.js        WebGL2 renderer
    js/viewer.js        orbit/walk viewer + loading UI
    js/game.js          ODM, Titans, Levi avatar, combat, HUD
    data/               JSON: district layout, model metadata
    assets/             binary packs (textures, models, animations, district geometry)
    js/story/           story layer: core, audio, destiny, dialogue, world, save, actors, map, ui, main
    tools/              model converter (glTF/GLB -> engine format) and pack builder
    data/story/         story content as JSON (dialogue, quests, world, credits)
    tests/              node tests for the story logic and boot
    docs/               blueprint, storyline, credits, changelog, story guide, asset wishlist

## Releasing
Every release: bump `VERSION` in js/boot.js (busts the cache), add a line to docs/CHANGELOG.md.

## Tests
`node tests/story_logic.test.js && node tests/story_smoke.test.js && node tests/boot.test.js && node tests/actor_pose.test.js`

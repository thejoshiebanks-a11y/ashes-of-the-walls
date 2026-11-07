# The opening (owner: the "opening" chat)

Everything from the first tap to a live menu: `js/story/opening.js` and `css/opening.css`. Other chats should not edit these files. Ask the opening chat, or keep changes to the hooks listed below.

## Flow
gate (tap) -> studio mark -> cinematic intro -> stamp -> dock -> title menu. `S.opening.runOpening(host)` runs it and falls back to the title screen if any step throws.

## Hooks other code may use
- `S.opening.runOpening(host)`, `showTitle(info,{stamp})`, `titleIn()`, `hideTitle()`, `exitCard()`, `ticker(lines)`.
- `host` (built in `main.js` as `openingHost`): has3D, setHour, teleport, cineOn, gh, project, ensure, info, prepTitle.
- Menu actions reach the game through `UI._cb(name)`: `new`, `continue`, `train`, `options`, `credits`, `exit`, `hover`, `hoverBegin`, `locked`.
- Pure helpers (tested in `tests/opening.test.js`): `titlePose(t)`, `scoutPath(i,t)`, `shotA(t)`, `newRun()`.

## Changing things
- Strings (captions, menu, descriptions, Japanese text): the `T` object at the top of opening.js.
- If you add Japanese characters, rebuild the font subset: `python3 tools/build_jp_font.py` (needs fonttools and the Noto Serif CJK JP source font). It scans opening.js and data/story/*.json.
- CSS: sizes are based on `--op-u` (min(1vh,1.6vw)). Button rules need the `#sv-root` prefix because of `#sv-root button{font:inherit}`.
- `#sv-root` is an isolated stacking context, so `mix-blend-mode` cannot blend with the WebGL canvas. Use alpha overlays.

## Known limits
- The Latin fonts (Cinzel, Grenze Gotisch) load from Google Fonts. Offline they fall back to serif faces.
- The 3D intro was checked in a software renderer only. Check the smoothness on a real phone.
- The Levi and Titan models may be game rips. Keep the repo private until they are replaced, and credit Prime Slayer3D (CC-BY) wherever those models are used.

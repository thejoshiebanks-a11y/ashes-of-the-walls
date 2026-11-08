# The opening (owner: the "opening" chat)

Everything from the first tap to a live menu: `js/story/opening.js` and `css/opening.css`. Other chats should not edit these files. Ask the opening chat, or keep changes to the hooks listed below.

## Flow
gate (game crest, tap) -> studio mark -> cinematic intro -> stamp -> dock -> title menu. `S.opening.runOpening(host)` runs it and falls back to the title screen if any step throws.

## Hooks other code may use
- `S.opening.runOpening(host)`, `showTitle(info,{stamp})`, `titleIn()`, `hideTitle()`, `exitCard()`, `ticker(lines)`.
- `host` (built in `main.js` as `openingHost`): has3D, setHour, teleport, cineOn, gh, project, ensure, info, prepTitle.
- Menu actions reach the game through `UI._cb(name)`: `new`, `continue`, `train`, `options`, `credits`, `exit`, `hover`, `hoverBegin`, `locked`.
- Pure helpers (tested in `tests/opening.test.js`): `titlePose(t)`, `camAt(t,g)`, `colossalState(t)`, `trauma(t)`, `newRun()`.

## Changing things
- Strings (captions, menu, descriptions, Japanese text): the `T` object at the top of opening.js.
- If you add Japanese characters, rebuild the font subset: `python3 tools/build_jp_font.py` (needs fonttools and the Noto Serif CJK JP source font). It scans opening.js and data/story/*.json.
- CSS: sizes are based on `--op-u` (min(1vh,1.6vw)). Button rules need the `#sv-root` prefix because of `#sv-root button{font:inherit}`.
- `#sv-root` is an isolated stacking context, so `mix-blend-mode` cannot blend with the WebGL canvas. Use alpha overlays.

## Known limits
- The Latin fonts (Cinzel, Grenze Gotisch) load from Google Fonts. Offline they fall back to serif faces.
- The 3D intro was checked in a software renderer only. Check the smoothness on a real phone.
- The Levi and Titan models may be game rips. Keep the repo private until they are replaced, and credit Prime Slayer3D (CC-BY) wherever those models are used.

## Tuning the wall scene
`S.opening.K` holds the knobs (Colossal height, how far behind the wall he stands, arm directions, how high he heaves). `OP.TL` holds the beat times. `OP.camAt(t, g)` is the whole camera; `g` is the wall measured by `openingHost.geo()` with rays, so the scene follows the wall if the district changes. Set `window.__opT = seconds` while the intro runs to freeze it at any instant (used for screenshots).

## Tuning the breach teaser (v0.5.0)
- Timeline: `OP.TL` (rumble, ball, strike, grab, headUp, reveal, end). Knobs: `OP.K` (liftHide/liftGrab/liftUp = how far the Colossal is sunk below the wall, tzOff = distance behind the wall, height, arm directions, ballUp).
- Effects live in `js/story/fx.js` (puffs, bolts, plasma, shocks, flashes, rays, storm). They are simulated from the timeline, so scrubbing with `window.__opT = seconds` shows an exact frame.
- `OP.useC2 = true` switches to the new `colossal2` model (experimental; its skeleton has no Spine2).

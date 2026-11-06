# Story systems (v0.2.0): how to add content

Everything story-related is data in `data/story/*.json`. No code changes are needed to add conversations, quests or NPC spots.

## Files
| File | Holds |
|---|---|
| config.json | creator options, bloodlines, difficulties, faction colours, loading tips |
| characters.json | named NPCs (id, name, faction, tier, monogram). `anchor`, `player`, `narr` are built in |
| dialogue.json | all conversations |
| quests.json | quests and objectives |
| world.json | talk points, trigger zones, start position, title-screen camera shot |
| credits.json | the credits scene and opening sequence |

## Dialogue nodes
    "n1": {"s":"marta","t":"Hello, {player}.","next":"n2","fx":[...]}      a line
    "n2": {"s":"player","t":"","choices":[{"t":"Yes","next":"n3","fx":[...],"if":"bond.marta>=1"}]}   a choice
    "n3": {"branch":[{"if":"talked_x","next":"a"},{"next":"b"}]}           first true condition wins
A node with no `next` (or `"end":true`) ends the conversation. `next` can be `"conv:other_id"` or `"conv:other_id.node"`.
Text templates: `{player}`, `{player.he}`, `{anchor}`, `{anchor.rel}` (brother, mother, friend), `{anchor.he}`, `{anchor.his}`, `{flag:name}`.

## Conditions (`if`)
Flags by name, `bond.<id>`, `quest.<id>=='active'|'done'`, `obj.<quest>.<objective>`, `player.bloodline`, `player.anchor.rel`, `hour`.
Operators: `and or not && || ! == != >= <= > <` and parentheses. Every conversation sets `talked_<id>` (a counter) when it ends.

## Effects (`fx`)
    {"op":"set","key":"flag","value":true}      {"op":"add","key":"n","value":1}      {"op":"bond","id":"anchor","value":1}
    {"op":"quest.start","id":"q"}  {"op":"quest.obj","id":"q","obj":"o"}  {"op":"quest.done","id":"q"}  {"op":"quest.fail","id":"q"}
    {"op":"emit","event":"name"}   {"op":"hour","value":12}   {"op":"toast","text":"..."}   {"op":"card","title":"..","sub":".."}
    {"op":"scene","id":"breach"}   {"op":"save"}   {"op":"shake"}   {"op":"flash"}   {"op":"day","value":2}  (advances the day, resets the clock, main.js starts that day's quest)
Any effect accepts an `if`. New scene ids are registered in `js/story/main.js` under `scenes`.

## Quests
An objective completes when the event named in `on` fires. Finished conversations emit `talk:<conversationId>`, zones emit what their `fx` say (for example `enter:gate_square`). `marker` is a world point id (draws the gold marker and arrow). The quest completes when all non-`optional` objectives are done, then runs `onComplete`.

## World points
A point is a place where someone stands. `talk` is a list checked in order; the first entry whose `if` is true gives the conversation. If none is true the point is hidden. Positions are snapped at runtime away from walls and roofs and the change is logged to the console as `[story] point ... moved`.

## Saves
IndexedDB (falls back to localStorage, then memory). Slots: auto, slot1-3. Settings > Export / Import saves makes a backup file.

## Tests
`node tests/story_logic.test.js`, `node tests/story_smoke.test.js`, `node tests/boot.test.js`. The first validates every link, speaker, effect, marker and expression in the JSON, so run it after editing data.

## v0.3.0 additions
- `npcs.json`: who stands where, which model, height in metres and tint colours. A point's `char` picks the NPC; add `label` to show a group name ("The children").
- `world.json` `places`: named places drawn on the map.
- Days: `day` is a condition (`day==2`). The main quest for each day starts from the day-change handler (`DAY_Q` in main.js).
- Destiny (js/story/destiny.js): `BLOODLINES`, `FAMILIES` and `RELATIONS` carry the odds. Change weights there. A true global cap on Ackerman files needs a server counter; this is a per-player probability.

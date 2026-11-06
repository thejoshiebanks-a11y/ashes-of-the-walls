# Asset status and what to send next

Format: GLB (glTF 2.0) preferred. Humanoids on a Bip001 or Mixamo skeleton so one animation set serves everyone. Textures 1024 px or smaller.
Keep the source link and licence for every file (docs/CREDITS.md). A credit satisfies CC-BY, but it does not license a model ripped from a game or anime. Keep the repo private until those are replaced.

## Converted and in the game (assets/npc.pack)
Eren, Mikasa, Armin, Sasha, Annie, Reiner, Bertholdt, two Fuse civilian bodies (man, woman), Colossal Titan, Armored Titan. See docs/MODELS.md.

## Not converted yet
- FBX files: Hannes, Mina, Carla (XPS/MMD rip) and the 7 Titans in the Titans pack. They need an FBX reader in the converter (next task).
- Levi (eosepia) came as a .rar which could not be opened here. Send it as a .zip if you want it.
- Hallucigenia: 300k vertices, too heavy for mobile as is.

## Still needed for the Prologue and Act 1
- More civilians: a few more men, women, elders and children, ideally Fuse or other Mixamo-rigged bodies, so crowds look varied.
- Garrison soldier model(s) with the rose emblem, and a Grisha and Carla if you can find them as GLB.
- Animations: talk gestures, sit, cry, frantic run, climb, push through a crowd (Mixamo has most of these).
- Music and sound effects. Everything is synthesised for now; real recordings will sound better. CC0 or credited files, any common format.

## Notes
- Scars are recorded in the registry but not painted yet: the Fuse face is part of the body texture, so painting needs a per-character texture pass.
- Procedural effects (steam, dust, fire) are built in code and need no files.

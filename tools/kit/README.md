# Character kit tools (work in progress, v0.5 groundwork)
- xps.py: reader for XNALara .xps files (the AoTWA Furlan and Isabel rips). Gives bones, meshes, weights, UVs.
- engine_model.py: writes any skinned mesh in the game's engine format.
- build_mannequin.py: skins the uploaded human body mesh to the canonical Bip001 skeleton (Furlan's AoTWA rig, trimmed to 52 joints)
  and swings the arms into the mesh's A-pose. Expects ./models/body.glb and ./ex_church/.../xps.xps next to the scripts folder.
- pose_dump.js + pose_sheet.py: pose a built model with the game's real animation code and render a contact sheet (docs/mannequin_pose_check.png).
Output: assets/kit/mannequin.* (not wired into the game yet).

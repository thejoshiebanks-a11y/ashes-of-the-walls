# Converted models

| Key | Source | Joints | Notes |
|---|---|---|---|
| armin, eren, mikasa, sasha, annie, reiner, bertholdt | Prime Slayer3D (Sketchfab), CC-BY 4.0 | 97 to 128 | Bip001 skeleton, drives directly from the game's animation clips. Scout gear is hidden at runtime and clothes are recoloured for civilian scenes. |
| fuse_man, fuse_woman | Adobe Mixamo Fuse | 66 | Renamed from Mixamo to Bip001 bone names. Modular parts (body, top, bottom, shoes, hair, beard) tint independently. Used for the player, the Anchor and civilians. |
| colossal, armored | Prime Slayer3D (Sketchfab), CC-BY 4.0 | 69 to 78 | Static props for now. Colossal is drawn at 60 m. |

Rebuild: `python3 tools/build_npc_pack.py /path/to/extracted/models`

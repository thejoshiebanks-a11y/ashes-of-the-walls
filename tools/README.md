# Tools

    python3 tools/convert_model.py model.glb --key myguy [--rename mixamo] [--drop-mat REGEX]
    python3 tools/build_npc_pack.py /path/to/extracted/models      # converts tools/models_manifest.json

Requires Python 3, numpy and Pillow. glTF and GLB only. Models need a skin and at most 128 joints (extra unweighted joints are pruned, the least influential leaf joints are folded into their parents).

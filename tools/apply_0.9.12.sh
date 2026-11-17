#!/bin/bash
# Run once from the repo root after unzipping both update parts: removes the files this version retired (old bases, old thumbnails, stale textures).
cd "$(dirname "$0")/.." || exit 1
n=0; while IFS= read -r f; do [ -n "$f" ] && [ -e "$f" ] && rm -f "$f" && n=$((n+1)); done < tools/stale_0.9.12.txt
find assets -type d -empty -delete 2>/dev/null
echo "removed $n retired files. Update 0.9.12 is in place."

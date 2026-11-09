# Creator thumbnails
Real engine renders (not drawings) for the creator cards. Pipeline:
1. serve the repo (`python3 -m http.server 8765`) and start `node live.js` (Playwright, needs `cmd/` and `previews/` next to it);
2. wait for `cmd/ready`, load all models (`ACT.ensure([...ACT.RIG.models])`), run `setup.js`;
3. `python3 gen.py > cmd/N.js` renders 512x512 shots `previews/th_*.png`;
4. `python3 finish.py previews ../../assets/ui/thumbs` writes 384px webp.
The names match creator.js: face_<kit>, hair_<kit>, base_<base>, shape_<n>, body_<n>.

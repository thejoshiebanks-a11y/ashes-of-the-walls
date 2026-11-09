#!/usr/bin/env python3
"""usage: finish.py <previews dir> <out dir> : th_*.png -> out/*.webp (384px, high quality)"""
import sys,glob,os
from PIL import Image
src,dst=sys.argv[1:3]; os.makedirs(dst,exist_ok=True)
for f in sorted(glob.glob(os.path.join(src,'th_*.png'))):
    im=Image.open(f).convert('RGB').resize((384,384),Image.LANCZOS); n=os.path.basename(f)[3:-4]; im.save(os.path.join(dst,n+'.webp'),quality=90,method=6); print(n)

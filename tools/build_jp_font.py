#!/usr/bin/env python3
"""Builds the tiny Japanese font files the opening uses (Noto Serif CJK JP, SIL OFL), subset to the
characters that actually appear in the game text. Re-run it whenever you add Japanese text:

    python3 tools/build_jp_font.py

It scans js/story/opening.js and data/story/*.json for Japanese characters, adds every hiragana and
katakana letter plus tools/jp_extra.txt, and writes assets/fonts/aow-jp-<weight>.woff.
Source fonts: /usr/share/fonts/opentype/noto/NotoSerifCJK-{Medium,Black}.ttc  (or pass --src DIR)."""
import re, sys, glob, os
from fontTools.ttLib import TTCollection
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = '/usr/share/fonts/opentype/noto'
if '--src' in sys.argv: SRC = sys.argv[sys.argv.index('--src') + 1]
CJK = re.compile(r'[　-ヿ㐀-鿿＀-￯]')
chars = set()
for f in [os.path.join(ROOT, 'js/story/opening.js')] + glob.glob(os.path.join(ROOT, 'data/story/*.json')):
    chars |= set(CJK.findall(open(f, encoding='utf-8').read()))
extra = os.path.join(ROOT, 'tools/jp_extra.txt')
if os.path.exists(extra): chars |= set(CJK.findall(open(extra, encoding='utf-8').read()))
chars |= {chr(c) for c in range(0x3041, 0x3097)} | {chr(c) for c in range(0x30a1, 0x30fb)} | set('、。・「」『』ー〜！？')
chars |= {chr(c) for c in range(0x20, 0x7f)}
text = ''.join(sorted(chars))
print(len(chars), 'characters')
for name, w in (('Medium', 500), ('Black', 900)):
    ttc = TTCollection(os.path.join(SRC, 'NotoSerifCJK-%s.ttc' % name))
    font = next(f for f in ttc.fonts if 'JP' in f['name'].getDebugName(1))
    opt = subset.Options(); opt.flavor = 'woff'; opt.layout_features = ['*']; opt.notdef_outline = True; opt.name_IDs = ['*']
    sub = subset.Subsetter(opt); sub.populate(text=text); sub.subset(font)
    out = os.path.join(ROOT, 'assets/fonts/aow-jp-%d.woff' % w); font.flavor = 'woff'; font.save(out)
    print(out, os.path.getsize(out) // 1024, 'KB')

"""Build every base pack of the v3 character system.
 common (identical for every base): the new anime body, boxers, Levi scout kit + ODM gear, Furlan casual, traveller armour
 per base: its own head piece, skin tone, its own face, and a shared library of 6 faces and 8 hair styles transplanted onto every head."""
import sys, os, copy, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import build_bases as BB, compose as C
from build_bases import mean_skin, tone_match, move_hair, face_set, FACE_PART, assemble

S = os.environ['S']; OLD = S + '/w/g10/assets'; NEWDIR = S + '/nb/New base boy/'
BASES = ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen']      # face k = native face of BASES[k]
NEWM = {'nin': ('anime_boy_ninja_character_-_fully_rigged.glb', 'N0'), 'blen': ('anime_boy_for_blender..glb', 'F0')}
OFF = {k: 1000 * (i + 1) for i, k in enumerate(BASES)}

def dropflange(p):
    """the head piece of the old bodies ends in a collar flange (trapezius stump); the new body has its own smooth trapezius, so the flange would hover above it: keep only the neck column"""
    if p['mat'] != 'Skin_Body': return p
    P = p['pos']; bad = (np.abs(P[:, 0]) > .0615) & (P[:, 1] < 1.60); return C.sub(p, ~bad[p['ix'].reshape(-1, 3)].any(1))      # every triangle touching the flange goes; the neck tube (|x| <= .06) and the jaw stay
def load_sources():
    src = {}
    for k in ('boy', 'dragon', 'beauty', 'lad'):
        pr, wp, tx = BB.read_pack(os.path.join(OLD, k), k)
        head = [p for p in C.head_parts(pr, wp, wp) if p['mat'] == 'Skin_Body']            # head piece (no shift)
        faces = {int(p['mat'][4]): p for p in pr if False}
        head = [dropflange(p) for p in head]
        src[k] = dict(wp=wp, tx=tx, head=head, prims=pr)
    for k, (f, hid) in NEWM.items():
        raw, wp, texs = BB.convert(NEWDIR + f, BB.VRM, 'vrm', 512); own = BB.name_native(raw, hid, 'X'); tx = dict(enumerate(texs))
        body = [p for p in own if p['mat'] == 'Skin_Body'][0]; c = C.centroid(body); sel = (c[:, 1] > 1.545) & (np.abs(c[:, 0]) < .3)
        head = [C.sub(body, sel)]
        head = [dropflange(p) for p in head]
        src[k] = dict(wp=wp, tx=tx, head=head, prims=own, hid=hid)
    return src

def with_tex(prims, tx, off, T):
    out = []
    for p in prims:
        q = dict(p)
        if p.get('srctex') is not None: T[off + p['srctex']] = tx[p['srctex']]; q['srctex'] = off + p['srctex']
        out.append(q)
    return out

def hair_norm(parts, T):
    """the game dyes hair as tint x (luma*1.6+.05): a hair map whose own brightness is dark (or a flat untextured hair) would swallow every colour.
    Re-base every hair map to a mid-grey luma (keeping its strand/highlight structure and alpha) so each style takes the whole dye range."""
    done = {}
    for p in parts:
        if not p['mat'].startswith('Hair_'): continue
        t = p.get('srctex')
        if t is None:
            if 39999 not in T: T[39999] = Image.new('RGBA', (8, 8), (132, 132, 132, 255))
            p['srctex'] = 39999; continue
        if t in done: continue
        im = np.asarray(T[t].convert('RGBA'), float) / 255; l = im[..., :3] @ np.array([.299, .587, .114]); a = im[..., 3] > .5
        m = float(l[a].mean()) if a.any() else .3; sd = float(l[a].std()) if a.any() else .1
        nl = np.clip(.50 + (l - m) * min(2.4, max(1.0, .17 / max(sd, 1e-3))), .06, .98)             # mean .50, contrast raised if the map is flat
        out = np.concatenate([np.repeat(nl[..., None], 3, 2), im[..., 3:]], 2)
        T[t] = Image.fromarray((out * 255).astype(np.uint8), 'RGBA'); done[t] = 1

def warp_all(parts, w2):
    out = []
    for p in parts:
        q = dict(p); P0 = q['pos']; P1 = C.shoulder_warp(P0).astype(P0.dtype)
        if np.abs(P1 - P0).max() > 5e-4: q['pos'] = P1; q['nrm'] = C.wnorm(P1, q['ix'].reshape(-1, 3)).astype(q['nrm'].dtype)
        out.append(q)
    return out, C.shoulder_warp(w2)

def build(key, src, common, wpl, out_root):
    s = src[key]; T = {}; tone = {}
    for k in BASES:                                   # skin tone of each source's body
        sb = [p for p in src[k]['head'] if p['mat'] == 'Skin_Body'][0]; tone[k] = mean_skin(src[k]['tx'][sb['srctex']])
    bt = tone[key]; wp = s['wp']; d_tgt = wpl[17] + np.array([0, C.NECK, 0])
    parts = []
    # --- body in this base's skin colour
    T[900] = Image.new('RGBA', (8, 8), tuple(int(v) for v in bt) + (255,)); body = dict(common['body']); body['srctex'] = 900; parts.append(body)
    # --- head piece (native)
    for p in with_tex(s['head'], s['tx'], OFF[key], T): q = dict(p); q['pos'] = q['pos'] + (d_tgt - wp[17]); parts.append(q)
    # --- six faces: Face k = native face of BASES[k]
    for k, fk in enumerate(BASES):
        fs = src[fk]; own = [p for p in fs['prims'] if p['mat'] in FACE_PART] if fk in NEWM else [p for p in fs['prims'] if p['mat'].startswith('Face%d_' % k)]
        for p in own:
            q = dict(p); mat = ('Face%d_%s' % (k, FACE_PART[p['mat']])) if fk in NEWM else p['mat']; q['mat'] = mat; tx = fs['tx']
            q['pos'] = q['pos'] + (d_tgt - fs['wp'][17])
            if p.get('srctex') is not None:
                im = tx[p['srctex']]
                if mat.endswith('_Skin') and fk != key: im = tone_match(im, tone[fk], bt)
                elif mat.endswith('_Skin') and fk == key and fk in NEWM: im = im
                T[OFF[fk] + 500 + p['srctex'] + (0 if fk == key else 0) + (7000 if (fk != key and mat.endswith('_Skin')) else 0) + (100 * ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen'].index(key) if (fk != key and mat.endswith('_Skin')) else 0)] = im
                q['srctex'] = OFF[fk] + 500 + p['srctex'] + (7000 if (fk != key and mat.endswith('_Skin')) else 0) + (100 * ['boy', 'dragon', 'beauty', 'lad', 'nin', 'blen'].index(key) if (fk != key and mat.endswith('_Skin')) else 0)
            parts.append(q)
    # --- hair library (boy pack carries B0 C0 D0 K0 L0 Y0 + backs; plus the two new models)
    hp = [p for p in src['boy']['prims'] if p['mat'].startswith('Hair_')]
    for p in with_tex(hp, src['boy']['tx'], 20000, T): q = dict(p); q['pos'] = q['pos'] + (d_tgt - src['boy']['wp'][17]); parts.append(q)
    for nk in NEWM:
        hn = [p for p in src[nk]['prims'] if p['mat'].startswith('Hair_')]
        for p in with_tex(hn, src[nk]['tx'], OFF[nk] + 8000, T): q = dict(p); q['pos'] = q['pos'] + (d_tgt - src[nk]['wp'][17]); parts.append(q)
    # --- shared garments
    for p in common['garments']:
        q = dict(p); parts.append(q)
    T.update(common['T'])
    hair_norm(parts, T)
    wpo = wp.copy(); w2 = wpl.copy(); w2[18] = wp[18] + (d_tgt - wp[17]); w2[19] = wp[19] + (d_tgt - wp[17]); w2[17] = wpl[17]
    parts, w2 = warp_all(parts, w2)
    assemble(key, [(p, T) for p in parts], w2, os.path.join(out_root, key))

def common_parts():
    pr, wpo, tx0 = BB.read_pack(os.path.join(OLD, 'boy'), 'boy')
    lv, wpl, ltx, fu, wpf, ftx = C.donors(); T = {}
    sk = mean_skin(tx0[0]); T[900] = Image.new('RGBA', (8, 8), tuple(int(v) for v in sk) + (255,))
    body = C.new_body(sk); sc = C.scout(T, body); ca = C.casual(T, body); ar = C.armour(pr, T, body, wpo, wpl)
    # armour textures live in the boy pack's texture table: pull them in under unique ids
    for p in ar:
        if p.get('srctex') is not None: T[30000 + p['srctex']] = tx0[p['srctex']]; p['srctex'] = 30000 + p['srctex']
    gar = [p for p in sc + ca + ar if p['mat'] in ('Outfit_Scout_Body', 'Outfit_Scout_Boots', 'Outfit_Peasant_Body', 'Outfit_Peasant_Legs', 'Outfit_Peasant_Feet', 'Outfit_Ranger_Body', 'Outfit_Ranger_Legs', 'Outfit_Ranger_FeetBoots')]
    body = C.relief(body); body = C.tuck_body(body, gar); C.reweight(sc + ca + ar, body); bx = C.boxers(body, T)
    return dict(body=body, garments=[bx] + sc + ca + ar, T=T), wpl

if __name__ == '__main__':
    out = sys.argv[1]; keys = sys.argv[2:] or BASES
    src = load_sources(); common, wpl = common_parts()
    for k in keys: build(k, src, common, wpl, out)

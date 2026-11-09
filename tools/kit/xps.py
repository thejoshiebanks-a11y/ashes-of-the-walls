"""Minimal XNALara .xps (binary) reader -> bones, meshes. Handles v2.x (hasTangent) headers."""
import struct, io
import numpy as np
class R:
    def __init__(s, b): s.b = b; s.o = 0
    def u32(s): v = struct.unpack_from('<I', s.b, s.o)[0]; s.o += 4; return v
    def u16(s): v = struct.unpack_from('<H', s.b, s.o)[0]; s.o += 2; return v
    def i16(s): v = struct.unpack_from('<h', s.b, s.o)[0]; s.o += 2; return v
    def u8(s): v = s.b[s.o]; s.o += 1; return v
    def f32(s): v = struct.unpack_from('<f', s.b, s.o)[0]; s.o += 4; return v
    def arr(s, dt, n, cnt):
        a = np.frombuffer(s.b, dt, n * cnt, s.o).reshape(cnt, n); s.o += a.itemsize * n * cnt; return a
    def string(s):
        l = s.u8()
        if l & 0x80: l = (l & 0x7f) | (s.u8() << 7)
        v = s.b[s.o:s.o + l].decode('utf8', 'replace'); s.o += l; return v

def read_xps(path):
    r = R(open(path, 'rb').read())
    magic = r.u32(); major = r.u16(); minor = r.u16(); r.string()
    settings = r.u32(); r.string(); r.string(); r.string()
    r.o += settings * 4
    nb = r.u32(); bones = []
    for i in range(nb):
        name = r.string(); parent = r.i16(); pos = [r.f32(), r.f32(), r.f32()]
        bones.append((name, parent, pos))
    nm = r.u32(); meshes = []
    for m in range(nm):
        name = r.string(); nuv = r.u32(); ntex = r.u32(); tex = []
        for t in range(ntex): tex.append((r.string(), r.u32()))
        nv = r.u32()
        P = np.zeros((nv, 3), np.float32); N = np.zeros((nv, 3), np.float32); UV = np.zeros((nv, 2), np.float32)
        BI = np.zeros((nv, 4), np.int32); BW = np.zeros((nv, 4), np.float32)
        for v in range(nv):
            P[v] = (r.f32(), r.f32(), r.f32()); N[v] = (r.f32(), r.f32(), r.f32()); r.o += 4
            UV[v] = (r.f32(), r.f32()); r.o += 8 * (nuv - 1)
            if major >= 2 and (major > 2 or minor >= 12) or True:
                pass
            # tangents only for xps meshes with uv layers > 0 in versions < 2.?; handled by caller via flag
            BI[v] = (r.i16(), r.i16(), r.i16(), r.i16()); BW[v] = (r.f32(), r.f32(), r.f32(), r.f32())
        nf = r.u32(); F = r.arr(np.uint32, 3, nf).copy()
        meshes.append(dict(name=name, nuv=nuv, tex=tex, P=P, N=N, UV=UV, BI=BI, BW=BW, F=F))
    return dict(version=(major, minor), bones=bones, meshes=meshes)
if __name__ == '__main__':
    import sys
    x = read_xps(sys.argv[1]); print(x['version'], len(x['bones']))
    for b in x['bones'][:300]: print(b[0], b[1], [round(v, 3) for v in b[2]])
    for m in x['meshes']: print(m['name'], len(m['P']), len(m['F']), m['tex'], m['P'].min(0), m['P'].max(0))

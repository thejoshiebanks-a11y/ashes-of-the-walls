import struct, zlib, numpy as np
def parse(path):
    d = open(path, 'rb').read(); ver = struct.unpack('<I', d[23:27])[0]; big = ver >= 7500
    def rd(o):
        if big: end, npr, pl, nl = struct.unpack('<QQQB', d[o:o+25]); o += 25
        else: end, npr, pl, nl = struct.unpack('<IIIB', d[o:o+13]); o += 13
        if end == 0: return None, o
        name = d[o:o+nl].decode('latin1'); o += nl; props = []; p = o
        for _ in range(npr):
            t = chr(d[p]); p += 1
            if t in 'YCIFDL':
                fmt, sz = {'Y': ('<h', 2), 'C': ('<B', 1), 'I': ('<i', 4), 'F': ('<f', 4), 'D': ('<d', 8), 'L': ('<q', 8)}[t]
                props.append(struct.unpack(fmt, d[p:p+sz])[0]); p += sz
            elif t in 'fdlib':
                n, enc, cl = struct.unpack('<III', d[p:p+12]); p += 12; raw = d[p:p+cl]; p += cl
                if enc: raw = zlib.decompress(raw)
                props.append(np.frombuffer(raw, {'f': '<f4', 'd': '<f8', 'l': '<i8', 'i': '<i4', 'b': 'u1'}[t], n))
            elif t in 'SR':
                n = struct.unpack('<I', d[p:p+4])[0]; p += 4; props.append(d[p:p+n]); p += n
        o += pl; kids = []
        while o < end:
            k, o = rd(o)
            if k is None: continue
            kids.append(k)
        return (name, props, kids), end
    o = 27; top = []
    while o < len(d) - 32:
        n, o2 = rd(o)
        if n is None: break
        top.append(n); o = o2
    return ver, top
def find(nodes, name): return [n for n in nodes if n[0] == name]

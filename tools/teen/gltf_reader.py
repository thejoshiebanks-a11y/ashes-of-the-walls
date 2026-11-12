"""Minimal glTF/GLB reader (numpy). Used by the model converter."""
import json, struct, base64, os
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}

class GLTF:
    def __init__(self, path):
        self.path = path; self.dir = os.path.dirname(path)
        raw = open(path, 'rb').read()
        self.glb_bin = None
        if raw[:4] == b'glTF':
            _, total = struct.unpack('<II', raw[4:12]); off = 12
            while off < total:
                ln, ty = struct.unpack('<II', raw[off:off + 8]); chunk = raw[off + 8:off + 8 + ln]; off += 8 + ln
                if ty == 0x4E4F534A: self.j = json.loads(chunk)
                elif ty == 0x004E4942: self.glb_bin = chunk
        else:
            self.j = json.loads(raw)
        self.buffers = []
        for b in self.j.get('buffers', []):
            uri = b.get('uri')
            if uri is None: self.buffers.append(self.glb_bin)
            elif uri.startswith('data:'): self.buffers.append(base64.b64decode(uri.split(',', 1)[1]))
            else: self.buffers.append(open(os.path.join(self.dir, uri.replace('%20', ' ')), 'rb').read())

    def view_bytes(self, vi):
        bv = self.j['bufferViews'][vi]; b = self.buffers[bv['buffer']]
        o = bv.get('byteOffset', 0); return b[o:o + bv['byteLength']], bv.get('byteStride')

    def accessor(self, ai):
        a = self.j['accessors'][ai]; nc = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); n = a['count']
        if 'bufferView' in a:
            data, stride = self.view_bytes(a['bufferView']); off = a.get('byteOffset', 0); esz = nc * dt.itemsize
            if stride and stride != esz:
                arr = np.empty((n, nc), dt)
                for i in range(n): arr[i] = np.frombuffer(data, dt, nc, off + i * stride)
            else:
                arr = np.frombuffer(data, dt, n * nc, off).reshape(n, nc).copy()
        else:
            arr = np.zeros((n, nc), dt)
        if a.get('normalized'):
            if dt == np.uint8: arr = arr.astype(np.float32) / 255
            elif dt == np.uint16: arr = arr.astype(np.float32) / 65535
            elif dt == np.int8: arr = np.maximum(arr.astype(np.float32) / 127, -1)
            elif dt == np.int16: arr = np.maximum(arr.astype(np.float32) / 32767, -1)
        return arr

    def node_local(self, n):
        """column-major 4x4 numpy (as the engine expects: element [col][row] flattened col-major)."""
        node = self.j['nodes'][n]
        if 'matrix' in node: return np.array(node['matrix'], np.float64).reshape(4, 4).T  # to row-major math form
        t = node.get('translation', [0, 0, 0]); q = node.get('rotation', [0, 0, 0, 1]); s = node.get('scale', [1, 1, 1])
        x, y, z, w = q
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M = np.eye(4); M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M

    def parents(self):
        p = {}
        for i, nd in enumerate(self.j['nodes']):
            for c in nd.get('children', []): p[c] = i
        return p

    def world(self, n, par=None):
        par = par or self.parents(); M = self.node_local(n)
        while n in par: n = par[n]; M = self.node_local(n) @ M
        return M

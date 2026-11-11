import struct, zlib
class Node:
    __slots__=('name','props','children')
    def __init__(s,n): s.name=n; s.props=[]; s.children=[]
    def find(s,n): return [c for c in s.children if c.name==n]
    def first(s,n):
        r=s.find(n); return r[0] if r else None
def parse(path):
    b=open(path,'rb').read(); assert b[:20]==b'Kaydara FBX Binary  '; ver=struct.unpack('<I',b[23:27])[0]; big=ver>=7500; pos=27
    def rd(fmt,n): 
        nonlocal pos; v=struct.unpack_from(fmt,b,pos); pos+=n; return v
    def node():
        nonlocal pos
        if big: end,np_,pl=struct.unpack_from('<QQQ',b,pos); pos+=24
        else: end,np_,pl=struct.unpack_from('<III',b,pos); pos+=12
        nl=b[pos]; pos+=1
        if end==0: return None
        n=Node(b[pos:pos+nl].decode()); pos+=nl
        for _ in range(np_):
            t=chr(b[pos]); pos+=1
            if t in 'YCFDIL':
                f={'Y':'<h','C':'<B','F':'<f','D':'<d','I':'<i','L':'<q'}[t]; sz=struct.calcsize(f); n.props.append(struct.unpack_from(f,b,pos)[0]); pos+=sz
            elif t in 'fdilb':
                ln,enc,cl=struct.unpack_from('<III',b,pos); pos+=12; raw=b[pos:pos+cl]; pos+=cl
                if enc: raw=zlib.decompress(raw)
                f={'f':'f','d':'d','i':'i','l':'q','b':'b'}[t]; n.props.append(list(struct.unpack('<%d%s'%(ln,f),raw)))
            elif t in 'SR':
                ln=struct.unpack_from('<I',b,pos)[0]; pos+=4; raw=b[pos:pos+ln]; pos+=ln; n.props.append(raw.decode('utf8','ignore') if t=='S' else raw)
        while pos<end:
            c=node()
            if c is None: break
            n.children.append(c)
        pos=end; return n
    root=Node('root')
    while pos<len(b)-160:
        n=node()
        if n is None: break
        root.children.append(n)
    return root,ver

// Quadric edge-collapse decimation for skinned, UV-mapped meshes (Garland-Heckbert).
// Vertices on UV/material seams (edges that have a single incident face in the UNWELDED mesh) are locked, so the texture never smears
// across an atlas island. Skin weights are blended on collapse. usage: decimate in.bin out.bin target_faces
// in.bin: u32 nv, u32 nf, then f32 pos[nv*3], f32 uv[nv*2], u8 joints[nv*4], f32 weights[nv*4], u32 idx[nf*3]
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cmath>
#include <vector>
#include <queue>
#include <map>
#include <algorithm>
using namespace std;
struct V { double p[3]; float uv[2]; uint8_t j[4]; float w[4]; double Q[10]; bool lock = false, dead = false; int ver = 0; vector<int> f; };
struct F { int v[3]; bool dead = false; };
static vector<V> vs; static vector<F> fs;
static void planeQ(const double* p0, const double* p1, const double* p2, double* Q) {
  double u[3] = {p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]}, w[3] = {p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]};
  double n[3] = {u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]}; double l = sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]); double area = l*.5;
  if (l < 1e-18) { for (int i = 0; i < 10; i++) Q[i] = 0; return; } n[0] /= l; n[1] /= l; n[2] /= l; double d = -(n[0]*p0[0]+n[1]*p0[1]+n[2]*p0[2]);
  double a = n[0], b = n[1], c = n[2];
  Q[0]=a*a*area; Q[1]=a*b*area; Q[2]=a*c*area; Q[3]=a*d*area; Q[4]=b*b*area; Q[5]=b*c*area; Q[6]=b*d*area; Q[7]=c*c*area; Q[8]=c*d*area; Q[9]=d*d*area;
}
static double evalQ(const double* Q, const double* p) {
  double x=p[0], y=p[1], z=p[2];
  return Q[0]*x*x + 2*Q[1]*x*y + 2*Q[2]*x*z + 2*Q[3]*x + Q[4]*y*y + 2*Q[5]*y*z + 2*Q[6]*y + Q[7]*z*z + 2*Q[8]*z + Q[9];
}
struct E { double cost; int a, b, va, vb; double t; bool operator<(const E& o) const { return cost > o.cost; } };
static double normalOf(const double* a, const double* b, const double* c, double* n) {
  double u[3] = {b[0]-a[0], b[1]-a[1], b[2]-a[2]}, w[3] = {c[0]-a[0], c[1]-a[1], c[2]-a[2]};
  n[0]=u[1]*w[2]-u[2]*w[1]; n[1]=u[2]*w[0]-u[0]*w[2]; n[2]=u[0]*w[1]-u[1]*w[0]; double l = sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]); if (l > 1e-20) { n[0]/=l; n[1]/=l; n[2]/=l; } return l;
}
// would moving vertex `from` to position q (dropping faces that contain `to`) flip or collapse any neighbouring face?
static bool flips(int from, int to, const double* q) {
  for (int fi : vs[from].f) { F& f = fs[fi]; if (f.dead) continue; if (f.v[0]==to || f.v[1]==to || f.v[2]==to) continue;
    double* P[3]; double Pn[3][3]; for (int k = 0; k < 3; k++) { if (f.v[k] == from) { Pn[k][0]=q[0]; Pn[k][1]=q[1]; Pn[k][2]=q[2]; P[k]=Pn[k]; } else P[k] = vs[f.v[k]].p; }
    double n0[3], n1[3]; double l0 = normalOf(vs[f.v[0]].p, vs[f.v[1]].p, vs[f.v[2]].p, n0), l1 = normalOf(P[0], P[1], P[2], n1);
    if (l1 < 1e-12) return true; if (l0 > 1e-12 && n0[0]*n1[0]+n0[1]*n1[1]+n0[2]*n1[2] < .35) return true; }
  return false;
}
static bool considerEdge(int a, int b, priority_queue<E>& pq) {
  V &A = vs[a], &B = vs[b]; if (A.lock && B.lock) return false;
  double Q[10]; for (int i = 0; i < 10; i++) Q[i] = A.Q[i] + B.Q[i];
  double mid[3] = {(A.p[0]+B.p[0])/2, (A.p[1]+B.p[1])/2, (A.p[2]+B.p[2])/2};
  double best = 1e300, bt = 0;
  if (A.lock) { best = evalQ(Q, A.p); bt = 0; }
  else if (B.lock) { best = evalQ(Q, B.p); bt = 1; }
  else { double ca = evalQ(Q, A.p), cb = evalQ(Q, B.p), cm = evalQ(Q, mid); best = ca; bt = 0; if (cb < best) { best = cb; bt = 1; } if (cm < best * .98) { best = cm; bt = .5; } }
  double dx = A.p[0]-B.p[0], dy = A.p[1]-B.p[1], dz = A.p[2]-B.p[2]; best += 1e-9 * (dx*dx+dy*dy+dz*dz);      // prefer short edges when the error is zero
  pq.push({best, a, b, A.ver, B.ver, bt}); return true;
}
int main(int argc, char** argv) {
  FILE* fp = fopen(argv[1], "rb"); uint32_t nv, nf; fread(&nv, 4, 1, fp); fread(&nf, 4, 1, fp);
  vector<float> pos(nv*3), uv(nv*2), w(nv*4); vector<uint8_t> jj(nv*4); vector<uint32_t> idx(nf*3);
  fread(pos.data(), 4, nv*3, fp); fread(uv.data(), 4, nv*2, fp); fread(jj.data(), 1, nv*4, fp); fread(w.data(), 4, nv*4, fp); fread(idx.data(), 4, nf*3, fp); fclose(fp);
  size_t target = (size_t)atoi(argv[3]);
  vs.resize(nv); fs.resize(nf);
  for (uint32_t i = 0; i < nv; i++) { for (int k = 0; k < 3; k++) vs[i].p[k] = pos[i*3+k]; vs[i].uv[0] = uv[i*2]; vs[i].uv[1] = uv[i*2+1]; for (int k = 0; k < 4; k++) { vs[i].j[k] = jj[i*4+k]; vs[i].w[k] = w[i*4+k]; } for (int k = 0; k < 10; k++) vs[i].Q[k] = 0; }
  map<pair<int,int>, int> ec;
  for (uint32_t i = 0; i < nf; i++) { for (int k = 0; k < 3; k++) { fs[i].v[k] = idx[i*3+k]; vs[idx[i*3+k]].f.push_back(i); }
    double Qf[10]; planeQ(vs[fs[i].v[0]].p, vs[fs[i].v[1]].p, vs[fs[i].v[2]].p, Qf); for (int k = 0; k < 3; k++) for (int q = 0; q < 10; q++) vs[fs[i].v[k]].Q[q] += Qf[q];
    for (int k = 0; k < 3; k++) { int a = fs[i].v[k], b = fs[i].v[(k+1)%3]; if (a > b) swap(a, b); ec[{a, b}]++; } }
  size_t nlock = 0; for (auto& e : ec) if (e.second == 1) { if (!vs[e.first.first].lock) nlock++; if (!vs[e.first.second].lock) nlock++; vs[e.first.first].lock = vs[e.first.second].lock = true; }
  // a boundary quadric keeps open borders straight; seams are locked anyway
  priority_queue<E> pq; for (auto& e : ec) considerEdge(e.first.first, e.first.second, pq);
  size_t alive = nf; size_t guard = 0;
  while (alive > target && !pq.empty()) {
    E e = pq.top(); pq.pop(); V &A = vs[e.a], &B = vs[e.b]; if (A.dead || B.dead || A.ver != e.va || B.ver != e.vb) continue;
    int keep = e.t > .75 ? e.b : e.a, drop = keep == e.a ? e.b : e.a; if (A.lock && !B.lock) { keep = e.a; drop = e.b; } else if (B.lock && !A.lock) { keep = e.b; drop = e.a; }
    V &K = vs[keep], &D = vs[drop];
    double q[3]; if (e.t == .5) { for (int k = 0; k < 3; k++) q[k] = (K.p[k] + D.p[k]) / 2; } else { for (int k = 0; k < 3; k++) q[k] = K.p[k]; }
    if (flips(drop, keep, q) || flips(keep, drop, q)) { continue; }
    // attributes
    if (e.t == .5 && !K.lock) { K.uv[0] = (K.uv[0] + D.uv[0]) / 2; K.uv[1] = (K.uv[1] + D.uv[1]) / 2; }
    { // blend skin weights
      map<int, float> m; for (int k = 0; k < 4; k++) { if (K.w[k] > 0) m[K.j[k]] += K.w[k] * (e.t == .5 ? .5f : 1.f); if (D.w[k] > 0) m[D.j[k]] += D.w[k] * (e.t == .5 ? .5f : 0.f); }
      vector<pair<float,int>> v; for (auto& x : m) v.push_back({x.second, x.first}); sort(v.rbegin(), v.rend()); float s = 0; for (int k = 0; k < 4 && k < (int)v.size(); k++) s += v[k].first;
      for (int k = 0; k < 4; k++) { if (k < (int)v.size() && s > 0) { K.j[k] = v[k].second; K.w[k] = v[k].first / s; } else { K.j[k] = 0; K.w[k] = 0; } } }
    for (int k = 0; k < 3; k++) K.p[k] = q[k]; for (int i = 0; i < 10; i++) K.Q[i] += D.Q[i];
    for (int fi : D.f) { F& f = fs[fi]; if (f.dead) continue; bool hasK = f.v[0]==keep || f.v[1]==keep || f.v[2]==keep;
      if (hasK) { f.dead = true; alive--; for (int k = 0; k < 3; k++) { int vv = f.v[k]; if (vv != drop) { auto& L = vs[vv].f; L.erase(remove(L.begin(), L.end(), fi), L.end()); } } }
      else { for (int k = 0; k < 3; k++) if (f.v[k] == drop) f.v[k] = keep; K.f.push_back(fi); } }
    D.dead = true; D.f.clear(); K.ver++; 
    // re-queue the edges around the survivor
    vector<int> nb; for (int fi : K.f) { F& f = fs[fi]; if (f.dead) continue; for (int k = 0; k < 3; k++) if (f.v[k] != keep) nb.push_back(f.v[k]); } sort(nb.begin(), nb.end()); nb.erase(unique(nb.begin(), nb.end()), nb.end());
    for (int n : nb) { vs[n].ver++; considerEdge(keep, n, pq); }
    for (int n : nb) for (int fi : vs[n].f) { F& f = fs[fi]; if (f.dead) continue; for (int k = 0; k < 3; k++) { int o = f.v[k]; if (o != n && o != keep && o > n) considerEdge(n, o, pq); } }
    guard++;
  }
  vector<int> remap(nv, -1); vector<uint32_t> outi; int nn = 0; for (auto& f : fs) if (!f.dead) for (int k = 0; k < 3; k++) { if (remap[f.v[k]] < 0) remap[f.v[k]] = nn++; }
  FILE* fo = fopen(argv[2], "wb"); uint32_t onv = nn, onf = alive; fwrite(&onv, 4, 1, fo); fwrite(&onf, 4, 1, fo);
  vector<float> op(nn*3), ou(nn*2), ow(nn*4); vector<uint8_t> oj(nn*4);
  for (uint32_t i = 0; i < nv; i++) if (remap[i] >= 0) { int r = remap[i]; for (int k = 0; k < 3; k++) op[r*3+k] = vs[i].p[k]; ou[r*2] = vs[i].uv[0]; ou[r*2+1] = vs[i].uv[1]; for (int k = 0; k < 4; k++) { oj[r*4+k] = vs[i].j[k]; ow[r*4+k] = vs[i].w[k]; } }
  for (auto& f : fs) if (!f.dead) for (int k = 0; k < 3; k++) outi.push_back(remap[f.v[k]]);
  fwrite(op.data(), 4, nn*3, fo); fwrite(ou.data(), 4, nn*2, fo); fwrite(oj.data(), 1, nn*4, fo); fwrite(ow.data(), 4, nn*4, fo); fwrite(outi.data(), 4, outi.size(), fo); fclose(fo);
  fprintf(stderr, "locked(seam) verts %zu; %u -> %u verts, %u -> %zu faces\n", nlock, nv, onv, nf, alive); return 0;
}

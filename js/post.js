/* post.js - Phase 2 post-processing pipeline (additive; removing this file from boot.js restores the old direct-to-screen path).
   scene -> off-screen FBO (RGBA8 colour + depth TEXTURE) -> bloom chain (bright pass, 3 down, 3 up) -> ONE post shader:
   FXAA -> bloom -> sun light shafts -> SSAO-lite -> finishing grade -> vignette -> film grain -> screen.
   The scene shaders keep their own ACES + anime grade (display space); this pass does NOT tone-map again, so nothing is graded twice.
   Levels (set by quality.js tiers): 0 off (direct path), 1 FXAA + vignette + grain, 2 + bloom + light shafts, 3 + SSAO-lite, bigger bloom. */
(function () {
  'use strict';
  const VS = `#version 300 es
out vec2 v_uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v_uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const BRIGHT = `#version 300 es
precision mediump float;in vec2 v_uv;uniform sampler2D u_t;uniform vec2 u_px;uniform float u_th;out vec4 o;
void main(){vec3 c=(texture(u_t,v_uv+u_px*vec2(-1,-1)).rgb+texture(u_t,v_uv+u_px*vec2(1,-1)).rgb+texture(u_t,v_uv+u_px*vec2(-1,1)).rgb+texture(u_t,v_uv+u_px*vec2(1,1)).rgb)*.25;
 float l=dot(c,vec3(.299,.587,.114));float k=smoothstep(u_th,u_th+.28,l);o=vec4(c*k*k,1.);}`;
  const DOWN = `#version 300 es
precision mediump float;in vec2 v_uv;uniform sampler2D u_t;uniform vec2 u_px;out vec4 o;
void main(){vec3 c=texture(u_t,v_uv).rgb*4.;c+=texture(u_t,v_uv+u_px*vec2(-1,-1)).rgb+texture(u_t,v_uv+u_px*vec2(1,-1)).rgb+texture(u_t,v_uv+u_px*vec2(-1,1)).rgb+texture(u_t,v_uv+u_px*vec2(1,1)).rgb;o=vec4(c/8.,1.);}`;
  const UP = `#version 300 es
precision mediump float;in vec2 v_uv;uniform sampler2D u_t;uniform vec2 u_px;out vec4 o;
void main(){vec3 c=texture(u_t,v_uv+u_px*vec2(-1,0)).rgb+texture(u_t,v_uv+u_px*vec2(1,0)).rgb+texture(u_t,v_uv+u_px*vec2(0,-1)).rgb+texture(u_t,v_uv+u_px*vec2(0,1)).rgb;
 c+=(texture(u_t,v_uv+u_px*vec2(-1,-1)).rgb+texture(u_t,v_uv+u_px*vec2(1,-1)).rgb+texture(u_t,v_uv+u_px*vec2(-1,1)).rgb+texture(u_t,v_uv+u_px*vec2(1,1)).rgb)*.5;o=vec4(c/6.,1.);}`;
  const POST = `#version 300 es
precision highp float;in vec2 v_uv;uniform sampler2D u_scene;uniform sampler2D u_bloom;uniform sampler2D u_depth;
uniform vec2 u_px;uniform float u_bl;uniform float u_time;uniform vec4 u_sun;uniform vec3 u_sunC;uniform float u_god;uniform float u_ao;uniform vec2 u_nf;uniform float u_vig;uniform float u_grain;uniform float u_fx;uniform float u_warm;
out vec4 o;
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 fxaa(vec2 uv){
 vec3 rM=texture(u_scene,uv).rgb;float lM=luma(rM);
 float lNW=luma(texture(u_scene,uv+u_px*vec2(-1,-1)).rgb),lNE=luma(texture(u_scene,uv+u_px*vec2(1,-1)).rgb),lSW=luma(texture(u_scene,uv+u_px*vec2(-1,1)).rgb),lSE=luma(texture(u_scene,uv+u_px*vec2(1,1)).rgb);
 float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))),lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
 if(lMax-lMin<max(.0312,lMax*.125))return rM;
 vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
 float dr=max((lNW+lNE+lSW+lSE)*.25*.125,1./128.);float rc=1./(min(abs(dir.x),abs(dir.y))+dr);dir=clamp(dir*rc,vec2(-8.),vec2(8.))*u_px;
 vec3 a=.5*(texture(u_scene,uv+dir*(1./3.-.5)).rgb+texture(u_scene,uv+dir*(2./3.-.5)).rgb);
 vec3 b=a*.5+.25*(texture(u_scene,uv+dir*-.5).rgb+texture(u_scene,uv+dir*.5).rgb);
 float lb=luma(b);return (lb<lMin||lb>lMax)?a:b;}
float lin(float z){float n=u_nf.x,f=u_nf.y;return 2.*n*f/(f+n-(z*2.-1.)*(f-n));}
void main(){
 vec2 uv=v_uv;vec3 c=u_fx>.5?fxaa(uv):texture(u_scene,uv).rgb;
 float z=texture(u_depth,uv).r;
 if(u_ao>0.&&z<.99999){float zl=lin(z);float occ=0.;float rad=mix(5.,26.,1.-clamp(zl/160.,0.,1.));
  for(int i=0;i<8;i++){float a=float(i)*.785398+fract(sin(dot(uv*1000.,vec2(12.9898,78.233)))*43758.5)*.785;vec2 off=vec2(cos(a),sin(a))*rad*u_px*(.55+.45*float(i&1));
   float zs=lin(texture(u_depth,uv+off).r);float d=zl-zs;occ+=smoothstep(.15,.9,d/(zl*.02+.4))*(1.-smoothstep(1.,1.+zl*.05+4.,d));}
  c*=1.-clamp(occ/8.*u_ao,0.,.55);}
 if(u_bl>0.){vec3 bl=texture(u_bloom,uv).rgb;c+=bl*u_bl*mix(vec3(1.0,1.0,1.02),vec3(1.08,1.0,.9),u_warm);}
 if(u_god>0.&&u_sun.w>0.){vec2 d=(u_sun.xy-uv);float len=length(d);vec2 st=d/24.*.92;vec2 p=uv+st*fract(sin(dot(uv*vec2(913.,517.),vec2(12.9898,78.233)))*43758.5453);float acc=0.,w=1.;
  for(int i=0;i<24;i++){p+=st;float zz=texture(u_depth,p).r;float sk=step(.99999,zz);vec3 s=texture(u_scene,p).rgb;acc+=sk*smoothstep(.55,1.,luma(s))*w;w*=.93;}
  float fall=1.-smoothstep(.2,1.4,len);c+=u_sunC*acc/24.*u_god*u_sun.w*(.35+fall);}
 // finishing grade (once): gentle filmic S-curve + warmth in the lights, cool lift in the deepest shadows
 float l=luma(c);c=mix(vec3(l),c,1.07);c=mix(c,c*c*(3.-2.*c),.10);c*=mix(vec3(.99,1.0,1.02),mix(vec3(1.0),vec3(1.03,1.0,.95),u_warm),smoothstep(.1,.7,l));
 vec2 q=uv-.5;float v=1.-dot(q,q)*u_vig*1.9;c*=clamp(v,.25,1.);
 float g=fract(sin(dot(uv*vec2(1731.,1283.)+fract(u_time*.37)*91.,vec2(12.9898,78.233)))*43758.5453)-.5;c+=g*u_grain*(1.-l*.6);
 o=vec4(clamp(c,0.,1.),1.);}`;

  function mk(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('post shader: ' + gl.getShaderInfoLog(s)); return s; }
  function prog(gl, fs) { const p = gl.createProgram(); gl.attachShader(p, mk(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('post link: ' + gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; }

  class Post {
    constructor(E) { this.E = E; this.gl = E.gl; this.level = 0; this.on = false; this.W = 0; this.H = 0; this.ok = null; this.vao = this.gl.createVertexArray(); this.strength = 1; this.cfg = { th2: 0.78, th3: 0.72, bl2: 0.34, bl3: 0.42, god: 0.17, ao: 0.8, vig: 0.5, grain: 0.03 }; }
    init() {
      if (this.ok !== null) return this.ok; const gl = this.gl;
      try { this.progs = { bright: prog(gl, BRIGHT), down: prog(gl, DOWN), up: prog(gl, UP), post: prog(gl, POST) }; this.ok = true; } catch (e) { console.warn('[post] disabled:', e.message); this.ok = false; }
      return this.ok;
    }
    tex(w, h, depth) {
      const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      if (depth) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const f = depth ? gl.NEAREST : gl.LINEAR; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t;
    }
    free() { const gl = this.gl; if (this.sc) { gl.deleteTexture(this.sc.c); gl.deleteTexture(this.sc.d); gl.deleteFramebuffer(this.sc.f); } if (this.bl) for (const b of this.bl) { gl.deleteTexture(b.t); gl.deleteFramebuffer(b.f); } this.sc = null; this.bl = null; }
    alloc(W, H) {
      const gl = this.gl; this.free(); const c = this.tex(W, H, false), d = this.tex(W, H, true), f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, c, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, d, 0);
      const okc = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; this.sc = { c, d, f };
      this.bl = []; let w = W, h = H; const n = this.level >= 3 ? 4 : 3;
      for (let i = 0; i < n; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); const t = this.tex(w, h, false), fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); this.bl.push({ t, f: fb, w, h }); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); this.W = W; this.H = H; this.n = n; return okc;
    }
    set(level) { this.level = level | 0; if (this.level <= 0 || !this.init()) { this.on = false; return; } this.on = true; this.W = 0; }   // realloc on next frame
    /* start of the scene pass: draw into the off-screen target. returns false (and turns post off) if the target is unusable */
    begin(W, H) {
      if (!this.on) return false; const gl = this.gl;
      if (W !== this.W || H !== this.H) { if (!this.alloc(W, H)) { console.warn('[post] framebuffer incomplete, using direct path'); this.on = false; this.ok = false; this.free(); return false; } }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sc.f); return true;
    }
    pass(P, srcTex, dst, w, h, extra) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, dst); gl.viewport(0, 0, w, h); gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex); gl.uniform1i(P.u.u_t, 0); gl.uniform2f(P.u.u_px, 1 / (w), 1 / (h)); if (extra) extra(P); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    /* end of the scene pass: bloom chain + the single post shader into the screen. sunScreen = [x,y,visible] in 0..1 uv or null */
    end(cam, sunUv, sunCol, warm) {
      const gl = this.gl, L = this.level, W = this.W, H = this.H, E = this.E; gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
      const bloomOn = L >= 2 && this.strength > 0;
      if (bloomOn) {
        const b = this.bl, th = L >= 3 ? this.cfg.th3 : this.cfg.th2;
        this.pass(this.progs.bright, this.sc.c, b[0].f, b[0].w, b[0].h, P => { gl.uniform1f(P.u.u_th, th); gl.uniform2f(P.u.u_px, 0.5 / b[0].w, 0.5 / b[0].h); });
        for (let i = 1; i < b.length; i++) this.pass(this.progs.down, b[i - 1].t, b[i].f, b[i].w, b[i].h);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        for (let i = b.length - 1; i > 0; i--) this.pass(this.progs.up, b[i].t, b[i - 1].f, b[i - 1].w, b[i - 1].h);
        gl.disable(gl.BLEND);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); const P = this.progs.post, u = P.u; gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sc.c); gl.uniform1i(u.u_scene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomOn ? this.bl[0].t : this.sc.c); gl.uniform1i(u.u_bloom, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.sc.d); gl.uniform1i(u.u_depth, 2);
      const grade = E.grade === undefined ? 1 : E.grade;
      gl.uniform2f(u.u_px, 1 / W, 1 / H); gl.uniform1f(u.u_bl, bloomOn ? (L >= 3 ? this.cfg.bl3 : this.cfg.bl2) * this.strength : 0); gl.uniform1f(u.u_time, E.time || 0);
      const sv = sunUv && L >= 2 ? sunUv : null; gl.uniform4f(u.u_sun, sv ? sv[0] : 0, sv ? sv[1] : 0, 0, sv ? sv[2] : 0); gl.uniform3fv(u.u_sunC, sunCol || [1, .8, .5]); gl.uniform1f(u.u_god, L >= 2 ? this.cfg.god : 0);
      gl.uniform1f(u.u_ao, L >= 3 ? this.cfg.ao : 0); gl.uniform2f(u.u_nf, cam.near || 0.3, cam.far || 3500); gl.uniform1f(u.u_vig, this.cfg.vig * grade + 0.1); gl.uniform1f(u.u_grain, this.cfg.grain); gl.uniform1f(u.u_fx, 1); gl.uniform1f(u.u_warm, warm === undefined ? 1 : warm);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(E.vao); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    }
  }
  window.AotPost = Post;
})();

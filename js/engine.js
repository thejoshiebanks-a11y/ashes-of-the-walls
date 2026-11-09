/* Shiganshina viewer engine — dependency-free WebGL2 renderer */
(function(){
'use strict';
const V3={sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}};
const M4={
 id:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o},
 persp(fov,asp,n,f){const t=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=t/asp;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o},
 ortho(l,r,b,t,n,f){const o=M4.id();o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);return o},
 look(e,c,u){const z=V3.norm(V3.sub(e,c)),x=V3.norm(V3.cross(u,z)),y=V3.cross(z,x),o=new Float32Array(16);
  o[0]=x[0];o[4]=x[1];o[8]=x[2];o[1]=y[0];o[5]=y[1];o[9]=y[2];o[2]=z[0];o[6]=z[1];o[10]=z[2];
  o[12]=-V3.dot(x,e);o[13]=-V3.dot(y,e);o[14]=-V3.dot(z,e);o[15]=1;return o},
 inv(m){const i=new Float32Array(16),a=m;
  const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  let d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;d=1/d;
  i[0]=(a11*b11-a12*b10+a13*b09)*d;i[1]=(a02*b10-a01*b11-a03*b09)*d;i[2]=(a31*b05-a32*b04+a33*b03)*d;i[3]=(a22*b04-a21*b05-a23*b03)*d;
  i[4]=(a12*b08-a10*b11-a13*b07)*d;i[5]=(a00*b11-a02*b08+a03*b07)*d;i[6]=(a32*b02-a30*b05-a33*b01)*d;i[7]=(a20*b05-a22*b02+a23*b01)*d;
  i[8]=(a10*b10-a11*b08+a13*b06)*d;i[9]=(a01*b08-a00*b10-a03*b06)*d;i[10]=(a30*b04-a31*b02+a33*b00)*d;i[11]=(a21*b02-a20*b04-a23*b00)*d;
  i[12]=(a11*b07-a10*b09-a12*b06)*d;i[13]=(a00*b09-a01*b07+a02*b06)*d;i[14]=(a31*b01-a30*b03-a32*b00)*d;i[15]=(a20*b03-a21*b01+a22*b00)*d;return i}
};
function frustumPlanes(m){const p=[];const r=i=>[m[i],m[4+i],m[8+i],m[12+i]];const r3=r(3);
 for(const [i,s] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]){const q=r(i);p.push([r3[0]+s*q[0],r3[1]+s*q[1],r3[2]+s*q[2],r3[3]+s*q[3]])}
 return p.map(q=>{const l=Math.hypot(q[0],q[1],q[2])||1;return[q[0]/l,q[1]/l,q[2]/l,q[3]/l]})}
function boxVisible(pl,b){for(const q of pl){const x=q[0]>0?b[3]:b[0],y=q[1]>0?b[4]:b[1],z=q[2]>0?b[5]:b[2];if(q[0]*x+q[1]*y+q[2]*z+q[3]<0)return false}return true}

const SKY_GLSL=`
uniform vec4 u_for[24];uniform vec3 u_skyH;uniform vec3 u_skyZ;uniform vec3 u_cl0;uniform vec3 u_cl1;uniform vec3 u_sunC;uniform vec3 u_ambS;uniform vec3 u_ambG;uniform vec3 u_fogC;uniform vec3 u_halo;
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
vec3 skyBase(vec3 d,vec3 sun){
  float h=clamp(d.y,0.,1.);
  vec3 c=mix(u_skyH,u_skyZ,pow(h,.55));
  float sd=max(dot(d,sun),0.);
  float low=1.-smoothstep(.12,.62,sun.y);                                   // 0 high noon .. 1 sun on the horizon
  vec2 sa=normalize(sun.xz+1e-4),da=normalize(d.xz+1e-4);float az=max(dot(sa,da),0.);
  c+=u_halo*(pow(sd,900.)*2.4+pow(sd,14.)*.22+pow(sd,3.)*.10);
  c+=u_halo*vec3(1.,.62,.36)*pow(az,2.5)*pow(1.-h,3.2)*(.18+.5*low);        // sunset glow band on the horizon, strongest toward the sun
  c=mix(c,c*vec3(1.04,.9,.82),low*pow(1.-h,2.)*(1.-az)*.5);                  // opposite horizon turns dusty rose
  return c;}
vec3 skyFog(vec3 d,vec3 sun){return skyBase(d,sun);}
vec3 skyColor(vec3 d,vec3 sun,float t){
  vec3 c=skyBase(d,sun);
  if(d.y>0.){
    float low=1.-smoothstep(.12,.62,sun.y);
    vec2 sdir=normalize(sun.xz+1e-4);
    float fadeH=smoothstep(0.,.10,d.y);
    // layer 1: high, broad, soft cover.  layer 2: low, big dramatic cumulus with sun-lit rims
    for(int L=0;L<2;L++){
      float sc=L==0?.75:1.5, h0=L==0?.30:.15;
      vec2 p=d.xz/(d.y+h0)*sc+vec2(t*(L==0?.003:.006),t*.0015)+vec2(L==0?3.1:0.);
      vec2 w=vec2(fbm(p*.7+7.3),fbm(p*.7+1.9))-.5;p+=w*.9;                // domain warp: billows instead of blobs
      float n=fbm(p*1.25);
      float cover=L==0?.50:.47-low*.04;
      float cl=smoothstep(cover,cover+.20,n);
      float n2=fbm((p+sdir*.16)*1.25);                                    // same field nudged toward the sun: difference = lit side
      float lit=clamp((n-n2)*7.+.5,0.,1.);
      float thick=clamp((n-cover)*3.,0.,1.);
      vec3 shadow=mix(u_cl0*.52,u_ambS*.55,.35)*(1.-.25*low);          // dark, cool-warm underbelly
      vec3 lite=u_cl1*(1.25+.5*low);
      vec3 cc=mix(shadow,lite,lit*(1.-.55*thick)+.1);
      float edge=(1.-smoothstep(0.,.35,thick))*cl;                      // thin cloud edge
      float toSun=pow(max(dot(normalize(vec3(d.x,max(d.y,.0)+.12,d.z)),sun),0.),4.);
      cc+=u_halo*(edge*(.35+1.4*toSun)*(.5+low))+u_halo*thick*lit*.18*low;   // glowing silver/gold lining
      cc=mix(cc,cc*vec3(1.15,.82,.62),low*.5*(1.-thick));                // sunset tint
      cl*=fadeH*(L==0?.80:.97);
      c=mix(c,cc,cl);
    }
  }
  return c;
}`;

const MAIN_VS=`#version 300 es
precision highp float;
in vec3 a_pos;in vec3 a_nrm;in vec2 a_uv;in vec4 a_col;
in vec4 i_r0;in vec4 i_r1;in vec4 i_r2;in vec4 i_tint;
uniform mat4 u_vp;uniform mat4 u_sh0;uniform mat4 u_sh1;
out vec3 v_p;out vec3 v_n;out vec2 v_uv;out vec4 v_col;out vec4 v_s0;out vec4 v_s1;
void main(){
  vec3 p=vec3(dot(i_r0.xyz,a_pos)+i_r0.w,dot(i_r1.xyz,a_pos)+i_r1.w,dot(i_r2.xyz,a_pos)+i_r2.w);
  vec3 n=normalize(vec3(dot(i_r0.xyz,a_nrm),dot(i_r1.xyz,a_nrm),dot(i_r2.xyz,a_nrm)));
  v_p=p;v_n=n;v_uv=a_uv;v_col=vec4(pow(a_col.rgb,vec3(2.2)),a_col.a)*i_tint;
  vec4 pn=vec4(p+n*.12,1.);v_s0=u_sh0*pn;v_s1=u_sh1*pn;
  gl_Position=u_vp*vec4(p,1.);
}`;
const MAIN_FS=`#version 300 es
precision highp float;precision highp sampler2DShadow;
in vec3 v_p;in vec3 v_n;in vec2 v_uv;in vec4 v_col;in vec4 v_s0;in vec4 v_s1;
uniform sampler2D u_tex;uniform sampler2D u_norm;uniform sampler2D u_ctl;uniform sampler2D u_ctlH;uniform sampler2D u_dt0;uniform sampler2D u_dt1;uniform sampler2D u_dt2;
uniform sampler2DShadow u_sm0;uniform sampler2DShadow u_sm1;
uniform vec3 u_cam;uniform vec3 u_sun;uniform vec4 u_color;uniform float u_cut;uniform float u_uvs;uniform int u_kind;uniform float u_time;uniform float u_shadow;uniform float u_hasNorm;
uniform vec4 u_ctlRect;uniform float u_fogK;uniform float u_over;uniform float u_grade;
out vec4 o;
${SKY_GLSL}

uniform float u_stone;uniform sampler2D u_stA;uniform sampler2D u_stN;uniform float u_hasSt;
// Procedural masonry in world space (no UV needed): bricks / blocks with mortar, per-block tone, cracks, chips, stains, damp base, plus optional external albedo/normal.
void stoneFx(inout vec3 alb,inout vec3 N,float mode){
  float dist=length(u_cam-v_p);float far=1.-smoothstep(90.,260.,dist);
  vec3 an=abs(N);vec2 q=an.y>max(an.x,an.z)*1.3?v_p.xz:(an.x>an.z?v_p.zy:v_p.xy);
  vec2 sz=mode<1.5?vec2(4.4,2.2):mode<2.5?vec2(.52,.22):vec2(.95,.48);
  float row=floor(q.y/sz.y);vec2 g=vec2(q.x/sz.x+mod(row,2.)*.5+hash12(vec2(row,3.7)),q.y/sz.y);vec2 id=floor(g),f=fract(g);float r=hash12(id+mode*17.);
  vec2 e=min(f,1.-f)*sz;float mw=mode<1.5?.10:.026;float aa=fwidth(q.x)+fwidth(q.y);float lod=1.-smoothstep(.25,1.,aa/mw);
  float d=min(e.x,e.y);float face=smoothstep(mw*.5,mw*1.7+aa,d);
  float rough=vnoise(q*(mode<1.5?2.2:9.))*.5+vnoise(q*(mode<1.5?7.:26.))*.5;
  float chip=smoothstep(.62,.9,vnoise(q*(mode<1.5?1.3:5.)+r*9.))*(1.-smoothstep(0.,mw*3.,d));    // chipped corners
  float h=face*(.80+.20*rough)-chip*.35;
  float crk=1.-smoothstep(0.,.018*(mode<1.5?3.:1.),abs(fbm(q*(mode<1.5?.7:2.6)+r*13.)-.5));crk*=step(.52,r)*face*lod;   // hairline cracks in some blocks
  float streak=vnoise(vec2(q.x*(mode<1.5?.22:.9),q.y*(mode<1.5?.035:.12)+r));float stain=smoothstep(.50,.85,streak);
  float damp=1.-smoothstep(0.,mode<1.5?7.:1.2,v_p.y);
  vec3 tone=mix(vec3(.80,.77,.72),vec3(1.14,1.08,.98),r)*mix(vec3(1.),vec3(.96,1.0,1.05),hash12(id+5.1));
  vec3 a=alb*tone*(.90+.20*rough);
  a*=1.-.30*stain*(.4+.6*(1.-damp))-.55*crk;a=mix(a,a*vec3(.62,.74,.46),damp*smoothstep(.4,.8,vnoise(q*1.7))*.55);   // damp / mossy foot
  vec3 mort=alb*vec3(.50,.47,.42)*(.85+.3*vnoise(q*14.));a=mix(mort,a,face);
  if(u_hasSt>.5){vec3 w=an*an;w/=w.x+w.y+w.z;vec3 pp=v_p*.16;vec3 ta=texture(u_stA,pp.zy).rgb*w.x+texture(u_stA,pp.xz).rgb*w.y+texture(u_stA,pp.xy).rgb*w.z;float tl=dot(ta,vec3(.333));
   a*=mix(1.,.45+1.1*tl,.7*far);vec3 tn=(texture(u_stN,pp.zy).xyz*w.x+texture(u_stN,pp.xz).xyz*w.y+texture(u_stN,pp.xy).xyz*w.z)*2.-1.;N=normalize(N+vec3(tn.x,0.,tn.y)*.5*far);}
  alb=mix(alb,a,mix(.55,1.,lod)*mix(.6,1.,far));
  vec3 dpx=dFdx(v_p),dpy=dFdy(v_p);vec3 r1=cross(dpy,N),r2=cross(N,dpx);float det=dot(dpx,r1);
  if(abs(det)>1e-9){vec3 gr=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);N=normalize(abs(det)*N-gr*mw*.7*lod*far);}
}
float shadowTap(sampler2DShadow s,vec4 c){vec3 p=c.xyz/c.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return -1.;
  float r=0.;float tx=1./2048.;
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)r+=texture(s,vec3(p.xy+vec2(i,j)*tx*1.1,p.z-.0008));return r/9.;}
float shadowAt(){
  vec3 c0=v_s0.xyz/v_s0.w;
  if(abs(c0.x)<.94&&abs(c0.y)<.94){float a=shadowTap(u_sm0,v_s0);if(a>=0.){float e=smoothstep(.80,.94,max(abs(c0.x),abs(c0.y)));
     float b=shadowTap(u_sm1,v_s1);if(b<0.)b=1.;return mix(a,b,e);}}
  float b=shadowTap(u_sm1,v_s1);return b<0.?1.:b;
}
mat3 cotan(vec3 N,vec3 p,vec2 uv){vec3 dp1=dFdx(p),dp2=dFdy(p);vec2 duv1=dFdx(uv),duv2=dFdy(uv);
  vec3 dp2perp=cross(dp2,N),dp1perp=cross(N,dp1);vec3 T=dp2perp*duv1.x+dp1perp*duv2.x;vec3 B=dp2perp*duv1.y+dp1perp*duv2.y;
  float inv=inversesqrt(max(dot(T,T),dot(B,B))+1e-12);return mat3(T*inv,B*inv,N);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
  vec3 N=normalize(v_n);if(!gl_FrontFacing)N=-N;
  vec4 al;
  if(u_kind==2){ // ground: control-map splat + anime-style fields outside the walls
    vec2 cuv=(v_p.xz-u_ctlRect.xy)/u_ctlRect.zw;vec2 cc_=clamp(cuv,0.,1.);vec4 c=vec4(texture(u_ctl,cc_).rgb,texture(u_ctlH,cc_).r);
    bool inR=cuv.x>0.&&cuv.x<1.&&cuv.y>0.&&cuv.y<1.;
    if(inR&&c.a>.5)discard;
    if(!inR)c=vec4(0.);
    vec2 w=v_p.xz;
    vec3 grass=texture(u_dt0,w*.11).rgb*vec3(.95,.95,.80);
    vec3 grassB=texture(u_dt0,w*.027+3.1).rgb;
    vec3 dirt=mix(texture(u_dt1,w*.16).rgb,texture(u_dt1,w*.043+.5).rgb,.45);
    vec3 stone=texture(u_dt2,w*.30).rgb*.5+texture(u_dt2,w*.30*1.7+.37).rgb*.5;
    float nz=vnoise(w*.35)*.5+vnoise(w*1.7)*.3+vnoise(w*5.)*.2;
    // --- fields (outside)
    vec2 q=mat2(.94,.34,-.34,.94)*(w+38.*vec2(vnoise(w*.011),vnoise(w*.011+7.3)))/52.;vec2 q2=q*.5;if(hash12(floor(q2)+3.7)<.55)q=q2;vec2 id=floor(q),fq=fract(q);float h1=hash12(id),h2=hash12(id+17.3);
    vec3 fcol=h1<.28?vec3(.17,.24,.085):(h1<.52?vec3(.27,.28,.105):(h1<.72?vec3(.30,.235,.125):vec3(.105,.165,.065)));
    float stripes=.5+.5*sin(dot(q,vec2(h2>.5?1.:-.4,h2>.5?.3:1.))*210.);
    fcol*=mix(1.,.86+.2*stripes,step(.52,h1)*step(h1,.72));
    float ed=min(min(fq.x,1.-fq.x),min(fq.y,1.-fq.y));float hedge=1.-smoothstep(.010,.034,ed+(nz-.5)*.02);
    vec3 field=mix(fcol*(.75+.5*grassB.g*1.4)*(.55+.9*texture(u_dt0,w*.33).g),vec3(.04,.09,.03),hedge*.85)*(.88+.24*nz);
    // forest patches
    float fo=0.;for(int i=0;i<24;i++){vec4 fr=u_for[i];if(fr.z>0.){float dd=length(w-fr.xy)/(fr.z*(.78+.5*vnoise(w*.025+fr.xy)));fo=max(fo,1.-smoothstep(.72,1.,dd));}}field=mix(field,vec3(.035,.085,.03)*(.8+.4*nz),fo*.8);
    float town=c.b;
    vec3 insideG=grass*vec3(.78,.80,.66)*(.80+.30*grassB.g);
    float road=clamp(c.r+(nz-.5)*.38*step(.01,c.r)*step(c.r,.99),0.,1.);road=smoothstep(.34,.66,road);
    float nz2=vnoise(w*.06)*.6+vnoise(w*.19)*.4;float gpatch=smoothstep(.60,.72,nz2);
    road=max(road,town*(1.-gpatch*.88));
    float cob=smoothstep(.4,.6,c.g+(nz-.5)*.3);
    float spt=smoothstep(.55,.70,vnoise(w*.085+vec2(11.,5.))*.62+vnoise(w*.33)*.38);
    float yard=town*(1.-road)*smoothstep(.60,.72,vnoise(w*.13+vec2(2.,9.))*.7+vnoise(w*.5)*.3);
    float dpatch=smoothstep(.66,.80,nz2)*.65;cob=max(cob,max(road*.97*(1.-dpatch),max(spt*road*.5,yard*.9)));
    road*=1.-.55*u_over*smoothstep(.30,.62,nz2);cob*=1.-.45*u_over*smoothstep(.25,.6,nz2+.1);
    vec3 base=mix(field,insideG,town);
    // grass fringe on lane edges
    float edgeGrass=smoothstep(.15,.5,road)*(1.-smoothstep(.5,.9,road))*smoothstep(.45,.7,vnoise(w*1.3));
    float wear=smoothstep(.45,.8,vnoise(vec2(w.x*.9+w.y*.35,w.y*.06-w.x*.02))*.6+vnoise(w*.22)*.4);vec3 dcol=mix(dirt,vec3(dot(dirt,vec3(.33))),.25)*vec3(1.0,.95,.86)*(.96+.14*wear);
    base=mix(base,dcol,road);base=mix(base,mix(base,insideG*1.05,.55),edgeGrass*.7);
    base=mix(base,stone*vec3(1.04,1.0,.93),cob);
    base*=(.84+.24*nz);
    // v0.8 close-range realism: individual rounded cobbles with dark joints, pebbles on dirt, blade-scale grass breakup (all fade out with distance)
    float nearK=1.-smoothstep(22.,120.,length(u_cam-v_p));float stoneM=0.;
    if(nearK>.01){vec2 cq=w*1.7;cq.x+=mod(floor(cq.y),2.)*.5;vec2 cid=floor(cq),cf=fract(cq)-.5;float cr=hash12(cid+9.1);
      stoneM=smoothstep(.52,.34,max(abs(cf.x)*1.0,abs(cf.y)*1.2)+(vnoise(cq*5.)-.5)*.16);
      float cw=cob*nearK;base*=mix(1.,mix(.50,.78+.42*cr,stoneM),cw);base=mix(base,base*vec3(.92,.96,1.04),cw*(1.-stoneM)*.5);
      float peb=step(.84,hash12(floor(w*8.)))*smoothstep(.3,.8,vnoise(floor(w*8.)*.37));base=mix(base,base*1.38,peb*road*(1.-cob)*nearK*.7);
      float bl=(vnoise(w*17.)-.5)*.30+(vnoise(w*41.)-.5)*.18;base*=1.+bl*nearK*(1.-road)*(1.-cob)*(.4+.6*(1.-town));}
    float hgt=mix(dot(grass,vec3(.33))*.5,dot(dirt,vec3(.33))*1.4,road);hgt=mix(hgt,dot(stone,vec3(.33))*3.0+stoneM*1.3*nearK,cob);
    vec3 dpx=dFdx(v_p),dpy=dFdy(v_p);vec3 r1=cross(dpy,N),r2=cross(N,dpx);float det=dot(dpx,r1);
    if(abs(det)>1e-9){vec3 gr=sign(det)*(dFdx(hgt)*r1+dFdy(hgt)*r2);N=normalize(abs(det)*N-gr*.2*(1.-cob));}
    al=vec4(base,1.);
  } else {
    al=texture(u_tex,v_uv*u_uvs);
    if(u_cut>0.&&al.a<u_cut)discard;
    al.rgb*=u_color.rgb;
    if(u_over>.01&&u_cut<=0.){float roofy=smoothstep(.12,.55,N.y);float mn=fbm(v_p.xz*.9+v_p.y*.55);float mn2=fbm(v_p.xz*3.1+v_p.y*1.7);
      float lowK=1.-smoothstep(1.5,9.,v_p.y)*.55;float hiK=1.-smoothstep(16.,30.,v_p.y);
      float mm=smoothstep(.50,.80,mn+roofy*.30+(1.-smoothstep(0.,4.,v_p.y))*.22+(mn2-.5)*.30)*u_over*hiK;
      vec3 moss=mix(vec3(.030,.058,.016),vec3(.085,.125,.034),mn2);moss=mix(moss,vec3(.12,.16,.045),smoothstep(.65,.9,mn2)*roofy);
      al.rgb=mix(al.rgb,moss,clamp(mm,0.,.9));}
  }
  al.rgb*=v_col.rgb;
  if(u_stone>.5&&u_kind==0)stoneFx(al.rgb,N,u_stone);
  if(u_hasNorm>.5){vec3 t=texture(u_norm,v_uv*u_uvs).xyz*2.-1.;t.xy*=.8;N=normalize(cotan(N,v_p,v_uv)*t);}
  float sh=u_shadow>.5?shadowAt():1.;
  float ndl=dot(N,u_sun);
  float diff=clamp((ndl+.18)/1.18,0.,1.);
  diff=mix(diff,smoothstep(.0,.55,diff),.55); // gentle cel-leaning ramp
  vec3 sunC=u_sunC;
  vec3 sky=u_ambS,gnd=u_ambG;
  float up=N.y*.5+.5;
  vec3 amb=mix(gnd,sky,up)*.90;
  float ao=v_col.a;if(u_kind!=2){ao*=mix(.66,1.,smoothstep(.0,3.2,v_p.y));ao*=1.-clamp(-N.y,0.,1.)*.38;}
  vec3 lit=al.rgb*(sunC*diff*sh+amb*ao*(.74+.26*sh));
  // warm bounce in shadow side
  lit+=al.rgb*vec3(.10,.07,.04)*(1.-diff)*ao;
  vec3 V=u_cam-v_p;float dist=length(V);V/=dist;
  float fog=1.-exp(-dist*u_fogK*(1.+clamp((34.-v_p.y)/34.,0.,1.)*.9));fog=max(fog,smoothstep(1700.,3100.,dist));
  vec3 fogc=skyFog(normalize(vec3(-V.x,max(-V.y,.0),-V.z)),u_sun);
  fogc=mix(u_fogC,fogc,.35);fogc+=u_halo*pow(max(dot(-V,u_sun),0.),5.)*.30;
  vec3 col=aces(lit*.80);
  col=pow(col,vec3(1./2.2));
  // painted wash + anime grade (warm shadows, gentle desaturation, soft contrast)
  float pw=vnoise(v_p.xz*.7+v_p.y*.9)*.55+vnoise(v_p.xz*2.9+v_p.y*3.1)*.45;col*=.955+.09*pw;
  float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,mix(1.12,.96,u_grade));
  col=mix(col,col*col*(3.-2.*col),.10*u_grade);
  col*=mix(vec3(1.),vec3(1.05,1.0,.90),u_grade*(1.-smoothstep(.15,.75,l)*.6));col+=vec3(.030,.017,-.002)*u_grade*(1.-l);
  // haze in display space so distant ground meets the sky dome exactly
  col=mix(col,pow(fogc,vec3(.95)),clamp(fog,0.,fog>.9?1.:.84));
  o=vec4(col,al.a);
}`;
const SHADOW_VS=`#version 300 es
in vec3 a_pos;in vec2 a_uv;in vec4 i_r0;in vec4 i_r1;in vec4 i_r2;
uniform mat4 u_sh;out vec2 v_uv;
void main(){vec3 p=vec3(dot(i_r0.xyz,a_pos)+i_r0.w,dot(i_r1.xyz,a_pos)+i_r1.w,dot(i_r2.xyz,a_pos)+i_r2.w);v_uv=a_uv;gl_Position=u_sh*vec4(p,1.);}`;
const SHADOW_FS=`#version 300 es
precision mediump float;in vec2 v_uv;uniform sampler2D u_tex;uniform float u_cut;uniform float u_uvs;out vec4 o;
void main(){if(u_cut>0.&&texture(u_tex,v_uv*u_uvs).a<u_cut)discard;o=vec4(1);}`;
const SKY_VS=`#version 300 es
out vec2 v_q;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v_q=p*2.-1.;gl_Position=vec4(v_q,.9999,1.);}`;
const SKY_FS=`#version 300 es
precision highp float;in vec2 v_q;uniform mat4 u_ivp;uniform vec3 u_cam;uniform vec3 u_sun;uniform float u_time;out vec4 o;
${SKY_GLSL}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec4 w=u_ivp*vec4(v_q,1.,1.);vec3 d=normalize(w.xyz/w.w-u_cam);
 vec3 c=skyColor(d,u_sun,u_time);
 if(d.y<0.)c=mix(c,u_fogC,clamp(-d.y*6.,0.,1.));
 o=vec4(pow(c,vec3(.95)),1.);}`;
const WATER_FS=`#version 300 es
precision highp float;precision highp sampler2DShadow;
in vec3 v_p;in vec3 v_n;in vec2 v_uv;in vec4 v_col;in vec4 v_s0;in vec4 v_s1;
uniform vec3 u_cam;uniform vec3 u_sun;uniform float u_time;uniform float u_fogK;uniform float u_shadow;
uniform sampler2DShadow u_sm0;uniform sampler2DShadow u_sm1;
out vec4 o;
${SKY_GLSL}
float wh(vec2 sq,float t){ // height field in flow space (s along flow, q across)
  float h=vnoise(sq*vec2(.55,1.1)+vec2(-t*1.1,0.))*.55+vnoise(sq*vec2(1.4,2.4)+vec2(-t*1.7,t*.2))*.30+vnoise(sq*vec2(3.6,5.0)+vec2(-t*2.4,-t*.3))*.15;return h;}
void main(){
  vec2 fd=v_uv;float fl=length(fd);fd=fl>.01?fd/fl:vec2(1.,0.);vec2 pq=vec2(-fd.y,fd.x);
  vec2 sq=vec2(dot(v_p.xz,fd),dot(v_p.xz,pq));float t=u_time;float e=.18;
  float h0=wh(sq,t),hx=wh(sq+vec2(e,0.),t),hz=wh(sq+vec2(0.,e),t);
  vec2 g=vec2(hx-h0,hz-h0)/e;vec2 gw=fd*g.x+pq*g.y;
  vec3 N=normalize(vec3(-gw.x*.55,1.,-gw.y*.55));
  vec3 V=u_cam-v_p;float dist=length(V);V/=dist;
  float fr=pow(1.-max(dot(N,V),0.),4.)*.9+.04;
  vec3 R=reflect(-V,N);R.y=abs(R.y);
  vec3 refl=skyColor(R,u_sun,u_time);
  float side=v_col.a;
  vec3 deep=vec3(.07,.20,.22),shal=vec3(.20,.42,.40);
  vec3 body=mix(deep,shal,clamp(side*1.1+vnoise(sq*.2)*.25,0.,1.));
  vec3 c=mix(body,refl,fr);
  float sp=pow(max(dot(R,u_sun),0.),160.)*1.4+pow(max(dot(R,u_sun),0.),24.)*.12;c+=u_halo*sp;
  float crest=smoothstep(.70,.86,h0+vnoise(sq*3.)*.1);c+=vec3(.9,.95,.95)*crest*.10;
  float foam=smoothstep(.80,.98,side)*(.45+.55*vnoise(sq*vec2(1.6,3.)+t*vec2(-.6,0.)));c=mix(c,vec3(.86,.9,.88),foam*.55);
  c=mix(c,u_fogC,clamp(1.-exp(-dist*u_fogK),0.,.88));
  c=pow(c,vec3(.95));
  o=vec4(c,mix(.93,.78,smoothstep(.2,.9,1.-side)*0.));}`;

function mk(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s),src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));throw new Error('shader')}return s}
function prog(gl,vs,fs,locs){const p=gl.createProgram();gl.attachShader(p,mk(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl,gl.FRAGMENT_SHADER,fs));
 for(const k in locs)gl.bindAttribLocation(p,locs[k],k);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
 const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const a=gl.getActiveUniform(p,i);u[a.name]=gl.getUniformLocation(p,a.name)}return{p,u}}
const STONE={wall:1,brick:2,sbrick:2,stoneg:3};
const AL={a_pos:0,a_nrm:1,a_uv:2,a_col:3,i_r0:4,i_r1:5,i_r2:6,i_tint:7};

const PRESETS={
 day:{sun:[-0.55,0.62,0.50],sunC:[2.7,2.4,1.9],ambS:[.33,.48,.76],ambG:[.38,.32,.20],skyH:[.72,.87,1.0],skyZ:[.09,.34,.92],cl0:[.66,.76,.93],cl1:[1.04,1.03,1],fogC:[.68,.83,.99],halo:[1.1,.96,.72]},
 golden:{sun:[-0.64,0.50,0.52],sunC:[3.1,2.1,1.15],ambS:[.44,.45,.62],ambG:[.44,.32,.20],skyH:[1.0,.76,.48],skyZ:[.24,.44,.82],cl0:[.84,.56,.50],cl1:[1.1,.80,.50],fogC:[.96,.80,.56],halo:[1.35,.88,.48]}
};
class Engine{
 constructor(canvas,opts={}){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:opts.antialias!==undefined?opts.antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:!!opts.preserve});
  if(!gl)throw new Error('WebGL2 not available');
  this.mobile=opts.mobile!==undefined?opts.mobile:(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||('ontouchstart' in window&&innerWidth<900));
  this.aniso=gl.getExtension('EXT_texture_filter_anisotropic');
  this.progs={main:prog(gl,MAIN_VS,MAIN_FS,AL),shadow:prog(gl,SHADOW_VS,SHADOW_FS,AL),sky:prog(gl,SKY_VS,SKY_FS,{}),
   water:prog(gl,MAIN_VS,WATER_FS,AL)};
  this.lodScale=this.mobile?.9:1;this.setPreset('day');this.time=0;this.camPos=[0,0,0];this.shadowOn=true;this.over=0;this.grade=1;this.fogK=0.00022;
  this.vao=gl.createVertexArray();this.white=this.texFromPixels(new Uint8Array([255,255,255,255]),1,1,true);
  this.flatN=this.texFromPixels(new Uint8Array([128,128,255,255]),1,1,false);
  this.cascades=2;this.initShadow();this.dpr=Math.min(window.devicePixelRatio||1,this.mobile?2:2);this.scale=1;
 }
 texFromPixels(px,w,h,srgb){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t}
 texFromBitmap(bmp,srgb,rep=true,mip=true){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bmp);
  if(mip)gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,rep?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,rep?gl.REPEAT:gl.CLAMP_TO_EDGE);
  if(this.aniso&&mip)gl.texParameterf(gl.TEXTURE_2D,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,this.anisoMax||(this.mobile?4:8));return t}
 initShadow(S0){const gl=this.gl;this.smSize=S0||(this.mobile?3072:4096);this.sm=[];this.cascades=this.cascades||2;
  for(let i=0;i<2;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);const S=this.smSize;
   gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,S,S,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
   const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,t,0);
   gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);this.sm.push({t,f,S,m:M4.id()})}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null)}
 async loadStoneTex(base){try{const g=async f=>{const r=await fetch(base+f);if(!r.ok)throw 0;return createImageBitmap(await r.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'})};const a=await g('assets/stone_albedo.jpg'),n=await g('assets/stone_normal.jpg');this.stoneTex={a:this.texFromBitmap(a,true,true,true),n:this.texFromBitmap(n,false,true,true)};return true}catch(e){return false}}   // optional: drop stone_albedo.jpg + stone_normal.jpg into assets/
 endPost(){const q=this._pp;this._pp=null;if(q&&this.postFx&&this.postFx.on)this.postFx.end(q.cam,q.su,q.col)}   // resolve the off-screen frame to the screen (game.js calls this after drawing actors/FX into it)
 setPost(level){if(!window.AotPost){return}if(!this.postFx)this.postFx=new window.AotPost(this);this.postFx.set(level)}
 setShadowSize(S){if(!this.sm||S===this.smSize)return;const gl=this.gl;for(const s of this.sm){gl.deleteTexture(s.t);gl.deleteFramebuffer(s.f)}this.initShadow(S)}   // quality tiers resize the shadow maps (frees the old ones)
 // ---- data loading ----
 async load(base,onprog){
  const gl=this.gl;onprog&&onprog('Reading district data…',0.02);
  const J=window.__PACK_JSON;const buf=await window.__packBuf();
  if(buf.byteLength!==J.vbytes+J.ibytes+J.nInst*64)throw new Error('data file size mismatch ('+buf.byteLength+')');this.J=J;const vb=new Uint8Array(buf,0,J.vbytes),ib=new Uint32Array(buf.slice(J.vbytes,J.vbytes+J.ibytes));
  const inst=new Float32Array(buf.slice(J.vbytes+J.ibytes));this._vb=vb;this._ib=ib;this._inst=inst;
  {const sc2={prop_barrels:.4,prop_crates:.5},vf2=new Float32Array(vb.buffer,vb.byteOffset,J.vbytes>>2);for(const k in sc2){const g=J.geoms[k];if(!g)continue;const q0=sc2[k];for(let q=0;q<g.vn;q++){const o=(g.v+q)*9;vf2[o]*=q0;vf2[o+1]*=q0;vf2[o+2]*=q0}for(let q=0;q<6;q++)g.bb[q]*=q0}}
  this.vbuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.vbuf);gl.bufferData(gl.ARRAY_BUFFER,vb,gl.STATIC_DRAW);
  this.ibuf=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibuf);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ib,gl.STATIC_DRAW);
  this.instbuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.instbuf);gl.bufferData(gl.ARRAY_BUFFER,inst,gl.STATIC_DRAW);
  // textures
  this.texs=[];let done=0;const T=J.tex;
  await Promise.all(T.map(async(t,i)=>{const r=await fetch(base+t.file);const b=await createImageBitmap(await r.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
   this.texs[i]=this.texFromBitmap(b,t.srgb!==false,true,true);b.close&&b.close();done++;onprog&&onprog('Painting the walls and rooftops…',0.1+0.85*done/T.length)}));
  if(J.ctl){const r=await fetch(base+J.ctl.file);const b=await createImageBitmap(await r.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});this.ctlTex=this.texFromBitmap(b,false,false,true);if(J.ctl.hole){const r2=await fetch(base+J.ctl.hole);const b2=await createImageBitmap(await r2.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});this.ctlHTex=this.texFromBitmap(b2,false,false,true)}}
  this.detail=[];for(const f of J.detail||[]){const r=await fetch(base+f);const b=await createImageBitmap(await r.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});this.detail.push(this.texFromBitmap(b,true,true,true))}
  // VAO for geometry
  gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.vbuf);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibuf);
  for(let k=0;k<4;k++)gl.enableVertexAttribArray(k);
  for(let k=4;k<8;k++){gl.enableVertexAttribArray(k);gl.vertexAttribDivisor(k,1)}
  this.draws=J.draws;this.collide=J.collide;
  onprog&&onprog('Ready',1);
 }
 setGeomPtr(g){const gl=this.gl,S=36,o=g.v*S;gl.bindBuffer(gl.ARRAY_BUFFER,this.vbuf);
  gl.vertexAttribPointer(0,3,gl.FLOAT,false,S,o);gl.vertexAttribPointer(1,3,gl.FLOAT,false,S,o+12);gl.vertexAttribPointer(2,2,gl.FLOAT,false,S,o+24);gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,S,o+32)}
 setInstPtr(off){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.instbuf);const S=64,o=off*S;
  gl.vertexAttribPointer(4,4,gl.FLOAT,false,S,o);gl.vertexAttribPointer(5,4,gl.FLOAT,false,S,o+16);gl.vertexAttribPointer(6,4,gl.FLOAT,false,S,o+32);gl.vertexAttribPointer(7,4,gl.FLOAT,false,S,o+48)}
 resize(){const c=this.canvas,w=Math.floor(c.clientWidth*this.dpr*this.scale),h=Math.floor(c.clientHeight*this.dpr*this.scale);if(c.width!==w||c.height!==h){c.width=w;c.height=h}}
 // ---- rendering ----
 bindMat(g,P,shadowPass){const gl=this.gl,J=this.J,m=J.mats[g.mat];
  if(g.mat===this.lastMat)return;this.lastMat=g.mat;const u=P.u;
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,m.tex>=0?this.texs[m.tex]:this.white);gl.uniform1i(u.u_tex,0);
  if(u.u_cut)gl.uniform1f(u.u_cut,m.cut||0);if(u.u_uvs)gl.uniform1f(u.u_uvs,m.uvs||1);
  if(!shadowPass){gl.uniform4f(u.u_color,m.color[0],m.color[1],m.color[2],1);gl.uniform1i(u.u_kind,m.kind||0);if(u.u_stone){if(m.st===undefined)m.st=STONE[m.name]||0;gl.uniform1f(u.u_stone,this.stoneOn===false?0:m.st)}
   if(m.norm>=0){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.texs[m.norm]);gl.uniform1f(u.u_hasNorm,1)}else gl.uniform1f(u.u_hasNorm,0);}}
 drawScene(planes,shadowPass,P,filterKind){
  const gl=this.gl,J=this.J;this.lastMat=-1;let tris=0;const cp=this.camPos;this.calls=this.calls||0;
  const dbox=(b)=>{const dx=Math.max(b[0]-cp[0],0,cp[0]-b[3]),dy=Math.max(b[1]-cp[1],0,cp[1]-b[4]),dz=Math.max(b[2]-cp[2],0,cp[2]-b[5]);return Math.hypot(dx,dy,dz)};
  for(const d of this.draws){const g=J.geoms[d.g],m=J.mats[g.mat];
   if(shadowPass&&(m.kind===2||m.kind===3||m.noshadow))continue;
   if(filterKind!==undefined&&((m.kind===3)!==(filterKind===3)))continue;
   if(this.hidden&&this.hidden.has(d.g))continue;
   if(d.over&&!(this.over>.5))continue;if(d.cln&&(this.over>.5))continue;
   const hi=[],lo=[];const lg=d.lod?J.geoms[d.lod]:null;
   for(const c of d.chunks){if(!boxVisible(planes,c.bb))continue;const dd=(lg||d.maxDist)?dbox(c.bb):0;if(d.maxDist&&dd>d.maxDist*(this.lodScale||1))continue;if(lg&&dd>d.lodDist*(this.lodScale||1))lo.push(c);else hi.push(c)}
   for(const [gg,list] of [[g,hi],[lg,lo]]){if(!list.length)continue;this.bindMat(gg,P,shadowPass);this.setGeomPtr(gg);
    for(const c of list){this.setInstPtr(c.o);gl.drawElementsInstanced(gl.TRIANGLES,gg.in,gl.UNSIGNED_INT,gg.i*4,c.n);tris+=gg.in/3*c.n;this.calls++}}}
  return tris}
 setPreset(name){const P=PRESETS[name]||PRESETS.day;this.light=P;this.sunDir=V3.norm(P.sun);this.preset=name}
 setLight(u){const L=this.light,gl=this.gl;const f=(k,v)=>{if(u[k])gl.uniform3fv(u[k],v)};
  f('u_skyH',L.skyH);f('u_skyZ',L.skyZ);f('u_cl0',L.cl0);f('u_cl1',L.cl1);f('u_sunC',L.sunC);f('u_ambS',L.ambS);f('u_ambG',L.ambG);f('u_fogC',L.fogC);f('u_halo',L.halo);const uf=u['u_for[0]']||u.u_for;if(uf&&this.J&&this.J.forests){const a=new Float32Array(96);this.J.forests.slice(0,24).forEach((q,i)=>{a[i*4]=q[0];a[i*4+1]=q[1];a[i*4+2]=q[2]});gl.uniform4fv(uf,a)}}
 updateBoats(){const J=this.J,gl=this.gl;if(!J.boats||!J.canalPath)return;const cp=J.canalPath,pts=cp.pts,cum=cp.cum,L=cum[cum.length-1],t=this.time;
  const data=new Float32Array(16);gl.bindBuffer(gl.ARRAY_BUFFER,this.instbuf);this.boatXf=[];
  for(const b of J.boats){if(!b.os)b.os=b.g.map(g=>J.dyn[g][b.i]);let s=((b.s0+b.speed*t)%L+L)%L;let i=1;while(i<cum.length-1&&cum[i]<s)i++;const f=(s-cum[i-1])/Math.max(1e-6,cum[i]-cum[i-1]);
   const x=pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f,z=pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f;let dx=pts[i][0]-pts[i-1][0],dz=pts[i][1]-pts[i-1][1];const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
   // lateral offset (keep to one side of channel)
   const nx=-dz,nz=dx;const px=x+nx*(b.lat||0),pz=z+nz*(b.lat||0);
   if(b.speed<0){dx=-dx;dz=-dz}
   const yaw=Math.atan2(dx,dz),c=Math.cos(yaw),sn=Math.sin(yaw);
   const bob=Math.sin(t*1.25+b.ph)*.07,roll=Math.sin(t*.9+b.ph*1.7)*.012,pitch=Math.sin(t*.7+b.ph)*.008,cr=Math.cos(roll),sr=Math.sin(roll),cpi=Math.cos(pitch),spi=Math.sin(pitch);
   // R = Ry*Rx(pitch)*Rz(roll)
   const Rx=[[1,0,0],[0,cpi,-spi],[0,spi,cpi]],Rz=[[cr,-sr,0],[sr,cr,0],[0,0,1]],Ry=[[c,0,sn],[0,1,0],[-sn,0,c]];
   const mm=(A,B)=>A.map((r,i)=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));const R=mm(Ry,mm(Rx,Rz));
   const sink=Math.min(1,Math.min(s,L-s)/22),sk=sink<1?(1-sink)*(1-sink)*6:0;data.set([R[0][0],R[0][1],R[0][2],px,R[1][0],R[1][1],R[1][2],J.waterY+bob-sk,R[2][0],R[2][1],R[2][2],pz,b.tint[0],b.tint[1],b.tint[2],1]);
   this.boatXf.push({row:b.g[0]==='boat_row',R,px,py:J.waterY+bob-sk,pz,i:b.i,ph:b.ph});for(const o of b.os)gl.bufferSubData(gl.ARRAY_BUFFER,o*64,data)}}
 shadowMatrix(center,R,zr){const L=this.sunDir;const eye=V3.add(center,V3.mul(L,zr));
  let up=Math.abs(L[1])>.95?[1,0,0]:[0,1,0];const view=M4.look(eye,center,up);
  // snap center to texel grid
  const proj=M4.ortho(-R,R,-R,R,0.5,zr*2);let m=M4.mul(proj,view);
  const S=this.sm[0].S;const tx=m[12]*S/2,ty=m[13]*S/2;m[12]+=(Math.round(tx)-tx)*2/S;m[13]+=(Math.round(ty)-ty)*2/S;return m}
 render(cam,dt){
  const gl=this.gl;if(this._pp)try{this.endPost()}catch(e){}this.time+=dt;this.resize();const W=this.canvas.width,H=this.canvas.height;
  const asp=W/H;let vfov=cam.fov;if(asp<1){vfov=2*Math.atan(Math.tan(cam.fov/2)/asp*Math.min(1,asp*1.55))}
  const proj=M4.persp(vfov,asp,cam.near||0.3,cam.far||3500),view=M4.look(cam.pos,cam.target,[0,1,0]);
  const vp=M4.mul(proj,view),planes=frustumPlanes(vp);this.vp=vp;
  gl.bindVertexArray(this.vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  let tris=0;this.camPos=cam.pos;this.updateBoats();
  const f=V3.norm(V3.sub(cam.target,cam.pos));
  if(this.shadowOn){
   const d=cam.dist||40;const R0=Math.max(28,Math.min(110,d*0.7)),R1=Math.min(this.shadowFar||520,Math.max(R0*4,150));
   const c0=cam.walk?V3.add(cam.pos,V3.mul(f,R0*.55)):cam.target;
   const c1=cam.walk?V3.add(cam.pos,V3.mul(f,R1*.5)):cam.target;
   const z0=Math.max(120,R0*2.5),z1=Math.max(220,R1*1.6,150);
   const mats=[this.shadowMatrix(c0,R0,z0+60),this.shadowMatrix(c1,R1,z1+80)];
   const P=this.progs.shadow;gl.useProgram(P.p);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2.2,4);
   const one=this.cascades===1;if(one)mats[1]=this.shadowMatrix(c1,Math.min(R1,Math.max(R0*2.4,90)),z1+80);
   for(let i=one?1:0;i<2;i++){const s=this.sm[i];s.m=mats[i];gl.bindFramebuffer(gl.FRAMEBUFFER,s.f);gl.viewport(0,0,s.S,s.S);gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(P.u.u_sh,false,s.m);tris+=this.drawScene(frustumPlanes(s.m),true,P)}
   if(one)this.sm[0].m=this.sm[1].m;
   gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  const PO=this.postFx&&this.postFx.on?this.postFx:null;if(PO&&!PO.begin(W,H)){/* fell back to the direct path */}
  gl.viewport(0,0,W,H);gl.clearColor(.7,.82,.95,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // sky
  {const P=this.progs.sky;gl.useProgram(P.p);gl.depthMask(false);gl.uniformMatrix4fv(P.u.u_ivp,false,M4.inv(vp));gl.uniform3fv(P.u.u_cam,cam.pos);gl.uniform3fv(P.u.u_sun,this.sunDir);gl.uniform1f(P.u.u_time,this.time);this.setLight(P.u);
   gl.bindVertexArray(null);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(this.vao);gl.depthMask(true)}
  const bindCommon=(P)=>{const u=P.u;gl.useProgram(P.p);gl.uniformMatrix4fv(u.u_vp,false,vp);gl.uniformMatrix4fv(u.u_sh0,false,this.cascades===1?this.sm[1].m:this.sm[0].m);gl.uniformMatrix4fv(u.u_sh1,false,this.sm[1].m);
   gl.uniform3fv(u.u_cam,cam.pos);gl.uniform3fv(u.u_sun,this.sunDir);gl.uniform1f(u.u_time,this.time);gl.uniform1f(u.u_fogK,this.fogK);gl.uniform1f(u.u_shadow,this.shadowOn?1:0);if(u.u_over)gl.uniform1f(u.u_over,this.over||0);if(u.u_grade)gl.uniform1f(u.u_grade,this.grade===undefined?1:this.grade);this.setLight(u);
   gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,(this.cascades===1?this.sm[1]:this.sm[0]).t);gl.uniform1i(u.u_sm0,4);
   gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,this.sm[1].t);gl.uniform1i(u.u_sm1,5);return u};
  {const P=this.progs.main,u=bindCommon(P);
   gl.uniform1i(u.u_norm,1);
   if(this.ctlTex){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.ctlTex);gl.uniform1i(u.u_ctl,2);if(this.ctlHTex){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.ctlHTex);gl.uniform1i(u.u_ctlH,3)}const r=this.J.ctl.rect;gl.uniform4f(u.u_ctlRect,r[0],r[1],r[2],r[3])}
   {const hs=this.stoneTex?1:0;gl.uniform1f(u.u_hasSt,hs);gl.uniform1i(u.u_stA,10);gl.uniform1i(u.u_stN,11);if(hs){gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,this.stoneTex.a);gl.activeTexture(gl.TEXTURE11);gl.bindTexture(gl.TEXTURE_2D,this.stoneTex.n)}else{gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,this.white);gl.activeTexture(gl.TEXTURE11);gl.bindTexture(gl.TEXTURE_2D,this.flatN)}}
   for(let i=0;i<3;i++){if(this.detail[i]){gl.activeTexture(gl.TEXTURE6+i);gl.bindTexture(gl.TEXTURE_2D,this.detail[i]);gl.uniform1i(u['u_dt'+i],6+i)}}
   tris+=this.drawScene(planes,false,P,0)}
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  {const P=this.progs.water;bindCommon(P);tris+=this.drawScene(planes,false,P,3)}
  gl.depthMask(true);gl.disable(gl.BLEND);
  if(PO&&PO.on){let su=null;{const sd=this.sunDir,q=[cam.pos[0]+sd[0]*1000,cam.pos[1]+sd[1]*1000,cam.pos[2]+sd[2]*1000,1],m=vp,cx=m[0]*q[0]+m[4]*q[1]+m[8]*q[2]+m[12],cy=m[1]*q[0]+m[5]*q[1]+m[9]*q[2]+m[13],cw=m[3]*q[0]+m[7]*q[1]+m[11]*q[2]+m[15];
   if(cw>0.01){const sx=cx/cw*.5+.5,sy=cy/cw*.5+.5,edge=Math.max(Math.abs(sx-.5),Math.abs(sy-.5));su=[sx,sy,Math.max(0,1-Math.max(0,edge-.5)*2.2)]}}
   this._pp={cam,su,col:this.light.halo.map(v=>v*.55)};if(!this.deferPost)this.endPost()}
  this.tris=tris;this.lastCalls=this.calls;this.calls=0;this.proj=proj;this.view=view;
 }
}
window.AotEngine={Engine,V3,M4};
})();

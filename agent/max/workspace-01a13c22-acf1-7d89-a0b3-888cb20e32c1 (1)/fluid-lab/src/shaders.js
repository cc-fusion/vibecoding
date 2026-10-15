// All numerical kernels run in parallel on the GPU. JavaScript only schedules passes.
export const vertex = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const common = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform int uN;
out vec4 frag;
const float PI = 3.141592653589793;
vec4 cell(sampler2D t, ivec2 p) { return texelFetch(t, p & ivec2(uN - 1), 0); }
vec4 sampleBilinear(sampler2D t, vec2 p) {
  ivec2 i = ivec2(floor(p)); vec2 a = fract(p);
  return mix(mix(cell(t,i), cell(t,i+ivec2(1,0)), a.x),
             mix(cell(t,i+ivec2(0,1)), cell(t,i+ivec2(1,1)), a.x), a.y);
}
// A texel packs u at the right face, v at the top face, and dye at the center.
vec2 velocityAt(sampler2D t, vec2 centerCoordinates) {
  return vec2(sampleBilinear(t,centerCoordinates-vec2(.5,0)).r,
              sampleBilinear(t,centerCoordinates-vec2(0,.5)).g);
}
float divergenceAt(sampler2D t, ivec2 p) {
  vec2 v = cell(t,p).rg;
  return float(uN)*(v.x-cell(t,p-ivec2(1,0)).r + v.y-cell(t,p-ivec2(0,1)).g);
}
vec2 periodicDelta(vec2 d) { return d - floor(d + .5); }
`;
export const initialize =
  common +
  `
uniform int uPreset;
float psi(vec2 p) {
  vec2 a=periodicDelta(p-vec2(.39,.5)), b=periodicDelta(p-vec2(.61,.5));
  if(uPreset==2) return 0.0;
  if(uPreset==1) return .012*sin(2.0*PI*p.x)*sin(2.0*PI*p.y);
  return .019*exp(-dot(a,a)/.025)-.019*exp(-dot(b,b)/.025);
}
void main() {
  vec2 p=gl_FragCoord.xy/float(uN), corner=p+.5/float(uN);
  float h=1.0/float(uN);
  vec2 v=vec2(psi(corner)-psi(corner-vec2(0,h)), -psi(corner)+psi(corner-vec2(h,0)))/h;
  float dye=0.0;
  if(uPreset==0) {
    vec2 a=p-vec2(.39,.50), b=p-vec2(.61,.50);
    float ra=length(a),rb=length(b), ta=atan(a.y,a.x),tb=atan(b.y,b.x);
    float ringA=exp(-pow((ra-.17-.014*sin(ta*5.0)-.006*cos(ta*11.0))/.04,2.0));
    float ringB=exp(-pow((rb-.17+.014*sin(tb*5.0)+.006*cos(tb*11.0))/.04,2.0));
    dye=(ringA*(.18+.82*pow(.5+.5*sin(240.0*ra-7.0*ta+2.0*sin(9.0*ta)),2.0))+
         ringB*(.18+.82*pow(.5+.5*sin(240.0*rb+7.0*tb+2.0*sin(9.0*tb)),2.0)))*1.5;
  } else if(uPreset==1) {
    dye=exp(-pow((p.x-.5)/.09,2.0)-pow((p.y-.23)/.12,2.0))*2.0;
  }
  frag=vec4(v,dye,0);
}`;
export const forceDiffuse =
  common +
  `
uniform sampler2D uState;
uniform float uDt, uViscosity, uVelocityDecay, uDensityDecay;
uniform bool uBrush, uInjectDye;
uniform vec2 uPoint, uPrevious, uImpulse;
uniform float uRadius, uDyeAmount;
float brushWeight(vec2 p) {
  vec2 ab=periodicDelta(uPoint-uPrevious), ap=periodicDelta(p-uPrevious);
  float t=clamp(dot(ap,ab)/max(dot(ab,ab),1e-10),0.0,1.0);
  float d=length(ap-ab*t);
  return exp(-d*d/max(uRadius*uRadius*.35,1e-9));
}
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=cell(uState,p);
  vec2 lap=cell(uState,p+ivec2(1,0)).rg+cell(uState,p-ivec2(1,0)).rg+
           cell(uState,p+ivec2(0,1)).rg+cell(uState,p-ivec2(0,1)).rg-4.0*s.rg;
  s.rg += uDt*uViscosity*float(uN*uN)*lap;
  s.rg *= exp(-uVelocityDecay*uDt); s.b*=exp(-uDensityDecay*uDt);
  if(uBrush) {
    vec2 center=gl_FragCoord.xy/float(uN);
    float wx=brushWeight(center+vec2(.5,0)/float(uN));
    float wy=brushWeight(center+vec2(0,.5)/float(uN));
    s.rg += uImpulse*vec2(wx,wy);
    if(uInjectDye) s.b=min(8.0,s.b+uDyeAmount*uDt*brushWeight(center));
  }
  frag=vec4(s.rgb,0);
}`;
export const advect =
  common +
  `
uniform sampler2D uSource, uVelocity, uBounds;
uniform float uDt;
uniform bool uLimit;
vec3 departure(vec2 p) {
  // Positions are in cell-center index units; velocities are in domain units / second.
  vec2 pu=p+vec2(.5,0), pv=p+vec2(0,.5);
  vec2 a=pu-uDt*float(uN)*velocityAt(uVelocity,pu)-vec2(.5,0);
  vec2 b=pv-uDt*float(uN)*velocityAt(uVelocity,pv)-vec2(0,.5);
  vec2 c=p-uDt*float(uN)*velocityAt(uVelocity,p);
  vec3 value=vec3(sampleBilinear(uSource,a).r,sampleBilinear(uSource,b).g,sampleBilinear(uSource,c).b);
  if(uLimit) {
    ivec2 ia=ivec2(floor(a)),ib=ivec2(floor(b)),ic=ivec2(floor(c));
    vec4 a0=cell(uBounds,ia),a1=cell(uBounds,ia+ivec2(1,0)),a2=cell(uBounds,ia+ivec2(0,1)),a3=cell(uBounds,ia+ivec2(1,1));
    vec4 b0=cell(uBounds,ib),b1=cell(uBounds,ib+ivec2(1,0)),b2=cell(uBounds,ib+ivec2(0,1)),b3=cell(uBounds,ib+ivec2(1,1));
    vec4 c0=cell(uBounds,ic),c1=cell(uBounds,ic+ivec2(1,0)),c2=cell(uBounds,ic+ivec2(0,1)),c3=cell(uBounds,ic+ivec2(1,1));
    vec3 lo=vec3(min(min(a0.r,a1.r),min(a2.r,a3.r)),min(min(b0.g,b1.g),min(b2.g,b3.g)),min(min(c0.b,c1.b),min(c2.b,c3.b)));
    vec3 hi=vec3(max(max(a0.r,a1.r),max(a2.r,a3.r)),max(max(b0.g,b1.g),max(b2.g,b3.g)),max(max(c0.b,c1.b),max(c2.b,c3.b)));
    value=clamp(value,lo,hi);
  }
  return value;
}
void main() { frag=vec4(departure(gl_FragCoord.xy-.5),0); }
`;
export const correct =
  common +
  `
uniform sampler2D uOriginal,uReverse;
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec3 a=cell(uOriginal,p).rgb,b=cell(uReverse,p).rgb;
  frag=vec4(a+.5*(a-b),0);
}`;
export const divergence =
  common +
  `
uniform sampler2D uState;
void main() { frag=vec4(divergenceAt(uState,ivec2(gl_FragCoord.xy)),0,0,0); }
`;
export const fft =
  common +
  `
uniform sampler2D uInput, uRoots;
uniform int uStage, uAxis;
uniform bool uInverse;
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);
  int k=uAxis==0?p.x:p.y, halfStage=uStage/2;
  int base=(k/uStage)*halfStage+k%halfStage;
  ivec2 a=p,b=p;
  if(uAxis==0) { a.x=base;b.x=base+uN/2; } else { a.y=base;b.y=base+uN/2; }
  vec2 even=texelFetch(uInput,a,0).rg,odd=texelFetch(uInput,b,0).rg;
  int root=(k%uStage)*(uN/uStage);
  vec2 w=texelFetch(uRoots,ivec2(root,0),0).rg;
  if(uInverse) w.y=-w.y;
  vec2 product=vec2(w.x*odd.x-w.y*odd.y,w.x*odd.y+w.y*odd.x);
  frag=vec4((even+product)*(uInverse?.5:1.0),0,0);
}`;
export const poisson =
  common +
  `
uniform sampler2D uInput, uRoots;
void main() {
  ivec2 k=ivec2(gl_FragCoord.xy);
  if(k==ivec2(0)) { frag=vec4(0);return; }
  // Exact Fourier symbol of D_backward * G_forward for the staggered MAC grid.
  // Precomputed high-accuracy sin² values avoid driver trigonometric error and
  // cancellation in 1-cos(theta) at the lowest frequencies.
  float sx=texelFetch(uRoots,ivec2(k.x,0),0).b;
  float sy=texelFetch(uRoots,ivec2(k.y,0),0).b;
  float lambda=-4.0*float(uN*uN)*(sx+sy);
  frag=vec4(texelFetch(uInput,k,0).rg/lambda,0,0);
}`;
export const project =
  common +
  `
uniform sampler2D uState,uPressure;
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);float q=cell(uPressure,p).r;
  vec2 grad=float(uN)*vec2(cell(uPressure,p+ivec2(1,0)).r-q,cell(uPressure,p+ivec2(0,1)).r-q);
  frag=vec4(cell(uState,p).rg-grad,cell(uState,p).b,0);
}`;
export const diagnostics =
  common +
  `
uniform sampler2D uState,uIntermediate;
vec4 metrics(ivec2 p) {
  float after=divergenceAt(uState,p),before=divergenceAt(uIntermediate,p);
  vec4 s=cell(uState,p);
  return vec4(after*after,before*before,dot(s.rg,s.rg),s.b);
}
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy)*2;
  vec4 a=metrics(p),b=metrics(p+ivec2(1,0)),c=metrics(p+ivec2(0,1)),d=metrics(p+ivec2(1,1));
  frag=(a+b+c+d)*.25;frag.b=max(max(a.b,b.b),max(c.b,d.b));
}`;
export const reduce =
  common +
  `
uniform sampler2D uInput;
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy)*2;
  vec4 a=texelFetch(uInput,p,0),b=texelFetch(uInput,p+ivec2(1,0),0),c=texelFetch(uInput,p+ivec2(0,1),0),d=texelFetch(uInput,p+ivec2(1,1),0);
  frag=(a+b+c+d)*.25;frag.b=max(max(a.b,b.b),max(c.b,d.b));
}`;
export const display =
  common +
  `
uniform sampler2D uState,uPressure;
uniform vec2 uResolution,uPointer;
uniform int uView,uPalette;
uniform float uExposure,uRadius;
uniform bool uGrid,uVectors,uHover;
vec3 colorRamp(float t) {
  t=max(0.0,t);vec3 c;
  if(uPalette==1) c=mix(vec3(.035,.16,.22),vec3(.18,.73,.83),clamp(t,0.0,1.0));
  else if(uPalette==2) c=mix(vec3(.08,.085,.09),vec3(.84,.86,.82),clamp(t,0.0,1.0));
  else c=mix(vec3(.23,.046,.027),vec3(.96,.32,.13),clamp(t,0.0,1.0));
  c=mix(c,vec3(1.0,.86,.64),clamp((t-1.0)*.6,0.0,.85));
  return mix(vec3(.039,.047,.055),c,clamp(t*2.8,0.0,1.0));
}
float line(vec2 p,vec2 a,vec2 b) {
  vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/max(dot(ab,ab),1e-8),0.0,1.0));
}
void main() {
  vec2 uv=gl_FragCoord.xy/uResolution, p=uv*float(uN)-.5;
  vec4 s=sampleBilinear(uState,p); vec3 col;
  if(uView==0) col=colorRamp(s.b*uExposure);
  else if(uView==1) {
    vec2 v=velocityAt(uState,p);float speed=length(v)*uExposure*3.0;
    col=colorRamp(speed);
  } else {
    float value=uView==2?sampleBilinear(uPressure,p).r*150.0:divergenceAt(uState,ivec2(uv*float(uN)))*.1;
    float magnitude=1.0-exp(-abs(value)*uExposure);
    col=mix(vec3(.065,.077,.088),value>0.0?vec3(.94,.36,.19):vec3(.13,.63,.75),magnitude);
  }
  if(uGrid) {
    vec2 g=abs(fract(uv*16.0)-.5)/fwidth(uv*16.0);
    float edge=1.0-clamp(min(g.x,g.y),0.0,1.0);col+=edge*.055;
  }
  if(uVectors) {
    vec2 tile=floor(uv*24.0),center=(tile+.5)/24.0;
    vec2 v=velocityAt(uState,center*float(uN)-.5);float speed=length(v);
    vec2 dir=v/max(speed,1e-6),a=center-dir*.010,b=center+dir*.010;
    float dist=line(uv,a,b);
    vec2 side=vec2(-dir.y,dir.x);
    dist=min(dist,min(line(uv,b,b-dir*.006+side*.004),line(uv,b,b-dir*.006-side*.004)));
    float arrow=(1.0-smoothstep(.0003,.0015,dist))*clamp(speed*15.0,0.0,.65);
    col=mix(col,vec3(.85,.89,.89),arrow);
  }
  if(uHover) {
    float ring=1.0-smoothstep(.0008,.0020,abs(length(uv-uPointer)-uRadius));
    col=mix(col,vec3(.91,.82,.67),ring*.6);
  }
  frag=vec4(col,1);
}`;

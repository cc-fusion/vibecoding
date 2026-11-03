import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec2 light;
attribute float shade;
attribute vec3 tint;
varying vec2 vUv;
varying vec2 vLight;
varying float vShade;
varying vec3 vTint;
varying float vDist;
varying vec3 vWorldPos;
uniform float time;
uniform float wave;
void main() {
  vUv = uv; vLight = light; vShade = shade; vTint = tint;
  vec3 p = position;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  if (wave > 0.5) {
    wp.y += sin(wp.x * 1.3 + time * 1.7) * 0.04 + cos(wp.z * 1.1 + time * 1.3) * 0.04 - 0.04;
  }
  vWorldPos = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform sampler2D atlas;
uniform float daylight;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float alpha;
uniform float wave;
uniform vec3 skyTint;
uniform vec3 cameraPos;
varying vec2 vUv;
varying vec2 vLight;
varying float vShade;
varying vec3 vTint;
varying float vDist;
varying vec3 vWorldPos;
void main() {
  vec4 tex = texture2D(atlas, vUv);
  if (tex.a < 0.5 && wave < 0.5) discard;
  float sky = vLight.x * daylight;
  float blk = vLight.y;
  // nonlinear falloff so torch light feels warm and local
  float skyB = sky / (3.0 - 2.0 * sky);
  float blkB = blk / (3.0 - 2.0 * blk);
  vec3 skyCol = skyB * skyTint;
  vec3 blkCol = blkB * vec3(1.0, 0.82, 0.58);
  vec3 lightCol = max(skyCol, blkCol);
  lightCol = max(lightCol, vec3(0.035));
  vec3 col = tex.rgb * vTint * lightCol * vShade;
  float fog = smoothstep(fogNear, fogFar, vDist);
  col = mix(col, fogColor, fog);
  float a = wave > 0.5 ? alpha : 1.0;
  gl_FragColor = vec4(col, a);
}`;

export function createMaterials(atlasTexture) {
  const uniforms = {
    atlas: { value: atlasTexture },
    daylight: { value: 1 },
    fogColor: { value: new THREE.Color(0.7, 0.8, 1.0) },
    fogNear: { value: 60 },
    fogFar: { value: 110 },
    time: { value: 0 },
    skyTint: { value: new THREE.Color(1, 1, 1) },
    cameraPos: { value: new THREE.Vector3() },
  };
  const solid = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, alpha: { value: 1 }, wave: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.FrontSide,
  });
  const water = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, alpha: { value: 0.62 }, wave: { value: 1 } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  return { solid, water, uniforms };
}

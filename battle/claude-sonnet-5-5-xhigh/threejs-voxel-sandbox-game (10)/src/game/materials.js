// Shared voxel shader: texture array atlas, baked sky/block light, day-night, fog, water waves.
import * as THREE from 'three';
import { buildAtlasTexture } from './textures.js';
import { layerOf } from './blocks.js';

const VERT = /* glsl */`
attribute vec3 aUvw;
attribute vec4 aLight;
attribute vec4 aTint;
uniform float uTime;
varying vec3 vUvw;
varying vec3 vLight;
varying vec3 vTint;
varying float vFlags;
varying float vDist;
void main() {
  float flags = floor(aLight.w * 255.0 + 0.5);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  if (mod(flags, 8.0) >= 4.0) {
    wp.y += sin(wp.x * 1.3 + uTime * 1.6) * 0.022 + cos(wp.z * 1.1 + uTime * 1.3) * 0.022 - 0.02;
  }
  if (mod(flags, 4.0) >= 2.0) {
    wp.x += sin(uTime * 1.9 + wp.x * 0.8 + wp.z * 0.6) * 0.06;
    wp.z += cos(uTime * 1.6 + wp.z * 0.7 + wp.x * 0.5) * 0.045;
  }
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;
  vUvw = aUvw;
  vLight = aLight.xyz;
  vTint = aTint.rgb;
  vFlags = flags;
  vDist = length(mv.xyz);
}
`;

const FRAG = /* glsl */`
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAtlas;
uniform float uTime;
uniform float uSky;
uniform vec3 uSkyTint;
uniform float uAmbient;
uniform float uFlash;
uniform float uTorch;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAlphaCut;
uniform float uWaterLayer;
uniform float uLavaLayer;
uniform vec3 uEntTint;
uniform float uEntFlat;
varying vec3 vUvw;
varying vec3 vLight;
varying vec3 vTint;
varying float vFlags;
varying float vDist;
float curve(float v) { return pow(0.8, (1.0 - v) * 15.0); }
void main() {
  vec2 uv = vUvw.xy;
  float layer = vUvw.z;
  if (abs(layer - uWaterLayer) < 0.5) uv += vec2(uTime * 0.035, uTime * 0.02);
  else if (abs(layer - uLavaLayer) < 0.5) uv += vec2(uTime * 0.012, -uTime * 0.02);
  vec4 tex = texture(uAtlas, vec3(uv, layer));
  if (tex.a < uAlphaCut) discard;
  vec3 tint = vTint;
  if (mod(floor(vFlags / 8.0), 2.0) >= 1.0) tint = mix(vTint, vec3(1.0), clamp((tex.a - 0.5) * 2.0, 0.0, 1.0));
  vec3 col = tex.rgb * tint;
  bool emissive = mod(vFlags, 2.0) >= 1.0;
  float sky = curve(vLight.x) * uSky;
  float blk = curve(vLight.y) * uTorch;
  vec3 skyCol = uSkyTint * sky;
  vec3 blkCol = vec3(1.0, 0.82, 0.58) * blk;
  vec3 lum = 1.0 - (1.0 - skyCol) * (1.0 - blkCol);
  lum = max(lum, vec3(uAmbient));
  lum += vec3(uFlash);
  if (emissive) { lum = vec3(1.0); col *= 1.0; }
  else col *= vLight.z;
  col *= lum * uEntTint;
  float f = smoothstep(uFogNear, uFogFar, vDist);
  col = mix(col, uFogColor, f);
  float a = tex.a;
  gl_FragColor = vec4(col, a);
}
`;

export function createVoxelUniforms() {
  const atlas = buildAtlasTexture();
  return {
    uAtlas: { value: atlas },
    uTime: { value: 0 },
    uSky: { value: 1 },
    uSkyTint: { value: new THREE.Vector3(1, 1, 1) },
    uAmbient: { value: 0.035 },
    uFlash: { value: 0 },
    uTorch: { value: 1 },
    uFogColor: { value: new THREE.Color(0.7, 0.8, 1.0) },
    uFogNear: { value: 80 },
    uFogFar: { value: 140 },
    uWaterLayer: { value: layerOf('water') },
    uLavaLayer: { value: layerOf('lava') },
  };
}

export function createVoxelMaterial(shared, { transparent = false, alphaCut = 0.4, side = THREE.DoubleSide } = {}) {
  const uniforms = {
    ...shared,
    uAlphaCut: { value: alphaCut },
    uEntTint: { value: new THREE.Vector3(1, 1, 1) },
    uEntFlat: { value: 0 },
  };
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent, side,
    depthWrite: !transparent, fog: false,
  });
}

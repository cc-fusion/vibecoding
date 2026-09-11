// Custom chunk shader: baked sky/block light + AO per vertex, texture atlas, distance fog.
import * as THREE from "three";

export const CHUNK_VERT = /* glsl */ `
attribute vec3 aShade;
varying vec2 vUv;
varying vec3 vLight;
varying float vDepth;
uniform float uSun;
uniform vec3 uSkyTint;
void main() {
  vUv = uv;
  vec3 skyCol = vec3(aShade.x * uSun) * uSkyTint;
  vec3 blockCol = vec3(aShade.y) * vec3(1.0, 0.86, 0.66);
  vLight = max(max(skyCol, blockCol), vec3(0.025)) * aShade.z;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const CHUNK_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAlpha;
varying vec2 vUv;
varying vec3 vLight;
varying float vDepth;
void main() {
  vec4 c = texture2D(uMap, vUv);
  #ifdef CUTOUT
  if (c.a < 0.5) discard;
  #endif
  c.rgb *= vLight;
  float f = smoothstep(uFogNear, uFogFar, vDepth);
  c.rgb = mix(c.rgb, uFogColor, f);
  c.a *= uAlpha;
  gl_FragColor = c;
  #include <colorspace_fragment>
}
`;

export function makeChunkMaterials(atlas: THREE.Texture) {
  const uniforms = {
    uMap: { value: atlas },
    uSun: { value: 1 },
    uSkyTint: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color(0.6, 0.75, 0.95) },
    uFogNear: { value: 60 },
    uFogFar: { value: 90 },
    uAlpha: { value: 1 },
  };
  const solid = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: CHUNK_VERT,
    fragmentShader: CHUNK_FRAG,
    defines: { CUTOUT: 1 },
    side: THREE.FrontSide,
  });
  const water = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uAlpha: { value: 0.72 } },
    vertexShader: CHUNK_VERT,
    fragmentShader: CHUNK_FRAG,
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  return { solid, water, uniforms };
}

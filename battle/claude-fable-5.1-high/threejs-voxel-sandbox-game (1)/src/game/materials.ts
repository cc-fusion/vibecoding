// Custom shader materials for voxel chunks.
import * as THREE from "three";
import { buildAtlas } from "./textures";

export interface WorldUniforms {
  atlas: { value: THREE.Texture };
  uSun: { value: number }; // 0..1 sunlight intensity
  uSunColor: { value: THREE.Color };
  uTorchColor: { value: THREE.Color };
  uAmbient: { value: number };
  uFogColor: { value: THREE.Color };
  uFogNear: { value: number };
  uFogFar: { value: number };
  uTime: { value: number };
  uUnderwater: { value: number };
}

let uniforms: WorldUniforms | null = null;
let materials: { opaque: THREE.ShaderMaterial; water: THREE.ShaderMaterial } | null = null;

export function getUniforms(): WorldUniforms {
  if (!uniforms) {
    uniforms = {
      atlas: { value: buildAtlas() },
      uSun: { value: 1 },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uTorchColor: { value: new THREE.Color(1.0, 0.82, 0.55) },
      uAmbient: { value: 0.08 },
      uFogColor: { value: new THREE.Color(0.7, 0.85, 1) },
      uFogNear: { value: 80 },
      uFogFar: { value: 140 },
      uTime: { value: 0 },
      uUnderwater: { value: 0 },
    };
  }
  return uniforms;
}

const vertexShader = /* glsl */ `
  attribute vec2 aLight;
  attribute vec3 aColor;
  varying vec2 vUv;
  varying vec2 vLight;
  varying vec3 vColor;
  varying float vDist;
  varying vec3 vWorldPos;
  uniform float uTime;
  #ifdef WATER
  #endif
  void main() {
    vUv = uv;
    vLight = aLight;
    vColor = aColor;
    vec3 p = position;
    #ifdef WATER
      float w = sin(p.x * 1.3 + uTime * 1.7) * 0.5 + sin(p.z * 1.1 + uTime * 1.3 + p.x * 0.5) * 0.5;
      if (fract(p.y) > 0.5) p.y += w * 0.045 - 0.02;
    #endif
    vWorldPos = p;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D atlas;
  uniform float uSun;
  uniform vec3 uSunColor;
  uniform vec3 uTorchColor;
  uniform float uAmbient;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform float uUnderwater;
  varying vec2 vUv;
  varying vec2 vLight;
  varying vec3 vColor;
  varying float vDist;
  varying vec3 vWorldPos;
  void main() {
    vec4 tex = texture2D(atlas, vUv);
    #ifdef WATER
      tex.a = 0.62;
      // subtle moving highlight
      float sh = sin(vWorldPos.x * 2.0 + uTime * 1.5) * sin(vWorldPos.z * 2.3 - uTime * 1.1);
      tex.rgb += sh * 0.05;
    #else
      if (tex.a < 0.5) discard;
    #endif
    vec3 sky = uSunColor * (vLight.x * uSun);
    vec3 torch = uTorchColor * vLight.y;
    // torch flicker
    torch *= 0.94 + 0.06 * sin(uTime * 9.0 + vWorldPos.x * 3.0 + vWorldPos.z * 2.0);
    vec3 light = max(sky, torch);
    light = max(light, vec3(uAmbient) * max(vLight.x, vLight.y) * 2.0 + uAmbient * 0.5);
    vec3 col = tex.rgb * vColor * light;
    float fogF = smoothstep(uFogNear, uFogFar, vDist);
    if (uUnderwater > 0.5) fogF = smoothstep(2.0, 24.0, vDist);
    col = mix(col, uFogColor, fogF);
    gl_FragColor = vec4(col, tex.a);
  }
`;

export function getMaterials() {
  if (materials) return materials;
  const u = getUniforms();
  const opaque = new THREE.ShaderMaterial({
    uniforms: u as unknown as { [k: string]: THREE.IUniform },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });
  const water = new THREE.ShaderMaterial({
    uniforms: u as unknown as { [k: string]: THREE.IUniform },
    vertexShader,
    fragmentShader,
    defines: { WATER: 1 },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials = { opaque, water };
  return materials;
}

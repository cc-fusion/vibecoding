import * as THREE from "three";

export interface VoxelUniforms {
  uAtlas: { value: THREE.DataArrayTexture | null };
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uDayLight: { value: number };
  uSkyLightColor: { value: THREE.Color };
  uAmbient: { value: THREE.Color };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uUnderwater: { value: number };
  uCamPos: { value: THREE.Vector3 };
  uTorchColor: { value: THREE.Color };
  uLightning: { value: number };
}

export function makeUniforms(atlas: THREE.DataArrayTexture): VoxelUniforms {
  return {
    uAtlas: { value: atlas },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.9, 0.2).normalize() },
    uDayLight: { value: 1 },
    uSkyLightColor: { value: new THREE.Color(1, 1, 1) },
    uAmbient: { value: new THREE.Color(0.05, 0.06, 0.09) },
    uFogColor: { value: new THREE.Color(0.6, 0.75, 1) },
    uFogDensity: { value: 0.012 },
    uUnderwater: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uTorchColor: { value: new THREE.Color(1.0, 0.62, 0.28) },
    uLightning: { value: 0 },
  };
}

const VERT = /* glsl */ `
precision highp float;

in vec2 aUv;
in float aLayer;
in vec3 aLight;
in float aFace;
in vec3 aTint;

out vec2 vUv;
out float vLayer;
out vec3 vLight;
out vec3 vTint;
out float vFace;
out vec3 vWorld;
out float vFogDepth;

uniform float uTime;

const float FACE_SHADE[7] = float[7](1.0, 0.52, 0.72, 0.72, 0.86, 0.86, 0.96);

void main() {
  vUv = aUv;
  vLayer = aLayer;
  vLight = aLight;
  vTint = aTint;
  vFace = FACE_SHADE[int(aFace + 0.5)];

  vec3 p = position;
  #ifdef WATER
    float w = sin(p.x * 0.7 + uTime * 1.6) * 0.5 + sin(p.z * 0.9 - uTime * 1.9) * 0.5;
    if (aFace < 0.5) p.y += w * 0.035;
  #endif
  #ifdef FOLIAGE
    if (aUv.y < 0.5) {
      float s = sin(uTime * 1.5 + position.x * 0.6 + position.z * 0.8);
      float c = cos(uTime * 1.1 + position.x * 0.9);
      p.x += s * 0.055;
      p.z += c * 0.045;
    }
  #endif

  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;

uniform sampler2DArray uAtlas;
uniform vec3 uSunDir;
uniform float uDayLight;
uniform vec3 uSkyLightColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uUnderwater;
uniform vec3 uCamPos;
uniform vec3 uTorchColor;
uniform float uTime;
uniform float uLightning;

in vec2 vUv;
in float vLayer;
in vec3 vLight;
in vec3 vTint;
in float vFace;
in vec3 vWorld;
in float vFogDepth;

layout(location = 0) out vec4 fragColor;

void main() {
  vec4 tex = texture(uAtlas, vec3(vUv, vLayer));

  #ifdef CUTOUT
    if (tex.a < 0.5) discard;
  #endif
  #ifdef WATER
    tex.a = max(tex.a, 0.5);
  #endif

  float sky = vLight.x;
  float blk = vLight.y;
  float ao  = vLight.z;

  float skyAmt = sky * uDayLight;
  vec3 skyCol = uSkyLightColor * skyAmt;
  float bl = blk * blk * 1.08;
  vec3 blkCol = uTorchColor * bl;

  // flicker torches subtly
  blkCol *= 0.94 + 0.06 * sin(uTime * 9.0 + vWorld.x * 3.1 + vWorld.z * 2.3);

  vec3 lightCol = max(skyCol, blkCol);
  lightCol += uAmbient;
  lightCol += uLightning * 0.9 * sky;

  // soft sun wrap term on upward faces
  float sunUp = max(uSunDir.y, 0.0);
  lightCol += uSkyLightColor * skyAmt * sunUp * 0.10 * step(0.95, vFace);

  vec3 color = tex.rgb * vTint * lightCol * vFace * ao;

  #ifdef WATER
    vec3 viewDir = normalize(vWorld - uCamPos);
    vec3 n = vec3(0.0, 1.0, 0.0);
    n.x += sin(vWorld.x * 1.8 + uTime * 2.0) * 0.12;
    n.z += cos(vWorld.z * 1.6 - uTime * 1.7) * 0.12;
    n = normalize(n);
    float fres = pow(1.0 - max(dot(-viewDir, n), 0.0), 3.0);
    vec3 h = normalize(uSunDir - viewDir);
    float spec = pow(max(dot(n, h), 0.0), 90.0) * uDayLight;
    color = mix(color, uFogColor * 1.05, fres * 0.55);
    color += vec3(1.0, 0.97, 0.9) * spec * 1.6;
    tex.a = mix(0.72, 0.93, fres);
  #endif

  // fog
  float d = vFogDepth;
  float density = uFogDensity * mix(1.0, 7.0, uUnderwater);
  float f = 1.0 - exp(-pow(d * density, 2.0));
  f = clamp(f, 0.0, 1.0);
  vec3 fogC = mix(uFogColor, vec3(0.09, 0.26, 0.45), uUnderwater);
  color = mix(color, fogC, f);

  fragColor = vec4(color, tex.a);
}
`;

export type VoxelPass = "opaque" | "cutout" | "water";

export function createVoxelMaterial(u: VoxelUniforms, pass: VoxelPass): THREE.ShaderMaterial {
  const defines: Record<string, string> = {};
  if (pass === "cutout") {
    defines.CUTOUT = "1";
    defines.FOLIAGE = "1";
  }
  if (pass === "water") defines.WATER = "1";
  const m = new THREE.ShaderMaterial({
    uniforms: u as unknown as Record<string, THREE.IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    glslVersion: THREE.GLSL3,
    transparent: pass === "water",
    depthWrite: true,
    side: pass === "water" ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.toneMapped = true;
  return m;
}

/** 10-stage crack overlay texture */
export function makeCrackTexture(): THREE.DataArrayTexture {
  const N = 10;
  const S = 16;
  const data = new Uint8Array(S * S * 4 * N);
  for (let s = 0; s < N; s++) {
    const off = s * S * S * 4;
    const branches = 2 + s;
    for (let b = 0; b < branches; b++) {
      let x = 8 + Math.cos((b / branches) * Math.PI * 2) * 1.5;
      let y = 8 + Math.sin((b / branches) * Math.PI * 2) * 1.5;
      const ang = (b / branches) * Math.PI * 2 + (s % 3) * 0.3;
      const len = 2 + s * 0.9;
      for (let t = 0; t < len; t++) {
        x += Math.cos(ang) + (((b * 7 + t * 13 + s * 5) % 5) - 2) * 0.22;
        y += Math.sin(ang) + (((b * 11 + t * 3 + s * 7) % 5) - 2) * 0.22;
        const px = Math.round(x),
          py = Math.round(y);
        if (px < 0 || py < 0 || px >= S || py >= S) break;
        const i = off + (py * S + px) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 200;
      }
    }
  }
  const tex = new THREE.DataArrayTexture(data, S, S, N);
  tex.format = THREE.RGBAFormat;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createCrackMaterial(tex: THREE.DataArrayTexture) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uStage: { value: 0 } },
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler2DArray;
      uniform sampler2DArray uTex;
      uniform float uStage;
      in vec2 vUv;
      layout(location = 0) out vec4 fragColor;
      void main(){
        vec4 c = texture(uTex, vec3(vUv, uStage));
        if (c.a < 0.1) discard;
        fragColor = c;
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

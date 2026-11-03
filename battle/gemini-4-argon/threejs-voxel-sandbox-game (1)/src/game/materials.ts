import * as THREE from 'three';

export interface VoxelMaterialBundle {
  opaque: THREE.ShaderMaterial;
  cutout: THREE.ShaderMaterial;
  translucent: THREE.ShaderMaterial;
  uniforms: {
    uMap: { value: THREE.Texture };
    uTime: { value: number };
    uDayLight: { value: number };
    uSkyTint: { value: THREE.Color };
    uBlockTint: { value: THREE.Color };
    uFogColor: { value: THREE.Color };
    uFogNear: { value: number };
    uFogFar: { value: number };
    uPlayerPos: { value: THREE.Vector3 };
    uHeldLight: { value: number };
  };
}

const VERTEX_COMMON = /* glsl */ `
  attribute float aShade;
  attribute vec2 aLight;
  attribute float aSway;

  uniform float uTime;

  varying vec2 vUv;
  varying float vShade;
  varying vec2 vLight;
  varying vec3 vWorldPos;
  varying float vFogDepth;
`;

const FRAGMENT_LIGHTING = /* glsl */ `
  vec3 computeVoxelLight(vec3 albedo) {
    float skyL = pow(clamp(vLight.x * uDayLight, 0.0, 1.0), 1.15);
    float flicker = 0.96 + 0.04 * sin(uTime * 7.3 + vWorldPos.x * 1.7 + vWorldPos.z * 1.3);
    float handDist = length(vWorldPos - uPlayerPos);
    float handL = uHeldLight * clamp(1.0 - handDist / 13.5, 0.0, 1.0);
    float blockL = max(vLight.y * flicker, handL);

    vec3 skyContrib = uSkyTint * max(skyL, 0.065);
    vec3 blockContrib = uBlockTint * pow(blockL, 1.1);
    vec3 combinedLight = max(skyContrib, blockContrib * 1.06) + min(skyContrib, blockContrib) * 0.25;

    return albedo * combinedLight * vShade;
  }

  vec3 applyAtmosphereFog(vec3 color) {
    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    return mix(color, uFogColor, fogFactor);
  }
`;

export function createVoxelMaterials(atlasTexture: THREE.Texture): VoxelMaterialBundle {
  const sharedUniforms = {
    uMap: { value: atlasTexture },
    uTime: { value: 0 },
    uDayLight: { value: 1.0 },
    uSkyTint: { value: new THREE.Color('#ffffff') },
    uBlockTint: { value: new THREE.Color('#ffbe73') },
    uFogColor: { value: new THREE.Color('#8ec5ff') },
    uFogNear: { value: 52 },
    uFogFar: { value: 98 },
    uPlayerPos: { value: new THREE.Vector3() },
    uHeldLight: { value: 0 },
  };

  const opaque = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: /* glsl */ `
      ${VERTEX_COMMON}
      void main() {
        vUv = uv;
        vShade = aShade;
        vLight = aLight;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uDayLight;
      uniform vec3 uSkyTint;
      uniform vec3 uBlockTint;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uPlayerPos;
      uniform float uHeldLight;

      varying vec2 vUv;
      varying float vShade;
      varying vec2 vLight;
      varying vec3 vWorldPos;
      varying float vFogDepth;

      ${FRAGMENT_LIGHTING}

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        vec3 lit = computeVoxelLight(texel.rgb);
        gl_FragColor = vec4(applyAtmosphereFog(lit), 1.0);
      }
    `,
    side: THREE.FrontSide,
  });

  const cutout = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: /* glsl */ `
      ${VERTEX_COMMON}
      void main() {
        vUv = uv;
        vShade = aShade;
        vLight = aLight;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        if (aSway > 0.5) {
          float w = sin(uTime * 2.3 + worldPosition.x * 0.85 + worldPosition.z * 0.65) * 0.045;
          worldPosition.x += w;
          worldPosition.z += w * 0.6;
        }
        vWorldPos = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uDayLight;
      uniform vec3 uSkyTint;
      uniform vec3 uBlockTint;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uPlayerPos;
      uniform float uHeldLight;

      varying vec2 vUv;
      varying float vShade;
      varying vec2 vLight;
      varying vec3 vWorldPos;
      varying float vFogDepth;

      ${FRAGMENT_LIGHTING}

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        if (texel.a < 0.45) discard;
        vec3 lit = computeVoxelLight(texel.rgb);
        gl_FragColor = vec4(applyAtmosphereFog(lit), 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });

  const translucent = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${VERTEX_COMMON}
      void main() {
        vUv = uv;
        vShade = aShade;
        vLight = aLight;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        if (aSway > 0.5) {
          worldPosition.y += sin(uTime * 2.1 + worldPosition.x * 1.1 + worldPosition.z * 0.9) * 0.045 - 0.06;
        }
        vWorldPos = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uDayLight;
      uniform vec3 uSkyTint;
      uniform vec3 uBlockTint;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uPlayerPos;
      uniform float uHeldLight;

      varying vec2 vUv;
      varying float vShade;
      varying vec2 vLight;
      varying vec3 vWorldPos;
      varying float vFogDepth;

      ${FRAGMENT_LIGHTING}

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        float shimmer = sin(vWorldPos.x * 3.1 + uTime * 2.6) * cos(vWorldPos.z * 2.9 - uTime * 2.1);
        vec3 baseRgb = texel.rgb + vec3(max(0.0, shimmer) * 0.09);
        vec3 lit = computeVoxelLight(baseRgb);
        gl_FragColor = vec4(applyAtmosphereFog(lit), texel.a);
      }
    `,
    side: THREE.DoubleSide,
  });

  return {
    opaque,
    cutout,
    translucent,
    uniforms: sharedUniforms,
  };
}

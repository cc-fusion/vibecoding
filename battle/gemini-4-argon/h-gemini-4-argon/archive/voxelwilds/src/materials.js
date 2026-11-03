import * as THREE from 'three';

const VERTEX_SHADER = `
  attribute float aShade;
  attribute float aSky;
  attribute float aTorch;
  attribute float aSway;

  uniform float uTime;
  uniform float uSwayAmp;
  uniform float uIsWater;

  varying vec2 vUv;
  varying float vShade;
  varying float vSky;
  varying float vTorch;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);

    if (uSwayAmp > 0.0 && aSway > 0.5) {
      worldPosition.x += sin(uTime * 2.1 + worldPosition.z * 0.75 + worldPosition.x * 0.5) * 0.05 * uSwayAmp;
      worldPosition.z += cos(uTime * 1.8 + worldPosition.x * 0.65) * 0.04 * uSwayAmp;
    }

    if (uIsWater > 0.5) {
      worldPosition.y += sin(uTime * 2.3 + worldPosition.x * 0.85 + worldPosition.z * 0.85) * 0.032;
    }

    vec4 mvPosition = viewMatrix * worldPosition;
    vFogDepth = -mvPosition.z;
    vWorldPos = worldPosition.xyz;
    vUv = uv;
    vShade = aShade;
    vSky = aSky;
    vTorch = aTorch;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uAtlas;
  uniform float uSunBrightness;
  uniform vec3 uSkyTint;
  uniform vec3 uTorchColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAlphaTest;
  uniform float uOpacity;
  uniform vec3 uHeldLightPos;
  uniform float uHeldLightIntensity;
  uniform float uIsWater;
  uniform float uTime;

  varying vec2 vUv;
  varying float vShade;
  varying float vSky;
  varying float vTorch;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vec4 texel = texture2D(uAtlas, vUv);
    if (texel.a < uAlphaTest) discard;

    vec3 skyLight = uSkyTint * (vSky * uSunBrightness);

    float distHeld = distance(vWorldPos, uHeldLightPos);
    float heldAtten = clamp(1.0 - distHeld / 14.0, 0.0, 1.0);
    float heldFactor = uHeldLightIntensity * heldAtten * heldAtten;

    float torchLevel = max(vTorch, heldFactor);
    vec3 blockLight = uTorchColor * (torchLevel * 1.12);

    vec3 combinedLight = max(skyLight, blockLight * 0.94) + min(skyLight, blockLight) * 0.32;
    combinedLight = max(combinedLight, vec3(0.075, 0.085, 0.115));

    vec3 baseRgb = texel.rgb;
    if (uIsWater > 0.5) {
      float shimmer = sin(uTime * 3.1 + vWorldPos.x * 1.9 - vWorldPos.z * 1.7) * 0.045;
      baseRgb += vec3(max(0.0, shimmer));
    }

    vec3 litColor = baseRgb * combinedLight * vShade;

    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    vec3 finalRgb = mix(litColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalRgb, texel.a * uOpacity);
  }
`;

export function createVoxelMaterials(atlasTexture) {
  const sharedUniforms = {
    uAtlas: { value: atlasTexture },
    uTime: { value: 0 },
    uSunBrightness: { value: 1.0 },
    uSkyTint: { value: new THREE.Color(1.0, 0.99, 0.96) },
    uTorchColor: { value: new THREE.Color(1.0, 0.76, 0.42) },
    uFogColor: { value: new THREE.Color(0x8ec8ff) },
    uFogNear: { value: 42 },
    uFogFar: { value: 92 },
    uHeldLightPos: { value: new THREE.Vector3(0, -999, 0) },
    uHeldLightIntensity: { value: 0 },
  };

  function makeVariant({ alphaTest = 0.0, opacity = 1.0, transparent = false, doubleSided = false, swayAmp = 0.0, isWater = 0.0, depthWrite = true }) {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...sharedUniforms,
        uAlphaTest: { value: alphaTest },
        uOpacity: { value: opacity },
        uSwayAmp: { value: swayAmp },
        uIsWater: { value: isWater },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent,
      depthWrite,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  const opaqueMaterial = makeVariant({
    alphaTest: 0.0,
    opacity: 1.0,
    transparent: false,
    doubleSided: false,
    swayAmp: 0.0,
    isWater: 0.0,
    depthWrite: true,
  });

  const cutoutMaterial = makeVariant({
    alphaTest: 0.35,
    opacity: 1.0,
    transparent: false,
    doubleSided: true,
    swayAmp: 1.0,
    isWater: 0.0,
    depthWrite: true,
  });

  const waterMaterial = makeVariant({
    alphaTest: 0.01,
    opacity: 0.74,
    transparent: true,
    doubleSided: true,
    swayAmp: 0.0,
    isWater: 1.0,
    depthWrite: false,
  });

  return {
    sharedUniforms,
    opaqueMaterial,
    cutoutMaterial,
    waterMaterial,
  };
}

import * as THREE from 'three';

export function createChunkMaterials(atlasTexture) {
  const sharedUniforms = {
    uAtlas: { value: atlasTexture },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.45, 0.82, 0.35).normalize() },
    uSkyColor: { value: new THREE.Color(0xffffff) },
    uAmbientMin: { value: 0.14 },
    uTorchColor: { value: new THREE.Color(0xffb85c) },
    uTorchFlicker: { value: 1.0 },
    uHeldLight: { value: 0.0 },
    uFogColor: { value: new THREE.Color(0x8ec5ff) },
    uFogNear: { value: 45.0 },
    uFogFar: { value: 92.0 },
    uUnderwater: { value: 0.0 },
  };

  const vertexShader = `
    attribute vec3 aLight; // x: dirShade * ao, y: skyLight, z: blockLight
    attribute float aSway;

    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vLight;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying float vCamDist;

    void main() {
      vUv = uv;
      vLight = aLight;
      vNormal = normal;

      vec4 worldPosition = modelMatrix * vec4(position, 1.0);

      if (aSway > 0.001) {
        float wave = sin(uTime * 2.1 + worldPosition.x * 0.75 + worldPosition.z * 0.65) * 0.055 * aSway;
        float waveZ = cos(uTime * 1.7 + worldPosition.x * 0.55 - worldPosition.z * 0.8) * 0.04 * aSway;
        worldPosition.x += wave;
        worldPosition.z += waveZ;
      }

      vWorldPos = worldPosition.xyz;
      vec4 mvPosition = viewMatrix * worldPosition;
      vCamDist = length(mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShaderSolid = `
    uniform sampler2D uAtlas;
    uniform vec3 uSunDir;
    uniform vec3 uSkyColor;
    uniform float uAmbientMin;
    uniform vec3 uTorchColor;
    uniform float uTorchFlicker;
    uniform float uHeldLight;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uUnderwater;

    varying vec2 vUv;
    varying vec3 vLight;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying float vCamDist;

    void main() {
      vec4 tex = texture2D(uAtlas, vUv);
      #ifdef USE_CUTOUT
        if (tex.a < 0.45) discard;
      #endif

      float shadeAO = vLight.x;
      float skyFactor = vLight.y;
      float heldGlow = uHeldLight * pow(clamp(1.0 - vCamDist / 13.5, 0.0, 1.0), 1.45) * 0.88;
      float blockFactor = max(vLight.z, heldGlow);

      // Subtle directional sun boost on sun-facing surfaces exposed to sky
      float sunNdotL = max(0.0, dot(normalize(vNormal), uSunDir));
      float sunBoost = 0.86 + 0.22 * sunNdotL * skyFactor;

      vec3 skyTerm = uSkyColor * max(uAmbientMin, skyFactor * sunBoost);
      vec3 torchTerm = uTorchColor * (pow(blockFactor, 1.45) * 1.32 * uTorchFlicker);

      // Combine sky & block light smoothly without harsh clipping
      vec3 combinedLight = max(skyTerm, torchTerm) + min(skyTerm, torchTerm) * 0.32;
      vec3 litColor = tex.rgb * combinedLight * shadeAO;

      if (uUnderwater > 0.5) {
        litColor = mix(litColor, vec3(0.08, 0.34, 0.58), 0.36);
      }

      float fogFactor = smoothstep(uFogNear, uFogFar, vCamDist);
      vec3 finalColor = mix(litColor, uFogColor, fogFactor);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const waterVertexShader = `
    attribute vec3 aLight;

    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vLight;
    varying vec3 vWorldPos;
    varying float vCamDist;

    void main() {
      vUv = uv;
      vLight = aLight;

      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      // Gentle surface wave undulation
      float ripple = sin(uTime * 2.3 + worldPosition.x * 0.9 + worldPosition.z * 0.7) * 0.035
                   + cos(uTime * 1.6 - worldPosition.x * 0.6 + worldPosition.z * 1.1) * 0.025;
      worldPosition.y += ripple - 0.08;

      vWorldPos = worldPosition.xyz;
      vec4 mvPosition = viewMatrix * worldPosition;
      vCamDist = length(mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const waterFragmentShader = `
    uniform sampler2D uAtlas;
    uniform float uTime;
    uniform vec3 uSkyColor;
    uniform float uAmbientMin;
    uniform vec3 uTorchColor;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;

    varying vec2 vUv;
    varying vec3 vLight;
    varying vec3 vWorldPos;
    varying float vCamDist;

    void main() {
      vec4 tex = texture2D(uAtlas, vUv);
      float shimmer = sin(uTime * 3.0 + vWorldPos.x * 1.8 + vWorldPos.z * 1.6) * 0.5 + 0.5;
      vec3 waterBase = mix(tex.rgb, vec3(0.24, 0.62, 0.92), 0.35 + shimmer * 0.14);

      vec3 skyTerm = uSkyColor * max(uAmbientMin + 0.05, vLight.y);
      vec3 torchTerm = uTorchColor * (vLight.z * vLight.z);
      vec3 lit = waterBase * max(skyTerm, torchTerm) * vLight.x;
      // Subtle specular sky glint on ripples
      lit += uSkyColor * pow(shimmer, 6.0) * 0.14 * vLight.y;

      float fogFactor = smoothstep(uFogNear, uFogFar, vCamDist);
      vec3 finalColor = mix(lit, uFogColor, fogFactor);

      gl_FragColor = vec4(finalColor, 0.76);
    }
  `;

  const solidMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader,
    fragmentShader: fragmentShaderSolid,
  });

  const cutoutMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader,
    fragmentShader: `#define USE_CUTOUT\n` + fragmentShaderSolid,
    side: THREE.DoubleSide,
  });

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return {
    uniforms: sharedUniforms,
    solidMaterial,
    cutoutMaterial,
    waterMaterial,
  };
}

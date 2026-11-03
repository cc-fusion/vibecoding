import * as THREE from 'three';

export interface WorldUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uMap: THREE.IUniform<THREE.Texture>;
  uSunColor: THREE.IUniform<THREE.Color>;
  uSkyIntensity: THREE.IUniform<number>;
  uTorchFlicker: THREE.IUniform<number>;
  uFogColor: THREE.IUniform<THREE.Color>;
  uFogNear: THREE.IUniform<number>;
  uFogFar: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

export function createWorldUniforms(atlas: THREE.Texture): WorldUniforms {
  return {
    uMap: { value: atlas },
    uSunColor: { value: new THREE.Color(1.0, 0.98, 0.94) },
    uSkyIntensity: { value: 1.0 },
    uTorchFlicker: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0x87ceeb) },
    uFogNear: { value: 48 },
    uFogFar: { value: 108 },
    uTime: { value: 0 },
  };
}

export function createTerrainMaterial(
  uniforms: WorldUniforms,
  options: { cutout?: boolean; doubleSide?: boolean } = {}
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    defines: options.cutout ? { USE_CUTOUT: '' } : {},
    side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: false,
    vertexShader: /* glsl */ `
      attribute float aShade;
      attribute float aSkyLight;
      attribute float aBlockLight;

      uniform float uTime;

      varying vec2 vUv;
      varying float vShade;
      varying float vSkyLight;
      varying float vBlockLight;
      varying float vFogDepth;

      void main() {
        vUv = uv;
        vShade = aShade;
        vSkyLight = aSkyLight;
        vBlockLight = aBlockLight;

        vec3 pos = position;
        #ifdef USE_CUTOUT
          // Gentle breeze sway on top vertices of cross-quad foliage
          if (aShade > 0.93) {
            pos.x += sin(uTime * 2.2 + position.x * 0.9 + position.z * 0.7) * 0.03;
          }
        #endif

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vFogDepth = length(mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSunColor;
      uniform float uSkyIntensity;
      uniform float uTorchFlicker;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;

      varying vec2 vUv;
      varying float vShade;
      varying float vSkyLight;
      varying float vBlockLight;
      varying float vFogDepth;

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        #ifdef USE_CUTOUT
          if (texel.a < 0.45) discard;
        #endif

        vec3 skyTerm = uSunColor * (vSkyLight * uSkyIntensity);
        vec3 torchColor = vec3(1.0, 0.79, 0.47);
        vec3 torchTerm = torchColor * (vBlockLight * 0.95) * uTorchFlicker;

        vec3 combinedLight = max(skyTerm, torchTerm) + min(skyTerm, torchTerm) * 0.24 + vec3(0.055, 0.062, 0.082);
        vec3 color = texel.rgb * vShade * combinedLight;

        float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
        gl_FragColor = vec4(mix(color, uFogColor, fogFactor), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createWaterMaterial(uniforms: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aShade;
      attribute float aSkyLight;
      attribute float aBlockLight;

      uniform float uTime;

      varying vec2 vUv;
      varying float vShade;
      varying float vSkyLight;
      varying float vBlockLight;
      varying float vFogDepth;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vShade = aShade;
        vSkyLight = aSkyLight;
        vBlockLight = aBlockLight;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        // Subtle organic water surface ripples on non-integer lowered water tops
        if (fract(worldPos.y) > 0.5) {
          worldPos.y += sin(worldPos.x * 1.45 + uTime * 2.3) * cos(worldPos.z * 1.35 + uTime * 1.8) * 0.048;
        }
        vWorldPos = worldPos.xyz;

        vec4 mvPosition = viewMatrix * worldPos;
        vFogDepth = length(mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSunColor;
      uniform float uSkyIntensity;
      uniform float uTorchFlicker;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uTime;

      varying vec2 vUv;
      varying float vShade;
      varying float vSkyLight;
      varying float vBlockLight;
      varying float vFogDepth;
      varying vec3 vWorldPos;

      void main() {
        vec4 texel = texture2D(uMap, vUv);

        float shimmer = sin(vWorldPos.x * 2.8 + uTime * 3.1) * cos(vWorldPos.z * 2.5 - uTime * 2.4);
        vec3 skyTerm = uSunColor * (vSkyLight * uSkyIntensity);
        vec3 torchTerm = vec3(1.0, 0.79, 0.47) * (vBlockLight * 0.95) * uTorchFlicker;
        vec3 combinedLight = max(skyTerm, torchTerm) + vec3(0.07, 0.08, 0.11);

        vec3 base = texel.rgb * vShade * combinedLight;
        base += vec3(0.09, 0.14, 0.18) * max(0.0, shimmer) * uSkyIntensity;

        float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
        gl_FragColor = vec4(mix(base, uFogColor, fogFactor), texel.a);
        #include <colorspace_fragment>
      }
    `,
  });
}

import * as THREE from 'three';

export function createVoxelMaterials(atlasTexture) {
  const sharedUniforms = {
    uMap: { value: atlasTexture },
    uTime: { value: 0 },
    uTorchFlicker: { value: 1.0 },
    uSkyLightColor: { value: new THREE.Color(1.0, 0.99, 0.96) },
    uBlockLightColor: { value: new THREE.Color(1.05, 0.78, 0.44) },
    uAmbientMin: { value: 0.065 },
    uFogColor: { value: new THREE.Color(0.56, 0.78, 0.98) },
    uFogNear: { value: 42.0 },
    uFogFar: { value: 96.0 },
    uUnderwater: { value: 0.0 },
  };

  const solidMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute vec2 aLight;
      attribute float aSway;

      uniform float uTime;
      uniform float uTorchFlicker;
      uniform vec3 uSkyLightColor;
      uniform vec3 uBlockLightColor;
      uniform float uAmbientMin;

      varying vec2 vUv;
      varying vec3 vLitTint;
      varying float vFogDepth;

      void main() {
        vUv = uv;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        if (aSway > 0.01) {
          float wave = sin(uTime * 2.1 + worldPos.x * 0.85 + worldPos.z * 0.65) * 0.045 * aSway;
          float waveZ = cos(uTime * 1.7 + worldPos.z * 0.9 + worldPos.x * 0.4) * 0.035 * aSway;
          worldPos.x += wave;
          worldPos.z += waveZ;
        }

        // Fast smooth light curves computed per-vertex rather than per-pixel
        float skyFactor = aLight.x * (0.38 * aLight.x + 0.62);
        float blkFactor = aLight.y * (0.32 * aLight.y + 0.68);
        vec3 skyTerm = skyFactor * uSkyLightColor;
        vec3 blockTerm = blkFactor * uBlockLightColor * uTorchFlicker;

        vec3 lightCombined = max(skyTerm, blockTerm);
        lightCombined = max(lightCombined, skyTerm * 0.65 + blockTerm * 0.72);
        lightCombined = max(lightCombined, vec3(uAmbientMin));
        vLitTint = aColor * lightCombined;

        vec4 mvPosition = viewMatrix * worldPos;
        vFogDepth = length(mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uUnderwater;

      varying vec2 vUv;
      varying vec3 vLitTint;
      varying float vFogDepth;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.45) discard;

        vec3 rgb = tex.rgb * vLitTint;

        if (uUnderwater > 0.5) {
          rgb = mix(rgb, vec3(0.08, 0.34, 0.58), 0.28);
          float uwFog = smoothstep(2.0, 26.0, vFogDepth);
          rgb = mix(rgb, vec3(0.05, 0.24, 0.46), uwFog);
        } else {
          float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
          rgb = mix(rgb, uFogColor, fogFactor);
        }

        gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
      }
    `,
  });

  const fluidMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute vec2 aLight;
      attribute float aWave;

      uniform float uTime;
      uniform vec3 uSkyLightColor;
      uniform vec3 uBlockLightColor;
      uniform float uAmbientMin;

      varying vec2 vUv;
      varying vec3 vLitTint;
      varying float vSky;
      varying float vFogDepth;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        vUv = uv;
        vWave = aWave;
        vSky = aLight.x;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        if (aWave > 0.5) {
          float ripple = sin(worldPos.x * 1.45 + uTime * 2.2) * 0.035
                       + cos(worldPos.z * 1.35 + uTime * 1.8) * 0.035;
          worldPos.y += ripple - 0.08;
        }
        vWorldPos = worldPos.xyz;

        float skyFactor = aLight.x * (0.35 * aLight.x + 0.65);
        float blkFactor = aLight.y * (0.30 * aLight.y + 0.70);
        vec3 lightCombined = max(max(skyFactor * uSkyLightColor, blkFactor * uBlockLightColor), vec3(uAmbientMin + 0.04));
        vLitTint = aColor * lightCombined;

        vec4 mvPosition = viewMatrix * worldPos;
        vFogDepth = length(mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uUnderwater;

      varying vec2 vUv;
      varying vec3 vLitTint;
      varying float vSky;
      varying float vFogDepth;
      varying vec3 vWorldPos;
      varying float vWave;

      void main() {
        vec4 tex = texture2D(uMap, vUv);

        float shimmer = 0.0;
        if (vWave > 0.5) {
          shimmer = max(0.0, sin(vWorldPos.x * 3.1 + uTime * 2.8) * cos(vWorldPos.z * 2.9 - uTime * 2.3)) * 0.14;
        }

        vec3 rgb = tex.rgb * vLitTint + vec3(shimmer * vSky);
        float alpha = tex.a;

        if (uUnderwater > 0.5) {
          float uwFog = smoothstep(2.0, 26.0, vFogDepth);
          rgb = mix(rgb, vec3(0.05, 0.24, 0.46), uwFog);
        } else {
          float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
          rgb = mix(rgb, uFogColor, fogFactor);
        }

        gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), alpha);
      }
    `,
  });

  return {
    solidMaterial,
    fluidMaterial,
    uniforms: sharedUniforms,
  };
}

// Custom Voxel Shaders: Smooth AO, Sky + Block Light, Handheld Torchlight, Water Shimmer & Fog
import * as THREE from 'three';

export function createVoxelMaterials(atlasTexture) {
  const sharedUniforms = {
    uMap: { value: atlasTexture },
    uTime: { value: 0 },
    uSunBrightness: { value: 1.0 },
    uSkyTint: { value: new THREE.Color(1.0, 0.99, 0.96) },
    uTorchFlicker: { value: 1.0 },
    uPlayerLightPos: { value: new THREE.Vector3(0, -999, 0) },
    uPlayerLightStrength: { value: 0.0 },
    uFogColor: { value: new THREE.Color(0x8cc8ff) },
    uFogNear: { value: 42.0 },
    uFogFar: { value: 84.0 },
    uUnderwater: { value: 0.0 },
  };

  const commonVertexHead = /* glsl */ `
    attribute vec3 aLight; // x: aoShade, y: skyLight, z: blockLight
    attribute float aAnim; // 0: static, 1: flora sway, 2: water surface
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vLight;
    varying vec3 vWorldPos;
    varying float vFogDepth;
    varying float vAnim;
  `;

  const commonVertexMain = /* glsl */ `
    vUv = uv;
    vLight = aLight;
    vAnim = aAnim;

    vec3 pos = position;
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

    // Subtle wind sway on top vertices of tall grass / flowers / leaves
    if (aAnim > 0.5 && aAnim < 1.5) {
      float wave = sin(uTime * 2.4 + worldPosition.x * 0.9 + worldPosition.z * 0.7) * 0.045;
      worldPosition.x += wave;
      worldPosition.z += wave * 0.6;
    }
    // Gentle ripple on water surface vertices
    else if (aAnim > 1.5) {
      float ripple = sin(uTime * 2.2 + worldPosition.x * 1.3 + worldPosition.z * 1.1) * 0.035
                   + cos(uTime * 1.7 - worldPosition.x * 0.8 + worldPosition.z * 1.5) * 0.025;
      worldPosition.y += ripple - 0.08;
    }

    vWorldPos = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  `;

  const buildFragmentShader = ({ cutout = false, water = false }) => /* glsl */ `
    uniform sampler2D uMap;
    uniform float uTime;
    uniform float uSunBrightness;
    uniform vec3 uSkyTint;
    uniform float uTorchFlicker;
    uniform vec3 uPlayerLightPos;
    uniform float uPlayerLightStrength;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uUnderwater;

    varying vec2 vUv;
    varying vec3 vLight;
    varying vec3 vWorldPos;
    varying float vFogDepth;
    varying float vAnim;

    void main() {
      vec2 sampleUv = vUv;
      ${
        water
          ? `
        if (vAnim > 1.5) {
          sampleUv.x += sin(uTime * 1.4 + vWorldPos.z * 2.0) * 0.0022;
          sampleUv.y += cos(uTime * 1.2 + vWorldPos.x * 2.0) * 0.0022;
        }
      `
          : ''
      }

      vec4 texColor = texture2D(uMap, sampleUv);
      ${cutout ? 'if (texColor.a < 0.4) discard;' : ''}

      float aoShade = vLight.x;
      float skyExp = vLight.y;
      float blockExp = vLight.z;

      // Sky illumination (daylight -> moonlight minimum ambient)
      vec3 skyTerm = uSkyTint * max(0.065, skyExp * uSunBrightness);

      // Placed block light (warm golden-amber glow)
      float bLight = pow(blockExp, 1.35) * uTorchFlicker;
      vec3 blockTerm = vec3(1.08, 0.82, 0.50) * bLight;

      // Dynamic handheld torch / lantern illumination around player
      if (uPlayerLightStrength > 0.01) {
        float dist = distance(vWorldPos, uPlayerLightPos);
        float handAtten = clamp(1.0 - dist / 11.5, 0.0, 1.0);
        handAtten = handAtten * handAtten * uPlayerLightStrength * uTorchFlicker;
        blockTerm = max(blockTerm, vec3(1.05, 0.78, 0.46) * handAtten);
      }

      // Combine sky and warm block light smoothly without harsh clipping
      vec3 totalLight = max(skyTerm, blockTerm) + min(skyTerm, blockTerm) * 0.32;
      vec3 litColor = texColor.rgb * totalLight * aoShade;

      ${
        water
          ? `
        // Subtle sky reflection shimmer on water surfaces
        if (vAnim > 1.5) {
          float glint = pow(max(0.0, sin(uTime * 2.6 + vWorldPos.x * 3.1 - vWorldPos.z * 2.7)), 6.0);
          litColor += uSkyTint * uSunBrightness * glint * 0.16;
        }
      `
          : ''
      }

      if (uUnderwater > 0.5) {
        litColor *= vec3(0.58, 0.82, 1.05);
      }

      gl_FragColor = vec4(litColor, ${water ? 'texColor.a * 0.80' : '1.0'});

      // Convert linear lighting back to renderer output color space (sRGB)
      #include <colorspace_fragment>

      // Smooth atmospheric fog applied in display space so it matches sky dome horizon seamlessly
      float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, fogFactor);
    }
  `;

  const vertexShader = `${commonVertexHead}\nvoid main() {\n${commonVertexMain}\n}`;

  const opaqueMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader,
    fragmentShader: buildFragmentShader({ cutout: false, water: false }),
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
  });

  const cutoutMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader,
    fragmentShader: buildFragmentShader({ cutout: true, water: false }),
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });

  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader,
    fragmentShader: buildFragmentShader({ cutout: false, water: true }),
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  return {
    uniforms: sharedUniforms,
    opaqueMaterial,
    cutoutMaterial,
    waterMaterial,
  };
}

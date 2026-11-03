import * as THREE from 'three';

const SHARED_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute vec2 aLight;

  uniform float uTime;
  uniform float uIsWater;
  uniform float uSway;

  varying vec2 vUv;
  varying vec3 vColor;
  varying vec2 vLight;
  varying float vFogDepth;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vColor = aColor;
    vLight = aLight;

    vec3 pos = position;
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

    if (uIsWater > 0.5) {
      float wave = sin(worldPosition.x * 1.4 + uTime * 2.3) * 0.035
                 + cos(worldPosition.z * 1.6 + uTime * 1.9) * 0.035;
      worldPosition.y += wave - 0.06;
    } else if (uSway > 0.5) {
      // Gentle breeze on leaves & tall grass
      float breeze = sin(worldPosition.x * 0.9 + worldPosition.z * 0.7 + uTime * 2.1) * 0.025;
      worldPosition.x += breeze;
    }

    vWorldPos = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SHARED_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uSkyLightColor;
  uniform float uSkyBrightness;
  uniform float uTorchFlicker;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uAlphaTest;
  uniform float uOpacity;
  uniform float uIsWater;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vColor;
  varying vec2 vLight;
  varying float vFogDepth;
  varying vec3 vWorldPos;

  void main() {
    vec2 sampleUv = vUv;
    vec4 texel = texture2D(uMap, sampleUv);

    if (texel.a < uAlphaTest) discard;

    // Non-linear light response curves for rich voxel contrast
    float skyLvl = pow(clamp(vLight.x, 0.0, 1.0), 1.35) * uSkyBrightness;
    float blkLvl = pow(clamp(vLight.y, 0.0, 1.0), 1.25) * uTorchFlicker;

    vec3 skyContrib = uSkyLightColor * skyLvl;
    vec3 torchColor = vec3(1.08, 0.83, 0.50);
    vec3 blockContrib = torchColor * blkLvl;

    // Combine sky & block light smoothly without harsh clipping, keeping a subtle ambient floor
    vec3 combinedLight = max(skyContrib, blockContrib) + min(skyContrib, blockContrib) * 0.28;
    combinedLight = max(combinedLight, vec3(0.065, 0.072, 0.095));

    vec3 lit = texel.rgb * vColor * combinedLight;

    if (uIsWater > 0.5) {
      float shimmer = sin(vWorldPos.x * 3.1 + uTime * 3.2) * cos(vWorldPos.z * 2.9 - uTime * 2.6);
      lit += vec3(0.06, 0.11, 0.16) * max(0.0, shimmer) * clamp(uSkyBrightness, 0.2, 1.0);
    }

    float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
    vec3 finalRgb = mix(lit, uFogColor, fogFactor);

    float outAlpha = uIsWater > 0.5 ? mix(texel.a * uOpacity, 0.94, fogFactor * 0.5) : texel.a * uOpacity;
    gl_FragColor = vec4(finalRgb, outAlpha);
    #include <colorspace_fragment>
  }
`;

export class VoxelMaterials {
  constructor(atlasTexture) {
    this.sharedUniforms = {
      uMap: { value: atlasTexture },
      uTime: { value: 0 },
      uSkyLightColor: { value: new THREE.Color(1.0, 0.99, 0.96) },
      uSkyBrightness: { value: 1.0 },
      uTorchFlicker: { value: 1.0 },
      uFogColor: { value: new THREE.Color(0x8ec8ff) },
      uFogNear: { value: 55 },
      uFogFar: { value: 105 },
    };

    this.opaque = this._createPass({
      alphaTest: 0.0,
      opacity: 1.0,
      transparent: false,
      depthWrite: true,
      side: THREE.FrontSide,
      isWater: 0.0,
      sway: 0.0,
    });

    this.cutout = this._createPass({
      alphaTest: 0.45,
      opacity: 1.0,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      isWater: 0.0,
      sway: 1.0,
    });

    this.translucent = this._createPass({
      alphaTest: 0.05,
      opacity: 0.74,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      isWater: 1.0,
      sway: 0.0,
    });
  }

  _createPass(opts) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: this.sharedUniforms.uMap,
        uTime: this.sharedUniforms.uTime,
        uSkyLightColor: this.sharedUniforms.uSkyLightColor,
        uSkyBrightness: this.sharedUniforms.uSkyBrightness,
        uTorchFlicker: this.sharedUniforms.uTorchFlicker,
        uFogColor: this.sharedUniforms.uFogColor,
        uFogNear: this.sharedUniforms.uFogNear,
        uFogFar: this.sharedUniforms.uFogFar,
        uAlphaTest: { value: opts.alphaTest },
        uOpacity: { value: opts.opacity },
        uIsWater: { value: opts.isWater },
        uSway: { value: opts.sway },
      },
      vertexShader: SHARED_VERTEX,
      fragmentShader: SHARED_FRAGMENT,
      transparent: opts.transparent,
      depthWrite: opts.depthWrite,
      side: opts.side,
    });
  }

  update(elapsedTime, skyState, renderDistanceChunks, underwater = false) {
    this.sharedUniforms.uTime.value = elapsedTime;
    const flicker = 0.96 + Math.sin(elapsedTime * 11.0) * 0.025 + Math.cos(elapsedTime * 17.3) * 0.015;
    this.sharedUniforms.uTorchFlicker.value = flicker;

    this.sharedUniforms.uSkyBrightness.value = skyState.brightness;
    this.sharedUniforms.uSkyLightColor.value.copy(skyState.lightTint);

    if (underwater) {
      this.sharedUniforms.uFogColor.value.setRGB(0.05, 0.24, 0.42);
      this.sharedUniforms.uFogNear.value = 3.0;
      this.sharedUniforms.uFogFar.value = 24.0;
    } else {
      this.sharedUniforms.uFogColor.value.copy(skyState.fogColor);
      const maxDist = renderDistanceChunks * 16;
      this.sharedUniforms.uFogNear.value = maxDist * 0.56;
      this.sharedUniforms.uFogFar.value = maxDist * 0.96;
    }
  }
}

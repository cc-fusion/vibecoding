import * as THREE from 'three';
import { DAY_LENGTH_SECONDS, WEATHER_TYPES, BIOMES, CHUNK_SIZE } from '../constants.js';
import { BLOCK_IDS } from '../data/blocks.js';

export class SkyAndWeather {
  constructor(scene) {
    this.scene = scene;
    // Start at bright welcoming morning (0.30 of [0..1], where 0.25 = 6:00 AM sunrise, 0.50 = Noon, 0.75 = 6:00 PM sunset, 0.0 = Midnight)
    this.timeOfDay = 0.31;
    this.dayCount = 1;

    this.weather = WEATHER_TYPES.CLEAR;
    this.weatherTimer = 150 + Math.random() * 120;
    this.stormStrength = 0; // smooth 0..1

    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Entity / Viewmodel scene lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.sunLight = new THREE.DirectionalLight(0xfff7e8, 1.0);
    this.scene.add(this.ambientLight);
    this.scene.add(this.sunLight);

    this.initSkyDome();
    this.initCelestials();
    this.initClouds();
    this.initPrecipitation();
  }

  initSkyDome() {
    const geom = new THREE.SphereGeometry(260, 24, 16);
    this.skyUniforms = {
      uZenith: { value: new THREE.Color(0x3478e3) },
      uHorizon: { value: new THREE.Color(0x9bd0ff) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.2) },
      uSunGlow: { value: new THREE.Color(0xffb56b) },
      uGlowStrength: { value: 0.2 },
      uStarStrength: { value: 0.0 },
      uTime: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunGlow;
        uniform float uGlowStrength;
        uniform float uStarStrength;
        uniform float uTime;

        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizon, uZenith, pow(h, 0.62));

          // Warm sunrise / sunset radial glow near horizon
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          sky += uSunGlow * pow(sunDot, 5.0) * uGlowStrength;

          // Twinkling night stars above horizon
          if (uStarStrength > 0.01 && dir.y > 0.05) {
            vec3 cell = floor(dir * 165.0);
            float n = hash31(cell);
            if (n > 0.9945) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 3.2 + n * 80.0);
              float horizonFade = smoothstep(0.05, 0.28, dir.y);
              sky += vec3(0.92, 0.95, 1.0) * twinkle * uStarStrength * horizonFade;
            }
          }

          gl_FragColor = vec4(sky, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    this.skyDome = new THREE.Mesh(geom, mat);
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    this.root.add(this.skyDome);
  }

  initCelestials() {
    this.celestialPivot = new THREE.Group();
    this.root.add(this.celestialPivot);

    // Sun
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfff5b8,
      depthWrite: false,
      fog: false,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffbf5e,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      fog: false,
    });

    this.sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), sunMat);
    const sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), haloMat);
    sunHalo.position.z = -0.2;
    this.sunGroup.add(sunHalo, sunCore);
    this.sunGroup.position.set(200, 0, 0);
    this.sunGroup.lookAt(0, 0, 0);
    this.celestialPivot.add(this.sunGroup);

    // Moon with subtle crater patches
    let moonTex = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e6f0ff';
      ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = '#bacbe6';
      ctx.fillRect(1, 2, 2, 2);
      ctx.fillRect(5, 1, 2, 1);
      ctx.fillRect(4, 5, 2, 2);
      moonTex = new THREE.CanvasTexture(c);
      moonTex.magFilter = THREE.NearestFilter;
      moonTex.colorSpace = THREE.SRGBColorSpace;
    }

    const moonMat = new THREE.MeshBasicMaterial({
      map: moonTex,
      color: 0xffffff,
      depthWrite: false,
      fog: false,
    });
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), moonMat);
    this.moonMesh.position.set(-200, 0, 0);
    this.moonMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.moonMesh);
  }

  initClouds() {
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);

    this.cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
    });

    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    const count = 42;
    this.cloudInstanced = new THREE.InstancedMesh(boxGeom, this.cloudMaterial, count);
    this.cloudInstanced.frustumCulled = false;
    this.cloudOffsets = [];

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 260;
      const oz = (Math.random() - 0.5) * 260;
      const oy = 104 + Math.random() * 5;
      const sx = 14 + Math.floor(Math.random() * 20);
      const sz = 10 + Math.floor(Math.random() * 16);
      this.cloudOffsets.push({ ox, oy, oz, sx, sz });
      dummy.position.set(ox, oy, oz);
      dummy.scale.set(sx, 3.2, sz);
      dummy.updateMatrix();
      this.cloudInstanced.setMatrixAt(i, dummy.matrix);
    }
    this.cloudGroup.add(this.cloudInstanced);
    this.cloudDrift = 0;
  }

  initPrecipitation() {
    this.dropCount = 650;
    const positions = new Float32Array(this.dropCount * 6); // 2 vertices per streak/flake
    this.dropSeeds = new Float32Array(this.dropCount * 3);

    for (let i = 0; i < this.dropCount; i++) {
      this.dropSeeds[i * 3] = (Math.random() - 0.5) * 38;
      this.dropSeeds[i * 3 + 1] = Math.random() * 26;
      this.dropSeeds[i * 3 + 2] = (Math.random() - 0.5) * 38;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.precipMat = new THREE.LineBasicMaterial({
      color: 0xaed4ff,
      transparent: true,
      opacity: 0.55,
    });

    this.precipLines = new THREE.LineSegments(geom, this.precipMat);
    this.precipLines.visible = false;
    this.precipLines.frustumCulled = false;
    this.scene.add(this.precipLines);
  }

  isNight() {
    return this.timeOfDay < 0.23 || this.timeOfDay > 0.77;
  }

  getFormattedClock() {
    // timeOfDay 0.0 = 00:00, 0.25 = 06:00, 0.50 = 12:00, 0.75 = 18:00
    const totalMinutes = Math.floor(this.timeOfDay * 24 * 60);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const hh = String(hours24).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    let phase = 'Day';
    if (this.timeOfDay >= 0.21 && this.timeOfDay < 0.30) phase = 'Dawn';
    else if (this.timeOfDay >= 0.30 && this.timeOfDay < 0.70) phase = 'Day';
    else if (this.timeOfDay >= 0.70 && this.timeOfDay < 0.79) phase = 'Dusk';
    else phase = 'Night';

    return {
      clock: `${hh}:${mm}`,
      phase,
      dayCount: this.dayCount,
      isNight: this.isNight(),
    };
  }

  skipToMorning() {
    this.timeOfDay = 0.27;
    this.dayCount += 1;
    if (this.weather !== WEATHER_TYPES.CLEAR) {
      this.weather = WEATHER_TYPES.CLEAR;
    }
  }

  cycleWeather(currentBiome) {
    if (this.weather === WEATHER_TYPES.CLEAR) {
      const cold = currentBiome && (currentBiome.id === BIOMES.TAIGA.id || currentBiome.id === BIOMES.PEAKS.id);
      this.weather = cold ? WEATHER_TYPES.SNOW : WEATHER_TYPES.RAIN;
      this.weatherTimer = 95;
    } else {
      this.weather = WEATHER_TYPES.CLEAR;
      this.weatherTimer = 180;
    }
    return this.weather;
  }

  update(dt, elapsedTime, cameraPos, world, currentBiome, underwater = false) {
    // Advance clock
    this.timeOfDay += dt / DAY_LENGTH_SECONDS;
    if (this.timeOfDay >= 1.0) {
      this.timeOfDay -= 1.0;
      this.dayCount += 1;
    }

    // Dynamic weather timer
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather === WEATHER_TYPES.CLEAR && Math.random() < 0.32) {
        const cold = currentBiome && (currentBiome.id === BIOMES.TAIGA.id || currentBiome.id === BIOMES.PEAKS.id);
        this.weather = cold ? WEATHER_TYPES.SNOW : WEATHER_TYPES.RAIN;
        this.weatherTimer = 65 + Math.random() * 55;
      } else {
        this.weather = WEATHER_TYPES.CLEAR;
        this.weatherTimer = 160 + Math.random() * 140;
      }
    }

    // Adapt precipitation type if walking from warm rain into snowy mountain/taiga!
    if (this.weather !== WEATHER_TYPES.CLEAR && currentBiome) {
      if (currentBiome.id === BIOMES.DESERT.id) {
        // Deserts stay dry/overcast without rain streaks
      } else if (currentBiome.id === BIOMES.TAIGA.id || currentBiome.id === BIOMES.PEAKS.id) {
        this.weather = WEATHER_TYPES.SNOW;
      } else if (this.weather === WEATHER_TYPES.SNOW) {
        this.weather = WEATHER_TYPES.RAIN;
      }
    }

    const targetStorm = this.weather === WEATHER_TYPES.CLEAR ? 0 : 1;
    this.stormStrength += (targetStorm - this.stormStrength) * Math.min(1, dt * 0.8);

    // Keep sky dome & celestials centered on camera
    this.root.position.copy(cameraPos);

    // Sun angle: timeOfDay=0.25 -> 0 rad (horizon rise), 0.50 -> +PI/2 (zenith), 0.75 -> PI (set)
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    this.celestialPivot.rotation.z = angle;
    this.celestialPivot.rotation.y = 0.28; // Slight axial tilt for picturesque shadows

    const sunElev = Math.sin(angle); // -1 midnight .. +1 noon
    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.18, 0.28);
    const sunsetFactor = Math.max(0, 1.0 - Math.abs(sunElev) * 3.4);
    const nightFactor = 1.0 - THREE.MathUtils.smoothstep(sunElev, -0.24, 0.05);

    // Sky palette
    const dayZenith = new THREE.Color(0x3176e0);
    const dayHorizon = new THREE.Color(0x9dd2ff);
    const nightZenith = new THREE.Color(0x060b18);
    const nightHorizon = new THREE.Color(0x111e38);
    const duskHorizon = new THREE.Color(0xf08c4b);
    const stormZenith = new THREE.Color(0x3a4759);
    const stormHorizon = new THREE.Color(0x637387);

    const zenith = nightZenith.clone().lerp(dayZenith, dayFactor);
    const horizon = nightHorizon.clone().lerp(dayHorizon, dayFactor);
    horizon.lerp(duskHorizon, sunsetFactor * 0.65);

    zenith.lerp(stormZenith, this.stormStrength * 0.72);
    horizon.lerp(stormHorizon, this.stormStrength * 0.75);

    this.skyUniforms.uZenith.value.copy(zenith);
    this.skyUniforms.uHorizon.value.copy(horizon);
    this.skyUniforms.uSunDir.value.set(Math.cos(angle), Math.sin(angle), 0.25).normalize();
    this.skyUniforms.uGlowStrength.value = sunsetFactor * (1.0 - this.stormStrength * 0.8) * 0.75;
    this.skyUniforms.uStarStrength.value = nightFactor * (1.0 - this.stormStrength);
    this.skyUniforms.uTime.value = elapsedTime;

    this.sunGroup.visible = this.stormStrength < 0.85;
    this.moonMesh.visible = this.stormStrength < 0.85;

    // Update drifting 3D clouds wrapped around player
    this.cloudDrift += dt * 1.4;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.cloudOffsets.length; i++) {
      const c = this.cloudOffsets[i];
      let dx = ((c.ox + this.cloudDrift - cameraPos.x) % 260);
      if (dx > 130) dx -= 260;
      if (dx < -130) dx += 260;
      let dz = ((c.oz - cameraPos.z) % 260);
      if (dz > 130) dz -= 260;
      if (dz < -130) dz += 260;

      dummy.position.set(cameraPos.x + dx, c.oy, cameraPos.z + dz);
      dummy.scale.set(c.sx, 3.2, c.sz);
      dummy.updateMatrix();
      this.cloudInstanced.setMatrixAt(i, dummy.matrix);
    }
    this.cloudInstanced.instanceMatrix.needsUpdate = true;

    const cloudBrightness = 0.22 + dayFactor * 0.78 - this.stormStrength * 0.28;
    this.cloudMaterial.color.setRGB(
      cloudBrightness + sunsetFactor * 0.14,
      cloudBrightness,
      cloudBrightness + nightFactor * 0.08
    );

    // Sync Voxel Chunk Shader Uniforms + Entity Lights
    const sunColor = new THREE.Color(0x6b82b8)
      .lerp(new THREE.Color(0xfffaf2), dayFactor)
      .lerp(new THREE.Color(0xffb570), sunsetFactor * 0.45);

    const sunIntensity =
      (0.17 + dayFactor * 0.85) * (1.0 - this.stormStrength * 0.26);

    const uniforms = world.materials.uniforms;
    uniforms.uSunColor.value.copy(sunColor);
    uniforms.uSunIntensity.value = sunIntensity;

    const viewBlocks = world.renderDistance * CHUNK_SIZE;
    if (underwater) {
      const waterFog = new THREE.Color(0x104a80).multiplyScalar(0.35 + dayFactor * 0.65);
      uniforms.uFogColor.value.copy(waterFog);
      uniforms.uFogNear.value = 2.0;
      uniforms.uFogFar.value = 24.0;
    } else {
      uniforms.uFogColor.value.copy(horizon);
      uniforms.uFogNear.value = Math.max(24, viewBlocks * 0.56);
      uniforms.uFogFar.value = Math.max(44, viewBlocks * 0.96);
    }

    this.sunLight.position.set(
      cameraPos.x + Math.cos(angle) * 60,
      cameraPos.y + Math.max(12, Math.sin(angle) * 80),
      cameraPos.z + 25
    );
    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = 0.2 + dayFactor * 0.85;
    this.ambientLight.intensity = 0.28 + dayFactor * 0.48;

    // Update Rain / Snow particles
    const showPrecip =
      this.stormStrength > 0.08 &&
      !underwater &&
      (!currentBiome || currentBiome.id !== BIOMES.DESERT.id);

    this.precipLines.visible = showPrecip;
    if (showPrecip) {
      const isSnow = this.weather === WEATHER_TYPES.SNOW;
      this.precipMat.color.setHex(isSnow ? 0xf5faff : 0x99c7ff);
      this.precipMat.opacity = this.stormStrength * (isSnow ? 0.75 : 0.48);

      const posAttr = this.precipLines.geometry.getAttribute('position');
      const arr = posAttr.array;
      const fallSpeed = isSnow ? 3.4 : 20.0;
      const streakLen = isSnow ? 0.14 : 0.85;

      for (let i = 0; i < this.dropCount; i++) {
        const sx = this.dropSeeds[i * 3];
        const sy = this.dropSeeds[i * 3 + 1];
        const sz = this.dropSeeds[i * 3 + 2];

        const swayX = isSnow ? Math.sin(elapsedTime * 1.8 + i) * 0.8 : 0;
        const wx = cameraPos.x + sx + swayX;
        const wz = cameraPos.z + sz;
        const localY = 16.0 - ((sy + elapsedTime * fallSpeed) % 26.0);
        const wy = cameraPos.y + localY;

        // Hide drops inside caves/houses where skylight < 13
        const skyHere = world.getSkyLight(wx, wy, wz);
        if (skyHere < 13 || world.getBlock(wx, wy, wz) !== BLOCK_IDS.AIR) {
          arr[i * 6] = 0; arr[i * 6 + 1] = -999; arr[i * 6 + 2] = 0;
          arr[i * 6 + 3] = 0; arr[i * 6 + 4] = -999; arr[i * 6 + 5] = 0;
        } else {
          arr[i * 6] = wx;
          arr[i * 6 + 1] = wy;
          arr[i * 6 + 2] = wz;
          arr[i * 6 + 3] = wx + (isSnow ? 0.05 : 0);
          arr[i * 6 + 4] = wy + streakLen;
          arr[i * 6 + 5] = wz;
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}

import * as THREE from 'three';
import { DAY_LENGTH_SECONDS, WEATHER_TYPES, BIOMES } from './constants.js';
import { createRng } from './noise.js';

function lerpColor(out, a, b, t) {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
  return out;
}

const C_NOON_ZENITH = new THREE.Color(0.24, 0.56, 0.96);
const C_NOON_HORIZON = new THREE.Color(0.64, 0.84, 0.99);
const C_SUNSET_ZENITH = new THREE.Color(0.22, 0.24, 0.54);
const C_SUNSET_HORIZON = new THREE.Color(0.96, 0.50, 0.28);
const C_NIGHT_ZENITH = new THREE.Color(0.02, 0.035, 0.09);
const C_NIGHT_HORIZON = new THREE.Color(0.05, 0.08, 0.17);
const C_STORM_TINT = new THREE.Color(0.36, 0.42, 0.50);

export class EnvironmentSystem {
  constructor(scene, voxelUniforms) {
    this.scene = scene;
    this.voxelUniforms = voxelUniforms;

    // 0.32 = bright morning on day 1!
    this.timeOfDay = 0.32;
    this.dayCount = 1;
    this.weather = WEATHER_TYPES.CLEAR;
    this.weatherTimer = 150;
    this.rainIntensity = 0;

    this.zenithColor = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this.skyLightColor = new THREE.Color(1, 1, 1);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.buildSkyDome();
    this.buildCelestials();
    this.buildClouds();
    this.buildWeatherParticles();

    // Directional + hemisphere light for 3D entities (creatures, dropped items, hand viewmodel)
    this.hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x556b44, 0.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e0, 1.0);
    this.sunLight.position.set(40, 80, 30);
    this.scene.add(this.sunLight);
  }

  buildSkyDome() {
    const geo = new THREE.SphereGeometry(240, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0.24, 0.56, 0.96) },
        uHorizon: { value: new THREE.Color(0.64, 0.84, 0.99) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunsetGlow: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform float uSunsetGlow;
        varying vec3 vDir;

        void main() {
          float h = clamp(vDir.y * 0.85 + 0.15, 0.0, 1.0);
          float hCurve = sqrt(h) * 0.62 + h * 0.38;
          vec3 col = mix(uHorizon, uZenith, hCurve);

          // Warm solar halo near horizon at dawn/dusk
          float sunDot = max(0.0, dot(normalize(vDir), uSunDir));
          float s2 = sunDot * sunDot;
          float s6 = s2 * s2 * s2;
          col += vec3(1.0, 0.52, 0.22) * s6 * uSunsetGlow * 0.55;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(geo, this.skyMat);
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    this.root.add(this.skyDome);
  }

  buildCelestials() {
    this.celestialPivot = new THREE.Group();
    this.root.add(this.celestialPivot);

    // Crisp Glowing Sun
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 16;
    sunCanvas.height = 16;
    const sctx = sunCanvas.getContext('2d');
    sctx.fillStyle = '#fff3b0';
    sctx.fillRect(2, 2, 12, 12);
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(4, 4, 8, 8);
    const sunTex = new THREE.CanvasTexture(sunCanvas);
    sunTex.magFilter = THREE.NearestFilter;

    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({
        map: sunTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.sunMesh.position.set(185, 0, 0);
    this.sunMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.sunMesh);

    // Crisp Pixel Moon with craters
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 16;
    moonCanvas.height = 16;
    const mctx = moonCanvas.getContext('2d');
    mctx.fillStyle = '#dce8ff';
    mctx.fillRect(3, 3, 10, 10);
    mctx.fillStyle = '#9bb0d4';
    mctx.fillRect(5, 5, 3, 2);
    mctx.fillRect(9, 8, 2, 3);
    mctx.fillRect(5, 10, 2, 2);
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    moonTex.magFilter = THREE.NearestFilter;

    this.moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({
        map: moonTex,
        transparent: true,
        depthWrite: false,
      })
    );
    this.moonMesh.position.set(-185, 0, 0);
    this.moonMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.moonMesh);

    // Starfield
    const rng = createRng(777);
    const starPositions = [];
    for (let i = 0; i < 420; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const rad = 205;
      const sx = rad * Math.sin(phi) * Math.cos(theta);
      const sy = Math.abs(rad * Math.cos(phi)) + 8; // Upper hemisphere
      const sz = rad * Math.sin(phi) * Math.sin(theta);
      starPositions.push(sx, sy, sz);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xeef5ff,
      size: 1.6,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.root.add(this.stars);
  }

  buildClouds() {
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);

    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });

    const rng = createRng(555);
    this.clouds = [];
    for (let i = 0; i < 28; i++) {
      const w = 14 + Math.floor(rng() * 18);
      const d = 10 + Math.floor(rng() * 14);
      const geo = new THREE.BoxGeometry(w, 3.2, d);
      const mesh = new THREE.Mesh(geo, this.cloudMat);
      const ox = (rng() - 0.5) * 260;
      const oz = (rng() - 0.5) * 260;
      mesh.position.set(ox, 105 + (i % 3) * 1.5, oz);
      this.cloudGroup.add(mesh);
      this.clouds.push({ mesh, relX: ox, relZ: oz });
    }
    this.cloudDriftX = 0;
  }

  buildWeatherParticles() {
    this.weatherCount = 900;
    const positions = new Float32Array(this.weatherCount * 3);
    const rng = createRng(888);
    for (let i = 0; i < this.weatherCount; i++) {
      positions[i * 3] = (rng() - 0.5) * 44;
      positions[i * 3 + 1] = rng() * 28;
      positions[i * 3 + 2] = (rng() - 0.5) * 44;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.weatherMat = new THREE.PointsMaterial({
      color: 0xaad4ff,
      size: 0.22,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.weatherPoints.visible = false;
    this.scene.add(this.weatherPoints);
  }

  isNight() {
    return this.timeOfDay < 0.22 || this.timeOfDay > 0.76;
  }

  getClockLabel() {
    const totalHours = ((this.timeOfDay * 24) + 6) % 24; // 0.25 -> 12:00? Wait: let's map 0.25=06:00, 0.5=12:00, 0.75=18:00, 0.0=00:00!
    const exactH = this.timeOfDay * 24;
    const hh = Math.floor(exactH);
    const mm = Math.floor((exactH - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  getPhaseLabel() {
    const t = this.timeOfDay;
    if (t >= 0.22 && t < 0.30) return 'Dawn';
    if (t >= 0.30 && t < 0.70) return 'Day';
    if (t >= 0.70 && t < 0.79) return 'Sunset';
    return 'Night';
  }

  setTimeOfDay(val) {
    this.timeOfDay = ((val % 1.0) + 1.0) % 1.0;
  }

  setWeather(type) {
    this.weather = type;
    this.weatherTimer = 160;
  }

  update(dt, playerPos, currentBiome, renderDistance, headUnderwater) {
    // Advance clock
    const prevT = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH_SECONDS) % 1.0;
    if (this.timeOfDay < prevT) {
      this.dayCount++;
    }

    // Natural weather cycle
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 140 + Math.random() * 140;
      if (this.weather === WEATHER_TYPES.CLEAR && Math.random() < 0.32) {
        this.weather = currentBiome?.precipitation === WEATHER_TYPES.SNOW
          ? WEATHER_TYPES.SNOW
          : WEATHER_TYPES.RAIN;
      } else {
        this.weather = WEATHER_TYPES.CLEAR;
      }
    }

    const activePrecip = currentBiome === BIOMES.DESERT ? WEATHER_TYPES.CLEAR : this.weather;
    const isPrecip = activePrecip !== WEATHER_TYPES.CLEAR;
    const targetRain = isPrecip ? 1.0 : 0.0;
    this.rainIntensity += (targetRain - this.rainIntensity) * Math.min(1.0, dt * 1.2);

    // Center sky dome on player
    this.root.position.copy(playerPos);

    // Orbit sun & moon: timeOfDay 0.25 = sunrise (+X), 0.50 = zenith (+Y), 0.75 = sunset (-X), 0.0 = midnight (-Y)
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    this.celestialPivot.rotation.z = sunAngle;

    const sunHeight = Math.sin(sunAngle); // -1 at midnight, +1 at noon
    const sunX = Math.cos(sunAngle);
    this.skyMat.uniforms.uSunDir.value.set(sunX, sunHeight, 0.12).normalize();

    // Compute smooth day/sunset/night blend weights
    const dayFactor = THREE.MathUtils.clamp((sunHeight + 0.12) / 0.55, 0.0, 1.0);
    const sunsetFactor = Math.max(0.0, 1.0 - Math.abs(sunHeight - 0.04) * 4.2);
    this.skyMat.uniforms.uSunsetGlow.value = sunsetFactor * (1.0 - this.rainIntensity * 0.7);

    // Interpolate Zenith & Horizon colors
    lerpColor(this.zenithColor, C_NIGHT_ZENITH, C_NOON_ZENITH, dayFactor);
    lerpColor(this.horizonColor, C_NIGHT_HORIZON, C_NOON_HORIZON, dayFactor);

    if (sunsetFactor > 0.001) {
      this.zenithColor.lerp(C_SUNSET_ZENITH, sunsetFactor * 0.65);
      this.horizonColor.lerp(C_SUNSET_HORIZON, sunsetFactor * 0.85);
    }

    if (this.rainIntensity > 0.01) {
      this.zenithColor.lerp(C_STORM_TINT, this.rainIntensity * 0.55 * dayFactor);
      this.horizonColor.lerp(C_STORM_TINT, this.rainIntensity * 0.60 * dayFactor);
    }

    this.skyMat.uniforms.uZenith.value.copy(this.zenithColor);
    this.skyMat.uniforms.uHorizon.value.copy(this.horizonColor);

    // Star opacity at night
    this.starMat.opacity = THREE.MathUtils.clamp((0.25 - dayFactor) * 3.5, 0.0, 0.92) * (1.0 - this.rainIntensity * 0.85);
    this.sunMesh.visible = this.rainIntensity < 0.85;
    this.moonMesh.visible = this.rainIntensity < 0.85;

    // SkyLight tint & intensity sent to chunk voxel shader (zero chunk remesh needed!)
    const skyBrightness = THREE.MathUtils.lerp(0.14, 1.0, dayFactor) * (1.0 - this.rainIntensity * 0.24);
    this.skyLightColor.setRGB(
      skyBrightness * (1.0 + sunsetFactor * 0.12),
      skyBrightness * (0.99 - sunsetFactor * 0.08),
      skyBrightness * (1.02 - sunsetFactor * 0.18 + (1.0 - dayFactor) * 0.28)
    );

    const tVal = this.voxelUniforms.uTime.value + dt;
    this.voxelUniforms.uTime.value = tVal;
    if (this.voxelUniforms.uTorchFlicker) {
      this.voxelUniforms.uTorchFlicker.value = 0.97 + 0.03 * Math.sin(tVal * 7.3) * Math.cos(tVal * 11.1);
    }
    this.voxelUniforms.uSkyLightColor.value.copy(this.skyLightColor);
    this.voxelUniforms.uFogColor.value.copy(this.horizonColor);

    const maxDist = renderDistance * 16.0;
    const weatherFogScale = 1.0 - this.rainIntensity * 0.28;
    this.voxelUniforms.uFogNear.value = maxDist * 0.52 * weatherFogScale;
    this.voxelUniforms.uFogFar.value = maxDist * 0.96 * weatherFogScale;
    this.voxelUniforms.uUnderwater.value = headUnderwater ? 1.0 : 0.0;

    // Entity lights
    this.sunLight.intensity = THREE.MathUtils.lerp(0.15, 0.95, dayFactor);
    this.sunLight.position.set(
      playerPos.x + sunX * 60,
      playerPos.y + Math.max(12, sunHeight * 80),
      playerPos.z + 25
    );
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.22, 0.85, dayFactor);

    // Drift 3D Clouds wrapped cleanly around player
    this.cloudDriftX = (this.cloudDriftX + dt * 1.35) % 260;
    const cloudShade = THREE.MathUtils.lerp(0.16, 0.96, dayFactor) * (1.0 - this.rainIntensity * 0.32);
    this.cloudMat.color.setRGB(
      cloudShade + sunsetFactor * 0.12,
      cloudShade - sunsetFactor * 0.04,
      cloudShade - sunsetFactor * 0.08 + (1 - dayFactor) * 0.06
    );
    for (const cl of this.clouds) {
      let rx = ((cl.relX + this.cloudDriftX + 130) % 260) - 130;
      cl.mesh.position.x = playerPos.x + rx;
      cl.mesh.position.z = playerPos.z + cl.relZ;
    }

    // Update Rain / Snow particles around player
    if (this.rainIntensity > 0.03 && !headUnderwater) {
      this.weatherPoints.visible = true;
      const isSnow = currentBiome?.precipitation === WEATHER_TYPES.SNOW || activePrecip === WEATHER_TYPES.SNOW;
      this.weatherMat.color.setHex(isSnow ? 0xf5faff : 0x99ccff);
      this.weatherMat.size = isSnow ? 0.30 : 0.20;
      this.weatherMat.opacity = this.rainIntensity * (isSnow ? 0.85 : 0.62);

      const fallSpeed = isSnow ? 4.2 : 22.0;
      const posArr = this.weatherGeo.attributes.position.array;
      for (let i = 0; i < this.weatherCount; i++) {
        const i3 = i * 3;
        posArr[i3 + 1] -= fallSpeed * dt;
        if (isSnow) {
          posArr[i3] += Math.sin(this.voxelUniforms.uTime.value * 1.8 + i) * 0.9 * dt;
        }
        if (posArr[i3 + 1] < -8) {
          posArr[i3 + 1] = 22;
        }
      }
      this.weatherGeo.attributes.position.needsUpdate = true;
      this.weatherPoints.position.set(playerPos.x, playerPos.y, playerPos.z);
    } else {
      this.weatherPoints.visible = false;
    }
  }
}

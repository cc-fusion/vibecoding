// Dynamic Sky Dome, Orbiting 3D Sun & Moon, Starfield, Volumetric Voxel Clouds & Weather

import * as THREE from 'three';
import { DAY_LENGTH_SECONDS, WEATHER_TYPES } from '../constants.js';

export class AtmosphereSystem {
  constructor(scene, sharedUniforms) {
    this.scene = scene;
    this.sharedUniforms = sharedUniforms;

    // 0.0 = Sunrise, 0.22 = Bright Morning, 0.28 = High Noon, 0.50 = Sunset, 0.75 = Midnight
    this.timeOfDay = 0.20; // Start in crisp golden morning light!
    this.dayCount = 1;
    this.timePaused = false;

    this.weather = WEATHER_TYPES.CLEAR;
    this.weatherTimer = 190;
    this.underwater = false;

    // Entity & Viewmodel lights matching sky atmosphere
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.sunDirLight = new THREE.DirectionalLight(0xfff6e5, 1.15);
    this.scene.add(this.ambientLight);
    this.scene.add(this.sunDirLight);

    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    this.buildSkyDome();
    this.buildCelestialBodies();
    this.buildStarfield();
    this.buildVoxelClouds();
    this.buildWeatherParticles();
  }

  buildSkyDome() {
    const geo = new THREE.SphereGeometry(260, 24, 16);
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x4a90e8) },
      uHorizonColor: { value: new THREE.Color(0xaad6ff) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
      uSunGlow: { value: new THREE.Color(0xffe0a3) },
      uGlowStrength: { value: 0.35 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunGlow;
        uniform float uGlowStrength;
        varying vec3 vDir;

        void main() {
          float h = clamp(vDir.y * 1.15 + 0.06, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uTopColor, pow(h, 0.68));
          float sunDot = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          sky += uSunGlow * pow(sunDot, 7.0) * uGlowStrength;
          gl_FragColor = vec4(sky, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    this.skyDome = new THREE.Mesh(geo, mat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -10;
    this.skyGroup.add(this.skyDome);
  }

  buildCelestialBodies() {
    this.celestialPivot = new THREE.Group();
    this.skyGroup.add(this.celestialPivot);

    // Crisp glowing 3D Voxel Sun
    const sunGeo = new THREE.BoxGeometry(18, 18, 18);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3b8, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(0, 195, 0);
    this.celestialPivot.add(this.sunMesh);

    // Soft Sun Halo
    const haloGeo = new THREE.BoxGeometry(28, 28, 4);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.32,
      fog: false,
      depthWrite: false,
    });
    const sunHalo = new THREE.Mesh(haloGeo, haloMat);
    sunHalo.rotation.x = Math.PI / 2;
    this.sunMesh.add(sunHalo);

    // Luminous Silver 3D Voxel Moon opposite the Sun
    const moonGeo = new THREE.BoxGeometry(14, 14, 14);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdce8ff, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.set(0, -195, 0);
    this.celestialPivot.add(this.moonMesh);
  }

  buildStarfield() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.88 + 0.08);
      const r = 225;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.frustumCulled = false;
    this.skyGroup.add(this.stars);
  }

  buildVoxelClouds() {
    // Instanced puffy 3D voxel cloud puffs drifting high across the sky!
    const puffs = [];
    for (let c = 0; c < 26; c++) {
      const cx = (Math.random() - 0.5) * 280;
      const cz = (Math.random() - 0.5) * 280;
      const cy = 96 + (c % 3) * 4;
      const w = 2 + ((Math.random() * 3) | 0);
      const d = 2 + ((Math.random() * 3) | 0);
      for (let ix = -w; ix <= w; ix++) {
        for (let iz = -d; iz <= d; iz++) {
          if (Math.abs(ix) === w && Math.abs(iz) === d && Math.random() < 0.6) continue;
          puffs.push({ x: cx + ix * 7.5, y: cy, z: cz + iz * 7.5 });
        }
      }
    }

    const boxGeo = new THREE.BoxGeometry(7.6, 3.4, 7.6);
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
    });
    this.cloudMesh = new THREE.InstancedMesh(boxGeo, this.cloudMat, puffs.length);
    this.cloudMesh.frustumCulled = false;
    this.cloudPuffs = puffs;

    const dummy = new THREE.Object3D();
    puffs.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(idx, dummy.matrix);
    });
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.cloudDrift = 0;
    this.scene.add(this.cloudMesh);
  }

  buildWeatherParticles() {
    // Rain streaks
    const rainCount = 900;
    const rainPos = new Float32Array(rainCount * 6);
    this.rainSeeds = [];
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * 46;
      const y = Math.random() * 34;
      const z = (Math.random() - 0.5) * 46;
      this.rainSeeds.push({ x, y, z, speed: 22 + Math.random() * 8 });
      rainPos[i * 6] = x;
      rainPos[i * 6 + 1] = y;
      rainPos[i * 6 + 2] = z;
      rainPos[i * 6 + 3] = x + 0.08;
      rainPos[i * 6 + 4] = y - 0.95;
      rainPos[i * 6 + 5] = z;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0x9ecaff,
      transparent: true,
      opacity: 0.58,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);

    // Snow flakes
    const snowCount = 700;
    const snowPos = new Float32Array(snowCount * 3);
    this.snowSeeds = [];
    for (let i = 0; i < snowCount; i++) {
      const x = (Math.random() - 0.5) * 44;
      const y = Math.random() * 30;
      const z = (Math.random() - 0.5) * 44;
      this.snowSeeds.push({ x, y, z, phase: Math.random() * Math.PI * 2 });
      snowPos[i * 3] = x;
      snowPos[i * 3 + 1] = y;
      snowPos[i * 3 + 2] = z;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xf7fbff,
      size: 0.22,
      transparent: true,
      opacity: 0.9,
    });
    this.snowPoints = new THREE.Points(snowGeo, snowMat);
    this.snowPoints.frustumCulled = false;
    this.snowPoints.visible = false;
    this.scene.add(this.snowPoints);
  }

  setWeather(type) {
    this.weather = type;
    this.weatherTimer = 180 + Math.random() * 120;
  }

  setTimePreset(preset) {
    const map = {
      dawn: 0.03,
      day: 0.25,
      sunset: 0.49,
      night: 0.74,
    };
    if (map[preset] !== undefined) {
      this.timeOfDay = map[preset];
    }
  }

  isNight() {
    return this.timeOfDay > 0.54 && this.timeOfDay < 0.96;
  }

  getClockLabel() {
    // 0.0 -> 06:00 AM, 0.25 -> 12:00 PM, 0.50 -> 06:00 PM, 0.75 -> 12:00 AM
    const totalMinutes = Math.floor(((this.timeOfDay + 0.25) % 1.0) * 24 * 60);
    const hrs24 = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const suffix = hrs24 >= 12 ? 'PM' : 'AM';
    const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
    return `Day ${this.dayCount} · ${hrs12}:${String(mins).padStart(2, '0')} ${suffix}`;
  }

  update(dt, playerPos, elapsedTime, currentBiome) {
    if (!this.timePaused) {
      this.timeOfDay += dt / DAY_LENGTH_SECONDS;
      if (this.timeOfDay >= 1.0) {
        this.timeOfDay -= 1.0;
        this.dayCount += 1;
      }
    }

    // Occasional organic weather shifts
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 160 + Math.random() * 140;
      const r = Math.random();
      if (r < 0.68) this.weather = WEATHER_TYPES.CLEAR;
      else if (currentBiome?.includes('Peaks') || currentBiome?.includes('Taiga')) {
        this.weather = WEATHER_TYPES.SNOW;
      } else {
        this.weather = WEATHER_TYPES.RAIN;
      }
    }

    // Center sky dome & celestial orbit on player
    this.skyGroup.position.set(playerPos.x, playerPos.y * 0.25, playerPos.z);

    // Angle: timeOfDay = 0 -> sunrise horizon, 0.25 -> zenith noon, 0.5 -> sunset horizon, 0.75 -> midnight nadir
    const angle = this.timeOfDay * Math.PI * 2;
    const sunElev = Math.sin(angle); // +1 at noon, -1 at midnight
    const sunHoriz = Math.cos(angle);

    this.celestialPivot.rotation.z = angle - Math.PI * 0.5;
    this.celestialPivot.rotation.y = 0.32;

    const sunDir = new THREE.Vector3(sunHoriz * 0.92, sunElev, 0.35).normalize();
    this.skyUniforms.uSunDir.value.copy(sunDir);

    // Smooth day / twilight / night color curves
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.14) / 0.52, 0, 1);
    const sunsetBand = Math.max(0, 1.0 - Math.abs(sunElev - 0.04) / 0.28);

    const topDay = new THREE.Color(0x3f88e8);
    const topNight = new THREE.Color(0x091126);
    const horDay = new THREE.Color(0xa8d8ff);
    const horSunset = new THREE.Color(0xf28d52);
    const horNight = new THREE.Color(0x14223d);

    const topColor = topNight.clone().lerp(topDay, dayFactor);
    const horColor = horNight.clone().lerp(horDay, dayFactor).lerp(horSunset, sunsetBand * 0.78);

    // Storm darkening when raining or snowing
    const stormDim = this.weather === WEATHER_TYPES.RAIN ? 0.62 : this.weather === WEATHER_TYPES.SNOW ? 0.80 : 1.0;
    if (this.weather !== WEATHER_TYPES.CLEAR) {
      topColor.lerp(new THREE.Color(0x526378), 0.48).multiplyScalar(stormDim + 0.22);
      horColor.lerp(new THREE.Color(0x8899ad), 0.52).multiplyScalar(stormDim + 0.20);
    }

    // Underwater deep turquoise atmosphere override!
    if (this.underwater) {
      const waterFog = new THREE.Color(0x124e78).multiplyScalar(0.35 + dayFactor * 0.65);
      this.skyUniforms.uTopColor.value.copy(waterFog);
      this.skyUniforms.uHorizonColor.value.copy(waterFog);
      this.sharedUniforms.uFogColor.value.copy(waterFog);
      this.sharedUniforms.uFogNear.value = 3.0;
      this.sharedUniforms.uFogFar.value = 26.0;
    } else {
      this.skyUniforms.uTopColor.value.copy(topColor);
      this.skyUniforms.uHorizonColor.value.copy(horColor);
      this.sharedUniforms.uFogColor.value.copy(horColor);
    }

    this.skyUniforms.uGlowStrength.value = (0.18 + sunsetBand * 0.52) * stormDim;
    this.starMat.opacity = THREE.MathUtils.clamp((0.35 - dayFactor) * 2.2, 0, 0.92) * (this.weather === WEATHER_TYPES.CLEAR ? 1 : 0.15);

    // Voxel sunlight uniform (warm noon -> golden sunset -> readable silver-blue moonlight!)
    const nightLight = new THREE.Color(0.17, 0.22, 0.36);
    const noonLight = new THREE.Color(1.03, 1.01, 0.97);
    const sunsetLight = new THREE.Color(1.06, 0.72, 0.48);
    const currentSun = nightLight
      .clone()
      .lerp(noonLight, dayFactor)
      .lerp(sunsetLight, sunsetBand * 0.55)
      .multiplyScalar(stormDim * 0.22 + 0.78);

    this.sharedUniforms.uSunLight.value.copy(currentSun);

    // Warm organic torch/lantern flicker
    const flicker = 0.97 + Math.sin(elapsedTime * 7.3) * 0.02 + Math.cos(elapsedTime * 13.1) * 0.015;
    this.sharedUniforms.uTorchLight.value.setRGB(1.14 * flicker, 0.86 * flicker, 0.52 * flicker);
    this.sharedUniforms.uTime.value = elapsedTime;
    this.sharedUniforms.uWindStrength.value = this.weather === WEATHER_TYPES.RAIN ? 2.1 : 1.0;

    // Sync Three.js standard lights for 3D creatures, dropped items, and held viewmodel
    this.ambientLight.intensity = 0.35 + dayFactor * 0.65;
    this.ambientLight.color.copy(currentSun);
    this.sunDirLight.position.set(
      playerPos.x + sunDir.x * 80,
      playerPos.y + Math.max(15, sunDir.y * 80),
      playerPos.z + sunDir.z * 80
    );
    this.sunDirLight.intensity = 0.18 + dayFactor * 0.95;
    this.cloudMat.color.copy(currentSun).lerp(new THREE.Color(0xffffff), 0.35);

    // Drift volumetric clouds across the sky around player
    this.cloudDrift += dt * 1.4;
    const snappedX = Math.floor(playerPos.x / 280) * 280;
    const snappedZ = Math.floor(playerPos.z / 280) * 280;
    this.cloudMesh.position.set(
      snappedX + (this.cloudDrift % 280) - 140,
      0,
      snappedZ
    );

    // Animate Rain or Snow around player
    const showRain = this.weather === WEATHER_TYPES.RAIN && !this.underwater;
    const showSnow = this.weather === WEATHER_TYPES.SNOW && !this.underwater;
    this.rainLines.visible = showRain;
    this.snowPoints.visible = showSnow;

    if (showRain) {
      const arr = this.rainLines.geometry.attributes.position.array;
      for (let i = 0; i < this.rainSeeds.length; i++) {
        const s = this.rainSeeds[i];
        s.y -= s.speed * dt;
        if (s.y < -10) s.y += 34;
        const wx = playerPos.x + s.x;
        const wy = playerPos.y + s.y;
        const wz = playerPos.z + s.z;
        const idx = i * 6;
        arr[idx] = wx;
        arr[idx + 1] = wy;
        arr[idx + 2] = wz;
        arr[idx + 3] = wx + 0.14;
        arr[idx + 4] = wy - 1.05;
        arr[idx + 5] = wz;
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    } else if (showSnow) {
      const arr = this.snowPoints.geometry.attributes.position.array;
      for (let i = 0; i < this.snowSeeds.length; i++) {
        const s = this.snowSeeds[i];
        s.y -= 2.4 * dt;
        if (s.y < -8) s.y += 30;
        const idx = i * 3;
        arr[idx] = playerPos.x + s.x + Math.sin(elapsedTime * 1.4 + s.phase) * 0.7;
        arr[idx + 1] = playerPos.y + s.y;
        arr[idx + 2] = playerPos.z + s.z + Math.cos(elapsedTime * 1.1 + s.phase) * 0.7;
      }
      this.snowPoints.geometry.attributes.position.needsUpdate = true;
    }
  }
}

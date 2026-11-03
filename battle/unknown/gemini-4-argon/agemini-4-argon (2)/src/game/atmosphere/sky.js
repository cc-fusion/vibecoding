import * as THREE from 'three';
import { DAY_LENGTH_SECONDS } from '../constants.js';

export class SkyAtmosphere {
  constructor(scene) {
    this.scene = scene;
    // timeOfDay in [0, 1): 0.25 = sunrise (06:00), 0.50 = noon (12:00), 0.75 = sunset (18:00), 0.0 = midnight
    this.timeOfDay = 0.31; // Start at bright, welcoming morning (~07:25)
    this.dayCount = 1;

    this.weatherState = 'clear'; // 'clear' | 'precip'
    this.weatherTimer = 95;

    // Scene lights for 3D mobs & entities
    this.hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x5c6e4e, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.1);
    this.scene.add(this.sunLight);

    // Sky Group anchored to camera position each frame
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    this._initSkyDome();
    this._initCelestialBodies();
    this._initClouds();
  }

  _initSkyDome() {
    this.zenithColor = new THREE.Color(0x4b93f2);
    this.horizonColor = new THREE.Color(0xaad6ff);

    const geom = new THREE.SphereGeometry(260, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: this.zenithColor },
        uHorizon: { value: this.horizonColor },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 1.15 + 0.12, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.68));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(geom, this.skyMat);
    this.skyDome.renderOrder = -10;
    this.skyGroup.add(this.skyDome);
  }

  _initCelestialBodies() {
    this.celestialPivot = new THREE.Group();
    this.skyGroup.add(this.celestialPivot);

    // Crisp Voxel Sun
    const sunGeom = new THREE.PlaneGeometry(26, 26);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xfff099,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
    this.sunMesh.position.set(0, 190, 0);
    this.sunMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.sunMesh);

    // Crisp Voxel Moon
    const moonGeom = new THREE.PlaneGeometry(20, 20);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xd8e8ff,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.moonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.moonMesh.position.set(0, -190, 0);
    this.moonMesh.lookAt(0, 0, 0);
    this.celestialPivot.add(this.moonMesh);

    // Starfield
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 210;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeom, this.starMat);
    this.celestialPivot.add(this.stars);
  }

  _initClouds() {
    const cloudCount = 38;
    const geom = new THREE.BoxGeometry(1, 1, 1);
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
    });
    this.cloudMesh = new THREE.InstancedMesh(geom, this.cloudMat, cloudCount);
    this.cloudMesh.frustumCulled = false;
    this.scene.add(this.cloudMesh);

    this.clouds = [];
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        ox: (Math.random() - 0.5) * 240,
        oz: (Math.random() - 0.5) * 240,
        w: 14 + Math.random() * 22,
        d: 10 + Math.random() * 18,
        y: 98 + (i % 3) * 2.5,
      });
    }
    this._cloudDummy = new THREE.Object3D();
    this._cloudDrift = 0;
  }

  isNight() {
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    return Math.sin(angle) < -0.06;
  }

  getClockString() {
    const totalMinutes = Math.floor(this.timeOfDay * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = Math.floor((totalMinutes % 60) / 5) * 5;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `Day ${this.dayCount} · ${hh}:${mm}`;
  }

  setTimePreset(preset) {
    if (preset === 'dawn') this.timeOfDay = 0.25;
    else if (preset === 'noon') this.timeOfDay = 0.5;
    else if (preset === 'sunset') this.timeOfDay = 0.74;
    else if (preset === 'night') this.timeOfDay = 0.02;
  }

  toggleWeather() {
    this.weatherState = this.weatherState === 'clear' ? 'precip' : 'clear';
    this.weatherTimer = 110;
  }

  getActiveWeatherForBiome(biome) {
    if (this.weatherState === 'clear' || !biome) return 'clear';
    if (biome.weather === 'clear') return 'clear';
    return biome.weather || 'rain';
  }

  update(dt, cameraPos, chunkUniforms, headUnderwater = false, currentBiome = null) {
    // Advance clock
    this.timeOfDay += dt / DAY_LENGTH_SECONDS;
    if (this.timeOfDay >= 1.0) {
      this.timeOfDay -= 1.0;
      this.dayCount += 1;
    }

    // Weather timer
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weatherState === 'clear') {
        this.weatherState = Math.random() < 0.35 ? 'precip' : 'clear';
        this.weatherTimer = this.weatherState === 'precip' ? 55 + Math.random() * 45 : 100 + Math.random() * 80;
      } else {
        this.weatherState = 'clear';
        this.weatherTimer = 120 + Math.random() * 90;
      }
    }

    const activeWeather = this.getActiveWeatherForBiome(currentBiome);
    const overcast = activeWeather !== 'clear' ? 0.28 : 0.0;

    // Celestial angle: 0.25 -> 0 rad (horizon rise), 0.5 -> PI/2 (zenith), 0.75 -> PI (set)
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle); // [-1, 1]
    const sunHoriz = Math.cos(sunAngle);

    this.skyGroup.position.copy(cameraPos);
    this.celestialPivot.rotation.z = sunAngle - Math.PI / 2;

    const sunDir = new THREE.Vector3(sunHoriz, sunElev, 0.28).normalize();
    this.sunLight.position.copy(cameraPos).addScaledVector(sunDir, 80);

    // Smooth color palette interpolation across Day / Sunset / Night
    const dayZenith = new THREE.Color(0x428cf0);
    const dayHorizon = new THREE.Color(0xa6d5ff);
    const duskZenith = new THREE.Color(0x3a3b78);
    const duskHorizon = new THREE.Color(0xf27d4a);
    const nightZenith = new THREE.Color(0x090d1f);
    const nightHorizon = new THREE.Color(0x16203d);

    let skyLightTint = new THREE.Color(1, 1, 1);

    if (sunElev > 0.18) {
      const t = Math.min(1, (sunElev - 0.18) / 0.45);
      this.zenithColor.copy(duskZenith).lerp(dayZenith, t);
      this.horizonColor.copy(duskHorizon).lerp(dayHorizon, t);
      skyLightTint.setRGB(0.96 + 0.04 * t, 0.92 + 0.08 * t, 0.88 + 0.12 * t);
      this.starMat.opacity = 0.0;
    } else if (sunElev > -0.16) {
      const t = (sunElev + 0.16) / 0.34; // 0 = night edge, 1 = day edge
      const sunsetPeak = 1.0 - Math.abs(t - 0.5) * 2.0;
      this.zenithColor.copy(nightZenith).lerp(dayZenith, t).lerp(duskZenith, sunsetPeak * 0.65);
      this.horizonColor.copy(nightHorizon).lerp(dayHorizon, t).lerp(duskHorizon, sunsetPeak * 0.88);

      const nightLight = new THREE.Color(0x283659);
      const warmLight = new THREE.Color(0xffb580);
      skyLightTint.copy(nightLight).lerp(new THREE.Color(0xffffff), t).lerp(warmLight, sunsetPeak * 0.52);
      this.starMat.opacity = (1.0 - t) * 0.85;
    } else {
      this.zenithColor.copy(nightZenith);
      this.horizonColor.copy(nightHorizon);
      skyLightTint.setHex(0x263457);
      this.starMat.opacity = 0.92;
    }

    if (overcast > 0) {
      const stormCol = new THREE.Color(0x6d7b8d);
      this.zenithColor.lerp(stormCol, overcast);
      this.horizonColor.lerp(stormCol, overcast * 0.85);
      skyLightTint.multiplyScalar(0.84);
      this.starMat.opacity *= 0.2;
    }

    if (headUnderwater) {
      const waterFog = new THREE.Color(0x104d7a);
      this.zenithColor.copy(waterFog);
      this.horizonColor.copy(waterFog);
    }

    // Update Three.js entity lights
    this.sunLight.intensity = Math.max(0.12, (sunElev * 0.5 + 0.5) * 1.05 * (1 - overcast * 0.4));
    this.sunLight.color.copy(skyLightTint);
    this.hemiLight.color.copy(skyLightTint);
    this.hemiLight.intensity = Math.max(0.28, 0.5 + sunElev * 0.35);

    // Update drifting clouds around player
    this._cloudDrift += dt * 1.4;
    const dummy = this._cloudDummy;
    const dayFactor = Math.max(0, Math.min(1, (sunElev + 0.12) / 0.45));
    this.cloudMat.color.copy(skyLightTint).lerp(new THREE.Color(0xffffff), dayFactor * 0.38);
    this.cloudMat.opacity = 0.34 + dayFactor * 0.5;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const relX = ((c.ox + this._cloudDrift - cameraPos.x) % 240 + 360) % 240 - 120;
      const relZ = ((c.oz - cameraPos.z) % 240 + 360) % 240 - 120;
      dummy.position.set(cameraPos.x + relX, c.y, cameraPos.z + relZ);
      dummy.scale.set(c.w, 2.8, c.d);
      dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, dummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // Update chunk shader uniforms
    if (chunkUniforms) {
      chunkUniforms.uTime.value += dt;
      chunkUniforms.uSunDir.value.copy(sunDir.y > -0.1 ? sunDir : sunDir.clone().negate());
      chunkUniforms.uSkyColor.value.copy(skyLightTint);
      chunkUniforms.uFogColor.value.copy(this.horizonColor);
      chunkUniforms.uTorchFlicker.value = 0.96 + Math.sin(performance.now() * 0.009) * 0.03 + Math.cos(performance.now() * 0.021) * 0.02;
      chunkUniforms.uUnderwater.value = headUnderwater ? 1.0 : 0.0;
      if (headUnderwater) {
        chunkUniforms.uFogNear.value = 4.0;
        chunkUniforms.uFogFar.value = 24.0;
      }
    }

    return activeWeather;
  }

  dispose() {
    this.scene.remove(this.skyGroup);
    this.scene.remove(this.cloudMesh);
    this.scene.remove(this.hemiLight);
    this.scene.remove(this.sunLight);
    this.skyDome.geometry.dispose();
    this.skyMat.dispose();
    this.sunMesh.geometry.dispose();
    this.sunMesh.material.dispose();
    this.moonMesh.geometry.dispose();
    this.moonMesh.material.dispose();
    this.stars.geometry.dispose();
    this.starMat.dispose();
    this.cloudMesh.geometry.dispose();
    this.cloudMat.dispose();
  }
}

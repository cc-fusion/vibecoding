import * as THREE from 'three';

const C_DAY_ZENITH = new THREE.Color('#3988f0');
const C_DAY_HORIZON = new THREE.Color('#addbff');
const C_DAWN_ZENITH = new THREE.Color('#4a66a8');
const C_DAWN_HORIZON = new THREE.Color('#ff9d66');
const C_NIGHT_ZENITH = new THREE.Color('#060a17');
const C_NIGHT_HORIZON = new THREE.Color('#131e38');
const C_UNDERWATER = new THREE.Color('#0d4a7d');
const C_RAIN_GREY = new THREE.Color('#5a6b82');

export class SkySystem {
  constructor(scene, worldUniforms) {
    this.scene = scene;
    this.worldUniforms = worldUniforms;

    // 0.0 = 06:00 Dawn, 0.25 = 12:00 Noon, 0.50 = 18:00 Sunset, 0.75 = 00:00 Midnight
    this.timeOfDay = 0.14; // Start in crisp mid-morning (09:20)
    this.dayNumber = 1;
    this.dayDurationSec = 600;
    this.sunBrightness = 1.0;

    this.weather = 'clear'; // 'clear' | 'rain'
    this.weatherIntensity = 0;
    this.weatherTimer = 150;

    this.zenithColor = new THREE.Color();
    this.horizonColor = new THREE.Color();

    // Scene lighting for mobs, drops, and held viewmodel
    this.hemiLight = new THREE.HemisphereLight(0xdbeeff, 0x6b785c, 0.85);
    this.dirLight = new THREE.DirectionalLight(0xfff6e0, 1.05);
    this.scene.add(this.hemiLight, this.dirLight);

    // Distance fog
    this.fog = new THREE.Fog(0xaddbff, 42, 92);
    this.scene.fog = this.fog;

    // Sky group follows player X/Z so horizon is infinite
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    this.buildSkyDome();
    this.buildCelestialBodies();
    this.buildStars();
    this.buildClouds();
    this.buildPrecipitation();
  }

  buildSkyDome() {
    const geo = new THREE.SphereGeometry(240, 24, 16);
    this.skyUniforms = {
      uZenith: { value: new THREE.Color('#3988f0') },
      uHorizon: { value: new THREE.Color('#addbff') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying float vHeight;
        void main() {
          vHeight = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying float vHeight;
        void main() {
          float t = pow(clamp(vHeight * 1.15 + 0.08, 0.0, 1.0), 0.65);
          vec3 col = mix(uHorizon, uZenith, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -10;
    this.skyGroup.add(dome);
  }

  buildCelestialBodies() {
    this.celestialPivot = new THREE.Group();
    this.skyGroup.add(this.celestialPivot);

    // Voxel Sun + warm glow halo
    const sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.BoxGeometry(18, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xfff5b8, fog: false, depthWrite: false })
    );
    const sunHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 38),
      new THREE.MeshBasicMaterial({
        color: 0xffb84d,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        fog: false,
        depthWrite: false,
      })
    );
    sunHalo.lookAt(0, 0, 0);
    sunGroup.position.set(190, 0, 0);
    sunHalo.rotation.y = Math.PI / 2;
    sunGroup.add(sunCore, sunHalo);
    this.celestialPivot.add(sunGroup);

    // Voxel Moon + cool silver glow
    const moonGroup = new THREE.Group();
    const moonCore = new THREE.Mesh(
      new THREE.BoxGeometry(14, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xe6f0ff, fog: false, depthWrite: false })
    );
    const moonHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({
        color: 0x7aaeff,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        fog: false,
        depthWrite: false,
      })
    );
    moonHalo.rotation.y = Math.PI / 2;
    moonGroup.position.set(-190, 0, 0);
    moonGroup.add(moonCore, moonHalo);
    this.celestialPivot.add(moonGroup);
  }

  buildStars() {
    const count = 360;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.88 + 0.08);
      const r = 205;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.9,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    const stars = new THREE.Points(geo, this.starMat);
    stars.renderOrder = -8;
    this.skyGroup.add(stars);
  }

  buildClouds() {
    const cloudCount = 34;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: true,
    });
    this.cloudMesh = new THREE.InstancedMesh(geo, this.cloudMat, cloudCount);
    this.cloudMesh.renderOrder = -2;
    this.cloudData = [];

    for (let i = 0; i < cloudCount; i++) {
      this.cloudData.push({
        ox: (Math.random() - 0.5) * 260,
        oz: (Math.random() - 0.5) * 260,
        y: 96 + (i % 3) * 2.5,
        sx: 14 + Math.floor(Math.random() * 18),
        sy: 3.2,
        sz: 10 + Math.floor(Math.random() * 14),
      });
    }
    this.scene.add(this.cloudMesh);
  }

  buildPrecipitation() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    this.precipOffsets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.precipOffsets[i * 3] = (Math.random() - 0.5) * 34;
      this.precipOffsets[i * 3 + 1] = Math.random() * 24;
      this.precipOffsets[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.precipMat = new THREE.PointsMaterial({
      color: 0x99ccff,
      size: 0.22,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.precipPoints = new THREE.Points(geo, this.precipMat);
    this.precipPoints.frustumCulled = false;
    this.scene.add(this.precipPoints);
  }

  setWeather(mode) {
    this.weather = mode === 'rain' ? 'rain' : 'clear';
  }

  toggleWeather() {
    this.weather = this.weather === 'rain' ? 'clear' : 'rain';
    return this.weather;
  }

  setTimePreset(preset) {
    if (preset === 'dawn') this.timeOfDay = 0.01;
    else if (preset === 'noon') this.timeOfDay = 0.25;
    else if (preset === 'sunset') this.timeOfDay = 0.49;
    else if (preset === 'night') this.timeOfDay = 0.75;
  }

  getFormattedClock() {
    // timeOfDay 0 -> 06:00
    const totalMinutes = Math.floor(((this.timeOfDay + 0.25) % 1) * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  isNight() {
    return this.sunBrightness < 0.35;
  }

  update(dt, player, renderDistanceChunks, biomeInfo) {
    // Advance clock
    this.timeOfDay += dt / this.dayDurationSec;
    if (this.timeOfDay >= 1.0) {
      this.timeOfDay -= 1.0;
      this.dayNumber++;
    }

    // Gentle natural weather cycle
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 140 + Math.random() * 160;
      this.weather = Math.random() < 0.24 ? 'rain' : 'clear';
    }

    const targetWeather = (this.weather === 'rain' && (biomeInfo.rains || biomeInfo.snows)) ? 1 : 0;
    this.weatherIntensity += (targetWeather - this.weatherIntensity) * Math.min(1, dt * 0.8);

    // Sun angle: 0 at sunrise, PI/2 at noon, PI at sunset, 3PI/2 at midnight
    const angle = this.timeOfDay * Math.PI * 2;
    const sunElev = Math.sin(angle); // [-1, 1]

    this.skyGroup.position.set(player.pos.x, 0, player.pos.z);
    this.celestialPivot.rotation.z = angle;

    // Compute sky colors & sun brightness smoothly
    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.18, 0.28);
    const twilightFactor = Math.max(0, 1.0 - Math.abs(sunElev) * 3.4);

    this.zenithColor.copy(C_NIGHT_ZENITH).lerp(C_DAY_ZENITH, dayFactor);
    this.horizonColor.copy(C_NIGHT_HORIZON).lerp(C_DAY_HORIZON, dayFactor);

    if (twilightFactor > 0.001) {
      this.zenithColor.lerp(C_DAWN_ZENITH, twilightFactor * 0.65);
      this.horizonColor.lerp(C_DAWN_HORIZON, twilightFactor * 0.88);
    }

    if (this.weatherIntensity > 0.01) {
      this.zenithColor.lerp(C_RAIN_GREY, this.weatherIntensity * 0.55);
      this.horizonColor.lerp(C_RAIN_GREY, this.weatherIntensity * 0.55);
    }

    // Star opacity
    this.starMat.opacity = THREE.MathUtils.clamp((1 - dayFactor) * (1 - this.weatherIntensity * 0.85), 0, 0.92);

    // Voxel sun brightness uniform
    const rawBrightness = THREE.MathUtils.lerp(0.14, 1.0, dayFactor);
    this.sunBrightness = rawBrightness * (1.0 - this.weatherIntensity * 0.25);
    this.worldUniforms.uSunBrightness.value = this.sunBrightness;

    // Warm golden tint at sunrise/sunset, cool blue tint at night
    const skyTint = this.worldUniforms.uSkyLightTint.value;
    skyTint.setRGB(1.0, 0.99, 0.97);
    if (twilightFactor > 0.02) {
      skyTint.lerp(new THREE.Color(1.0, 0.82, 0.65), twilightFactor * 0.65);
    } else if (dayFactor < 0.3) {
      skyTint.lerp(new THREE.Color(0.68, 0.78, 1.0), (1 - dayFactor / 0.3) * 0.55);
    }

    // Entity scene lights
    this.dirLight.position.set(
      player.pos.x + Math.cos(angle) * 60,
      Math.max(12, Math.sin(angle) * 80),
      player.pos.z + 25
    );
    this.dirLight.intensity = 0.2 + dayFactor * 0.9;
    this.hemiLight.intensity = 0.32 + dayFactor * 0.58;

    // Underwater override vs Horizon fog
    const maxFogDist = Math.max(48, renderDistanceChunks * 16 - 4);
    if (player.headUnderWater) {
      this.fog.color.copy(C_UNDERWATER);
      this.fog.near = 2;
      this.fog.far = 22;
      this.skyUniforms.uZenith.value.copy(C_UNDERWATER);
      this.skyUniforms.uHorizon.value.copy(C_UNDERWATER);
    } else {
      this.fog.color.copy(this.horizonColor);
      this.fog.near = maxFogDist * 0.52 * (1 - this.weatherIntensity * 0.25);
      this.fog.far = maxFogDist * (1 - this.weatherIntensity * 0.2);
      this.skyUniforms.uZenith.value.copy(this.zenithColor);
      this.skyUniforms.uHorizon.value.copy(this.horizonColor);
    }

    // Update drifting 3D clouds
    const dummy = new THREE.Object3D();
    const drift = performance.now() * 0.0014;
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      const relX = ((((c.ox + drift - player.pos.x) % 260) + 260) % 260) - 130;
      const relZ = ((((c.oz - player.pos.z) % 260) + 260) % 260) - 130;
      dummy.position.set(player.pos.x + relX, c.y, player.pos.z + relZ);
      dummy.scale.set(c.sx, c.sy, c.sz);
      dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, dummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.cloudMat.color.copy(this.horizonColor).lerp(new THREE.Color(0xffffff), 0.55 * dayFactor + 0.15);

    // Update Rain / Snow particles around player
    if (this.weatherIntensity > 0.03 && !player.headUnderWater) {
      const isSnow = biomeInfo.snows;
      this.precipMat.opacity = this.weatherIntensity * 0.72;
      this.precipMat.color.setHex(isSnow ? 0xf5faff : 0x8cc2ff);
      this.precipMat.size = isSnow ? 0.26 : 0.18;

      const fallSpeed = isSnow ? 3.6 : 19.0;
      const posAttr = this.precipPoints.geometry.attributes.position;
      const arr = posAttr.array;
      const t = performance.now() * 0.001;

      for (let i = 0; i < this.precipOffsets.length; i += 3) {
        this.precipOffsets[i + 1] -= fallSpeed * dt;
        if (this.precipOffsets[i + 1] < -6) {
          this.precipOffsets[i + 1] = 18;
        }
        const sway = isSnow ? Math.sin(t * 2 + i) * 0.6 : 0;
        arr[i] = player.pos.x + this.precipOffsets[i] + sway;
        arr[i + 1] = player.pos.y + this.precipOffsets[i + 1];
        arr[i + 2] = player.pos.z + this.precipOffsets[i + 2];
      }
      posAttr.needsUpdate = true;
      this.precipPoints.visible = true;
    } else {
      this.precipPoints.visible = false;
    }
  }
}

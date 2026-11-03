import * as THREE from 'three';
import { BIOME } from '../world/WorldGen.js';
import { mulberry32 } from '../engine/Noise.js';

const DAY_DURATION_SEC = 600; // 10 minutes per full 24h cycle

export class SkyWeather {
  constructor(scene, sharedUniforms) {
    this.scene = scene;
    this.uniforms = sharedUniforms;

    // 0.0 = 06:00 Dawn, 0.25 = 12:00 Noon, 0.50 = 18:00 Dusk, 0.75 = 00:00 Midnight
    this.timeOfDay = 0.12;
    this.dayCount = 1;
    this.timeSpeed = 1.0;

    // Weather: 'auto' | 'clear' | 'rain'
    this.weatherMode = 'auto';
    this.isPrecipitating = false;
    this.precipIntensity = 0;
    this.weatherTimer = 140;

    this.zenithColor = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this.skyTint = new THREE.Color();

    this.initLights();
    this.initSkyDome();
    this.initCelestials();
    this.initClouds();
    this.initWeatherParticles();
  }

  initLights() {
    // Lights illuminate 3D entities (creatures, dropped items, held tools)
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x5c6b4d, 0.75);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff6e0, 1.05);
    this.dirLight.position.set(40, 80, 30);
    this.scene.add(this.dirLight);
  }

  initSkyDome() {
    const geo = new THREE.SphereGeometry(260, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x3b82f6) },
        uHorizon: { value: new THREE.Color(0x9bd1ff) },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(vWorldDir.y, 0.0, 1.0);
          float curve = pow(h, 0.58);
          vec3 col = mix(uHorizon, uZenith, curve);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(geo, this.skyMat);
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);
  }

  initCelestials() {
    this.celestialGroup = new THREE.Group();
    this.scene.add(this.celestialGroup);

    // Sun (warm layered voxel glow)
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3a8, fog: false, depthWrite: false });
    const sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.35,
      fog: false,
      depthWrite: false,
    });
    this.sunMesh = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), sunMat);
    const sunHalo = new THREE.Mesh(new THREE.BoxGeometry(28, 28, 28), sunHaloMat);
    this.sunMesh.add(sunHalo);
    this.celestialGroup.add(this.sunMesh);

    // Moon (crisp silver voxel moon)
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe2ecff, fog: false, depthWrite: false });
    const moonGlowMat = new THREE.MeshBasicMaterial({
      color: 0x7aa2f7,
      transparent: true,
      opacity: 0.25,
      fog: false,
      depthWrite: false,
    });
    this.moonMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), moonMat);
    this.moonMesh.add(new THREE.Mesh(new THREE.BoxGeometry(22, 22, 22), moonGlowMat));
    this.celestialGroup.add(this.moonMesh);

    // Starfield
    const rng = mulberry32(4242);
    const starCount = 340;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(1 - rng() * 1.65);
      const r = 230;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.celestialGroup.add(this.stars);
  }

  initClouds() {
    const rng = mulberry32(8888);
    const boxes = [];
    for (let i = 0; i < 34; i++) {
      const cx = (rng() - 0.5) * 300;
      const cz = (rng() - 0.5) * 300;
      const w = 14 + Math.floor(rng() * 22);
      const d = 10 + Math.floor(rng() * 18);
      boxes.push({ x: cx, y: 0, z: cz, w, h: 3.5, d });
      if (rng() > 0.4) {
        boxes.push({ x: cx + w * 0.35, y: 0.5, z: cz + d * 0.25, w: w * 0.65, h: 3.0, d: d * 0.7 });
      }
    }

    const positions = [];
    const indices = [];
    let vc = 0;
    const pushBox = (bx, by, bz, w, h, d) => {
      const x0 = bx - w / 2, x1 = bx + w / 2;
      const y0 = by, y1 = by + h;
      const z0 = bz - d / 2, z1 = bz + d / 2;
      const faces = [
        [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
        [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
        [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
        [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
        [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
        [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
      ];
      for (const f of faces) {
        for (const p of f) positions.push(p[0], p[1], p[2]);
        indices.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
        vc += 4;
      }
    };
    for (const b of boxes) pushBox(b.x, b.y, b.z, b.w, b.h, b.d);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.cloudMesh = new THREE.Mesh(geo, this.cloudMat);
    this.cloudDrift = 0;
    this.scene.add(this.cloudMesh);
  }

  initWeatherParticles() {
    const count = 900;
    this.weatherCount = count;
    this.weatherPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.weatherPositions[i * 3] = (Math.random() - 0.5) * 44;
      this.weatherPositions[i * 3 + 1] = Math.random() * 28;
      this.weatherPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    this.weatherGeo = new THREE.BufferGeometry();
    this.weatherGeo.setAttribute('position', new THREE.BufferAttribute(this.weatherPositions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      color: 0xa5d8ff,
      size: 0.22,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeo, this.weatherMat);
    this.weatherPoints.frustumCulled = false;
    this.scene.add(this.weatherPoints);
  }

  isNight() {
    return this.timeOfDay > 0.54 && this.timeOfDay < 0.96;
  }

  getClockString() {
    const totalHours = ((this.timeOfDay * 24 + 6) % 24);
    const hh = Math.floor(totalHours);
    const mm = Math.floor((totalHours - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  getPhaseLabel() {
    const t = this.timeOfDay;
    if (t < 0.08 || t >= 0.95) return 'Dawn';
    if (t < 0.42) return 'Day';
    if (t < 0.55) return 'Dusk';
    return 'Night';
  }

  update(dt, playerPos, currentBiome) {
    // Advance world clock
    const prev = this.timeOfDay;
    this.timeOfDay = (this.timeOfDay + (dt * this.timeSpeed) / DAY_DURATION_SEC) % 1.0;
    if (this.timeOfDay < prev) this.dayCount++;

    // Weather state machine
    if (this.weatherMode === 'auto') {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this.isPrecipitating = !this.isPrecipitating && Math.random() < 0.45;
        this.weatherTimer = this.isPrecipitating ? 55 + Math.random() * 45 : 130 + Math.random() * 120;
      }
    } else {
      this.isPrecipitating = this.weatherMode === 'rain';
    }

    const dryBiome = currentBiome === BIOME.DESERT;
    const targetPrecip = this.isPrecipitating && !dryBiome ? 1.0 : 0.0;
    this.precipIntensity += (targetPrecip - this.precipIntensity) * Math.min(1, dt * 1.2);

    // Sun elevation angle: t=0 -> 0 rad (horizon), t=0.25 -> PI/2 (zenith), t=0.5 -> PI, t=0.75 -> 3PI/2
    const angle = this.timeOfDay * Math.PI * 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);

    // Smooth daylight level [0.16 .. 1.0]
    const rawDay = Math.max(0, Math.min(1, (sunY + 0.18) / 0.85));
    const rainDim = 1.0 - this.precipIntensity * 0.24;
    const sunLevel = (0.16 + rawDay * 0.84) * rainDim;
    this.uniforms.uSunLevel.value = sunLevel;
    this.uniforms.uTime.value += dt;

    // Palette keyframes: Night -> Dawn/Dusk -> Noon
    const twilight = Math.max(0, 1.0 - Math.abs(sunY) * 3.4);
    const dayFactor = Math.max(0, sunY);

    // Zenith sky color
    const nightZenith = new THREE.Color(0x090f24);
    const dayZenith = new THREE.Color(0x2d7ef7);
    const duskZenith = new THREE.Color(0x4b4c8c);
    this.zenithColor.copy(nightZenith).lerp(dayZenith, Math.pow(dayFactor, 0.65)).lerp(duskZenith, twilight * 0.65);

    // Horizon color
    const nightHorizon = new THREE.Color(0x162244);
    const dayHorizon = new THREE.Color(0xa6d8ff);
    const duskHorizon = new THREE.Color(0xff8e53);
    this.horizonColor.copy(nightHorizon).lerp(dayHorizon, Math.pow(dayFactor, 0.55)).lerp(duskHorizon, twilight * 0.85);

    // Overcast desaturation during rain/snow
    if (this.precipIntensity > 0.01) {
      const overcast = new THREE.Color(0x6d7d91).multiplyScalar(0.35 + 0.65 * rawDay);
      this.zenithColor.lerp(overcast, this.precipIntensity * 0.65);
      this.horizonColor.lerp(overcast, this.precipIntensity * 0.72);
    }

    // Sky tint applied to terrain
    const nightTint = new THREE.Color(0x7c98d6);
    const dayTint = new THREE.Color(0xffffff);
    const duskTint = new THREE.Color(0xffbe8a);
    this.skyTint.copy(nightTint).lerp(dayTint, rawDay).lerp(duskTint, twilight * 0.55);

    this.skyMat.uniforms.uZenith.value.copy(this.zenithColor);
    this.skyMat.uniforms.uHorizon.value.copy(this.horizonColor);

    if (this.uniforms.uUnderwater.value > 0.5) {
      this.uniforms.uFogColor.value.setRGB(0.05, 0.25, 0.44).multiplyScalar(0.4 + 0.6 * sunLevel);
      this.uniforms.uFogNear.value = 6.0;
      this.uniforms.uFogFar.value = 28.0;
    } else {
      this.uniforms.uFogColor.value.copy(this.horizonColor);
    }
    this.uniforms.uSkyTint.value.copy(this.skyTint);

    // Sync scene lights for 3D mobs & items
    this.hemiLight.intensity = 0.28 + rawDay * 0.55;
    this.hemiLight.color.copy(this.skyTint);
    this.dirLight.intensity = 0.12 + rawDay * 0.95;
    this.dirLight.color.copy(this.skyTint);

    // Center sky & celestials around player
    this.skyDome.position.copy(playerPos);
    this.celestialGroup.position.copy(playerPos);

    const orbitR = 195;
    this.sunMesh.position.set(sunX * orbitR, sunY * orbitR, -35);
    this.sunMesh.lookAt(playerPos);
    this.moonMesh.position.set(-sunX * orbitR, -sunY * orbitR, 35);
    this.moonMesh.lookAt(playerPos);
    this.stars.rotation.y = angle * 0.25;
    this.starMat.opacity = Math.max(0, (-sunY + 0.05) * 1.1) * (1 - this.precipIntensity * 0.85);

    // Drift voxel clouds overhead (y = 88)
    this.cloudDrift = (this.cloudDrift + dt * 1.6) % 300;
    const snapX = Math.floor(playerPos.x / 300) * 300;
    const snapZ = Math.floor((playerPos.z - this.cloudDrift) / 300) * 300 + this.cloudDrift;
    this.cloudMesh.position.set(snapX, 88, snapZ);
    this.cloudMat.color.copy(this.skyTint).multiplyScalar(0.32 + 0.68 * sunLevel);

    // Update rain / snow particles around player
    if (this.precipIntensity > 0.02) {
      const isSnow = currentBiome === BIOME.SNOW_TAIGA || currentBiome === BIOME.ALPINE;
      this.weatherMat.opacity = this.precipIntensity * (isSnow ? 0.85 : 0.62);
      this.weatherMat.color.setHex(isSnow ? 0xf8fbff : 0x8ec5ff);
      this.weatherMat.size = isSnow ? 0.28 : 0.18;
      const fallSpeed = isSnow ? 4.2 : 22.0;

      const arr = this.weatherPositions;
      for (let i = 0; i < this.weatherCount; i++) {
        const i3 = i * 3;
        arr[i3 + 1] -= fallSpeed * dt;
        if (isSnow) {
          arr[i3] += Math.sin(this.uniforms.uTime.value * 2 + i) * dt * 1.1;
        }
        if (arr[i3 + 1] < -8) {
          arr[i3] = (Math.random() - 0.5) * 44;
          arr[i3 + 1] = 20 + Math.random() * 8;
          arr[i3 + 2] = (Math.random() - 0.5) * 44;
        }
      }
      this.weatherGeo.attributes.position.needsUpdate = true;
      this.weatherPoints.position.set(playerPos.x, playerPos.y, playerPos.z);
      this.weatherPoints.visible = true;
    } else {
      this.weatherPoints.visible = false;
    }
  }
}

// Dynamic Atmosphere: Day-Night Cycle, Sky Dome, Sun/Moon, Stars, Voxel Clouds & Weather
import * as THREE from 'three';
import { DAY_DURATION, CLOUD_HEIGHT, CHUNK_SIZE } from './constants.js';
import { mulberry32 } from './noise.js';

export class SkySystem {
  constructor(scene, voxelUniforms) {
    this.scene = scene;
    this.voxelUniforms = voxelUniforms;

    // Start at bright welcoming morning (0.14 => ~8:30 AM)
    this.timeOfDay = 0.14;
    this.dayCount = 1;
    this.weatherMode = 'auto'; // 'auto' | 'clear' | 'precip'
    this.precipActive = false;
    this.precipIntensity = 0; // 0..1 smooth blend
    this.weatherTimer = 110;

    // Scene lights for 3D entities (creatures, dropped items, held tool)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    this.sunLight = new THREE.DirectionalLight(0xfff8e8, 1.05);
    this.sunLight.position.set(40, 80, 30);

    this.root = new THREE.Group();
    if (this.scene) {
      this.scene.add(this.ambientLight);
      this.scene.add(this.sunLight);
      this.scene.add(this.root);
    }

    this.buildSkyDome();
    this.buildCelestials();
    this.buildClouds();
    this.buildWeatherParticles();
  }

  buildSkyDome() {
    this.skyUniforms = {
      uZenithColor: { value: new THREE.Color(0x3b86eb) },
      uHorizonColor: { value: new THREE.Color(0x9bd2ff) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunsetGlow: { value: 0.0 },
    };

    const geom = new THREE.SphereGeometry(220, 24, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform float uSunsetGlow;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          float curve = pow(h, 0.58);
          vec3 col = mix(uHorizonColor, uZenithColor, curve);

          // Warm golden-coral glow near sun during sunrise & sunset
          float sunDot = max(0.0, dot(normalize(vDir), normalize(uSunDir)));
          col += vec3(1.0, 0.52, 0.22) * pow(sunDot, 5.0) * uSunsetGlow * 0.58;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(geom, mat);
    this.skyDome.renderOrder = -20;
    this.skyDome.frustumCulled = false;
    this.root.add(this.skyDome);
  }

  buildCelestials() {
    this.celestialPivot = new THREE.Group();
    this.root.add(this.celestialPivot);

    // Crisp Voxel Sun
    const sunGeom = new THREE.BoxGeometry(18, 18, 2);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff08a, fog: false, depthWrite: false });
    this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
    this.sunMesh.position.set(0, 175, 0);
    this.sunMesh.lookAt(0, 0, 0);
    this.sunMesh.renderOrder = -15;
    this.celestialPivot.add(this.sunMesh);

    // Glowing Voxel Moon
    const moonGeom = new THREE.BoxGeometry(14, 14, 2);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe, fog: false, depthWrite: false });
    this.moonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.moonMesh.position.set(0, -175, 0);
    this.moonMesh.lookAt(0, 0, 0);
    this.moonMesh.renderOrder = -15;
    this.celestialPivot.add(this.moonMesh);

    // 3D Starfield
    const rng = mulberry32(202607);
    const starPositions = [];
    for (let i = 0; i < 340; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 2 - 1);
      const r = 185;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.9,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeom, this.starMat);
    this.stars.renderOrder = -18;
    this.celestialPivot.add(this.stars);
  }

  buildClouds() {
    this.cloudGroup = new THREE.Group();
    const rng = mulberry32(88421);
    const boxes = [];
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.cloudMat = cloudMat;

    const unitGeom = new THREE.BoxGeometry(1, 1, 1);
    const count = 68;
    const inst = new THREE.InstancedMesh(unitGeom, cloudMat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const cx = (rng() - 0.5) * 260;
      const cz = (rng() - 0.5) * 260;
      const w = 12 + Math.floor(rng() * 22);
      const d = 10 + Math.floor(rng() * 18);
      dummy.position.set(cx, 0, cz);
      dummy.scale.set(w, 3.2, d);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      boxes.push({ cx, cz, w, d });
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    this.cloudGroup.add(inst);
    this.cloudDrift = 0;
    if (this.scene) this.scene.add(this.cloudGroup);
  }

  buildWeatherParticles() {
    this.weatherCount = 550;
    const positions = new Float32Array(this.weatherCount * 3);
    for (let i = 0; i < this.weatherCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 38;
      positions[i * 3 + 1] = Math.random() * 26 - 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 38;
    }
    this.weatherGeom = new THREE.BufferGeometry();
    this.weatherGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.weatherMat = new THREE.PointsMaterial({
      color: 0xbadbff,
      size: 0.22,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(this.weatherGeom, this.weatherMat);
    this.weatherPoints.visible = false;
    this.weatherPoints.frustumCulled = false;
    if (this.scene) this.scene.add(this.weatherPoints);
  }

  setTimePreset(preset) {
    if (preset === 'dawn') this.timeOfDay = 0.02;
    else if (preset === 'noon') this.timeOfDay = 0.25;
    else if (preset === 'sunset') this.timeOfDay = 0.50;
    else if (preset === 'night') this.timeOfDay = 0.75;
  }

  getPhaseLabel() {
    const t = this.timeOfDay;
    if (t >= 0.96 || t < 0.08) return 'Dawn';
    if (t < 0.44) return 'Day';
    if (t < 0.56) return 'Sunset';
    return 'Night';
  }

  isNight() {
    return this.timeOfDay >= 0.54 && this.timeOfDay <= 0.96;
  }

  update(dt, playerPos, currentBiome, renderDistance, isUnderwater) {
    // Advance world clock
    this.timeOfDay += dt / DAY_DURATION;
    if (this.timeOfDay >= 1.0) {
      this.timeOfDay -= 1.0;
      this.dayCount += 1;
    }

    // Weather state machine
    if (this.weatherMode === 'auto') {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this.precipActive = !this.precipActive && Math.random() < 0.65;
        this.weatherTimer = this.precipActive ? 45 + Math.random() * 45 : 110 + Math.random() * 90;
      }
    } else {
      this.precipActive = this.weatherMode === 'precip';
    }

    const biomeWeather = currentBiome ? currentBiome.weather : 'rain';
    const wantPrecip = this.precipActive && biomeWeather !== 'clear';
    const targetPrecip = wantPrecip ? 1.0 : 0.0;
    this.precipIntensity += (targetPrecip - this.precipIntensity) * Math.min(1, dt * 1.4);

    // Sun angle: timeOfDay 0 = sunrise (horizon), 0.25 = zenith (+Y), 0.50 = sunset, 0.75 = nadir (-Y)
    const angle = this.timeOfDay * Math.PI * 2;
    const sunElev = Math.sin(angle); // [-1..1]
    const sunHoriz = Math.cos(angle);

    this.root.position.copy(playerPos);
    this.celestialPivot.rotation.z = angle - Math.PI * 0.5;
    this.celestialPivot.rotation.y = 0.32;

    const sunDir = new THREE.Vector3(sunHoriz * 0.95, sunElev, 0.3).normalize();
    this.skyUniforms.uSunDir.value.copy(sunDir);

    // Compute smooth atmospheric colors across Day -> Sunset -> Night -> Dawn
    const dayFactor = THREE.MathUtils.smoothstep(sunElev, -0.18, 0.28);
    const twilight = Math.max(0, 1.0 - Math.abs(sunElev) * 3.4);

    const zenithDay = new THREE.Color(0x3682eb);
    const zenithNight = new THREE.Color(0x070d1f);
    const zenith = zenithNight.clone().lerp(zenithDay, dayFactor);

    const horizDay = new THREE.Color(0x9ed3ff);
    const horizNight = new THREE.Color(0x111c38);
    const horizSunset = new THREE.Color(0xf28549);
    const horizon = horizNight.clone().lerp(horizDay, dayFactor).lerp(horizSunset, twilight * 0.68);

    // Dim sky slightly during rain/snow
    if (this.precipIntensity > 0.01) {
      const stormZenith = new THREE.Color(0x4b5c73).multiplyScalar(0.3 + 0.7 * dayFactor);
      const stormHoriz = new THREE.Color(0x76899e).multiplyScalar(0.3 + 0.7 * dayFactor);
      zenith.lerp(stormZenith, this.precipIntensity * 0.65);
      horizon.lerp(stormHoriz, this.precipIntensity * 0.65);
    }

    if (isUnderwater) {
      const waterCol = new THREE.Color(0x11498a).multiplyScalar(0.35 + 0.65 * dayFactor);
      zenith.copy(waterCol);
      horizon.copy(waterCol);
    }

    this.skyUniforms.uZenithColor.value.copy(zenith);
    this.skyUniforms.uHorizonColor.value.copy(horizon);
    this.skyUniforms.uSunsetGlow.value = twilight * (1.0 - this.precipIntensity * 0.7);

    // Stars visibility at night
    this.starMat.opacity = THREE.MathUtils.clamp((0.25 - dayFactor) * 3.2 * (1.0 - this.precipIntensity), 0, 0.92);

    // Update voxel world uniforms (updates EVERY chunk's lighting simultaneously with 0 remeshes!)
    const sunBrightness = THREE.MathUtils.lerp(0.14, 1.0, dayFactor) * (1.0 - this.precipIntensity * 0.22);
    const skyTint = new THREE.Color(0x6d84b8)
      .lerp(new THREE.Color(0xfffdf8), dayFactor)
      .lerp(new THREE.Color(0xffb27a), twilight * 0.45);

    this.voxelUniforms.uSunBrightness.value = sunBrightness;
    this.voxelUniforms.uSkyTint.value.copy(skyTint);
    this.voxelUniforms.uFogColor.value.copy(horizon);
    this.voxelUniforms.uUnderwater.value = isUnderwater ? 1.0 : 0.0;

    const maxView = renderDistance * CHUNK_SIZE;
    if (isUnderwater) {
      this.voxelUniforms.uFogNear.value = 3.0;
      this.voxelUniforms.uFogFar.value = 24.0;
    } else {
      const rainShorten = 1.0 - this.precipIntensity * 0.22;
      this.voxelUniforms.uFogNear.value = maxView * 0.52 * rainShorten;
      this.voxelUniforms.uFogFar.value = (maxView - 4.0) * rainShorten;
    }

    // Sync scene lights for 3D mobs & held viewmodel
    this.ambientLight.intensity = 0.28 + dayFactor * 0.52;
    this.ambientLight.color.copy(skyTint);
    this.sunLight.intensity = dayFactor * 0.95;
    this.sunLight.color.copy(skyTint);
    this.sunLight.position.set(
      playerPos.x + sunDir.x * 60,
      playerPos.y + Math.max(15, sunDir.y * 80),
      playerPos.z + sunDir.z * 60
    );

    // Drift voxel clouds centered lazily around player
    this.cloudDrift = (this.cloudDrift + dt * 1.4) % 260;
    const snapX = Math.floor(playerPos.x / 260) * 260;
    const snapZ = Math.floor(playerPos.z / 260) * 260;
    this.cloudGroup.position.set(snapX + this.cloudDrift - 130, CLOUD_HEIGHT, snapZ);
    this.cloudMat.color.copy(skyTint).multiplyScalar(0.32 + dayFactor * 0.68);
    this.cloudGroup.visible = !isUnderwater;

    // Update rain / snow particles around player
    if (this.precipIntensity > 0.02 && !isUnderwater) {
      this.weatherPoints.visible = true;
      this.weatherPoints.position.set(playerPos.x, playerPos.y, playerPos.z);
      const isSnow = biomeWeather === 'snow';
      this.weatherMat.color.setHex(isSnow ? 0xf5faff : 0x9ecaff);
      this.weatherMat.size = isSnow ? 0.26 : 0.17;
      this.weatherMat.opacity = this.precipIntensity * (isSnow ? 0.85 : 0.62);

      const posAttr = this.weatherGeom.getAttribute('position');
      const arr = posAttr.array;
      const fallSpeed = isSnow ? 3.4 : 19.5;
      for (let i = 0; i < this.weatherCount; i++) {
        const idx = i * 3;
        arr[idx + 1] -= fallSpeed * dt;
        if (isSnow) {
          arr[idx + 0] += Math.sin(this.voxelUniforms.uTime.value * 1.8 + i) * 0.8 * dt;
        }
        if (arr[idx + 1] < -8) {
          arr[idx + 1] = 18;
          arr[idx + 0] = (Math.random() - 0.5) * 38;
          arr[idx + 2] = (Math.random() - 0.5) * 38;
        }
      }
      posAttr.needsUpdate = true;
    } else {
      this.weatherPoints.visible = false;
    }

    return {
      isRaining: this.precipIntensity > 0.25 && biomeWeather === 'rain' && !isUnderwater,
    };
  }

  dispose() {
    if (!this.scene) return;
    this.scene.remove(this.root);
    this.scene.remove(this.cloudGroup);
    this.scene.remove(this.weatherPoints);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.sunLight);
  }
}

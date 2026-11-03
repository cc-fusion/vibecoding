import * as THREE from 'three';
import { DAY_LENGTH_SECONDS, WEATHER_TYPES } from '../constants.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform float uSunsetGlow;

  varying vec3 vDir;

  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    float curve = pow(h, 0.55);
    vec3 col = mix(uHorizon, uZenith, curve);

    // Warm horizon glow near sun during dawn & dusk
    float sunAlign = max(0.0, dot(normalize(vDir), normalize(uSunDir)));
    float horizonBand = pow(1.0 - abs(vDir.y), 3.0);
    col += vec3(1.0, 0.48, 0.18) * pow(sunAlign, 5.0) * horizonBand * uSunsetGlow;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class SkyWeather {
  constructor(scene) {
    this.scene = scene;

    // 0.0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    this.timeOfDay = 0.30; // Start in crisp bright mid-morning
    this.dayNumber = 1;
    this.weather = WEATHER_TYPES.CLEAR;
    this._weatherTimer = 150 + Math.random() * 120;

    // Live lighting state consumed by VoxelMaterials, Mobs, and Renderer
    this.skyState = {
      brightness: 1.0,
      lightTint: new THREE.Color(1, 1, 1),
      fogColor: new THREE.Color(0x8ec8ff),
      zenithColor: new THREE.Color(0x3a82f6),
      sunDir: new THREE.Vector3(0.4, 0.85, 0.2).normalize(),
      isNight: false,
    };

    // Directional & ambient lights for 3D entities (Mobs, Dropped Items, ViewModel)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.sunLight = new THREE.DirectionalLight(0xfff8e8, 0.95);
    this.scene.add(this.ambientLight);
    this.scene.add(this.sunLight);

    // Sky root follows camera position
    this.skyRoot = new THREE.Group();
    this.scene.add(this.skyRoot);

    this._buildSkyDome();
    this._buildCelestials();
    this._buildClouds();
    this._buildPrecipitation();
  }

  _buildSkyDome() {
    const geo = new THREE.SphereGeometry(280, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color(0x3b82f6) },
        uHorizon: { value: new THREE.Color(0x9bd2ff) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunsetGlow: { value: 0.0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(geo, this.skyMat);
    this.skyDome.renderOrder = -10;
    this.skyRoot.add(this.skyDome);
  }

  _buildCelestials() {
    this.celestialPivot = new THREE.Group();
    this.skyRoot.add(this.celestialPivot);

    // Pixel Sun
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 16; sunCanvas.height = 16;
    const sctx = sunCanvas.getContext('2d');
    sctx.fillStyle = 'rgba(255, 224, 110, 0.38)';
    sctx.fillRect(0, 0, 16, 16);
    sctx.fillStyle = '#ffe566';
    sctx.fillRect(2, 2, 12, 12);
    sctx.fillStyle = '#fffbe0';
    sctx.fillRect(4, 4, 8, 8);
    const sunTex = new THREE.CanvasTexture(sunCanvas);
    sunTex.magFilter = THREE.NearestFilter;
    sunTex.colorSpace = THREE.SRGBColorSpace;

    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), sunMat);
    this.sunMesh.position.set(0, 220, 0);
    this.sunMesh.rotation.x = Math.PI / 2;
    this.sunMesh.renderOrder = -8;
    this.celestialPivot.add(this.sunMesh);

    // Pixel Moon
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 16; moonCanvas.height = 16;
    const mctx = moonCanvas.getContext('2d');
    mctx.fillStyle = 'rgba(180, 210, 255, 0.25)';
    mctx.fillRect(1, 1, 14, 14);
    mctx.fillStyle = '#dce9ff';
    mctx.fillRect(3, 3, 10, 10);
    mctx.fillStyle = '#a8bddb';
    mctx.fillRect(5, 5, 3, 2);
    mctx.fillRect(9, 8, 2, 3);
    mctx.fillRect(4, 10, 2, 2);
    const moonTex = new THREE.CanvasTexture(moonCanvas);
    moonTex.magFilter = THREE.NearestFilter;
    moonTex.colorSpace = THREE.SRGBColorSpace;

    const moonMat = new THREE.MeshBasicMaterial({
      map: moonTex,
      transparent: true,
      depthWrite: false,
    });
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), moonMat);
    this.moonMesh.position.set(0, -220, 0);
    this.moonMesh.rotation.x = -Math.PI / 2;
    this.moonMesh.renderOrder = -8;
    this.celestialPivot.add(this.moonMesh);

    // Starfield
    const starCount = 380;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 240;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xf4f8ff,
      size: 2.0,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.renderOrder = -9;
    this.celestialPivot.add(this.stars);
  }

  _buildClouds() {
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);

    const cloudCount = 34;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.80,
      depthWrite: false,
    });
    this.cloudMesh = new THREE.InstancedMesh(boxGeo, this.cloudMat, cloudCount);
    this.cloudMesh.frustumCulled = false;
    this.cloudData = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < cloudCount; i++) {
      const w = 14 + Math.floor(Math.random() * 20);
      const d = 10 + Math.floor(Math.random() * 16);
      const ox = (Math.random() - 0.5) * 260;
      const oz = (Math.random() - 0.5) * 260;
      const oy = 102 + (i % 3) * 2.5;
      this.cloudData.push({ ox, oy, oz, w, d });
      dummy.position.set(ox, oy, oz);
      dummy.scale.set(w, 3.2, d);
      dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, dummy.matrix);
    }
    this.cloudGroup.add(this.cloudMesh);
    this._cloudOffset = 0;
  }

  _buildPrecipitation() {
    // Rain streaks (LineSegments) + Snowflakes (Points)
    const dropCount = 650;
    this._precipDrops = [];
    const rainPositions = new Float32Array(dropCount * 6);
    const snowPositions = new Float32Array(dropCount * 3);

    for (let i = 0; i < dropCount; i++) {
      this._precipDrops.push({
        ox: (Math.random() - 0.5) * 38,
        oy: Math.random() * 26,
        oz: (Math.random() - 0.5) * 38,
        speed: 0.85 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(rainGeo, this.rainMat);
    this.rainLines.visible = false;
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);

    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
    this.snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 4.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    this.snowPoints = new THREE.Points(snowGeo, this.snowMat);
    this.snowPoints.visible = false;
    this.snowPoints.frustumCulled = false;
    this.scene.add(this.snowPoints);
  }

  setTimeOfDay(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
  }

  getFormattedClock() {
    // timeOfDay 0.0 = 00:00, 0.25 = 06:00, 0.50 = 12:00, 0.75 = 18:00
    const totalMinutes = Math.floor(this.timeOfDay * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `Day ${this.dayNumber} · ${hh}:${mm}`;
  }

  canSleepNow() {
    // Allow sleeping at dusk/night (18:30 to 05:30 -> ~0.77 to 0.23)
    return this.timeOfDay >= 0.76 || this.timeOfDay <= 0.23;
  }

  sleepToMorning() {
    this.timeOfDay = 0.26;
    this.dayNumber += 1;
    if (this.weather !== WEATHER_TYPES.CLEAR) {
      this.weather = WEATHER_TYPES.CLEAR;
    }
  }

  update(dt, playerPos, currentBiome, timeScale = 1.0) {
    // Advance day-night clock
    this.timeOfDay += (dt * timeScale) / DAY_LENGTH_SECONDS;
    if (this.timeOfDay >= 1.0) {
      this.timeOfDay -= 1.0;
      this.dayNumber += 1;
    }

    // Natural weather transitions
    this._weatherTimer -= dt;
    if (this._weatherTimer <= 0) {
      if (this.weather === WEATHER_TYPES.CLEAR) {
        this.weather = Math.random() < 0.32 ? WEATHER_TYPES.RAIN : WEATHER_TYPES.CLEAR;
        this._weatherTimer = 75 + Math.random() * 90;
      } else {
        this.weather = WEATHER_TYPES.CLEAR;
        this._weatherTimer = 160 + Math.random() * 140;
      }
    }

    // Determine effective local precipitation based on biome & altitude
    let activePrecip = WEATHER_TYPES.CLEAR;
    if (this.weather !== WEATHER_TYPES.CLEAR) {
      if (currentBiome?.dry) {
        activePrecip = WEATHER_TYPES.CLEAR;
      } else if (currentBiome?.snowy || playerPos.y >= 64 || this.weather === WEATHER_TYPES.SNOW) {
        activePrecip = WEATHER_TYPES.SNOW;
      } else {
        activePrecip = WEATHER_TYPES.RAIN;
      }
    }
    this.activePrecipitation = activePrecip;

    // Celestial angle: timeOfDay 0.5 = noon (angle = 0 -> +Y), 0.0 = midnight (-Y)
    const angle = (this.timeOfDay - 0.5) * Math.PI * 2;
    this.celestialPivot.rotation.z = angle;

    const sunY = Math.cos(angle);
    const sunX = -Math.sin(angle);
    this.skyState.sunDir.set(sunX, sunY, 0.18).normalize();

    // Smooth day/sunset/night factor
    const dayFactor = THREE.MathUtils.smoothstep(sunY, -0.18, 0.28);
    const twilightFactor = Math.max(0, 1.0 - Math.abs(sunY) * 3.4);
    const stormDim = activePrecip !== WEATHER_TYPES.CLEAR ? 0.76 : 1.0;

    this.skyState.isNight = sunY < -0.06;
    this.skyState.brightness = THREE.MathUtils.lerp(0.16, 1.0, dayFactor) * stormDim;

    // Zenith & Horizon colors
    const dayZenith = new THREE.Color(0x3980f5);
    const dayHorizon = new THREE.Color(0x9ed3ff);
    const duskHorizon = new THREE.Color(0xf28549);
    const nightZenith = new THREE.Color(0x060b1a);
    const nightHorizon = new THREE.Color(0x131d38);

    const zenith = nightZenith.clone().lerp(dayZenith, dayFactor);
    const horizon = nightHorizon.clone().lerp(dayHorizon, dayFactor).lerp(duskHorizon, twilightFactor * 0.65);

    if (activePrecip !== WEATHER_TYPES.CLEAR) {
      const stormGray = new THREE.Color(0x5d6b7d).multiplyScalar(0.35 + dayFactor * 0.65);
      zenith.lerp(stormGray, 0.55);
      horizon.lerp(stormGray, 0.60);
    }

    this.skyState.zenithColor.copy(zenith);
    this.skyState.fogColor.copy(horizon);

    // Light tint (warm golden at dawn/dusk, cool lunar blue at night, crisp daylight at noon)
    const nightTint = new THREE.Color(0.68, 0.76, 1.0);
    const dayTint = new THREE.Color(1.0, 0.99, 0.96);
    const sunsetTint = new THREE.Color(1.05, 0.84, 0.68);
    this.skyState.lightTint.copy(nightTint).lerp(dayTint, dayFactor).lerp(sunsetTint, twilightFactor * 0.55);

    // Update sky shader uniforms & lights
    this.skyRoot.position.copy(playerPos);
    this.skyMat.uniforms.uZenith.value.copy(zenith);
    this.skyMat.uniforms.uHorizon.value.copy(horizon);
    this.skyMat.uniforms.uSunDir.value.copy(this.skyState.sunDir);
    this.skyMat.uniforms.uSunsetGlow.value = twilightFactor * (activePrecip === WEATHER_TYPES.CLEAR ? 0.85 : 0.15);

    this.starMat.opacity = THREE.MathUtils.clamp((0.12 - sunY) * 3.2, 0, 0.9) * (activePrecip === WEATHER_TYPES.CLEAR ? 1.0 : 0.1);
    this.sunMesh.visible = activePrecip === WEATHER_TYPES.CLEAR;
    this.moonMesh.visible = activePrecip === WEATHER_TYPES.CLEAR;

    this.ambientLight.intensity = 0.25 + this.skyState.brightness * 0.55;
    this.ambientLight.color.copy(this.skyState.lightTint);
    this.sunLight.intensity = Math.max(0.08, dayFactor * 0.85 * stormDim);
    this.sunLight.position.copy(playerPos).addScaledVector(this.skyState.sunDir, 60);
    this.sunLight.target.position.copy(playerPos);
    this.sunLight.target.updateMatrixWorld();

    // Update drifting 3D voxel clouds wrapped around player
    this._cloudOffset += dt * 1.4;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      let relX = ((c.ox + this._cloudOffset - playerPos.x) % 260);
      if (relX > 130) relX -= 260;
      if (relX < -130) relX += 260;

      let relZ = ((c.oz - playerPos.z) % 260);
      if (relZ > 130) relZ -= 260;
      if (relZ < -130) relZ += 260;

      dummy.position.set(playerPos.x + relX, c.oy, playerPos.z + relZ);
      dummy.scale.set(c.w, 3.2, c.d);
      dummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, dummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    const cloudBright = THREE.MathUtils.lerp(0.18, 0.98, dayFactor) * stormDim;
    this.cloudMat.color.setRGB(
      cloudBright * this.skyState.lightTint.r,
      cloudBright * this.skyState.lightTint.g,
      cloudBright * this.skyState.lightTint.b
    );

    // Update rain / snow particles around player
    this.rainLines.visible = activePrecip === WEATHER_TYPES.RAIN;
    this.snowPoints.visible = activePrecip === WEATHER_TYPES.SNOW;

    if (activePrecip === WEATHER_TYPES.RAIN) {
      const arr = this.rainLines.geometry.attributes.position.array;
      for (let i = 0; i < this._precipDrops.length; i++) {
        const d = this._precipDrops[i];
        d.oy -= dt * 24.0 * d.speed;
        if (d.oy < -10) d.oy += 28;
        const wx = playerPos.x + d.ox;
        const wy = playerPos.y + d.oy;
        const wz = playerPos.z + d.oz;
        const idx = i * 6;
        arr[idx] = wx;
        arr[idx + 1] = wy;
        arr[idx + 2] = wz;
        arr[idx + 3] = wx - 0.08;
        arr[idx + 4] = wy + 0.95;
        arr[idx + 5] = wz;
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    } else if (activePrecip === WEATHER_TYPES.SNOW) {
      const arr = this.snowPoints.geometry.attributes.position.array;
      const now = performance.now() * 0.001;
      for (let i = 0; i < this._precipDrops.length; i++) {
        const d = this._precipDrops[i];
        d.oy -= dt * 3.4 * d.speed;
        if (d.oy < -10) d.oy += 26;
        const drift = Math.sin(now * 1.6 + d.phase) * 0.7;
        const idx = i * 3;
        arr[idx] = playerPos.x + d.ox + drift;
        arr[idx + 1] = playerPos.y + d.oy;
        arr[idx + 2] = playerPos.z + d.oz + Math.cos(now * 1.3 + d.phase) * 0.7;
      }
      this.snowPoints.geometry.attributes.position.needsUpdate = true;
    }
  }
}

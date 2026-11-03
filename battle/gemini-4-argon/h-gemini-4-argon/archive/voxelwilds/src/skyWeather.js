import * as THREE from 'three';
import { DAY_DURATION_SECONDS } from './constants.js';

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 0.85 + 0.15, 0.0, 1.0);
    float curve = pow(h, 0.58);
    vec3 col = mix(uHorizon, uZenith, curve);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class SkyWeatherSystem {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;

    // 0.0 = midnight, 0.25 = 6:00 AM, 0.50 = 12:00 PM, 0.75 = 6:00 PM
    this.timeOfDay = 0.30; // Start at bright scenic ~7:15 AM morning
    this.dayCount = 1;
    this.timePaused = false;

    this.weatherMode = 'clear'; // 'clear' | 'rain'
    this.weatherIntensity = 0;
    this.weatherTimer = 140; // seconds until next natural weather roll

    // Sky group anchored to player X,Z
    this.skyGroup = new THREE.Group();
    this.scene.add(this.skyGroup);

    // 1. Gradient Sky Dome
    this.skyUniforms = {
      uZenith: { value: new THREE.Color(0x4a9eff) },
      uHorizon: { value: new THREE.Color(0xbbe0ff) },
    };
    const domeGeom = new THREE.SphereGeometry(260, 24, 16);
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.domeMesh = new THREE.Mesh(domeGeom, domeMat);
    this.domeMesh.renderOrder = -20;
    this.skyGroup.add(this.domeMesh);

    // 2. Starfield Dome
    const starPositions = [];
    for (let i = 0; i < 380; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.08);
      const r = 235;
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
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeom, this.starMat);
    this.stars.renderOrder = -18;
    this.skyGroup.add(this.stars);

    // 3. Orbiting Voxel Sun & Moon
    this.celestialPivot = new THREE.Group();
    this.skyGroup.add(this.celestialPivot);

    const sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff7c2, side: THREE.DoubleSide, depthWrite: false })
    );
    const sunGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 38),
      new THREE.MeshBasicMaterial({
        color: 0xffb84d,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    sunGlow.position.z = -0.2;
    sunGroup.add(sunGlow, sunCore);
    sunGroup.position.set(0, 210, 0);
    sunGroup.rotation.x = Math.PI / 2;
    this.celestialPivot.add(sunGroup);

    const moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 19),
      new THREE.MeshBasicMaterial({ color: 0xdce9ff, side: THREE.DoubleSide, depthWrite: false })
    );
    moonMesh.position.set(0, -210, 0);
    moonMesh.rotation.x = Math.PI / 2;
    this.celestialPivot.add(moonMesh);

    // 4. Drifting 3D Voxel Cloud Layer
    this.cloudCount = 42;
    const cloudGeom = new THREE.BoxGeometry(1, 1, 1);
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.84,
    });
    this.cloudMesh = new THREE.InstancedMesh(cloudGeom, this.cloudMat, this.cloudCount);
    this.cloudMesh.frustumCulled = false;
    this.scene.add(this.cloudMesh);

    this.clouds = [];
    this.cloudDummy = new THREE.Object3D();
    for (let i = 0; i < this.cloudCount; i++) {
      this.clouds.push({
        ox: (Math.random() - 0.5) * 260,
        oz: (Math.random() - 0.5) * 260,
        y: 94 + (i % 3) * 2.5,
        sx: 14 + Math.floor(Math.random() * 18),
        sz: 10 + Math.floor(Math.random() * 14),
      });
    }

    // 5. Standard Three.js Lights for 3D entities (Mobs, Drops, Held Rig)
    this.hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x5c6e4c, 0.78);
    this.dirLight = new THREE.DirectionalLight(0xfff5e0, 0.92);
    this.dirLight.position.set(40, 80, 30);
    this.scene.add(this.hemiLight, this.dirLight);

    // Reusable colors
    this.cZenith = new THREE.Color();
    this.cHorizon = new THREE.Color();
    this.cTint = new THREE.Color();
  }

  setWeather(mode) {
    this.weatherMode = mode === 'rain' ? 'rain' : 'clear';
    this.weatherTimer = 120 + Math.random() * 120;
  }

  toggleWeather() {
    this.setWeather(this.weatherMode === 'rain' ? 'clear' : 'rain');
    return this.weatherMode;
  }

  isNight() {
    return this.timeOfDay < 0.22 || this.timeOfDay > 0.78;
  }

  getFormattedClock() {
    const totalMinutes = Math.floor(this.timeOfDay * 24 * 60);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `Day ${this.dayCount} • ${h12}:${String(mins).padStart(2, '0')} ${suffix}`;
  }

  update(dt, elapsed, playerPos, isUnderwater = false, renderDistance = 5) {
    if (!this.timePaused) {
      this.timeOfDay += dt / DAY_DURATION_SECONDS;
      if (this.timeOfDay >= 1.0) {
        this.timeOfDay -= 1.0;
        this.dayCount++;
      }
    }

    // Natural weather cycle
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherMode = Math.random() < 0.24 ? 'rain' : 'clear';
      this.weatherTimer = 110 + Math.random() * 140;
    }

    const targetWeather = this.weatherMode === 'rain' ? 1.0 : 0.0;
    this.weatherIntensity += (targetWeather - this.weatherIntensity) * Math.min(1, dt * 0.8);

    // Keep sky dome centered on camera
    this.skyGroup.position.set(playerPos.x, 0, playerPos.z);

    // Orbit angle: timeOfDay=0.5 -> noon (+Y = 0 rad), timeOfDay=0 -> midnight (PI rad)
    const sunAngle = (this.timeOfDay - 0.5) * Math.PI * 2;
    this.celestialPivot.rotation.z = sunAngle;
    this.stars.rotation.z = sunAngle * 0.5;

    const sunElev = Math.cos(sunAngle); // +1 at noon, 0 at sunrise/sunset, -1 at midnight

    // Compute smooth atmospheric palette
    const dayWeight = THREE.MathUtils.smoothstep(sunElev, -0.16, 0.28);
    const twilightWeight = Math.max(0, 1 - Math.abs(sunElev + 0.02) / 0.26);

    const dayZenith = new THREE.Color(0x4396fa);
    const dayHorizon = new THREE.Color(0xbce0ff);
    const duskZenith = new THREE.Color(0x38366e);
    const duskHorizon = new THREE.Color(0xf28d4b);
    const nightZenith = new THREE.Color(0x060b1a);
    const nightHorizon = new THREE.Color(0x13203d);

    this.cZenith.copy(nightZenith).lerp(dayZenith, dayWeight).lerp(duskZenith, twilightWeight * 0.65);
    this.cHorizon.copy(nightHorizon).lerp(dayHorizon, dayWeight).lerp(duskHorizon, twilightWeight * 0.85);

    // Overcast storm darkening
    if (this.weatherIntensity > 0.01) {
      const stormZenith = new THREE.Color(0x3a4859).multiplyScalar(0.35 + dayWeight * 0.65);
      const stormHorizon = new THREE.Color(0x637385).multiplyScalar(0.35 + dayWeight * 0.65);
      this.cZenith.lerp(stormZenith, this.weatherIntensity * 0.72);
      this.cHorizon.lerp(stormHorizon, this.weatherIntensity * 0.72);
    }

    this.skyUniforms.uZenith.value.copy(this.cZenith);
    this.skyUniforms.uHorizon.value.copy(this.cHorizon);

    // Stars visibility
    const starAlpha = (1 - dayWeight) * (1 - this.weatherIntensity * 0.9);
    this.starMat.opacity = Math.max(0, starAlpha * 0.9);

    // Sun brightness & tint for voxel shader
    let sunBrightness = 0.16 + dayWeight * 0.84;
    sunBrightness *= 1 - this.weatherIntensity * 0.24;

    const dayTint = new THREE.Color(1.0, 0.99, 0.96);
    const nightTint = new THREE.Color(0.56, 0.68, 0.98);
    const duskTint = new THREE.Color(1.0, 0.78, 0.62);
    this.cTint.copy(nightTint).lerp(dayTint, dayWeight).lerp(duskTint, twilightWeight * 0.55);

    const uniforms = this.materials.sharedUniforms;
    uniforms.uTime.value = elapsed;
    uniforms.uSunBrightness.value = sunBrightness;
    uniforms.uSkyTint.value.copy(this.cTint);

    const normalFogFar = (renderDistance + 0.5) * 16;
    if (isUnderwater) {
      const aqua = new THREE.Color(0x124d82).multiplyScalar(0.35 + dayWeight * 0.65);
      uniforms.uFogColor.value.copy(aqua);
      uniforms.uFogNear.value = 1.5;
      uniforms.uFogFar.value = 24.0;
      this.skyUniforms.uHorizon.value.copy(aqua);
      this.skyUniforms.uZenith.value.copy(aqua);
    } else {
      uniforms.uFogColor.value.copy(this.cHorizon);
      const rainPull = 1 - this.weatherIntensity * 0.22;
      uniforms.uFogNear.value = normalFogFar * 0.52 * rainPull;
      uniforms.uFogFar.value = normalFogFar * rainPull;
    }

    // Update Three.js entity lights
    this.hemiLight.intensity = 0.26 + dayWeight * 0.58;
    this.dirLight.intensity = 0.12 + dayWeight * 0.85;
    this.dirLight.color.copy(this.cTint);
    this.dirLight.position.set(
      playerPos.x - Math.sin(sunAngle) * 70,
      Math.max(15, sunElev * 90),
      playerPos.z + 30
    );

    // Update drifting 3D voxel clouds wrapped smoothly around player
    this.cloudMat.color.copy(this.cHorizon).lerp(new THREE.Color(0xffffff), dayWeight * 0.7);
    for (let i = 0; i < this.cloudCount; i++) {
      const c = this.clouds[i];
      let dx = ((c.ox + elapsed * 1.35 - playerPos.x) % 260 + 260) % 260 - 130;
      let dz = ((c.oz - playerPos.z) % 260 + 260) % 260 - 130;
      this.cloudDummy.position.set(playerPos.x + dx, c.y, playerPos.z + dz);
      this.cloudDummy.scale.set(c.sx, 3.2, c.sz);
      this.cloudDummy.updateMatrix();
      this.cloudMesh.setMatrixAt(i, this.cloudDummy.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.skyGroup, this.cloudMesh, this.hemiLight, this.dirLight);
  }
}

import * as THREE from 'three';

export class SkyWeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 0.22; // Start in crisp morning-noon sunlight
    this.dayLengthSeconds = 360; // 6-minute full day-night cycle
    this.dayCount = 1;
    this.timePaused = false;
    this.weather = 'clear'; // 'clear' | 'rain' | 'snow'

    // Lights
    this.hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x566844, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e0, 1.15);
    this.sunLight.position.set(40, 80, 30);
    this.scene.add(this.sunLight);

    // Fog
    this.fogColor = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(this.fogColor, 0.014);
    this.scene.background = this.fogColor.clone();

    // Celestial Group (follows player XZ)
    this.celestialGroup = new THREE.Group();
    this.scene.add(this.celestialGroup);

    // Sun Mesh
    const sunGeo = new THREE.BoxGeometry(10, 10, 10);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffef8a, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.celestialGroup.add(this.sunMesh);

    // Moon Mesh
    const moonGeo = new THREE.BoxGeometry(8, 8, 8);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdbe9ff, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.celestialGroup.add(this.moonMesh);

    // Starfield
    this.starsMesh = this._createStarfield();
    this.celestialGroup.add(this.starsMesh);

    // Drifting 3D Voxel Clouds
    this.cloudGroup = new THREE.Group();
    this._createClouds();
    this.scene.add(this.cloudGroup);

    // Weather Precipitation
    this.precipGroup = new THREE.Group();
    this.scene.add(this.precipGroup);
    this._initPrecipitation();
  }

  _createStarfield() {
    const starPositions = [];
    for (let i = 0; i < 320; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48; // Upper hemisphere
      const r = 135;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) + 10,
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    return new THREE.Points(geo, mat);
  }

  _createClouds() {
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
    });
    this.clouds = [];
    for (let i = 0; i < 22; i++) {
      const w = 10 + Math.floor(Math.random() * 14);
      const d = 8 + Math.floor(Math.random() * 12);
      const geo = new THREE.BoxGeometry(w, 2.5, d);
      const mesh = new THREE.Mesh(geo, this.cloudMat);
      mesh.position.set(
        (Math.random() - 0.5) * 180,
        56 + (i % 3) * 1.5,
        (Math.random() - 0.5) * 180
      );
      this.cloudGroup.add(mesh);
      this.clouds.push(mesh);
    }
  }

  _initPrecipitation() {
    const count = 450;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 28;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    this.precipGeo = new THREE.BufferGeometry();
    this.precipGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.precipMat = new THREE.PointsMaterial({
      color: 0xaad4ff,
      size: 0.28,
      transparent: true,
      opacity: 0.75,
    });
    this.precipPoints = new THREE.Points(this.precipGeo, this.precipMat);
    this.precipPoints.visible = false;
    this.precipGroup.add(this.precipPoints);
  }

  setWeather(mode) {
    this.weather = mode;
    if (mode === 'clear') {
      this.precipPoints.visible = false;
    } else {
      this.precipPoints.visible = true;
      this.precipMat.color.setHex(mode === 'snow' ? 0xffffff : 0x90c2ff);
      this.precipMat.size = mode === 'snow' ? 0.36 : 0.24;
    }
  }

  getPhaseLabel() {
    const t = this.timeOfDay;
    if (t >= 0.92 || t < 0.08) return 'Sunrise';
    if (t >= 0.08 && t < 0.42) return 'Daylight';
    if (t >= 0.42 && t < 0.58) return 'Sunset';
    return 'Night';
  }

  isNight() {
    return this.timeOfDay >= 0.55 && this.timeOfDay < 0.93;
  }

  update(dt, playerPos, renderDistance = 4) {
    if (!this.timePaused) {
      this.timeOfDay += dt / this.dayLengthSeconds;
      if (this.timeOfDay >= 1.0) {
        this.timeOfDay -= 1.0;
        this.dayCount += 1;
      }
    }

    // Orbit angle: timeOfDay = 0.25 -> Noon (angle = PI/2)
    const angle = this.timeOfDay * Math.PI * 2;
    const sunElev = Math.sin(angle); // +1 at 0.25 (noon), -1 at 0.75 (midnight)
    const sunHoriz = Math.cos(angle);

    this.celestialGroup.position.set(playerPos.x, 0, playerPos.z);

    const orbitRadius = 115;
    this.sunMesh.position.set(sunHoriz * orbitRadius, sunElev * orbitRadius + 20, -25);
    this.moonMesh.position.set(-sunHoriz * orbitRadius, -sunElev * orbitRadius + 20, 25);

    this.sunLight.position.set(
      playerPos.x + sunHoriz * 65,
      Math.max(12, Math.abs(sunElev) * 85 + 15),
      playerPos.z - 25
    );

    // Sky Palette interpolation
    const daySky = new THREE.Color(0x7ec0ee);
    const duskSky = new THREE.Color(0xe88554);
    const nightSky = new THREE.Color(0x0b1021);
    const rainSky = new THREE.Color(0x526378);

    let targetSky;
    if (sunElev > 0.2) {
      targetSky = daySky.clone();
    } else if (sunElev > -0.18) {
      const t = (sunElev + 0.18) / 0.38;
      targetSky = nightSky.clone().lerp(duskSky, Math.sin(t * Math.PI)).lerp(daySky, Math.max(0, (t - 0.4) / 0.6));
    } else {
      targetSky = nightSky.clone();
    }

    if (this.weather !== 'clear') {
      targetSky.lerp(rainSky, 0.55);
    }

    this.fogColor.copy(targetSky);
    this.scene.background.copy(targetSky);
    this.scene.fog.color.copy(targetSky);
    this.scene.fog.density = Math.max(0.008, 0.052 / (renderDistance * 2.5));

    // Ambient & Sun Intensity
    const dayFactor = Math.max(0, Math.min(1, (sunElev + 0.15) / 0.75));
    const weatherDim = this.weather === 'clear' ? 1.0 : 0.72;
    this.hemiLight.intensity = (0.28 + dayFactor * 0.62) * weatherDim;
    this.sunLight.intensity = (0.18 + dayFactor * 0.98) * weatherDim;

    // Starfield opacity at night
    this.starsMesh.material.opacity = this.weather === 'clear' ? Math.max(0, Math.min(0.95, -sunElev * 1.4)) : 0;

    // Cloud color & drifting
    const cloudBrightness = 0.25 + dayFactor * 0.75;
    this.cloudMat.color.setRGB(cloudBrightness, cloudBrightness, Math.min(1, cloudBrightness + 0.04));

    for (const cloud of this.clouds) {
      cloud.position.x += dt * 1.6;
      if (cloud.position.x - playerPos.x > 95) cloud.position.x -= 190;
      if (cloud.position.x - playerPos.x < -95) cloud.position.x += 190;
      if (cloud.position.z - playerPos.z > 95) cloud.position.z -= 190;
      if (cloud.position.z - playerPos.z < -95) cloud.position.z += 190;
    }

    // Precipitation update
    if (this.precipPoints.visible) {
      this.precipGroup.position.set(playerPos.x, Math.max(20, playerPos.y - 8), playerPos.z);
      const posAttr = this.precipGeo.getAttribute('position');
      const arr = posAttr.array;
      const fallSpeed = this.weather === 'snow' ? 4.2 : 18.5;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fallSpeed * dt;
        if (this.weather === 'snow') {
          arr[i] += Math.sin(dt * 3 + i) * 0.03;
        }
        if (arr[i + 1] < 0) {
          arr[i + 1] = 28;
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}

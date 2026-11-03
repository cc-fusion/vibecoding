// Sky: day/night cycle, sun/moon/stars, clouds, weather, lightning, torch lights.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, mulberry32 } from './noise.js';

export const DAY_LENGTH = 600; // seconds per full day

const DAY_SKY = new THREE.Color(0x7ec3ea);
const NIGHT_SKY = new THREE.Color(0x0a1024);
const DUSK_SKY = new THREE.Color(0xf29a5c);
const RAIN_SKY = new THREE.Color(0x6e7d8a);

export class Sky {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.time = 0.08; // dawn-ish start (0 = 6:00)
    this.day = 1;
    this.weather = 'clear';
    this.weatherTimer = 90 + Math.random() * 120;
    this.precip = 0;          // eased intensity 0..1
    this.precipType = 'rain'; // set from biome
    this.flash = 0;
    this.thunderTimer = 15;

    // lights
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.7);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.castShadow = !!opts.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 320;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x8899cc, 0.0);
    scene.add(this.moon);
    scene.add(this.moon.target);

    // celestial group follows camera
    this.celestial = new THREE.Group();
    scene.add(this.celestial);
    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, fog: false, transparent: true, opacity: 0.95 })
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({ color: 0xdfe6f0, fog: false, transparent: true, opacity: 0.9 })
    );
    this.celestial.add(this.sunMesh, this.moonMesh);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    const rand = mulberry32(2024);
    for (let i = 0; i < 700; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 2 - 1);
      const r = 420;
      starPos.push(r * Math.sin(phi) * Math.cos(theta), Math.abs(r * Math.cos(phi)), r * Math.sin(phi) * Math.sin(theta));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0,
    }));
    this.celestial.add(this.stars);

    // clouds
    this.cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false });
    const crand = mulberry32(777);
    this.clouds = [];
    for (let i = 0; i < 34; i++) {
      const w = 14 + crand() * 26, d = 10 + crand() * 20;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), cloudMat);
      mesh.position.set((crand() - 0.5) * 480, 112 + crand() * 8, (crand() - 0.5) * 480);
      this.cloudGroup.add(mesh);
      this.clouds.push(mesh);
    }
    scene.add(this.cloudGroup);
    this.cloudMat = cloudMat;

    // rain: line segments
    const rainCount = 700;
    const rainPos = new Float32Array(rainCount * 6);
    this.rainDrops = [];
    for (let i = 0; i < rainCount; i++) {
      this.rainDrops.push({ x: 0, y: Math.random() * 30, z: 0, init: false });
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({
      color: 0x9db8d8, transparent: true, opacity: 0,
    }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    // snow: points
    const snowCount = 600;
    const snowPos = new Float32Array(snowCount * 3);
    this.snowFlakes = [];
    for (let i = 0; i < snowCount; i++) this.snowFlakes.push({ x: 0, y: Math.random() * 30, z: 0, phase: Math.random() * 10, init: false });
    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    this.snow = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.14, transparent: true, opacity: 0,
    }));
    this.snow.frustumCulled = false;
    scene.add(this.snow);

    // torch light pool
    this.torchLights = [];
    for (let i = 0; i < 10; i++) {
      const l = new THREE.PointLight(0xffa050, 0, 13, 1.8);
      scene.add(l);
      this.torchLights.push(l);
    }
    this.torchTimer = 0;

    this.fogColor = new THREE.Color();
    scene.fog = new THREE.Fog(0x7ec3ea, 40, 120);
  }

  get elevation() { return Math.sin(this.time * Math.PI * 2); }
  get daylight() { return smoothstep(-0.1, 0.18, this.elevation); }
  get isNight() { return this.elevation < -0.08; }

  clockString() {
    const hours = (this.time * 24 + 6) % 24;
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt, camera, playerPos, { coldBiome = false, underwater = false, renderDist = 5, hooks = {} } = {}) {
    // time
    const prevTime = this.time;
    this.time += dt / DAY_LENGTH;
    if (this.time >= 1) { this.time -= 1; this.day++; hooks.newDay?.(this.day); }

    // weather state machine
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather === 'clear') {
        this.weather = 'precip';
        this.weatherTimer = 60 + Math.random() * 90;
        hooks.weatherStart?.(coldBiome ? 'snow' : 'rain');
      } else {
        this.weather = 'clear';
        this.weatherTimer = 150 + Math.random() * 240;
        hooks.weatherEnd?.();
      }
    }
    this.precipType = coldBiome ? 'snow' : 'rain';
    const target = this.weather === 'precip' ? 1 : 0;
    this.precip += (target - this.precip) * Math.min(1, dt * 0.5);

    const dl = this.daylight;
    const dusk = Math.max(0, 1 - Math.abs(this.elevation) * 5) * (this.elevation > -0.15 ? 1 : 0);

    // sky & fog colors
    const sky = NIGHT_SKY.clone().lerp(DAY_SKY, dl);
    sky.lerp(DUSK_SKY, dusk * 0.55);
    sky.lerp(RAIN_SKY, this.precip * 0.55 * dl);
    if (this.flash > 0) sky.lerp(new THREE.Color(0xffffff), this.flash * 0.6);
    this.scene.background = this.scene.background || new THREE.Color();
    this.scene.background.copy(sky);

    const fog = this.scene.fog;
    if (underwater) {
      fog.color.setHex(0x1a4a8a).multiplyScalar(0.4 + dl * 0.6);
      fog.near = 2; fog.far = 26;
    } else {
      fog.color.copy(sky);
      const far = renderDist * 16 - 8;
      fog.near = far * (this.precip > 0.4 ? 0.3 : 0.45);
      fog.far = far * (1 - this.precip * 0.3);
    }

    // sun & moon
    const ang = this.time * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.28).normalize();
    this.celestial.position.copy(camera.position);
    this.sunMesh.position.copy(sunDir).multiplyScalar(380);
    this.sunMesh.lookAt(camera.position);
    this.moonMesh.position.copy(sunDir).multiplyScalar(-380);
    this.moonMesh.lookAt(camera.position);
    this.sunMesh.material.color.setHex(0xffe9a0).lerp(new THREE.Color(0xff8a3c), dusk);
    this.stars.material.opacity = (1 - dl) * 0.9;
    this.stars.rotation.z = ang;

    const px = Math.round(playerPos.x), pz = Math.round(playerPos.z);
    this.sun.position.set(px + sunDir.x * 140, Math.max(20, sunDir.y * 140), pz + sunDir.z * 140);
    this.sun.target.position.set(px, 40, pz);
    this.sun.intensity = (0.1 + dl * 1.25) * (1 - this.precip * 0.55) + this.flash * 2;
    this.sun.color.setHex(0xffffff).lerp(new THREE.Color(0xffb070), dusk * 0.8);
    this.moon.position.set(px - sunDir.x * 140, Math.max(20, -sunDir.y * 140), pz - sunDir.z * 140);
    this.moon.target.position.set(px, 40, pz);
    this.moon.intensity = (1 - dl) * 0.16;
    this.hemi.intensity = 0.22 + dl * 0.55 + this.flash;
    this.hemi.color.setHex(0xbfd8ff).lerp(new THREE.Color(0x22304d), 1 - dl);

    // clouds
    this.cloudMat.opacity = 0.65 + this.precip * 0.25;
    this.cloudMat.color.setScalar(0.5 + dl * 0.5 - this.precip * 0.25);
    for (const c of this.clouds) {
      c.position.x += dt * 1.6;
      if (c.position.x - camera.position.x > 260) c.position.x -= 520;
      if (c.position.x - camera.position.x < -260) c.position.x += 520;
      if (c.position.z - camera.position.z > 260) c.position.z -= 520;
      if (c.position.z - camera.position.z < -260) c.position.z += 520;
    }

    // precipitation particles around camera
    this.updatePrecip(dt, camera, coldBiome);

    // lightning
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.weather === 'precip' && this.precipType === 'rain' && this.precip > 0.7) {
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 18 + Math.random() * 30;
        this.flash = 1;
        hooks.thunder?.();
      }
    }
  }

  updatePrecip(dt, camera, cold) {
    const showRain = this.precip > 0.02 && !cold;
    const showSnow = this.precip > 0.02 && cold;
    this.rain.material.opacity = showRain ? this.precip * 0.4 : 0;
    this.snow.material.opacity = showSnow ? this.precip * 0.9 : 0;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;

    if (showRain) {
      const arr = this.rainGeo.attributes.position.array;
      for (let i = 0; i < this.rainDrops.length; i++) {
        const d = this.rainDrops[i];
        if (!d.init || Math.abs(d.x - cx) > 24 || Math.abs(d.z - cz) > 24) {
          d.x = cx + (Math.random() - 0.5) * 44;
          d.z = cz + (Math.random() - 0.5) * 44;
          d.y = cy + Math.random() * 26;
          d.init = true;
        }
        d.y -= dt * 27;
        if (d.y < cy - 8) { d.y = cy + 20 + Math.random() * 8; d.x = cx + (Math.random() - 0.5) * 44; d.z = cz + (Math.random() - 0.5) * 44; }
        arr[i * 6] = d.x; arr[i * 6 + 1] = d.y; arr[i * 6 + 2] = d.z;
        arr[i * 6 + 3] = d.x + 0.05; arr[i * 6 + 4] = d.y + 0.7; arr[i * 6 + 5] = d.z;
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    }
    if (showSnow) {
      const arr = this.snowGeo.attributes.position.array;
      for (let i = 0; i < this.snowFlakes.length; i++) {
        const f = this.snowFlakes[i];
        if (!f.init || Math.abs(f.x - cx) > 24 || Math.abs(f.z - cz) > 24) {
          f.x = cx + (Math.random() - 0.5) * 44;
          f.z = cz + (Math.random() - 0.5) * 44;
          f.y = cy + Math.random() * 24;
          f.init = true;
        }
        f.phase += dt;
        f.y -= dt * 2.2;
        f.x += Math.sin(f.phase * 1.5) * dt * 0.8;
        if (f.y < cy - 8) { f.y = cy + 18 + Math.random() * 6; f.x = cx + (Math.random() - 0.5) * 44; f.z = cz + (Math.random() - 0.5) * 44; }
        arr[i * 3] = f.x; arr[i * 3 + 1] = f.y; arr[i * 3 + 2] = f.z;
      }
      this.snowGeo.attributes.position.needsUpdate = true;
    }
  }

  updateTorches(dt, lights, camera) {
    this.torchTimer -= dt;
    if (this.torchTimer <= 0) {
      this.torchTimer = 0.4;
      const sorted = lights
        .map((p) => ({ p, d: (p[0] - camera.position.x) ** 2 + (p[1] - camera.position.y) ** 2 + (p[2] - camera.position.z) ** 2 }))
        .filter((o) => o.d < 32 * 32)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.torchLights.length);
      this.torchLights.forEach((l, i) => {
        if (sorted[i]) {
          l.position.set(sorted[i].p[0], sorted[i].p[1], sorted[i].p[2]);
          l.userData.on = true;
        } else l.userData.on = false;
      });
    }
    const flicker = 0.85 + Math.sin(performance.now() * 0.02) * 0.08 + Math.random() * 0.07;
    for (const l of this.torchLights) {
      const target = l.userData.on ? 14 * flicker : 0;
      l.intensity += (target - l.intensity) * Math.min(1, dt * 10);
    }
  }

  serialize() { return { time: this.time, day: this.day, weather: this.weather, weatherTimer: this.weatherTimer }; }
  deserialize(d) {
    if (!d) return;
    this.time = d.time ?? 0.08; this.day = d.day ?? 1;
    this.weather = d.weather || 'clear'; this.weatherTimer = d.weatherTimer ?? 120;
  }
}
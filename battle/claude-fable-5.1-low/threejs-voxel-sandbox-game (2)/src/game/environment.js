import * as THREE from 'three';

export const DAY_LENGTH = 900; // seconds per full day

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = `varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunGlow;
void main(){ float h = clamp(vDir.y, -0.1, 1.0); float t = pow(1.0 - max(h,0.0), 3.0);
  vec3 col = mix(top, horizon, t);
  float s = max(dot(vDir, sunDir), 0.0);
  col += sunColor * pow(s, 24.0) * sunGlow * 0.6 + sunColor * pow(s, 4.0) * sunGlow * 0.18 * (1.0 - h);
  if (vDir.y < 0.0) col = mix(col, horizon * 0.8, clamp(-vDir.y * 4.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0); }`;

const C = (h) => new THREE.Color(h);
const PAL = {
  dayTop: C(0x3f8ed8), dayHor: C(0xbcd8f0), nightTop: C(0x050812), nightHor: C(0x101a30),
  dawnHor: C(0xf0a060), dawnTop: C(0x5070a8), rainTop: C(0x4a5563), rainHor: C(0x8a949c), nightRainHor: C(0x0b0f18),
};

export class Environment {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio;
    this.time = 0.3; // start mid-morning
    this.daylight = 1; this.weather = 'clear'; this.weatherTimer = 300 + Math.random() * 400; this.rainLevel = 0; this.raining = false;
    this.thunderFlash = 0; this.nextThunder = 0;
    this.skyColor = new THREE.Color(); this.fogColor = new THREE.Color(); this.sunDir = new THREE.Vector3(0, 1, 0);
    // sky dome
    this.skyMat = new THREE.ShaderMaterial({ uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: this.sunDir }, sunColor: { value: new THREE.Color(1, 0.9, 0.7) }, sunGlow: { value: 1 } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; scene.add(this.sky);
    // sun & moon
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, depthWrite: false })); scene.add(this.sun);
    const moonTex = makeMoonTexture();
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false })); scene.add(this.moon);
    // stars
    const sp = []; for (let i = 0; i < 900; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(450); sp.push(v.x, v.y, v.z); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat); scene.add(this.stars);
    // clouds
    this.cloudTex = makeCloudTexture(); this.cloudTex.wrapS = this.cloudTex.wrapT = THREE.RepeatWrapping; this.cloudTex.repeat.set(6, 6);
    this.cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.cloudMat); this.clouds.rotation.x = -Math.PI / 2; this.clouds.position.y = 128; this.clouds.renderOrder = -5; scene.add(this.clouds);
    // lights (for standard materials: mobs, drops)
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a4a3a, 0.9); scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 0.8); scene.add(this.dir);
    // rain
    const N = 1600; this.rainN = N; this.rainPos = new Float32Array(N * 3); this.rainVel = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.rainPos[i * 3 + 1] = -1000; this.rainVel[i] = 14 + Math.random() * 6; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMat = new THREE.PointsMaterial({ color: 0x9ab8e0, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false });
    this.rain = new THREE.Points(rg, this.rainMat); this.rain.frustumCulled = false; scene.add(this.rain);
    this.rainGroundY = new Float32Array(N);
  }

  get isNight() { return this.daylight < 0.4; }
  clockString() {
    const h = Math.floor(((this.time + 0.25) % 1) * 24), m = Math.floor((((this.time + 0.25) % 1) * 24 - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt, camera, player, world, cold) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    const elev = Math.sin(this.time * Math.PI * 2);
    const sunAngle = this.time * Math.PI * 2;
    this.sunDir.set(Math.cos(sunAngle), Math.sin(sunAngle), 0.25).normalize();
    // weather
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather === 'clear') { this.weather = Math.random() < 0.3 ? 'storm' : 'rain'; this.weatherTimer = 90 + Math.random() * 150; }
      else { this.weather = 'clear'; this.weatherTimer = 400 + Math.random() * 600; }
    }
    this.raining = this.weather !== 'clear';
    this.rainLevel += ((this.raining ? 1 : 0) - this.rainLevel) * Math.min(1, dt * 0.3);
    if (this.weather === 'storm') {
      this.nextThunder -= dt;
      if (this.nextThunder <= 0) { this.nextThunder = 6 + Math.random() * 20; this.thunderFlash = 0.35; this.audio.thunder(); }
    }
    this.thunderFlash = Math.max(0, this.thunderFlash - dt);
    this.audio.setRain(this.rainLevel * (player.underwater ? 0.1 : 1) * (player.sheltered ? 0.35 : 1));
    // daylight
    let dl = THREE.MathUtils.smoothstep(elev, -0.12, 0.22);
    dl = 0.13 + 0.87 * dl;
    dl *= 1 - this.rainLevel * 0.35;
    if (this.thunderFlash > 0.25) dl = 1.2;
    this.daylight = dl;
    // colors
    const dawn = Math.max(0, 1 - Math.abs(elev) / 0.3) * (1 - this.rainLevel);
    const dayAmt = THREE.MathUtils.smoothstep(elev, -0.15, 0.2);
    const top = new THREE.Color().copy(PAL.nightTop).lerp(PAL.dayTop, dayAmt).lerp(PAL.rainTop, this.rainLevel * dayAmt);
    const hor = new THREE.Color().copy(PAL.nightHor).lerp(PAL.dayHor, dayAmt).lerp(PAL.dawnHor, dawn * 0.8).lerp(PAL.rainHor, this.rainLevel * dayAmt).lerp(PAL.nightRainHor, this.rainLevel * (1 - dayAmt));
    top.lerp(PAL.dawnTop, dawn * 0.5);
    if (this.thunderFlash > 0.25) { top.lerp(new THREE.Color(1, 1, 1), 0.6); hor.lerp(new THREE.Color(1, 1, 1), 0.6); }
    this.skyMat.uniforms.top.value.copy(top); this.skyMat.uniforms.horizon.value.copy(hor);
    this.skyMat.uniforms.sunGlow.value = (1 - this.rainLevel * 0.8) * (0.4 + 0.6 * dayAmt);
    this.skyMat.uniforms.sunColor.value.setRGB(1, 0.75 + 0.2 * dayAmt, 0.5 + 0.3 * dayAmt);
    this.skyColor.copy(top); this.fogColor.copy(hor);
    if (player.underwater) this.fogColor.setRGB(0.05, 0.2, 0.45).multiplyScalar(0.3 + 0.7 * dl);
    // positions follow camera
    const cp = camera.position;
    this.sky.position.copy(cp); this.stars.position.copy(cp);
    this.stars.rotation.z = sunAngle * 0.5; this.starMat.opacity = (1 - dayAmt) * (1 - this.rainLevel) * 0.9;
    this.sun.position.copy(cp).addScaledVector(this.sunDir, 420); this.sun.lookAt(cp);
    this.sun.material.opacity = 1 - this.rainLevel * 0.85; this.sun.material.transparent = true;
    this.moon.position.copy(cp).addScaledVector(this.sunDir, -420); this.moon.lookAt(cp);
    this.moon.material.opacity = (1 - dayAmt) * (1 - this.rainLevel * 0.8);
    this.clouds.position.set(cp.x, 128, cp.z);
    this.cloudTex.offset.x += dt * 0.002; this.cloudTex.offset.y += dt * 0.0005;
    const cl = 0.25 + 0.75 * dayAmt * (1 - this.rainLevel * 0.5);
    this.cloudMat.color.setRGB(cl, cl, cl * 1.03); this.cloudMat.opacity = 0.6 + this.rainLevel * 0.35;
    // lights
    this.hemi.intensity = 0.25 + 0.9 * dl; this.hemi.color.copy(hor).lerp(new THREE.Color(1, 1, 1), 0.5);
    this.dir.intensity = 0.9 * dayAmt * (1 - this.rainLevel * 0.6); this.dir.position.copy(cp).addScaledVector(this.sunDir, 100); this.dir.target.position.copy(cp); this.dir.target.updateMatrixWorld();
    this.updateRain(dt, player, world, cold);
  }

  updateRain(dt, player, world, cold) {
    const P = this.rainPos, N = this.rainN;
    const active = Math.floor(this.rainLevel * N);
    const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
    this.rainMat.color.set(cold ? 0xffffff : 0x9ab8e0); this.rainMat.size = cold ? 0.14 : 0.09;
    const speedScale = cold ? 0.18 : 1;
    for (let i = 0; i < N; i++) {
      let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (i >= active) { if (y > -500) P[i * 3 + 1] = -1000; continue; }
      if (y < -500 || y < this.rainGroundY[i] || Math.abs(x - px) > 22 || Math.abs(z - pz) > 22) {
        x = px + (Math.random() - 0.5) * 40; z = pz + (Math.random() - 0.5) * 40;
        const bx = Math.floor(x), bz = Math.floor(z);
        if (!world.isLoaded(bx, bz)) { P[i * 3 + 1] = -1000; continue; }
        const topY = world.topY(bx, bz);
        this.rainGroundY[i] = topY + 1;
        y = Math.max(py, topY) + 12 + Math.random() * 14;
        if (y - topY > 60) { P[i * 3 + 1] = -1000; continue; }
      }
      y -= this.rainVel[i] * speedScale * dt;
      if (cold) { x += Math.sin(y * 0.5 + i) * dt * 0.5; }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.visible = active > 0;
  }
  serialize() { return { time: this.time, weather: this.weather, weatherTimer: this.weatherTimer }; }
  load(d) { if (!d) return; this.time = d.time ?? this.time; this.weather = d.weather || 'clear'; this.weatherTimer = d.weatherTimer ?? 300; this.rainLevel = this.weather === 'clear' ? 0 : 1; }
}

function makeCloudTexture() {
  const s = 256; const c = document.createElement('canvas'); c.width = c.height = s; const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s); const d = img.data;
  // value noise clouds
  const grid = 16, g = []; for (let i = 0; i < (grid + 1) * (grid + 1); i++) g.push(Math.random());
  const val = (x, y) => { const gx = x / s * grid, gy = y / s * grid; const x0 = Math.floor(gx) % grid, y0 = Math.floor(gy) % grid; const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy); const sm = t => t * t * (3 - 2 * t); const a = g[y0 * (grid + 1) + x0], b = g[y0 * (grid + 1) + (x0 + 1) % grid], c2 = g[((y0 + 1) % grid) * (grid + 1) + x0], d2 = g[((y0 + 1) % grid) * (grid + 1) + (x0 + 1) % grid]; return a + (b - a) * sm(fx) + (c2 - a) * sm(fy) + (a - b - c2 + d2) * sm(fx) * sm(fy); };
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const n = (val(x, y) + 0.5 * val(x * 2 % s, y * 2 % s) + 0.25 * val(x * 4 % s, y * 4 % s)) / 1.75;
    const a = n > 0.55 ? 255 : 0; const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  // pixelate for a blocky look
  const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = false; x2.drawImage(c, 0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c2); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t;
}
function makeMoonTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16; const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8e8f0'; ctx.fillRect(2, 2, 12, 12); ctx.fillStyle = '#c0c0cc'; ctx.fillRect(4, 5, 3, 3); ctx.fillRect(9, 8, 2, 3); ctx.fillRect(6, 10, 2, 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
}

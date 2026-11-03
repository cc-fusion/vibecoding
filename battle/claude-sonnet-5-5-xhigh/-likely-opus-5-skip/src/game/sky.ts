// Sky dome, sun/moon, stars, flat clouds, and weather (rain / snow / thunder).
import * as THREE from 'three';
import { U } from './chunks';
import { makeCelestial, makeCloudTexture } from './textures';
import type { World } from './world';
import { smoothstep } from './noise';

const mixA = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const DAY_Z = [0.28, 0.5, 0.93], DAY_H = [0.74, 0.86, 1.0], NIGHT_Z = [0.01, 0.018, 0.06], NIGHT_H = [0.03, 0.045, 0.11];
const DUSK_H = [0.98, 0.55, 0.3], DUSK_Z = [0.2, 0.26, 0.5];
export const CLOUD_Y = 136;

export class Sky {
  group = new THREE.Group();
  sunDir = new THREE.Vector3(0, 1, 0);
  fogColor = new THREE.Color(0.7, 0.85, 1);
  daylight = 1;
  private dome: THREE.Mesh;
  private du = { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uGlow: { value: 0 } };
  private sun: THREE.Mesh; private moon: THREE.Mesh;
  private stars: THREE.Points; private starMat: THREE.PointsMaterial;
  private clouds: THREE.Mesh;
  private cu = { map: { value: null as THREE.Texture | null }, uOffset: { value: new THREE.Vector2() }, uCover: { value: 0.5 }, uColor: { value: new THREE.Color(1, 1, 1) }, uFogColor: U.uFogColor };
  private tmp = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.du, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform float uGlow;
        void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          col += vec3(1.0, 0.6, 0.3) * pow(sd, 5.0) * uGlow * (1.0 - h * 0.7);
          gl_FragColor = vec4(col, 1.0); }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), domeMat);
    this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    this.group.add(this.dome);
    const mk = (kind: 'sun' | 'moon', size: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: makeCelestial(kind), transparent: true, depthWrite: false, fog: false, blending: kind === 'sun' ? THREE.AdditiveBlending : THREE.NormalBlending }));
      m.renderOrder = -9; m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    this.sun = mk('sun', 90); this.moon = mk('moon', 60);
    const sp = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      sp[i * 3] = Math.cos(a) * r * 380; sp[i * 3 + 1] = u * 380; sp[i * 3 + 2] = Math.sin(a) * r * 380;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = -9; this.stars.frustumCulled = false;
    this.group.add(this.stars);
    this.cu.map.value = makeCloudTexture();
    const cm = new THREE.ShaderMaterial({
      uniforms: this.cu, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform sampler2D map; uniform vec2 uOffset; uniform float uCover; uniform vec3 uColor; uniform vec3 uFogColor; varying vec3 vW;
        void main(){ float n = texture2D(map, (vW.xz + uOffset) / 1536.0).r;
          if (n > uCover) discard;
          float d = length(vW.xz - cameraPosition.xz);
          float a = 1.0 - smoothstep(380.0, 700.0, d);
          vec3 c = uColor * (gl_FrontFacing ? 1.0 : 0.72);
          c = mix(c, uFogColor, smoothstep(250.0, 700.0, d) * 0.6);
          gl_FragColor = vec4(c, a * 0.92); }`,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), cm);
    this.clouds.renderOrder = -5; this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
    scene.add(this.group);
  }

  update(t: number, rain: number, cam: THREE.Camera, time: number, cloudsOn: boolean) {
    const a = t * Math.PI * 2;
    this.sunDir.set(Math.cos(a), Math.sin(a), 0.25).normalize();
    const sh = this.sunDir.y;
    const day = smoothstep(-0.14, 0.22, sh);
    this.daylight = day;
    const dusk = Math.exp(-Math.pow(sh / 0.22, 2)) * (0.25 + 0.75 * Math.min(1, day * 3 + 0.4)) * (1 - rain * 0.6);
    let z = mixA(NIGHT_Z, DAY_Z, day), h = mixA(NIGHT_H, DAY_H, day);
    h = mixA(h, DUSK_H, dusk * 0.85); z = mixA(z, DUSK_Z, dusk * 0.45);
    if (rain > 0) {
      const g = (0.34 + 0.4 * day);
      z = mixA(z, [g * 0.85, g * 0.88, g * 0.95], rain * 0.85);
      h = mixA(h, [g, g * 1.02, g * 1.08], rain * 0.9);
    }
    this.du.uZenith.value.setRGB(z[0], z[1], z[2]);
    this.du.uHorizon.value.setRGB(h[0], h[1], h[2]);
    this.du.uSunDir.value.copy(this.sunDir);
    this.du.uGlow.value = dusk * 0.9 + day * 0.15;
    this.fogColor.setRGB(h[0], h[1], h[2]);
    U.uSun.value = (0.5 + 0.5 * day) * (1 - 0.2 * rain);
    const warm = dusk * 0.5;
    U.uSkyTint.value.setRGB((0.62 + 0.38 * day) * (1 + warm * 0.1), (0.72 + 0.28 * day) * (1 - warm * 0.15), (1.0) * (1 - warm * 0.4));
    this.starMat.opacity = Math.pow(1 - day, 2) * (1 - rain);
    this.group.position.copy(cam.position);
    this.sun.position.copy(this.sunDir).multiplyScalar(340); this.sun.lookAt(cam.position);
    this.moon.position.copy(this.sunDir).multiplyScalar(-340); this.moon.lookAt(cam.position);
    this.sun.visible = sh > -0.2; this.moon.visible = sh < 0.2;
    (this.sun.material as THREE.MeshBasicMaterial).opacity = 1 - rain * 0.85;
    (this.moon.material as THREE.MeshBasicMaterial).opacity = 1 - rain * 0.85;
    this.stars.rotation.z = a; this.stars.rotation.y = 0.6;
    this.clouds.visible = cloudsOn;
    this.clouds.position.set(0, CLOUD_Y - cam.position.y, 0);
    this.cu.uOffset.value.set(time * 1.6, time * 0.6);
    this.cu.uCover.value = 0.5 + rain * 0.24;
    const cd = this.tmp.setRGB(0.12, 0.14, 0.22).lerp(new THREE.Color(1, 1, 1), day).lerp(new THREE.Color(1.0, 0.72, 0.55), dusk * 0.5);
    cd.multiplyScalar(1 - rain * 0.45);
    this.cu.uColor.value.copy(cd);
  }
}

export class Weather {
  rain = 0; target = 0; timer = 300 + Math.random() * 300; thunder = false; flash = 0; nextBolt = 10; snowy = false;
  group = new THREE.Group();
  private N = 700;
  private dx = new Float32Array(700); private dz = new Float32Array(700); private dy = new Float32Array(700);
  private rainGeo = new THREE.BufferGeometry(); private rainPos = new Float32Array(700 * 6);
  private snowGeo = new THREE.BufferGeometry(); private snowPos = new Float32Array(700 * 3);
  private rainMesh: THREE.LineSegments; private snowMesh: THREE.Points;
  onBolt: (() => void) | null = null;
  onSplash: ((x: number, y: number, z: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < this.N; i++) { this.dx[i] = (Math.random() * 2 - 1) * 16; this.dz[i] = (Math.random() * 2 - 1) * 16; this.dy[i] = Math.random() * 24 - 8; }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.rainMesh = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xaac4ff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.snowMesh = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
    this.rainMesh.frustumCulled = false; this.snowMesh.frustumCulled = false;
    this.group.add(this.rainMesh, this.snowMesh);
    scene.add(this.group);
  }

  set(kind: 'clear' | 'rain' | 'thunder') {
    if (kind === 'clear') { this.target = 0; this.thunder = false; this.timer = 500 + Math.random() * 500; }
    else { this.target = 1; this.thunder = kind === 'thunder'; this.timer = 150 + Math.random() * 200; }
  }

  update(dt: number, px: number, py: number, pz: number, world: World | null, cold: boolean) {
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.target === 0) this.set(Math.random() < 0.3 ? 'thunder' : 'rain');
      else this.set('clear');
    }
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), dt * 0.1);
    this.snowy = cold;
    this.flash = Math.max(0, this.flash - dt * 2.4);
    if (this.thunder && this.rain > 0.7) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = 8 + Math.random() * 18; this.onBolt?.(); }
    }
    const active = this.rain > 0.02;
    this.rainMesh.visible = active && !cold; this.snowMesh.visible = active && cold;
    if (!active || !world) return;
    const n = Math.floor(this.N * Math.min(1, this.rain));
    const speed = cold ? 2.6 : 24, t = performance.now() * 0.001;
    for (let i = 0; i < this.N; i++) {
      if (i >= n) { this.rainPos.fill(0, i * 6, i * 6 + 6); this.snowPos[i * 3 + 1] = -1000; this.rainPos[i * 6 + 1] = -1000; this.rainPos[i * 6 + 4] = -1000; continue; }
      let y = this.dy[i] - speed * dt;
      let x = px + this.dx[i], z = pz + this.dz[i];
      const hm = world.heightAt(Math.floor(x), Math.floor(z));
      if (y < py - 10 || y < hm + 1) {
        if (!cold && y < hm + 1 && y > py - 10 && Math.random() < 0.15) this.onSplash?.(x, hm + 1.05, z);
        y = py + 12 + Math.random() * 6;
        this.dx[i] = (Math.random() * 2 - 1) * 16; this.dz[i] = (Math.random() * 2 - 1) * 16;
        x = px + this.dx[i]; z = pz + this.dz[i];
      }
      this.dy[i] = y;
      const hm2 = world.heightAt(Math.floor(x), Math.floor(z));
      const hidden = y < hm2 + 1 && hm2 >= 0;
      if (cold) { this.snowPos[i * 3] = x + Math.sin(t + i) * 0.4; this.snowPos[i * 3 + 1] = hidden ? -1000 : y; this.snowPos[i * 3 + 2] = z + Math.cos(t * 0.8 + i) * 0.4; }
      else {
        const o = i * 6, yy = hidden ? -1000 : y;
        this.rainPos[o] = x; this.rainPos[o + 1] = yy; this.rainPos[o + 2] = z;
        this.rainPos[o + 3] = x - 0.08; this.rainPos[o + 4] = hidden ? -1000 : y + 0.9; this.rainPos[o + 5] = z;
      }
    }
    (cold ? this.snowGeo : this.rainGeo).attributes.position.needsUpdate = true;
  }
}

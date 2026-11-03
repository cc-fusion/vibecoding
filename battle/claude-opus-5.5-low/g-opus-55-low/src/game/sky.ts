import * as THREE from 'three';
import { mulberry32 } from './noise';

const lerpC = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
const C = (h: string) => new THREE.Color(h);

const DAY_TOP = C('#5a9bff'), DAY_HOR = C('#bcd8ff');
const SET_TOP = C('#4a5d9a'), SET_HOR = C('#ff9a5a');
const NIGHT_TOP = C('#03050c'), NIGHT_HOR = C('#0b1224');
const RAIN_TOP = C('#5c6470'), RAIN_HOR = C('#8a929c');

export class Sky {
  group = new THREE.Group();
  dome: THREE.Mesh;
  sun: THREE.Mesh; moon: THREE.Mesh; stars: THREE.Points;
  clouds: THREE.Mesh;
  rain: THREE.LineSegments; snow: THREE.Points;
  rainPos: Float32Array; snowPos: Float32Array;
  horizon = new THREE.Color(); top = new THREE.Color();
  sunDir = new THREE.Vector3();
  sunLevel = 1;
  flash = 0;
  private domeMat: THREE.ShaderMaterial;
  private RN = 1600; private SN = 1400;

  constructor(scene: THREE.Scene) {
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: new THREE.Color() } },
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 glow; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y,-0.2,1.0); vec3 c = mix(hor, top, pow(max(h,0.0),0.55));
          if (h < 0.0) c = mix(hor, hor*0.6, -h*4.0);
          float s = max(dot(normalize(vDir), sunDir),0.0); c += glow * pow(s,8.0) * 0.6;
          gl_FragColor = vec4(c,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), this.domeMat);
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    const disc = (draw: (c: CanvasRenderingContext2D) => void, size: number) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      draw(cv.getContext('2d')!);
      const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.renderOrder = -9;
      return m;
    };
    this.sun = disc((c) => {
      const g = c.createRadialGradient(16, 16, 4, 16, 16, 16); g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(1, 'rgba(255,200,100,0)');
      c.fillStyle = g; c.fillRect(0, 0, 32, 32); c.fillStyle = '#fffbe0'; c.fillRect(9, 9, 14, 14);
    }, 70);
    this.moon = disc((c) => {
      c.fillStyle = '#dfe6f5'; c.fillRect(10, 10, 12, 12);
      c.fillStyle = '#aeb6c8'; c.fillRect(12, 13, 3, 3); c.fillRect(17, 17, 2, 2); c.fillRect(18, 11, 2, 2);
    }, 40);
    this.group.add(this.sun, this.moon);

    const r = mulberry32(42);
    const sp: number[] = [];
    for (let i = 0; i < 1200; i++) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(380);
      if (v.y < -40) continue; sp.push(v.x, v.y, v.z);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    this.stars.renderOrder = -9;
    this.group.add(this.stars);
    scene.add(this.group);

    // blocky clouds
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cc = cv.getContext('2d')!;
    const rr = mulberry32(7);
    const grid = new Uint8Array(128 * 128);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rr() * 128), y = Math.floor(rr() * 128), w = 3 + Math.floor(rr() * 10), h = 2 + Math.floor(rr() * 7);
      for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) grid[((y + b) % 128) * 128 + ((x + a) % 128)] = 1;
    }
    for (let i = 0; i < grid.length; i++) if (grid[i]) { cc.fillStyle = 'rgba(255,255,255,0.85)'; cc.fillRect(i % 128, Math.floor(i / 128), 1, 1); }
    const ct = new THREE.CanvasTexture(cv); ct.magFilter = THREE.NearestFilter; ct.minFilter = THREE.NearestFilter;
    ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(3, 3);
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.8 }));
    this.clouds.rotation.x = -Math.PI / 2;
    scene.add(this.clouds);

    // precipitation
    this.rainPos = new Float32Array(this.RN * 6);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xa8c0e8, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false;
    this.snowPos = new Float32Array(this.SN * 3);
    const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.9 }));
    this.snow.frustumCulled = false;
    for (let i = 0; i < this.RN; i++) this.rainPos[i * 6 + 1] = -999;
    scene.add(this.rain, this.snow);
  }

  update(time: number, cam: THREE.Vector3, rain: number, dt: number, heightAt: (x: number, z: number) => number, snowy: boolean, underwater: boolean) {
    const ang = time * Math.PI * 2;
    this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    const sh = this.sunDir.y;
    this.sunLevel = THREE.MathUtils.clamp(sh * 3 + 0.35, 0.16, 1) * (1 - rain * 0.35);
    const dayT = THREE.MathUtils.clamp(sh * 4 + 0.4, 0, 1);
    const setT = Math.max(0, 1 - Math.abs(sh) * 5);
    let top = lerpC(NIGHT_TOP, DAY_TOP, dayT), hor = lerpC(NIGHT_HOR, DAY_HOR, dayT);
    if (this.sunDir.x > -0.2) { top = lerpC(top, SET_TOP, setT * 0.5); hor = lerpC(hor, SET_HOR, setT * 0.8); }
    else { hor = lerpC(hor, C('#c2674a'), setT * 0.5); }
    top = lerpC(top, RAIN_TOP.clone().multiplyScalar(0.25 + dayT * 0.75), rain * 0.85);
    hor = lerpC(hor, RAIN_HOR.clone().multiplyScalar(0.2 + dayT * 0.8), rain * 0.85);
    if (this.flash > 0) { this.flash -= dt; const f = Math.max(0, this.flash) * 2; top.lerp(C('#ffffff'), f); hor.lerp(C('#ffffff'), f); }
    if (underwater) { hor = C('#1a3c78').multiplyScalar(0.3 + dayT * 0.7); top = hor.clone(); }
    this.top.copy(top); this.horizon.copy(hor);
    this.domeMat.uniforms.top.value.copy(top);
    this.domeMat.uniforms.hor.value.copy(hor);
    this.domeMat.uniforms.sunDir.value.copy(this.sunDir);
    this.domeMat.uniforms.glow.value.copy(C('#ffb070').multiplyScalar(setT * (1 - rain)));
    this.group.position.copy(cam);
    this.sun.position.copy(this.sunDir).multiplyScalar(350); this.sun.lookAt(cam.clone().sub(this.group.position).add(new THREE.Vector3(0, 0, 0)));
    this.sun.lookAt(new THREE.Vector3(0, 0, 0).add(this.group.position));
    this.moon.position.copy(this.sunDir).multiplyScalar(-350); this.moon.lookAt(this.group.position);
    (this.sun.material as THREE.MeshBasicMaterial).opacity = 1 - rain;
    (this.moon.material as THREE.MeshBasicMaterial).opacity = 1 - rain;
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - dayT * 1.6) * (1 - rain);
    // clouds
    const cm = this.clouds.material as THREE.MeshBasicMaterial;
    cm.color.copy(lerpC(C('#20242e'), C('#ffffff'), dayT)).lerp(C('#8a9099'), rain * 0.6);
    cm.opacity = 0.75 + rain * 0.2;
    this.clouds.position.set(cam.x, 118, cam.z);
    const tex = cm.map!;
    tex.offset.x = (cam.x / 1500) * 3 + time * 8; tex.offset.y = -(cam.z / 1500) * 3;

    // precipitation
    const showRain = rain > 0.02 && !snowy, showSnow = rain > 0.02 && snowy;
    this.rain.visible = showRain; this.snow.visible = showSnow;
    const R = 22;
    if (showRain) {
      const active = Math.floor(this.RN * rain);
      const p = this.rainPos;
      for (let i = 0; i < this.RN; i++) {
        const o = i * 6;
        if (i >= active) { p[o + 1] = p[o + 4] = -999; continue; }
        let x = p[o], y = p[o + 1], z = p[o + 2];
        y -= dt * 28;
        if (y < cam.y - 14 || Math.abs(x - cam.x) > R || Math.abs(z - cam.z) > R || y < -100) {
          x = cam.x + (Math.random() * 2 - 1) * R; z = cam.z + (Math.random() * 2 - 1) * R; y = cam.y + 8 + Math.random() * 14;
        }
        const ground = heightAt(Math.floor(x), Math.floor(z));
        const vis = y > ground + 1;
        p[o] = x; p[o + 1] = vis ? y : y; p[o + 2] = z;
        p[o + 3] = x + 0.05; p[o + 4] = vis ? y + 0.7 : y; p[o + 5] = z;
        if (!vis) { p[o + 1] = -999; p[o + 4] = -999; p[o] = cam.x + 9999; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      (this.rain.material as THREE.LineBasicMaterial).color.copy(C('#a8c0e8').multiplyScalar(0.3 + dayT * 0.7));
    }
    if (showSnow) {
      const active = Math.floor(this.SN * rain);
      const p = this.snowPos;
      for (let i = 0; i < this.SN; i++) {
        const o = i * 3;
        if (i >= active) { p[o + 1] = -999; continue; }
        let x = p[o], y = p[o + 1], z = p[o + 2];
        y -= dt * 2.2; x += Math.sin(y * 0.8 + i) * dt * 0.6;
        if (y < cam.y - 12 || Math.abs(x - cam.x) > R || Math.abs(z - cam.z) > R || y < -100) {
          x = cam.x + (Math.random() * 2 - 1) * R; z = cam.z + (Math.random() * 2 - 1) * R; y = cam.y + 4 + Math.random() * 14;
        }
        p[o] = x; p[o + 1] = y; p[o + 2] = z;
        if (y < heightAt(Math.floor(x), Math.floor(z)) + 1) { p[o + 1] = cam.y + 14; }
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}

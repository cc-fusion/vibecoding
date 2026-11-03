// Day/night cycle, sky dome, sun/moon, clouds and weather.
import * as THREE from "three";
import { getUniforms } from "./materials";
import { clamp, lerp, smoothstep, mulberry32 } from "./noise";
import type { World } from "./world";

export type Weather = "clear" | "rain" | "storm";

export class Sky {
  group = new THREE.Group();
  time = 0.05; // 0..1, 0 = 06:00
  dayLength = 600; // seconds per full day
  sun = 1;
  weather: Weather = "clear";
  weatherIntensity = 0;
  weatherTimer = 240 + Math.random() * 300;
  flash = 0;
  lightningTimer = 0;
  onThunder: ((dist: number) => void) | null = null;
  skyColor = new THREE.Color();
  horizonColor = new THREE.Color();
  fogColor = new THREE.Color();
  sunDir = new THREE.Vector3(0, 1, 0);
  private dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private clouds: THREE.Mesh;
  private cloudTex: THREE.CanvasTexture;
  private precip: THREE.Points;
  private precipPos: Float32Array;
  private precipMat: THREE.PointsMaterial;
  private PRECIP = 1400;
  private cloudMat: THREE.MeshBasicMaterial;

  constructor(private scene: THREE.Scene, private world: World) {
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() },
        uSunGlow: { value: new THREE.Color() },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){ vDir = normalize(position); vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunGlow; uniform float uNight; uniform float uTime;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          if (d.y < 0.0) col = mix(uHorizon, uZenith * 0.6, clamp(-d.y * 3.0, 0.0, 1.0));
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunGlow * (pow(sd, 8.0) * 0.5 + pow(sd, 48.0) * 0.8);
          // stars
          if (uNight > 0.01 && d.y > 0.0) {
            vec3 g = floor(d * 90.0);
            float s = hash(g);
            float star = step(0.985, s) * (0.5 + 0.5 * sin(uTime * 2.0 + s * 60.0));
            col += vec3(star) * uNight * smoothstep(0.0, 0.3, d.y);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const sunTex = makeDiscTexture([255, 240, 180], true);
    const moonTex = makeDiscTexture([220, 225, 240], false);
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.sunMesh.renderOrder = -9;
    this.moonMesh.renderOrder = -9;
    this.sunMesh.frustumCulled = false;
    this.moonMesh.frustumCulled = false;
    this.group.add(this.sunMesh, this.moonMesh);

    // Clouds
    this.cloudTex = makeCloudTexture();
    this.cloudMat = new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 150;
    this.clouds.renderOrder = -5;
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);

    // Precipitation
    this.precipPos = new Float32Array(this.PRECIP * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.precipPos, 3));
    this.precipMat = new THREE.PointsMaterial({ color: 0x9fb8d8, size: 0.12, transparent: true, opacity: 0.0, depthWrite: false, sizeAttenuation: true, fog: true });
    this.precip = new THREE.Points(g, this.precipMat);
    this.precip.frustumCulled = false;
    this.precip.visible = false;
    this.group.add(this.precip);
    scene.add(this.group);
    scene.fog = new THREE.Fog(0xffffff, 80, 140);
  }

  get hours(): number {
    return (this.time * 24 + 6) % 24;
  }
  get isNight(): boolean {
    return this.sun < 0.3;
  }

  skipToMorning() {
    this.time = Math.ceil(this.time) + 0.01;
  }

  setWeather(w: Weather) {
    this.weather = w;
    this.weatherTimer = w === "clear" ? 300 + Math.random() * 400 : 90 + Math.random() * 150;
  }

  update(dt: number, cam: THREE.Vector3, renderDistance: number, cold: boolean, underwater: boolean, renderer: THREE.WebGLRenderer, dry = false) {
    this.time = (this.time + dt / this.dayLength) % 1;
    // weather state machine
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather === "clear") this.setWeather(Math.random() < 0.3 ? "storm" : "rain");
      else this.setWeather("clear");
    }
    const targetI = this.weather === "clear" ? 0 : this.weather === "storm" ? 1 : 0.6;
    this.weatherIntensity += (targetI - this.weatherIntensity) * Math.min(1, dt * 0.15);
    const wi = this.weatherIntensity;
    // lightning
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.weather === "storm" && wi > 0.6) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 4 + Math.random() * 14;
        this.flash = 1;
        this.onThunder?.(Math.random());
      }
    }

    const a = this.time * Math.PI * 2;
    const sinA = Math.sin(a);
    this.sunDir.set(Math.cos(a), sinA, 0.25).normalize();
    const dayF = smoothstep(-0.1, 0.3, sinA);
    const sunsetF = (1 - smoothstep(0, 0.35, Math.abs(sinA))) * (sinA > -0.25 ? 1 : 0);
    const night = 1 - dayF;
    const sunLight = smoothstep(-0.15, 0.3, sinA);
    this.sun = Math.max(sunLight, 0.1) * (1 - wi * 0.45) + this.flash * 0.6;

    const dayZ = new THREE.Color(0.33, 0.56, 0.93), dayH = new THREE.Color(0.72, 0.84, 0.97);
    const nightZ = new THREE.Color(0.012, 0.02, 0.06), nightH = new THREE.Color(0.05, 0.07, 0.14);
    const setH = new THREE.Color(0.98, 0.5, 0.25), setZ = new THREE.Color(0.3, 0.3, 0.6);
    this.skyColor.copy(nightZ).lerp(dayZ, dayF).lerp(setZ, sunsetF * 0.5);
    this.horizonColor.copy(nightH).lerp(dayH, dayF).lerp(setH, sunsetF * 0.85);
    // weather graying
    const gray = new THREE.Color(0.45, 0.48, 0.55).multiplyScalar(dayF * 0.9 + 0.1);
    this.skyColor.lerp(gray, wi * 0.8);
    this.horizonColor.lerp(gray.clone().multiplyScalar(1.15), wi * 0.8);
    if (this.flash > 0) {
      this.skyColor.lerp(new THREE.Color(0.9, 0.9, 1), this.flash * 0.7);
      this.horizonColor.lerp(new THREE.Color(0.9, 0.9, 1), this.flash * 0.7);
    }
    this.fogColor.copy(this.horizonColor);
    const u = getUniforms();
    const sunColor = new THREE.Color(1, 1, 1).lerp(new THREE.Color(1, 0.7, 0.45), sunsetF * 0.6).lerp(new THREE.Color(0.55, 0.65, 1.0), night * 0.9).lerp(new THREE.Color(0.8, 0.85, 0.95), wi * 0.5);
    u.uSun.value = this.sun;
    u.uSunColor.value.copy(sunColor);
    u.uFogColor.value.copy(this.fogColor);
    const far = renderDistance * 16;
    u.uFogNear.value = far * (0.55 - wi * 0.25);
    u.uFogFar.value = far * (0.95 - wi * 0.3);
    u.uUnderwater.value = underwater ? 1 : 0;
    if (underwater) u.uFogColor.value.setRGB(0.05, 0.2, 0.45).multiplyScalar(Math.max(this.sun, 0.15));
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(u.uFogColor.value);
    fog.near = underwater ? 2 : u.uFogNear.value;
    fog.far = underwater ? 24 : u.uFogFar.value;
    renderer.setClearColor(u.uFogColor.value);

    // dome
    this.domeMat.uniforms.uZenith.value.copy(this.skyColor);
    this.domeMat.uniforms.uHorizon.value.copy(this.horizonColor);
    this.domeMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.domeMat.uniforms.uSunGlow.value.setRGB(1, 0.75, 0.45).multiplyScalar((0.5 + sunsetF) * (1 - wi * 0.8) * smoothstep(-0.3, 0.0, sinA));
    this.domeMat.uniforms.uNight.value = night * (1 - wi * 0.9);
    this.domeMat.uniforms.uTime.value += dt;
    this.dome.position.copy(cam);
    this.dome.visible = !underwater;

    // sun & moon
    const sd = 9.5;
    this.sunMesh.position.copy(cam).addScaledVector(this.sunDir, sd);
    this.sunMesh.scale.setScalar(1.3);
    this.sunMesh.lookAt(cam);
    (this.sunMesh.material as THREE.MeshBasicMaterial).opacity = (1 - wi * 0.9) * smoothstep(-0.15, 0.05, sinA);
    this.moonMesh.position.copy(cam).addScaledVector(this.sunDir, -sd);
    this.moonMesh.scale.setScalar(0.9);
    this.moonMesh.lookAt(cam);
    (this.moonMesh.material as THREE.MeshBasicMaterial).opacity = (1 - wi * 0.9) * smoothstep(0.15, -0.05, sinA);
    this.sunMesh.visible = !underwater;
    this.moonMesh.visible = !underwater;

    // clouds
    this.clouds.position.set(cam.x, 150, cam.z);
    const windT = performance.now() / 1000;
    this.cloudTex.offset.set((cam.x + windT * 1.2) / 1200, -(cam.z + windT * 0.4) / 1200);
    this.cloudMat.color.copy(sunColor).multiplyScalar(lerp(0.12, 1.0, dayF) * (1 - wi * 0.5) + this.flash * 0.5);
    this.cloudMat.opacity = 0.85 * (1 - wi * 0.3);
    this.clouds.visible = !underwater;

    // precipitation
    if (wi > 0.05 && !dry && !underwater) {
      this.precip.visible = true;
      this.precipMat.opacity = clamp(wi, 0, 1) * (cold ? 0.9 : 0.55);
      this.precipMat.color.setHex(cold ? 0xffffff : 0x9fb8d8);
      this.precipMat.size = cold ? 0.18 : 0.1;
      const pos = this.precipPos;
      const speed = cold ? 2.5 : 18;
      const R = 22;
      for (let i = 0; i < this.PRECIP; i++) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        if (x === 0 && y === 0 && z === 0) {
          x = cam.x + (Math.random() - 0.5) * R * 2;
          z = cam.z + (Math.random() - 0.5) * R * 2;
          y = cam.y - 8 + Math.random() * 30;
        }
        y -= speed * dt * (0.8 + ((i * 7) % 10) / 20);
        if (cold) {
          x += Math.sin(windT + i) * dt * 0.6;
          z += Math.cos(windT * 0.7 + i) * dt * 0.6;
        }
        const surf = this.world.getSurfaceY(Math.floor(x), Math.floor(z));
        if (y < surf + 1 || y < cam.y - 12 || Math.abs(x - cam.x) > R || Math.abs(z - cam.z) > R) {
          x = cam.x + (Math.random() - 0.5) * R * 2;
          z = cam.z + (Math.random() - 0.5) * R * 2;
          y = cam.y + 10 + Math.random() * 14;
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      (this.precip.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    } else {
      this.precip.visible = false;
    }
  }

  serialize() {
    return { time: this.time, weather: this.weather, weatherTimer: this.weatherTimer };
  }
  load(d: { time?: number; weather?: Weather; weatherTimer?: number } | undefined) {
    if (!d) return;
    if (typeof d.time === "number") this.time = d.time;
    if (d.weather) this.weather = d.weather;
    if (typeof d.weatherTimer === "number") this.weatherTimer = d.weatherTimer;
    this.weatherIntensity = this.weather === "clear" ? 0 : this.weather === "storm" ? 1 : 0.6;
  }
}

function makeDiscTexture(color: [number, number, number], square: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  if (square) {
    const g = ctx.createRadialGradient(32, 32, 10, 32, 32, 32);
    g.addColorStop(0, `rgba(${color.join(",")},1)`);
    g.addColorStop(0.6, `rgba(${color.join(",")},0.9)`);
    g.addColorStop(1, `rgba(${color.join(",")},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = `rgb(${color.join(",")})`;
    ctx.fillRect(18, 18, 28, 28);
  } else {
    ctx.fillStyle = `rgb(${color.join(",")})`;
    ctx.fillRect(18, 18, 28, 28);
    ctx.fillStyle = "rgba(150,155,175,1)";
    ctx.fillRect(24, 22, 6, 6);
    ctx.fillRect(34, 32, 8, 6);
    ctx.fillRect(22, 36, 5, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

function makeCloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(99);
  const img = ctx.createImageData(size, size);
  // value noise cells
  const cells = 32;
  const grid = new Float32Array((cells + 1) * (cells + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const val = (x: number, y: number) => {
    const gx = (x / size) * cells, gy = (y / size) * cells;
    const x0 = Math.floor(gx) % cells, y0 = Math.floor(gy) % cells;
    const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
    const g = (xx: number, yy: number) => grid[(yy % cells) * (cells + 1) + (xx % cells)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(g(x0, y0), g(x0 + 1, y0), sx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), sx), sy);
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = val(x, y) * 0.6 + val((x * 2) % size, (y * 2) % size) * 0.4;
      const cloud = v > 0.56 ? 1 : 0;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = cloud * 255;
    }
  // pixelate (blocky clouds)
  ctx.putImageData(img, 0, 0);
  const small = document.createElement("canvas");
  small.width = small.height = 64;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(c, 0, 0, 64, 64);
  const t = new THREE.CanvasTexture(small);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

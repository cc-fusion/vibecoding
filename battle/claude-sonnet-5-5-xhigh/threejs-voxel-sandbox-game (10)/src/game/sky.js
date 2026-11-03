// Sky dome (gradient, square sun & moon, stars), voxel clouds and day/night parameter blending.
import * as THREE from 'three';
import { Simplex, smoothstep, clamp } from './noise.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.9999;
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uGlow;
uniform float uStars;
uniform float uTime;
uniform float uSunAngle;
uniform float uCover;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
  if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.85, clamp(-d.y * 4.0, 0.0, 1.0));
  // sunrise / sunset glow around the sun
  float sd = dot(d, uSunDir);
  col += uGlow * pow(max(sd, 0.0), 6.0) * (1.0 - h * 0.6);
  vec3 t1 = normalize(cross(uSunDir, vec3(0.0, 0.0, 1.0)));
  vec3 t2 = cross(uSunDir, t1);
  float vis = 1.0 - uCover;
  if (sd > 0.0) {
    vec2 p = vec2(dot(d, t1), dot(d, t2)) / sd;
    float m = max(abs(p.x), abs(p.y));
    if (m < 0.085) col = mix(col, vec3(1.0, 0.96, 0.78), vis);
    else col += vec3(1.0, 0.85, 0.5) * 0.35 * smoothstep(0.30, 0.085, m) * vis * 0.7;
  }
  if (sd < 0.0) {
    vec2 p = vec2(dot(d, t1), dot(d, t2)) / (-sd);
    float m = max(abs(p.x), abs(p.y));
    if (m < 0.06) {
      float c = hash(vec3(floor(p * 40.0), 3.0));
      vec3 moon = vec3(0.92, 0.94, 1.0) * (0.82 + 0.18 * step(0.5, c));
      col = mix(col, moon, vis);
    }
  }
  // stars (rotate with the sky)
  float ca = cos(uSunAngle), sa = sin(uSunAngle);
  vec3 sdir = vec3(d.x * ca + d.y * sa, -d.x * sa + d.y * ca, d.z);
  vec3 cell = floor(sdir * 110.0);
  float s = hash(cell);
  if (s > 0.9965 && d.y > 0.02) {
    float tw = 0.65 + 0.35 * sin(uTime * 2.0 + s * 200.0);
    col += vec3(0.9, 0.95, 1.0) * tw * uStars * vis;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const CLOUD_VERT = /* glsl */`
attribute float aShade;
varying float vShade;
varying float vDist;
void main() {
  vShade = aShade;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDist = length(wp.xz - cameraPosition.xz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const CLOUD_FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor;
uniform vec3 uFog;
uniform float uFadeA;
uniform float uFadeB;
uniform float uOpacity;
varying float vShade;
varying float vDist;
void main() {
  float f = smoothstep(uFadeA, uFadeB, vDist);
  vec3 c = mix(uColor * vShade, uFog, f * 0.85);
  gl_FragColor = vec4(c, uOpacity * (1.0 - smoothstep(uFadeB * 0.8, uFadeB, vDist)));
}`;

const C = (r, g, b) => new THREE.Color(r, g, b);
const DAY_Z = C(0.36, 0.56, 0.95), DAY_H = C(0.74, 0.85, 1.0);
const DUSK_Z = C(0.28, 0.32, 0.6), DUSK_H = C(1.0, 0.6, 0.38);
const NIGHT_Z = C(0.012, 0.02, 0.07), NIGHT_H = C(0.04, 0.06, 0.14);
const RAIN_Z = C(0.34, 0.37, 0.42), RAIN_H = C(0.5, 0.53, 0.58);

export class Sky {
  constructor(scene, shared, seed = 1) {
    this.shared = shared;
    this.scene = scene;
    const geo = new THREE.SphereGeometry(400, 24, 16);
    this.skyUniforms = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uGlow: { value: new THREE.Color() },
      uStars: { value: 0 }, uTime: { value: 0 }, uSunAngle: { value: 0 }, uCover: { value: 0 },
    };
    this.dome = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.noise = new Simplex(seed + 77);
    this.cloudsOn = true;
    this.cloudUniforms = {
      uColor: { value: new THREE.Color(1, 1, 1) }, uFog: { value: new THREE.Color() },
      uFadeA: { value: 150 }, uFadeB: { value: 300 }, uOpacity: { value: 0.88 },
    };
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    this.cloudMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.cloudMat);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.renderOrder = -50;
    scene.add(this.cloudMesh);
    this.cloudScroll = 0;
    this.cloudKey = '';
    this.cloudY = 122;

    // outputs
    this.daylight = 1;       // 0..1 sun above horizon
    this.sunElev = 1;
    this.skyBright = 1;
    this.horizon = new THREE.Color();
    this.zenith = new THREE.Color();
    this.sunDir = new THREE.Vector3();
    this.isNight = false;
  }

  buildClouds(camX, camZ) {
    const CELL = 12, N = 22;
    const ccx = Math.floor(camX / CELL), ccz = Math.floor(camZ / CELL);
    const scrollCell = Math.floor(this.cloudScroll / CELL);
    const key = ccx + ',' + ccz + ',' + scrollCell;
    if (key === this.cloudKey) return;
    this.cloudKey = key;
    const pos = [], shade = [], idx = [];
    const filled = new Uint8Array((2 * N + 2) * (2 * N + 2));
    const W = 2 * N + 2;
    const val = (gx, gz) => {
      const wx = ccx + gx - scrollCell, wz = ccz + gz;
      return this.noise.noise2(wx * 0.11, wz * 0.11) * 0.7 + this.noise.noise2(wx * 0.27 + 40, wz * 0.27) * 0.3 > 0.12 ? 1 : 0;
    };
    for (let gx = -N - 1; gx <= N; gx++) for (let gz = -N - 1; gz <= N; gz++) filled[(gx + N + 1) * W + gz + N + 1] = val(gx, gz);
    const at = (gx, gz) => (gx < -N - 1 || gx > N || gz < -N - 1 || gz > N ? 0 : filled[(gx + N + 1) * W + gz + N + 1]);
    const H = 4;
    const quad = (a, b, c, d, s) => {
      const i = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      shade.push(s, s, s, s);
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    for (let gx = -N; gx < N; gx++) for (let gz = -N; gz < N; gz++) {
      if (!at(gx, gz)) continue;
      const x0 = gx * CELL, x1 = x0 + CELL, z0 = gz * CELL, z1 = z0 + CELL;
      quad([x0, H, z0], [x0, H, z1], [x1, H, z1], [x1, H, z0], 1.0);
      quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], 0.7);
      if (!at(gx + 1, gz)) quad([x1, 0, z0], [x1, H, z0], [x1, H, z1], [x1, 0, z1], 0.86);
      if (!at(gx - 1, gz)) quad([x0, 0, z1], [x0, H, z1], [x0, H, z0], [x0, 0, z0], 0.86);
      if (!at(gx, gz + 1)) quad([x1, 0, z1], [x1, H, z1], [x0, H, z1], [x0, 0, z1], 0.8);
      if (!at(gx, gz - 1)) quad([x0, 0, z0], [x0, H, z0], [x1, H, z0], [x1, 0, z0], 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aShade', new THREE.Float32BufferAttribute(shade, 1));
    g.setIndex(idx);
    this.cloudMesh.geometry.dispose();
    this.cloudMesh.geometry = g;
  }

  // t: 0..1 time of day (0 = sunrise). weather: {rain 0..1, thunder 0..1}
  update(t, cam, weather, dt, renderDist, time) {
    const a = t * Math.PI * 2;
    const sd = this.sunDir.set(Math.cos(a), Math.sin(a), 0.22).normalize();
    const e = sd.y;
    this.sunElev = e;
    const dayW = smoothstep(0.02, 0.38, e);
    const nightW = 1 - smoothstep(-0.3, -0.02, e);
    const duskW = Math.max(0, 1 - dayW - nightW);
    const sum = dayW + nightW + duskW || 1;
    const rain = weather.rain;
    const Z = this.zenith.setRGB(0, 0, 0), Hc = this.horizon.setRGB(0, 0, 0);
    Z.r = (DAY_Z.r * dayW + DUSK_Z.r * duskW + NIGHT_Z.r * nightW) / sum;
    Z.g = (DAY_Z.g * dayW + DUSK_Z.g * duskW + NIGHT_Z.g * nightW) / sum;
    Z.b = (DAY_Z.b * dayW + DUSK_Z.b * duskW + NIGHT_Z.b * nightW) / sum;
    Hc.r = (DAY_H.r * dayW + DUSK_H.r * duskW + NIGHT_H.r * nightW) / sum;
    Hc.g = (DAY_H.g * dayW + DUSK_H.g * duskW + NIGHT_H.g * nightW) / sum;
    Hc.b = (DAY_H.b * dayW + DUSK_H.b * duskW + NIGHT_H.b * nightW) / sum;
    const dim = 1 - nightW * 0.9;
    if (rain > 0) {
      const k = rain * 0.85 * dim;
      Z.lerp(RAIN_Z.clone().multiplyScalar(0.25 + 0.75 * (1 - nightW)), k);
      Hc.lerp(RAIN_H.clone().multiplyScalar(0.2 + 0.8 * (1 - nightW)), k);
    }
    this.daylight = clamp(dayW + duskW * 0.5, 0, 1);
    this.isNight = e < -0.05;
    const flash = weather.flash || 0;
    // brightness applied to sky light in the voxel shader
    let bright = 0.17 + 0.83 * smoothstep(-0.12, 0.3, e);
    bright *= 1 - rain * 0.35;
    this.skyBright = bright;
    const S = this.shared;
    S.uSky.value = bright;
    S.uFlash.value = flash * 0.5;
    // skylight tint
    const warm = duskW * 0.6;
    S.uSkyTint.value.set(1.0 - nightW * 0.45 - warm * 0.0, 1.0 - nightW * 0.3 - warm * 0.22, 1.0 - warm * 0.4 + nightW * 0.0);
    S.uAmbient.value = 0.03 + (1 - nightW) * 0.02;
    S.uFogColor.value.copy(Hc);
    if (flash > 0) S.uFogColor.value.addScalar(flash * 0.4);

    const far = renderDist * 16 * 0.96;
    const fogFar = far * (1 - rain * 0.35);
    S.uFogFar.value = fogFar;
    S.uFogNear.value = fogFar * 0.5;

    const U = this.skyUniforms;
    U.uZenith.value.copy(Z); U.uHorizon.value.copy(Hc);
    if (flash > 0) { U.uZenith.value.addScalar(flash * 0.5); U.uHorizon.value.addScalar(flash * 0.5); }
    U.uSunDir.value.copy(sd);
    U.uGlow.value.setRGB(1.0, 0.55, 0.25).multiplyScalar(duskW * 0.9 * (1 - rain * 0.8));
    U.uStars.value = nightW * (1 - rain * 0.9);
    U.uTime.value = time;
    U.uSunAngle.value = a;
    U.uCover.value = Math.min(1, rain * 0.95);
    this.dome.position.copy(cam.position);

    // clouds
    this.cloudMesh.visible = this.cloudsOn;
    if (this.cloudsOn) {
      this.cloudScroll += dt * (1.4 + rain * 2);
      const CELL = 12;
      this.buildClouds(cam.position.x, cam.position.z);
      const frac = this.cloudScroll - Math.floor(this.cloudScroll / CELL) * CELL;
      this.cloudMesh.position.set(Math.floor(cam.position.x / CELL) * CELL + frac, this.cloudY, Math.floor(cam.position.z / CELL) * CELL);
      const cu = this.cloudUniforms;
      const cc = cu.uColor.value;
      const day = dayW + duskW * 0.7;
      cc.setRGB(0.12 + 0.88 * day + duskW * 0.1, 0.14 + 0.86 * day - duskW * 0.18, 0.22 + 0.78 * day - duskW * 0.3);
      cc.multiplyScalar(1 - rain * 0.5);
      cu.uFog.value.copy(Hc);
      cu.uFadeA.value = Math.min(160, far * 1.0);
      cu.uFadeB.value = Math.min(330, far * 1.8 + 60);
      cu.uOpacity.value = 0.9 - rain * 0.1;
    }
  }

  dispose() {
    this.scene.remove(this.dome); this.scene.remove(this.cloudMesh);
    this.dome.geometry.dispose(); this.cloudMesh.geometry.dispose();
  }
}

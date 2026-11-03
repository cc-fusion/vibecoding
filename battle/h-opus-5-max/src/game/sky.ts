import * as THREE from "three";
import { DAY_LENGTH, clamp, lerp } from "./constants";

const SKY_VERT = /* glsl */ `
out vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
in vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uStarFade;
uniform float uLightning;
uniform float uUnderwater;
uniform float uCave;
uniform vec3 uCaveColor;
layout(location = 0) out vec4 fragColor;

float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col;
  if (h > 0.0) {
    col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
  } else {
    col = mix(uHorizon, uGround, pow(clamp(-h, 0.0, 1.0), 0.4));
  }
  // sun glow
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * pow(sd, 180.0) * 2.0;
  col += uSunColor * pow(sd, 8.0) * 0.22;
  // moon
  vec3 md = -uSunDir;
  float mdot = max(dot(d, md), 0.0);
  col += vec3(0.75, 0.8, 0.95) * pow(mdot, 900.0) * 2.4 * uStarFade;
  // stars
  if (uStarFade > 0.01 && h > -0.05) {
    vec3 g = floor(d * 160.0);
    float s = hash(g);
    if (s > 0.9965) {
      float tw = 0.6 + 0.4 * sin(s * 100.0);
      col += vec3(1.0, 0.98, 0.92) * (s - 0.9965) * 320.0 * uStarFade * tw;
    }
  }
  col += uLightning * vec3(0.9, 0.93, 1.0);
  col = mix(col, uCaveColor, uCave);
  col = mix(col, vec3(0.05, 0.17, 0.3), uUnderwater);
  fragColor = vec4(col, 1.0);
}`;

interface Keyframe {
  t: number;
  zenith: [number, number, number];
  horizon: [number, number, number];
  fog: [number, number, number];
  sun: [number, number, number];
  light: number;
  ambient: [number, number, number];
}

// t = 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset
const KEYS: Keyframe[] = [
  {
    t: 0.0,
    zenith: [0.012, 0.018, 0.055],
    horizon: [0.04, 0.05, 0.11],
    fog: [0.035, 0.045, 0.1],
    sun: [0.2, 0.25, 0.42],
    light: 0.1,
    ambient: [0.035, 0.04, 0.075],
  },
  {
    t: 0.21,
    zenith: [0.06, 0.08, 0.2],
    horizon: [0.3, 0.19, 0.2],
    fog: [0.26, 0.19, 0.22],
    sun: [1.0, 0.45, 0.22],
    light: 0.3,
    ambient: [0.07, 0.06, 0.09],
  },
  {
    t: 0.28,
    zenith: [0.22, 0.42, 0.78],
    horizon: [0.92, 0.6, 0.42],
    fog: [0.78, 0.62, 0.55],
    sun: [1.0, 0.72, 0.42],
    light: 0.72,
    ambient: [0.09, 0.09, 0.11],
  },
  {
    t: 0.42,
    zenith: [0.28, 0.52, 0.95],
    horizon: [0.68, 0.82, 1.0],
    fog: [0.66, 0.79, 0.98],
    sun: [1.0, 0.97, 0.9],
    light: 1.0,
    ambient: [0.1, 0.11, 0.14],
  },
  {
    t: 0.58,
    zenith: [0.28, 0.52, 0.95],
    horizon: [0.68, 0.82, 1.0],
    fog: [0.66, 0.79, 0.98],
    sun: [1.0, 0.97, 0.9],
    light: 1.0,
    ambient: [0.1, 0.11, 0.14],
  },
  {
    t: 0.72,
    zenith: [0.2, 0.36, 0.72],
    horizon: [0.95, 0.52, 0.3],
    fog: [0.8, 0.55, 0.42],
    sun: [1.0, 0.6, 0.3],
    light: 0.68,
    ambient: [0.09, 0.08, 0.1],
  },
  {
    t: 0.79,
    zenith: [0.05, 0.07, 0.19],
    horizon: [0.28, 0.16, 0.2],
    fog: [0.22, 0.16, 0.2],
    sun: [0.7, 0.35, 0.25],
    light: 0.26,
    ambient: [0.06, 0.055, 0.085],
  },
  {
    t: 1.0,
    zenith: [0.012, 0.018, 0.055],
    horizon: [0.04, 0.05, 0.11],
    fog: [0.035, 0.045, 0.1],
    sun: [0.2, 0.25, 0.42],
    light: 0.1,
    ambient: [0.035, 0.04, 0.075],
  },
];

function sampleKeys(t: number) {
  let a = KEYS[0],
    b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const f = (t - a.t) / Math.max(1e-5, b.t - a.t);
  const mix3 = (p: [number, number, number], q: [number, number, number]) =>
    [lerp(p[0], q[0], f), lerp(p[1], q[1], f), lerp(p[2], q[2], f)] as [number, number, number];
  return {
    zenith: mix3(a.zenith, b.zenith),
    horizon: mix3(a.horizon, b.horizon),
    fog: mix3(a.fog, b.fog),
    sun: mix3(a.sun, b.sun),
    ambient: mix3(a.ambient, b.ambient),
    light: lerp(a.light, b.light, f),
  };
}

function cloudTexture(): THREE.Texture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  // value-noise clouds
  const grid = 16;
  const rnd = new Float32Array(grid * grid);
  for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
  const smooth = (x: number, y: number, g: number) => {
    const gx = (x / S) * g;
    const gy = (y / S) * g;
    const x0 = Math.floor(gx) % g,
      y0 = Math.floor(gy) % g;
    const x1 = (x0 + 1) % g,
      y1 = (y0 + 1) % g;
    const fx = gx - Math.floor(gx),
      fy = gy - Math.floor(gy);
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const i = (yy: number, xx: number) => rnd[(yy % grid) * grid + (xx % grid)];
    const a = lerp(i(y0, x0), i(y0, x1), sx);
    const b = lerp(i(y1, x0), i(y1, x1), sx);
    return lerp(a, b, sy);
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = smooth(x, y, 4) * 0.6 + smooth(x, y, 8) * 0.3 + smooth(x, y, 16) * 0.1;
      v = clamp((v - 0.48) * 3.4, 0, 1);
      const i = (y * S + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = v > 0.08 ? 215 : 0;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.repeat.set(5, 5);
  return tex;
}

export class Sky {
  dome: THREE.Mesh;
  clouds: THREE.Mesh;
  group = new THREE.Group();
  uniforms: Record<string, THREE.IUniform>;
  sunDir = new THREE.Vector3(0, 1, 0);
  dayLight = 1;
  fogColor = new THREE.Color();
  skyColor = new THREE.Color();
  ambient = new THREE.Color();
  sunColor = new THREE.Color();
  lightning = 0;
  cloudMat: THREE.MeshBasicMaterial;

  constructor() {
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color(0.1, 0.1, 0.12) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uSunSize: { value: 0.015 },
      uStarFade: { value: 0 },
      uLightning: { value: 0 },
      uUnderwater: { value: 0 },
      uCave: { value: 0 },
      uCaveColor: { value: new THREE.Color(0.022, 0.024, 0.032) },
    };
    const geo = new THREE.SphereGeometry(1, 32, 20);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      glslVersion: THREE.GLSL3,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    this.cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTexture(),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      opacity: 0.85,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 148;
    this.clouds.renderOrder = -900;
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
  }

  /** t: seconds since world start */
  update(worldTime: number, camPos: THREE.Vector3, stormy: number) {
    const t = ((worldTime / DAY_LENGTH) % 1 + 1) % 1;
    const k = sampleKeys(t);
    const ang = (t - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(ang) * 0.35, Math.sin(ang), Math.cos(ang) * 0.75).normalize();

    const storm = clamp(stormy, 0, 1);
    const dim = 1 - storm * 0.55;
    this.dayLight = clamp(k.light, 0, 1) * dim;
    const grey = (c: [number, number, number], amt: number) => {
      const g = (c[0] + c[1] + c[2]) / 3;
      return new THREE.Color(
        lerp(c[0], g * 0.75, amt),
        lerp(c[1], g * 0.78, amt),
        lerp(c[2], g * 0.82, amt),
      );
    };
    const zen = grey(k.zenith, storm * 0.85);
    const hor = grey(k.horizon, storm * 0.85);
    const fog = grey(k.fog, storm * 0.8);
    this.skyColor.copy(zen);
    this.fogColor.copy(fog);
    this.ambient.setRGB(k.ambient[0], k.ambient[1], k.ambient[2]);
    this.sunColor.setRGB(k.sun[0], k.sun[1], k.sun[2]);

    (this.uniforms.uZenith.value as THREE.Color).copy(zen);
    (this.uniforms.uHorizon.value as THREE.Color).copy(hor);
    (this.uniforms.uGround.value as THREE.Color).copy(fog).multiplyScalar(0.55);
    (this.uniforms.uSunDir.value as THREE.Vector3).copy(this.sunDir);
    (this.uniforms.uSunColor.value as THREE.Color).copy(this.sunColor);
    this.uniforms.uStarFade.value = clamp((0.22 - Math.max(0, this.sunDir.y)) * 7, 0, 1) * (1 - storm);
    this.uniforms.uLightning.value = this.lightning;

    this.group.position.copy(camPos);
    this.dome.scale.setScalar(1);
    this.clouds.position.set(camPos.x, 148, camPos.z);
    const mapOff = (this.cloudMat.map as THREE.Texture).offset;
    mapOff.x = (worldTime * 0.0032) % 1;
    mapOff.y = (worldTime * 0.0012) % 1;
    const cloudBright = clamp(this.dayLight * 1.15 + 0.08, 0.1, 1);
    this.cloudMat.color.setRGB(
      cloudBright * lerp(1, 0.55, storm),
      cloudBright * lerp(1, 0.57, storm),
      cloudBright * lerp(1, 0.62, storm),
    );
    this.cloudMat.opacity = lerp(0.72, 0.95, storm);
  }

  isNight(worldTime: number) {
    const t = ((worldTime / DAY_LENGTH) % 1 + 1) % 1;
    return t < 0.2 || t > 0.8;
  }
}

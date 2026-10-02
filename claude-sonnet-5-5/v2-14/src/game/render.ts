import { W, H, N, SOIL_CAP, BUILD_MAP, TIERS, EVENT_INFO, clamp, lerp } from './data';
import type { ToolId } from './data';
import { cylNoise } from './noise';
import type { Fx, World } from './sim';

export type Overlay = 'surface' | 'temp' | 'moist' | 'veg' | 'hab' | 'cloud' | 'wind';

const SS = 4; // surface supersample
const SC = 3; // cloud supersample
const SW = W * SS, SH = H * SS;
const CW = W * SC, CH = H * SC;

interface Map1 { i0: Int16Array; i1: Int16Array; f: Float32Array }
function makeMap(count: number, ss: number, cells: number, wrap: boolean): Map1 {
  const i0 = new Int16Array(count), i1 = new Int16Array(count), f = new Float32Array(count);
  for (let p = 0; p < count; p++) {
    const g = (p + 0.5) / ss - 0.5;
    const i = Math.floor(g);
    f[p] = g - i;
    if (wrap) { i0[p] = ((i % cells) + cells) % cells; i1[p] = (i0[p] + 1) % cells; }
    else { i0[p] = clamp(i, 0, cells - 1); i1[p] = clamp(i + 1, 0, cells - 1); }
  }
  return { i0, i1, f };
}

type RGB = [number, number, number];
const TEMP_STOPS: [number, RGB][] = [
  [-80, [43, 27, 107]], [-40, [59, 111, 216]], [-10, [94, 198, 255]], [5, [121, 224, 161]],
  [20, [217, 232, 106]], [35, [255, 179, 71]], [55, [255, 77, 46]], [90, [122, 15, 58]],
];
const HAB_STOPS: [number, RGB][] = [[0, [90, 30, 40]], [0.25, [200, 90, 50]], [0.5, [230, 200, 70]], [0.75, [120, 210, 90]], [1, [60, 240, 200]]];

function ramp(stops: [number, RGB][], v: number, out: RGB) {
  if (v <= stops[0][0]) { out[0] = stops[0][1][0]; out[1] = stops[0][1][1]; out[2] = stops[0][1][2]; return; }
  for (let k = 1; k < stops.length; k++) {
    if (v <= stops[k][0]) {
      const a = stops[k - 1], b = stops[k];
      const t = (v - a[0]) / (b[0] - a[0]);
      out[0] = a[1][0] + (b[1][0] - a[1][0]) * t;
      out[1] = a[1][1] + (b[1][1] - a[1][1]) * t;
      out[2] = a[1][2] + (b[1][2] - a[1][2]) * t;
      return;
    }
  }
  const l = stops[stops.length - 1][1];
  out[0] = l[0]; out[1] = l[1]; out[2] = l[2];
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: number; g: number }
interface FloatText { x: number; y: number; s: string; c: string; life: number; max: number }

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  world: World;
  overlay: Overlay = 'surface';
  cw = 800; ch = 600; dpr = 1;
  cam = { cx: W / 2, cy: H / 2, zoom: 1 };
  surf: HTMLCanvasElement;
  sctx: CanvasRenderingContext2D;
  simg: ImageData;
  cloud: HTMLCanvasElement;
  cctx: CanvasRenderingContext2D;
  cimg: ImageData;
  cloudTex = new Float32Array(CW * CH);
  shade = new Float32Array(N);
  mx = makeMap(SW, SS, W, true);
  my = makeMap(SH, SS, H, false);
  cmx = makeMap(CW, SC, W, true);
  cmy = makeMap(CH, SC, H, false);
  stars: HTMLCanvasElement | null = null;
  particles: Particle[] = [];
  texts: FloatText[] = [];
  wind: Float32Array = new Float32Array(360 * 4);
  shake = 0;
  flash: { c: string; a: number } = { c: '#fff', a: 0 };
  lastBuf = 0;
  dirty = true;
  time = 0;
  hover: { x: number; y: number } | null = null;
  selected: { x: number; y: number } | null = null;
  tool: ToolId = 'inspect';
  toolErr: string | null = null;
  shakeOn = true;
  particlesOn = true;
  tmpc: RGB = [0, 0, 0];

  constructor(canvas: HTMLCanvasElement, world: World) {
    this.canvas = canvas;
    this.world = world;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('2D canvas unavailable');
    this.ctx = c;
    this.surf = document.createElement('canvas');
    this.surf.width = SW; this.surf.height = SH;
    this.sctx = this.surf.getContext('2d') as CanvasRenderingContext2D;
    this.simg = this.sctx.createImageData(SW, SH);
    this.cloud = document.createElement('canvas');
    this.cloud.width = CW; this.cloud.height = CH;
    this.cctx = this.cloud.getContext('2d') as CanvasRenderingContext2D;
    this.cimg = this.cctx.createImageData(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const n = cylNoise(x, y, CW, 0.07, 4242, 4);
      this.cloudTex[y * CW + x] = n;
    }
    for (let k = 0; k < 360; k++) this.resetWind(k, true);
  }

  resetWind(k: number, spread: boolean) {
    const o = k * 4;
    this.wind[o] = Math.random() * W;
    this.wind[o + 1] = Math.random() * H;
    this.wind[o + 2] = spread ? Math.random() * 2 : 0;
    this.wind[o + 3] = 0;
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(100, w);
    this.ch = Math.max(100, h);
    this.canvas.width = Math.floor(this.cw * this.dpr);
    this.canvas.height = Math.floor(this.ch * this.dpr);
    this.canvas.style.width = this.cw + 'px';
    this.canvas.style.height = this.ch + 'px';
    const st = document.createElement('canvas');
    st.width = this.canvas.width; st.height = this.canvas.height;
    const sc = st.getContext('2d');
    if (sc) {
      const g = sc.createRadialGradient(st.width / 2, st.height / 2, 0, st.width / 2, st.height / 2, Math.max(st.width, st.height) * 0.7);
      g.addColorStop(0, '#0c1322'); g.addColorStop(1, '#03050b');
      sc.fillStyle = g; sc.fillRect(0, 0, st.width, st.height);
      for (let i = 0; i < 160; i++) {
        sc.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.6})`;
        const r = Math.random() < 0.1 ? 1.6 : 0.8;
        sc.fillRect(Math.random() * st.width, Math.random() * st.height, r * this.dpr, r * this.dpr);
      }
      this.stars = st;
    }
    this.dirty = true;
  }

  baseScale() { return Math.min(this.cw / W, this.ch / H) * 0.97; }
  scale() { return this.baseScale() * this.cam.zoom; }

  clampCam() {
    const s = this.scale();
    const vw = this.cw / s, vh = this.ch / s;
    this.cam.cx = vw >= W ? W / 2 : clamp(this.cam.cx, vw / 2, W - vw / 2);
    this.cam.cy = vh >= H ? H / 2 : clamp(this.cam.cy, vh / 2, H - vh / 2);
  }

  zoomAt(px: number, py: number, factor: number) {
    const before = this.screenToWorld(px, py);
    this.cam.zoom = clamp(this.cam.zoom * factor, 1, 8);
    const s = this.scale();
    this.cam.cx = before.x - (px - this.cw / 2) / s;
    this.cam.cy = before.y - (py - this.ch / 2) / s;
    this.clampCam();
  }

  pan(dxPx: number, dyPx: number) {
    const s = this.scale();
    this.cam.cx -= dxPx / s;
    this.cam.cy -= dyPx / s;
    this.clampCam();
  }

  offset() {
    const s = this.scale();
    return { s, ox: this.cw / 2 - this.cam.cx * s, oy: this.ch / 2 - this.cam.cy * s };
  }

  screenToWorld(px: number, py: number) {
    const { s, ox, oy } = this.offset();
    return { x: (px - ox) / s, y: (py - oy) / s };
  }

  screenToCell(px: number, py: number): { x: number; y: number } | null {
    const w = this.screenToWorld(px, py);
    if (w.x < 0 || w.x >= W || w.y < 0 || w.y >= H) return null;
    return { x: Math.floor(w.x), y: Math.floor(w.y) };
  }

  incomingAt(px: number, py: number): number | null {
    const w = this.screenToWorld(px, py);
    let best: number | null = null, bd = 1.6;
    for (const inc of this.world.incoming) {
      if (inc.src === 'player') continue;
      const d = Math.hypot(inc.x + 0.5 - w.x, inc.y + 0.5 - w.y);
      if (d < bd) { bd = d; best = inc.id; }
    }
    return best;
  }

  // ---------- fx ----------
  fx(e: Fx) {
    switch (e.t) {
      case 'text': this.texts.push({ x: e.x + 0.5, y: e.y + 0.2, s: e.s, c: e.c, life: 0, max: 1.8 }); if (this.texts.length > 40) this.texts.shift(); break;
      case 'burst': this.burst(e.x + 0.5, e.y + 0.5, e.kind, e.n); break;
      case 'shake': if (this.shakeOn) this.shake = Math.min(1.4, this.shake + e.a); break;
      case 'flash': this.flash = { c: e.c, a: 0.35 }; break;
      default: break;
    }
  }

  burst(x: number, y: number, kind: string, n: number) {
    if (!this.particlesOn) n = Math.ceil(n * 0.25);
    const add = (p: Partial<Particle>) => {
      if (this.particles.length > 1400) return;
      this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: '#fff', kind: 0, g: 0, ...p });
    };
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      switch (kind) {
        case 'impact': {
          const sp = 1.5 + Math.random() * 7;
          add({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: 0.5 + Math.random() * 0.8, size: 2 + Math.random() * 3, color: ['#fff3b0', '#ffb347', '#ff6a3a', '#ffd9a0'][k % 4], g: 3 });
          break;
        }
        case 'smoke':
          add({ x: x + (Math.random() - 0.5) * 1.5, vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 1.1, max: 1.6 + Math.random() * 1.6, size: 6 + Math.random() * 10, color: 'rgba(120,110,105,1)', kind: 1 });
          break;
        case 'fire':
          add({ x: x + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random() * 1.6, max: 0.5 + Math.random() * 0.6, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#ff9a2a' : '#ffd24a', g: -0.5 });
          break;
        case 'sparkle':
          add({ vx: Math.cos(a) * (0.4 + Math.random() * 1.6), vy: Math.sin(a) * (0.4 + Math.random() * 1.6) - 0.8, max: 0.7 + Math.random() * 0.7, size: 2 + Math.random() * 2, color: ['#fff6a8', '#9dffb0', '#a9f0ff'][k % 3] });
          break;
        case 'build':
          add({ vx: Math.cos(a) * (1 + Math.random() * 2.2), vy: Math.sin(a) * (1 + Math.random() * 1.4) - 0.5, max: 0.45 + Math.random() * 0.4, size: 2 + Math.random() * 2.5, color: k % 3 === 0 ? '#ffe9a8' : '#cdb89a', g: 2 });
          break;
        case 'lance':
          add({ vx: Math.cos(a) * (3 + Math.random() * 6), vy: Math.sin(a) * (3 + Math.random() * 6), max: 0.35 + Math.random() * 0.4, size: 2, color: k % 2 ? '#8ff3ff' : '#ffffff', kind: 2 });
          break;
        case 'water':
          add({ x: x + (Math.random() - 0.5) * 3, y: y - 1.5, vx: 0, vy: 4 + Math.random() * 3, max: 0.5, size: 2, color: '#6fb8ff', kind: 2 });
          break;
        default: break;
      }
    }
  }

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 1.9);
    this.flash.a = Math.max(0, this.flash.a - dt * 0.9);
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      if (t.life >= t.max) this.texts.splice(i, 1);
    }
    // weather particles (rain/snow)
    if (this.particlesOn && ps.length < 900 && this.world.cnt.rain > 0) {
      const w = this.world;
      const tries = Math.min(10, 2 + Math.floor(w.cnt.rain / 20));
      for (let k = 0; k < tries; k++) {
        const i = Math.floor(Math.random() * N);
        if (w.rain[i] > 0.00004) {
          const x = (i % W) + Math.random(), y = Math.floor(i / W) + Math.random() - 0.5;
          const snow = w.tmp[i] < 0.2;
          ps.push({ x, y, vx: snow ? (Math.random() - 0.5) * 0.5 : 0.3, vy: snow ? 0.9 : 5.5, life: 0, max: snow ? 0.7 : 0.28, size: snow ? 2 : 1.4, color: snow ? '#ffffff' : '#9ed4ff', kind: 3, g: 0 });
        }
      }
    }
    // wind particles
    if (this.overlay === 'wind') {
      const w = this.world;
      for (let k = 0; k < 360; k++) {
        const o = k * 4;
        const y = clamp(Math.floor(this.wind[o + 1]), 0, H - 1);
        const sp = 2.8 * w.windScale;
        this.wind[o] += w.windU[y] * sp * dt;
        this.wind[o + 1] += w.windV[y] * sp * dt * 4;
        this.wind[o + 2] += dt;
        this.wind[o + 3] = Math.abs(w.windU[y]);
        if (this.wind[o] < 0) this.wind[o] += W;
        if (this.wind[o] >= W) this.wind[o] -= W;
        if (this.wind[o + 1] < 0 || this.wind[o + 1] >= H || this.wind[o + 2] > 3.2) this.resetWind(k, false);
      }
    }
  }

  // ---------- buffers ----------
  buildBuffers() {
    const w = this.world;
    // hillshade
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = w.hgt[y * W + ((x + W - 1) % W)], r = w.hgt[y * W + ((x + 1) % W)];
      const u = y > 0 ? w.hgt[i - W] : w.hgt[i], d = y < H - 1 ? w.hgt[i + W] : w.hgt[i];
      this.shade[i] = clamp(0.5 + (l - r + u - d) * 3.2, 0, 1);
    }
    const data = this.simg.data;
    const { mx, my } = this;
    const bl = (F: Float32Array, r0: number, r1: number, xa: number, xb: number, fx: number, fy: number) => {
      const a = F[r0 + xa] * (1 - fx) + F[r0 + xb] * fx;
      const b = F[r1 + xa] * (1 - fx) + F[r1 + xb] * fx;
      return a * (1 - fy) + b * fy;
    };
    const ov = this.overlay;
    const lo = w.wd.rockLow, hi = w.wd.rockHigh;
    const c = this.tmpc;
    const dustTint = w.dust * 0.3;
    const flick = 0.75 + 0.25 * Math.sin(this.time * 18);
    const hasHeat = true;
    for (let py = 0; py < SH; py++) {
      const y0 = my.i0[py], y1 = my.i1[py], fy = my.f[py];
      const r0 = y0 * W, r1 = y1 * W;
      for (let px = 0; px < SW; px++) {
        const xa = mx.i0[px], xb = mx.i1[px], fx = mx.f[px];
        const near = (fy < 0.5 ? r0 : r1) + (fx < 0.5 ? xa : xb);
        const sh = 0.65 + 0.7 * bl(this.shade, r0, r1, xa, xb, fx, fy);
        const wat = bl(w.wat, r0, r1, xa, xb, fx, fy);
        const ice = bl(w.ice, r0, r1, xa, xb, fx, fy);
        let R = 0, G = 0, B = 0;
        if (ov === 'temp') {
          ramp(TEMP_STOPS, bl(w.tmp, r0, r1, xa, xb, fx, fy), c);
          const m = 0.85 + (sh - 1) * 0.5;
          R = c[0] * m; G = c[1] * m; B = c[2] * m;
        } else if (ov === 'hab') {
          const hv = bl(w.hab, r0, r1, xa, xb, fx, fy);
          ramp(HAB_STOPS, hv, c);
          if (wat > 0.02) { R = 18; G = 40; B = 80; } else { R = c[0] * (0.8 + (sh - 1) * 0.5 + 0.2); G = c[1] * (0.8 + (sh - 1) * 0.5 + 0.2); B = c[2] * (0.8 + (sh - 1) * 0.5 + 0.2); }
        } else if (ov === 'moist') {
          const sf = clamp(bl(w.soil, r0, r1, xa, xb, fx, fy) / SOIL_CAP, 0, 1);
          if (wat > 0.003) {
            const d = clamp(wat / 0.2, 0, 1);
            R = lerp(80, 12, d); G = lerp(180, 60, d); B = lerp(230, 140, d);
          } else {
            R = lerp(170, 30, sf) * (0.8 + (sh - 1) * 0.5 + 0.2); G = lerp(130, 150, sf) * (0.8 + (sh - 1) * 0.5 + 0.2); B = lerp(90, 170, sf) * (0.8 + (sh - 1) * 0.5 + 0.2);
          }
          if (ice > 0.004) { const a = clamp(ice / 0.02, 0, 1) * 0.8; R = lerp(R, 235, a); G = lerp(G, 245, a); B = lerp(B, 255, a); }
        } else if (ov === 'veg') {
          const v = bl(w.veg, r0, r1, xa, xb, fx, fy);
          const g = 70 * (0.8 + (sh - 1) * 0.5 + 0.2);
          R = g; G = g * 0.95; B = g * 0.95;
          if (wat > 0.02) { R = 14; G = 32; B = 64; }
          else if (w.vtier[near] > 0) {
            const tc = TIERS[w.vtier[near]].color;
            const a = clamp(v * 1.4, 0, 1);
            R = lerp(R, tc[0] * 1.15, a); G = lerp(G, tc[1] * 1.2, a); B = lerp(B, tc[2] * 1.1, a);
          }
        } else if (ov === 'cloud') {
          const cl = clamp(bl(w.cld, r0, r1, xa, xb, fx, fy) / 1.2, 0, 1);
          const rn = clamp(bl(w.rain, r0, r1, xa, xb, fx, fy) / 0.0004, 0, 1);
          R = lerp(16, 238, cl) * (1 - rn * 0.5); G = lerp(26, 244, cl) * (1 - rn * 0.25); B = lerp(52, 255, cl);
          R *= 0.85 + (sh - 1) * 0.3 + 0.15; G *= 0.85 + (sh - 1) * 0.3 + 0.15; B *= 0.85 + (sh - 1) * 0.3 + 0.15;
        } else {
          // surface (and wind base)
          const h = clamp(bl(w.hgt, r0, r1, xa, xb, fx, fy), 0, 1);
          R = lerp(lo[0], hi[0], h) * sh; G = lerp(lo[1], hi[1], h) * sh; B = lerp(lo[2], hi[2], h) * sh;
          const sm = clamp(bl(w.soil, r0, r1, xa, xb, fx, fy) / SOIL_CAP, 0, 1);
          R *= 1 - 0.22 * sm; G *= 1 - 0.12 * sm; B *= 1 - 0.05 * sm;
          const tier = w.vtier[near];
          if (tier > 0) {
            const v = bl(w.veg, r0, r1, xa, xb, fx, fy);
            const tc = TIERS[tier].color;
            const a = clamp(v * 1.4, 0, 1) * 0.92;
            const m = 0.8 + 0.4 * (sh - 0.65) / 0.7 + 0.1;
            R = lerp(R, tc[0] * m, a); G = lerp(G, tc[1] * m, a); B = lerp(B, tc[2] * m, a);
          }
          if (wat > 0.002) {
            const d = clamp(wat / 0.22, 0, 1);
            const a = clamp(wat / 0.012, 0, 1);
            const m = 0.9 + (sh - 1) * 0.15;
            R = lerp(R, lerp(74, 10, Math.sqrt(d)) * m, a); G = lerp(G, lerp(172, 48, Math.sqrt(d)) * m, a); B = lerp(B, lerp(206, 118, Math.sqrt(d)) * m, a);
          }
          if (ice > 0.002) {
            const a = clamp(ice / 0.02, 0, 1) * 0.93;
            const m = 0.82 + 0.3 * (sh - 0.65) / 0.7;
            R = lerp(R, 226 * m, a); G = lerp(G, 239 * m, a); B = lerp(B, 250 * m, a);
          }
          if (w.fire[near] > 0) { R = lerp(R, 255, 0.7 * flick); G = lerp(G, 120, 0.7 * flick); B = lerp(B, 30, 0.7 * flick); }
          if (hasHeat) {
            const ht = bl(w.heat, r0, r1, xa, xb, fx, fy);
            if (ht > 12) { const a = clamp((ht - 12) / 40, 0, 0.7); R = lerp(R, 255, a); G = lerp(G, 90, a); B = lerp(B, 20, a); }
          }
          if (dustTint > 0) { R = lerp(R, 190, dustTint); G = lerp(G, 140, dustTint); B = lerp(B, 90, dustTint); }
          if (ov === 'wind') { R *= 0.55; G *= 0.6; B *= 0.7; }
        }
        const o = (py * SW + px) * 4;
        data[o] = R; data[o + 1] = G; data[o + 2] = B; data[o + 3] = 255;
      }
    }
    this.sctx.putImageData(this.simg, 0, 0);
    this.buildClouds();
  }

  buildClouds() {
    const w = this.world;
    const d = this.cimg.data;
    const t = this.time;
    for (let py = 0; py < CH; py++) {
      const y0 = this.cmy.i0[py], y1 = this.cmy.i1[py], fy = this.cmy.f[py];
      const r0 = y0 * W, r1 = y1 * W;
      const off = Math.floor(t * w.windU[y0] * 5 * w.windScale);
      for (let px = 0; px < CW; px++) {
        const xa = this.cmx.i0[px], xb = this.cmx.i1[px], fx = this.cmx.f[px];
        const a = w.cld[r0 + xa] * (1 - fx) + w.cld[r0 + xb] * fx;
        const b = w.cld[r1 + xa] * (1 - fx) + w.cld[r1 + xb] * fx;
        const c = a * (1 - fy) + b * fy;
        const o = (py * CW + px) * 4;
        if (c < 0.12) { d[o + 3] = 0; continue; }
        const tx = (((px - off) % CW) + CW) % CW;
        const n = this.cloudTex[py * CW + tx];
        const dens = c * 1.05 + (n - 0.5) * 1.1 - 0.4;
        const al = clamp(dens * 1.7, 0, 0.82);
        const g = 255 - clamp(dens, 0, 1) * 30;
        d[o] = g; d[o + 1] = g + 2; d[o + 2] = 255; d[o + 3] = al * 255;
      }
    }
    this.cctx.putImageData(this.cimg, 0, 0);
  }

  // ---------- main draw ----------
  draw(nowMs: number) {
    const ctx = this.ctx;
    const w = this.world;
    if (this.dirty || nowMs - this.lastBuf > 90) {
      this.buildBuffers();
      this.lastBuf = nowMs;
      this.dirty = false;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.stars) ctx.drawImage(this.stars, 0, 0, this.cw, this.ch);
    else { ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, this.cw, this.ch); }
    const { s, ox, oy: oy0 } = this.offset();
    const sh = this.shake;
    const oy = oy0 + (sh > 0 ? (Math.random() - 0.5) * sh * 14 : 0);
    const oxs = ox + (sh > 0 ? (Math.random() - 0.5) * sh * 14 : 0);
    // planet glow
    ctx.save();
    ctx.shadowColor = w.wd.sky;
    ctx.shadowBlur = 30 + 20 * Math.min(1, w.H * 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(oxs, oy, W * s, H * s);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.surf, oxs, oy, W * s, H * s);
    if (this.overlay === 'surface') ctx.drawImage(this.cloud, oxs, oy, W * s, H * s);
    // grid
    if (s > 24) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x++) { ctx.moveTo(oxs + x * s, oy); ctx.lineTo(oxs + x * s, oy + H * s); }
      for (let y = 0; y <= H; y++) { ctx.moveTo(oxs, oy + y * s); ctx.lineTo(oxs + W * s, oy + y * s); }
      ctx.stroke();
    }
    const px = (x: number) => oxs + x * s;
    const py = (y: number) => oy + y * s;

    // vents
    for (const v of w.ventList) {
      if (w.bmap[v] >= 0) continue;
      const x = v % W, y = Math.floor(v / W);
      const pulse = 0.55 + 0.35 * Math.sin(this.time * 3 + x);
      ctx.fillStyle = `rgba(255,120,50,${pulse})`;
      ctx.beginPath();
      const cx = px(x + 0.5), cy = py(y + 0.5), r = Math.max(2.5, s * 0.22);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
      ctx.fill();
    }

    // event zones
    for (const ev of w.events) {
      if (ev.kind !== 'volcano' && ev.kind !== 'deluge' && ev.kind !== 'wildfire') continue;
      const warn = ev.phase === 'warn';
      const cx = px(ev.x + 0.5), cy = py(ev.y + 0.5);
      const r = Math.max(ev.r, 1.2) * s;
      ctx.save();
      ctx.strokeStyle = warn ? 'rgba(255,200,80,0.9)' : 'rgba(255,80,60,0.9)';
      ctx.lineWidth = 2;
      if (warn) ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -this.time * 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r + Math.sin(this.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.font = `${Math.max(14, s * 0.7)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(EVENT_INFO[ev.kind].icon, cx, cy - r - 10);
    }

    // buildings
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const b of w.bld) {
      const def = BUILD_MAP[b.kind];
      const x = px(b.x), y = py(b.y);
      const pad = s * 0.08;
      ctx.fillStyle = 'rgba(8,12,22,0.78)';
      ctx.strokeStyle = def.color;
      ctx.lineWidth = Math.max(1, s * 0.05);
      this.rr(x + pad, y + pad, s - pad * 2, s - pad * 2, s * 0.18);
      ctx.fill();
      ctx.stroke();
      if (s >= 12) {
        ctx.font = `${s * 0.58}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText(def.icon, x + s / 2, y + s / 2 + s * 0.04);
      } else {
        ctx.fillStyle = def.color;
        ctx.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4);
      }
      if (b.hp < 99) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x + pad, y + s - pad - 3, s - pad * 2, 3);
        ctx.fillStyle = b.hp > 50 ? '#7fe36b' : b.hp > 25 ? '#ffc94a' : '#ff5a4a';
        ctx.fillRect(x + pad, y + s - pad - 3, (s - pad * 2) * (b.hp / 100), 3);
      }
      if ((b.kind === 'dome' || b.kind === 'settle') && s >= 16) {
        ctx.font = `bold ${Math.max(9, s * 0.26)}px system-ui,sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 3;
        const t = String(Math.floor(b.pop));
        ctx.strokeText(t, x + s / 2, y - s * 0.12);
        ctx.fillText(t, x + s / 2, y - s * 0.12);
      }
      if (w.effPower < 0.6 && def.energy > 0 && s >= 14) {
        ctx.font = `${Math.max(9, s * 0.3)}px sans-serif`;
        ctx.fillText('🔌', x + s * 0.82, y + s * 0.18);
      }
    }

    // incoming
    for (const inc of w.incoming) {
      const f = clamp(inc.eta / inc.total, 0, 1);
      const cx = px(inc.x + 0.5), cy = py(inc.y + 0.5);
      const hostile = inc.src !== 'player';
      const col = hostile ? '255,80,70' : '170,230,255';
      const r = s * (inc.size === 2 ? 2.2 : inc.size === 3 ? 2.2 : 1.2);
      ctx.save();
      ctx.strokeStyle = `rgba(${col},${0.5 + 0.4 * Math.sin(this.time * 10)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.3 + 0.7 * f), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.15, cy); ctx.lineTo(cx + r * 1.15, cy);
      ctx.moveTo(cx, cy - r * 1.15); ctx.lineTo(cx, cy + r * 1.15);
      ctx.stroke();
      const hx = cx - 6 * f * s * 1.0, hy = cy - 12 * f * s * 1.0;
      const g = ctx.createLinearGradient(hx, hy, cx, cy);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(1, `rgba(${col},0.9)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx - 8 * f * s, hy - 16 * f * s);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = hostile ? '#ffb27a' : '#e6f8ff';
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(3, s * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // wind streaks
    if (this.overlay === 'wind') {
      ctx.lineCap = 'round';
      for (let k = 0; k < 360; k++) {
        const o = k * 4;
        const age = this.wind[o + 2];
        const al = Math.sin(clamp(age / 3.2, 0, 1) * Math.PI) * 0.8;
        const y = clamp(Math.floor(this.wind[o + 1]), 0, H - 1);
        const u = w.windU[y], v = w.windV[y];
        const x1 = px(this.wind[o]), y1 = py(this.wind[o + 1]);
        ctx.strokeStyle = `rgba(190,235,255,${al})`;
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - u * s * 0.9, y1 - v * s * 3.6);
        ctx.stroke();
      }
    }

    // particles
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      const x = px(p.x), y = py(p.y);
      if (p.kind === 1) {
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 + (1 - a) * 1.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 2 || p.kind === 3) {
        ctx.globalAlpha = a * (p.kind === 3 ? 0.65 : 1);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vx * 0.04 * s * 0.4, y - p.vy * 0.04 * s * 0.4);
        ctx.stroke();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    // hover & tool preview
    const hv = this.hover;
    if (hv) this.drawPreview(hv.x, hv.y, px, py, s);
    const sel = this.selected;
    if (sel) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(px(sel.x) + 1, py(sel.y) + 1, s - 2, s - 2);
      ctx.setLineDash([]);
    }

    // floating texts
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.4);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `bold ${Math.round(14 * pop)}px system-ui,sans-serif`;
      const x = px(t.x), y = py(t.y - k * 1.8);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.s, x, y);
      ctx.fillStyle = t.c;
      ctx.fillText(t.s, x, y);
    }
    ctx.globalAlpha = 1;

    // dust haze + flash + vignette
    if (w.dust > 0.05) {
      ctx.fillStyle = `rgba(170,110,60,${w.dust * 0.16})`;
      ctx.fillRect(0, 0, this.cw, this.ch);
    }
    if (this.flash.a > 0.01) {
      ctx.globalAlpha = this.flash.a;
      ctx.fillStyle = this.flash.c;
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.globalAlpha = 1;
    }
    const vg = ctx.createRadialGradient(this.cw / 2, this.ch / 2, Math.min(this.cw, this.ch) * 0.45, this.cw / 2, this.ch / 2, Math.max(this.cw, this.ch) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.cw, this.ch);
  }

  rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  drawPreview(x: number, y: number, px: (v: number) => number, py: (v: number) => number, s: number) {
    const ctx = this.ctx;
    const tool = this.tool;
    const err = this.toolErr;
    const col = tool === 'inspect' ? '255,255,255' : err ? '255,90,80' : '120,255,150';
    ctx.strokeStyle = `rgba(${col},0.95)`;
    ctx.fillStyle = `rgba(${col},0.14)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(px(x) + 1, py(y) + 1, s - 2, s - 2);
    ctx.fillRect(px(x), py(y), s, s);
    let radius = 0;
    if (tool === 'cloud' || tool === 'soot' || tool === 'seeder') radius = 3;
    else if (tool === 'comet') radius = 2.2;
    else if (tool === 'raise' || tool === 'lower') radius = 1.5;
    if (radius > 0) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = tool === 'comet' ? 'rgba(255,120,80,0.95)' : `rgba(${col},0.7)`;
      ctx.beginPath();
      ctx.arc(px(x + 0.5), py(y + 0.5), radius * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}


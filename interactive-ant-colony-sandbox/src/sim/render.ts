import { PHEROMONE } from './config';
import { PHEROMONE_TYPES, type PheromoneType } from './types';
import { foodRadius, type World } from './world';

export interface RenderOptions {
  showPheromones: boolean;
  pheromoneTypes: Record<PheromoneType, boolean>;
  pheromoneColony: number | 'all';
  selectedAntId: number;
  selectedFoodId: number;
  selectedNestId: number;
  cursor: { x: number; y: number; radius: number; visible: boolean };
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Visual convention per pheromone type: tint blended with colony color + max opacity + gamma. */
const TYPE_STYLE: Record<PheromoneType, { tint: RGB; tintAmount: number; alpha: number; norm: number }> = {
  food: { tint: { r: 255, g: 255, b: 255 }, tintAmount: 0.0, alpha: 0.85, norm: 0.9 },
  home: { tint: { r: 220, g: 235, b: 255 }, tintAmount: 0.6, alpha: 0.32, norm: 0.7 },
  alarm: { tint: { r: 255, g: 40, b: 40 }, tintAmount: 0.8, alpha: 0.9, norm: 0.5 },
  explore: { tint: { r: 140, g: 150, b: 140 }, tintAmount: 0.7, alpha: 0.28, norm: 0.8 },
};

/**
 * Canvas renderer. Keeps cached layers (background texture, walls) and a
 * low-resolution pheromone image that is scaled up with smoothing so the
 * overlay reads as a soft translucent heatmap rather than a pixel grid.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private wallLayer: HTMLCanvasElement;
  private wallVersion = -1;
  private phCanvas: HTMLCanvasElement;
  private phCtx: CanvasRenderingContext2D;
  private phImage: ImageData;
  private colorCache = new Map<string, RGB>();
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.bg = document.createElement('canvas');
    this.bg.width = world.width;
    this.bg.height = world.height;
    this.paintBackground();
    this.wallLayer = document.createElement('canvas');
    this.wallLayer.width = world.width;
    this.wallLayer.height = world.height;
    this.phCanvas = document.createElement('canvas');
    this.phCanvas.width = world.cols;
    this.phCanvas.height = world.rows;
    this.phCtx = this.phCanvas.getContext('2d')!;
    this.phImage = this.phCtx.createImageData(world.cols, world.rows);
  }

  setWorld(world: World) {
    this.world = world;
    this.wallVersion = -1;
  }

  private rgb(hex: string): RGB {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = hexToRgb(hex);
      this.colorCache.set(hex, c);
    }
    return c;
  }

  /** Convert screen (CSS px) coordinates to world coordinates. */
  toWorld(px: number, py: number) {
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  private paintBackground() {
    const g = this.bg.getContext('2d')!;
    const { width, height } = this.bg;
    const grad = g.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width * 0.75);
    grad.addColorStop(0, '#2b2620');
    grad.addColorStop(1, '#1c1916');
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
    // soil grain
    let s = 12345;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * width;
      const y = rnd() * height;
      const v = rnd();
      g.fillStyle = v < 0.5 ? 'rgba(255,230,190,0.05)' : 'rgba(0,0,0,0.12)';
      g.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }

  private paintWalls() {
    const w = this.world;
    const g = this.wallLayer.getContext('2d')!;
    g.clearRect(0, 0, this.wallLayer.width, this.wallLayer.height);
    const cs = w.cellSize;
    g.fillStyle = '#5f554b';
    for (let y = 0; y < w.rows; y++)
      for (let x = 0; x < w.cols; x++) if (w.walls[y * w.cols + x]) g.fillRect(x * cs, y * cs, cs, cs);
    // lighter top edge for a slight relief look
    g.fillStyle = '#7d7266';
    for (let y = 0; y < w.rows; y++)
      for (let x = 0; x < w.cols; x++) {
        const i = y * w.cols + x;
        if (w.walls[i] && (y === 0 || !w.walls[i - w.cols])) g.fillRect(x * cs, y * cs, cs, 2);
      }
    g.fillStyle = '#3d3630';
    for (let y = 0; y < w.rows; y++)
      for (let x = 0; x < w.cols; x++) {
        const i = y * w.cols + x;
        if (w.walls[i] && (y === w.rows - 1 || !w.walls[i + w.cols])) g.fillRect(x * cs, y * cs + cs - 2, cs, 2);
      }
    this.wallVersion = w.wallsVersion;
  }

  private paintPheromones(opt: RenderOptions) {
    const w = this.world;
    const data = this.phImage.data;
    data.fill(0);
    const n = w.cols * w.rows;
    for (const c of w.colonies) {
      if (opt.pheromoneColony !== 'all' && opt.pheromoneColony !== c.id) continue;
      const base = this.rgb(c.traits.color);
      for (const type of PHEROMONE_TYPES) {
        if (!opt.pheromoneTypes[type]) continue;
        const st = TYPE_STYLE[type];
        const col = mix(base, st.tint, st.tintAmount);
        const ch = c.pheromones.channels[type];
        const norm = 1 / (PHEROMONE[type].max * st.norm);
        for (let i = 0; i < n; i++) {
          const v = ch[i];
          if (v < 0.003) continue;
          let t = v * norm;
          if (t > 1) t = 1;
          t = Math.sqrt(t); // gamma so faint trails remain visible
          const a = t * st.alpha;
          const o = i * 4;
          // "over" compositing onto whatever is already in the pixel
          const da = data[o + 3] / 255;
          const outA = a + da * (1 - a);
          if (outA <= 0) continue;
          data[o] = (col.r * a + data[o] * da * (1 - a)) / outA;
          data[o + 1] = (col.g * a + data[o + 1] * da * (1 - a)) / outA;
          data[o + 2] = (col.b * a + data[o + 2] * da * (1 - a)) / outA;
          data[o + 3] = outA * 255;
        }
      }
    }
    this.phCtx.putImageData(this.phImage, 0, 0);
  }

  render(opt: RenderOptions) {
    const canvas = this.canvas;
    const w = this.world;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw === 0 || ch === 0) return;
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
    }
    const ctx = this.ctx;
    this.scale = Math.min(cw / w.width, ch / w.height);
    this.offsetX = (cw - w.width * this.scale) / 2;
    this.offsetY = (ch - w.height * this.scale) / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.offsetX, dpr * this.offsetY);

    // terrain
    ctx.drawImage(this.bg, 0, 0);

    // pheromones (translucent heatmap)
    if (opt.showPheromones) {
      this.paintPheromones(opt);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.phCanvas, 0, 0, w.width, w.height);
    }

    // walls
    if (this.wallVersion !== w.wallsVersion) this.paintWalls();
    ctx.drawImage(this.wallLayer, 0, 0);

    this.drawNests(ctx, opt);
    this.drawFood(ctx, opt);
    this.drawAnts(ctx, opt);
    this.drawCursor(ctx, opt);

    // world border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w.width, w.height);
  }

  private drawNests(ctx: CanvasRenderingContext2D, opt: RenderOptions) {
    const w = this.world;
    for (const n of w.nests) {
      const c = w.colonyById(n.colonyId);
      const color = c?.traits.color ?? '#fff';
      const g = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, n.radius * 1.9);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, color + '22');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * 1.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#3a2f26';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#100d0b';
      ctx.fill();
      if (opt.selectedNestId === n.id) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (c) {
        const fs = 13 / this.scale; // constant on-screen size regardless of zoom-to-fit
        ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(c.traits.name, n.x + 1, n.y - n.radius - 7 + 1);
        ctx.fillStyle = color;
        ctx.fillText(c.traits.name, n.x, n.y - n.radius - 7);
      }
    }
  }

  private drawFood(ctx: CanvasRenderingContext2D, opt: RenderOptions) {
    for (const f of this.world.food) {
      const r = foodRadius(f);
      const rMax = foodRadius({ ...f, amount: f.maxAmount });
      if (rMax > r + 1) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, rMax, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(140,220,90,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const g = ctx.createRadialGradient(f.x - r * 0.3, f.y - r * 0.3, 1, f.x, f.y, r);
      g.addColorStop(0, '#c4f57a');
      g.addColorStop(0.7, '#6fbf3a');
      g.addColorStop(1, '#3f7f22');
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,10,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // seeds
      ctx.fillStyle = 'rgba(30,70,15,0.55)';
      for (let k = 0; k < 5; k++) {
        const ang = k * 1.256 + f.id;
        const rr = r * 0.5;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr, Math.max(1, r * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      if (opt.selectedFoodId === f.id) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `600 ${12 / this.scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.round(f.amount)} food`, f.x, f.y - r - 10);
      }
    }
  }

  private drawAnts(ctx: CanvasRenderingContext2D, opt: RenderOptions) {
    const w = this.world;
    // Keep ants legible when the world is scaled down to fit a small viewport.
    const k = Math.min(1.7, Math.max(1, 0.8 / this.scale));
    const len = 5.5 * k;
    ctx.lineCap = 'round';
    // Batch by colony: one stroke path per colony keeps this fast for thousands of ants.
    for (const c of w.colonies) {
      ctx.strokeStyle = c.traits.color;
      ctx.lineWidth = 2.4 * k;
      ctx.beginPath();
      for (const a of w.ants) {
        if (a.colonyId !== c.id || a.state === 'resting') continue;
        const cx = Math.cos(a.heading) * len * 0.5;
        const cy = Math.sin(a.heading) * len * 0.5;
        ctx.moveTo(a.x - cx, a.y - cy);
        ctx.lineTo(a.x + cx, a.y + cy);
      }
      ctx.stroke();
      // dark head dot for orientation
      ctx.fillStyle = 'rgba(20,14,8,0.9)';
      ctx.beginPath();
      for (const a of w.ants) {
        if (a.colonyId !== c.id || a.state === 'resting') continue;
        const hx = a.x + Math.cos(a.heading) * len * 0.5;
        const hy = a.y + Math.sin(a.heading) * len * 0.5;
        ctx.moveTo(hx + 1.1, hy);
        ctx.arc(hx, hy, 1.1, 0, Math.PI * 2);
      }
      ctx.fill();
      // resting ants: faint dots inside nest
      ctx.fillStyle = c.traits.color + '66';
      ctx.beginPath();
      for (const a of w.ants) {
        if (a.colonyId !== c.id || a.state !== 'resting') continue;
        ctx.moveTo(a.x + 1.2, a.y);
        ctx.arc(a.x, a.y, 1.2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // carried food
    ctx.fillStyle = '#b8f56a';
    ctx.beginPath();
    for (const a of w.ants) {
      if (a.carrying <= 0) continue;
      const hx = a.x + Math.cos(a.heading) * len * 0.7;
      const hy = a.y + Math.sin(a.heading) * len * 0.7;
      ctx.moveTo(hx + 1.6, hy);
      ctx.arc(hx, hy, 1.6, 0, Math.PI * 2);
    }
    ctx.fill();
    // combat flashes
    ctx.fillStyle = 'rgba(255,70,50,0.55)';
    ctx.beginPath();
    for (const a of w.ants) {
      if (a.state !== 'fighting') continue;
      ctx.moveTo(a.x + 5, a.y);
      ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
    }
    ctx.fill();

    // selected ant highlight + sensory radius
    if (opt.selectedAntId >= 0) {
      const a = w.antById(opt.selectedAntId);
      if (a) {
        const c = w.colonyById(a.colonyId);
        const range = c?.traits.senseRange ?? 30;
        ctx.beginPath();
        ctx.arc(a.x, a.y, range, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + Math.cos(a.heading) * 16, a.y + Math.sin(a.heading) * 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private drawCursor(ctx: CanvasRenderingContext2D, opt: RenderOptions) {
    const cur = opt.cursor;
    if (!cur.visible) return;
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, cur.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Canvas 2D renderer. Completely decoupled from React: it reads the World each
 * animation frame and draws. Pheromones are rendered at grid resolution into a
 * small offscreen canvas and upscaled; walls are cached until they change.
 */
import { AntState, foodRadius, type Ant, type FoodSource, type Nest } from '../sim/ant';
import { CELL, GRID_H, GRID_W, PH_ALARM, PH_COUNT, PH_EXPLORE, PH_FOOD, PH_HOME, TUNING, WORLD_H, WORLD_W } from '../sim/constants';
import type { World } from '../sim/world';

export interface RenderOptions {
  showPheromones: boolean;
  channels: boolean[]; // per PH_* index
  pheromoneOpacity: number; // 0..1
  showSensors: boolean;
  selectedAnt: Ant | null;
  selectedFood: FoodSource | null;
  selectedNest: Nest | null;
  brush: { x: number; y: number; radius: number; color: string } | null;
}

export interface Viewport {
  scale: number;
  ox: number;
  oy: number;
}

const ANT_LEN = 7;

export class Renderer {
  private phCanvas: HTMLCanvasElement;
  private phCtx: CanvasRenderingContext2D;
  private phImage: ImageData;
  private wallCanvas: HTMLCanvasElement;
  private wallCtx: CanvasRenderingContext2D;
  private wallVersion = -1;
  viewport: Viewport = { scale: 1, ox: 0, oy: 0 };

  constructor() {
    this.phCanvas = document.createElement('canvas');
    this.phCanvas.width = GRID_W;
    this.phCanvas.height = GRID_H;
    this.phCtx = this.phCanvas.getContext('2d')!;
    this.phImage = this.phCtx.createImageData(GRID_W, GRID_H);
    this.wallCanvas = document.createElement('canvas');
    this.wallCanvas.width = GRID_W;
    this.wallCanvas.height = GRID_H;
    this.wallCtx = this.wallCanvas.getContext('2d')!;
  }

  computeViewport(cssW: number, cssH: number): Viewport {
    const scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    const ox = (cssW - WORLD_W * scale) / 2;
    const oy = (cssH - WORLD_H * scale) / 2;
    this.viewport = { scale, ox, oy };
    return this.viewport;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const v = this.viewport;
    return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale };
  }

  draw(ctx: CanvasRenderingContext2D, world: World, cssW: number, cssH: number, opts: RenderOptions): void {
    const { scale, ox, oy } = this.computeViewport(cssW, cssH);
    ctx.save();
    ctx.fillStyle = '#0d0f0b';
    ctx.fillRect(0, 0, cssW, cssH);

    // soil background
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    const grad = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.2, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.7);
    grad.addColorStop(0, '#221d16');
    grad.addColorStop(1, '#15120d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // pheromones
    if (opts.showPheromones) {
      this.buildPheromoneImage(world, opts.channels);
      ctx.save();
      ctx.globalAlpha = opts.pheromoneOpacity;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.phCanvas, 0, 0, WORLD_W, WORLD_H);
      ctx.restore();
    }

    // walls
    if (world.walls.version !== this.wallVersion) this.rebuildWalls(world);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.wallCanvas, 0, 0, WORLD_W, WORLD_H);
    ctx.restore();

    this.drawFood(ctx, world, opts);
    this.drawNests(ctx, world, opts);
    this.drawAnts(ctx, world, scale);
    if (opts.selectedAnt && opts.selectedAnt.alive) this.drawSelectedAnt(ctx, world, opts.selectedAnt, opts.showSensors, scale);

    if (opts.brush) {
      ctx.beginPath();
      ctx.arc(opts.brush.x, opts.brush.y, opts.brush.radius, 0, Math.PI * 2);
      ctx.strokeStyle = opts.brush.color;
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // world border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  // ------------------------------------------------------------ pheromones
  private buildPheromoneImage(world: World, channels: boolean[]): void {
    const data = this.phImage.data;
    data.fill(0);
    const n = GRID_W * GRID_H;
    // accumulation buffers (premultiplied)
    const accR = accBufR, accG = accBufG, accB = accBufB, accA = accBufA;
    accR.fill(0); accG.fill(0); accB.fill(0); accA.fill(0);
    for (const col of world.colonies) {
      const [cr, cg, cb] = col.rgb;
      for (let ch = 0; ch < PH_COUNT; ch++) {
        if (!channels[ch]) continue;
        const arr = col.pheromones.channels[ch];
        let r = cr, g = cg, b = cb, gain = 0.85, pow = 0.5;
        if (ch === PH_HOME) { r = mix(cr, 235, 0.55); g = mix(cg, 235, 0.55); b = mix(cb, 255, 0.55); gain = 0.55; pow = 0.6; }
        else if (ch === PH_ALARM) { r = mix(cr, 255, 0.7); g = mix(cg, 30, 0.7); b = mix(cb, 30, 0.7); gain = 0.95; pow = 0.45; }
        else if (ch === PH_EXPLORE) { r = mix(cr, 150, 0.6); g = mix(cg, 150, 0.6); b = mix(cb, 150, 0.6); gain = 0.35; pow = 0.7; }
        else if (ch === PH_FOOD) { gain = 0.9; pow = 0.5; }
        for (let i = 0; i < n; i++) {
          const v = arr[i];
          if (v < 0.003) continue;
          const a = Math.min(1, Math.pow(v, pow) * gain);
          accR[i] += r * a; accG[i] += g * a; accB[i] += b * a; accA[i] += a;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const a = accA[i];
      if (a <= 0) continue;
      const o = i * 4;
      data[o] = accR[i] / a;
      data[o + 1] = accG[i] / a;
      data[o + 2] = accB[i] / a;
      data[o + 3] = Math.min(1, a) * 255;
    }
    this.phCtx.putImageData(this.phImage, 0, 0);
  }

  private rebuildWalls(world: World): void {
    this.wallVersion = world.walls.version;
    const ctx = this.wallCtx;
    ctx.clearRect(0, 0, GRID_W, GRID_H);
    const img = ctx.createImageData(GRID_W, GRID_H);
    const d = img.data;
    const cells = world.walls.cells;
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      const o = i * 4;
      // subtle variation for a stony look
      const v = ((i * 2654435761) >>> 0) % 23;
      d[o] = 112 + v; d[o + 1] = 96 + v; d[o + 2] = 78 + v; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------ entities
  private drawFood(ctx: CanvasRenderingContext2D, world: World, opts: RenderOptions): void {
    for (const f of world.foods) {
      const r = foodRadius(f);
      const maxR = 4 + Math.sqrt(f.maxQuantity) * 0.8 + f.radiusBonus;
      if (f.quantity <= 0) {
        const t = Math.max(0, 1 - (world.time - f.depletedAt) / TUNING.depletedLingerSec);
        ctx.beginPath();
        ctx.arc(f.x, f.y, maxR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(160,160,140,${0.4 * t})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      // depletion ring (original size)
      ctx.beginPath();
      ctx.arc(f.x, f.y, maxR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(140,200,90,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const g = ctx.createRadialGradient(f.x - r * 0.3, f.y - r * 0.3, r * 0.1, f.x, f.y, r);
      g.addColorStop(0, '#b6e86a');
      g.addColorStop(1, '#4f9a2c');
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,60,20,0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (opts.selectedFood === f) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawNests(ctx: CanvasRenderingContext2D, world: World, opts: RenderOptions): void {
    for (const n of world.nests) {
      const col = world.colonyById(n.colonyId);
      if (!col) continue;
      const [r, g, b] = col.rgb;
      // mound
      const grad = ctx.createRadialGradient(n.x, n.y, n.radius * 0.2, n.x, n.y, n.radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
      grad.addColorStop(0.75, `rgba(${r},${g},${b},0.55)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.25)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = col.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      // entrance hole
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#0e0c09';
      ctx.fill();
      // label
      ctx.font = '600 12px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(col.name, n.x, n.y - n.radius - 8);
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${col.storedFood.toFixed(0)} food`, n.x, n.y + n.radius + 14);
      if (opts.selectedNest === n) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawAnts(ctx: CanvasRenderingContext2D, world: World, scale: number): void {
    const lw = Math.max(1.6 / scale, 2.4);
    ctx.lineCap = 'round';
    for (const col of world.colonies) {
      ctx.beginPath();
      for (const a of world.ants) {
        if (a.colonyId !== col.id) continue;
        const cx = Math.cos(a.heading), cy = Math.sin(a.heading);
        ctx.moveTo(a.x - cx * ANT_LEN * 0.5, a.y - cy * ANT_LEN * 0.5);
        ctx.lineTo(a.x + cx * ANT_LEN * 0.5, a.y + cy * ANT_LEN * 0.5);
      }
      ctx.strokeStyle = col.color;
      ctx.lineWidth = lw;
      ctx.stroke();
      // dark head dot for readability
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      for (const a of world.ants) {
        if (a.colonyId !== col.id) continue;
        const hx = a.x + Math.cos(a.heading) * ANT_LEN * 0.45, hy = a.y + Math.sin(a.heading) * ANT_LEN * 0.45;
        ctx.moveTo(hx, hy);
        ctx.arc(hx, hy, lw * 0.45, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // carried food
    ctx.fillStyle = '#c4f57a';
    ctx.beginPath();
    for (const a of world.ants) {
      if (a.carrying <= 0) continue;
      const hx = a.x + Math.cos(a.heading) * ANT_LEN * 0.6, hy = a.y + Math.sin(a.heading) * ANT_LEN * 0.6;
      ctx.moveTo(hx, hy);
      ctx.arc(hx, hy, lw * 0.6, 0, Math.PI * 2);
    }
    ctx.fill();
    // fighting sparks
    ctx.fillStyle = 'rgba(255,80,60,0.9)';
    ctx.beginPath();
    for (const a of world.ants) {
      if (a.state !== AntState.Fighting) continue;
      ctx.moveTo(a.x, a.y);
      ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  private drawSelectedAnt(ctx: CanvasRenderingContext2D, world: World, a: Ant, sensors: boolean, scale: number): void {
    const col = world.colonyById(a.colonyId);
    if (!col) return;
    const lw = 1.5 / scale;
    ctx.lineWidth = lw;
    // highlight ring
    ctx.beginPath();
    ctx.arc(a.x, a.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw * 1.5;
    ctx.stroke();
    if (!sensors) return;
    const s = a.senses;
    const range = col.traits.sensoryRange;
    // sensory radius
    ctx.beginPath();
    ctx.arc(a.x, a.y, range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = lw;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    // pheromone probes
    const probes: [number, number, number][] = [
      [a.heading - TUNING.probeAngle, s.foodL, s.homeL],
      [a.heading, s.foodA, s.homeA],
      [a.heading + TUNING.probeAngle, s.foodR, s.homeR],
    ];
    for (const [ang, fv, hv] of probes) {
      const px = a.x + Math.cos(ang) * TUNING.probeDist, py = a.y + Math.sin(ang) * TUNING.probeDist;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(px, py);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 2.5 + fv * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col.rgb[0]},${col.rgb[1]},${col.rgb[2]},${0.3 + Math.min(0.7, fv)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 1.5 + hv * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,240,255,${0.3 + Math.min(0.7, hv)})`;
      ctx.fill();
    }
    // obstacle rays
    const rays: [number, number][] = [
      [a.heading, s.obsF], [a.heading - TUNING.obstacleProbeAngle, s.obsL], [a.heading + TUNING.obstacleProbeAngle, s.obsR],
    ];
    for (const [ang, v] of rays) {
      const len = TUNING.obstacleProbeLen * (v > 0 ? 1 - v : 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + Math.cos(ang) * len, a.y + Math.sin(ang) * len);
      ctx.strokeStyle = v > 0 ? `rgba(255,${Math.round(200 - v * 180)},60,0.9)` : 'rgba(120,255,160,0.5)';
      ctx.lineWidth = lw * 1.5;
      ctx.stroke();
    }
    // perceived objects
    const drawLink = (ang: number, d: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + Math.cos(a.heading + ang) * d, a.y + Math.sin(a.heading + ang) * d);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (s.foodSeen) drawLink(s.foodBearing, s.foodDist + 4, 'rgba(180,255,120,0.9)');
    if (s.nestSeen) drawLink(s.nestBearing, s.nestDist + 4, 'rgba(255,255,255,0.8)');
    if (s.rivalSeen) drawLink(s.rivalBearing, s.rivalDist, 'rgba(255,90,90,0.9)');
    // heading / steering intent
    const hx = a.x + Math.cos(a.heading) * 14, hy = a.y + Math.sin(a.heading) * 14;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw * 1.5;
    ctx.stroke();
  }
}

const accBufR = new Float32Array(GRID_W * GRID_H);
const accBufG = new Float32Array(GRID_W * GRID_H);
const accBufB = new Float32Array(GRID_W * GRID_H);
const accBufA = new Float32Array(GRID_W * GRID_H);

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export { CELL };

// Procedural terrain: biomes, caves, ores, vegetation. Pure & deterministic (worker-safe).
import { B, CS, CH, SEA, CVOL, T_KIND, K } from './blocks';
import { Noise, hash2, hash3, mulberry32, smoothstep } from './noise';

export const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, TUNDRA: 5, TAIGA: 6, MOUNTAINS: 7, BIRCH: 8 } as const;
export const BIOME_NAMES = ['Ocean', 'Beach', 'Plains', 'Forest', 'Desert', 'Snowy Tundra', 'Taiga', 'Mountains', 'Birch Forest'];

export interface Col { h: number; t: number; hu: number; biome: number; mt: number }

const SPL: [number, number][] = [[-1, -30], [-0.5, -22], [-0.28, -10], [-0.14, -4], [-0.05, 0], [0.02, 4], [0.15, 7], [0.4, 12], [1, 19]];
function spline(c: number) {
  if (c <= SPL[0][0]) return SPL[0][1];
  for (let i = 1; i < SPL.length; i++) {
    if (c <= SPL[i][0]) {
      const a = SPL[i - 1], b = SPL[i];
      return a[1] + ((c - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    }
  }
  return SPL[SPL.length - 1][1];
}

export class Terrain {
  noise: Noise;
  constructor(public seed: number) { this.noise = new Noise(seed); }

  col(wx: number, wz: number, o: Col): Col {
    const n = this.noise;
    const cont = n.fbm2(wx * 0.0022 + 11.3, wz * 0.0022 - 7.7, 4) * 1.35 + 0.07;
    const ero = n.fbm2(wx * 0.0055 - 31.1, wz * 0.0055 + 19.7, 3);
    const hill = n.fbm2(wx * 0.014 + 3.3, wz * 0.014 + 9.1, 4);
    const mtn = n.fbm2(wx * 0.003 + 77.7, wz * 0.003 + 55.5, 3) * 1.4;
    const rf = n.fbm2(wx * 0.009 - 5.5, wz * 0.009 + 1.5, 3);
    const r = Math.max(0, 1 - Math.min(1, Math.abs(rf) * 2.4));
    const land = smoothstep(-0.14, 0.06, cont);
    const hillAmp = 2.5 + 9 * smoothstep(-0.3, 0.5, ero);
    let hgt = SEA + spline(cont) + hill * hillAmp * land;
    const mt = smoothstep(0.12, 0.42, mtn) * smoothstep(0.0, 0.22, cont);
    hgt += mt * (14 + 46 * r * r);
    const h = Math.max(3, Math.min(CH - 8, Math.round(hgt)));
    let t = n.fbm2(wx * 0.0016 + 200, wz * 0.0016 - 100, 3) * 1.6;
    const hu = n.fbm2(wx * 0.0018 - 400, wz * 0.0018 + 300, 3) * 1.6;
    t -= Math.max(0, h - SEA - 22) * 0.012;
    let biome: number;
    if (h < SEA - 1) biome = BIOME.OCEAN;
    else if (h <= SEA + 1 && mt < 0.2) biome = BIOME.BEACH;
    else if (mt > 0.38) biome = BIOME.MOUNTAINS;
    else if (t < -0.17) biome = hu > 0.0 ? BIOME.TAIGA : BIOME.TUNDRA;
    else if (t > 0.2 && hu < 0.08) biome = BIOME.DESERT;
    else if (hu > 0.1) biome = hu > 0.34 || n.n2(wx * 0.01, wz * 0.01) > 0.45 ? BIOME.BIRCH : BIOME.FOREST;
    else biome = BIOME.PLAINS;
    o.h = h; o.t = t; o.hu = hu; o.biome = biome; o.mt = mt;
    return o;
  }

  topBlock(biome: number, h: number, wx: number, wz: number): number {
    const p = hash2(wx >> 2, wz >> 2, this.seed + 91);
    if (h < SEA) return biome === BIOME.OCEAN && h < SEA - 6 ? (p > 0.5 ? B.GRAVEL : B.DIRT) : p > 0.8 ? B.GRAVEL : h < SEA - 2 && p < 0.3 ? B.DIRT : B.SAND;
    switch (biome) {
      case BIOME.DESERT: case BIOME.BEACH: return B.SAND;
      case BIOME.TUNDRA: case BIOME.TAIGA: return B.SNOW_GRASS;
      case BIOME.MOUNTAINS: return h > SEA + 52 ? B.SNOW : h > SEA + 26 ? (p > 0.85 ? B.GRAVEL : B.STONE) : B.GRASS;
      default: return B.GRASS;
    }
  }

  generate(cx: number, cz: number) {
    const blocks = new Uint8Array(CVOL);
    const biomeA = new Uint8Array(256);
    const climate = new Uint8Array(512);
    const hm = new Int16Array(256);
    const hts = new Int16Array(256);
    const x0 = cx * CS, z0 = cz * CS;
    const n = this.noise, seed = this.seed;
    const tmp: Col = { h: 0, t: 0, hu: 0, biome: 0, mt: 0 };
    // coarse cave fields (4-block grid, trilinear interpolated)
    const GY = 33;
    const fa = new Float32Array(25 * GY), fb = new Float32Array(25 * GY), fc = new Float32Array(25 * GY);
    for (let gx = 0; gx < 5; gx++) for (let gz = 0; gz < 5; gz++) for (let gy = 0; gy < GY; gy++) {
      const wx = x0 + gx * 4, wz = z0 + gz * 4, wy = gy * 4, i = (gx * 5 + gz) * GY + gy;
      fa[i] = n.n3(wx * 0.022, wy * 0.035, wz * 0.022);
      fb[i] = n.n3(wx * 0.022 + 100.5, wy * 0.035 + 37.1, wz * 0.022 - 60.3);
      fc[i] = n.n3(wx * 0.011 - 20, wy * 0.02, wz * 0.011 + 90);
    }
    const interp = (f: Float32Array, gx: number, gz: number, gy: number, fx: number, fy: number, fz: number) => {
      const b = (gx * 5 + gz) * GY + gy;
      const c00 = f[b] + (f[b + 1] - f[b]) * fy;
      const c01 = f[b + GY] + (f[b + GY + 1] - f[b + GY]) * fy;
      const c10 = f[b + 5 * GY] + (f[b + 5 * GY + 1] - f[b + 5 * GY]) * fy;
      const c11 = f[b + 5 * GY + GY] + (f[b + 5 * GY + GY + 1] - f[b + 5 * GY + GY]) * fy;
      const z0v = c00 + (c01 - c00) * fz, z1v = c10 + (c11 - c10) * fz;
      return z0v + (z1v - z0v) * fx;
    };

    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const ci = lz * 16 + lx, wx = x0 + lx, wz = z0 + lz;
      this.col(wx, wz, tmp);
      const h = tmp.h, biome = tmp.biome;
      hts[ci] = h; biomeA[ci] = biome;
      climate[ci * 2] = Math.max(0, Math.min(255, ((tmp.t * 0.5 + 0.5) * 255) | 0));
      climate[ci * 2 + 1] = Math.max(0, Math.min(255, ((tmp.hu * 0.5 + 0.5) * 255) | 0));
      const top = this.topBlock(biome, h, wx, wz);
      const gx = lx >> 2, gz = lz >> 2, fx = (lx & 3) / 4, fz = (lz & 3) / 4;
      const limit = h < SEA ? h - 5 : h - 2;
      const depth = 3 + (hash2(wx, wz, seed) > 0.6 ? 1 : 0);
      for (let y = 0; y <= h; y++) {
        let id: number = B.STONE;
        if (y === 0) id = B.BEDROCK;
        else if (y <= 2 && hash3(wx, y, wz, seed) < 0.5) id = B.BEDROCK;
        else if (y === h) id = top;
        else if (y > h - depth) {
          if (top === B.SAND) id = B.SAND;
          else if (top === B.SNOW || top === B.STONE) id = B.STONE;
          else if (top === B.GRAVEL) id = B.GRAVEL;
          else id = B.DIRT;
        } else if (y > h - depth - 3 && (top === B.SAND) && h >= SEA - 1) id = B.SANDSTONE;
        if (y >= 3 && y <= limit && id !== B.BEDROCK) {
          const gy = y >> 2, fy = (y & 3) / 4;
          let carve = false;
          const a = interp(fa, gx, gz, gy, fx, fy, fz);
          if (a > -0.12 && a < 0.12) {
            const b = interp(fb, gx, gz, gy, fx, fy, fz);
            if (a * a + b * b < 0.0125) carve = true;
          }
          if (!carve && y < 46 && interp(fc, gx, gz, gy, fx, fy, fz) > 0.6) carve = true;
          if (carve) id = y <= 10 ? B.LAVA : B.AIR;
        }
        blocks[(y * 16 + lz) * 16 + lx] = id;
      }
      if (h < SEA) {
        const ice = tmp.t < -0.3;
        for (let y = h + 1; y <= SEA; y++) blocks[(y * 16 + lz) * 16 + lx] = y === SEA && ice ? B.ICE : B.WATER;
      }
    }

    // ores & underground blobs
    const rnd = mulberry32(Math.floor(hash3(cx, 7, cz, seed) * 4294967296));
    const vein = (id: number, tries: number, size: number, ymin: number, ymax: number, only: number = B.STONE) => {
      for (let t = 0; t < tries; t++) {
        let x = 1 + ((rnd() * 14) | 0), z = 1 + ((rnd() * 14) | 0), y = ymin + ((rnd() * (ymax - ymin)) | 0);
        for (let s = 0; s < size; s++) {
          const i = (y * 16 + z) * 16 + x;
          if (blocks[i] === only) blocks[i] = id;
          x = Math.max(0, Math.min(15, x + ((rnd() * 3) | 0) - 1));
          z = Math.max(0, Math.min(15, z + ((rnd() * 3) | 0) - 1));
          y = Math.max(1, Math.min(CH - 2, y + ((rnd() * 3) | 0) - 1));
        }
      }
    };
    vein(B.GRAVEL, 4, 20, 5, 70);
    vein(B.DIRT, 5, 22, 10, 80);
    vein(B.COAL_ORE, 22, 9, 5, 95);
    vein(B.IRON_ORE, 14, 6, 4, 64);
    vein(B.GOLD_ORE, 3, 5, 4, 30);
    vein(B.DIAMOND_ORE, 2, 4, 3, 16);

    // vegetation (single-column features)
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const ci = lz * 16 + lx, h = hts[ci], biome = biomeA[ci], wx = x0 + lx, wz = z0 + lz;
      if (h < SEA || h + 2 >= CH) continue;
      const topId = blocks[(h * 16 + lz) * 16 + lx];
      const above = ((h + 1) * 16 + lz) * 16 + lx;
      const r = hash2(wx, wz, seed + 13);
      if (topId === B.GRASS) {
        let id = 0;
        if (biome === BIOME.PLAINS) id = r < 0.22 ? B.TALLGRASS : r < 0.235 ? B.FLOWER_RED : r < 0.25 ? B.FLOWER_YELLOW : 0;
        else if (biome === BIOME.FOREST || biome === BIOME.BIRCH) id = r < 0.1 ? B.TALLGRASS : r < 0.108 ? B.FLOWER_RED : r < 0.114 ? B.FLOWER_YELLOW : 0;
        else if (biome === BIOME.MOUNTAINS) id = r < 0.05 ? B.TALLGRASS : 0;
        if (id) blocks[above] = id;
      } else if (topId === B.SAND && biome === BIOME.DESERT) {
        if (r < 0.012) blocks[above] = B.DEADBUSH;
        else if (r > 0.985) {
          const ch = 1 + ((hash2(wx, wz, seed + 5) * 3) | 0);
          for (let k = 1; k <= ch; k++) blocks[((h + k) * 16 + lz) * 16 + lx] = B.CACTUS;
        }
      }
    }

    // trees (scan an extended region so canopies cross chunk borders deterministically)
    const put = (x: number, y: number, z: number, id: number, trunk: boolean) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= CH) return;
      const i = (y * 16 + lz) * 16 + lx, cur = blocks[i];
      if (cur === 0 || T_KIND[cur] === K.CROSS || (trunk && (cur === B.LEAVES || cur === B.BIRCH_LEAVES || cur === B.SPRUCE_LEAVES))) blocks[i] = id;
    };
    const c2: Col = { h: 0, t: 0, hu: 0, biome: 0, mt: 0 };
    for (let dz = -3; dz < 19; dz++) for (let dx = -3; dx < 19; dx++) {
      const wx = x0 + dx, wz = z0 + dz;
      const r = hash2(wx, wz, seed + 7);
      if (r > 0.075) continue;
      let h: number, biome: number;
      if (dx >= 0 && dx < 16 && dz >= 0 && dz < 16) { h = hts[dz * 16 + dx]; biome = biomeA[dz * 16 + dx]; }
      else { this.col(wx, wz, c2); h = c2.h; biome = c2.biome; }
      if (h < SEA || h + 14 >= CH) continue;
      let dens = 0, kind = 0;
      switch (biome) {
        case BIOME.FOREST: dens = 0.06; kind = 0; break;
        case BIOME.BIRCH: dens = 0.05; kind = 1; break;
        case BIOME.TAIGA: dens = 0.045; kind = 2; break;
        case BIOME.PLAINS: dens = 0.004; kind = 0; break;
        case BIOME.TUNDRA: dens = 0.003; kind = 2; break;
        case BIOME.MOUNTAINS: dens = 0.012; kind = 2; break;
        default: continue;
      }
      if (r >= dens) continue;
      const top = this.topBlock(biome, h, wx, wz);
      if (top !== B.GRASS && top !== B.SNOW_GRASS) continue;
      const rr = hash2(wx, wz, seed + 21), r2 = hash2(wx, wz, seed + 22);
      const base = h + 1;
      if (kind === 2) {
        const th = 6 + ((rr * 4) | 0);
        for (let y = 0; y < th; y++) put(wx, base + y, wz, B.SPRUCE_LOG, true);
        const topY = base + th;
        for (let k = 0; k <= th - 2; k++) {
          const rad = Math.min(3, Math.ceil(k / 2));
          const y = topY - k;
          for (let ox = -rad; ox <= rad; ox++) for (let oz = -rad; oz <= rad; oz++) {
            if (ox * ox + oz * oz <= rad * rad + 1 && !(ox === 0 && oz === 0 && y < topY - 1 && y >= base + 1 && false)) put(wx + ox, y, wz + oz, B.SPRUCE_LEAVES, false);
          }
        }
        put(wx, topY + 1, wz, B.SPRUCE_LEAVES, false);
      } else {
        const th = (kind === 1 ? 5 : 4) + ((rr * 3) | 0);
        const log = kind === 1 ? B.BIRCH_LOG : B.LOG, leaf = kind === 1 ? B.BIRCH_LEAVES : B.LEAVES;
        for (let y = 0; y < th; y++) put(wx, base + y, wz, log, true);
        for (let dy = -2; dy <= 1; dy++) {
          const rad = dy <= 0 ? 2 : 1, y = base + th + dy - 1;
          for (let ox = -rad; ox <= rad; ox++) for (let oz = -rad; oz <= rad; oz++) {
            if (Math.abs(ox) === rad && Math.abs(oz) === rad && (dy >= 1 || hash3(wx + ox, y, wz + oz, seed) > 0.55 + r2 * 0.1)) continue;
            put(wx + ox, y, wz + oz, leaf, false);
          }
        }
      }
    }

    // surface heightmap (highest non-plant, non-air block)
    for (let ci = 0; ci < 256; ci++) {
      let y = CH - 1;
      for (; y > 0; y--) {
        const id = blocks[y * 256 + ci];
        if (id !== 0 && T_KIND[id] !== K.CROSS && T_KIND[id] !== K.TORCH) break;
      }
      hm[ci] = y;
    }
    return { blocks, biome: biomeA, climate, hm };
  }
}

export function findSpawn(t: Terrain) {
  const c: Col = { h: 0, t: 0, hu: 0, biome: 0, mt: 0 };
  for (let r = 0; r < 600; r += 6) {
    const steps = Math.max(1, Math.floor(r / 6) * 4);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      t.col(x, z, c);
      if (c.h >= SEA + 2 && (c.biome === BIOME.PLAINS || c.biome === BIOME.FOREST || c.biome === BIOME.BIRCH || c.biome === BIOME.TAIGA)) return { x, z };
    }
  }
  return { x: 0, z: 0 };
}

// Procedural terrain: continents, mountains, rivers, biomes, caves, ores, trees and flora.
// Pure functions of (seed, chunk coords) so any chunk can be regenerated identically.
import { CS, CH, SEA, idx } from './constants.js';
import { B } from './blocks.js';
import { Simplex, mulberry32, hash2, hash3, clamp, lerp, smoothstep } from './noise.js';

export const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, SNOW: 5, MOUNTAINS: 6, RIVER: 7, BIRCH: 8 };
export const BIOME_NAMES = ['Ocean', 'Beach', 'Plains', 'Forest', 'Desert', 'Snowy Taiga', 'Mountains', 'River', 'Birch Forest'];

const SPLINE = [[-1, 8], [-0.55, 15], [-0.3, 24], [-0.14, 31], [-0.06, 34.5], [0.0, 37.5], [0.07, 40], [0.2, 43], [0.5, 48], [1, 55]];
function landSpline(c) {
  if (c <= SPLINE[0][0]) return SPLINE[0][1];
  for (let i = 1; i < SPLINE.length; i++) {
    if (c <= SPLINE[i][0]) {
      const a = SPLINE[i - 1], b = SPLINE[i];
      return lerp(a[1], b[1], (c - a[0]) / (b[0] - a[0]));
    }
  }
  return SPLINE[SPLINE.length - 1][1];
}

export class WorldGen {
  constructor(seed) {
    this.seed = seed | 0;
    const s = this.seed;
    this.nCont = new Simplex(s + 101);
    this.nEro = new Simplex(s + 202);
    this.nRid = new Simplex(s + 303);
    this.nDet = new Simplex(s + 404);
    this.nTemp = new Simplex(s + 505);
    this.nHum = new Simplex(s + 606);
    this.nRiv = new Simplex(s + 707);
    this.nCave1 = new Simplex(s + 808);
    this.nCave2 = new Simplex(s + 909);
    this.nCave3 = new Simplex(s + 1010);
    this.nMisc = new Simplex(s + 1111);
    this.nFlower = new Simplex(s + 1212);
  }

  // Terrain description for one world column. `out` may be provided to avoid allocation.
  column(x, z, out = {}) {
    const cont = this.nCont.fbm2(x / 700, z / 700, 4) + 0.2;
    const ero = this.nEro.fbm2(x / 300 + 31.7, z / 300 - 12.3, 3);
    const ridgeRaw = 1 - Math.abs(this.nRid.fbm2(x / 150, z / 150, 3, 2.1, 0.5) * 1.8);
    const ridge = clamp(ridgeRaw, 0, 1);
    const detail = this.nDet.fbm2(x / 60, z / 60, 4);
    const temp = clamp(this.nTemp.fbm2(x / 520 + 5, z / 520 + 9, 2) * 1.7, -1, 1);
    const hum = clamp(this.nHum.fbm2(x / 430 - 40, z / 430 + 70, 2) * 1.8, -1, 1);
    const riv = Math.abs(this.nRiv.fbm2(x / 420, z / 420, 2));

    let h = landSpline(cont);
    const landF = smoothstep(-0.1, 0.12, cont);
    h += detail * (2.2 + 8 * landF * clamp(ero + 0.55, 0.15, 1.2));
    const mt = smoothstep(0.1, 0.4, ero) * smoothstep(0.0, 0.22, cont);
    h += mt * (8 + Math.pow(ridge, 1.5) * 62);
    const rf = (1 - smoothstep(0.010, 0.05, riv)) * landF * (1 - mt);
    const riverBed = SEA - 3.5;
    if (h > riverBed) h = lerp(h, riverBed, clamp(rf * 1.1, 0, 1));
    h = clamp(Math.floor(h), 3, CH - 12);

    let biome;
    if (h < SEA - 1) biome = rf > 0.5 ? BIOME.RIVER : BIOME.OCEAN;
    else if (mt > 0.45 && h > SEA + 12) biome = BIOME.MOUNTAINS;
    else if (h <= SEA + 1) biome = BIOME.BEACH;
    else if (temp > 0.33 && hum < 0.15) biome = BIOME.DESERT;
    else if (temp < -0.45) biome = BIOME.SNOW;
    else if (hum > 0.12) biome = this.nMisc.noise2(x / 140, z / 140) > 0.25 ? BIOME.BIRCH : BIOME.FOREST;
    else biome = BIOME.PLAINS;

    out.h = h; out.biome = biome; out.temp = temp; out.hum = hum; out.mt = mt; out.rf = rf;
    return out;
  }

  surfaceBlocks(col) {
    switch (col.biome) {
      case BIOME.DESERT: return [B.SAND, B.SAND, 5];
      case BIOME.BEACH: return [B.SAND, B.SAND, 3];
      case BIOME.SNOW: return [B.SNOW_GRASS, B.DIRT, 3];
      case BIOME.OCEAN: return col.h > SEA - 6 ? [B.SAND, B.SAND, 3] : [B.GRAVEL, B.DIRT, 3];
      case BIOME.RIVER: return [B.SAND, B.DIRT, 3];
      case BIOME.MOUNTAINS: return col.h < 70 ? [B.GRASS, B.DIRT, 2] : [B.STONE, B.STONE, 0];
      default: return [B.GRASS, B.DIRT, 3];
    }
  }

  findSpawn() {
    const col = {}, nb = {};
    for (let r = 0; r < 900; r += 6) {
      const steps = Math.max(1, Math.floor((r * 6.28) / 14));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
        this.column(x, z, col);
        if (col.h < SEA + 2 || (col.biome !== BIOME.PLAINS && col.biome !== BIOME.FOREST && col.biome !== BIOME.BIRCH)) continue;
        // prefer gentle terrain: neighbours within a few blocks of the same height
        let flat = true;
        for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [5, 5], [-5, -5]]) {
          this.column(x + dx, z + dz, nb);
          if (Math.abs(nb.h - col.h) > 2 || nb.h < SEA + 1) { flat = false; break; }
        }
        if (flat) return { x, z, y: col.h + 1 };
      }
    }
    return { x: 0, z: 0, y: 60 };
  }

  // climate/biome arrays only (used when a chunk is restored from a save)
  fillClimate(cx, cz, biomes, climate) {
    const col = {};
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      this.column(cx * CS + x, cz * CS + z, col);
      const i2 = z * CS + x;
      biomes[i2] = col.biome;
      climate[i2 * 2] = Math.round((col.temp * 0.5 + 0.5) * 255);
      climate[i2 * 2 + 1] = Math.round((col.hum * 0.5 + 0.5) * 255);
    }
  }

  // Fill `blocks` (Uint8Array CHUNK_VOL), `meta`, `biomes` (256), `climate` (512). Returns max non-air y.
  generate(cx, cz, blocks, meta, biomes, climate) {
    const ox = cx * CS, oz = cz * CS;
    const cols = new Array(256);
    const rnd = mulberry32(hash2(cx, cz, this.seed) * 4294967296);
    let maxH = 0;

    // --- columns, base fill and surface -----------------------------------------------------
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const col = this.column(ox + x, oz + z, {});
      const i2 = z * CS + x;
      cols[i2] = col;
      biomes[i2] = col.biome;
      climate[i2 * 2] = Math.round((col.temp * 0.5 + 0.5) * 255);
      climate[i2 * 2 + 1] = Math.round((col.hum * 0.5 + 0.5) * 255);
      if (col.h > maxH) maxH = col.h;
      const h = col.h;
      const [top, filler, fdepth] = this.surfaceBlocks(col);
      const deepY = 11 + Math.floor(hash2(ox + x, oz + z, this.seed + 5) * 4);
      const dirtDepth = fdepth + (hash2(ox + x, oz + z, this.seed + 9) < 0.5 ? 1 : 0);
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === 0) b = B.BEDROCK;
        else if (y <= 2 && rnd() < 0.7 - y * 0.25) b = B.BEDROCK;
        else if (y === h) {
          b = top;
          if (col.biome === BIOME.MOUNTAINS && h > 70) {
            const sn = h + this.nMisc.noise2((ox + x) / 12, (oz + z) / 12) * 7;
            if (sn > 92) b = B.SNOW;
            else if (hash2(ox + x, oz + z, 3) < 0.07 || this.nMisc.noise2((ox + x) / 30 + 9, (oz + z) / 30) > 0.45) b = B.GRAVEL;
          }
          if (col.biome === BIOME.MOUNTAINS && h <= 70 && h > 62) b = this.nMisc.noise2((ox + x) / 20, (oz + z) / 20) > 0.1 ? B.GRASS : B.STONE;
        } else if (y >= h - dirtDepth) {
          b = filler;
          if (col.biome === BIOME.MOUNTAINS && h > 70) b = B.STONE;
          if (col.biome === BIOME.DESERT && y < h - 4) b = B.SANDSTONE;
        } else {
          b = y < deepY ? B.DEEPSLATE : B.STONE;
          if (col.biome === BIOME.DESERT && y >= h - 8 && y < h - 4) b = B.SANDSTONE;
        }
        blocks[idx(x, y, z)] = b;
      }
    }

    // --- caves ---------------------------------------------------------------------------------
    this.carveCaves(cx, cz, blocks, cols, maxH);

    // --- water, ice -------------------------------------------------------------------------
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const col = cols[z * CS + x];
      if (col.h < SEA) {
        for (let y = col.h + 1; y <= SEA; y++) blocks[idx(x, y, z)] = B.WATER;
        if (col.temp < -0.3) blocks[idx(x, SEA, z)] = B.ICE;
      }
    }

    // --- ores & pockets ---------------------------------------------------------------------
    const vein = (id, tries, y0, y1, size) => {
      for (let t = 0; t < tries; t++) {
        const px = 2 + ((rnd() * 12) | 0), pz = 2 + ((rnd() * 12) | 0), py = y0 + ((rnd() * (y1 - y0)) | 0);
        const r = Math.cbrt(size) * (0.7 + rnd() * 0.3);
        const ri = Math.ceil(r);
        for (let dx = -ri; dx <= ri; dx++) for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) {
          if (dx * dx + dy * dy + dz * dz > r * r * (0.55 + rnd() * 0.6)) continue;
          const x = px + dx, y = py + dy, z = pz + dz;
          if (x < 0 || x >= CS || z < 0 || z >= CS || y < 1 || y >= CH) continue;
          const i = idx(x, y, z), cur = blocks[i];
          if (cur === B.STONE || cur === B.DEEPSLATE) blocks[i] = id;
        }
      }
    };
    vein(B.DIRT, 6, 8, 70, 30);
    vein(B.GRAVEL, 5, 8, 60, 26);
    vein(B.COAL_ORE, 20, 4, 96, 14);
    vein(B.IRON_ORE, 14, 3, 64, 9);
    vein(B.GOLD_ORE, 3, 3, 30, 7);
    vein(B.DIAMOND_ORE, 3, 2, 16, 6);
    vein(B.IRON_ORE, 3, 60, 90, 6);

    // --- trees, cacti, flora ----------------------------------------------------------------
    this.decorate(cx, cz, blocks, meta, cols);

    // max y
    let maxY = 0;
    for (let y = CH - 1; y > 0; y--) {
      const base = y << 8;
      for (let i = 0; i < 256; i++) if (blocks[base + i] !== 0) { maxY = y; y = 0; break; }
    }
    return maxY;
  }

  carveCaves(cx, cz, blocks, cols, maxH) {
    const GX = 5, GZ = 5, topY = Math.min(CH - 1, maxH + 2);
    const GY = (topY >> 2) + 2;
    const n = GX * GZ * GY;
    const a = new Float32Array(n), b = new Float32Array(n), c = new Float32Array(n);
    const ox = cx * CS, oz = cz * CS;
    for (let gx = 0; gx < GX; gx++) for (let gz = 0; gz < GZ; gz++) for (let gy = 0; gy < GY; gy++) {
      const wx = ox + gx * 4, wy = gy * 4, wz = oz + gz * 4;
      const i = (gx * GZ + gz) * GY + gy;
      a[i] = this.nCave1.noise3(wx / 44, wy / 30, wz / 44);
      b[i] = this.nCave2.noise3(wx / 44 + 100, wy / 30, wz / 44);
      c[i] = wy < 56 ? this.nCave3.noise3(wx / 70, wy / 34, wz / 70) : 0;
    }
    const T0 = 0.0058;
    for (let x = 0; x < CS; x++) {
      const gx = x >> 2, fx = (x & 3) / 4;
      for (let z = 0; z < CS; z++) {
        const gz = z >> 2, fz = (z & 3) / 4;
        const col = cols[z * CS + x];
        const h = col.h;
        const landHigh = h > SEA + 1;
        const yMax = Math.min(h, topY);
        const b00 = (gx * GZ + gz) * GY, b10 = ((gx + 1) * GZ + gz) * GY, b01 = (gx * GZ + gz + 1) * GY, b11 = ((gx + 1) * GZ + gz + 1) * GY;
        for (let y = 3; y <= yMax; y++) {
          const depth = h - y;
          if (landHigh ? depth < 1 : depth < 6) continue;
          if (!landHigh || y <= SEA + 1) { if (depth < 6) continue; }
          const gy = y >> 2, fy = (y & 3) / 4;
          const lerpField = (arr) => {
            const c000 = arr[b00 + gy], c001 = arr[b00 + gy + 1], c100 = arr[b10 + gy], c101 = arr[b10 + gy + 1];
            const c010 = arr[b01 + gy], c011 = arr[b01 + gy + 1], c110 = arr[b11 + gy], c111 = arr[b11 + gy + 1];
            const x00 = c000 + (c100 - c000) * fx, x01 = c001 + (c101 - c001) * fx;
            const x10 = c010 + (c110 - c010) * fx, x11 = c011 + (c111 - c011) * fx;
            const y0 = x00 + (x10 - x00) * fz, y1 = x01 + (x11 - x01) * fz;
            return y0 + (y1 - y0) * fy;
          };
          const va = lerpField(a), vb = lerpField(b);
          const thr = T0 * (depth < 8 ? 0.4 + 0.6 * (depth / 8) : 1);
          let carve = va * va + vb * vb < thr;
          if (!carve && y < 56 && depth > 8) carve = lerpField(c) > 0.6;
          if (carve) {
            const i = idx(x, y, z);
            if (blocks[i] === B.BEDROCK) continue;
            blocks[i] = y <= 10 ? B.LAVA : B.AIR;
          }
        }
      }
    }
  }

  decorate(cx, cz, blocks, meta, cols) {
    const ox = cx * CS, oz = cz * CS;
    const seed = this.seed;
    const set = (x, y, z, id, replaceLeaves = true) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= CH) return;
      const i = idx(lx, y, lz);
      const cur = blocks[i];
      if (id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES) {
        if (cur !== B.AIR && !(replaceLeaves && (cur === B.TALL_GRASS))) return;
      }
      blocks[i] = id;
    };
    const tcol = {};
    // trees on a jittered grid so neighbouring chunks agree on placement
    const CELL = 5;
    const x0 = Math.floor((ox - 4) / CELL), x1 = Math.floor((ox + CS + 3) / CELL);
    const z0 = Math.floor((oz - 4) / CELL), z1 = Math.floor((oz + CS + 3) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const tx = gx * CELL + Math.floor(hash2(gx, gz, seed + 11) * CELL);
      const tz = gz * CELL + Math.floor(hash2(gx, gz, seed + 12) * CELL);
      if (tx < ox - 3 || tx >= ox + CS + 3 || tz < oz - 3 || tz >= oz + CS + 3) continue;
      const col = this.column(tx, tz, tcol);
      const roll = hash2(gx, gz, seed + 13);
      let dens = 0, type = 'oak';
      switch (col.biome) {
        case BIOME.FOREST: dens = 0.78; type = hash2(gx, gz, seed + 14) < 0.15 ? 'birch' : 'oak'; break;
        case BIOME.BIRCH: dens = 0.7; type = hash2(gx, gz, seed + 14) < 0.8 ? 'birch' : 'oak'; break;
        case BIOME.PLAINS: dens = 0.035; break;
        case BIOME.SNOW: dens = 0.5; type = 'spruce'; break;
        case BIOME.MOUNTAINS: dens = col.h < 74 ? 0.25 : 0; type = 'spruce'; break;
        default: dens = 0;
      }
      if (roll > dens) continue;
      const surf = this.surfaceBlocks(col)[0];
      if (surf !== B.GRASS && surf !== B.SNOW_GRASS) continue;
      if (col.biome === BIOME.MOUNTAINS && this.nMisc.noise2(tx / 20, tz / 20) <= 0.1 && col.h > 62) continue;
      // make sure the root block still exists (caves may have removed it) when the root is inside this chunk
      const lx = tx - ox, lz = tz - oz;
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) {
        const rb = blocks[idx(lx, col.h, lz)];
        if (rb !== B.GRASS && rb !== B.SNOW_GRASS) continue;
      }
      this.placeTree(type, tx, col.h + 1, tz, hash2(tx, tz, seed + 15), set);
    }

    // cacti
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const col = cols[z * CS + x];
      const wx = ox + x, wz = oz + z;
      const i0 = idx(x, col.h, z);
      const top = blocks[i0];
      const above = col.h + 1 < CH ? blocks[idx(x, col.h + 1, z)] : 0;
      if (above !== B.AIR) continue;
      const r = hash2(wx, wz, seed + 21);
      if (col.biome === BIOME.DESERT && top === B.SAND) {
        if (r < 0.006 && this.nearClear(blocks, x, col.h + 1, z)) {
          const hgt = 1 + Math.floor(hash2(wx, wz, seed + 22) * 3);
          for (let k = 0; k < hgt; k++) blocks[idx(x, col.h + 1 + k, z)] = B.CACTUS;
        } else if (r > 0.97) blocks[idx(x, col.h + 1, z)] = B.DEAD_BUSH;
      } else if (top === B.GRASS) {
        const flowery = this.nFlower.noise2(wx / 40, wz / 40) > 0.35;
        let pGrass = 0.14, pFlower = flowery ? 0.1 : 0.008;
        if (col.biome === BIOME.FOREST || col.biome === BIOME.BIRCH) { pGrass = 0.08; pFlower = flowery ? 0.04 : 0.004; }
        if (col.biome === BIOME.PLAINS) pGrass = 0.22;
        if (col.biome === BIOME.MOUNTAINS) { pGrass = 0.05; pFlower = 0.002; }
        if (r < pGrass) blocks[idx(x, col.h + 1, z)] = B.TALL_GRASS;
        else if (r < pGrass + pFlower) blocks[idx(x, col.h + 1, z)] = hash2(wx, wz, seed + 23) < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW;
      }
    }
  }

  nearClear(blocks, x, y, z) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, zz = z + dz;
      if (xx < 0 || xx >= CS || zz < 0 || zz >= CS) continue;
      if (blocks[idx(xx, y, zz)] === B.CACTUS) return false;
    }
    return true;
  }

  // `set(x,y,z,id)` writes in world coords, ignoring cells outside the chunk being generated.
  placeTree(type, x, y0, z, r, set) {
    if (type === 'spruce') {
      const h = 6 + Math.floor(r * 4);
      for (let y = 0; y <= h; y++) set(x, y0 + y, z, B.SPRUCE_LOG);
      const layers = h - 1;
      for (let k = 0; k <= layers; k++) {
        const y = y0 + h + 1 - k;
        const rad = Math.min(3, Math.floor((k + 1) / 1.8));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (rad >= 2 && Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
          if (dx === 0 && dz === 0 && k > 0 && y <= y0 + h) continue;
          set(x + dx, y, z + dz, B.SPRUCE_LEAVES);
        }
      }
      return;
    }
    const birch = type === 'birch';
    const h = birch ? 5 + Math.floor(r * 3) : 4 + Math.floor(r * 3);
    const log = birch ? B.BIRCH_LOG : B.LOG, leaf = birch ? B.BIRCH_LEAVES : B.LEAVES;
    for (let y = 0; y < h; y++) set(x, y0 + y, z, log);
    const top = y0 + h;
    for (let ly = top - 3; ly <= top + 1; ly++) {
      const rad = ly >= top ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const corner = Math.abs(dx) === rad && Math.abs(dz) === rad;
        if (corner && (ly >= top || hash3(x + dx, ly, z + dz, 77) < 0.5)) continue;
        if (ly === top + 1 && corner) continue;
        if (dx === 0 && dz === 0 && ly < top) continue; // trunk
        set(x + dx, ly, z + dz, leaf);
      }
    }
    set(x, top, z, log);
  }
}

import * as THREE from 'three';
import { B, BLOCKS, NUM_BLOCKS, tileUV } from './blocks';
import { Noise, hash2, mulberry32 } from './noise';

export const CW = 16;
export const CH = 128;
export const SEA = 40;

export type Biome = 'ocean' | 'beach' | 'plains' | 'forest' | 'birch' | 'desert' | 'snowy' | 'mountains';
export const BIOME_NAMES: Record<Biome, string> = {
  ocean: 'Ocean', beach: 'Beach', plains: 'Plains', forest: 'Forest', birch: 'Birch Grove', desert: 'Desert', snowy: 'Snowy Taiga', mountains: 'Mountains',
};

// precomputed per-block lookup tables for fast meshing
const OPAQUE = new Uint8Array(256);
const SOLID = new Uint8Array(256);
const CROSS = new Uint8Array(256);
const LIQUID = new Uint8Array(256);
const LIGHT = new Uint8Array(256);
const FACE_UV: Float32Array[] = []; // per block 6 faces * 4 uv
for (let i = 0; i < NUM_BLOCKS; i++) {
  const b = BLOCKS[i];
  if (!b) continue;
  OPAQUE[i] = b.opaque ? 1 : 0; SOLID[i] = b.solid ? 1 : 0; CROSS[i] = b.cross ? 1 : 0; LIQUID[i] = b.liquid ? 1 : 0;
  LIGHT[i] = b.light ?? 0;
  const arr = new Float32Array(24);
  // face order: +x,-x,+y,-y,+z,-z
  const names = [b.tiles[2], b.tiles[2], b.tiles[0], b.tiles[1], b.tiles[2], b.tiles[2]];
  names.forEach((n, f) => { const uv = tileUV(n); arr.set(uv, f * 4); });
  FACE_UV[i] = arr;
}
export const isSolid = (id: number) => SOLID[id] === 1;
export const isOpaque = (id: number) => OPAQUE[id] === 1;
export const isLiquid = (id: number) => LIQUID[id] === 1;

const idx = (x: number, y: number, z: number) => x + z * CW + y * CW * CW;
export const ckey = (cx: number, cz: number) => cx + ',' + cz;

export class Chunk {
  data = new Uint8Array(CW * CW * CH);
  heights = new Int16Array(CW * CW);
  lights: number[] = []; // packed light sources (local idx)
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  dirty = true;
  constructor(public cx: number, public cz: number) {}
  get(x: number, y: number, z: number) { return this.data[idx(x, y, z)]; }
  recomputeHeight(x: number, z: number) {
    let y = CH - 1;
    for (; y > 0; y--) { const b = this.data[idx(x, y, z)]; if (OPAQUE[b] && b !== B.LEAVES) break; }
    this.heights[x + z * CW] = y;
  }
  recomputeLights() {
    this.lights = [];
    for (let i = 0; i < this.data.length; i++) if (LIGHT[this.data[i]]) this.lights.push(i);
  }
}

// ------------------------------------------------------------------ generator
export class Generator {
  n1: Noise; n2: Noise; n3: Noise; n4: Noise; n5: Noise;
  constructor(public seed: number) {
    this.n1 = new Noise(seed); this.n2 = new Noise(seed + 101); this.n3 = new Noise(seed + 202);
    this.n4 = new Noise(seed + 303); this.n5 = new Noise(seed + 404);
  }
  climate(x: number, z: number) {
    const t = this.n2.fbm2(x / 900, z / 900, 2) + this.n4.noise2(x / 90, z / 90) * 0.04;
    const h = this.n3.fbm2(x / 700 + 50, z / 700 - 50, 2);
    return [t, h];
  }
  height(x: number, z: number) {
    const cont = this.n1.fbm2(x / 520, z / 520, 4);
    const detail = this.n1.fbm2(x / 70 + 300, z / 70, 3);
    const mnt = this.n5.fbm2(x / 300, z / 300, 4);
    const [t] = this.climate(x, z);
    let h = SEA + 3 + cont * 22 + detail * 5;
    const m = Math.max(0, mnt - 0.15);
    h += Math.pow(m, 1.4) * 95 * (0.5 + Math.max(0, cont + 0.3));
    if (t > 0.3) h = h * 0.7 + (SEA + 5) * 0.3; // deserts flatter
    return Math.max(4, Math.min(CH - 12, Math.floor(h)));
  }
  biome(x: number, z: number, h: number): Biome {
    const [t, hu] = this.climate(x, z);
    if (h < SEA - 1) return 'ocean';
    if (h <= SEA + 1 && t > -0.3) return 'beach';
    if (h > SEA + 34) return 'mountains';
    if (t > 0.3 && hu < 0.15) return 'desert';
    if (t < -0.28) return 'snowy';
    if (hu > 0.22) return t > 0.05 ? 'forest' : 'birch';
    return 'plains';
  }
  generate(c: Chunk) {
    const { data } = c;
    const ox = c.cx * CW, oz = c.cz * CW;
    const hs = new Int16Array(CW * CW);
    const bs: Biome[] = [];
    for (let z = 0; z < CW; z++) for (let x = 0; x < CW; x++) {
      const h = this.height(ox + x, oz + z);
      hs[x + z * CW] = h; bs[x + z * CW] = this.biome(ox + x, oz + z, h);
    }
    for (let z = 0; z < CW; z++) for (let x = 0; x < CW; x++) {
      const wx = ox + x, wz = oz + z;
      const h = hs[x + z * CW]; const bio = bs[x + z * CW];
      const dirtDepth = 3 + Math.floor(hash2(wx, wz, this.seed) * 2);
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let b: number = B.AIR;
        if (y === 0 || (y < 3 && hash2(wx * 3 + y, wz, this.seed) < 0.5)) b = B.BEDROCK;
        else if (y <= h) {
          const d = h - y;
          if (bio === 'desert' || bio === 'beach') b = d < 4 ? B.SAND : d < 7 ? B.SANDSTONE : B.STONE;
          else if (bio === 'ocean') b = d < 3 ? (this.n4.noise2(wx / 30, wz / 30) > 0.3 ? B.CLAY : this.n4.noise2(wx / 20, wz / 20) > 0 ? B.GRAVEL : B.SAND) : B.STONE;
          else if (bio === 'mountains') b = d === 0 ? (h > SEA + 52 ? B.SNOW : h > SEA + 40 ? B.STONE : B.GRASS) : d < 2 && h <= SEA + 40 ? B.DIRT : B.STONE;
          else if (bio === 'snowy') b = d === 0 ? B.SNOW_GRASS : d < dirtDepth ? B.DIRT : B.STONE;
          else b = d === 0 ? (h < SEA ? B.DIRT : B.GRASS) : d < dirtDepth ? B.DIRT : B.STONE;
        } else if (y <= SEA) b = (y === SEA && (bio === 'snowy' || (bio === 'ocean' && this.climate(wx, wz)[0] < -0.3))) ? B.ICE : B.WATER;
        data[idx(x, y, z)] = b;
      }
      // caves
      for (let y = 4; y < h - 1 || (y <= h && h > SEA + 2); y++) {
        if (y > h) break;
        const a = this.n3.noise3(wx / 42, y / 26, wz / 42), bb = this.n4.noise3(wx / 42, y / 26, wz / 42);
        let cave = a * a + bb * bb < 0.009 + (y < 20 ? 0.004 : 0);
        if (!cave && y < 32) cave = this.n5.noise3(wx / 70, y / 30, wz / 70) > 0.72;
        if (cave) {
          const cur = data[idx(x, y, z)];
          if (cur === B.BEDROCK || cur === B.WATER) continue;
          if (h <= SEA + 1 && y >= h - 4) continue; // don't puncture sea floor
          data[idx(x, y, z)] = B.AIR;
        }
      }
    }
    // ores - random walk veins
    const rnd = mulberry32((c.cx * 73856093) ^ (c.cz * 19349663) ^ this.seed);
    const veins: [number, number, number, number, number][] = [ // block, count, size, minY, maxY
      [B.COAL_ORE, 14, 8, 5, 90], [B.IRON_ORE, 9, 6, 5, 60], [B.GOLD_ORE, 3, 5, 5, 30], [B.DIAMOND_ORE, 2, 4, 3, 16], [B.GRAVEL, 4, 12, 5, 60],
    ];
    for (const [ob, cnt, size, y0, y1] of veins) for (let v = 0; v < cnt; v++) {
      let x = Math.floor(rnd() * CW), y = y0 + Math.floor(rnd() * (y1 - y0)), z = Math.floor(rnd() * CW);
      for (let s = 0; s < size; s++) {
        if (x >= 0 && x < CW && z >= 0 && z < CW && y > 0 && y < CH && data[idx(x, y, z)] === B.STONE) data[idx(x, y, z)] = ob;
        const d = Math.floor(rnd() * 6);
        if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
      }
    }
    // vegetation & trees (scan margin so trees cross chunk borders)
    const M = 3;
    for (let z = -M; z < CW + M; z++) for (let x = -M; x < CW + M; x++) {
      const wx = ox + x, wz = oz + z;
      const inside = x >= 0 && x < CW && z >= 0 && z < CW;
      const h = inside ? hs[x + z * CW] : this.height(wx, wz);
      if (h < SEA) continue;
      const bio = inside ? bs[x + z * CW] : this.biome(wx, wz, h);
      const r = hash2(wx, wz, this.seed + 7);
      const dens = { forest: 0.045, birch: 0.035, plains: 0.004, snowy: 0.02, mountains: 0.006, desert: 0.006, beach: 0, ocean: 0 }[bio];
      if (r < dens) {
        // check top block if inside (could be carved)
        if (inside) { const top = data[idx(x, h, z)]; if (top !== B.GRASS && top !== B.SNOW_GRASS && top !== B.SAND && top !== B.DIRT) continue; }
        const r2 = hash2(wx, wz, this.seed + 9);
        if (bio === 'desert') this.cactus(c, x, h + 1, z, 2 + Math.floor(r2 * 2));
        else if (bio === 'snowy' || (bio === 'mountains' && r2 < 0.7)) this.pine(c, x, h + 1, z, 6 + Math.floor(r2 * 4));
        else if (bio === 'birch' || (bio === 'forest' && r2 < 0.2)) this.oak(c, x, h + 1, z, 5 + Math.floor(r2 * 2), B.BIRCH_LOG, B.BIRCH_LEAVES);
        else this.oak(c, x, h + 1, z, 4 + Math.floor(r2 * 3), B.LOG, B.LEAVES);
      } else if (inside && h + 1 < CH) {
        const top = data[idx(x, h, z)], above = data[idx(x, h + 1, z)];
        if (above !== B.AIR) continue;
        if (top === B.GRASS) {
          const fr = hash2(wx, wz, this.seed + 11);
          const fl = this.n2.noise2(wx / 40, wz / 40);
          if (fr < (bio === 'plains' ? 0.14 : 0.08)) data[idx(x, h + 1, z)] = B.TALL_GRASS;
          else if (fr < 0.16 && fl > 0.3) data[idx(x, h + 1, z)] = fl > 0.55 ? B.FLOWER_RED : B.FLOWER_YELLOW;
        } else if (top === B.SAND && bio === 'desert' && hash2(wx, wz, this.seed + 12) < 0.01) data[idx(x, h + 1, z)] = B.DEAD_BUSH;
      }
    }
    for (let z = 0; z < CW; z++) for (let x = 0; x < CW; x++) c.recomputeHeight(x, z);
    c.recomputeLights();
  }
  private put(c: Chunk, x: number, y: number, z: number, b: number, replace = false) {
    if (x < 0 || x >= CW || z < 0 || z >= CW || y < 0 || y >= CH) return;
    const i = idx(x, y, z); const cur = c.data[i];
    if (replace || cur === B.AIR || CROSS[cur] || (cur === B.LEAVES || cur === B.BIRCH_LEAVES || cur === B.PINE_LEAVES)) c.data[i] = b;
  }
  oak(c: Chunk, x: number, y: number, z: number, h: number, log: number, leaf: number) {
    for (let dy = h - 3; dy <= h + 1; dy++) {
      const r = dy >= h ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy >= h || hash2(x + dx + c.cx * 16, z + dz + c.cz * 16 + dy, 5) < 0.5)) continue;
        this.put(c, x + dx, y + dy, z + dz, leaf);
      }
    }
    for (let i = 0; i < h; i++) this.put(c, x, y + i, z, log, true);
    this.put(c, x, y - 1, z, B.DIRT, true);
  }
  pine(c: Chunk, x: number, y: number, z: number, h: number) {
    let r = 0;
    for (let dy = h; dy >= 2; dy--) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + (r > 1 ? 1 : 0)) continue;
        this.put(c, x + dx, y + dy, z + dz, B.PINE_LEAVES);
      }
      r = r >= 2 + (dy < h / 2 ? 1 : 0) ? 1 : r + 1;
    }
    this.put(c, x, y + h + 1, z, B.PINE_LEAVES);
    for (let i = 0; i < h; i++) this.put(c, x, y + i, z, B.PINE_LOG, true);
  }
  cactus(c: Chunk, x: number, y: number, z: number, h: number) {
    for (let i = 0; i < h; i++) this.put(c, x, y + i, z, B.CACTUS);
  }
}

// ------------------------------------------------------------------ mesher
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9 },
];
const AO_CURVE = [0.45, 0.65, 0.82, 1.0];

class Buf {
  pos: number[] = []; uv: number[] = []; light: number[] = []; ind: number[] = [];
  quad(p: number[][], uvs: number[], l: number[][], flip = false) {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) { this.pos.push(p[i][0], p[i][1], p[i][2]); this.light.push(l[i][0], l[i][1]); }
    this.uv.push(uvs[0], uvs[1], uvs[2], uvs[1], uvs[2], uvs[3], uvs[0], uvs[3]);
    if (flip) this.ind.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    if (!this.ind.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('light', new THREE.Float32BufferAttribute(this.light, 2));
    g.setIndex(this.ind);
    g.computeBoundingSphere();
    return g;
  }
}

export interface Neighborhood {
  get(x: number, y: number, z: number): number; // world coords
  height(x: number, z: number): number;
  lights: [number, number, number, number][]; // x,y,z,level in world coords
}

const P = CW + 2;
export function meshChunk(c: Chunk, nb: Neighborhood) {
  const ox = c.cx * CW, oz = c.cz * CW;
  // padded copy
  const pad = new Uint8Array(P * P * CH);
  const ph = new Int16Array(P * P);
  for (let z = -1; z <= CW; z++) for (let x = -1; x <= CW; x++) {
    const inside = x >= 0 && x < CW && z >= 0 && z < CW;
    ph[(x + 1) + (z + 1) * P] = inside ? c.heights[x + z * CW] : nb.height(ox + x, oz + z);
    for (let y = 0; y < CH; y++) pad[(x + 1) + (z + 1) * P + y * P * P] = inside ? c.data[idx(x, y, z)] : nb.get(ox + x, y, oz + z);
  }
  const G = (x: number, y: number, z: number) => (y < 0 ? B.STONE : y >= CH ? B.AIR : pad[(x + 1) + (z + 1) * P + y * P * P]);
  const sky = (x: number, y: number, z: number) => {
    const h = ph[(x + 1) + (z + 1) * P];
    return y > h ? 1 : Math.max(0.05, 0.85 - (h - y) * 0.2);
  };
  const lights = nb.lights.filter(([lx, , lz]) => lx > ox - 10 && lx < ox + CW + 10 && lz > oz - 10 && lz < oz + CW + 10);
  const blockLight = (wx: number, y: number, wz: number) => {
    let m = 0;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const d = Math.abs(l[0] - wx) + Math.abs(l[1] - y) + Math.abs(l[2] - wz);
      const v = 1 - d / (l[3] * 0.62);
      if (v > m) m = v;
    }
    return m;
  };
  const solid = new Buf(), water = new Buf();
  let maxY = 0;
  for (let i = 0; i < c.heights.length; i++) maxY = Math.max(maxY, c.heights[i]);
  maxY = Math.min(CH - 1, Math.max(maxY + 16, SEA + 1));
  for (let y = 0; y <= maxY; y++) for (let z = 0; z < CW; z++) for (let x = 0; x < CW; x++) {
    const id = G(x, y, z);
    if (id === B.AIR) continue;
    const wx = ox + x, wz = oz + z;
    if (CROSS[id]) {
      const uv = FACE_UV[id].subarray(0, 4);
      const s = sky(x, y, z), bl = blockLight(wx + 0.5, y + 0.5, wz + 0.5);
      const L = id === B.TORCH ? [[1, 1], [1, 1], [1, 1], [1, 1]] : [[s * 0.9, bl], [s * 0.9, bl], [s, bl], [s, bl]];
      const a = 0.15, b2 = 0.85;
      const quads = [
        [[wx + a, y, wz + a], [wx + b2, y, wz + b2], [wx + b2, y + 1, wz + b2], [wx + a, y + 1, wz + a]],
        [[wx + b2, y, wz + a], [wx + a, y, wz + b2], [wx + a, y + 1, wz + b2], [wx + b2, y + 1, wz + a]],
      ];
      if (id === B.TORCH) {
        for (const q of quads) for (const p of q) { p[0] = wx + 0.5 + (p[0] - wx - 0.5) * 0.9; p[2] = wz + 0.5 + (p[2] - wz - 0.5) * 0.9; }
      }
      for (const q of quads) { solid.quad(q, Array.from(uv), L); solid.quad([q[1], q[0], q[3], q[2]], Array.from(uv), L); }
      continue;
    }
    const liquid = LIQUID[id] === 1;
    const buf = liquid ? water : solid;
    const topLower = liquid && G(x, y + 1, z) !== id ? 0.12 : 0;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const n = G(nx, ny, nz);
      if (liquid) { if (n === id || (OPAQUE[n] && !(f === 2))) continue; if (f === 2 && OPAQUE[n]) continue; }
      else {
        if (OPAQUE[n]) continue;
        if (n === id && !OPAQUE[id]) continue; // glass/leaves interior culling
      }
      const uv = FACE_UV[id].subarray(f * 4, f * 4 + 4);
      const pts: number[][] = []; const L: number[][] = [];
      const aos: number[] = [];
      for (let v = 0; v < 4; v++) {
        const cc = F.c[v];
        // tangent offsets for AO samples
        const d = [cc[0] * 2 - 1, cc[1] * 2 - 1, cc[2] * 2 - 1];
        let s1x = nx, s1y = ny, s1z = nz, s2x = nx, s2y = ny, s2z = nz;
        if (F.n[0] !== 0) { s1y += d[1]; s2z += d[2]; }
        else if (F.n[1] !== 0) { s1x += d[0]; s2z += d[2]; }
        else { s1x += d[0]; s2y += d[1]; }
        const cx2 = s1x + s2x - nx, cy2 = s1y + s2y - ny, cz2 = s1z + s2z - nz;
        const o1 = OPAQUE[G(s1x, s1y, s1z)], o2 = OPAQUE[G(s2x, s2y, s2z)], o3 = OPAQUE[G(cx2, cy2, cz2)];
        const ao = liquid ? 3 : o1 && o2 ? 0 : 3 - (o1 + o2 + o3);
        aos.push(ao);
        // smooth skylight: average over non-opaque samples
        let sl = sky(nx, ny, nz), cnt = 1;
        if (!o1) { sl += sky(s1x, s1y, s1z); cnt++; }
        if (!o2) { sl += sky(s2x, s2y, s2z); cnt++; }
        if (!o3 && !(o1 && o2)) { sl += sky(cx2, cy2, cz2); cnt++; }
        sl /= cnt;
        const px = wx + cc[0], py = y + cc[1] - (cc[1] === 1 ? topLower : 0), pz = wz + cc[2];
        pts.push([px, py, pz]);
        const k = AO_CURVE[ao] * F.shade;
        const bl = LIGHT[id] ? 1 : blockLight(px + F.n[0] * 0.5, py + F.n[1] * 0.5, pz + F.n[2] * 0.5);
        L.push(LIGHT[id] ? [1.2, 1.2] : [sl * k, bl * k]);
      }
      const flip = aos[0] + aos[2] < aos[1] + aos[3];
      buf.quad(pts, Array.from(uv), L, flip);
      if (liquid && f === 2) buf.quad([pts[1], pts[0], pts[3], pts[2]], Array.from(uv), L); // visible from below
    }
  }
  return { solid: solid.geometry(), water: water.geometry() };
}

// ------------------------------------------------------------------ material
export function makeChunkMaterial(atlas: THREE.Texture, isWater: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: atlas }, uSun: { value: 1 }, uSkyTint: { value: new THREE.Color(1, 1, 1) },
      uFogColor: { value: new THREE.Color(0.6, 0.75, 1) }, uFogNear: { value: 40 }, uFogFar: { value: 100 },
      uHeld: { value: new THREE.Vector4() }, uTime: { value: 0 }, uAlpha: { value: isWater ? 0.72 : 1 }, uTorch: { value: 1 },
    },
    transparent: isWater, depthWrite: !isWater, side: isWater ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: `
      attribute vec2 light;
      varying vec2 vUv; varying vec2 vLight; varying float vDist; varying vec3 vWorld;
      uniform float uTime;
      void main(){
        vUv = uv; vLight = light;
        vec3 p = position;
        ${isWater ? 'p.y += sin(uTime*1.6 + p.x*0.9 + p.z*0.6)*0.04 - 0.04;' : ''}
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vDist = length(mv.xyz); vWorld = p;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uSun; uniform vec3 uSkyTint; uniform vec3 uFogColor;
      uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform float uTorch; uniform float uTime; uniform vec4 uHeld;
      varying vec2 vUv; varying vec2 vLight; varying float vDist; varying vec3 vWorld;
      void main(){
        vec4 t = texture2D(map, vUv);
        ${isWater ? '' : 'if (t.a < 0.5) discard;'}
        float s = vLight.x * uSun;
        float flick = 0.94 + 0.06*sin(uTime*7.0 + vDist);
        float held = uHeld.w * max(0.0, 1.0 - distance(vWorld, uHeld.xyz)/9.0);
        vec3 torch = vec3(1.0,0.78,0.5) * pow(max(max(vLight.y, held),0.0),1.4) * 1.15 * uTorch * flick;
        vec3 lit = max(uSkyTint * s, torch) + vec3(0.025,0.025,0.04);
        vec3 col = t.rgb * min(lit, vec3(1.25));
        float f = smoothstep(uFogNear, uFogFar, vDist);
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, ${isWater ? 'uAlpha' : '1.0'});
        #include <colorspace_fragment>
      }`,
  });
}

// Procedural terrain generation: biomes, caves, ores, trees, decorations.
import { B } from "./blocks";
import { SimplexNoise, hash2, hash3, mulberry32 } from "./noise";

export const CHUNK = 16;
export const HEIGHT = 128;
export const SEA = 62;
export const CHUNK_VOLUME = CHUNK * CHUNK * HEIGHT;

/** block index within a chunk */
export const bi = (x: number, y: number, z: number) => (x << 11) | (z << 7) | y;

export const enum Biome {
  OCEAN,
  BEACH,
  PLAINS,
  FOREST,
  BIRCH_FOREST,
  DESERT,
  TAIGA,
  SNOWY,
  MOUNTAINS,
}
export const BIOME_NAMES = ["Ocean", "Beach", "Plains", "Forest", "Birch Forest", "Desert", "Taiga", "Snowy Tundra", "Mountains"];

interface Column {
  h: number;
  biome: Biome;
  temp: number;
  humid: number;
  mountain: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class WorldGen {
  private cont: SimplexNoise;
  private climate: SimplexNoise;
  private mount: SimplexNoise;
  private detail: SimplexNoise;
  private cave1: SimplexNoise;
  private cave2: SimplexNoise;
  private cave3: SimplexNoise;
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.cont = new SimplexNoise(seed + 1);
    this.climate = new SimplexNoise(seed + 2);
    this.mount = new SimplexNoise(seed + 3);
    this.detail = new SimplexNoise(seed + 4);
    this.cave1 = new SimplexNoise(seed + 5);
    this.cave2 = new SimplexNoise(seed + 6);
    this.cave3 = new SimplexNoise(seed + 7);
  }

  column(x: number, z: number): Column {
    const cont = this.cont.fbm2(x * 0.0011, z * 0.0011, 5);
    const temp = this.climate.fbm2(x * 0.0007 + 100, z * 0.0007 + 100, 3);
    const humid = this.climate.fbm2(x * 0.0009 - 300, z * 0.0009 + 250, 3);
    const mt = this.mount.ridged2(x * 0.0028, z * 0.0028, 4);
    const hills = this.detail.fbm2(x * 0.009, z * 0.009, 3);
    const fine = this.detail.fbm2(x * 0.035 + 50, z * 0.035 + 50, 2);

    const land = smooth(-0.25, 0.2, cont);
    let h = 66 + cont * 22;
    h += hills * 7 * land + fine * 2;
    const mountainMask = smooth(0.05, 0.4, cont) * smooth(0.42, 0.78, mt);
    h += mountainMask * (58 + hills * 14);
    h = Math.max(6, Math.min(HEIGHT - 4, Math.floor(h)));

    let biome: Biome;
    if (h < SEA - 1) biome = Biome.OCEAN;
    else if (h <= SEA + 1 && mountainMask < 0.3) biome = Biome.BEACH;
    else if (mountainMask > 0.45 || h > 96) biome = Biome.MOUNTAINS;
    else if (temp < -0.22) biome = humid > -0.05 ? Biome.TAIGA : Biome.SNOWY;
    else if (temp > 0.25 && humid < 0.05) biome = Biome.DESERT;
    else if (humid > 0.18) biome = Biome.FOREST;
    else if (humid > 0.04 && temp > 0) biome = Biome.BIRCH_FOREST;
    else biome = Biome.PLAINS;
    return { h, biome, temp, humid, mountain: mountainMask };
  }

  surfaceHeight(x: number, z: number): number {
    return this.column(x, z).h;
  }

  generate(cx: number, cz: number): { blocks: Uint8Array; biomes: Uint8Array } {
    const blocks = new Uint8Array(CHUNK_VOLUME);
    const biomes = new Uint8Array(CHUNK * CHUNK);
    const ox = cx * CHUNK,
      oz = cz * CHUNK;
    const PAD = 3;
    const W = CHUNK + PAD * 2;
    const cols: Column[] = new Array(W * W);
    for (let i = 0; i < W; i++)
      for (let k = 0; k < W; k++) cols[i * W + k] = this.column(ox + i - PAD, oz + k - PAD);
    const colAt = (lx: number, lz: number) => cols[(lx + PAD) * W + (lz + PAD)];

    // ---- cave noise sampled on a coarse 4x4x4 grid, trilinearly interpolated ----
    const GS = 4;
    const gx = CHUNK / GS + 1,
      gy = HEIGHT / GS + 1;
    const c1 = new Float32Array(gx * gy * gx),
      c2 = new Float32Array(gx * gy * gx),
      c3 = new Float32Array(gx * gy * gx);
    for (let i = 0; i < gx; i++)
      for (let j = 0; j < gy; j++)
        for (let k = 0; k < gx; k++) {
          const wx = ox + i * GS,
            wy = j * GS,
            wz = oz + k * GS;
          const idx = (i * gy + j) * gx + k;
          c1[idx] = this.cave1.noise3D(wx * 0.017, wy * 0.026, wz * 0.017);
          c2[idx] = this.cave2.noise3D(wx * 0.028, wy * 0.03, wz * 0.028);
          c3[idx] = this.cave3.noise3D(wx * 0.028 + 7, wy * 0.03, wz * 0.028 + 7);
        }
    const sample = (arr: Float32Array, x: number, y: number, z: number) => {
      const i = x >> 2,
        j = y >> 2,
        k = z >> 2;
      const fx = (x & 3) / 4,
        fy = (y & 3) / 4,
        fz = (z & 3) / 4;
      const i0 = (i * gy + j) * gx + k;
      const i1 = i0 + gy * gx; // +x
      const a = arr[i0] + (arr[i0 + gx] - arr[i0]) * fy; // y interp at (x,z)
      const b = arr[i0 + 1] + (arr[i0 + gx + 1] - arr[i0 + 1]) * fy; // z+1
      const c = arr[i1] + (arr[i1 + gx] - arr[i1]) * fy;
      const d = arr[i1 + 1] + (arr[i1 + gx + 1] - arr[i1 + 1]) * fy;
      const ab = a + (b - a) * fz;
      const cd = c + (d - c) * fz;
      return ab + (cd - ab) * fx;
    };

    // ---- base terrain ----
    for (let x = 0; x < CHUNK; x++) {
      for (let z = 0; z < CHUNK; z++) {
        const col = colAt(x, z);
        const { h, biome } = col;
        biomes[x * CHUNK + z] = biome;
        const wx = ox + x,
          wz = oz + z;
        const cold = col.temp < -0.22;
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id: number = B.AIR;
          if (y === 0 || (y < 3 && hash3(wx, y, wz, this.seed) < 0.5)) id = B.BEDROCK;
          else if (y <= h) {
            const depth = h - y;
            if (biome === Biome.DESERT) id = depth < 4 ? B.SAND : depth < 7 ? B.SANDSTONE : B.STONE;
            else if (biome === Biome.BEACH) id = depth < 4 ? B.SAND : B.STONE;
            else if (biome === Biome.OCEAN) {
              if (depth < 3) {
                const r = hash2(wx, wz, this.seed + 11);
                id = h > SEA - 6 ? (r < 0.15 ? B.CLAY : B.SAND) : r < 0.3 ? B.GRAVEL : r < 0.4 ? B.CLAY : B.SAND;
              } else id = B.STONE;
            } else if (biome === Biome.MOUNTAINS) {
              if (h > 100) id = depth < 2 ? B.SNOW : B.STONE;
              else if (h > 86) id = B.STONE;
              else id = depth === 0 ? (cold ? B.SNOWY_GRASS : B.GRASS) : depth < 4 ? B.DIRT : B.STONE;
            } else if (biome === Biome.SNOWY) id = depth === 0 ? B.SNOWY_GRASS : depth < 4 ? B.DIRT : B.STONE;
            else if (biome === Biome.TAIGA) id = depth === 0 ? (col.temp < -0.4 ? B.SNOWY_GRASS : B.GRASS) : depth < 4 ? B.DIRT : B.STONE;
            else id = depth === 0 ? B.GRASS : depth < 4 ? B.DIRT : B.STONE;

            // caves
            if (id !== B.BEDROCK && y > 2) {
              const nearSurface = depth < 7;
              const underwater = h <= SEA + 1;
              if (!(nearSurface && underwater)) {
                const n1 = sample(c1, x, y, z);
                const thresh = 0.56 + (nearSurface ? (7 - depth) * 0.045 : 0) + (y < 12 ? 0.1 : 0);
                let carve = n1 > thresh;
                if (!carve) {
                  const n2 = sample(c2, x, y, z),
                    n3 = sample(c3, x, y, z);
                  const w = nearSurface ? 0.045 : 0.075;
                  carve = Math.abs(n2) < w && Math.abs(n3) < w;
                }
                if (carve) id = y <= 9 ? B.LAVA : B.AIR;
              }
            }
          } else if (y <= SEA) {
            id = B.WATER;
            if (y === SEA && cold && biome === Biome.OCEAN) id = B.ICE;
          }
          blocks[bi(x, y, z)] = id;
        }
      }
    }

    // ---- ores & pockets (random walks, clipped to chunk) ----
    const rnd = mulberry32((hash2(cx, cz, this.seed + 99) * 4294967295) >>> 0);
    const vein = (id: number, count: number, minY: number, maxY: number, size: number, replace: number = B.STONE) => {
      for (let v = 0; v < count; v++) {
        let x = Math.floor(rnd() * CHUNK),
          z = Math.floor(rnd() * CHUNK),
          y = minY + Math.floor(rnd() * (maxY - minY));
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK && y > 0 && y < HEIGHT) {
            const i = bi(x, y, z);
            if (blocks[i] === replace) blocks[i] = id;
          }
          const r = rnd();
          if (r < 0.33) x += rnd() < 0.5 ? 1 : -1;
          else if (r < 0.66) z += rnd() < 0.5 ? 1 : -1;
          else y += rnd() < 0.5 ? 1 : -1;
        }
      }
    };
    vein(B.DIRT, 4, 10, 100, 12);
    vein(B.GRAVEL, 3, 6, 90, 12);
    vein(B.COAL_ORE, 16, 4, 110, 8);
    vein(B.IRON_ORE, 12, 4, 64, 6);
    vein(B.GOLD_ORE, 3, 4, 32, 5);
    vein(B.DIAMOND_ORE, 2, 3, 16, 4);

    // ---- decorations & trees (deterministic per world column, may span chunk borders) ----
    const setIfAir = (wx: number, wy: number, wz: number, id: number, force = false) => {
      const lx = wx - ox,
        lz = wz - oz;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 0 || wy >= HEIGHT) return;
      const i = bi(lx, wy, lz);
      if (force || blocks[i] === B.AIR) blocks[i] = id;
    };
    const leafBlob = (wx: number, wy: number, wz: number, r: number, leaf: number, corners: boolean, salt: number) => {
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (!corners || hash3(wx + dx, wy, wz + dz, salt) < 0.5)) continue;
          setIfAir(wx + dx, wy, wz + dz, leaf);
        }
    };

    for (let lx = -PAD; lx < CHUNK + PAD; lx++) {
      for (let lz = -PAD; lz < CHUNK + PAD; lz++) {
        const col = colAt(lx, lz);
        const { h, biome } = col;
        const wx = ox + lx,
          wz = oz + lz;
        const inChunk = lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK;
        if (h <= SEA) continue;
        // the column's surface block might have been carved away by a cave; check when in chunk
        if (inChunk && blocks[bi(lx, h, lz)] === B.AIR) continue;
        const r = hash2(wx, wz, this.seed + 21);
        const r2 = hash2(wx, wz, this.seed + 22);
        const y0 = h + 1;

        let tree: "oak" | "birch" | "spruce" | null = null;
        switch (biome) {
          case Biome.PLAINS:
            if (r < 0.004) tree = "oak";
            break;
          case Biome.FOREST:
            if (r < 0.045) tree = r2 < 0.85 ? "oak" : "birch";
            break;
          case Biome.BIRCH_FOREST:
            if (r < 0.04) tree = r2 < 0.8 ? "birch" : "oak";
            break;
          case Biome.TAIGA:
            if (r < 0.04) tree = "spruce";
            break;
          case Biome.SNOWY:
            if (r < 0.006) tree = "spruce";
            break;
          case Biome.MOUNTAINS:
            if (h < 88 && r < 0.008) tree = "spruce";
            break;
        }

        if (tree) {
          const trunkH = tree === "spruce" ? 6 + Math.floor(r2 * 4) : tree === "birch" ? 5 + Math.floor(r2 * 3) : 4 + Math.floor(r2 * 3);
          const log = tree === "oak" ? B.OAK_LOG : tree === "birch" ? B.BIRCH_LOG : B.SPRUCE_LOG;
          const leaf = tree === "oak" ? B.OAK_LEAVES : tree === "birch" ? B.BIRCH_LEAVES : B.SPRUCE_LEAVES;
          const top = y0 + trunkH - 1;
          if (tree === "spruce") {
            for (let k = 0; ; k++) {
              const y = top + 1 - k;
              if (y < y0 + 2) break;
              const rad = k === 0 ? 0 : k % 2 === 1 ? 1 : 2;
              leafBlob(wx, y, wz, rad, leaf, true, this.seed + 5 + k);
            }
            setIfAir(wx, top + 2, wz, leaf);
          } else {
            leafBlob(wx, top - 1, wz, 2, leaf, true, this.seed + 5);
            leafBlob(wx, top, wz, 2, leaf, true, this.seed + 6);
            leafBlob(wx, top + 1, wz, 1, leaf, false, this.seed + 7);
            setIfAir(wx, top + 2, wz, leaf);
            setIfAir(wx + 1, top + 2, wz, leaf);
            setIfAir(wx - 1, top + 2, wz, leaf);
            setIfAir(wx, top + 2, wz + 1, leaf);
            setIfAir(wx, top + 2, wz - 1, leaf);
          }
          for (let y = y0; y <= top; y++) setIfAir(wx, y, wz, log, true);
          if (inChunk) blocks[bi(lx, h, lz)] = biome === Biome.SNOWY || (biome === Biome.TAIGA && col.temp < -0.4) ? B.DIRT : blocks[bi(lx, h, lz)] === B.GRASS ? B.DIRT : blocks[bi(lx, h, lz)];
          continue;
        }

        if (!inChunk) continue;
        const surface = blocks[bi(lx, h, lz)];
        const above = bi(lx, y0, lz);
        if (y0 >= HEIGHT || blocks[above] !== B.AIR) continue;
        if (biome === Biome.DESERT && surface === B.SAND) {
          if (r < 0.006) {
            const ch = 1 + Math.floor(r2 * 3);
            for (let y = 0; y < ch; y++) blocks[bi(lx, y0 + y, lz)] = B.CACTUS;
          } else if (r < 0.014) blocks[above] = B.DEAD_BUSH;
        } else if (surface === B.GRASS) {
          if (biome === Biome.PLAINS || biome === Biome.FOREST || biome === Biome.BIRCH_FOREST) {
            if (r < 0.2) blocks[above] = B.TALL_GRASS;
            else if (r < 0.215) blocks[above] = B.FLOWER_YELLOW;
            else if (r < 0.228) blocks[above] = B.FLOWER_RED;
            else if (r < 0.2295 && biome === Biome.PLAINS) blocks[above] = B.PUMPKIN;
            else if (r < 0.232 && biome === Biome.FOREST) blocks[above] = B.MUSHROOM;
          } else if (biome === Biome.TAIGA || biome === Biome.MOUNTAINS) {
            if (r < 0.08) blocks[above] = B.TALL_GRASS;
            else if (r < 0.09) blocks[above] = B.MUSHROOM;
          }
        }
      }
    }

    // ---- cave mushrooms ----
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++)
        for (let y = 4; y < 55; y++) {
          const i = bi(x, y, z);
          if (blocks[i] === B.AIR && blocks[i - 1] === B.STONE && hash3(ox + x, y, oz + z, this.seed + 33) < 0.004) blocks[i] = B.MUSHROOM;
        }

    return { blocks, biomes };
  }
}

import * as THREE from 'three';
import { B, BLOCKS, CHUNK, HEIGHT, SEA, isSolid, isTransparent } from './blocks';
import { Noise2D, Noise3D, hash2, hash3, mulberry32, clamp } from './noise';
import { createAtlasTexture, tileUV } from './textures';

export type Biome = 'plains' | 'desert' | 'snow' | 'forest' | 'beach' | 'mountain' | 'swamp';

export class Chunk {
  data = new Uint8Array(CHUNK * HEIGHT * CHUNK);
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  dirty = true;
  constructor(public cx: number, public cz: number) {}
  idx(x: number, y: number, z: number) { return (y * CHUNK + z) * CHUNK + x; }
  get(x: number, y: number, z: number) {
    if (x < 0 || x >= CHUNK || z < 0 || z >= CHUNK || y < 0 || y >= HEIGHT) return 0;
    return this.data[this.idx(x, y, z)];
  }
  set(x: number, y: number, z: number, v: number) {
    if (x < 0 || x >= CHUNK || z < 0 || z >= CHUNK || y < 0 || y >= HEIGHT) return;
    this.data[this.idx(x, y, z)] = v;
  }
}

export class World {
  chunks = new Map<string, Chunk>();
  seed: number;
  heightNoise: Noise2D; tempNoise: Noise2D; moistNoise: Noise2D; caveNoise: Noise3D; detailNoise: Noise2D;
  modified = new Map<string, number>(); // "x,y,z" -> block

  constructor(seed: number) {
    this.seed = seed;
    this.heightNoise = new Noise2D(seed);
    this.tempNoise = new Noise2D(seed + 101);
    this.moistNoise = new Noise2D(seed + 202);
    this.caveNoise = new Noise3D(seed + 303);
    this.detailNoise = new Noise2D(seed + 404);
  }

  key(cx: number, cz: number) { return `${cx},${cz}`; }

  getBiome(x: number, z: number): Biome {
    const t = this.tempNoise.fbm(x / 220 + 10, z / 220 + 10, 3);
    const m = this.moistNoise.fbm(x / 180 + 30, z / 180 + 30, 3);
    const h = this.getHeightRaw(x, z);
    if (h <= SEA + 1) return 'beach';
    if (t < 0.38) return 'snow';
    if (t > 0.62 && m < 0.45) return 'desert';
    if (m > 0.62 && t < 0.5) return 'swamp';
    if (h > 46) return 'mountain';
    if (m > 0.58) return 'forest';
    return 'plains';
  }

  getHeightRaw(x: number, z: number): number {
    const base = this.heightNoise.fbm(x / 90, z / 90, 4);
    const hills = this.heightNoise.fbm(x / 28 + 50, z / 28 + 50, 3);
    const t = this.tempNoise.fbm(x / 220 + 10, z / 220 + 10, 2);
    let h = 26 + base * 16 + (hills - 0.5) * 6;
    if (t < 0.38) h += 6 + base * 10; // snow mountains
    if (h > 48) h = 48 + (h - 48) * 0.6;
    return Math.floor(clamp(h, 4, HEIGHT - 12));
  }

  getHeight(x: number, z: number): number {
    // actual surface from generated data if chunk exists, else raw
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (c) {
      const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
      for (let y = HEIGHT - 1; y >= 0; y--) {
        const b = c.get(lx, y, lz);
        if (b !== 0 && b !== B.Water && b !== B.Lava) return y;
      }
      return SEA;
    }
    return this.getHeightRaw(x, z);
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return 0;
    return c.get(wx - cx * CHUNK, wy, wz - cz * CHUNK);
  }
  setBlock(wx: number, wy: number, wz: number, v: number, record = true) {
    if (wy < 0 || wy >= HEIGHT) return;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return;
    c.set(wx - cx * CHUNK, wy, wz - cz * CHUNK, v);
    c.dirty = true;
    // mark neighbors dirty
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    if (lx === 0) this.chunks.get(this.key(cx - 1, cz))!.dirty = true;
    if (lx === CHUNK - 1) this.chunks.get(this.key(cx + 1, cz))!.dirty = true;
    if (lz === 0) this.chunks.get(this.key(cx, cz - 1))!.dirty = true;
    if (lz === CHUNK - 1) this.chunks.get(this.key(cx, cz + 1))!.dirty = true;
    if (record) this.modified.set(`${wx},${wy},${wz}`, v);
  }

  generateChunk(cx: number, cz: number): Chunk {
    const existing = this.chunks.get(this.key(cx, cz));
    if (existing) return existing;
    const chunk = new Chunk(cx, cz);
    this.chunks.set(this.key(cx, cz), chunk);
    const rng = mulberry32(this.seed + cx * 7919 + cz * 104729);

    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
        const biome = this.getBiome(wx, wz);
        const h = this.getHeightRaw(wx, wz);
        for (let y = 0; y <= h; y++) {
          let b: number = B.Stone;
          if (y === 0) b = B.Bedrock;
          else if (y === h) {
            if (biome === 'desert' || biome === 'beach') b = B.Sand;
            else if (biome === 'snow' || biome === 'mountain') b = B.SnowGrass;
            else if (biome === 'swamp') b = B.Clay;
            else b = B.Grass;
            if (h <= SEA + 1 && biome !== 'desert') b = B.Sand;
          } else if (y >= h - 3) {
            if (biome === 'desert' || biome === 'beach') b = B.Sand;
            else if (biome === 'snow' || biome === 'mountain') b = B.Dirt;
            else b = B.Dirt;
          } else {
            b = B.Stone;
            // gravel patches
            if (hash3(wx, y, wz, this.seed + 7) > 0.985) b = B.Gravel;
          }
          // caves
          if (y > 2 && y < h - 2) {
            const cave = this.caveNoise.fbm(wx / 24, y / 18, wz / 24, 2);
            const cave2 = this.caveNoise.fbm(wx / 24 + 100, y / 18, wz / 24, 2);
            if (Math.abs(cave - 0.5) < 0.035 && Math.abs(cave2 - 0.5) < 0.035) {
              b = 0;
            } else if (cave > 0.72 && cave2 > 0.72 && y < h - 4) {
              b = 0;
            }
          }
          // ores in stone
          if (b === B.Stone) {
            const r = hash3(wx, y, wz, this.seed + 11);
            if (y < 16 && r > 0.997) b = B.DiamondOre;
            else if (y < 32 && r > 0.994 && r <= 0.997) b = B.GoldOre;
            else if (y < 48 && r > 0.992 && r <= 0.994) b = B.IronOre;
            else if (r > 0.99 && r <= 0.992) b = B.CoalOre;
            else if (y < 20 && r > 0.988 && r <= 0.99) b = B.RedstoneOre;
            else if (y < 24 && r > 0.986 && r <= 0.988) b = B.LapisOre;
            else if (y < 28 && r > 0.984 && r <= 0.986) b = B.EmeraldOre;
          }
          chunk.set(lx, y, lz, b);
        }
        // water / ice
        for (let y = h + 1; y <= SEA; y++) {
          const biome = this.getBiome(wx, wz);
          chunk.set(lx, y, lz, biome === 'snow' ? B.Ice : B.Water);
        }
        // lava deep caves
        if (h < 10) {
          for (let y = 1; y < h; y++) if (chunk.get(lx, y, lz) === 0 && hash3(wx, y, wz, this.seed + 21) > 0.6) chunk.set(lx, y, lz, B.Lava);
        }
      }
    }

    // trees & decorations (interior only to avoid cross-chunk writes)
    const treeCount = biomeDensity(this, cx, cz);
    for (let i = 0; i < treeCount; i++) {
      const lx = 2 + Math.floor(rng() * 12), lz = 2 + Math.floor(rng() * 12);
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
      const biome = this.getBiome(wx, wz);
      const h = this.getHeightRaw(wx, wz);
      if (h <= SEA + 1 || h >= HEIGHT - 10) continue;
      const top = chunk.get(lx, h, lz);
      if (biome === 'desert') {
        if (top === B.Sand && rng() < 0.5) {
          const ch = 2 + Math.floor(rng() * 3);
          for (let y = 1; y <= ch; y++) chunk.set(lx, h + y, lz, B.Cactus);
        }
        continue;
      }
      if (biome === 'snow' || biome === 'mountain') {
        if (rng() < 0.35 && (top === B.SnowGrass || top === B.Grass)) {
          const th = 5 + Math.floor(rng() * 3);
          for (let y = 1; y <= th; y++) chunk.set(lx, h + y, lz, B.Log);
          for (let dy = th - 2; dy <= th + 1; dy++) {
            const r = dy >= th ? 1 : 2;
            for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
              if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.6) continue;
              const yy = h + dy;
              if (yy >= HEIGHT) continue;
              if (chunk.get(lx + dx, yy, lz + dz) === 0) chunk.set(lx + dx, yy, lz + dz, B.Leaves);
            }
          }
          chunk.set(lx, h + th + 2, lz, B.Leaves);
        }
        continue;
      }
      if (top !== B.Grass && top !== B.SnowGrass) continue;
      if (rng() < 0.75) {
        const th = 4 + Math.floor(rng() * 2);
        for (let y = 1; y <= th; y++) chunk.set(lx, h + y, lz, B.Log);
        for (let dy = th - 1; dy <= th + 1; dy++) {
          const r = dy === th + 1 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
            if (dx === 0 && dz === 0 && dy <= th) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.5) continue;
            const yy = h + dy;
            if (yy >= HEIGHT) continue;
            if (chunk.get(lx + dx, yy, lz + dz) === 0) chunk.set(lx + dx, yy, lz + dz, B.Leaves);
          }
        }
        chunk.set(lx, h + th + 2, lz, B.Leaves);
      } else if (rng() < 0.4) {
        // flowers / mushrooms as blocks
        chunk.set(lx, h + 1, lz, rng() < 0.5 ? B.Mushroom : B.Pumpkin);
      } else if (rng() < 0.3) {
        chunk.set(lx, h + 1, lz, B.Melon);
      }
    }

    // structures: rare per chunk
    const structRoll = hash2(cx, cz, this.seed + 555);
    if (structRoll > 0.985) {
      const wx = cx * CHUNK + 8, wz = cz * CHUNK + 8;
      const biome = this.getBiome(wx, wz);
      const h = this.getHeightRaw(wx, wz);
      if (h > SEA + 1 && h < HEIGHT - 12) {
        if (biome === 'desert') buildPyramid(chunk, 8, h, 8);
        else if (biome === 'snow') buildIgloo(chunk, 8, h, 8);
        else buildHouse(chunk, 8, h, 8, rng);
      }
    } else if (structRoll > 0.97) {
      // ruin / dungeon entrance: stone brick box with glowstone
      const wx = cx * CHUNK + 8, wz = cz * CHUNK + 8;
      const h = this.getHeightRaw(wx, wz);
      if (h > SEA + 1 && h < HEIGHT - 8) buildRuin(chunk, 8, h, 8);
    }

    // mark neighbors dirty so border faces re-cull correctly
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = this.chunks.get(this.key(cx + dx, cz + dz));
      if (n) n.dirty = true;
    }
    // apply saved modifications
    for (const [k, v] of this.modified) {
      const [x, y, z] = k.split(',').map(Number);
      if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz) {
        chunk.set(x - cx * CHUNK, y, z - cz * CHUNK, v);
      }
    }
    return chunk;
  }

  unloadFar(playerCX: number, playerCZ: number, radius: number, scene?: THREE.Scene) {
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - playerCX) > radius + 2 || Math.abs(c.cz - playerCZ) > radius + 2) {
        if (scene) {
          if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
          if (c.waterMesh) { scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); }
        }
        this.chunks.delete(k);
      }
    }
  }
}

function biomeDensity(w: World, cx: number, cz: number) {
  const wx = cx * CHUNK + 8, wz = cz * CHUNK + 8;
  const b = w.getBiome(wx, wz);
  if (b === 'forest') return 7;
  if (b === 'plains') return 3;
  if (b === 'swamp') return 4;
  if (b === 'snow') return 2;
  if (b === 'desert') return 2;
  if (b === 'mountain') return 1;
  return 1;
}

function buildHouse(c: Chunk, cx: number, baseY: number, cz: number, rng: () => number) {
  // 7x5x7 house: log corners, planks walls, glass windows, stone brick roof
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    for (let y = 0; y < 4; y++) {
      const edge = Math.abs(x) === 3 || Math.abs(z) === 3;
      if (!edge) continue;
      let b: number = B.Planks;
      if (Math.abs(x) === 3 && Math.abs(z) === 3) b = B.Log;
      if (y === 1 && (x === 0 && Math.abs(z) === 3)) continue; // door
      if (y === 1 && (z === 0 && Math.abs(x) === 3)) b = B.Glass;
      if (y === 2 && (x === 0 && Math.abs(z) === 3)) b = B.Glass;
      c.set(cx + x, baseY + 1 + y, cz + z, b);
    }
  }
  // floor
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) c.set(cx + x, baseY + 1, cz + z, B.Planks);
  // roof
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d <= 3) c.set(cx + x, baseY + 5, cz + z, B.StoneBrick);
    else if (d === 4 && rng() < 0.7) c.set(cx + x, baseY + 5, cz + z, B.StoneBrick);
  }
  c.set(cx, baseY + 6, cz, B.Glowstone);
  // interior: crafting + furnace + bed-ish wool
  c.set(cx - 2, baseY + 2, cz - 2, B.Crafting);
  c.set(cx + 2, baseY + 2, cz - 2, B.Furnace);
  c.set(cx - 2, baseY + 2, cz + 2, B.WoolRed);
  c.set(cx + 2, baseY + 2, cz + 2, B.Bookshelf);
  c.set(cx, baseY + 2, cz, B.Glowstone);
}
function buildPyramid(c: Chunk, cx: number, baseY: number, cz: number) {
  for (let layer = 0; layer < 4; layer++) {
    const r = 4 - layer;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
      if (Math.abs(x) === r || Math.abs(z) === r || layer === 0) c.set(cx + x, baseY + 1 + layer, cz + z, B.Sandstone);
    }
  }
  c.set(cx, baseY + 5, cz, B.GoldOre);
  c.set(cx, baseY + 2, cz, B.Glowstone);
  // entrance
  c.set(cx, baseY + 1, cz + 4, 0); c.set(cx, baseY + 2, cz + 4, 0);
  c.set(cx, baseY + 1, cz + 3, 0); c.set(cx, baseY + 2, cz + 3, 0);
  c.set(cx, baseY + 1, cz + 2, B.TNT);
}
function buildIgloo(c: Chunk, cx: number, baseY: number, cz: number) {
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    const d = Math.sqrt(x * x + z * z);
    if (d > 3.2) continue;
    const h = Math.floor(Math.sqrt(Math.max(0, 9 - d * d)));
    for (let y = 0; y <= h; y++) {
      if (x === 0 && z === 3 && y < 2) continue;
      c.set(cx + x, baseY + 1 + y, cz + z, B.Snow);
    }
  }
  c.set(cx, baseY + 2, cz, B.Glowstone);
  c.set(cx - 1, baseY + 1, cz, B.Furnace);
  c.set(cx + 1, baseY + 1, cz, B.Crafting);
}
function buildRuin(c: Chunk, cx: number, baseY: number, cz: number) {
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (Math.abs(x) === 2 || Math.abs(z) === 2) {
      c.set(cx + x, baseY + 1, cz + z, B.MossyCobble);
      if (Math.abs(x) === 2 && Math.abs(z) === 2) c.set(cx + x, baseY + 2, cz + z, B.MossyCobble);
    }
  }
  c.set(cx, baseY + 1, cz, B.Glowstone);
  c.set(cx + 1, baseY + 1, cz + 1, B.Obsidian);
  c.set(cx - 1, baseY + 1, cz - 1, B.IronOre);
}

// ---- Meshing ----
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.72, tile: 'side' },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.72, tile: 'side' },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, tile: 'top' },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, tile: 'bottom' },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.86, tile: 'side' },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.86, tile: 'side' },
] as const;

function aoFor(world: World, wx: number, wy: number, wz: number, faceDir: number[], corner: number[]): number {
  // simple AO: count solid neighbors around vertex
  const [dx, dy, dz] = faceDir;
  const [cx, cy, cz] = corner;
  // neighbor cell in face direction
  const bx = wx + dx, by = wy + dy, bz = wz + dz;
  // offsets toward corner
  const ox = cx === 1 ? 1 : -1, oy = cy === 1 ? 1 : -1, oz = cz === 1 ? 1 : -1;
  // sample side blocks
  let occ = 0;
  const checks: [number, number, number][] = [];
  if (dx !== 0) { checks.push([bx, by + oy, bz], [bx, by, bz + oz], [bx, by + oy, bz + oz]); }
  else if (dy !== 0) { checks.push([bx + ox, by, bz], [bx, by, bz + oz], [bx + ox, by, bz + oz]); }
  else { checks.push([bx + ox, by, bz], [bx, by + oy, bz], [bx + ox, by + oy, bz]); }
  for (const [x, y, z] of checks) {
    const b = world.getBlock(x, y, z);
    if (b !== 0 && isSolid(b) && !isTransparent(b)) occ++;
  }
  return 1 - occ * 0.18;
}

export function buildChunkMesh(world: World, chunk: Chunk, material: THREE.Material, waterMaterial: THREE.Material) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  const wPos: number[] = [], wNorm: number[] = [], wUv: number[] = [], wCol: number[] = [], wIdx: number[] = [];
  const baseX = chunk.cx * CHUNK, baseZ = chunk.cz * CHUNK;

  for (let y = 0; y < HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const b = chunk.get(lx, y, lz);
        if (b === 0) continue;
        const def = BLOCKS[b];
        if (!def) continue;
        const wx = baseX + lx, wz = baseZ + lz;
        const isWater = def.liquid;
        const target = isWater ? { p: wPos, n: wNorm, u: wUv, c: wCol, i: wIdx } : { p: positions, n: normals, u: uvs, c: colors, i: indices };

        for (const face of FACES) {
          const nx = wx + face.dir[0], ny = y + face.dir[1], nz = wz + face.dir[2];
          const nb = world.getBlock(nx, ny, nz);
          // culling rules
          if (isWater) {
            if (nb === B.Water || nb === B.Lava) continue;
            if (nb !== 0 && isSolid(nb) && !isTransparent(nb)) continue;
            if (face.dir[1] === -1) continue; // no bottom for water
          } else {
            if (nb !== 0 && !isTransparent(nb)) continue;
            if (nb === b && (b === B.Leaves || b === B.Glass || b === B.Ice)) continue;
            if (nb === B.Water || nb === B.Lava) {
              // draw solid face against water (underwater terrain visible)
            }
          }
          const tileIdx = face.tile === 'top' ? def.tiles.top : face.tile === 'bottom' ? def.tiles.bottom : def.tiles.side;
          const uv = tileUV(tileIdx);
          const vertStart = target.p.length / 3;
          for (let ci = 0; ci < 4; ci++) {
            const corner = face.corners[ci] as unknown as number[];
            let vy: number = corner[1];
            if (isWater && corner[1] === 1) vy = 0.875;
            target.p.push(wx + corner[0], y + vy, wz + corner[2]);
            target.n.push(face.dir[0], face.dir[1], face.dir[2]);
            let uu: number, vv: number;
            if (face.dir[1] !== 0) {
              uu = corner[0] === 0 ? uv.u0 : uv.u1;
              vv = corner[2] === 0 ? uv.v0 : uv.v1;
            } else if (face.dir[0] !== 0) {
              uu = corner[2] === 0 ? uv.u0 : uv.u1;
              vv = corner[1] === 0 ? uv.v0 : uv.v1;
            } else {
              uu = corner[0] === 0 ? uv.u0 : uv.u1;
              vv = corner[1] === 0 ? uv.v0 : uv.v1;
            }
            target.u.push(uu, vv);
            let shade: number = face.shade;
            if (!isWater) {
              const ao = aoFor(world, wx, y, wz, face.dir as unknown as number[], corner as unknown as number[]);
              shade *= ao;
            } else {
              shade *= face.shade;
            }
            // emissive blocks brighter
            if (def.emissive) shade = Math.max(shade, 1.0);
            target.c.push(shade, shade, shade);
          }
          target.i.push(vertStart, vertStart + 1, vertStart + 2, vertStart, vertStart + 2, vertStart + 3);
        }
      }
    }
  }

  function makeMesh(p: number[], n: number[], u: number[], c: number[], idx: number[], mat: THREE.Material) {
    if (idx.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
  return {
    solid: makeMesh(positions, normals, uvs, colors, indices, material),
    water: makeMesh(wPos, wNorm, wUv, wCol, wIdx, waterMaterial),
  };
}

export function createChunkMaterials() {
  const atlas = createAtlasTexture();
  const mat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  const waterMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
  return { mat, waterMat, atlas };
}

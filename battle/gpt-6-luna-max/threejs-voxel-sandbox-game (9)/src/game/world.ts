import * as THREE from "three";
import { BLOCK, BLOCKS, type BlockId } from "./data";

export const CHUNK_SIZE = 16;
const WATERLINE = 8;
const MAX_HEIGHT = 40;

export type BiomeName = "Meadow" | "Pinewood" | "Dunes" | "Highlands";

export interface TerrainSample {
  height: number;
  biome: BiomeName;
}

type FaceName = "right" | "left" | "top" | "bottom" | "front" | "back";

interface Face {
  name: FaceName;
  offset: [number, number, number];
  vertices: [number, number, number][];
}

const FACES: Face[] = [
  {
    name: "right",
    offset: [1, 0, 0],
    vertices: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },
  {
    name: "left",
    offset: [-1, 0, 0],
    vertices: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },
  {
    name: "top",
    offset: [0, 1, 0],
    vertices: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    name: "bottom",
    offset: [0, -1, 0],
    vertices: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    name: "front",
    offset: [0, 0, 1],
    vertices: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    name: "back",
    offset: [0, 0, -1],
    vertices: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
];

const MATERIAL_KEYS = [
  "grass_top",
  "grass_side",
  "dirt",
  "stone",
  "sand",
  "water",
  "bark",
  "wood_end",
  "leaves",
  "planks",
  "coal_ore",
  "copper_ore",
  "amethyst",
  "snow",
  "workbench_top",
  "workbench_side",
  "lantern",
] as const;

type MaterialKey = (typeof MATERIAL_KEYS)[number];

const MATERIAL_INDEX = new Map<MaterialKey, number>(
  MATERIAL_KEYS.map((key, index) => [key, index]),
);

interface TextureStyle {
  base: string;
  accent?: string;
  kind?: "plain" | "grass-side" | "wood-end" | "planks" | "ore" | "leaves" | "lantern";
}

const TEXTURE_STYLES: Record<MaterialKey, TextureStyle> = {
  grass_top: { base: "#719b50", accent: "#a4bd71" },
  grass_side: { base: "#8c674a", accent: "#729950", kind: "grass-side" },
  dirt: { base: "#8b674b", accent: "#ad8460" },
  stone: { base: "#878f91", accent: "#b1b7b3" },
  sand: { base: "#c8b17a", accent: "#e0cf9d" },
  water: { base: "#5baab0", accent: "#8bd4d2" },
  bark: { base: "#795339", accent: "#a8794b" },
  wood_end: { base: "#a77a4c", accent: "#63452f", kind: "wood-end" },
  leaves: { base: "#66844e", accent: "#9bb56a", kind: "leaves" },
  planks: { base: "#b58957", accent: "#dfb77d", kind: "planks" },
  coal_ore: { base: "#838b8b", accent: "#353c40", kind: "ore" },
  copper_ore: { base: "#838b8b", accent: "#bd7650", kind: "ore" },
  amethyst: { base: "#737b89", accent: "#ad83d9", kind: "ore" },
  snow: { base: "#d8e4df", accent: "#f3f6ed" },
  workbench_top: { base: "#b8874f", accent: "#d7ae72", kind: "planks" },
  workbench_side: { base: "#8f613b", accent: "#bd8953", kind: "planks" },
  lantern: { base: "#d38b45", accent: "#ffe4a2", kind: "lantern" },
};

function coordinateKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function chunkKey(x: number, z: number): string {
  return `${x},${z}`;
}

function parseChunkKey(key: string): [number, number] {
  const [x, z] = key.split(",").map(Number);
  return [x, z];
}

function parseCoordinateKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(",").map(Number);
  return [x, y, z];
}

function hash2(x: number, z: number, seed: number): number {
  const raw = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return raw - Math.floor(raw);
}

function hash3(x: number, y: number, z: number, seed: number): number {
  const raw = Math.sin(x * 127.1 + y * 269.5 + z * 311.7 + seed * 53.1) * 43758.5453123;
  return raw - Math.floor(raw);
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function parseHex(hex: string): [number, number, number] {
  const color = Number.parseInt(hex.slice(1), 16);
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

function makeTexture(style: TextureStyle, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas texture context unavailable");

  const image = context.createImageData(16, 16);
  const base = parseHex(style.base);
  const accent = parseHex(style.accent ?? style.base);
  let state = (seed + 1) * 1664525 + 1013904223;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      let color = base;
      let alpha = 255;
      const noise = (random() - 0.5) * 30;

      if (style.kind === "grass-side" && y < 4) color = accent;
      if (style.kind === "grass-side" && y === 4) color = parseHex("#536f3f");
      if (style.kind === "wood-end") {
        const radius = Math.hypot(x - 7.5, y - 7.5);
        color = Math.floor(radius) % 3 === 0 ? accent : base;
      }
      if (style.kind === "planks" && (y === 0 || y === 7 || y === 8 || y === 15)) {
        color = accent;
      }
      if (style.kind === "ore" && random() > 0.83) color = accent;
      if (style.kind === "leaves") {
        if (random() < 0.16) alpha = 0;
        else if (random() > 0.66) color = accent;
      }
      if (style.kind === "lantern") {
        const centerGlow = Math.abs(x - 7.5) < 4 && Math.abs(y - 7.5) < 4;
        if (centerGlow) color = accent;
        if (x === 0 || x === 15 || y === 0 || y === 15) color = parseHex("#80522f");
      }

      const pixel = (y * 16 + x) * 4;
      image.data[pixel] = Math.max(0, Math.min(255, baseColor(color[0], noise)));
      image.data[pixel + 1] = Math.max(0, Math.min(255, baseColor(color[1], noise)));
      image.data[pixel + 2] = Math.max(0, Math.min(255, baseColor(color[2], noise)));
      image.data[pixel + 3] = alpha;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function baseColor(channel: number, noise: number): number {
  return channel + noise;
}

function appendNumbers(target: number[], values: number[]): void {
  for (const value of values) target.push(value);
}

function createMaterials(): THREE.MeshStandardMaterial[] {
  return MATERIAL_KEYS.map((key, index) => {
    const isWater = key === "water";
    const isLeaves = key === "leaves";
    const texture = makeTexture(TEXTURE_STYLES[key], index * 37 + 12);
    return new THREE.MeshStandardMaterial({
      map: texture,
      vertexColors: true,
      roughness: isWater ? 0.32 : 0.92,
      metalness: key === "lantern" ? 0.12 : 0,
      transparent: isWater,
      opacity: isWater ? 0.68 : 1,
      depthWrite: !isWater,
      alphaTest: isLeaves ? 0.18 : 0,
      side: THREE.FrontSide,
      emissive: key === "lantern" ? new THREE.Color("#d77d32") : new THREE.Color(0x000000),
      emissiveIntensity: key === "lantern" ? 0.48 : 0,
    });
  });
}

export class VoxelWorld {
  readonly seed: number;
  readonly chunkMeshes = new Map<string, THREE.Mesh>();
  private readonly blocksByChunk = new Map<string, Map<string, BlockId>>();
  private readonly generatedChunks = new Set<string>();
  private readonly edits = new Map<string, BlockId>();
  private readonly materials: THREE.MeshStandardMaterial[];

  constructor(seed: number, savedEdits?: Record<string, number>) {
    this.seed = seed;
    this.materials = createMaterials();
    if (savedEdits) {
      for (const [key, value] of Object.entries(savedEdits)) {
        if (Number.isInteger(value) && value >= 0 && value <= BLOCK.lantern) {
          this.edits.set(key, value as BlockId);
        }
      }
    }
  }

  get meshes(): THREE.Mesh[] {
    return [...this.chunkMeshes.values()];
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y > MAX_HEIGHT) return BLOCK.air;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    return this.blocksByChunk.get(chunkKey(cx, cz))?.get(coordinateKey(ix, iy, iz)) ?? BLOCK.air;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return BLOCKS[this.getBlock(x, y, z)].solid;
  }

  terrainAt(x: number, z: number): TerrainSample {
    const broad = this.fractal(x * 0.022, z * 0.022, 11);
    const detail = this.fractal(x * 0.073, z * 0.073, 29);
    const ridge = this.fractal(x * 0.012, z * 0.012, 71);
    let height = Math.round(5 + broad * 8 + detail * 2 + Math.max(0, ridge - 0.62) * 14);

    const temperature = this.valueNoise(x * 0.014, z * 0.014, 103);
    const moisture = this.valueNoise(x * 0.019, z * 0.019, 211);
    const basin = this.valueNoise(x * 0.031, z * 0.031, 307);
    let biome: BiomeName = "Meadow";

    if (temperature > 0.62 && moisture < 0.45) biome = "Dunes";
    else if (moisture > 0.57) biome = "Pinewood";
    if (height > 15) biome = "Highlands";

    if (basin < 0.4 && x * x + z * z > 64) {
      const basinFloor = Math.floor(WATERLINE - (0.4 - basin) * 8);
      height = Math.min(height, basinFloor);
    }

    // Keep the arrival meadow level and open enough for a safe first landing.
    if (x * x + z * z < 64) {
      height = 10 + Math.round((detail - 0.5) * 2);
      biome = "Meadow";
    }

    return { height, biome };
  }

  heightAt(x: number, z: number): number {
    return this.terrainAt(x, z).height;
  }

  biomeAt(x: number, z: number): BiomeName {
    return this.terrainAt(x, z).biome;
  }

  ensureAround(x: number, z: number, radius = 3): void {
    const centerX = Math.floor(x / CHUNK_SIZE);
    const centerZ = Math.floor(z / CHUNK_SIZE);
    const newlyGenerated = new Set<string>();
    const changed = new Set<string>();

    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = chunkKey(cx, cz);
        if (!this.generatedChunks.has(key)) {
          this.generateChunkData(cx, cz);
          newlyGenerated.add(key);
          changed.add(key);
        }
      }
    }

    for (const key of newlyGenerated) {
      const [cx, cz] = parseChunkKey(key);
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nearby = chunkKey(cx + dx, cz + dz);
          if (this.generatedChunks.has(nearby)) changed.add(nearby);
        }
      }
    }

    const unloadDistance = radius + 1;
    for (const key of [...this.generatedChunks]) {
      const [cx, cz] = parseChunkKey(key);
      if (Math.abs(cx - centerX) <= unloadDistance && Math.abs(cz - centerZ) <= unloadDistance) continue;
      this.removeChunkMesh(key);
      this.blocksByChunk.delete(key);
      this.generatedChunks.delete(key);
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nearby = chunkKey(cx + dx, cz + dz);
          if (this.generatedChunks.has(nearby)) changed.add(nearby);
        }
      }
    }

    for (const key of changed) this.rebuildChunk(key);
  }

  setBlock(x: number, y: number, z: number, id: BlockId): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    if (iy < 1 || iy > MAX_HEIGHT) return;

    this.storeBlock(ix, iy, iz, id);
    this.edits.set(coordinateKey(ix, iy, iz), id);

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    this.rebuildChunk(chunkKey(cx, cz));
    const localX = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if (localX === 0) this.rebuildChunk(chunkKey(cx - 1, cz));
    if (localX === CHUNK_SIZE - 1) this.rebuildChunk(chunkKey(cx + 1, cz));
    if (localZ === 0) this.rebuildChunk(chunkKey(cx, cz - 1));
    if (localZ === CHUNK_SIZE - 1) this.rebuildChunk(chunkKey(cx, cz + 1));
  }

  hasWorkbenchNear(x: number, y: number, z: number): boolean {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dz = -4; dz <= 4; dz += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          if (this.getBlock(x + dx, y + dy, z + dz) === BLOCK.workbench) return true;
        }
      }
    }
    return false;
  }

  serializeEdits(): Record<string, number> {
    return Object.fromEntries(this.edits.entries());
  }

  dispose(): void {
    for (const key of this.chunkMeshes.keys()) this.removeChunkMesh(key);
    for (const material of this.materials) {
      const map = material.map;
      material.dispose();
      map?.dispose();
    }
    this.blocksByChunk.clear();
    this.generatedChunks.clear();
  }

  private valueNoise(x: number, z: number, offset: number): number {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = smooth(x - x0);
    const tz = smooth(z - z0);
    const a = hash2(x0, z0, this.seed + offset);
    const b = hash2(x0 + 1, z0, this.seed + offset);
    const c = hash2(x0, z0 + 1, this.seed + offset);
    const d = hash2(x0 + 1, z0 + 1, this.seed + offset);
    return mix(mix(a, b, tx), mix(c, d, tx), tz);
  }

  private fractal(x: number, z: number, offset: number): number {
    let total = 0;
    let weight = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < 4; octave += 1) {
      total += this.valueNoise(x * frequency, z * frequency, offset + octave * 41) * amplitude;
      weight += amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    return total / weight;
  }

  private generateChunkData(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const chunk = new Map<string, BlockId>();
    this.blocksByChunk.set(key, chunk);
    this.generatedChunks.add(key);

    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let z = startZ; z < startZ + CHUNK_SIZE; z += 1) {
      for (let x = startX; x < startX + CHUNK_SIZE; x += 1) {
        const { height, biome } = this.terrainAt(x, z);
        for (let y = 0; y <= height; y += 1) {
          let id: BlockId;
          if (y === 0) id = BLOCK.stone;
          else if (y === height) {
            id = biome === "Dunes" ? BLOCK.sand : biome === "Highlands" && height > 14 ? BLOCK.snow : BLOCK.grass;
          } else if (biome === "Dunes" && y >= height - 3) id = BLOCK.sand;
          else if (y >= height - 3) id = BLOCK.dirt;
          else id = this.oreAt(x, y, z, height);
          chunk.set(coordinateKey(x, y, z), id);
        }

        if (height < WATERLINE) {
          for (let y = height + 1; y <= WATERLINE; y += 1) {
            chunk.set(coordinateKey(x, y, z), BLOCK.water);
          }
        }
      }
    }

    this.generateTrees(cx, cz);

    for (const [editKey, value] of this.edits) {
      const [x, , z] = parseCoordinateKey(editKey);
      if (Math.floor(x / CHUNK_SIZE) !== cx || Math.floor(z / CHUNK_SIZE) !== cz) continue;
      if (value === BLOCK.air) chunk.delete(editKey);
      else chunk.set(editKey, value);
    }
  }

  private oreAt(x: number, y: number, z: number, surface: number): BlockId {
    if (y > surface - 2 || y < 2) return BLOCK.stone;
    const chance = hash3(x, y, z, this.seed + 503);
    if (chance < 0.0011 && y < 9) return BLOCK.amethyst;
    if (chance < 0.007 && y < 13) return BLOCK.copperOre;
    if (chance < 0.026) return BLOCK.coalOre;
    return BLOCK.stone;
  }

  private generateTrees(cx: number, cz: number): void {
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;
    const candidates: [number, number, number][] = [];

    for (let z = startZ + 3; z < startZ + CHUNK_SIZE - 3; z += 1) {
      for (let x = startX + 3; x < startX + CHUNK_SIZE - 3; x += 1) {
        const sample = this.terrainAt(x, z);
        if (sample.biome !== "Pinewood" && sample.biome !== "Meadow") continue;
        if (sample.height < WATERLINE + 1 || sample.height > 14) continue;
        if (x * x + z * z < 100) continue;
        const roll = hash2(x, z, this.seed + 887);
        const threshold = sample.biome === "Pinewood" ? 0.978 : 0.994;
        if (roll > threshold) candidates.push([x, z, sample.height]);
      }
    }

    const placed: [number, number][] = [];
    for (const [x, z, surface] of candidates) {
      if (placed.some(([otherX, otherZ]) => (x - otherX) ** 2 + (z - otherZ) ** 2 < 28)) continue;
      placed.push([x, z]);
      const trunkHeight = 4 + Math.floor(hash2(x, z, this.seed + 919) * 2);
      for (let y = 1; y <= trunkHeight; y += 1) {
        this.storeBlock(x, surface + y, z, BLOCK.oakLog);
      }

      const crownY = surface + trunkHeight;
      for (let dy = -1; dy <= 2; dy += 1) {
        const radius = dy === 2 ? 1 : 2;
        for (let dz = -radius; dz <= radius; dz += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy !== 0) continue;
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            if (hash3(x + dx, crownY + dy, z + dz, this.seed + 1231) < 0.12) continue;
            const leafX = x + dx;
            const leafY = crownY + dy;
            const leafZ = z + dz;
            if (this.getBlock(leafX, leafY, leafZ) === BLOCK.air) {
              this.storeBlock(leafX, leafY, leafZ, BLOCK.leaves);
            }
          }
        }
      }
    }
  }

  private storeBlock(x: number, y: number, z: number, id: BlockId): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.blocksByChunk.get(chunkKey(cx, cz));
    if (!chunk) return;
    const key = coordinateKey(x, y, z);
    if (id === BLOCK.air) chunk.delete(key);
    else chunk.set(key, id);
  }

  private rebuildChunk(key: string): void {
    if (!this.generatedChunks.has(key)) return;
    this.removeChunkMesh(key);
    const [cx, cz] = parseChunkKey(key);
    const chunk = this.blocksByChunk.get(key);
    if (!chunk?.size) return;

    const data = MATERIAL_KEYS.map(() => ({
      positions: [] as number[],
      normals: [] as number[],
      uvs: [] as number[],
      colors: [] as number[],
      indices: [] as number[],
    }));
    const shade = {
      right: 0.82,
      left: 0.78,
      top: 1,
      bottom: 0.55,
      front: 0.91,
      back: 0.75,
    } satisfies Record<FaceName, number>;

    for (const key of chunk.keys()) {
      const [x, y, z] = parseCoordinateKey(key);
      const id = chunk.get(key);
      if (!id) continue;

      for (const face of FACES) {
        if (y === 0 && face.name === "bottom") continue;
        const neighbor = this.getBlock(x + face.offset[0], y + face.offset[1], z + face.offset[2]);
        if (!this.faceIsVisible(id, neighbor, face.name)) continue;

        const materialKey = this.faceMaterial(id, face.name);
        const materialIndex = MATERIAL_INDEX.get(materialKey);
        if (materialIndex === undefined) continue;
        const target = data[materialIndex];
        const start = target.positions.length / 3;
        const variation = 0.96 + hash3(x, y, z, id * 17) * 0.08;
        const brightness = shade[face.name] * variation;
        const normal = face.offset;

        for (const vertex of face.vertices) {
          target.positions.push(x - cx * CHUNK_SIZE + vertex[0], y + vertex[1], z - cz * CHUNK_SIZE + vertex[2]);
          target.normals.push(normal[0], normal[1], normal[2]);
          target.colors.push(brightness, brightness, brightness);
        }
        target.uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
        target.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    data.forEach((materialData, materialIndex) => {
      if (materialData.indices.length === 0) return;
      const groupStart = indices.length;
      appendNumbers(positions, materialData.positions);
      appendNumbers(normals, materialData.normals);
      appendNumbers(uvs, materialData.uvs);
      appendNumbers(colors, materialData.colors);
      for (const index of materialData.indices) indices.push(index + vertexOffset);
      vertexOffset += materialData.positions.length / 3;
      geometry.addGroup(groupStart, indices.length - groupStart, materialIndex);
    });

    if (positions.length === 0) {
      geometry.dispose();
      return;
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.materials);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    mesh.name = `chunk-${key}`;
    mesh.userData.chunkKey = key;
    mesh.frustumCulled = true;
    mesh.renderOrder = 0;
    this.chunkMeshes.set(key, mesh);
  }

  private faceIsVisible(id: BlockId, neighbor: BlockId, face: FaceName): boolean {
    if (id === BLOCK.water) return face !== "bottom" && neighbor !== BLOCK.water;
    return neighbor === BLOCK.air || neighbor === BLOCK.water;
  }

  private faceMaterial(id: BlockId, face: FaceName): MaterialKey {
    switch (id) {
      case BLOCK.grass:
        return face === "top" ? "grass_top" : "grass_side";
      case BLOCK.dirt:
        return "dirt";
      case BLOCK.stone:
        return "stone";
      case BLOCK.sand:
        return "sand";
      case BLOCK.water:
        return "water";
      case BLOCK.oakLog:
        return face === "top" || face === "bottom" ? "wood_end" : "bark";
      case BLOCK.leaves:
        return "leaves";
      case BLOCK.planks:
        return "planks";
      case BLOCK.coalOre:
        return "coal_ore";
      case BLOCK.copperOre:
        return "copper_ore";
      case BLOCK.amethyst:
        return "amethyst";
      case BLOCK.snow:
        return "snow";
      case BLOCK.workbench:
        return face === "top" ? "workbench_top" : "workbench_side";
      case BLOCK.lantern:
        return "lantern";
      default:
        return "stone";
    }
  }

  private removeChunkMesh(key: string): void {
    const mesh = this.chunkMeshes.get(key);
    if (!mesh) return;
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
    this.chunkMeshes.delete(key);
  }
}
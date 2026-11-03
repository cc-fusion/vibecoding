import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  Vector3,
} from "three";
import { BlockId } from "./blocks";
import { CHUNK_SIZE, SEA_LEVEL, TerrainGenerator, WORLD_HEIGHT } from "./terrain";

interface FaceBuffer {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

interface Chunk {
  cx: number;
  cz: number;
  data: Uint8Array;
  group: Group;
  built: boolean;
}

interface FaceDefinition {
  step: readonly [number, number, number];
  normal: readonly [number, number, number];
  vertices: readonly (readonly [number, number, number])[];
}

const FACES: FaceDefinition[] = [
  { step: [1, 0, 0], normal: [1, 0, 0], vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { step: [-1, 0, 0], normal: [-1, 0, 0], vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { step: [0, 1, 0], normal: [0, 1, 0], vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { step: [0, -1, 0], normal: [0, -1, 0], vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { step: [0, 0, 1], normal: [0, 0, 1], vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { step: [0, 0, -1], normal: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const QUAD_UVS = [[0, 0], [0, 1], [1, 1], [1, 0]] as const;

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function editKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function chunkIndex(x: number, y: number, z: number): number {
  return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
}

function localCoordinate(value: number): number {
  return ((value % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

function makeTile(base: string, accent: string, seed: number, kind: "plain" | "grass" | "leaves" | "wood" | "ore" | "water" = "plain"): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are not available in this browser.");
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 16, 16);
  context.fillStyle = base;
  context.fillRect(0, 0, 16, 16);

  let random = seed | 0;
  const next = () => {
    random = (Math.imul(random ^ (random >>> 15), 1 | random) + 0x6d2b79f5) | 0;
    let value = Math.imul(random ^ (random >>> 7), 61 | random);
    value ^= value + Math.imul(value ^ (value >>> 14), 45 | value);
    return ((value ^ (value >>> 13)) >>> 0) / 4294967295;
  };

  if (kind === "grass") {
    context.fillStyle = "#719250";
    context.fillRect(0, 0, 16, 4);
    context.fillStyle = "#93a966";
    for (let index = 0; index < 11; index += 1) {
      context.fillRect(Math.floor(next() * 16), Math.floor(next() * 4), 1, 1);
    }
  }

  if (kind === "wood") {
    context.fillStyle = accent;
    for (let x = 2; x < 16; x += 5) context.fillRect(x, 0, 1, 16);
    context.fillStyle = "rgba(54, 37, 24, 0.3)";
    context.fillRect(7, 0, 1, 16);
  }

  const speckles = kind === "leaves" ? 56 : kind === "water" ? 20 : kind === "ore" ? 16 : 44;
  for (let index = 0; index < speckles; index += 1) {
    const size = kind === "ore" ? (next() > 0.75 ? 2 : 1) : next() > 0.8 ? 2 : 1;
    const x = Math.floor(next() * (16 - size));
    const y = Math.floor(next() * (16 - size));
    if (kind === "leaves" && next() > 0.83) continue;
    context.globalAlpha = 0.35 + next() * 0.5;
    context.fillStyle = next() > 0.48 ? accent : base;
    context.fillRect(x, y, size, size);
  }
  context.globalAlpha = 1;

  if (kind === "ore") {
    context.fillStyle = accent;
    for (let index = 0; index < 9; index += 1) {
      const x = 1 + Math.floor(next() * 14);
      const y = 1 + Math.floor(next() * 14);
      context.fillRect(x, y, 2, 2);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMaterials(): Record<string, MeshLambertMaterial> {
  const textures: Record<string, CanvasTexture> = {
    grassTop: makeTile("#658b49", "#90a95e", 11),
    grassSide: makeTile("#805f46", "#9a7554", 12, "grass"),
    dirt: makeTile("#805f46", "#9a7554", 13),
    stone: makeTile("#818986", "#a3a9a4", 14),
    sand: makeTile("#d2bf89", "#ead9a5", 15),
    log: makeTile("#795333", "#ae7a48", 16, "wood"),
    leaves: makeTile("#557c4e", "#71965d", 17, "leaves"),
    planks: makeTile("#b58b58", "#d3ad73", 18, "wood"),
    cobblestone: makeTile("#727a78", "#989f9a", 19),
    coalOre: makeTile("#7b8380", "#252c2b", 20, "ore"),
    ironOre: makeTile("#7b8380", "#bd9573", 21, "ore"),
    water: makeTile("#4f91a0", "#8fc5c4", 22, "water"),
    bedrock: makeTile("#343a39", "#575c58", 23),
    snow: makeTile("#dfe9e4", "#ffffff", 24),
    craftingTable: makeTile("#967047", "#d1a46e", 25, "wood"),
  };

  const materials: Record<string, MeshLambertMaterial> = {};
  for (const [name, map] of Object.entries(textures)) {
    const isWater = name === "water";
    const isLeaves = name === "leaves";
    materials[name] = new MeshLambertMaterial({
      map,
      transparent: isWater,
      opacity: isWater ? 0.72 : 1,
      depthWrite: !isWater,
      alphaTest: isLeaves ? 0.15 : 0,
      side: 0,
    });
  }
  return materials;
}

function textureKey(block: BlockId, faceIndex: number): string {
  switch (block) {
    case BlockId.Grass:
      if (faceIndex === 2) return "grassTop";
      if (faceIndex === 3) return "dirt";
      return "grassSide";
    case BlockId.Dirt: return "dirt";
    case BlockId.Stone: return "stone";
    case BlockId.Sand: return "sand";
    case BlockId.Log: return "log";
    case BlockId.Leaves: return "leaves";
    case BlockId.Planks: return "planks";
    case BlockId.Cobblestone: return "cobblestone";
    case BlockId.CoalOre: return "coalOre";
    case BlockId.IronOre: return "ironOre";
    case BlockId.Water: return "water";
    case BlockId.Bedrock: return "bedrock";
    case BlockId.Snow: return "snow";
    case BlockId.CraftingTable: return faceIndex === 2 ? "planks" : "craftingTable";
    default: return "stone";
  }
}

function isFaceVisible(block: BlockId, neighbor: BlockId): boolean {
  if (neighbor === BlockId.Air) return true;
  if (block === BlockId.Water) return false;
  if (neighbor === BlockId.Water) return true;
  if (block === BlockId.Leaves && neighbor === BlockId.Leaves) return false;
  return false;
}

function disposeGroup(group: Group): void {
  for (const child of [...group.children]) {
    if (child instanceof Mesh) child.geometry.dispose();
    group.remove(child);
  }
}

export class VoxelWorld {
  readonly generator: TerrainGenerator;
  readonly edits = new Map<string, BlockId>();
  private readonly chunks = new Map<string, Chunk>();
  private readonly materials = createMaterials();
  private readonly renderRadius = 2;
  private readonly loadRadius = 3;
  private center = { x: Number.NaN, z: Number.NaN };

  constructor(
    private readonly scene: Group | import("three").Scene,
    readonly seed: string,
    savedEdits: [string, number][] = [],
  ) {
    this.generator = new TerrainGenerator(seed);
    for (const [key, value] of savedEdits) {
      if (Number.isInteger(value) && value >= BlockId.Air && value <= BlockId.CraftingTable) {
        this.edits.set(key, value as BlockId);
      }
    }
  }

  getBiome(x: number, z: number): string {
    const biome = this.generator.column(Math.floor(x), Math.floor(z)).biome;
    switch (biome) {
      case "woodland": return "Mosswood forest";
      case "meadow": return "Sunlit meadow";
      case "dunes": return "Amber dunes";
      case "highlands": return "Frostline peaks";
      default: return "Tidewater coast";
    }
  }

  findSpawn(): { x: number; y: number; z: number } {
    return this.generator.findSpawn();
  }

  streamTo(x: number, z: number): void {
    const centerX = Math.floor(x / CHUNK_SIZE);
    const centerZ = Math.floor(z / CHUNK_SIZE);
    if (centerX === this.center.x && centerZ === this.center.z) return;
    this.center = { x: centerX, z: centerZ };

    const wanted = new Set<string>();
    for (let dz = -this.loadRadius; dz <= this.loadRadius; dz += 1) {
      for (let dx = -this.loadRadius; dx <= this.loadRadius; dx += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = chunkKey(cx, cz);
        wanted.add(key);
        if (!this.chunks.has(key)) this.createChunk(cx, cz);
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!wanted.has(key)) {
        this.scene.remove(chunk.group);
        disposeGroup(chunk.group);
        this.chunks.delete(key);
        continue;
      }

      const shouldRender = Math.abs(chunk.cx - centerX) <= this.renderRadius && Math.abs(chunk.cz - centerZ) <= this.renderRadius;
      if (shouldRender && !chunk.built) this.rebuildChunk(chunk);
      chunk.group.visible = shouldRender;
    }
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0) return BlockId.Bedrock;
    if (y >= WORLD_HEIGHT) return BlockId.Air;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) return chunk.data[chunkIndex(localCoordinate(x), y, localCoordinate(z))] as BlockId;
    return this.edits.get(editKey(x, y, z)) ?? this.generator.blockAt(x, y, z);
  }

  setBlock(x: number, y: number, z: number, block: BlockId): void {
    if (y < 1 || y >= WORLD_HEIGHT) return;
    this.edits.set(editKey(x, y, z), block);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.data[chunkIndex(localCoordinate(x), y, localCoordinate(z))] = block;

    const affected = new Set<string>([chunkKey(cx, cz)]);
    const lx = localCoordinate(x);
    const lz = localCoordinate(z);
    if (lx === 0) affected.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) affected.add(chunkKey(cx + 1, cz));
    if (lz === 0) affected.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) affected.add(chunkKey(cx, cz + 1));

    for (const key of affected) {
      const affectedChunk = this.chunks.get(key);
      if (!affectedChunk?.built) continue;
      if (affectedChunk.group.visible) this.rebuildChunk(affectedChunk);
      else {
        disposeGroup(affectedChunk.group);
        affectedChunk.built = false;
      }
    }
  }

  getSavedEdits(): [string, number][] {
    return Array.from(this.edits.entries()).map(([key, value]) => [key, value]);
  }

  dispose(): void {
    for (const chunk of this.chunks.values()) {
      this.scene.remove(chunk.group);
      disposeGroup(chunk.group);
    }
    this.chunks.clear();
    for (const material of Object.values(this.materials)) {
      material.map?.dispose();
      material.dispose();
    }
  }

  private createChunk(cx: number, cz: number): void {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const worldX = originX + x;
        const worldZ = originZ + z;
        const column = this.generator.column(worldX, worldZ);
        const ceiling = Math.max(column.height, SEA_LEVEL);
        for (let y = 0; y <= ceiling; y += 1) {
          let block = BlockId.Air;
          if (y === 0) {
            block = BlockId.Bedrock;
          } else if (y <= column.height) {
            if (y === column.height) {
              block = this.generator.surfaceBlock(column.biome);
            } else if (y >= column.height - 3 && column.biome !== "highlands") {
              block = column.biome === "dunes" || column.biome === "coast" ? BlockId.Sand : BlockId.Dirt;
            } else if (y >= column.height - 2 && column.biome === "highlands") {
              block = BlockId.Stone;
            } else if (y > 3 && y < column.height - 4 && this.generator.isCave(worldX, y, worldZ)) {
              block = BlockId.Air;
            } else {
              block = BlockId.Stone;
              if (y < 18 && this.generator.randomAt(worldX, y, worldZ, 1409) > 0.994) {
                block = BlockId.IronOre;
              } else if (y < 27 && this.generator.randomAt(worldX, y, worldZ, 241) > 0.989) {
                block = BlockId.CoalOre;
              }
            }
          } else if (y <= SEA_LEVEL) {
            block = BlockId.Water;
          }
          data[chunkIndex(x, y, z)] = block;
        }
      }
    }

    this.placeTrees(data, originX, originZ);
    for (const [key, value] of this.edits) {
      const [editX, editY, editZ] = key.split(",").map(Number);
      if (Math.floor(editX / CHUNK_SIZE) === cx && Math.floor(editZ / CHUNK_SIZE) === cz && editY >= 0 && editY < WORLD_HEIGHT) {
        data[chunkIndex(localCoordinate(editX), editY, localCoordinate(editZ))] = value;
      }
    }

    const group = new Group();
    group.position.set(originX, 0, originZ);
    this.scene.add(group);
    this.chunks.set(chunkKey(cx, cz), { cx, cz, data, group, built: false });
  }

  private placeTrees(data: Uint8Array, originX: number, originZ: number): void {
    for (let treeX = originX - 2; treeX <= originX + CHUNK_SIZE + 1; treeX += 1) {
      for (let treeZ = originZ - 2; treeZ <= originZ + CHUNK_SIZE + 1; treeZ += 1) {
        const tree = this.generator.treeFor(treeX, treeZ);
        if (!tree) continue;
        for (let y = tree.height + 1; y <= tree.height + tree.trunk; y += 1) {
          this.writeTreeBlock(data, originX, originZ, treeX, y, treeZ, BlockId.Log);
        }
        const centerY = tree.height + tree.trunk - 1;
        for (let layer = -2; layer <= 2; layer += 1) {
          const radius = Math.abs(layer) === 2 ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
              if (dx * dx + dz * dz > radius * radius + 0.4) continue;
              if (dx === 0 && dz === 0 && centerY + layer <= tree.height + tree.trunk) continue;
              this.writeTreeBlock(data, originX, originZ, treeX + dx, centerY + layer, treeZ + dz, BlockId.Leaves, true);
            }
          }
        }
      }
    }
  }

  private writeTreeBlock(
    data: Uint8Array,
    originX: number,
    originZ: number,
    x: number,
    y: number,
    z: number,
    block: BlockId,
    onlyAir = false,
  ): void {
    const localX = x - originX;
    const localZ = z - originZ;
    if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT) return;
    const index = chunkIndex(localX, y, localZ);
    if (!onlyAir || data[index] === BlockId.Air) data[index] = block;
  }

  private rebuildChunk(chunk: Chunk): void {
    disposeGroup(chunk.group);
    const buffers = new Map<string, FaceBuffer>();
    const originX = chunk.cx * CHUNK_SIZE;
    const originZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const block = chunk.data[chunkIndex(x, y, z)] as BlockId;
          if (block === BlockId.Air) continue;
          const worldX = originX + x;
          const worldZ = originZ + z;

          for (let faceIndex = 0; faceIndex < FACES.length; faceIndex += 1) {
            const face = FACES[faceIndex];
            const neighbor = this.getBlock(worldX + face.step[0], y + face.step[1], worldZ + face.step[2]);
            if (!isFaceVisible(block, neighbor)) continue;
            const materialKey = textureKey(block, faceIndex);
            let buffer = buffers.get(materialKey);
            if (!buffer) {
              buffer = { positions: [], normals: [], uvs: [], indices: [] };
              buffers.set(materialKey, buffer);
            }

            const firstVertex = buffer.positions.length / 3;
            for (let vertexIndex = 0; vertexIndex < 4; vertexIndex += 1) {
              const vertex = face.vertices[vertexIndex];
              buffer.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
              buffer.normals.push(face.normal[0], face.normal[1], face.normal[2]);
              buffer.uvs.push(QUAD_UVS[vertexIndex][0], QUAD_UVS[vertexIndex][1]);
            }
            buffer.indices.push(firstVertex, firstVertex + 1, firstVertex + 2, firstVertex, firstVertex + 2, firstVertex + 3);
          }
        }
      }
    }

    for (const [materialKey, buffer] of buffers) {
      if (buffer.positions.length === 0) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(buffer.positions), 3));
      geometry.setAttribute("normal", new BufferAttribute(new Float32Array(buffer.normals), 3));
      geometry.setAttribute("uv", new BufferAttribute(new Float32Array(buffer.uvs), 2));
      geometry.setIndex(buffer.indices);
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, this.materials[materialKey]);
      mesh.castShadow = materialKey !== "water";
      mesh.receiveShadow = materialKey !== "water";
      if (materialKey === "water") mesh.renderOrder = 1;
      chunk.group.add(mesh);
    }
    chunk.built = true;
  }
}

export function blockTint(block: BlockId): Color {
  switch (block) {
    case BlockId.Grass: return new Color("#72934f");
    case BlockId.Dirt: return new Color("#85634c");
    case BlockId.Stone: return new Color("#8b9290");
    case BlockId.Sand: return new Color("#d6c28b");
    case BlockId.Log: return new Color("#88603b");
    case BlockId.Leaves: return new Color("#507b4b");
    case BlockId.Planks: return new Color("#bd9562");
    case BlockId.Cobblestone: return new Color("#777e7d");
    case BlockId.CoalOre: return new Color("#303535");
    case BlockId.IronOre: return new Color("#a78b78");
    case BlockId.Snow: return new Color("#e6eeec");
    case BlockId.CraftingTable: return new Color("#a67545");
    default: return new Color("#6c8080");
  }
}

export function chunkCenter(x: number, z: number): Vector3 {
  return new Vector3(Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE, 0, Math.floor(z / CHUNK_SIZE) * CHUNK_SIZE);
}
import { BLOCKS, type Biome, type BlockId } from "./data";

export const WORLD_RADIUS = 23;
export const ALTAR = { x: 15, z: -15 };

export const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const columnKey = (x: number, z: number) => `${x},${z}`;
export const parseBlockKey = (key: string) => key.split(",").map(Number) as [number, number, number];

const smooth = (v: number) => v * v * (3 - 2 * v);

export class VoxelWorld {
  blocks = new Map<string, BlockId>();
  heights = new Map<string, number>();
  biomes = new Map<string, Biome>();
  crops = new Map<string, number>();
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.generate();
  }

  private hash(x: number, z: number) {
    const n = Math.sin(x * 127.1 + z * 311.7 + this.seed * 0.021) * 43758.5453;
    return n - Math.floor(n);
  }

  private noise(x: number, z: number, scale: number) {
    const ax = x / scale;
    const az = z / scale;
    const ix = Math.floor(ax);
    const iz = Math.floor(az);
    const u = smooth(ax - ix);
    const v = smooth(az - iz);
    const a = this.hash(ix, iz) * (1 - u) + this.hash(ix + 1, iz) * u;
    const b = this.hash(ix, iz + 1) * (1 - u) + this.hash(ix + 1, iz + 1) * u;
    return a * (1 - v) + b * v;
  }

  private biomeFor(x: number, z: number): Biome {
    const warp = (this.noise(x + 73, z - 27, 9) - 0.5) * 7;
    if (Math.hypot(x - ALTAR.x, z - ALTAR.z) < 8.5 || (x + warp > 9 && z - warp < -5)) return "cinder";
    if (z + warp < -11 && x < 9) return "frost";
    if (x + warp < -7 && z < 8) return "pinewood";
    if (x - warp > 7 && z > 0) return "dunes";
    return "meadow";
  }

  private pond(x: number, z: number) {
    return Math.hypot((x + 8) / 1.12, (z - 9) / 0.85) < 3.5 ||
      Math.hypot((x - 6) / 0.9, z - 11) < 2.6 ||
      Math.hypot(x + 16, z + 5) < 2.2;
  }

  private generate() {
    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
      for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
        const biome = this.biomeFor(x, z);
        const spawn = Math.hypot(x, z) < 4.5;
        const altar = Math.hypot(x - ALTAR.x, z - ALTAR.z) < 4.7;
        const water = this.pond(x, z) && !spawn && !altar;
        const elevation = this.noise(x + 170, z - 60, 8) * 0.72 + this.noise(x - 49, z + 90, 3.5) * 0.28;
        let height = spawn || altar ? 2 : Math.max(2, Math.min(5, 1 + Math.floor(elevation * 4.5)));
        if (water) height = 1;
        this.heights.set(columnKey(x, z), height);
        this.biomes.set(columnKey(x, z), biome);
        this.set(x, 0, z, "bedrock");
        for (let y = 1; y <= height; y++) {
          let block: BlockId = "stone";
          if (y === height) {
            block = biome === "pinewood" ? "pineGrass" : biome === "frost" ? "snow" : biome === "dunes" ? "sand" : biome === "cinder" ? "basalt" : "grass";
          } else if (y >= height - 1) {
            block = biome === "dunes" ? "sand" : biome === "cinder" ? "basalt" : "dirt";
          } else {
            const ore = this.hash(x * 7 + y * 19, z * 9 - y * 13);
            block = ore > 0.987 && biome === "cinder" ? "diamondOre" : ore > 0.94 ? "ironOre" : ore > 0.86 ? "coalOre" : "stone";
          }
          this.set(x, y, z, block);
        }
        if (water) this.set(x, 2, z, "water");
        if (!spawn && !altar && !water && Math.hypot(x, z) > 5) {
          const ore = this.hash(x * 13 + 11, z * 17 - 31);
          if (ore > 0.992 && (biome === "cinder" || biome === "frost")) this.set(x, height, z, "diamondOre");
          else if (ore > 0.965) this.set(x, height, z, "ironOre");
          else if (ore > 0.928) this.set(x, height, z, "coalOre");
          else if (ore > 0.884 && biome !== "dunes") this.set(x, height, z, "stone");
        }
      }
    }

    for (let x = -WORLD_RADIUS + 2; x <= WORLD_RADIUS - 2; x++) {
      for (let z = -WORLD_RADIUS + 2; z <= WORLD_RADIUS - 2; z++) {
        const biome = this.biomeAt(x, z);
        const chance = biome === "pinewood" ? 0.105 : biome === "meadow" ? 0.048 : biome === "frost" ? 0.027 : 0;
        if (this.hash(x * 23 + 4, z * 31 - 8) < chance) this.plantTree(x, z, biome !== "meadow");
      }
    }

    // Guaranteed nearby landmarks make the first minutes reliably playable.
    this.plantTree(-3, -2, false, true);
    this.plantTree(3, 3, false, true);
    this.placeDeposit(4, -3, "stone");
    this.placeDeposit(-5, 4, "coalOre");
    this.placeDeposit(7, -5, "ironOre");
    this.placeDeposit(11, -10, "diamondOre");
    this.placeDeposit(13, -12, "diamondOre");
    this.placeDeposit(18, -10, "diamondOre");
  }

  private placeDeposit(x: number, z: number, block: BlockId) {
    const h = this.terrainHeight(x, z);
    if (h > 1) this.set(x, h, z, block);
  }

  private plantTree(x: number, z: number, pine: boolean, force = false) {
    if (!force && (Math.hypot(x, z) < 5.2 || Math.hypot(x - ALTAR.x, z - ALTAR.z) < 5.4)) return;
    const h = this.terrainHeight(x, z);
    const base = this.get(x, h, z);
    if (!base || base === "water" || base === "sand" || base === "basalt" || this.get(x, h + 1, z)) return;
    const height = pine ? 4 + Math.floor(this.hash(x + 17, z - 13) * 2) : 3 + Math.floor(this.hash(x - 4, z + 19) * 2);
    for (let y = 1; y <= height; y++) this.set(x, h + y, z, pine ? "pineWood" : "wood");
    for (let dy = height - 1; dy <= height + 1; dy++) {
      const radius = pine ? (dy === height + 1 ? 0 : dy === height ? 1 : 2) : (dy === height + 1 ? 1 : 2);
      for (let ox = -radius; ox <= radius; ox++) {
        for (let oz = -radius; oz <= radius; oz++) {
          if (Math.abs(ox) + Math.abs(oz) > radius + (pine ? 0 : 1)) continue;
          if (ox === 0 && oz === 0 && dy <= height) continue;
          const yy = h + dy;
          if (!this.get(x + ox, yy, z + oz)) this.set(x + ox, yy, z + oz, pine ? "pineLeaves" : "leaves");
        }
      }
    }
  }

  inside(x: number, z: number) { return x >= -WORLD_RADIUS && x <= WORLD_RADIUS && z >= -WORLD_RADIUS && z <= WORLD_RADIUS; }
  get(x: number, y: number, z: number) { return this.blocks.get(blockKey(x, y, z)); }
  set(x: number, y: number, z: number, block?: BlockId) {
    const key = blockKey(x, y, z);
    if (block) this.blocks.set(key, block);
    else { this.blocks.delete(key); this.crops.delete(key); }
  }
  terrainHeight(x: number, z: number) { return this.heights.get(columnKey(x, z)) ?? 2; }
  biomeAt(x: number, z: number): Biome { return this.biomes.get(columnKey(x, z)) ?? "meadow"; }
  solid(x: number, y: number, z: number) {
    const block = this.get(x, y, z);
    return !!block && BLOCKS[block].solid !== false;
  }
  surfaceY(x: number, z: number) {
    const ix = Math.round(x);
    const iz = Math.round(z);
    for (let y = 6; y >= 0; y--) {
      const block = this.get(ix, y, iz);
      if (block && BLOCKS[block].solid !== false && block !== "wood" && block !== "pineWood" && block !== "leaves" && block !== "pineLeaves") return y + 0.5;
    }
    return 0.5;
  }
  exposed(x: number, y: number, z: number, block: BlockId) {
    if (block === "torch" || block === "crop" || block === "cropRipe" || block === "water") return true;
    return !this.get(x, y + 1, z) || !this.get(x + 1, y, z) || !this.get(x - 1, y, z) ||
      !this.get(x, y, z + 1) || !this.get(x, y, z - 1) ||
      (this.get(x, y + 1, z) === "water");
  }
}
// Block registry: ids, rendering tiles, physics & harvesting properties.

export const B = {
  Air: 0, Grass: 1, Dirt: 2, Stone: 3, Cobble: 4, Sand: 5, Sandstone: 6,
  Log: 7, BirchLog: 8, PineLog: 9, Leaves: 10, PineLeaves: 11, Planks: 12,
  Glass: 13, Bedrock: 14, Water: 15, CoalOre: 16, IronOre: 17, GoldOre: 18,
  DiamondOre: 19, Snow: 20, Ice: 21, Cactus: 22, Torch: 23, CraftingTable: 24,
  Furnace: 25, Gravel: 26, TallGrass: 27, FlowerRed: 28, FlowerYellow: 29,
  DeadBush: 30, Wool: 31, Lava: 32, StoneBricks: 33, Sapling: 34, Chest: 35,
  Pumpkin: 36, SnowyGrass: 37,
} as const;

export type SoundType = 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'glass' | 'plant' | 'cloth' | 'snow';
export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';
export type Shape = 'cube' | 'cross' | 'liquid' | 'cactus';

export interface BlockDef {
  name: string;
  // tiles per face: [ +x, -x, +y(top), -y(bottom), +z, -z ]
  tiles: [string, string, string, string, string, string];
  shape: Shape;
  solid: boolean;          // collides
  opaque: boolean;         // fully occludes neighbor faces (render-cull)
  lightOpacity: number;    // 0..15 light attenuation
  lightEmit: number;       // 0..15
  hardness: number;        // base seconds to break bare-handed (Infinity = unbreakable)
  tool: ToolType;          // preferred tool
  minTier: number;         // min tool tier required to drop (0 = hand ok for drops if tool is 'none')
  needTool: boolean;       // requires correct tool type to drop
  dropId: number;          // item id dropped (-1 = itself, 0 = nothing) (item ids >=256 allowed)
  sound: SoundType;
  mapColor: string;        // minimap / particle average color
  gravity?: boolean;       // falls (sand/gravel)
  support?: 'soil' | 'sand' | 'any'; // plants / torch need support below
}

const all = (t: string): BlockDef['tiles'] => [t, t, t, t, t, t];
const sides = (side: string, top: string, bottom?: string): BlockDef['tiles'] =>
  [side, side, top, bottom ?? top, side, side];

function def(p: Partial<BlockDef> & { name: string; tiles: BlockDef['tiles'] }): BlockDef {
  return {
    shape: 'cube', solid: true, opaque: true, lightOpacity: 15, lightEmit: 0,
    hardness: 1, tool: 'none', minTier: 0, needTool: false, dropId: -1,
    sound: 'stone', mapColor: '#888', ...p,
  };
}

export const BLOCKS: BlockDef[] = [];
function reg(id: number, d: BlockDef) { BLOCKS[id] = d; }

reg(B.Air, def({ name: 'Air', tiles: all(''), solid: false, opaque: false, lightOpacity: 0, hardness: Infinity }));
reg(B.Grass, def({ name: 'Grass Block', tiles: sides('grass_side', 'grass_top', 'dirt'), hardness: 0.65, tool: 'shovel', dropId: B.Dirt, sound: 'grass', mapColor: '#6abe30' }));
reg(B.Dirt, def({ name: 'Dirt', tiles: all('dirt'), hardness: 0.55, tool: 'shovel', sound: 'dirt', mapColor: '#8a5f3c' }));
reg(B.Stone, def({ name: 'Stone', tiles: all('stone'), hardness: 1.6, tool: 'pickaxe', needTool: true, dropId: B.Cobble, mapColor: '#7d7d7d' }));
reg(B.Cobble, def({ name: 'Cobblestone', tiles: all('cobble'), hardness: 1.8, tool: 'pickaxe', needTool: true, mapColor: '#6f6f6f' }));
reg(B.Sand, def({ name: 'Sand', tiles: all('sand'), hardness: 0.55, tool: 'shovel', sound: 'sand', mapColor: '#e3d9a0', gravity: true }));
reg(B.Sandstone, def({ name: 'Sandstone', tiles: sides('sandstone_side', 'sandstone_top'), hardness: 1.1, tool: 'pickaxe', needTool: true, mapColor: '#d8cf9e' }));
reg(B.Log, def({ name: 'Oak Log', tiles: sides('log_side', 'log_top'), hardness: 1.1, tool: 'axe', sound: 'wood', mapColor: '#6b4f2a' }));
reg(B.BirchLog, def({ name: 'Birch Log', tiles: sides('birch_side', 'birch_top'), hardness: 1.1, tool: 'axe', sound: 'wood', mapColor: '#cfc8b8' }));
reg(B.PineLog, def({ name: 'Spruce Log', tiles: sides('pine_side', 'pine_top'), hardness: 1.1, tool: 'axe', sound: 'wood', mapColor: '#4a3620' }));
reg(B.Leaves, def({ name: 'Oak Leaves', tiles: all('leaves'), hardness: 0.15, lightOpacity: 2, sound: 'plant', mapColor: '#3f7d26', dropId: 0 }));
reg(B.PineLeaves, def({ name: 'Spruce Leaves', tiles: all('pine_leaves'), hardness: 0.15, lightOpacity: 2, sound: 'plant', mapColor: '#2c5a34', dropId: 0 }));
reg(B.Planks, def({ name: 'Oak Planks', tiles: all('planks'), hardness: 1.1, tool: 'axe', sound: 'wood', mapColor: '#a8834f' }));
reg(B.Glass, def({ name: 'Glass', tiles: all('glass'), hardness: 0.35, opaque: false, lightOpacity: 0, sound: 'glass', mapColor: '#d8f4f4', dropId: 0 }));
reg(B.Bedrock, def({ name: 'Bedrock', tiles: all('bedrock'), hardness: Infinity, mapColor: '#333' }));
reg(B.Water, def({ name: 'Water', tiles: all('water'), shape: 'liquid', solid: false, opaque: false, lightOpacity: 2, hardness: Infinity, sound: 'cloth', mapColor: '#3f76e4', dropId: 0 }));
reg(B.CoalOre, def({ name: 'Coal Ore', tiles: all('coal_ore'), hardness: 2.2, tool: 'pickaxe', needTool: true, mapColor: '#5a5a5a' }));
reg(B.IronOre, def({ name: 'Iron Ore', tiles: all('iron_ore'), hardness: 2.6, tool: 'pickaxe', needTool: true, minTier: 1, mapColor: '#8a6f5f' }));
reg(B.GoldOre, def({ name: 'Gold Ore', tiles: all('gold_ore'), hardness: 2.6, tool: 'pickaxe', needTool: true, minTier: 2, mapColor: '#a8903f' }));
reg(B.DiamondOre, def({ name: 'Diamond Ore', tiles: all('diamond_ore'), hardness: 2.8, tool: 'pickaxe', needTool: true, minTier: 2, mapColor: '#5fc8c0' }));
reg(B.Snow, def({ name: 'Snow Block', tiles: all('snow'), hardness: 0.35, tool: 'shovel', sound: 'snow', mapColor: '#f2fbfb' }));
reg(B.SnowyGrass, def({ name: 'Snowy Grass', tiles: sides('snow_side', 'snow', 'dirt'), hardness: 0.65, tool: 'shovel', dropId: B.Dirt, sound: 'snow', mapColor: '#e8f4f0' }));
reg(B.Ice, def({ name: 'Ice', tiles: all('ice'), hardness: 0.6, tool: 'pickaxe', lightOpacity: 1, sound: 'glass', mapColor: '#a8d8f0', dropId: 0 }));
reg(B.Cactus, def({ name: 'Cactus', tiles: sides('cactus_side', 'cactus_top'), shape: 'cactus', hardness: 0.3, opaque: false, lightOpacity: 1, sound: 'cloth', mapColor: '#2e7d32', support: 'sand' }));
reg(B.Torch, def({ name: 'Torch', tiles: all('torch'), shape: 'cross', solid: false, opaque: false, lightOpacity: 0, lightEmit: 14, hardness: 0.02, sound: 'wood', mapColor: '#ffb347', support: 'any' }));
reg(B.CraftingTable, def({ name: 'Crafting Table', tiles: ['crafting_side', 'crafting_side', 'crafting_top', 'planks', 'crafting_side2', 'crafting_side2'], hardness: 1.2, tool: 'axe', sound: 'wood', mapColor: '#9a7b4f' }));
reg(B.Furnace, def({ name: 'Furnace', tiles: ['furnace_side', 'furnace_side', 'furnace_top', 'furnace_top', 'furnace_front', 'furnace_side'], hardness: 2.2, tool: 'pickaxe', needTool: true, mapColor: '#666' }));
reg(B.Gravel, def({ name: 'Gravel', tiles: all('gravel'), hardness: 0.6, tool: 'shovel', sound: 'dirt', mapColor: '#8a837e', gravity: true }));
reg(B.TallGrass, def({ name: 'Tall Grass', tiles: all('tallgrass'), shape: 'cross', solid: false, opaque: false, lightOpacity: 0, hardness: 0.02, sound: 'plant', mapColor: '#5da23a', dropId: 0, support: 'soil' }));
reg(B.FlowerRed, def({ name: 'Poppy', tiles: all('flower_red'), shape: 'cross', solid: false, opaque: false, lightOpacity: 0, hardness: 0.02, sound: 'plant', mapColor: '#d23c2a', support: 'soil' }));
reg(B.FlowerYellow, def({ name: 'Dandelion', tiles: all('flower_yellow'), shape: 'cross', solid: false, opaque: false, lightOpacity: 0, hardness: 0.02, sound: 'plant', mapColor: '#e8d832', support: 'soil' }));
reg(B.DeadBush, def({ name: 'Dead Bush', tiles: all('deadbush'), shape: 'cross', solid: false, opaque: false, lightOpacity: 0, hardness: 0.02, sound: 'plant', mapColor: '#9a7b4f', dropId: 0, support: 'sand' }));
reg(B.Wool, def({ name: 'White Wool', tiles: all('wool'), hardness: 0.5, sound: 'cloth', mapColor: '#e8e8e8' }));
reg(B.Lava, def({ name: 'Lava', tiles: all('lava'), shape: 'liquid', solid: false, opaque: false, lightOpacity: 1, lightEmit: 15, hardness: Infinity, sound: 'cloth', mapColor: '#e25822', dropId: 0 }));
reg(B.StoneBricks, def({ name: 'Stone Bricks', tiles: all('stone_bricks'), hardness: 1.8, tool: 'pickaxe', needTool: true, mapColor: '#757575' }));
reg(B.Sapling, def({ name: 'Oak Sapling', tiles: all('sapling'), shape: 'cross', solid: false, opaque: false, lightOpacity: 0, hardness: 0.02, sound: 'plant', mapColor: '#4a9d3a', support: 'soil' }));
reg(B.Chest, def({ name: 'Chest', tiles: ['chest_side', 'chest_side', 'chest_top', 'chest_top', 'chest_side', 'chest_side'], hardness: 1.4, tool: 'axe', opaque: false, lightOpacity: 1, sound: 'wood', mapColor: '#8a6a35' }));
reg(B.Pumpkin, def({ name: 'Pumpkin', tiles: ['pumpkin_side', 'pumpkin_side', 'pumpkin_top', 'pumpkin_top', 'pumpkin_face', 'pumpkin_side'], hardness: 0.8, tool: 'axe', sound: 'cloth', mapColor: '#d98324' }));

export function blockDef(id: number): BlockDef { return BLOCKS[id] ?? BLOCKS[0]; }

// flat lookup tables for hot loops (lighting, meshing)
export const LIGHT_OPACITY = new Uint8Array(256);
export const LIGHT_EMIT = new Uint8Array(256);
BLOCKS.forEach((d, i) => { if (d) { LIGHT_OPACITY[i] = d.lightOpacity; LIGHT_EMIT[i] = d.lightEmit; } });
export function isOpaque(id: number) { return blockDef(id).opaque; }
export function isSolid(id: number) { return blockDef(id).solid; }
export function isLiquid(id: number) { return id === B.Water || id === B.Lava; }
export function isReplaceable(id: number) {
  return id === B.Air || id === B.Water || id === B.Lava || id === B.TallGrass;
}

export interface ToolInfo { type: ToolType; tier: number }
export const TIER_SPEED = [1, 2.2, 4, 6.5, 10]; // hand=1 multiplier index by tier+? tier: wood0 stone1 iron2 diamond3 -> speed via TIER_SPEED[tier+1]

/** seconds to break; Infinity if unbreakable */
export function breakSeconds(id: number, tool: ToolInfo | null): number {
  const d = blockDef(id);
  if (!isFinite(d.hardness)) return Infinity;
  let speed = 1;
  if (tool && d.tool === tool.type) speed = TIER_SPEED[tool.tier + 1];
  else if (tool && tool.type === 'sword' && (id === B.Leaves || id === B.PineLeaves)) speed = 3;
  let t = d.hardness / speed;
  // wrong-tier tool for ores: much slower
  if (d.needTool && (!tool || tool.type !== d.tool || tool.tier < d.minTier)) t *= 2.2;
  return Math.max(0.02, t);
}

export function canHarvest(id: number, tool: ToolInfo | null): boolean {
  const d = blockDef(id);
  if (!d.needTool) return true;
  return !!tool && tool.type === d.tool && tool.tier >= d.minTier;
}

/** Drops for a broken block. Item ids may be >=256 (pure items) via ITEM_DROPS override. */
export function blockDrops(id: number, tool: ToolInfo | null, rand: () => number): { id: number; count: number }[] {
  const d = blockDef(id);
  if (id === B.Leaves || id === B.PineLeaves) {
    const out: { id: number; count: number }[] = [];
    if (rand() < 0.06) out.push({ id: B.Sapling, count: 1 });
    if (rand() < 0.03) out.push({ id: 262, count: 1 }); // apple
    return out;
  }
  if (id === B.Gravel && rand() < 0.12) return [{ id: 271, count: 1 }]; // flint
  if (id === B.CoalOre) return canHarvest(id, tool) ? [{ id: 257, count: 1 }] : [];
  if (id === B.DiamondOre) return canHarvest(id, tool) ? [{ id: 261, count: 1 }] : [];
  if (!canHarvest(id, tool)) return [];
  if (d.dropId === 0) return [];
  return [{ id: d.dropId === -1 ? id : d.dropId, count: 1 }];
}

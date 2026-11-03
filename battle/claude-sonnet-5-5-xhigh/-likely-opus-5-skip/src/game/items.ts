// Item registry, drops, recipes, smelting, fuel.
import { B, BLOCKS, TILE, MATS, TOOLS, TL, isLog } from './blocks';

export interface Stack { id: number; n: number; d?: number }

export const I = {
  STICK: 256, COAL: 257, IRON_INGOT: 258, GOLD_INGOT: 259, DIAMOND: 260, FLINT: 261, FEATHER: 262,
  LEATHER: 263, RAW_PORK: 264, COOKED_PORK: 265, RAW_BEEF: 266, COOKED_BEEF: 267, RAW_CHICKEN: 268,
  COOKED_CHICKEN: 269, RAW_MUTTON: 270, COOKED_MUTTON: 271, APPLE: 272, BREAD: 273, WHEAT: 274,
  SEEDS: 275, BONE: 276, GUNPOWDER: 277, ROTTEN: 278, FLINT_STEEL: 279,
} as const;

export interface ToolInfo { kind: number; tier: number; speed: number; dur: number; dmg: number }
export interface ItemDef {
  id: number; name: string; tile: number; block: number; max: number;
  tool?: ToolInfo; food?: { h: number; s: number }; fuel?: number;
}
export const ITEMDEF: (ItemDef | undefined)[] = new Array(512).fill(undefined);

for (const b of BLOCKS) {
  if (!b || !b.item || b.id === 0) continue;
  ITEMDEF[b.id] = { id: b.id, name: b.name, tile: b.icon, block: b.id, max: 64 };
}
const item = (id: number, name: string, tile: string, o: Partial<ItemDef> = {}) => {
  ITEMDEF[id] = { id, name, tile: TILE[tile], block: 0, max: 64, ...o };
};
item(I.STICK, 'Stick', 'stick', { fuel: 5 });
item(I.COAL, 'Coal', 'coal', { fuel: 80 });
item(I.IRON_INGOT, 'Iron Ingot', 'iron_ingot');
item(I.GOLD_INGOT, 'Gold Ingot', 'gold_ingot');
item(I.DIAMOND, 'Diamond', 'diamond');
item(I.FLINT, 'Flint', 'flint');
item(I.FEATHER, 'Feather', 'feather');
item(I.LEATHER, 'Leather', 'leather');
item(I.RAW_PORK, 'Raw Porkchop', 'raw_pork', { food: { h: 3, s: 1.8 } });
item(I.COOKED_PORK, 'Cooked Porkchop', 'cooked_pork', { food: { h: 8, s: 12.8 } });
item(I.RAW_BEEF, 'Raw Beef', 'raw_beef', { food: { h: 3, s: 1.8 } });
item(I.COOKED_BEEF, 'Steak', 'cooked_beef', { food: { h: 8, s: 12.8 } });
item(I.RAW_CHICKEN, 'Raw Chicken', 'raw_chicken', { food: { h: 2, s: 1.2 } });
item(I.COOKED_CHICKEN, 'Cooked Chicken', 'cooked_chicken', { food: { h: 6, s: 7.2 } });
item(I.RAW_MUTTON, 'Raw Mutton', 'raw_mutton', { food: { h: 2, s: 1.2 } });
item(I.COOKED_MUTTON, 'Cooked Mutton', 'cooked_mutton', { food: { h: 6, s: 9.6 } });
item(I.APPLE, 'Apple', 'apple', { food: { h: 4, s: 2.4 } });
item(I.BREAD, 'Bread', 'bread', { food: { h: 5, s: 6 } });
item(I.WHEAT, 'Wheat', 'wheat');
item(I.SEEDS, 'Wheat Seeds', 'seeds');
item(I.BONE, 'Bone', 'bone');
item(I.GUNPOWDER, 'Gunpowder', 'gunpowder');
item(I.ROTTEN, 'Rotten Flesh', 'rotten_flesh', { food: { h: 4, s: 0.8 } });
item(I.FLINT_STEEL, 'Flint and Steel', 'flint_steel', { max: 1 });

const TIER = [1, 2, 3, 4], SPEED = [2, 4, 6, 8], DUR = [59, 131, 250, 1561], BONUS = [0, 1, 2, 3];
const MAT_NAME = ['Wooden', 'Stone', 'Iron', 'Diamond'];
const TOOL_KIND = [TL.PICK, TL.AXE, TL.SHOVEL, TL.SWORD, TL.HOE];
const TOOL_NAME = ['Pickaxe', 'Axe', 'Shovel', 'Sword', 'Hoe'];
const TOOL_DMG = [2, 3, 1.5, 4, 1];
export const toolId = (mat: number, t: number) => 288 + mat * 8 + t;
for (let m = 0; m < 4; m++) {
  for (let t = 0; t < 5; t++) {
    item(toolId(m, t), `${MAT_NAME[m]} ${TOOL_NAME[t]}`, `${MATS[m]}_${TOOLS[t]}`, {
      max: 1,
      fuel: m === 0 ? 10 : undefined,
      tool: { kind: TOOL_KIND[t], tier: TIER[m], speed: SPEED[m], dur: DUR[m], dmg: TOOL_DMG[t] + BONUS[m] },
    });
  }
}
for (const id of [B.PLANKS, B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.TABLE, B.CHEST, B.BOOKSHELF]) ITEMDEF[id]!.fuel = 15;
ITEMDEF[B.SAPLING]!.fuel = 5;

export const CREATIVE_ITEMS: number[] = [];
ITEMDEF.forEach((d) => d && CREATIVE_ITEMS.push(d.id));

export function maxDur(id: number) { return ITEMDEF[id]?.tool?.dur ?? (id === I.FLINT_STEEL ? 65 : 0); }

// Block drops ------------------------------------------------------------
export function blockDrops(id: number, rnd: () => number, harvest: boolean): [number, number][] {
  const bd = BLOCKS[id];
  if (!bd || bd.hardness < 0 && id !== B.WATER) return [];
  if (!harvest && bd.tier > 0) return [];
  switch (id) {
    case B.GRASS: case B.SNOW_GRASS: case B.FARMLAND: return [[B.DIRT, 1]];
    case B.STONE: return [[B.COBBLE, 1]];
    case B.COAL_ORE: return [[I.COAL, 1]];
    case B.DIAMOND_ORE: return [[I.DIAMOND, 1]];
    case B.LEAVES: {
      const r = rnd();
      if (r < 0.1) return [[B.SAPLING, 1]];
      if (r < 0.13) return [[I.APPLE, 1]];
      if (r < 0.18) return [[I.STICK, 1]];
      return [];
    }
    case B.BIRCH_LEAVES: case B.SPRUCE_LEAVES: return rnd() < 0.06 ? [[I.STICK, 1]] : [];
    case B.GRAVEL: return rnd() < 0.12 ? [[I.FLINT, 1]] : [[B.GRAVEL, 1]];
    case B.TALLGRASS: return rnd() < 0.15 ? [[I.SEEDS, 1]] : [];
    case B.DEADBUSH: return rnd() < 0.5 ? [[I.STICK, 1 + ((rnd() * 2) | 0)]] : [];
    case B.GLASS: case B.ICE: case B.WATER: case B.LAVA: case B.AIR: return [];
    case B.FURNACE_LIT: return [[B.FURNACE, 1]];
    case B.WHEAT0: case B.WHEAT1: case B.WHEAT2: return [[I.SEEDS, 1]];
    case B.WHEAT3: return [[I.WHEAT, 1], [I.SEEDS, 1 + ((rnd() * 3) | 0)]];
    default: return bd.item ? [[id, 1]] : [];
  }
}

export function miningTime(id: number, held: Stack | null) {
  const bd = BLOCKS[id];
  if (!bd || bd.hardness < 0) return Infinity;
  const tool = held ? ITEMDEF[held.id]?.tool : undefined;
  const matches = !!tool && tool.kind === bd.tool && bd.tool !== TL.NONE;
  const harvest = bd.tier === 0 || (matches && tool!.tier >= bd.tier);
  const speed = matches ? tool!.speed : 1;
  return (bd.hardness * (harvest ? 1.5 : 5)) / speed;
}
export function canHarvest(id: number, held: Stack | null) {
  const bd = BLOCKS[id];
  if (bd.tier === 0) return true;
  const tool = held ? ITEMDEF[held.id]?.tool : undefined;
  return !!tool && tool.kind === bd.tool && tool.tier >= bd.tier;
}

// Recipes ----------------------------------------------------------------
export type Ing = number | string;
export interface Recipe { w: number; h: number; cells: (Ing | null)[]; out: number; n: number; shapeless: boolean }
const TAGS: Record<string, number[]> = {
  planks: [B.PLANKS],
  logs: [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG],
};
export const ingMatches = (ing: Ing, id: number) => (typeof ing === 'number' ? ing === id : TAGS[ing].includes(id));
export const ingRepresentative = (ing: Ing) => (typeof ing === 'number' ? ing : TAGS[ing][0]);

export const RECIPES: Recipe[] = [];
function shaped(rows: string[], key: Record<string, Ing>, out: number, n = 1) {
  const w = rows[0].length, h = rows.length;
  const cells: (Ing | null)[] = [];
  for (const r of rows) for (const c of r) cells.push(c === '.' ? null : key[c]);
  RECIPES.push({ w, h, cells, out, n, shapeless: false });
}
function shapeless(ings: Ing[], out: number, n = 1) {
  RECIPES.push({ w: ings.length, h: 1, cells: ings, out, n, shapeless: true });
}

shapeless(['logs'], B.PLANKS, 4);
shaped(['P', 'P'], { P: 'planks' }, I.STICK, 4);
shaped(['PP', 'PP'], { P: 'planks' }, B.TABLE);
shaped(['PPP', 'P.P', 'PPP'], { P: 'planks' }, B.CHEST);
shaped(['CCC', 'C.C', 'CCC'], { C: B.COBBLE }, B.FURNACE);
shaped(['C', 'S'], { C: I.COAL, S: I.STICK }, B.TORCH, 4);
const heads: Ing[] = ['planks', B.COBBLE, I.IRON_INGOT, I.DIAMOND];
for (let m = 0; m < 4; m++) {
  const k = { H: heads[m], S: I.STICK };
  shaped(['HHH', '.S.', '.S.'], k, toolId(m, 0));
  shaped(['HH', 'HS', '.S'], k, toolId(m, 1));
  shaped(['H', 'S', 'S'], k, toolId(m, 2));
  shaped(['H', 'H', 'S'], k, toolId(m, 3));
  shaped(['HH', '.S', '.S'], k, toolId(m, 4));
}
shaped(['WWW'], { W: I.WHEAT }, I.BREAD);
shaped(['SS', 'SS'], { S: B.SAND }, B.SANDSTONE);
shaped(['SS', 'SS'], { S: B.STONE }, B.STONE_BRICKS, 4);
shaped(['PPP', 'LLL', 'PPP'], { P: 'planks', L: I.LEATHER }, B.BOOKSHELF);
shaped(['GSG', 'SGS', 'GSG'], { G: I.GUNPOWDER, S: B.SAND }, B.TNT);
shapeless([B.GLASS, B.TORCH], B.LAMP);
shapeless([I.FLINT, I.IRON_INGOT], I.FLINT_STEEL);
shapeless([B.WOOL, B.FLOWER_RED], B.WOOL_RED);
shapeless([B.WOOL, B.FLOWER_YELLOW], B.WOOL_YELLOW);
for (const [ing, blk] of [[I.IRON_INGOT, B.IRON_BLOCK], [I.GOLD_INGOT, B.GOLD_BLOCK], [I.DIAMOND, B.DIAMOND_BLOCK]]) {
  shaped(['III', 'III', 'III'], { I: ing }, blk);
  shapeless([blk], ing, 9);
}

export function findRecipe(grid: (Stack | null)[], gw: number, gh: number): Recipe | null {
  let minX = gw, minY = gh, maxX = -1, maxY = -1;
  const ids: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const s = grid[i];
    if (!s) continue;
    const x = i % gw, y = (i / gw) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    ids.push(s.id);
  }
  if (!ids.length) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  for (const r of RECIPES) {
    if (r.shapeless) {
      if (r.cells.length !== ids.length) continue;
      const used = new Array(ids.length).fill(false);
      let ok = true;
      for (const ing of r.cells) {
        let found = false;
        for (let j = 0; j < ids.length; j++) if (!used[j] && ingMatches(ing!, ids[j])) { used[j] = true; found = true; break; }
        if (!found) { ok = false; break; }
      }
      if (ok) return r;
    } else if (r.w === w && r.h === h) {
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) {
          for (let x = 0; x < w; x++) {
            const rx = mirror ? w - 1 - x : x;
            const ing = r.cells[y * w + rx];
            const s = grid[(minY + y) * gw + minX + x];
            if (ing === null) { if (s) { ok = false; break; } } else if (!s || !ingMatches(ing, s.id)) { ok = false; break; }
          }
        }
        if (ok) return r;
      }
    }
  }
  return null;
}

// Smelting -----------------------------------------------------------------
export const SMELT: Record<number, number> = {
  [B.IRON_ORE]: I.IRON_INGOT, [B.GOLD_ORE]: I.GOLD_INGOT, [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE,
  [I.RAW_PORK]: I.COOKED_PORK, [I.RAW_BEEF]: I.COOKED_BEEF, [I.RAW_CHICKEN]: I.COOKED_CHICKEN,
  [I.RAW_MUTTON]: I.COOKED_MUTTON, [B.LOG]: I.COAL, [B.BIRCH_LOG]: I.COAL, [B.SPRUCE_LOG]: I.COAL,
};
export const fuelValue = (id: number) => ITEMDEF[id]?.fuel ?? 0;
export const isLogItem = isLog;

export const itemName = (id: number) => ITEMDEF[id]?.name ?? 'Unknown';

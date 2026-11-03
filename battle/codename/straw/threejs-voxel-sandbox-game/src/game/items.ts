// Items (ids >= 256 are pure items; ids < 256 are placeable blocks),
// crafting recipes and smelting.
import { B, blockDef, type ToolType } from './blocks';
import { setIconResolver } from './textures';

export const I = {
  Stick: 256, Coal: 257, Charcoal: 258, IronIngot: 259, GoldIngot: 260, Diamond: 261,
  Apple: 262, RawPork: 263, CookedPork: 264, RawBeef: 265, Steak: 266,
  RawChicken: 267, CookedChicken: 268, RottenFlesh: 269, Feather: 270, Flint: 271,
  Egg: 272, Bread: 273, GoldenApple: 274,
  WoodPick: 280, StonePick: 281, IronPick: 282, DiamondPick: 283,
  WoodAxe: 284, StoneAxe: 285, IronAxe: 286, DiamondAxe: 287,
  WoodShovel: 288, StoneShovel: 289, IronShovel: 290, DiamondShovel: 291,
  WoodSword: 292, StoneSword: 293, IronSword: 294, DiamondSword: 295,
} as const;

export interface Stack { id: number; count: number; dur?: number }
export function mkStack(id: number, count = 1): Stack {
  const d = itemDef(id);
  return d.durability ? { id, count, dur: d.durability } : { id, count };
}
export function cloneStack(s: Stack | null): Stack | null { return s ? { ...s } : null; }

export interface ItemDef {
  name: string;
  icon: string;
  maxStack: number;
  tool?: Exclude<ToolType, 'none'>;
  tier?: number;        // 0 wood, 1 stone, 2 iron, 3 diamond
  durability?: number;
  damage: number;       // melee damage
  food?: number;        // hunger points restored
  heal?: number;        // hp restored when eaten
  fuel?: number;        // burn seconds in furnace
  placeBlock?: number;  // block id placed by this item
}

const toolDefs = (base: number, kind: 'pickaxe' | 'axe' | 'shovel' | 'sword', label: string) => {
  const tiers: [string, string, number, number][] = [
    ['Wooden', 'wood', 59, 0], ['Stone', 'stone', 131, 1], ['Iron', 'iron', 250, 2], ['Diamond', 'diamond', 900, 3],
  ];
  const dmg = kind === 'sword' ? [4, 5, 6, 8] : kind === 'axe' ? [3, 4, 5, 6] : [2, 3, 4, 5];
  tiers.forEach(([tn, tk, dur, tier], i) => {
    ITEMS.set(base + i, {
      name: `${tn} ${label}`, icon: `${kind}_${tk}`, maxStack: 1, tool: kind, tier,
      durability: dur, damage: dmg[i],
    });
  });
};

export const ITEMS = new Map<number, ItemDef>();
ITEMS.set(I.Stick, { name: 'Stick', icon: 'stick', maxStack: 64, damage: 1, fuel: 4 });
ITEMS.set(I.Coal, { name: 'Coal', icon: 'coal', maxStack: 64, damage: 1, fuel: 40 });
ITEMS.set(I.Charcoal, { name: 'Charcoal', icon: 'charcoal', maxStack: 64, damage: 1, fuel: 40 });
ITEMS.set(I.IronIngot, { name: 'Iron Ingot', icon: 'iron_ingot', maxStack: 64, damage: 1 });
ITEMS.set(I.GoldIngot, { name: 'Gold Ingot', icon: 'gold_ingot', maxStack: 64, damage: 1 });
ITEMS.set(I.Diamond, { name: 'Diamond', icon: 'diamond', maxStack: 64, damage: 1 });
ITEMS.set(I.Apple, { name: 'Apple', icon: 'apple', maxStack: 64, damage: 1, food: 4 });
ITEMS.set(I.RawPork, { name: 'Raw Porkchop', icon: 'raw_pork', maxStack: 64, damage: 1, food: 3 });
ITEMS.set(I.CookedPork, { name: 'Cooked Porkchop', icon: 'cooked_pork', maxStack: 64, damage: 1, food: 8 });
ITEMS.set(I.RawBeef, { name: 'Raw Beef', icon: 'raw_beef', maxStack: 64, damage: 1, food: 3 });
ITEMS.set(I.Steak, { name: 'Steak', icon: 'steak', maxStack: 64, damage: 1, food: 8 });
ITEMS.set(I.RawChicken, { name: 'Raw Chicken', icon: 'raw_chicken', maxStack: 64, damage: 1, food: 2 });
ITEMS.set(I.CookedChicken, { name: 'Cooked Chicken', icon: 'cooked_chicken', maxStack: 64, damage: 1, food: 6 });
ITEMS.set(I.RottenFlesh, { name: 'Rotten Flesh', icon: 'rotten_flesh', maxStack: 64, damage: 1, food: 3 });
ITEMS.set(I.Feather, { name: 'Feather', icon: 'feather', maxStack: 64, damage: 1 });
ITEMS.set(I.Flint, { name: 'Flint', icon: 'flint', maxStack: 64, damage: 1 });
ITEMS.set(I.Egg, { name: 'Egg', icon: 'egg', maxStack: 16, damage: 1, food: 1 });
ITEMS.set(I.Bread, { name: 'Bread', icon: 'bread', maxStack: 64, damage: 1, food: 5 });
toolDefs(I.WoodPick, 'pickaxe', 'Pickaxe');
toolDefs(I.WoodAxe, 'axe', 'Axe');
toolDefs(I.WoodShovel, 'shovel', 'Shovel');
toolDefs(I.WoodSword, 'sword', 'Sword');

const WOOD_FUEL: Record<number, number> = {
  [B.Planks]: 8, [B.Log]: 8, [B.BirchLog]: 8, [B.PineLog]: 8, [B.CraftingTable]: 8, [B.Chest]: 8, [B.Sapling]: 3,
};

export function itemDef(id: number): ItemDef {
  const d = ITEMS.get(id);
  if (d) return d;
  const b = blockDef(id);
  return {
    name: b.name, icon: '', maxStack: 64, damage: 1, placeBlock: id,
    fuel: WOOD_FUEL[id],
  };
}
export function isBlockItem(id: number) { return id < 256; }

setIconResolver((id) => ({ icon: itemDef(id).icon, isBlock: isBlockItem(id) }));

// ---------- crafting ----------
export type Ingredient = number | number[];
export interface Recipe {
  out: Stack;
  shape?: string[];                    // rows; ' ' = empty
  key?: Record<string, Ingredient>;
  shapeless?: Ingredient[];
}

const LOGS = [B.Log, B.BirchLog, B.PineLog];
const COALS = [I.Coal, I.Charcoal];
const MAT: { wood: Ingredient; stone: Ingredient; iron: Ingredient; diamond: Ingredient } = {
  wood: B.Planks, stone: B.Cobble, iron: I.IronIngot, diamond: I.Diamond,
};
const TIER_OUT = {
  pickaxe: [I.WoodPick, I.StonePick, I.IronPick, I.DiamondPick],
  axe: [I.WoodAxe, I.StoneAxe, I.IronAxe, I.DiamondAxe],
  shovel: [I.WoodShovel, I.StoneShovel, I.IronShovel, I.DiamondShovel],
  sword: [I.WoodSword, I.StoneSword, I.IronSword, I.DiamondSword],
} as const;

export const RECIPES: Recipe[] = [
  { out: { id: B.Planks, count: 4 }, shapeless: [LOGS] },
  { out: { id: I.Stick, count: 4 }, shape: ['P', 'P'], key: { P: B.Planks } },
  { out: { id: B.CraftingTable, count: 1 }, shape: ['PP', 'PP'], key: { P: B.Planks } },
  { out: { id: B.Torch, count: 4 }, shape: ['C', 'S'], key: { C: COALS, S: I.Stick } },
  { out: { id: B.Chest, count: 1 }, shape: ['PPP', 'P P', 'PPP'], key: { P: B.Planks } },
  { out: { id: B.Furnace, count: 1 }, shape: ['CCC', 'C C', 'CCC'], key: { C: B.Cobble } },
  { out: { id: B.StoneBricks, count: 4 }, shape: ['SS', 'SS'], key: { S: B.Stone } },
  { out: { id: B.Sandstone, count: 1 }, shape: ['SS', 'SS'], key: { S: B.Sand } },
  { out: { id: B.Wool, count: 1 }, shapeless: [I.Feather, I.Feather, I.Feather, I.Feather] },
];

(['wood', 'stone', 'iron', 'diamond'] as const).forEach((m, ti) => {
  RECIPES.push(
    { out: { id: TIER_OUT.pickaxe[ti], count: 1 }, shape: ['MMM', ' S ', ' S '], key: { M: MAT[m], S: I.Stick } },
    { out: { id: TIER_OUT.axe[ti], count: 1 }, shape: ['MM', 'MS', ' S'], key: { M: MAT[m], S: I.Stick } },
    { out: { id: TIER_OUT.shovel[ti], count: 1 }, shape: ['M', 'S', 'S'], key: { M: MAT[m], S: I.Stick } },
    { out: { id: TIER_OUT.sword[ti], count: 1 }, shape: ['M', 'M', 'S'], key: { M: MAT[m], S: I.Stick } },
  );
});

function matchIng(ing: Ingredient, id: number): boolean {
  return Array.isArray(ing) ? ing.includes(id) : ing === id;
}

/** grid: row-major w*h slots. Returns output stack + indices to consume. */
export function matchRecipe(grid: (Stack | null)[], w: number, h: number): { out: Stack; consume: number[] } | null {
  for (const r of RECIPES) {
    if (r.shapeless) {
      const filled = grid.map((s, i) => (s ? i : -1)).filter(i => i >= 0);
      if (filled.length !== r.shapeless.length) continue;
      const rest = [...r.shapeless];
      const used: number[] = [];
      let ok = true;
      for (const gi of filled) {
        const id = grid[gi]!.id;
        const k = rest.findIndex(ing => matchIng(ing, id));
        if (k < 0) { ok = false; break; }
        rest.splice(k, 1); used.push(gi);
      }
      if (ok) return { out: mkStack(r.out.id, r.out.count), consume: used };
      continue;
    }
    const shape = r.shape!;
    const sh = shape.length, sw = Math.max(...shape.map(s => s.length));
    // try normal + mirrored, at every offset
    for (const mirror of [false, true]) {
      for (let oy = 0; oy + sh <= h; oy++) for (let ox = 0; ox + sw <= w; ox++) {
        const used: number[] = [];
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
          const gx = x - ox, gy = y - oy;
          let ch = ' ';
          if (gx >= 0 && gy >= 0 && gy < sh && gx < shape[gy].length) {
            ch = shape[gy][mirror ? shape[gy].length - 1 - gx : gx];
          }
          const slot = grid[y * w + x];
          if (ch === ' ') { if (slot) ok = false; }
          else {
            if (!slot || !matchIng(r.key![ch], slot.id)) ok = false;
            else used.push(y * w + x);
          }
        }
        if (ok && used.length) return { out: mkStack(r.out.id, r.out.count), consume: used };
      }
    }
  }
  return null;
}

// ---------- smelting ----------
export const SMELTING = new Map<number, number>([
  [B.Cobble, B.Stone],
  [B.Sand, B.Glass],
  [B.IronOre, I.IronIngot],
  [B.GoldOre, I.GoldIngot],
  [B.Log, I.Charcoal], [B.BirchLog, I.Charcoal], [B.PineLog, I.Charcoal],
  [I.RawPork, I.CookedPork], [I.RawBeef, I.Steak], [I.RawChicken, I.CookedChicken],
]);
export const SMELT_SECONDS = 5;

// Blocks/items offered in the creative palette
export const CREATIVE_BLOCKS: number[] = [
  B.Grass, B.Dirt, B.Stone, B.Cobble, B.StoneBricks, B.Sand, B.Sandstone, B.Gravel,
  B.Log, B.BirchLog, B.PineLog, B.Planks, B.Leaves, B.PineLeaves, B.Glass, B.Bedrock,
  B.CoalOre, B.IronOre, B.GoldOre, B.DiamondOre, B.Snow, B.SnowyGrass, B.Ice, B.Cactus,
  B.Torch, B.CraftingTable, B.Furnace, B.Chest, B.Wool, B.Pumpkin, B.Sapling,
  B.TallGrass, B.FlowerRed, B.FlowerYellow, B.DeadBush,
];
export const CREATIVE_ITEMS: number[] = [
  I.Stick, I.Coal, I.Charcoal, I.IronIngot, I.GoldIngot, I.Diamond, I.Apple, I.Bread,
  I.CookedPork, I.Steak, I.CookedChicken, I.Feather, I.Flint, I.Egg,
  I.DiamondPick, I.DiamondAxe, I.DiamondShovel, I.DiamondSword,
  I.IronPick, I.IronAxe, I.IronShovel, I.IronSword,
];

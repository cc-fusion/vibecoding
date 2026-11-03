export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Log = 5,
  Leaves = 6,
  Planks = 7,
  Cobblestone = 8,
  CoalOre = 9,
  IronOre = 10,
  Water = 11,
  Bedrock = 12,
  Snow = 13,
  CraftingTable = 14,
}

export type ItemId =
  | "dirt"
  | "sand"
  | "oak_log"
  | "oak_leaves"
  | "oak_planks"
  | "cobblestone"
  | "coal"
  | "iron_ore"
  | "snow"
  | "sticks"
  | "crafting_table"
  | "wooden_pickaxe"
  | "wooden_axe"
  | "stone_pickaxe"
  | "stone_axe";

export interface ItemDefinition {
  name: string;
  color: string;
  kind: "block" | "resource" | "tool";
  placeBlock?: BlockId;
}

export const ITEM_DEFS: Record<ItemId, ItemDefinition> = {
  dirt: { name: "Dirt", color: "#85634c", kind: "block", placeBlock: BlockId.Dirt },
  sand: { name: "Sand", color: "#d6c28b", kind: "block", placeBlock: BlockId.Sand },
  oak_log: { name: "Oak log", color: "#88603b", kind: "block", placeBlock: BlockId.Log },
  oak_leaves: { name: "Oak leaves", color: "#507b4b", kind: "block", placeBlock: BlockId.Leaves },
  oak_planks: { name: "Oak planks", color: "#bd9562", kind: "block", placeBlock: BlockId.Planks },
  cobblestone: { name: "Cobblestone", color: "#777e7d", kind: "block", placeBlock: BlockId.Cobblestone },
  coal: { name: "Coal", color: "#303535", kind: "resource" },
  iron_ore: { name: "Iron ore", color: "#a78b78", kind: "block", placeBlock: BlockId.IronOre },
  snow: { name: "Snow", color: "#e6eeec", kind: "block", placeBlock: BlockId.Snow },
  sticks: { name: "Sticks", color: "#a57b4f", kind: "resource" },
  crafting_table: { name: "Crafting table", color: "#a67545", kind: "block", placeBlock: BlockId.CraftingTable },
  wooden_pickaxe: { name: "Wooden pickaxe", color: "#c29a61", kind: "tool" },
  wooden_axe: { name: "Wooden axe", color: "#c29a61", kind: "tool" },
  stone_pickaxe: { name: "Stone pickaxe", color: "#89918f", kind: "tool" },
  stone_axe: { name: "Stone axe", color: "#89918f", kind: "tool" },
};

export const ITEM_ORDER = Object.keys(ITEM_DEFS) as ItemId[];

export interface Recipe {
  id: ItemId;
  output: number;
  ingredients: Partial<Record<ItemId, number>>;
}

export const RECIPES: Recipe[] = [
  { id: "oak_planks", output: 4, ingredients: { oak_log: 1 } },
  { id: "sticks", output: 4, ingredients: { oak_planks: 2 } },
  { id: "crafting_table", output: 1, ingredients: { oak_planks: 4 } },
  { id: "wooden_pickaxe", output: 1, ingredients: { oak_planks: 3, sticks: 2 } },
  { id: "wooden_axe", output: 1, ingredients: { oak_planks: 3, sticks: 2 } },
  { id: "stone_pickaxe", output: 1, ingredients: { cobblestone: 3, sticks: 2 } },
  { id: "stone_axe", output: 1, ingredients: { cobblestone: 3, sticks: 2 } },
];

export function blockForItem(item: ItemId | null | undefined): BlockId | null {
  if (!item) return null;
  return ITEM_DEFS[item].placeBlock ?? null;
}

export function itemForBlock(block: BlockId): ItemId | null {
  switch (block) {
    case BlockId.Grass:
    case BlockId.Dirt:
      return "dirt";
    case BlockId.Stone:
      return "cobblestone";
    case BlockId.Sand:
      return "sand";
    case BlockId.Log:
      return "oak_log";
    case BlockId.Leaves:
      return "oak_leaves";
    case BlockId.Planks:
      return "oak_planks";
    case BlockId.Cobblestone:
      return "cobblestone";
    case BlockId.CoalOre:
      return "coal";
    case BlockId.IronOre:
      return "iron_ore";
    case BlockId.Snow:
      return "snow";
    case BlockId.CraftingTable:
      return "crafting_table";
    default:
      return null;
  }
}

export function blockName(block: BlockId): string {
  switch (block) {
    case BlockId.Grass: return "Grass block";
    case BlockId.Dirt: return "Dirt";
    case BlockId.Stone: return "Stone";
    case BlockId.Sand: return "Sand";
    case BlockId.Log: return "Oak log";
    case BlockId.Leaves: return "Oak leaves";
    case BlockId.Planks: return "Oak planks";
    case BlockId.Cobblestone: return "Cobblestone";
    case BlockId.CoalOre: return "Coal ore";
    case BlockId.IronOre: return "Iron ore";
    case BlockId.Water: return "Water";
    case BlockId.Bedrock: return "Bedrock";
    case BlockId.Snow: return "Snow";
    case BlockId.CraftingTable: return "Crafting table";
    default: return "Air";
  }
}

export function blockHardness(block: BlockId): number {
  switch (block) {
    case BlockId.Grass: return 0.32;
    case BlockId.Dirt: return 0.36;
    case BlockId.Sand: return 0.34;
    case BlockId.Snow: return 0.28;
    case BlockId.Leaves: return 0.24;
    case BlockId.Log: return 0.78;
    case BlockId.Planks: return 0.58;
    case BlockId.CraftingTable: return 0.62;
    case BlockId.Stone: return 1.25;
    case BlockId.Cobblestone: return 1.05;
    case BlockId.CoalOre: return 1.4;
    case BlockId.IronOre: return 1.65;
    default: return Number.POSITIVE_INFINITY;
  }
}
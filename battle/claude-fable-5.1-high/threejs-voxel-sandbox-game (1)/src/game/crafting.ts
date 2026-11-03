// Recipe-book style crafting. station: 'hand' (2x2 equivalent), 'table', 'furnace'.
import { B, I } from "./blocks";
import type { Inventory } from "./inventory";

export type Station = "hand" | "table" | "furnace";

export interface Recipe {
  out: { id: number; count: number };
  in: { id: number; count: number }[];
  station: Station;
  /** Alternative inputs: any of these ids satisfies that ingredient slot */
  anyOf?: Record<number, number[]>;
}

const LOGS = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG];
const PLANKS = [B.PLANKS, B.BIRCH_PLANKS, B.SPRUCE_PLANKS];

function r(out: number, count: number, station: Station, ...inputs: [number, number][]): Recipe {
  const rec: Recipe = { out: { id: out, count }, in: inputs.map(([id, c]) => ({ id, count: c })), station };
  const any: Record<number, number[]> = {};
  for (const [id] of inputs) {
    if (id === B.PLANKS) any[id] = PLANKS;
    if (id === B.LOG) any[id] = LOGS;
  }
  if (Object.keys(any).length) rec.anyOf = any;
  return rec;
}

export const RECIPES: Recipe[] = [
  // hand
  { out: { id: B.PLANKS, count: 4 }, in: [{ id: B.LOG, count: 1 }], station: "hand" },
  { out: { id: B.BIRCH_PLANKS, count: 4 }, in: [{ id: B.BIRCH_LOG, count: 1 }], station: "hand" },
  { out: { id: B.SPRUCE_PLANKS, count: 4 }, in: [{ id: B.SPRUCE_LOG, count: 1 }], station: "hand" },
  r(I.STICK, 4, "hand", [B.PLANKS, 2]),
  r(B.CRAFTING_TABLE, 1, "hand", [B.PLANKS, 4]),
  r(B.TORCH, 4, "hand", [I.COAL, 1], [I.STICK, 1]),
  r(I.WOOD_PICKAXE, 1, "hand", [B.PLANKS, 3], [I.STICK, 2]),
  r(I.WOOD_SWORD, 1, "hand", [B.PLANKS, 2], [I.STICK, 1]),
  r(I.BOWL, 4, "hand", [B.PLANKS, 3]),
  r(I.MUSHROOM_STEW, 1, "hand", [I.BOWL, 1], [B.MUSHROOM, 2]),
  // table
  r(I.WOOD_AXE, 1, "table", [B.PLANKS, 3], [I.STICK, 2]),
  r(I.WOOD_SHOVEL, 1, "table", [B.PLANKS, 1], [I.STICK, 2]),
  r(I.STONE_PICKAXE, 1, "table", [B.COBBLE, 3], [I.STICK, 2]),
  r(I.STONE_AXE, 1, "table", [B.COBBLE, 3], [I.STICK, 2]),
  r(I.STONE_SHOVEL, 1, "table", [B.COBBLE, 1], [I.STICK, 2]),
  r(I.STONE_SWORD, 1, "table", [B.COBBLE, 2], [I.STICK, 1]),
  r(I.IRON_PICKAXE, 1, "table", [I.IRON_INGOT, 3], [I.STICK, 2]),
  r(I.IRON_AXE, 1, "table", [I.IRON_INGOT, 3], [I.STICK, 2]),
  r(I.IRON_SHOVEL, 1, "table", [I.IRON_INGOT, 1], [I.STICK, 2]),
  r(I.IRON_SWORD, 1, "table", [I.IRON_INGOT, 2], [I.STICK, 1]),
  r(I.DIAMOND_PICKAXE, 1, "table", [I.DIAMOND, 3], [I.STICK, 2]),
  r(I.DIAMOND_AXE, 1, "table", [I.DIAMOND, 3], [I.STICK, 2]),
  r(I.DIAMOND_SHOVEL, 1, "table", [I.DIAMOND, 1], [I.STICK, 2]),
  r(I.DIAMOND_SWORD, 1, "table", [I.DIAMOND, 2], [I.STICK, 1]),
  r(B.FURNACE, 1, "table", [B.COBBLE, 8]),
  r(B.STONE_BRICK, 4, "table", [B.STONE, 4]),
  r(B.SANDSTONE, 1, "table", [B.SAND, 4]),
  r(B.BOOKSHELF, 1, "table", [B.PLANKS, 6], [B.LEAVES, 3]),
  r(B.BED, 1, "table", [B.PLANKS, 3], [B.WOOL, 3]),
  r(B.LANTERN, 2, "table", [I.IRON_INGOT, 1], [B.TORCH, 1]),
  r(B.GLOWSTONE, 1, "table", [B.TORCH, 4], [B.GLASS, 1], [I.GOLD_INGOT, 1]),
  r(B.MOSSY_COBBLE, 1, "table", [B.COBBLE, 1], [B.TALL_GRASS, 1]),
  r(B.BRICK, 1, "table", [B.CLAY, 4]),
  // furnace (each requires 1 coal as fuel)
  r(I.IRON_INGOT, 1, "furnace", [B.IRON_ORE, 1], [I.COAL, 1]),
  r(I.GOLD_INGOT, 1, "furnace", [B.GOLD_ORE, 1], [I.COAL, 1]),
  r(B.GLASS, 2, "furnace", [B.SAND, 2], [I.COAL, 1]),
  r(B.STONE, 2, "furnace", [B.COBBLE, 2], [I.COAL, 1]),
  r(I.COOKED_PORKCHOP, 1, "furnace", [I.PORKCHOP, 1], [I.COAL, 1]),
  r(I.STEAK, 1, "furnace", [I.BEEF, 1], [I.COAL, 1]),
  r(I.COOKED_MUTTON, 1, "furnace", [I.MUTTON, 1], [I.COAL, 1]),
  r(I.COAL, 2, "furnace", [B.LOG, 2], [B.PLANKS, 1]),
];

export function recipesFor(station: Station): Recipe[] {
  if (station === "hand") return RECIPES.filter((r) => r.station === "hand");
  if (station === "table") return RECIPES.filter((r) => r.station === "hand" || r.station === "table");
  return RECIPES.filter((r) => r.station === "furnace");
}

/** Which concrete id satisfies an ingredient given inventory contents. */
function resolveIngredient(inv: Inventory, rec: Recipe, ing: { id: number; count: number }): number | null {
  const options = rec.anyOf?.[ing.id] ?? [ing.id];
  for (const id of options) if (inv.count(id) >= ing.count) return id;
  return null;
}

export function canCraft(inv: Inventory, rec: Recipe): boolean {
  return rec.in.every((ing) => resolveIngredient(inv, rec, ing) !== null);
}

export function craft(inv: Inventory, rec: Recipe): boolean {
  if (!canCraft(inv, rec)) return false;
  const resolved = rec.in.map((ing) => ({ id: resolveIngredient(inv, rec, ing)!, count: ing.count }));
  for (const ing of resolved) inv.remove(ing.id, ing.count);
  const left = inv.add(rec.out.id, rec.out.count);
  if (left > 0) return true; // caller may drop leftovers; keep simple
  return true;
}

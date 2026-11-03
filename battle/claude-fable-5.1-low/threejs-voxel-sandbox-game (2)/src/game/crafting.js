import { B, I } from './blocks.js';

// Shapeless, count-based recipes. station: null | 'table' | 'furnace'
// in: [[id, count], ...]  out: [id, count]
const r = (out, inp, cat, station = null, alt = null) => ({ out, in: inp, cat, station, alt });
const anyLog = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG];

export const RECIPES = [
  r([B.PLANKS, 4], [[B.LOG, 1]], 'blocks', null, { [B.LOG]: anyLog }),
  r([I.STICK, 4], [[B.PLANKS, 2]], 'tools'),
  r([B.CRAFTING_TABLE, 1], [[B.PLANKS, 4]], 'blocks'),
  r([B.TORCH, 4], [[I.COAL, 1], [I.STICK, 1]], 'blocks'),
  r([B.LADDER, 3], [[I.STICK, 7]], 'blocks'),
  r([B.FENCE, 3], [[B.PLANKS, 4], [I.STICK, 2]], 'blocks'),

  r([I.WOOD_PICKAXE, 1], [[B.PLANKS, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.WOOD_AXE, 1], [[B.PLANKS, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.WOOD_SHOVEL, 1], [[B.PLANKS, 1], [I.STICK, 2]], 'tools', 'table'),
  r([I.WOOD_SWORD, 1], [[B.PLANKS, 2], [I.STICK, 1]], 'tools', 'table'),
  r([I.STONE_PICKAXE, 1], [[B.COBBLE, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.STONE_AXE, 1], [[B.COBBLE, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.STONE_SHOVEL, 1], [[B.COBBLE, 1], [I.STICK, 2]], 'tools', 'table'),
  r([I.STONE_SWORD, 1], [[B.COBBLE, 2], [I.STICK, 1]], 'tools', 'table'),
  r([I.IRON_PICKAXE, 1], [[I.IRON_INGOT, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.IRON_AXE, 1], [[I.IRON_INGOT, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.IRON_SHOVEL, 1], [[I.IRON_INGOT, 1], [I.STICK, 2]], 'tools', 'table'),
  r([I.IRON_SWORD, 1], [[I.IRON_INGOT, 2], [I.STICK, 1]], 'tools', 'table'),
  r([I.DIAMOND_PICKAXE, 1], [[I.DIAMOND, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.DIAMOND_AXE, 1], [[I.DIAMOND, 3], [I.STICK, 2]], 'tools', 'table'),
  r([I.DIAMOND_SHOVEL, 1], [[I.DIAMOND, 1], [I.STICK, 2]], 'tools', 'table'),
  r([I.DIAMOND_SWORD, 1], [[I.DIAMOND, 2], [I.STICK, 1]], 'tools', 'table'),

  r([B.FURNACE, 1], [[B.COBBLE, 8]], 'blocks', 'table'),
  r([B.STONE_BRICKS, 4], [[B.STONE, 4]], 'blocks', 'table'),
  r([B.BRICKS, 1], [[I.BRICK, 4]], 'blocks', 'table'),
  r([B.SANDSTONE, 1], [[B.SAND, 4]], 'blocks', 'table'),
  r([B.BOOKSHELF, 1], [[B.PLANKS, 6], [B.LEAVES, 3]], 'blocks', 'table'),
  r([B.GLOWSTONE, 1], [[I.GOLD_INGOT, 1], [I.COAL, 4]], 'blocks', 'table'),
  r([B.JACK_O_LANTERN, 1], [[B.PUMPKIN, 1], [B.TORCH, 1]], 'blocks'),
  r([B.MOSSY_COBBLE, 1], [[B.COBBLE, 1], [B.TALL_GRASS, 1]], 'blocks'),
  r([B.WOOL, 1], [[I.FEATHER, 4]], 'blocks'),
  r([I.BREAD, 1], [[I.WHEAT, 3]], 'blocks', 'table'),

  // smelting: furnace + coal as fuel
  r([I.IRON_INGOT, 2], [[B.IRON_ORE, 2], [I.COAL, 1]], 'smelt', 'furnace'),
  r([I.GOLD_INGOT, 2], [[B.GOLD_ORE, 2], [I.COAL, 1]], 'smelt', 'furnace'),
  r([B.GLASS, 4], [[B.SAND, 4], [I.COAL, 1]], 'smelt', 'furnace'),
  r([B.STONE, 4], [[B.COBBLE, 4], [I.COAL, 1]], 'smelt', 'furnace'),
  r([I.BRICK, 4], [[B.CLAY, 4], [I.COAL, 1]], 'smelt', 'furnace'),
  r([I.PORKCHOP_COOKED, 2], [[I.PORKCHOP_RAW, 2], [I.COAL, 1]], 'smelt', 'furnace'),
  r([I.MUTTON_COOKED, 2], [[I.MUTTON_RAW, 2], [I.COAL, 1]], 'smelt', 'furnace'),
  r([I.CHICKEN_COOKED, 2], [[I.CHICKEN_RAW, 2], [I.COAL, 1]], 'smelt', 'furnace'),
  r([I.COAL, 1], [[B.LOG, 2]], 'smelt', 'furnace', { [B.LOG]: anyLog }),
];

// Resolve which actual item ids satisfy an ingredient (alternatives)
function altIds(recipe, id) { return (recipe.alt && recipe.alt[id]) || [id]; }

export function canCraft(recipe, inv, stations) {
  if (recipe.station && !stations[recipe.station]) return false;
  for (const [id, n] of recipe.in) {
    let have = 0; for (const a of altIds(recipe, id)) have += inv.count(a);
    if (have < n) return false;
  }
  return true;
}
export function missing(recipe, inv) {
  return recipe.in.map(([id, n]) => { let have = 0; for (const a of altIds(recipe, id)) have += inv.count(a); return { id, need: n, have }; });
}
export function craft(recipe, inv, stations) {
  if (!canCraft(recipe, inv, stations)) return false;
  for (const [id, n] of recipe.in) {
    let left = n;
    for (const a of altIds(recipe, id)) { const c = Math.min(inv.count(a), left); if (c > 0) { inv.remove(a, c); left -= c; } if (!left) break; }
  }
  const leftover = inv.add(recipe.out[0], recipe.out[1]);
  return { leftover };
}

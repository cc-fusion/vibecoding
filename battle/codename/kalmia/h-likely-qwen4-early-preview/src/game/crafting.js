// Crafting recipes + furnace smelting definitions.
import { B, I, TOOL_DEFS } from './blocks.js';

export const RECIPES = [
  { out: { id: B.PLANKS, n: 4 }, ing: [{ id: B.LOG, n: 1 }], cat: 'basic' },
  { out: { id: I.STICK, n: 4 }, ing: [{ id: B.PLANKS, n: 2 }], cat: 'basic' },
  { out: { id: B.TABLE, n: 1 }, ing: [{ id: B.PLANKS, n: 4 }], cat: 'basic' },
  { out: { id: B.TORCH, n: 4 }, ing: [{ id: I.COAL, n: 1 }, { id: I.STICK, n: 1 }], cat: 'basic' },
  { out: { id: B.FURNACE, n: 1 }, ing: [{ id: B.COBBLE, n: 8 }], cat: 'basic' },
];

const MATS = { W: B.PLANKS, S: B.COBBLE, I: I.IRON, D: I.DIAMOND };
const SHAPES = { PICK: [3, 2], AXE: [3, 2], SHOVEL: [1, 2], SWORD: [2, 1] };
for (const t of TOOL_DEFS) {
  const kindKey = t.icon.split('_')[0].toUpperCase();
  const [matN, stickN] = SHAPES[kindKey];
  RECIPES.push({
    out: { id: t.id, n: 1 },
    ing: [{ id: MATS[t.matKey], n: matN }, { id: I.STICK, n: stickN }],
    cat: 'tools',
  });
}

export const SMELT_RECIPES = [
  { input: B.IRON_ORE, output: { id: I.IRON, n: 1 } },
  { input: B.GOLD_ORE, output: { id: I.GOLD, n: 1 } },
  { input: B.SAND, output: { id: B.GLASS, n: 1 } },
  { input: B.COBBLE, output: { id: B.STONE, n: 1 } },
  { input: I.PORK_RAW, output: { id: I.PORK_COOKED, n: 1 } },
  { input: B.LOG, output: { id: I.COAL, n: 1 } },
];

export const FUELS = [
  { id: I.COAL, burns: 8 },
  { id: B.LOG, burns: 2 },
  { id: B.PLANKS, burns: 1 },
];

export const SMELT_TIME = 3.5;

export function canCraft(inv, recipe) {
  return recipe.ing.every((r) => inv.count(r.id) >= r.n);
}

export function doCraft(inv, recipe) {
  if (!canCraft(inv, recipe)) return false;
  // ensure space: simulate
  const room = inv.slots.some((s) => !s) ||
    inv.slots.some((s) => s && s.id === recipe.out.id && s.n + recipe.out.n <= 64);
  if (!room) return false;
  for (const r of recipe.ing) inv.remove(r.id, r.n);
  inv.add(recipe.out.id, recipe.out.n);
  return true;
}
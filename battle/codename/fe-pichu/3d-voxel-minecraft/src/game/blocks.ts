export enum Block {
  Air, Stone, Dirt, Grass, Log, Leaves, Sand, Planks, Cobble, Glass,
  Glowstone, Iron, Coal, Snow, Workbench, Torch, Brick, BirchLog, BirchLeaves,
  Carrot, Bedrock, CookedCarrot = 50, Pickaxe = 100, Axe = 101, StoneAxe = 102,
}
export type ItemKind = 'block' | 'tool' | 'food';
export interface ItemDefinition { name: string; color: string; kind: ItemKind; hardness: number; tile: number; }
export interface Stack { id: Block; count: number }
export interface Recipe { name: string; result: Block; count: number; inputs: { id: Block; count: number }[]; category: ItemKind; }
export const BLOCKS: Record<number, ItemDefinition> = {
  [Block.Stone]: { name: 'Stone', color: '#9da7a4', kind: 'block', hardness: 2, tile: 1 },
  [Block.Dirt]: { name: 'Dirt', color: '#a47c52', kind: 'block', hardness: .55, tile: 3 },
  [Block.Grass]: { name: 'Grass block', color: '#79ab55', kind: 'block', hardness: .55, tile: 0 },
  [Block.Log]: { name: 'Oak log', color: '#92704a', kind: 'block', hardness: 1.5, tile: 4 },
  [Block.Leaves]: { name: 'Oak leaves', color: '#65934d', kind: 'block', hardness: .22, tile: 6 },
  [Block.Sand]: { name: 'Sand', color: '#d5c496', kind: 'block', hardness: .4, tile: 8 },
  [Block.Planks]: { name: 'Oak planks', color: '#bb9664', kind: 'block', hardness: .9, tile: 7 },
  [Block.Cobble]: { name: 'Cobblestone', color: '#929c9a', kind: 'block', hardness: 1.5, tile: 9 },
  [Block.Glass]: { name: 'Glass', color: '#a9d4cd', kind: 'block', hardness: .3, tile: 10 },
  [Block.Glowstone]: { name: 'Glowstone', color: '#e3bd73', kind: 'block', hardness: .6, tile: 11 },
  [Block.Iron]: { name: 'Iron ore', color: '#a1846b', kind: 'block', hardness: 3.6, tile: 12 },
  [Block.Coal]: { name: 'Coal ore', color: '#727c78', kind: 'block', hardness: 2.1, tile: 13 },
  [Block.Snow]: { name: 'Snow', color: '#dce8df', kind: 'block', hardness: .3, tile: 14 },
  [Block.Workbench]: { name: 'Crafting table', color: '#a78151', kind: 'block', hardness: 1, tile: 15 },
  [Block.Torch]: { name: 'Torch', color: '#eccc7a', kind: 'block', hardness: .1, tile: 16 },
  [Block.Brick]: { name: 'Terracotta brick', color: '#b76f50', kind: 'block', hardness: 1.5, tile: 17 },
  [Block.BirchLog]: { name: 'Birch log', color: '#d3d2bb', kind: 'block', hardness: 1.4, tile: 18 },
  [Block.BirchLeaves]: { name: 'Birch leaves', color: '#87aa61', kind: 'block', hardness: .22, tile: 19 },
  [Block.Carrot]: { name: 'Wild carrot', color: '#dcb465', kind: 'block', hardness: .3, tile: 20 },
  [Block.Bedrock]: { name: 'Bedrock', color: '#596865', kind: 'block', hardness: Infinity, tile: 21 },
  [Block.CookedCarrot]: { name: 'Roasted carrot', color: '#e79d62', kind: 'food', hardness: 0, tile: 22 },
  [Block.Pickaxe]: { name: 'Wooden pickaxe', color: '#a9b9a9', kind: 'tool', hardness: 0, tile: 23 },
  [Block.Axe]: { name: 'Stone pickaxe', color: '#a9b9a9', kind: 'tool', hardness: 0, tile: 24 },
  [Block.StoneAxe]: { name: 'Stone axe', color: '#a9b9a9', kind: 'tool', hardness: 0, tile: 25 },
};
export const RECIPES: Recipe[] = [
  { name: 'Oak planks', result: Block.Planks, count: 4, category: 'block', inputs: [{ id: Block.Log, count: 1 }] },
  { name: 'Wooden pickaxe', result: Block.Pickaxe, count: 1, category: 'tool', inputs: [{ id: Block.Planks, count: 3 }] },
  { name: 'Stone pickaxe', result: Block.Axe, count: 1, category: 'tool', inputs: [{ id: Block.Planks, count: 2 }, { id: Block.Cobble, count: 3 }] },
  { name: 'Stone axe', result: Block.StoneAxe, count: 1, category: 'tool', inputs: [{ id: Block.Planks, count: 3 }, { id: Block.Cobble, count: 3 }] },
  { name: 'Crafting table', result: Block.Workbench, count: 1, category: 'block', inputs: [{ id: Block.Planks, count: 4 }] },
  { name: 'Terracotta bricks', result: Block.Brick, count: 4, category: 'block', inputs: [{ id: Block.Cobble, count: 2 }] },
  { name: 'Torches', result: Block.Torch, count: 4, category: 'block', inputs: [{ id: Block.Planks, count: 1 }, { id: Block.Coal, count: 1 }] },
  { name: 'Glass blocks', result: Block.Glass, count: 4, category: 'block', inputs: [{ id: Block.Sand, count: 1 }, { id: Block.Coal, count: 1 }] },
  { name: 'Glowstones', result: Block.Glowstone, count: 2, category: 'block', inputs: [{ id: Block.Iron, count: 2 }, { id: Block.Coal, count: 1 }] },
  { name: 'Roasted carrots', result: Block.CookedCarrot, count: 2, category: 'food', inputs: [{ id: Block.Carrot, count: 2 }, { id: Block.Planks, count: 1 }] },
];
export function isSolid(id: number) { return id !== Block.Air && id !== Block.Carrot && id !== Block.Torch && BLOCKS[id]?.kind === 'block'; }
export function isTool(id: number) { return id === Block.Pickaxe || id === Block.Axe || id === Block.StoneAxe; }
export function countItem(inventory: (Stack | null)[], id: number) { return inventory.reduce((n, stack) => n + (stack?.id === id ? stack.count : 0), 0); }
export function canCraft(inventory: (Stack | null)[], recipe: Recipe) { return recipe.inputs.every(input => countItem(inventory, input.id) >= input.count); }
export function addItem(inventory: (Stack | null)[], id: Block, count: number): boolean {
  for (const stack of inventory) { if (stack && stack.id === id && stack.count < 99) { const n = Math.min(count, 99 - stack.count); stack.count += n; count -= n; if (count === 0) return true; } }
  for (let i = 0; i < inventory.length; i++) { if (!inventory[i]) { const n = Math.min(count, 99); inventory[i] = { id, count: n }; count -= n; if (count === 0) return true; } }
  return false;
}
export function consume(inventory: (Stack | null)[], id: number, count: number): boolean {
  if (countItem(inventory, id) < count) return false;
  for (let i = 0; i < inventory.length && count > 0; i++) { const stack = inventory[i]; if (stack?.id === id) { const n = Math.min(stack.count, count); stack.count -= n; count -= n; if (stack.count === 0) inventory[i] = null; } }
  return true;
}
export function initialInventory(): (Stack | null)[] {
  const inventory = Array<Stack | null>(36).fill(null);
  const starter: [Block, number][] = [[Block.Axe, 1], [Block.Grass, 24], [Block.Log, 24], [Block.Planks, 24], [Block.Cobble, 24], [Block.Leaves, 24], [Block.Torch, 24], [Block.Workbench, 1], [Block.Glass, 16], [Block.Carrot, 6], [Block.Sand, 24], [Block.Snow, 24], [Block.Brick, 24], [Block.BirchLog, 24]];
  starter.forEach(([id, count], i) => { inventory[i] = { id, count }; });
  return inventory;
}
export const RECIPES_BY_RESULT = Object.fromEntries(RECIPES.map(r => [r.result, r]));

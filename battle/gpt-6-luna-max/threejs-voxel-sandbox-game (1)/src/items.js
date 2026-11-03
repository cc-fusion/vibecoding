import { BLOCK } from './voxel-world.js';

export const ITEM = {
  COAL: 20,
  RAW_IRON: 21,
  STICK: 100,
  WOOD_PICK: 101,
  STONE_PICK: 102,
  WOOD_AXE: 103,
  STONE_AXE: 104,
  WOOD_SWORD: 105,
  STONE_SWORD: 106,
  HIDE: 107,
  IRON_INGOT: 108,
  IRON_PICK: 109,
  IRON_SWORD: 110,
};

export const ITEMS = {
  [BLOCK.GRASS]: { name: 'Grass block', icon: 'grass', maxStack: 64, place: BLOCK.GRASS, group: 'Block' },
  [BLOCK.DIRT]: { name: 'Dirt', icon: 'dirt', maxStack: 64, place: BLOCK.DIRT, group: 'Block' },
  [BLOCK.STONE]: { name: 'Stone', icon: 'stone', maxStack: 64, place: BLOCK.STONE, group: 'Block' },
  [BLOCK.SAND]: { name: 'Sand', icon: 'sand', maxStack: 64, place: BLOCK.SAND, group: 'Block' },
  [BLOCK.LOG]: { name: 'Oak log', icon: 'log', maxStack: 64, place: BLOCK.LOG, group: 'Block' },
  [BLOCK.LEAVES]: { name: 'Leaves', icon: 'leaves', maxStack: 64, place: BLOCK.LEAVES, group: 'Block' },
  [BLOCK.PLANK]: { name: 'Oak planks', icon: 'plank', maxStack: 64, place: BLOCK.PLANK, group: 'Block' },
  [BLOCK.COAL_ORE]: { name: 'Coal ore', icon: 'coal-ore', maxStack: 64, place: BLOCK.COAL_ORE, group: 'Block' },
  [BLOCK.IRON_ORE]: { name: 'Iron ore', icon: 'iron-ore', maxStack: 64, place: BLOCK.IRON_ORE, group: 'Block' },
  [BLOCK.GRAVEL]: { name: 'Gravel', icon: 'gravel', maxStack: 64, place: BLOCK.GRAVEL, group: 'Block' },
  [BLOCK.SNOW]: { name: 'Snow', icon: 'snow', maxStack: 64, place: BLOCK.SNOW, group: 'Block' },
  [BLOCK.TORCH]: { name: 'Torch', icon: 'torch', maxStack: 64, place: BLOCK.TORCH, group: 'Light' },
  [ITEM.COAL]: { name: 'Coal', icon: 'coal', maxStack: 64, group: 'Material' },
  [ITEM.RAW_IRON]: { name: 'Raw iron', icon: 'raw-iron', maxStack: 64, group: 'Material' },
  [ITEM.STICK]: { name: 'Stick', icon: 'stick', maxStack: 64, group: 'Material' },
  [ITEM.WOOD_PICK]: { name: 'Wooden pickaxe', icon: 'wood-pick', maxStack: 1, durability: 38, tool: 'pickaxe', group: 'Tool' },
  [ITEM.STONE_PICK]: { name: 'Stone pickaxe', icon: 'stone-pick', maxStack: 1, durability: 78, tool: 'pickaxe', group: 'Tool' },
  [ITEM.WOOD_AXE]: { name: 'Wooden axe', icon: 'wood-axe', maxStack: 1, durability: 46, tool: 'axe', group: 'Tool' },
  [ITEM.STONE_AXE]: { name: 'Stone axe', icon: 'stone-axe', maxStack: 1, durability: 92, tool: 'axe', group: 'Tool' },
  [ITEM.WOOD_SWORD]: { name: 'Wooden sword', icon: 'wood-sword', maxStack: 1, durability: 42, tool: 'sword', group: 'Weapon' },
  [ITEM.STONE_SWORD]: { name: 'Stone sword', icon: 'stone-sword', maxStack: 1, durability: 78, tool: 'sword', group: 'Weapon' },
  [ITEM.HIDE]: { name: 'Soft hide', icon: 'hide', maxStack: 32, group: 'Material' },
  [ITEM.IRON_INGOT]: { name: 'Iron ingot', icon: 'iron-ingot', maxStack: 64, group: 'Material' },
  [ITEM.IRON_PICK]: { name: 'Iron pickaxe', icon: 'iron-pick', maxStack: 1, durability: 150, tool: 'pickaxe', group: 'Tool' },
  [ITEM.IRON_SWORD]: { name: 'Iron sword', icon: 'iron-sword', maxStack: 1, durability: 132, tool: 'sword', group: 'Weapon' },
};

export const RECIPES = [
  {
    id: 'planks', name: 'Oak planks', output: BLOCK.PLANK, amount: 4,
    ingredients: [[BLOCK.LOG, 1]], note: 'A little lumber goes a long way.',
  },
  {
    id: 'sticks', name: 'Sticks', output: ITEM.STICK, amount: 4,
    ingredients: [[BLOCK.PLANK, 2]], note: 'The first step to a good tool.',
  },
  {
    id: 'torch', name: 'Torches', output: BLOCK.TORCH, amount: 4,
    ingredients: [[ITEM.COAL, 1], [ITEM.STICK, 1]], note: 'A warm marker for the dark.',
  },
  {
    id: 'wood-pick', name: 'Wooden pickaxe', output: ITEM.WOOD_PICK, amount: 1,
    ingredients: [[BLOCK.PLANK, 3], [ITEM.STICK, 2]], note: 'Mine stone and ore more quickly.',
  },
  {
    id: 'stone-pick', name: 'Stone pickaxe', output: ITEM.STONE_PICK, amount: 1,
    ingredients: [[BLOCK.STONE, 3], [ITEM.STICK, 2]], note: 'A sturdy tool for deep places.',
  },
  {
    id: 'wood-axe', name: 'Wooden axe', output: ITEM.WOOD_AXE, amount: 1,
    ingredients: [[BLOCK.PLANK, 3], [ITEM.STICK, 2]], note: 'Bring a woodland home.',
  },
  {
    id: 'stone-axe', name: 'Stone axe', output: ITEM.STONE_AXE, amount: 1,
    ingredients: [[BLOCK.STONE, 3], [ITEM.STICK, 2]], note: 'Cut timber with fewer swings.',
  },
  {
    id: 'wood-sword', name: 'Wooden sword', output: ITEM.WOOD_SWORD, amount: 1,
    ingredients: [[BLOCK.PLANK, 2], [ITEM.STICK, 1]], note: 'Keep the night at arm\'s length.',
  },
  {
    id: 'stone-sword', name: 'Stone sword', output: ITEM.STONE_SWORD, amount: 1,
    ingredients: [[BLOCK.STONE, 2], [ITEM.STICK, 1]], note: 'A sharper answer to a gloamling.',
  },
  {
    id: 'iron-ingot', name: 'Iron ingot', output: ITEM.IRON_INGOT, amount: 1,
    ingredients: [[ITEM.RAW_IRON, 1], [ITEM.COAL, 1]], note: 'A small-batch field smelt.',
  },
  {
    id: 'iron-pick', name: 'Iron pickaxe', output: ITEM.IRON_PICK, amount: 1,
    ingredients: [[ITEM.IRON_INGOT, 3], [ITEM.STICK, 2]], note: 'A lasting companion underground.',
  },
  {
    id: 'iron-sword', name: 'Iron sword', output: ITEM.IRON_SWORD, amount: 1,
    ingredients: [[ITEM.IRON_INGOT, 2], [ITEM.STICK, 1]], note: 'A sure edge when dusk settles.',
  },
];

export function createStartingInventory() {
  const slots = Array.from({ length: 36 }, () => null);
  slots[0] = { id: BLOCK.DIRT, count: 16 };
  slots[1] = { id: BLOCK.PLANK, count: 8 };
  slots[2] = { id: BLOCK.TORCH, count: 4 };
  slots[3] = { id: BLOCK.STONE, count: 10 };
  slots[4] = { id: BLOCK.LOG, count: 5 };
  slots[5] = { id: BLOCK.GRASS, count: 8 };
  slots[6] = { id: BLOCK.SAND, count: 8 };
  slots[7] = { id: ITEM.WOOD_PICK, count: 1, durability: ITEMS[ITEM.WOOD_PICK].durability };
  return slots;
}

export function normalizeInventory(saved) {
  if (!Array.isArray(saved) || saved.length !== 36) return createStartingInventory();
  return saved.map((slot) => {
    if (!slot || !ITEMS[slot.id] || !Number.isFinite(slot.count) || slot.count <= 0) return null;
    const item = ITEMS[slot.id];
    return {
      id: slot.id,
      count: Math.min(item.maxStack, Math.floor(slot.count)),
      ...(item.durability ? { durability: Math.max(0, Math.min(item.durability, Math.floor(slot.durability ?? item.durability))) } : {}),
    };
  });
}

export function inventoryCount(slots, id) {
  return slots.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0);
}

export function canCraft(slots, recipe) {
  return recipe.ingredients.every(([id, amount]) => inventoryCount(slots, id) >= amount);
}

export function consumeItems(slots, id, amount) {
  let remaining = amount;
  for (let i = slots.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const slot = slots[i];
    if (!slot || slot.id !== id) continue;
    const used = Math.min(slot.count, remaining);
    slot.count -= used;
    remaining -= used;
    if (slot.count <= 0) slots[i] = null;
  }
  return remaining === 0;
}

export function addItem(slots, id, amount = 1, durability) {
  const meta = ITEMS[id];
  if (!meta || amount <= 0) return 0;
  let left = amount;
  if (meta.maxStack > 1) {
    for (const slot of slots) {
      if (!slot || slot.id !== id || slot.count >= meta.maxStack) continue;
      const added = Math.min(meta.maxStack - slot.count, left);
      slot.count += added;
      left -= added;
      if (left <= 0) return 0;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i += 1) {
    if (slots[i]) continue;
    const count = Math.min(meta.maxStack, left);
    slots[i] = {
      id,
      count,
      ...(meta.durability ? { durability: Math.min(meta.durability, durability ?? meta.durability) } : {}),
    };
    left -= count;
  }
  return left;
}

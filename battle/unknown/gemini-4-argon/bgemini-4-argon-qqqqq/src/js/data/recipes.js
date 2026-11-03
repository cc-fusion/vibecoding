import { BLOCK } from './blocks.js';
import { getEntry, ITEM } from './items.js';

export const TAGS = {
  ANY_PLANKS: [BLOCK.OAK_PLANKS, BLOCK.BIRCH_PLANKS, BLOCK.SPRUCE_PLANKS],
  ANY_LOG: [BLOCK.OAK_LOG, BLOCK.BIRCH_LOG, BLOCK.SPRUCE_LOG],
};

function matchesToken(itemId, token) {
  if (!token) return !itemId;
  if (!itemId) return false;
  if (typeof token === 'string' && TAGS[token]) {
    return TAGS[token].includes(itemId);
  }
  return itemId === token;
}

export const CRAFTING_RECIPES = [
  // Basic 2x2 Essentials
  {
    id: 'oak_planks',
    result: { id: BLOCK.OAK_PLANKS, count: 4 },
    shapeless: [BLOCK.OAK_LOG],
  },
  {
    id: 'birch_planks',
    result: { id: BLOCK.BIRCH_PLANKS, count: 4 },
    shapeless: [BLOCK.BIRCH_LOG],
  },
  {
    id: 'spruce_planks',
    result: { id: BLOCK.SPRUCE_PLANKS, count: 4 },
    shapeless: [BLOCK.SPRUCE_LOG],
  },
  {
    id: 'sticks',
    result: { id: ITEM.STICK, count: 4 },
    pattern: [
      ['ANY_PLANKS'],
      ['ANY_PLANKS'],
    ],
  },
  {
    id: 'crafting_table',
    result: { id: BLOCK.CRAFTING_TABLE, count: 1 },
    pattern: [
      ['ANY_PLANKS', 'ANY_PLANKS'],
      ['ANY_PLANKS', 'ANY_PLANKS'],
    ],
  },
  {
    id: 'torches',
    result: { id: BLOCK.TORCH, count: 4 },
    pattern: [
      [ITEM.COAL],
      [ITEM.STICK],
    ],
  },

  // Utility & Storage (3x3)
  {
    id: 'furnace',
    result: { id: BLOCK.FURNACE, count: 1 },
    pattern: [
      [BLOCK.COBBLESTONE, BLOCK.COBBLESTONE, BLOCK.COBBLESTONE],
      [BLOCK.COBBLESTONE, null, BLOCK.COBBLESTONE],
      [BLOCK.COBBLESTONE, BLOCK.COBBLESTONE, BLOCK.COBBLESTONE],
    ],
  },
  {
    id: 'chest',
    result: { id: BLOCK.CHEST, count: 1 },
    pattern: [
      ['ANY_PLANKS', 'ANY_PLANKS', 'ANY_PLANKS'],
      ['ANY_PLANKS', null, 'ANY_PLANKS'],
      ['ANY_PLANKS', 'ANY_PLANKS', 'ANY_PLANKS'],
    ],
  },
  {
    id: 'cozy_bed',
    result: { id: BLOCK.BED_BLOCK, count: 1 },
    pattern: [
      [BLOCK.WOOL, BLOCK.WOOL, BLOCK.WOOL],
      ['ANY_PLANKS', 'ANY_PLANKS', 'ANY_PLANKS'],
    ],
  },

  // Wooden Tools
  {
    id: 'wood_pickaxe',
    result: { id: ITEM.WOOD_PICKAXE, count: 1 },
    pattern: [
      ['ANY_PLANKS', 'ANY_PLANKS', 'ANY_PLANKS'],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
  },
  {
    id: 'wood_axe',
    result: { id: ITEM.WOOD_AXE, count: 1 },
    allowMirror: true,
    pattern: [
      ['ANY_PLANKS', 'ANY_PLANKS'],
      ['ANY_PLANKS', ITEM.STICK],
      [null, ITEM.STICK],
    ],
  },
  {
    id: 'wood_shovel',
    result: { id: ITEM.WOOD_SHOVEL, count: 1 },
    pattern: [
      ['ANY_PLANKS'],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
  },
  {
    id: 'wood_sword',
    result: { id: ITEM.WOOD_SWORD, count: 1 },
    pattern: [
      ['ANY_PLANKS'],
      ['ANY_PLANKS'],
      [ITEM.STICK],
    ],
  },

  // Stone Tools
  {
    id: 'stone_pickaxe',
    result: { id: ITEM.STONE_PICKAXE, count: 1 },
    pattern: [
      [BLOCK.COBBLESTONE, BLOCK.COBBLESTONE, BLOCK.COBBLESTONE],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
  },
  {
    id: 'stone_axe',
    result: { id: ITEM.STONE_AXE, count: 1 },
    allowMirror: true,
    pattern: [
      [BLOCK.COBBLESTONE, BLOCK.COBBLESTONE],
      [BLOCK.COBBLESTONE, ITEM.STICK],
      [null, ITEM.STICK],
    ],
  },
  {
    id: 'stone_shovel',
    result: { id: ITEM.STONE_SHOVEL, count: 1 },
    pattern: [
      [BLOCK.COBBLESTONE],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
  },
  {
    id: 'stone_sword',
    result: { id: ITEM.STONE_SWORD, count: 1 },
    pattern: [
      [BLOCK.COBBLESTONE],
      [BLOCK.COBBLESTONE],
      [ITEM.STICK],
    ],
  },

  // Iron Tools & Bucket / Flint & Steel
  {
    id: 'iron_pickaxe',
    result: { id: ITEM.IRON_PICKAXE, count: 1 },
    pattern: [
      [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
  },
  {
    id: 'iron_axe',
    result: { id: ITEM.IRON_AXE, count: 1 },
    allowMirror: true,
    pattern: [
      [ITEM.IRON_INGOT, ITEM.IRON_INGOT],
      [ITEM.IRON_INGOT, ITEM.STICK],
      [null, ITEM.STICK],
    ],
  },
  {
    id: 'iron_shovel',
    result: { id: ITEM.IRON_SHOVEL, count: 1 },
    pattern: [
      [ITEM.IRON_INGOT],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
  },
  {
    id: 'iron_sword',
    result: { id: ITEM.IRON_SWORD, count: 1 },
    pattern: [
      [ITEM.IRON_INGOT],
      [ITEM.IRON_INGOT],
      [ITEM.STICK],
    ],
  },
  {
    id: 'bucket',
    result: { id: ITEM.BUCKET, count: 1 },
    pattern: [
      [ITEM.IRON_INGOT, null, ITEM.IRON_INGOT],
      [null, ITEM.IRON_INGOT, null],
    ],
  },
  {
    id: 'flint_and_steel',
    result: { id: ITEM.FLINT_AND_STEEL, count: 1 },
    shapeless: [ITEM.IRON_INGOT, ITEM.FLINT],
  },

  // Diamond Tools
  {
    id: 'diamond_pickaxe',
    result: { id: ITEM.DIAMOND_PICKAXE, count: 1 },
    pattern: [
      [ITEM.DIAMOND, ITEM.DIAMOND, ITEM.DIAMOND],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
  },
  {
    id: 'diamond_axe',
    result: { id: ITEM.DIAMOND_AXE, count: 1 },
    allowMirror: true,
    pattern: [
      [ITEM.DIAMOND, ITEM.DIAMOND],
      [ITEM.DIAMOND, ITEM.STICK],
      [null, ITEM.STICK],
    ],
  },
  {
    id: 'diamond_shovel',
    result: { id: ITEM.DIAMOND_SHOVEL, count: 1 },
    pattern: [
      [ITEM.DIAMOND],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
  },
  {
    id: 'diamond_sword',
    result: { id: ITEM.DIAMOND_SWORD, count: 1 },
    pattern: [
      [ITEM.DIAMOND],
      [ITEM.DIAMOND],
      [ITEM.STICK],
    ],
  },

  // Decorative, Building & Special Blocks
  {
    id: 'stone_bricks',
    result: { id: BLOCK.STONE_BRICKS, count: 4 },
    pattern: [
      [BLOCK.STONE, BLOCK.STONE],
      [BLOCK.STONE, BLOCK.STONE],
    ],
  },
  {
    id: 'bricks_block',
    result: { id: BLOCK.BRICKS, count: 1 },
    pattern: [
      [ITEM.BRICK_ITEM, ITEM.BRICK_ITEM],
      [ITEM.BRICK_ITEM, ITEM.BRICK_ITEM],
    ],
  },
  {
    id: 'sandstone',
    result: { id: BLOCK.SANDSTONE, count: 1 },
    pattern: [
      [BLOCK.SAND, BLOCK.SAND],
      [BLOCK.SAND, BLOCK.SAND],
    ],
  },
  {
    id: 'glowstone',
    result: { id: BLOCK.GLOWSTONE, count: 1 },
    pattern: [
      [BLOCK.GLASS, BLOCK.TORCH],
      [BLOCK.TORCH, ITEM.GOLD_INGOT],
    ],
  },
  {
    id: 'glowstone_simple',
    result: { id: BLOCK.GLOWSTONE, count: 1 },
    pattern: [
      [BLOCK.TORCH, BLOCK.TORCH],
      [BLOCK.TORCH, BLOCK.GLASS],
    ],
  },
  {
    id: 'tnt',
    result: { id: BLOCK.TNT, count: 1 },
    pattern: [
      [ITEM.COAL, BLOCK.SAND, ITEM.COAL],
      [BLOCK.SAND, ITEM.FLINT, BLOCK.SAND],
      [ITEM.COAL, BLOCK.SAND, ITEM.COAL],
    ],
  },
  {
    id: 'bookshelf',
    result: { id: BLOCK.BOOKSHELF, count: 1 },
    pattern: [
      ['ANY_PLANKS', 'ANY_PLANKS', 'ANY_PLANKS'],
      [BLOCK.WOOL, ITEM.STICK, BLOCK.WOOL],
      ['ANY_PLANKS', 'ANY_PLANKS', 'ANY_PLANKS'],
    ],
  },
  {
    id: 'iron_block',
    result: { id: BLOCK.IRON_BLOCK, count: 1 },
    pattern: [
      [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
      [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
      [ITEM.IRON_INGOT, ITEM.IRON_INGOT, ITEM.IRON_INGOT],
    ],
  },
  {
    id: 'gold_block',
    result: { id: BLOCK.GOLD_BLOCK, count: 1 },
    pattern: [
      [ITEM.GOLD_INGOT, ITEM.GOLD_INGOT, ITEM.GOLD_INGOT],
      [ITEM.GOLD_INGOT, ITEM.GOLD_INGOT, ITEM.GOLD_INGOT],
      [ITEM.GOLD_INGOT, ITEM.GOLD_INGOT, ITEM.GOLD_INGOT],
    ],
  },
  {
    id: 'diamond_block',
    result: { id: BLOCK.DIAMOND_BLOCK, count: 1 },
    pattern: [
      [ITEM.DIAMOND, ITEM.DIAMOND, ITEM.DIAMOND],
      [ITEM.DIAMOND, ITEM.DIAMOND, ITEM.DIAMOND],
      [ITEM.DIAMOND, ITEM.DIAMOND, ITEM.DIAMOND],
    ],
  },
  {
    id: 'iron_ingots_from_block',
    result: { id: ITEM.IRON_INGOT, count: 9 },
    shapeless: [BLOCK.IRON_BLOCK],
  },
  {
    id: 'gold_ingots_from_block',
    result: { id: ITEM.GOLD_INGOT, count: 9 },
    shapeless: [BLOCK.GOLD_BLOCK],
  },
  {
    id: 'diamonds_from_block',
    result: { id: ITEM.DIAMOND, count: 9 },
    shapeless: [BLOCK.DIAMOND_BLOCK],
  },
];

// Trim empty rows/cols from a 2D array of slot objects/IDs
function trimGrid(grid2D) {
  const rows = grid2D.length;
  const cols = grid2D[0].length;
  let minR = rows, maxR = -1, minC = cols, maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid2D[r][c]) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }
  if (maxR === -1) return [];
  const trimmed = [];
  for (let r = minR; r <= maxR; r++) {
    const row = [];
    for (let c = minC; c <= maxC; c++) {
      row.push(grid2D[r][c]);
    }
    trimmed.push(row);
  }
  return trimmed;
}

function matchPattern(trimmed, pattern, mirror = false) {
  if (trimmed.length !== pattern.length) return false;
  if (trimmed[0].length !== pattern[0].length) return false;
  const h = pattern.length;
  const w = pattern[0].length;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const pc = mirror ? w - 1 - c : c;
      if (!matchesToken(trimmed[r][c], pattern[r][pc])) {
        return false;
      }
    }
  }
  return true;
}

export function matchCraftingGrid(flatSlots, gridSize) {
  const grid2D = [];
  const nonEmptyIds = [];
  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      const slot = flatSlots[r * gridSize + c];
      const id = slot && slot.count > 0 ? slot.id : null;
      row.push(id);
      if (id) nonEmptyIds.push(id);
    }
    grid2D.push(row);
  }

  if (nonEmptyIds.length === 0) return null;
  const trimmed = trimGrid(grid2D);

  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.shapeless) {
      if (recipe.shapeless.length !== nonEmptyIds.length) continue;
      const used = new Array(nonEmptyIds.length).fill(false);
      let allMatched = true;
      for (const req of recipe.shapeless) {
        let found = -1;
        for (let i = 0; i < nonEmptyIds.length; i++) {
          if (!used[i] && matchesToken(nonEmptyIds[i], req)) {
            found = i;
            break;
          }
        }
        if (found === -1) {
          allMatched = false;
          break;
        }
        used[found] = true;
      }
      if (allMatched) return recipe;
    } else if (recipe.pattern) {
      if (recipe.pattern.length > gridSize || recipe.pattern[0].length > gridSize) continue;
      if (matchPattern(trimmed, recipe.pattern, false)) return recipe;
      if (recipe.allowMirror && matchPattern(trimmed, recipe.pattern, true)) return recipe;
    }
  }
  return null;
}

// Compute compact ingredient list for UI display & 1-click crafting
export function getRecipeIngredients(recipe) {
  const map = new Map();
  const addToken = (tok) => {
    if (!tok) return;
    map.set(tok, (map.get(tok) || 0) + 1);
  };
  if (recipe.shapeless) {
    for (const tok of recipe.shapeless) addToken(tok);
  } else if (recipe.pattern) {
    for (const row of recipe.pattern) {
      for (const tok of row) addToken(tok);
    }
  }
  const list = [];
  for (const [token, count] of map.entries()) {
    let displayId = token;
    let label = '';
    if (typeof token === 'string' && TAGS[token]) {
      displayId = TAGS[token][0];
      label = token === 'ANY_PLANKS' ? 'Any Planks' : 'Any Log';
    } else {
      const entry = getEntry(token);
      label = entry ? entry.name : 'Item';
    }
    list.push({ token, count, displayId, label });
  }
  return list;
}

export function recipeFitsGrid(recipe, gridSize) {
  if (recipe.shapeless) return recipe.shapeless.length <= gridSize * gridSize;
  return recipe.pattern.length <= gridSize && recipe.pattern[0].length <= gridSize;
}

export function canCraftRecipeWithInventory(recipe, inventory, gridSize) {
  if (!recipeFitsGrid(recipe, gridSize)) return false;
  const ingredients = getRecipeIngredients(recipe);
  for (const ing of ingredients) {
    let available = 0;
    for (const slot of inventory.slots) {
      if (slot && slot.count > 0 && matchesToken(slot.id, ing.token)) {
        available += slot.count;
      }
    }
    if (available < ing.count) return false;
  }
  return true;
}

export function consumeIngredientsFromInventory(recipe, inventory) {
  const ingredients = getRecipeIngredients(recipe);
  for (const ing of ingredients) {
    let remaining = ing.count;
    for (let i = 0; i < inventory.slots.length && remaining > 0; i++) {
      const slot = inventory.slots[i];
      if (slot && slot.count > 0 && matchesToken(slot.id, ing.token)) {
        const take = Math.min(slot.count, remaining);
        slot.count -= take;
        remaining -= take;
        if (slot.count <= 0) inventory.slots[i] = null;
      }
    }
  }
}

// Furnace Smelting Table
export const SMELTING_RECIPES = {
  [ITEM.RAW_IRON]: { id: ITEM.IRON_INGOT, count: 1, cookTime: 7.0 },
  [BLOCK.IRON_ORE]: { id: ITEM.IRON_INGOT, count: 1, cookTime: 7.0 },
  [ITEM.RAW_GOLD]: { id: ITEM.GOLD_INGOT, count: 1, cookTime: 7.5 },
  [BLOCK.GOLD_ORE]: { id: ITEM.GOLD_INGOT, count: 1, cookTime: 7.5 },
  [BLOCK.SAND]: { id: BLOCK.GLASS, count: 1, cookTime: 5.5 },
  [BLOCK.COBBLESTONE]: { id: BLOCK.STONE, count: 1, cookTime: 6.0 },
  [ITEM.CLAY_BALL]: { id: ITEM.BRICK_ITEM, count: 1, cookTime: 5.5 },
  [BLOCK.OAK_LOG]: { id: ITEM.COAL, count: 1, cookTime: 6.5 },
  [BLOCK.BIRCH_LOG]: { id: ITEM.COAL, count: 1, cookTime: 6.5 },
  [BLOCK.SPRUCE_LOG]: { id: ITEM.COAL, count: 1, cookTime: 6.5 },
  [ITEM.RAW_PORK]: { id: ITEM.COOKED_PORK, count: 1, cookTime: 6.0 },
  [ITEM.RAW_MUTTON]: { id: ITEM.COOKED_MUTTON, count: 1, cookTime: 6.0 },
  [ITEM.RAW_CHICKEN]: { id: ITEM.COOKED_CHICKEN, count: 1, cookTime: 6.0 },
};

export function getSmeltingResult(inputId) {
  return SMELTING_RECIPES[inputId] || null;
}

export function getFuelBurnTime(itemId) {
  const entry = getEntry(itemId);
  return entry && entry.fuelTime ? entry.fuelTime : 0;
}

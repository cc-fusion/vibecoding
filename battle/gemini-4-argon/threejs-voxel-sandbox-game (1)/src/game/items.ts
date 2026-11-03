import { BLOCKS, blockItemId } from './blocks';
import { BlockId, ItemDefinition, ItemId } from './types';

const nonBlockItems: Record<string, ItemDefinition> = {
  stick: {
    id: 'stick',
    name: 'Wooden Stick',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1.5,
    fuelSeconds: 5,
    accentColor: '#9c7344',
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    fuelSeconds: 64,
    accentColor: '#25272b',
  },
  iron_ingot: {
    id: 'iron_ingot',
    name: 'Iron Ingot',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    accentColor: '#dce2ea',
  },
  gold_ingot: {
    id: 'gold_ingot',
    name: 'Gold Ingot',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    accentColor: '#ffd447',
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    accentColor: '#4bf2e8',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    accentColor: '#29e36e',
  },
  clay_ball: {
    id: 'clay_ball',
    name: 'Clay Ball',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    accentColor: '#a2abb8',
  },
  brick_item: {
    id: 'brick_item',
    name: 'Fired Brick',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    accentColor: '#b95342',
  },
  flint: {
    id: 'flint',
    name: 'Flint',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 2,
    accentColor: '#44464d',
  },
  apple: {
    id: 'apple',
    name: 'Crisp Apple',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    foodRestore: 4,
    healthRestore: 3,
    accentColor: '#e53935',
  },
  raw_meat: {
    id: 'raw_meat',
    name: 'Raw Venison',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    foodRestore: 3,
    healthRestore: 2,
    accentColor: '#e07a7a',
  },
  cooked_meat: {
    id: 'cooked_meat',
    name: 'Roasted Steak',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    foodRestore: 8,
    healthRestore: 6,
    accentColor: '#8d4a2b',
  },
  bread: {
    id: 'bread',
    name: 'Golden Loaf',
    maxStack: 64,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    foodRestore: 6,
    healthRestore: 4,
    accentColor: '#d49b42',
  },

  // Wooden Tools
  wood_pickaxe: {
    id: 'wood_pickaxe',
    name: 'Wooden Pickaxe',
    maxStack: 1,
    toolCategory: 'pickaxe',
    toolTier: 1,
    miningSpeed: 2.3,
    attackDamage: 3,
    maxDurability: 60,
    fuelSeconds: 10,
    accentColor: '#b58d58',
    secondaryColor: '#6f5232',
  },
  wood_axe: {
    id: 'wood_axe',
    name: 'Wooden Axe',
    maxStack: 1,
    toolCategory: 'axe',
    toolTier: 1,
    miningSpeed: 2.3,
    attackDamage: 4,
    maxDurability: 60,
    fuelSeconds: 10,
    accentColor: '#b58d58',
    secondaryColor: '#6f5232',
  },
  wood_shovel: {
    id: 'wood_shovel',
    name: 'Wooden Shovel',
    maxStack: 1,
    toolCategory: 'shovel',
    toolTier: 1,
    miningSpeed: 2.3,
    attackDamage: 2.5,
    maxDurability: 60,
    fuelSeconds: 10,
    accentColor: '#b58d58',
    secondaryColor: '#6f5232',
  },
  wood_sword: {
    id: 'wood_sword',
    name: 'Wooden Sword',
    maxStack: 1,
    toolCategory: 'sword',
    toolTier: 1,
    miningSpeed: 1.5,
    attackDamage: 5,
    maxDurability: 60,
    fuelSeconds: 10,
    accentColor: '#b58d58',
    secondaryColor: '#6f5232',
  },

  // Stone Tools
  stone_pickaxe: {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    maxStack: 1,
    toolCategory: 'pickaxe',
    toolTier: 2,
    miningSpeed: 4.0,
    attackDamage: 4,
    maxDurability: 132,
    accentColor: '#8d9196',
    secondaryColor: '#6f5232',
  },
  stone_axe: {
    id: 'stone_axe',
    name: 'Stone Axe',
    maxStack: 1,
    toolCategory: 'axe',
    toolTier: 2,
    miningSpeed: 4.0,
    attackDamage: 5.5,
    maxDurability: 132,
    accentColor: '#8d9196',
    secondaryColor: '#6f5232',
  },
  stone_shovel: {
    id: 'stone_shovel',
    name: 'Stone Shovel',
    maxStack: 1,
    toolCategory: 'shovel',
    toolTier: 2,
    miningSpeed: 4.0,
    attackDamage: 3,
    maxDurability: 132,
    accentColor: '#8d9196',
    secondaryColor: '#6f5232',
  },
  stone_sword: {
    id: 'stone_sword',
    name: 'Stone Sword',
    maxStack: 1,
    toolCategory: 'sword',
    toolTier: 2,
    miningSpeed: 1.6,
    attackDamage: 6.5,
    maxDurability: 132,
    accentColor: '#8d9196',
    secondaryColor: '#6f5232',
  },

  // Iron Tools
  iron_pickaxe: {
    id: 'iron_pickaxe',
    name: 'Iron Pickaxe',
    maxStack: 1,
    toolCategory: 'pickaxe',
    toolTier: 3,
    miningSpeed: 6.2,
    attackDamage: 5,
    maxDurability: 250,
    accentColor: '#e3e8ef',
    secondaryColor: '#6f5232',
  },
  iron_axe: {
    id: 'iron_axe',
    name: 'Iron Axe',
    maxStack: 1,
    toolCategory: 'axe',
    toolTier: 3,
    miningSpeed: 6.2,
    attackDamage: 6.5,
    maxDurability: 250,
    accentColor: '#e3e8ef',
    secondaryColor: '#6f5232',
  },
  iron_shovel: {
    id: 'iron_shovel',
    name: 'Iron Shovel',
    maxStack: 1,
    toolCategory: 'shovel',
    toolTier: 3,
    miningSpeed: 6.2,
    attackDamage: 4,
    maxDurability: 250,
    accentColor: '#e3e8ef',
    secondaryColor: '#6f5232',
  },
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    maxStack: 1,
    toolCategory: 'sword',
    toolTier: 3,
    miningSpeed: 1.8,
    attackDamage: 8,
    maxDurability: 250,
    accentColor: '#e3e8ef',
    secondaryColor: '#6f5232',
  },

  // Gold Pickaxe (blazing speed!)
  gold_pickaxe: {
    id: 'gold_pickaxe',
    name: 'Golden Pickaxe',
    maxStack: 1,
    toolCategory: 'pickaxe',
    toolTier: 3,
    miningSpeed: 11.0,
    attackDamage: 4.5,
    maxDurability: 48,
    accentColor: '#ffd447',
    secondaryColor: '#6f5232',
  },

  // Diamond Tools
  diamond_pickaxe: {
    id: 'diamond_pickaxe',
    name: 'Diamond Pickaxe',
    maxStack: 1,
    toolCategory: 'pickaxe',
    toolTier: 4,
    miningSpeed: 9.0,
    attackDamage: 6,
    maxDurability: 1000,
    accentColor: '#4bf2e8',
    secondaryColor: '#6f5232',
  },
  diamond_axe: {
    id: 'diamond_axe',
    name: 'Diamond Axe',
    maxStack: 1,
    toolCategory: 'axe',
    toolTier: 4,
    miningSpeed: 9.0,
    attackDamage: 8,
    maxDurability: 1000,
    accentColor: '#4bf2e8',
    secondaryColor: '#6f5232',
  },
  diamond_shovel: {
    id: 'diamond_shovel',
    name: 'Diamond Shovel',
    maxStack: 1,
    toolCategory: 'shovel',
    toolTier: 4,
    miningSpeed: 9.0,
    attackDamage: 5,
    maxDurability: 1000,
    accentColor: '#4bf2e8',
    secondaryColor: '#6f5232',
  },
  diamond_sword: {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    maxStack: 1,
    toolCategory: 'sword',
    toolTier: 4,
    miningSpeed: 2.0,
    attackDamage: 10,
    maxDurability: 1000,
    accentColor: '#4bf2e8',
    secondaryColor: '#6f5232',
  },
};

export const ITEMS: Record<ItemId, ItemDefinition> = {} as Record<ItemId, ItemDefinition>;

// Register every Block as a stackable placeable Item
for (const key of Object.keys(BLOCKS)) {
  const numId = Number(key) as BlockId;
  if (numId === BlockId.Air) continue;
  const b = BLOCKS[numId];
  const id = blockItemId(numId);
  const isWoodFuel =
    numId === BlockId.OakLog ||
    numId === BlockId.BirchLog ||
    numId === BlockId.SpruceLog ||
    numId === BlockId.OakPlanks ||
    numId === BlockId.BirchPlanks ||
    numId === BlockId.SprucePlanks ||
    numId === BlockId.CraftingTable ||
    numId === BlockId.Chest ||
    numId === BlockId.Bookshelf;

  ITEMS[id] = {
    id,
    name: b.name,
    maxStack: 64,
    blockId: numId,
    toolCategory: 'none',
    toolTier: 0,
    miningSpeed: 1,
    attackDamage: 1,
    fuelSeconds: isWoodFuel ? 15 : undefined,
    accentColor: b.particleColor,
  };
}

for (const [k, def] of Object.entries(nonBlockItems)) {
  ITEMS[k as ItemId] = def;
}

export function getItemDef(id: ItemId): ItemDefinition {
  return ITEMS[id];
}

export function computeBreakTimeSeconds(
  blockId: BlockId,
  heldItemId: ItemId | null,
  underwater: boolean,
  onGround: boolean
): number {
  const block = BLOCKS[blockId];
  if (!block || block.hardness < 0) return Infinity;
  if (block.hardness === 0) return 0.05;

  const item = heldItemId ? ITEMS[heldItemId] : null;
  let speed = 1.0;

  if (item && block.preferredTool !== 'none' && item.toolCategory === block.preferredTool) {
    speed = item.miningSpeed;
  } else if (item && item.toolCategory === 'sword' && block.soundMaterial === 'leaves') {
    speed = 2.0;
  }

  // If block requires a minimum tool tier and player lacks it, mining is slower
  const hasRequiredTier =
    block.minTier === 0 ||
    (item !== null &&
      item.toolCategory === block.preferredTool &&
      item.toolTier >= block.minTier);

  if (!hasRequiredTier) {
    speed *= 0.35;
  }

  if (underwater) speed *= 0.45;
  if (!onGround) speed *= 0.75;

  return Math.max(0.06, block.hardness / speed);
}

export function canHarvestBlockDrop(blockId: BlockId, heldItemId: ItemId | null): boolean {
  const block = BLOCKS[blockId];
  if (!block || block.hardness < 0) return false;
  if (block.minTier === 0) return true;
  if (!heldItemId) return false;
  const item = ITEMS[heldItemId];
  if (!item) return false;
  return item.toolCategory === block.preferredTool && item.toolTier >= block.minTier;
}

export const CREATIVE_PALETTE: ItemId[] = [
  blockItemId(BlockId.Grass),
  blockItemId(BlockId.Dirt),
  blockItemId(BlockId.Stone),
  blockItemId(BlockId.Cobblestone),
  blockItemId(BlockId.MossyCobble),
  blockItemId(BlockId.OakPlanks),
  blockItemId(BlockId.BirchPlanks),
  blockItemId(BlockId.SprucePlanks),
  blockItemId(BlockId.OakLog),
  blockItemId(BlockId.BirchLog),
  blockItemId(BlockId.SpruceLog),
  blockItemId(BlockId.OakLeaves),
  blockItemId(BlockId.Bricks),
  blockItemId(BlockId.Glass),
  blockItemId(BlockId.Sand),
  blockItemId(BlockId.Sandstone),
  blockItemId(BlockId.Snow),
  blockItemId(BlockId.Ice),
  blockItemId(BlockId.Glowstone),
  blockItemId(BlockId.Torch),
  blockItemId(BlockId.CraftingTable),
  blockItemId(BlockId.Furnace),
  blockItemId(BlockId.Chest),
  blockItemId(BlockId.Bookshelf),
  blockItemId(BlockId.TNT),
  blockItemId(BlockId.RedFlower),
  blockItemId(BlockId.YellowFlower),
  blockItemId(BlockId.BlueFlower),
  blockItemId(BlockId.Cactus),
  'diamond_pickaxe',
  'diamond_axe',
  'diamond_shovel',
  'diamond_sword',
  'cooked_meat',
  'apple',
];

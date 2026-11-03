import { BLOCK, ITEM } from '../blocks.js';

export const MILESTONES = [
  {
    id: 'wood',
    title: 'Gather Timber',
    hint: 'Hold Left-Click on a tree trunk to collect 3 Logs',
    check: (inv) => inv.countIngredient('ANY_LOG') >= 3 || inv.countIngredient('ANY_PLANKS') >= 4,
  },
  {
    id: 'workbench',
    title: 'Set Up Camp',
    hint: 'Press E to craft Planks & a Crafting Table, then Right-Click to place it',
    check: (inv, stats) => stats.placedWorkbench,
  },
  {
    id: 'wood_pick',
    title: 'First Pickaxe',
    hint: 'Stand near your Crafting Table and press E to craft Sticks & a Wooden Pickaxe',
    check: (inv) => inv.countIngredient(ITEM.WOOD_PICKAXE) > 0 || inv.countIngredient(ITEM.STONE_PICKAXE) > 0,
  },
  {
    id: 'stone_age',
    title: 'Stone Age',
    hint: 'Mine 8 Stone with your Pickaxe and upgrade to a Stone Pickaxe',
    check: (inv) => inv.countIngredient(ITEM.STONE_PICKAXE) > 0 || inv.countIngredient(ITEM.IRON_PICKAXE) > 0,
  },
  {
    id: 'light',
    title: 'Light the Night',
    hint: 'Mine Coal Ore (or smelt Charcoal in a Furnace) and craft Torches',
    check: (inv, stats) => inv.countIngredient(BLOCK.TORCH) > 0 || stats.placedTorch,
  },
  {
    id: 'iron_age',
    title: 'Iron Foundry',
    hint: 'Place a Stone Furnace, mine Iron Ore, and smelt Iron Ingots',
    check: (inv) => inv.countIngredient(ITEM.IRON_INGOT) > 0 || inv.countIngredient(ITEM.IRON_PICKAXE) > 0,
  },
  {
    id: 'diamond',
    title: 'Deep Delver',
    hint: 'Explore deep caverns (Y ≤ 16) with an Iron Pickaxe to unearth Diamonds',
    check: (inv) => inv.countIngredient(ITEM.DIAMOND) > 0 || inv.countIngredient(ITEM.DIAMOND_PICKAXE) > 0,
  },
];

export class ProgressionTracker {
  constructor() {
    this.completed = new Set();
    this.stats = {
      placedWorkbench: false,
      placedFurnace: false,
      placedTorch: false,
    };
    this.onMilestoneComplete = null;
  }

  recordBlockPlaced(blockId) {
    if (blockId === BLOCK.CRAFTING_TABLE) this.stats.placedWorkbench = true;
    if (blockId === BLOCK.FURNACE) this.stats.placedFurnace = true;
    if (blockId === BLOCK.TORCH || blockId === BLOCK.GLOWSTONE) this.stats.placedTorch = true;
  }

  update(inventory) {
    for (const m of MILESTONES) {
      if (!this.completed.has(m.id) && m.check(inventory, this.stats)) {
        this.completed.add(m.id);
        if (typeof this.onMilestoneComplete === 'function') {
          this.onMilestoneComplete(m);
        }
      }
    }
  }

  getCurrentMilestone() {
    for (const m of MILESTONES) {
      if (!this.completed.has(m.id)) return m;
    }
    return null;
  }

  serialize() {
    return {
      completed: Array.from(this.completed),
      stats: { ...this.stats },
    };
  }

  deserialize(data) {
    if (!data) return;
    if (Array.isArray(data.completed)) {
      this.completed = new Set(data.completed);
    }
    if (data.stats) {
      this.stats = { ...this.stats, ...data.stats };
    }
  }
}

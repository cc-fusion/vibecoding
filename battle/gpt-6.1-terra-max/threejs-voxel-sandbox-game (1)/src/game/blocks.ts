export enum Block {
  Air,
  Grass,
  Dirt,
  Stone,
  Log,
  Leaves,
  Planks,
  Sand,
  Water,
  Flower,
  TallGrass,
  Cobblestone,
  CraftingTable,
  CoalOre,
  IronOre,
  Wool,
  Furnace,
}

export type ItemId =
  | 'grass' | 'dirt' | 'stone' | 'log' | 'leaves' | 'planks' | 'sand'
  | 'flower' | 'cobblestone' | 'crafting_table' | 'coal' | 'iron_ore'
  | 'wool' | 'stick' | 'iron_ingot' | 'furnace' | 'wooden_pickaxe' | 'stone_pickaxe' | 'iron_pickaxe' | 'wooden_axe'

export interface ItemDefinition {
  name: string
  shortName?: string
  block?: Block
  color: string
  top?: string
  side?: string
  tool?: 'axe' | 'pickaxe'
  tier?: number
}

export interface Slot {
  id: ItemId
  count: number
}

export interface Recipe {
  id: string
  output: Slot
  ingredients: Slot[]
  description: string
  requires?: 'table' | 'furnace'
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  grass: { name: 'Grass Block', block: Block.Grass, color: '#8d6746', top: '#85b95c', side: '#a3764f' },
  dirt: { name: 'Dirt', block: Block.Dirt, color: '#8e6448', top: '#a77955', side: '#79523c' },
  stone: { name: 'Stone', block: Block.Stone, color: '#929c96', top: '#afb9ad', side: '#7a8880' },
  log: { name: 'Oak Log', block: Block.Log, color: '#85613e', top: '#c7a778', side: '#735134' },
  leaves: { name: 'Oak Leaves', block: Block.Leaves, color: '#538a46', top: '#78ae5d', side: '#40703b' },
  planks: { name: 'Oak Planks', block: Block.Planks, color: '#ba905d', top: '#d7b479', side: '#9c7148' },
  sand: { name: 'Sand', block: Block.Sand, color: '#d9c992', top: '#eee0ae', side: '#bcad7c' },
  flower: { name: 'Daisy', block: Block.Flower, color: '#f6efca', top: '#fff8e1', side: '#6c9b55' },
  cobblestone: { name: 'Cobblestone', block: Block.Cobblestone, color: '#858f89', top: '#abb4aa', side: '#6d7771' },
  crafting_table: { name: 'Crafting Table', block: Block.CraftingTable, color: '#9b704a', top: '#d3a66e', side: '#765039' },
  coal: { name: 'Coal', color: '#414a43' },
  iron_ore: { name: 'Iron Ore', block: Block.IronOre, color: '#bba290', top: '#d2b6a1', side: '#8d827b' },
  wool: { name: 'Soft Wool', block: Block.Wool, color: '#e8e5d3', top: '#f9f6e8', side: '#c5c8b9' },
  stick: { name: 'Stick', color: '#9c7048' },
  iron_ingot: { name: 'Iron Ingot', color: '#c8d1c8' },
  furnace: { name: 'Furnace', block: Block.Furnace, color: '#858f89', top: '#aeb8ad', side: '#68766e' },
  wooden_pickaxe: { name: 'Wooden Pickaxe', shortName: 'Wood Pickaxe', color: '#be9664', tool: 'pickaxe', tier: 1 },
  stone_pickaxe: { name: 'Stone Pickaxe', color: '#98a59c', tool: 'pickaxe', tier: 2 },
  iron_pickaxe: { name: 'Iron Pickaxe', color: '#d3ddd3', tool: 'pickaxe', tier: 3 },
  wooden_axe: { name: 'Wooden Axe', shortName: 'Wood Axe', color: '#be9664', tool: 'axe', tier: 1 },
}

export const RECIPES: Recipe[] = [
  { id: 'planks', output: { id: 'planks', count: 4 }, ingredients: [{ id: 'log', count: 1 }], description: 'A good place to start.' },
  { id: 'sticks', output: { id: 'stick', count: 4 }, ingredients: [{ id: 'planks', count: 2 }], description: 'The beginning of every tool.' },
  { id: 'table', output: { id: 'crafting_table', count: 1 }, ingredients: [{ id: 'planks', count: 4 }], description: 'A workspace to call your own.' },
  { id: 'wood_pickaxe', output: { id: 'wooden_pickaxe', count: 1 }, ingredients: [{ id: 'planks', count: 3 }, { id: 'stick', count: 2 }], description: 'Make light work of stone.', requires: 'table' },
  { id: 'wood_axe', output: { id: 'wooden_axe', count: 1 }, ingredients: [{ id: 'planks', count: 3 }, { id: 'stick', count: 2 }], description: 'For gathering wood faster.', requires: 'table' },
  { id: 'stone_pickaxe', output: { id: 'stone_pickaxe', count: 1 }, ingredients: [{ id: 'cobblestone', count: 3 }, { id: 'stick', count: 2 }], description: 'A sturdier way to mine iron.', requires: 'table' },
  { id: 'furnace', output: { id: 'furnace', count: 1 }, ingredients: [{ id: 'cobblestone', count: 8 }], description: 'A little heat goes a long way.', requires: 'table' },
  { id: 'iron_ingot', output: { id: 'iron_ingot', count: 1 }, ingredients: [{ id: 'iron_ore', count: 1 }, { id: 'coal', count: 1 }], description: 'Smelt iron ore with coal.', requires: 'furnace' },
  { id: 'iron_pickaxe', output: { id: 'iron_pickaxe', count: 1 }, ingredients: [{ id: 'iron_ingot', count: 3 }, { id: 'stick', count: 2 }], description: 'Your best companion underground.', requires: 'table' },
]

export const BLOCK_DROPS: Partial<Record<Block, ItemId>> = {
  [Block.Grass]: 'grass',
  [Block.Dirt]: 'dirt',
  [Block.Stone]: 'cobblestone',
  [Block.Log]: 'log',
  [Block.Leaves]: 'leaves',
  [Block.Planks]: 'planks',
  [Block.Sand]: 'sand',
  [Block.Flower]: 'flower',
  [Block.Cobblestone]: 'cobblestone',
  [Block.CraftingTable]: 'crafting_table',
  [Block.CoalOre]: 'coal',
  [Block.IronOre]: 'iron_ore',
  [Block.Wool]: 'wool',
  [Block.Furnace]: 'furnace',
}

export const STARTER_INVENTORY: (Slot | null)[] = [
  { id: 'wooden_axe', count: 1 },
  { id: 'wooden_pickaxe', count: 1 },
  { id: 'grass', count: 24 },
  { id: 'dirt', count: 20 },
  { id: 'planks', count: 16 },
  { id: 'cobblestone', count: 12 },
  { id: 'log', count: 6 },
  { id: 'sand', count: 12 },
  { id: 'flower', count: 4 },
  ...Array(18).fill(null),
]

export function isPlant(block: Block) {
  return block === Block.Flower || block === Block.TallGrass
}

export function isSolid(block: Block) {
  return block !== Block.Air && block !== Block.Water && !isPlant(block)
}

export function countItem(inventory: (Slot | null)[], id: ItemId) {
  return inventory.reduce((total, slot) => total + (slot?.id === id ? slot.count : 0), 0)
}

export function canCraft(inventory: (Slot | null)[], recipe: Recipe) {
  return recipe.ingredients.every((ingredient) => countItem(inventory, ingredient.id) >= ingredient.count)
}
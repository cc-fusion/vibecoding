export const B = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  OAK_LOG: 6,
  OAK_LEAVES: 7,
  PLANKS: 8,
  CRAFTING_TABLE: 9,
  COAL_ORE: 10,
  IRON_ORE: 11,
  CRYSTAL_ORE: 12,
  SNOW: 13,
  CACTUS: 14,
  SANDSTONE: 15,
  BEDROCK: 16,
  GLOWSTONE: 17,
  FLOWER: 18,
  TALL_GRASS: 19,
  PINE_LEAVES: 20,
  GLASS: 21,
  BRICKS: 22,
  STONE_BRICKS: 23,
  OBSIDIAN: 24,
  CRYSTAL_BLOCK: 25,
  FURNACE: 26,
  MOSSY_STONE: 27,
  CLAY: 28,
  GRAVEL: 29,
  BERRY_BUSH: 30,
  TORCH: 31,
  PINE_LOG: 32,
  JUNGLE_LEAVES: 33,
  MUD: 34,
  PUMPKIN: 35,
});

const block = (id, name, tiles, options = {}) => ({
  id,
  key: name.toLowerCase().replaceAll(' ', '_'),
  name,
  tiles: typeof tiles === 'string' ? { side: tiles, top: tiles, bottom: tiles } : tiles,
  solid: true,
  opaque: true,
  shape: 'cube',
  category: 'opaque',
  hardness: 1,
  tool: null,
  tier: 0,
  drop: null,
  dropChance: 1,
  xp: 0,
  ...options,
});

export const BLOCKS = [
  block(B.AIR, 'Air', 'air', { solid: false, opaque: false, hardness: Infinity }),
  block(B.GRASS, 'Grass Block', { side: 'grass_side', top: 'grass_top', bottom: 'dirt' }, { hardness: 0.65, tool: 'shovel', drop: 'dirt' }),
  block(B.DIRT, 'Dirt', 'dirt', { hardness: 0.55, tool: 'shovel' }),
  block(B.STONE, 'Stone', 'stone', { hardness: 1.8, tool: 'pickaxe', tier: 1 }),
  block(B.SAND, 'Sand', 'sand', { hardness: 0.5, tool: 'shovel' }),
  block(B.WATER, 'Water', 'water', { solid: false, opaque: false, category: 'water', hardness: Infinity }),
  block(B.OAK_LOG, 'Oak Log', { side: 'oak_log', top: 'oak_log_top', bottom: 'oak_log_top' }, { hardness: 1.4, tool: 'axe' }),
  block(B.OAK_LEAVES, 'Oak Leaves', 'oak_leaves', { opaque: false, category: 'cutout', hardness: 0.25, tool: 'axe', dropChance: 0.5 }),
  block(B.PLANKS, 'Wooden Planks', 'planks', { hardness: 1.1, tool: 'axe' }),
  block(B.CRAFTING_TABLE, 'Crafting Table', { side: 'crafting_side', top: 'crafting_top', bottom: 'planks' }, { hardness: 1.2, tool: 'axe' }),
  block(B.COAL_ORE, 'Coal Ore', 'coal_ore', { hardness: 2.2, tool: 'pickaxe', tier: 1, drop: 'coal', xp: 7 }),
  block(B.IRON_ORE, 'Iron Ore', 'iron_ore', { hardness: 2.8, tool: 'pickaxe', tier: 2, drop: 'raw_iron', xp: 14 }),
  block(B.CRYSTAL_ORE, 'Crystal Ore', 'crystal_ore', { hardness: 3.8, tool: 'pickaxe', tier: 3, drop: 'crystal', xp: 30 }),
  block(B.SNOW, 'Snow Block', 'snow', { hardness: 0.5, tool: 'shovel' }),
  block(B.CACTUS, 'Cactus', { side: 'cactus_side', top: 'cactus_top', bottom: 'cactus_top' }, { hardness: 0.55 }),
  block(B.SANDSTONE, 'Sandstone', { side: 'sandstone_side', top: 'sandstone_top', bottom: 'sandstone_top' }, { hardness: 1.4, tool: 'pickaxe', tier: 1 }),
  block(B.BEDROCK, 'Bedrock', 'bedrock', { hardness: Infinity, tier: 99 }),
  block(B.GLOWSTONE, 'Glowstone', 'glowstone', { category: 'glow', hardness: 0.8, light: 1 }),
  block(B.FLOWER, 'Wildflower', 'flower', { solid: false, opaque: false, shape: 'cross', category: 'cutout', hardness: 0.08, drop: 'plant_fiber' }),
  block(B.TALL_GRASS, 'Wild Grass', 'tall_grass', { solid: false, opaque: false, shape: 'cross', category: 'cutout', hardness: 0.08, drop: 'plant_fiber', dropChance: 0.7 }),
  block(B.PINE_LEAVES, 'Pine Needles', 'pine_leaves', { opaque: false, category: 'cutout', hardness: 0.25, tool: 'axe', dropChance: 0.45 }),
  block(B.GLASS, 'Glass', 'glass', { opaque: false, category: 'cutout', hardness: 0.35 }),
  block(B.BRICKS, 'Clay Bricks', 'bricks', { hardness: 1.8, tool: 'pickaxe', tier: 1 }),
  block(B.STONE_BRICKS, 'Stone Bricks', 'stone_bricks', { hardness: 1.9, tool: 'pickaxe', tier: 1 }),
  block(B.OBSIDIAN, 'Obsidian', 'obsidian', { hardness: 6.5, tool: 'pickaxe', tier: 3, xp: 20 }),
  block(B.CRYSTAL_BLOCK, 'Crystal Block', 'crystal_block', { category: 'glow', hardness: 2.2, tool: 'pickaxe', tier: 2, light: 0.7 }),
  block(B.FURNACE, 'Furnace', { side: 'furnace_side', top: 'stone', bottom: 'stone' }, { hardness: 2, tool: 'pickaxe', tier: 1 }),
  block(B.MOSSY_STONE, 'Mossy Stone', 'mossy_stone', { hardness: 1.8, tool: 'pickaxe', tier: 1 }),
  block(B.CLAY, 'Clay', 'clay', { hardness: 0.7, tool: 'shovel' }),
  block(B.GRAVEL, 'Gravel', 'gravel', { hardness: 0.65, tool: 'shovel' }),
  block(B.BERRY_BUSH, 'Berry Bush', 'berry_bush', { solid: false, opaque: false, shape: 'cross', category: 'cutout', hardness: 0.18, drop: 'berries' }),
  block(B.TORCH, 'Torch', 'torch', { solid: false, opaque: false, shape: 'cross', category: 'glow_cutout', hardness: 0.08, light: 1.25 }),
  block(B.PINE_LOG, 'Pine Log', { side: 'pine_log', top: 'pine_log_top', bottom: 'pine_log_top' }, { hardness: 1.5, tool: 'axe' }),
  block(B.JUNGLE_LEAVES, 'Jungle Leaves', 'jungle_leaves', { opaque: false, category: 'cutout', hardness: 0.25, tool: 'axe', dropChance: 0.5 }),
  block(B.MUD, 'Mud', 'mud', { hardness: 0.6, tool: 'shovel' }),
  block(B.PUMPKIN, 'Pumpkin', { side: 'pumpkin_side', top: 'pumpkin_top', bottom: 'pumpkin_top' }, { hardness: 0.8, tool: 'axe', drop: 'pumpkin' }),
];

for (const def of BLOCKS) {
  if (def.id !== B.AIR && def.id !== B.WATER && !def.drop) def.drop = def.key;
}

const item = (key, name, options = {}) => ({ key, name, stack: 64, ...options });
export const ITEMS = {};
for (const def of BLOCKS) {
  if (def.id === B.AIR || def.id === B.WATER) continue;
  ITEMS[def.key] = item(def.key, def.name, { block: def.id });
}
Object.assign(ITEMS, {
  stick: item('stick', 'Stick'),
  coal: item('coal', 'Coal'),
  raw_iron: item('raw_iron', 'Raw Iron'),
  iron_ingot: item('iron_ingot', 'Iron Ingot'),
  crystal: item('crystal', 'Sky Crystal'),
  plant_fiber: item('plant_fiber', 'Plant Fiber'),
  guardian_core: item('guardian_core', 'Guardian Core', { stack: 1 }),
  guardian_idol: item('guardian_idol', 'Guardian Idol', { stack: 1, use: 'summon' }),
  apple: item('apple', 'Apple', { food: 3, heal: 1, stack: 16 }),
  berries: item('berries', 'Sweet Berries', { food: 2, stack: 16 }),
  pumpkin: item('pumpkin', 'Pumpkin', { food: 3, stack: 16, block: B.PUMPKIN }),
  raw_meat: item('raw_meat', 'Raw Meat', { food: 2, hurt: 1, stack: 16 }),
  cooked_meat: item('cooked_meat', 'Cooked Meat', { food: 7, heal: 2, stack: 16 }),
  bandage: item('bandage', 'Fiber Bandage', { heal: 6, stack: 8, use: 'heal' }),
});

const MATERIALS = {
  wood: { name: 'Wooden', color: '#a87342', tier: 1, speed: 2.4, durability: 70, attack: 2 },
  stone: { name: 'Stone', color: '#858a8c', tier: 2, speed: 4.2, durability: 150, attack: 3 },
  iron: { name: 'Iron', color: '#d4d9d5', tier: 3, speed: 6.5, durability: 310, attack: 4 },
  crystal: { name: 'Crystal', color: '#65e4dc', tier: 4, speed: 9, durability: 640, attack: 6 },
};
for (const [material, m] of Object.entries(MATERIALS)) {
  const ingredient = material === 'wood' ? 'planks' : material === 'stone' ? 'stone' : material === 'iron' ? 'iron_ingot' : 'crystal';
  for (const [kind, tool, speedMultiplier] of [['pickaxe', 'pickaxe', 1], ['axe', 'axe', 1.08], ['shovel', 'shovel', 1.12]]) {
    const key = `${material}_${kind}`;
    ITEMS[key] = item(key, `${m.name} ${kind[0].toUpperCase()}${kind.slice(1)}`, {
      stack: 1, tool, tier: m.tier, speed: m.speed * speedMultiplier,
      durability: Math.round(m.durability * (kind === 'shovel' ? 0.8 : 1)),
      attack: m.attack, ingredient, material,
    });
  }
  const key = `${material}_sword`;
  ITEMS[key] = item(key, `${m.name} Sword`, {
    stack: 1, tool: 'sword', tier: m.tier, speed: 1, durability: m.durability,
    attack: m.attack + 2, ingredient, material,
  });
}
ITEMS.guardian_edge = item('guardian_edge', 'Guardian Edge', {
  stack: 1, tool: 'sword', tier: 5, speed: 1, durability: 1100,
  attack: 11, material: 'guardian',
});

export const RECIPES = [
  { id: 'oak_planks', out: 'planks', count: 4, ingredients: { oak_log: 1 }, category: 'building' },
  { id: 'pine_planks', out: 'planks', count: 4, ingredients: { pine_log: 1 }, category: 'building' },
  { id: 'sticks', out: 'stick', count: 4, ingredients: { planks: 2 }, category: 'building' },
  { id: 'crafting_table', out: 'crafting_table', count: 1, ingredients: { planks: 4 }, category: 'building' },
  { id: 'furnace', out: 'furnace', count: 1, ingredients: { stone: 8 }, category: 'building', station: 'crafting_table' },
  { id: 'torch', out: 'torch', count: 4, ingredients: { stick: 1, coal: 1 }, category: 'survival' },
  { id: 'stone_bricks', out: 'stone_bricks', count: 4, ingredients: { stone: 4 }, category: 'building', station: 'crafting_table' },
  { id: 'bricks', out: 'bricks', count: 4, ingredients: { clay: 4 }, category: 'building', station: 'crafting_table' },
  { id: 'glass', out: 'glass', count: 2, ingredients: { sand: 2, coal: 1 }, category: 'building', station: 'furnace' },
  { id: 'iron_ingot', out: 'iron_ingot', count: 1, ingredients: { raw_iron: 1, coal: 1 }, category: 'survival', station: 'furnace' },
  { id: 'cooked_meat', out: 'cooked_meat', count: 1, ingredients: { raw_meat: 1, coal: 1 }, category: 'survival', station: 'furnace' },
  { id: 'bandage', out: 'bandage', count: 1, ingredients: { plant_fiber: 3 }, category: 'survival' },
  { id: 'crystal_block', out: 'crystal_block', count: 1, ingredients: { crystal: 4 }, category: 'building', station: 'crafting_table', level: 3 },
  { id: 'guardian_idol', out: 'guardian_idol', count: 1, ingredients: { crystal: 2, stone_bricks: 4, iron_ingot: 2 }, category: 'survival', station: 'crafting_table', level: 4 },
  { id: 'guardian_edge', out: 'guardian_edge', count: 1, ingredients: { guardian_core: 1, crystal: 2, stick: 1 }, category: 'tools', station: 'crafting_table', boss: true },
];

for (const [material, m] of Object.entries(MATERIALS)) {
  const ingredient = material === 'wood' ? 'planks' : material === 'stone' ? 'stone' : material === 'iron' ? 'iron_ingot' : 'crystal';
  const level = material === 'crystal' ? 3 : 1;
  for (const kind of ['pickaxe', 'axe', 'shovel', 'sword']) {
    RECIPES.push({
      id: `${material}_${kind}`,
      out: `${material}_${kind}`,
      count: 1,
      ingredients: { [ingredient]: kind === 'sword' ? 2 : 3, stick: kind === 'sword' ? 1 : 2 },
      category: 'tools', station: material === 'wood' ? null : 'crafting_table', level,
    });
  }
}

export const BLOCK_BY_KEY = Object.fromEntries(BLOCKS.map((b) => [b.key, b]));
export const getBlock = (id) => BLOCKS[id] || BLOCKS[0];
export const getItem = (key) => ITEMS[key];
export const isPlaceable = (key) => Number.isInteger(ITEMS[key]?.block);
export const xpLevel = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 60));
export const xpForNextLevel = (level) => level * level * 60;
export const xpForLevel = (level) => (level - 1) * (level - 1) * 60;

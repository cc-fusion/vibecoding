// ===== Terra Delve — static game data =====
export const TS = 16;

export const T = {
  AIR: 0, DIRT: 1, STONE: 2, GRASS: 3, SAND: 4, SANDSTONE: 5, SNOW: 6, ICE: 7, MUD: 8, JGRASS: 9, EBON: 10, BGRASS: 11,
  ASH: 12, HELLSTONE: 13, COPPER: 14, IRON: 15, GOLD: 16, SHADOW: 17, COBALT: 18, ADAMANT: 19, WOOD: 20, TRUNK: 21,
  LEAVES: 22, LEAVES_SNOW: 23, LEAVES_BLIGHT: 24, CACTUS: 25, BRICK: 26, GLASS: 27, PLATFORM: 28, OBSIDIAN: 29, TORCH: 30,
  WORKBENCH: 31, FURNACE: 32, ANVIL: 33, HELLFORGE: 34, ARCANE: 35, CHEST: 36, DOOR: 37, CHAIR: 38, TABLE: 39, BED: 40,
  CRYSTAL: 41, DAYBLOOM: 42, SHIVER: 43, FIRE: 44, GLOWSHROOM: 45, TALLGRASS: 46, SAPLING: 47, WATER: 48, LAVA: 49,
} as const;
export const NT = 50;

export const B = { FOREST: 0, DESERT: 1, TUNDRA: 2, JUNGLE: 3, BLIGHT: 4, HELL: 5 };
export const BIOME_NAMES = ['Forest', 'Desert', 'Tundra', 'Jungle', 'Blight', 'Underworld'];
export const LAYER_NAMES = ['Sky', 'Surface', 'Underground', 'Caverns', 'Underworld'];

export interface TileDef {
  name: string; solid: boolean; hp: number; pick: number; item: string; snd: string; style: string;
  c: string; d: string; l: string; light: number; liquid?: boolean; plat?: boolean; clear?: boolean;
  sup?: boolean; door?: boolean; top?: string; ore?: string;
}
export const TILES: TileDef[] = [];
function td(id: number, name: string, o: Partial<TileDef>) {
  TILES[id] = { name, solid: true, hp: 50, pick: 0, item: '', snd: 'dirt', style: 'noise', c: '#888', d: '#666', l: '#aaa', light: 0, ...o } as TileDef;
}
const SC = { c: '#7d838d', d: '#5f656f', l: '#9ba1ab' };
const EC = { c: '#5b4a7d', d: '#42335f', l: '#7a66a3' };
td(T.AIR, 'Air', { solid: false, hp: 0, c: '#000' });
td(T.DIRT, 'Dirt', { hp: 40, item: 'dirt', c: '#8a5a32', d: '#6e4524', l: '#a46c3c' });
td(T.STONE, 'Stone', { hp: 90, item: 'stone', snd: 'stone', style: 'stone', ...SC });
td(T.GRASS, 'Grass', { hp: 40, item: 'dirt', style: 'grass', c: '#8a5a32', d: '#6e4524', l: '#a46c3c', top: '#3fae3a' });
td(T.SAND, 'Sand', { hp: 30, item: 'sand', c: '#e2c97a', d: '#c9ad5d', l: '#f2dd9a' });
td(T.SANDSTONE, 'Sandstone', { hp: 70, item: 'sand', snd: 'stone', style: 'stone', c: '#c9a45a', d: '#a8843f', l: '#dcbb70' });
td(T.SNOW, 'Snow', { hp: 30, item: 'snow', c: '#e9f1f9', d: '#c9d8e8', l: '#ffffff' });
td(T.ICE, 'Ice', { hp: 50, item: 'ice', snd: 'glass', style: 'ice', c: '#9fd3ee', d: '#7ab8dc', l: '#d6f0ff' });
td(T.MUD, 'Mud', { hp: 40, item: 'mud', c: '#6b4f58', d: '#503a42', l: '#85666f' });
td(T.JGRASS, 'Jungle Grass', { hp: 40, item: 'mud', style: 'grass', c: '#6b4f58', d: '#503a42', l: '#85666f', top: '#58c92e' });
td(T.EBON, 'Ebonstone', { hp: 100, item: 'ebonstone', snd: 'stone', style: 'stone', ...EC });
td(T.BGRASS, 'Blight Grass', { hp: 40, item: 'dirt', style: 'grass', c: '#6b4a5e', d: '#4d3445', l: '#85647a', top: '#8a4fd0' });
td(T.ASH, 'Ash', { hp: 60, item: 'ash', c: '#4a4a54', d: '#34343c', l: '#62626e' });
td(T.HELLSTONE, 'Hellstone', { hp: 150, pick: 65, item: 'hellstone', snd: 'stone', style: 'hell', c: '#6a2a22', d: '#401410', l: '#ff7a30', light: 0.55 });
td(T.COPPER, 'Copper Ore', { hp: 80, item: 'copper_ore', snd: 'stone', style: 'ore', ore: '#e8843a', ...SC });
td(T.IRON, 'Iron Ore', { hp: 100, item: 'iron_ore', snd: 'stone', style: 'ore', ore: '#d8c0a8', ...SC });
td(T.GOLD, 'Gold Ore', { hp: 120, pick: 40, item: 'gold_ore', snd: 'stone', style: 'ore', ore: '#ffd84a', ...SC });
td(T.SHADOW, 'Shadowite Ore', { hp: 150, pick: 55, item: 'shadow_ore', snd: 'stone', style: 'ore', ore: '#a070f0', ...EC });
td(T.COBALT, 'Cobalt Ore', { hp: 220, pick: 100, item: 'cobalt_ore', snd: 'stone', style: 'ore', ore: '#3a7cf0', ...SC });
td(T.ADAMANT, 'Adamant Ore', { hp: 280, pick: 110, item: 'adamant_ore', snd: 'stone', style: 'ore', ore: '#f0506e', ...SC });
td(T.WOOD, 'Wood', { hp: 50, item: 'wood', snd: 'wood', style: 'planks', c: '#b27a43', d: '#7d5128', l: '#cf9658' });
td(T.TRUNK, 'Tree', { solid: false, hp: 70, item: 'wood', snd: 'wood', style: 'trunk', c: '#7a5230', d: '#523519', l: '#946238', clear: true });
td(T.LEAVES, 'Leaves', { solid: false, hp: 3, snd: 'plant', style: 'leaf', c: '#2f9a35', d: '#1f7a28', l: '#52c050', clear: true });
td(T.LEAVES_SNOW, 'Frosted Leaves', { solid: false, hp: 3, snd: 'plant', style: 'leaf', c: '#9cc4cc', d: '#6a98a8', l: '#ffffff', clear: true });
td(T.LEAVES_BLIGHT, 'Blighted Leaves', { solid: false, hp: 3, snd: 'plant', style: 'leaf', c: '#6a3c9a', d: '#4a2878', l: '#8c5ac0', clear: true });
td(T.CACTUS, 'Cactus', { solid: false, hp: 30, snd: 'plant', style: 'cactus', c: '#3a9a48', d: '#26703a', l: '#62c070', clear: true });
td(T.BRICK, 'Stone Brick', { hp: 90, item: 'brick', snd: 'stone', style: 'brick', c: '#868c96', d: '#555b66', l: '#a8aeb8' });
td(T.GLASS, 'Glass', { hp: 15, item: 'glass', snd: 'glass', style: 'glass', c: '#bfe8f5', d: '#8cc8dc', l: '#ffffff', clear: true });
td(T.PLATFORM, 'Wood Platform', { solid: false, plat: true, hp: 20, item: 'platform', snd: 'wood', style: 'platform', c: '#b27a43', d: '#7d5128', l: '#cf9658', clear: true });
td(T.OBSIDIAN, 'Obsidian', { hp: 200, pick: 65, item: 'obsidian', snd: 'stone', style: 'stone', c: '#2a1c40', d: '#180f2a', l: '#4a3470' });
const OBJ = { solid: false, style: 'obj', clear: true, sup: true } as Partial<TileDef>;
td(T.TORCH, 'Torch', { ...OBJ, sup: false, hp: 1, item: 'torch', snd: 'wood', light: 1, c: '#ffb040' });
td(T.WORKBENCH, 'Work Bench', { ...OBJ, hp: 20, item: 'workbench', snd: 'wood', c: '#b27a43' });
td(T.FURNACE, 'Furnace', { ...OBJ, hp: 40, item: 'furnace', snd: 'stone', c: '#8a8e98', light: 0.6 });
td(T.ANVIL, 'Iron Anvil', { ...OBJ, hp: 60, item: 'anvil', snd: 'metal', c: '#9a9aa8' });
td(T.HELLFORGE, 'Hellforge', { ...OBJ, hp: 80, item: 'hellforge', snd: 'metal', c: '#a03a2a', light: 0.7 });
td(T.ARCANE, 'Arcane Anvil', { ...OBJ, hp: 80, item: 'arcane_anvil', snd: 'metal', c: '#6a4ad0', light: 0.4 });
td(T.CHEST, 'Chest', { ...OBJ, hp: 30, item: 'chest', snd: 'wood', c: '#c88a3a' });
td(T.DOOR, 'Wooden Door', { ...OBJ, sup: false, door: true, hp: 30, item: 'door', snd: 'wood', c: '#9a6a34' });
td(T.CHAIR, 'Wooden Chair', { ...OBJ, hp: 20, item: 'chair', snd: 'wood', c: '#b27a43' });
td(T.TABLE, 'Wooden Table', { ...OBJ, hp: 20, item: 'table', snd: 'wood', c: '#b27a43' });
td(T.BED, 'Bed', { ...OBJ, hp: 20, item: 'bed', snd: 'wood', c: '#d84a4a' });
td(T.CRYSTAL, 'Life Crystal', { ...OBJ, hp: 25, item: 'life_crystal', snd: 'glass', light: 0.75, c: '#ff5a9a' });
td(T.DAYBLOOM, 'Daybloom', { ...OBJ, hp: 1, item: 'daybloom', snd: 'plant', c: '#ffd23a' });
td(T.SHIVER, 'Shiverthorn', { ...OBJ, hp: 1, item: 'shiverthorn', snd: 'plant', c: '#6ac0ff' });
td(T.FIRE, 'Fireblossom', { ...OBJ, hp: 1, item: 'fireblossom', snd: 'plant', c: '#ff6a2a', light: 0.3 });
td(T.GLOWSHROOM, 'Glowing Mushroom', { ...OBJ, hp: 1, item: 'glowshroom', snd: 'plant', c: '#5ae0ff', light: 0.6 });
td(T.TALLGRASS, 'Tall Grass', { ...OBJ, hp: 1, snd: 'plant', c: '#4cc040' });
td(T.SAPLING, 'Sapling', { ...OBJ, hp: 1, item: 'acorn', snd: 'plant', c: '#4cc040' });
td(T.WATER, 'Water', { solid: false, hp: 0, liquid: true, clear: true, c: '#3d78e0' });
td(T.LAVA, 'Lava', { solid: false, hp: 0, liquid: true, clear: true, c: '#ff6a1a', light: 0.95 });

export const WL = { NONE: 0, DIRT: 1, STONE: 2, WOOD: 3, PSTONE: 4, PBRICK: 5, ICE: 6, SAND: 7, MUD: 8, EBON: 9, HELL: 10 };
export const WALLS = [
  { name: 'None', c: '#000', item: '' }, { name: 'Dirt Wall', c: '#4a3220', item: '' }, { name: 'Stone Wall', c: '#3c4048', item: '' },
  { name: 'Wood Wall', c: '#6e4a28', item: 'wood_wall' }, { name: 'Stone Wall', c: '#454a52', item: 'stone_wall' },
  { name: 'Brick Wall', c: '#4a4e58', item: 'brick_wall' }, { name: 'Ice Wall', c: '#4a6a80', item: '' }, { name: 'Sand Wall', c: '#7a6a3a', item: '' },
  { name: 'Mud Wall', c: '#3e2e36', item: '' }, { name: 'Ebon Wall', c: '#2e2444', item: '' }, { name: 'Ash Wall', c: '#2a2024', item: '' },
];

// ===== Items =====
export interface ItemDef {
  id: string; name: string; kind: string; value: number; col: string; icon: string; stack: number;
  tile?: number; wall?: number; power?: number; dmg?: number; use?: number; kb?: number; reach?: number; mana?: number;
  ammo?: string; heal?: number; healMana?: number; buff?: string; dur?: number; def?: number; set?: string; fx?: string;
  desc?: string; proj?: string; speed?: number; pellets?: number; boss?: string; auto?: boolean; ammoType?: string;
}
export const ITEMS: Record<string, ItemDef> = {};
const BIGSTACK = new Set(['block', 'wall', 'mat', 'ammo']);
function it(id: string, name: string, kind: string, value: number, col: string, icon: string, o: Partial<ItemDef> = {}) {
  const stack = BIGSTACK.has(kind) ? 999 : (kind === 'potion' || kind === 'use' || kind === 'throw') ? 99 : kind === 'summon' ? 20 : 1;
  ITEMS[id] = { id, name, kind, value, col, icon, stack, ...o };
}
export const BLOCK_ITEMS: [string, string, number, number, string][] = [
  ['dirt', 'Dirt Block', T.DIRT, 2, '#8a5a32'], ['stone', 'Stone Block', T.STONE, 2, '#7d838d'], ['wood', 'Wood', T.WOOD, 5, '#b27a43'],
  ['mud', 'Mud Block', T.MUD, 2, '#6b4f58'], ['sand', 'Sand Block', T.SAND, 2, '#e2c97a'], ['snow', 'Snow Block', T.SNOW, 2, '#e9f1f9'],
  ['ice', 'Ice Block', T.ICE, 3, '#9fd3ee'], ['ash', 'Ash Block', T.ASH, 2, '#4a4a54'], ['ebonstone', 'Ebonstone Block', T.EBON, 6, '#5b4a7d'],
  ['obsidian', 'Obsidian', T.OBSIDIAN, 40, '#2a1c40'], ['brick', 'Stone Brick', T.BRICK, 6, '#868c96'], ['glass', 'Glass', T.GLASS, 10, '#bfe8f5'],
  ['platform', 'Wood Platform', T.PLATFORM, 3, '#b27a43'], ['torch', 'Torch', T.TORCH, 25, '#ffb040'],
  ['workbench', 'Work Bench', T.WORKBENCH, 60, '#b27a43'], ['furnace', 'Furnace', T.FURNACE, 200, '#8a8e98'],
  ['anvil', 'Iron Anvil', T.ANVIL, 500, '#9a9aa8'], ['hellforge', 'Hellforge', T.HELLFORGE, 1500, '#a03a2a'],
  ['arcane_anvil', 'Arcane Anvil', T.ARCANE, 6000, '#6a4ad0'], ['chest', 'Chest', T.CHEST, 250, '#c88a3a'],
  ['door', 'Wooden Door', T.DOOR, 100, '#9a6a34'], ['chair', 'Wooden Chair', T.CHAIR, 60, '#b27a43'],
  ['table', 'Wooden Table', T.TABLE, 100, '#b27a43'], ['bed', 'Bed', T.BED, 400, '#d84a4a'], ['acorn', 'Acorn', T.SAPLING, 20, '#9a6a34'],
];
for (const [id, n, t, v, c] of BLOCK_ITEMS) it(id, n, 'block', v, c, 'block', { tile: t });
it('wood_wall', 'Wood Wall', 'wall', 2, '#6e4a28', 'wall', { wall: WL.WOOD });
it('stone_wall', 'Stone Wall', 'wall', 2, '#454a52', 'wall', { wall: WL.PSTONE });
it('brick_wall', 'Brick Wall', 'wall', 3, '#4a4e58', 'wall', { wall: WL.PBRICK });

const MATS: [string, string, number, string, string][] = [
  ['gel', 'Gel', 10, '#5ac8ff', 'gel'], ['lens', 'Lens', 80, '#d0d8ff', 'lens'], ['bone', 'Bone', 30, '#e8e4d0', 'bone'],
  ['fallen_star', 'Fallen Star', 100, '#ffe060', 'star'], ['soul_shard', 'Soul Shard', 500, '#c8a0ff', 'shard'],
  ['worm_core', 'Mechanical Core', 3000, '#ff5050', 'core'], ['bottle', 'Bottle', 20, '#bfe8f5', 'bottle'],
  ['daybloom', 'Daybloom', 30, '#ffd23a', 'herb'], ['shiverthorn', 'Shiverthorn', 40, '#6ac0ff', 'herb'],
  ['fireblossom', 'Fireblossom', 60, '#ff6a2a', 'herb'], ['glowshroom', 'Glowing Mushroom', 40, '#5ae0ff', 'shroom'],
  ['copper_ore', 'Copper Ore', 30, '#e8843a', 'ore'], ['iron_ore', 'Iron Ore', 60, '#d8c0a8', 'ore'], ['gold_ore', 'Gold Ore', 120, '#ffd84a', 'ore'],
  ['shadow_ore', 'Shadowite Ore', 250, '#a070f0', 'ore'], ['hellstone', 'Hellstone', 300, '#ff6a30', 'ore'],
  ['cobalt_ore', 'Cobalt Ore', 600, '#3a7cf0', 'ore'], ['adamant_ore', 'Adamant Ore', 1000, '#f0506e', 'ore'],
  ['copper_bar', 'Copper Bar', 90, '#e8843a', 'bar'], ['iron_bar', 'Iron Bar', 180, '#d8d0c8', 'bar'], ['gold_bar', 'Gold Bar', 480, '#ffd84a', 'bar'],
  ['shadow_bar', 'Shadowite Bar', 1000, '#8a5ad8', 'bar'], ['hell_bar', 'Hellstone Bar', 1200, '#ff6a30', 'bar'],
  ['cobalt_bar', 'Cobalt Bar', 2400, '#3a7cf0', 'bar'], ['adamant_bar', 'Adamant Bar', 4000, '#f0506e', 'bar'],
];
for (const [id, n, v, c, ic] of MATS) it(id, n, 'mat', v, c, ic);

export interface Tier { k: string; n: string; bar: string; col: string; pick: number; dmg: number; use: number; def: number[]; st: string; set: any; cnt: number[]; }
export const TIERS: Tier[] = [
  { k: 'copper', n: 'Copper', bar: 'copper_bar', col: '#e8843a', pick: 35, dmg: 9, use: 0.4, def: [1, 2, 1], st: 'anvil', set: { def: 1 }, cnt: [8, 7, 6, 10, 8] },
  { k: 'iron', n: 'Iron', bar: 'iron_bar', col: '#d8d0c8', pick: 45, dmg: 12, use: 0.38, def: [2, 3, 2], st: 'anvil', set: { def: 2 }, cnt: [10, 8, 8, 12, 10] },
  { k: 'gold', n: 'Gold', bar: 'gold_bar', col: '#ffd84a', pick: 55, dmg: 15, use: 0.36, def: [3, 4, 3], st: 'anvil', set: { def: 2, crit: 4 }, cnt: [10, 8, 8, 12, 10] },
  { k: 'shadow', n: 'Shadow', bar: 'shadow_bar', col: '#8a5ad8', pick: 65, dmg: 19, use: 0.34, def: [4, 5, 4], st: 'anvil', set: { speed: 0.1, mine: 0.15 }, cnt: [10, 8, 8, 14, 10] },
  { k: 'molten', n: 'Molten', bar: 'hell_bar', col: '#ff6a30', pick: 100, dmg: 26, use: 0.33, def: [5, 7, 5], st: 'forge', set: { lava: true, dmg: 0.1 }, cnt: [10, 8, 8, 14, 10] },
  { k: 'cobalt', n: 'Cobalt', bar: 'cobalt_bar', col: '#3a7cf0', pick: 110, dmg: 38, use: 0.31, def: [7, 9, 6], st: 'arcane', set: { crit: 10, speed: 0.1 }, cnt: [10, 8, 8, 14, 10] },
  { k: 'adamant', n: 'Adamant', bar: 'adamant_bar', col: '#f0506e', pick: 130, dmg: 55, use: 0.28, def: [9, 12, 8], st: 'arcane', set: { dmg: 0.2, def: 3 }, cnt: [10, 8, 8, 16, 12] },
];
export const SET_DESC: Record<string, string> = {};
export const RECIPES: Recipe[] = [];
export interface Recipe { out: string; n: number; st: string; ing: [string, number][]; }
const rc = (out: string, n: number, st: string, ...ing: [string, number][]) => RECIPES.push({ out, n, st, ing });

TIERS.forEach((t, i) => {
  const bv = ITEMS[t.bar].value;
  it(`${t.k}_pick`, `${t.n} Pickaxe`, 'pick', bv * t.cnt[0], t.col, 'pick', { power: t.pick, tier: i } as any);
  it(`${t.k}_sword`, `${t.n} Broadsword`, 'sword', bv * t.cnt[1], t.col, 'sword', { dmg: t.dmg, use: t.use, kb: 4 + i * 0.5, reach: 34 });
  it(`${t.k}_head`, `${t.n} Helmet`, 'head', bv * t.cnt[2], t.col, 'head', { def: t.def[0], set: t.k });
  it(`${t.k}_body`, `${t.n} Breastplate`, 'body', bv * t.cnt[3], t.col, 'body', { def: t.def[1], set: t.k });
  it(`${t.k}_legs`, `${t.n} Greaves`, 'legs', bv * t.cnt[4], t.col, 'legs', { def: t.def[2], set: t.k });
  const parts: string[] = [];
  const s = t.set; if (s.def) parts.push(`+${s.def} defense`); if (s.crit) parts.push(`+${s.crit}% crit`); if (s.speed) parts.push(`+${Math.round(s.speed * 100)}% move speed`);
  if (s.mine) parts.push(`+${Math.round(s.mine * 100)}% mining speed`); if (s.lava) parts.push('lava immunity'); if (s.dmg) parts.push(`+${Math.round(s.dmg * 100)}% damage`);
  SET_DESC[t.k] = `${t.n} set bonus: ${parts.join(', ')}`;
  const wood: [string, number][] = i < 2 ? [['wood', 4]] : [];
  rc(`${t.k}_pick`, 1, t.st, [t.bar, t.cnt[0]], ...wood);
  rc(`${t.k}_sword`, 1, t.st, [t.bar, t.cnt[1]]);
  rc(`${t.k}_head`, 1, t.st, [t.bar, t.cnt[2]]);
  rc(`${t.k}_body`, 1, t.st, [t.bar, t.cnt[3]]);
  rc(`${t.k}_legs`, 1, t.st, [t.bar, t.cnt[4]]);
});

// weapons
it('wood_bow', 'Wooden Bow', 'bow', 80, '#b27a43', 'bow', { dmg: 6, use: 0.5, ammo: 'arrow', speed: 520 });
it('gold_bow', 'Gold Bow', 'bow', 1500, '#ffd84a', 'bow', { dmg: 13, use: 0.4, ammo: 'arrow', speed: 560 });
it('molten_fury', 'Molten Fury', 'bow', 4000, '#ff6a30', 'bow', { dmg: 25, use: 0.36, ammo: 'arrow', speed: 600, fx: 'fire', desc: 'Turns wooden arrows into flaming arrows' });
it('adamant_repeater', 'Adamant Repeater', 'bow', 9000, '#f0506e', 'bow', { dmg: 42, use: 0.19, ammo: 'arrow', speed: 700, auto: true });
it('musket', 'Musket', 'gun', 900, '#8a8a95', 'gun', { dmg: 17, use: 0.65, ammo: 'bullet', speed: 820 });
it('boomstick', 'Boomstick', 'gun', 2500, '#b27a43', 'gun', { dmg: 11, use: 0.62, ammo: 'bullet', speed: 700, pellets: 4, desc: 'Fires a spread of pellets' });
it('megashark', 'Megashark', 'gun', 15000, '#5a6ad0', 'gun', { dmg: 26, use: 0.09, ammo: 'bullet', speed: 900, auto: true, desc: '66% chance not to consume ammo' });
it('wand_sparks', 'Wand of Sparks', 'staff', 600, '#ffcc40', 'staff', { dmg: 11, mana: 3, use: 0.33, proj: 'spark', speed: 480 });
it('flower_fire', 'Flower of Fire', 'staff', 5000, '#ff7a30', 'staff', { dmg: 26, mana: 8, use: 0.38, proj: 'fireball', speed: 420 });
it('book_skulls', 'Book of Skulls', 'staff', 8000, '#e8e4d0', 'book', { dmg: 32, mana: 9, use: 0.42, proj: 'skull', speed: 380 });
it('rainbow_rod', 'Rainbow Rod', 'staff', 18000, '#ff80ff', 'staff', { dmg: 64, mana: 12, use: 0.3, proj: 'rainbow', speed: 520 });
it('ice_blade', 'Ice Blade', 'sword', 2000, '#9fe0ff', 'sword', { dmg: 21, use: 0.36, kb: 4, reach: 34, proj: 'frost', speed: 460, desc: 'Fires an icy bolt' });
it('starfury', 'Starfury', 'sword', 2500, '#ffe060', 'sword', { dmg: 24, use: 0.34, kb: 4, reach: 34, proj: 'starcall', desc: 'Rains stars from the sky' });
it('breaker_blade', 'Breaker Blade', 'sword', 12000, '#c0c8ff', 'sword', { dmg: 78, use: 0.46, kb: 8, reach: 56 });
it('bomb', 'Bomb', 'throw', 60, '#444', 'bomb', { dmg: 75, use: 0.5, desc: 'Explodes, destroying blocks and enemies' });
it('grappling_hook', 'Grappling Hook', 'tool', 1200, '#cfcfd8', 'hook', { desc: 'Hook onto blocks and reel in' });
it('magic_mirror', 'Magic Mirror', 'tool', 3000, '#9fd3ff', 'mirror', { desc: 'Gaze to return home' });
it('wooden_arrow', 'Wooden Arrow', 'ammo', 4, '#b27a43', 'arrow', { dmg: 4, ammoType: 'arrow' });
it('flaming_arrow', 'Flaming Arrow', 'ammo', 8, '#ff9a30', 'arrow', { dmg: 8, ammoType: 'arrow', fx: 'fire' });
it('musket_ball', 'Musket Ball', 'ammo', 6, '#c8c8d0', 'bullet', { dmg: 7, ammoType: 'bullet' });

// potions
it('lesser_heal', 'Lesser Healing Potion', 'potion', 80, '#ff5a6a', 'potion', { heal: 60 });
it('heal', 'Healing Potion', 'potion', 300, '#ff3040', 'potion', { heal: 130 });
it('lesser_mana', 'Lesser Mana Potion', 'potion', 60, '#4a7aff', 'potion', { healMana: 80 });
it('mana_potion', 'Mana Potion', 'potion', 200, '#3a5aff', 'potion', { healMana: 170 });
it('ironskin', 'Ironskin Potion', 'potion', 120, '#c8c8d0', 'potion', { buff: 'ironskin', dur: 300 });
it('regen_potion', 'Regeneration Potion', 'potion', 120, '#ff7a9a', 'potion', { buff: 'regen', dur: 300 });
it('swift_potion', 'Swiftness Potion', 'potion', 120, '#7aff9a', 'potion', { buff: 'swift', dur: 300 });
it('mining_potion', 'Mining Potion', 'potion', 160, '#ffd070', 'potion', { buff: 'mining', dur: 300 });
it('owl_potion', 'Night Owl Potion', 'potion', 160, '#b0e8ff', 'potion', { buff: 'owl', dur: 420 });
it('obsidian_potion', 'Obsidian Skin Potion', 'potion', 250, '#7a4ac8', 'potion', { buff: 'obsidian', dur: 240 });
it('wrath_potion', 'Wrath Potion', 'potion', 250, '#ff5030', 'potion', { buff: 'wrath', dur: 300 });
export const BUFFS: Record<string, { name: string; desc: string; col: string; bad?: boolean }> = {
  ironskin: { name: 'Ironskin', desc: '+8 defense', col: '#c8c8d0' }, regen: { name: 'Regeneration', desc: 'Faster life regen', col: '#ff7a9a' },
  swift: { name: 'Swiftness', desc: '+25% move speed', col: '#7aff9a' }, mining: { name: 'Mining', desc: '+30% mining speed', col: '#ffd070' },
  owl: { name: 'Night Owl', desc: 'Improved vision in darkness', col: '#b0e8ff' }, obsidian: { name: 'Obsidian Skin', desc: 'Immune to lava', col: '#7a4ac8' },
  wrath: { name: 'Wrath', desc: '+12% damage', col: '#ff5030' }, sick: { name: 'Potion Sickness', desc: 'Cannot drink healing potions', col: '#8a6a4a', bad: true },
};

// consumables, summons
it('life_crystal', 'Life Crystal', 'use', 500, '#ff5a9a', 'crystal', { fx: 'life', desc: 'Permanently +20 max life' });
it('mana_crystal', 'Mana Crystal', 'use', 500, '#5a8aff', 'mcrystal', { fx: 'mana', desc: 'Permanently +20 max mana' });
it('purify_powder', 'Purification Powder', 'throw', 60, '#a0ffb0', 'powder', { fx: 'purify', desc: 'Cleanses Blight in an area' });
it('suspicious_eye', 'Suspicious Looking Eye', 'summon', 200, '#d0d8ff', 'lens', { boss: 'eoc', desc: 'Summons the Eye of Cthulhu. Use at night.' });
it('cursed_skull', 'Cursed Skull', 'summon', 500, '#e8e4d0', 'skull', { boss: 'bone_lord', desc: 'Summons the Bone Lord.' });
it('voodoo_doll', 'Fleshy Voodoo Doll', 'summon', 800, '#d85a6a', 'doll', { boss: 'flesh_wall', desc: 'Summons the Wall of Flesh. Use in the Underworld.' });
it('mech_worm', 'Mechanical Worm', 'summon', 2000, '#9aa0b8', 'worm', { boss: 'mech_worm', desc: 'Summons the Destroyer worm. Use at night.' });
it('celestial_sigil', 'Celestial Sigil', 'summon', 5000, '#6affff', 'sigil', { boss: 'lunar', desc: 'Summons the Lunar Colossus — the final challenge.' });
it('goblin_standard', 'Goblin Battle Standard', 'summon', 800, '#6a9a4a', 'flag', { boss: 'goblin', desc: 'Calls a Goblin Army to your world.' });

// accessories
it('hermes', 'Hermes Boots', 'acc', 1500, '#d85a3a', 'boots', { fx: 'hermes', desc: '+35% movement speed' });
it('cloud_bottle', 'Cloud in a Bottle', 'acc', 1500, '#bfe8ff', 'cloud', { fx: 'cloud', desc: 'Allows double jump' });
it('horseshoe', 'Lucky Horseshoe', 'acc', 1500, '#c8e8ff', 'shoe', { fx: 'horseshoe', desc: 'Negates fall damage' });
it('regen_band', 'Band of Regeneration', 'acc', 1500, '#ff7a9a', 'ring', { fx: 'regen', desc: 'Slowly regenerate life' });
it('claws', 'Feral Claws', 'acc', 1500, '#e8e4d0', 'claws', { fx: 'claws', desc: '+15% melee speed' });
it('cthulhu_shield', 'Shield of Cthulhu', 'acc', 4000, '#b0a090', 'shield', { fx: 'shield', desc: '+4 defense, immune to knockback' });
it('wings', 'Angel Wings', 'acc', 8000, '#ffffff', 'wings', { fx: 'wings', desc: 'Grants flight — hold Jump in the air' });
it('emblem', 'Warrior Emblem', 'acc', 5000, '#ffa030', 'emblem', { fx: 'emblem', desc: '+12% damage' });

// ===== Recipes (non-tier) =====
rc('workbench', 1, 'hand', ['wood', 10]);
rc('torch', 3, 'hand', ['wood', 1], ['gel', 1]);
rc('platform', 2, 'hand', ['wood', 1]);
rc('wood_wall', 4, 'hand', ['wood', 1]);
rc('stone_wall', 4, 'hand', ['stone', 1]);
rc('brick_wall', 4, 'bench', ['brick', 1]);
rc('wooden_arrow', 8, 'hand', ['wood', 1]);
rc('chair', 1, 'bench', ['wood', 4]);
rc('table', 1, 'bench', ['wood', 8]);
rc('door', 1, 'bench', ['wood', 6]);
rc('bed', 1, 'bench', ['wood', 15], ['gel', 6]);
rc('chest', 1, 'bench', ['wood', 8], ['iron_bar', 2]);
rc('wood_bow', 1, 'bench', ['wood', 8]);
rc('brick', 1, 'bench', ['stone', 2]);
rc('furnace', 1, 'bench', ['stone', 20], ['wood', 4], ['torch', 3]);
rc('anvil', 1, 'bench', ['iron_bar', 5]);
rc('glass', 1, 'furnace', ['sand', 2]);
rc('bottle', 2, 'bench', ['glass', 1]);
rc('copper_bar', 1, 'furnace', ['copper_ore', 3]);
rc('iron_bar', 1, 'furnace', ['iron_ore', 3]);
rc('gold_bar', 1, 'furnace', ['gold_ore', 4]);
rc('shadow_bar', 1, 'furnace', ['shadow_ore', 4]);
rc('cobalt_bar', 1, 'furnace', ['cobalt_ore', 3]);
rc('hell_bar', 1, 'forge', ['hellstone', 3]);
rc('adamant_bar', 1, 'forge', ['adamant_ore', 4]);
rc('hellforge', 1, 'furnace', ['hellstone', 20], ['stone', 10]);
rc('arcane_anvil', 1, 'anvil', ['cobalt_bar', 10], ['soul_shard', 5]);
rc('mana_crystal', 1, 'hand', ['fallen_star', 5]);
rc('bomb', 3, 'bench', ['gel', 3], ['iron_bar', 1]);
rc('grappling_hook', 1, 'anvil', ['iron_bar', 6], ['wood', 4]);
rc('magic_mirror', 1, 'anvil', ['gold_bar', 6], ['glass', 6]);
rc('purify_powder', 3, 'bench', ['daybloom', 1], ['sand', 3]);
rc('flaming_arrow', 5, 'bench', ['wooden_arrow', 5], ['torch', 1]);
rc('musket_ball', 20, 'bench', ['iron_bar', 1]);
rc('musket', 1, 'anvil', ['iron_bar', 12], ['wood', 8]);
rc('gold_bow', 1, 'anvil', ['gold_bar', 9]);
rc('wand_sparks', 1, 'anvil', ['gold_bar', 6], ['fallen_star', 2]);
rc('megashark', 1, 'arcane', ['adamant_bar', 16], ['soul_shard', 10], ['musket', 1]);
rc('adamant_repeater', 1, 'arcane', ['adamant_bar', 14], ['soul_shard', 4]);
rc('rainbow_rod', 1, 'arcane', ['adamant_bar', 12], ['soul_shard', 8], ['fallen_star', 8]);
rc('hermes', 1, 'anvil', ['gold_bar', 8], ['lens', 6]);
rc('cloud_bottle', 1, 'bench', ['bottle', 1], ['fallen_star', 4], ['glass', 6]);
rc('regen_band', 1, 'anvil', ['gold_bar', 6], ['glowshroom', 6], ['life_crystal', 1]);
rc('claws', 1, 'anvil', ['iron_bar', 8], ['bone', 12]);
rc('emblem', 1, 'arcane', ['soul_shard', 8], ['adamant_bar', 6]);
rc('lesser_heal', 1, 'bench', ['bottle', 1], ['gel', 2], ['daybloom', 1]);
rc('heal', 1, 'bench', ['bottle', 1], ['glowshroom', 2], ['daybloom', 2]);
rc('lesser_mana', 1, 'bench', ['bottle', 1], ['fallen_star', 1], ['daybloom', 1]);
rc('mana_potion', 1, 'bench', ['bottle', 1], ['fallen_star', 2], ['glowshroom', 1]);
rc('ironskin', 1, 'bench', ['bottle', 1], ['iron_ore', 1], ['daybloom', 1]);
rc('regen_potion', 1, 'bench', ['bottle', 1], ['daybloom', 2], ['gel', 2]);
rc('swift_potion', 1, 'bench', ['bottle', 1], ['shiverthorn', 1], ['daybloom', 1]);
rc('mining_potion', 1, 'bench', ['bottle', 1], ['glowshroom', 1], ['iron_bar', 1]);
rc('owl_potion', 1, 'bench', ['bottle', 1], ['glowshroom', 2], ['torch', 1]);
rc('obsidian_potion', 1, 'bench', ['bottle', 1], ['fireblossom', 2], ['hellstone', 1]);
rc('wrath_potion', 1, 'bench', ['bottle', 1], ['fireblossom', 1], ['soul_shard', 1]);
rc('suspicious_eye', 1, 'bench', ['lens', 6]);
rc('cursed_skull', 1, 'anvil', ['bone', 20], ['shadow_bar', 4]);
rc('voodoo_doll', 1, 'forge', ['hell_bar', 6], ['bone', 8]);
rc('mech_worm', 1, 'arcane', ['soul_shard', 12], ['cobalt_bar', 10], ['lens', 5]);
rc('celestial_sigil', 1, 'arcane', ['soul_shard', 15], ['adamant_bar', 12], ['worm_core', 1]);
rc('goblin_standard', 1, 'anvil', ['shadow_bar', 6], ['wood', 10]);

export const STATION_NAMES: Record<string, string> = { hand: 'By hand', bench: 'Work Bench', furnace: 'Furnace', anvil: 'Iron Anvil', forge: 'Hellforge', arcane: 'Arcane Anvil' };

// ===== Enemies =====
export interface EnemyDef {
  id: string; name: string; w: number; h: number; hp: number; dmg: number; def: number; kb: number; ai: string; spd: number;
  accel?: number; jump?: number; draw: string; col: string; col2: string; coin: [number, number]; loot: [string, number, number, number][];
  hm?: boolean; shoot?: { proj: string; rate: number; spd: number; dmg: number; range: number }; light?: number; night?: boolean; bone?: boolean;
  boss?: boolean; summon?: string; bossLoot?: [string, number, number][]; goblin?: number; fire?: boolean;
}
export const ENEMIES: Record<string, EnemyDef> = {};
function en(id: string, name: string, o: Partial<EnemyDef>) {
  ENEMIES[id] = { id, name, w: 14, h: 20, hp: 20, dmg: 10, def: 0, kb: 0, ai: 'walk', spd: 60, jump: 0, draw: 'humanoid', col: '#6a6', col2: '#444', coin: [0, 0], loot: [], ...o } as EnemyDef;
}
const GEL: [string, number, number, number] = ['gel', 0.9, 1, 3];
en('slime', 'Green Slime', { w: 16, h: 12, hp: 14, dmg: 8, ai: 'slime', spd: 70, jump: 300, draw: 'slime', col: '#4adf5a', col2: '#2a9a38', coin: [20, 60], loot: [GEL] });
en('blue_slime', 'Blue Slime', { w: 16, h: 12, hp: 26, dmg: 11, ai: 'slime', spd: 75, jump: 310, draw: 'slime', col: '#4a8aff', col2: '#2a5ad0', coin: [40, 90], loot: [GEL] });
en('ice_slime', 'Ice Slime', { w: 16, h: 12, hp: 32, dmg: 13, ai: 'slime', spd: 75, jump: 310, draw: 'slime', col: '#a0e0ff', col2: '#60b0e0', coin: [50, 100], loot: [GEL] });
en('jungle_slime', 'Jungle Slime', { w: 18, h: 14, hp: 48, dmg: 17, def: 2, ai: 'slime', spd: 85, jump: 340, draw: 'slime', col: '#8ad058', col2: '#4a9a30', coin: [80, 160], loot: [GEL] });
en('corrupt_slime', 'Blight Slime', { w: 18, h: 14, hp: 54, dmg: 19, def: 3, ai: 'slime', spd: 85, jump: 340, draw: 'slime', col: '#a060e0', col2: '#6a30a0', coin: [90, 170], loot: [GEL] });
en('lava_slime', 'Lava Slime', { w: 18, h: 14, hp: 64, dmg: 28, def: 4, ai: 'slime', spd: 90, jump: 340, draw: 'slime', col: '#ff7a2a', col2: '#d03a10', coin: [120, 220], loot: [GEL], light: 0.8, fire: true });
en('zombie', 'Zombie', { w: 12, h: 26, hp: 46, dmg: 15, def: 4, ai: 'walk', spd: 52, jump: 360, draw: 'humanoid', col: '#7aa86a', col2: '#4a5a8a', coin: [60, 140], night: true });
en('frozen_zombie', 'Frozen Zombie', { w: 12, h: 26, hp: 62, dmg: 17, def: 6, ai: 'walk', spd: 55, jump: 360, draw: 'humanoid', col: '#a8d8e8', col2: '#6a8aa8', coin: [80, 150], night: true });
en('demon_eye', 'Demon Eye', { w: 20, h: 16, hp: 56, dmg: 19, def: 2, ai: 'fly', spd: 85, accel: 160, draw: 'eye', col: '#f0f0f0', col2: '#3a6aff', coin: [70, 150], loot: [['lens', 0.33, 1, 1]], night: true });
en('servant', 'Servant of Cthulhu', { w: 10, h: 10, hp: 9, dmg: 13, ai: 'fly', spd: 150, accel: 320, draw: 'eye', col: '#f0d0d0', col2: '#d03030' });
en('skeleton', 'Skeleton', { w: 12, h: 26, hp: 66, dmg: 22, def: 6, ai: 'walk', spd: 56, jump: 380, draw: 'humanoid', col: '#e8e4d0', col2: '#c8c0a0', bone: true, coin: [100, 220], loot: [['bone', 0.5, 1, 2]] });
en('skel_archer', 'Skeleton Archer', { w: 12, h: 26, hp: 58, dmg: 18, def: 4, ai: 'archer', spd: 45, jump: 380, draw: 'humanoid', col: '#e8e4d0', col2: '#a08a60', bone: true, coin: [120, 240], loot: [['bone', 0.5, 1, 2]], shoot: { proj: 'arrow', rate: 2, spd: 380, dmg: 20, range: 260 } });
en('cave_bat', 'Cave Bat', { w: 14, h: 10, hp: 16, dmg: 13, ai: 'bat', spd: 130, accel: 400, draw: 'bat', col: '#6a5a7a', col2: '#3a2a4a', coin: [30, 70] });
en('ice_bat', 'Ice Bat', { w: 14, h: 10, hp: 24, dmg: 16, ai: 'bat', spd: 135, accel: 400, draw: 'bat', col: '#a0d8f0', col2: '#60a0d0', coin: [40, 90] });
en('vulture', 'Vulture', { w: 22, h: 16, hp: 46, dmg: 20, def: 2, ai: 'fly', spd: 115, accel: 200, draw: 'bird', col: '#a08a6a', col2: '#6a5a3a', coin: [90, 180] });
en('sand_scarab', 'Sand Scarab', { w: 16, h: 12, hp: 54, dmg: 19, def: 8, ai: 'walk', spd: 72, jump: 330, draw: 'bug', col: '#c8a850', col2: '#8a6a20', coin: [90, 180] });
en('hornet', 'Hornet', { w: 18, h: 16, hp: 60, dmg: 22, ai: 'flyshoot', spd: 95, accel: 220, draw: 'bug', col: '#e8c030', col2: '#6a3a10', coin: [150, 280], shoot: { proj: 'stinger', rate: 2.4, spd: 300, dmg: 20, range: 260 } });
en('eater_souls', 'Eater of Souls', { w: 22, h: 18, hp: 44, dmg: 23, def: 8, ai: 'fly', spd: 105, accel: 220, draw: 'souls', col: '#8a58b8', col2: '#4a2878', coin: [100, 200] });
en('fire_imp', 'Fire Imp', { w: 14, h: 24, hp: 50, dmg: 28, def: 6, ai: 'imp', spd: 70, accel: 200, draw: 'imp', col: '#d8402a', col2: '#ffb030', light: 0.6, coin: [200, 380], fire: true, shoot: { proj: 'fireball', rate: 2.2, spd: 260, dmg: 30, range: 300 } });
en('hell_bat', 'Hell Bat', { w: 14, h: 10, hp: 36, dmg: 32, ai: 'bat', spd: 165, accel: 450, draw: 'bat', col: '#d8502a', col2: '#802010', light: 0.5, coin: [120, 240], fire: true });
en('demon', 'Demon', { w: 26, h: 22, hp: 125, dmg: 40, def: 8, ai: 'flyshoot', spd: 80, accel: 180, draw: 'demon', col: '#a02a3a', col2: '#501020', coin: [400, 800], shoot: { proj: 'scythe', rate: 2.5, spd: 280, dmg: 38, range: 320 }, loot: [['fireblossom', 0.2, 1, 2]] });
en('wraith', 'Wraith', { w: 18, h: 28, hp: 175, dmg: 54, def: 10, ai: 'ghost', spd: 100, accel: 160, draw: 'ghost', col: '#c8d8ff', col2: '#8090d0', light: 0.3, hm: true, coin: [500, 900], loot: [['soul_shard', 0.25, 1, 1]] });
en('armored_skeleton', 'Armored Skeleton', { w: 12, h: 26, hp: 270, dmg: 60, def: 20, ai: 'walk', spd: 62, jump: 380, draw: 'humanoid', col: '#b8c0d0', col2: '#6a7080', bone: true, hm: true, coin: [500, 900], loot: [['soul_shard', 0.22, 1, 1], ['bone', 0.5, 1, 3]] });
en('cursed_skull', 'Cursed Skull', { w: 16, h: 16, hp: 145, dmg: 52, def: 12, ai: 'flyshoot', spd: 120, accel: 200, draw: 'skull', col: '#e8e0c8', col2: '#40ff90', hm: true, coin: [450, 800], light: 0.4, shoot: { proj: 'bolt', rate: 3, spd: 280, dmg: 44, range: 280 }, loot: [['soul_shard', 0.22, 1, 1]] });
en('goblin_peon', 'Goblin Peon', { w: 12, h: 22, hp: 62, dmg: 17, def: 3, ai: 'walk', spd: 62, jump: 380, draw: 'humanoid', col: '#6a9a4a', col2: '#7a4a2a', coin: [120, 260], goblin: 1 });
en('goblin_thief', 'Goblin Thief', { w: 12, h: 22, hp: 52, dmg: 27, def: 2, ai: 'walk', spd: 108, jump: 400, draw: 'humanoid', col: '#6a9a4a', col2: '#4a3a5a', coin: [140, 300], goblin: 1 });
en('goblin_warrior', 'Goblin Warrior', { w: 14, h: 24, hp: 115, dmg: 27, def: 9, ai: 'walk', spd: 55, jump: 380, draw: 'humanoid', col: '#5a8a3a', col2: '#8a8a98', coin: [200, 380], goblin: 2 });
en('goblin_archer', 'Goblin Archer', { w: 12, h: 22, hp: 64, dmg: 20, ai: 'archer', spd: 50, jump: 380, draw: 'humanoid', col: '#6a9a4a', col2: '#8a5a2a', coin: [180, 340], goblin: 1, shoot: { proj: 'arrow', rate: 1.8, spd: 380, dmg: 22, range: 280 } });
en('goblin_sorc', 'Goblin Sorcerer', { w: 12, h: 22, hp: 44, dmg: 18, ai: 'imp', spd: 60, accel: 160, draw: 'imp', col: '#5a8a3a', col2: '#a050e0', coin: [220, 420], goblin: 2, shoot: { proj: 'chaos', rate: 2.6, spd: 240, dmg: 24, range: 280 } });
en('hungry', 'The Hungry', { w: 14, h: 14, hp: 26, dmg: 36, ai: 'fly', spd: 175, accel: 420, draw: 'souls', col: '#d85a6a', col2: '#802030' });
en('true_eye', 'True Eye', { w: 24, h: 24, hp: 95, dmg: 48, def: 6, ai: 'flyshoot', spd: 115, accel: 200, draw: 'eye', col: '#e8f8ff', col2: '#30e0ff', light: 0.5, shoot: { proj: 'phantom', rate: 3, spd: 220, dmg: 40, range: 340 } });

// bosses
function boss(id: string, name: string, o: Partial<EnemyDef>) {
  en(id, name, { boss: true, ai: 'boss', kb: 1, ...o });
}
boss('eoc', 'Eye of Cthulhu', { w: 56, h: 56, hp: 2200, dmg: 30, def: 6, coin: [40000, 40000], summon: 'suspicious_eye', col: '#f0e8e8', col2: '#3070e0', bossLoot: [['cthulhu_shield', 1, 1], ['shadow_bar', 12, 20], ['lens', 4, 8], ['lesser_heal', 3, 5]] });
boss('bone_lord', 'Bone Lord', { w: 44, h: 44, hp: 3600, dmg: 34, def: 10, coin: [80000, 80000], summon: 'cursed_skull', col: '#e8e4d0', col2: '#40ff90', bossLoot: [['book_skulls', 1, 1], ['gold_bar', 10, 16], ['heal', 3, 5], ['bone', 10, 20]] });
boss('flesh_wall', 'Wall of Flesh', { w: 44, h: 340, hp: 6500, dmg: 90, def: 12, coin: [150000, 150000], summon: 'voodoo_doll', col: '#d85a6a', col2: '#802030', bossLoot: [['wings', 1, 1], ['breaker_blade', 1, 1], ['heal', 5, 8], ['soul_shard', 4, 8]] });
boss('mech_worm', 'The Destroyer', { w: 26, h: 26, hp: 9500, dmg: 70, def: 18, coin: [250000, 250000], summon: 'mech_worm', col: '#9aa0b8', col2: '#ff3040', bossLoot: [['worm_core', 1, 1], ['soul_shard', 12, 18], ['adamant_bar', 4, 6], ['heal', 5, 8]] });
boss('lunar', 'Lunar Colossus', { w: 84, h: 84, hp: 14000, dmg: 75, def: 20, coin: [500000, 500000], summon: 'celestial_sigil', col: '#bfe8ff', col2: '#30e0ff', bossLoot: [['soul_shard', 10, 20]] });

// ===== NPCs =====
export interface NpcDef { id: string; name: string; col: string; hair: string; like: number; dislike: number; likeN: string; dislikeN: string; need: string; intro: string; shop: { id: string; n?: number; flag?: string }[]; lines: string[]; }
export const NPCS: Record<string, NpcDef> = {
  guide: { id: 'guide', name: 'Guide', col: '#4a7acb', hair: '#6a4a2a', like: B.FOREST, dislike: B.DESERT, likeN: 'merchant', dislikeN: 'arms_dealer', need: 'Always present', intro: 'I know a thing or two about this world. Ask me what to do next!', shop: [],
    lines: ['Dig down, find ore, and smelt it at a Furnace. Better tools mean deeper mining.', 'Zombies come at night — a house with walls, a door, a table, a chair and a torch keeps folks safe.', 'Smash Life Crystals underground to grow your health. Fallen stars become Mana Crystals.', 'Boss summons are crafted from monster parts. Prepare before you use them!'] },
  merchant: { id: 'merchant', name: 'Merchant', col: '#c89a4a', hair: '#d8d8d8', like: B.FOREST, dislike: B.JUNGLE, likeN: 'nurse', dislikeN: 'demolitionist', need: 'Carry 25 silver or more', intro: 'Take a look at my wares, friend. Coin spends the same everywhere.',
    shop: [{ id: 'torch', n: 5 }, { id: 'bottle', n: 3 }, { id: 'wooden_arrow', n: 20 }, { id: 'lesser_heal' }, { id: 'lesser_mana' }, { id: 'ironskin' }, { id: 'magic_mirror', flag: 'eoc' }, { id: 'grappling_hook', flag: 'eoc' }, { id: 'platform', n: 10 }],
    lines: ['Prices are fair. Mostly.', 'Bring me coin and I will bring you comfort.', 'A good torch is worth its weight in copper.'] },
  nurse: { id: 'nurse', name: 'Nurse', col: '#f0a0b8', hair: '#e8c040', like: B.TUNDRA, dislike: B.BLIGHT, likeN: 'wizard', dislikeN: 'merchant', need: 'Have more than 100 max life', intro: 'You look hurt. For a modest fee I can patch you right up.',
    shop: [{ id: 'lesser_heal' }, { id: 'heal', flag: 'skel' }, { id: 'regen_potion' }, { id: 'mana_potion', flag: 'hm' }],
    lines: ['Keep your health up. Heroes live longer that way.', 'Healing is cheaper the less damaged you are.'] },
  arms_dealer: { id: 'arms_dealer', name: 'Arms Dealer', col: '#6a6a74', hair: '#3a2a2a', like: B.DESERT, dislike: B.TUNDRA, likeN: 'nurse', dislikeN: 'dryad', need: 'Own any bow, gun, or ammunition', intro: 'Ammo, ammo, and more ammo. What do you need?',
    shop: [{ id: 'musket_ball', n: 20 }, { id: 'wooden_arrow', n: 20 }, { id: 'flaming_arrow', n: 20, flag: 'eoc' }, { id: 'musket', flag: 'eoc' }, { id: 'boomstick', flag: 'skel' }, { id: 'wood_bow' }],
    lines: ['Ranged is best. Distance is life.', 'Stock up before the Goblins arrive.'] },
  demolitionist: { id: 'demolitionist', name: 'Demolitionist', col: '#d86a2a', hair: '#8a3a1a', like: B.JUNGLE, dislike: B.TUNDRA, likeN: 'arms_dealer', dislikeN: 'guide', need: 'Own a Bomb', intro: 'Boom! I mean, hello. Care for some explosives?',
    shop: [{ id: 'bomb', n: 3 }, { id: 'torch', n: 5 }, { id: 'obsidian_potion', flag: 'skel' }],
    lines: ['Never light a fuse indoors. Unless it is funny.', 'Bombs make short work of rock — and of enemies.'] },
  dryad: { id: 'dryad', name: 'Dryad', col: '#58b848', hair: '#c8e870', like: B.JUNGLE, dislike: B.DESERT, likeN: 'wizard', dislikeN: 'merchant', need: 'Defeat the Eye of Cthulhu', intro: 'The Blight spreads. I can sell you purifying powders to hold it back.',
    shop: [{ id: 'purify_powder', n: 3 }, { id: 'acorn', n: 3 }, { id: 'daybloom' }, { id: 'shiverthorn' }, { id: 'glowshroom' }, { id: 'fireblossom', flag: 'skel' }],
    lines: ['The Blight spreads faster after the Wall falls. Keep it in check.', 'Plant acorns on grass and a tree will grow.'] },
  wizard: { id: 'wizard', name: 'Wizard', col: '#7a4ad8', hair: '#e8e8f0', like: B.FOREST, dislike: B.JUNGLE, likeN: 'dryad', dislikeN: 'demolitionist', need: 'Hardmode — defeat the Wall of Flesh', intro: 'Ah, the world has changed. Arcane wares for sale!',
    shop: [{ id: 'mana_potion' }, { id: 'lesser_mana' }, { id: 'wand_sparks' }, { id: 'cloud_bottle' }, { id: 'magic_mirror' }, { id: 'owl_potion' }],
    lines: ['Magic is merely patience, wearing a hat.', 'Stars fall at night. Collect them.'] },
};

// ===== Difficulty, mods, perks =====
export const DIFFS = [
  { id: 'explorer', name: 'Explorer', desc: 'Relaxed. Enemies are weaker and you keep everything when you fall.', hp: 0.7, dmg: 0.6, spawn: 0.7, loot: 1.25, coinLoss: 0, respawn: 3, perma: false },
  { id: 'adventurer', name: 'Adventurer', desc: 'The intended experience. Death costs half your coins.', hp: 1, dmg: 1, spawn: 1, loot: 1, coinLoss: 0.5, respawn: 6, perma: false },
  { id: 'veteran', name: 'Veteran', desc: 'Tougher, faster foes and richer rewards. Death costs half your coins.', hp: 1.5, dmg: 1.7, spawn: 1.35, loot: 1.5, coinLoss: 0.5, respawn: 10, perma: false },
  { id: 'hardcore', name: 'Hardcore', desc: 'One life. Death deletes the world forever. Bonus Legacy Shards.', hp: 1.15, dmg: 1.25, spawn: 1.15, loot: 1.25, coinLoss: 0, respawn: 0, perma: true },
];
export const MODS = [
  { id: 'bloodthirst', name: 'Bloodthirsty', desc: 'Blood Moons and invasions occur twice as often. +25% coins from enemies.' },
  { id: 'scarce', name: 'Scarcity', desc: 'Fewer ores, crystals and chests are generated.' },
  { id: 'glass', name: 'Glass Cannon', desc: 'You deal +30% damage but have 25% less max life and take +25% damage.' },
];
export interface Perk { id: string; name: string; desc: string; max: number; cost: number[]; icon: string; }
export const PERKS: Perk[] = [
  { id: 'hardy', name: 'Hardy Soul', desc: '+20 starting max life per rank', max: 3, cost: [6, 12, 20], icon: '❤️' },
  { id: 'quick', name: 'Quick Hands', desc: '+10% mining speed per rank', max: 3, cost: [5, 10, 18], icon: '⛏️' },
  { id: 'fleet', name: 'Fleet Foot', desc: '+6% movement speed per rank', max: 3, cost: [5, 10, 18], icon: '👟' },
  { id: 'trader', name: "Trader's Eye", desc: '-6% shop prices and +12% coins per rank', max: 3, cost: [6, 12, 20], icon: '🪙' },
  { id: 'kit', name: "Prospector's Kit", desc: 'Rank 1: +25 torches & 8 bombs. Rank 2: + Iron Pickaxe. Rank 3: + Magic Mirror & Grappling Hook', max: 3, cost: [4, 10, 16], icon: '🎒' },
  { id: 'wind', name: 'Second Wind', desc: 'Survive a lethal blow once per world, per rank', max: 2, cost: [10, 24], icon: '💨' },
  { id: 'fortune', name: 'Fortune', desc: '+12% loot chance per rank (drops and chests)', max: 3, cost: [6, 12, 20], icon: '🍀' },
  { id: 'starry', name: 'Star-Touched', desc: '+50% more fallen stars per rank', max: 2, cost: [5, 12], icon: '⭐' },
];

export function fmtCoins(c: number): string {
  c = Math.max(0, Math.floor(c));
  const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cu = c % 100;
  const parts: string[] = [];
  if (g) parts.push(`${g}g`); if (s) parts.push(`${s}s`); if (cu || !parts.length) parts.push(`${cu}c`);
  return parts.join(' ');
}
export function itemDesc(id: string): string {
  const d = ITEMS[id]; if (!d) return '';
  const l: string[] = [];
  if (d.kind === 'sword') l.push(`${d.dmg} melee damage`);
  if (d.kind === 'bow' || d.kind === 'gun') l.push(`${d.dmg} ranged damage (+ammo)`);
  if (d.kind === 'staff') l.push(`${d.dmg} magic damage · ${d.mana} mana`);
  if (d.kind === 'pick') l.push(`${d.power}% pickaxe power`);
  if (d.kind === 'ammo') l.push(`${d.dmg} damage`);
  if (d.kind === 'throw' && d.dmg) l.push(`${d.dmg} explosive damage`);
  if (d.def !== undefined && ['head', 'body', 'legs'].includes(d.kind)) l.push(`${d.def} defense`);
  if (d.set) l.push(SET_DESC[d.set] || '');
  if (d.heal) l.push(`Restores ${d.heal} life`);
  if (d.healMana) l.push(`Restores ${d.healMana} mana`);
  if (d.buff) l.push(BUFFS[d.buff].desc);
  if (d.desc) l.push(d.desc);
  if (d.kind === 'block' && d.tile !== undefined && TILES[d.tile]) l.push('Placeable');
  return l.filter(Boolean).join('\n');
}

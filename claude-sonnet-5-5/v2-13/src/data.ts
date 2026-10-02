export const GW = 16;
export const GH = 10;
export const ENTRANCE = { x: 0, y: 5 };
export const HEART = { x: 15, y: 5 };
export const MAX_WAVES = 12;

export type StructKind =
  | 'spike' | 'dart' | 'flame' | 'curse' | 'door'
  | 'goblin' | 'skeleton' | 'slime' | 'imp' | 'golem' | 'wraith'
  | 'cache' | 'well' | 'altar';
export type Cat = 'trap' | 'lair' | 'econ';
export type MonsterType = 'goblin' | 'skeleton' | 'slime' | 'imp' | 'golem' | 'wraith';

export interface StructDef {
  id: StructKind;
  name: string;
  icon: string;
  cat: Cat;
  cost: number;
  mana: number;
  key: string;
  color: string;
  desc: string;
  unlock?: string;
}

export const STRUCTS: Record<StructKind, StructDef> = {
  spike: { id: 'spike', name: 'Spike Pit', icon: '📌', cat: 'trap', cost: 25, mana: 2, key: 'q', color: '#9aa3b5', desc: 'Impales whoever steps here. 22 dmg, 3.5s rearm. Costs 2 mana per trigger.' },
  dart: { id: 'dart', name: 'Dart Wall', icon: '🎯', cat: 'trap', cost: 35, mana: 2, key: 'w', color: '#7bd88f', desc: '11 dmg + poison (4/s for 5s). 2.5s rearm. Poison stacks pressure on tanks.' },
  flame: { id: 'flame', name: 'Flame Vent', icon: '🔥', cat: 'trap', cost: 55, mana: 5, key: 'e', color: '#ff8a3d', desc: 'Burst of fire hits everyone within 1.3 tiles: 28 dmg + burning. 6s rearm.', unlock: 'u_flame' },
  curse: { id: 'curse', name: 'Curse Rune', icon: '☠️', cat: 'trap', cost: 50, mana: 4, key: 'r', color: '#b46bff', desc: 'Slows heroes 40%, weakens their attacks 30%, and rattles morale. 8s rearm.', unlock: 'u_curse' },
  door: { id: 'door', name: 'Iron Door', icon: '🚪', cat: 'trap', cost: 30, mana: 0, key: 't', color: '#b0b8c8', desc: 'Blocks the path until bashed down (80 HP). Great choke point; heroes avoid it if a detour exists.' },
  goblin: { id: 'goblin', name: 'Goblin Den', icon: '👺', cat: 'lair', cost: 30, mana: 8, key: 'a', color: '#6fbf5a', desc: 'Spawns a fast, cheap Goblin. 8 mana per hatch.' },
  skeleton: { id: 'skeleton', name: 'Bone Crypt', icon: '💀', cat: 'lair', cost: 45, mana: 10, key: 's', color: '#e8e2d0', desc: 'Spawns a Skeleton that reassembles once after dying. 10 mana.' },
  slime: { id: 'slime', name: 'Slime Pool', icon: '🟢', cat: 'lair', cost: 40, mana: 8, key: 'g', color: '#4fe08a', desc: 'Spawns a bulky Slime whose hits slow heroes. 8 mana.' },
  imp: { id: 'imp', name: 'Imp Roost', icon: '😈', cat: 'lair', cost: 65, mana: 14, key: 'h', color: '#ff5b6e', desc: 'Spawns a ranged Imp that hurls fireballs. 14 mana.', unlock: 'u_imp' },
  golem: { id: 'golem', name: 'Golem Forge', icon: '🗿', cat: 'lair', cost: 120, mana: 25, key: 'j', color: '#a89478', desc: 'Spawns a slow, massive Golem. 25 mana.', unlock: 'u_golem' },
  wraith: { id: 'wraith', name: 'Wraith Shrine', icon: '👻', cat: 'lair', cost: 105, mana: 20, key: 'k', color: '#8fd3ff', desc: 'Spawns a Wraith whose touch drains hero morale. 20 mana.', unlock: 'u_wraith' },
  cache: { id: 'cache', name: 'Treasure Cache', icon: '💰', cat: 'econ', cost: 50, mana: 0, key: 'c', color: '#f4c453', desc: 'Holds 50 gold of bait. Greedy heroes detour to steal it. Kill the thief and you keep the gold. Auto-refills each wave for half price.' },
  well: { id: 'well', name: 'Mana Well', icon: '🔷', cat: 'econ', cost: 60, mana: 0, key: 'm', color: '#5aa9ff', desc: 'Siphons +1.4 mana/s from the deep ley. The lifeblood of traps, lairs and spells.' },
  altar: { id: 'altar', name: 'Blood Altar', icon: '🩸', cat: 'econ', cost: 80, mana: 0, key: 'b', color: '#e0445c', desc: 'Heals monsters within 2.2 tiles (5 HP/s) so lairs can hold the line.', unlock: 'u_altar' },
};
export const STRUCT_ORDER: StructKind[] = ['spike', 'dart', 'flame', 'curse', 'door', 'goblin', 'skeleton', 'slime', 'imp', 'golem', 'wraith', 'cache', 'well', 'altar'];
export const LAIRS: StructKind[] = ['goblin', 'skeleton', 'slime', 'imp', 'golem', 'wraith'];

export interface MonDef { name: string; icon: string; hp: number; dmg: number; speed: number; range: number; cd: number; color: string; size: number; ranged?: boolean }
export const MONSTERS: Record<MonsterType, MonDef> = {
  goblin: { name: 'Goblin', icon: '👺', hp: 45, dmg: 7, speed: 2.2, range: 0.8, cd: 0.7, color: '#6fbf5a', size: 0.55 },
  skeleton: { name: 'Skeleton', icon: '💀', hp: 70, dmg: 11, speed: 1.4, range: 0.85, cd: 1.0, color: '#e8e2d0', size: 0.6 },
  slime: { name: 'Slime', icon: '🟢', hp: 110, dmg: 6, speed: 1.0, range: 0.8, cd: 1.1, color: '#4fe08a', size: 0.62 },
  imp: { name: 'Imp', icon: '😈', hp: 34, dmg: 10, speed: 1.7, range: 3.0, cd: 1.2, color: '#ff5b6e', size: 0.55, ranged: true },
  golem: { name: 'Golem', icon: '🗿', hp: 280, dmg: 22, speed: 0.8, range: 0.95, cd: 1.6, color: '#a89478', size: 0.82 },
  wraith: { name: 'Wraith', icon: '👻', hp: 80, dmg: 13, speed: 1.8, range: 0.9, cd: 1.0, color: '#8fd3ff', size: 0.6 },
};

export type AdvClass = 'warrior' | 'rogue' | 'cleric' | 'thief' | 'mage' | 'ranger' | 'paladin' | 'aldric' | 'vexara' | 'hero';
export interface AdvDef {
  name: string; icon: string; hp: number; dmg: number; speed: number; range: number; cd: number;
  greed: number; carry: number; weight: number; minWave: number; color: string; size: number; boss?: boolean; desc: string;
}
export const ADVS: Record<AdvClass, AdvDef> = {
  warrior: { name: 'Warrior', icon: '⚔️', hp: 90, dmg: 9, speed: 1.5, range: 0.85, cd: 1.0, greed: 0.3, carry: 1, weight: 5, minWave: 1, color: '#d9564a', size: 0.58, desc: 'Sturdy melee bruiser.' },
  rogue: { name: 'Rogue', icon: '🗡️', hp: 55, dmg: 7, speed: 1.9, range: 0.85, cd: 0.6, greed: 0.6, carry: 1.2, weight: 3, minWave: 1, color: '#6b5b95', size: 0.52, desc: 'Spots and disarms traps (55%).' },
  cleric: { name: 'Cleric', icon: '✨', hp: 65, dmg: 4, speed: 1.4, range: 2.4, cd: 1.2, greed: 0.2, carry: 0.8, weight: 2, minWave: 2, color: '#f5e6a3', size: 0.55, desc: 'Heals the wounded and steadies morale.' },
  thief: { name: 'Hoarder', icon: '🎒', hp: 50, dmg: 5, speed: 2.2, range: 0.8, cd: 0.7, greed: 1.0, carry: 1.5, weight: 2, minWave: 2, color: '#e0a030', size: 0.52, desc: 'Goes straight for caches, then bolts for the exit with your gold.' },
  mage: { name: 'Mage', icon: '🧙', hp: 45, dmg: 13, speed: 1.3, range: 3.2, cd: 1.6, greed: 0.4, carry: 1, weight: 3, minWave: 3, color: '#4a90e2', size: 0.55, desc: 'Ranged splash bolts that shred packed monsters.' },
  ranger: { name: 'Ranger', icon: '🏹', hp: 58, dmg: 9, speed: 1.6, range: 3.6, cd: 1.0, greed: 0.4, carry: 1, weight: 3, minWave: 4, color: '#4caf6a', size: 0.55, desc: 'Long-range archer. Needs line of sight.' },
  paladin: { name: 'Paladin', icon: '🛡️', hp: 170, dmg: 11, speed: 1.2, range: 0.9, cd: 1.1, greed: 0.1, carry: 1.4, weight: 2, minWave: 6, color: '#f0d890', size: 0.64, desc: 'Resists traps 40%. Holy aura cuts party morale loss.' },
  aldric: { name: 'Sir Aldric the Unbroken', icon: '👑', hp: 650, dmg: 18, speed: 1.1, range: 1.0, cd: 1.0, greed: 0, carry: 8, weight: 0, minWave: 99, color: '#ffd24a', size: 0.9, boss: true, desc: 'Raises Shield Walls over nearby allies.' },
  vexara: { name: 'Archmage Vexara', icon: '🔮', hp: 480, dmg: 20, speed: 1.2, range: 3.4, cd: 1.5, greed: 0, carry: 8, weight: 0, minWave: 99, color: '#d36bff', size: 0.85, boss: true, desc: 'Dispels your structures within 4 tiles for 8s.' },
  hero: { name: 'The Hero of Dawn', icon: '🌟', hp: 1000, dmg: 24, speed: 1.3, range: 1.1, cd: 0.9, greed: 0, carry: 12, weight: 0, minWave: 99, color: '#fff3a0', size: 0.95, boss: true, desc: 'Dawn Nova scorches monsters. Enrages below 50% HP.' },
};
export const ADV_POOL: AdvClass[] = ['warrior', 'rogue', 'cleric', 'thief', 'mage', 'ranger', 'paladin'];

export type SpellId = 'smite' | 'rally' | 'terrify' | 'cavein';
export interface SpellDef { id: SpellId; name: string; icon: string; cost: number; cd: number; radius: number; key: string; desc: string; unlock?: string; color: string }
export const SPELLS: SpellDef[] = [
  { id: 'smite', name: 'Smite', icon: '⚡', cost: 30, cd: 3, radius: 1.5, key: '1', desc: 'Lightning strike: 55 dmg in a small area.', color: '#ffe86b' },
  { id: 'rally', name: 'Blood Frenzy', icon: '🩸', cost: 25, cd: 8, radius: 3.2, key: '2', desc: 'Monsters in the area heal 25% and gain +40% speed & damage for 6s.', color: '#ff5b6e' },
  { id: 'terrify', name: 'Terrify', icon: '😱', cost: 30, cd: 10, radius: 3.2, key: '3', desc: 'Heroes in area are slowed 50% for 4s and the party loses 14 morale.', unlock: 'u_terrify', color: '#b46bff' },
  { id: 'cavein', name: 'Cave-In', icon: '🪨', cost: 45, cd: 12, radius: 1.8, key: '4', desc: 'Rocks fall: 45 dmg and a 3s stun in the area.', unlock: 'u_cavein', color: '#c9a36b' },
];

export interface Mods {
  trapDmg: number; monHp: number; monDmg: number; spellCost: number; manaRegen: number; bounty: number;
  cacheMul: number; manaPerKill: number; respawn: number; buildCost: number; moraleLoss: number; thorns: number;
  spellPow: number; lairMana: number;
}
export const defaultMods = (): Mods => ({
  trapDmg: 1, monHp: 1, monDmg: 1, spellCost: 1, manaRegen: 0, bounty: 1, cacheMul: 1, manaPerKill: 0,
  respawn: 1, buildCost: 1, moraleLoss: 1, thorns: 0, spellPow: 1, lairMana: 1,
});

export interface EdictApi { gold(n: number): void; heart(max: number, heal: number): void; mana(max: number, fill: boolean): void; rep(n: number): void; refreshCaches(): void }
export interface EdictDef { id: string; name: string; icon: string; desc: string; apply: (m: Mods, api: EdictApi) => void }
export const EDICTS: EdictDef[] = [
  { id: 'gilded', name: 'Gilded Bait', icon: '🪙', desc: 'Treasure caches hold +50% gold. Greedy heroes will take bigger risks.', apply: (m, a) => { m.cacheMul *= 1.5; a.refreshCaches(); } },
  { id: 'bloodpact', name: 'Blood Pact', icon: '🩸', desc: 'Monsters gain +25% HP and damage. Lairs cost 20% more mana to hatch.', apply: (m) => { m.monHp *= 1.25; m.monDmg *= 1.25; m.lairMana *= 1.2; } },
  { id: 'honed', name: 'Honed Steel', icon: '🗡️', desc: 'Traps deal +30% damage.', apply: (m) => { m.trapDmg *= 1.3; } },
  { id: 'echo', name: 'Echoing Halls', icon: '🔔', desc: 'Spells cost 25% less mana.', apply: (m) => { m.spellCost *= 0.75; } },
  { id: 'harvest', name: 'Bone Harvest', icon: '🦴', desc: 'Every hero slain restores 4 mana.', apply: (m) => { m.manaPerKill += 4; } },
  { id: 'bulwark', name: 'Heart Bulwark', icon: '🛡️', desc: '+60 max Heart HP and heal 60.', apply: (_m, a) => { a.heart(60, 60); } },
  { id: 'hatch', name: 'Rapid Hatching', icon: '🥚', desc: 'Dead monsters respawn 40% faster.', apply: (m) => { m.respawn *= 0.6; } },
  { id: 'surge', name: 'Mana Surge', icon: '🌀', desc: '+1.5 mana per second.', apply: (m) => { m.manaRegen += 1.5; } },
  { id: 'tongue', name: 'Silver Tongue', icon: '💬', desc: 'Gold bounties from slain heroes +30%.', apply: (m) => { m.bounty *= 1.3; } },
  { id: 'banner', name: 'Dread Banner', icon: '🚩', desc: '+15 reputation. Your scares hit morale 25% harder — but stronger parties come.', apply: (m, a) => { m.moraleLoss *= 1.25; a.rep(15); } },
  { id: 'tithe', name: 'Tithe of Fools', icon: '💎', desc: 'Receive 160 gold immediately.', apply: (_m, a) => { a.gold(160); } },
  { id: 'mason', name: 'Master Builder', icon: '🧱', desc: 'All construction costs 15% less.', apply: (m) => { m.buildCost *= 0.85; } },
  { id: 'thorned', name: 'Thorned Heart', icon: '🌹', desc: 'The Heart lashes out for +5 dmg/s at heroes within 2 tiles.', apply: (m) => { m.thorns += 5; } },
  { id: 'arcane', name: 'Arcane Amplifier', icon: '🔆', desc: 'Spells are 30% more powerful.', apply: (m) => { m.spellPow *= 1.3; } },
  { id: 'reservoir', name: 'Deep Reservoir', icon: '🫙', desc: '+40 max mana and refill instantly.', apply: (_m, a) => { a.mana(40, true); } },
];

export interface UpgradeDef { id: string; name: string; icon: string; desc: string; costs: number[]; group: 'Vitality' | 'Arcana' | 'Craft' | 'Unlocks' }
export const UPGRADES: UpgradeDef[] = [
  { id: 'heart', name: 'Heart Vigor', icon: '❤️‍🔥', desc: '+30 max Heart HP per level.', costs: [20, 40, 70, 110, 160], group: 'Vitality' },
  { id: 'pulse', name: 'Heart Thorns', icon: '🌹', desc: 'Heart pulses 4 dmg/s per level at heroes within 2 tiles.', costs: [45, 90, 150], group: 'Vitality' },
  { id: 'mana', name: 'Mana Font', icon: '🔷', desc: '+0.4 mana/s regen and +15 max mana per level.', costs: [25, 45, 75, 115, 165], group: 'Arcana' },
  { id: 'arcana', name: 'Spell Mastery', icon: '🔆', desc: 'Spells +10% power per level.', costs: [30, 60, 100, 150], group: 'Arcana' },
  { id: 'purse', name: 'Deep Pockets', icon: '💰', desc: '+40 starting gold per level.', costs: [15, 30, 55, 85, 130], group: 'Craft' },
  { id: 'beast', name: 'Beastmaster', icon: '🐺', desc: 'Monsters +8% HP and damage per level.', costs: [30, 55, 90, 140, 200], group: 'Craft' },
  { id: 'trap', name: 'Trapsmith', icon: '⚙️', desc: 'Traps +8% damage per level.', costs: [25, 50, 85, 130, 190], group: 'Craft' },
  { id: 'dig', name: 'Stonemason', icon: '⛏️', desc: 'Digging costs 15% less per level.', costs: [20, 45, 80], group: 'Craft' },
  { id: 'u_flame', name: 'Flame Vent', icon: '🔥', desc: 'Unlocks the area-burn trap.', costs: [50], group: 'Unlocks' },
  { id: 'u_curse', name: 'Curse Rune', icon: '☠️', desc: 'Unlocks the slowing, morale-rattling trap.', costs: [80], group: 'Unlocks' },
  { id: 'u_imp', name: 'Imp Roost', icon: '😈', desc: 'Unlocks the ranged Imp lair.', costs: [60], group: 'Unlocks' },
  { id: 'u_altar', name: 'Blood Altar', icon: '🩸', desc: 'Unlocks monster-healing altars.', costs: [90], group: 'Unlocks' },
  { id: 'u_golem', name: 'Golem Forge', icon: '🗿', desc: 'Unlocks the massive Golem lair.', costs: [120], group: 'Unlocks' },
  { id: 'u_wraith', name: 'Wraith Shrine', icon: '👻', desc: 'Unlocks the morale-draining Wraith lair.', costs: [150], group: 'Unlocks' },
  { id: 'u_terrify', name: 'Spell: Terrify', icon: '😱', desc: 'Unlocks the morale-crushing spell.', costs: [70], group: 'Unlocks' },
  { id: 'u_cavein', name: 'Spell: Cave-In', icon: '🪨', desc: 'Unlocks the stunning area spell.', costs: [100], group: 'Unlocks' },
];

export interface Difficulty { id: string; name: string; icon: string; desc: string; hp: number; count: number; gold: number; heart: number; regen: number; souls: number }
export const DIFFICULTIES: Difficulty[] = [
  { id: 'apprentice', name: 'Apprentice Lord', icon: '🕯️', desc: 'Weaker, smaller parties. Sturdier Heart. Souls ×0.7.', hp: 0.8, count: 0.85, gold: 1.3, heart: 1.3, regen: 1.1, souls: 0.7 },
  { id: 'overlord', name: 'Overlord', icon: '👁️', desc: 'The intended challenge. Souls ×1.', hp: 1, count: 1, gold: 1, heart: 1, regen: 1, souls: 1 },
  { id: 'archfiend', name: 'Archfiend', icon: '🔥', desc: 'Tougher, bigger parties. Fragile Heart. Souls ×1.6.', hp: 1.3, count: 1.2, gold: 0.85, heart: 0.8, regen: 0.9, souls: 1.6 },
];
export interface Modifier { id: string; name: string; icon: string; desc: string; souls: number }
export const MODIFIERS: Modifier[] = [
  { id: 'greedy', name: 'Greedy Heroes', icon: '🤑', desc: 'Heroes are twice as greedy and carry 50% more gold.', souls: 0.2 },
  { id: 'drought', name: 'Mana Drought', icon: '🏜️', desc: 'Base mana regeneration is cut by 40%.', souls: 0.25 },
  { id: 'iron', name: 'Iron Parties', icon: '🛡️', desc: 'Heroes have +35% HP.', souls: 0.25 },
  { id: 'zealots', name: 'Zealots', icon: '🕍', desc: 'Heroes lose only half as much morale.', souls: 0.2 },
];

export const REP_TIERS = [
  { min: 0, name: 'Obscure' },
  { min: 20, name: 'Rumored' },
  { min: 40, name: 'Notorious' },
  { min: 60, name: 'Feared' },
  { min: 80, name: 'Legendary' },
];
export const repTier = (r: number) => {
  let t = REP_TIERS[0];
  for (const x of REP_TIERS) if (r >= x.min) t = x;
  return t.name;
};

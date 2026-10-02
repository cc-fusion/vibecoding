// Core static data for Heirloom Dynasty

export type StatKey = "vigor" | "might" | "agility" | "wits" | "luck";
export const STAT_KEYS: StatKey[] = ["vigor", "might", "agility", "wits", "luck"];
export type Stats = Record<StatKey, number>;

export const STAT_INFO: Record<StatKey, { label: string; icon: string; desc: string }> = {
  vigor: { label: "Vigor", icon: "❤️", desc: "Maximum health." },
  might: { label: "Might", icon: "⚔️", desc: "Weapon damage." },
  agility: { label: "Agility", icon: "💨", desc: "Move speed, attack speed, dash recovery." },
  wits: { label: "Wits", icon: "📖", desc: "Ancestral Roar charge rate and potion strength." },
  luck: { label: "Luck", icon: "🍀", desc: "Critical chance, gold and heart drops." },
};

export interface Mods {
  hpBase: number;
  hpAdd: number;
  hpMul: number;
  dmg: number;
  atkSpd: number;
  move: number;
  crit: number;
  critDmg: number;
  gold: number;
  lifesteal: number;
  taken: number;
  dashCd: number;
  special: number;
  reach: number;
  burn: number;
  slow: number;
  chain: number;
  thorns: number;
  echo: number;
  orbit: number;
  revive: number;
  dashStrike: number;
  magnet: number;
  potionHeal: number;
  berserk: number;
  potions: number;
  regen: number;
}

export function baseMods(): Mods {
  return {
    hpBase: 100, hpAdd: 0, hpMul: 1, dmg: 1, atkSpd: 1, move: 1, crit: 0.05, critDmg: 1.8, gold: 1,
    lifesteal: 0, taken: 1, dashCd: 1, special: 1, reach: 1, burn: 0, slow: 0, chain: 0, thorns: 0,
    echo: 0, orbit: 0, revive: 0, dashStrike: 0, magnet: 0, potionHeal: 0.4, berserk: 0, potions: 1, regen: 0,
  };
}
export const maxHpOf = (m: Mods) => Math.max(20, Math.round((m.hpBase + m.hpAdd) * m.hpMul));

// ---------------- Traits ----------------
export interface Trait {
  id: string;
  name: string;
  icon: string;
  kind: "good" | "bad" | "mixed" | "mythic";
  desc: string;
  apply: (m: Mods) => void;
}

export const TRAITS: Record<string, Trait> = {
  berserker: { id: "berserker", name: "Berserker Blood", icon: "🔥", kind: "good", desc: "Up to +50% damage as health falls.", apply: (m) => { m.berserk += 0.5; } },
  swift: { id: "swift", name: "Fleet of Foot", icon: "💨", kind: "good", desc: "+12% movement speed.", apply: (m) => { m.move *= 1.12; } },
  stout: { id: "stout", name: "Stout", icon: "🛡️", kind: "good", desc: "+25% maximum health.", apply: (m) => { m.hpMul *= 1.25; } },
  keen: { id: "keen", name: "Keen-Eyed", icon: "🎯", kind: "good", desc: "+10% crit chance, +30% crit damage.", apply: (m) => { m.crit += 0.1; m.critDmg += 0.3; } },
  vampiric: { id: "vampiric", name: "Leech-Blooded", icon: "🩸", kind: "good", desc: "Heal 5% of damage dealt.", apply: (m) => { m.lifesteal += 0.05; } },
  lucky: { id: "lucky", name: "Lucky Star", icon: "🍀", kind: "good", desc: "+30% gold, +4% crit.", apply: (m) => { m.gold *= 1.3; m.crit += 0.04; } },
  scholar: { id: "scholar", name: "Scholar", icon: "📚", kind: "good", desc: "+35% Ancestral Roar charge.", apply: (m) => { m.special *= 1.35; } },
  ember: { id: "ember", name: "Ember-Touched", icon: "♨️", kind: "good", desc: "Strikes ignite foes.", apply: (m) => { m.burn += 6; } },
  ironhide: { id: "ironhide", name: "Ironhide", icon: "🪨", kind: "good", desc: "Take 15% less damage.", apply: (m) => { m.taken *= 0.85; } },
  winddancer: { id: "winddancer", name: "Wind-Dancer", icon: "🌀", kind: "good", desc: "Dash recovers 30% faster.", apply: (m) => { m.dashCd *= 0.7; } },
  giant: { id: "giant", name: "Giant-Born", icon: "🗿", kind: "mixed", desc: "+20% reach, +10% damage, -5% speed.", apply: (m) => { m.reach *= 1.2; m.dmg *= 1.1; m.move *= 0.95; } },
  troll: { id: "troll", name: "Troll-Blood", icon: "🌿", kind: "good", desc: "Regenerate 0.8 HP per second.", apply: (m) => { m.regen += 0.8; } },
  crowned: { id: "crowned", name: "Crowned Blood", icon: "👑", kind: "mythic", desc: "+10% damage, health, gold and roar charge.", apply: (m) => { m.dmg *= 1.1; m.hpMul *= 1.1; m.gold *= 1.1; m.special *= 1.1; } },
  stormborn: { id: "stormborn", name: "Stormborn", icon: "⚡", kind: "mythic", desc: "30% chance for strikes to arc lightning.", apply: (m) => { m.chain += 0.3; } },
  frail: { id: "frail", name: "Frail", icon: "🥀", kind: "bad", desc: "-20% health, but +8% crit.", apply: (m) => { m.hpMul *= 0.8; m.crit += 0.08; } },
  clumsy: { id: "clumsy", name: "Clumsy", icon: "🦶", kind: "mixed", desc: "-15% attack speed, +20% damage.", apply: (m) => { m.atkSpd *= 0.85; m.dmg *= 1.2; } },
  greedy: { id: "greedy", name: "Greedy", icon: "💰", kind: "mixed", desc: "-15% health, +40% gold.", apply: (m) => { m.hpMul *= 0.85; m.gold *= 1.4; } },
  nervous: { id: "nervous", name: "Nervous", icon: "😰", kind: "mixed", desc: "Dash +25% slower, roar +30% charge.", apply: (m) => { m.dashCd *= 1.25; m.special *= 1.3; } },
  glass: { id: "glass", name: "Glass Cannon", icon: "💎", kind: "mixed", desc: "+35% damage, -30% health.", apply: (m) => { m.dmg *= 1.35; m.hpMul *= 0.7; } },
  sluggish: { id: "sluggish", name: "Sluggish", icon: "🐌", kind: "bad", desc: "-12% speed, take 10% less damage.", apply: (m) => { m.move *= 0.88; m.taken *= 0.9; } },
  hemophilic: { id: "hemophilic", name: "Hemophilic", icon: "🩹", kind: "mixed", desc: "Take 15% more damage, heal 4% of damage dealt.", apply: (m) => { m.taken *= 1.15; m.lifesteal += 0.04; } },
};
export const TRAIT_IDS = Object.keys(TRAITS);
export const TRAIT_CONFLICTS: [string, string][] = [
  ["stout", "frail"], ["swift", "sluggish"], ["glass", "ironhide"], ["stout", "glass"], ["greedy", "stout"], ["winddancer", "nervous"], ["troll", "hemophilic"],
];
export const traitsConflict = (a: string, b: string) => a === b || TRAIT_CONFLICTS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// ---------------- Boons (in-run) ----------------
export interface Boon {
  id: string;
  name: string;
  icon: string;
  desc: string;
  rarity: "common" | "rare" | "epic";
  max: number;
  apply: (m: Mods, lvl: number) => void;
}
export const BOONS: Record<string, Boon> = {
  edge: { id: "edge", name: "Sharpened Edge", icon: "🗡️", desc: "+14% damage per level.", rarity: "common", max: 5, apply: (m, l) => { m.dmg *= 1 + 0.14 * l; } },
  haste: { id: "haste", name: "Quick Hands", icon: "⚡", desc: "+12% attack speed per level.", rarity: "common", max: 5, apply: (m, l) => { m.atkSpd *= 1 + 0.12 * l; } },
  boots: { id: "boots", name: "Fleet Boots", icon: "👢", desc: "+10% move speed per level.", rarity: "common", max: 4, apply: (m, l) => { m.move *= 1 + 0.1 * l; } },
  vitality: { id: "vitality", name: "Hearty Meal", icon: "🍖", desc: "+22 max health per level (heals on pickup).", rarity: "common", max: 5, apply: (m, l) => { m.hpAdd += 22 * l; } },
  leech: { id: "leech", name: "Leeching Edge", icon: "🩸", desc: "Heal 4% of damage dealt per level.", rarity: "rare", max: 3, apply: (m, l) => { m.lifesteal += 0.04 * l; } },
  fortune: { id: "fortune", name: "Gambler's Coin", icon: "🪙", desc: "+20% gold and +5% crit per level.", rarity: "common", max: 4, apply: (m, l) => { m.gold *= 1 + 0.2 * l; m.crit += 0.05 * l; } },
  flame: { id: "flame", name: "Flame Touch", icon: "🔥", desc: "Strikes ignite foes (8 dmg/s per level).", rarity: "rare", max: 3, apply: (m, l) => { m.burn += 8 * l; } },
  frost: { id: "frost", name: "Frost Touch", icon: "❄️", desc: "35% chance per level to chill foes.", rarity: "rare", max: 3, apply: (m, l) => { m.slow += 0.35 * l; } },
  chain: { id: "chain", name: "Chain Lightning", icon: "⚡", desc: "+30% chance for hits to arc to nearby foes.", rarity: "rare", max: 3, apply: (m, l) => { m.chain += 0.3 * l; } },
  thorns: { id: "thorns", name: "Thornmail", icon: "🌵", desc: "Taking damage releases a thorn nova (+14 dmg/lvl).", rarity: "common", max: 4, apply: (m, l) => { m.thorns += 14 * l; } },
  echo: { id: "echo", name: "Echo Strike", icon: "🌊", desc: "Every 4th (3rd, 2nd) swing releases a shockwave.", rarity: "epic", max: 3, apply: (m, l) => { m.echo = l; } },
  orbit: { id: "orbit", name: "Spirit Blades", icon: "🌀", desc: "+1 ancestral blade circles you.", rarity: "epic", max: 3, apply: (m, l) => { m.orbit += l; } },
  phoenix: { id: "phoenix", name: "Ancestor's Mercy", icon: "🕊️", desc: "Revive once per run at 40% health.", rarity: "epic", max: 1, apply: (m, l) => { m.revive += l; } },
  dashstrike: { id: "dashstrike", name: "Rending Dash", icon: "💫", desc: "Dashing slashes foes (+40 dmg/lvl).", rarity: "rare", max: 3, apply: (m, l) => { m.dashStrike += l; } },
  magnet: { id: "magnet", name: "Gold Magnet", icon: "🧲", desc: "+90 pickup range per level.", rarity: "common", max: 3, apply: (m, l) => { m.magnet += 90 * l; } },
  stoneskin: { id: "stoneskin", name: "Stoneskin", icon: "🪨", desc: "Take 10% less damage per level.", rarity: "rare", max: 3, apply: (m, l) => { m.taken *= Math.pow(0.9, l); } },
  bloodrage: { id: "bloodrage", name: "Blood Rage", icon: "😡", desc: "+35% low-health damage per level.", rarity: "rare", max: 3, apply: (m, l) => { m.berserk += 0.35 * l; } },
  wellspring: { id: "wellspring", name: "Wellspring", icon: "🧪", desc: "Potions heal +20% more per level.", rarity: "common", max: 3, apply: (m, l) => { m.potionHeal += 0.2 * l; } },
  reach: { id: "reach", name: "Titan's Reach", icon: "📏", desc: "+15% weapon reach per level.", rarity: "common", max: 3, apply: (m, l) => { m.reach *= 1 + 0.15 * l; } },
  voice: { id: "voice", name: "Voice of Ancestors", icon: "📢", desc: "+30% Ancestral Roar charge per level.", rarity: "common", max: 4, apply: (m, l) => { m.special *= 1 + 0.3 * l; } },
};
export const BOON_IDS = Object.keys(BOONS);

export function applyBoons(base: Mods, boons: Record<string, number>): Mods {
  const m = { ...base };
  for (const id of Object.keys(boons)) {
    const b = BOONS[id];
    if (b && boons[id] > 0) b.apply(m, boons[id]);
  }
  return m;
}

// ---------------- Relics (heirlooms) ----------------
export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  apply: (m: Mods, s: number) => void; // s = scale factor (1 + 0.2*(lvl-1))
}
export const RELICS: Record<string, RelicDef> = {
  signet: { id: "signet", name: "Ember Signet", icon: "💍", desc: "+9 burn damage/s and +6% damage.", apply: (m, s) => { m.burn += 9 * s; m.dmg *= 1 + 0.06 * s; } },
  locket: { id: "locket", name: "Hearthstone Locket", icon: "📿", desc: "+30 max health.", apply: (m, s) => { m.hpAdd += 30 * s; } },
  boots: { id: "boots", name: "Wayfarer's Boots", icon: "🥾", desc: "+8% speed, dash recovers 8% faster.", apply: (m, s) => { m.move *= 1 + 0.08 * s; m.dashCd *= 1 - 0.08 * Math.min(s, 3); } },
  coin: { id: "coin", name: "Grave Coin", icon: "🪙", desc: "+25% gold.", apply: (m, s) => { m.gold *= 1 + 0.25 * s; } },
  lantern: { id: "lantern", name: "Soul Lantern", icon: "🏮", desc: "+30% Roar charge.", apply: (m, s) => { m.special *= 1 + 0.3 * s; } },
  thornring: { id: "thornring", name: "Thorn Ring", icon: "⭕", desc: "+16 thorn nova damage, -5% damage taken.", apply: (m, s) => { m.thorns += 16 * s; m.taken *= 1 - 0.05 * Math.min(s, 3); } },
  fang: { id: "fang", name: "Wolf Fang", icon: "🐺", desc: "+10% crit, +25% crit damage.", apply: (m, s) => { m.crit += 0.1 * Math.min(s, 3); m.critDmg += 0.25 * s; } },
  crownshard: { id: "crownshard", name: "Crown Shard", icon: "🔱", desc: "+10% damage, +10% health, +10% gold.", apply: (m, s) => { m.dmg *= 1 + 0.1 * s; m.hpMul *= 1 + 0.1 * s; m.gold *= 1 + 0.1 * s; } },
};
export const RELIC_IDS = Object.keys(RELICS);
export const MAX_RELIC_LVL = 10;
export const relicScale = (lvl: number) => 1 + 0.2 * (Math.max(1, lvl) - 1);

// ---------------- Weapons ----------------
export type WeaponId = "blade" | "spear" | "hammer" | "bow";
export interface Weapon {
  id: WeaponId;
  name: string;
  icon: string;
  desc: string;
  type: "melee" | "ranged";
  range: number;
  arc: number;
  dmg: number;
  cd: number;
  kb: number;
  cost: number;
}
export const WEAPONS: Record<WeaponId, Weapon> = {
  blade: { id: "blade", name: "Heirloom Blade", icon: "🗡️", desc: "Balanced arc swing. Deflects bullets.", type: "melee", range: 70, arc: 2.1, dmg: 1, cd: 0.36, kb: 200, cost: 0 },
  spear: { id: "spear", name: "Wyrmtooth Spear", icon: "🔱", desc: "Long narrow thrust. Great reach, deflects bullets.", type: "melee", range: 124, arc: 0.75, dmg: 1.25, cd: 0.5, kb: 140, cost: 120 },
  hammer: { id: "hammer", name: "Ancestral Maul", icon: "🔨", desc: "Slow, enormous arc, huge knockback and stun.", type: "melee", range: 88, arc: 3.5, dmg: 2.6, cd: 0.95, kb: 460, cost: 200 },
  bow: { id: "bow", name: "Hunter's Bow", icon: "🏹", desc: "Ranged arrows. Safe, but lighter damage.", type: "ranged", range: 520, arc: 0, dmg: 0.85, cd: 0.42, kb: 90, cost: 160 },
};
export const WEAPON_IDS: WeaponId[] = ["blade", "spear", "hammer", "bow"];

// ---------------- Realms / enemies ----------------
export interface Realm {
  name: string;
  floorA: string;
  floorB: string;
  accent: string;
  hazard: "bog" | "lava" | "ice" | "spikes" | "void";
  hazardText: string;
  boss: number;
  intro: string;
  enemies: string[];
  music: number;
}
export const REALMS: Realm[] = [
  { name: "Mossy Barrows", floorA: "#17261a", floorB: "#1f3424", accent: "#8fd16a", hazard: "bog", hazardText: "Bogs slow all who tread them.", boss: 0, intro: "Where the first of your line was buried, the dead have grown restless.", enemies: ["grub", "spitter"], music: 0 },
  { name: "Ember Caverns", floorA: "#2a1411", floorB: "#3a1c16", accent: "#ff7a3d", hazard: "lava", hazardText: "Lava vents erupt on a rhythm.", boss: 1, intro: "The roots of the mountain burn with an old grudge.", enemies: ["grub", "spitter", "charger", "bomber"], music: 1 },
  { name: "Frostbound Hollows", floorA: "#112230", floorB: "#17303f", accent: "#8fdcff", hazard: "ice", hazardText: "Ice makes your footing slippery.", boss: 2, intro: "Beneath the glacier, something has been dreaming of your family.", enemies: ["grub", "spitter", "charger", "shaman", "bomber"], music: 2 },
  { name: "Gilded Ruins", floorA: "#2a2413", floorB: "#3a3219", accent: "#ffd24a", hazard: "spikes", hazardText: "Gilded spike traps strike everyone.", boss: 3, intro: "A palace of gold, built from every oath your ancestors broke.", enemies: ["spitter", "charger", "shaman", "knight", "bomber"], music: 3 },
  { name: "The Hollow Throne", floorA: "#1a1226", floorB: "#261a38", accent: "#c07bff", hazard: "void", hazardText: "Void wells drag everything inward.", boss: 4, intro: "The Hollow King waits. He is the first heir, and he never let go.", enemies: ["grub", "spitter", "charger", "shaman", "knight", "bomber"], music: 4 },
];

export interface EnemyDef {
  name: string;
  hp: number;
  spd: number;
  r: number;
  dmg: number;
  gold: number;
  cost: number;
  color: string;
}
export const ENEMIES: Record<string, EnemyDef> = {
  grub: { name: "Grave Grub", hp: 26, spd: 100, r: 12, dmg: 9, gold: 2, cost: 1, color: "#9bd37a" },
  spitter: { name: "Bile Spitter", hp: 18, spd: 70, r: 11, dmg: 9, gold: 3, cost: 2, color: "#d3c97a" },
  charger: { name: "Tusked Charger", hp: 48, spd: 90, r: 15, dmg: 16, gold: 4, cost: 3, color: "#d39a7a" },
  bomber: { name: "Cinder Bomber", hp: 16, spd: 135, r: 12, dmg: 22, gold: 3, cost: 2, color: "#ff8855" },
  shaman: { name: "Bone Shaman", hp: 36, spd: 65, r: 13, dmg: 8, gold: 5, cost: 4, color: "#b890e8" },
  knight: { name: "Shield Knight", hp: 85, spd: 72, r: 16, dmg: 14, gold: 6, cost: 4, color: "#9ab0c8" },
  dummy: { name: "Training Dummy", hp: 90, spd: 0, r: 16, dmg: 0, gold: 0, cost: 0, color: "#c9a56a" },
};

export interface BossDef {
  name: string;
  title: string;
  hp: number;
  r: number;
  color: string;
  adds: string[];
  phases: string[][]; // pattern lists, by phase
}
export const BOSSES: BossDef[] = [
  { name: "Mossback Warden", title: "Guardian of the Barrows", hp: 900, r: 44, color: "#6fa85a", adds: ["grub"], phases: [["slam", "spread", "summon", "charge"], ["slam", "ring", "charge", "spread", "zones"]] },
  { name: "Ember Matriarch", title: "Mother of Cinders", hp: 1350, r: 46, color: "#ff6a2a", adds: ["bomber", "grub"], phases: [["spiral", "zones", "charge", "ring"], ["spiral", "slam", "zones", "ring", "charge"]] },
  { name: "Rimebound Wyrm", title: "The Dreaming Cold", hp: 1800, r: 48, color: "#78cfff", adds: ["shaman", "grub"], phases: [["spread", "rain", "charge", "summon"], ["spiral", "rain", "zones", "ring", "charge"]] },
  { name: "Gilded Sentinel", title: "Tax Collector of Oaths", hp: 2300, r: 50, color: "#ffd24a", adds: ["knight", "spitter"], phases: [["ring", "slam", "rain", "summon", "spread"], ["spiral", "slam", "rain", "zones", "summon", "charge"]] },
  { name: "The Hollow King", title: "First Heir, Last Tyrant", hp: 3600, r: 54, color: "#c07bff", adds: ["knight", "shaman", "charger"], phases: [["spread", "slam", "charge", "ring"], ["spiral", "zones", "summon", "ring", "rain"], ["spiral", "slam", "rain", "zones", "summon", "charge", "ring", "spread"]] },
];

// ---------------- Difficulty & modifiers ----------------
export type DifficultyId = "humble" | "noble" | "cursed";
export interface Difficulty {
  id: DifficultyId;
  name: string;
  icon: string;
  desc: string;
  hp: number;
  dmg: number;
  gold: number;
  gens: number;
  mut: number;
  renown: number;
}
export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  humble: { id: "humble", name: "Humble Line", icon: "🌾", desc: "Gentler foes, 15 generations to end the Hollow King.", hp: 0.8, dmg: 0.75, gold: 1.15, gens: 15, mut: 0.18, renown: 1 },
  noble: { id: "noble", name: "Noble House", icon: "🏰", desc: "The intended challenge. 12 generations.", hp: 1, dmg: 1, gold: 1, gens: 12, mut: 0.15, renown: 1.25 },
  cursed: { id: "cursed", name: "Cursed Bloodline", icon: "💀", desc: "Brutal foes, 9 generations, greater renown.", hp: 1.35, dmg: 1.35, gold: 0.9, gens: 9, mut: 0.22, renown: 1.8 },
};
export interface DynMod {
  id: string;
  name: string;
  icon: string;
  desc: string;
  hp?: number;
  dmg?: number;
  gold?: number;
  spd?: number;
  mut?: number;
  renown: number;
}
export const DYN_MODS: DynMod[] = [
  { id: "mutation", name: "Mutation Surge", icon: "🧬", desc: "Trait mutations are far more common (good and bad).", mut: 0.3, renown: 1.1 },
  { id: "lean", name: "Lean Years", icon: "🥀", desc: "Gold income -30%.", gold: 0.7, renown: 1.25 },
  { id: "iron", name: "Iron Foes", icon: "⛓️", desc: "Enemies have +30% health.", hp: 1.3, renown: 1.25 },
  { id: "swift", name: "Swift Foes", icon: "🏃", desc: "Enemies move 20% faster.", spd: 1.2, renown: 1.2 },
];

// ---------------- Estate buildings ----------------
export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  levels: string[];
}
export const BUILDINGS: BuildingDef[] = [
  { id: "forge", name: "Forge", icon: "⚒️", desc: "Temper the family weapons.", levels: ["+7% damage", "+14% damage", "+21% damage, +3% crit", "+28% damage, +6% crit", "+35% damage, +9% crit"] },
  { id: "hearth", name: "Hearth", icon: "🔥", desc: "A warm home heals and fortifies.", levels: ["+12 HP, +0 potions", "+24 HP, +1 potion", "+36 HP, +1 potion", "+48 HP, +2 potions", "+60 HP, +2 potions"] },
  { id: "yard", name: "Training Yard", icon: "🏋️", desc: "Raise the stat cap and cut tutor costs.", levels: ["Stat cap 11, -10% cost", "Stat cap 12, -20% cost", "Stat cap 13, -30% cost", "Stat cap 14, -40% cost", "Stat cap 15, -50% cost"] },
  { id: "nursery", name: "Nursery", icon: "🍼", desc: "More heirs, better inheritance. Level 1 summons Distant Kin if the line would end.", levels: ["Max 3 children, Kin safety net", "Max 4 kids, +8% good inherit", "Max 5 kids, +16%, twins 15%", "Max 6 kids, +24%, twins 25%", "Max 7 kids, +32%, twins 35%"] },
  { id: "shrine", name: "Ancestral Shrine", icon: "⛩️", desc: "Ancestors bless each expedition and rewrite blood.", levels: ["Start with 1 boon, rites cost less", "Rite discount, 1 boon", "Start with 2 boons", "Rite discount, 2 boons", "Start with 3 boons"] },
  { id: "vault", name: "Vault", icon: "🏦", desc: "Keep more gold if you fall and carry more heirlooms.", levels: ["Keep 64% gold on death, +6% gold", "73%, +12% gold", "82%, +18%, 2nd heirloom slot", "91%, +24% gold", "100%, +30%, 3rd heirloom slot"] },
];
export const BUILDING_MAX = 5;
export function buildingCost(lv: number): { gold: number; renown: number } {
  const gold = [60, 140, 260, 420, 650][lv] ?? 9999;
  const renown = [0, 0, 10, 20, 35][lv] ?? 0;
  return { gold, renown };
}

// ---------------- Legacy marks (cross-dynasty perks) ----------------
export interface PerkDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  costs: number[];
}
export const PERKS: PerkDef[] = [
  { id: "birth", name: "Noble Birth", icon: "👑", desc: "Founder starts with +1 to all stats per level.", costs: [3, 5, 8] },
  { id: "chest", name: "Ancestral Chest", icon: "💰", desc: "Start every dynasty with +100 gold per level.", costs: [2, 4, 6] },
  { id: "kin", name: "Spare Heir", icon: "🧒", desc: "Start with an extra adult heir.", costs: [4] },
  { id: "blood", name: "Seasoned Blood", icon: "🧬", desc: "Founder starts with an extra good trait.", costs: [4] },
  { id: "arms", name: "Armory Key", icon: "🗝️", desc: "Level 1 unlocks Spear, level 2 unlocks Bow.", costs: [3, 4] },
];

export const NAMES = ["Alder", "Bryn", "Cael", "Dara", "Eryk", "Fenna", "Garr", "Hale", "Isolde", "Joren", "Kestrel", "Lysa", "Marek", "Nell", "Orin", "Petra", "Quill", "Rowan", "Sable", "Tamsin", "Ulric", "Vesna", "Wren", "Yara", "Zeph", "Brannoc", "Cora", "Dunstan", "Elowen", "Fergus", "Gwen", "Hamish", "Ivor", "Jessa", "Kay", "Linnet"];
export const HOUSES = ["Vale", "Ashgrove", "Thornwick", "Greymere", "Oakhollow", "Stormwatch", "Ravenmoor", "Brightwater", "Highcairn", "Duskwood"];
export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"];

export const COLS = 38;
export const ROWS = 22;
export const T = 28;
export const W = COLS * T;
export const H = ROWS * T;
export const MAX_WAVES = 15;

export type Element = "storm" | "water" | "frost" | "fire" | "wind" | "earth" | "phys";
export type SpellId = "lightning" | "rain" | "blizzard" | "firestorm" | "gale" | "rockfall";

export const ELEMENT_COLOR: Record<string, string> = {
  storm: "#ffe85c",
  water: "#59b8ff",
  frost: "#9ff0ff",
  fire: "#ff7a2e",
  wind: "#c9f7d8",
  earth: "#c9a26b",
  phys: "#dddddd",
};

export interface SpellDef {
  id: SpellId;
  name: string;
  key: string;
  element: Element;
  cost: number;
  cd: number;
  color: string;
  icon: string;
  desc: string;
  unlockNode?: string;
}

export const SPELLS: SpellDef[] = [
  { id: "lightning", name: "Chain Lightning", key: "1", element: "storm", cost: 18, cd: 0.45, color: "#ffe85c", icon: "⚡",
    desc: "Strike a point and chain between enemies. Wet enemies conduct: more damage, longer chains, brief stun." },
  { id: "rain", name: "Rainstorm", key: "2", element: "water", cost: 22, cd: 1.4, color: "#59b8ff", icon: "🌧️",
    desc: "Summon a rain cloud that soaks enemies (slows them, douses fire). Soaked foes are primed for Lightning and Frost." },
  { id: "blizzard", name: "Blizzard", key: "3", element: "frost", cost: 36, cd: 2.5, color: "#9ff0ff", icon: "❄️",
    desc: "A freezing squall that chills and slows. Chilling a WET enemy flash-freezes it solid." },
  { id: "firestorm", name: "Firestorm", key: "4", element: "fire", cost: 40, cd: 3, color: "#ff7a2e", icon: "🔥",
    desc: "Rain fire on an area, igniting enemies. Melts frozen foes for bonus damage. Water extinguishes it.", unlockNode: "fl0" },
  { id: "gale", name: "Gale Burst", key: "5", element: "wind", cost: 28, cd: 3.5, color: "#c9f7d8", icon: "🌪️",
    desc: "Blast enemies back up the pass, smashing them into walls. Spreads burning, fans fire zones, wind-chills the wet.", unlockNode: "w0" },
  { id: "rockfall", name: "Rockfall", key: "6", element: "earth", cost: 45, cd: 4.5, color: "#c9a26b", icon: "🪨",
    desc: "Call a boulder after a short delay. Crushes and stuns ground foes, SHATTERS frozen ones, and leaves rubble walls." },
];

export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  hp: number;
  speed: number;
  r: number;
  cost: number;
  minWave: number;
  gate: number;
  wallDps: number;
  range: number;
  flying?: boolean;
  boss?: boolean;
  res: Partial<Record<Element, number>>;
  immune?: string[];
  kb: number;
  frz: number;
  desc: string;
  tip: string;
}

export const ENEMIES: Record<string, EnemyDef> = {
  footman: { id: "footman", name: "Footman", icon: "🗡️", color: "#c9b79a", hp: 62, speed: 34, r: 7, cost: 10, minWave: 1, gate: 1, wallDps: 9, range: 0,
    res: {}, kb: 1, frz: 1, desc: "Basic infantry. Hacks at walls that block the road.", tip: "Cheap fodder. Rain + Lightning clears packs." },
  scout: { id: "scout", name: "Raider Scout", icon: "🏹", color: "#8fd06a", hp: 34, speed: 72, r: 6, cost: 8, minWave: 2, gate: 1, wallDps: 5, range: 0,
    res: {}, kb: 1.3, frz: 1, desc: "Fast and fragile. Sprints for the gate.", tip: "Walls & Blizzard slow them. Gale sends them tumbling." },
  sapper: { id: "sapper", name: "Powder Sapper", icon: "💣", color: "#d98a4a", hp: 48, speed: 52, r: 7, cost: 15, minWave: 3, gate: 1, wallDps: 0, range: 0,
    res: { fire: 1.5 }, kb: 1, frz: 1, desc: "Runs at walls and detonates, wrecking every wall nearby.", tip: "Kill them before they reach walls. Burning sappers explode and hurt their friends!" },
  ironclad: { id: "ironclad", name: "Ironclad", icon: "🛡️", color: "#9aa7bd", hp: 190, speed: 25, r: 9, cost: 26, minWave: 4, gate: 2, wallDps: 14, range: 0,
    res: { storm: 1.5, frost: 0.9, phys: 0.7, wind: 0.5 }, kb: 0.5, frz: 1, desc: "Heavy plate armor conducts lightning terribly well.", tip: "Lightning does +50% damage. Wind barely moves them." },
  wyvern: { id: "wyvern", name: "Ash Wyvern", icon: "🐉", color: "#b86bd6", hp: 84, speed: 56, r: 8, cost: 20, minWave: 4, gate: 2, wallDps: 0, range: 0, flying: true,
    res: { storm: 1.3, earth: 0 }, kb: 1.4, frz: 1, desc: "Flies over walls and cliffs straight to the gate.", tip: "Walls & Rockfall can't touch it. Lightning and Gale can." },
  pyromancer: { id: "pyromancer", name: "Ember Mage", icon: "🔮", color: "#ff6a3d", hp: 76, speed: 30, r: 7, cost: 24, minWave: 6, gate: 2, wallDps: 24, range: 100,
    res: { fire: 0.15, water: 1.5, frost: 1.4 }, immune: ["burn"], kb: 1, frz: 1, desc: "Hurls fireballs at walls from range.", tip: "Immune to burning. Frost and water hurt it badly." },
  warcaller: { id: "warcaller", name: "Warcaller", icon: "📯", color: "#e8c34a", hp: 120, speed: 30, r: 8, cost: 36, minWave: 7, gate: 2, wallDps: 8, range: 0,
    res: {}, kb: 0.8, frz: 1, desc: "Banner bearer. Nearby allies march 30% faster and hit walls harder.", tip: "Priority target: kill or freeze it to break the aura." },
  ogre: { id: "ogre", name: "Frost Ogre", icon: "👹", color: "#7aa0b8", hp: 560, speed: 21, r: 13, cost: 62, minWave: 8, gate: 5, wallDps: 46, range: 0,
    res: { frost: 0.4, fire: 1.4, wind: 0.3 }, immune: [], kb: 0.25, frz: 0.45, desc: "A towering brute that smashes walls.", tip: "Resists frost and wind. Burn it and strike while wet." },
  warlord: { id: "warlord", name: "Warlord Gorrak", icon: "👑", color: "#d94a4a", hp: 2600, speed: 23, r: 15, cost: 0, minWave: 5, gate: 12, wallDps: 60, range: 0, boss: true,
    res: { wind: 0.2 }, kb: 0.1, frz: 0.4, desc: "BOSS. Calls reinforcements, then enrages at half health.", tip: "Reinforcements pour in: control the crowd while you burst the Warlord." },
  colossus: { id: "colossus", name: "Siege Colossus", icon: "🗿", color: "#8a8f9c", hp: 5200, speed: 16, r: 17, cost: 0, minWave: 10, gate: 18, wallDps: 0, range: 0, boss: true,
    res: { wind: 0.1, storm: 0.8 }, kb: 0, frz: 0.35, desc: "BOSS. Stone Hide halves damage. Smashes all walls around it.", tip: "FREEZE it to crack its hide, then Rockfall to shatter." },
  tyrant: { id: "tyrant", name: "Tyrant Vael", icon: "🌑", color: "#8f4bd6", hp: 7600, speed: 20, r: 16, cost: 0, minWave: 15, gate: 30, wallDps: 80, range: 0, boss: true,
    res: { wind: 0.1 }, kb: 0, frz: 0.35, desc: "BOSS. Elemental Ward rotates. Summons wyverns at 75%, 45%, 20%.", tip: "Hit the OPPOSITE of its ward element for 1.7x; its ward element only does 25%." },
};

export const BOSS_CYCLE = ["warlord", "colossus", "tyrant"];
export const WARD_WEAK: Record<string, Element> = { fire: "frost", frost: "fire", storm: "earth", earth: "storm" };
export const WARD_LIST = ["fire", "frost", "storm", "earth"];

export interface WeatherDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
}
export const WEATHER: Record<string, WeatherDef> = {
  clear: { id: "clear", name: "Clear Night", icon: "🌙", desc: "Calm skies. Mana regenerates 10% faster.", color: "#9ab" },
  rain: { id: "rain", name: "Thunderstorm", icon: "⛈️", desc: "Everything is soaked. Lightning +25%, fire -30% and burns fizzle.", color: "#59b8ff" },
  snow: { id: "snow", name: "Snowfall", icon: "🌨️", desc: "Enemies are chilled (slowed). Frost +25%. Walls are cheaper.", color: "#cfeaff" },
  ember: { id: "ember", name: "Ashfall", icon: "🌋", desc: "Fire +30%, but mana regenerates 15% slower.", color: "#ff8a4a" },
  gale: { id: "gale", name: "Howling Gale", icon: "💨", desc: "Wind +50%. Flyers are 25% faster. Enemies are pushed more easily.", color: "#bff7d6" },
};

export interface Difficulty {
  id: string;
  name: string;
  desc: string;
  hp: number;
  count: number;
  gate: number;
  regen: number;
  aether: number;
  color: string;
}
export const DIFFICULTIES: Difficulty[] = [
  { id: "apprentice", name: "Apprentice", desc: "Weaker armies, a sturdier gate, faster mana. Learn the storm.", hp: 0.8, count: 0.8, gate: 40, regen: 1.15, aether: 0.7, color: "#7fe0a0" },
  { id: "stormcaller", name: "Stormcaller", desc: "The intended challenge. Hold the pass for 15 waves.", hp: 1, count: 1, gate: 30, regen: 1, aether: 1, color: "#7fb0ff" },
  { id: "archmage", name: "Archmage", desc: "Hardened legions, a fragile gate, stingy mana.", hp: 1.3, count: 1.25, gate: 20, regen: 0.9, aether: 1.7, color: "#ff8a8a" },
];

export interface Mutator {
  id: string;
  name: string;
  icon: string;
  desc: string;
  aether: number;
}
export const MUTATORS: Mutator[] = [
  { id: "frenzy", name: "Frenzy", icon: "💢", desc: "Enemies move 25% faster.", aether: 0.25 },
  { id: "drought", name: "Drought", icon: "🏜️", desc: "Mana regeneration -35%.", aether: 0.25 },
  { id: "ironhide", name: "Ironhide", icon: "🔩", desc: "Enemies have +40% health.", aether: 0.3 },
  { id: "brittle", name: "Brittle Stone", icon: "🧱", desc: "Walls have 40% less health.", aether: 0.2 },
  { id: "horde", name: "Endless Horde", icon: "👥", desc: "50% more enemies per wave.", aether: 0.35 },
];

/* ---------------- Mods (research + relics) ---------------- */

export interface Mods {
  unlocked: string[];
  lightningMult: number; chain: number; wetBonus: number; echo: number; tempestGain: number; tempestDur: number;
  frozenDur: number; shatter: number; frostMult: number; blizzardR: number; rime: boolean;
  burnMult: number; wildfire: boolean; ember: boolean;
  rainDur: number; wetVuln: number; rainStrike: boolean;
  galeForce: number; galeImpact: number;
  rockMult: number; rockR: number; rubble: number;
  wallHp: number; wallCost: number; stoneCap: number; stoneRegen: number; stoneKill: number; pylon: boolean;
  maxMana: number; manaRegen: number; gateHp: number; gateHeal: number;
  harmonyCap: number; harmonyBonus: number; cdMult: number; costMult: number; startRelic: boolean;
}

export function baseMods(): Mods {
  return {
    unlocked: ["lightning", "rain", "blizzard", "rockfall"],
    lightningMult: 1, chain: 3, wetBonus: 1.5, echo: 0, tempestGain: 1, tempestDur: 8,
    frozenDur: 1.8, shatter: 2, frostMult: 1, blizzardR: 1, rime: false,
    burnMult: 1, wildfire: false, ember: false,
    rainDur: 7, wetVuln: 1, rainStrike: false,
    galeForce: 1, galeImpact: 25,
    rockMult: 1, rockR: 1, rubble: 1,
    wallHp: 1, wallCost: 2, stoneCap: 60, stoneRegen: 0.45, stoneKill: 0.35, pylon: false,
    maxMana: 100, manaRegen: 8.5, gateHp: 0, gateHeal: 0,
    harmonyCap: 4, harmonyBonus: 0.08, cdMult: 1, costMult: 1, startRelic: false,
  };
}

export type Branch = "storm" | "frost" | "flame" | "stone" | "spirit";
export interface ResNode {
  id: string;
  name: string;
  icon: string;
  branch: Branch;
  desc: string;
  costs: number[];
  req?: string;
}

export const BRANCHES: { id: Branch; name: string; color: string; icon: string }[] = [
  { id: "storm", name: "Tempest", color: "#ffe85c", icon: "⚡" },
  { id: "frost", name: "Rime", color: "#9ff0ff", icon: "❄️" },
  { id: "flame", name: "Ember", color: "#ff7a2e", icon: "🔥" },
  { id: "stone", name: "Bedrock", color: "#c9a26b", icon: "🪨" },
  { id: "spirit", name: "Spirit", color: "#c9a6ff", icon: "✨" },
];

export const RESEARCH: ResNode[] = [
  { id: "s1", name: "Conductive Air", icon: "⚡", branch: "storm", desc: "+15% lightning damage per level.", costs: [8, 12, 18] },
  { id: "s2", name: "Forked Bolt", icon: "🌩️", branch: "storm", desc: "+1 lightning chain jump per level.", costs: [12, 18, 26], req: "s1" },
  { id: "s3", name: "Tempest Heart", icon: "💠", branch: "storm", desc: "+35% Tempest meter gain per level.", costs: [20, 30], req: "s2" },
  { id: "s4", name: "Static Field", icon: "🔋", branch: "storm", desc: "Wet enemies conduct +0.3x extra lightning damage.", costs: [36], req: "s3" },
  { id: "f1", name: "Deep Chill", icon: "🧊", branch: "frost", desc: "+0.4s freeze duration per level.", costs: [8, 12, 18] },
  { id: "f2", name: "Rime Walls", icon: "🏔️", branch: "frost", desc: "Walls chill adjacent enemies, slowing them.", costs: [20], req: "f1" },
  { id: "f3", name: "Absolute Zero", icon: "🥶", branch: "frost", desc: "+15% blizzard radius and +20% frost damage per level.", costs: [18, 28], req: "f1" },
  { id: "f4", name: "Glacial Shatter", icon: "💎", branch: "frost", desc: "Shatter combo deals +0.75x extra damage.", costs: [34], req: "f3" },
  { id: "fl0", name: "Ember Rites", icon: "🔥", branch: "flame", desc: "UNLOCK the Firestorm spell (key 4).", costs: [10] },
  { id: "fl1", name: "Kindling", icon: "🕯️", branch: "flame", desc: "+25% burn damage per level.", costs: [10, 16, 24], req: "fl0" },
  { id: "fl2", name: "Ember Walls", icon: "🧱", branch: "flame", desc: "Walls scorch adjacent enemies.", costs: [22], req: "fl1" },
  { id: "fl3", name: "Wildfire", icon: "🌋", branch: "flame", desc: "Burning enemies spread fire when they die.", costs: [26], req: "fl1" },
  { id: "t1", name: "Quarrying", icon: "⛏️", branch: "stone", desc: "+20 max stone and +0.3 stone/sec per level.", costs: [8, 12, 18] },
  { id: "t2", name: "Reinforced Walls", icon: "🛡️", branch: "stone", desc: "+30% wall health per level.", costs: [10, 16, 24], req: "t1" },
  { id: "t3", name: "Rubble Rain", icon: "🏗️", branch: "stone", desc: "Rockfall leaves +2 extra rubble walls per level.", costs: [20, 30], req: "t2" },
  { id: "t4", name: "Seismic Might", icon: "🌍", branch: "stone", desc: "+25% rockfall damage per level.", costs: [16, 26], req: "t2" },
  { id: "p1", name: "Aether Attunement", icon: "🔮", branch: "spirit", desc: "+15 max mana and +1.2 mana/sec per level.", costs: [8, 12, 18] },
  { id: "p2", name: "Keep Blessing", icon: "🏰", branch: "spirit", desc: "+6 gate health per level.", costs: [10, 16, 24], req: "p1" },
  { id: "p3", name: "Harmony", icon: "🎶", branch: "spirit", desc: "Element Harmony: +1 max stack and +3% per stack per level.", costs: [16, 26], req: "p1" },
  { id: "p4", name: "Provisioner", icon: "📜", branch: "spirit", desc: "Start every run with a free relic draft.", costs: [30], req: "p2" },
  { id: "w0", name: "Windcaller", icon: "🌪️", branch: "spirit", desc: "UNLOCK the Gale Burst spell (key 5).", costs: [10] },
  { id: "w1", name: "Gale Force", icon: "💨", branch: "spirit", desc: "+30% gale knockback and +20 impact damage per level.", costs: [14, 22], req: "w0" },
];

export type Rarity = "common" | "rare" | "epic";
export interface Relic {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  desc: string;
  apply: (m: Mods) => void;
}

export const RELICS: Relic[] = [
  { id: "stormglass", name: "Stormglass Prism", icon: "🔷", rarity: "common", desc: "Lightning chains +2 times and deals +10% damage.", apply: (m) => { m.chain += 2; m.lightningMult += 0.1; } },
  { id: "tidebowl", name: "Tidecaller's Bowl", icon: "🥣", rarity: "common", desc: "Rain lasts 50% longer. Wet enemies take +15% damage from everything.", apply: (m) => { m.rainDur *= 1.5; m.wetVuln += 0.15; } },
  { id: "cinder", name: "Cinder Heart", icon: "❤️‍🔥", rarity: "rare", desc: "Burning deals +60% damage and spreads on death.", apply: (m) => { m.burnMult += 0.6; m.wildfire = true; } },
  { id: "anvil", name: "Frostbound Anvil", icon: "⚒️", rarity: "rare", desc: "Walls chill nearby enemies. Freezes last 0.8s longer.", apply: (m) => { m.rime = true; m.frozenDur += 0.8; } },
  { id: "granite", name: "Granite Crown", icon: "👑", rarity: "common", desc: "Walls have +50% health and cost 1 less stone.", apply: (m) => { m.wallHp += 0.5; m.wallCost = Math.max(1, m.wallCost - 1); } },
  { id: "manawell", name: "Mana Well", icon: "🫙", rarity: "common", desc: "+30 max mana, +2 mana regen per second.", apply: (m) => { m.maxMana += 30; m.manaRegen += 2; } },
  { id: "echo", name: "Echoing Thunder", icon: "📢", rarity: "rare", desc: "30% chance Lightning echoes a second free strike.", apply: (m) => { m.echo += 0.3; } },
  { id: "windsigil", name: "Wind Sigil", icon: "🧭", rarity: "common", desc: "Gale pushes 50% harder and impacts deal +40 damage.", apply: (m) => { m.galeForce += 0.5; m.galeImpact += 40; } },
  { id: "quarry", name: "Quarry Spirit", icon: "👻", rarity: "common", desc: "Kills yield triple stone.", apply: (m) => { m.stoneKill *= 3; } },
  { id: "keystone", name: "Aegis Keystone", icon: "🗝️", rarity: "rare", desc: "+10 gate health now. Heals 2 gate health after each wave.", apply: (m) => { m.gateHp += 10; m.gateHeal += 2; } },
  { id: "shatterstone", name: "Shatterstone", icon: "💥", rarity: "rare", desc: "Shatter deals +1.0x extra damage. Rockfall radius +20%.", apply: (m) => { m.shatter += 1; m.rockR += 0.2; } },
  { id: "banners", name: "Ember Banners", icon: "🚩", rarity: "rare", desc: "Walls scorch adjacent enemies.", apply: (m) => { m.ember = true; } },
  { id: "pylons", name: "Storm Pylons", icon: "🗼", rarity: "epic", desc: "Walls zap adjacent WET enemies with lightning every second.", apply: (m) => { m.pylon = true; } },
  { id: "hourglass", name: "Surge Hourglass", icon: "⏳", rarity: "rare", desc: "All spell cooldowns are 25% shorter.", apply: (m) => { m.cdMult *= 0.75; } },
  { id: "miser", name: "Aether Miser", icon: "🪙", rarity: "rare", desc: "All spells cost 20% less mana.", apply: (m) => { m.costMult *= 0.8; } },
  { id: "eye", name: "Eye of the Tempest", icon: "👁️", rarity: "epic", desc: "Tempest meter fills twice as fast. Tempest Call lasts 4s longer.", apply: (m) => { m.tempestGain *= 2; m.tempestDur += 4; } },
  { id: "thunderhead", name: "Thunderhead", icon: "☁️", rarity: "epic", desc: "Rain clouds randomly call lightning down on soaked enemies.", apply: (m) => { m.rainStrike = true; } },
  { id: "harmonic", name: "Harmonic Crystal", icon: "🔔", rarity: "epic", desc: "+2 max Harmony stacks, and each stack gives +4% damage.", apply: (m) => { m.harmonyCap += 2; m.harmonyBonus += 0.04; } },
];

export function buildMods(levels: Record<string, number>, relics: string[], tutorial = false): Mods {
  const m = baseMods();
  const L = (id: string) => levels[id] || 0;
  if (L("fl0")) m.unlocked.push("firestorm");
  if (L("w0")) m.unlocked.push("gale");
  if (tutorial) m.unlocked = ["lightning", "rain", "blizzard", "firestorm", "gale", "rockfall"];
  m.lightningMult += 0.15 * L("s1");
  m.chain += L("s2");
  m.tempestGain += 0.35 * L("s3");
  m.wetBonus += 0.3 * L("s4");
  m.frozenDur += 0.4 * L("f1");
  if (L("f2")) m.rime = true;
  m.blizzardR += 0.15 * L("f3");
  m.frostMult += 0.2 * L("f3");
  m.shatter += 0.75 * L("f4");
  m.burnMult += 0.25 * L("fl1");
  if (L("fl2")) m.ember = true;
  if (L("fl3")) m.wildfire = true;
  m.stoneCap += 20 * L("t1");
  m.stoneRegen += 0.3 * L("t1");
  m.wallHp += 0.3 * L("t2");
  m.rubble += 2 * L("t3");
  m.rockMult += 0.25 * L("t4");
  m.maxMana += 15 * L("p1");
  m.manaRegen += 1.2 * L("p1");
  m.gateHp += 6 * L("p2");
  m.harmonyCap += L("p3");
  m.harmonyBonus += 0.03 * L("p3");
  if (L("p4")) m.startRelic = true;
  m.galeForce += 0.3 * L("w1");
  m.galeImpact += 20 * L("w1");
  for (const id of relics) {
    const r = RELICS.find((x) => x.id === id);
    if (r) r.apply(m);
  }
  return m;
}

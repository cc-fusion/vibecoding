export type Tag = "feral" | "scale" | "chitin" | "plume" | "void";
export type SlotKind = "head" | "torso" | "limbs" | "tail";
export const SLOTS: SlotKind[] = ["head", "torso", "limbs", "tail"];
export const SLOT_LABEL: Record<SlotKind, string> = { head: "Head", torso: "Torso", limbs: "Limbs", tail: "Tail" };
export const ROW_NAMES = ["Front", "Middle", "Back"];
export const TAGS: Tag[] = ["feral", "scale", "chitin", "plume", "void"];

export const TAG_META: Record<Tag, { name: string; color: string; icon: string; blurb: string }> = {
  feral: { name: "Feral", color: "#ff8a3d", icon: "🐺", blurb: "Raw offense. Bonus attack and crits." },
  scale: { name: "Scale", color: "#34d399", icon: "🐉", blurb: "Armored bulk. Health, armor and reflection." },
  chitin: { name: "Chitin", color: "#c8e64a", icon: "🦂", blurb: "Poison damage over time that spreads." },
  plume: { name: "Plume", color: "#5cc8ff", icon: "🦅", blurb: "Speed and evasion. Strikes first, rarely hit." },
  void: { name: "Void", color: "#a65cff", icon: "🌀", blurb: "Life-drain, shields and soul reaping." },
};

export interface PartDef {
  id: string;
  name: string;
  slot: SlotKind;
  tag: Tag;
  rarity: 1 | 2 | 3;
  row: 0 | 1 | 2; // resonance row
  hp: number;
  atk: number;
  spd: number;
  def: number;
  fx: string;
  v: number;
  icon: string;
  unlock: number; // essence cost, 0 = starter
}

const P = (
  id: string, name: string, slot: SlotKind, tag: Tag, rarity: 1 | 2 | 3, row: 0 | 1 | 2,
  s: { hp?: number; atk?: number; spd?: number; def?: number }, fx: string, v: number, icon: string, unlock = 0,
): PartDef => ({ id, name, slot, tag, rarity, row, hp: s.hp ?? 0, atk: s.atk ?? 0, spd: s.spd ?? 0, def: s.def ?? 0, fx, v, icon, unlock });

export const PART_LIST: PartDef[] = [
  // HEADS
  P("wolf_head", "Dire Wolf Skull", "head", "feral", 1, 0, { atk: 3 }, "crit", 0.15, "🐺"),
  P("drake_head", "Ember Drake Maw", "head", "scale", 2, 1, { atk: 3, hp: 8 }, "breath", 0.5, "🐲"),
  P("mantis_head", "Mantis Lobe", "head", "chitin", 1, 1, { atk: 2, hp: 5 }, "venom", 3, "🦗"),
  P("owl_head", "Hawk-Eye Skull", "head", "plume", 1, 2, { atk: 2, spd: 0.1 }, "snipe", 1, "🦉"),
  P("maw_head", "Voidmaw", "head", "void", 2, 1, { atk: 4 }, "leech", 0.25, "👁️", 12),
  // TORSOS
  P("bear_torso", "Cave Bear Chest", "torso", "feral", 1, 0, { hp: 40 }, "regen", 1.5, "🐻"),
  P("drake_torso", "Plated Drake Hide", "torso", "scale", 1, 0, { hp: 30, def: 2 }, "reflect", 0.2, "🦎"),
  P("carapace", "Chitin Carapace", "torso", "chitin", 1, 1, { hp: 25, def: 2 }, "toxic", 2, "🪲"),
  P("plume_torso", "Stormfeather Breast", "torso", "plume", 2, 2, { hp: 22, spd: 0.08 }, "dodge", 0.15, "🪶"),
  P("void_torso", "Singularity Core", "torso", "void", 3, 1, { hp: 30 }, "barrier", 25, "🕳️", 30),
  // LIMBS
  P("claws", "Rending Claws", "limbs", "feral", 1, 0, { atk: 4 }, "pierce", 0.4, "🐾"),
  P("scale_arms", "Gauntlet Fists", "limbs", "scale", 2, 0, { atk: 3, def: 1 }, "slam", 0.25, "👊", 12),
  P("scythes", "Scythe Arms", "limbs", "chitin", 2, 1, { atk: 3 }, "cleave", 0.5, "🦀"),
  P("talons", "Raptor Talons", "limbs", "plume", 1, 1, { atk: 2, spd: 0.12 }, "rampage", 0.06, "🦶"),
  P("tentacles", "Void Tentacles", "limbs", "void", 1, 2, { atk: 2, hp: 8 }, "weaken", 0.2, "🐙"),
  // TAILS
  P("wolf_tail", "Alpha's Brush", "tail", "feral", 1, 2, { atk: 1, hp: 6 }, "howl", 0.08, "🦊"),
  P("drake_tail", "Guardian Tail", "tail", "scale", 1, 1, { hp: 10, def: 1 }, "ward", 8, "🐊"),
  P("stinger", "Scorpion Stinger", "tail", "chitin", 1, 2, { atk: 2 }, "potent", 0.15, "🦂"),
  P("peacock", "Prism Plume Tail", "tail", "plume", 2, 1, { atk: 1, spd: 0.05 }, "inspire", 0.15, "🦚", 16),
  P("void_tail", "Hex Tail", "tail", "void", 2, 0, { atk: 1, hp: 8 }, "deathblast", 1.5, "☄️", 20),
];

export const PARTS: Record<string, PartDef> = Object.fromEntries(PART_LIST.map((p) => [p.id, p]));

export const STAT_MULT = [1, 1, 2.2, 4];
export const FX_MULT = [1, 1, 1.6, 2.4];
export const RARITY_COST = [0, 3, 4, 5];
export const RESONANCE = 1.5;

const pc = (v: number) => `${Math.round(v * 100)}%`;
const nn = (v: number) => `${Math.round(v * 10) / 10}`;
export const FX_TEXT: Record<string, (v: number) => string> = {
  crit: (v) => `${pc(v)} chance to crit (×2 damage)`,
  breath: (v) => `Every 3rd attack breathes fire on ALL enemies for ${pc(v)} ATK`,
  venom: (v) => `Hits inflict ${nn(v)} poison`,
  snipe: () => `Targets the lowest-HP enemy`,
  leech: (v) => `Heals ${pc(v)} of damage dealt`,
  regen: (v) => `Regenerates ${nn(v)} HP/s`,
  reflect: (v) => `Reflects ${pc(v)} of damage taken`,
  toxic: (v) => `Attackers are poisoned (${nn(v)})`,
  dodge: (v) => `${pc(v)} chance to dodge`,
  barrier: (v) => `Starts battle with ${nn(v)} shield`,
  pierce: (v) => `Ignores ${pc(v)} of enemy armor`,
  slam: (v) => `${pc(v)} chance to stun target 1s`,
  cleave: (v) => `Also hits a neighboring enemy for ${pc(v)} damage`,
  rampage: (v) => `+${pc(v)} attack speed per hit (max 10)`,
  howl: (v) => `All allies gain +${pc(v)} ATK`,
  ward: (v) => `Shields the ally BEHIND for ${nn(v)} every 6s`,
  potent: (v) => `Poison you inflict hurts ${pc(v)} more`,
  inspire: (v) => `Adjacent allies gain +${pc(v)} attack speed`,
  deathblast: (v) => `On death, blasts all enemies for ${pc(v)} ATK`,
  weaken: (v) => `Hits weaken target by ${pc(v)} for 3s`,
};

export function partFx(def: PartDef, tier: number, boost = 1) {
  return def.v * FX_MULT[tier] * boost;
}
export function partDesc(def: PartDef, tier: number) {
  return FX_TEXT[def.fx](partFx(def, tier));
}
export function partStats(def: PartDef, tier: number, boost = 1) {
  const m = STAT_MULT[tier] * boost;
  return { hp: Math.round(def.hp * m), atk: Math.round(def.atk * m * 10) / 10, spd: def.spd * m, def: Math.round(def.def * m * 10) / 10 };
}

export interface Mods {
  atkPct: number; hpPct: number; spdPct: number; def: number; crit: number; dodge: number;
  leech: number; shield: number; venom: number; potent: number; reflect: number;
  bloodlust: number; infest: number; reap: number;
}
export const ZERO_MODS: Mods = { atkPct: 0, hpPct: 0, spdPct: 0, def: 0, crit: 0, dodge: 0, leech: 0, shield: 0, venom: 0, potent: 0, reflect: 0, bloodlust: 0, infest: 0, reap: 0 };

export interface SynTier { n: number; text: string; mod: Partial<Mods> }
export const SYNERGIES: Record<Tag, SynTier[]> = {
  feral: [
    { n: 2, text: "+15% ATK", mod: { atkPct: 0.15 } },
    { n: 4, text: "+35% ATK, +10% crit", mod: { atkPct: 0.35, crit: 0.1 } },
    { n: 6, text: "+60% ATK, +20% crit, Bloodlust (+50% speed under half HP)", mod: { atkPct: 0.6, crit: 0.2, bloodlust: 1 } },
  ],
  scale: [
    { n: 2, text: "+15% HP", mod: { hpPct: 0.15 } },
    { n: 4, text: "+30% HP, +2 armor", mod: { hpPct: 0.3, def: 2 } },
    { n: 6, text: "+50% HP, +4 armor, reflect 15%", mod: { hpPct: 0.5, def: 4, reflect: 0.15 } },
  ],
  chitin: [
    { n: 2, text: "+1 poison on hit", mod: { venom: 1 } },
    { n: 4, text: "+2 poison on hit, poison +10% stronger", mod: { venom: 2, potent: 0.1 } },
    { n: 6, text: "+3 poison, +20% stronger, Infest: dying poisoned foes spread it", mod: { venom: 3, potent: 0.2, infest: 1 } },
  ],
  plume: [
    { n: 2, text: "+15% attack speed", mod: { spdPct: 0.15 } },
    { n: 4, text: "+25% speed, 10% dodge", mod: { spdPct: 0.25, dodge: 0.1 } },
    { n: 6, text: "+40% speed, 20% dodge", mod: { spdPct: 0.4, dodge: 0.2 } },
  ],
  void: [
    { n: 2, text: "10% lifesteal", mod: { leech: 0.1 } },
    { n: 4, text: "15% lifesteal, +15 shield", mod: { leech: 0.15, shield: 15 } },
    { n: 6, text: "25% lifesteal, +30 shield, Reaping: heal 15% HP on any kill", mod: { leech: 0.25, shield: 30, reap: 1 } },
  ],
};

export interface Difficulty { id: string; name: string; desc: string; enemyMult: number; lives: number; gold: number; essence: number; color: string }
export const DIFFICULTIES: Difficulty[] = [
  { id: "apprentice", name: "Apprentice", desc: "Gentle foes, generous scrap, 6 lives.", enemyMult: 0.75, lives: 6, gold: 14, essence: 0.7, color: "#34d399" },
  { id: "journeyman", name: "Journeyman", desc: "The intended gauntlet. 5 lives.", enemyMult: 0.92, lives: 5, gold: 12, essence: 1, color: "#5cc8ff" },
  { id: "artisan", name: "Artisan", desc: "Stronger packs and lean funds. 4 lives.", enemyMult: 1.15, lives: 4, gold: 10, essence: 1.5, color: "#ff8a3d" },
  { id: "grandmaster", name: "Grandmaster", desc: "Brutal beasts. 3 lives. Glory awaits.", enemyMult: 1.4, lives: 3, gold: 9, essence: 2.2, color: "#ef4444" },
];

export interface Mutagen { id: string; name: string; desc: string; mult: number; icon: string }
export const MUTAGENS: Mutagen[] = [
  { id: "glass", name: "Glass Chimeras", desc: "Every beast (both sides): +40% ATK, -30% HP. Fights end fast.", mult: 1.2, icon: "🔮" },
  { id: "scarce", name: "Scarce Scrap", desc: "-1 gold income every round.", mult: 1.25, icon: "🪙" },
  { id: "fog", name: "Fog of War", desc: "Enemy previews are hidden until battle.", mult: 1.15, icon: "🌫️" },
  { id: "hungry", name: "Hungry Forge", desc: "Rerolls cost 2. Forge upgrades cost +2.", mult: 1.15, icon: "🔥" },
  { id: "apex", name: "Apex Predators", desc: "Enemies field higher-tier parts.", mult: 1.4, icon: "💀" },
];

export interface LabUpgrade { id: string; name: string; desc: string; costs: number[]; icon: string }
export const LAB_UPGRADES: LabUpgrade[] = [
  { id: "gold", name: "Seed Capital", desc: "+1 starting gold per level.", costs: [6, 10, 15, 22], icon: "💰" },
  { id: "life", name: "Spare Heart", desc: "+1 life per level.", costs: [20, 40], icon: "❤️" },
  { id: "bench", name: "Deep Cradle", desc: "+1 bench slot per level.", costs: [8, 14, 20], icon: "📦" },
  { id: "reroll", name: "Free Reroll", desc: "The first reroll each round is free.", costs: [14], icon: "🎲" },
  { id: "interest", name: "Compound Interest", desc: "+1 max interest gold per level.", costs: [12, 20, 30], icon: "📈" },
  { id: "vigor", name: "Vital Marrow", desc: "+4% chimera HP per level.", costs: [8, 12, 16, 22, 30], icon: "🦴" },
  { id: "fang", name: "Sharpened Fang", desc: "+3% chimera ATK per level.", costs: [8, 12, 16, 22, 30], icon: "🦷" },
  { id: "salvage", name: "Salvage Rights", desc: "+1 gold when selling parts per level.", costs: [10, 25], icon: "🔧" },
];

export interface Archetype { id: string; name: string; tag: Tag | null; blurb: string }
export const ARCHETYPES: Archetype[] = [
  { id: "pack", name: "Howling Pack", tag: "feral", blurb: "Fast, hard-hitting predators." },
  { id: "wall", name: "Scale Wall", tag: "scale", blurb: "Armored bulk that reflects damage." },
  { id: "swarm", name: "Hive Swarm", tag: "chitin", blurb: "Poison stacks that melt tanks." },
  { id: "flock", name: "Storm Flock", tag: "plume", blurb: "Evasive and relentlessly quick." },
  { id: "cult", name: "Void Cult", tag: "void", blurb: "Lifedrainers wrapped in shields." },
  { id: "mongrel", name: "Mongrel Horde", tag: null, blurb: "Stitched from everything. Unpredictable." },
];

export interface BossDef {
  id: string; name: string; title: string; tag: Tag; pos: number; skill: string; skillDesc: string;
  hpMult: number; atkMult: number; color: string;
}
export const BOSSES: BossDef[] = [
  { id: "matriarch", name: "Ironhide Matriarch", title: "The Armored Mother", tag: "scale", pos: 0, skill: "Stoneskin", skillDesc: "Every 6s she grows a shield worth 25% of her max HP.", hpMult: 2.1, atkMult: 1.15, color: "#34d399" },
  { id: "tyrant", name: "Hive Tyrant", title: "Lord of the Spore Choir", tag: "chitin", pos: 1, skill: "Spore Cloud", skillDesc: "Every 5s a cloud inflicts heavy poison on all your chimeras.", hpMult: 2.3, atkMult: 1.15, color: "#c8e64a" },
  { id: "prime", name: "The Prime Chimera", title: "Origin of All Stitched Things", tag: "void", pos: 1, skill: "Cataclysm", skillDesc: "Every 7s a telegraphed blast hits everyone. Shifts phase at 66% and 33% HP: heals, shockwaves and enrages.", hpMult: 3, atkMult: 1.25, color: "#a65cff" },
];

export const NAMES = ["Scrapjaw", "Bonecrown", "Nightmoth", "Gristle", "Ashmaw", "Vexwing", "Rotclaw", "Mawlet", "Cinderhide"];
export const FINAL_ROUND = 15; // campaign length; endless mode follows
export const FORGE_COSTS = [0, 6, 8, 10];
export const SHOP_WEIGHTS = [[88, 12, 0], [60, 35, 5], [35, 45, 20], [20, 40, 40]];

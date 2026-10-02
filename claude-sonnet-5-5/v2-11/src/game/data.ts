export type CardType = "hymn" | "gloss" | "ward" | "wrath" | "vow";
export type Rarity = "common" | "uncommon" | "rare";

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  cost: number;
  icon: string;
  text: string;
  p: Record<string, number>;
  up: Record<string, number>;
  exhaust?: boolean;
  unlock?: number; // ash cost in the Reliquary; undefined = available from the start
}

export interface CardInst {
  uid: number;
  id: string;
  up: boolean;
}

export const TYPE_META: Record<CardType, { label: string; color: string; glow: string; blurb: string }> = {
  hymn: { label: "Hymn", color: "#52e5ff", glow: "rgba(82,229,255,0.5)", blurb: "Rewrites your firing pattern for a time." },
  gloss: { label: "Gloss", color: "#b78bff", glow: "rgba(183,139,255,0.5)", blurb: "Annotates your shots with a new property." },
  ward: { label: "Ward", color: "#f6d37a", glow: "rgba(246,211,122,0.5)", blurb: "Shields, barriers and protective fields." },
  wrath: { label: "Wrath", color: "#ff4d6d", glow: "rgba(255,77,109,0.5)", blurb: "Bombs that erase bullets and smite foes." },
  vow: { label: "Vow", color: "#7dffb0", glow: "rgba(125,255,176,0.5)", blurb: "Utility: draw, faith, healing, time." },
};

const C = (
  id: string, name: string, type: CardType, rarity: Rarity, cost: number, icon: string, text: string,
  p: Record<string, number>, up: Record<string, number>, extra: Partial<CardDef> = {}
): CardDef => ({ id, name, type, rarity, cost, icon, text, p, up, ...extra });

export const CARDS: CardDef[] = [
  // HYMNS
  C("aspersion", "Aspersion", "hymn", "common", 2, "✦", "A fan of {n} holy shots for {dur}s. Focus tightens the fan.", { dur: 14, n: 5, dmg: 1.5, rate: 7 }, { n: 7, dur: 18 }),
  C("needle", "Needle Psalm", "hymn", "common", 2, "⟊", "Rapid needle volleys ({dmg} dmg) for {dur}s. Brutal when focused.", { dur: 12, dmg: 2.2, rate: 13 }, { dmg: 2.9, dur: 15 }),
  C("halo", "Halo Orbit", "hymn", "uncommon", 3, "◎", "{n} halos orbit you for {dur}s, shredding foes and devouring small bullets. Your base prayer keeps firing.", { dur: 16, n: 4, dmg: 7 }, { n: 6, dur: 20 }),
  C("seraph", "Seraph Feathers", "hymn", "uncommon", 3, "🪶", "Homing feathers ({dmg} dmg) seek foes for {dur}s.", { dur: 14, dmg: 2.2, rate: 6 }, { dur: 18, dmg: 2.9 }),
  C("lance", "Sunder Lance", "hymn", "uncommon", 3, "†", "A piercing lance ({dmg} dmg) twice a second for {dur}s.", { dur: 12, dmg: 22, rate: 1.9 }, { dmg: 32, cost: 2 }, { unlock: 150 }),
  C("rotary", "Rotary Censer", "hymn", "uncommon", 3, "☸", "A whirling censer fires {n} streams in all directions for {dur}s.", { dur: 12, n: 4, dmg: 1.5, rate: 11 }, { n: 6, dur: 15 }, { unlock: 150 }),
  C("wave", "Wave Canticle", "hymn", "common", 2, "≋", "Twin sine-wave streams sweep the field for {dur}s.", { dur: 14, dmg: 1.9, rate: 10 }, { dur: 18, dmg: 2.5 }),
  C("choir", "Choir of Many", "hymn", "rare", 4, "♬", "Two choir drones flank you, each firing a stream, for {dur}s.", { dur: 18, dmg: 1.6, rate: 9 }, { cost: 3, dur: 24 }, { unlock: 250 }),
  // GLOSSES
  C("pierce", "Piercing Light", "gloss", "common", 1, "➳", "For {dur}s, shots pierce {n} foes.", { dur: 12, n: 2 }, { n: 4, dur: 16 }),
  C("guide", "Guiding Hand", "gloss", "common", 1, "☞", "For {dur}s, shots curve toward foes.", { dur: 12 }, { dur: 18 }),
  C("cloister", "Cloister Echo", "gloss", "uncommon", 1, "⇋", "For {dur}s, shots ricochet off walls {n} times.", { dur: 12, n: 2 }, { n: 4, dur: 16 }),
  C("fission", "Fission", "gloss", "uncommon", 2, "❖", "For {dur}s, hits burst into {n} piercing shards.", { dur: 12, n: 2 }, { n: 3, dur: 16 }),
  C("cinders", "Cinders", "gloss", "common", 1, "♨", "For {dur}s, shots ignite foes for {dps} dmg/s.", { dur: 12, dps: 6 }, { dps: 10, dur: 16 }),
  C("heavy", "Heavy Censer", "gloss", "common", 1, "⬣", "For {dur}s, shots deal ×{mult} damage but fire 25% slower.", { dur: 12, mult: 1.8 }, { mult: 2.3 }),
  C("echo", "Echo of Echoes", "gloss", "rare", 2, "⫶", "For {dur}s, every shot is doubled by a trailing echo.", { dur: 12 }, { dur: 18, cost: 1 }, { unlock: 200 }),
  C("tithe_rounds", "Tithe Rounds", "gloss", "uncommon", 1, "☩", "For {dur}s, each kill grants {faith} Faith.", { dur: 14, faith: 0.15 }, { faith: 0.3 }),
  // WARDS
  C("barrier", "Barrier", "ward", "common", 2, "⛨", "Gain {n} Barrier charge (max 3). A hit pops it and purges nearby bullets.", { n: 1 }, { cost: 1 }),
  C("aegis", "Aegis", "ward", "uncommon", 3, "◈", "Invulnerable for {dur}s. Ram foes for damage.", { dur: 3 }, { dur: 4.5 }),
  C("veil", "Mirror Veil", "ward", "rare", 3, "◐", "For {dur}s, bullets entering your veil are reflected at foes.", { dur: 5 }, { dur: 8 }, { unlock: 300 }),
  C("penumbra", "Penumbra", "ward", "common", 2, "◍", "For {dur}s, bullets near you slow to 35%.", { dur: 6 }, { dur: 10 }),
  C("sanctuary", "Sanctuary", "ward", "rare", 4, "✚", "Heal 1 HP, gain a Barrier, and 2s invulnerability.", {}, { cost: 3 }, { unlock: 350 }),
  // WRATHS
  C("purge", "Purge", "wrath", "common", 3, "✹", "Erase every bullet into up to {cap} Faith. {dmg} dmg to all foes.", { cap: 3, dmg: 25 }, { dmg: 45, cap: 4 }),
  C("smite", "Smite", "wrath", "uncommon", 3, "⇑", "A column of light ({dmg} dmg, {w}px wide) rises from your ship, erasing bullets.", { dmg: 140, w: 90 }, { dmg: 220, w: 130 }),
  C("absolution", "Absolution", "wrath", "rare", 4, "❂", "An expanding ring erases bullets and deals {dmg} dmg. 2s invulnerable.", { dmg: 70 }, { cost: 3, dmg: 110 }, { unlock: 300 }),
  C("cinder_rain", "Cinder Rain", "wrath", "common", 2, "☄", "Calls {n} fire bombs ({dmg} dmg, burning) across the field.", { n: 10, dmg: 30 }, { n: 16, dmg: 40 }),
  // VOWS
  C("litany", "Litany", "vow", "common", 1, "📜", "Draw {n} cards.", { n: 2 }, { n: 3 }),
  C("fasting", "Fasting", "vow", "common", 0, "☽", "Gain {n} Faith. Exhaust.", { n: 3 }, { n: 5 }, { exhaust: true }),
  C("tithe", "Blood Tithe", "vow", "uncommon", 0, "🩸", "Lose 1 HP. Gain 5 Faith and draw {n}.", { n: 2 }, { n: 3 }, { unlock: 120 }),
  C("mend", "Mend", "vow", "uncommon", 4, "♥", "Heal 1 HP. Exhaust.", {}, { cost: 3 }, { exhaust: true }),
  C("hush", "Hush", "vow", "uncommon", 2, "⏳", "Time slows to 40% for {dur}s. You move at full speed.", { dur: 4 }, { dur: 6 }),
  C("zeal", "Zeal", "vow", "common", 1, "🔥", "+{fervor} Fervor and +30% damage for {dur}s.", { dur: 8, fervor: 25 }, { dur: 12, fervor: 40 }, { unlock: 100 }),
  C("rapture", "Rapture", "vow", "common", 1, "☀", "Faith regenerates ×2.5 for {dur}s.", { dur: 8 }, { dur: 12 }),
];

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function cardParams(inst: { id: string; up: boolean }): Record<string, number> {
  const d = CARD_MAP[inst.id];
  return inst.up ? { ...d.p, ...d.up } : { ...d.p };
}
export function cardBaseCost(inst: { id: string; up: boolean }): number {
  const d = CARD_MAP[inst.id];
  return inst.up && d.up.cost !== undefined ? d.up.cost : d.cost;
}
export function cardName(inst: { id: string; up: boolean }): string {
  return CARD_MAP[inst.id].name + (inst.up ? "+" : "");
}
export function cardText(inst: { id: string; up: boolean }): string {
  const p = cardParams(inst);
  return CARD_MAP[inst.id].text.replace(/\{(\w+)\}/g, (_, k) => (p[k] !== undefined ? String(p[k]) : "?"));
}

// ---------- RELICS ----------
export interface RelicDef { id: string; name: string; icon: string; text: string; rare?: boolean }
export const RELICS: RelicDef[] = [
  { id: "thurible", name: "Cracked Thurible", icon: "⚱", text: "Hymns last 30% longer." },
  { id: "rosary", name: "Worn Rosary", icon: "📿", text: "Draw cards 25% faster." },
  { id: "candle", name: "Votive Candle", icon: "🕯", text: "+2 max Faith." },
  { id: "halo", name: "Iron Halo", icon: "⭕", text: "+1 max HP and heal 1." },
  { id: "reliquary", name: "Gilded Reliquary", icon: "⚜", text: "+1 hand size.", rare: true },
  { id: "hairshirt", name: "Penitent's Hair-Shirt", icon: "🧵", text: "Grazing grants 60% more Faith." },
  { id: "knucklebone", name: "Saint's Knucklebone", icon: "🦴", text: "Wrath cards cost 1 less (min 1)." },
  { id: "nail", name: "Martyr's Nail", icon: "📍", text: "Begin each stage with a Barrier." },
  { id: "veil", name: "Mourning Veil", icon: "🕸", text: "When hit: gain 3 Faith and +1s invulnerability." },
  { id: "ink", name: "Glossator's Ink", icon: "🖋", text: "Glosses last 50% longer." },
  { id: "chalice", name: "Bleeding Chalice", icon: "🏆", text: "Heal 1 HP whenever a boss phase is broken.", rare: true },
  { id: "wax", name: "Wax Seal", icon: "🔴", text: "Fervor decays half as fast." },
  { id: "twin", name: "Twin Voices", icon: "👥", text: "Two Hymns may be active at once.", rare: true },
  { id: "wick", name: "Smoldering Wick", icon: "🕯", text: "Wrath cards deal +50% damage and refund 1 Faith." },
  { id: "shard", name: "Stained Shard", icon: "🔷", text: "+15% damage." },
  { id: "lantern", name: "Gravewarden's Lantern", icon: "🏮", text: "Graze radius +50%." },
];
export const RELIC_MAP: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// ---------- ORDERS ----------
export interface OrderDef {
  id: string; name: string; sub: string; icon: string; color: string;
  hp: number; faith: number; regen: number; dmg: number; deck: string[]; unlock?: number; desc: string;
}
export const ORDERS: OrderDef[] = [
  { id: "acolyte", name: "Order of the Censer", sub: "Acolyte", icon: "✝", color: "#f6d37a", hp: 4, faith: 10, regen: 1, dmg: 1,
    deck: ["aspersion", "aspersion", "needle", "barrier", "barrier", "purge", "litany", "pierce", "guide", "fasting"],
    desc: "Balanced and forgiving. A sturdy starter liturgy." },
  { id: "cantor", name: "Order of Voices", sub: "Cantor", icon: "♪", color: "#52e5ff", hp: 3, faith: 10, regen: 1.25, dmg: 1, unlock: 150,
    deck: ["wave", "wave", "halo", "barrier", "penumbra", "litany", "rapture", "guide", "fasting", "purge"],
    desc: "Fragile but fluent. Faster Faith, orbiting halos and wavering songs." },
  { id: "inquisitor", name: "Order of Pyres", sub: "Inquisitor", icon: "🔥", color: "#ff6a3d", hp: 4, faith: 8, regen: 1, dmg: 1.15, unlock: 300,
    deck: ["needle", "needle", "lance", "cinders", "cinders", "heavy", "smite", "cinder_rain", "tithe", "barrier"],
    desc: "Glass cannon. +15% damage, less Faith, burning cards and blood tithes." },
];
export const ORDER_MAP: Record<string, OrderDef> = Object.fromEntries(ORDERS.map((o) => [o.id, o]));

// ---------- DIFFICULTY & VOWS ----------
export interface DiffDef { id: string; name: string; speed: number; hp: number; density: number; hpBonus: number; ash: number; desc: string }
export const DIFFS: DiffDef[] = [
  { id: "pilgrim", name: "Pilgrim", speed: 0.82, hp: 0.8, density: 0.75, hpBonus: 2, ash: 0.6, desc: "Slower bullets, fewer foes, +2 HP. For learning the rites." },
  { id: "zealot", name: "Zealot", speed: 1, hp: 1, density: 1, hpBonus: 0, ash: 1, desc: "The intended liturgy." },
  { id: "heretic", name: "Heretic", speed: 1.12, hp: 1.25, density: 1.25, hpBonus: -1, ash: 1.7, desc: "Faster, thicker bullet curtains. -1 HP." },
  { id: "martyr", name: "Martyr", speed: 1.25, hp: 1.5, density: 1.5, hpBonus: -2, ash: 2.6, desc: "Only the devout survive. -2 HP." },
];
export const DIFF_MAP: Record<string, DiffDef> = Object.fromEntries(DIFFS.map((d) => [d.id, d]));

export interface VowDef { id: string; name: string; text: string; ash: number }
export const VOWS: VowDef[] = [
  { id: "fasting", name: "Vow of Fasting", text: "Faith regeneration -40%.", ash: 0.25 },
  { id: "wrath", name: "Vow of Wrath", text: "Enemy bullets 15% faster.", ash: 0.2 },
  { id: "plague", name: "Vow of Plague", text: "40% more foes in waves.", ash: 0.2 },
  { id: "frail", name: "Vow of Frail Flesh", text: "-1 max HP.", ash: 0.3 },
  { id: "idle", name: "Vow of Idle Hands", text: "-1 hand size.", ash: 0.25 },
  { id: "idols", name: "Vow of Glass Idols", text: "Bosses have +30% HP.", ash: 0.15 },
];
export const VOW_MAP: Record<string, VowDef> = Object.fromEntries(VOWS.map((v) => [v.id, v]));

// ---------- META UPGRADES ----------
export interface MetaDef { id: string; name: string; text: string; max: number; cost: number[]; icon: string }
export const METAS: MetaDef[] = [
  { id: "faith", name: "Deep Faith", icon: "✧", text: "+1 starting max Faith per level.", max: 3, cost: [80, 160, 260] },
  { id: "regen", name: "Steady Breath", icon: "☁", text: "+8% Faith regeneration per level.", max: 3, cost: [90, 150, 220] },
  { id: "hands", name: "Quick Hands", icon: "✋", text: "Cards are drawn 8% faster per level.", max: 3, cost: [70, 140, 220] },
  { id: "vest", name: "Thick Vestments", icon: "🧥", text: "+1 max HP per level.", max: 2, cost: [150, 350] },
  { id: "fervor", name: "Fervent Hands", icon: "🔥", text: "+4% damage per level.", max: 5, cost: [60, 100, 150, 210, 280] },
  { id: "graze", name: "Pious Graze", icon: "✺", text: "+10% Faith per graze per level.", max: 3, cost: [70, 120, 180] },
  { id: "ash", name: "Ash Tithe", icon: "⚰", text: "+10% Ash earned per level.", max: 3, cost: [100, 200, 300] },
  { id: "token", name: "Pilgrim's Token", icon: "🗝", text: "Begin each run with a random relic.", max: 1, cost: [400] },
];

// ---------- CODEX CONTENT ----------
export const FOES: { name: string; icon: string; text: string }[] = [
  { name: "Cherub", icon: "👼", text: "Fast, fragile skirmishers that fire aimed shots at you." },
  { name: "Thurifer", icon: "🕯", text: "Swings a censer, releasing a continuous spiral of bullets. Learn its rhythm and graze it for Faith." },
  { name: "Chorister", icon: "🎶", text: "Arrives in sine-wave choirs, firing straight volleys downward." },
  { name: "Sentinel", icon: "🛡", text: "Slow armored guardian that blooms rings of bullets with a gap aimed at you." },
  { name: "Zealot", icon: "⚔", text: "Pauses to take aim, then dives at you. Bursts into bullets when destroyed." },
  { name: "Weaver", icon: "🕸", text: "Glides across the field firing curtains of needles. Later weaves telegraphed beams." },
  { name: "Bellringer", icon: "🔔", text: "Elite. Tolls expanding double rings with safe lanes. Appears from Act II." },
  { name: "The Bell Warden", icon: "⛪", text: "Act I Boss. Rings with gaps, pendulum streams and falling bells that burst." },
  { name: "Choirmaster Mortis", icon: "💀", text: "Act II Boss. Twin spirals, curving hymns, beam curtains and rotating beams." },
  { name: "The Hollow Cardinal", icon: "🜏", text: "Act III Boss. Rosettes, stained-glass rain with a safe lane, a judgement wheel, and the final Dies Irae." },
];

// ---------- ASH ----------
export interface RunStats {
  time: number; score: number; kills: number; grazes: number; damage: number; cardsPlayed: number;
  hits: number; maxFervor: number; bosses: number; tithes: number; purged: number;
}
export const newStats = (): RunStats => ({ time: 0, score: 0, kills: 0, grazes: 0, damage: 0, cardsPlayed: 0, hits: 0, maxFervor: 0, bosses: 0, tithes: 0, purged: 0 });

export interface RunState {
  order: string; diff: string; vows: string[];
  deck: CardInst[]; relics: string[];
  hp: number; maxHp: number;
  act: number; stage: "wave" | "boss"; endless: boolean;
  stats: RunStats; ashClaimed: number; ashMult: number; uid: number; won: boolean; recorded?: boolean;
}

export function computeAsh(run: RunState, ashMetaLvl: number): number {
  const s = run.stats;
  const base = s.kills * 1.2 + s.grazes * 0.08 + s.bosses * 70 + (run.act - 1) * 20 + (run.stage === "boss" ? 10 : 0) + (run.won ? 120 : 0);
  return Math.floor(base * run.ashMult * (1 + 0.1 * ashMetaLvl));
}

export function vowAshBonus(vows: string[]): number {
  return 1 + vows.reduce((a, v) => a + (VOW_MAP[v]?.ash ?? 0), 0);
}

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

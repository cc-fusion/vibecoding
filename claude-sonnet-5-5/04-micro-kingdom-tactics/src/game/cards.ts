export type Terrain = "plains" | "forest" | "mountain" | "water" | "lava";
export type Side = "p" | "e";
export type Keyword = "pierce" | "fire";
export type TargetKind = "empty" | "any" | "unit" | "none";

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  kind: "unit" | "spell";
  atk?: number;
  hp?: number;
  keyword?: Keyword;
  text: string;
  art: string;
  target: TargetKind;
  rarity: 1 | 2 | 3; // common, rare, epic
  hue: number;
}

export const TERRAIN_INFO: Record<
  Terrain,
  { name: string; icon: string; lift: number; desc: string; color: string }
> = {
  plains: { name: "Plains", icon: "🌾", lift: 6, desc: "No effect.", color: "#b9c46a" },
  forest: { name: "Forest", icon: "🌲", lift: 10, desc: "Unit takes 1 less damage from attacks (min 1).", color: "#3f9b52" },
  mountain: { name: "Mountain", icon: "⛰️", lift: 26, desc: "Unit gains +1 ATK.", color: "#9a9aa8" },
  water: { name: "Water", icon: "🌊", lift: -2, desc: "Unit loses 1 ATK (min 1) but heals 1 at end of its turn.", color: "#3b8fd6" },
  lava: { name: "Lava", icon: "🔥", lift: 2, desc: "Unit burns for 1 at end of its turn. Fire units gain +1 ATK.", color: "#e8531f" },
};

const C = (c: CardDef): CardDef => c;

export const CARDS: Record<string, CardDef> = {
  militia: C({ id: "militia", name: "Militia", cost: 1, kind: "unit", atk: 2, hp: 2, art: "🗡️", target: "empty", rarity: 1, hue: 40, text: "Tramples its tile flat into Plains." }),
  sapper: C({ id: "sapper", name: "Sapper", cost: 1, kind: "unit", atk: 1, hp: 3, art: "⛏️", target: "empty", rarity: 1, hue: 30, text: "Raises a Mountain beneath itself." }),
  druid: C({ id: "druid", name: "Druid", cost: 2, kind: "unit", atk: 1, hp: 4, art: "🧙", target: "empty", rarity: 1, hue: 130, text: "Forest beneath; adjacent Plains become Forest." }),
  tidecaller: C({ id: "tidecaller", name: "Tidecaller", cost: 2, kind: "unit", atk: 2, hp: 3, art: "🧜", target: "empty", rarity: 1, hue: 200, text: "All adjacent tiles turn to Water." }),
  pyromancer: C({ id: "pyromancer", name: "Pyromancer", cost: 2, kind: "unit", atk: 3, hp: 2, art: "🧑‍🎤", target: "empty", rarity: 1, hue: 15, text: "The tile ahead of it becomes Lava." }),
  archer: C({ id: "archer", name: "Archer", cost: 2, kind: "unit", atk: 2, hp: 2, keyword: "pierce", art: "🏹", target: "empty", rarity: 1, hue: 100, text: "Pierce: hits every enemy ahead. Forest beneath." }),
  ballista: C({ id: "ballista", name: "Ballista", cost: 3, kind: "unit", atk: 3, hp: 3, keyword: "pierce", art: "🎯", target: "empty", rarity: 2, hue: 25, text: "Pierce. Raises a Mountain beneath itself." }),
  knight: C({ id: "knight", name: "Knight", cost: 3, kind: "unit", atk: 4, hp: 4, art: "🛡️", target: "empty", rarity: 2, hue: 215, text: "Adjacent Water and Lava turn to Plains." }),
  geomancer: C({ id: "geomancer", name: "Geomancer", cost: 3, kind: "unit", atk: 2, hp: 5, art: "🪨", target: "empty", rarity: 2, hue: 35, text: "Mountain beneath and on the tile ahead." }),
  phoenix: C({ id: "phoenix", name: "Phoenix", cost: 4, kind: "unit", atk: 3, hp: 4, keyword: "fire", art: "🦅", target: "empty", rarity: 2, hue: 8, text: "Fire: immune to Lava, +1 ATK on it. Lava beneath." }),
  wyrm: C({ id: "wyrm", name: "Cinder Wyrm", cost: 4, kind: "unit", atk: 5, hp: 4, art: "🐉", target: "empty", rarity: 3, hue: 0, text: "Adjacent Plains and Forest scorch into Lava." }),
  colossus: C({ id: "colossus", name: "Colossus", cost: 5, kind: "unit", atk: 6, hp: 7, art: "🗿", target: "empty", rarity: 3, hue: 260, text: "Mountain beneath; adjacent Plains rise to Mountain." }),
  leviathan: C({ id: "leviathan", name: "Leviathan", cost: 5, kind: "unit", atk: 5, hp: 8, art: "🐙", target: "empty", rarity: 3, hue: 190, text: "Floods its own tile and every adjacent tile." }),

  raise: C({ id: "raise", name: "Raise Earth", cost: 1, kind: "spell", art: "🌋", target: "any", rarity: 1, hue: 280, text: "Target tile becomes a Mountain." }),
  bloom: C({ id: "bloom", name: "Bloom", cost: 1, kind: "spell", art: "🌱", target: "any", rarity: 1, hue: 140, text: "Target tile becomes Forest. Unit there heals 2." }),
  flood: C({ id: "flood", name: "Flood", cost: 1, kind: "spell", art: "💧", target: "any", rarity: 1, hue: 205, text: "Target tile becomes Water." }),
  scorch: C({ id: "scorch", name: "Scorch", cost: 2, kind: "spell", art: "☄️", target: "any", rarity: 1, hue: 10, text: "Target tile becomes Lava; unit there takes 2." }),
  lightning: C({ id: "lightning", name: "Lightning", cost: 2, kind: "spell", art: "⚡", target: "unit", rarity: 1, hue: 55, text: "Deal 3 damage to target unit." }),
  shift: C({ id: "shift", name: "Tectonic Shift", cost: 2, kind: "spell", art: "↔️", target: "any", rarity: 2, hue: 300, text: "Slide target tile's row one step right (wraps), units too." }),
  drift: C({ id: "drift", name: "Landslide", cost: 2, kind: "spell", art: "↕️", target: "any", rarity: 2, hue: 320, text: "Slide target tile's column one step toward your foe (wraps)." }),
  level: C({ id: "level", name: "Level the Land", cost: 2, kind: "spell", art: "📏", target: "none", rarity: 2, hue: 60, text: "Every tile becomes Plains." }),
  hearth: C({ id: "hearth", name: "Hearthfire", cost: 2, kind: "spell", art: "🏰", target: "none", rarity: 1, hue: 20, text: "Heal your Keep for 5." }),
  insight: C({ id: "insight", name: "Insight", cost: 1, kind: "spell", art: "📜", target: "none", rarity: 1, hue: 250, text: "Draw 2 cards." }),
  cataclysm: C({ id: "cataclysm", name: "Cataclysm", cost: 4, kind: "spell", art: "💥", target: "none", rarity: 3, hue: 350, text: "Randomize all terrain. Every unit takes 2." }),
};

export const STARTER_DECK = [
  "militia", "militia", "sapper", "sapper", "druid", "tidecaller", "pyromancer", "archer",
  "raise", "flood", "shift", "lightning",
];

export interface Opponent {
  name: string;
  title: string;
  art: string;
  keep: number;
  blurb: string;
  skill: number; // 0..1 AI noise reduction
  deck: string[];
  hue: number;
}

export const OPPONENTS: Opponent[] = [
  {
    name: "Baron Bramble", title: "Lord of the Thicket", art: "🧔", keep: 16, skill: 0.4, hue: 130,
    blurb: "A gentle landowner who fights with hedges and cover. Forests make his troops tough.",
    deck: ["militia", "militia", "druid", "druid", "archer", "archer", "sapper", "bloom", "bloom", "knight", "hearth", "insight", "lightning", "militia"],
  },
  {
    name: "Queen Tidewyn", title: "Matriarch of the Shallows", art: "👸", keep: 18, skill: 0.55, hue: 200,
    blurb: "Floods the battlefield so your attackers flounder, while her own soldiers mend.",
    deck: ["tidecaller", "tidecaller", "militia", "flood", "flood", "archer", "knight", "geomancer", "leviathan", "insight", "hearth", "lightning", "druid", "shift"],
  },
  {
    name: "Warlord Ashgar", title: "The Cinder Tyrant", art: "👹", keep: 20, skill: 0.7, hue: 10,
    blurb: "Burns everything. His Lava tiles sear all who stand on them, friend and foe.",
    deck: ["pyromancer", "pyromancer", "scorch", "scorch", "phoenix", "wyrm", "militia", "knight", "lightning", "lightning", "archer", "sapper", "drift", "insight"],
  },
  {
    name: "King Granite", title: "The Mountain Throne", art: "🤴", keep: 24, skill: 0.85, hue: 260,
    blurb: "An immovable monarch. Every unit of his stands on a peak and hits like a landslide.",
    deck: ["sapper", "sapper", "geomancer", "geomancer", "raise", "raise", "ballista", "ballista", "colossus", "knight", "lightning", "shift", "hearth", "drift", "level"],
  },
  {
    name: "The Terraformer", title: "Architect of Ruin", art: "🧿", keep: 30, skill: 1, hue: 300,
    blurb: "A godlike planner that rewrites the land at will. Defeat it to claim the Micro-Kingdom.",
    deck: ["druid", "tidecaller", "pyromancer", "geomancer", "phoenix", "wyrm", "colossus", "leviathan", "ballista", "knight", "lightning", "lightning", "scorch", "shift", "drift", "cataclysm", "insight", "hearth", "raise", "flood"],
  },
];

export interface Perk {
  id: string;
  name: string;
  icon: string;
  text: string;
}

export const PERKS: Perk[] = [
  { id: "keep", name: "Fortified Keep", icon: "🏯", text: "+6 max Keep health in every battle." },
  { id: "energy", name: "War Chest", icon: "💰", text: "+1 energy every turn." },
  { id: "draw", name: "Royal Scouts", icon: "🔭", text: "Draw 1 extra card each turn." },
  { id: "hardy", name: "Hardened Troops", icon: "🧱", text: "Your units enter play with +1 health." },
  { id: "ember", name: "Volcanic Heart", icon: "🌋", text: "Your units are immune to Lava damage." },
  { id: "tide", name: "Tidal Blessing", icon: "🌊", text: "Your units on Water don't lose ATK and heal 2." },
];

export function rewardChoices(owned: string[], n = 3): string[] {
  // Weighted by rarity; avoid duplicates in offer
  const pool = Object.values(CARDS);
  const picks: string[] = [];
  const weight = (c: CardDef) => (c.rarity === 1 ? 5 : c.rarity === 2 ? 3 : 1.6);
  let guard = 0;
  while (picks.length < n && guard++ < 200) {
    const total = pool.reduce((a, c) => a + weight(c), 0);
    let r = Math.random() * total;
    for (const c of pool) {
      r -= weight(c);
      if (r <= 0) {
        if (!picks.includes(c.id)) picks.push(c.id);
        break;
      }
    }
  }
  void owned;
  return picks;
}

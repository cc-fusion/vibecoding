import type { EnemyDef, EnemyId, FactionId, LandmarkId, RelicId, TerrainId } from "./types";

export const MAP_R = 10;
export const DAY_LEN = 12;

export const TERRAIN: Record<
  TerrainId,
  { name: string; cost: number; sanity: number; danger: number; ink: number; color: string; edge: string }
> = {
  meadow: { name: "Meadow", cost: 1, sanity: 0, danger: 0.07, ink: 1, color: "#bcc47c", edge: "#7d8450" },
  forest: { name: "Forest", cost: 1, sanity: 0, danger: 0.11, ink: 1, color: "#7f9c5a", edge: "#4d6a36" },
  hills: { name: "Hills", cost: 2, sanity: 0, danger: 0.1, ink: 1, color: "#c6aa6c", edge: "#8a7240" },
  mountain: { name: "Mountains", cost: 3, sanity: 0, danger: 0.13, ink: 2, color: "#9c958a", edge: "#5f5a52" },
  marsh: { name: "Marsh", cost: 2, sanity: 1, danger: 0.15, ink: 1, color: "#78998a", edge: "#44665a" },
  ash: { name: "Ashlands", cost: 2, sanity: 1, danger: 0.17, ink: 1, color: "#b88e78", edge: "#7a4f3c" },
  ruins: { name: "Ruins", cost: 1, sanity: 1, danger: 0.2, ink: 2, color: "#ab9f84", edge: "#6d6350" },
  lake: { name: "Lake", cost: 99, sanity: 0, danger: 0, ink: 1, color: "#86abbd", edge: "#4a7488" },
};

export const FACTIONS: Record<FactionId, { name: string; emoji: string; color: string; desc: string; enemy: EnemyId }> = {
  wardens: {
    name: "Meridian Wardens",
    emoji: "🧭",
    color: "#4f7fb5",
    desc: "The cartographers' guild. Allies open towers and share rumors; enemies send patrols. Rivals of the Choir.",
    enemy: "patrol",
  },
  hollow: {
    name: "Hollow Folk",
    emoji: "🪶",
    color: "#6a9a4a",
    desc: "Nomads who walk the land unmapped. Friends guide you and calm beasts; foes raid your camp. Distrust the Concord.",
    enemy: "raider",
  },
  concord: {
    name: "Gilded Concord",
    emoji: "⚖️",
    color: "#c8962e",
    desc: "Merchant princes. Good standing lowers prices and buys your maps dearly; hostility closes every market.",
    enemy: "bandit",
  },
  choir: {
    name: "Choir Beneath",
    emoji: "🕯️",
    color: "#8a5ab5",
    desc: "Singers of the blank page. Allies soothe your mind and may open the Spire; foes send acolytes. Rivals of the Wardens.",
    enemy: "acolyte",
  },
};

export const LM: Record<LandmarkId, { name: string; emoji: string; desc: string }> = {
  outpost: { name: "Meridian Outpost", emoji: "⛺", desc: "The last stamped corner of the known world. A few crates, a map table, and a warm lamp." },
  village: { name: "Hollow Encampment", emoji: "🛖", desc: "Felt tents and quiet fires. The Hollow Folk watch you with polite suspicion." },
  market: { name: "Concord Night Stall", emoji: "🏮", desc: "A lantern-lit stall of the Gilded Concord. Everything has a price, including your map." },
  shrine: { name: "Choir Shrine", emoji: "🕯️", desc: "Candles burn in a ring of blank stone. Something hums beneath the floor." },
  tower: { name: "Warden Watchtower", emoji: "🗼", desc: "A surveyor's tower, its brass lens still turning toward the horizon." },
  library: { name: "Drowned Library", emoji: "📚", desc: "Shelves of ink-stained books, rearranged by hands that are not there." },
  spring: { name: "Clearwater Spring", emoji: "⛲", desc: "Impossibly clean water pools beneath carved stones. The air smells like rain." },
  obelisk: { name: "Whispering Obelisk", emoji: "🗿", desc: "A black monolith etched with a map of somewhere else. It is warm to the touch." },
  cave: { name: "Dark Cave Mouth", emoji: "🕳️", desc: "Cold air breathes out of the dark. Old footprints lead in. None lead out." },
  sigil: { name: "Sigil Altar", emoji: "🔱", desc: "One of three altars that keep the Spire's gate sealed. A guardian dozes upon it." },
  spire: { name: "The Lament Spire", emoji: "🌀", desc: "A needle of unwritten stone. Where it stands, the map is blank, and it is hungry." },
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  wolf: {
    id: "wolf", name: "Ash Wolf", emoji: "🐺", hp: 13, atk: 3, armor: 0, san: 0,
    pattern: ["attack", "attack", "heavy"], parley: 0.25, desc: "Grey, lean and hungry. Hollow charms and drums may calm it.",
    gold: [0, 3], tiers: [0, 1], prefer: ["forest", "meadow", "hills"],
  },
  bandit: {
    id: "bandit", name: "Road Bandit", emoji: "🥷", hp: 15, atk: 4, armor: 0, san: 0,
    pattern: ["attack", "guard", "attack", "heavy"], parley: 0.5, desc: "Desperate cutthroats. Gold and Concord favor ease the tension.",
    gold: [6, 14], faction: "concord", tiers: [0, 1], prefer: ["meadow", "hills", "forest"],
  },
  hag: {
    id: "hag", name: "Mire Hag", emoji: "🧙‍♀️", hp: 20, atk: 4, armor: 0, san: 6,
    pattern: ["drain", "attack", "drain", "guard"], parley: 0.12, desc: "She wears the faces of lost mapmakers. Her whispers corrode sanity.",
    gold: [2, 8], tiers: [1, 2], prefer: ["marsh", "forest"],
  },
  acolyte: {
    id: "acolyte", name: "Choir Acolyte", emoji: "🕯️", hp: 18, atk: 3, armor: 0, san: 5,
    pattern: ["drain", "attack", "wail", "attack"], parley: 0.45, desc: "Hooded singers. Their hymn bends your thoughts toward the blank page.",
    gold: [3, 9], faction: "choir", tiers: [1, 2], prefer: ["ruins", "ash"], rep: { choir: -6, wardens: 3 },
  },
  golem: {
    id: "golem", name: "Stone Golem", emoji: "🗿", hp: 24, atk: 5, armor: 1, san: 0,
    pattern: ["guard", "heavy", "attack"], parley: 0, desc: "Carved from the landscape itself. Armored; strike hard or burn it with ink.",
    gold: [0, 4], tiers: [1, 2], prefer: ["mountain", "hills", "ruins"],
  },
  wraith: {
    id: "wraith", name: "Hollow Wraith", emoji: "👻", hp: 24, atk: 3, armor: 0, san: 9,
    pattern: ["wail", "drain", "attack", "wail"], parley: 0, desc: "A mapmaker erased mid-line. Ink Flares burn it twice as hard.",
    gold: [0, 0], weak: "flare", tiers: [2], prefer: ["ash", "ruins", "marsh"],
  },
  patrol: {
    id: "patrol", name: "Warden Patrol", emoji: "🛡️", hp: 24, atk: 5, armor: 1, san: 0,
    pattern: ["attack", "guard", "heavy"], parley: 0.35, desc: "They know you wronged the guild. Reputation could still sway them.",
    gold: [5, 12], faction: "wardens", tiers: [0, 1, 2], prefer: [], rep: { wardens: -4, choir: 3 },
  },
  raider: {
    id: "raider", name: "Hollow Raider", emoji: "🏹", hp: 20, atk: 4, armor: 0, san: 0,
    pattern: ["attack", "heavy", "attack"], parley: 0.35, desc: "Silent riders who avenge the trespass of maps. A kind word may still help.",
    gold: [2, 8], faction: "hollow", tiers: [0, 1, 2], prefer: [], rep: { hollow: -4 },
  },
  unwritten: {
    id: "unwritten", name: "The Unwritten", emoji: "📜", hp: 75, atk: 5, armor: 1, san: 7,
    pattern: ["attack", "drain", "attack", "heavy"], parley: 0,
    desc: "The first blank page. It redacts your actions and erases what is unmapped within you.",
    gold: [0, 0], tiers: [2], prefer: [],
  },
};

export const RELICS: Record<RelicId, { name: string; emoji: string; desc: string }> = {
  sextant: { name: "Brass Sextant", emoji: "📐", desc: "Every 3rd tile you chart costs no ink." },
  lantern: { name: "Lantern of Veils", emoji: "🏮", desc: "+1 vision radius, and night no longer narrows your sight." },
  boots: { name: "Pilgrim's Boots", emoji: "🥾", desc: "Hills and Mountains cost 1 less to cross." },
  quill: { name: "Mad Quill", emoji: "🪶", desc: "Charting a tile restores 1 sanity. Camping costs 3 sanity." },
  salt: { name: "Salt Charm", emoji: "🧂", desc: "Wraiths, hags and acolytes deal 40% less sanity damage." },
  seal: { name: "Warden's Seal", emoji: "🔖", desc: "Warden reputation gains +50%. Patrols spare you." },
  scale: { name: "Gilded Scale", emoji: "⚖️", desc: "Prices −20%. Map sales earn +50%." },
  drum: { name: "Hollow Drum", emoji: "🥁", desc: "Beasts hesitate: wolves can be parleyed (+35%) and ambushes are rarer in forests." },
  fork: { name: "Choir Tuning Fork", emoji: "🎼", desc: "Whenever you lose sanity, 25% chance to gain 1 ink." },
  skiff: { name: "Reed Skiff", emoji: "🛶", desc: "Lakes become passable (cost 2)." },
  chrono: { name: "Chronometer", emoji: "⌚", desc: "Nights are 2 units shorter." },
  compass: { name: "Blood Compass", emoji: "🩸", desc: "+2 strike damage, but each fight starts with −2 sanity." },
  vial: { name: "Ink-Blooded Vial", emoji: "🧪", desc: "Ink Flare costs 2 ink and deals +2 damage." },
  gloves: { name: "Surveyor's Gloves", emoji: "🧤", desc: "+8 pin slots. Pinned tiles also grant +1 sanity when you step on them." },
  bell: { name: "Lamentation Bell", emoji: "🔔", desc: "Winning a fight restores 5 sanity." },
};

export const PINS = [
  { glyph: "", name: "No note" },
  { glyph: "⚠️", name: "Danger" },
  { glyph: "⭐", name: "Interest" },
  { glyph: "🏕️", name: "Camp" },
  { glyph: "✖️", name: "Avoid" },
];

export const DIFFICULTY = {
  wayfarer: {
    name: "Wayfarer", desc: "Gentler enemies, a slow Unwriting and kinder nights. For learning the map.",
    dmg: 0.75, hp: 0.85, unwrite: 0.6, hallu: 0.7, renown: 0.7, enc: 0.8, supply: 1.2,
  },
  cartographer: {
    name: "Cartographer", desc: "The intended expedition. Balanced pressure from the dark and the clock.",
    dmg: 1, hp: 1, unwrite: 0.9, hallu: 1, renown: 1, enc: 1, supply: 1,
  },
  lamenter: {
    name: "Lamenter", desc: "Ferocious enemies, a hungry Unwriting and constant hallucination. Glory for the mad.",
    dmg: 1.3, hp: 1.2, unwrite: 1.3, hallu: 1.4, renown: 1.6, enc: 1.25, supply: 0.9,
  },
} as const;

export const MODIFIERS: Record<string, { name: string; desc: string; renown: number; emoji: string }> = {
  scarce: { name: "Scarce Roads", desc: "−30% max supplies, +25% prices.", renown: 0.25, emoji: "🥖" },
  longnight: { name: "Long Night", desc: "Nights last 6 units instead of 4.", renown: 0.25, emoji: "🌑" },
  fog: { name: "Fog of Madness", desc: "Hallucinations twice as likely. Start with −15 sanity.", renown: 0.3, emoji: "🌫️" },
  iron: { name: "Iron Quill", desc: "Ink no longer regenerates at dawn.", renown: 0.25, emoji: "🖋️" },
};

export const CLASSES: Record<string, { name: string; emoji: string; desc: string; cost: number }> = {
  surveyor: { name: "Surveyor", emoji: "📏", desc: "+3 ink. The first chart each day is free.", cost: 0 },
  pathfinder: { name: "Pathfinder", emoji: "🥾", desc: "+8 supplies. Forest and Marsh cost 1 less to cross.", cost: 40 },
  mystic: { name: "Mystic", emoji: "🔮", desc: "+15 max sanity, −5 max vigor. Hallucinations halved. 20% to gain 1 ink when losing sanity.", cost: 80 },
};

export const UPGRADES: { id: string; name: string; desc: string; max: number; cost: number; emoji: string }[] = [
  { id: "pack", name: "Deep Pack", desc: "+5 max supplies per rank.", max: 3, cost: 15, emoji: "🎒" },
  { id: "well", name: "Ink Well", desc: "+3 max ink per rank.", max: 3, cost: 15, emoji: "🫙" },
  { id: "mind", name: "Steady Mind", desc: "+10 max sanity per rank.", max: 3, cost: 20, emoji: "🧠" },
  { id: "hard", name: "Hardened Frame", desc: "+5 max vigor per rank.", max: 3, cost: 18, emoji: "💪" },
  { id: "eyes", name: "Keen Eyes", desc: "+1 vision radius.", max: 1, cost: 60, emoji: "👁️" },
  { id: "nib", name: "Fine Nib", desc: "+1 free chart per day per rank.", max: 2, cost: 30, emoji: "🖊️" },
  { id: "dipl", name: "Silver Tongue", desc: "+8 starting reputation with all factions per rank.", max: 3, cost: 15, emoji: "🗣️" },
  { id: "hag", name: "Haggler", desc: "−6% prices per rank.", max: 3, cost: 15, emoji: "🪙" },
  { id: "blade", name: "Whetstone", desc: "+1 strike damage per rank.", max: 3, cost: 25, emoji: "🗡️" },
  { id: "pins", name: "Pin Cushion", desc: "+4 pin slots per rank.", max: 2, cost: 12, emoji: "📌" },
  { id: "luck", name: "Heirloom", desc: "Begin each run with a random relic per rank.", max: 2, cost: 45, emoji: "🏺" },
  { id: "kit", name: "Field Kit", desc: "Begin with +1 tonic and +1 laudanum per rank.", max: 3, cost: 12, emoji: "🧰" },
];

export const LORE: { title: string; text: string }[] = [
  { title: "I. The First Survey", text: "Before maps, the land was only weather and intention. The first surveyor drew a coastline and the sea obeyed. She was thanked. She drew again." },
  { title: "II. Ink Is a Promise", text: "Whatever is charted must stay as charted. The Wardens learned this too late: every line is a vow, and the unmapped land resents being held." },
  { title: "III. The Shifting Marches", text: "Unmapped ground wanders in the dark. A glimpse is only a rumor of a place. Trust the pen over the eye, and the pen over the memory." },
  { title: "IV. Hymn of the Blank Page", text: "The Choir believes the map is a wound. Sing long enough and the page will heal into white. They are not wrong that it feels like peace." },
  { title: "V. A Hollow Proverb", text: "'Walk where no one drew, and the road remembers you.' The Hollow Folk are not afraid of the Unwriting. They are afraid of what comes after it." },
  { title: "VI. The Concord Ledger", text: "A map sells for more than a sword, and a false map for more than both. The Concord has never once lost money on the end of the world." },
  { title: "VII. Last Entry of Surveyor Ilse Varn", text: "Day 41. The Spire does not appear on any chart because it is the chart. I keep seeing my own hand drawing me. I'll mark this page with my name so something remembers." },
  { title: "VIII. The Unwritten", text: "It is not a monster. It is the margin where every cartographer's doubt gathered. It hates to be annotated. Draw on it. Sign your name. Leave it a coastline." },
  { title: "IX. Epilogue: The Lament", text: "The Lament is the sound a map makes when no one is left to read it. You have read it. You have drawn it. It will stay." },
];

export const WHISPERS = [
  "She is drawing you now.",
  "The road behind you is not there.",
  "Turn back. Turn back. Turn back.",
  "The ink remembers your name.",
  "Count the tiles. One is missing.",
  "You were never on this map.",
  "The Spire is closer than it was.",
  "Something is erasing the edges.",
  "Who is holding the quill?",
  "Your hand is not your own.",
];

export const EVENT_TIPS = [
  "Charted tiles cost less, spawn fewer ambushes and drain less sanity.",
  "Unmapped land shifts at dawn. Glimpsed tiles may no longer be what they seem.",
  "Pinned notes show the truth even through hallucinations.",
  "Ink Flare gets stronger the more of the world you have charted.",
  "The Unwriting spreads from where you began. Never stand still for long.",
  "Low sanity makes the map lie. Camp, pray, or drink at springs.",
];

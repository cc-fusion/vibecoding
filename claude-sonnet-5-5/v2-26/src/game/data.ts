import type {
  ClientId,
  ConsumableId,
  DiffId,
  KindId,
  LootKind,
  MechType,
  ModId,
  UpgradeId,
} from "./types";

export const SAVE_KEY = "lockpick-dynasty-v1";

export const MECH_INFO: Record<
  MechType,
  { name: string; icon: string; short: string; help: string; lesson: string[] }
> = {
  pins: {
    name: "Pin Tumbler",
    icon: "📍",
    short: "Feel for the binding pin and lift it to the shear line.",
    help: "←/→ select pin · ↑/↓ lift · or drag a pin with the mouse. One pin binds at a time — it feels stiff and trembles. Hold it in the sweet spot to set it.",
    lesson: [
      "Only ONE pin is 'binding' at a time. Probe each pin — the binding pin trembles and creaks while loose pins move freely.",
      "Lift the binding pin slowly. The creak pitch rises as you near the shear line. Hold it in the sweet spot to set it.",
      "Lift too far and the pin oversets — noise, pick wear, and (on harder locks) a set pin pops loose again.",
      "Set every pin to open the lock. The Stethoscope upgrade glows the binding pin and reveals the sweet spot.",
    ],
  },
  dial: {
    name: "Combination Dial",
    icon: "🧭",
    short: "Listen for the clicks, lock each number in the right direction.",
    help: "←/→ or A/D or mouse-drag to spin · wheel = fine tune · SPACE/ENTER locks a number. Watch the listening gauge; spin too fast and the dial clatters.",
    lesson: [
      "Spin the dial (drag, arrows or mouse wheel). The listening gauge swells as you near a hidden number.",
      "When the gauge flares and the dial 'clunks', press SPACE or ENTER to lock the number in.",
      "Harder safes demand each number be reached in an alternating direction — the arrow above the dial tells you which.",
      "Spinning too fast makes the mechanism clatter and raises noise. Slow, steady hands win.",
    ],
  },
  rings: {
    name: "Gear-Ring Cylinder",
    icon: "⚙️",
    short: "Rotate linked rings until every gap lines up under the latch.",
    help: "↑/↓ select ring · ←/→ rotate (or drag a ring). Rotating a ring also drags the ring inside it by the shown ratio. Align all gaps at the top.",
    lesson: [
      "Each ring has a gap. Rotate rings (←/→, or drag) until every gap sits under the top latch.",
      "Rings are LINKED: turning a ring also turns the next ring inward by the ratio shown on the chain (×-1 = opposite way).",
      "Fix rings from the outermost inward — a ring only disturbs rings inside it.",
      "When all gaps align, hold steady and the latch drops. Grinding gears makes noise, so be economical.",
    ],
  },
  sweep: {
    name: "Magnetic Latch",
    icon: "🧲",
    short: "Strike when the needle crosses the glowing band.",
    help: "SPACE / click / tap when the needle crosses the golden band. Each hit speeds the needle and narrows the band.",
    lesson: [
      "The needle swings across the arc. Press SPACE (or click) as it passes through the golden band.",
      "Each success moves and narrows the band, and the needle swings faster.",
      "A miss costs noise and pick wear, and knocks one success off your streak.",
      "Land the required number of hits to release the latch.",
    ],
  },
  cipher: {
    name: "Cipher Keypad",
    icon: "🔢",
    short: "Deduce the secret code from the feedback pegs.",
    help: "Type digits (1-8) or click glyphs · BACKSPACE removes · ENTER submits. Green = right symbol & place, amber = right symbol, wrong place.",
    lesson: [
      "A hidden code of glyphs guards this lock. Enter a guess with the number keys or by clicking glyphs, then press ENTER.",
      "Green pegs mean a correct glyph in the correct place. Amber pegs mean a correct glyph in the wrong place.",
      "Use logic: every guess narrows the possibilities. Wrong guesses add a little noise; running out of tries resets the code.",
      "The Stethoscope upgrade pre-reveals one or two glyphs for you.",
    ],
  },
  runes: {
    name: "Rune Sequence",
    icon: "🔮",
    short: "Watch the runes flash, then repeat the sequence.",
    help: "Click runes or press 1-6 to repeat the pattern. SPACE replays the sequence (costs a little noise unless you own a Stethoscope).",
    lesson: [
      "Runes flash in a sequence, each with its own tone. Repeat the sequence by clicking runes or pressing 1-6.",
      "Each round adds one more rune. Complete the full-length sequence to open the lock.",
      "A wrong rune costs noise and pick wear, then the round replays.",
      "Press SPACE to replay the sequence; it adds a trickle of noise unless you own a Stethoscope.",
    ],
  },
};

export const CLIENTS: Record<
  ClientId,
  { name: string; icon: string; color: string; rival: ClientId; blurb: string; perk: string; kinds: KindId[] }
> = {
  merchants: {
    name: "The Gilded Ledger",
    icon: "🪙",
    color: "#e0b450",
    rival: "underworld",
    blurb: "A merchant consortium. Pays steadily; hates the Black Lantern.",
    perk: "Trusted (50+): Workshop prices −20%.",
    kinds: ["strongbox", "safecrack"],
  },
  nobles: {
    name: "House Vael",
    icon: "👑",
    color: "#d0608c",
    rival: "scholars",
    blurb: "Old money with a taste for grand heists. Despises the Lumen Order.",
    perk: "Trusted (50+): All payouts +12%.",
    kinds: ["grandheist", "clockwork", "safecrack"],
  },
  underworld: {
    name: "The Black Lantern",
    icon: "🏮",
    color: "#46cfa0",
    rival: "merchants",
    blurb: "Smugglers and fixers. Dangerous, lucrative, and anti-Ledger.",
    perk: "Trusted (50+): Fence pays +15% and Heat cools faster.",
    kinds: ["strongbox", "clockwork", "grandheist"],
  },
  scholars: {
    name: "The Lumen Order",
    icon: "📜",
    color: "#6aa8ff",
    rival: "nobles",
    blurb: "Archivists chasing forbidden knowledge. Opposed to House Vael.",
    perk: "Trusted (50+): Free Stethoscope tier +1 and +10% time.",
    kinds: ["archive", "clockwork"],
  },
};

export const CLIENT_IDS: ClientId[] = ["merchants", "nobles", "underworld", "scholars"];

export const KINDS: Record<
  KindId,
  { name: string; icon: string; weights: Partial<Record<MechType, number>>; payMul: number; stageBonus: number; blurb: string }
> = {
  strongbox: { name: "Strongbox Job", icon: "📦", weights: { pins: 5, dial: 2, sweep: 1 }, payMul: 1, stageBonus: 0, blurb: "Pins and tumblers." },
  safecrack: { name: "Safecracking", icon: "🧭", weights: { dial: 5, pins: 2, cipher: 1 }, payMul: 1.05, stageBonus: 0, blurb: "Combination dials." },
  archive: { name: "Archive Break-in", icon: "📚", weights: { cipher: 4, runes: 4, pins: 1 }, payMul: 1.1, stageBonus: 0, blurb: "Ciphers and runes." },
  clockwork: { name: "Clockwork Vault", icon: "⚙️", weights: { rings: 5, sweep: 3, dial: 1 }, payMul: 1.1, stageBonus: 0, blurb: "Gears and latches." },
  grandheist: { name: "Grand Heist", icon: "💎", weights: { pins: 2, dial: 2, rings: 2, cipher: 2, runes: 2, sweep: 2 }, payMul: 1.25, stageBonus: 1, blurb: "A long mixed vault." },
  odd: { name: "Odd Job", icon: "🗝️", weights: { pins: 3, dial: 2, sweep: 2 }, payMul: 0.8, stageBonus: 0, blurb: "Small fry. Always available." },
  sovereign: { name: "The Sovereign's Vault", icon: "🏛️", weights: {}, payMul: 1, stageBonus: 0, blurb: "The capstone challenge." },
};

export const DIFFS: Record<
  DiffId,
  {
    name: string;
    desc: string;
    tol: number;
    noise: number;
    time: number;
    pay: number;
    patrol: number;
    rent: number;
    heat: number;
  }
> = {
  apprentice: { name: "Apprentice", desc: "Wide tolerances, quiet locks, generous clocks. Learn the craft.", tol: 1.25, noise: 0.75, time: 1.3, pay: 0.85, patrol: 1.3, rent: 0.7, heat: 0.7 },
  journeyman: { name: "Journeyman", desc: "The intended experience. Balanced and fair.", tol: 1, noise: 1, time: 1, pay: 1, patrol: 1, rent: 1, heat: 1 },
  master: { name: "Master", desc: "Tight tolerances, jumpy locks, frequent guards, heavy rent.", tol: 0.85, noise: 1.25, time: 0.85, pay: 1.35, patrol: 0.78, rent: 1.3, heat: 1.35 },
};

export const MODS: Record<ModId, { name: string; icon: string; desc: string; pay: number }> = {
  rush: { name: "Rush Job", icon: "⏱️", desc: "Time −30%. Payout +35%.", pay: 1.35 },
  ironhands: { name: "Brittle Steel", icon: "🔩", desc: "Pick wear ×2. Payout +30%.", pay: 1.3 },
  silent: { name: "Silent Night", icon: "🤫", desc: "No patrols, but all noise ×1.6. Payout +15%.", pay: 1.15 },
};

export const UPGRADES: Record<
  UpgradeId,
  { name: string; icon: string; max: number; base: number; mul: number; desc: string; per: string }
> = {
  steel: { name: "Spring-Steel Picks", icon: "🪡", max: 4, base: 80, mul: 1.9, desc: "Picks take more wear before snapping.", per: "+2 durability per level" },
  wrench: { name: "Precision Tension Wrench", icon: "🔧", max: 3, base: 110, mul: 2.1, desc: "Wider sweet spots on every lock.", per: "+8% tolerance per level" },
  stetho: { name: "Locksmith's Stethoscope", icon: "🩺", max: 2, base: 180, mul: 2.4, desc: "Hear the mechanism. Reveals binding pins, proximity, glyphs and more.", per: "Hint tier per level" },
  gloves: { name: "Felt-Lined Gloves", icon: "🧤", max: 3, base: 100, mul: 1.9, desc: "Mistakes are quieter.", per: "−10% noise per level" },
  oil: { name: "Whisper Oil Kit", icon: "🛢️", max: 3, base: 90, mul: 1.8, desc: "Noise fades faster.", per: "+0.7 noise decay/s per level" },
  hourglass: { name: "Hourglass Locket", icon: "⏳", max: 3, base: 90, mul: 1.8, desc: "More time before dawn.", per: "+10% time per level" },
  cloak: { name: "Shadow Cloak", icon: "🧥", max: 3, base: 130, mul: 2, desc: "Guards notice less and warn you earlier.", per: "−25% patrol penalty, +0.8s warning" },
};
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export const CONSUMABLES: Record<
  ConsumableId,
  { name: string; icon: string; key: string; cost: number; desc: string }
> = {
  oil: { name: "Lock Oil Flask", icon: "🫗", key: "Q", cost: 30, desc: "−35 noise now; noise gain −40% for 20s." },
  smoke: { name: "Smoke Pellet", icon: "💨", key: "E", cost: 45, desc: "Cancels the current patrol and delays the next by 30s." },
  sand: { name: "Sand Vial", icon: "⌛", key: "R", cost: 40, desc: "+25 seconds on the clock." },
  skeleton: { name: "Skeleton Key", icon: "🗝️", key: "F", cost: 170, desc: "Bypass the current lock. Costs a star." },
};
export const CONSUMABLE_IDS = Object.keys(CONSUMABLES) as ConsumableId[];

export const PICK_COST = 18;
export const MAX_PICKS = 12;
export const MAX_ITEMS = 6;

export const RANKS = [
  { name: "Street Picker", at: 0 },
  { name: "Journeyman", at: 45 },
  { name: "Artisan", at: 120 },
  { name: "Master Locksmith", at: 230 },
  { name: "Grand Artificer", at: 360 },
];
export const BOSS_RANK = 4;

export const LOOT: Record<LootKind, { icon: string; label: string; base: number; names: string[] }> = {
  coin: { icon: "🪙", label: "Coin Hoards", base: 28, names: ["Sack of Old Crowns", "Minted Ingots", "Foreign Doubloons"] },
  gem: { icon: "💠", label: "Gemstones", base: 48, names: ["Cut Sapphire", "Uncut Emerald", "Smoky Quartz Heart"] },
  idol: { icon: "🗿", label: "Idols", base: 72, names: ["Jade Idol", "Bronze Fetish", "Obsidian Totem"] },
  tome: { icon: "📖", label: "Tomes", base: 60, names: ["Alchemist's Codex", "Forbidden Atlas", "Sealed Ledger"] },
  jewel: { icon: "💍", label: "Jewelry", base: 95, names: ["Signet Ring", "Pearl Choker", "Gilded Tiara"] },
  relic: { icon: "🏺", label: "Relics", base: 150, names: ["Ancient Reliquary", "Clockwork Heart", "Sunken Crown"] },
};
export const LOOT_KINDS = Object.keys(LOOT) as LootKind[];

export const CLIENT_TASTE: Record<string, LootKind[]> = {
  merchants: ["coin", "gem", "jewel"],
  nobles: ["jewel", "relic", "idol"],
  underworld: ["gem", "idol", "coin"],
  scholars: ["tome", "relic", "idol"],
  odd: ["coin", "gem"],
  boss: ["relic", "jewel", "relic"],
};

export const HOUSE_NAMES = ["Vance", "Ashgrove", "Corvane", "Thistle", "Marrow", "Halloran", "Voss", "Quillon", "Dray", "Ebonmere"];

export const CONTRACT_TITLES: Record<KindId, string[]> = {
  strongbox: ["The Counting-House Coffer", "Dockmaster's Strongbox", "The Cobbler's Secret", "Magistrate's Lockbox"],
  safecrack: ["The Banker's Safe", "Vault 9 at Harrow Street", "The Mint Inspector's Dial", "Ironclad Ledger Safe"],
  archive: ["The Sealed Reading Room", "Cartographer's Cipher", "Rune-Locked Stacks", "The Forbidden Shelf"],
  clockwork: ["The Gearwright's Door", "Orrery Vault", "Brass Cathedral Lock", "The Automaton Annex"],
  grandheist: ["The Duke's Gallery", "Opera House Treasury", "Harbor Bank Heist", "The Masquerade Vault"],
  odd: ["A Neighbour's Strongbox", "Misplaced Key Job", "Tavern Cellar Chest"],
  sovereign: ["The Sovereign's Vault"],
};

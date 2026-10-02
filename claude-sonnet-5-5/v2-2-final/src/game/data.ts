// ---------- Shared game definitions: crew, loot, venues, gadgets, upgrades, fences ----------
export type Skill = 'lock' | 'tech' | 'crack' | 'force' | 'grab';
export type CrewKind = 'ghost' | 'hacker' | 'cracker' | 'muscle' | 'face';
export type LootCat = 'jewels' | 'art' | 'cash' | 'data' | 'relic' | 'gold';
export type VenueId = 'tutorial' | 'boutique' | 'gallery' | 'casino' | 'tower' | 'museum' | 'bank' | 'meridian';
export type GadgetId = 'smoke' | 'emp' | 'decoy' | 'tranq';
export type UpgradeId = 'safehouse' | 'garage' | 'intel' | 'lawyer' | 'workshop';
export type DiffId = 'rookie' | 'pro' | 'master';

export interface CrewDef {
  kind: CrewKind; name: string; title: string; icon: string; color: string; hire: number;
  speed: number; hp: number; cap: number; noise: number; skills: Record<Skill, number>;
  perk: string; blurb: string;
}

export const CREW: Record<CrewKind, CrewDef> = {
  ghost: {
    kind: 'ghost', name: 'Ghost', title: 'Infiltrator', icon: '👻', color: '#b79bff', hire: 1800, speed: 2.5, hp: 2, cap: 4, noise: 3,
    skills: { lock: 1.5, tech: 0.6, crack: 0.4, force: 0, grab: 1.3 },
    perk: 'Fastest and quietest. Best lockpick. Silent takedowns.',
    blurb: 'Slips through any door. Fragile if caught.',
  },
  hacker: {
    kind: 'hacker', name: 'Hacker', title: 'Systems Specialist', icon: '💻', color: '#5cf0a8', hire: 1800, speed: 1.9, hp: 2, cap: 4, noise: 4,
    skills: { lock: 0.5, tech: 1.6, crack: 0.3, force: 0, grab: 1 },
    perk: 'Loops cameras, kills lasers, cuts alarm lines, cracks keycard doors.',
    blurb: 'The only one who can really beat the electronics.',
  },
  cracker: {
    kind: 'cracker', name: 'Safecracker', title: 'Vault Artisan', icon: '🔐', color: '#ffd35c', hire: 2000, speed: 1.7, hp: 3, cap: 4, noise: 5,
    skills: { lock: 1.0, tech: 0.5, crack: 1.6, force: 0, grab: 1 },
    perk: 'Cracks safes and vault tumblers at record speed.',
    blurb: 'Slow on foot, golden hands on steel.',
  },
  muscle: {
    kind: 'muscle', name: 'Muscle', title: 'Heavy Hitter', icon: '💪', color: '#ff7a5c', hire: 1500, speed: 1.85, hp: 5, cap: 8, noise: 7,
    skills: { lock: 0, tech: 0, crack: 0, force: 1.2, grab: 1 },
    perk: 'Carries double. Breaches doors (loud). Brawls guards that catch him.',
    blurb: 'Subtlety is overrated.',
  },
  face: {
    kind: 'face', name: 'Face', title: 'Grifter', icon: '🎭', color: '#ff7ad1', hire: 1900, speed: 2.1, hp: 2, cap: 4, noise: 3,
    skills: { lock: 0.7, tech: 0.7, crack: 0, force: 0, grab: 1.1 },
    perk: 'Disguise (guards barely notice) and Radio Spoof (covers missed check-ins).',
    blurb: 'Walks in the front door and makes it look easy.',
  },
};
export const CREW_KINDS: CrewKind[] = ['ghost', 'hacker', 'cracker', 'muscle', 'face'];
export const NAME_POOL = ['Vesper', 'Rook', 'Juno', 'Kestrel', 'Mara', 'Dex', 'Silas', 'Wren', 'Tamsin', 'Orion', 'Nyx', 'Cormac', 'Ines', 'Bastian', 'Lark', 'Zephyr', 'Odalys', 'Pike', 'Marlow', 'Sable', 'Quill', 'Hollis', 'Rue', 'Vance'];

export interface LootDef { cat: LootCat; name: string; icon: string; weight: number; min: number; max: number; skill: Skill; time: number; items: string[]; color: string; }
export const LOOT: Record<LootCat, LootDef> = {
  jewels: { cat: 'jewels', name: 'Jewels', icon: '💎', weight: 1, min: 260, max: 720, skill: 'grab', time: 1.6, items: ['Sapphire Parure', 'Diamond Choker', 'Ruby Brooch', 'Pearl Strand', 'Emerald Cuff'], color: '#6ee7ff' },
  art: { cat: 'art', name: 'Fine Art', icon: '🖼️', weight: 3, min: 1500, max: 3400, skill: 'grab', time: 3.2, items: ['Oil Landscape', 'Bronze Bust', 'Cubist Portrait', 'Gilded Triptych', 'Marble Study'], color: '#ff7ad1' },
  cash: { cat: 'cash', name: 'Cash', icon: '💵', weight: 2, min: 650, max: 1250, skill: 'grab', time: 2.2, items: ['Bundled Bricks', 'Chip Trays', 'Marked Bills', 'Reserve Satchel'], color: '#5cf0a8' },
  data: { cat: 'data', name: 'Data', icon: '💾', weight: 1, min: 1200, max: 2600, skill: 'tech', time: 5, items: ['Client Ledger Drive', 'Prototype Schematics', 'Zero-Day Archive', 'Merger Files'], color: '#a6b8ff' },
  relic: { cat: 'relic', name: 'Relics', icon: '🏺', weight: 4, min: 2600, max: 5000, skill: 'grab', time: 4, items: ['Obsidian Idol', 'Gilded Reliquary', 'Jade Funerary Mask', 'Sunken Astrolabe'], color: '#ffb347' },
  gold: { cat: 'gold', name: 'Gold', icon: '🪙', weight: 4, min: 1800, max: 2400, skill: 'grab', time: 3, items: ['Gold Bar Crate', 'Bullion Stack', 'Reserve Ingots'], color: '#ffd35c' },
};
export const LOOT_CATS: LootCat[] = ['jewels', 'art', 'cash', 'data', 'relic', 'gold'];

export interface Loot { id: string; cat: LootCat; name: string; value: number; weight: number; primary?: boolean; hotUntil?: number; }

export interface Venue {
  id: VenueId; name: string; icon: string; blurb: string; w: number; h: number; top: [number, number]; bot: [number, number];
  loot: LootCat[]; lootN: [number, number]; safes: [number, number]; cams: [number, number]; lasers: [number, number];
  guards: [number, number]; dogs: number; heavy: number; keycards: number; locked: number; vault: boolean; vaultLocks: Skill[];
  baseFee: number; time: number; rooms: string[]; targets: string[]; targetCat: LootCat; minJobs: number; clients: string[];
}

export const VENUES: Record<VenueId, Venue> = {
  tutorial: {
    id: 'tutorial', name: 'Training Warehouse', icon: '🎓', blurb: 'A forgiving practice job to learn the ropes.', w: 30, h: 18, top: [2, 2], bot: [1, 1],
    loot: ['jewels'], lootN: [2, 3], safes: [0, 0], cams: [1, 1], lasers: [0, 0], guards: [1, 1], dogs: 0, heavy: 0, keycards: 0, locked: 1, vault: false, vaultLocks: [],
    baseFee: 900, time: 300, rooms: ['Stockroom', 'Crate Bay', 'Loading Dock', 'Break Room'], targets: ['The Practice Pearl'], targetCat: 'jewels', minJobs: 0, clients: ['The Old Man'],
  },
  boutique: {
    id: 'boutique', name: 'Velvet & Co. Jewelers', icon: '💍', blurb: 'Small boutique, glittering cases, a nervous owner.', w: 34, h: 22, top: [2, 3], bot: [2, 3],
    loot: ['jewels'], lootN: [4, 6], safes: [1, 1], cams: [2, 3], lasers: [0, 1], guards: [1, 2], dogs: 0, heavy: 0, keycards: 0, locked: 2, vault: false, vaultLocks: [],
    baseFee: 1500, time: 330, rooms: ['Showroom', 'Appraisal Lab', 'Stockroom', 'Workshop', 'Lounge'], targets: ['The Sapphire Tear', 'The Duchess Parure'], targetCat: 'jewels', minJobs: 0, clients: ['Lady Ashgrove', 'Mr. Pell', 'Anonymous'],
  },
  gallery: {
    id: 'gallery', name: 'Halcyon Art Gallery', icon: '🖼️', blurb: 'Priceless canvases behind laser grids. Art is heavy.', w: 42, h: 26, top: [3, 4], bot: [3, 4],
    loot: ['art', 'jewels'], lootN: [4, 6], safes: [1, 1], cams: [3, 4], lasers: [2, 3], guards: [2, 3], dogs: 0, heavy: 0, keycards: 1, locked: 2, vault: false, vaultLocks: [],
    baseFee: 2400, time: 360, rooms: ['Impressionist Hall', 'Sculpture Court', 'Restoration Studio', 'Archive', 'Modern Wing', 'Cafe'], targets: ['"Woman With Lantern"', '"Midnight Cartographer"'], targetCat: 'art', minJobs: 0, clients: ['Collector Voss', 'The Curator', 'Madame Vey'],
  },
  casino: {
    id: 'casino', name: 'Golden Mirage Counting House', icon: '🎰', blurb: 'Cash rooms, keycards everywhere, eyes in the ceiling.', w: 44, h: 26, top: [3, 4], bot: [3, 4],
    loot: ['cash'], lootN: [5, 7], safes: [2, 2], cams: [4, 5], lasers: [0, 1], guards: [3, 4], dogs: 0, heavy: 1, keycards: 3, locked: 1, vault: false, vaultLocks: [],
    baseFee: 3200, time: 380, rooms: ['Cage', 'Count Room', 'High Roller Suite', 'Chip Vault Annex', 'Surveillance Hall', 'Kitchen'], targets: ['The Whale Ledger', 'Pit Boss Reserve'], targetCat: 'cash', minJobs: 1, clients: ['Dealer-in-Chief', 'Rival Syndicate'],
  },
  tower: {
    id: 'tower', name: 'Argent Dynamics Tower', icon: '🏢', blurb: 'Server floors, guard dog, keycard doors. Hackers shine.', w: 44, h: 26, top: [3, 4], bot: [3, 4],
    loot: ['data', 'cash'], lootN: [4, 6], safes: [1, 1], cams: [3, 4], lasers: [1, 2], guards: [2, 3], dogs: 1, heavy: 0, keycards: 3, locked: 1, vault: false, vaultLocks: [],
    baseFee: 3400, time: 380, rooms: ['Server Hall', 'R&D Lab', 'Boardroom', 'Mail Room', 'Data Archive', 'Cold Storage'], targets: ['Project Halcyon Core', 'The Orchid Algorithm'], targetCat: 'data', minJobs: 2, clients: ['Shell Company', 'Dr. Ibarra'],
  },
  museum: {
    id: 'museum', name: 'Orsini Natural History Museum', icon: '🏛️', blurb: 'Relics, lasers and a patrolling hound.', w: 46, h: 28, top: [3, 5], bot: [3, 5],
    loot: ['relic', 'art'], lootN: [4, 6], safes: [1, 1], cams: [3, 4], lasers: [3, 4], guards: [3, 4], dogs: 1, heavy: 0, keycards: 1, locked: 2, vault: false, vaultLocks: [],
    baseFee: 4000, time: 400, rooms: ['Egyptian Hall', 'Fossil Gallery', 'Meteorite Room', 'Conservation Lab', 'Planetarium', 'Gift Shop'], targets: ['The Obsidian Idol', 'The Jade Death Mask'], targetCat: 'relic', minJobs: 3, clients: ['Dr. Orsini (disgraced)', 'Collector Voss'],
  },
  bank: {
    id: 'bank', name: 'Fourth Meridian Savings', icon: '🏦', blurb: 'A proper vault with a proper door. Heavy security.', w: 46, h: 28, top: [3, 5], bot: [3, 4],
    loot: ['cash', 'gold'], lootN: [4, 6], safes: [2, 3], cams: [4, 5], lasers: [1, 2], guards: [3, 4], dogs: 0, heavy: 1, keycards: 2, locked: 2, vault: true, vaultLocks: ['crack'],
    baseFee: 5200, time: 420, rooms: ['Teller Hall', 'Loan Office', 'Safe Deposit', 'Records', 'Staff Lounge', 'Armored Dock'], targets: ['Bearer Bond Cache', 'The Reserve Ingot'], targetCat: 'gold', minJobs: 4, clients: ['The Broker', 'Anonymous'],
  },
  meridian: {
    id: 'meridian', name: 'THE MERIDIAN VAULT', icon: '💠', blurb: 'The capstone. Triple-authorized vault, elite guards, two hounds. One shot.', w: 48, h: 30, top: [4, 5], bot: [3, 5],
    loot: ['gold', 'relic', 'jewels'], lootN: [5, 7], safes: [2, 3], cams: [5, 6], lasers: [3, 4], guards: [4, 5], dogs: 2, heavy: 2, keycards: 3, locked: 2, vault: true, vaultLocks: ['crack', 'tech', 'force'],
    baseFee: 16000, time: 480, rooms: ['Atrium', 'Bullion Annex', 'Gem Reserve', 'Archive of Crowns', 'Control Deck', 'Armory', 'Observatory'], targets: ['The Meridian Star'], targetCat: 'relic', minJobs: 6, clients: ['The Syndicate Itself'],
  },
};
export const VENUE_ORDER: VenueId[] = ['boutique', 'gallery', 'casino', 'tower', 'museum', 'bank'];

export interface Contract {
  id: string; venue: VenueId; tier: number; seed: number; fee: number; client: string; expires: number;
  targetName: string; tutorial?: boolean; final?: boolean;
}

export interface GadgetDef { id: GadgetId; name: string; icon: string; cost: number; desc: string; key: string; }
export const GADGETS: Record<GadgetId, GadgetDef> = {
  smoke: { id: 'smoke', name: 'Smoke Canister', icon: '🌫️', cost: 120, desc: 'Blocks line of sight in a cloud for 9s. Hide crew or cut a camera view.', key: '1' },
  emp: { id: 'emp', name: 'EMP Pulse', icon: '⚡', cost: 260, desc: 'Fries cameras and lasers within 12 tiles for 18s.', key: '2' },
  decoy: { id: 'decoy', name: 'Noise Decoy', icon: '📢', cost: 150, desc: 'Plays loud noises for 6s. Draws guards and dogs to the spot.', key: '3' },
  tranq: { id: 'tranq', name: 'Tranq Dart', icon: '💉', cost: 220, desc: 'Puts the nearest guard or dog to sleep (25s). Silent. Range 3 tiles of target.', key: '4' },
};
export const GADGET_IDS: GadgetId[] = ['smoke', 'emp', 'decoy', 'tranq'];

export interface UpgradeDef { id: UpgradeId; name: string; icon: string; desc: string; costs: number[]; requires?: [UpgradeId, number]; effect: string[]; }
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  safehouse: { id: 'safehouse', name: 'Safehouse Network', icon: '🏚️', desc: 'Heat cools faster each day.', costs: [1500, 3000, 5500], effect: ['+1.5 heat decay/day', '+3 heat decay/day', '+4.5 heat decay/day'] },
  garage: { id: 'garage', name: 'Getaway Garage', icon: '🚗', desc: 'Police take longer to arrive.', costs: [1800, 3500, 6000], requires: ['safehouse', 1], effect: ['+12s police ETA', '+24s police ETA', '+36s police ETA'] },
  intel: { id: 'intel', name: 'Intel Den', icon: '🕵️', desc: 'Casing is cheaper.', costs: [1200, 2600, 4800], effect: ['-30% casing cost', '-60% casing cost', '-85% casing cost'] },
  lawyer: { id: 'lawyer', name: 'Syndicate Lawyer', icon: '⚖️', desc: 'Cheaper bail, fewer arrest heat spikes.', costs: [1400, 3000, 5000], requires: ['intel', 1], effect: ['-30% bail, -25% arrest heat', '-55% bail, -50% arrest heat', '-80% bail, -75% arrest heat'] },
  workshop: { id: 'workshop', name: 'Gadget Workshop', icon: '🔧', desc: 'Gadgets cost less.', costs: [1500, 3200, 5200], requires: ['intel', 1], effect: ['-20% gadget cost', '-40% gadget cost', '-60% gadget cost'] },
};
export const UPGRADE_IDS: UpgradeId[] = ['safehouse', 'garage', 'intel', 'lawyer', 'workshop'];

export interface Fence { id: string; name: string; icon: string; cut: number; bonus: Partial<Record<LootCat, number>>; heatProof: boolean; blurb: string; }
export const FENCES: Fence[] = [
  { id: 'vey', name: "Madame Vey's Salon", icon: '🎩', cut: 0.22, bonus: { art: 1.3, relic: 1.2, jewels: 0.95 }, heatProof: false, blurb: 'Art and antiquities. Taste, discretion.' },
  { id: 'tito', name: "Tito's Pawn & Loan", icon: '🪙', cut: 0.2, bonus: { jewels: 1.25, gold: 1.25, cash: 1.0 }, heatProof: false, blurb: 'Gold, gems and fast cash. Hates heat.' },
  { id: 'broker', name: 'The Broker', icon: '🕶️', cut: 0.32, bonus: { data: 1.45, relic: 1.1, gold: 1.0, cash: 1.0, art: 1.0, jewels: 1.0 }, heatProof: true, blurb: 'Pricey, but does not care how hot you are.' },
];

export const DIFFS: Record<DiffId, { name: string; blurb: string; vis: number; detect: number; heat: number; pay: number; cash: number; eta: number; deadline: number; escWindow: number }> = {
  rookie: { name: 'Rookie', blurb: 'Dim guards, slow heat, fat payouts, long deadline.', vis: 0.85, detect: 0.8, heat: 0.7, pay: 1.15, cash: 4500, eta: 20, deadline: 38, escWindow: 12 },
  pro: { name: 'Professional', blurb: 'The intended experience.', vis: 1, detect: 1, heat: 1, pay: 1, cash: 3200, eta: 0, deadline: 32, escWindow: 8 },
  master: { name: 'Mastermind', blurb: 'Sharp guards, brutal heat, thin margins, tight deadline.', vis: 1.12, detect: 1.25, heat: 1.4, pay: 0.9, cash: 2600, eta: -15, deadline: 27, escWindow: 5 },
};
export const MODS: { id: 'iron' | 'eagle' | 'thrift'; name: string; desc: string; pay: number }[] = [
  { id: 'iron', name: 'Iron Crew', desc: 'Arrested crew are lost forever.', pay: 0.1 },
  { id: 'eagle', name: 'Eagle Eyes', desc: 'Guard vision range +25%.', pay: 0.1 },
  { id: 'thrift', name: 'Thin Margins', desc: 'Half starting cash; fences take +5%.', pay: 0.1 },
];
export type ModId = 'iron' | 'eagle' | 'thrift';

export const HEAT_TIERS = [
  { name: 'Cold', color: '#6ee7ff', desc: 'Nobody is looking at you.' },
  { name: 'Watched', color: '#5cf0a8', desc: '+1 guard on new jobs once above 25.' },
  { name: 'Hot', color: '#ffd35c', desc: 'More cameras, fences take a bigger cut.' },
  { name: 'Wanted', color: '#ff9a4d', desc: 'Faster police, stash raids possible.' },
  { name: 'Manhunt', color: '#ff4d5e', desc: 'One more day like this and the syndicate is raided.' },
];
export const heatTier = (h: number) => Math.min(4, Math.floor(h / 20));

export const fmt = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---------- seeded rng ----------
export type Rng = () => number;
export function mulberry32(a: number): Rng {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const ri = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const pick = <T,>(r: Rng, arr: T[]): T => arr[Math.floor(r() * arr.length)];
export function shuffle<T>(r: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export type ArchId = 'hacker' | 'locksmith' | 'muscle' | 'grifter' | 'ghost';
export type SkillId = 'stealth' | 'hack' | 'lock' | 'muscle' | 'charm';
export type Skills = Record<SkillId, number>;
export type GadgetId = 'smoke' | 'noise' | 'emp' | 'dart' | 'jammer' | 'drill' | 'flash';
export type Cat = 'cash' | 'jewels' | 'art' | 'gold' | 'data' | 'relic';
export type DiffId = 'rookie' | 'pro' | 'mastermind';
export type TraitId = 'steady' | 'jumpy' | 'quiet' | 'strong' | 'greedy' | 'veteran' | 'sharp';

export const SKILLS: { id: SkillId; name: string; icon: string; desc: string }[] = [
  { id: 'stealth', name: 'Stealth', icon: '👣', desc: 'Harder for guards and cameras to notice.' },
  { id: 'hack', name: 'Hacking', icon: '💻', desc: 'Faster terminal, camera and panel hacks.' },
  { id: 'lock', name: 'Locks', icon: '🗝️', desc: 'Faster lockpicking and safecracking. Needed for high-grade locks.' },
  { id: 'muscle', name: 'Muscle', icon: '💪', desc: 'Carry capacity, breaching, takedowns of heavies.' },
  { id: 'charm', name: 'Charm', icon: '🎭', desc: 'Distraction duration and radius.' },
];

export const ARCH: Record<ArchId, { name: string; icon: string; color: string; base: Skills; perk: string; perkDesc: string; hire: number }> = {
  hacker: { name: 'Hacker', icon: '💻', color: '#38bdf8', base: { stealth: 2, hack: 5, lock: 2, muscle: 1, charm: 2 }, perk: 'Remote Link', perkDesc: 'Hacks from up to 6 tiles away, straight through walls.', hire: 900 },
  locksmith: { name: 'Locksmith', icon: '🗝️', color: '#fbbf24', base: { stealth: 3, hack: 2, lock: 5, muscle: 2, charm: 1 }, perk: 'Silent Tumblers', perkDesc: 'Picking and safecracking make no noise and run 25% faster.', hire: 800 },
  muscle: { name: 'Muscle', icon: '💪', color: '#f87171', base: { stealth: 1, hack: 1, lock: 2, muscle: 5, charm: 2 }, perk: 'Bagman', perkDesc: 'Carries +2 weight, hides knocked-out guards, wins grapples against guards.', hire: 850 },
  grifter: { name: 'Grifter', icon: '🎭', color: '#c084fc', base: { stealth: 3, hack: 2, lock: 1, muscle: 2, charm: 5 }, perk: 'Smooth Talker', perkDesc: 'Blends in (60% less noticeable). Talks down one suspicious guard per heist.', hire: 950 },
  ghost: { name: 'Ghost', icon: '🥷', color: '#4ade80', base: { stealth: 5, hack: 2, lock: 3, muscle: 2, charm: 1 }, perk: 'Contortionist', perkDesc: 'Slips through laser grids untouched and runs more quietly.', hire: 1000 },
};

export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  steady: { name: 'Steady Hands', desc: '+15% work speed' },
  jumpy: { name: 'Jumpy', desc: '+20% visible once an alarm is raised' },
  quiet: { name: 'Light Feet', desc: '-30% noise' },
  strong: { name: 'Deep Pockets', desc: '+1 carry capacity' },
  greedy: { name: 'Greedy', desc: '+25% wage' },
  veteran: { name: 'Veteran', desc: 'Starts at level 2' },
  sharp: { name: 'Sharp Eyes', desc: 'Guard suspicion builds 10% slower on them' },
};

export const NAMES = ['Vex', 'Mara', 'Dax', 'Ines', 'Rook', 'Juno', 'Cass', 'Tobias', 'Sable', 'Lux', 'Kade', 'Nyx', 'Odessa', 'Pike', 'Rhea', 'Silas', 'Tess', 'Wren', 'Zed', 'Bram', 'Calla', 'Hollis', 'Ivo', 'Mina'];

export const GADGETS: Record<GadgetId, { name: string; icon: string; cost: number; tier: number; desc: string }> = {
  smoke: { name: 'Smoke Bomb', icon: '💨', cost: 150, tier: 1, desc: 'Blocks line of sight in a 3-tile cloud for 9s.' },
  noise: { name: 'Noisemaker', icon: '📢', cost: 100, tier: 1, desc: 'Lures guards within 10 tiles to investigate the spot.' },
  dart: { name: 'Tranq Dart', icon: '💉', cost: 200, tier: 2, desc: 'Ranged takedown (6 tiles). Target sleeps twice as long. Stuns heavies and the Warden.' },
  emp: { name: 'EMP Charge', icon: '⚡', cost: 250, tier: 2, desc: 'Fries cameras, lasers and drones within 5 tiles for 14s.' },
  drill: { name: 'Thermal Drill', icon: '🔥', cost: 350, tier: 2, desc: 'Cracks a safe or vault 3x faster. Very loud. Enable with the Drill toggle when planning.' },
  jammer: { name: 'Radio Jammer', icon: '📡', cost: 300, tier: 3, desc: 'Guards cannot radio for 25s; alarms spread slowly.' },
  flash: { name: 'Flashbang', icon: '✨', cost: 180, tier: 3, desc: 'Blinds guards within 4 tiles for 7s.' },
};

export const LOOT: Record<string, { name: string; cat: Cat; value: number; w: number; icon: string }> = {
  cash: { name: 'Cash Bundle', cat: 'cash', value: 500, w: 1, icon: '💵' },
  ring: { name: 'Diamond Ring', cat: 'jewels', value: 800, w: 1, icon: '💍' },
  necklace: { name: 'Sapphire Necklace', cat: 'jewels', value: 1400, w: 1, icon: '📿' },
  painting: { name: 'Oil Painting', cat: 'art', value: 2000, w: 2, icon: '🖼️' },
  statue: { name: 'Bronze Statue', cat: 'art', value: 2600, w: 3, icon: '🗿' },
  goldbar: { name: 'Gold Bar', cat: 'gold', value: 1600, w: 2, icon: '🥇' },
  drive: { name: 'Encrypted Drive', cat: 'data', value: 1500, w: 1, icon: '💾' },
  artifact: { name: 'Ancient Artifact', cat: 'relic', value: 3200, w: 2, icon: '🏺' },
  core: { name: 'The Meridian Core', cat: 'relic', value: 30000, w: 2, icon: '🔮' },
};

export const CATS: Record<Cat, { name: string; icon: string; color: string }> = {
  cash: { name: 'Cash', icon: '💵', color: '#4ade80' },
  jewels: { name: 'Jewels', icon: '💎', color: '#67e8f9' },
  art: { name: 'Fine Art', icon: '🎨', color: '#f0abfc' },
  gold: { name: 'Bullion', icon: '🪙', color: '#fde047' },
  data: { name: 'Data', icon: '💽', color: '#93c5fd' },
  relic: { name: 'Relics', icon: '🏺', color: '#fdba74' },
};
export const CAT_IDS = Object.keys(CATS) as Cat[];

export interface Tpl {
  id: string; name: string; clients: string[]; blurb: string; tier: number;
  w: number; h: number; rooms: number;
  guards: number; heavy: number; cams: number; lasers: number; drones: number; civs: number; safes: number;
  terms: string[]; vault: boolean; loot: { kind: string; n: number; where: 'any' | 'vault' }[];
  basePay: number; eta: number; solid?: boolean; boss?: boolean; roomNames: string[]; icon: string;
}

export const TPLS: Record<string, Tpl> = {
  training: { id: 'training', name: 'Training Run: The Pawn Shop', clients: ['The Old Fixer'], blurb: 'A quiet pawn shop. Learn the ropes: plan, execute, escape.', tier: 0, w: 26, h: 20, rooms: 3, guards: 1, heavy: 0, cams: 0, lasers: 0, drones: 0, civs: 0, safes: 0, terms: [], vault: false, loot: [{ kind: 'ring', n: 3, where: 'any' }], basePay: 300, eta: 140, roomNames: ['Shop Floor', 'Back Room', 'Storage', 'Office'], icon: '🎓' },
  jeweler: { id: 'jeweler', name: 'Lucky Karat Jewelers', clients: ['Madam Orlov', 'Sal the Fence', 'Anonymous'], blurb: 'Corner jeweler with a back safe room. A gentle first score.', tier: 1, w: 30, h: 22, rooms: 5, guards: 1, heavy: 0, cams: 1, lasers: 0, drones: 0, civs: 0, safes: 1, terms: ['cams'], vault: true, loot: [{ kind: 'ring', n: 4, where: 'any' }, { kind: 'necklace', n: 2, where: 'any' }, { kind: 'necklace', n: 1, where: 'vault' }], basePay: 600, eta: 115, roomNames: ['Showroom', 'Workshop', 'Office', 'Storeroom', 'Break Room'], icon: '💍' },
  gallery: { id: 'gallery', name: 'Halloran Gallery', clients: ['A Rival Collector', 'Ines Valdez', 'Anonymous'], blurb: 'Private art gallery with pulsing laser curtains and a night curator.', tier: 1, w: 34, h: 24, rooms: 7, guards: 2, heavy: 0, cams: 2, lasers: 1, drones: 0, civs: 1, safes: 1, terms: ['cams', 'lasers'], vault: true, loot: [{ kind: 'painting', n: 3, where: 'any' }, { kind: 'statue', n: 1, where: 'any' }, { kind: 'painting', n: 1, where: 'vault' }, { kind: 'artifact', n: 1, where: 'vault' }], basePay: 900, eta: 115, roomNames: ['Atrium', 'Modern Wing', 'Sculpture Hall', 'Curator Office', 'Archive', 'Cafe', 'Restoration Lab'], icon: '🖼️' },
  datacenter: { id: 'datacenter', name: 'Helix Data Vault', clients: ['Shadow Broker', 'Helix Rival Corp', 'Anonymous'], blurb: 'Server farm with drones overhead and encrypted drives in every rack.', tier: 2, w: 36, h: 24, rooms: 7, guards: 2, heavy: 0, cams: 3, lasers: 1, drones: 1, civs: 0, safes: 0, terms: ['cams', 'comms', 'vault'], vault: true, loot: [{ kind: 'drive', n: 5, where: 'any' }, { kind: 'drive', n: 2, where: 'vault' }, { kind: 'goldbar', n: 1, where: 'vault' }], basePay: 1400, eta: 105, roomNames: ['Reception', 'Server Hall A', 'Server Hall B', 'Cooling Plant', 'NOC', 'Lab', 'Storage'], icon: '🖥️' },
  bank: { id: 'bank', name: 'Orsini Savings & Trust', clients: ['The Marchetti Family', 'Retired Banker', 'Anonymous'], blurb: 'Armoured heavies, safe deposit boxes and a timelocked vault.', tier: 2, w: 38, h: 26, rooms: 9, guards: 3, heavy: 1, cams: 3, lasers: 2, drones: 0, civs: 0, safes: 3, terms: ['cams', 'lasers', 'comms', 'vault'], vault: true, loot: [{ kind: 'cash', n: 5, where: 'any' }, { kind: 'goldbar', n: 3, where: 'vault' }, { kind: 'cash', n: 3, where: 'vault' }], basePay: 1800, eta: 100, roomNames: ['Lobby', 'Teller Line', 'Manager Office', 'Deposit Boxes', 'Records', 'Staff Room', 'Counting Room', 'Armory', 'Mail Room'], icon: '🏦' },
  casino: { id: 'casino', name: 'Gilded Ace Casino', clients: ['The Marchetti Family', 'Don Reyes', 'Anonymous'], blurb: 'Crowded floors, witnesses everywhere, and a mountain of cash upstairs.', tier: 3, w: 44, h: 28, rooms: 11, guards: 4, heavy: 1, cams: 4, lasers: 0, drones: 1, civs: 5, safes: 2, terms: ['cams', 'comms', 'vault'], vault: true, loot: [{ kind: 'cash', n: 8, where: 'any' }, { kind: 'necklace', n: 2, where: 'any' }, { kind: 'goldbar', n: 2, where: 'vault' }, { kind: 'cash', n: 4, where: 'vault' }], basePay: 2500, eta: 95, roomNames: ['Main Floor', 'High Roller Room', 'Bar', 'Cage', 'Surveillance', 'Kitchen', 'Lounge', 'Poker Room', 'Offices', 'Storage', 'Count Room'], icon: '🎰' },
  museum: { id: 'museum', name: 'Natural History Museum', clients: ['Eccentric Billionaire', 'Black Market Curator', 'Anonymous'], blurb: 'Laser halls, drones and heavy sentries guarding priceless relics.', tier: 3, w: 44, h: 28, rooms: 11, guards: 3, heavy: 2, cams: 4, lasers: 3, drones: 2, civs: 0, safes: 1, terms: ['cams', 'lasers', 'comms', 'vault'], vault: true, loot: [{ kind: 'artifact', n: 4, where: 'any' }, { kind: 'statue', n: 2, where: 'any' }, { kind: 'artifact', n: 2, where: 'vault' }, { kind: 'goldbar', n: 2, where: 'vault' }], basePay: 3500, eta: 95, roomNames: ['Grand Hall', 'Dinosaur Wing', 'Egyptian Wing', 'Gem Room', 'Conservation', 'Archive', 'Gift Shop', 'Planetarium', 'Staff Area', 'Loading Dock', 'Vault Antechamber'], icon: '🦴' },
  meridian: { id: 'meridian', name: 'THE MERIDIAN VAULT', clients: ['The Syndicate Council'], blurb: 'The capstone job. A fortress tower, solid laser curtains, drones, and Warden Vance himself. Steal the Meridian Core.', tier: 5, w: 52, h: 32, rooms: 14, guards: 5, heavy: 3, cams: 6, lasers: 4, drones: 3, civs: 0, safes: 3, terms: ['cams', 'lasers', 'comms', 'vault'], vault: true, solid: true, boss: true, loot: [{ kind: 'core', n: 1, where: 'vault' }, { kind: 'goldbar', n: 3, where: 'vault' }, { kind: 'drive', n: 3, where: 'any' }, { kind: 'artifact', n: 2, where: 'any' }], basePay: 10000, eta: 100, roomNames: ['Grand Lobby', 'Atrium', 'Guard Barracks', 'Server Spine', 'Gallery of Sins', 'Archive', 'Command Center', 'Armory', 'Garden', 'Records', 'Tech Lab', 'Hall of Mirrors', 'Staff Wing', 'Panic Room'], icon: '🏛️' },
};

export const TIER_NAMES = ['Nobodies', 'Street Crew', 'Known Crew', 'Syndicate', 'Kingpins', 'Meridian Legends'];
export const REP_STEPS = [0, 0, 80, 220, 450, 800];
export const repTier = (rep: number) => { let t = 1; for (let i = 1; i < REP_STEPS.length; i++) if (rep >= REP_STEPS[i]) t = Math.max(t, i); return Math.min(t, 5); };
export const CAPSTONE_TIER = 4;

export const DIFFS: Record<DiffId, { name: string; desc: string; guards: number; susp: number; police: number; cash: number; heat: number; wage: number }> = {
  rookie: { name: 'Rookie', desc: 'Fewer guards, slow suspicion, generous police delay, more starting cash.', guards: 0.75, susp: 0.8, police: 1.3, cash: 6000, heat: 0.7, wage: 0.7 },
  pro: { name: 'Professional', desc: 'The intended experience. Fair but unforgiving.', guards: 1, susp: 1, police: 1, cash: 4000, heat: 1, wage: 1 },
  mastermind: { name: 'Mastermind', desc: 'More guards, jumpy security, short police ETA, fast-rising heat.', guards: 1.3, susp: 1.25, police: 0.75, cash: 2500, heat: 1.3, wage: 1.2 },
};

export type ModId = 'iron' | 'paranoid' | 'lean';
export const MODS: Record<ModId, { name: string; icon: string; desc: string }> = {
  iron: { name: 'Iron Crew', icon: '⛓️', desc: 'Arrested crew are lost forever.' },
  paranoid: { name: 'Paranoid Security', icon: '👁️', desc: 'Guards notice 30% faster and heat gain +25%.' },
  lean: { name: 'Lean Times', icon: '🪙', desc: 'Start with half the cash, but loot is worth +25%.' },
};

export const CONTRACT_MODS: Record<string, { name: string; desc: string }> = {
  rich: { name: 'Rich Pickings', desc: 'Loot +35% value, +1 guard.' },
  tight: { name: 'Camera Overhaul', desc: '+2 security cameras.' },
  night: { name: 'Blackout Night', desc: 'Rooms are darker, guards see less far.' },
  audit: { name: 'Insurance Audit', desc: 'Police arrive 25% sooner.' },
  none: { name: 'Standard', desc: 'No special conditions.' },
};

export const UPGRADES: { id: string; name: string; icon: string; desc: string; costs: number[] }[] = [
  { id: 'table', name: 'War Room Table', icon: '🗺️', desc: '+1 crew slot on heists (4 total).', costs: [2500] },
  { id: 'scanner', name: 'Police Scanner', icon: '📻', desc: '+15s police response time per level.', costs: [800, 1600, 2800] },
  { id: 'workshop', name: 'Gadget Workshop', icon: '🔧', desc: 'Gadgets cost 15% less per level.', costs: [1200, 2400] },
  { id: 'fence', name: 'Fence Network', icon: '🕸️', desc: 'Fence takes 4% less per level.', costs: [1000, 2000, 3500] },
  { id: 'forger', name: 'Forgery Desk', icon: '🖋️', desc: 'Heat fades 2 points faster per day, per level.', costs: [900, 1800, 3000] },
  { id: 'armory', name: 'Gadget Bandolier', icon: '🎒', desc: '+1 gadget carried per heist per level (base 3).', costs: [600, 1200, 2000] },
  { id: 'lawyer', name: 'Pet Lawyer', icon: '⚖️', desc: 'Bail 35% cheaper and jail 1 day shorter per level.', costs: [1500, 2800] },
];

export const heatTier = (h: number) => (h < 25 ? { n: 'Cold', c: '#4ade80' } : h < 50 ? { n: 'Warm', c: '#fde047' } : h < 75 ? { n: 'Hot', c: '#fb923c' } : { n: 'Scorching', c: '#f87171' });

export const rng32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

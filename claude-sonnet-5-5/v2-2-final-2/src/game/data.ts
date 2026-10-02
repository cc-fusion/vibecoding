import type { Crew, GadgetDef, GadgetId, HeistDef, LootCat, Role, Skill, TraitId, UpgradeDef } from './types';

export const ROLE_INFO: Record<Role, { label: string; icon: string; color: string; special: string; specialDesc: string; base: Record<Skill, number> }> = {
  hacker: { label: 'Hacker', icon: '💻', color: '#38bdf8', special: 'Jam Comms', specialDesc: 'Once per heist: blocks radio/camera alarms for 14s and delays police by 15s.', base: { hack: 3, pick: 1, crack: 0, force: 0, stealth: 1, charm: 1 } },
  cracker: { label: 'Safecracker', icon: '🔓', color: '#fbbf24', special: 'Shaped Charge', specialDesc: 'Once per heist: instantly opens the nearest door or safe. Very loud.', base: { hack: 1, pick: 2, crack: 3, force: 1, stealth: 1, charm: 0 } },
  muscle: { label: 'Muscle', icon: '💪', color: '#f87171', special: 'Ambush', specialDesc: 'Wait at a spot and take down the first unaware guard that passes. Body is left behind.', base: { hack: 0, pick: 0, crack: 1, force: 3, stealth: 0, charm: 1 } },
  shadow: { label: 'Shadow', icon: '🥷', color: '#a78bfa', special: 'Silent Ambush', specialDesc: 'Wait at a spot and silently take down a guard, hiding the body.', base: { hack: 1, pick: 3, crack: 0, force: 1, stealth: 3, charm: 1 } },
  face: { label: 'Face', icon: '🎭', color: '#4ade80', special: 'Distract', specialDesc: 'Wait at a spot and chat up a passing guard for 9 seconds, keeping them blind to others.', base: { hack: 1, pick: 1, crack: 0, force: 0, stealth: 2, charm: 3 } },
};

export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  quick: { name: 'Quick', desc: '+12% movement speed' },
  steady: { name: 'Steady Nerves', desc: 'Guards notice them 15% slower' },
  loyal: { name: 'Loyal', desc: '-30% salary and bail' },
  brawler: { name: 'Brawler', desc: '+25 HP, 50% more melee damage' },
  lucky: { name: 'Lucky', desc: 'Clumsy forced locks never trip alarms' },
  quiet: { name: 'Soft Steps', desc: 'Footstep noise reduced by 40%' },
};

export const SKILL_INFO: Record<Skill, { label: string; icon: string }> = {
  hack: { label: 'Hacking', icon: '🖥️' },
  pick: { label: 'Lockpicking', icon: '🗝️' },
  crack: { label: 'Safecracking', icon: '🔐' },
  force: { label: 'Force', icon: '🔨' },
  stealth: { label: 'Stealth', icon: '👣' },
  charm: { label: 'Charm', icon: '🎩' },
};

export const CAT_INFO: Record<LootCat, { label: string; icon: string }> = {
  cash: { label: 'Cash', icon: '💵' },
  jewels: { label: 'Jewels', icon: '💎' },
  art: { label: 'Art', icon: '🖼️' },
  tech: { label: 'Tech', icon: '💾' },
  bullion: { label: 'Bullion', icon: '🪙' },
  data: { label: 'Data', icon: '🗂️' },
};

export const GADGETS: Record<GadgetId, GadgetDef> = {
  smoke: { id: 'smoke', name: 'Smoke Bomb', icon: '💨', cost: 140, desc: 'Cloud blocks all sight lines for 9s.' },
  emp: { id: 'emp', name: 'EMP Pulse', icon: '⚡', cost: 260, desc: 'Disables cameras, lasers and drones within 7 tiles for 14s.' },
  decoy: { id: 'decoy', name: 'Noise Decoy', icon: '📻', cost: 120, desc: 'Draws nearby guards to the spot for 8s.' },
  dart: { id: 'dart', name: 'Tranq Dart', icon: '🎯', cost: 200, desc: 'Silently drops the nearest guard in sight (range 7). Weakens the Captain.' },
  key: { id: 'key', name: 'Master Key', icon: '🗝️', cost: 300, desc: 'Instantly opens one lock, terminal or safe, silently.' },
};

export const UPGRADES: UpgradeDef[] = [
  { id: 'planning', name: 'Planning Table', icon: '🗺️', costs: [1800, 4500], desc: '+1 crew slot per level (base 3).' },
  { id: 'workshop', name: 'Workshop', icon: '🔧', costs: [900, 2200, 4500], desc: '+1 gadget loadout slot and -10% gadget cost per level.' },
  { id: 'comms', name: 'Comms Hub', icon: '📡', costs: [800, 2000, 4000], desc: '+1 Improvise order per level and -15% recon cost.' },
  { id: 'safehouse', name: 'Safehouse', icon: '🏚️', costs: [1000, 2500, 5000], desc: '+1 heat decay per day and -25% bail per level.' },
  { id: 'garage', name: 'Getaway Garage', icon: '🚐', costs: [1200, 3000, 6000], desc: '+12s police ETA and +5s van wait per level.' },
];

export const FENCES = [
  { id: 'marlowe', name: 'Marlowe & Sons', icon: '🕴️', rate: 1.0, heatPen: 0.004, bust: 0, desc: 'Honest broker. Fair prices, but wary of hot goods.' },
  { id: 'vera', name: 'Dutch Vera', icon: '🚢', rate: 0.74, heatPen: 0, bust: 0, desc: 'Pays less but never cares how hot the goods are.' },
  { id: 'cipher', name: 'Cipher Exchange', icon: '🌐', rate: 1.18, heatPen: 0.002, bust: 0.22, desc: 'Best rates online, but 22% chance each sale gets traced (+4 heat).' },
];

const mk = (id: string, name: string, client: string, district: string, blurb: string, hint: string, o: Partial<HeistDef> & Pick<HeistDef, 'w' | 'h' | 'seed' | 'fee' | 'unlock' | 'prime' | 'map' | 'names' | 'vaultName'>): HeistDef => ({
  id, name, client, district, blurb, hint,
  guards: 2, sentinels: 0, k9: 0, drones: 0, captain: false, cams: 1, lasers: 0, terminals: ['cam'], safes: 1, loose: 3,
  lockMix: [0.4, 0.1, 0], vaultLock: 'pick', vaultStages: 1, pool: ['cash', 'jewels'], recon: [150, 300], eta: 85, par: 150,
  ...o,
});

const item = (name: string, cat: LootCat, value: number, weight: number, icon: string, primary = false) => ({ name, cat, value, weight, icon, primary });

export const HEISTS: HeistDef[] = [
  mk('pawn', "Lucky Seven Pawn & Loan", 'Slick Eddie', 'Old Quarter', 'A greasy pawn shop with a backroom safe and a prized watch collection. A gentle first job.', 'Hack the camera terminal, crack the safe, then run for the van.', {
    w: 30, h: 19, seed: 1011, fee: 900, unlock: 0, map: { x: 14, y: 70 }, vaultName: 'Back Vault', names: ['Shop Floor', 'Stock Room', 'Office', 'Pawn Counter', 'Cage', 'Break Room'],
    prime: item('Antique Watch Collection', 'jewels', 1800, 1, '⌚', true), pool: ['cash', 'jewels'], recon: [100, 220], guards: 2, cams: 1, safes: 1, loose: 3, lockMix: [0.45, 0.1, 0], vaultLock: 'pick', eta: 95, par: 160,
  }),
  mk('jeweler', 'Halcyon Fine Jewelers', 'Madame Orlova', 'Gilt Row', 'Boutique with laser-guarded cases and a vault behind the workshop.', 'Lasers cycle on and off. Sneaking crew wait for a safe window.', {
    w: 34, h: 21, seed: 2027, fee: 1800, unlock: 1, map: { x: 30, y: 44 }, vaultName: 'Vault', names: ['Showroom', 'Workshop', 'Appraisal', 'Office', 'Storage', 'Lounge', 'Server Closet'],
    prime: item('Halcyon Star Sapphire', 'jewels', 4200, 1, '💎', true), pool: ['jewels', 'cash'], recon: [160, 340], guards: 3, cams: 2, lasers: 1, terminals: ['cam', 'laser'], safes: 2, loose: 4, lockMix: [0.4, 0.2, 0], vaultLock: 'hack', eta: 90, par: 170,
  }),
  mk('gallery', 'Brightwater Gallery', 'The Curator', 'Harbor Arts', 'A modern art gallery with roving sentinels and sweeping cameras.', 'Sentinels stand watch in one spot. Time your moves with Distract or smoke.', {
    w: 38, h: 23, seed: 3141, fee: 2800, unlock: 2, map: { x: 48, y: 26 }, vaultName: 'Climate Vault', names: ['Atrium', 'East Gallery', 'West Gallery', 'Restoration Lab', 'Offices', 'Cafe', 'Archive', 'Loading Bay'],
    prime: item('Madonna of the Salt Marsh', 'art', 7500, 2, '🖼️', true), pool: ['art', 'cash', 'jewels'], recon: [220, 440], guards: 3, sentinels: 1, cams: 3, lasers: 2, terminals: ['cam', 'laser'], safes: 2, loose: 5, lockMix: [0.35, 0.25, 0.05], vaultLock: 'hack', eta: 85, par: 190,
  }),
  mk('datacenter', 'Vantage Data Vault', 'Null Cartel', 'Silicon Docks', 'A hardened server farm patrolled by a security drone. Everything is electronic.', 'Drones ignore stealth tricks. EMP or avoid their wide cone.', {
    w: 40, h: 24, seed: 4242, fee: 4200, unlock: 3, map: { x: 66, y: 62 }, vaultName: 'Core Server Cage', names: ['Lobby', 'Server Hall A', 'Server Hall B', 'NOC', 'Cooling Plant', 'Break Room', 'Cable Vault', 'Offices'],
    prime: item('Quantum Key Array', 'tech', 9000, 1, '🔮', true), pool: ['tech', 'data', 'cash'], recon: [300, 560], guards: 3, drones: 1, cams: 3, lasers: 2, terminals: ['cam', 'laser', 'lock'], safes: 2, loose: 5, lockMix: [0.15, 0.55, 0], vaultLock: 'hack', eta: 80, par: 200,
  }),
  mk('bullion', 'Harbor Bullion Depot', 'Captain Reyes', 'Dockside', 'Heavy gold in a steel yard with K9 patrols. Bring muscle.', 'Dogs smell anyone not sneaking. Gold bars are heavy: Muscle carries 4 weight, others 2.', {
    w: 42, h: 25, seed: 5150, fee: 5800, unlock: 4, map: { x: 82, y: 38 }, vaultName: 'Gold Cage', names: ['Gatehouse', 'Weigh Room', 'Warehouse A', 'Warehouse B', 'Forge', 'Customs Office', 'Locker Room', 'Armory'],
    prime: item('Crate of Gold Bars', 'bullion', 14000, 2, '🪙', true), pool: ['bullion', 'cash'], recon: [380, 700], guards: 4, k9: 1, sentinels: 1, cams: 3, lasers: 1, terminals: ['cam', 'lock'], safes: 2, loose: 5, lockMix: [0.2, 0.15, 0.4], vaultLock: 'breach', eta: 80, par: 210,
  }),
  mk('casino', 'Orchid Casino Count Room', 'Don Valeriano', 'The Strip', 'A packed casino with a fortress count room. Lots of eyes, lots of cash.', 'Many guards: use Ambush spots and decoys. Cameras everywhere.', {
    w: 44, h: 26, seed: 6006, fee: 7500, unlock: 5, map: { x: 72, y: 14 }, vaultName: 'Count Room', names: ['Casino Floor', 'High Roller Lounge', 'Kitchen', 'Cage', 'Surveillance', 'Offices', 'Bar', 'Staff Hall'],
    prime: item('Armored Cash Cart', 'cash', 22000, 2, '💰', true), pool: ['cash', 'jewels', 'data'], recon: [450, 800], guards: 5, k9: 1, sentinels: 1, cams: 5, lasers: 1, terminals: ['cam', 'laser', 'lock'], safes: 3, loose: 6, lockMix: [0.25, 0.3, 0.15], vaultLock: 'breach', eta: 75, par: 230,
  }),
  mk('penthouse', 'Lumen Tower Penthouse', 'Mr. Vale', 'Skyline', 'A glass tower auction with drones, sentinels and nested laser nets.', 'Mix EMP, smoke and sync signals so everyone moves at once.', {
    w: 46, h: 28, seed: 7777, fee: 9500, unlock: 5, map: { x: 50, y: 8 }, vaultName: 'Auction Vault', names: ['Sky Lobby', 'Gala Hall', 'Coat Check', 'Suite', 'Control Room', 'Terrace', 'Gym', 'Sauna', 'Library'],
    prime: item('Lumen Blue Diamond', 'jewels', 30000, 1, '💠', true), pool: ['jewels', 'art', 'tech'], recon: [550, 950], guards: 4, sentinels: 2, drones: 2, cams: 5, lasers: 3, terminals: ['cam', 'laser', 'lock'], safes: 3, loose: 6, lockMix: [0.25, 0.35, 0.1], vaultLock: 'hack', eta: 70, par: 240,
  }),
  mk('meridian', 'The Meridian Vault', 'The Syndicate', 'Meridian Plaza', 'The legendary bank vault beneath Meridian Plaza. Captain Voss and a three-stage vault protocol stand between you and the Meridian Diamond.', 'Each vault stage trips the alarm. Be ready to run, and watch for Captain Voss.', {
    w: 50, h: 30, seed: 9001, fee: 25000, unlock: 6, map: { x: 36, y: 86 }, vaultName: 'Meridian Vault', names: ['Grand Lobby', 'Teller Hall', 'Safe Deposit', 'Boardroom', 'Security Hub', 'Archive', 'Records', 'Staff Wing', 'Guard Barracks', 'Server Core'],
    prime: item('The Meridian Diamond', 'jewels', 80000, 1, '👑', true), pool: ['jewels', 'cash', 'bullion', 'art', 'data'], recon: [800, 1400], guards: 6, sentinels: 2, k9: 2, drones: 2, captain: true, cams: 6, lasers: 3, terminals: ['cam', 'laser', 'lock'], safes: 3, loose: 6, lockMix: [0.2, 0.3, 0.2], vaultLock: 'breach', vaultStages: 3, eta: 65, par: 300,
  }),
];

export const HEIST_BY_ID: Record<string, HeistDef> = Object.fromEntries(HEISTS.map(h => [h.id, h]));

export const LOOT_NAMES: Record<LootCat, { n: string; icon: string; v: [number, number]; w: number }[]> = {
  cash: [{ n: 'Bag of Cash', icon: '💵', v: [400, 800], w: 1 }, { n: 'Stack of Bearer Bonds', icon: '📜', v: [700, 1200], w: 1 }],
  jewels: [{ n: 'Diamond Necklace', icon: '📿', v: [900, 1800], w: 1 }, { n: 'Emerald Ring', icon: '💍', v: [600, 1300], w: 1 }],
  art: [{ n: 'Oil Painting', icon: '🖼️', v: [1500, 3200], w: 2 }, { n: 'Marble Bust', icon: '🗿', v: [1200, 2400], w: 2 }],
  tech: [{ n: 'Prototype Chip', icon: '💾', v: [900, 1800], w: 1 }, { n: 'Encrypted Drive', icon: '🔋', v: [700, 1500], w: 1 }],
  bullion: [{ n: 'Gold Bar', icon: '🪙', v: [1800, 2800], w: 2 }],
  data: [{ n: 'Ledger Archive', icon: '🗂️', v: [800, 1600], w: 1 }, { n: 'Blackmail Dossier', icon: '📁', v: [1000, 2000], w: 1 }],
};

const NAMES = ['Nyx', 'Vesper', 'Brick', 'Juno', 'Rook', 'Sable', 'Quill', 'Tank', 'Mirage', 'Ghost', 'Cinder', 'Pixel', 'Lark', 'Dagger', 'Echo', 'Fable', 'Zephyr', 'Onyx', 'Bishop', 'Cobra', 'Dahlia', 'Moth', 'Hex', 'Vandal'];
const TRAIT_LIST: TraitId[] = ['quick', 'steady', 'loyal', 'brawler', 'lucky', 'quiet'];

export function makeCrew(uid: number, role: Role, level: number, rnd: () => number, forceName?: string, trait?: TraitId): Crew {
  const info = ROLE_INFO[role];
  const skills = { ...info.base };
  const primary = (Object.keys(skills) as Skill[]).sort((a, b) => skills[b] - skills[a]);
  for (let i = 1; i < level; i++) skills[primary[Math.floor(rnd() * 2)]] = Math.min(5, skills[primary[Math.floor(rnd() * 2)]] + 1);
  const tr = trait ?? TRAIT_LIST[Math.floor(rnd() * TRAIT_LIST.length)];
  const salary = 60 + level * 40;
  return {
    id: 'c' + uid, name: forceName ?? NAMES[Math.floor(rnd() * NAMES.length)], role, skills, trait: tr, level, xp: 0, perks: 0, salary,
    hire: 500 + level * 450 + Math.floor(rnd() * 200), icon: info.icon, color: info.color, jailed: 0, heists: 0,
  };
}

export const xpNeeded = (lvl: number) => 80 + lvl * 70;
export const heatTier = (h: number) => (h < 25 ? 0 : h < 50 ? 1 : h < 75 ? 2 : 3);
export const HEAT_NAMES = ['Cold', 'Warm', 'Hot', 'Burning'];
export const HEAT_COLORS = ['#38bdf8', '#fbbf24', '#fb923c', '#ef4444'];
export const DIFF_NAMES = ['Rookie', 'Professional', 'Mastermind'];
export const DIFF_DESC = [
  'Forgiving guards, longer police ETA, extra improv orders, generous starting cash. 4 raids allowed.',
  'The intended experience. 3 raids allowed.',
  'Sharper guards, faster police, 30% bigger fees, tight cash. Only 2 raids allowed.',
];
export const MOD_INFO = {
  iron: { name: 'Iron Crew', icon: '⛓️', desc: 'Arrested crew are lost forever. Loot is worth +20%.' },
  hot: { name: 'Hot Streak', icon: '🔥', desc: 'Heat gains are +50%. Fees are +40%.' },
  fuse: { name: 'Short Fuse', icon: '🧨', desc: 'Police arrive 35% sooner. Alarm builds faster.' },
};

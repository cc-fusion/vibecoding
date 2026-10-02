export type Branch = 'hull' | 'life' | 'power' | 'tools';

export interface Upgrade {
  id: string;
  branch: Branch;
  name: string;
  desc: string;
  icon: string;
  max: number;
  cost: number[];
  req?: { id: string; lvl: number };
}

export const BRANCHES: { id: Branch; name: string; color: string; icon: string }[] = [
  { id: 'hull', name: 'Hull & Cargo', color: '#f0b84a', icon: '🛡️' },
  { id: 'life', name: 'Life Support', color: '#5fe3c0', icon: '🫧' },
  { id: 'power', name: 'Power & Light', color: '#7cc7ff', icon: '💡' },
  { id: 'tools', name: 'Salvage Tools', color: '#ff8d6b', icon: '🔱' },
];

export const UPGRADES: Upgrade[] = [
  { id: 'plating', branch: 'hull', name: 'Titanium Plating', icon: '🛡️', max: 5, cost: [120, 260, 480, 800, 1300], desc: '+90 m crush depth rating and +10 max hull per tier.' },
  { id: 'ballast', branch: 'hull', name: 'Pressure Ballast', icon: '⚖️', max: 2, cost: [400, 900], req: { id: 'plating', lvl: 2 }, desc: '+40 m crush depth rating per tier.' },
  { id: 'repair', branch: 'hull', name: 'Repair Drones', icon: '🔧', max: 3, cost: [200, 450, 900], req: { id: 'plating', lvl: 1 }, desc: 'Regenerate hull while drifting slowly (needs power).' },
  { id: 'insurance', branch: 'hull', name: 'Salvage Insurance', icon: '📜', max: 3, cost: [250, 600, 1100], req: { id: 'plating', lvl: 1 }, desc: 'Keep 25% of cargo value per tier if the sub is lost.' },
  { id: 'cargo', branch: 'hull', name: 'Cargo Racks', icon: '📦', max: 4, cost: [150, 320, 600, 950], desc: '+4 cargo capacity per tier. Heavy cargo slows you down.' },
  { id: 'tank', branch: 'life', name: 'Air Tanks', icon: '🫧', max: 5, cost: [100, 220, 400, 700, 1100], desc: '+30 air capacity per tier.' },
  { id: 'scrubber', branch: 'life', name: 'CO₂ Scrubbers', icon: '🌿', max: 3, cost: [200, 480, 900], req: { id: 'tank', lvl: 1 }, desc: '-12% air consumption per tier.' },
  { id: 'reserve', branch: 'life', name: 'Reserve Cylinder', icon: '🧪', max: 1, cost: [700], req: { id: 'tank', lvl: 2 }, desc: 'Once per dive, refill 40% air when you run dry.' },
  { id: 'battery', branch: 'power', name: 'Capacitor Bank', icon: '🔋', max: 5, cost: [100, 220, 400, 700, 1100], desc: '+25 power capacity per tier.' },
  { id: 'lens', branch: 'power', name: 'Lantern Lens', icon: '🔦', max: 4, cost: [140, 300, 560, 900], req: { id: 'battery', lvl: 1 }, desc: '+35 lantern radius per tier.' },
  { id: 'leds', branch: 'power', name: 'Low-draw LEDs', icon: '✨', max: 3, cost: [200, 450, 850], req: { id: 'lens', lvl: 1 }, desc: '-15% lantern power draw per tier.' },
  { id: 'dynamo', branch: 'power', name: 'Kinetic Dynamo', icon: '⚙️', max: 3, cost: [300, 650, 1100], req: { id: 'battery', lvl: 2 }, desc: 'Generate power while cruising (not boosting).' },
  { id: 'harpoon', branch: 'tools', name: 'Harpoon Tips', icon: '🔱', max: 5, cost: [120, 260, 480, 800, 1200], desc: '+25% harpoon damage per tier.' },
  { id: 'reel', branch: 'tools', name: 'Quick Winch', icon: '🪝', max: 3, cost: [200, 450, 850], req: { id: 'harpoon', lvl: 1 }, desc: '-15% harpoon reload per tier.' },
  { id: 'sonar', branch: 'tools', name: 'Deep Sonar', icon: '📡', max: 3, cost: [150, 350, 700], desc: '+25% sonar range, cheaper pings.' },
  { id: 'flares', branch: 'tools', name: 'Flare Rack', icon: '🎇', max: 3, cost: [120, 300, 600], desc: '+1 flare per dive per tier.' },
  { id: 'emp', branch: 'tools', name: 'EMP Coil', icon: '⚡', max: 3, cost: [500, 800, 1200], req: { id: 'battery', lvl: 2 }, desc: 'Unlocks the EMP pulse (R). Higher tiers: bigger radius, longer stun.' },
  { id: 'thrusters', branch: 'tools', name: 'Hydro Thrusters', icon: '🌀', max: 4, cost: [140, 300, 560, 900], desc: '+8% thrust and top speed per tier.' },
  { id: 'magnet', branch: 'tools', name: 'Tractor Arm', icon: '🧲', max: 3, cost: [100, 250, 500], desc: 'Larger salvage pickup radius.' },
];

export interface SiteDef {
  id: number;
  name: string;
  blurb: string;
  depth: number; // metres
  nodes: number;
  puzzles: ('echo' | 'rings' | 'grid')[];
  reward: number;
  boss: boolean;
  current: number;
  shoals: number;
  jellies: number;
  eels: number;
  anglers: number;
  sentinels: number;
  scrap: number;
  gears: number;
  relics: number;
  crates: number;
  vents: number;
  tablets: number;
  color: [number, number, number]; // rock rgb
  accent: string;
}

export const SITES: SiteDef[] = [
  { id: 0, name: 'Glasswater Shallows', blurb: 'Sunlit wrecks of the Archive\u2019s outer docks. Gentle currents, curious eels.', depth: 180, nodes: 2, puzzles: ['echo', 'grid'], reward: 300, boss: false, current: 14, shoals: 5, jellies: 3, eels: 3, anglers: 0, sentinels: 0, scrap: 40, gears: 10, relics: 3, crates: 4, vents: 4, tablets: 2, color: [70, 92, 100], accent: '#6be0d0' },
  { id: 1, name: 'Kelp Cathedral', blurb: 'Towering kelp spires hide reading rooms. Strong tides push you around.', depth: 280, nodes: 3, puzzles: ['rings', 'echo', 'grid'], reward: 550, boss: false, current: 34, shoals: 6, jellies: 6, eels: 5, anglers: 0, sentinels: 0, scrap: 50, gears: 14, relics: 5, crates: 5, vents: 4, tablets: 2, color: [52, 86, 76], accent: '#7dffa0' },
  { id: 2, name: 'The Brine Trench', blurb: 'Light dies here. Lure-anglers wait and the first sentinels still patrol.', depth: 400, nodes: 3, puzzles: ['grid', 'rings', 'echo'], reward: 900, boss: false, current: 22, shoals: 6, jellies: 6, eels: 5, anglers: 4, sentinels: 3, scrap: 55, gears: 16, relics: 6, crates: 5, vents: 3, tablets: 3, color: [58, 62, 96], accent: '#9aa8ff' },
  { id: 3, name: 'The Drowned Library', blurb: 'Endless flooded stacks guarded by tireless automata.', depth: 520, nodes: 4, puzzles: ['rings', 'grid', 'echo', 'rings'], reward: 1400, boss: false, current: 16, shoals: 5, jellies: 7, eels: 5, anglers: 5, sentinels: 7, scrap: 60, gears: 20, relics: 8, crates: 5, vents: 3, tablets: 3, color: [96, 72, 62], accent: '#ffb27a' },
  { id: 4, name: 'The Heart Vault', blurb: 'The sunken heart of the Archive. Its Warden has never slept.', depth: 640, nodes: 3, puzzles: ['grid', 'rings', 'echo'], reward: 2500, boss: true, current: 10, shoals: 4, jellies: 6, eels: 5, anglers: 5, sentinels: 6, scrap: 55, gears: 22, relics: 9, crates: 6, vents: 3, tablets: 2, color: [92, 58, 86], accent: '#ff7ad0' },
];

export const TRAINING_SITE: SiteDef = {
  id: -1, name: 'Training Pool', blurb: 'A calm practice pool beneath the dock.', depth: 70, nodes: 1, puzzles: ['echo'], reward: 0, boss: false, current: 0,
  shoals: 1, jellies: 0, eels: 0, anglers: 0, sentinels: 0, scrap: 8, gears: 0, relics: 0, crates: 1, vents: 1, tablets: 0, color: [70, 92, 100], accent: '#6be0d0',
};

export interface Diff { id: string; name: string; blurb: string; enemy: number; dmg: number; drain: number; marks: number; threat: number; boss: number }
export const DIFFS: Diff[] = [
  { id: 'calm', name: 'Tide Pool', blurb: 'Fewer creatures, gentler stings, slower air use. -20% marks.', enemy: 0.6, dmg: 0.6, drain: 0.8, marks: 0.8, threat: 0.7, boss: 0.7 },
  { id: 'standard', name: 'Deep Diver', blurb: 'The intended experience.', enemy: 1, dmg: 1, drain: 1, marks: 1, threat: 1, boss: 1 },
  { id: 'abyssal', name: 'Crushing Abyss', blurb: 'More predators, brutal damage, hungry air. +60% marks.', enemy: 1.5, dmg: 1.4, drain: 1.2, marks: 1.6, threat: 1.5, boss: 1.4 },
];

export interface Mod { id: string; name: string; desc: string; marks: number; icon: string }
export const MODS: Mod[] = [
  { id: 'blackout', name: 'Blackout', icon: '🌑', desc: 'Lantern radius -40%.', marks: 0.25 },
  { id: 'thinair', name: 'Thin Air', icon: '😮‍💨', desc: 'Air tanks hold 30% less; fewer vents.', marks: 0.25 },
  { id: 'hungry', name: 'Hungry Deep', icon: '🦈', desc: '+50% creatures and faster ecosystem spawns.', marks: 0.25 },
  { id: 'glass', name: 'Glass Hull', icon: '🥚', desc: 'All damage taken +50%.', marks: 0.3 },
];

export interface Lore { id: number; title: string; text: string }
export const LORE: Lore[] = [
  { id: 0, title: 'Tidewrit I — The Burning Year', text: 'When the cities burned, the Hydrarchs did not flee the fire. They sank their library beneath the sea and let the ocean keep every page.' },
  { id: 1, title: 'Keeper\u2019s Log, Docks', text: 'The outer docks were built to float. The tide was meant to carry readers in. Nobody planned for the tide to carry them out again.' },
  { id: 2, title: 'On Glyph Echoes', text: 'The terminals answer only in song. Four tones, repeated true. A librarian who forgets the tune is simply locked out; a thief is not so lucky.' },
  { id: 3, title: 'Kelp Cathedral Hymnal', text: 'We grew the kelp to hold the stacks upright. It grew past us, and now it reads over our shoulders.' },
  { id: 4, title: 'Ring-Lock Manual', text: 'Every ring in a lock leans on its neighbour. Move one and the others complain. Solve it backwards, as it was built.' },
  { id: 5, title: 'The Anglers', text: 'The lights in the trench are not lamps. They were never lamps. Do not swim toward the warm ones.' },
  { id: 6, title: 'Pressure Treatise', text: 'The sea weighs more than any book. A hull rated for one hundred fathoms will tell you its limit loudly, once.' },
  { id: 7, title: 'Sentinel Directive 9', text: 'Intruders shall be illuminated. Illuminated intruders shall be corrected. Corrections are final.' },
  { id: 8, title: 'The Silent Stacks', text: 'The automata recite the catalogue to themselves, endlessly. When your light touches them, they lose their place — and it makes them angry.' },
  { id: 9, title: 'Archivist\u2019s Confession', text: 'I built the Warden from my own wish to protect the books. I forgot to teach it that I, too, would one day want to read them.' },
  { id: 10, title: 'Warden Protocol', text: 'Armoured when striding. Open when it stumbles. A Warden that strikes stone will rest a while.' },
  { id: 11, title: 'The Heart', text: 'The Heart of the Archive is not a book at all. It is the first reader\u2019s lamp. Take it home, and let the library finally close.' },
];

export interface Stats {
  maxAir: number; airDrain: number; maxHull: number; rating: number; repair: number; insurance: number; cargoCap: number;
  maxPower: number; lensR: number; ledMul: number; dynamo: number; dmg: number; cd: number; sonarR: number; sonarCost: number;
  flares: number; emp: number; speed: number; magnet: number; reserve: boolean; marksMul: number;
}

export interface SaveLike { upgrades: Record<string, number>; codex: number[] }

export function lvl(s: SaveLike, id: string): number { return s.upgrades[id] || 0; }

export function computeStats(s: SaveLike, mods: string[]): Stats {
  const L = (id: string) => lvl(s, id);
  const thin = mods.includes('thinair') ? 0.7 : 1;
  const dark = mods.includes('blackout') ? 0.6 : 1;
  const cx = s.codex.length;
  return {
    maxAir: (100 + 30 * L('tank')) * thin,
    airDrain: 1 - 0.12 * L('scrubber'),
    maxHull: 100 + 10 * L('plating'),
    rating: 160 + 90 * L('plating') + 40 * L('ballast'),
    repair: 0.6 * L('repair'),
    insurance: 0.25 * L('insurance'),
    cargoCap: 8 + 4 * L('cargo'),
    maxPower: 100 + 25 * L('battery'),
    lensR: (220 + 35 * L('lens')) * dark,
    ledMul: 1 - 0.15 * L('leds'),
    dynamo: 0.7 * L('dynamo'),
    dmg: 14 * (1 + 0.25 * L('harpoon')),
    cd: 0.55 * (1 - 0.15 * L('reel')),
    sonarR: 600 * (1 + 0.25 * L('sonar')),
    sonarCost: 10 * (1 - 0.1 * L('sonar')),
    flares: 2 + L('flares') + (cx >= 4 ? 1 : 0),
    emp: L('emp'),
    speed: 1 + 0.08 * L('thrusters'),
    magnet: 60 + 30 * L('magnet'),
    reserve: L('reserve') > 0,
    marksMul: cx >= 12 ? 1.15 : 1,
  };
}

export const CODEX_PERKS = [
  { n: 4, text: '+1 starting flare' },
  { n: 8, text: 'Sonar pings reveal hidden tablets' },
  { n: 12, text: '+15% marks from every dive' },
];

export const TUTORIAL_STEPS = [
  'Move with WASD / Arrow keys. Swim around the pool.',
  'Hold SHIFT to boost. It burns power and makes noise.',
  'Press L to toggle your lantern. Light costs power and draws jellies.',
  'Collect 3 scrap — just swim near it. Cargo adds weight.',
  'Aim with the mouse and fire your harpoon (Left Click / Space) at the jelly.',
  'Press Q to send a sonar ping. It reveals creatures and items.',
  'Press F to drop a flare. Creatures follow light.',
  'Swim to the glowing ancient terminal and press E to solve its puzzle.',
  'Swim up to the dock at the surface and press E to end the dive.',
];

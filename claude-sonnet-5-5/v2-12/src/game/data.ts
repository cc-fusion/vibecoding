export type UType = 'mote' | 'sling' | 'prism' | 'bulwark' | 'singularity' | 'core' | 'warden' | 'horizon';
export type Flag = 'lens' | 'pierce' | 'anchor' | 'pull' | 'push' | 'vamp' | 'ghost';
export type PlayableType = 'mote' | 'sling' | 'prism' | 'bulwark' | 'singularity' | 'core';

export interface Mods {
  hp?: number;
  atk?: number;
  mass?: number;
  move?: number;
  range?: number;
  armor?: number;
  flags?: Flag[];
}

export interface UnitDef {
  type: UType;
  name: string;
  role: string;
  mass: number;
  hp: number;
  atk: number;
  move: number;
  mpat: 'step' | 'orth' | 'diag' | 'any' | 'knight';
  adirs: 'all' | 'orth' | 'diag' | 'knight';
  range: number;
  impulse: 'none' | 'push' | 'pull';
  cost: number;
  unlock: number; // level id that must be cleared (0 = from start)
  blurb: string;
  boss?: boolean;
}

export const UNITS: Record<UType, UnitDef> = {
  mote: {
    type: 'mote', name: 'Mote', role: 'Pawn', mass: 1, hp: 5, atk: 2, move: 2, mpat: 'step', adirs: 'all', range: 1,
    impulse: 'none', cost: 15, unlock: 0,
    blurb: 'Light infantry. Walks 8 ways, strikes adjacent. Drifts easily - cheap bait for wells.',
  },
  sling: {
    type: 'sling', name: 'Slingshot', role: 'Knight', mass: 2, hp: 6, atk: 3, move: 2.2, mpat: 'knight', adirs: 'knight', range: 1,
    impulse: 'none', cost: 30, unlock: 0,
    blurb: 'Leaps in an L and lobs shells in an L. Lobbed shots ignore gravity bending and blockers.',
  },
  prism: {
    type: 'prism', name: 'Prism', role: 'Bishop', mass: 2, hp: 5, atk: 3, move: 4, mpat: 'diag', adirs: 'diag', range: 4,
    impulse: 'none', cost: 35, unlock: 1,
    blurb: 'Slides and fires diagonal beams (range 4). Beams curve around heavy masses.',
  },
  bulwark: {
    type: 'bulwark', name: 'Bulwark', role: 'Rook', mass: 4, hp: 10, atk: 3, move: 4, mpat: 'orth', adirs: 'orth', range: 3,
    impulse: 'push', cost: 45, unlock: 2,
    blurb: 'Heavy orthogonal slider. Hits shove lighter targets back - into holes, walls, or each other.',
  },
  singularity: {
    type: 'singularity', name: 'Singularity', role: 'Queen', mass: 6, hp: 9, atk: 4, move: 5, mpat: 'any', adirs: 'all', range: 4,
    impulse: 'pull', cost: 80, unlock: 4,
    blurb: 'Massive and mobile. Its field bends every beam nearby, and its hits drag targets inward.',
  },
  core: {
    type: 'core', name: 'Core', role: 'King', mass: 3, hp: 12, atk: 2, move: 2, mpat: 'step', adirs: 'all', range: 1,
    impulse: 'none', cost: 0, unlock: 99,
    blurb: 'Your command reactor. If it falls - or drifts into a hole - the battle is lost.',
  },
  warden: {
    type: 'warden', name: 'Neutron Warden', role: 'Boss', mass: 8, hp: 28, atk: 4, move: 2, mpat: 'orth', adirs: 'orth', range: 4,
    impulse: 'push', cost: 0, unlock: 99, boss: true,
    blurb: 'Anchored titan. Every 3rd round it unleashes a shockwave that hurls everything away.',
  },
  horizon: {
    type: 'horizon', name: 'Event Horizon', role: 'Final Boss', mass: 12, hp: 44, atk: 4, move: 1, mpat: 'step', adirs: 'all', range: 5,
    impulse: 'pull', cost: 0, unlock: 99, boss: true,
    blurb: 'A walking collapse. Marks tiles for gravitational ruin and sheds Motes. Its field warps everything.',
  },
};

export interface Promo {
  id: string;
  name: string;
  desc: string;
  mods: Mods;
}
export interface PromoTree {
  a: [Promo, Promo];
  b: [Promo, Promo];
}

export const PROMOS: Record<PlayableType, PromoTree> = {
  mote: {
    a: [
      { id: 'mote_a1', name: 'Comet', desc: '+1 move, +1 attack', mods: { move: 1, atk: 1 } },
      { id: 'mote_a2', name: 'Nova', desc: '+1 attack, +1 range, shrugs off gravity cost', mods: { atk: 1, range: 1, flags: ['ghost'] } },
    ],
    b: [
      { id: 'mote_b1', name: 'Asteroid', desc: '+2 mass, +3 HP', mods: { mass: 2, hp: 3 } },
      { id: 'mote_b2', name: 'Planetoid', desc: '+3 HP, +1 armor, anchored vs drift', mods: { hp: 3, armor: 1, flags: ['anchor'] } },
    ],
  },
  sling: {
    a: [
      { id: 'sling_a1', name: 'Catapult', desc: '+1 attack, shells shove targets', mods: { atk: 1, flags: ['push'] } },
      { id: 'sling_a2', name: 'Siege Lord', desc: '+2 attack, +2 HP', mods: { atk: 2, hp: 2 } },
    ],
    b: [
      { id: 'sling_b1', name: 'Slingshot Ace', desc: 'Gravity never slows its leaps', mods: { flags: ['ghost'], move: 0.6 } },
      { id: 'sling_b2', name: 'Gravity Rider', desc: '+1 attack, heals 2 on kill', mods: { atk: 1, flags: ['vamp'] } },
    ],
  },
  prism: {
    a: [
      { id: 'prism_a1', name: 'Lens', desc: 'Beams no longer bend. +1 range', mods: { flags: ['lens'], range: 1 } },
      { id: 'prism_a2', name: 'Focal Array', desc: '+1 attack, +1 range, beams pierce', mods: { atk: 1, range: 1, flags: ['pierce'] } },
    ],
    b: [
      { id: 'prism_b1', name: 'Refractor', desc: 'Beams pierce a 2nd target', mods: { flags: ['pierce'] } },
      { id: 'prism_b2', name: 'Spectrum', desc: '+2 attack, +1 mass', mods: { atk: 2, mass: 1 } },
    ],
  },
  bulwark: {
    a: [
      { id: 'bulwark_a1', name: 'Fortress', desc: '+4 HP, +1 armor', mods: { hp: 4, armor: 1 } },
      { id: 'bulwark_a2', name: 'Citadel', desc: 'Anchored, +1 armor, +3 HP', mods: { flags: ['anchor'], armor: 1, hp: 3 } },
    ],
    b: [
      { id: 'bulwark_b1', name: 'Ram', desc: '+1 attack, +1 move', mods: { atk: 1, move: 1 } },
      { id: 'bulwark_b2', name: 'Siege Tower', desc: '+1 range, +2 attack', mods: { range: 1, atk: 2 } },
    ],
  },
  singularity: {
    a: [
      { id: 'singularity_a1', name: 'Maelstrom', desc: '+1 range, +1 attack', mods: { range: 1, atk: 1 } },
      { id: 'singularity_a2', name: 'Black Star', desc: '+3 mass, +2 attack', mods: { mass: 3, atk: 2 } },
    ],
    b: [
      { id: 'singularity_b1', name: 'Dark Matter', desc: '+4 HP, +1 armor', mods: { hp: 4, armor: 1 } },
      { id: 'singularity_b2', name: 'Dominion', desc: 'Heals 2 on kill, +1 move, +3 HP', mods: { flags: ['vamp'], move: 1, hp: 3 } },
    ],
  },
  core: {
    a: [
      { id: 'core_a1', name: 'Bastion Core', desc: '+5 HP, +1 armor', mods: { hp: 5, armor: 1 } },
      { id: 'core_a2', name: 'Fortress Core', desc: 'Anchored against drift, +5 HP', mods: { flags: ['anchor'], hp: 5 } },
    ],
    b: [
      { id: 'core_b1', name: 'Commander', desc: '+1 attack, +1 move', mods: { atk: 1, move: 1 } },
      { id: 'core_b2', name: 'Warlord', desc: '+2 attack, +1 range', mods: { atk: 2, range: 1 } },
    ],
  },
};

export const PROMO_BY_ID: Record<string, Promo> = {};
(Object.keys(PROMOS) as PlayableType[]).forEach((t) => {
  [...PROMOS[t].a, ...PROMOS[t].b].forEach((p) => (PROMO_BY_ID[p.id] = p));
});

export const XP_TIERS = [8, 20];
export const PROMO_COST = [40, 90];

export interface Stats {
  mass: number;
  hp: number;
  atk: number;
  move: number;
  range: number;
  armor: number;
  impulse: 'none' | 'push' | 'pull';
  flags: Flag[];
}

export function computeStats(type: UType, promos: string[]): Stats {
  const d = UNITS[type];
  const s: Stats = { mass: d.mass, hp: d.hp, atk: d.atk, move: d.move, range: d.range, armor: 0, impulse: d.impulse, flags: [] };
  if (d.boss) s.flags.push('anchor');
  for (const id of promos) {
    const p = PROMO_BY_ID[id];
    if (!p) continue;
    const m = p.mods;
    s.mass += m.mass || 0;
    s.hp += m.hp || 0;
    s.atk += m.atk || 0;
    s.move += m.move || 0;
    s.range += m.range || 0;
    s.armor += m.armor || 0;
    (m.flags || []).forEach((f) => {
      if (!s.flags.includes(f)) s.flags.push(f);
    });
  }
  return s;
}

export type Terrain = '.' | '#' | 'N' | 'W' | 'R' | 'H';
export const TERRAIN_INFO: Record<string, { name: string; desc: string }> = {
  '#': { name: 'Asteroid', desc: 'Blocks movement and beams.' },
  N: { name: 'Nebula', desc: 'Costs +0.8 to enter. Ranged hits against units inside deal -1.' },
  W: { name: 'Gravity Well', desc: 'Mass +6. Pulls beams and drifting pieces inward.' },
  R: { name: 'Repulsor', desc: 'Mass -5. Pushes beams and pieces away.' },
  H: { name: 'Black Hole', desc: 'Mass +8. Lethal: anything that falls in is destroyed. Cannot be entered voluntarily.' },
};

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  story: string;
  obj: 'king' | 'annihilate' | 'survive';
  surviveRounds?: number;
  par: number;
  deploy: number;
  map: string[];
  enemies: [UType, number, number][];
  reinf?: { every: number; list: UType[] };
  boss?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1, name: 'First Light', subtitle: 'Training Range',
    story: 'A lone well hangs over the training grid. Learn how mass bends the board, then break the rival Core.',
    obj: 'king', par: 9, deploy: 4,
    map: ['........', '........', '........', '...W....', '........', '........', '........', '........'],
    enemies: [['core', 4, 0], ['mote', 3, 1], ['mote', 4, 1], ['mote', 5, 1]],
  },
  {
    id: 2, name: 'Twin Wells', subtitle: 'Sector 7',
    story: 'Two wells tug on every piece in the sector. Beams will curl toward them - use that.',
    obj: 'king', par: 10, deploy: 5,
    map: ['........', '........', '........', '.W......', '......W.', '........', '........', '........'],
    enemies: [['core', 3, 0], ['mote', 2, 1], ['mote', 3, 1], ['mote', 4, 1], ['prism', 5, 0]],
  },
  {
    id: 3, name: 'Horizon Edge', subtitle: 'The Drop',
    story: 'Black holes pock the midfield. Shove, lure and shoot the enemy into the dark. Leave none standing.',
    obj: 'annihilate', par: 12, deploy: 5,
    map: ['........', '........', '........', '..H##H..', '........', '........', '........', '........'],
    enemies: [['bulwark', 3, 0], ['bulwark', 4, 0], ['sling', 2, 1], ['sling', 5, 1], ['mote', 3, 1], ['mote', 4, 1]],
  },
  {
    id: 4, name: 'Repulsor Ridge', subtitle: 'Hold the Line',
    story: 'Repulsors scatter everything. Survive eight rounds against a stream of reinforcements.',
    obj: 'survive', surviveRounds: 8, par: 8, deploy: 6,
    map: ['........', '........', '........', '#..RR..#', '..R..R..', '........', '........', '........'],
    enemies: [['prism', 1, 0], ['prism', 6, 0], ['sling', 3, 1], ['sling', 4, 1], ['mote', 2, 1], ['mote', 5, 1]],
    reinf: { every: 3, list: ['mote', 'sling', 'prism', 'bulwark'] },
  },
  {
    id: 5, name: 'The Neutron Warden', subtitle: 'Boss - Sector Gate',
    story: 'An anchored titan guards the gate. Its shockwave comes every third round. Cut it down.',
    obj: 'king', par: 14, deploy: 6, boss: true,
    map: ['........', '........', '.W....W.', '...##...', '........', '........', '........', '........'],
    enemies: [['warden', 3, 0], ['mote', 2, 1], ['mote', 4, 1], ['prism', 1, 0], ['prism', 6, 0], ['sling', 5, 1]],
  },
  {
    id: 6, name: 'Nebula Drift', subtitle: 'The Veil',
    story: 'Dust clouds slow movement and blunt ranged fire. Their Singularity commands the veil.',
    obj: 'king', par: 12, deploy: 6,
    map: ['........', '........', '.NN..NN.', '.NN..NN.', '........', '..N..N..', '........', '........'],
    enemies: [['core', 4, 0], ['singularity', 3, 0], ['bulwark', 2, 1], ['prism', 5, 1], ['mote', 3, 1], ['mote', 4, 1]],
  },
  {
    id: 7, name: 'Twin Suns', subtitle: 'Collapse Zone',
    story: 'Wells and holes intermingle - every step is a calculation. Destroy all hostiles.',
    obj: 'annihilate', par: 14, deploy: 7,
    map: ['........', '........', '........', '.W.H..W.', '....H...', '........', '........', '........'],
    enemies: [['singularity', 3, 0], ['bulwark', 2, 1], ['bulwark', 5, 1], ['sling', 1, 1], ['sling', 6, 1], ['prism', 4, 0], ['mote', 3, 1], ['mote', 4, 1]],
  },
  {
    id: 8, name: 'Shattered Ring', subtitle: 'Last Orbit',
    story: 'A ring of holes and repulsors. Hold out ten rounds while the fleet pours in.',
    obj: 'survive', surviveRounds: 10, par: 10, deploy: 7,
    map: ['........', '........', '..H..H..', '.R....R.', '.R....R.', '..H..H..', '........', '........'],
    enemies: [['prism', 2, 0], ['prism', 5, 0], ['sling', 1, 1], ['sling', 6, 1], ['bulwark', 3, 1], ['bulwark', 4, 1], ['singularity', 3, 0]],
    reinf: { every: 2, list: ['mote', 'mote', 'prism', 'sling', 'bulwark', 'mote', 'singularity'] },
  },
  {
    id: 9, name: 'Gauntlet of Mass', subtitle: 'Heavy Armor',
    story: 'Their finest heavy division blocks the road to the Heart. Break their Core.',
    obj: 'king', par: 14, deploy: 8,
    map: ['..#..#..', '........', '.W....W.', '...HH...', '..N..N..', '........', '........', '........'],
    enemies: [['core', 3, 0], ['singularity', 4, 0], ['singularity', 1, 0], ['bulwark', 2, 1], ['bulwark', 5, 1], ['sling', 3, 1], ['sling', 4, 1], ['prism', 1, 1], ['prism', 6, 1]],
  },
  {
    id: 10, name: 'Heart of the Singularity', subtitle: 'Final Boss',
    story: 'The Event Horizon walks. Marks of ruin, shed Motes, and a field that warps the whole board. End it.',
    obj: 'king', par: 16, deploy: 8, boss: true,
    map: ['........', '........', '.R....R.', '..H..H..', '........', '.#....#.', '........', '........'],
    enemies: [['horizon', 3, 1], ['mote', 2, 0], ['mote', 5, 0], ['prism', 1, 0], ['prism', 6, 0], ['bulwark', 4, 1], ['sling', 2, 1]],
  },
];

export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: number[];
}
export const RESEARCH: ResearchDef[] = [
  { id: 'flux', name: 'Flux Capacitors', desc: '+1 max Energy and +1 starting Energy per rank.', max: 3, cost: [40, 80, 140] },
  { id: 'dur', name: 'Pulse Persistence', desc: 'Gravity Pulses last +1 round per rank.', max: 3, cost: [35, 70, 120] },
  { id: 'seed', name: 'Singularity Seeds', desc: 'Gravity Pulses are +2 mass stronger per rank.', max: 3, cost: [45, 90, 150] },
  { id: 'orbit', name: 'Stable Orbits', desc: 'All your pieces resist drift (+0.3 threshold per rank).', max: 3, cost: [50, 100, 160] },
  { id: 'armor', name: 'Reactor Plating', desc: 'Your Core gains +3 HP per rank.', max: 3, cost: [30, 60, 110] },
  { id: 'academy', name: 'Tactical Academy', desc: 'Pieces earn +25% XP per rank.', max: 3, cost: [40, 80, 130] },
  { id: 'salvage', name: 'Salvage Rigs', desc: '+15% Stardust from battles per rank.', max: 3, cost: [40, 80, 130] },
];

export interface DiffDef {
  id: 'cadet' | 'officer' | 'admiral';
  name: string;
  desc: string;
  hp: number;
  atk: number;
  noise: number;
  caution: number;
  reward: number;
  energy: number;
  extra: number;
}
export const DIFFS: DiffDef[] = [
  { id: 'cadet', name: 'Cadet', desc: 'Enemies have 80% HP and play carelessly. +1 starting Energy. Rewards x0.8.', hp: 0.8, atk: 0, noise: 4, caution: 0.25, reward: 0.8, energy: 1, extra: 0 },
  { id: 'officer', name: 'Officer', desc: 'Balanced challenge. Rewards x1.', hp: 1, atk: 0, noise: 1.4, caution: 0.6, reward: 1, energy: 0, extra: 0 },
  { id: 'admiral', name: 'Admiral', desc: 'Enemies have 125% HP, +1 attack, sharp tactics, and 2 extra Motes. Rewards x1.5.', hp: 1.25, atk: 1, noise: 0.25, caution: 1, reward: 1.5, energy: 0, extra: 2 },
];

export interface ModDef {
  id: 'iron' | 'heavy' | 'reinf';
  name: string;
  desc: string;
  bonus: number;
}
export const MODS: ModDef[] = [
  { id: 'iron', name: 'Ironman', desc: 'Fallen pieces are lost from your roster forever.', bonus: 0.5 },
  { id: 'heavy', name: 'Heavy Gravity', desc: 'All gravitational fields are 1.5x stronger.', bonus: 0.3 },
  { id: 'reinf', name: 'Endless Fleet', desc: 'Enemy reinforcements arrive every 3 rounds in every battle.', bonus: 0.4 },
];

export const TUT_STEPS = ['select', 'move', 'act', 'endturn', 'field', 'pulse', 'done'];

// SVG shapes in a -50..50 box (used by both canvas Path2D and React SVG)
function star(n: number, r1: number, r2: number): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const a = (Math.PI * i) / n - Math.PI / 2;
    d += (i === 0 ? 'M' : 'L') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1) + ' ';
  }
  return d + 'Z';
}
export const SHAPES: Record<UType, string> = {
  mote: 'M0 -30 A30 30 0 1 1 0 30 A30 30 0 1 1 0 -30Z',
  sling: 'M-28 34 L-28 6 L-10 -10 L-26 -16 L2 -38 L28 -22 L30 34Z',
  prism: 'M0 -40 L32 0 L0 40 L-32 0Z',
  bulwark: 'M-30 34 L-30 -4 L-24 -4 L-24 -34 L-12 -34 L-12 -22 L-5 -22 L-5 -34 L5 -34 L5 -22 L12 -22 L12 -34 L24 -34 L24 -4 L30 -4 L30 34Z',
  singularity: star(8, 40, 17),
  core: 'M0 -40 L35 -20 L35 20 L0 40 L-35 20 L-35 -20Z',
  warden: star(6, 46, 28),
  horizon: 'M0 -44 A44 44 0 1 1 0 44 A44 44 0 1 1 0 -44Z',
};

export const TEAM_COLOR = { p: '#4ff0ff', e: '#ff4f9a' };

// ---------- Orchestra of Automata : static game data ----------

export const COLS = 10;
export const LANES = 5;
export const PLACE_COLS = 7;
export const CW = 100;
export const CH = 96;
export const OX = 100;
export const OY = 76;
export const LW = 1100;
export const LH = OY + LANES * CH + 20;
export const STEPS = 16;

export type InstId = 'timpani' | 'violin' | 'horn' | 'flute' | 'harp' | 'cymbal' | 'musicbox';
export interface Step {
  d: number; // scale degree 0..6
  a: boolean; // accent
}
export type Pattern = (Step | null)[];

export const SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function noteName(root: number, deg: number): string {
  return NOTE_NAMES[(((root + SCALE[((deg % 7) + 7) % 7]) % 12) + 12) % 12];
}
export function midiFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export interface InstDef {
  id: InstId;
  name: string;
  icon: string;
  cost: number;
  hp: number;
  pc: number; // pressure cost per note
  dmg: number;
  midi: number;
  color: string;
  role: string;
  desc: string;
  defDeg: number;
}

export const INST_ORDER: InstId[] = ['timpani', 'violin', 'musicbox', 'flute', 'horn', 'harp', 'cymbal'];

export const INST: Record<InstId, InstDef> = {
  timpani: {
    id: 'timpani', name: 'Timpani Golem', icon: '🥁', cost: 100, hp: 130, pc: 6, dmg: 14, midi: 36,
    color: '#e08a3c', role: 'Shockwave',
    desc: 'Booms a shockwave down its lane (and weakly into neighbours). Accents knock foes back.', defDeg: 0,
  },
  violin: {
    id: 'violin', name: 'Violin Sentinel', icon: '🎻', cost: 75, hp: 85, pc: 3, dmg: 7, midi: 62,
    color: '#e6c15a', role: 'Rapid Piercer',
    desc: 'Cheap and fast. Fires piercing notes through several foes. Accents pierce deeper.', defDeg: 2,
  },
  musicbox: {
    id: 'musicbox', name: 'Music Box Engine', icon: '🎹', cost: 50, hp: 65, pc: 2, dmg: 0, midi: 70,
    color: '#ff9ec7', role: 'Cog Generator',
    desc: 'Every note winds out Cogs. Chords multiply its yield. Fragile, so guard it.', defDeg: 2,
  },
  flute: {
    id: 'flute', name: 'Piper Automaton', icon: '🎶', cost: 125, hp: 80, pc: 4, dmg: 4, midi: 67,
    color: '#7fd6c2', role: 'Slow & Push',
    desc: 'Breezy notes slow foes (halved march) and shove them back. Accents slow longer.', defDeg: 4,
  },
  horn: {
    id: 'horn', name: 'Brass Bellower', icon: '🎺', cost: 175, hp: 105, pc: 9, dmg: 28, midi: 55,
    color: '#f2a93b', role: 'Explosive Blast',
    desc: 'Slow heavy blasts that burst on impact, splashing nearby lanes. Thirsty for steam.', defDeg: 4,
  },
  harp: {
    id: 'harp', name: 'Harp Mender', icon: '🎼', cost: 100, hp: 90, pc: 5, dmg: 0, midi: 60,
    color: '#c79bff', role: 'Support',
    desc: 'Arpeggios heal neighbours, refill their steam, and grant Resonance (+25% damage).', defDeg: 0,
  },
  cymbal: {
    id: 'cymbal', name: 'Cymbal Crasher', icon: '💥', cost: 150, hp: 95, pc: 9, dmg: 6, midi: 76,
    color: '#fff0a8', role: 'Stun Crash',
    desc: 'Crashes stun every foe ahead across three lanes. Accents stun twice as long.', defDeg: 0,
  },
};

export function mk(steps: number[], d: number, acc: number[] = [], cycle?: number[]): Pattern {
  const p: Pattern = new Array(STEPS).fill(null);
  steps.forEach((s, i) => {
    const deg = cycle ? (d + cycle[i % cycle.length]) % 7 : d;
    p[s] = { d: deg, a: acc.includes(s) };
  });
  return p;
}

export function defaultPattern(inst: InstId): Pattern {
  const d = INST[inst].defDeg;
  switch (inst) {
    case 'timpani': return mk([0, 8], d, [0]);
    case 'violin': return mk([0, 4, 8, 12], d, [0]);
    case 'horn': return mk([0, 8], d, [0]);
    case 'flute': return mk([2, 6, 10, 14], d);
    case 'harp': return mk([0, 8], d);
    case 'cymbal': return mk([4, 12], d, [4]);
    default: return mk([0, 4, 8, 12], d);
  }
}

export const PRESETS: { name: string; make: (d: number) => Pattern }[] = [
  { name: 'Downbeats', make: (d) => mk([0, 4, 8, 12], d, [0, 8]) },
  { name: 'Offbeats', make: (d) => mk([2, 6, 10, 14], d, [6, 14]) },
  { name: 'Half-time', make: (d) => mk([0, 8], d, [0]) },
  { name: 'Gallop', make: (d) => mk([0, 3, 4, 7, 8, 11, 12, 15], d, [0, 8]) },
  { name: 'Roll', make: (d) => mk([0, 2, 4, 6, 8, 10, 12, 14], d, [0, 8]) },
  { name: 'Syncopated', make: (d) => mk([0, 3, 6, 10, 12], d, [0, 6]) },
  { name: 'Arpeggio', make: (d) => mk([0, 2, 4, 6, 8, 10, 12, 14], d, [0, 8], [0, 2, 4, 2]) },
  {
    name: 'Random',
    make: (d) => {
      const p: Pattern = new Array(STEPS).fill(null);
      for (let i = 0; i < STEPS; i++) if (Math.random() < 0.38) p[i] = { d: (d + (Math.random() < 0.5 ? 0 : [2, 4][Math.floor(Math.random() * 2)])) % 7, a: Math.random() < 0.25 };
      if (!p.some(Boolean)) p[0] = { d, a: false };
      return p;
    },
  },
];

// ---------------- Enemies ----------------
export type EnemyId =
  | 'screecher' | 'drone' | 'brute' | 'mute' | 'syncopator' | 'metronome' | 'echo'
  | 'howler' | 'colossus' | 'tyrant' | 'choir' | 'cacophony';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number; // columns per beat
  dmg: number;
  armor: number;
  reward: number;
  leak: number;
  r: number;
  color: string;
  boss?: boolean;
  threat: number;
  desc: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  screecher: { id: 'screecher', name: 'Screecher', hp: 30, speed: 0.24, dmg: 8, armor: 0, reward: 9, leak: 1, r: 26, color: '#e4506c', threat: 3, desc: 'A shrill ♯ spike. The basic discord.' },
  drone: { id: 'drone', name: 'Static Drone', hp: 14, speed: 0.5, dmg: 5, armor: 0, reward: 5, leak: 1, r: 18, color: '#ff9f43', threat: 2, desc: 'Fast and fragile static.' },
  brute: { id: 'brute', name: 'Bass Brute', hp: 140, speed: 0.13, dmg: 22, armor: 3, reward: 22, leak: 3, r: 38, color: '#8a63d2', threat: 9, desc: 'Heavily armoured: tiny hits barely scratch it. Use Timpani and Horns.' },
  mute: { id: 'mute', name: 'Hush Wraith', hp: 45, speed: 0.2, dmg: 0, armor: 0, reward: 14, leak: 1, r: 26, color: '#7f93b2', threat: 5, desc: 'Silences automata from range. Kill it fast.' },
  syncopator: { id: 'syncopator', name: 'Syncopator', hp: 60, speed: 0.28, dmg: 10, armor: 0, reward: 16, leak: 2, r: 26, color: '#3fd0e8', threat: 6, desc: 'Deflects notes fired on DOWNBEATS (steps 1·5·9·13). Hit it off the beat!' },
  metronome: { id: 'metronome', name: 'Rigid Metronome', hp: 80, speed: 0.2, dmg: 12, armor: 0, reward: 18, leak: 2, r: 28, color: '#d9c27a', threat: 6, desc: 'Only notes fired ON the downbeat (steps 1·5·9·13) can hurt it.' },
  echo: { id: 'echo', name: 'Echo Twin', hp: 70, speed: 0.2, dmg: 8, armor: 0, reward: 16, leak: 2, r: 28, color: '#4fd6a0', threat: 6, desc: 'Splits into two Static Drones when destroyed.' },
  howler: { id: 'howler', name: 'The Feedback Howler', hp: 700, speed: 0.1, dmg: 20, armor: 1, reward: 140, leak: 8, r: 64, color: '#ff4d6d', boss: true, threat: 0, desc: 'Boss. Periodically blasts feedback that silences your automata.' },
  colossus: { id: 'colossus', name: 'The Bass Colossus', hp: 1500, speed: 0.08, dmg: 34, armor: 5, reward: 200, leak: 10, r: 72, color: '#7b4fe0', boss: true, threat: 0, desc: 'Boss. Thick armour and summons Static Drones.' },
  tyrant: { id: 'tyrant', name: 'The Metronome Tyrant', hp: 1400, speed: 0.1, dmg: 30, armor: 0, reward: 240, leak: 10, r: 66, color: '#f0c850', boss: true, threat: 0, desc: 'Boss. Only downbeat notes wound it, and it jumps between lanes.' },
  choir: { id: 'choir', name: 'The Choir of Static', hp: 1700, speed: 0.1, dmg: 26, armor: 1, reward: 280, leak: 12, r: 66, color: '#35e0a1', boss: true, threat: 0, desc: 'Boss. Hops lanes and shatters into Echo Twins as it weakens.' },
  cacophony: { id: 'cacophony', name: 'THE CACOPHONY', hp: 4200, speed: 0.08, dmg: 40, armor: 2, reward: 500, leak: 20, r: 80, color: '#ff2e63', boss: true, threat: 0, desc: 'Final boss. Three phases: scrambles your compositions, summons hordes, then enrages.' },
};

export const REGULAR: EnemyId[] = ['screecher', 'drone', 'brute', 'mute', 'syncopator', 'metronome', 'echo'];
export const BOSSES: EnemyId[] = ['howler', 'colossus', 'tyrant', 'choir', 'cacophony'];

// ---------------- Levels ----------------
export interface LevelDef {
  id: number;
  name: string;
  sub: string;
  waves: number;
  enemies: EnemyId[];
  boss: EnemyId | null;
  bpm: number;
  root: number;
  desc: string;
  hue: number;
}

export const TUTORIAL: LevelDef = {
  id: -1, name: 'Rehearsal', sub: 'Interactive tutorial', waves: 2, enemies: ['screecher'], boss: null, bpm: 90, root: 0,
  desc: 'Learn to compose, conduct and defend.', hue: 40,
};

export const LEVELS: LevelDef[] = [
  { id: 0, name: 'I. Overture of Rust', sub: 'Screechers and Drones', waves: 5, enemies: ['screecher', 'drone'], boss: 'howler', bpm: 96, root: 0, desc: 'The hall wakes with a shriek. Learn the basics before the Howler arrives.', hue: 20 },
  { id: 1, name: 'II. The Bass Foundry', sub: 'Armour & silence', waves: 6, enemies: ['screecher', 'drone', 'brute', 'mute'], boss: 'colossus', bpm: 92, root: 2, desc: 'Brutes shrug off weak notes and Wraiths hush your players.', hue: 270 },
  { id: 2, name: 'III. Metronome Hall', sub: 'Rhythm-locked foes', waves: 7, enemies: ['screecher', 'drone', 'mute', 'syncopator', 'metronome', 'brute'], boss: 'tyrant', bpm: 100, root: 5, desc: 'Foes that only bleed on certain beats. Your compositions must adapt.', hue: 50 },
  { id: 3, name: 'IV. Hall of Echoes', sub: 'Splitting horrors', waves: 8, enemies: ['screecher', 'drone', 'brute', 'mute', 'syncopator', 'metronome', 'echo'], boss: 'choir', bpm: 104, root: 7, desc: 'Everything multiplies. Splash and piercing win the day.', hue: 160 },
  { id: 4, name: 'V. Cacophony Finale', sub: 'The final movement', waves: 9, enemies: ['screecher', 'drone', 'brute', 'mute', 'syncopator', 'metronome', 'echo'], boss: 'cacophony', bpm: 108, root: 9, desc: 'The Cacophony rises to unmake the symphony. Conduct your masterpiece.', hue: 340 },
  { id: 5, name: 'Encore: Endless Fugue', sub: 'Survive forever', waves: 9999, enemies: ['screecher', 'drone', 'brute', 'mute', 'syncopator', 'metronome', 'echo'], boss: null, bpm: 112, root: 3, desc: 'No finale. A boss every fifth wave. How long can you play?', hue: 200 },
];

export interface Spawn { beat: number; lane: number; type: EnemyId }

export function isBossWave(lv: LevelDef, wave: number): boolean {
  if (lv.id === 5) return wave % 5 === 0;
  return lv.boss !== null && wave === lv.waves;
}

export function genWave(lv: LevelDef, wave: number, countMult: number, swarm: boolean): Spawn[] {
  const lvIdx = Math.max(0, Math.min(lv.id, 4));
  const encoreBonus = lv.id === 5 ? wave * 2.2 : 0;
  let budget = (5 + wave * 4 + lvIdx * 6 + encoreBonus) * countMult * (swarm ? 1.4 : 1);
  const boss = isBossWave(lv, wave);
  if (boss) budget *= 0.55;
  const allowedCount = Math.min(lv.enemies.length, 2 + Math.floor(wave / 2) + (lv.id === 5 ? 3 : 0));
  const allowed = lv.enemies.slice(0, allowedCount);
  const out: Spawn[] = [];
  let beat = 2;
  let guard = 0;
  while (budget >= 2 && guard++ < 200) {
    const cands = allowed.filter((t) => ENEMIES[t].threat <= budget + 2);
    if (!cands.length) break;
    // weight cheaper units more
    const weights = cands.map((t) => 1 / (0.6 + ENEMIES[t].threat * 0.25));
    let sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let pick = cands[0];
    for (let i = 0; i < cands.length; i++) {
      r -= weights[i];
      if (r <= 0) { pick = cands[i]; break; }
    }
    sum = 0;
    out.push({ beat, lane: Math.floor(Math.random() * LANES), type: pick });
    budget -= ENEMIES[pick].threat;
    beat += Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * (swarm ? 2 : 3)); // occasional simultaneous pair
  }
  if (boss) {
    let bossId: EnemyId = lv.boss ?? BOSSES[Math.min(4, Math.floor(wave / 5) - 1 + Math.floor(Math.random() * 3)) % 5];
    if (lv.id === 5) bossId = BOSSES[Math.floor(Math.random() * 4)];
    const lastBeat = out.length ? out[out.length - 1].beat : 8;
    out.push({ beat: Math.max(6, Math.floor(lastBeat * 0.3)), lane: 2, type: bossId });
  }
  out.sort((a, b) => a.beat - b.beat);
  return out;
}

// ---------------- Difficulty & modifiers ----------------
export interface DiffDef { id: string; name: string; sub: string; hp: number; count: number; speed: number; harmony: number; cogs: number; opus: number }
export const DIFFS: DiffDef[] = [
  { id: 'andante', name: 'Andante', sub: 'Gentle stroll', hp: 0.8, count: 0.8, speed: 0.9, harmony: 25, cogs: 100, opus: 0.8 },
  { id: 'allegro', name: 'Allegro', sub: 'Balanced tempo', hp: 1, count: 1, speed: 1, harmony: 20, cogs: 0, opus: 1 },
  { id: 'presto', name: 'Presto', sub: 'Frantic virtuoso', hp: 1.3, count: 1.25, speed: 1.15, harmony: 14, cogs: -25, opus: 1.6 },
];

export interface ModDef { id: string; name: string; icon: string; desc: string; bonus: number }
export const MODS: ModDef[] = [
  { id: 'detuned', name: 'Out of Tune', icon: '🎚️', desc: 'Enemies have +30% health.', bonus: 0.25 },
  { id: 'staccato', name: 'Low Steam', icon: '💨', desc: 'Pressure regenerates 35% slower.', bonus: 0.2 },
  { id: 'brittle', name: 'Brittle Gears', icon: '🔩', desc: 'Automata take double damage.', bonus: 0.2 },
  { id: 'swarm', name: 'Swarm Season', icon: '🦟', desc: '+40% more, faster-spawning foes.', bonus: 0.25 },
  { id: 'fright', name: 'Stage Fright', icon: '😰', desc: 'Conducting timing windows shrink 40%.', bonus: 0.2 },
];

// ---------------- Meta upgrades ----------------
export interface UpgDef { id: string; name: string; icon: string; desc: string; max: number; base: number }
export const UPGRADES: UpgDef[] = [
  { id: 'mainspring', name: 'Mainspring', icon: '🌀', desc: '+30 starting Cogs per level.', max: 5, base: 20 },
  { id: 'tank', name: 'Pressure Tank', icon: '🛢️', desc: '+15% automaton steam capacity per level.', max: 5, base: 25 },
  { id: 'regen', name: 'Steam Regulator', icon: '♨️', desc: '+12% steam regeneration per level.', max: 5, base: 25 },
  { id: 'casing', name: 'Hardened Casings', icon: '🛡️', desc: '+15% automaton health per level.', max: 5, base: 25 },
  { id: 'dmg', name: 'Tuning Forks', icon: '🔱', desc: '+8% damage for all automata per level.', max: 5, base: 35 },
  { id: 'calib', name: 'Metronome Calibration', icon: '⏱️', desc: '+12ms conducting timing windows per level.', max: 3, base: 30 },
  { id: 'cresc', name: 'Crescendo Mastery', icon: '📈', desc: '+15% Crescendo meter gain per level.', max: 4, base: 30 },
  { id: 'hall', name: 'Reinforced Hall', icon: '🏛️', desc: '+3 Harmony (max health) per level.', max: 4, base: 30 },
  { id: 'scrap', name: 'Scrap Dealer', icon: '♻️', desc: '+10% Cogs from kills and +8% sell refund per level.', max: 4, base: 25 },
];
export function upgCost(u: UpgDef, lvl: number): number {
  return Math.round(u.base * (1 + lvl * 0.9));
}

export const UNLOCKS: { id: InstId; cost: number }[] = [
  { id: 'flute', cost: 30 },
  { id: 'horn', cost: 45 },
  { id: 'harp', cost: 60 },
  { id: 'cymbal', cost: 80 },
];

// ---------------- Boons (run motifs) ----------------
export interface BoonDef { id: string; name: string; icon: string; desc: string }
export const BOONS: BoonDef[] = [
  { id: 'vivace', name: 'Vivace', icon: '🔥', desc: '+15% damage for all automata (stacks).' },
  { id: 'fortune', name: 'Fortune Gears', icon: '💰', desc: '+25% Cogs from kills & music boxes.' },
  { id: 'valve', name: 'Overflow Valve', icon: '🚿', desc: '+25% steam regeneration.' },
  { id: 'stock', name: 'Stockpile', icon: '📦', desc: 'Gain 150 Cogs now.' },
  { id: 'mend', name: 'Restoration', icon: '🔧', desc: 'Repair every automaton and restore 5 Harmony.' },
  { id: 'pitch', name: 'Perfect Pitch', icon: '🎯', desc: '+30% Crescendo gain; Perfect hits refill more steam.' },
  { id: 'chords', name: 'Resonant Chords', icon: '🎶', desc: 'Chord bonuses are 50% stronger.' },
  { id: 'iron', name: 'Iron Gears', icon: '⚙️', desc: '+25% automaton health, healing existing ones.' },
  { id: 'cheap', name: 'Cheaper Parts', icon: '🏷️', desc: 'Automata cost 15% less (stacks).' },
];

export const TUT_TEXT = [
  'Pick an instrument card below (or press 1), then click a square on the left of the staff to place it.',
  'COMPOSE! Click cells in the piano-roll to write at least 3 notes. Shift-click (or right-click) a note to make it an accent. Notes sound when the playhead passes.',
  'CONDUCT! Press SPACE (or tap the baton) exactly when the shrinking ring meets the podium circle. Land 4 hits.',
  'Defeat the discord! Foes march on the beat. Place more automata, mix instruments, line notes up into chords, and watch your steam.',
];
export const TUT_TOTAL = 4;

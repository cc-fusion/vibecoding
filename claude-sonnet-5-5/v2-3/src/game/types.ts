export type TerrainId = "meadow" | "forest" | "hills" | "mountain" | "marsh" | "ash" | "ruins" | "lake";
export type FactionId = "wardens" | "hollow" | "concord" | "choir";
export type LandmarkId =
  | "outpost" | "village" | "market" | "shrine" | "tower" | "library"
  | "spring" | "obelisk" | "cave" | "sigil" | "spire";
export type EnemyId = "wolf" | "bandit" | "hag" | "acolyte" | "golem" | "wraith" | "patrol" | "raider" | "unwritten";
export type HazardId = "quicksand" | "rockfall" | "whisperfog" | "storm";
export type RelicId =
  | "sextant" | "lantern" | "boots" | "quill" | "salt" | "seal" | "scale" | "drum"
  | "fork" | "skiff" | "chrono" | "compass" | "vial" | "gloves" | "bell";
export type ResKind = "supplies" | "ink" | "sanity" | "vigor" | "gold" | "tonics" | "laud";

export type Feature =
  | { kind: "landmark"; id: LandmarkId }
  | { kind: "lair"; enemy: EnemyId }
  | { kind: "hazard"; id: HazardId }
  | { kind: "event" }
  | { kind: "cache" };

export interface Tile {
  q: number;
  r: number;
  terrain: TerrainId;
  seen: TerrainId; // what the player believes (stale if unmapped land shifted)
  state: 0 | 1 | 2; // 0 unknown, 1 glimpsed, 2 charted
  visited: boolean;
  feature: Feature | null;
  done: boolean;
  pin: number; // 0 none, 1 danger, 2 interest, 3 camp, 4 avoid
  seed: number;
  hallu: number;
  erased: boolean;
  chartT: number;
  glimT: number;
  shiftT: number;
  ls: Record<string, number>; // landmark state flags
  dist: number; // distance from start
  tier: number;
}

export interface Rumor {
  q: number;
  r: number;
  radius: number;
  label: string;
  sigil: number;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  emoji: string;
  hp: number;
  atk: number;
  armor: number;
  san: number;
  pattern: string[];
  parley: number;
  desc: string;
  gold: [number, number];
  faction?: FactionId;
  weak?: "flare";
  tiers: number[];
  prefer: TerrainId[];
  rep?: Partial<Record<FactionId, number>>;
}

export interface Intent {
  kind: string;
  label: string;
  dmg: number;
  san: number;
  icon: string;
  note?: string;
}

export interface Combat {
  enemy: EnemyDef;
  hp: number;
  maxHp: number;
  guard: number;
  idx: number;
  intent: Intent;
  stunned: boolean;
  brace: boolean;
  log: { t: string; c: string }[];
  over: null | "win" | "lose" | "fled" | "parley";
  reward: string;
  boss: boolean;
  phase: number;
  redacted: string | null;
  nextRedact: string | null;
  gilded: number;
  dmgScale: number;
  turn: number;
  tile: Tile | null;
  prev: { q: number; r: number } | null;
  onWin: ((g: any) => string) | null;
  anim: { id: number; enemy: string; player: string; ne: string; np: string; npKind: "dmg" | "san" | "heal" | "sheal" };
  noFlee: boolean;
}

export interface RunConfig {
  difficulty: "wayfarer" | "cartographer" | "lamenter";
  mods: string[];
  classId: string;
  tutorial: boolean;
}

export interface Stats {
  tilesCharted: number;
  tilesWalked: number;
  landmarks: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  sanityLost: number;
  goldEarned: number;
  relics: number;
  camps: number;
  pins: number;
  corrected: number;
  shifts: number;
  flares: number;
}

export interface SaveData {
  renown: number;
  lifetime: number;
  upgrades: Record<string, number>;
  classes: string[];
  lore: number[];
  tutorialDone: boolean;
  runs: number;
  wins: number;
  best: { score: number; diff: string; win: boolean; days: number; charted: number; cls: string }[];
  totals: { charted: number; kills: number; landmarks: number };
  settings: { master: number; music: number; sfx: number; muted: boolean; shake: boolean; psycho: boolean };
  lastCfg: RunConfig;
}

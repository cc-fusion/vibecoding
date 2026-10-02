export type MechType = "pins" | "dial" | "rings" | "sweep" | "cipher" | "runes";
export type Affix = "trapped" | "rusted" | "alarmed";
export type ClientId = "merchants" | "nobles" | "underworld" | "scholars";
export type KindId = "strongbox" | "safecrack" | "archive" | "clockwork" | "grandheist" | "odd" | "sovereign";
export type LootKind = "coin" | "gem" | "idol" | "tome" | "jewel" | "relic";
export type DiffId = "apprentice" | "journeyman" | "master";
export type ModId = "rush" | "ironhands" | "silent";
export type ConsumableId = "oil" | "smoke" | "sand" | "skeleton";
export type UpgradeId = "steel" | "wrench" | "stetho" | "gloves" | "oil" | "hourglass" | "cloak";

export interface StageSpec {
  type: MechType;
  level: number;
  affix?: Affix;
  seed: number;
}

export interface Contract {
  id: string;
  client: ClientId | "odd" | "boss";
  kind: KindId;
  title: string;
  tier: number;
  stages: StageSpec[];
  pay: number;
  timeLimit: number;
  renown: number;
  lootCount: number;
  boss?: boolean;
}

export interface LootItem {
  id: number;
  kind: LootKind;
  name: string;
  base: number;
  from: ClientId | "odd" | "boss";
}

export interface MarketEntry {
  price: number; // multiplier
  trend: number;
  hist: number[];
}

export interface Stats {
  jobsDone: number;
  jobsFailed: number;
  stagesCracked: number;
  goldEarned: number;
  goldSpent: number;
  picksBroken: number;
  faults: number;
  alarms: number;
  perfect: number;
  lootSold: number;
  patrolsDodged: number;
  patrolsCaught: number;
  playTime: number;
  bestPay: number;
}

export interface Campaign {
  house: string;
  day: number;
  gold: number;
  heat: number;
  renown: number;
  rep: Record<ClientId, number>;
  upgrades: Record<UpgradeId, number>;
  items: Record<ConsumableId, number>;
  picks: number;
  loot: LootItem[];
  lootSeq: number;
  market: Record<LootKind, MarketEntry>;
  board: Contract[];
  stats: Stats;
  generation: number;
  seed: number;
  log: string[];
  bossDone: boolean;
}

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
  shake: boolean;
  particles: boolean;
  difficulty: DiffId;
}

export interface Meta {
  generation: number;
  victories: number;
  bestRenown: number;
  academy: Record<MechType, boolean>;
  settings: Settings;
}

export interface JobSpec {
  mode: "job" | "practice";
  title: string;
  theme: ClientId | "odd" | "boss";
  stages: StageSpec[];
  timeLimit: number;
  picks: number;
  pickDur: number;
  items: Record<ConsumableId, number>;
  tolMul: number;
  noiseMul: number;
  wearMul: number;
  noiseDecay: number;
  patrolEnabled: boolean;
  patrolInterval: number;
  patrolReduce: number;
  patrolWarn: number;
  hint: number;
  seed: number;
  shake: boolean;
  particles: boolean;
  lesson?: string;
}

export type Outcome = "success" | "alarm" | "timeout" | "nopicks" | "abandon";

export interface JobResult {
  outcome: Outcome;
  stagesDone: number;
  stageTotal: number;
  faults: number;
  peakNoise: number;
  picksBroken: number;
  picksLeft: number;
  timeLeft: number;
  timeLimit: number;
  timeUsed: number;
  itemsUsed: Record<ConsumableId, number>;
  skeletonUsed: boolean;
  patrolsDodged: number;
  patrolsCaught: number;
}

export interface HudState {
  noise: number;
  time: number;
  timeLimit: number;
  stageIdx: number;
  stageCount: number;
  stages: StageSpec[];
  picksLeft: number;
  durability: number;
  durMax: number;
  patrol: "none" | "warn" | "pass";
  patrolT: number;
  patrolMax: number;
  hidden: boolean;
  items: Record<ConsumableId, number>;
  oilActive: boolean;
  help: string;
  mechName: string;
  practiceDone: boolean;
  nextPatrol: number;
}

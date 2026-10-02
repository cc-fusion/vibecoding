export type Role = 'hacker' | 'cracker' | 'muscle' | 'shadow' | 'face';
export type Skill = 'hack' | 'pick' | 'crack' | 'force' | 'stealth' | 'charm';
export const SKILLS: Skill[] = ['hack', 'pick', 'crack', 'force', 'stealth', 'charm'];
export type LootCat = 'cash' | 'jewels' | 'art' | 'tech' | 'bullion' | 'data';
export const CATS: LootCat[] = ['cash', 'jewels', 'art', 'tech', 'bullion', 'data'];
export type GadgetId = 'smoke' | 'emp' | 'decoy' | 'dart' | 'key';
export const GADGET_IDS: GadgetId[] = ['smoke', 'emp', 'decoy', 'dart', 'key'];
export type Mode = 'sneak' | 'walk' | 'run';
export type TraitId = 'quick' | 'steady' | 'loyal' | 'brawler' | 'lucky' | 'quiet';
export type LockKind = 'none' | 'pick' | 'hack' | 'breach';

export interface Crew {
  id: string;
  name: string;
  role: Role;
  skills: Record<Skill, number>;
  trait: TraitId;
  level: number;
  xp: number;
  perks: number;
  salary: number;
  hire: number;
  icon: string;
  color: string;
  jailed: number;
  heists: number;
}

export interface LootItem {
  name: string;
  cat: LootCat;
  value: number;
  weight: number;
  icon: string;
  primary?: boolean;
}

export type Step =
  | { k: 'move'; x: number; y: number; mode: Mode; t?: number }
  | { k: 'use'; oid: number; key?: boolean; t?: number }
  | { k: 'wait'; sec: number; t?: number }
  | { k: 'signal'; n: number }
  | { k: 'await'; n: number; t?: number }
  | { k: 'ambush'; x: number; y: number; t?: number }
  | { k: 'distract'; x: number; y: number; t?: number }
  | { k: 'jam'; t?: number }
  | { k: 'blast'; t?: number }
  | { k: 'gadget'; g: GadgetId; x: number; y: number; t?: number }
  | { k: 'extract' };
export type Plan = Record<string, Step[]>;

export interface P { x: number; y: number }

export interface Room { id: number; x: number; y: number; w: number; h: number; name: string; dark: boolean; kind: string }
export interface Door { kind: 'door'; id: number; x: number; y: number; vert: boolean; lock: LockKind; locked: boolean; open: number; tampered: boolean; vault: boolean }
export interface Cam { kind: 'camera'; id: number; x: number; y: number; base: number; sweep: number; speed: number; phase: number; fov: number; range: number; off: number; sus: number; cool: number; ang: number }
export interface Laser { id: number; tiles: P[]; period: number; onT: number; phase: number; off: number; cool?: number }
export interface Terminal { kind: 'terminal'; id: number; x: number; y: number; effect: 'cam' | 'laser' | 'lock'; done: boolean }
export interface Safe { kind: 'safe'; id: number; x: number; y: number; tier: number; stages: number; stage: number; opened: boolean; contents: LootItem[]; vault: boolean }
export interface Loot { kind: 'loot'; id: number; x: number; y: number; item: LootItem; taken: boolean }
export type Thing = Door | Cam | Terminal | Safe | Loot;
export type GType = 'guard' | 'sentinel' | 'k9' | 'drone' | 'captain' | 'cop';
export interface GuardDef { id: number; type: GType; x: number; y: number; route: P[] }

export interface World {
  w: number;
  h: number;
  tiles: Uint8Array;
  roomId: Int16Array;
  rooms: Room[];
  things: Thing[];
  lasers: Laser[];
  guards: GuardDef[];
  spawns: P[];
  van: P;
  vaultRoom: number;
  def: HeistDef;
}

export interface HeistDef {
  id: string;
  name: string;
  client: string;
  district: string;
  blurb: string;
  hint: string;
  w: number;
  h: number;
  seed: number;
  fee: number;
  unlock: number;
  guards: number;
  sentinels: number;
  k9: number;
  drones: number;
  captain: boolean;
  cams: number;
  lasers: number;
  terminals: ('cam' | 'laser' | 'lock')[];
  safes: number;
  loose: number;
  lockMix: [number, number, number];
  vaultLock: LockKind;
  vaultStages: number;
  prime: LootItem;
  pool: LootCat[];
  vaultName: string;
  names: string[];
  recon: [number, number];
  eta: number;
  par: number;
  map: P;
}

export interface GadgetDef { id: GadgetId; name: string; icon: string; cost: number; desc: string }
export interface UpgradeDef { id: string; name: string; icon: string; costs: number[]; desc: string }

export interface Mods { iron: boolean; hot: boolean; fuse: boolean }

export interface Campaign {
  v: number;
  diff: 0 | 1 | 2;
  mods: Mods;
  cash: number;
  heat: number;
  day: number;
  raids: number;
  crew: Crew[];
  recruits: Crew[];
  stash: LootItem[];
  jobs: Record<string, { done: number; best: string; bestLoot: number }>;
  intel: Record<string, number>;
  upg: Record<string, number>;
  gadgets: Record<GadgetId, number>;
  market: { idx: Record<LootCat, number>; trend: Record<LootCat, number>; event: string; sat: Record<string, Record<LootCat, number>> };
  news: string[];
  stats: { heists: number; earned: number; loot: number; arrests: number; alarms: number; ghosts: number; bodies: number; guards: number; time: number; sold: number };
  won: boolean;
  over: string;
  uid: number;
}

export interface HeistResult {
  heistId: string;
  success: boolean;
  primary: boolean;
  aborted: boolean;
  loot: LootItem[];
  lootValue: number;
  time: number;
  ghost: boolean;
  alarms: number;
  fullAlarm: boolean;
  police: boolean;
  arrested: string[];
  extracted: string[];
  guardsDowned: number;
  bodiesFound: number;
  spotted: number;
  captainDown: boolean;
  xp: Record<string, number>;
  bonuses: { name: string; amount: number }[];
  fee: number;
  rating: string;
  heatGain: number;
  gadgetsUsed: Record<GadgetId, number>;
  salary: number;
}

export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; speedDefault: number }

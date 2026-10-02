export type Pillar = "means" | "motive" | "opp";
export const PILLARS: Pillar[] = ["means", "motive", "opp"];
export const PILLAR_LABEL: Record<Pillar, string> = { means: "Means", motive: "Motive", opp: "Opportunity" };
export const PILLAR_ICON: Record<Pillar, string> = { means: "🗡️", motive: "💢", opp: "🕰️" };
export const PILLAR_TOPIC: Record<Pillar, string> = { means: "Possessions", motive: "Relationship", opp: "Whereabouts" };

export type Trait = "nervous" | "stoic" | "charming" | "arrogant" | "evasive";

export interface Clue {
  id: string;
  text: string;
  key: string;
  room: number;
  objId: string;
  kind: Pillar | "decoy";
  suspect?: number;
  sealed?: boolean;
}

export interface Deduction {
  id: string;
  a: string;
  b: string;
  suspect: number;
  pillar: Pillar;
  value: boolean;
  text: string;
}

export interface Statement {
  pillar: Pillar;
  text: string;
  isLie: boolean;
  contra: string[];
  claim: boolean | null;
}

export interface Suspect {
  id: number;
  name: string;
  first: string;
  emoji: string;
  job: string;
  trait: Trait;
  sig: string;
  initials: string;
  inj: string;
  receipt: string;
  alibi: string;
  statements: Statement[];
  patience: number;
  isCulprit: boolean;
}

export interface ObjDef {
  id: string;
  emoji: string;
  name: string;
  x: number;
  y: number;
  clueId?: string;
}

export interface Furn {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomDef {
  name: string;
  kind: string;
  hue: number;
  objects: ObjDef[];
  furn: Furn[];
}

export interface CaseDef {
  idx: number;
  seed: number;
  tutorial: boolean;
  boss: boolean;
  bossRoom: number;
  title: string;
  crime: string;
  blurb: string;
  victim: string;
  weapon: string;
  clock: string;
  scene: number;
  time: string;
  suspects: Suspect[];
  rooms: RoomDef[];
  clues: Clue[];
  deductions: Deduction[];
  culprit: number;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  shake: boolean;
  difficulty: 0 | 1 | 2;
  mods: { hazy: boolean; liar: boolean; insomnia: boolean; nightmares: boolean };
}

export interface Career {
  idx: number;
  cred: number;
  score: number;
  solved: number;
  stars: number;
  lies: number;
  seconds: number;
  seed: number;
  stars_by: number[];
}

export interface Meta {
  insight: number;
  up: Record<string, number>;
  settings: Settings;
  best: Record<string, { stars: number; score: number }>;
  career: Career | null;
  tutorialDone: boolean;
  won: boolean;
  cold: number;
  stats: { solved: number; lies: number; careers: number; wins: number; bestScore: number; deaths: number };
}

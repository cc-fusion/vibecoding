export type TileType = "deep" | "shallow" | "kelp" | "rock" | "current";
export type CrateKind = "fuel" | "harpoon" | "net" | "gold" | "hull";
export type FishKind = "sardine" | "tuna" | "glow";
export type MonsterKind = "eel" | "angler" | "whale" | "kraken";
export type Mode = "sail" | "net" | "harpoon" | "dredge";

export interface Tile {
  q: number;
  r: number;
  type: TileType;
  dir: number;
  seen: boolean;
  relic: boolean;
  crate: CrateKind | null;
  special: "start" | "gate" | null;
}

export interface Shoal {
  id: number;
  q: number;
  r: number;
  kind: FishKind;
  count: number;
}

export interface Monster {
  id: number;
  kind: MonsterKind;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  cd: number;
  cd2: number;
  stun: number;
  lodged: number;
  aware: boolean;
}

export interface Upgrades {
  hold: number;
  hull: number;
  fuel: number;
  net: number;
  rack: number;
}

export interface Player {
  q: number;
  r: number;
  hull: number;
  maxHull: number;
  fuel: number;
  maxFuel: number;
  nets: number;
  maxNets: number;
  harpoons: number;
  maxHarpoons: number;
  hold: Record<FishKind, number>;
  holdMax: number;
  gold: number;
  relics: string[];
  netRange: number;
  harpRange: number;
  harpDmg: number;
  vision: number;
  oilBonus: number;
  sellBonus: number;
  armor: number;
  reel: boolean;
  lucky: boolean;
  piston: boolean;
  moves: number;
  stormBonus: number;
  upg: Upgrades;
}

export type Ev =
  | { t: "float"; q: number; r: number; text: string; color: string }
  | { t: "ring"; q: number; r: number; color: string; big?: boolean }
  | { t: "bolt"; from: { q: number; r: number }; to: { q: number; r: number } }
  | { t: "shake"; amount: number }
  | { t: "flash"; color: string }
  | { t: "snd"; name: SoundName };

export type SoundName =
  | "sail"
  | "splash"
  | "harpoon"
  | "hit"
  | "coin"
  | "relic"
  | "kill"
  | "thunder"
  | "click"
  | "win"
  | "lose"
  | "oil"
  | "crate"
  | "bite"
  | "buy";

export interface LogEntry {
  text: string;
  tone: "good" | "bad" | "info" | "warn";
  turn: number;
}

export interface Harbor {
  levyPaid: boolean;
  mods: Record<FishKind, number>;
  offers: string[];
}

export interface Game {
  phase: "sail" | "harbor" | "over" | "won";
  captain: string;
  chart: number;
  turn: number;
  stormQ: number;
  tiles: Record<string, Tile>;
  shoals: Shoal[];
  monsters: Monster[];
  p: Player;
  log: LogEntry[];
  events: Ev[];
  evSeq: number;
  pending: string | null;
  nextId: number;
  harbor: Harbor | null;
  stats: { earned: number; fish: number; relics: number; slain: number; turns: number };
  overCause: string;
  score: number;
}

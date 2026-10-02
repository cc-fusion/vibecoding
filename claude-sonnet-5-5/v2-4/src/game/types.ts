import type { DType } from "./data";

export interface District {
  id: number; name: string; type: DType; x: number; y: number; pop0: number;
  S: number; E: number; I: number; H: number; R: number; D: number; bodies: number;
  hosp: number; beds: number; build: { level: number; left: number } | null;
  quarantine: boolean; qDays: number;
  panic: number; rumor: number; hunger: number;
  detected: boolean; seenI: number; trace: number; tracedEver: boolean;
  addrCd: number; disCd: number; cureCd: number; disinfect: number;
  deathsEma: number; deathAcc: number; srcLocal: number; srcFrom: Record<number, number>;
  cured: number; peakI: number; pulse: number; fleeCd: number; edges: number[];
}

export interface Edge {
  id: number; a: number; b: number; traffic: number; closed: boolean;
  fab: number; fba: number; accAB: number; accBA: number; revealed: boolean;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number; }
export interface Ring { x: number; y: number; r: number; life: number; max: number; color: string; }
export interface LogEntry { day: number; text: string; kind: "info" | "warn" | "bad" | "good" | "event"; }
export interface HistPoint { day: number; actual: number; seen: number; dead: number; panic: number; trust: number; }
export interface ActiveEvent { id: string; did: number; }

export interface SimConfig { cityIdx: number; diffId: string; mods: string[]; tutorial: boolean; perks: Record<string, number>; }

export interface Stats {
  peakActive: number; totalInfected: number; recovered: number; hospBuilt: number; quarantines: number;
  traces: number; events: number; minTrust: number; researchDone: number; riots: number; cures: number;
  addresses: number; disinfects: number; roadsClosed: number; peakPanic: number;
}

export interface Sim {
  cfg: SimConfig;
  rs: number;
  time: number; day: number;
  districts: District[]; edges: Edge[];
  funds: number; food: number; med: number; rp: number; trust: number;
  rates: { income: number; upkeep: number; food: number; med: number; rp: number };
  foodRatio: number; broke: boolean;
  research: { current: string | null; progress: number; partial: Record<string, number> };
  techs: Record<string, boolean>; policies: Record<string, boolean>;
  teamsMax: number;
  strain: number; mutMult: number; bossDay: number; bossEmerged: boolean; bossPulled: boolean; bossOrigin: number[];
  bossStartActive: number;
  selected: { kind: "d" | "e" | null; id: number };
  speed: number; paused: boolean;
  pendingEvent: ActiveEvent | null; eventTimer: number; eventLast: Record<string, number>;
  temp: Record<string, number>;
  log: LogEntry[]; history: HistPoint[];
  stats: Stats;
  over: null | { win: boolean; title: string; reason: string };
  vis: {
    particles: Particle[]; floaters: Floater[]; rings: Ring[];
    shake: number; flash: number; flashColor: string;
    banner: string; bannerSub: string; bannerT: number; bannerColor: string;
  };
  sfxQueue: string[];
  flags: Record<string, boolean>;
  tutStep: number;
  pop0: number; lastBell: number; sporeT: number; seedId: number;
}

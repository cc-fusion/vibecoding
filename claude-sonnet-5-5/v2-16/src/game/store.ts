// Persistent meta-progression (localStorage with in-memory fallback)

export interface BestRun { name: string; score: number; year: number; result: string; diff: string }
export interface Meta {
  lp: number;
  perks: Record<string, number>;
  runs: number;
  wins: number;
  best: BestRun[];
  tutorialDone: boolean;
  spikes: number;
}

const KEY = 'frb_meta_v1';
let mem: Meta | null = null;

const blank = (): Meta => ({ lp: 0, perks: {}, runs: 0, wins: 0, best: [], tutorialDone: false, spikes: 0 });

export function loadMeta(): Meta {
  if (mem) return mem;
  try {
    const s = localStorage.getItem(KEY);
    if (s) { mem = { ...blank(), ...JSON.parse(s) }; return mem as Meta; }
  } catch { /* ignore */ }
  mem = blank();
  return mem;
}

export function saveMeta(m: Meta) {
  mem = m;
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function resetMeta() {
  mem = blank();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

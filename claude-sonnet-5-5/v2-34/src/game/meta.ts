export interface Mods {
  iron: boolean;
  tight: boolean;
  fog: boolean;
}
export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  difficulty: 0 | 1 | 2;
  mods: Mods;
  linkHints: boolean;
  shake: boolean;
}
export interface Stats {
  moves: number;
  levels: number;
  caught: number;
  docs: number;
  hops: number;
  rotations: number;
  seconds: number;
  failures: number;
}
export interface Save {
  v: 1;
  progress: Record<number, { stars: number; best: number }>;
  stamps: number;
  permits: Record<string, number>;
  settings: Settings;
  stats: Stats;
  seenTips: Record<number, boolean>;
  tutorialDone: boolean;
  won: boolean;
}

export const DIFFS = [
  { name: "Apprentice", desc: "Generous energy, 4 rewinds, 3 hints. Stamps x0.8", mult: 3.0, undo: 4, hints: 3, stamps: 0.8 },
  { name: "Inspector", desc: "Balanced budget, 2 rewinds, 2 hints.", mult: 1.9, undo: 2, hints: 2, stamps: 1 },
  { name: "Architect", desc: "Tight budget, 1 rewind, 1 hint. Stamps x1.4", mult: 1.4, undo: 1, hints: 1, stamps: 1.4 },
];
export const MODS: { key: keyof Mods; name: string; desc: string }[] = [
  { key: "iron", name: "Iron Rules", desc: "No rewinds or hints. Stamps x1.5" },
  { key: "tight", name: "Tight Budget", desc: "Energy is only par + 2. Stamps x1.3" },
  { key: "fog", name: "Fog of Paper", desc: "Distant tiles fade from view. Stamps x1.2" },
];

export interface Permit {
  key: string;
  name: string;
  icon: string;
  max: number;
  cost: number[];
  desc: string;
}
export const PERMITS: Permit[] = [
  { key: "thermos", name: "Thermos of Tea", icon: "🍵", max: 5, cost: [15, 25, 40, 60, 90], desc: "+2 energy at the start of every level, per rank." },
  { key: "reel", name: "Rewind Reel", icon: "⏪", max: 3, cost: [20, 40, 70], desc: "+1 rewind charge per level, per rank." },
  { key: "lens", name: "Compass Lens", icon: "🧭", max: 3, cost: [20, 40, 70], desc: "+1 hint per level, per rank." },
  { key: "beans", name: "Fine Beans", icon: "☕", max: 3, cost: [15, 30, 55], desc: "Coffee restores +2 more energy, per rank." },
  { key: "monocle", name: "Foresight Monocle", icon: "🧐", max: 2, cost: [30, 60], desc: "Shows the next 1 (then 2) inspector moves as ghosts." },
  { key: "union", name: "Union Rep", icon: "🤝", max: 1, cost: [45], desc: "Waiting a beat costs no energy." },
  { key: "gold", name: "Gold Stamp", icon: "🏅", max: 3, cost: [25, 50, 90], desc: "+20% stamps earned, per rank." },
];

export interface Rules {
  maxEnergy: number;
  undo: number;
  hints: number;
  waitCost: number;
  coffeeGain: number;
  stampMult: number;
  foresight: number;
  fog: boolean;
  iron: boolean;
}
export function computeRules(par: number, diff: number, mods: Mods, permits: Record<string, number>): Rules {
  const d = DIFFS[diff] ?? DIFFS[1];
  const p = (k: string) => permits[k] ?? 0;
  const base = mods.tight ? par + 2 : Math.ceil(par * d.mult) + 3;
  const maxEnergy = Math.max(par + 2, base) + 2 * p("thermos");
  const iron = mods.iron;
  return {
    maxEnergy,
    undo: iron ? 0 : d.undo + p("reel"),
    hints: iron ? 0 : d.hints + p("lens"),
    waitCost: p("union") > 0 ? 0 : 1,
    coffeeGain: 4 + 2 * p("beans"),
    stampMult: d.stamps * (1 + 0.2 * p("gold")) * (iron ? 1.5 : 1) * (mods.tight ? 1.3 : 1) * (mods.fog ? 1.2 : 1),
    foresight: p("monocle"),
    fog: mods.fog,
    iron,
  };
}

export const defaultSettings = (): Settings => ({
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  muted: false,
  difficulty: 1,
  mods: { iron: false, tight: false, fog: false },
  linkHints: true,
  shake: true,
});
export const defaultStats = (): Stats => ({ moves: 0, levels: 0, caught: 0, docs: 0, hops: 0, rotations: 0, seconds: 0, failures: 0 });
export const defaultSave = (): Save => ({
  v: 1,
  progress: {},
  stamps: 0,
  permits: {},
  settings: defaultSettings(),
  stats: defaultStats(),
  seenTips: {},
  tutorialDone: false,
  won: false,
});

const KEY = "bureau-impossible-architecture-v1";
export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const o = JSON.parse(raw) as Partial<Save>;
    const d = defaultSave();
    return {
      ...d,
      ...o,
      v: 1,
      settings: { ...d.settings, ...(o.settings ?? {}), mods: { ...d.settings.mods, ...(o.settings?.mods ?? {}) } },
      stats: { ...d.stats, ...(o.stats ?? {}) },
      progress: o.progress ?? {},
      permits: o.permits ?? {},
      seenTips: o.seenTips ?? {},
    };
  } catch {
    return defaultSave();
  }
}
export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lasts for this session only */
  }
}
export function wipeSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

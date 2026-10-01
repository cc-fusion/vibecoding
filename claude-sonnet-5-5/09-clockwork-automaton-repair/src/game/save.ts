export interface Save {
  cogs: number;
  stars: Record<string, number>; // best stars per level
  score: Record<string, number>; // best score per level
  upgrades: Record<string, number>;
  otBest: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  baseCost: number;
  icon: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'governor', name: 'Pressure Governor', desc: 'Boilers heat 8% slower per level.', max: 4, baseCost: 45, icon: '⏲' },
  { id: 'vents', name: 'Spare Safety Valves', desc: '+1 emergency vent per shift per level.', max: 3, baseCost: 60, icon: '♨' },
  { id: 'spectacles', name: 'Brass Spectacles', desc: '+1 hint per shift per level.', max: 3, baseCost: 40, icon: '◎' },
  { id: 'sealant', name: 'Leak Sealant', desc: 'Leaks & jams add 25% less heat per level.', max: 3, baseCost: 70, icon: '◍' },
];

export const upgradeCost = (u: UpgradeDef, level: number) => Math.round(u.baseCost * (1 + level * 0.9));

const KEY = 'clockwork_automaton_repair_v1';

export const defaultSave = (): Save => ({ cogs: 0, stars: {}, score: {}, upgrades: {}, otBest: 0 });

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultSave();
}

export function persist(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export interface Stats {
  rateMul: number;
  vents: number;
  hints: number;
  penaltyMul: number;
}

export function statsOf(s: Save): Stats {
  const u = s.upgrades;
  return {
    rateMul: Math.pow(0.92, u.governor || 0),
    vents: 2 + (u.vents || 0),
    hints: 2 + (u.spectacles || 0),
    penaltyMul: Math.max(0.25, 1 - 0.25 * (u.sealant || 0)),
  };
}

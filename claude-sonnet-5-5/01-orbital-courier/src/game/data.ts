export interface Upgrades {
  fuel: number;
  hull: number;
  thrust: number;
  energy: number;
  nav: number;
  struts: number;
  padding: number;
  heat: number;
}

export type UpgradeKey = keyof Upgrades;

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  icon: string;
  desc: string;
  base: number;
  effect: (lvl: number) => string;
}

export const MAX_LEVEL = 4;

export const emptyUpgrades = (): Upgrades => ({
  fuel: 0,
  hull: 0,
  thrust: 0,
  energy: 0,
  nav: 0,
  struts: 0,
  padding: 0,
  heat: 0,
});

export const UPGRADES: UpgradeDef[] = [
  { key: 'fuel', name: 'Reserve Tanks', icon: '⛽', desc: 'Carry more reaction mass between ports.', base: 120, effect: (l) => `${100 + 25 * l} fuel units` },
  { key: 'hull', name: 'Ablative Plating', icon: '🛡️', desc: 'Survive more debris hits and flare burns.', base: 130, effect: (l) => `${100 + 25 * l} hull` },
  { key: 'thrust', name: 'Ion Thrusters', icon: '🔥', desc: 'Stronger main engine acceleration.', base: 140, effect: (l) => `+${12 * l}% thrust` },
  { key: 'energy', name: 'Deflector Capacitor', icon: '⚡', desc: 'Bigger deflector battery, faster recharge.', base: 130, effect: (l) => `${100 + 25 * l} energy · ${10 + 2 * l}/s` },
  { key: 'nav', name: 'Nav Computer', icon: '🧭', desc: 'Longer gravity-aware trajectory prediction.', base: 110, effect: (l) => `${7 + 5 * l}s look-ahead` },
  { key: 'struts', name: 'Landing Struts', icon: '🦿', desc: 'Dock safely at higher relative speeds.', base: 100, effect: (l) => `safe dock ≤ ${100 + 12 * l} m/s` },
  { key: 'padding', name: 'Cargo Padding', icon: '📦', desc: 'Cargo takes less damage from impacts.', base: 100, effect: (l) => `-${18 * l}% cargo damage` },
  { key: 'heat', name: 'Heat Radiators', icon: '❄️', desc: 'Absorb less heat near the star.', base: 110, effect: (l) => `-${15 * l}% heat gain` },
];

export const upgradeCost = (def: UpgradeDef, lvl: number) => Math.round((def.base * (1 + lvl * 0.75)) / 10) * 10;

export function derive(u: Upgrades) {
  return {
    maxFuel: 100 + 25 * u.fuel,
    maxHull: 100 + 25 * u.hull,
    thrust: 45 * (1 + 0.12 * u.thrust),
    maxEnergy: 100 + 25 * u.energy,
    regen: 10 + 2 * u.energy,
    predict: 7 + 5 * u.nav,
    safe: 100 + 12 * u.struts,
    cargoMul: 1 - 0.18 * u.padding,
    heatMul: 1 - 0.15 * u.heat,
  };
}

export interface CargoType {
  name: string;
  icon: string;
  pay: number;
  time: number;
  fragile: number;
  color: string;
}

export const CARGO: CargoType[] = [
  { name: 'Ore Pods', icon: '⛏️', pay: 0.8, time: 1.3, fragile: 0.4, color: '#c08a5a' },
  { name: 'Mail Sacks', icon: '✉️', pay: 0.9, time: 1.0, fragile: 0.3, color: '#e8d9a8' },
  { name: 'Luxury Wine', icon: '🍷', pay: 1.2, time: 1.1, fragile: 0.8, color: '#b0405f' },
  { name: 'Medical Isotopes', icon: '☢️', pay: 1.3, time: 0.85, fragile: 1.0, color: '#6dffb0' },
  { name: 'Volatile Fuel Cells', icon: '🔋', pay: 1.5, time: 1.0, fragile: 1.2, color: '#ffd24a' },
  { name: 'Cryo Embryos', icon: '🧬', pay: 1.7, time: 0.9, fragile: 1.6, color: '#7fd4ff' },
];

export interface SectorDef {
  name: string;
  blurb: string;
  quota: number;
  planets: number;
  debris: number;
  flareMin: number;
  flareMax: number;
  doubleFlare: number;
  flareWarn: number;
}

export const SECTORS: SectorDef[] = [
  { name: 'Helios Reach', blurb: 'A quiet yellow dwarf and three friendly worlds. Learn the rhythm of the spheres.', quota: 3, planets: 3, debris: 10, flareMin: 16, flareMax: 24, doubleFlare: 0, flareWarn: 2.8 },
  { name: 'Cinder Belt', blurb: 'A crowded inner system littered with wreckage from the old mining wars.', quota: 4, planets: 4, debris: 22, flareMin: 13, flareMax: 20, doubleFlare: 0.1, flareWarn: 2.5 },
  { name: 'Vesper Drift', blurb: 'Five worlds, tangled orbits, and a restless star. Timing is everything.', quota: 4, planets: 5, debris: 32, flareMin: 11, flareMax: 17, doubleFlare: 0.2, flareWarn: 2.3 },
  { name: 'Kestrel Run', blurb: 'The freight lanes everyone avoids. High pay, flares that come in pairs.', quota: 5, planets: 6, debris: 44, flareMin: 9, flareMax: 14, doubleFlare: 0.3, flareWarn: 2.1 },
  { name: 'The Ember Gate', blurb: 'Seven worlds circling a furious star. Finish this route and become a legend.', quota: 5, planets: 7, debris: 58, flareMin: 7, flareMax: 11, doubleFlare: 0.45, flareWarn: 1.9 },
];

export interface Stats {
  delivered: number;
  earned: number;
  flares: number;
  hits: number;
  crashes: number;
  fuelUsed: number;
  time: number;
}

export const newStats = (): Stats => ({ delivered: 0, earned: 0, flares: 0, hits: 0, crashes: 0, fuelUsed: 0, time: 0 });

export const mergeStats = (a: Stats, b: Stats): Stats => ({
  delivered: a.delivered + b.delivered,
  earned: a.earned + b.earned,
  flares: a.flares + b.flares,
  hits: a.hits + b.hits,
  crashes: a.crashes + b.crashes,
  fuelUsed: a.fuelUsed + b.fuelUsed,
  time: a.time + b.time,
});

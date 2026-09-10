import type { PheromoneType } from './types';

// ---------------------------------------------------------------------------
// Centralized simulation tuning. All "magic numbers" that shape emergent
// behaviour live here so they are easy to find and experiment with.
// ---------------------------------------------------------------------------

export const WORLD = {
  width: 1600,
  height: 1000,
  cellSize: 8, // pheromone + wall grid resolution (world units per cell)
  hashCell: 40, // spatial hash bucket size for ant neighbour queries
  territoryCell: 40, // coarse grid for activity-area statistic
  territoryWindow: 900, // ticks a visited cell counts toward territory
};

export const SIM = {
  diffuseInterval: 3, // pheromone decay/diffusion pass every N ticks
  historyInterval: 60, // ticks between time-series samples
  historyLength: 240, // bounded samples per colony

  // Steering
  turnRate: 0.35, // how quickly heading blends toward a desired direction
  wanderJitter: 0.22, // random heading noise per tick (radians, scaled by exploration)
  sampleAngles: [-1.05, -0.5, 0, 0.5, 1.05], // pheromone sampling offsets around heading
  detectFloor: 0.004, // pheromone concentrations below this are treated as noise
  trailIgnoreBase: 0.0012, // per-tick chance to drop a trail (scaled by exploration)

  // Obstacles
  whiskerLength: 14,
  whiskerAngle: 0.6,

  // Food
  collectTicks: 18,
  foodRadiusBase: 5,
  foodRadiusScale: 0.55, // radius = base + sqrt(amount) * scale

  // Nest
  nestRadius: 20,
  nestSenseBonus: 2.2, // nests are big landmarks; visible beyond normal sense range

  // Energy
  baseEnergyPerTick: 0.00012, // ~140 s at 1x for an average colony to run dry
  hungerThreshold: 0.28, // go home when energy falls below this
  restUntil: 0.92,
  restEnergyPerTick: 0.01,
  restFoodPerEnergy: 0.6, // food consumed per full energy refill
  starveDamagePerTick: 0.02,
  healPerTick: 0.15,

  // Combat
  contactRange: 7,
  attackInterval: 18,
  fleeHealthFraction: 0.35,
  alarmInvestigateTicks: 260,

  // Reproduction
  antFoodCost: 4,
  growInterval: 45, // ticks between spawn attempts per colony

  // Pheromone deposit amounts (before colony strength multiplier)
  depositFood: 0.045,
  depositHome: 0.015,
  depositExplore: 0.006,
  depositAlarm: 0.08,
};

export interface PheromoneParams {
  decay: number; // per-tick retention factor (1 = never fades)
  diffusion: number; // fraction exchanged with neighbours per diffusion pass
  max: number; // concentration cap
}

/** Half-life helpers make the numbers below readable: ticks at 1x = 60/s. */
const halfLife = (ticks: number) => Math.pow(0.5, 1 / ticks);

export const PHEROMONE: Record<PheromoneType, PheromoneParams> = {
  food: { decay: halfLife(1000), diffusion: 0.035, max: 3 },
  home: { decay: halfLife(1800), diffusion: 0.05, max: 3 },
  alarm: { decay: halfLife(160), diffusion: 0.14, max: 2 },
  explore: { decay: halfLife(700), diffusion: 0.04, max: 1.5 },
};

export const SPEEDS = [0.5, 1, 2, 4] as const;

/**
 * Central tuning constants for the ant-colony simulation.
 * Anything that changes how the emergent behaviour looks lives here so it is
 * easy to find and adjust.
 */

// ---- World geometry -------------------------------------------------------
export const WORLD_W = 1600;
export const WORLD_H = 1000;
/** Pheromone + wall grid cell size in world units. */
export const CELL = 8;
export const GRID_W = WORLD_W / CELL; // 200
export const GRID_H = WORLD_H / CELL; // 125

// ---- Time -----------------------------------------------------------------
export const SIM_DT = 1 / 30; // fixed simulation timestep (seconds)
export const MAX_STEPS_PER_FRAME = 8; // catch-up cap so slow machines don't spiral
/** Pheromone decay/diffusion runs every N ticks (cheaper than every tick). */
export const DIFFUSE_INTERVAL = 3;

// ---- Pheromone channels ---------------------------------------------------
export const PH_FOOD = 0;
export const PH_HOME = 1;
export const PH_ALARM = 2;
export const PH_EXPLORE = 3;
export const PH_COUNT = 4;

export interface PheromoneDef {
  key: string;
  label: string;
  /** Fraction lost per second (before colony decay modifier). */
  evaporation: number;
  /** Fraction of a cell shared with its 4 neighbours per diffusion pass. */
  diffusion: number;
}

export const PHEROMONE_DEFS: PheromoneDef[] = [
  { key: 'food', label: 'Food trail', evaporation: 0.028, diffusion: 0.025 },
  { key: 'home', label: 'Home', evaporation: 0.012, diffusion: 0.02 },
  { key: 'alarm', label: 'Alarm', evaporation: 0.22, diffusion: 0.09 },
  { key: 'explore', label: 'Exploration', evaporation: 0.05, diffusion: 0 },
];

// ---- Behaviour tuning -----------------------------------------------------
export const TUNING = {
  // Deposits are "per second" and multiplied by colony production & signal budget.
  foodDepositPerSec: 1.0,
  homeDepositPerSec: 1.0,
  exploreDepositPerSec: 0.12,
  alarmDepositPerSec: 3.5,
  /** Travel distance (world units) over which a signal budget decays by 1/e. */
  foodSignalRange: 600,
  homeSignalRange: 900,

  /** Pheromone probe geometry (local sampling ahead-left / ahead / ahead-right). */
  probeDist: 14,
  probeAngle: 0.75,
  /** Obstacle probes. */
  obstacleProbeLen: 20,
  obstacleProbeAngle: 0.65,
  obstacleProbeStep: 4,

  maxTurnPerTick: 0.38, // radians
  baseWander: 0.085, // gaussian sigma of random turn per tick
  /** Below this (sensitivity-scaled) concentration a trail is not perceived. */
  trailThreshold: 0.012,

  contactRange: 7, // world units for combat contact
  collectTime: 0.7, // seconds spent picking up food
  encounterMargin: 4, // extra radius around food/nest where contact counts

  energyDrainPerSec: 0.0032,
  restRecoverPerSec: 0.22,
  restFoodBoost: 0.25, // extra recovery per second if colony has stored food
  restFoodCostPerSec: 0.02,
  deliveryEnergy: 0.3, // energy restored when delivering food
  lowEnergy: 0.22, // below this ants prefer heading home

  damagePerSec: 9,
  retreatHealth: 0.3,
  fleeSeconds: 3,

  growthCost: 4, // stored food per new ant
  growthInterval: 3, // seconds between growth checks per colony
  maxColonyPop: 1500,

  depletedLingerSec: 10,
  /** Territory metric: cells whose exploration pheromone exceeds this. */
  territoryThreshold: 0.03,
  statsSampleInterval: 1, // seconds
  historyLength: 240,
};

// ---- Neural network dimensions -------------------------------------------
export const NN_INPUTS = 24;
export const NN_HIDDEN = 20;
export const NN_OUTPUTS = 8;

export const NN_INPUT_LABELS = [
  'food ph L', 'food ph A', 'food ph R',
  'home ph L', 'home ph A', 'home ph R',
  'alarm', 'explore ph',
  'obstacle F', 'obstacle L', 'obstacle R',
  'food seen', 'food bearing',
  'nest seen', 'nest bearing',
  'rival near', 'rival bearing',
  'friends', 'carrying', 'health', 'energy', 'home budget', 'stuck', 'noise',
];

export const NN_OUTPUT_LABELS = [
  'steer', 'forward', 'trail follow', 'explore', 'alarm response', 'engage', 'avoid/retreat', 'go home',
];
export const OUT_STEER = 0;
export const OUT_FORWARD = 1;
export const OUT_TRAIL = 2;
export const OUT_EXPLORE = 3;
export const OUT_ALARM = 4;
export const OUT_ENGAGE = 5;
export const OUT_AVOID = 6;
export const OUT_HOME = 7;

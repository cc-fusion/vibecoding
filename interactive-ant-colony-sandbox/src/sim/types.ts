// ---------------------------------------------------------------------------
// Core data model for the ant colony sandbox.
// ---------------------------------------------------------------------------

export type AntState =
  | 'exploring'
  | 'followingFood'
  | 'collecting'
  | 'returning'
  | 'homing' // following home signal without food (hungry / lost)
  | 'investigating'
  | 'fighting'
  | 'fleeing'
  | 'resting';

export const ANT_STATE_LABELS: Record<AntState, string> = {
  exploring: 'Exploring',
  followingFood: 'Following food trail',
  collecting: 'Collecting food',
  returning: 'Returning with food',
  homing: 'Following home signal',
  investigating: 'Investigating alarm',
  fighting: 'Fighting',
  fleeing: 'Fleeing',
  resting: 'Resting / recovering',
};

export type PheromoneType = 'food' | 'home' | 'alarm' | 'explore';
export const PHEROMONE_TYPES: PheromoneType[] = ['food', 'home', 'alarm', 'explore'];
export const PHEROMONE_LABELS: Record<PheromoneType, string> = {
  food: 'Food trail',
  home: 'Home signal',
  alarm: 'Alarm',
  explore: 'Exploration',
};

/** Editable per-colony traits. Every colony owns an independent copy. */
export interface ColonyTraits {
  name: string;
  color: string;
  startPopulation: number;
  speed: number; // base movement, world units per tick
  maxHealth: number;
  strength: number; // damage per hit
  carryCapacity: number; // food units per trip
  senseRange: number; // world units
  pheromoneStrength: number; // deposit multiplier
  pheromoneSensitivity: number; // detection multiplier
  pheromoneDecay: number; // evaporation multiplier (1 = normal, >1 = faster fade)
  exploration: number; // 0..1 willingness to leave trails
  aggression: number; // 0..1
  energyUse: number; // metabolic multiplier
  autoGrow: boolean;
  maxPopulation: number;
}

export interface Ant {
  id: number;
  colonyId: number;
  x: number;
  y: number;
  heading: number; // radians
  state: AntState;
  health: number;
  energy: number; // 0..1
  carrying: number;
  /** Internal food-signal strength: high right after finding food, fades on the way home. */
  foodSignal: number;
  /** Internal home-signal strength: high right after leaving the nest, fades with travel. */
  homeSignal: number;
  /** Noisy path-integration memory (vector pointing roughly back to the nest). */
  memX: number;
  memY: number;
  memBias: number; // per-ant systematic heading error for the memory
  memValid: boolean; // false for ants released in the field that never visited a nest
  targetFoodId: number;
  targetAntId: number;
  timer: number; // generic state timer (ticks)
  attackCooldown: number;
  avoidTimer: number; // >0 while recently steering around a wall
  foodBlind: number; // >0 after giving up on unreachable food (ignore visible food briefly)
  age: number;
  // Debug / inspection snapshot of last perception
  senseFood: number;
  senseHome: number;
  senseAlarm: number;
  senseExplore: number;
  seesFood: boolean;
  seesNest: boolean;
  seesEnemies: number;
}

export interface FoodSource {
  id: number;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
}

export interface Nest {
  id: number;
  colonyId: number;
  x: number;
  y: number;
  radius: number;
}

export interface HistorySample {
  tick: number;
  population: number;
  stored: number;
  collected: number;
  deaths: number;
}

export interface ColonyStats {
  living: number;
  avgHealth: number;
  explorers: number;
  carrying: number;
  fighting: number;
  territoryCells: number;
  territoryArea: number; // world units^2
}

/** Setup-level snapshot used for save/load. Does not include live ant state. */
export interface WorldSetup {
  version: 1;
  seed: number;
  colonies: { id: number; traits: ColonyTraits; storedFood: number }[];
  nests: Nest[];
  food: FoodSource[];
  walls: number[]; // run-length encoded wall grid: [value, count, value, count, ...]
  pathMemory: boolean;
}

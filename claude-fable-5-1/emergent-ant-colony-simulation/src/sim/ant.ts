/**
 * Ant agent state. All fields are strictly local knowledge: the ant's own
 * body state plus whatever it sensed on the current tick.
 */
import { NN_INPUTS, NN_OUTPUTS } from './constants';

export enum AntState {
  Exploring = 0,
  FollowingFoodTrail,
  CollectingFood,
  ReturningWithFood,
  FollowingHomeSignal,
  InvestigatingAlarm,
  Fighting,
  AvoidingObstacle,
  Resting,
  Retreating,
}

export const STATE_LABELS: Record<AntState, string> = {
  [AntState.Exploring]: 'Exploring',
  [AntState.FollowingFoodTrail]: 'Following food trail',
  [AntState.CollectingFood]: 'Collecting food',
  [AntState.ReturningWithFood]: 'Returning with food',
  [AntState.FollowingHomeSignal]: 'Following home signal',
  [AntState.InvestigatingAlarm]: 'Investigating alarm',
  [AntState.Fighting]: 'Fighting',
  [AntState.AvoidingObstacle]: 'Avoiding obstacle',
  [AntState.Resting]: 'Resting / recovering',
  [AntState.Retreating]: 'Retreating',
};

/** Everything the ant perceived this tick (local only). */
export interface Senses {
  // raw pheromone probe values (0..1) for own colony channels
  foodL: number; foodA: number; foodR: number;
  homeL: number; homeA: number; homeR: number;
  alarmL: number; alarmA: number; alarmR: number;
  foodHere: number; homeHere: number; alarmHere: number; exploreHere: number;
  // obstacle proximity 0 (clear) .. 1 (touching)
  obsF: number; obsL: number; obsR: number;
  foodSeen: boolean; foodDist: number; foodBearing: number; foodId: number;
  nestSeen: boolean; nestDist: number; nestBearing: number; nestId: number;
  rivalSeen: boolean; rivalDist: number; rivalBearing: number; rivalIndex: number;
  friends: number; rivals: number;
}

export function emptySenses(): Senses {
  return {
    foodL: 0, foodA: 0, foodR: 0, homeL: 0, homeA: 0, homeR: 0, alarmL: 0, alarmA: 0, alarmR: 0,
    foodHere: 0, homeHere: 0, alarmHere: 0, exploreHere: 0,
    obsF: 0, obsL: 0, obsR: 0,
    foodSeen: false, foodDist: 0, foodBearing: 0, foodId: -1,
    nestSeen: false, nestDist: 0, nestBearing: 0, nestId: -1,
    rivalSeen: false, rivalDist: 0, rivalBearing: 0, rivalIndex: -1,
    friends: 0, rivals: 0,
  };
}

export class Ant {
  id: number;
  colonyId: number;
  x: number;
  y: number;
  heading: number;
  health: number;
  energy = 1;
  carrying = 0;
  alive = true;
  age = 0;

  state: AntState = AntState.Exploring;
  prevState: AntState = AntState.Exploring;
  stateTimer = 0;

  /** Signal budgets: decay with distance travelled, reset at food / nest. */
  foodBudget = 0;
  homeBudget = 1;

  // short-term memory
  avoidDir = 0;        // +1 turn right / -1 turn left while skirting an obstacle
  avoidTimer = 0;
  stuck = 0;           // 0..1 stuck indicator
  sampleX: number;
  sampleY: number;
  sampleTimer = 0;
  lostTimer = 0;       // seconds without useful trail signal
  downhill = 0;        // consecutive ticks moving against the gradient
  ignoreTrailTimer = 0;// seconds during which food trails are ignored
  frustration = 0;     // time spent on a strong trail with no food in sight
  alarmCooldown = 0;   // seconds before this ant will answer another alarm
  retreatCheck = 0;
  target: Ant | null = null; // combat opponent
  targetFoodId = -1;
  /** per-ant variation of speed / wander (0.85..1.15) */
  variation: number;

  // brain buffers (reused; never reallocated)
  inputs = new Float32Array(NN_INPUTS);
  outputs = new Float32Array(NN_OUTPUTS);
  senses: Senses = emptySenses();
  lastTurn = 0;
  effectiveSpeed = 0;

  constructor(id: number, colonyId: number, x: number, y: number, heading: number, health: number, variation: number) {
    this.id = id;
    this.colonyId = colonyId;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.health = health;
    this.sampleX = x;
    this.sampleY = y;
    this.variation = variation;
  }

  setState(s: AntState): void {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTimer = 0;
  }
}

export interface FoodSource {
  id: number;
  x: number;
  y: number;
  quantity: number;
  maxQuantity: number;
  /** extra radius added to the quantity-derived radius */
  radiusBonus: number;
  /** simulated time when depleted (for fade-out); -1 while active */
  depletedAt: number;
}

export function foodRadius(f: FoodSource): number {
  return 4 + Math.sqrt(Math.max(0, f.quantity)) * 0.8 + f.radiusBonus;
}

export interface Nest {
  id: number;
  colonyId: number;
  x: number;
  y: number;
  radius: number;
}

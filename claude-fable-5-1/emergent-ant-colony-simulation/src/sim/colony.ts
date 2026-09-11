/**
 * Colony definitions: traits, colour, policy and per-colony runtime data.
 */
import { PheromoneField } from './pheromone';
import { buildBaselinePolicy, clonePolicy, type Policy, type PolicyProfile, DEFAULT_PROFILE } from './policy';

export interface ColonyTraits {
  population: number;          // target/initial ants
  speed: number;               // world units per second
  maxHealth: number;
  strength: number;            // damage multiplier
  carryCapacity: number;       // food units per trip
  sensoryRange: number;        // world units
  pheromoneProduction: number; // deposit multiplier
  pheromoneSensitivity: number;// input gain for pheromone samples
  pheromoneDecay: number;      // decay modifier (1 = normal, 2 = fades twice as fast)
  exploration: number;         // 0..1 willingness to wander / leave trails
  aggression: number;          // 0..1 tendency to confront rivals
  energyConsumption: number;   // drain multiplier
  neuralInfluence: number;     // 0..1.5 how much the policy network biases behaviour
  autoGrow: boolean;           // spend stored food on new ants
}

export interface TraitMeta {
  key: keyof ColonyTraits;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}

export const TRAIT_META: TraitMeta[] = [
  { key: 'population', label: 'Population', min: 0, max: 600, step: 5, hint: 'Number of ants maintained by manual spawn/reset (growth cap is 2x).' },
  { key: 'speed', label: 'Speed', min: 15, max: 90, step: 1, hint: 'Movement speed in world units per second.' },
  { key: 'maxHealth', label: 'Max health', min: 20, max: 250, step: 5, hint: 'Hit points of each ant.' },
  { key: 'strength', label: 'Strength', min: 0.2, max: 3, step: 0.1, hint: 'Damage dealt in combat.' },
  { key: 'carryCapacity', label: 'Carrying capacity', min: 0.5, max: 5, step: 0.5, hint: 'Food carried per successful trip.' },
  { key: 'sensoryRange', label: 'Sensory range', min: 15, max: 90, step: 1, hint: 'Radius within which food, nests and other ants are directly perceived.' },
  { key: 'pheromoneProduction', label: 'Pheromone production', min: 0.2, max: 3, step: 0.1, hint: 'Amount of pheromone deposited per step.' },
  { key: 'pheromoneSensitivity', label: 'Pheromone sensitivity', min: 0.2, max: 3, step: 0.1, hint: 'How strongly local pheromone samples influence decisions.' },
  { key: 'pheromoneDecay', label: 'Pheromone decay', min: 0.3, max: 3, step: 0.1, hint: 'Multiplier on evaporation of this colony\'s trails.' },
  { key: 'exploration', label: 'Exploration', min: 0, max: 1, step: 0.02, hint: 'Willingness to wander and deviate from established trails.' },
  { key: 'aggression', label: 'Aggression', min: 0, max: 1, step: 0.02, hint: 'Likelihood of confronting nearby rivals and answering alarm signals.' },
  { key: 'energyConsumption', label: 'Energy use', min: 0.2, max: 3, step: 0.1, hint: 'How fast ants tire. Tired ants slow down and return to rest.' },
  { key: 'neuralInfluence', label: 'Neural influence', min: 0, max: 1.5, step: 0.05, hint: 'Degree to which the tiny policy network biases steering and decisions (0 = rules only).' },
];

export interface ColonyStats {
  living: number;
  storedFood: number;
  collected: number;
  deaths: number;
  kills: number;
  avgHealth: number;
  explorers: number;
  carrying: number;
  followers: number;
  fighting: number;
  territory: number; // cells
  trips: number;
}

export interface Colony {
  id: number;
  name: string;
  color: string;
  traits: ColonyTraits;
  policy: Policy;
  basePolicy: Policy; // for "reset policy"
  profileName: string;
  pheromones: PheromoneField;
  storedFood: number;
  collected: number;
  deaths: number;
  kills: number;
  trips: number;
  growthTimer: number;
  stats: ColonyStats;
  /** cached rgb for renderer */
  rgb: [number, number, number];
}

export const DEFAULT_TRAITS: ColonyTraits = {
  population: 120,
  speed: 45,
  maxHealth: 100,
  strength: 1,
  carryCapacity: 1,
  sensoryRange: 45,
  pheromoneProduction: 1,
  pheromoneSensitivity: 1,
  pheromoneDecay: 1,
  exploration: 0.4,
  aggression: 0.3,
  energyConsumption: 1,
  neuralInfluence: 1,
  autoGrow: true,
};

export interface ColonyPreset {
  name: string;
  color: string;
  traits: Partial<ColonyTraits>;
  profile: PolicyProfile;
  description: string;
}

export const COLONY_PRESETS: ColonyPreset[] = [
  {
    name: 'Amber Scouts',
    color: '#f5a524',
    description: 'Fast, curious, long-sighted, fragile.',
    traits: { speed: 58, exploration: 0.62, sensoryRange: 60, maxHealth: 70, strength: 0.8, carryCapacity: 1, aggression: 0.28, population: 130 },
    profile: { ...DEFAULT_PROFILE, trailGain: 0.85, noiseGain: 1.5, visionGain: 1.2, alarmGain: 0.8, engageGain: 0.8, caution: 1.2 },
  },
  {
    name: 'Cobalt Harvesters',
    color: '#38bdf8',
    description: 'Slow, tough, strong, heavy loads, trail-committed.',
    traits: { speed: 36, exploration: 0.22, sensoryRange: 40, maxHealth: 150, strength: 1.5, carryCapacity: 2, aggression: 0.36, population: 110 },
    profile: { ...DEFAULT_PROFILE, trailGain: 1.4, noiseGain: 0.6, visionGain: 1.0, alarmGain: 1.1, engageGain: 1.2, caution: 0.8 },
  },
  {
    name: 'Crimson Raiders',
    color: '#ef4444',
    description: 'Aggressive and alarm-driven. Fights over resources.',
    traits: { speed: 48, exploration: 0.4, maxHealth: 110, strength: 1.8, aggression: 0.8, carryCapacity: 1, population: 100 },
    profile: { ...DEFAULT_PROFILE, alarmGain: 1.8, engageGain: 1.8, caution: 0.5, noiseGain: 1.0 },
  },
  {
    name: 'Jade Pacifists',
    color: '#4ade80',
    description: 'Peaceful and efficient foragers that avoid conflict.',
    traits: { speed: 44, exploration: 0.35, aggression: 0.02, maxHealth: 90, strength: 0.7, carryCapacity: 1.5, population: 120 },
    profile: { ...DEFAULT_PROFILE, alarmGain: 0.4, engageGain: 0.2, caution: 1.6, trailGain: 1.2 },
  },
  {
    name: 'Violet Wanderers',
    color: '#a78bfa',
    description: 'Extreme explorers that rarely commit to trails.',
    traits: { speed: 50, exploration: 0.9, sensoryRange: 55, pheromoneSensitivity: 0.7, aggression: 0.2, population: 110 },
    profile: { ...DEFAULT_PROFILE, trailGain: 0.6, noiseGain: 2.2, caution: 1.0 },
  },
];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function createColony(id: number, preset: ColonyPreset, overrides: Partial<ColonyTraits> = {}): Colony {
  const traits: ColonyTraits = { ...DEFAULT_TRAITS, ...preset.traits, ...overrides };
  const basePolicy = buildBaselinePolicy(preset.profile);
  return {
    id,
    name: preset.name,
    color: preset.color,
    traits,
    policy: clonePolicy(basePolicy),
    basePolicy,
    profileName: preset.name,
    pheromones: new PheromoneField(),
    storedFood: 0,
    collected: 0,
    deaths: 0,
    kills: 0,
    trips: 0,
    growthTimer: 0,
    stats: { living: 0, storedFood: 0, collected: 0, deaths: 0, kills: 0, avgHealth: 0, explorers: 0, carrying: 0, followers: 0, fighting: 0, territory: 0, trips: 0 },
    rgb: hexToRgb(preset.color),
  };
}

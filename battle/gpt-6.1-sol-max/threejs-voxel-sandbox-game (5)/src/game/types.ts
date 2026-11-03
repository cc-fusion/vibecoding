export type GameMode = 'explorer' | 'creative';
export type Weather = 'clear' | 'rain';
export type Screen = 'welcome' | 'playing' | 'paused' | 'inventory' | 'guide' | 'settings' | 'worlds';

export interface Settings {
  volume: number;
  sensitivity: number;
  renderDistance: number;
  fov: number;
  shadows: boolean;
  autoStep: boolean;
  weather: 'auto' | Weather;
  mode: GameMode;
}

export interface Stats {
  gathered: Record<number, number>;
  crafted: Record<number, number>;
  placed: number;
  distance: number;
  biomes: string[];
  completed: string[];
}

export interface WorldSave {
  version: 1;
  id: string;
  name: string;
  seed: string;
  createdAt: number;
  updatedAt: number;
  position: [number, number, number] | null;
  spawn: [number, number, number] | null;
  yaw: number;
  pitch: number;
  inventory: Record<number, number>;
  hotbar: number[];
  selected: number;
  edits: [string, number][];
  time: number;
  day: number;
  health: number;
  stats: Stats;
}

export interface Target {
  x: number;
  y: number;
  z: number;
  id: number;
  normal: [number, number, number];
  distance: number;
}

export interface GameSnapshot {
  ready: boolean;
  loading: number;
  health: number;
  stamina: number;
  air: number;
  selected: number;
  hotbar: number[];
  inventory: Record<number, number>;
  position: [number, number, number];
  yaw: number;
  biome: string;
  time: number;
  day: number;
  weather: Weather;
  mining: number;
  target: Target | null;
  fps: number;
  savedAt: number;
  stats: Stats;
  flying: boolean;
  inWater: boolean;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'item' | 'achievement' | 'error';
  item?: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  output: number;
  count: number;
  ingredients: [number, number][];
  station?: number;
  category: 'Essentials' | 'Tools' | 'Building';
}
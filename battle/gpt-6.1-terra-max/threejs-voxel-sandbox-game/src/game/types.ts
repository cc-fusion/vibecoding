export interface ItemStack {
  id: string;
  count: number;
}

export interface GameStats {
  mined: number;
  logs: number;
  placed: number;
  crafted: number;
}

export interface SavedGame {
  version: number;
  seed: number;
  edits: Record<string, number>;
  position: [number, number, number];
  rotation: [number, number];
  inventory: (ItemStack | null)[];
  selected: number;
  time: number;
  health: number;
  stats: GameStats;
  sound: boolean;
}

export interface GameSnapshot {
  inventory: (ItemStack | null)[];
  selected: number;
  health: number;
  day: number;
  time: string;
  biome: string;
  weather: 'Clear' | 'Rain';
  coordinates: [number, number, number];
  target: string;
  breaking: number;
  stats: GameStats;
  sound: boolean;
  saved: boolean;
}

export interface Recipe {
  id: string;
  output: string;
  count: number;
  ingredients: { id: string; count: number }[];
  description: string;
}

export interface GameCallbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onLockChange: (locked: boolean) => void;
  onInventory: () => void;
  onToast: (title: string, detail: string) => void;
  onReady: () => void;
}
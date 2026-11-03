// Minimal observable store bridging the game loop and React UI.
import { useSyncExternalStore } from "react";
import type { Stack } from "./inventory";
import type { Station } from "./crafting";

export type Screen = "menu" | "loading" | "playing" | "inventory" | "paused" | "dead" | "settings";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  icon?: number;
  kind: "achievement" | "info";
}

export interface HudState {
  screen: Screen;
  pointerLocked: boolean;
  loadingProgress: number;
  loadingText: string;
  health: number;
  maxHealth: number;
  hunger: number;
  air: number;
  maxAir: number;
  xp: number;
  hotbar: (Stack | null)[];
  selected: number;
  invVersion: number;
  creative: boolean;
  flying: boolean;
  underwater: boolean;
  hurtFlash: number;
  targetName: string | null;
  breakProgress: number;
  timeString: string;
  biome: string;
  fps: number;
  debug: string[];
  station: Station;
  toasts: Toast[];
  deathCause: string;
  worldName: string;
  sleepFade: number;
  hintText: string;
  playTime: number;
}

export const initialHud: HudState = {
  screen: "menu",
  pointerLocked: false,
  loadingProgress: 0,
  loadingText: "",
  health: 20,
  maxHealth: 20,
  hunger: 20,
  air: 300,
  maxAir: 300,
  xp: 0,
  hotbar: new Array(9).fill(null),
  selected: 0,
  invVersion: 0,
  creative: false,
  flying: false,
  underwater: false,
  hurtFlash: 0,
  targetName: null,
  breakProgress: 0,
  timeString: "06:00",
  biome: "Plains",
  fps: 0,
  debug: [],
  station: "hand",
  toasts: [],
  deathCause: "",
  worldName: "",
  sleepFade: 0,
  hintText: "",
  playTime: 0,
};

type Listener = () => void;

class Store {
  state: HudState = { ...initialHud };
  private listeners = new Set<Listener>();
  private toastId = 0;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => this.state;

  set(patch: Partial<HudState>) {
    // avoid re-render if nothing changed (shallow)
    let changed = false;
    for (const k in patch) {
      if ((this.state as unknown as Record<string, unknown>)[k] !== (patch as unknown as Record<string, unknown>)[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  toast(title: string, body?: string, icon?: number, kind: Toast["kind"] = "info") {
    const t: Toast = { id: ++this.toastId, title, body, icon, kind };
    this.set({ toasts: [...this.state.toasts, t].slice(-4) });
    setTimeout(() => this.set({ toasts: this.state.toasts.filter((x) => x.id !== t.id) }), 5000);
  }
}

export const store = new Store();

export function useHud(): HudState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

import { EventEmitter } from "../core/EventEmitter";

export type PanelTab = "output" | "terminal" | "problems" | "build";
export type PreviewMode = "hidden" | "split" | "only" | "fullscreen";
export type RunState = "idle" | "building" | "running";
export type ActivityView = "explorer" | "search";

export interface UIState {
  activeFile: string | null;
  openTabs: string[];
  sidebarVisible: boolean;
  sidebarWidth: number;
  activeActivity: ActivityView;
  expandedDirs: string[];
  panelVisible: boolean;
  panelHeight: number;
  activePanelTab: PanelTab;
  previewMode: PreviewMode;
  previewWidth: number; // percentage of workbench width
  previewFile: string | null;
  settingsVisible: boolean;
  runState: RunState;
  runLabel: string;
}

const PERSISTED_KEYS: Array<keyof UIState> = ["activeFile", "openTabs", "sidebarVisible", "sidebarWidth", "activeActivity", "expandedDirs", "panelVisible", "panelHeight", "activePanelTab", "previewMode", "previewWidth", "previewFile"];

const STORAGE_KEY = "forge-ide.ui.v1";

const DEFAULT_STATE: UIState = {
  activeFile: null,
  openTabs: [],
  sidebarVisible: true,
  sidebarWidth: 260,
  activeActivity: "explorer",
  expandedDirs: [],
  panelVisible: true,
  panelHeight: 220,
  activePanelTab: "output",
  previewMode: "hidden",
  previewWidth: 50,
  previewFile: null,
  settingsVisible: false,
  runState: "idle",
  runLabel: "Ready",
};

/**
 * Explicit UI state store. The DOM is rendered *from* this state; nothing
 * important is derived back from DOM classes.
 */
export class UIStateManager extends EventEmitter<{ change: { state: UIState; changed: Array<keyof UIState> } }> {
  private state: UIState;

  constructor() {
    super();
    const restored = this.read();
    this.state = { ...DEFAULT_STATE, ...restored, settingsVisible: false, runState: "idle", runLabel: "Ready" };
    if (this.state.previewMode === "fullscreen") this.state.previewMode = "split";
    if (window.innerWidth < 900) this.state.sidebarVisible = false;
  }

  get(): UIState {
    return this.state;
  }

  set(patch: Partial<UIState>): void {
    const changed: Array<keyof UIState> = [];
    for (const key of Object.keys(patch) as Array<keyof UIState>) {
      const next = patch[key];
      if (next === undefined) continue;
      const prev = this.state[key];
      const same = Array.isArray(next) && Array.isArray(prev) ? next.length === prev.length && next.every((v, i) => v === prev[i]) : prev === next;
      if (same) continue;
      (this.state as any)[key] = next;
      changed.push(key);
    }
    if (!changed.length) return;
    if (changed.some((k) => PERSISTED_KEYS.includes(k))) this.write();
    this.emit("change", { state: this.state, changed });
  }

  toggle(key: "sidebarVisible" | "panelVisible" | "settingsVisible"): void {
    this.set({ [key]: !this.state[key] } as Partial<UIState>);
  }

  private read(): Partial<UIState> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  private write(): void {
    const out: Partial<UIState> = {};
    for (const k of PERSISTED_KEYS) (out as any)[k] = this.state[k];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      /* ignore */
    }
  }
}

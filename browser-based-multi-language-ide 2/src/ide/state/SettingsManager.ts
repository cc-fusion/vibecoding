import { EventEmitter } from "../core/EventEmitter";

export type ThemeId = "dark" | "dimmed" | "light";

export interface Settings {
  fontSize: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  minimap: boolean;
  theme: ThemeId;
  previewAutoRefresh: boolean;
  /** Autosave is always on; only the debounce delay is configurable. */
  autosaveDelayMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 13,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: false,
  minimap: true,
  theme: "dark",
  previewAutoRefresh: true,
  autosaveDelayMs: 600,
};

const STORAGE_KEY = "forge-ide.settings.v1";

export class SettingsManager extends EventEmitter<{ change: { settings: Settings; changed: Array<keyof Settings> } }> {
  private settings: Settings;

  constructor() {
    super();
    this.settings = { ...DEFAULT_SETTINGS, ...this.read() };
  }

  get(): Settings {
    return { ...this.settings };
  }

  update(patch: Partial<Settings>): void {
    const changed: Array<keyof Settings> = [];
    for (const key of Object.keys(patch) as Array<keyof Settings>) {
      const value = patch[key];
      if (value === undefined || this.settings[key] === value) continue;
      (this.settings as any)[key] = value;
      changed.push(key);
    }
    if (!changed.length) return;
    this.settings.autosaveDelayMs = Math.min(5000, Math.max(150, this.settings.autosaveDelayMs));
    this.settings.fontSize = Math.min(32, Math.max(8, this.settings.fontSize));
    this.settings.tabSize = Math.min(8, Math.max(1, this.settings.tabSize));
    this.write();
    this.emit("change", { settings: this.get(), changed });
  }

  private read(): Partial<Settings> {
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* quota / private mode: settings simply won't persist */
    }
  }
}

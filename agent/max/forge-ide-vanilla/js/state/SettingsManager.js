import { EventEmitter } from "../core/EventEmitter.js";
const DEFAULT_SETTINGS = {
  fontSize: 13,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: false,
  minimap: true,
  theme: "dark",
  previewAutoRefresh: true,
  autosaveDelayMs: 600
};
const STORAGE_KEY = "forge-ide.settings.v1";
class SettingsManager extends EventEmitter {
  settings;
  constructor() {
    super();
    this.settings = { ...DEFAULT_SETTINGS, ...this.read() };
  }
  get() {
    return { ...this.settings };
  }
  update(patch) {
    const changed = [];
    for (const key of Object.keys(patch)) {
      const value = patch[key];
      if (value === void 0 || this.settings[key] === value) continue;
      this.settings[key] = value;
      changed.push(key);
    }
    if (!changed.length) return;
    this.settings.autosaveDelayMs = Math.min(5e3, Math.max(150, this.settings.autosaveDelayMs));
    this.settings.fontSize = Math.min(32, Math.max(8, this.settings.fontSize));
    this.settings.tabSize = Math.min(8, Math.max(1, this.settings.tabSize));
    this.write();
    this.emit("change", { settings: this.get(), changed });
  }
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  write() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
    }
  }
}
export {
  DEFAULT_SETTINGS,
  SettingsManager
};

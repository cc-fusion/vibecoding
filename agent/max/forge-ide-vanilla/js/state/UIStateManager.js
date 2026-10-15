import { EventEmitter } from "../core/EventEmitter.js";
const PERSISTED_KEYS = ["activeFile", "openTabs", "sidebarVisible", "sidebarWidth", "activeActivity", "expandedDirs", "panelVisible", "panelHeight", "activePanelTab", "previewMode", "previewWidth", "previewFile"];
const STORAGE_KEY = "forge-ide.ui.v1";
const DEFAULT_STATE = {
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
  runLabel: "Ready"
};
class UIStateManager extends EventEmitter {
  state;
  constructor() {
    super();
    const restored = this.read();
    this.state = { ...DEFAULT_STATE, ...restored, settingsVisible: false, runState: "idle", runLabel: "Ready" };
    if (this.state.previewMode === "fullscreen") this.state.previewMode = "split";
    if (window.innerWidth < 900) this.state.sidebarVisible = false;
  }
  get() {
    return this.state;
  }
  set(patch) {
    const changed = [];
    for (const key of Object.keys(patch)) {
      const next = patch[key];
      if (next === void 0) continue;
      const prev = this.state[key];
      const same = Array.isArray(next) && Array.isArray(prev) ? next.length === prev.length && next.every((v, i) => v === prev[i]) : prev === next;
      if (same) continue;
      this.state[key] = next;
      changed.push(key);
    }
    if (!changed.length) return;
    if (changed.some((k) => PERSISTED_KEYS.includes(k))) this.write();
    this.emit("change", { state: this.state, changed });
  }
  toggle(key) {
    this.set({ [key]: !this.state[key] });
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
    const out = {};
    for (const k of PERSISTED_KEYS) out[k] = this.state[k];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
    }
  }
}
export {
  UIStateManager
};

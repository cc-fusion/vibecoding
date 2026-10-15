import { icons } from "../core/icons.js";
class TabManager {
  constructor(container, ui, project, persistence) {
    this.container = container;
    this.ui = ui;
    this.project = project;
    this.persistence = persistence;
    this.container.setAttribute("role", "tablist");
    this.container.addEventListener("wheel", (e) => {
      if (e.deltaY && !e.deltaX) {
        this.container.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
    ui.on("change", ({ changed }) => {
      if (changed.includes("openTabs") || changed.includes("activeFile")) this.render();
    });
    persistence.on("stateChange", () => this.renderSaveDots());
    project.on("renamed", ({ moves }) => this.handleRenamed(moves));
    project.on("deleted", ({ paths }) => this.handleDeleted(paths));
    project.on("languageChanged", () => this.render());
  }
  container;
  ui;
  project;
  persistence;
  open(path) {
    if (!this.project.getFile(path)) return;
    const { openTabs } = this.ui.get();
    const tabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
    this.ui.set({ openTabs: tabs, activeFile: path });
  }
  activate(path) {
    if (this.ui.get().openTabs.includes(path)) this.ui.set({ activeFile: path });
    else this.open(path);
  }
  close(path) {
    const { openTabs, activeFile } = this.ui.get();
    const idx = openTabs.indexOf(path);
    if (idx === -1) return;
    const tabs = openTabs.filter((t) => t !== path);
    let next = activeFile;
    if (activeFile === path) next = tabs[Math.min(idx, tabs.length - 1)] ?? null;
    this.ui.set({ openTabs: tabs, activeFile: next });
  }
  closeAll() {
    this.ui.set({ openTabs: [], activeFile: null });
  }
  closeOthers(path) {
    this.ui.set({ openTabs: [path], activeFile: path });
  }
  /** Remove tabs whose files no longer exist (after load). */
  prune() {
    const { openTabs, activeFile } = this.ui.get();
    const tabs = openTabs.filter((t) => !!this.project.getFile(t));
    const active = activeFile && tabs.includes(activeFile) ? activeFile : tabs[0] ?? null;
    this.ui.set({ openTabs: tabs, activeFile: active });
    this.render();
  }
  handleRenamed(moves) {
    const map = new Map(moves.map((m) => [m.from, m.to]));
    const { openTabs, activeFile } = this.ui.get();
    const tabs = openTabs.map((t) => map.get(t) ?? t);
    const active = activeFile ? map.get(activeFile) ?? activeFile : null;
    this.ui.set({ openTabs: tabs, activeFile: active });
    this.render();
  }
  handleDeleted(paths) {
    const set = new Set(paths);
    const { openTabs, activeFile } = this.ui.get();
    if (!openTabs.some((t) => set.has(t))) return;
    const tabs = openTabs.filter((t) => !set.has(t));
    let active = activeFile;
    if (activeFile && set.has(activeFile)) {
      const idx = openTabs.indexOf(activeFile);
      active = tabs[Math.min(idx, tabs.length - 1)] ?? null;
    }
    this.ui.set({ openTabs: tabs, activeFile: active });
  }
  render() {
    const { openTabs, activeFile } = this.ui.get();
    this.container.textContent = "";
    for (const path of openTabs) {
      const file = this.project.getFile(path);
      if (!file) continue;
      const lang = this.project.languageOf(path);
      const tab = document.createElement("div");
      tab.className = "tab" + (path === activeFile ? " active" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(path === activeFile));
      tab.tabIndex = 0;
      tab.title = path;
      tab.dataset.path = path;
      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.style.background = lang.color;
      icon.textContent = lang.badge;
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = file.name;
      const dot = document.createElement("span");
      dot.className = "save-dot";
      dot.title = "Autosave status";
      const close = document.createElement("button");
      close.className = "close";
      close.type = "button";
      close.setAttribute("aria-label", `Close ${file.name}`);
      close.innerHTML = icons.close;
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        this.close(path);
      });
      tab.append(icon, name, dot, close);
      tab.addEventListener("click", () => this.activate(path));
      tab.addEventListener("auxclick", (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.close(path);
        }
      });
      tab.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.activate(path);
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          this.close(path);
        }
      });
      this.container.appendChild(tab);
      if (path === activeFile) tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    this.renderSaveDots();
  }
  renderSaveDots() {
    const state = this.persistence.state;
    for (const tab of Array.from(this.container.querySelectorAll(".tab"))) {
      const path = tab.dataset.path;
      const dot = tab.querySelector(".save-dot");
      if (!dot) continue;
      const pending = this.persistence.isPending(path);
      dot.className = "save-dot" + (state === "error" && pending ? " error" : pending ? " pending" : "");
      dot.title = state === "error" && pending ? "Autosave failed" : pending ? "Saving\u2026" : "Saved";
    }
  }
}
export {
  TabManager
};

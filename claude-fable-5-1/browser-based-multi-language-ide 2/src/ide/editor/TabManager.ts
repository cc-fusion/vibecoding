import { icons } from "../core/icons";
import type { PersistenceManager } from "../project/PersistenceManager";
import type { ProjectManager } from "../project/ProjectManager";
import type { UIStateManager } from "../state/UIStateManager";

/**
 * Editor tab strip. The list of open tabs and the active tab live in UIState;
 * this class mutates that state and renders from it.
 */
export class TabManager {
  constructor(private container: HTMLElement, private ui: UIStateManager, private project: ProjectManager, private persistence: PersistenceManager) {
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

  open(path: string): void {
    if (!this.project.getFile(path)) return;
    const { openTabs } = this.ui.get();
    const tabs = openTabs.includes(path) ? openTabs : [...openTabs, path];
    this.ui.set({ openTabs: tabs, activeFile: path });
  }

  activate(path: string): void {
    if (this.ui.get().openTabs.includes(path)) this.ui.set({ activeFile: path });
    else this.open(path);
  }

  close(path: string): void {
    const { openTabs, activeFile } = this.ui.get();
    const idx = openTabs.indexOf(path);
    if (idx === -1) return;
    const tabs = openTabs.filter((t) => t !== path);
    let next = activeFile;
    if (activeFile === path) next = tabs[Math.min(idx, tabs.length - 1)] ?? null;
    this.ui.set({ openTabs: tabs, activeFile: next });
  }

  closeAll(): void {
    this.ui.set({ openTabs: [], activeFile: null });
  }

  closeOthers(path: string): void {
    this.ui.set({ openTabs: [path], activeFile: path });
  }

  /** Remove tabs whose files no longer exist (after load). */
  prune(): void {
    const { openTabs, activeFile } = this.ui.get();
    const tabs = openTabs.filter((t) => !!this.project.getFile(t));
    const active = activeFile && tabs.includes(activeFile) ? activeFile : tabs[0] ?? null;
    this.ui.set({ openTabs: tabs, activeFile: active });
    this.render();
  }

  private handleRenamed(moves: Array<{ from: string; to: string; type: string }>): void {
    const map = new Map(moves.map((m) => [m.from, m.to]));
    const { openTabs, activeFile } = this.ui.get();
    const tabs = openTabs.map((t) => map.get(t) ?? t);
    const active = activeFile ? map.get(activeFile) ?? activeFile : null;
    this.ui.set({ openTabs: tabs, activeFile: active });
    this.render();
  }

  private handleDeleted(paths: string[]): void {
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

  render(): void {
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
      close.innerHTML = icons.close; // trusted static icon
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

  private renderSaveDots(): void {
    const state = this.persistence.state;
    for (const tab of Array.from(this.container.querySelectorAll<HTMLElement>(".tab"))) {
      const path = tab.dataset.path!;
      const dot = tab.querySelector<HTMLElement>(".save-dot");
      if (!dot) continue;
      const pending = this.persistence.isPending(path);
      dot.className = "save-dot" + (state === "error" && pending ? " error" : pending ? " pending" : "");
      dot.title = state === "error" && pending ? "Autosave failed" : pending ? "Saving…" : "Saved";
    }
  }
}

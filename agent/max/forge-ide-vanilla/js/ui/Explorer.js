import { icons } from "../core/icons.js";
import { ROOT, dirname, joinPath, validateName, validateRelativePath } from "../core/paths.js";
import { showContextMenu } from "./overlays.js";
class Explorer {
  constructor(header, body, project, ui, actions) {
    this.header = header;
    this.project = project;
    this.ui = ui;
    this.actions = actions;
    this.tree = document.createElement("div");
    this.tree.className = "tree";
    this.tree.setAttribute("role", "tree");
    this.tree.tabIndex = 0;
    body.appendChild(this.tree);
    this.buildHeader();
    this.tree.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const row = e.target.closest(".tree-row");
      const path = row?.dataset.path ?? null;
      if (path) this.selected = path;
      this.showMenu(e.clientX, e.clientY, path);
    });
    this.tree.addEventListener("keydown", (e) => this.onKey(e));
    const rerender = () => this.render();
    project.on("created", rerender);
    project.on("deleted", ({ paths }) => {
      if (this.selected && paths.includes(this.selected)) this.selected = null;
      rerender();
    });
    project.on("renamed", ({ moves }) => {
      const m = this.selected ? moves.find((x) => x.from === this.selected) : void 0;
      if (m) this.selected = m.to;
      rerender();
    });
    project.on("languageChanged", rerender);
    project.on("loaded", rerender);
    ui.on("change", ({ changed }) => {
      if (changed.includes("expandedDirs") || changed.includes("activeFile")) this.render();
    });
    this.render();
  }
  header;
  project;
  ui;
  actions;
  tree;
  selected = null;
  pending = null;
  rows = /* @__PURE__ */ new Map();
  startCreate(kind, dir) {
    const base = dir ?? this.contextDir();
    this.expand(base);
    this.pending = { kind: kind === "file" ? "create-file" : "create-folder", dir: base };
    this.render();
  }
  startRename(path) {
    this.pending = { kind: "rename", dir: dirname(path), path };
    this.render();
  }
  revealActive() {
    const active = this.ui.get().activeFile;
    if (!active) return;
    let dir = dirname(active);
    const expanded = new Set(this.ui.get().expandedDirs);
    while (dir !== ROOT) {
      expanded.add(dir);
      dir = dirname(dir);
    }
    this.ui.set({ expandedDirs: Array.from(expanded) });
  }
  // ---------- rendering ----------
  render() {
    const expanded = new Set(this.ui.get().expandedDirs);
    const active = this.ui.get().activeFile;
    this.tree.textContent = "";
    this.rows.clear();
    const renderDir = (dir, depth) => {
      if (this.pending && this.pending.kind !== "rename" && this.pending.dir === dir) this.tree.appendChild(this.editRow(depth, this.pending));
      for (const node of this.project.children(dir)) {
        const row = this.row(node, depth, expanded.has(node.path), node.path === active);
        this.tree.appendChild(row);
        this.rows.set(node.path, row);
        if (node.type === "dir" && expanded.has(node.path)) renderDir(node.path, depth + 1);
      }
    };
    renderDir(ROOT, 0);
    if (!this.tree.childElementCount) {
      const empty = document.createElement("div");
      empty.className = "tree-empty";
      empty.textContent = "The project is empty. Use the buttons above to create a file or folder.";
      this.tree.appendChild(empty);
    }
  }
  row(node, depth, isExpanded, isActive) {
    const row = document.createElement("div");
    row.className = "tree-row" + (isExpanded ? " expanded" : "") + (isActive ? " active" : "") + (node.path === this.selected ? " selected" : "");
    row.dataset.path = node.path;
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(depth + 1));
    if (node.type === "dir") row.setAttribute("aria-expanded", String(isExpanded));
    row.style.paddingLeft = `${8 + depth * 12}px`;
    row.title = node.path;
    const chev = document.createElement("span");
    chev.className = "chev";
    if (node.type === "dir") chev.innerHTML = icons.chevronRight;
    row.appendChild(chev);
    if (node.type === "dir") {
      const ic = document.createElement("span");
      ic.className = "folder-icon";
      ic.innerHTML = isExpanded ? icons.folderOpen : icons.folder;
      row.appendChild(ic);
    } else {
      const lang = this.project.languageOf(node.path);
      const ic = document.createElement("span");
      ic.className = "file-icon";
      ic.style.background = lang.color;
      ic.textContent = lang.badge;
      row.appendChild(ic);
    }
    if (this.pending?.kind === "rename" && this.pending.path === node.path) {
      row.appendChild(this.inlineInput(node.name, (value) => this.commitRename(node.path, value)));
    } else {
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = node.name;
      row.appendChild(label);
    }
    row.addEventListener("click", () => {
      this.selected = node.path;
      if (node.type === "dir") this.toggleDir(node.path);
      else {
        this.actions.open(node.path);
        this.render();
      }
    });
    row.addEventListener("dblclick", () => {
      if (node.type === "file") this.startRename(node.path);
    });
    return row;
  }
  editRow(depth, pending) {
    const row = document.createElement("div");
    row.className = "tree-row";
    row.style.paddingLeft = `${8 + depth * 12}px`;
    const chev = document.createElement("span");
    chev.className = "chev";
    const ic = document.createElement("span");
    ic.className = pending.kind === "create-folder" ? "folder-icon" : "file-icon";
    if (pending.kind === "create-folder") ic.innerHTML = icons.folder;
    else {
      ic.style.background = "var(--bg-4)";
      ic.textContent = "+";
    }
    row.append(chev, ic, this.inlineInput("", (value) => this.commitCreate(pending, value), pending.kind === "create-folder" ? "folder name (a/b creates nested)" : "file name, e.g. src/util.ts"));
    return row;
  }
  inlineInput(value, commit, placeholder = "") {
    const input = document.createElement("input");
    input.className = "inline-edit";
    input.value = value;
    input.placeholder = placeholder;
    input.spellcheck = false;
    input.setAttribute("aria-label", placeholder || "Name");
    let done = false;
    const finish = (apply) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      this.pending = null;
      if (apply && v) commit(v);
      else this.render();
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(!!input.value.trim() && input.value.trim() !== value));
    input.addEventListener("click", (e) => e.stopPropagation());
    requestAnimationFrame(() => {
      input.focus();
      const dot = value.lastIndexOf(".");
      input.setSelectionRange(0, dot > 0 ? dot : value.length);
    });
    return input;
  }
  // ---------- operations ----------
  commitCreate(pending, value) {
    const problem = validateRelativePath(value);
    if (problem) {
      this.actions.onError(problem);
      this.render();
      return;
    }
    const target = joinPath(pending.dir, value);
    try {
      if (pending.kind === "create-folder") {
        this.project.createFolder(target);
        this.expand(target);
      } else {
        this.project.createFile(target, "");
        this.expand(dirname(target));
        this.actions.open(target);
      }
      this.selected = target;
    } catch (err) {
      this.actions.onError(err.message);
    }
    this.render();
  }
  commitRename(path, value) {
    const problem = validateName(value);
    if (problem) {
      this.actions.onError(problem);
      this.render();
      return;
    }
    const target = joinPath(dirname(path), value);
    if (target === path) {
      this.render();
      return;
    }
    try {
      this.project.rename(path, target);
      this.selected = target;
    } catch (err) {
      this.actions.onError(err.message);
      this.render();
    }
  }
  duplicate(path) {
    try {
      const node = this.project.duplicate(path);
      this.selected = node.path;
      this.actions.open(node.path);
    } catch (err) {
      this.actions.onError(err.message);
    }
  }
  toggleDir(path) {
    const set = new Set(this.ui.get().expandedDirs);
    if (set.has(path)) set.delete(path);
    else set.add(path);
    this.ui.set({ expandedDirs: Array.from(set) });
  }
  expand(path) {
    if (path === ROOT) return;
    const set = new Set(this.ui.get().expandedDirs);
    let dir = path;
    while (dir !== ROOT) {
      set.add(dir);
      dir = dirname(dir);
    }
    this.ui.set({ expandedDirs: Array.from(set) });
  }
  collapseAll() {
    this.ui.set({ expandedDirs: [] });
  }
  contextDir() {
    if (!this.selected) return ROOT;
    const node = this.project.get(this.selected);
    if (!node) return ROOT;
    return node.type === "dir" ? node.path : dirname(node.path);
  }
  showMenu(x, y, path) {
    const node = path ? this.project.get(path) : void 0;
    const dir = node ? node.type === "dir" ? node.path : dirname(node.path) : ROOT;
    const items = [
      { label: "New File\u2026", icon: "newFile", onSelect: () => this.startCreate("file", dir) },
      { label: "New Folder\u2026", icon: "newFolder", onSelect: () => this.startCreate("folder", dir) }
    ];
    if (node) {
      items.push({ separator: true });
      if (node.type === "file") {
        const lang = this.project.languageOf(node.path);
        items.push({ label: "Open", onSelect: () => this.actions.open(node.path) });
        if (lang.id === "html") items.push({ label: "Preview", onSelect: () => this.actions.preview(node.path) });
        else if (lang.runnable) items.push({ label: "Run", onSelect: () => this.actions.runFile(node.path) });
        items.push({ label: "Duplicate", onSelect: () => this.duplicate(node.path) });
      }
      items.push({ label: "Rename\u2026", shortcut: "F2", onSelect: () => this.startRename(node.path) });
      items.push({ separator: true });
      items.push({ label: node.type === "dir" ? "Delete Folder\u2026" : "Delete\u2026", shortcut: "Del", danger: true, onSelect: () => void this.actions.requestDelete(node.path) });
    } else {
      items.push({ separator: true }, { label: "Collapse All", onSelect: () => this.collapseAll() });
    }
    showContextMenu(x, y, items);
  }
  onKey(e) {
    if (e.target.tagName === "INPUT") return;
    const paths = Array.from(this.rows.keys());
    if (!paths.length) return;
    const idx = this.selected ? paths.indexOf(this.selected) : -1;
    const node = this.selected ? this.project.get(this.selected) : void 0;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.select(paths[Math.min(paths.length - 1, idx + 1)]);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.select(paths[Math.max(0, idx - 1)]);
        break;
      case "ArrowRight":
        if (node?.type === "dir" && !this.ui.get().expandedDirs.includes(node.path)) this.toggleDir(node.path);
        break;
      case "ArrowLeft":
        if (node?.type === "dir" && this.ui.get().expandedDirs.includes(node.path)) this.toggleDir(node.path);
        else if (node && dirname(node.path) !== ROOT) this.select(dirname(node.path));
        break;
      case "Enter":
        e.preventDefault();
        if (node?.type === "file") this.actions.open(node.path);
        else if (node) this.toggleDir(node.path);
        break;
      case "F2":
        e.preventDefault();
        if (node) this.startRename(node.path);
        break;
      case "Delete":
      case "Backspace":
        if (node) {
          e.preventDefault();
          void this.actions.requestDelete(node.path);
        }
        break;
    }
  }
  select(path) {
    if (!path) return;
    this.selected = path;
    this.render();
    this.rows.get(path)?.scrollIntoView({ block: "nearest" });
  }
  buildHeader() {
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = "Explorer";
    const mk = (icon, label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "icon-btn";
      b.title = label;
      b.setAttribute("aria-label", label);
      b.innerHTML = icons[icon];
      b.addEventListener("click", fn);
      return b;
    };
    this.header.append(title, mk("newFile", "New File", () => this.startCreate("file")), mk("newFolder", "New Folder", () => this.startCreate("folder")), mk("collapseAll", "Collapse All", () => this.collapseAll()));
  }
}
export {
  Explorer
};

import { EventEmitter } from "../core/EventEmitter.js";
import { detectLanguage, languageById } from "../core/languages.js";
import { ROOT, basename, dirname, extname, isAncestor, joinPath, normalizePath, stripExt } from "../core/paths.js";
class ProjectManager extends EventEmitter {
  nodes = /* @__PURE__ */ new Map();
  load(records) {
    this.nodes.clear();
    for (const r of records) {
      const path = normalizePath(r.path);
      if (path === ROOT) continue;
      if (r.type === "dir") {
        this.nodes.set(path, { type: "dir", path, name: basename(path), updatedAt: r.updatedAt || Date.now() });
      } else {
        this.nodes.set(path, { type: "file", path, name: basename(path), content: r.content ?? "", language: r.language ?? null, updatedAt: r.updatedAt || Date.now() });
      }
    }
    for (const path of Array.from(this.nodes.keys())) this.ensureParents(path, false);
    this.emit("loaded", { count: this.nodes.size });
  }
  toRecords(paths) {
    const list = paths ? paths.map((p) => this.nodes.get(p)).filter((n) => !!n) : Array.from(this.nodes.values());
    return list.map((n) => this.toRecord(n));
  }
  toRecord(n) {
    return n.type === "dir" ? { path: n.path, type: "dir", updatedAt: n.updatedAt } : { path: n.path, type: "file", content: n.content, language: n.language, updatedAt: n.updatedAt };
  }
  get(path) {
    return this.nodes.get(normalizePath(path));
  }
  getFile(path) {
    const n = this.get(path);
    return n && n.type === "file" ? n : void 0;
  }
  exists(path) {
    return path === ROOT || this.nodes.has(normalizePath(path));
  }
  isDir(path) {
    return path === ROOT || this.nodes.get(normalizePath(path))?.type === "dir";
  }
  readFile(path) {
    return this.getFile(path)?.content ?? null;
  }
  allNodes() {
    return Array.from(this.nodes.values());
  }
  allFiles() {
    return this.allNodes().filter((n) => n.type === "file");
  }
  filesByLanguage(languageId) {
    return this.allFiles().filter((f) => this.languageOf(f.path).id === languageId);
  }
  /** Direct children of a directory, folders first, then case-insensitive by name. */
  children(dir) {
    const d = normalizePath(dir);
    const out = [];
    for (const n of this.nodes.values()) {
      if (dirname(n.path) === d && n.path !== d) out.push(n);
    }
    return out.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name, void 0, { sensitivity: "base", numeric: true }) : a.type === "dir" ? -1 : 1);
  }
  languageOf(path) {
    const node = this.getFile(path);
    if (node?.language) return languageById(node.language);
    return detectLanguage(path);
  }
  // ---------- mutations ----------
  createFile(path, content = "", language = null) {
    const p = normalizePath(path);
    if (p === ROOT) throw new Error("Invalid file path.");
    if (this.nodes.has(p)) throw new Error(`"${p}" already exists.`);
    const created = this.ensureParents(p, true);
    const node = { type: "file", path: p, name: basename(p), content, language, updatedAt: Date.now() };
    this.nodes.set(p, node);
    created.push(node);
    this.emit("created", { nodes: created });
    return node;
  }
  createFolder(path) {
    const p = normalizePath(path);
    if (p === ROOT) throw new Error("Invalid folder path.");
    if (this.nodes.has(p)) throw new Error(`"${p}" already exists.`);
    const created = this.ensureParents(p, true);
    const node = { type: "dir", path: p, name: basename(p), updatedAt: Date.now() };
    this.nodes.set(p, node);
    created.push(node);
    this.emit("created", { nodes: created });
    return node;
  }
  updateContent(path, content, origin = "api") {
    const node = this.getFile(path);
    if (!node) throw new Error(`File not found: ${path}`);
    if (node.content === content) return;
    node.content = content;
    node.updatedAt = Date.now();
    this.emit("contentChanged", { path: node.path, content, origin });
  }
  setLanguage(path, language) {
    const node = this.getFile(path);
    if (!node) return;
    node.language = language;
    node.updatedAt = Date.now();
    this.emit("languageChanged", { path: node.path, language });
  }
  rename(from, to) {
    const src = normalizePath(from);
    const dst = normalizePath(to);
    const node = this.nodes.get(src);
    if (!node) throw new Error(`Not found: ${src}`);
    if (src === dst) return [];
    if (this.nodes.has(dst)) throw new Error(`"${dst}" already exists.`);
    if (node.type === "dir" && isAncestor(src, dst)) throw new Error("Cannot move a folder into itself.");
    const created = this.ensureParents(dst, true);
    if (created.length) this.emit("created", { nodes: created });
    const moves = [];
    const affected = [node, ...node.type === "dir" ? this.descendants(src) : []];
    for (const n of affected) {
      const newPath = n.path === src ? dst : dst + n.path.slice(src.length);
      this.nodes.delete(n.path);
      moves.push({ from: n.path, to: newPath, type: n.type });
      n.path = newPath;
      n.name = basename(newPath);
      n.updatedAt = Date.now();
      this.nodes.set(newPath, n);
    }
    this.emit("renamed", { moves });
    return moves;
  }
  delete(path) {
    const p = normalizePath(path);
    const node = this.nodes.get(p);
    if (!node) return [];
    const removed = [node, ...node.type === "dir" ? this.descendants(p) : []].map((n) => n.path);
    for (const r of removed) this.nodes.delete(r);
    this.emit("deleted", { paths: removed });
    return removed;
  }
  duplicate(path) {
    const node = this.getFile(path);
    if (!node) throw new Error("Only files can be duplicated.");
    const target = this.uniquePath(dirname(node.path), node.name, " copy");
    return this.createFile(target, node.content, node.language);
  }
  /** Produce a non-colliding path for `name` inside `dir`, e.g. "main copy 2.ts". */
  uniquePath(dir, name, suffix = "") {
    const ext = extname(name);
    const base = stripExt(name);
    let candidate = joinPath(dir, name);
    if (!this.nodes.has(candidate) && !suffix) return candidate;
    candidate = joinPath(dir, `${base}${suffix}${ext}`);
    let i = 2;
    while (this.nodes.has(candidate)) {
      candidate = joinPath(dir, `${base}${suffix} ${i}${ext}`);
      i++;
    }
    return candidate;
  }
  /** Locate a project entry point by candidate file names (searched root-first). */
  findEntry(candidates) {
    for (const c of candidates) {
      const direct = this.getFile("/" + c);
      if (direct) return direct;
    }
    for (const c of candidates) {
      const found = this.allFiles().find((f) => f.path.endsWith("/" + c));
      if (found) return found;
    }
    return void 0;
  }
  // ---------- internals ----------
  descendants(dir) {
    return this.allNodes().filter((n) => isAncestor(dir, n.path));
  }
  ensureParents(path, collect) {
    const created = [];
    let dir = dirname(path);
    const missing = [];
    while (dir !== ROOT && !this.nodes.has(dir)) {
      missing.unshift(dir);
      dir = dirname(dir);
    }
    for (const m of missing) {
      const existing = this.nodes.get(m);
      if (existing && existing.type === "file") throw new Error(`"${m}" is a file, not a folder.`);
      const node = { type: "dir", path: m, name: basename(m), updatedAt: Date.now() };
      this.nodes.set(m, node);
      if (collect) created.push(node);
    }
    return created;
  }
}
export {
  ProjectManager
};

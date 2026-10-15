import { EventEmitter } from "../core/EventEmitter.js";
import { icons } from "../core/icons.js";
const MARKER_OWNER_PREFIX = "ide:";
const VOLATILE_SOURCES = /* @__PURE__ */ new Set(["typescript-build", "assemblyscript", "runtime", "cpp", "csharp", "java"]);
class DiagnosticsManager extends EventEmitter {
  constructor(container, editor, project) {
    super();
    this.container = container;
    this.editor = editor;
    this.project = project;
    editor.on("markersChanged", ({ paths }) => this.syncMonaco(paths));
    project.on("deleted", ({ paths }) => this.handleDeleted(paths));
    project.on("renamed", ({ moves }) => this.handleRenamed(moves));
    project.on("contentChanged", ({ path }) => this.invalidateVolatile(path));
    this.render();
  }
  container;
  editor;
  project;
  monacoByFile = /* @__PURE__ */ new Map();
  bySource = /* @__PURE__ */ new Map();
  renderQueued = false;
  /** Replace all diagnostics owned by `source`. */
  set(source, diagnostics) {
    const previousFiles = new Set((this.bySource.get(source) ?? []).map((d) => d.file));
    if (diagnostics.length) this.bySource.set(source, diagnostics);
    else this.bySource.delete(source);
    const files = /* @__PURE__ */ new Set([...previousFiles, ...diagnostics.map((d) => d.file)]);
    for (const file of files) this.applyMarkers(source, file);
    this.scheduleRender();
  }
  all() {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    const push = (d) => {
      const key = `${d.file}|${d.line}|${d.column}|${d.message}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(d);
    };
    for (const list of this.monacoByFile.values()) list.forEach(push);
    for (const list of this.bySource.values()) list.forEach(push);
    const order = { error: 0, warning: 1, info: 2 };
    return out.sort((a, b) => a.file.localeCompare(b.file) || order[a.severity] - order[b.severity] || a.line - b.line || a.column - b.column);
  }
  counts() {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const d of this.all()) {
      if (d.severity === "error") errors++;
      else if (d.severity === "warning") warnings++;
      else infos++;
    }
    return { errors, warnings, infos };
  }
  // ---------- synchronization ----------
  syncMonaco(paths) {
    for (const path of paths) {
      if (!this.project.getFile(path)) {
        this.monacoByFile.delete(path);
        continue;
      }
      const markers = this.editor.getMarkers(path).filter((m) => !String(m.owner ?? "").startsWith(MARKER_OWNER_PREFIX));
      const list = markers.map((m) => ({
        severity: m.severity >= 8 ? "error" : m.severity >= 4 ? "warning" : "info",
        file: path,
        line: m.startLineNumber,
        column: m.startColumn,
        endLine: m.endLineNumber,
        endColumn: m.endColumn,
        message: String(m.message),
        source: String(m.owner || m.source || "monaco"),
        code: m.code ? String(typeof m.code === "object" ? m.code.value : m.code) : void 0
      }));
      if (list.length) this.monacoByFile.set(path, list);
      else this.monacoByFile.delete(path);
    }
    this.scheduleRender();
  }
  invalidateVolatile(path) {
    let changed = false;
    for (const [source, list] of this.bySource) {
      if (!VOLATILE_SOURCES.has(source)) continue;
      const next = list.filter((d) => d.file !== path);
      if (next.length !== list.length) {
        changed = true;
        if (next.length) this.bySource.set(source, next);
        else this.bySource.delete(source);
        this.applyMarkers(source, path);
      }
    }
    if (changed) this.scheduleRender();
  }
  handleDeleted(paths) {
    const set = new Set(paths);
    for (const p of paths) this.monacoByFile.delete(p);
    for (const [source, list] of this.bySource) {
      const next = list.filter((d) => !set.has(d.file));
      if (next.length) this.bySource.set(source, next);
      else this.bySource.delete(source);
    }
    this.scheduleRender();
  }
  handleRenamed(moves) {
    const map = new Map(moves.map((m) => [m.from, m.to]));
    for (const [from, to] of map) {
      const m = this.monacoByFile.get(from);
      if (m) {
        this.monacoByFile.delete(from);
        this.monacoByFile.set(to, m.map((d) => ({ ...d, file: to })));
      }
    }
    for (const [source, list] of this.bySource) this.bySource.set(source, list.map((d) => map.has(d.file) ? { ...d, file: map.get(d.file) } : d));
    this.scheduleRender();
  }
  applyMarkers(source, file) {
    const monaco = this.editor.monaco;
    if (!monaco || !this.editor.hasModel(file)) return;
    const list = (this.bySource.get(source) ?? []).filter((d) => d.file === file);
    const sev = monaco.MarkerSeverity;
    this.editor.setMarkers(
      MARKER_OWNER_PREFIX + source,
      file,
      list.map((d) => ({
        severity: d.severity === "error" ? sev.Error : d.severity === "warning" ? sev.Warning : sev.Info,
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.endLine ?? d.line,
        endColumn: d.endColumn ?? d.column + 1,
        source: d.source,
        code: d.code
      }))
    );
  }
  // ---------- rendering ----------
  scheduleRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }
  render() {
    const items = this.all();
    this.container.textContent = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "problems-empty";
      empty.textContent = "No problems detected in the workspace.";
      this.container.appendChild(empty);
    }
    for (const d of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "problem-row";
      row.title = `${d.file}:${d.line}:${d.column}`;
      const sev = document.createElement("span");
      sev.className = `sev ${d.severity}`;
      sev.innerHTML = d.severity === "error" ? icons.error : d.severity === "warning" ? icons.warning : icons.info;
      const msg = document.createElement("span");
      msg.className = "msg";
      msg.textContent = d.message;
      const src = document.createElement("span");
      src.className = "src";
      src.textContent = d.code ? `${d.source} (${d.code})` : d.source;
      const loc = document.createElement("span");
      loc.className = "loc";
      loc.textContent = `${d.file.replace(/^\//, "")} [${d.line}, ${d.column}]`;
      row.append(sev, msg, src, loc);
      row.addEventListener("click", () => this.emit("navigate", { file: d.file, line: d.line, column: d.column }));
      this.container.appendChild(row);
    }
    this.emit("changed", this.counts());
  }
}
export {
  DiagnosticsManager
};

import { icons } from "../core/icons.js";
import { basename, dirname, extname, resolveRelative } from "../core/paths.js";
const MESSAGE_SOURCE = "forge-preview";
const BOOTSTRAP = `(function(){
  var SRC = ${JSON.stringify(MESSAGE_SOURCE)};
  function send(msg){ try { parent.postMessage(Object.assign({ source: SRC }, msg), "*"); } catch (e) {} }
  function fmt(v){ try { if (typeof v === "string") return v; if (v instanceof Error) return v.stack || String(v); return JSON.stringify(v, null, 0); } catch (e) { return String(v); } }
  ["log","info","warn","error","debug"].forEach(function(level){
    var orig = console[level];
    console[level] = function(){ var args = Array.prototype.slice.call(arguments); send({ type: "console", level: level, text: args.map(fmt).join(" ") }); if (orig) { try { orig.apply(console, args); } catch (e) {} } };
  });
  window.addEventListener("error", function(e){ send({ type: "error", message: e.message, line: e.lineno, column: e.colno }); });
  window.addEventListener("unhandledrejection", function(e){ send({ type: "error", message: "Unhandled rejection: " + fmt(e.reason) }); });
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest("a[data-ide-nav]") : null;
    if (a) { e.preventDefault(); send({ type: "navigate", path: a.getAttribute("data-ide-nav") }); }
  }, true);
  send({ type: "loaded" });
})();`;
const TEXT_MIME = { ".svg": "image/svg+xml", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".txt": "text/plain", ".html": "text/html" };
class PreviewManager {
  constructor(root, project, ui, settings, sink) {
    this.project = project;
    this.ui = ui;
    this.settings = settings;
    this.sink = sink;
    root.classList.add("preview");
    const toolbar = document.createElement("div");
    toolbar.className = "preview-toolbar";
    this.targetLabel = document.createElement("span");
    this.targetLabel.className = "target";
    const refresh = this.button("refresh", "Refresh preview", () => this.refresh(true));
    this.autoBtn = this.button("check", "Auto Refresh (toggle)", () => settings.update({ previewAutoRefresh: !settings.get().previewAutoRefresh }));
    this.splitBtn = this.button("split", "Toggle split editor/preview", () => this.setMode(ui.get().previewMode === "split" ? "only" : "split"));
    this.fullBtn = this.button("fullscreen", "Full screen preview", () => this.toggleFullscreen());
    const close = this.button("close", "Close preview", () => this.close());
    toolbar.append(this.targetLabel, refresh, this.autoBtn, this.splitBtn, this.fullBtn, close);
    const wrap = document.createElement("div");
    wrap.className = "preview-frame-wrap";
    this.iframe = document.createElement("iframe");
    this.iframe.title = "HTML preview (sandboxed)";
    this.iframe.setAttribute("sandbox", "allow-scripts allow-modals allow-forms");
    this.iframe.setAttribute("referrerpolicy", "no-referrer");
    wrap.appendChild(this.iframe);
    root.append(toolbar, wrap);
    window.addEventListener("message", (e) => this.onMessage(e));
    const scheduleIfRelevant = () => {
      if (this.isVisible() && settings.get().previewAutoRefresh) this.scheduleRefresh();
    };
    project.on("contentChanged", scheduleIfRelevant);
    project.on("created", scheduleIfRelevant);
    project.on("deleted", ({ paths }) => {
      const file = ui.get().previewFile;
      if (file && paths.includes(file)) this.close();
      else scheduleIfRelevant();
    });
    project.on("renamed", ({ moves }) => {
      const file = ui.get().previewFile;
      const m = file ? moves.find((x) => x.from === file) : void 0;
      if (m) ui.set({ previewFile: m.to });
      scheduleIfRelevant();
    });
    settings.on("change", ({ changed }) => {
      if (changed.includes("previewAutoRefresh")) {
        this.renderToolbar();
        if (settings.get().previewAutoRefresh && this.isVisible()) this.refresh(false);
      }
    });
    ui.on("change", ({ changed }) => {
      if (changed.includes("previewMode") || changed.includes("previewFile")) this.renderToolbar();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ui.get().previewMode === "fullscreen") this.setMode(this.previousMode === "fullscreen" ? "split" : this.previousMode);
    });
    this.renderToolbar();
  }
  project;
  ui;
  settings;
  sink;
  iframe;
  targetLabel;
  autoBtn;
  fullBtn;
  splitBtn;
  refreshTimer = null;
  previousMode = "split";
  missing = /* @__PURE__ */ new Set();
  isVisible() {
    return this.ui.get().previewMode !== "hidden";
  }
  /** Open the preview for an HTML file (defaults to the active HTML file or index.html). */
  open(path, mode) {
    const target = path && this.project.getFile(path) ? path : this.defaultTarget();
    if (!target) {
      this.sink.write("warn", "No HTML file to preview. Create an index.html or open an .html file.");
      return;
    }
    const current = this.ui.get().previewMode;
    this.ui.set({ previewFile: target, previewMode: mode ?? (current === "hidden" ? "split" : current) });
    this.refresh(false);
  }
  toggle(path) {
    if (this.isVisible()) this.close();
    else this.open(path);
  }
  close() {
    this.ui.set({ previewMode: "hidden" });
    this.iframe.srcdoc = "";
  }
  setMode(mode) {
    if (mode !== "fullscreen") this.previousMode = mode;
    this.ui.set({ previewMode: mode });
    if (mode !== "hidden" && !this.iframe.srcdoc) this.refresh(false);
  }
  toggleFullscreen() {
    const mode = this.ui.get().previewMode;
    if (mode === "fullscreen") this.setMode(this.previousMode === "fullscreen" ? "split" : this.previousMode);
    else {
      this.previousMode = mode === "hidden" ? "split" : mode;
      this.setMode("fullscreen");
    }
  }
  refresh(manual) {
    const file = this.ui.get().previewFile;
    if (!file || !this.project.getFile(file)) return;
    this.missing.clear();
    let html;
    try {
      html = this.buildDocument(file);
    } catch (err) {
      this.sink.write("error", `[preview] failed to build document: ${err.message}`);
      return;
    }
    for (const m of this.missing) this.sink.write("warn", `[preview] resource not found in project: ${m}`);
    this.iframe.srcdoc = html;
    if (manual) this.sink.write("system", `[preview] refreshed ${file}`);
  }
  scheduleRefresh() {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh(false);
    }, 450);
  }
  defaultTarget() {
    const active = this.ui.get().activeFile;
    if (active && this.project.languageOf(active).id === "html") return active;
    const index = this.project.findEntry(["index.html"]);
    if (index) return index.path;
    return this.project.filesByLanguage("html")[0]?.path ?? null;
  }
  // ---------- document generation ----------
  buildDocument(path) {
    const source = this.project.readFile(path) ?? "";
    const dir = dirname(path);
    const doc = new DOMParser().parseFromString(source, "text/html");
    for (const link of Array.from(doc.querySelectorAll("link[rel~='stylesheet'][href]"))) {
      const href = link.getAttribute("href") || "";
      if (isExternal(href)) continue;
      const resolved = resolveRelative(dir, href);
      const css = this.project.readFile(resolved);
      if (css === null) {
        this.missing.add(href);
        continue;
      }
      const style = doc.createElement("style");
      style.setAttribute("data-ide-src", resolved);
      style.textContent = this.rewriteCssUrls(css, dirname(resolved));
      link.replaceWith(style);
    }
    for (const script of Array.from(doc.querySelectorAll("script[src]"))) {
      const src = script.getAttribute("src") || "";
      if (isExternal(src)) continue;
      const resolved = resolveRelative(dir, src);
      const js = this.project.readFile(resolved);
      if (js === null) {
        this.missing.add(src);
        continue;
      }
      const inline = doc.createElement("script");
      const type = script.getAttribute("type");
      if (type) inline.setAttribute("type", type);
      if (script.hasAttribute("defer") || script.hasAttribute("async")) inline.setAttribute("data-ide-deferred", "");
      inline.setAttribute("data-ide-src", resolved);
      inline.textContent = js.replace(/<\/(script)/gi, "<\\/$1");
      script.replaceWith(inline);
    }
    for (const elm of Array.from(doc.querySelectorAll("img[src], source[src], video[src], audio[src], iframe[src], object[data]"))) {
      const attr = elm.hasAttribute("data") ? "data" : "src";
      const value = elm.getAttribute(attr) || "";
      if (isExternal(value)) continue;
      const resolved = resolveRelative(dir, value);
      const content = this.project.readFile(resolved);
      if (content === null) {
        this.missing.add(value);
        continue;
      }
      if (extname(resolved) === ".html" && elm.tagName === "IFRAME") {
        elm.setAttribute("srcdoc", this.buildDocument(resolved));
        elm.removeAttribute("src");
        continue;
      }
      elm.setAttribute(attr, this.dataUrl(resolved, content));
    }
    for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") || "";
      if (isExternal(href) || href.startsWith("#")) continue;
      const resolved = resolveRelative(dir, href.split("#")[0].split("?")[0]);
      if (this.project.getFile(resolved)) {
        a.setAttribute("data-ide-nav", resolved);
        a.setAttribute("href", "#" + encodeURIComponent(resolved));
      }
    }
    for (const style of Array.from(doc.querySelectorAll("style:not([data-ide-src])"))) style.textContent = this.rewriteCssUrls(style.textContent || "", dir);
    const boot = doc.createElement("script");
    boot.textContent = BOOTSTRAP;
    const head = doc.head || doc.documentElement;
    head.insertBefore(boot, head.firstChild);
    const base = doc.createElement("base");
    base.setAttribute("target", "_self");
    head.insertBefore(base, boot.nextSibling);
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }
  rewriteCssUrls(css, dir) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, ref) => {
      if (isExternal(ref) || ref.startsWith("#")) return whole;
      const resolved = resolveRelative(dir, ref);
      const content = this.project.readFile(resolved);
      if (content === null) {
        this.missing.add(ref);
        return whole;
      }
      return `url(${quote}${this.dataUrl(resolved, content)}${quote})`;
    });
  }
  dataUrl(path, content) {
    const mime = TEXT_MIME[extname(path)] || "text/plain";
    return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  }
  // ---------- messages from the sandbox ----------
  onMessage(e) {
    if (e.source !== this.iframe.contentWindow) return;
    const data = e.data;
    if (!data || data.source !== MESSAGE_SOURCE) return;
    const file = this.ui.get().previewFile ?? "preview";
    switch (data.type) {
      case "console":
        this.sink.write(data.level === "error" ? "stderr" : data.level === "warn" ? "warn" : data.level === "info" ? "info" : "stdout", `[preview ${basename(file)}] ${String(data.text)}`);
        break;
      case "error":
        this.sink.write("error", `[preview ${basename(file)}] ${String(data.message)}${data.line ? ` (line ${data.line}${data.column ? `:${data.column}` : ""})` : ""}`);
        break;
      case "navigate": {
        const target = String(data.path || "");
        if (this.project.getFile(target)) {
          this.ui.set({ previewFile: target });
          this.refresh(false);
        }
        break;
      }
      case "loaded":
        break;
    }
  }
  // ---------- toolbar ----------
  renderToolbar() {
    const { previewFile, previewMode } = this.ui.get();
    this.targetLabel.textContent = previewFile ? previewFile.replace(/^\//, "") : "";
    const auto = this.settings.get().previewAutoRefresh;
    this.autoBtn.classList.toggle("active", auto);
    this.autoBtn.title = auto ? "Auto Refresh: on (click to disable)" : "Auto Refresh: off (click to enable)";
    this.autoBtn.setAttribute("aria-pressed", String(auto));
    this.splitBtn.classList.toggle("active", previewMode === "split");
    this.splitBtn.title = previewMode === "split" ? "Preview only (hide editor)" : "Split editor / preview";
    this.fullBtn.innerHTML = previewMode === "fullscreen" ? icons.exitFullscreen : icons.fullscreen;
    this.fullBtn.title = previewMode === "fullscreen" ? "Exit full screen (Esc)" : "Full screen preview";
  }
  button(icon, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icons[icon];
    b.addEventListener("click", onClick);
    return b;
  }
}
function isExternal(ref) {
  return /^(https?:|data:|blob:|mailto:|tel:|javascript:|\/\/|about:)/i.test(ref.trim());
}
export {
  PreviewManager
};

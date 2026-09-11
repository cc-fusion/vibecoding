import { icons } from "../core/icons";
import { basename, dirname, extname, resolveRelative } from "../core/paths";
import type { ProjectManager } from "../project/ProjectManager";
import type { OutputSink } from "../runners/types";
import type { SettingsManager } from "../state/SettingsManager";
import type { PreviewMode, UIStateManager } from "../state/UIStateManager";

const MESSAGE_SOURCE = "forge-preview";

/**
 * Script injected at the top of every previewed document. It forwards console
 * output and errors to the IDE (via postMessage) and implements project-relative
 * navigation for links that were rewritten to virtual project pages.
 */
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

const TEXT_MIME: Record<string, string> = { ".svg": "image/svg+xml", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".txt": "text/plain", ".html": "text/html" };

/**
 * Live HTML preview in a sandboxed iframe (no allow-same-origin: the document
 * runs in an opaque origin and cannot reach the IDE window or its storage).
 * Project-relative stylesheets/scripts/images are resolved from the virtual
 * filesystem and inlined into a generated srcdoc document.
 */
export class PreviewManager {
  private iframe: HTMLIFrameElement;
  private targetLabel: HTMLElement;
  private autoBtn: HTMLButtonElement;
  private fullBtn: HTMLButtonElement;
  private splitBtn: HTMLButtonElement;
  private refreshTimer: number | null = null;
  private previousMode: PreviewMode = "split";
  private missing = new Set<string>();

  constructor(root: HTMLElement, private project: ProjectManager, private ui: UIStateManager, private settings: SettingsManager, private sink: OutputSink) {
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
      const m = file ? moves.find((x) => x.from === file) : undefined;
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

  isVisible(): boolean {
    return this.ui.get().previewMode !== "hidden";
  }

  /** Open the preview for an HTML file (defaults to the active HTML file or index.html). */
  open(path?: string | null, mode?: PreviewMode): void {
    const target = path && this.project.getFile(path) ? path : this.defaultTarget();
    if (!target) {
      this.sink.write("warn", "No HTML file to preview. Create an index.html or open an .html file.");
      return;
    }
    const current = this.ui.get().previewMode;
    this.ui.set({ previewFile: target, previewMode: mode ?? (current === "hidden" ? "split" : current) });
    this.refresh(false);
  }

  toggle(path?: string | null): void {
    if (this.isVisible()) this.close();
    else this.open(path);
  }

  close(): void {
    this.ui.set({ previewMode: "hidden" });
    this.iframe.srcdoc = "";
  }

  setMode(mode: PreviewMode): void {
    if (mode !== "fullscreen") this.previousMode = mode;
    this.ui.set({ previewMode: mode });
    if (mode !== "hidden" && !this.iframe.srcdoc) this.refresh(false);
  }

  toggleFullscreen(): void {
    const mode = this.ui.get().previewMode;
    if (mode === "fullscreen") this.setMode(this.previousMode === "fullscreen" ? "split" : this.previousMode);
    else {
      this.previousMode = mode === "hidden" ? "split" : mode;
      this.setMode("fullscreen");
    }
  }

  refresh(manual: boolean): void {
    const file = this.ui.get().previewFile;
    if (!file || !this.project.getFile(file)) return;
    this.missing.clear();
    let html: string;
    try {
      html = this.buildDocument(file);
    } catch (err) {
      this.sink.write("error", `[preview] failed to build document: ${(err as Error).message}`);
      return;
    }
    for (const m of this.missing) this.sink.write("warn", `[preview] resource not found in project: ${m}`);
    this.iframe.srcdoc = html;
    if (manual) this.sink.write("system", `[preview] refreshed ${file}`);
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh(false);
    }, 450);
  }

  private defaultTarget(): string | null {
    const active = this.ui.get().activeFile;
    if (active && this.project.languageOf(active).id === "html") return active;
    const index = this.project.findEntry(["index.html"]);
    if (index) return index.path;
    return this.project.filesByLanguage("html")[0]?.path ?? null;
  }

  // ---------- document generation ----------

  private buildDocument(path: string): string {
    const source = this.project.readFile(path) ?? "";
    const dir = dirname(path);
    const doc = new DOMParser().parseFromString(source, "text/html"); // parsing only; nothing executes here

    // Stylesheets → inline <style>
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
    // Scripts → inline <script>
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
    // Media / embedded resources → data URLs for text-based project assets
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
    // Links to project pages → IDE navigation
    for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") || "";
      if (isExternal(href) || href.startsWith("#")) continue;
      const resolved = resolveRelative(dir, href.split("#")[0].split("?")[0]);
      if (this.project.getFile(resolved)) {
        a.setAttribute("data-ide-nav", resolved);
        a.setAttribute("href", "#" + encodeURIComponent(resolved));
      }
    }
    // Inline <style> url() rewriting
    for (const style of Array.from(doc.querySelectorAll("style:not([data-ide-src])"))) style.textContent = this.rewriteCssUrls(style.textContent || "", dir);
    // Bootstrap must run first
    const boot = doc.createElement("script");
    boot.textContent = BOOTSTRAP;
    const head = doc.head || doc.documentElement;
    head.insertBefore(boot, head.firstChild);
    const base = doc.createElement("base");
    base.setAttribute("target", "_self");
    head.insertBefore(base, boot.nextSibling);
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  private rewriteCssUrls(css: string, dir: string): string {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote: string, ref: string) => {
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

  private dataUrl(path: string, content: string): string {
    const mime = TEXT_MIME[extname(path)] || "text/plain";
    return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  }

  // ---------- messages from the sandbox ----------

  private onMessage(e: MessageEvent): void {
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

  private renderToolbar(): void {
    const { previewFile, previewMode } = this.ui.get();
    this.targetLabel.textContent = previewFile ? previewFile.replace(/^\//, "") : "";
    const auto = this.settings.get().previewAutoRefresh;
    this.autoBtn.classList.toggle("active", auto);
    this.autoBtn.title = auto ? "Auto Refresh: on (click to disable)" : "Auto Refresh: off (click to enable)";
    this.autoBtn.setAttribute("aria-pressed", String(auto));
    this.splitBtn.classList.toggle("active", previewMode === "split");
    this.splitBtn.title = previewMode === "split" ? "Preview only (hide editor)" : "Split editor / preview";
    this.fullBtn.innerHTML = previewMode === "fullscreen" ? icons.exitFullscreen : icons.fullscreen; // static icon
    this.fullBtn.title = previewMode === "fullscreen" ? "Exit full screen (Esc)" : "Full screen preview";
  }

  private button(icon: keyof typeof icons, title: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icons[icon]; // trusted static icon
    b.addEventListener("click", onClick);
    return b;
  }
}

function isExternal(ref: string): boolean {
  return /^(https?:|data:|blob:|mailto:|tel:|javascript:|\/\/|about:)/i.test(ref.trim());
}

import { icons } from "../core/icons.js";
import { buildMenuItems } from "./overlays.js";
class Shell {
  constructor(host, ui, settings, actions) {
    this.ui = ui;
    this.actions = actions;
    host.textContent = "";
    const root = el("div", "ide");
    const menubar = this.buildMenubar();
    const body = el("div", "ide-body");
    const activitybar = this.buildActivityBar();
    const sidebar = el("aside", "sidebar");
    const sidebarHeader = el("div", "sidebar-header");
    const sidebarBody = el("div", "sidebar-body");
    sidebar.append(sidebarHeader, sidebarBody);
    const sidebarBackdrop = el("div", "sidebar-backdrop");
    sidebarBackdrop.addEventListener("click", () => ui.set({ sidebarVisible: false }));
    const sidebarResizer = el("div", "sidebar-resizer");
    sidebarResizer.setAttribute("role", "separator");
    sidebarResizer.setAttribute("aria-orientation", "vertical");
    const main = el("div", "main");
    const workbench = el("div", "workbench");
    const editorArea = el("div", "editor-area");
    const tabs = el("div", "tabs");
    const editorContainer = el("div", "editor-container");
    const editorHost = el("div", "monaco-host");
    const editorOverlay = el("div", "editor-empty hidden");
    editorContainer.append(editorHost, editorOverlay);
    editorArea.append(tabs, editorContainer);
    const previewResizer = el("div", "preview-resizer");
    const preview = el("section", "preview");
    workbench.append(editorArea, previewResizer, preview);
    const panelResizer = el("div", "panel-resizer");
    panelResizer.setAttribute("role", "separator");
    panelResizer.setAttribute("aria-orientation", "horizontal");
    const panel = el("section", "panel");
    main.append(workbench, panelResizer, panel);
    body.append(activitybar, sidebar, sidebarResizer, main, sidebarBackdrop);
    const statusbar = el("footer", "statusbar");
    root.append(menubar, body, statusbar);
    host.appendChild(root);
    this.refs = { root, menubar, sidebarHeader, sidebarBody, tabs, editorHost, editorOverlay, preview, panel, statusbar, main };
    this.installResizer(sidebarResizer, "x", (delta, start) => ui.set({ sidebarWidth: clamp(start + delta, 160, Math.min(640, window.innerWidth * 0.6)) }), () => ui.get().sidebarWidth);
    this.installResizer(panelResizer, "y", (delta, start) => ui.set({ panelHeight: clamp(start - delta, 80, window.innerHeight * 0.8) }), () => ui.get().panelHeight);
    this.installResizer(
      previewResizer,
      "x",
      (delta, start) => {
        const width = workbench.getBoundingClientRect().width || 1;
        ui.set({ previewWidth: clamp(start - delta / width * 100, 20, 80) });
      },
      () => ui.get().previewWidth
    );
    ui.on("change", ({ state }) => this.apply(state));
    settings.on("change", ({ settings: s }) => document.documentElement.setAttribute("data-theme", s.theme));
    document.documentElement.setAttribute("data-theme", settings.get().theme);
    this.apply(ui.get());
  }
  ui;
  actions;
  refs;
  runBtn;
  buildBtn;
  stopBtn;
  previewBtn;
  runStatus;
  explorerBtn;
  settingsBtn;
  problemsBadge;
  menuHost;
  openMenu = null;
  setMenus(menus) {
    this.menuHost.textContent = "";
    for (const m of menus) {
      const wrap = el("div", "menu");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = m.label;
      btn.setAttribute("aria-haspopup", "menu");
      const dropdown = el("div", "menu-dropdown");
      dropdown.setAttribute("role", "menu");
      wrap.append(btn, dropdown);
      const open = () => {
        this.closeMenus();
        dropdown.textContent = "";
        buildMenuItems(dropdown, m.items(), () => this.closeMenus());
        wrap.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
        this.openMenu = wrap;
      };
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (wrap.classList.contains("open")) this.closeMenus();
        else open();
      });
      btn.addEventListener("mouseenter", () => {
        if (this.openMenu && this.openMenu !== wrap) open();
      });
      this.menuHost.appendChild(wrap);
    }
    document.addEventListener("pointerdown", (e) => {
      if (this.openMenu && !this.openMenu.contains(e.target)) this.closeMenus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.openMenu) this.closeMenus();
    });
  }
  closeMenus() {
    this.openMenu?.classList.remove("open");
    this.openMenu?.querySelector("button")?.setAttribute("aria-expanded", "false");
    this.openMenu = null;
  }
  setProblemsBadge(count) {
    this.problemsBadge.textContent = count > 99 ? "99+" : String(count);
    this.problemsBadge.classList.toggle("hidden", count === 0);
  }
  /** Overlay shown over the editor area: loading spinner, error, or empty state. */
  setEditorOverlay(kind, message) {
    const o = this.refs.editorOverlay;
    o.textContent = "";
    o.className = kind === "hidden" ? "hidden" : kind === "loading" ? "editor-loading" : kind === "error" ? "editor-error" : "editor-empty";
    if (kind === "loading") {
      const spinner = el("span", "spinner");
      const t = document.createElement("span");
      t.textContent = message ?? "Loading Monaco Editor\u2026";
      o.append(spinner, t);
    } else if (kind === "error") {
      o.textContent = message ?? "Editor failed to load.";
    } else if (kind === "empty") {
      const h = document.createElement("h2");
      h.textContent = "No file open";
      const p = document.createElement("p");
      p.textContent = "Select a file in the Explorer or use Quick Open.";
      const hints = el("div", "hints");
      const rows = [["Ctrl/Cmd + P", "Quick Open"], ["Ctrl/Cmd + Enter", "Run current file"], ["F5", "Run project"], ["Ctrl/Cmd + B", "Toggle sidebar"], ["Ctrl/Cmd + J", "Toggle panel"]];
      for (const [k, v] of rows) {
        const kbd = document.createElement("kbd");
        kbd.textContent = k;
        const span = document.createElement("span");
        span.textContent = v;
        hints.append(kbd, span);
      }
      o.append(h, p, hints);
    }
  }
  apply(s) {
    const root = this.refs.root;
    root.classList.toggle("sidebar-hidden", !s.sidebarVisible);
    root.classList.toggle("panel-hidden", !s.panelVisible);
    for (const m of ["hidden", "split", "only", "fullscreen"]) root.classList.toggle(`preview-${m}`, s.previewMode === m);
    root.style.setProperty("--sidebar-w", `${s.sidebarWidth}px`);
    root.style.setProperty("--panel-h", `${s.panelHeight}px`);
    root.style.setProperty("--preview-w", `${s.previewWidth}%`);
    this.explorerBtn.classList.toggle("active", s.sidebarVisible);
    this.settingsBtn.classList.toggle("active", s.settingsVisible);
    this.previewBtn.classList.toggle("active", s.previewMode !== "hidden");
    const busy = s.runState !== "idle";
    this.stopBtn.disabled = !busy;
    this.runBtn.disabled = busy;
    this.buildBtn.disabled = busy;
    this.runStatus.className = `run-status ${s.runState}`;
    this.runStatus.textContent = "";
    const dot = el("span", "dot");
    const text = document.createElement("span");
    text.textContent = s.runLabel;
    this.runStatus.append(dot, text);
    this.runStatus.title = s.runLabel;
  }
  buildMenubar() {
    const bar = el("header", "menubar");
    const brand = el("div", "brand");
    const logo = el("span", "logo");
    logo.textContent = "F";
    const name = el("span", "name");
    name.textContent = "Forge IDE";
    brand.append(logo, name);
    this.menuHost = el("div", "menus");
    this.menuHost.style.display = "flex";
    this.menuHost.style.gap = "2px";
    const spacer = el("span", "spacer");
    this.runStatus = el("div", "run-status");
    const toolbar = el("div", "toolbar");
    this.runBtn = this.tbButton("run", "Run", "Run current file (Ctrl/Cmd+Enter)", () => this.actions.run(), "primary");
    this.buildBtn = this.tbButton("build", "Build", "Build project", () => this.actions.build());
    this.stopBtn = this.tbButton("stop", "Stop", "Stop execution", () => this.actions.stop(), "danger");
    this.previewBtn = this.tbButton("preview", "Preview", "Toggle HTML preview", () => this.actions.preview());
    toolbar.append(this.runBtn, this.buildBtn, this.stopBtn, this.previewBtn);
    bar.append(brand, this.menuHost, spacer, this.runStatus, toolbar);
    return bar;
  }
  buildActivityBar() {
    const bar = el("nav", "activitybar");
    bar.setAttribute("aria-label", "Activity bar");
    this.explorerBtn = this.actButton("files", "Explorer (Ctrl/Cmd+B)", () => this.ui.toggle("sidebarVisible"));
    const search = this.actButton("search", "Quick Open (Ctrl/Cmd+P)", () => this.actions.quickOpen());
    const problems = this.actButton("error", "Problems", () => this.ui.set({ panelVisible: true, activePanelTab: "problems" }));
    this.problemsBadge = el("span", "badge hidden");
    problems.appendChild(this.problemsBadge);
    const spacer = el("span", "spacer");
    this.settingsBtn = this.actButton("settings", "Settings", () => this.actions.toggleSettings());
    bar.append(this.explorerBtn, search, problems, spacer, this.settingsBtn);
    return bar;
  }
  actButton(icon, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "act-btn";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icons[icon];
    b.addEventListener("click", onClick);
    return b;
  }
  tbButton(icon, label, title, onClick, extra = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `tb-btn ${extra}`.trim();
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML = icons[icon];
    const l = el("span", "lbl");
    l.textContent = label;
    b.appendChild(l);
    b.addEventListener("click", onClick);
    return b;
  }
  installResizer(handle, axis, onMove, getStart) {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const origin = axis === "x" ? e.clientX : e.clientY;
      const start = getStart();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("resizer-active");
      document.body.classList.add(axis === "x" ? "resizing" : "resizing-v");
      const move = (ev) => onMove((axis === "x" ? ev.clientX : ev.clientY) - origin, start);
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        handle.classList.remove("resizer-active");
        document.body.classList.remove("resizing", "resizing-v");
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }
}
function el(tag, className) {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
export {
  Shell
};

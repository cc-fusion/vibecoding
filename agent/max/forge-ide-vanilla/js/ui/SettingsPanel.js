import { icons } from "../core/icons.js";
import { DEFAULT_SETTINGS } from "../state/SettingsManager.js";
class SettingsPanel {
  constructor(host, settings, ui) {
    this.settings = settings;
    this.panel = document.createElement("aside");
    this.panel.className = "settings-panel hidden";
    this.panel.setAttribute("aria-label", "Settings");
    const header = document.createElement("header");
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = "Settings";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-btn";
    close.title = "Close settings (Esc)";
    close.innerHTML = icons.close;
    close.addEventListener("click", () => ui.set({ settingsVisible: false }));
    header.append(title, close);
    const body = document.createElement("div");
    body.className = "settings-body";
    this.panel.append(header, body);
    host.appendChild(this.panel);
    this.build(body);
    ui.on("change", ({ state, changed }) => {
      if (changed.includes("settingsVisible")) {
        this.panel.classList.toggle("hidden", !state.settingsVisible);
        if (state.settingsVisible) this.panel.querySelector("select, input, button.switch")?.focus();
      }
    });
    settings.on("change", ({ settings: s }) => this.controls.forEach((c) => c(s)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ui.get().settingsVisible && this.panel.contains(document.activeElement)) ui.set({ settingsVisible: false });
    });
  }
  settings;
  panel;
  controls = [];
  build(body) {
    const s = () => this.settings.get();
    const editor = this.group(body, "Editor");
    this.numberSetting(editor, "Font size", "Editor font size in pixels", 8, 32, () => s().fontSize, (v) => this.settings.update({ fontSize: v }));
    this.numberSetting(editor, "Tab size", "Number of spaces per indentation level", 1, 8, () => s().tabSize, (v) => this.settings.update({ tabSize: v }));
    this.selectSetting(editor, "Indent using", "Insert spaces or tab characters when indenting", [["spaces", "Spaces"], ["tabs", "Tabs"]], () => s().insertSpaces ? "spaces" : "tabs", (v) => this.settings.update({ insertSpaces: v === "spaces" }));
    this.switchSetting(editor, "Word wrap", "Wrap long lines in the editor", () => s().wordWrap, (v) => this.settings.update({ wordWrap: v }));
    this.switchSetting(editor, "Minimap", "Show the code minimap", () => s().minimap, (v) => this.settings.update({ minimap: v }));
    const appearance = this.group(body, "Appearance");
    this.selectSetting(appearance, "Theme", "Applies to the IDE and Monaco", [["dark", "Forge Dark"], ["dimmed", "Forge Dimmed (warm)"], ["light", "Forge Light"]], () => s().theme, (v) => this.settings.update({ theme: v }));
    const preview = this.group(body, "Preview");
    this.switchSetting(preview, "Auto refresh preview", "Re-render the HTML preview shortly after edits are autosaved", () => s().previewAutoRefresh, (v) => this.settings.update({ previewAutoRefresh: v }));
    const persistence = this.group(body, "Autosave");
    const alwaysOn = this.switchSetting(persistence, "Autosave", "Always on \u2014 edits persist to IndexedDB automatically", () => true, () => void 0);
    alwaysOn.disabled = true;
    alwaysOn.title = "Autosave cannot be disabled";
    this.rangeSetting(persistence, "Autosave delay", "Debounce between the last keystroke and the IndexedDB write", 150, 3e3, 50, () => s().autosaveDelayMs, (v) => this.settings.update({ autosaveDelayMs: v }), (v) => `${v} ms`);
    const note = document.createElement("div");
    note.className = "settings-note";
    note.textContent = "Settings are stored in this browser's localStorage. Project files are stored in IndexedDB. Nothing is sent to a server.";
    body.appendChild(note);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn";
    reset.style.marginTop = "14px";
    reset.textContent = "Reset to defaults";
    reset.addEventListener("click", () => this.settings.update({ ...DEFAULT_SETTINGS }));
    body.appendChild(reset);
  }
  group(body, title) {
    const g = document.createElement("section");
    g.className = "settings-group";
    const h = document.createElement("h4");
    h.textContent = title;
    g.appendChild(h);
    body.appendChild(g);
    return g;
  }
  row(group, label, desc) {
    const row = document.createElement("div");
    row.className = "setting";
    const text = document.createElement("div");
    const l = document.createElement("div");
    l.className = "lbl";
    l.textContent = label;
    const d = document.createElement("div");
    d.className = "desc";
    d.textContent = desc;
    text.append(l, d);
    row.appendChild(text);
    group.appendChild(row);
    return row;
  }
  numberSetting(group, label, desc, min, max, get, set) {
    const row = this.row(group, label, desc);
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.value = String(get());
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => {
      const v = Math.min(max, Math.max(min, Number(input.value) || min));
      input.value = String(v);
      set(v);
    });
    row.appendChild(input);
    this.controls.push(() => input.value = String(get()));
  }
  rangeSetting(group, label, desc, min, max, step, get, set, fmt) {
    const row = this.row(group, label, desc);
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(get());
    input.setAttribute("aria-label", label);
    const out = document.createElement("span");
    out.style.minWidth = "56px";
    out.style.textAlign = "right";
    out.style.color = "var(--fg-1)";
    out.textContent = fmt(get());
    input.addEventListener("input", () => out.textContent = fmt(Number(input.value)));
    input.addEventListener("change", () => set(Number(input.value)));
    wrap.append(input, out);
    row.appendChild(wrap);
    this.controls.push(() => {
      input.value = String(get());
      out.textContent = fmt(get());
    });
  }
  selectSetting(group, label, desc, options, get, set) {
    const row = this.row(group, label, desc);
    const select = document.createElement("select");
    select.setAttribute("aria-label", label);
    for (const [value, text] of options) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      select.appendChild(o);
    }
    select.value = get();
    select.addEventListener("change", () => set(select.value));
    row.appendChild(select);
    this.controls.push(() => select.value = get());
  }
  switchSetting(group, label, desc, get, set) {
    const row = this.row(group, label, desc);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "switch";
    b.setAttribute("role", "switch");
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-checked", String(get()));
    b.addEventListener("click", () => {
      if (b.disabled) return;
      set(!get());
    });
    row.appendChild(b);
    this.controls.push(() => b.setAttribute("aria-checked", String(get())));
    return b;
  }
}
export {
  SettingsPanel
};

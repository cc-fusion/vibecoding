import { icons } from "../core/icons.js";
import { LANGUAGES } from "../core/languages.js";
import { showPicker } from "./overlays.js";
class StatusBar {
  constructor(root, actions) {
    this.actions = actions;
    root.classList.add("statusbar");
    this.runItem = this.item("button", "Run state");
    this.runItem.addEventListener("click", () => actions.showRunOutput());
    this.saveItem = this.item("span", "Autosave state");
    this.problemsItem = this.item("button", "Problems");
    this.problemsItem.addEventListener("click", () => actions.openProblems());
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    this.cursorItem = this.item("span", "Cursor position");
    this.indentItem = this.item("button", "Indentation");
    this.indentItem.addEventListener("click", () => this.pickIndent());
    this.encodingItem = this.item("span", "Encoding");
    this.encodingItem.textContent = "UTF-8";
    this.encodingItem.classList.add("optional");
    this.languageItem = this.item("button", "Language mode");
    this.languageItem.addEventListener("click", () => this.pickLanguage());
    root.append(this.runItem, this.saveItem, this.problemsItem, spacer, this.cursorItem, this.indentItem, this.encodingItem, this.languageItem);
    this.setRun("idle", "Ready");
    this.setAutosave("saved");
    this.setProblems(0, 0);
    this.setCursor(1, 1);
    this.setIndent(2, true);
    this.setLanguage(null, null);
  }
  actions;
  runItem;
  saveItem;
  problemsItem;
  cursorItem;
  indentItem;
  encodingItem;
  languageItem;
  currentIndent = { tabSize: 2, insertSpaces: true };
  setRun(state, label) {
    this.runItem.className = `sb-item ${state}`;
    this.runItem.textContent = "";
    const dot = document.createElement("span");
    dot.innerHTML = state === "idle" ? icons.check : icons.play;
    dot.style.display = "inline-flex";
    const text = document.createElement("span");
    text.textContent = label;
    this.runItem.append(dot, text);
  }
  setAutosave(state, message) {
    const labels = { editing: "Autosave pending\u2026", saving: "Saving\u2026", saved: "Saved", error: "Save Error" };
    this.saveItem.className = `sb-item ${state === "editing" ? "saving" : state}`;
    this.saveItem.textContent = labels[state];
    this.saveItem.title = state === "error" ? message || "Autosave failed" : "All edits are persisted automatically to IndexedDB";
  }
  setProblems(errors, warnings) {
    this.problemsItem.textContent = "";
    const e = document.createElement("span");
    e.className = "problems-err";
    e.textContent = `\u2715 ${errors}`;
    const w = document.createElement("span");
    w.className = "problems-warn";
    w.textContent = `\u26A0 ${warnings}`;
    this.problemsItem.append(e, w);
    this.problemsItem.title = `${errors} error(s), ${warnings} warning(s) \u2014 click to open Problems`;
  }
  setCursor(line, column) {
    this.cursorItem.textContent = `Ln ${line}, Col ${column}`;
  }
  setIndent(tabSize, insertSpaces) {
    this.currentIndent = { tabSize, insertSpaces };
    this.indentItem.textContent = insertSpaces ? `Spaces: ${tabSize}` : `Tab Size: ${tabSize}`;
    this.indentItem.title = "Change indentation";
  }
  setLanguage(lang, path) {
    this.languageItem.textContent = lang ? lang.label : "\u2014";
    this.languageItem.title = path ? `Language mode for ${path} (click to change)` : "No file open";
    this.languageItem.disabled = !path;
  }
  pickLanguage() {
    const current = this.languageItem.textContent;
    showPicker(
      this.languageItem,
      [{ label: "Auto Detect (by extension)", value: null }, ...LANGUAGES.map((l) => ({ label: l.label, value: l.id, active: l.label === current }))],
      (v) => this.actions.setLanguage(v)
    );
  }
  pickIndent() {
    const { tabSize, insertSpaces } = this.currentIndent;
    const items = [];
    for (const n of [2, 4, 8]) items.push({ label: `Indent Using Spaces: ${n}`, value: [n, true], active: insertSpaces && tabSize === n });
    for (const n of [2, 4, 8]) items.push({ label: `Indent Using Tabs (size ${n})`, value: [n, false], active: !insertSpaces && tabSize === n });
    showPicker(this.indentItem, items, ([n, spaces]) => this.actions.setIndentation(n, spaces));
  }
  item(tag, label) {
    const e = document.createElement(tag);
    e.className = "sb-item";
    e.setAttribute("aria-label", label);
    if (tag === "button") e.type = "button";
    return e;
  }
}
export {
  StatusBar
};

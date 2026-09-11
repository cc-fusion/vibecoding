import { icons } from "../core/icons";
import { LANGUAGES, type LanguageInfo } from "../core/languages";
import type { SaveState } from "../project/PersistenceManager";
import type { RunState } from "../state/UIStateManager";
import { showPicker } from "./overlays";

export interface StatusBarActions {
  openProblems(): void;
  setLanguage(languageId: string | null): void;
  setIndentation(tabSize: number, insertSpaces: boolean): void;
  showRunOutput(): void;
}

export class StatusBar {
  private runItem: HTMLElement;
  private saveItem: HTMLElement;
  private problemsItem: HTMLButtonElement;
  private cursorItem: HTMLElement;
  private indentItem: HTMLButtonElement;
  private encodingItem: HTMLElement;
  private languageItem: HTMLButtonElement;
  private currentIndent = { tabSize: 2, insertSpaces: true };

  constructor(root: HTMLElement, private actions: StatusBarActions) {
    root.classList.add("statusbar");
    this.runItem = this.item("button", "Run state") as HTMLButtonElement;
    this.runItem.addEventListener("click", () => actions.showRunOutput());
    this.saveItem = this.item("span", "Autosave state");
    this.problemsItem = this.item("button", "Problems") as HTMLButtonElement;
    this.problemsItem.addEventListener("click", () => actions.openProblems());
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    this.cursorItem = this.item("span", "Cursor position");
    this.indentItem = this.item("button", "Indentation") as HTMLButtonElement;
    this.indentItem.addEventListener("click", () => this.pickIndent());
    this.encodingItem = this.item("span", "Encoding");
    this.encodingItem.textContent = "UTF-8";
    this.encodingItem.classList.add("optional");
    this.languageItem = this.item("button", "Language mode") as HTMLButtonElement;
    this.languageItem.addEventListener("click", () => this.pickLanguage());
    root.append(this.runItem, this.saveItem, this.problemsItem, spacer, this.cursorItem, this.indentItem, this.encodingItem, this.languageItem);
    this.setRun("idle", "Ready");
    this.setAutosave("saved");
    this.setProblems(0, 0);
    this.setCursor(1, 1);
    this.setIndent(2, true);
    this.setLanguage(null, null);
  }

  setRun(state: RunState, label: string): void {
    this.runItem.className = `sb-item ${state}`;
    this.runItem.textContent = "";
    const dot = document.createElement("span");
    dot.innerHTML = state === "idle" ? icons.check : icons.play; // static icon
    dot.style.display = "inline-flex";
    const text = document.createElement("span");
    text.textContent = label;
    this.runItem.append(dot, text);
  }

  setAutosave(state: SaveState, message?: string): void {
    const labels: Record<SaveState, string> = { editing: "Autosave pending…", saving: "Saving…", saved: "Saved", error: "Save Error" };
    this.saveItem.className = `sb-item ${state === "editing" ? "saving" : state}`;
    this.saveItem.textContent = labels[state];
    this.saveItem.title = state === "error" ? message || "Autosave failed" : "All edits are persisted automatically to IndexedDB";
  }

  setProblems(errors: number, warnings: number): void {
    this.problemsItem.textContent = "";
    const e = document.createElement("span");
    e.className = "problems-err";
    e.textContent = `✕ ${errors}`;
    const w = document.createElement("span");
    w.className = "problems-warn";
    w.textContent = `⚠ ${warnings}`;
    this.problemsItem.append(e, w);
    this.problemsItem.title = `${errors} error(s), ${warnings} warning(s) — click to open Problems`;
  }

  setCursor(line: number, column: number): void {
    this.cursorItem.textContent = `Ln ${line}, Col ${column}`;
  }

  setIndent(tabSize: number, insertSpaces: boolean): void {
    this.currentIndent = { tabSize, insertSpaces };
    this.indentItem.textContent = insertSpaces ? `Spaces: ${tabSize}` : `Tab Size: ${tabSize}`;
    this.indentItem.title = "Change indentation";
  }

  setLanguage(lang: LanguageInfo | null, path: string | null): void {
    this.languageItem.textContent = lang ? lang.label : "—";
    this.languageItem.title = path ? `Language mode for ${path} (click to change)` : "No file open";
    this.languageItem.disabled = !path;
  }

  private pickLanguage(): void {
    const current = this.languageItem.textContent;
    showPicker(
      this.languageItem,
      [{ label: "Auto Detect (by extension)", value: null as string | null }, ...LANGUAGES.map((l) => ({ label: l.label, value: l.id as string | null, active: l.label === current }))],
      (v) => this.actions.setLanguage(v)
    );
  }

  private pickIndent(): void {
    const { tabSize, insertSpaces } = this.currentIndent;
    const items = [] as Array<{ label: string; value: [number, boolean]; active?: boolean }>;
    for (const n of [2, 4, 8]) items.push({ label: `Indent Using Spaces: ${n}`, value: [n, true], active: insertSpaces && tabSize === n });
    for (const n of [2, 4, 8]) items.push({ label: `Indent Using Tabs (size ${n})`, value: [n, false], active: !insertSpaces && tabSize === n });
    showPicker(this.indentItem, items, ([n, spaces]) => this.actions.setIndentation(n, spaces));
  }

  private item(tag: "span" | "button", label: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = "sb-item";
    e.setAttribute("aria-label", label);
    if (tag === "button") (e as HTMLButtonElement).type = "button";
    return e;
  }
}

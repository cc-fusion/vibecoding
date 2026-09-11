import { EventEmitter } from "../core/EventEmitter";
import { languageById } from "../core/languages";
import type { ProjectManager } from "../project/ProjectManager";
import type { Settings, SettingsManager, ThemeId } from "../state/SettingsManager";
import { loadMonaco, type ICodeEditor, type IEditorViewState, type ITextModel, type Monaco } from "./monacoLoader";

export interface EditorEvents extends Record<string, unknown> {
  cursor: { line: number; column: number };
  markersChanged: { paths: string[] };
  ready: Record<string, never>;
}

const THEME_IDS: Record<ThemeId, string> = { dark: "forge-dark", dimmed: "forge-dimmed", light: "forge-light" };

/**
 * Owns the Monaco editor instance and exactly one ITextModel per project file.
 * Models are created lazily, kept alive while the file exists (preserving undo
 * history, cursor, selection and scroll via saved view states), and disposed
 * only when the file is removed.
 */
export class EditorManager extends EventEmitter<EditorEvents> {
  monaco: Monaco = null;
  editor: ICodeEditor = null;
  private models = new Map<string, ITextModel>();
  private viewStates = new Map<string, IEditorViewState>();
  private currentPath: string | null = null;
  private disposers: Array<() => void> = [];

  constructor(private project: ProjectManager, private settings: SettingsManager) {
    super();
    // Subscribe now (before TabManager & co. are constructed) so model bookkeeping
    // for renames/deletes runs before the UI reacts to the same event.
    this.disposers.push(
      this.project.on("contentChanged", ({ path, content, origin }) => {
        if (origin === "editor" || !this.monaco) return;
        const model = this.models.get(path);
        if (model && model.getValue() !== content) {
          // Replace via an edit operation so undo history stays intact.
          model.pushEditOperations([], [{ range: model.getFullModelRange(), text: content }], () => null);
        }
      }),
      this.project.on("languageChanged", ({ path }) => {
        const model = this.models.get(path);
        if (model && this.monaco) this.monaco.editor.setModelLanguage(model, this.project.languageOf(path).monacoId);
      }),
      this.project.on("renamed", ({ moves }) => {
        if (!this.monaco) return;
        for (const m of moves) if (m.type === "file") this.handleRename(m.from, m.to);
      }),
      this.project.on("deleted", ({ paths }) => {
        for (const p of paths) this.disposeModel(p);
      }),
      this.settings.on("change", ({ settings }) => this.applySettings(settings))
    );
  }

  get activePath(): string | null {
    return this.currentPath;
  }

  async init(host: HTMLElement): Promise<void> {
    const monaco = await loadMonaco();
    this.monaco = monaco;
    this.defineThemes();
    await this.registerAssemblyScriptLanguage();
    this.configureTypeScript();

    const s = this.settings.get();
    this.editor = monaco.editor.create(host, {
      model: null,
      theme: THEME_IDS[s.theme],
      fontSize: s.fontSize,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, monospace',
      fontLigatures: true,
      minimap: { enabled: s.minimap },
      wordWrap: s.wordWrap ? "on" : "off",
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      folding: true,
      lineNumbers: "on",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      tabSize: s.tabSize,
      insertSpaces: s.insertSpaces,
      detectIndentation: false,
      padding: { top: 8 },
      fixedOverflowWidgets: true,
      multiCursorModifier: "alt",
      suggest: { showWords: true },
      quickSuggestions: true,
      formatOnPaste: false,
    });

    this.editor.onDidChangeCursorPosition((e: any) => {
      this.emit("cursor", { line: e.position.lineNumber, column: e.position.column });
    });
    monaco.editor.onDidChangeMarkers((uris: any[]) => {
      this.emit("markersChanged", { paths: uris.map((u) => this.pathFromUri(u)) });
    });

    this.emit("ready", {});
  }

  // ---------- models ----------

  uriFor(path: string): any {
    return this.monaco.Uri.file(path);
  }
  pathFromUri(uri: any): string {
    return uri.path as string;
  }

  ensureModel(path: string): ITextModel | null {
    const existing = this.models.get(path);
    if (existing && !existing.isDisposed()) return existing;
    const file = this.project.getFile(path);
    if (!file) return null;
    const monaco = this.monaco;
    const uri = this.uriFor(path);
    let model = monaco.editor.getModel(uri);
    if (model) {
      model.setValue(file.content);
    } else {
      model = monaco.editor.createModel(file.content, this.project.languageOf(path).monacoId, uri);
    }
    const s = this.settings.get();
    model.updateOptions({ tabSize: s.tabSize, insertSpaces: s.insertSpaces });
    model.onDidChangeContent(() => {
      if (model.isDisposed()) return;
      this.project.updateContent(path, model.getValue(), "editor");
    });
    this.models.set(path, model);
    return model;
  }

  getModel(path: string): ITextModel | undefined {
    return this.models.get(path);
  }

  hasModel(path: string): boolean {
    return this.models.has(path);
  }

  /** Make sure every project file of a language has a synced model (multi-file compilation). */
  ensureModelsForLanguage(languageId: string): ITextModel[] {
    return this.project
      .filesByLanguage(languageId)
      .map((f) => this.ensureModel(f.path))
      .filter((m): m is ITextModel => !!m);
  }

  showFile(path: string | null): void {
    if (!this.editor) return;
    if (this.currentPath && this.editor.getModel()) {
      this.viewStates.set(this.currentPath, this.editor.saveViewState());
    }
    if (!path) {
      this.editor.setModel(null);
      this.currentPath = null;
      return;
    }
    const model = this.ensureModel(path);
    if (!model) {
      this.editor.setModel(null);
      this.currentPath = null;
      return;
    }
    if (this.editor.getModel() !== model) this.editor.setModel(model);
    this.currentPath = path;
    const vs = this.viewStates.get(path);
    if (vs) this.editor.restoreViewState(vs);
    const pos = this.editor.getPosition();
    if (pos) this.emit("cursor", { line: pos.lineNumber, column: pos.column });
  }

  disposeModel(path: string): void {
    const model = this.models.get(path);
    if (model) {
      if (this.editor && this.editor.getModel() === model) {
        this.editor.setModel(null);
        this.currentPath = null;
      }
      model.dispose();
    }
    this.models.delete(path);
    this.viewStates.delete(path);
  }

  private handleRename(from: string, to: string): void {
    const old = this.models.get(from);
    if (!old) return;
    const existing = this.models.get(to);
    if (existing && !existing.isDisposed()) {
      // A model for the destination already exists; just retire the old one.
      if (this.editor?.getModel() === old) this.editor.setModel(existing);
      old.dispose();
      this.models.delete(from);
      this.viewStates.delete(from);
      return;
    }
    // Monaco URIs are immutable: recreate the model under the new URI and carry
    // over the view state (undo history cannot be transferred across URIs).
    const wasActive = this.editor?.getModel() === old;
    const viewState = wasActive ? this.editor.saveViewState() : this.viewStates.get(from);
    const content = old.getValue();
    if (wasActive) this.editor.setModel(null);
    old.dispose();
    this.models.delete(from);
    this.viewStates.delete(from);
    const fresh = this.monaco.editor.createModel(content, this.project.languageOf(to).monacoId, this.uriFor(to));
    const s = this.settings.get();
    fresh.updateOptions({ tabSize: s.tabSize, insertSpaces: s.insertSpaces });
    fresh.onDidChangeContent(() => {
      if (fresh.isDisposed()) return;
      this.project.updateContent(to, fresh.getValue(), "editor");
    });
    this.models.set(to, fresh);
    if (viewState) this.viewStates.set(to, viewState);
    if (wasActive) {
      this.editor.setModel(fresh);
      if (viewState) this.editor.restoreViewState(viewState);
      this.currentPath = to;
    }
  }

  // ---------- editor operations ----------

  revealPosition(line: number, column: number): void {
    if (!this.editor) return;
    const pos = { lineNumber: Math.max(1, line), column: Math.max(1, column) };
    this.editor.setPosition(pos);
    this.editor.revealPositionInCenter(pos, 0);
    this.editor.focus();
  }

  focus(): void {
    this.editor?.focus();
  }

  runAction(actionId: string): void {
    const action = this.editor?.getAction(actionId);
    if (action) void action.run();
  }

  addCommand(keybinding: number, handler: () => void): void {
    this.editor?.addCommand(keybinding, handler);
  }

  layout(): void {
    this.editor?.layout();
  }

  getIndentation(): { tabSize: number; insertSpaces: boolean } {
    const model = this.editor?.getModel();
    if (model) {
      const o = model.getOptions();
      return { tabSize: o.tabSize, insertSpaces: o.insertSpaces };
    }
    const s = this.settings.get();
    return { tabSize: s.tabSize, insertSpaces: s.insertSpaces };
  }

  applySettings(s: Settings): void {
    if (!this.editor) return;
    this.editor.updateOptions({ fontSize: s.fontSize, wordWrap: s.wordWrap ? "on" : "off", minimap: { enabled: s.minimap } });
    this.monaco.editor.setTheme(THEME_IDS[s.theme]);
    for (const model of this.models.values()) model.updateOptions({ tabSize: s.tabSize, insertSpaces: s.insertSpaces });
  }

  /** Markers for a file (Monaco's own language services: TS/JS/JSON/CSS/HTML). */
  getMarkers(path: string): any[] {
    if (!this.monaco) return [];
    return this.monaco.editor.getModelMarkers({ resource: this.uriFor(path) });
  }

  setMarkers(owner: string, path: string, markers: any[]): void {
    const model = this.models.get(path);
    if (model) this.monaco.editor.setModelMarkers(model, owner, markers);
  }

  dispose(): void {
    for (const d of this.disposers) d();
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.editor?.dispose();
  }

  // ---------- setup ----------

  private defineThemes(): void {
    const m = this.monaco;
    m.editor.defineTheme("forge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "comment", foreground: "6a7385", fontStyle: "italic" }],
      colors: {
        "editor.background": "#0f1115",
        "editor.lineHighlightBackground": "#161a21",
        "editorLineNumber.foreground": "#414957",
        "editorLineNumber.activeForeground": "#aeb4c0",
        "editorGutter.background": "#0f1115",
        "editorIndentGuide.background1": "#232833",
        "editorIndentGuide.activeBackground1": "#3a4150",
        "editorWidget.background": "#1b1f27",
        "editorWidget.border": "#343b48",
        "editorSuggestWidget.background": "#1b1f27",
        "editorSuggestWidget.selectedBackground": "#2b3547",
        "minimap.background": "#0f1115",
        "scrollbarSlider.background": "#3a415066",
        "editor.selectionBackground": "#2c4f86",
        "focusBorder": "#5b9cff",
      },
    });
    m.editor.defineTheme("forge-dimmed", {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "comment", foreground: "7d8594", fontStyle: "italic" }],
      colors: {
        "editor.background": "#1c1f26",
        "editor.lineHighlightBackground": "#22262e",
        "editorLineNumber.foreground": "#4f5766",
        "editorGutter.background": "#1c1f26",
        "editorWidget.background": "#282d36",
        "minimap.background": "#1c1f26",
        "editor.selectionBackground": "#4a3f2c",
        "focusBorder": "#e0a458",
      },
    });
    m.editor.defineTheme("forge-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#fbfbfd",
        "editor.lineHighlightBackground": "#f0f2f6",
        "editorLineNumber.foreground": "#a0a7b4",
        "editorGutter.background": "#fbfbfd",
        "minimap.background": "#fbfbfd",
        "focusBorder": "#2a6ee8",
      },
    });
  }

  /**
   * AssemblyScript is a TypeScript-like syntax with a different type system.
   * It gets its own Monaco language id (reusing the TypeScript Monarch grammar
   * for highlighting) so Monaco's TypeScript checker does not report false
   * errors for `i32`, `u8`, etc. Real diagnostics come from the asc compiler.
   */
  private async registerAssemblyScriptLanguage(): Promise<void> {
    const m = this.monaco;
    const lang = languageById("assemblyscript");
    m.languages.register({ id: lang.monacoId, extensions: [".as.ts"], aliases: ["AssemblyScript", "assemblyscript"] });
    try {
      const tsDef = m.languages.getLanguages().find((l: any) => l.id === "typescript");
      if (tsDef && typeof tsDef.loader === "function") {
        const mod = await tsDef.loader();
        if (mod?.language) m.languages.setMonarchTokensProvider(lang.monacoId, mod.language);
        if (mod?.conf) m.languages.setLanguageConfiguration(lang.monacoId, mod.conf);
      }
    } catch (err) {
      console.warn("[EditorManager] Could not reuse TypeScript grammar for AssemblyScript", err);
    }
    m.languages.registerCompletionItemProvider(lang.monacoId, {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const kinds = m.languages.CompletionItemKind;
        const types = ["i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64", "bool", "isize", "usize", "void", "string", "StaticArray", "Array", "Map", "Set"];
        const kw = ["export", "function", "let", "const", "return", "if", "else", "for", "while", "class", "new", "this", "unchecked", "changetype", "load", "store", "memory", "assert", "console"];
        return {
          suggestions: [
            ...types.map((t) => ({ label: t, kind: kinds.TypeParameter, insertText: t, range })),
            ...kw.map((k) => ({ label: k, kind: kinds.Keyword, insertText: k, range })),
          ],
        };
      },
    });
  }

  private configureTypeScript(): void {
    const ts = this.monaco.languages.typescript;
    if (!ts) return;
    ts.typescriptDefaults.setCompilerOptions({
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      esModuleInterop: true,
      strict: true,
      noEmitOnError: false,
      sourceMap: false,
      allowJs: true,
    });
    ts.typescriptDefaults.setEagerModelSync(true);
    ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
    ts.javascriptDefaults.setCompilerOptions({ target: ts.ScriptTarget.ES2020, allowNonTsExtensions: true, allowJs: true, checkJs: false, module: ts.ModuleKind.CommonJS });
    ts.javascriptDefaults.setEagerModelSync(true);
  }
}

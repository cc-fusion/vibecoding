import { EventEmitter } from "../core/EventEmitter.js";
import { languageById } from "../core/languages.js";
import { loadMonaco } from "./monacoLoader.js";
const THEME_IDS = { dark: "forge-dark", dimmed: "forge-dimmed", light: "forge-light" };
class EditorManager extends EventEmitter {
  constructor(project, settings) {
    super();
    this.project = project;
    this.settings = settings;
    this.disposers.push(
      this.project.on("contentChanged", ({ path, content, origin }) => {
        if (origin === "editor" || !this.monaco) return;
        const model = this.models.get(path);
        if (model && model.getValue() !== content) {
          model.pushEditOperations([], [{ range: model.getFullModelRange(), text: content }], () => null);
        }
      }),
      this.project.on("created", ({ nodes }) => {
        if (!this.monaco) return;
        for (const node of nodes) {
          if (node.type === "file" && this.project.languageOf(node.path).id === "typescript") this.ensureModel(node.path);
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
      this.settings.on("change", ({ settings: settings2 }) => this.applySettings(settings2))
    );
  }
  project;
  settings;
  monaco = null;
  editor = null;
  models = /* @__PURE__ */ new Map();
  viewStates = /* @__PURE__ */ new Map();
  currentPath = null;
  disposers = [];
  get activePath() {
    return this.currentPath;
  }
  async init(host) {
    const monaco = await loadMonaco();
    this.monaco = monaco;
    this.defineThemes();
    await this.registerAssemblyScriptLanguage();
    this.configureTypeScript();
    // Make imported project modules visible before the first diagnostic pass.
    this.ensureModelsForLanguage("typescript");
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
      formatOnPaste: false
    });
    this.editor.onDidChangeCursorPosition((e) => {
      this.emit("cursor", { line: e.position.lineNumber, column: e.position.column });
    });
    monaco.editor.onDidChangeMarkers((uris) => {
      this.emit("markersChanged", { paths: uris.map((u) => this.pathFromUri(u)) });
    });
    this.emit("ready", {});
  }
  // ---------- models ----------
  uriFor(path) {
    return this.monaco.Uri.file(path);
  }
  pathFromUri(uri) {
    return uri.path;
  }
  ensureModel(path) {
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
  getModel(path) {
    return this.models.get(path);
  }
  hasModel(path) {
    return this.models.has(path);
  }
  /** Make sure every project file of a language has a synced model (multi-file compilation). */
  ensureModelsForLanguage(languageId) {
    return this.project.filesByLanguage(languageId).map((f) => this.ensureModel(f.path)).filter((m) => !!m);
  }
  showFile(path) {
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
  disposeModel(path) {
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
  handleRename(from, to) {
    const old = this.models.get(from);
    if (!old) return;
    const existing = this.models.get(to);
    if (existing && !existing.isDisposed()) {
      if (this.editor?.getModel() === old) this.editor.setModel(existing);
      old.dispose();
      this.models.delete(from);
      this.viewStates.delete(from);
      return;
    }
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
  revealPosition(line, column) {
    if (!this.editor) return;
    const pos = { lineNumber: Math.max(1, line), column: Math.max(1, column) };
    this.editor.setPosition(pos);
    this.editor.revealPositionInCenter(pos, 0);
    this.editor.focus();
  }
  focus() {
    this.editor?.focus();
  }
  runAction(actionId) {
    const action = this.editor?.getAction(actionId);
    if (action) void action.run();
  }
  addCommand(keybinding, handler) {
    this.editor?.addCommand(keybinding, handler);
  }
  layout() {
    this.editor?.layout();
  }
  getIndentation() {
    const model = this.editor?.getModel();
    if (model) {
      const o = model.getOptions();
      return { tabSize: o.tabSize, insertSpaces: o.insertSpaces };
    }
    const s = this.settings.get();
    return { tabSize: s.tabSize, insertSpaces: s.insertSpaces };
  }
  applySettings(s) {
    if (!this.editor) return;
    this.editor.updateOptions({ fontSize: s.fontSize, wordWrap: s.wordWrap ? "on" : "off", minimap: { enabled: s.minimap } });
    this.monaco.editor.setTheme(THEME_IDS[s.theme]);
    for (const model of this.models.values()) model.updateOptions({ tabSize: s.tabSize, insertSpaces: s.insertSpaces });
  }
  /** Markers for a file (Monaco's own language services: TS/JS/JSON/CSS/HTML). */
  getMarkers(path) {
    if (!this.monaco) return [];
    return this.monaco.editor.getModelMarkers({ resource: this.uriFor(path) });
  }
  setMarkers(owner, path, markers) {
    const model = this.models.get(path);
    if (model) this.monaco.editor.setModelMarkers(model, owner, markers);
  }
  dispose() {
    for (const d of this.disposers) d();
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.editor?.dispose();
  }
  // ---------- setup ----------
  defineThemes() {
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
        "focusBorder": "#5b9cff"
      }
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
        "focusBorder": "#e0a458"
      }
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
        "focusBorder": "#2a6ee8"
      }
    });
  }
  /**
   * AssemblyScript is a TypeScript-like syntax with a different type system.
   * It gets its own Monaco language id (reusing the TypeScript Monarch grammar
   * for highlighting) so Monaco's TypeScript checker does not report false
   * errors for `i32`, `u8`, etc. Real diagnostics come from the asc compiler.
   */
  async registerAssemblyScriptLanguage() {
    const m = this.monaco;
    const lang = languageById("assemblyscript");
    m.languages.register({ id: lang.monacoId, extensions: [".as.ts"], aliases: ["AssemblyScript", "assemblyscript"] });
    try {
      const tsDef = m.languages.getLanguages().find((l) => l.id === "typescript");
      if (tsDef && typeof tsDef.loader === "function") {
        const mod = await tsDef.loader();
        if (mod?.language) m.languages.setMonarchTokensProvider(lang.monacoId, mod.language);
        if (mod?.conf) m.languages.setLanguageConfiguration(lang.monacoId, mod.conf);
      }
    } catch (err) {
      console.warn("[EditorManager] Could not reuse TypeScript grammar for AssemblyScript", err);
    }
    m.languages.registerCompletionItemProvider(lang.monacoId, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const kinds = m.languages.CompletionItemKind;
        const types = ["i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64", "bool", "isize", "usize", "void", "string", "StaticArray", "Array", "Map", "Set"];
        const kw = ["export", "function", "let", "const", "return", "if", "else", "for", "while", "class", "new", "this", "unchecked", "changetype", "load", "store", "memory", "assert", "console"];
        return {
          suggestions: [
            ...types.map((t) => ({ label: t, kind: kinds.TypeParameter, insertText: t, range })),
            ...kw.map((k) => ({ label: k, kind: kinds.Keyword, insertText: k, range }))
          ]
        };
      }
    });
  }
  configureTypeScript() {
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
      allowJs: true
    });
    ts.typescriptDefaults.setEagerModelSync(true);
    ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
    ts.javascriptDefaults.setCompilerOptions({ target: ts.ScriptTarget.ES2020, allowNonTsExtensions: true, allowJs: true, checkJs: false, module: ts.ModuleKind.CommonJS });
    ts.javascriptDefaults.setEagerModelSync(true);
  }
}
export {
  EditorManager
};

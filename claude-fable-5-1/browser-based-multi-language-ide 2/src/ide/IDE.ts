import { LANGUAGES } from "./core/languages";
import { ROOT, normalizePath } from "./core/paths";
import { EditorManager } from "./editor/EditorManager";
import { TabManager } from "./editor/TabManager";
import { DiagnosticsManager } from "./output/DiagnosticsManager";
import { OutputManager } from "./output/OutputManager";
import { PreviewManager } from "./preview/PreviewManager";
import { PersistenceManager } from "./project/PersistenceManager";
import { ProjectManager } from "./project/ProjectManager";
import { DEFAULT_OPEN_FILE, createDefaultProject } from "./project/defaultProject";
import { AssemblyScriptRunner } from "./runners/AssemblyScriptRunner";
import { CSharpRunner, ClangRunner, JavaRunner, ToolchainRegistry, registerBuiltinToolchains } from "./runners/BrowserToolchainRunners";
import { JavaScriptRunner } from "./runners/JavaScriptRunner";
import { PythonRunner } from "./runners/PythonRunner";
import { RunnerManager } from "./runners/RunnerManager";
import { TypeScriptCompiler } from "./runners/TypeScriptCompiler";
import { TypeScriptRunner } from "./runners/TypeScriptRunner";
import { SettingsManager } from "./state/SettingsManager";
import { UIStateManager } from "./state/UIStateManager";
import { Explorer } from "./ui/Explorer";
import { QuickOpen } from "./ui/QuickOpen";
import { SettingsPanel } from "./ui/SettingsPanel";
import { Shell } from "./ui/Shell";
import { installShortcuts } from "./ui/Shortcuts";
import { StatusBar } from "./ui/StatusBar";
import { Toasts, confirmDialog, type MenuItem } from "./ui/overlays";

/**
 * Composition root. Creates every manager, wires their events, and owns the
 * startup sequence: persistence → project → UI → Monaco → runners.
 */
export class IDE {
  private settings = new SettingsManager();
  private ui = new UIStateManager();
  private project = new ProjectManager();
  private persistence = new PersistenceManager();
  private toasts = new Toasts();
  private shell!: Shell;
  private output!: OutputManager;
  private editor!: EditorManager;
  private tabs!: TabManager;
  private explorer!: Explorer;
  private preview!: PreviewManager;
  private diagnostics!: DiagnosticsManager;
  private runner!: RunnerManager;
  private statusBar!: StatusBar;
  private quickOpen!: QuickOpen;
  private disposers: Array<() => void> = [];
  private lastSaveErrorToast = 0;
  private editorReady = false;

  constructor(private host: HTMLElement) {}

  async start(): Promise<void> {
    const { settings, ui, project, persistence } = this;

    this.shell = new Shell(this.host, ui, settings, {
      run: () => void this.runFile(),
      build: () => void this.buildProject(),
      stop: () => this.runner.stop(),
      preview: () => this.preview.toggle(ui.get().activeFile),
      quickOpen: () => this.quickOpen.open(),
      toggleSettings: () => ui.toggle("settingsVisible"),
    });
    this.shell.setEditorOverlay("loading", "Loading Monaco Editor…");

    this.output = new OutputManager(this.shell.refs.panel, ui);
    this.statusBar = new StatusBar(this.shell.refs.statusbar, {
      openProblems: () => this.output.show("problems"),
      showRunOutput: () => this.output.show("output"),
      setLanguage: (id) => {
        const active = ui.get().activeFile;
        if (active) project.setLanguage(active, id);
      },
      setIndentation: (tabSize, insertSpaces) => settings.update({ tabSize, insertSpaces }),
    });
    this.editor = new EditorManager(project, settings);
    this.tabs = new TabManager(this.shell.refs.tabs, ui, project, persistence);
    this.diagnostics = new DiagnosticsManager(this.output.problemsContainer, this.editor, project);
    this.preview = new PreviewManager(this.shell.refs.preview, project, ui, settings, this.output.sink);
    this.explorer = new Explorer(this.shell.refs.sidebarHeader, this.shell.refs.sidebarBody, project, ui, {
      open: (p) => this.openFile(p),
      requestDelete: (p) => this.requestDelete(p),
      onError: (m) => this.toasts.show(m, "error"),
      runFile: (p) => void this.runFile(p),
      preview: (p) => this.preview.open(p),
    });
    this.quickOpen = new QuickOpen(project, (p) => this.openFile(p));
    new SettingsPanel(this.shell.refs.main, settings, ui);

    this.runner = new RunnerManager(project, {
      sink: this.output.sink,
      reportDiagnostics: (source, d) => this.diagnostics.set(source, d),
      getActiveFile: () => ui.get().activeFile,
      beforeRun: () => persistence.flush(),
    });
    const js = new JavaScriptRunner();
    this.runner.register(js);
    this.runner.register(new TypeScriptRunner(new TypeScriptCompiler(this.editor), js));
    this.runner.register(new PythonRunner());
    this.runner.register(new AssemblyScriptRunner());
    registerBuiltinToolchains();
    this.runner.register(new ClangRunner());
    this.runner.register(new CSharpRunner());
    this.runner.register(new JavaRunner());

    this.shell.setMenus(this.buildMenus());
    this.wire();

    // ---- persistence + project ----
    await persistence.open();
    let records: Awaited<ReturnType<PersistenceManager["loadNodes"]>> = [];
    let firstLaunch = false;
    try {
      records = await persistence.loadNodes();
    } catch (err) {
      this.output.sink.write("error", `Failed to read the project from IndexedDB: ${(err as Error).message}`);
    }
    if (!records.length) {
      firstLaunch = true;
      records = createDefaultProject();
      if (persistence.isAvailable) {
        try {
          await persistence.writeAll(records);
        } catch (err) {
          this.output.sink.write("error", `Failed to persist the example project: ${(err as Error).message}`);
        }
      }
    }
    project.load(records);
    persistence.attach(project, () => settings.get().autosaveDelayMs);
    if (!persistence.isAvailable) {
      const msg = "Browser storage (IndexedDB) is unavailable: edits will be lost on reload.";
      this.output.sink.write("error", msg);
      this.toasts.show(msg, "error", 10000);
    }
    this.tabs.prune();
    if (firstLaunch || !ui.get().openTabs.length) {
      if (project.getFile(DEFAULT_OPEN_FILE)) this.tabs.open(DEFAULT_OPEN_FILE);
      ui.set({ expandedDirs: ["/lib", "/assembly", "/data"] });
    }
    this.explorer.revealActive();
    if (this.preview.isVisible()) {
      if (ui.get().previewFile && project.getFile(ui.get().previewFile!)) this.preview.refresh(false);
      else this.preview.close();
    }

    // ---- Monaco ----
    try {
      await this.editor.init(this.shell.refs.editorHost);
      this.editorReady = true;
      this.installEditorCommands();
      this.syncEditorToState();
    } catch (err) {
      const message = (err as Error).message || String(err);
      this.shell.setEditorOverlay("error", `Monaco Editor failed to load.\n\n${message}\n\nThe project explorer and persistence still work; reload the page once the CDN is reachable.`);
      this.output.sink.write("error", `Monaco Editor failed to load: ${message}`);
      this.toasts.show("Monaco Editor failed to load — see Output.", "error", 10000);
    }

    this.disposers.push(
      installShortcuts({
        quickOpen: () => this.quickOpen.open(),
        toggleSidebar: () => ui.toggle("sidebarVisible"),
        togglePanel: () => ui.toggle("panelVisible"),
        runFile: () => void this.runFile(),
        runProject: () => void this.runProject(),
        find: () => this.editorAction("actions.find"),
        replace: () => this.editorAction("editor.action.startFindReplaceAction"),
        editorHasFocus: () => !!this.editor.editor?.hasTextFocus(),
      })
    );

    this.output.sink.write("system", "Forge IDE ready — everything runs locally in this browser tab.");
    this.output.sink.write("system", "Runtimes: JavaScript/TypeScript, Python, AssemblyScript, C/C++ and C# use isolated Web Workers; Java and HTML use sandboxed iframes.");
    this.output.sink.write("system", `Lazy browser toolchains: ${ToolchainRegistry.list().join(", ")}. First use downloads pinned runtime assets; later runs reuse the warm runtime.`);
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.runner?.dispose();
    this.editor?.dispose();
    this.persistence.dispose();
  }

  // ---------- wiring ----------

  private wire(): void {
    const { ui, settings, project, persistence } = this;

    ui.on("change", ({ changed, state }) => {
      if (changed.includes("activeFile")) this.syncEditorToState();
      if (changed.some((k) => ["sidebarVisible", "panelVisible", "previewMode", "sidebarWidth", "panelHeight", "previewWidth"].includes(k))) requestAnimationFrame(() => this.editor.layout());
      if (changed.includes("runState")) this.statusBar.setRun(state.runState, state.runLabel);
      else if (changed.includes("runLabel")) this.statusBar.setRun(state.runState, state.runLabel);
    });

    persistence.on("stateChange", ({ state, message }) => {
      this.statusBar.setAutosave(state, message);
      if (state === "error") {
        const now = Date.now();
        if (now - this.lastSaveErrorToast > 8000) {
          this.lastSaveErrorToast = now;
          this.toasts.show(message ?? "Autosave failed", "error", 8000);
          this.output.sink.write("error", message ?? "Autosave failed");
        }
      }
    });
    persistence.on("unavailable", ({ message }) => this.toasts.show(message, "error", 10000));

    this.runner.on("stateChange", ({ state, label }) => ui.set({ runState: state, runLabel: label }));
    this.runner.on("previewRequested", ({ path }) => this.preview.open(path));
    this.output.on("status", ({ text }) => {
      if (ui.get().runState !== "idle") ui.set({ runLabel: text });
    });
    this.output.on("command", ({ command }) => void this.handleCommand(command));

    this.diagnostics.on("navigate", ({ file, line, column }) => {
      this.openFile(file);
      this.editor.revealPosition(line, column);
    });
    this.diagnostics.on("changed", ({ errors, warnings }) => {
      this.output.setProblemCount(errors, warnings);
      this.statusBar.setProblems(errors, warnings);
      this.shell.setProblemsBadge(errors + warnings);
    });

    this.editor.on("cursor", ({ line, column }) => this.statusBar.setCursor(line, column));
    project.on("languageChanged", ({ path }) => {
      if (path === ui.get().activeFile) this.statusBar.setLanguage(project.languageOf(path), path);
    });
    settings.on("change", () => {
      const { tabSize, insertSpaces } = this.editor.getIndentation();
      this.statusBar.setIndent(tabSize, insertSpaces);
    });
  }

  private syncEditorToState(): void {
    const active = this.ui.get().activeFile;
    if (this.editorReady) {
      this.editor.showFile(active);
      this.shell.setEditorOverlay(active ? "hidden" : "empty");
    }
    this.statusBar.setLanguage(active ? this.project.languageOf(active) : null, active);
    const { tabSize, insertSpaces } = this.editor.getIndentation();
    this.statusBar.setIndent(tabSize, insertSpaces);
  }

  private installEditorCommands(): void {
    const m = this.editor.monaco;
    const mod = m.KeyMod.CtrlCmd;
    this.editor.addCommand(mod | m.KeyCode.KeyP, () => this.quickOpen.open());
    this.editor.addCommand(mod | m.KeyCode.KeyB, () => this.ui.toggle("sidebarVisible"));
    this.editor.addCommand(mod | m.KeyCode.KeyJ, () => this.ui.toggle("panelVisible"));
    this.editor.addCommand(mod | m.KeyCode.Enter, () => void this.runFile());
    this.editor.addCommand(m.KeyCode.F5, () => void this.runProject());
  }

  private editorAction(id: string): void {
    if (!this.editorReady || !this.ui.get().activeFile) return;
    this.editor.focus();
    this.editor.runAction(id);
  }

  // ---------- high-level actions ----------

  openFile(path: string): void {
    if (!this.project.getFile(path)) return;
    this.tabs.open(path);
    if (window.innerWidth < 900 && this.ui.get().sidebarVisible) this.ui.set({ sidebarVisible: false });
    if (this.editorReady) this.editor.focus();
  }

  async runFile(path: string | null = this.ui.get().activeFile): Promise<void> {
    if (path && this.project.languageOf(path).id !== "html") this.output.show("output");
    await this.runner.runFile(path);
  }

  async runProject(): Promise<void> {
    this.output.show("output");
    await this.runner.runProject();
  }

  async buildProject(): Promise<void> {
    this.output.show("build");
    await this.runner.buildProject();
  }

  private async requestDelete(path: string): Promise<void> {
    const node = this.project.get(path);
    if (!node) return;
    const count = node.type === "dir" ? this.project.allNodes().filter((n) => n.path.startsWith(path + "/")).length : 0;
    const ok = await confirmDialog({
      title: node.type === "dir" ? "Delete folder" : "Delete file",
      message: node.type === "dir" ? `Delete "${path}" and its ${count} item(s)? This removes them from browser storage and cannot be undone.` : `Delete "${path}"? This removes it from browser storage and cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await this.persistence.flush();
    this.project.delete(path);
    this.toasts.show(`Deleted ${path}`, "info", 2500);
  }

  private async resetProject(): Promise<void> {
    const ok = await confirmDialog({ title: "Reset example project", message: "This deletes every file in the project and restores the example files. Continue?", confirmLabel: "Reset", danger: true });
    if (!ok) return;
    await this.persistence.flush();
    this.tabs.closeAll();
    for (const child of this.project.children(ROOT)) this.project.delete(child.path);
    for (const r of createDefaultProject()) {
      if (r.type === "dir") {
        if (!this.project.exists(r.path)) this.project.createFolder(r.path);
      } else this.project.createFile(r.path, r.content ?? "", r.language ?? null);
    }
    this.ui.set({ expandedDirs: ["/lib", "/assembly", "/data"], previewMode: "hidden" });
    this.tabs.open(DEFAULT_OPEN_FILE);
    this.toasts.show("Example project restored", "success");
  }

  // ---------- menus ----------

  private buildMenus(): Array<{ label: string; items: () => MenuItem[] }> {
    const ui = this.ui;
    return [
      {
        label: "File",
        items: () => [
          { label: "New File…", onSelect: () => this.explorer.startCreate("file") },
          { label: "New Folder…", onSelect: () => this.explorer.startCreate("folder") },
          { separator: true },
          { label: "Quick Open…", shortcut: "Ctrl/Cmd+P", onSelect: () => this.quickOpen.open() },
          { separator: true },
          { label: "Close Tab", disabled: !ui.get().activeFile, onSelect: () => ui.get().activeFile && this.tabs.close(ui.get().activeFile!) },
          { label: "Close All Tabs", disabled: !ui.get().openTabs.length, onSelect: () => this.tabs.closeAll() },
          { separator: true },
          { label: "Reset Example Project…", danger: true, onSelect: () => void this.resetProject() },
        ],
      },
      {
        label: "View",
        items: () => [
          { label: "Sidebar", shortcut: "Ctrl/Cmd+B", checked: ui.get().sidebarVisible, onSelect: () => ui.toggle("sidebarVisible") },
          { label: "Bottom Panel", shortcut: "Ctrl/Cmd+J", checked: ui.get().panelVisible, onSelect: () => ui.toggle("panelVisible") },
          { separator: true },
          { label: "Output", onSelect: () => this.output.show("output") },
          { label: "Terminal (IDE console)", onSelect: () => (this.output.show("terminal"), this.output.focusTerminal()) },
          { label: "Problems", onSelect: () => this.output.show("problems") },
          { label: "Build", onSelect: () => this.output.show("build") },
          { separator: true },
          { label: "Preview", checked: ui.get().previewMode !== "hidden", onSelect: () => this.preview.toggle(ui.get().activeFile) },
          { label: "Split Editor / Preview", checked: ui.get().previewMode === "split", onSelect: () => (ui.get().previewMode === "hidden" ? this.preview.open(ui.get().activeFile, "split") : this.preview.setMode(ui.get().previewMode === "split" ? "only" : "split")) },
          { label: "Full Screen Preview", disabled: ui.get().previewMode === "hidden", onSelect: () => this.preview.toggleFullscreen() },
          { separator: true },
          { label: "Settings", checked: ui.get().settingsVisible, onSelect: () => ui.toggle("settingsVisible") },
        ],
      },
      {
        label: "Run",
        items: () => [
          { label: "Run Current File", shortcut: "Ctrl/Cmd+Enter", disabled: ui.get().runState !== "idle", onSelect: () => void this.runFile() },
          { label: "Run Project", shortcut: "F5", disabled: ui.get().runState !== "idle", onSelect: () => void this.runProject() },
          { label: "Build Project", disabled: ui.get().runState !== "idle", onSelect: () => void this.buildProject() },
          { label: "Stop", disabled: ui.get().runState === "idle", danger: true, onSelect: () => this.runner.stop() },
          { separator: true },
          { label: "Preview HTML", onSelect: () => this.preview.open(ui.get().activeFile) },
        ],
      },
      {
        label: "Help",
        items: () => [
          { label: "Keyboard Shortcuts", onSelect: () => void confirmDialog({ title: "Keyboard shortcuts", message: "Ctrl/Cmd+P Quick Open · Ctrl/Cmd+F Find · Ctrl/Cmd+H Replace · Ctrl/Cmd+B Sidebar · Ctrl/Cmd+J Panel · Ctrl/Cmd+Enter Run file · F5 Run project · F2 Rename (explorer) · Esc Close overlays. Files autosave — there is no Save command.", confirmLabel: "OK" }) },
          { label: "About Forge IDE", onSelect: () => void confirmDialog({ title: "Forge IDE", message: "A browser-only IDE. Files live in IndexedDB; JavaScript, TypeScript, Python, AssemblyScript, C, C++ and C# run in Web Workers, while Java and HTML run in sandboxed iframes. Compilers and runtimes are loaded as pinned static assets, and project source is never submitted to a compilation service.", confirmLabel: "OK" }) },
        ],
      },
    ];
  }

  // ---------- IDE command console ----------

  private async handleCommand(command: string): Promise<void> {
    const out = (kind: "stdout" | "stderr" | "info" | "system", text: string) => this.output.append("terminal", kind, text);
    const [name, ...rest] = command.split(/\s+/);
    const arg = rest.join(" ");
    const resolve = (p: string) => normalizePath(p.startsWith("/") ? p : "/" + p);
    switch (name.toLowerCase()) {
      case "help":
        out("info", "IDE console commands (this is an IDE command interface, not a system shell):");
        out("stdout", "  help                 show this list\n  ls [dir]             list project files\n  cat <file>           print a file\n  open <file>          open a file in the editor\n  new <file>           create (and open) a file\n  mkdir <dir>          create a folder\n  run [file]           run a file (default: active file)\n  build                build the project\n  stop                 stop execution\n  preview [file]       open the HTML preview\n  languages            list language runners\n  echo <text>          print text\n  clear                clear this console");
        break;
      case "ls": {
        const dir = arg ? resolve(arg) : ROOT;
        if (!this.project.isDir(dir)) return out("stderr", `ls: not a directory: ${dir}`);
        const children = this.project.children(dir);
        out("stdout", children.length ? children.map((c) => (c.type === "dir" ? c.name + "/" : c.name)).join("\n") : "(empty)");
        break;
      }
      case "cat": {
        if (!arg) return out("stderr", "cat: missing file");
        const content = this.project.readFile(resolve(arg));
        if (content === null) return out("stderr", `cat: no such file: ${resolve(arg)}`);
        const lines = content.split("\n");
        out("stdout", lines.slice(0, 400).join("\n") + (lines.length > 400 ? `\n… (${lines.length - 400} more lines)` : ""));
        break;
      }
      case "open":
        if (!arg || !this.project.getFile(resolve(arg))) return out("stderr", `open: no such file: ${arg}`);
        this.openFile(resolve(arg));
        break;
      case "new":
        if (!arg) return out("stderr", "new: missing file name");
        try {
          this.project.createFile(resolve(arg), "");
          this.openFile(resolve(arg));
          out("system", `created ${resolve(arg)}`);
        } catch (err) {
          out("stderr", `new: ${(err as Error).message}`);
        }
        break;
      case "mkdir":
        if (!arg) return out("stderr", "mkdir: missing folder name");
        try {
          this.project.createFolder(resolve(arg));
          out("system", `created ${resolve(arg)}/`);
        } catch (err) {
          out("stderr", `mkdir: ${(err as Error).message}`);
        }
        break;
      case "run":
        await this.runner.runFile(arg ? resolve(arg) : this.ui.get().activeFile);
        break;
      case "build":
        await this.runner.buildProject();
        break;
      case "stop":
        this.runner.stop();
        break;
      case "preview":
        this.preview.open(arg ? resolve(arg) : this.ui.get().activeFile);
        break;
      case "languages":
        for (const l of LANGUAGES) {
          const r = this.runner.runnerFor(l.id);
          out("stdout", `${l.label.padEnd(15)} ${r ? r.label : l.runnable ? "(no runner)" : "editing only"}`);
        }
        break;
      case "echo":
        out("stdout", arg);
        break;
      case "clear":
        this.output.clear("terminal");
        break;
      default:
        out("stderr", `Unknown command: ${name}. Type \`help\`.`);
    }
  }
}

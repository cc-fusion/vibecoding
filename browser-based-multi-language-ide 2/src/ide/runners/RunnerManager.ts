import { EventEmitter } from "../core/EventEmitter";
import { LANGUAGES, languageById } from "../core/languages";
import type { ProjectManager } from "../project/ProjectManager";
import type { RunState } from "../state/UIStateManager";
import { formatDuration } from "./WorkerHost";
import type { Diagnostic, LanguageRunner, OutputSink, RunContext, RunResult } from "./types";

export interface RunnerEvents extends Record<string, unknown> {
  stateChange: { state: RunState; label: string };
  previewRequested: { path: string };
  finished: { result: RunResult; path: string | null; mode: "run" | "build" };
}

export interface RunnerHost {
  sink: OutputSink;
  reportDiagnostics(source: string, diagnostics: Diagnostic[]): void;
  getActiveFile(): string | null;
  /** Called before any execution so pending autosaves are durable. */
  beforeRun(): Promise<void>;
}

/**
 * Selects a browser-side adapter for a file/project and tracks execution state.
 * Only one execution is active at a time; Stop terminates its Worker(s).
 */
export class RunnerManager extends EventEmitter<RunnerEvents> {
  private runners: LanguageRunner[] = [];
  private active: LanguageRunner | null = null;
  private busy = false;
  private state: RunState = "idle";

  constructor(private project: ProjectManager, private host: RunnerHost) {
    super();
  }

  register(runner: LanguageRunner): void {
    this.runners.push(runner);
  }

  runnerFor(languageId: string): LanguageRunner | undefined {
    return this.runners.find((r) => r.languages.includes(languageId));
  }

  get isBusy(): boolean {
    return this.busy;
  }

  async runFile(path: string | null = this.host.getActiveFile()): Promise<void> {
    if (!path) {
      this.host.sink.write("warn", "No file selected. Open a file and press Run.");
      return;
    }
    const file = this.project.getFile(path);
    if (!file) return;
    const lang = this.project.languageOf(path);
    if (lang.id === "html") {
      this.emit("previewRequested", { path });
      return;
    }
    if (!lang.runnable) {
      this.host.sink.write("warn", `${lang.label} files (${path}) are not executable. Run a JavaScript, TypeScript, Python, AssemblyScript, HTML, C/C++, C#, or Java file.`);
      return;
    }
    const runner = this.runnerFor(lang.id);
    if (!runner) {
      this.host.sink.write("error", `No browser runner is registered for ${lang.label}.`);
      return;
    }
    await this.execute(runner, "run", path, (ctx) => runner.run(path, ctx));
  }

  async runProject(): Promise<void> {
    const entry = this.resolveProjectEntry();
    if (!entry) {
      this.host.sink.write("warn", "Could not determine a project entry point (index.html, main.ts, main.js, main.py, assembly/index.ts, …).");
      return;
    }
    await this.runFile(entry);
  }

  async buildProject(): Promise<void> {
    const buildable = LANGUAGES.filter((l) => l.buildable);
    const targets: Array<{ runner: LanguageRunner; entries: string[]; label: string }> = [];
    for (const lang of buildable) {
      const files = this.project.filesByLanguage(lang.id);
      if (!files.length) continue;
      const runner = this.runnerFor(lang.id);
      if (!runner?.build) continue;
      if (targets.some((t) => t.runner === runner)) {
        targets.find((t) => t.runner === runner)!.entries.push(...this.entriesFor(lang.id, files.map((f) => f.path)));
        continue;
      }
      targets.push({ runner, entries: this.entriesFor(lang.id, files.map((f) => f.path)), label: lang.label });
    }
    if (!targets.length) {
      this.host.sink.build("warn", "Nothing to build: the project has no TypeScript, AssemblyScript, C/C++, C#, or Java files.");
      return;
    }
    await this.execute(null, "build", null, async (ctx) => {
      const startedAt = performance.now();
      let failed = 0;
      let unavailable = 0;
      for (const t of targets) {
        this.active = t.runner;
        ctx.sink.build("system", `── ${t.label}: ${t.runner.label} ──`);
        const r = await t.runner.build!(t.entries, ctx);
        if (r.status === "failed") failed++;
        if (r.status === "unavailable") unavailable++;
        if (r.status === "stopped") return r;
      }
      const ok = failed === 0 && unavailable === 0;
      const summary = `${targets.length} target(s): ${targets.length - failed - unavailable} succeeded, ${failed} failed, ${unavailable} toolchain(s) unavailable`;
      return { status: ok ? "completed" : "failed", exitCode: ok ? 0 : 1, durationMs: performance.now() - startedAt, summary };
    });
  }

  stop(): void {
    if (!this.busy) return;
    const runner = this.active;
    this.host.sink.write("warn", "Stop requested — terminating execution worker(s).");
    if (runner) runner.stop();
    else for (const r of this.runners) r.stop();
  }

  dispose(): void {
    for (const r of this.runners) r.dispose();
  }

  // ---------- internals ----------

  private async execute(runner: LanguageRunner | null, mode: "run" | "build", path: string | null, body: (ctx: RunContext) => Promise<RunResult>): Promise<void> {
    if (this.busy) {
      this.stop();
      await new Promise((r) => setTimeout(r, 50));
    }
    this.busy = true;
    this.active = runner;
    await this.host.beforeRun();
    this.setState(mode === "build" ? "building" : "running", mode === "build" ? "Building project" : `Running ${path}`);
    const sink = this.host.sink;
    const ctx: RunContext = { project: this.project, sink, reportDiagnostics: (source, d) => this.host.reportDiagnostics(source, d) };
    const label = mode === "build" ? "Build project" : `Run ${path}`;
    sink.write("system", `${label} — ${new Date().toLocaleTimeString()}`);
    if (mode === "build") sink.build("system", `Build started — ${new Date().toLocaleTimeString()}`);
    let result: RunResult;
    try {
      result = await body(ctx);
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      sink.write("error", `Runner failure: ${message}`);
      result = { status: "failed", exitCode: null, durationMs: 0, summary: message };
    }
    if (mode === "build") {
      const kind = result.status === "completed" ? "success" : result.status === "stopped" ? "warn" : "error";
      sink.build(kind, `Build ${result.status} in ${formatDuration(result.durationMs)}${result.summary ? ` — ${result.summary}` : ""}`);
      sink.write(kind, `Build ${result.status}${result.summary ? ` — ${result.summary}` : ""}`);
    } else if (result.status === "stopped") {
      sink.write("warn", `Stopped after ${formatDuration(result.durationMs)}`);
    }
    this.busy = false;
    this.active = null;
    const finalLabel = result.status === "completed" ? `${mode === "build" ? "Build" : "Run"} finished (${formatDuration(result.durationMs)})` : result.status === "stopped" ? "Stopped" : result.status === "unavailable" ? "Toolchain not installed" : `${mode === "build" ? "Build" : "Run"} failed`;
    this.setState("idle", finalLabel);
    this.emit("finished", { result, path, mode });
  }

  private setState(state: RunState, label: string): void {
    this.state = state;
    this.emit("stateChange", { state, label });
  }

  get currentState(): RunState {
    return this.state;
  }

  private entriesFor(languageId: string, paths: string[]): string[] {
    const lang = languageById(languageId);
    if (languageId === "assemblyscript") {
      const entry = this.project.findEntry(lang.entryCandidates ?? []);
      return entry ? [entry.path] : [paths[0]];
    }
    const entry = this.project.findEntry(lang.entryCandidates ?? []);
    return entry ? [entry.path] : paths.slice(0, 1);
  }

  private resolveProjectEntry(): string | null {
    const html = this.project.getFile("/index.html");
    if (html) return html.path;
    const active = this.host.getActiveFile();
    const order = [...LANGUAGES];
    if (active) {
      const activeLang = this.project.languageOf(active);
      order.sort((a, b) => (a.id === activeLang.id ? -1 : b.id === activeLang.id ? 1 : 0));
      if (activeLang.runnable && !(activeLang.entryCandidates ?? []).length) return active;
    }
    for (const lang of order) {
      if (!lang.runnable || !lang.entryCandidates) continue;
      const entry = this.project.findEntry(lang.entryCandidates);
      if (entry) return entry.path;
    }
    if (active && this.project.languageOf(active).runnable) return active;
    return null;
  }
}

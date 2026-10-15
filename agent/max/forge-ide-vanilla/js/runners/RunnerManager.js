import { EventEmitter } from "../core/EventEmitter.js";
import { LANGUAGES, languageById } from "../core/languages.js";
import { formatDuration } from "./WorkerHost.js";
class RunnerManager extends EventEmitter {
  constructor(project, host) {
    super();
    this.project = project;
    this.host = host;
  }
  project;
  host;
  runners = [];
  active = null;
  busy = false;
  state = "idle";
  register(runner) {
    this.runners.push(runner);
  }
  runnerFor(languageId) {
    return this.runners.find((r) => r.languages.includes(languageId));
  }
  get isBusy() {
    return this.busy;
  }
  async runFile(path = this.host.getActiveFile()) {
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
  async runProject() {
    const entry = this.resolveProjectEntry();
    if (!entry) {
      this.host.sink.write("warn", "Could not determine a project entry point (index.html, main.ts, main.js, main.py, assembly/index.ts, \u2026).");
      return;
    }
    await this.runFile(entry);
  }
  async buildProject() {
    const buildable = LANGUAGES.filter((l) => l.buildable);
    const targets = [];
    for (const lang of buildable) {
      const files = this.project.filesByLanguage(lang.id);
      if (!files.length) continue;
      const runner = this.runnerFor(lang.id);
      if (!runner?.build) continue;
      if (targets.some((t) => t.runner === runner)) {
        targets.find((t) => t.runner === runner).entries.push(...this.entriesFor(lang.id, files.map((f) => f.path)));
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
        ctx.sink.build("system", `\u2500\u2500 ${t.label}: ${t.runner.label} \u2500\u2500`);
        const r = await t.runner.build(t.entries, ctx);
        if (r.status === "failed") failed++;
        if (r.status === "unavailable") unavailable++;
        if (r.status === "stopped") return r;
      }
      const ok = failed === 0 && unavailable === 0;
      const summary = `${targets.length} target(s): ${targets.length - failed - unavailable} succeeded, ${failed} failed, ${unavailable} toolchain(s) unavailable`;
      return { status: ok ? "completed" : "failed", exitCode: ok ? 0 : 1, durationMs: performance.now() - startedAt, summary };
    });
  }
  stop() {
    if (!this.busy) return;
    const runner = this.active;
    this.host.sink.write("warn", "Stop requested \u2014 terminating execution worker(s).");
    if (runner) runner.stop();
    else for (const r of this.runners) r.stop();
  }
  dispose() {
    for (const r of this.runners) r.dispose();
  }
  // ---------- internals ----------
  async execute(runner, mode, path, body) {
    if (this.busy) {
      this.stop();
      await new Promise((r) => setTimeout(r, 50));
    }
    this.busy = true;
    this.active = runner;
    await this.host.beforeRun();
    this.setState(mode === "build" ? "building" : "running", mode === "build" ? "Building project" : `Running ${path}`);
    const sink = this.host.sink;
    const ctx = { project: this.project, sink, reportDiagnostics: (source, d) => this.host.reportDiagnostics(source, d) };
    const label = mode === "build" ? "Build project" : `Run ${path}`;
    sink.write("system", `${label} \u2014 ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
    if (mode === "build") sink.build("system", `Build started \u2014 ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
    let result;
    try {
      result = await body(ctx);
    } catch (err) {
      const message = err?.message || String(err);
      sink.write("error", `Runner failure: ${message}`);
      result = { status: "failed", exitCode: null, durationMs: 0, summary: message };
    }
    if (mode === "build") {
      const kind = result.status === "completed" ? "success" : result.status === "stopped" ? "warn" : "error";
      sink.build(kind, `Build ${result.status} in ${formatDuration(result.durationMs)}${result.summary ? ` \u2014 ${result.summary}` : ""}`);
      sink.write(kind, `Build ${result.status}${result.summary ? ` \u2014 ${result.summary}` : ""}`);
    } else if (result.status === "stopped") {
      sink.write("warn", `Stopped after ${formatDuration(result.durationMs)}`);
    }
    this.busy = false;
    this.active = null;
    const finalLabel = result.status === "completed" ? `${mode === "build" ? "Build" : "Run"} finished (${formatDuration(result.durationMs)})` : result.status === "stopped" ? "Stopped" : result.status === "unavailable" ? "Toolchain not installed" : `${mode === "build" ? "Build" : "Run"} failed`;
    this.setState("idle", finalLabel);
    this.emit("finished", { result, path, mode });
  }
  setState(state, label) {
    this.state = state;
    this.emit("stateChange", { state, label });
  }
  get currentState() {
    return this.state;
  }
  entriesFor(languageId, paths) {
    const lang = languageById(languageId);
    if (languageId === "assemblyscript") {
      const entry2 = this.project.findEntry(lang.entryCandidates ?? []);
      return entry2 ? [entry2.path] : [paths[0]];
    }
    const entry = this.project.findEntry(lang.entryCandidates ?? []);
    return entry ? [entry.path] : paths.slice(0, 1);
  }
  resolveProjectEntry() {
    const html = this.project.getFile("/index.html");
    if (html) return html.path;
    const active = this.host.getActiveFile();
    const order = [...LANGUAGES];
    if (active) {
      const activeLang = this.project.languageOf(active);
      order.sort((a, b) => a.id === activeLang.id ? -1 : b.id === activeLang.id ? 1 : 0);
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
export {
  RunnerManager
};

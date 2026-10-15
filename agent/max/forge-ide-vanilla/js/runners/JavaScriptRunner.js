import { WorkerSession, formatDuration } from "./WorkerHost.js";
import { stoppedResult } from "./types.js";
const workerSource = await fetch(new URL("../workers/jsRunner.worker.js", import.meta.url)).then(response => { if (!response.ok) throw new Error('Worker source failed to load: ' + response.status); return response.text(); });
const FUNCTION_CTOR_LINE_OFFSET = 2;
class JavaScriptRunner {
  id = "javascript";
  label = "JavaScript (Web Worker)";
  languages = ["javascript"];
  canBuild = false;
  session = null;
  stopCurrent = null;
  async run(path, ctx) {
    const modules = {};
    for (const f of ctx.project.filesByLanguage("javascript")) modules[f.path] = f.content;
    for (const f of ctx.project.filesByLanguage("json")) modules[f.path] = f.content;
    if (!(path in modules)) modules[path] = ctx.project.readFile(path) ?? "";
    return this.execute(modules, path, ctx);
  }
  /** Shared execution path (also used by the TypeScript runner for emitted JS). */
  execute(modules, entry, ctx, options = {}) {
    this.stop();
    const startedAt = performance.now();
    const label = options.languageLabel ?? "JavaScript";
    ctx.sink.status(`Running ${entry}`);
    ctx.sink.write("system", `Starting ${label} worker for ${options.sourceMap?.[entry] ?? entry}`);
    return new Promise((resolve) => {
      let session;
      try {
        session = new WorkerSession(workerSource, "classic");
      } catch (err) {
        ctx.sink.write("error", `Could not create execution worker: ${err.message}`);
        resolve({ status: "failed", exitCode: null, durationMs: 0 });
        return;
      }
      this.session = session;
      const runtimeDiagnostics = [];
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        session.terminate();
        if (this.session === session) this.session = null;
        this.stopCurrent = null;
        ctx.reportDiagnostics("runtime", runtimeDiagnostics);
        resolve(result);
      };
      this.stopCurrent = () => finish(stoppedResult(startedAt));
      session.onError((e) => {
        ctx.sink.write("error", `Worker error: ${e.message || "unknown"}`);
        finish({ status: "failed", exitCode: 1, durationMs: performance.now() - startedAt });
      });
      session.onMessage((msg) => {
        switch (msg.type) {
          case "ready":
            session.post({ type: "run", modules, entry });
            break;
          case "console":
            ctx.sink.write(msg.level === "warn" ? "warn" : msg.level === "error" ? "stderr" : msg.level === "info" ? "info" : "stdout", String(msg.text));
            break;
          case "result":
            ctx.sink.write("info", `\u2192 ${msg.text}`);
            break;
          case "error": {
            const stack = String(msg.stack || "");
            const location = this.locate(stack, modules, options.sourceMap);
            ctx.sink.write("error", String(msg.message) + (location ? `
    at ${location.file}:${location.line}:${location.column}` : ""));
            if (location) runtimeDiagnostics.push({ severity: "error", file: location.file, line: location.line, column: location.column, message: String(msg.message), source: "runtime" });
            break;
          }
          case "done": {
            const code = Number(msg.exitCode ?? 0);
            const duration = performance.now() - startedAt;
            ctx.sink.write(code === 0 ? "success" : "error", `Process finished with exit code ${code} in ${formatDuration(duration)}`);
            finish({ status: code === 0 ? "completed" : "failed", exitCode: code, durationMs: duration });
            break;
          }
        }
      });
    });
  }
  stop() {
    if (this.stopCurrent) this.stopCurrent();
    else if (this.session) {
      this.session.terminate();
      this.session = null;
    }
  }
  dispose() {
    this.stop();
  }
  locate(stack, modules, sourceMap) {
    if (!stack) return null;
    const re = /(\/[^\s():]+):(\d+):(\d+)/g;
    let m;
    while (m = re.exec(stack)) {
      const p = m[1];
      if (p in modules) {
        const line = Math.max(1, Number(m[2]) - FUNCTION_CTOR_LINE_OFFSET);
        return { file: sourceMap?.[p] ?? p, line, column: Math.max(1, Number(m[3])) };
      }
    }
    return null;
  }
}
export {
  JavaScriptRunner
};

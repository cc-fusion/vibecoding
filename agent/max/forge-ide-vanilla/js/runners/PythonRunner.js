import { WorkerSession, formatDuration } from "./WorkerHost.js";
import { stoppedResult } from "./types.js";
const workerSource = await fetch(new URL("../workers/python.worker.js", import.meta.url)).then(response => { if (!response.ok) throw new Error('Worker source failed to load: ' + response.status); return response.text(); });
class PythonRunner {
  id = "python";
  label = "Python (Pyodide in Web Worker)";
  languages = ["python"];
  canBuild = false;
  session = null;
  ready = false;
  stopCurrent = null;
  async run(path, ctx) {
    if (this.stopCurrent) this.stopCurrent();
    const startedAt = performance.now();
    const files = {};
    for (const f of ctx.project.filesByLanguage("python")) files[f.path] = f.content;
    for (const f of ctx.project.filesByLanguage("json")) files[f.path] = f.content;
    if (!(path in files)) files[path] = ctx.project.readFile(path) ?? "";
    return new Promise((resolve) => {
      let session;
      try {
        session = this.ensureSession();
      } catch (err) {
        ctx.sink.write("error", `Could not create Python worker: ${err.message}`);
        resolve({ status: "failed", exitCode: null, durationMs: 0 });
        return;
      }
      const diagnostics = [];
      let stderrBuffer = "";
      let settled = false;
      let offMessage = () => {
      };
      let offError = () => {
      };
      const finish = (result) => {
        if (settled) return;
        settled = true;
        offMessage();
        offError();
        this.stopCurrent = null;
        ctx.reportDiagnostics("runtime", diagnostics);
        resolve(result);
      };
      this.stopCurrent = () => {
        this.terminateSession();
        ctx.sink.write("system", "Python worker terminated. Pyodide will be re-initialized on the next run.");
        finish(stoppedResult(startedAt));
      };
      if (!this.ready) ctx.sink.write("system", "Pyodide runtime is not loaded yet \u2014 downloading it in a background worker. The editor stays responsive.");
      ctx.sink.status(this.ready ? `Running ${path}` : "Loading Pyodide");
      offError = session.onError((e) => {
        ctx.sink.write("error", `Python worker crashed: ${e.message || "unknown error"}`);
        this.terminateSession();
        finish({ status: "failed", exitCode: 1, durationMs: performance.now() - startedAt });
      });
      offMessage = session.onMessage((msg) => {
        switch (msg.type) {
          case "status":
            ctx.sink.status(String(msg.text));
            ctx.sink.write("system", String(msg.text));
            break;
          case "ready":
            this.ready = true;
            ctx.sink.write("success", `Pyodide ready (Python ${msg.version}) in ${formatDuration(performance.now() - startedAt)}`);
            ctx.sink.status(`Running ${path}`);
            break;
          case "stdout":
            ctx.sink.write("stdout", String(msg.text));
            break;
          case "stderr":
            stderrBuffer += String(msg.text) + "\n";
            ctx.sink.write("stderr", String(msg.text));
            break;
          case "fatal":
            ctx.sink.write("error", String(msg.message));
            this.terminateSession();
            finish({ status: "failed", exitCode: null, durationMs: performance.now() - startedAt, summary: "Pyodide failed to load" });
            break;
          case "done": {
            const code = Number(msg.exitCode ?? 0);
            const duration = performance.now() - startedAt;
            const loc = this.locate(stderrBuffer, files);
            if (loc && code !== 0) diagnostics.push({ ...loc, severity: "error", source: "runtime" });
            ctx.sink.write(code === 0 ? "success" : "error", `Process finished with exit code ${code} in ${formatDuration(duration)}`);
            finish({ status: code === 0 ? "completed" : "failed", exitCode: code, durationMs: duration });
            break;
          }
        }
      });
      session.post({ type: "run", files, entry: path });
    });
  }
  stop() {
    if (this.stopCurrent) this.stopCurrent();
    else this.terminateSession();
  }
  dispose() {
    this.terminateSession();
  }
  ensureSession() {
    if (this.session && !this.session.terminated) return this.session;
    this.session = new WorkerSession(workerSource, "module");
    this.ready = false;
    this.session.post({ type: "init" });
    return this.session;
  }
  terminateSession() {
    this.session?.terminate();
    this.session = null;
    this.ready = false;
  }
  /** Find the last traceback frame that points at a project file. */
  locate(stderr, files) {
    const frames = Array.from(stderr.matchAll(/File "\/home\/pyodide(\/[^"]+)", line (\d+)/g));
    const last = frames.reverse().find((m) => m[1] in files);
    if (!last) return null;
    const lines = stderr.trim().split("\n");
    const message = lines[lines.length - 1] || "Python exception";
    return { file: last[1], line: Number(last[2]), column: 1, message };
  }
}
export {
  PythonRunner
};

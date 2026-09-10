import { WorkerSession, formatDuration } from "./WorkerHost";
import type { Diagnostic, LanguageRunner, RunContext, RunResult } from "./types";
import { stoppedResult } from "./types";
import workerSource from "../workers/python.worker.js?raw";

/**
 * Python via Pyodide. The runtime is lazy-loaded inside a module Worker on first
 * use and kept warm between runs. Stop terminates the Worker (Pyodide has no
 * safe in-thread interrupt without SharedArrayBuffer/COOP-COEP), so the next run
 * re-initializes the runtime.
 */
export class PythonRunner implements LanguageRunner {
  readonly id = "python";
  readonly label = "Python (Pyodide in Web Worker)";
  readonly languages = ["python"];
  readonly canBuild = false;
  private session: WorkerSession | null = null;
  private ready = false;
  private stopCurrent: (() => void) | null = null;

  async run(path: string, ctx: RunContext): Promise<RunResult> {
    if (this.stopCurrent) this.stopCurrent();
    const startedAt = performance.now();
    const files: Record<string, string> = {};
    for (const f of ctx.project.filesByLanguage("python")) files[f.path] = f.content;
    for (const f of ctx.project.filesByLanguage("json")) files[f.path] = f.content;
    if (!(path in files)) files[path] = ctx.project.readFile(path) ?? "";

    return new Promise<RunResult>((resolve) => {
      let session: WorkerSession;
      try {
        session = this.ensureSession();
      } catch (err) {
        ctx.sink.write("error", `Could not create Python worker: ${(err as Error).message}`);
        resolve({ status: "failed", exitCode: null, durationMs: 0 });
        return;
      }
      const diagnostics: Diagnostic[] = [];
      let stderrBuffer = "";
      let settled = false;
      let offMessage = () => {};
      let offError = () => {};
      const finish = (result: RunResult) => {
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

      if (!this.ready) ctx.sink.write("system", "Pyodide runtime is not loaded yet — downloading it in a background worker. The editor stays responsive.");
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

  stop(): void {
    if (this.stopCurrent) this.stopCurrent();
    else this.terminateSession();
  }

  dispose(): void {
    this.terminateSession();
  }

  private ensureSession(): WorkerSession {
    if (this.session && !this.session.terminated) return this.session;
    this.session = new WorkerSession(workerSource, "module");
    this.ready = false;
    this.session.post({ type: "init" });
    return this.session;
  }

  private terminateSession(): void {
    this.session?.terminate();
    this.session = null;
    this.ready = false;
  }

  /** Find the last traceback frame that points at a project file. */
  private locate(stderr: string, files: Record<string, string>): { file: string; line: number; column: number; message: string } | null {
    const frames = Array.from(stderr.matchAll(/File "\/home\/pyodide(\/[^"]+)", line (\d+)/g));
    const last = frames.reverse().find((m) => m[1] in files);
    if (!last) return null;
    const lines = stderr.trim().split("\n");
    const message = lines[lines.length - 1] || "Python exception";
    return { file: last[1], line: Number(last[2]), column: 1, message };
  }
}

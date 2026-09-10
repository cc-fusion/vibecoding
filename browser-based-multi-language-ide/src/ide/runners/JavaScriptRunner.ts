import { WorkerSession, formatDuration } from "./WorkerHost";
import type { Diagnostic, LanguageRunner, RunContext, RunResult } from "./types";
import { stoppedResult } from "./types";
import workerSource from "../workers/jsRunner.worker.js?raw";

/** Lines the Function constructor prepends before user code in V8/SpiderMonkey. */
const FUNCTION_CTOR_LINE_OFFSET = 2;

export interface ExecuteOptions {
  /** Map of executable module path -> original source path (for diagnostics). */
  sourceMap?: Record<string, string>;
  languageLabel?: string;
}

/**
 * Runs JavaScript in a dedicated Web Worker. The worker is created per run and
 * terminated on completion or Stop; nothing is ever evaluated in the IDE window.
 */
export class JavaScriptRunner implements LanguageRunner {
  readonly id = "javascript";
  readonly label = "JavaScript (Web Worker)";
  readonly languages = ["javascript"];
  readonly canBuild = false;
  private session: WorkerSession | null = null;
  private stopCurrent: (() => void) | null = null;

  async run(path: string, ctx: RunContext): Promise<RunResult> {
    const modules: Record<string, string> = {};
    for (const f of ctx.project.filesByLanguage("javascript")) modules[f.path] = f.content;
    for (const f of ctx.project.filesByLanguage("json")) modules[f.path] = f.content;
    if (!(path in modules)) modules[path] = ctx.project.readFile(path) ?? "";
    return this.execute(modules, path, ctx);
  }

  /** Shared execution path (also used by the TypeScript runner for emitted JS). */
  execute(modules: Record<string, string>, entry: string, ctx: RunContext, options: ExecuteOptions = {}): Promise<RunResult> {
    this.stop();
    const startedAt = performance.now();
    const label = options.languageLabel ?? "JavaScript";
    ctx.sink.status(`Running ${entry}`);
    ctx.sink.write("system", `Starting ${label} worker for ${options.sourceMap?.[entry] ?? entry}`);

    return new Promise<RunResult>((resolve) => {
      let session: WorkerSession;
      try {
        session = new WorkerSession(workerSource, "classic");
      } catch (err) {
        ctx.sink.write("error", `Could not create execution worker: ${(err as Error).message}`);
        resolve({ status: "failed", exitCode: null, durationMs: 0 });
        return;
      }
      this.session = session;
      const runtimeDiagnostics: Diagnostic[] = [];
      let settled = false;
      const finish = (result: RunResult) => {
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
            ctx.sink.write("info", `→ ${msg.text}`);
            break;
          case "error": {
            const stack = String(msg.stack || "");
            const location = this.locate(stack, modules, options.sourceMap);
            ctx.sink.write("error", String(msg.message) + (location ? `\n    at ${location.file}:${location.line}:${location.column}` : ""));
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

  stop(): void {
    if (this.stopCurrent) this.stopCurrent();
    else if (this.session) {
      this.session.terminate();
      this.session = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private locate(stack: string, modules: Record<string, string>, sourceMap?: Record<string, string>): { file: string; line: number; column: number } | null {
    if (!stack) return null;
    const re = /(\/[^\s():]+):(\d+):(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stack))) {
      const p = m[1];
      if (p in modules) {
        const line = Math.max(1, Number(m[2]) - FUNCTION_CTOR_LINE_OFFSET);
        return { file: sourceMap?.[p] ?? p, line, column: Math.max(1, Number(m[3])) };
      }
    }
    return null;
  }
}

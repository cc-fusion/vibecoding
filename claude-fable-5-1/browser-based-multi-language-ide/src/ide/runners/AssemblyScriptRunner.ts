import { WorkerSession, formatDuration } from "./WorkerHost";
import type { Diagnostic, LanguageRunner, RunContext, RunResult } from "./types";
import { stoppedResult } from "./types";
import compilerSource from "../workers/asc.worker.js?raw";
import wasmRunnerSource from "../workers/wasmRunner.worker.js?raw";

interface CompileOutcome {
  ok: boolean;
  binary?: ArrayBuffer;
  wat?: string;
  error?: string;
  diagnostics: Diagnostic[];
  durationMs: number;
}

/**
 * AssemblyScript → WebAssembly. Compilation runs the real `asc` compiler in a
 * (warm) compiler Worker; the resulting binary is instantiated and executed in a
 * separate, disposable WebAssembly execution Worker.
 */
export class AssemblyScriptRunner implements LanguageRunner {
  readonly id = "assemblyscript";
  readonly label = "AssemblyScript (asc → WebAssembly worker)";
  readonly languages = ["assemblyscript"];
  readonly canBuild = true;
  private compiler: WorkerSession | null = null;
  private exec: WorkerSession | null = null;
  private stopCurrent: (() => void) | null = null;

  async build(entries: string[], ctx: RunContext): Promise<RunResult> {
    const startedAt = performance.now();
    let failed = 0;
    for (const entry of entries) {
      const outcome = await this.compile(entry, ctx);
      if (!outcome.ok) failed++;
    }
    return { status: failed ? "failed" : "completed", exitCode: failed ? 1 : 0, durationMs: performance.now() - startedAt, summary: `${entries.length - failed}/${entries.length} module(s) compiled` };
  }

  async run(path: string, ctx: RunContext): Promise<RunResult> {
    this.stopExecution();
    const startedAt = performance.now();
    const outcome = await this.compile(path, ctx);
    if (this.wasStopped) return stoppedResult(startedAt);
    if (!outcome.ok || !outcome.binary) {
      ctx.sink.write("error", `AssemblyScript build failed${outcome.error ? `: ${outcome.error}` : ""}. See the Build and Problems panels.`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt, summary: "Compilation failed" };
    }
    return this.execute(outcome.binary, path, ctx, startedAt);
  }

  private wasStopped = false;

  stop(): void {
    this.wasStopped = true;
    if (this.stopCurrent) this.stopCurrent();
    this.stopExecution();
    // A compile in progress is abandoned too: the compiler worker is replaced.
    if (this.compiler) {
      this.compiler.terminate();
      this.compiler = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private stopExecution(): void {
    this.exec?.terminate();
    this.exec = null;
  }

  private ensureCompiler(): WorkerSession {
    if (this.compiler && !this.compiler.terminated) return this.compiler;
    this.compiler = new WorkerSession(compilerSource, "module");
    return this.compiler;
  }

  private compile(entry: string, ctx: RunContext): Promise<CompileOutcome> {
    this.wasStopped = false;
    const startedAt = performance.now();
    const files: Record<string, string> = {};
    for (const f of ctx.project.filesByLanguage("assemblyscript")) files[f.path] = f.content;
    if (!(entry in files)) files[entry] = ctx.project.readFile(entry) ?? "";
    ctx.sink.status(`Compiling ${entry}`);
    ctx.sink.build("system", `asc: compiling ${entry} → WebAssembly (in-browser AssemblyScript compiler)…`);

    return new Promise<CompileOutcome>((resolve) => {
      let session: WorkerSession;
      try {
        session = this.ensureCompiler();
      } catch (err) {
        const error = `Could not create compiler worker: ${(err as Error).message}`;
        ctx.sink.build("error", error);
        resolve({ ok: false, error, diagnostics: [], durationMs: 0 });
        return;
      }
      let settled = false;
      let offMessage = () => {};
      let offError = () => {};
      const finish = (outcome: CompileOutcome) => {
        if (settled) return;
        settled = true;
        offMessage();
        offError();
        this.stopCurrent = null;
        resolve(outcome);
      };
      this.stopCurrent = () => finish({ ok: false, error: "Stopped", diagnostics: [], durationMs: performance.now() - startedAt });

      offError = session.onError((e) => {
        const error = `Compiler worker crashed: ${e.message || "unknown error"}`;
        ctx.sink.build("error", error);
        this.compiler?.terminate();
        this.compiler = null;
        finish({ ok: false, error, diagnostics: [], durationMs: performance.now() - startedAt });
      });
      offMessage = session.onMessage((msg) => {
        if (msg.type === "status") {
          ctx.sink.status(String(msg.text));
          ctx.sink.build("system", String(msg.text));
          return;
        }
        if (msg.type !== "compiled") return;
        const diagnostics: Diagnostic[] = (msg.diagnostics || []).map((d: any) => ({
          severity: d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "info",
          file: this.mapFile(String(d.file || entry), files, entry),
          line: Number(d.line) || 1,
          column: Number(d.column) || 1,
          endLine: d.endLine ? Number(d.endLine) : undefined,
          endColumn: d.endColumn ? Number(d.endColumn) : undefined,
          message: String(d.message),
          source: "assemblyscript",
          code: d.code ? String(d.code) : undefined,
        }));
        ctx.reportDiagnostics("assemblyscript", diagnostics);
        for (const d of diagnostics) ctx.sink.build(d.severity === "error" ? "error" : d.severity === "warning" ? "warn" : "info", `${d.file}(${d.line},${d.column}): ${d.severity} ${d.code ?? ""}: ${d.message}`);
        if (msg.stdout) ctx.sink.build("stdout", String(msg.stdout).trimEnd());
        if (msg.stderr && !diagnostics.length) ctx.sink.build("stderr", String(msg.stderr).trimEnd());
        const duration = Number(msg.duration) || performance.now() - startedAt;
        if (msg.ok) {
          const size = (msg.binary as ArrayBuffer).byteLength;
          ctx.sink.build("success", `asc: ${entry} compiled → ${size.toLocaleString()} bytes of WebAssembly in ${formatDuration(duration)}`);
          finish({ ok: true, binary: msg.binary, wat: msg.wat, diagnostics, durationMs: duration });
        } else {
          ctx.sink.build("error", `asc: build failed${msg.error ? ` — ${msg.error}` : ""} (${formatDuration(duration)})`);
          finish({ ok: false, error: msg.error, diagnostics, durationMs: duration });
        }
      });
      session.post({ type: "compile", files, entry, optimize: true });
    });
  }

  private execute(binary: ArrayBuffer, path: string, ctx: RunContext, startedAt: number): Promise<RunResult> {
    ctx.sink.status(`Running ${path} (wasm)`);
    ctx.sink.write("system", `Instantiating WebAssembly module from ${path} in an isolated worker`);
    return new Promise<RunResult>((resolve) => {
      let session: WorkerSession;
      try {
        session = new WorkerSession(wasmRunnerSource, "classic");
      } catch (err) {
        ctx.sink.write("error", `Could not create WebAssembly worker: ${(err as Error).message}`);
        resolve({ status: "failed", exitCode: null, durationMs: performance.now() - startedAt });
        return;
      }
      this.exec = session;
      let settled = false;
      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        session.terminate();
        if (this.exec === session) this.exec = null;
        this.stopCurrent = null;
        resolve(result);
      };
      this.stopCurrent = () => finish(stoppedResult(startedAt));
      session.onError((e) => {
        ctx.sink.write("error", `WebAssembly worker error: ${e.message || "unknown"}`);
        finish({ status: "failed", exitCode: 1, durationMs: performance.now() - startedAt });
      });
      session.onMessage((msg) => {
        switch (msg.type) {
          case "console":
            ctx.sink.write(msg.level === "warn" ? "warn" : msg.level === "error" ? "stderr" : msg.level === "info" ? "info" : "stdout", String(msg.text));
            break;
          case "exports":
            ctx.sink.write("system", `exports: ${(msg.names as string[]).join(", ") || "(none)"}`);
            break;
          case "result":
            ctx.sink.write("info", `→ ${msg.text}`);
            break;
          case "error":
            ctx.sink.write("error", String(msg.message));
            break;
          case "done": {
            const code = Number(msg.exitCode ?? 0);
            const duration = performance.now() - startedAt;
            ctx.sink.write(code === 0 ? "success" : "error", `WebAssembly finished with exit code ${code} in ${formatDuration(duration)}`);
            finish({ status: code === 0 ? "completed" : "failed", exitCode: code, durationMs: duration });
            break;
          }
        }
      });
      session.post({ type: "run", binary, entry: "main" }, [binary]);
    });
  }

  private mapFile(reported: string, files: Record<string, string>, entry: string): string {
    if (reported in files) return reported;
    const withSlash = reported.startsWith("/") ? reported : "/" + reported;
    if (withSlash in files) return withSlash;
    const match = Object.keys(files).find((p) => p.endsWith(withSlash));
    return match ?? entry;
  }
}

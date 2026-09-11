import type { JavaScriptRunner } from "./JavaScriptRunner";
import type { TypeScriptCompiler } from "./TypeScriptCompiler";
import { formatDuration } from "./WorkerHost";
import type { LanguageRunner, RunContext, RunResult } from "./types";

/**
 * TypeScript: compile the whole project with the in-browser TypeScript compiler,
 * surface diagnostics, then execute the emitted CommonJS in the isolated
 * JavaScript worker.
 */
export class TypeScriptRunner implements LanguageRunner {
  readonly id = "typescript";
  readonly label = "TypeScript (tsc in Monaco worker → JS worker)";
  readonly languages = ["typescript"];
  readonly canBuild = true;

  constructor(private compiler: TypeScriptCompiler, private js: JavaScriptRunner) {}

  async build(_entries: string[], ctx: RunContext): Promise<RunResult> {
    const startedAt = performance.now();
    const result = await this.compile(ctx);
    if (!result) return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt };
    const ok = result.errorCount === 0;
    return { status: ok ? "completed" : "failed", exitCode: ok ? 0 : 1, durationMs: performance.now() - startedAt, summary: `${result.fileCount} file(s), ${result.errorCount} error(s), ${result.warningCount} warning(s)` };
  }

  async run(path: string, ctx: RunContext): Promise<RunResult> {
    const startedAt = performance.now();
    const result = await this.compile(ctx);
    if (!result) return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt };
    if (result.errorCount > 0) {
      ctx.sink.write("error", `TypeScript build failed with ${result.errorCount} error(s). See the Problems and Build panels.`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt, summary: "Compilation failed" };
    }
    const entry = this.compiler.outputPathFor(path);
    if (!(entry in result.outputs)) {
      ctx.sink.write("error", `No JavaScript was emitted for ${path}.`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt };
    }
    const modules: Record<string, string> = { ...result.outputs };
    for (const f of ctx.project.filesByLanguage("json")) modules[f.path] = f.content;
    return this.js.execute(modules, entry, ctx, { sourceMap: result.sourceMap, languageLabel: "TypeScript" });
  }

  stop(): void {
    this.js.stop();
  }

  dispose(): void {
    this.js.dispose();
  }

  private async compile(ctx: RunContext) {
    const startedAt = performance.now();
    ctx.sink.status("Compiling TypeScript");
    ctx.sink.build("system", "tsc: compiling project TypeScript files (in-browser TypeScript compiler)…");
    try {
      const result = await this.compiler.compileProject();
      ctx.reportDiagnostics("typescript-build", result.diagnostics);
      for (const d of result.diagnostics) {
        ctx.sink.build(d.severity === "error" ? "error" : d.severity === "warning" ? "warn" : "info", `${d.file}(${d.line},${d.column}): ${d.severity} ${d.code ?? ""}: ${d.message}`);
      }
      const summary = `tsc: ${result.fileCount} file(s) compiled, ${result.errorCount} error(s), ${result.warningCount} warning(s) in ${formatDuration(performance.now() - startedAt)}`;
      ctx.sink.build(result.errorCount ? "error" : "success", summary);
      return result;
    } catch (err) {
      const message = (err as Error).message || String(err);
      ctx.sink.build("error", `TypeScript compiler error: ${message}`);
      ctx.sink.write("error", `TypeScript compiler error: ${message}`);
      return null;
    }
  }
}

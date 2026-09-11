import type { Diagnostic, LanguageRunner, OutputSink, RunContext, RunResult } from "./types";

/**
 * A browser-side toolchain provider: a compiler/runtime that has been compiled
 * to WebAssembly/JS and bundled with this application as static assets. It
 * receives project sources and must compile *and* execute them locally
 * (inside Workers), streaming output to the sink. There is intentionally no
 * network/HTTP shape in this interface — providers are in-browser only.
 */
export interface BrowserToolchainProvider {
  readonly name: string;
  readonly version?: string;
  /** Lazily download/instantiate local compiler assets (wasm binaries, headers, sysroot…). */
  initialize(report: (status: string) => void): Promise<void>;
  compileAndRun(input: { files: Record<string, string>; entry: string; sink: OutputSink; signal: AbortSignal; reportDiagnostics(diagnostics: Diagnostic[]): void }): Promise<RunResult>;
  compile?(input: { files: Record<string, string>; entries: string[]; sink: OutputSink; signal: AbortSignal; reportDiagnostics(diagnostics: Diagnostic[]): void }): Promise<RunResult>;
  dispose(): void;
}

/** Registry of bundled browser toolchains (empty in the default lightweight bundle). */
export class ToolchainRegistry {
  private static providers = new Map<string, BrowserToolchainProvider>();
  static register(languageId: string, provider: BrowserToolchainProvider): void {
    this.providers.set(languageId, provider);
  }
  static get(languageId: string): BrowserToolchainProvider | undefined {
    return this.providers.get(languageId);
  }
  static list(): string[] {
    return Array.from(this.providers.keys());
  }
}

/**
 * Base adapter for heavy compilers (Clang/LLD, Roslyn/.NET, Java). Provides the
 * uniform Worker/cancellation contract and reports truthfully when no browser
 * toolchain is bundled. It never falls back to any remote service.
 */
export abstract class BrowserToolchainRunner implements LanguageRunner {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly languages: string[];
  readonly canBuild = true;
  protected abstract readonly unavailableMessage: string;
  protected abstract readonly requirements: string[];
  private abort: AbortController | null = null;

  protected provider(): BrowserToolchainProvider | undefined {
    return ToolchainRegistry.get(this.id);
  }

  async build(entries: string[], ctx: RunContext): Promise<RunResult> {
    const provider = this.provider();
    if (!provider) return this.reportUnavailable(ctx);
    const startedAt = performance.now();
    this.abort = new AbortController();
    try {
      await provider.initialize((status) => {
        ctx.sink.status(status);
        ctx.sink.build("system", status);
      });
      const files = this.collectFiles(ctx);
      if (provider.compile) return await provider.compile({ files, entries, sink: ctx.sink, signal: this.abort.signal, reportDiagnostics: (d) => ctx.reportDiagnostics(this.id, d) });
      return await provider.compileAndRun({ files, entry: entries[0], sink: ctx.sink, signal: this.abort.signal, reportDiagnostics: (d) => ctx.reportDiagnostics(this.id, d) });
    } catch (err) {
      ctx.sink.build("error", `${provider.name}: ${(err as Error).message}`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt };
    } finally {
      this.abort = null;
    }
  }

  async run(path: string, ctx: RunContext): Promise<RunResult> {
    const provider = this.provider();
    if (!provider) return this.reportUnavailable(ctx);
    const startedAt = performance.now();
    this.abort = new AbortController();
    try {
      await provider.initialize((status) => {
        ctx.sink.status(status);
        ctx.sink.write("system", status);
      });
      return await provider.compileAndRun({ files: this.collectFiles(ctx), entry: path, sink: ctx.sink, signal: this.abort.signal, reportDiagnostics: (d) => ctx.reportDiagnostics(this.id, d) });
    } catch (err) {
      ctx.sink.write("error", `${provider.name}: ${(err as Error).message}`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt };
    } finally {
      this.abort = null;
    }
  }

  stop(): void {
    this.abort?.abort();
  }

  dispose(): void {
    this.stop();
    this.provider()?.dispose();
  }

  protected collectFiles(ctx: RunContext): Record<string, string> {
    const files: Record<string, string> = {};
    for (const lang of this.languages) for (const f of ctx.project.filesByLanguage(lang)) files[f.path] = f.content;
    return files;
  }

  private reportUnavailable(ctx: RunContext): RunResult {
    ctx.sink.write("error", this.unavailableMessage);
    ctx.sink.build("error", this.unavailableMessage);
    ctx.sink.build("system", "Nothing was compiled or executed. This IDE is browser-only: no source code was sent anywhere.");
    ctx.sink.build("system", "To enable: bundle these browser-side assets and register a provider with ToolchainRegistry.register('" + this.id + "', provider):");
    for (const r of this.requirements) ctx.sink.build("system", "  • " + r);
    ctx.sink.status("Toolchain not installed");
    return { status: "unavailable", exitCode: null, durationMs: 0, summary: "Browser toolchain not installed" };
  }
}

export class ClangRunner extends BrowserToolchainRunner {
  readonly id = "cpp";
  readonly label = "C/C++ (Clang/LLD → WebAssembly, browser toolchain)";
  readonly languages = ["cpp", "c"];
  protected readonly unavailableMessage = "C/C++ browser compiler is not currently installed. Install or bundle a browser-compatible Clang/LLD WebAssembly toolchain to enable builds.";
  protected readonly requirements = [
    "clang and wasm-ld compiled to WebAssembly (e.g. an llvm-project wasm32 build), loaded lazily inside a Worker",
    "a wasm32 sysroot: libc/libc++ headers and libraries (e.g. wasi-libc / libc++ built for wasm32-wasi), loaded lazily",
    "a WASI-compatible in-Worker runtime to execute the linked .wasm and capture stdout/stderr/exit code",
  ];
}

export class CSharpRunner extends BrowserToolchainRunner {
  readonly id = "csharp";
  readonly label = "C# (Roslyn on .NET WebAssembly, browser toolchain)";
  readonly languages = ["csharp"];
  protected readonly unavailableMessage = "C# browser compiler is not currently installed. Bundle a browser-compatible .NET WebAssembly/Roslyn runtime to enable builds.";
  protected readonly requirements = [
    "the .NET runtime built for WebAssembly (dotnet.js + dotnet.wasm + framework assemblies), loaded inside a Worker",
    "Microsoft.CodeAnalysis.CSharp (Roslyn) assemblies plus reference assemblies for compilation in the browser",
    "an in-Worker host that loads the emitted assembly into the same .NET WebAssembly runtime and captures Console output",
  ];
}

export class JavaRunner extends BrowserToolchainRunner {
  readonly id = "java";
  readonly label = "Java (browser-executable Java toolchain)";
  readonly languages = ["java"];
  protected readonly unavailableMessage = "Java browser compiler/runtime is not currently installed. Bundle a browser-executable Java toolchain (for example a TeaVM-compiled javac + JVM runtime) in this application to enable builds.";
  protected readonly requirements = [
    "a Java compiler that runs in the browser (e.g. javac/ecj compiled with TeaVM to JS/WebAssembly), loaded inside a Worker",
    "a browser-executable JVM/bytecode interpreter or an ahead-of-time Java→WebAssembly pipeline for running the result",
    "the Java class library subset required by the programs, shipped as local static assets",
  ];
}

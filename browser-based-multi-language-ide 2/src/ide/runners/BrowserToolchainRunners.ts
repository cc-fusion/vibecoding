import clangWorkerSource from "../workers/clang.worker.js?raw";
import csharpWorkerSource from "../workers/csharp.worker.js?raw";
import { WorkerSession } from "./WorkerHost";
import type { Diagnostic, LanguageRunner, OutputKind, OutputSink, RunContext, RunResult, RunStatus } from "./types";
import { stoppedResult } from "./types";

interface ToolchainInput {
  files: Record<string, string>;
  entry: string;
  sink: OutputSink;
  signal: AbortSignal;
  reportDiagnostics(diagnostics: Diagnostic[]): void;
}

interface ToolchainBuildInput extends Omit<ToolchainInput, "entry"> {
  entries: string[];
}

/** Browser-only compiler/runtime provider used by the heavyweight language adapters. */
export interface BrowserToolchainProvider {
  readonly name: string;
  readonly version?: string;
  /** The optional signal preserves compatibility with providers written for the original registry API. */
  initialize(report: (status: string) => void, signal?: AbortSignal): Promise<void>;
  compileAndRun(input: ToolchainInput): Promise<RunResult>;
  compile?(input: ToolchainBuildInput): Promise<RunResult>;
  dispose(): void;
}

/** Registry remains public so deployments may replace a built-in provider. */
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

let builtinsRegistered = false;

/** Install all production browser toolchains once, without overwriting custom providers. */
export function registerBuiltinToolchains(): void {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  if (!ToolchainRegistry.get("cpp")) ToolchainRegistry.register("cpp", new WorkerToolchainProvider("Clang/LLD → WebAssembly", clangWorkerSource));
  if (!ToolchainRegistry.get("csharp")) ToolchainRegistry.register("csharp", new WorkerToolchainProvider("Roslyn/.NET WebAssembly", csharpWorkerSource));
  if (!ToolchainRegistry.get("java")) ToolchainRegistry.register("java", new CheerpJToolchainProvider());
}

/**
 * Shared adapter for C/C++, C#, and Java. Providers are lazy and warm: the
 * first run downloads runtime assets, subsequent runs reuse the initialized
 * compiler until Stop/dispose terminates it.
 */
export abstract class BrowserToolchainRunner implements LanguageRunner {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly languages: string[];
  readonly canBuild = true;
  private abort: AbortController | null = null;

  protected provider(): BrowserToolchainProvider {
    const provider = ToolchainRegistry.get(this.id);
    if (!provider) throw new Error(`No browser toolchain provider is registered for ${this.id}.`);
    return provider;
  }

  async build(entries: string[], ctx: RunContext): Promise<RunResult> {
    const startedAt = performance.now();
    const provider = this.provider();
    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    ctx.reportDiagnostics(this.id, []);
    try {
      await provider.initialize((status) => {
        ctx.sink.status(status);
        ctx.sink.build("system", status);
      }, signal);
      if (signal.aborted) return stoppedResult(startedAt);
      const files = this.collectFiles(ctx);
      const report = (diagnostics: Diagnostic[]) => ctx.reportDiagnostics(this.id, diagnostics);
      if (provider.compile) return await provider.compile({ files, entries, sink: ctx.sink, signal, reportDiagnostics: report });
      return await provider.compileAndRun({ files, entry: entries[0], sink: ctx.sink, signal, reportDiagnostics: report });
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return stoppedResult(startedAt);
      ctx.sink.build("error", `${provider.name}: ${errorMessage(error)}`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt, summary: errorMessage(error) };
    } finally {
      if (this.abort?.signal === signal) this.abort = null;
    }
  }

  async run(path: string, ctx: RunContext): Promise<RunResult> {
    const startedAt = performance.now();
    const provider = this.provider();
    this.abort?.abort();
    this.abort = new AbortController();
    const signal = this.abort.signal;
    ctx.reportDiagnostics(this.id, []);
    try {
      await provider.initialize((status) => {
        ctx.sink.status(status);
        ctx.sink.write("system", status);
      }, signal);
      if (signal.aborted) return stoppedResult(startedAt);
      const result = await provider.compileAndRun({
        files: this.collectFiles(ctx),
        entry: path,
        sink: ctx.sink,
        signal,
        reportDiagnostics: (diagnostics) => ctx.reportDiagnostics(this.id, diagnostics),
      });
      const kind: OutputKind = result.status === "completed" ? "success" : result.status === "stopped" ? "warn" : "error";
      ctx.sink.write(kind, `${provider.name}: ${result.summary ?? result.status}`);
      return result;
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return stoppedResult(startedAt);
      ctx.sink.write("error", `${provider.name}: ${errorMessage(error)}`);
      return { status: "failed", exitCode: 1, durationMs: performance.now() - startedAt, summary: errorMessage(error) };
    } finally {
      if (this.abort?.signal === signal) this.abort = null;
    }
  }

  stop(): void {
    this.abort?.abort();
  }

  dispose(): void {
    this.stop();
    this.provider().dispose();
  }

  protected collectFiles(ctx: RunContext): Record<string, string> {
    const files: Record<string, string> = {};
    for (const language of this.languages) {
      for (const file of ctx.project.filesByLanguage(language)) files[file.path] = file.content;
    }
    return files;
  }
}

export class ClangRunner extends BrowserToolchainRunner {
  readonly id = "cpp";
  readonly label = "C/C++ (Clang/LLD → WebAssembly worker)";
  readonly languages = ["cpp", "c"];
}

export class CSharpRunner extends BrowserToolchainRunner {
  readonly id = "csharp";
  readonly label = "C# (Roslyn + .NET WebAssembly worker)";
  readonly languages = ["csharp"];
}

export class JavaRunner extends BrowserToolchainRunner {
  readonly id = "java";
  readonly label = "Java (javac + CheerpJ sandbox)";
  readonly languages = ["java"];
}

interface WorkerResultMessage {
  type: "result";
  requestId: number;
  status: RunStatus;
  exitCode: number | null;
  durationMs: number;
  summary?: string;
  diagnostics?: Diagnostic[];
}

/** Provider for a compiler hosted in a dedicated, terminate-able module Worker. */
class WorkerToolchainProvider implements BrowserToolchainProvider {
  readonly version = "lazy CDN runtime";
  private session: WorkerSession | null = null;
  private ready = false;
  private initializing: Promise<void> | null = null;
  private nextRequestId = 1;

  constructor(readonly name: string, private workerSource: string) {}

  initialize(report: (status: string) => void, signal?: AbortSignal): Promise<void> {
    const activeSignal = signal ?? new AbortController().signal;
    if (this.ready && this.session && !this.session.terminated) return Promise.resolve();
    if (this.initializing) return raceAbort(this.initializing, activeSignal);

    this.initializing = new Promise<void>((resolve, reject) => {
      let session: WorkerSession;
      try {
        session = new WorkerSession(this.workerSource, "module");
      } catch (error) {
        reject(error);
        return;
      }
      this.session = session;
      let settled = false;
      let offMessage = () => {};
      let offError = () => {};
      let timeout = 0;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        activeSignal.removeEventListener("abort", onAbort);
        offMessage();
        offError();
        if (error) {
          this.resetSession();
          reject(error);
        } else {
          this.ready = true;
          resolve();
        }
      };
      const onAbort = () => finish(abortError());
      activeSignal.addEventListener("abort", onAbort, { once: true });
      timeout = window.setTimeout(() => finish(new Error(`${this.name} did not initialize within two minutes.`)), 120_000);
      offError = session.onError((event) => finish(new Error(event.message || `${this.name} worker crashed during initialization.`)));
      offMessage = session.onMessage((message) => {
        if (message.type === "status" || message.type === "notice") report(String(message.text));
        else if (message.type === "ready") finish();
        else if (message.type === "fatal") finish(new Error(String(message.message || `${this.name} failed to initialize.`)));
      });
      report(`Starting ${this.name}…`);
      session.post({ type: "initialize" });
      if (activeSignal.aborted) onAbort();
    }).finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  compileAndRun(input: ToolchainInput): Promise<RunResult> {
    return this.execute("run", input.files, input.entry, [input.entry], input.sink, input.signal, input.reportDiagnostics);
  }

  compile(input: ToolchainBuildInput): Promise<RunResult> {
    return this.execute("build", input.files, input.entries[0], input.entries, input.sink, input.signal, input.reportDiagnostics);
  }

  dispose(): void {
    this.resetSession();
  }

  private execute(
    mode: "run" | "build",
    files: Record<string, string>,
    entry: string,
    entries: string[],
    sink: OutputSink,
    signal: AbortSignal,
    reportDiagnostics: (diagnostics: Diagnostic[]) => void
  ): Promise<RunResult> {
    const session = this.session;
    if (!this.ready || !session || session.terminated) return Promise.reject(new Error(`${this.name} is not initialized.`));
    const requestId = this.nextRequestId++;

    return new Promise<RunResult>((resolve, reject) => {
      let settled = false;
      let offMessage = () => {};
      let offError = () => {};
      const finish = (result?: RunResult, error?: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        offMessage();
        offError();
        if (error) reject(error);
        else resolve(result!);
      };
      const onAbort = () => {
        this.resetSession();
        finish(undefined, abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      offError = session.onError((event) => {
        this.resetSession();
        finish(undefined, new Error(event.message || `${this.name} worker crashed.`));
      });
      offMessage = session.onMessage((message) => {
        if (message.type === "status") {
          sink.status(String(message.text));
          return;
        }
        if (message.type === "notice") {
          sink.write("system", String(message.text));
          return;
        }
        if (message.requestId !== requestId) return;
        if (message.type === "output") {
          const kind = normalizeOutputKind(message.kind);
          if (message.scope === "build") {
            sink.build(kind, String(message.text));
            if (mode === "run" && (kind === "error" || kind === "warn")) sink.write(kind, String(message.text));
          }
          else sink.write(kind, String(message.text));
          return;
        }
        if (message.type === "result") {
          const result = message as WorkerResultMessage;
          reportDiagnostics(Array.isArray(result.diagnostics) ? result.diagnostics : []);
          finish({
            status: normalizeRunStatus(result.status),
            exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
            durationMs: Number(result.durationMs) || 0,
            summary: result.summary ? String(result.summary) : undefined,
          });
        }
      });
      session.post({ type: "execute", requestId, mode, files, entry, entries });
      if (signal.aborted) onAbort();
    });
  }

  private resetSession(): void {
    this.session?.terminate();
    this.session = null;
    this.ready = false;
  }
}

interface JavaFrameResult {
  type: "result";
  token: string;
  requestId: number;
  compileCode: number;
  runCode: number | null;
  compileLog: string;
  runtimeOutput: string;
}

/** Java runs in a disposable opaque-origin iframe because CheerpJ is DOM based. */
class CheerpJToolchainProvider implements BrowserToolchainProvider {
  readonly name = "javac/CheerpJ";
  readonly version = "CheerpJ 4.3 / Java 8";
  private frame: HTMLIFrameElement | null = null;
  private ready = false;
  private initializing: Promise<void> | null = null;
  private nextRequestId = 1;
  private token = "";

  initialize(report: (status: string) => void, signal?: AbortSignal): Promise<void> {
    const activeSignal = signal ?? new AbortController().signal;
    if (this.ready && this.frame?.contentWindow) return Promise.resolve();
    if (this.initializing) return raceAbort(this.initializing, activeSignal);

    this.initializing = new Promise<void>((resolve, reject) => {
      this.destroyFrame();
      this.token = createToken();
      const frame = document.createElement("iframe");
      frame.title = "Java compiler and runtime sandbox";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none";
      this.frame = frame;
      let settled = false;
      let timeout = 0;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        activeSignal.removeEventListener("abort", onAbort);
        window.removeEventListener("message", onMessage);
        if (error) {
          this.destroyFrame();
          reject(error);
        } else {
          this.ready = true;
          resolve();
        }
      };
      const onAbort = () => finish(abortError());
      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow || event.data?.token !== this.token) return;
        if (event.data.type === "status") report(String(event.data.text));
        else if (event.data.type === "ready") finish();
        else if (event.data.type === "fatal") finish(new Error(String(event.data.message || "CheerpJ failed to initialize.")));
      };
      activeSignal.addEventListener("abort", onAbort, { once: true });
      window.addEventListener("message", onMessage);
      timeout = window.setTimeout(() => finish(new Error("CheerpJ did not initialize within two minutes.")), 120_000);
      report("Loading CheerpJ and the Java 8 runtime…");
      frame.srcdoc = javaFrameDocument(this.token);
      document.body.appendChild(frame);
      if (activeSignal.aborted) onAbort();
    }).finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  compileAndRun(input: ToolchainInput): Promise<RunResult> {
    return this.execute("run", input.files, input.entry, input.sink, input.signal, input.reportDiagnostics);
  }

  compile(input: ToolchainBuildInput): Promise<RunResult> {
    return this.execute("build", input.files, input.entries[0], input.sink, input.signal, input.reportDiagnostics);
  }

  dispose(): void {
    this.destroyFrame();
  }

  private execute(
    mode: "run" | "build",
    allFiles: Record<string, string>,
    entry: string,
    sink: OutputSink,
    signal: AbortSignal,
    reportDiagnostics: (diagnostics: Diagnostic[]) => void
  ): Promise<RunResult> {
    const frame = this.frame;
    if (!this.ready || !frame?.contentWindow) return Promise.reject(new Error("CheerpJ is not initialized."));
    const files = Object.fromEntries(Object.entries(allFiles).filter(([path]) => /\.java$/i.test(path)));
    const requestId = this.nextRequestId++;
    const startedAt = performance.now();

    return new Promise<RunResult>((resolve, reject) => {
      let settled = false;
      const finish = (result?: RunResult, error?: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        window.removeEventListener("message", onMessage);
        if (error) reject(error);
        else resolve(result!);
      };
      const onAbort = () => {
        this.destroyFrame();
        finish(undefined, abortError());
      };
      const onMessage = (event: MessageEvent<JavaFrameResult | { type: string; token: string; text?: string; message?: string; requestId?: number }>) => {
        if (event.source !== frame.contentWindow || event.data?.token !== this.token) return;
        if (event.data.type === "status") {
          sink.status(String(event.data.text));
          return;
        }
        if (event.data.type === "fatal" && event.data.requestId === requestId) {
          finish(undefined, new Error(String(event.data.message || "Java runtime failure")));
          return;
        }
        if (event.data.type !== "result" || event.data.requestId !== requestId) return;
        const message = event.data as JavaFrameResult;
        const diagnostics = parseJavaDiagnostics(message.compileLog, files, entry);
        reportDiagnostics(diagnostics);
        if (message.compileLog.trim()) sink.build(message.compileCode === 0 ? "info" : "error", message.compileLog.trimEnd());
        if (mode === "run" && message.compileCode !== 0) sink.write("error", "javac compilation failed. See Build and Problems for details.");
        if (message.compileCode === 0) sink.build("success", `javac compiled ${Object.keys(files).length} source file(s).`);
        if (message.runtimeOutput.trim()) sink.write(message.runCode === 0 ? "stdout" : "stderr", message.runtimeOutput.trimEnd());
        const code = message.compileCode !== 0 ? message.compileCode : message.runCode ?? 0;
        finish({
          status: code === 0 ? "completed" : "failed",
          exitCode: code,
          durationMs: performance.now() - startedAt,
          summary: message.compileCode !== 0 ? "javac compilation failed" : mode === "build" ? `${Object.keys(files).length} Java source file(s) compiled` : `Java process exited with code ${code}`,
        });
      };
      signal.addEventListener("abort", onAbort, { once: true });
      window.addEventListener("message", onMessage);
      sink.status(`Compiling ${entry} with javac`);
      frame.contentWindow!.postMessage({ type: "execute", token: this.token, requestId, mode, files, entry }, "*");
      if (signal.aborted) onAbort();
    });
  }

  private destroyFrame(): void {
    this.frame?.remove();
    this.frame = null;
    this.ready = false;
  }
}

function javaFrameDocument(token: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="https://javafiddle.leaningtech.com/"><script crossorigin="anonymous" src="https://cjrtnc.leaningtech.com/4.3/loader.js"></script></head><body><pre id="console"></pre><div id="java-display"></div><script>(${javaFrameBootstrap.toString()})(${JSON.stringify(token)});<\/script></body></html>`;
}

function javaFrameBootstrap(token: string): void {
  const api = globalThis as unknown as Record<string, (...args: unknown[]) => unknown>;
  const consoleElement = document.getElementById("console")!;
  const displayElement = document.getElementById("java-display")!;
  const send = (message: Record<string, unknown>) => window.parent.postMessage({ ...message, token }, "*");

  window.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    if (event.source !== window.parent || message?.token !== token || message.type !== "execute") return;
    void execute(message);
  });

  async function execute(message: { requestId: number; mode: "run" | "build"; files: Record<string, string>; entry: string }): Promise<void> {
    try {
      consoleElement.textContent = "";
      const addFile = api.cheerpOSAddStringFile || api.cheerpjAddStringFile;
      if (typeof addFile !== "function") throw new Error("CheerpJ virtual filesystem API is unavailable.");
      const encoder = new TextEncoder();
      const sourceFiles: string[] = [];
      for (const [path, source] of Object.entries(message.files)) {
        const virtualPath = "/str/" + path.replace(/^\/+/, "");
        addFile(virtualPath, encoder.encode(source));
        sourceFiles.push(virtualPath);
      }
      if (!sourceFiles.length) throw new Error("No Java source files were found in the project.");
      send({ type: "status", requestId: message.requestId, text: `Compiling ${sourceFiles.length} Java source file(s) with javac…` });
      const classPath = "/app/tools.jar:/files/";
      const compileCode = Number(await api.cheerpjRunMain("com.sun.tools.javac.Main", classPath, "-classpath", "/files/", "-d", "/files/", "-encoding", "UTF-8", "-Xlint:all", ...sourceFiles));
      const compileLog = consoleElement.textContent || "";
      if (compileCode !== 0 || message.mode === "build") {
        send({ type: "result", requestId: message.requestId, compileCode, runCode: null, compileLog, runtimeOutput: "" });
        return;
      }

      consoleElement.textContent = "";
      const mainClass = deriveJavaMainClass(message.entry, message.files[message.entry] || "");
      send({ type: "status", requestId: message.requestId, text: `Running ${mainClass} on CheerpJ…` });
      const runCode = Number(await api.cheerpjRunMain(mainClass, classPath));
      send({ type: "result", requestId: message.requestId, compileCode, runCode, compileLog, runtimeOutput: consoleElement.textContent || "" });
    } catch (error) {
      send({ type: "fatal", requestId: message.requestId, message: error instanceof Error ? error.message : String(error) });
    }
  }

  function deriveJavaMainClass(path: string, source: string): string {
    const className = path.split("/").pop()!.replace(/\.java$/i, "");
    const packageMatch = source.match(/\bpackage\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/);
    return packageMatch ? `${packageMatch[1]}.${className}` : className;
  }

  void (async () => {
    try {
      if (typeof api.cheerpjInit !== "function") throw new Error("CheerpJ loader did not load.");
      send({ type: "status", text: "Initializing the Java virtual machine…" });
      await api.cheerpjInit({ version: 8, status: "none", overrideDocumentBase: "https://javafiddle.leaningtech.com/" });
      if (typeof api.cheerpjCreateDisplay === "function") api.cheerpjCreateDisplay(1, 1, displayElement);
      send({ type: "ready" });
    } catch (error) {
      send({ type: "fatal", message: error instanceof Error ? error.message : String(error) });
    }
  })();
}

function parseJavaDiagnostics(log: string, files: Record<string, string>, fallbackFile: string): Diagnostic[] {
  const lines = String(log || "").replace(/\r/g, "").split("\n");
  const diagnostics: Diagnostic[] = [];
  const pattern = /^\/str\/(.+?):(\d+):\s*(error|warning|note):\s*(.+)$/;
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(pattern);
    if (!match) continue;
    const candidate = "/" + match[1].replace(/^\/+/, "");
    const file = candidate in files ? candidate : fallbackFile;
    const caretLine = lines[index + 2] || "";
    const column = Math.max(1, caretLine.indexOf("^") + 1);
    diagnostics.push({
      severity: match[3] === "error" ? "error" : match[3] === "warning" ? "warning" : "info",
      file,
      line: Math.max(1, Number(match[2]) || 1),
      column,
      endColumn: column + 1,
      message: match[4],
      source: "javac",
    });
  }
  return diagnostics;
}

function normalizeOutputKind(value: unknown): OutputKind {
  return value === "stdout" || value === "stderr" || value === "info" || value === "warn" || value === "error" || value === "success" || value === "system" ? value : "info";
}

function normalizeRunStatus(value: unknown): RunStatus {
  return value === "completed" || value === "failed" || value === "stopped" || value === "unavailable" ? value : "failed";
}

function createToken(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function abortError(): DOMException {
  return new DOMException("Stopped by user", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

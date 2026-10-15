const memoryDBSource = await fetch(new URL("../../vendor/fake-indexeddb.js", import.meta.url)).then(r => { if (!r.ok) throw new Error("Memory DB failed to load"); return r.text(); });
const clangWorkerSource = await fetch(new URL("../workers/clang.worker.js", import.meta.url)).then(response => { if (!response.ok) throw new Error('Worker source failed to load: ' + response.status); return response.text().then(source => 'const FORGE_BASE_URL = ' + JSON.stringify(new URL('../../', import.meta.url).href) + ';\n' + source); });
const csharpWorkerSource = await fetch(new URL("../workers/csharp.worker.js", import.meta.url)).then(response => { if (!response.ok) throw new Error('Worker source failed to load: ' + response.status); return response.text().then(source => 'const FORGE_BASE_URL = ' + JSON.stringify(new URL('../../', import.meta.url).href) + ';\n' + source); });
import { WorkerSession } from "./WorkerHost.js";
import { stoppedResult } from "./types.js";
class ToolchainRegistry {
  static providers = /* @__PURE__ */ new Map();
  static register(languageId, provider) {
    this.providers.set(languageId, provider);
  }
  static get(languageId) {
    return this.providers.get(languageId);
  }
  static list() {
    return Array.from(this.providers.keys());
  }
}
let builtinsRegistered = false;
function registerBuiltinToolchains() {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  if (!ToolchainRegistry.get("cpp")) ToolchainRegistry.register("cpp", new WorkerToolchainProvider("Clang/LLD \u2192 WebAssembly", clangWorkerSource));
  if (!ToolchainRegistry.get("csharp")) ToolchainRegistry.register("csharp", new WorkerToolchainProvider("Roslyn/.NET WebAssembly", csharpWorkerSource));
  if (!ToolchainRegistry.get("java")) ToolchainRegistry.register("java", new CheerpJToolchainProvider());
}
class BrowserToolchainRunner {
  canBuild = true;
  abort = null;
  provider() {
    const provider = ToolchainRegistry.get(this.id);
    if (!provider) throw new Error(`No browser toolchain provider is registered for ${this.id}.`);
    return provider;
  }
  async build(entries, ctx) {
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
      const report = (diagnostics) => ctx.reportDiagnostics(this.id, diagnostics);
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
  async run(path, ctx) {
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
        reportDiagnostics: (diagnostics) => ctx.reportDiagnostics(this.id, diagnostics)
      });
      const kind = result.status === "completed" ? "success" : result.status === "stopped" ? "warn" : "error";
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
  stop() {
    this.abort?.abort();
  }
  dispose() {
    this.stop();
    this.provider().dispose();
  }
  collectFiles(ctx) {
    const files = {};
    for (const language of this.languages) {
      for (const file of ctx.project.filesByLanguage(language)) files[file.path] = file.content;
    }
    return files;
  }
}
class ClangRunner extends BrowserToolchainRunner {
  id = "cpp";
  label = "C/C++ (Clang/LLD \u2192 WebAssembly worker)";
  languages = ["cpp", "c"];
}
class CSharpRunner extends BrowserToolchainRunner {
  id = "csharp";
  label = "C# (Roslyn + .NET WebAssembly worker)";
  languages = ["csharp"];
}
class JavaRunner extends BrowserToolchainRunner {
  id = "java";
  label = "Java (javac + CheerpJ sandbox)";
  languages = ["java"];
}
class WorkerToolchainProvider {
  constructor(name, workerSource) {
    this.name = name;
    this.workerSource = workerSource;
  }
  name;
  workerSource;
  version = "lazy CDN runtime";
  session = null;
  ready = false;
  initializing = null;
  nextRequestId = 1;
  initialize(report, signal) {
    const activeSignal = signal ?? new AbortController().signal;
    if (this.ready && this.session && !this.session.terminated) return Promise.resolve();
    if (this.initializing) return raceAbort(this.initializing, activeSignal);
    this.initializing = new Promise((resolve, reject) => {
      let session;
      try {
        session = new WorkerSession(this.workerSource, "module");
      } catch (error) {
        reject(error);
        return;
      }
      this.session = session;
      let settled = false;
      let offMessage = () => {
      };
      let offError = () => {
      };
      let timeout = 0;
      const finish = (error) => {
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
      timeout = window.setTimeout(() => finish(new Error(`${this.name} did not initialize within two minutes.`)), 12e4);
      offError = session.onError((event) => finish(new Error(event.message || `${this.name} worker crashed during initialization.`)));
      offMessage = session.onMessage((message) => {
        if (message.type === "status" || message.type === "notice") report(String(message.text));
        else if (message.type === "ready") finish();
        else if (message.type === "fatal") finish(new Error(String(message.message || `${this.name} failed to initialize.`)));
      });
      report(`Starting ${this.name}\u2026`);
      session.post({ type: "initialize" });
      if (activeSignal.aborted) onAbort();
    }).finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }
  compileAndRun(input) {
    return this.execute("run", input.files, input.entry, [input.entry], input.sink, input.signal, input.reportDiagnostics);
  }
  compile(input) {
    return this.execute("build", input.files, input.entries[0], input.entries, input.sink, input.signal, input.reportDiagnostics);
  }
  dispose() {
    this.resetSession();
  }
  execute(mode, files, entry, entries, sink, signal, reportDiagnostics) {
    const session = this.session;
    if (!this.ready || !session || session.terminated) return Promise.reject(new Error(`${this.name} is not initialized.`));
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      let settled = false;
      let offMessage = () => {
      };
      let offError = () => {
      };
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        offMessage();
        offError();
        if (error) reject(error);
        else resolve(result);
      };
      const onAbort = () => {
        this.resetSession();
        finish(void 0, abortError());
      };
      signal.addEventListener("abort", onAbort, { once: true });
      offError = session.onError((event) => {
        this.resetSession();
        finish(void 0, new Error(event.message || `${this.name} worker crashed.`));
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
          } else sink.write(kind, String(message.text));
          return;
        }
        if (message.type === "result") {
          const result = message;
          reportDiagnostics(Array.isArray(result.diagnostics) ? result.diagnostics : []);
          finish({
            status: normalizeRunStatus(result.status),
            exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
            durationMs: Number(result.durationMs) || 0,
            summary: result.summary ? String(result.summary) : void 0
          });
        }
      });
      session.post({ type: "execute", requestId, mode, files, entry, entries });
      if (signal.aborted) onAbort();
    });
  }
  resetSession() {
    this.session?.terminate();
    this.session = null;
    this.ready = false;
  }
}
class CheerpJToolchainProvider {
  name = "javac/CheerpJ";
  version = "CheerpJ 4.3 / Java 8";
  frame = null;
  ready = false;
  initializing = null;
  nextRequestId = 1;
  token = "";
  initialize(report, signal) {
    const activeSignal = signal ?? new AbortController().signal;
    if (this.ready && this.frame?.contentWindow) return Promise.resolve();
    if (this.initializing) return raceAbort(this.initializing, activeSignal);
    this.initializing = new Promise((resolve, reject) => {
      this.destroyFrame();
      this.token = createToken();
      const frame = document.createElement("iframe");
      frame.title = "Java compiler and runtime sandbox";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none";
      this.frame = frame;
      let settled = false;
      let timeout = 0;
      const finish = (error) => {
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
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow || event.data?.token !== this.token) return;
        if (event.data.type === "status") report(String(event.data.text));
        else if (event.data.type === "ready") finish();
        else if (event.data.type === "fatal") finish(new Error(String(event.data.message || "CheerpJ failed to initialize.")));
      };
      activeSignal.addEventListener("abort", onAbort, { once: true });
      window.addEventListener("message", onMessage);
      timeout = window.setTimeout(() => finish(new Error("CheerpJ did not initialize within two minutes.")), 12e4);
      report("Loading CheerpJ and the Java 8 runtime\u2026");
      frame.srcdoc = javaFrameDocument(this.token);
      document.body.appendChild(frame);
      if (activeSignal.aborted) onAbort();
    }).finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }
  compileAndRun(input) {
    return this.execute("run", input.files, input.entry, input.sink, input.signal, input.reportDiagnostics);
  }
  compile(input) {
    return this.execute("build", input.files, input.entries[0], input.sink, input.signal, input.reportDiagnostics);
  }
  dispose() {
    this.destroyFrame();
  }
  execute(mode, allFiles, entry, sink, signal, reportDiagnostics) {
    const frame = this.frame;
    if (!this.ready || !frame?.contentWindow) return Promise.reject(new Error("CheerpJ is not initialized."));
    const files = Object.fromEntries(Object.entries(allFiles).filter(([path]) => /\.java$/i.test(path)));
    const requestId = this.nextRequestId++;
    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result, error) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        window.removeEventListener("message", onMessage);
        if (error) reject(error);
        else resolve(result);
      };
      const onAbort = () => {
        this.destroyFrame();
        finish(void 0, abortError());
      };
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow || event.data?.token !== this.token) return;
        if (event.data.type === "status") {
          sink.status(String(event.data.text));
          return;
        }
        if (event.data.type === "fatal" && event.data.requestId === requestId) {
          finish(void 0, new Error(String(event.data.message || "Java runtime failure")));
          return;
        }
        if (event.data.type !== "result" || event.data.requestId !== requestId) return;
        const message = event.data;
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
          summary: message.compileCode !== 0 ? "javac compilation failed" : mode === "build" ? `${Object.keys(files).length} Java source file(s) compiled` : `Java process exited with code ${code}`
        });
      };
      signal.addEventListener("abort", onAbort, { once: true });
      window.addEventListener("message", onMessage);
      sink.status(`Compiling ${entry} with javac`);
      frame.contentWindow.postMessage({ type: "execute", token: this.token, requestId, mode, files, entry }, "*");
      if (signal.aborted) onAbort();
    });
  }
  destroyFrame() {
    this.frame?.remove();
    this.frame = null;
    this.ready = false;
  }
}
function javaFrameDocument(token) {
  return `<!doctype html><html><head><meta charset="utf-8"><base href="https://javafiddle.leaningtech.com/"><script crossorigin="anonymous" src="https://cjrtnc.leaningtech.com/4.3/loader.js"><\/script></head><body><pre id="console"></pre><div id="java-display"></div><script>${memoryDBSource.replace(/<\/script/gi, "<\\/script")}<\/script><script>(${javaFrameBootstrap.toString()})(${JSON.stringify(token)}, ${JSON.stringify(new URL("../../", import.meta.url).href)});<\/script></body></html>`;
}
function javaFrameBootstrap(token, baseURL) {
  const api = globalThis;
  const consoleElement = document.getElementById("console");
  const displayElement = document.getElementById("java-display");
  const send = (message) => window.parent.postMessage({ ...message, token }, "*");
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window.parent || message?.token !== token || message.type !== "execute") return;
    void execute(message);
  });
  async function execute(message) {
    try {
      consoleElement.textContent = "";
      const addFile = api.cheerpOSAddStringFile || api.cheerpjAddStringFile;
      if (typeof addFile !== "function") throw new Error("CheerpJ virtual filesystem API is unavailable.");
      const encoder = new TextEncoder();
      const sourceFiles = [];
      for (const [path, source] of Object.entries(message.files)) {
        const virtualPath = "/str/" + path.replace(/^\/+/, "");
        addFile(virtualPath, encoder.encode(source));
        sourceFiles.push(virtualPath);
      }
      if (!sourceFiles.length) throw new Error("No Java source files were found in the project.");
      send({ type: "status", requestId: message.requestId, text: `Compiling ${sourceFiles.length} Java source file(s) with javac\u2026` });
      const classPath = "/str/__forge_tools.jar:/files/";
      const compileCode = Number(await api.cheerpjRunMain("com.sun.tools.javac.Main", classPath, "-classpath", "/files/", "-d", "/files/", "-encoding", "UTF-8", "-Xlint:all", ...sourceFiles));
      const compileLog = consoleElement.textContent || "";
      if (compileCode !== 0 || message.mode === "build") {
        send({ type: "result", requestId: message.requestId, compileCode, runCode: null, compileLog, runtimeOutput: "" });
        return;
      }
      consoleElement.textContent = "";
      const mainClass = deriveJavaMainClass(message.entry, message.files[message.entry] || "");
      send({ type: "status", requestId: message.requestId, text: `Running ${mainClass} on CheerpJ\u2026` });
      const runCode = Number(await api.cheerpjRunMain(mainClass, classPath));
      send({ type: "result", requestId: message.requestId, compileCode, runCode, compileLog, runtimeOutput: consoleElement.textContent || "" });
    } catch (error) {
      send({ type: "fatal", requestId: message.requestId, message: error instanceof Error ? error.message : String(error) });
    }
  }
  function deriveJavaMainClass(path, source) {
    const className = path.split("/").pop().replace(/\.java$/i, "");
    const packageMatch = source.match(/\bpackage\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/);
    return packageMatch ? `${packageMatch[1]}.${className}` : className;
  }
  void (async () => {
    try {
      if (typeof api.cheerpjInit !== "function") throw new Error("CheerpJ loader did not load.");
      send({ type: "status", text: "Initializing the Java virtual machine\u2026" });
      // Use a fresh, in-memory IndexedDB inside the opaque-origin Java sandbox.
      // CheerpJ's writable /files mount normally needs origin-bound IndexedDB.
      const memoryDB = globalThis.ForgeMemoryDB;
      for (const [key, value] of Object.entries(memoryDB)) {
        if (key === "indexedDB" || key.startsWith("IDB")) Object.defineProperty(globalThis, key, { value, configurable: true });
      }
      await api.cheerpjInit({ version: 8, status: "none", overrideDocumentBase: "https://javafiddle.leaningtech.com/" });
      // The CDN cache iframe inherits our opaque sandbox origin. Use the runtime's
      // direct CORS downloader rather than its origin-specific message channel.
      for (const mount of globalThis.cheerpjFSMounts || []) {
        if (mount.downloader === globalThis.IFrameProxyDownloader) mount.downloader = globalThis.DirectDownloader;
      }
      if (typeof api.cheerpjCreateDisplay === "function") api.cheerpjCreateDisplay(1, 1, displayElement);
      send({ type: "status", text: "Downloading the Java compiler archive…" });
      const compilerResponse = await fetch("https://javafiddle.leaningtech.com/tools.jar");
      if (!compilerResponse.ok) throw new Error("Could not load javac: HTTP " + compilerResponse.status);
      const addCompilerFile = api.cheerpOSAddStringFile || api.cheerpjAddStringFile;
      addCompilerFile("/str/__forge_tools.jar", new Uint8Array(await compilerResponse.arrayBuffer()));
      send({ type: "ready" });
    } catch (error) {
      send({ type: "fatal", message: error instanceof Error ? error.message : String(error) });
    }
  })();
}
function parseJavaDiagnostics(log, files, fallbackFile) {
  const lines = String(log || "").replace(/\r/g, "").split("\n");
  const diagnostics = [];
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
      source: "javac"
    });
  }
  return diagnostics;
}
function normalizeOutputKind(value) {
  return value === "stdout" || value === "stderr" || value === "info" || value === "warn" || value === "error" || value === "success" || value === "system" ? value : "info";
}
function normalizeRunStatus(value) {
  return value === "completed" || value === "failed" || value === "stopped" || value === "unavailable" ? value : "failed";
}
function createToken() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function abortError() {
  return new DOMException("Stopped by user", "AbortError");
}
function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function raceAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
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
export {
  BrowserToolchainRunner,
  CSharpRunner,
  ClangRunner,
  JavaRunner,
  ToolchainRegistry,
  registerBuiltinToolchains
};

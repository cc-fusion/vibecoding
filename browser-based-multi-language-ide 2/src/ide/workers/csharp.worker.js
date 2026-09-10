/* C# compiler/runtime worker: Roslyn and .NET WebAssembly via WasmSharp. */

const WASMSHARP_URL = "https://cdn.jsdelivr.net/npm/@wasmsharp/core@0.10.2/src/bin/Release/net10.0/publish/wwwroot/_framework/index.js";

let wasmSharp = null;
let initializing = null;

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "initialize") {
    void initialize().then(
      () => postMessage({ type: "ready", name: "Roslyn/.NET WebAssembly", version: "WasmSharp 0.10.2" }),
      (error) => postMessage({ type: "fatal", message: friendlyError(error) })
    );
    return;
  }
  if (message.type === "execute") void execute(message);
};

async function initialize() {
  if (wasmSharp) return wasmSharp;
  if (initializing) return initializing;
  initializing = (async () => {
    postMessage({ type: "status", text: "Loading .NET WebAssembly and the Roslyn C# compiler…" });
    const core = await import(WASMSHARP_URL);
    wasmSharp = await core.WasmSharpModule.initializeAsync({
      disableWebWorker: true,
      onConfigLoaded(config) {
        const count = Array.isArray(config?.resources?.assembly) ? config.resources.assembly.length : null;
        postMessage({ type: "status", text: count ? `Loading ${count} .NET/Roslyn assemblies…` : "Loading .NET/Roslyn assemblies…" });
      },
      onDownloadResourceProgress(loaded, total) {
        if (Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
          postMessage({ type: "status", text: `Loading .NET/Roslyn resources (${loaded}/${total})…` });
        }
      },
    });
    return wasmSharp;
  })();
  try {
    return await initializing;
  } finally {
    initializing = null;
  }
}

async function execute(message) {
  const startedAt = performance.now();
  const requestId = message.requestId;
  const files = cleanFiles(message.files || {});
  const entry = typeof message.entry === "string" ? normalizePath(message.entry) : Object.keys(files)[0];
  try {
    await initialize();
    if (!Object.keys(files).length) throw new Error("No C# source files were found in the project.");
    postMessage({ type: "status", text: `Compiling ${Object.keys(files).length} C# source file(s) with Roslyn…` });
    const combined = combineSources(files, entry);
    const compilation = await wasmSharp.createCompilationAsync(combined.code);
    const compilerDiagnostics = await compilation.getDiagnosticsAsync();
    const diagnostics = mapDiagnostics(compilerDiagnostics, combined, entry);
    postDiagnostics(requestId, diagnostics);

    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      postMessage({
        type: "result",
        requestId,
        status: "failed",
        exitCode: 1,
        durationMs: performance.now() - startedAt,
        summary: "Roslyn compilation failed",
        diagnostics,
      });
      return;
    }

    postOutput(requestId, "build", "success", `Roslyn compiled ${Object.keys(files).length} source file(s).`);
    if (message.mode === "build") {
      postMessage({
        type: "result",
        requestId,
        status: "completed",
        exitCode: 0,
        durationMs: performance.now() - startedAt,
        summary: `${Object.keys(files).length} C# source file(s) compiled`,
        diagnostics,
      });
      return;
    }

    postMessage({ type: "status", text: `Running ${entry} on .NET WebAssembly` });
    const result = await compilation.run();
    if (result.stdOut) postOutput(requestId, "run", "stdout", result.stdOut);
    if (result.stdErr) postOutput(requestId, "run", "stderr", result.stdErr);
    const runDiagnostics = result.success ? [] : mapDiagnostics(result.diagnostics || [], combined, entry);
    const mergedDiagnostics = dedupeDiagnostics([...diagnostics, ...runDiagnostics]);
    if (runDiagnostics.length) postDiagnostics(requestId, mergedDiagnostics);
    postMessage({
      type: "result",
      requestId,
      status: result.success ? "completed" : "failed",
      exitCode: result.success ? 0 : 1,
      durationMs: performance.now() - startedAt,
      summary: result.success ? "C# program completed" : "C# compilation or execution failed",
      diagnostics: mergedDiagnostics,
    });
  } catch (error) {
    postOutput(requestId, message.mode === "build" ? "build" : "run", "error", friendlyError(error));
    postMessage({
      type: "result",
      requestId,
      status: "failed",
      exitCode: 1,
      durationMs: performance.now() - startedAt,
      summary: friendlyError(error),
      diagnostics: [],
    });
  }
}

function combineSources(files, entry) {
  const paths = Object.keys(files).sort((a, b) => a === entry ? -1 : b === entry ? 1 : a.localeCompare(b));
  const directives = [];
  const prepared = [];

  for (const path of paths) {
    const original = files[path];
    let transformed = original;
    const usingPattern = /^(?:(?:global\s+)?using\s+(?:static\s+)?[A-Za-z_][\w.]*(?:\s*=\s*[^;]+)?|extern\s+alias\s+[A-Za-z_]\w*)\s*;[^\S\r\n]*(?:\r?\n|$)/gm;
    transformed = transformed.replace(usingPattern, (text, offset) => {
      directives.push({
        text: text.trimEnd(),
        path,
        sourceOffset: Number(offset),
        global: /^global\s+using\b/.test(text.trimStart()),
      });
      return text.replace(/[^\r\n]/g, " ");
    });

    let closesNamespace = false;
    transformed = transformed.replace(/^(\s*namespace\s+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/m, (text, declaration) => {
      closesNamespace = true;
      return declaration + text.slice(declaration.length, -1).replace(/[^\r\n]/g, " ") + "{";
    });
    prepared.push({ path, original, transformed, closesNamespace });
  }

  directives.sort((a, b) => Number(b.global) - Number(a.global));
  let code = "";
  const ranges = [];
  for (const directive of directives) {
    code += `#line ${lineAt(files[directive.path], directive.sourceOffset)} \"${escapeLinePath(directive.path)}\"\n`;
    const start = code.length;
    code += directive.text + "\n";
    ranges.push({ start, end: code.length, path: directive.path, sourceOffset: directive.sourceOffset });
  }

  for (const file of prepared) {
    code += `\n#line 1 \"${escapeLinePath(file.path)}\"\n`;
    const start = code.length;
    code += file.transformed;
    ranges.push({ start, end: start + file.transformed.length, path: file.path, sourceOffset: 0 });
    if (file.closesNamespace) code += "\n}";
    code += "\n";
  }
  return { code, ranges, files };
}

function mapDiagnostics(items, combined, fallbackFile) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const start = Math.max(0, Number(item?.location?.start) || 0);
    const end = Math.max(start, Number(item?.location?.end) || start + Number(item?.location?.length) || start + 1);
    const range = combined.ranges.find((candidate) => start >= candidate.start && start <= candidate.end);
    const file = range?.path || fallbackFile || Object.keys(combined.files)[0] || "/Program.cs";
    const source = combined.files[file] || "";
    const sourceStart = range ? range.sourceOffset + Math.max(0, start - range.start) : 0;
    const sourceEnd = range ? range.sourceOffset + Math.max(1, end - range.start) : sourceStart + 1;
    const first = positionAt(source, sourceStart);
    const last = positionAt(source, Math.min(source.length, sourceEnd));
    const severityName = String(item?.severity || "Info").toLowerCase();
    return {
      severity: severityName === "error" ? "error" : severityName === "warning" ? "warning" : "info",
      file,
      line: first.line,
      column: first.column,
      endLine: last.line,
      endColumn: last.column,
      message: String(item?.message || "C# compiler diagnostic"),
      source: "roslyn",
      code: item?.id ? String(item.id) : undefined,
    };
  });
}

function postDiagnostics(requestId, diagnostics) {
  for (const diagnostic of diagnostics) {
    const code = diagnostic.code ? ` ${diagnostic.code}` : "";
    postOutput(
      requestId,
      "build",
      diagnostic.severity === "error" ? "error" : diagnostic.severity === "warning" ? "warn" : "info",
      `${diagnostic.file}(${diagnostic.line},${diagnostic.column}): ${diagnostic.severity}${code}: ${diagnostic.message}`
    );
  }
}

function postOutput(requestId, scope, kind, text) {
  const value = String(text || "").trimEnd();
  if (value) postMessage({ type: "output", requestId, scope, kind, text: value });
}

function cleanFiles(input) {
  const output = {};
  for (const [path, value] of Object.entries(input)) {
    if (typeof value === "string" && /\.cs$/i.test(path)) output[normalizePath(path)] = value;
  }
  return output;
}

function normalizePath(path) {
  return "/" + String(path).replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
}

function escapeLinePath(path) {
  return path.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

function lineAt(source, offset) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}

function positionAt(source, offset) {
  const safe = Math.max(0, Math.min(source.length, offset));
  const before = source.slice(0, safe);
  const lastBreak = before.lastIndexOf("\n");
  return { line: before.split("\n").length, column: safe - lastBreak };
}

function dedupeDiagnostics(diagnostics) {
  const seen = new Set();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code || ""}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function friendlyError(error) {
  if (error instanceof Error) return error.message || error.name;
  if (error && typeof error.message === "string") return error.message;
  return String(error || "Unknown C# toolchain error");
}

/*
 * C/C++ compilation and execution worker.
 *
 * The preferred engine is Wasmer's browser SDK running the clang/clang WASIX
 * package.  It supports a modern Clang toolchain and a complete writable
 * project directory.  Wasmer needs cross-origin isolation, so a functional
 * LLVM 8 WASI fallback is retained for hosts that cannot provide COOP/COEP.
 * Source files are only copied into an in-memory filesystem in this worker.
 */

const WASMER_SDK_URL = "https://unpkg.com/@wasmer/sdk@0.10.0/dist/index.mjs";
const WASMER_PACKAGE = "clang/clang";
const LEGACY_BASE = "https://raw.githubusercontent.com/binji/wasm-clang/648c4a89997a351eef75cdaec3ef5b89d4937dec/";

let engine = null;
let initializing = null;
let legacyApiClass = null;
const legacyBuffers = new Map();
const legacyModules = new Map();

const postStatus = (text) => postMessage({ type: "status", text });
const postOutput = (requestId, scope, kind, text) => {
  const value = stripAnsi(String(text || "")).trimEnd();
  if (value) postMessage({ type: "output", requestId, scope, kind, text: value });
};

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "initialize") {
    void ensureEngine().then(
      () => postMessage({ type: "ready", name: engine.name, version: engine.version }),
      (error) => postMessage({ type: "fatal", message: friendlyError(error) })
    );
    return;
  }
  if (message.type === "execute") void execute(message);
};

async function ensureEngine() {
  if (engine) return engine;
  if (initializing) return initializing;
  initializing = (async () => {
    if (self.crossOriginIsolated) {
      try {
        postStatus("Loading Wasmer WebAssembly runtime…");
        const sdk = await import(WASMER_SDK_URL);
        await sdk.init();
        postStatus("Downloading the Clang toolchain (first run is a large, cached download)…");
        const clang = await sdk.Wasmer.fromRegistry(WASMER_PACKAGE);
        engine = { kind: "wasmer", name: "Clang/WASIX", version: "Wasmer SDK 0.10.0", sdk, clang };
        return engine;
      } catch (error) {
        postMessage({ type: "notice", text: `Modern Clang could not start (${friendlyError(error)}). Loading the compatibility toolchain…` });
      }
    } else {
      postMessage({ type: "notice", text: "This host is not cross-origin isolated; using the compatible in-worker Clang/WASI toolchain." });
    }

    postStatus("Loading the Clang/WASI compatibility runtime…");
    const response = await fetch(LEGACY_BASE + "shared.js");
    if (!response.ok) throw new Error(`Could not download the compatibility runtime (HTTP ${response.status})`);
    const source = await response.text();
    legacyApiClass = new Function(`${source}\n;return API;`)();
    engine = { kind: "legacy", name: "Clang/LLD WASI", version: "LLVM 8 compatibility" };
    return engine;
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
  try {
    await ensureEngine();
    const files = cleanFiles(message.files || {});
    const requestedEntries = Array.isArray(message.entries) && message.entries.length
      ? message.entries
      : [message.entry];
    const entries = [];
    for (const requested of requestedEntries) {
      if (typeof requested !== "string") continue;
      const resolved = resolveCompilationEntry(files, normalizeProjectPath(requested));
      if (resolved && !entries.includes(resolved)) entries.push(resolved);
    }
    if (!entries.length) throw new Error("No C or C++ entry file was found in the project.");

    const allDiagnostics = [];
    let failed = 0;
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      postStatus(`Compiling ${entry} (${engine.name})`);
      const result = engine.kind === "wasmer"
        ? await buildWithWasmer(files, entry, message.mode === "run", requestId, index)
        : await buildWithLegacy(files, entry, message.mode === "run", requestId, index);
      allDiagnostics.push(...result.diagnostics);
      if (!result.ok) failed++;
      if (message.mode === "run" || !result.ok) {
        postMessage({
          type: "result",
          requestId,
          status: result.stopped ? "stopped" : result.ok ? "completed" : "failed",
          exitCode: result.exitCode,
          durationMs: performance.now() - startedAt,
          summary: result.summary,
          diagnostics: allDiagnostics,
        });
        return;
      }
    }

    postMessage({
      type: "result",
      requestId,
      status: failed ? "failed" : "completed",
      exitCode: failed ? 1 : 0,
      durationMs: performance.now() - startedAt,
      summary: `${entries.length - failed}/${entries.length} C/C++ target(s) compiled`,
      diagnostics: allDiagnostics,
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

async function buildWithWasmer(files, entry, runAfterBuild, requestId, buildIndex) {
  const { Directory, Wasmer } = engine.sdk;
  const project = new Directory();
  for (const [path, contents] of Object.entries(files)) {
    await project.writeFile(toRelative(path), contents);
  }

  const sources = selectSources(files, entry);
  const outputName = `.forge-${buildIndex}.wasm`;
  const diagnostics = [];
  const objects = [];

  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    const language = sourceLanguage(source);
    const object = `.forge-${buildIndex}-${index}.o`;
    objects.push(`/project/${object}`);
    const args = [
      ...(language === "cpp" ? ["--driver-mode=g++", "-std=c++20"] : ["-std=c17"]),
      "-O2",
      "-fdiagnostics-color=never",
      "-ferror-limit=50",
      "-I/project",
      "-c",
      `/project/${toRelative(source)}`,
      "-o",
      `/project/${object}`,
    ];
    postOutput(requestId, "build", "system", `clang ${args.join(" ")}`);
    const output = await runWasmerClang(project, args);
    const compilerText = [output.stdout, output.stderr].filter(Boolean).join("\n");
    diagnostics.push(...parseClangDiagnostics(compilerText, files, source));
    if (output.stdout) postOutput(requestId, "build", "info", output.stdout);
    if (output.stderr) postOutput(requestId, "build", output.code === 0 ? "warn" : "error", output.stderr);
    if (!(output.ok ?? output.code === 0)) {
      return { ok: false, exitCode: Number(output.code ?? 1), diagnostics: dedupeDiagnostics(diagnostics), summary: `Clang failed for ${source}` };
    }
  }

  const linkArgs = [
    ...(sources.some((source) => sourceLanguage(source) === "cpp") ? ["--driver-mode=g++"] : []),
    ...objects,
    "-o",
    `/project/${outputName}`,
  ];
  postOutput(requestId, "build", "system", `clang ${linkArgs.join(" ")}`);
  const linkOutput = await runWasmerClang(project, linkArgs);
  const linkText = [linkOutput.stdout, linkOutput.stderr].filter(Boolean).join("\n");
  diagnostics.push(...parseClangDiagnostics(linkText, files, entry));
  if (linkOutput.stdout) postOutput(requestId, "build", "info", linkOutput.stdout);
  if (linkOutput.stderr) postOutput(requestId, "build", linkOutput.code === 0 ? "warn" : "error", linkOutput.stderr);
  if (!(linkOutput.ok ?? linkOutput.code === 0)) {
    return { ok: false, exitCode: Number(linkOutput.code ?? 1), diagnostics: dedupeDiagnostics(diagnostics), summary: `LLD failed for ${entry}` };
  }

  postOutput(requestId, "build", "success", `Clang compiled ${sources.length} source file(s) for ${entry}.`);
  if (!runAfterBuild) return { ok: true, exitCode: 0, diagnostics: dedupeDiagnostics(diagnostics), summary: `${entry} compiled` };

  postStatus(`Running ${entry} in the WASIX sandbox`);
  const wasm = await project.readFile(outputName);
  const executable = await Wasmer.fromFile(wasm);
  const instance = await executable.entrypoint.run({ mount: { "/project": project } });
  const result = await instance.wait();
  if (result.stdout) postOutput(requestId, "run", "stdout", result.stdout);
  if (result.stderr) postOutput(requestId, "run", "stderr", result.stderr);
  const code = Number(result.code ?? (result.ok ? 0 : 1));
  return {
    ok: result.ok ?? code === 0,
    exitCode: code,
    diagnostics: dedupeDiagnostics(diagnostics),
    summary: `Process exited with code ${code}`,
  };
}

async function runWasmerClang(project, args) {
  const process = await engine.clang.entrypoint.run({ args, mount: { "/project": project } });
  return process.wait();
}

async function buildWithLegacy(files, entry, runAfterBuild, requestId, buildIndex) {
  const rawLog = { text: "" };
  const api = new legacyApiClass({
    memfs: LEGACY_BASE + "memfs",
    clang: LEGACY_BASE + "clang",
    lld: LEGACY_BASE + "lld",
    sysroot: LEGACY_BASE + "sysroot.tar",
    readBuffer: readLegacyBuffer,
    compileStreaming: compileLegacyModule,
    hostWrite: (text) => { rawLog.text += String(text); },
    showTiming: false,
  });

  postStatus("Preparing the in-memory WASI filesystem…");
  await api.ready;
  addLegacyProject(api.memfs, files);
  const sources = selectSources(files, entry);
  const clang = await api.getModule(api.clangFilename);
  const objects = [];
  const diagnostics = [];

  for (let index = 0; index < sources.length; index++) {
    const language = sourceLanguage(sources[index]);
    const input = `project/${toRelative(sources[index])}`;
    const object = `.forge-${buildIndex}-${index}.o`;
    objects.push(object);
    const start = rawLog.text.length;
    try {
      await api.run(
        clang,
        "clang",
        "-cc1",
        "-emit-obj",
        ...api.clangCommonArgs,
        "-fno-color-diagnostics",
        language === "cpp" ? "-std=c++17" : "-std=c17",
        "-Iproject",
        "-O2",
        "-o",
        object,
        "-x",
        language === "cpp" ? "c++" : "c",
        input
      );
      const text = rawLog.text.slice(start);
      const sourceDiagnostics = parseClangDiagnostics(text, files, sources[index]);
      diagnostics.push(...sourceDiagnostics);
      if (text.trim()) postOutput(requestId, "build", sourceDiagnostics.some((item) => item.severity === "warning") ? "warn" : "info", text);
    } catch (error) {
      const text = rawLog.text.slice(start);
      diagnostics.push(...parseClangDiagnostics(text, files, sources[index]));
      postOutput(requestId, "build", "error", text || friendlyError(error));
      return { ok: false, exitCode: Number(error && error.code || 1), diagnostics: dedupeDiagnostics(diagnostics), summary: `Clang failed for ${sources[index]}` };
    }
  }

  const wasm = `.forge-${buildIndex}.wasm`;
  const lld = await api.getModule(api.lldFilename);
  const linkStart = rawLog.text.length;
  try {
    await api.run(
      lld,
      "wasm-ld",
      "--no-threads",
      "--export-dynamic",
      "-z",
      "stack-size=1048576",
      "-Llib/wasm32-wasi",
      "lib/wasm32-wasi/crt1.o",
      ...objects,
      "-lc",
      ...(sources.some((source) => sourceLanguage(source) === "cpp") ? ["-lc++", "-lc++abi"] : []),
      "-o",
      wasm
    );
  } catch (error) {
    const text = rawLog.text.slice(linkStart);
    postOutput(requestId, "build", "error", text || friendlyError(error));
    return { ok: false, exitCode: Number(error && error.code || 1), diagnostics: dedupeDiagnostics(diagnostics), summary: `LLD failed for ${entry}` };
  }

  postOutput(requestId, "build", "success", `Clang/LLD compiled ${sources.length} source file(s) for ${entry}.`);
  if (!runAfterBuild) return { ok: true, exitCode: 0, diagnostics: dedupeDiagnostics(diagnostics), summary: `${entry} compiled` };

  postStatus(`Running ${entry} in the WASI sandbox`);
  const binary = api.memfs.getFileContents(wasm);
  const module = await WebAssembly.compile(binary);
  const runStart = rawLog.text.length;
  let code = 0;
  let runtimeError = null;
  try {
    await api.run(module, wasm);
  } catch (error) {
    if (typeof error?.code === "number") code = error.code;
    else {
      code = 1;
      runtimeError = friendlyError(error);
    }
  }
  const stdout = cleanLegacyRunOutput(rawLog.text.slice(runStart), wasm);
  if (stdout) postOutput(requestId, "run", "stdout", stdout);
  if (runtimeError) postOutput(requestId, "run", "error", runtimeError);
  return { ok: code === 0, exitCode: code, diagnostics: dedupeDiagnostics(diagnostics), summary: `Process exited with code ${code}` };
}

function cleanFiles(input) {
  const output = {};
  for (const [path, value] of Object.entries(input)) {
    if (typeof path === "string" && typeof value === "string") output[normalizeProjectPath(path)] = value;
  }
  return output;
}

function normalizeProjectPath(path) {
  const parts = String(path).replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..");
  return "/" + parts.join("/");
}

function toRelative(path) {
  return normalizeProjectPath(path).slice(1);
}

function sourceLanguage(path) {
  return /\.(c|i)$/i.test(path) ? "c" : "cpp";
}

function isCompilationUnit(path) {
  return /\.(c|i|cc|cpp|cxx|c\+\+|ii)$/i.test(path);
}

function resolveCompilationEntry(files, requested) {
  if (requested in files && isCompilationUnit(requested)) return requested;
  const wantsC = /\.(c|h)$/i.test(requested);
  const preferred = Object.keys(files).filter((path) => isCompilationUnit(path) && (wantsC ? sourceLanguage(path) === "c" : sourceLanguage(path) === "cpp")).sort();
  const candidates = preferred.length ? preferred : Object.keys(files).filter(isCompilationUnit).sort();
  return candidates.find((path) => /\bmain\s*\(/.test(files[path])) || candidates[0] || null;
}

function selectSources(files, entry) {
  const candidates = Object.keys(files).filter(isCompilationUnit).sort();
  const selected = [entry];
  for (const path of candidates) {
    if (path === entry) continue;
    if (/\bmain\s*\(/.test(files[path])) continue;
    selected.push(path);
  }
  return selected;
}

function dedupeDiagnostics(diagnostics) {
  const seen = new Set();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.severity}:${diagnostic.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addLegacyProject(memfs, files) {
  const directories = new Set(["project"]);
  for (const path of Object.keys(files)) {
    const parts = toRelative(path).split("/");
    let current = "project";
    for (const part of parts.slice(0, -1)) {
      current += "/" + part;
      directories.add(current);
    }
  }
  for (const directory of Array.from(directories).sort((a, b) => a.split("/").length - b.split("/").length)) {
    memfs.addDirectory(directory);
  }
  const encoder = new TextEncoder();
  for (const [path, contents] of Object.entries(files)) memfs.addFile(`project/${toRelative(path)}`, encoder.encode(contents));
}

async function readLegacyBuffer(filename) {
  const url = new URL(filename, LEGACY_BASE).href;
  if (!legacyBuffers.has(url)) {
    legacyBuffers.set(url, (async () => {
      postStatus(`Downloading ${url.split("/").pop()}…`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not download ${url} (HTTP ${response.status})`);
      return response.arrayBuffer();
    })());
  }
  return legacyBuffers.get(url);
}

async function compileLegacyModule(filename) {
  const url = new URL(filename, LEGACY_BASE).href;
  if (!legacyModules.has(url)) legacyModules.set(url, WebAssembly.compile(await readLegacyBuffer(url)));
  return legacyModules.get(url);
}

function parseClangDiagnostics(text, files, fallbackFile) {
  const diagnostics = [];
  const seen = new Set();
  const clean = stripAnsi(String(text || ""));
  const pattern = /^(.*?):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.+)$/gm;
  let match;
  while ((match = pattern.exec(clean))) {
    let file = match[1].replace(/^\/project\//, "/").replace(/^project\//, "/");
    if (!(file in files)) {
      const suffix = "/" + file.replace(/^\/+/, "");
      file = Object.keys(files).find((path) => path.endsWith(suffix)) || fallbackFile;
    }
    const severity = match[4].includes("error") ? "error" : match[4] === "warning" ? "warning" : "info";
    const key = `${file}:${match[2]}:${match[3]}:${severity}:${match[5]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    diagnostics.push({
      severity,
      file,
      line: Math.max(1, Number(match[2]) || 1),
      column: Math.max(1, Number(match[3]) || 1),
      message: match[5].trim(),
      source: "clang",
    });
  }
  return diagnostics;
}

function cleanLegacyRunOutput(text, wasmName) {
  let output = stripAnsi(String(text || ""));
  const escaped = wasmName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  output = output.replace(new RegExp(`^>\\s*${escaped}\\s*\\n?`), "");
  output = output.replace(/\n?Error: process exited with code \d+\.\s*$/s, "");
  return output.trimEnd();
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function friendlyError(error) {
  if (error instanceof Error) return error.message || error.name;
  if (error && typeof error.message === "string") return error.message;
  return String(error || "Unknown C/C++ toolchain error");
}

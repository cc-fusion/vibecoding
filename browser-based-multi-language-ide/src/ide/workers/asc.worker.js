/* eslint-disable */
/**
 * AssemblyScript compiler worker (module worker).
 * Loads the real `asc` compiler (assemblyscript@0.27.31, with its binaryen
 * dependency) from esm.sh and compiles project sources to a WebAssembly binary
 * using an in-memory filesystem backed by the IDE's virtual project.
 *
 * In:  { type: "compile", files: {path: text}, entry: "/assembly/index.ts", optimize: boolean }
 * Out: status | compiled { ok, binary, wat, stdout, stderr, diagnostics, error }
 */
const ASC_VERSION = "0.27.31";
const ASC_URL = `https://esm.sh/assemblyscript@${ASC_VERSION}/dist/asc.js`;
const post = (msg, transfer) => self.postMessage(msg, transfer || []);
let ascPromise = null;

function loadAsc() {
  if (!ascPromise) {
    post({ type: "status", text: `Loading AssemblyScript compiler ${ASC_VERSION} (asc + binaryen) from esm.sh…` });
    ascPromise = import(/* @vite-ignore */ ASC_URL)
      .then((m) => {
        const asc = m.default && typeof m.default.main === "function" ? m.default : m;
        if (typeof asc.main !== "function") throw new Error("asc module loaded but has no main()");
        return asc;
      })
      .catch((err) => {
        ascPromise = null;
        throw err;
      });
  }
  return ascPromise;
}

function normalize(p) {
  const parts = p.replace(/\\/g, "/").split("/");
  const out = [];
  for (const s of parts) {
    if (!s || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return "/" + out.join("/");
}

function lineColFromOffset(text, offset) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else col++;
  }
  return { line, col };
}

function categoryToSeverity(category) {
  // DiagnosticCategory: PEDANTIC=0, INFO=1, WARNING=2, ERROR=3
  if (category === 3 || category === "ERROR") return "error";
  if (category === 2 || category === "WARNING") return "warning";
  return "info";
}

/** Fallback: parse asc's textual stderr output when structured ranges are unavailable. */
function parseStderr(stderr) {
  const out = [];
  const lines = stderr.split("\n");
  let current = null;
  for (const raw of lines) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, "");
    const head = /^(ERROR|WARNING|INFO|PEDANTIC)\s+(\w+):\s*(.*)$/.exec(line);
    if (head) {
      current = { severity: categoryToSeverity(head[1]), code: head[2], message: head[3].trim(), file: null, line: 1, column: 1 };
      out.push(current);
      continue;
    }
    const loc = /in\s+(.+?)\((\d+),(\d+)\)\s*$/.exec(line);
    if (loc && current && !current.file) {
      current.file = normalize(loc[1]);
      current.line = Number(loc[2]);
      current.column = Number(loc[3]);
    }
  }
  return out;
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type !== "compile") return;
  const files = msg.files || {};
  const entry = normalize(msg.entry);
  const started = performance.now();
  let asc;
  try {
    asc = await loadAsc();
  } catch (err) {
    post({ type: "compiled", ok: false, error: `Failed to load the AssemblyScript compiler: ${(err && err.message) || err}`, stdout: "", stderr: "", diagnostics: [], duration: performance.now() - started });
    return;
  }

  const outputs = {};
  const structured = [];
  let stdoutText = "";
  let stderrText = "";
  const stdout = { write: (s) => (stdoutText += String(s)) };
  const stderr = { write: (s) => (stderrText += String(s)) };

  const readFile = (filename, baseDir) => {
    const candidates = [normalize(filename), normalize((baseDir || "/") + "/" + filename)];
    for (const c of candidates) if (Object.prototype.hasOwnProperty.call(files, c)) return files[c];
    return null;
  };
  const writeFile = (filename, contents) => {
    outputs[filename] = contents;
  };
  const listFiles = (dirname, baseDir) => {
    const dir = normalize((baseDir || "/") + "/" + dirname);
    const prefix = dir === "/" ? "/" : dir + "/";
    const names = new Set();
    for (const p of Object.keys(files)) {
      if (p.startsWith(prefix)) {
        const rest = p.slice(prefix.length);
        if (rest && !rest.includes("/") && /\.ts$/.test(rest)) names.add(rest);
      }
    }
    return Array.from(names);
  };
  const reportDiagnostic = (d) => {
    try {
      const item = { severity: categoryToSeverity(d.category), code: d.code != null ? String(d.code) : "", message: String(d.message || ""), file: null, line: 1, column: 1 };
      const range = d.range;
      if (range && range.source) {
        const src = range.source;
        const path = src.normalizedPath || src.path || src.internalPath || "";
        if (path && !path.startsWith("~lib")) item.file = normalize(path);
        // asc's structured diagnostics carry the normalized path but not the text; the
        // virtual project already has the source, so offsets map to line/column here.
        const projectPath = item.file ? item.file : null;
        const text = typeof src.text === "string" ? src.text : projectPath && Object.prototype.hasOwnProperty.call(files, projectPath) ? files[projectPath] : null;
        if (text && typeof range.start === "number") {
          const lc = lineColFromOffset(text, range.start);
          item.line = lc.line;
          item.column = lc.col;
          if (typeof range.end === "number") {
            const end = lineColFromOffset(text, range.end);
            item.endLine = end.line;
            item.endColumn = end.col;
          }
        }
      }
      structured.push(item);
    } catch (err) {
      /* ignore malformed diagnostics; stderr parse remains as fallback */
    }
  };

  const argv = [entry.replace(/^\//, ""), "--outFile", "output.wasm", "--textFile", "output.wat", msg.optimize === false ? "-O0" : "-O2", "--runtime", "incremental", "--noColors"];

  try {
    const result = await asc.main(argv, { stdout, stderr, readFile, writeFile, listFiles, reportDiagnostic });
    const error = result && result.error ? result.error : null;
    let diagnostics = structured.filter((d) => d.file);
    const parsed = parseStderr(stderrText);
    const located = parsed.filter((p) => p.file);
    // Prefer the structured channel; fall back to (or repair from) the textual report.
    if (diagnostics.length < located.length) diagnostics = located;
    else {
      for (const d of diagnostics) {
        if (d.line === 1 && d.column === 1) {
          const p = located.find((x) => x.message === d.message && x.file === d.file);
          if (p) {
            d.line = p.line;
            d.column = p.column;
          }
        }
      }
    }
    // Merge messages that have no location so nothing is silently dropped.
    for (const p of parsed) if (!p.file && !diagnostics.some((d) => d.message === p.message)) diagnostics.push({ ...p, file: entry });

    const wasm = outputs["output.wasm"];
    const wat = outputs["output.wat"];
    if (error || !wasm) {
      post({ type: "compiled", ok: false, error: error ? String(error.message || error) : "Compiler produced no output", stdout: stdoutText, stderr: stderrText, diagnostics, duration: performance.now() - started });
      return;
    }
    const binary = wasm instanceof Uint8Array ? wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) : new Uint8Array(wasm).buffer;
    post({ type: "compiled", ok: true, binary, wat: typeof wat === "string" ? wat : "", stdout: stdoutText, stderr: stderrText, diagnostics, duration: performance.now() - started }, [binary]);
  } catch (err) {
    post({ type: "compiled", ok: false, error: `Compiler crashed: ${(err && (err.stack || err.message)) || err}`, stdout: stdoutText, stderr: stderrText, diagnostics: parseStderr(stderrText), duration: performance.now() - started });
  }
};

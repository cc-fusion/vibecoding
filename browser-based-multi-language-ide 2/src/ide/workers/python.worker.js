/* eslint-disable */
/**
 * Pyodide execution worker (module worker).
 * Pyodide is downloaded lazily from jsDelivr on the first run and kept warm.
 * Messages in:  { type: "init" } | { type: "run", files: {path: text}, entry: "/main.py" }
 * Messages out: status | ready | stdout | stderr | done | fatal
 */
const PYODIDE_VERSION = "0.27.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const HOME = "/home/pyodide";

const post = (msg) => self.postMessage(msg);
let pyodide = null;
let loading = null;

function ensurePyodide() {
  if (pyodide) return Promise.resolve(pyodide);
  if (!loading) {
    loading = (async () => {
      post({ type: "status", text: `Downloading Pyodide ${PYODIDE_VERSION} runtime from jsDelivr (first run only, ~10 MB)…` });
      const mod = await import(/* @vite-ignore */ INDEX_URL + "pyodide.mjs");
      post({ type: "status", text: "Initializing CPython (WebAssembly)…" });
      const py = await mod.loadPyodide({ indexURL: INDEX_URL });
      py.setStdout({ batched: (text) => post({ type: "stdout", text }) });
      py.setStderr({ batched: (text) => post({ type: "stderr", text }) });
      pyodide = py;
      post({ type: "ready", version: py.version });
      return py;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

function mkdirp(FS, dir) {
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    try {
      FS.mkdir(cur);
    } catch (e) {
      /* exists */
    }
  }
}

const RUNNER = `
import sys, os, traceback, runpy

def __ide_run(entry):
    # Drop cached project modules so edits to imported files are picked up.
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None)
        if isinstance(f, str) and f.startswith("${HOME}"):
            del sys.modules[name]
    d = os.path.dirname(entry)
    for p in (d, "${HOME}"):
        if p not in sys.path:
            sys.path.insert(0, p)
    os.chdir(d)
    sys.argv = [os.path.basename(entry)]
    code = 0
    try:
        runpy.run_path(entry, run_name="__main__")
    except SystemExit as e:
        c = e.code
        if c is None:
            code = 0
        elif isinstance(c, int):
            code = c
        else:
            sys.stderr.write(str(c) + "\\n")
            code = 1
    except BaseException:
        etype, value, tb = sys.exc_info()
        cur = tb
        while cur is not None and cur.tb_frame.f_code.co_filename != entry:
            cur = cur.tb_next
        sys.stderr.write("".join(traceback.format_exception(etype, value, cur if cur is not None else tb)))
        code = 1
    finally:
        try:
            sys.stdout.flush(); sys.stderr.flush()
        except Exception:
            pass
    return code

__ide_run(__ide_entry__)
`;

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type === "init") {
    try {
      await ensurePyodide();
    } catch (err) {
      post({ type: "fatal", message: `Failed to load Pyodide: ${(err && err.message) || err}` });
    }
    return;
  }
  if (msg.type !== "run") return;
  const started = performance.now();
  try {
    const py = await ensurePyodide();
    const FS = py.FS;
    for (const [path, content] of Object.entries(msg.files || {})) {
      const full = HOME + path;
      mkdirp(FS, full.slice(0, full.lastIndexOf("/")));
      FS.writeFile(full, content, { encoding: "utf8" });
    }
    const entry = HOME + msg.entry;
    py.globals.set("__ide_entry__", entry);
    post({ type: "status", text: `Running ${msg.entry}…` });
    const code = await py.runPythonAsync(RUNNER);
    const exitCode = typeof code === "number" ? code : Number(code) || 0;
    post({ type: "done", exitCode, duration: performance.now() - started });
  } catch (err) {
    post({ type: "stderr", text: String((err && err.message) || err) });
    post({ type: "done", exitCode: 1, duration: performance.now() - started });
  }
};

/* eslint-disable */
/**
 * Isolated WebAssembly execution worker.
 * In:  { type: "run", binary: ArrayBuffer, entry: "main" }
 * Out: console | exports | result | error | done
 *
 * Provides the AssemblyScript host ABI (env.abort/trace/seed, env["console.*"])
 * and decodes AssemblyScript UTF-16 strings directly from linear memory.
 */
(function () {
  "use strict";
  var post = function (m) {
    self.postMessage(m);
  };
  var memory = null;

  function getString(ptr) {
    if (!ptr || !memory) return "";
    try {
      var buf = memory.buffer;
      var byteLen = new Uint32Array(buf)[(ptr - 4) >>> 2];
      var u16 = new Uint16Array(buf, ptr, byteLen >>> 1);
      var chunks = [];
      for (var i = 0; i < u16.length; i += 8192) chunks.push(String.fromCharCode.apply(null, u16.subarray(i, i + 8192)));
      return chunks.join("");
    } catch (e) {
      return "<invalid string pointer " + ptr + ">";
    }
  }
  function consoleFn(level) {
    return function (ptr) {
      post({ type: "console", level: level, text: getString(ptr) });
    };
  }

  self.onmessage = async function (e) {
    var data = e.data || {};
    if (data.type !== "run") return;
    var started = performance.now();
    var entry = data.entry || "main";
    try {
      var module = await WebAssembly.compile(data.binary);
      var env = {
        abort: function (msg, file, line, col) {
          var text = "abort: " + getString(msg) + " in " + getString(file) + "(" + line + ":" + col + ")";
          post({ type: "error", message: text });
          throw new Error(text);
        },
        trace: function (msg, n) {
          var extra = Array.prototype.slice.call(arguments, 2, 2 + (n || 0));
          post({ type: "console", level: "log", text: "trace: " + getString(msg) + (extra.length ? " " + extra.join(", ") : "") });
        },
        seed: function () {
          return Date.now() * Math.random();
        },
        "console.log": consoleFn("log"),
        "console.info": consoleFn("info"),
        "console.debug": consoleFn("log"),
        "console.warn": consoleFn("warn"),
        "console.error": consoleFn("error"),
        "Date.now": function () {
          return Date.now();
        },
        "performance.now": function () {
          return performance.now();
        },
      };
      var imports = { env: env };
      // Stub any additional imports the module requests so instantiate() gives a
      // clear error only when the import is actually *called*.
      WebAssembly.Module.imports(module).forEach(function (imp) {
        if (!imports[imp.module]) imports[imp.module] = {};
        if (!(imp.name in imports[imp.module])) {
          if (imp.kind === "function") {
            imports[imp.module][imp.name] = function () {
              throw new Error("Unsupported host import called: " + imp.module + "." + imp.name);
            };
          } else if (imp.kind === "memory") {
            imports[imp.module][imp.name] = new WebAssembly.Memory({ initial: 1 });
          } else if (imp.kind === "table") {
            imports[imp.module][imp.name] = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
          } else if (imp.kind === "global") {
            imports[imp.module][imp.name] = new WebAssembly.Global({ value: "i32", mutable: false }, 0);
          }
        }
      });
      var instance = await WebAssembly.instantiate(module, imports);
      memory = instance.exports.memory || null;
      var fnExports = Object.keys(instance.exports).filter(function (k) {
        return typeof instance.exports[k] === "function" && !k.startsWith("__");
      });
      post({ type: "exports", names: fnExports });
      if (typeof instance.exports._start === "function") instance.exports._start();
      var fn = instance.exports[entry];
      if (typeof fn === "function") {
        var result = fn();
        post({ type: "result", text: entry + "() returned " + String(result) });
      } else {
        post({ type: "console", level: "info", text: 'Module instantiated. No exported "' + entry + '" function to call; exports: ' + (fnExports.join(", ") || "(none)") });
      }
      post({ type: "done", exitCode: 0, duration: performance.now() - started });
    } catch (err) {
      var message = String((err && (err.message || err)) || err);
      if (!/^abort:/.test(message)) post({ type: "error", message: (err && err.name ? err.name + ": " : "") + message });
      post({ type: "done", exitCode: 1, duration: performance.now() - started });
    }
  };
})();

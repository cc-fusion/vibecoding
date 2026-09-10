/* eslint-disable */
/**
 * Isolated JavaScript execution worker.
 *
 * Receives { type: "run", modules: { "/path.js": code }, entry: "/path.js" }.
 * Modules are evaluated with a tiny CommonJS loader so multi-file projects
 * (including TypeScript compiled to CommonJS) can `require` each other.
 *
 * Emits: console | error | result | done
 *
 * This worker never shares memory with the IDE. Stop == worker.terminate().
 */
(function () {
  "use strict";
  var post = function (msg) {
    self.postMessage(msg);
  };
  var start = 0;
  var finished = false;
  var bodyDone = false;
  var timeouts = new Set();
  var intervals = new Set();

  // ---------- safe value formatting ----------
  function typeName(v) {
    return Object.prototype.toString.call(v).slice(8, -1);
  }
  function format(v, depth, seen) {
    depth = depth || 0;
    seen = seen || new WeakSet();
    var t = typeof v;
    if (v === null) return "null";
    if (t === "undefined") return "undefined";
    if (t === "string") return depth === 0 ? v : JSON.stringify(v);
    if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
    if (t === "bigint") return String(v) + "n";
    if (t === "boolean" || t === "symbol") return String(v);
    if (t === "function") return "[Function" + (v.name ? ": " + v.name : "") + "]";
    if (v instanceof Error) return (v.stack && String(v.stack)) || v.name + ": " + v.message;
    if (v instanceof Date) return isNaN(v.getTime()) ? "Invalid Date" : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (v instanceof Promise) return "Promise { <pending> }";
    if (seen.has(v)) return "[Circular]";
    if (depth > 3) return Array.isArray(v) ? "[Array]" : "[" + typeName(v) + "]";
    seen.add(v);
    var out;
    if (Array.isArray(v)) {
      var items = v.slice(0, 100).map(function (x) {
        return format(x, depth + 1, seen);
      });
      if (v.length > 100) items.push("… " + (v.length - 100) + " more");
      out = "[" + items.join(", ") + "]";
    } else if (ArrayBuffer.isView(v)) {
      out = typeName(v) + "(" + v.length + ") [" + Array.prototype.slice.call(v, 0, 50).join(", ") + (v.length > 50 ? ", …" : "") + "]";
    } else if (v instanceof Map) {
      var m = [];
      v.forEach(function (val, key) {
        if (m.length < 50) m.push(format(key, depth + 1, seen) + " => " + format(val, depth + 1, seen));
      });
      out = "Map(" + v.size + ") {" + m.join(", ") + "}";
    } else if (v instanceof Set) {
      var s = [];
      v.forEach(function (val) {
        if (s.length < 50) s.push(format(val, depth + 1, seen));
      });
      out = "Set(" + v.size + ") {" + s.join(", ") + "}";
    } else {
      var keys = Object.keys(v);
      var parts = keys.slice(0, 50).map(function (k) {
        var val;
        try {
          val = v[k];
        } catch (e) {
          val = "[Getter threw]";
        }
        return (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ": " + format(val, depth + 1, seen);
      });
      if (keys.length > 50) parts.push("… " + (keys.length - 50) + " more");
      var ctor = v.constructor && v.constructor.name && v.constructor.name !== "Object" ? v.constructor.name + " " : "";
      out = ctor + "{" + (parts.length ? " " + parts.join(", ") + " " : "") + "}";
    }
    seen.delete(v);
    return out;
  }
  function formatArgs(args) {
    var list = [];
    for (var i = 0; i < args.length; i++) list.push(format(args[i], 0));
    return list.join(" ");
  }

  // ---------- console capture ----------
  var timers = {};
  var counters = {};
  var groupDepth = 0;
  function emit(level, args) {
    var indent = groupDepth ? new Array(groupDepth + 1).join("  ") : "";
    post({ type: "console", level: level, text: indent + formatArgs(args) });
  }
  var sandboxConsole = {
    log: function () {
      emit("log", arguments);
    },
    info: function () {
      emit("info", arguments);
    },
    debug: function () {
      emit("log", arguments);
    },
    warn: function () {
      emit("warn", arguments);
    },
    error: function () {
      emit("error", arguments);
    },
    trace: function () {
      emit("log", arguments);
      post({ type: "console", level: "log", text: String(new Error().stack || "").split("\n").slice(2).join("\n") });
    },
    dir: function () {
      emit("log", arguments);
    },
    table: function () {
      emit("log", arguments);
    },
    assert: function (cond) {
      if (!cond) emit("error", ["Assertion failed:"].concat(Array.prototype.slice.call(arguments, 1)));
    },
    group: function () {
      if (arguments.length) emit("log", arguments);
      groupDepth++;
    },
    groupCollapsed: function () {
      if (arguments.length) emit("log", arguments);
      groupDepth++;
    },
    groupEnd: function () {
      if (groupDepth > 0) groupDepth--;
    },
    count: function (label) {
      label = label === undefined ? "default" : String(label);
      counters[label] = (counters[label] || 0) + 1;
      emit("log", [label + ": " + counters[label]]);
    },
    time: function (label) {
      timers[label === undefined ? "default" : String(label)] = performance.now();
    },
    timeEnd: function (label) {
      label = label === undefined ? "default" : String(label);
      if (timers[label] !== undefined) {
        emit("log", [label + ": " + (performance.now() - timers[label]).toFixed(3) + " ms"]);
        delete timers[label];
      }
    },
    timeLog: function (label) {
      label = label === undefined ? "default" : String(label);
      if (timers[label] !== undefined) emit("log", [label + ": " + (performance.now() - timers[label]).toFixed(3) + " ms"]);
    },
    clear: function () {},
  };
  try {
    self.console = sandboxConsole;
  } catch (e) {
    try {
      Object.defineProperty(self, "console", { value: sandboxConsole, configurable: true, writable: true });
    } catch (e2) {}
  }

  // ---------- pending-work tracking (event loop idle detection) ----------
  var nativeSetTimeout = self.setTimeout.bind(self);
  var nativeClearTimeout = self.clearTimeout.bind(self);
  var nativeSetInterval = self.setInterval.bind(self);
  var nativeClearInterval = self.clearInterval.bind(self);

  self.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetTimeout(function () {
      timeouts.delete(id);
      try {
        if (typeof fn === "function") fn.apply(null, args);
      } catch (err) {
        reportError(err);
      }
      checkDone();
    }, ms);
    timeouts.add(id);
    return id;
  };
  self.clearTimeout = function (id) {
    timeouts.delete(id);
    nativeClearTimeout(id);
    nativeSetTimeout(checkDone, 0);
  };
  self.setInterval = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetInterval(function () {
      try {
        if (typeof fn === "function") fn.apply(null, args);
      } catch (err) {
        reportError(err);
      }
    }, ms);
    intervals.add(id);
    return id;
  };
  self.clearInterval = function (id) {
    intervals.delete(id);
    nativeClearInterval(id);
    nativeSetTimeout(checkDone, 0);
  };

  function checkDone() {
    if (bodyDone && !finished && timeouts.size === 0 && intervals.size === 0) finish(0);
  }
  function finish(code) {
    if (finished) return;
    finished = true;
    post({ type: "done", exitCode: code, duration: performance.now() - start });
  }
  function reportError(err) {
    var message = err instanceof Error ? err.name + ": " + err.message : "Uncaught " + format(err, 0);
    post({ type: "error", message: message, stack: err && err.stack ? String(err.stack) : "" });
  }
  self.addEventListener("error", function (ev) {
    ev.preventDefault();
    reportError(ev.error || new Error(ev.message));
    finish(1);
  });
  self.addEventListener("unhandledrejection", function (ev) {
    ev.preventDefault();
    reportError(ev.reason instanceof Error ? ev.reason : new Error("Unhandled promise rejection: " + format(ev.reason, 0)));
  });

  // ---------- CommonJS loader ----------
  function dirname(p) {
    var i = p.lastIndexOf("/");
    return i <= 0 ? "/" : p.slice(0, i);
  }
  function normalize(p) {
    var parts = p.split("/");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      if (!s || s === ".") continue;
      if (s === "..") out.pop();
      else out.push(s);
    }
    return "/" + out.join("/");
  }
  function resolveModule(modules, fromPath, spec) {
    if (!spec.startsWith("./") && !spec.startsWith("../") && !spec.startsWith("/")) {
      throw new Error("Cannot find module '" + spec + "' (only project-relative imports are available in the sandbox)");
    }
    var base = spec.startsWith("/") ? normalize(spec) : normalize(dirname(fromPath) + "/" + spec);
    var candidates = [base, base + ".js", base + ".mjs", base + ".cjs", base + "/index.js", base + ".json"];
    for (var i = 0; i < candidates.length; i++) if (Object.prototype.hasOwnProperty.call(modules, candidates[i])) return candidates[i];
    throw new Error("Cannot find module '" + spec + "' from '" + fromPath + "'");
  }

  self.onmessage = function (e) {
    var data = e.data || {};
    if (data.type !== "run") return;
    var modules = data.modules || {};
    var entry = data.entry;
    start = performance.now();
    var cache = {};
    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    function makeRequire(fromPath) {
      return function require(spec) {
        var resolved = resolveModule(modules, fromPath, spec);
        return load(resolved, false);
      };
    }
    function load(path, isEntry) {
      if (cache[path]) return isEntry ? cache[path].promise : cache[path].module.exports;
      var code = modules[path];
      var mod = { exports: {} };
      var record = { module: mod, promise: null };
      cache[path] = record;
      if (path.endsWith(".json")) {
        mod.exports = JSON.parse(code);
        return mod.exports;
      }
      var wrapped = code + "\n//# sourceURL=" + path;
      if (isEntry) {
        var afn = new AsyncFunction("require", "module", "exports", "console", wrapped);
        record.promise = afn(makeRequire(path), mod, mod.exports, sandboxConsole);
        return record.promise;
      }
      var fn = new Function("require", "module", "exports", "console", wrapped);
      fn(makeRequire(path), mod, mod.exports, sandboxConsole);
      return mod.exports;
    }

    Promise.resolve()
      .then(function () {
        if (!Object.prototype.hasOwnProperty.call(modules, entry)) throw new Error("Entry module not found: " + entry);
        return load(entry, true);
      })
      .then(function (result) {
        if (result !== undefined) post({ type: "result", text: format(result, 0) });
        bodyDone = true;
        // Give already-queued microtasks/timers a tick before deciding we are idle.
        nativeSetTimeout(checkDone, 0);
      })
      .catch(function (err) {
        reportError(err);
        finish(1);
      });
  };
  post({ type: "ready" });
})();

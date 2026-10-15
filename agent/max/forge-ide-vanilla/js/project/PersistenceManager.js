import { EventEmitter } from "../core/EventEmitter.js";
const DB_NAME = "forge-ide";
const DB_VERSION = 1;
const STORE_NODES = "nodes";
const STORE_META = "meta";
class PersistenceManager extends EventEmitter {
  db = null;
  available = false;
  project = null;
  dirty = /* @__PURE__ */ new Set();
  timer = null;
  inflight = null;
  getDelay = () => 600;
  disposers = [];
  lastState = "saved";
  lastError = "";
  get isAvailable() {
    return this.available;
  }
  get state() {
    return this.lastState;
  }
  get pendingCount() {
    return this.dirty.size;
  }
  isPending(path) {
    return this.dirty.has(path);
  }
  async open() {
    if (typeof indexedDB === "undefined") {
      this.available = false;
      this.emit("unavailable", { message: "IndexedDB is not available in this browser; changes will not survive a reload." });
      this.setState("error", "IndexedDB unavailable");
      return;
    }
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NODES)) db.createObjectStore(STORE_NODES, { keyPath: "path" });
          if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "key" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
        req.onblocked = () => reject(new Error("IndexedDB open blocked by another tab"));
      });
      this.db.onversionchange = () => this.db?.close();
      this.available = true;
    } catch (err) {
      this.available = false;
      const message = `Could not open IndexedDB: ${err.message}`;
      this.emit("unavailable", { message });
      this.setState("error", message);
    }
  }
  async loadNodes() {
    if (!this.db) return [];
    return this.request((tx) => tx.objectStore(STORE_NODES).getAll(), "readonly");
  }
  async getMeta(key) {
    if (!this.db) return void 0;
    const row = await this.request((tx) => tx.objectStore(STORE_META).get(key), "readonly");
    return row?.value;
  }
  async setMeta(key, value) {
    if (!this.db) return;
    await this.transaction("readwrite", [STORE_META], (tx) => {
      tx.objectStore(STORE_META).put({ key, value });
    });
  }
  /** Subscribe to project events; content changes are debounced, structure is immediate. */
  attach(project, getDelay) {
    this.project = project;
    this.getDelay = getDelay;
    this.disposers.push(
      project.on("contentChanged", ({ path }) => this.markDirty(path)),
      project.on("languageChanged", ({ path }) => this.markDirty(path)),
      project.on("created", ({ nodes }) => {
        this.writeRecords(project.toRecords(nodes.map((n) => n.path))).catch(() => {
        });
      }),
      project.on("deleted", ({ paths }) => {
        for (const p of paths) this.dirty.delete(p);
        void this.deleteRecords(paths);
      }),
      project.on("renamed", ({ moves }) => {
        for (const m of moves) this.dirty.delete(m.from);
        void this.transaction("readwrite", [STORE_NODES], (tx) => {
          const store = tx.objectStore(STORE_NODES);
          for (const m of moves) store.delete(m.from);
          for (const r of project.toRecords(moves.map((m) => m.to))) store.put(r);
        }).then(
          () => this.setState(this.dirty.size ? "editing" : "saved"),
          (err) => this.setState("error", `Rename failed to persist: ${err.message}`)
        );
      })
    );
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") void this.flush();
    };
    document.addEventListener("visibilitychange", flushOnHide);
    window.addEventListener("pagehide", () => void this.flush());
    this.disposers.push(() => document.removeEventListener("visibilitychange", flushOnHide));
  }
  /** Persist the full project (used on first launch / reset). */
  async writeAll(records) {
    await this.transaction("readwrite", [STORE_NODES], (tx) => {
      const store = tx.objectStore(STORE_NODES);
      store.clear();
      for (const r of records) store.put(r);
    });
  }
  markDirty(path) {
    this.dirty.add(path);
    this.setState("editing");
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, Math.max(100, this.getDelay()));
  }
  /** Write everything dirty now. Safe to call repeatedly; concurrent calls coalesce. */
  async flush() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inflight) {
      await this.inflight;
      if (!this.dirty.size) return;
    }
    if (!this.dirty.size || !this.project) return;
    const paths = Array.from(this.dirty);
    this.dirty.clear();
    const records = this.project.toRecords(paths);
    this.setState("saving");
    this.inflight = this.writeRecords(records, paths).then(() => {
      this.setState(this.dirty.size ? "editing" : "saved");
    }).catch(() => {
    }).finally(() => {
      this.inflight = null;
      if (this.dirty.size && this.timer === null) this.markDirty(Array.from(this.dirty)[0]);
    });
    await this.inflight;
  }
  dispose() {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.db?.close();
  }
  // ---------- internals ----------
  async writeRecords(records, dirtyPaths) {
    if (!this.available) {
      const msg = "Autosave failed: browser storage unavailable.";
      if (dirtyPaths) for (const p of dirtyPaths) this.dirty.add(p);
      this.setState("error", msg);
      throw new Error(msg);
    }
    try {
      await this.transaction("readwrite", [STORE_NODES], (tx) => {
        const store = tx.objectStore(STORE_NODES);
        for (const r of records) store.put(r);
      });
      if (!dirtyPaths) this.setState(this.dirty.size ? "editing" : "saved");
    } catch (err) {
      if (dirtyPaths) for (const p of dirtyPaths) this.dirty.add(p);
      this.setState("error", `Autosave failed: ${err.message}`);
      throw err;
    }
  }
  async deleteRecords(paths) {
    if (!this.available) return;
    try {
      await this.transaction("readwrite", [STORE_NODES], (tx) => {
        const store = tx.objectStore(STORE_NODES);
        for (const p of paths) store.delete(p);
      });
      this.setState(this.dirty.size ? "editing" : "saved");
    } catch (err) {
      this.setState("error", `Delete failed to persist: ${err.message}`);
    }
  }
  setState(state, message) {
    if (state === "error") this.lastError = message ?? "Persistence error";
    else if (state === "saved") this.lastError = "";
    this.lastState = state;
    this.emit("stateChange", { state, message: state === "error" ? this.lastError : message, pending: this.dirty.size });
  }
  transaction(mode, stores, body) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("IndexedDB is not open"));
      let tx;
      try {
        tx = this.db.transaction(stores, mode);
      } catch (err) {
        return reject(err);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      try {
        body(tx);
      } catch (err) {
        reject(err);
      }
    });
  }
  request(make, mode) {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("IndexedDB is not open"));
      const tx = this.db.transaction([STORE_NODES, STORE_META], mode);
      const req = make(tx);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    });
  }
}
export {
  PersistenceManager
};

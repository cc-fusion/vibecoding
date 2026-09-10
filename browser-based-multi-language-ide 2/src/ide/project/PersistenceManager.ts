import { EventEmitter } from "../core/EventEmitter";
import type { FileRecord, ProjectManager } from "./ProjectManager";

export type SaveState = "editing" | "saving" | "saved" | "error";

export interface PersistenceEvents extends Record<string, unknown> {
  stateChange: { state: SaveState; message?: string; pending: number };
  unavailable: { message: string };
}

const DB_NAME = "forge-ide";
const DB_VERSION = 1;
const STORE_NODES = "nodes";
const STORE_META = "meta";

/**
 * IndexedDB-backed persistence with debounced autosave.
 *
 * - Content edits are marked dirty immediately and written after a debounce.
 * - Structural changes (create/rename/delete) are written right away.
 * - Rename/delete flush any pending content writes first so no queued write can
 *   resurrect a removed path.
 */
export class PersistenceManager extends EventEmitter<PersistenceEvents> {
  private db: IDBDatabase | null = null;
  private available = false;
  private project: ProjectManager | null = null;
  private dirty = new Set<string>();
  private timer: number | null = null;
  private inflight: Promise<void> | null = null;
  private getDelay: () => number = () => 600;
  private disposers: Array<() => void> = [];
  private lastState: SaveState = "saved";
  private lastError = "";

  get isAvailable(): boolean {
    return this.available;
  }
  get state(): SaveState {
    return this.lastState;
  }
  get pendingCount(): number {
    return this.dirty.size;
  }
  isPending(path: string): boolean {
    return this.dirty.has(path);
  }

  async open(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      this.available = false;
      this.emit("unavailable", { message: "IndexedDB is not available in this browser; changes will not survive a reload." });
      this.setState("error", "IndexedDB unavailable");
      return;
    }
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
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
      const message = `Could not open IndexedDB: ${(err as Error).message}`;
      this.emit("unavailable", { message });
      this.setState("error", message);
    }
  }

  async loadNodes(): Promise<FileRecord[]> {
    if (!this.db) return [];
    return this.request<FileRecord[]>((tx) => tx.objectStore(STORE_NODES).getAll(), "readonly");
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    if (!this.db) return undefined;
    const row = await this.request<{ key: string; value: T } | undefined>((tx) => tx.objectStore(STORE_META).get(key), "readonly");
    return row?.value;
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    if (!this.db) return;
    await this.transaction("readwrite", [STORE_META], (tx) => {
      tx.objectStore(STORE_META).put({ key, value });
    });
  }

  /** Subscribe to project events; content changes are debounced, structure is immediate. */
  attach(project: ProjectManager, getDelay: () => number): void {
    this.project = project;
    this.getDelay = getDelay;
    this.disposers.push(
      project.on("contentChanged", ({ path }) => this.markDirty(path)),
      project.on("languageChanged", ({ path }) => this.markDirty(path)),
      project.on("created", ({ nodes }) => {
        this.writeRecords(project.toRecords(nodes.map((n) => n.path))).catch(() => {
          /* already surfaced via stateChange("error") */
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
          (err) => this.setState("error", `Rename failed to persist: ${(err as Error).message}`)
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
  async writeAll(records: FileRecord[]): Promise<void> {
    await this.transaction("readwrite", [STORE_NODES], (tx) => {
      const store = tx.objectStore(STORE_NODES);
      store.clear();
      for (const r of records) store.put(r);
    });
  }

  markDirty(path: string): void {
    this.dirty.add(path);
    this.setState("editing");
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, Math.max(100, this.getDelay()));
  }

  /** Write everything dirty now. Safe to call repeatedly; concurrent calls coalesce. */
  async flush(): Promise<void> {
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
    this.inflight = this.writeRecords(records, paths)
      .then(() => {
        this.setState(this.dirty.size ? "editing" : "saved");
      })
      .catch(() => {
        // writeRecords already reported the error; keep paths dirty for retry.
      })
      .finally(() => {
        this.inflight = null;
        if (this.dirty.size && this.timer === null) this.markDirty(Array.from(this.dirty)[0]);
      });
    await this.inflight;
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.db?.close();
  }

  // ---------- internals ----------

  private async writeRecords(records: FileRecord[], dirtyPaths?: string[]): Promise<void> {
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
      this.setState("error", `Autosave failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async deleteRecords(paths: string[]): Promise<void> {
    if (!this.available) return;
    try {
      await this.transaction("readwrite", [STORE_NODES], (tx) => {
        const store = tx.objectStore(STORE_NODES);
        for (const p of paths) store.delete(p);
      });
      this.setState(this.dirty.size ? "editing" : "saved");
    } catch (err) {
      this.setState("error", `Delete failed to persist: ${(err as Error).message}`);
    }
  }

  private setState(state: SaveState, message?: string): void {
    if (state === "error") this.lastError = message ?? "Persistence error";
    else if (state === "saved") this.lastError = "";
    this.lastState = state;
    this.emit("stateChange", { state, message: state === "error" ? this.lastError : message, pending: this.dirty.size });
  }

  private transaction(mode: IDBTransactionMode, stores: string[], body: (tx: IDBTransaction) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("IndexedDB is not open"));
      let tx: IDBTransaction;
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

  private request<T>(make: (tx: IDBTransaction) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error("IndexedDB is not open"));
      const tx = this.db.transaction([STORE_NODES, STORE_META], mode);
      const req = make(tx);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    });
  }
}

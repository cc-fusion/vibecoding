class WorkerSession {
  worker;
  url;
  _terminated = false;
  handlers = /* @__PURE__ */ new Set();
  errorHandlers = /* @__PURE__ */ new Set();
  constructor(source, type) {
    const blob = new Blob([source], { type: "text/javascript" });
    this.url = URL.createObjectURL(blob);
    try {
      this.worker = new Worker(this.url, type === "module" ? { type: "module" } : void 0);
    } catch (err) {
      URL.revokeObjectURL(this.url);
      throw err;
    }
    setTimeout(() => URL.revokeObjectURL(this.url), 5e3);
    this.worker.onmessage = (e) => {
      for (const h of Array.from(this.handlers)) h(e.data);
    };
    this.worker.onerror = (e) => {
      for (const h of Array.from(this.errorHandlers)) h(e);
    };
  }
  get terminated() {
    return this._terminated;
  }
  post(message, transfer) {
    if (this._terminated) return;
    if (transfer && transfer.length) this.worker.postMessage(message, transfer);
    else this.worker.postMessage(message);
  }
  onMessage(handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  onError(handler) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }
  terminate() {
    if (this._terminated) return;
    this._terminated = true;
    this.worker.terminate();
    this.handlers.clear();
    this.errorHandlers.clear();
    URL.revokeObjectURL(this.url);
  }
}
function formatDuration(ms) {
  if (ms < 1e3) return `${Math.round(ms)} ms`;
  return `${(ms / 1e3).toFixed(2)} s`;
}
export {
  WorkerSession,
  formatDuration
};

/**
 * Creates Web Workers from in-bundle source strings via Blob URLs. This keeps
 * the application a single static file while guaranteeing user code runs in a
 * separate thread/global with no access to the IDE window.
 */
export class WorkerSession {
  readonly worker: Worker;
  private url: string;
  private _terminated = false;
  private handlers = new Set<(msg: any) => void>();
  private errorHandlers = new Set<(err: ErrorEvent) => void>();

  constructor(source: string, type: "classic" | "module") {
    const blob = new Blob([source], { type: "text/javascript" });
    this.url = URL.createObjectURL(blob);
    try {
      this.worker = new Worker(this.url, type === "module" ? { type: "module" } : undefined);
    } catch (err) {
      URL.revokeObjectURL(this.url);
      throw err;
    }
    // The blob URL is only needed for construction (and module resolution of the
    // top-level script); revoke it once the worker has started.
    setTimeout(() => URL.revokeObjectURL(this.url), 5000);
    this.worker.onmessage = (e) => {
      for (const h of Array.from(this.handlers)) h(e.data);
    };
    this.worker.onerror = (e) => {
      for (const h of Array.from(this.errorHandlers)) h(e);
    };
  }

  get terminated(): boolean {
    return this._terminated;
  }

  post(message: unknown, transfer?: Transferable[]): void {
    if (this._terminated) return;
    if (transfer && transfer.length) this.worker.postMessage(message, transfer);
    else this.worker.postMessage(message);
  }

  onMessage(handler: (msg: any) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onError(handler: (err: ErrorEvent) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  terminate(): void {
    if (this._terminated) return;
    this._terminated = true;
    this.worker.terminate();
    this.handlers.clear();
    this.errorHandlers.clear();
    URL.revokeObjectURL(this.url);
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

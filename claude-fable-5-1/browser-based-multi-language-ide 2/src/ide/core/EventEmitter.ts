export type Listener<T> = (payload: T) => void;
export type Disposable = () => void;

/**
 * Minimal typed event emitter used as the boundary between managers.
 */
export class EventEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<any>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Disposable {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
    };
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Disposable {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of Array.from(set)) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[EventEmitter] listener for "${String(event)}" threw`, err);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

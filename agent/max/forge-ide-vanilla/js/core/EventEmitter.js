class EventEmitter {
  listeners = /* @__PURE__ */ new Map();
  on(event, listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }
  once(event, listener) {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }
  emit(event, payload) {
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
  removeAllListeners() {
    this.listeners.clear();
  }
}
export {
  EventEmitter
};

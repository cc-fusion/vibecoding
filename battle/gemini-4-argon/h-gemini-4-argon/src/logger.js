const MAX_LOGS = 200;

class DebugLogger {
  constructor() {
    this.entries = [];
    this.listeners = new Set();
  }

  log(category, message, detail = null) {
    const now = new Date();
    const time =
      String(now.getHours()).padStart(2, '0') +
      ':' +
      String(now.getMinutes()).padStart(2, '0') +
      ':' +
      String(now.getSeconds()).padStart(2, '0') +
      '.' +
      String(now.getMilliseconds()).padStart(3, '0');

    const entry = { time, category, message, detail };
    this.entries.push(entry);
    if (this.entries.length > MAX_LOGS) {
      this.entries.shift();
    }
    for (const fn of this.listeners) {
      fn(this.entries);
    }
  }

  clear() {
    this.entries = [];
    for (const fn of this.listeners) {
      fn(this.entries);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const logger = new DebugLogger();

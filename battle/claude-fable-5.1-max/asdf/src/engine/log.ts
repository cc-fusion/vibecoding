export interface LogEntry {
  id: number;
  time: number;
  tag: string;
  message: string;
}

const MAX_ENTRIES = 200;
let enabled = false;
let nextId = 1;
const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

export function setDebugEnabled(v: boolean) {
  enabled = v;
}
export function isDebugEnabled() {
  return enabled;
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, (_k, val) => {
      if (val && typeof val === "object" && typeof (val as { toFixed?: unknown }).toFixed === "function" && "d" in val) {
        return String(val);
      }
      return val;
    });
  } catch {
    return String(v);
  }
}

export function dlog(tag: string, ...args: unknown[]) {
  if (!enabled) return;
  const message = args.map(stringify).join(" ");
  entries.push({ id: nextId++, time: Date.now(), tag, message });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  // eslint-disable-next-line no-console
  console.log(`[${tag}]`, ...args);
  listeners.forEach((l) => l());
}

export function getLogEntries(): LogEntry[] {
  return entries.slice();
}
export function clearLog() {
  entries.length = 0;
  listeners.forEach((l) => l());
}
export function subscribeLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

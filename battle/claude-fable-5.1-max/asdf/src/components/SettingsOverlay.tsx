import { useEffect, useRef, useState, type ReactNode } from "react";
import { clearLog, getLogEntries, subscribeLog, type LogEntry } from "@/engine/log";
import { DEFAULT_UNITS_JSON, type Settings } from "@/hooks/useSettings";
import { cn } from "@/utils/cn";

interface SettingsOverlayProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  unitsError: string | null;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-zinc-200 text-sm dark:border-zinc-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 px-3 py-1.5 transition-colors",
            value === o.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-indigo-600 dark:bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{title}</div>
        {hint && <div className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>(() => getLogEntries());
  useEffect(() => subscribeLog(() => setEntries(getLogEntries())), []);
  const shown = entries.slice(-60);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Console log ({entries.length})</div>
        <button
          type="button"
          onClick={() => clearLog()}
          className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          Clear
        </button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 font-mono text-[11px] leading-4 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        {shown.length === 0
          ? "No entries yet. Enable debug logging and type an expression."
          : shown
              .map((e) => `${new Date(e.time).toLocaleTimeString()} [${e.tag}] ${e.message}`)
              .join("\n")}
      </pre>
    </div>
  );
}

export function SettingsOverlay({ settings, onChange, onClose, unitsError }: SettingsOverlayProps) {
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-zinc-900/10 p-3 backdrop-blur-[2px] sm:p-5 dark:bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          downOnBackdrop.current = true;
          e.preventDefault(); // keep focus where it is; onClose will refocus the editor
        }
      }}
      onClick={(e) => {
        const close = downOnBackdrop.current && e.target === e.currentTarget;
        downOnBackdrop.current = false;
        if (close) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2.5rem)] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <Row title="Unit system" hint="Preferred units for results">
            <div className="w-44">
              <Segmented
                value={settings.system}
                onChange={(v) => onChange({ system: v })}
                options={[
                  { value: "metric", label: "Metric" },
                  { value: "imperial", label: "Imperial" },
                ]}
              />
            </div>
          </Row>
          <Row title="Angle mode" hint="Used by trigonometric functions">
            <div className="w-44">
              <Segmented
                value={settings.angle}
                onChange={(v) => onChange({ angle: v })}
                options={[
                  { value: "rad", label: "Radians" },
                  { value: "deg", label: "Degrees" },
                ]}
              />
            </div>
          </Row>
          <Row title="Theme">
            <div className="w-44">
              <Segmented
                value={settings.theme}
                onChange={(v) => onChange({ theme: v })}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
          </Row>
          <Row title="Font size" hint={`${settings.fontSize}px`}>
            <input
              type="range"
              min={11}
              max={28}
              step={1}
              value={settings.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="w-44 accent-indigo-600"
              aria-label="Font size"
            />
          </Row>
          <Row title="Inline suggestions" hint="Show the first candidate as ghost text">
            <Toggle checked={settings.inline} onChange={(v) => onChange({ inline: v })} label="Inline suggestions" />
          </Row>

          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Row title="Developer tools" hint="Debugging and unit engine internals">
              <Toggle checked={settings.developer} onChange={(v) => onChange({ developer: v })} label="Developer tools" />
            </Row>
          </div>

          {settings.developer && (
            <div className="space-y-4 rounded-xl border border-dashed border-zinc-200 p-3 dark:border-zinc-700">
              <Row title="Debug logging" hint="Log suggestion decisions to the console">
                <Toggle checked={settings.debug} onChange={(v) => onChange({ debug: v })} label="Debug logging" />
              </Row>
              <LogViewer />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Known units (JSON)</div>
                  <button
                    type="button"
                    onClick={() => onChange({ unitsJson: DEFAULT_UNITS_JSON })}
                    className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
                  >
                    Reset to defaults
                  </button>
                </div>
                <textarea
                  value={settings.unitsJson}
                  onChange={(e) => onChange({ unitsJson: e.target.value })}
                  spellCheck={false}
                  className={cn(
                    "h-64 w-full resize-y rounded-lg border bg-zinc-50 p-2 font-mono text-[11px] leading-4 text-zinc-800 outline-none focus:border-indigo-500 dark:bg-zinc-950 dark:text-zinc-200",
                    unitsError ? "border-red-400" : "border-zinc-200 dark:border-zinc-800",
                  )}
                  aria-label="Units JSON"
                />
                {unitsError ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {unitsError} — the previous valid definitions remain active.
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 dark:text-zinc-500">
                    Units: symbol, dim (kg, m, s, A, K, mol, cd, rad), factor to SI (decimal, a/b, pi/180), optional
                    offset, system, prefixable, aliases. Ladders control readable-unit normalisation.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

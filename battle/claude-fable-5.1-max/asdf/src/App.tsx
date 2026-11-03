import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BottomBar } from "@/components/BottomBar";
import { Editor } from "@/components/Editor";
import { SettingsOverlay } from "@/components/SettingsOverlay";
import { dlog, setDebugEnabled } from "@/engine/log";
import { suggestInDocument, type Suggestion } from "@/engine/suggest";
import { UnitRegistry } from "@/engine/units";
import { DEFAULT_UNITS, type UnitsJSON } from "@/engine/unitsData";
import { usePersistentText, useSettings } from "@/hooks/useSettings";

const defaultRegistry = new UnitRegistry(DEFAULT_UNITS);

function buildRegistry(json: string, fallback: UnitRegistry): { registry: UnitRegistry; error: string | null } {
  try {
    const parsed = JSON.parse(json) as UnitsJSON;
    return { registry: new UnitRegistry(parsed), error: null };
  } catch (err) {
    return { registry: fallback, error: err instanceof Error ? err.message : String(err) };
  }
}

interface UnitOverride {
  dimKey: string;
  unit: string;
  line: number;
}

export default function App() {
  const [settings, updateSettings] = useSettings();
  const [text, setText] = usePersistentText();
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [override, setOverride] = useState<UnitOverride | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const lastGoodRegistry = useRef<UnitRegistry>(defaultRegistry);

  // Unit registry (editable JSON in the developer menu; falls back to the last valid definitions).
  const { registry, unitsError } = useMemo(() => {
    const r = buildRegistry(settings.unitsJson, lastGoodRegistry.current);
    if (!r.error) lastGoodRegistry.current = r.registry;
    return { registry: r.registry, unitsError: r.error };
  }, [settings.unitsJson]);

  useEffect(() => setDebugEnabled(settings.debug), [settings.debug]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  const lineIndex = useMemo(() => {
    let n = 0;
    for (let i = 0; i < sel.start && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return n;
  }, [text, sel.start]);
  const activeOverride = override && override.line === lineIndex ? override.unit : null;

  const suggestion = useMemo(() => {
    if (sel.start !== sel.end) return null;
    return suggestInDocument(
      text,
      sel.start,
      { system: settings.system, angle: settings.angle, inlineEnabled: settings.inline },
      registry,
      activeOverride,
    );
  }, [text, sel, settings.system, settings.angle, settings.inline, registry, activeOverride]);

  const suggestionKey = suggestion
    ? `${sel.start}:${suggestion.items.map((i) => `${i.replaceBefore}/${i.text}`).join("\u0001")}`
    : null;
  const visible = suggestion && suggestionKey !== dismissedKey ? suggestion : null;

  // Reset chip selection whenever the candidate set changes.
  useEffect(() => {
    setSelectedIdx(0);
  }, [suggestionKey]);

  // Drop a unit override once the result's dimension changes.
  useEffect(() => {
    if (override && suggestion?.dimKey && suggestion.dimKey !== override.dimKey) setOverride(null);
  }, [suggestion?.dimKey, override]);

  const items = visible?.items ?? [];
  const safeIdx = items.length ? Math.min(selectedIdx, items.length - 1) : 0;
  const selected = items[safeIdx] ?? null;
  const ghost = visible && visible.inline && selected ? { text: selected.text, replaceBefore: selected.replaceBefore } : null;

  // Apply a programmatic caret position after React has committed the new value.
  useLayoutEffect(() => {
    if (pendingCaret.current != null && textareaRef.current) {
      const c = pendingCaret.current;
      pendingCaret.current = null;
      textareaRef.current.setSelectionRange(c, c);
    }
  }, [text]);

  const replaceRange = useCallback(
    (start: number, end: number, insert: string) => {
      const next = text.slice(0, start) + insert + text.slice(end);
      const caret = start + insert.length;
      pendingCaret.current = caret;
      setText(next);
      setSel({ start: caret, end: caret });
    },
    [text, setText],
  );

  const accept = useCallback(
    (s: Suggestion) => {
      dlog("accept", { text: s.text, replaceBefore: s.replaceBefore });
      replaceRange(sel.start - s.replaceBefore, sel.start, s.text);
      textareaRef.current?.focus({ preventScroll: true });
    },
    [replaceRange, sel.start],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === "Tab" && plain && !e.shiftKey) {
      e.preventDefault();
      if (selected) accept(selected);
      else replaceRange(sel.start, sel.end, "\t");
      return;
    }
    if (e.key === "ArrowRight" && plain && !e.shiftKey && items.length > 1) {
      if (safeIdx < items.length - 1) {
        e.preventDefault();
        setSelectedIdx(safeIdx + 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && plain && !e.shiftKey && items.length > 1) {
      if (safeIdx > 0) {
        e.preventDefault();
        setSelectedIdx(safeIdx - 1);
      }
      return;
    }
    if (e.key === "Escape" && items.length) {
      e.preventDefault();
      setDismissedKey(suggestionKey);
    }
  };

  const onUnitChange = (unit: string) => {
    if (visible?.dimKey) setOverride({ dimKey: visible.dimKey, unit, line: lineIndex });
    textareaRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="min-h-screen">
      <Editor
        ref={textareaRef}
        text={text}
        caret={sel.start}
        ghost={ghost}
        fontSize={settings.fontSize}
        onChange={(t, start, end) => {
          setText(t);
          setSel({ start, end });
        }}
        onSelectionChange={(start, end) => {
          setSel((s) => (s.start === start && s.end === end ? s : { start, end }));
        }}
        onKeyDown={onKeyDown}
      />

      {!settingsOpen && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings"
          className="fixed top-3 right-3 z-30 rounded-full border border-zinc-200/80 bg-white/80 p-2 text-zinc-500 shadow-sm backdrop-blur transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}

      <BottomBar
        items={items}
        selectedIdx={safeIdx}
        onAccept={accept}
        unitPicker={visible?.unitPicker ?? null}
        onUnitChange={onUnitChange}
        angle={settings.angle}
        onAngleChange={(angle) => {
          updateSettings({ angle });
          textareaRef.current?.focus({ preventScroll: true });
        }}
      />

      {settingsOpen && (
        <SettingsOverlay
          settings={settings}
          onChange={updateSettings}
          onClose={() => {
            setSettingsOpen(false);
            textareaRef.current?.focus({ preventScroll: true });
          }}
          unitsError={unitsError}
        />
      )}
    </div>
  );
}

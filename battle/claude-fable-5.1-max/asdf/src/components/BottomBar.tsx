import { useEffect, useRef } from "react";
import type { Suggestion, UnitPickerInfo } from "@/engine/suggest";
import { truncatePreview } from "@/engine/format";
import { cn } from "@/utils/cn";

interface BottomBarProps {
  items: Suggestion[];
  selectedIdx: number;
  onAccept: (s: Suggestion) => void;
  unitPicker: UnitPickerInfo | null;
  onUnitChange: (key: string) => void;
  angle: "rad" | "deg";
  onAngleChange: (a: "rad" | "deg") => void;
}

export function BottomBar({ items, selectedIdx, onAccept, unitPicker, onUnitChange, angle, onAngleChange }: BottomBarProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedIdx, items]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/80 bg-white/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex h-12 items-center gap-2 px-3">
        <div ref={scrollerRef} className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
          {items.length === 0 ? (
            <span className="select-none text-xs text-zinc-400 dark:text-zinc-600">No suggestions</span>
          ) : (
            items.map((s, i) => {
              const selected = i === selectedIdx;
              return (
                <button
                  key={`${s.text}-${s.replaceBefore}-${i}`}
                  type="button"
                  data-idx={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onAccept(s)}
                  title={s.text}
                  className={cn(
                    "group flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[13px] transition-colors",
                    selected
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm dark:border-indigo-400 dark:bg-indigo-500"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
                  )}
                >
                  <span className="whitespace-pre">{truncatePreview(s.label, 48)}</span>
                  {s.badge && (
                    <span
                      className={cn(
                        "rounded px-1 text-[10px] font-medium uppercase tracking-wide",
                        selected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {s.badge}
                    </span>
                  )}
                  {selected && (
                    <kbd className="rounded border border-white/30 px-1 text-[10px] font-sans leading-4 text-white/90">Tab</kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {unitPicker && (
            <select
              aria-label="Result unit"
              value={unitPicker.selected}
              onChange={(e) => onUnitChange(e.target.value)}
              className="h-7 max-w-[9rem] rounded-md border border-zinc-200 bg-white px-1.5 font-mono text-xs text-zinc-700 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {unitPicker.options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <div
            role="group"
            aria-label="Angle mode"
            className="flex h-7 overflow-hidden rounded-md border border-zinc-200 text-xs font-medium dark:border-zinc-700"
          >
            {(["rad", "deg"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAngleChange(a)}
                className={cn(
                  "px-2.5 transition-colors",
                  angle === a
                    ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-white text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

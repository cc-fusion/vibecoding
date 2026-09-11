import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SHORTCUTS } from "@/editor/keyboard";

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-shortcuts-toggle]")) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="shortcuts-pop" role="dialog" aria-label="Keyboard shortcuts">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-[13px]">Keyboard shortcuts</h3>
        <button type="button" className="btn is-icon btn-sm" aria-label="Close" onClick={onClose}>
          <X size={14} aria-hidden />
        </button>
      </div>
      <table>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys}>
              <td>{s.keys}</td>
              <td>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint mt-2">On touch devices: drag on empty space to marquee-select, or enable multi-select mode in the toolbar.</p>
    </div>,
    document.body,
  );
}

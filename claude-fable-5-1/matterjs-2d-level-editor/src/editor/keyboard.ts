import type { Editor } from "./Editor";
import type { ToolController } from "./tools";
import type { ToolId } from "./types";

export const TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  r: "rectangle",
  q: "square",
  c: "circle",
  p: "polygon",
  d: "custom",
  l: "link",
  a: "anchor",
  s: "spring",
  n: "pin",
};

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "V / R / Q / C / P / D", action: "Select · Rectangle · Square · Circle · Polygon · Draw polygon" },
  { keys: "L / A / S / N", action: "Link · Anchor · Spring · Pin constraint tools" },
  { keys: "Space", action: "Start / pause simulation" },
  { keys: ".", action: "Step one physics tick" },
  { keys: ",", action: "Stop simulation" },
  { keys: "Shift + R", action: "Reset to pre-simulation state" },
  { keys: "Delete / Backspace", action: "Delete selection (or undo last polygon vertex)" },
  { keys: "Ctrl/⌘ + D", action: "Duplicate selection" },
  { keys: "Ctrl/⌘ + A", action: "Select all bodies" },
  { keys: "Ctrl/⌘ + S", action: "Save to browser storage" },
  { keys: "Shift + click / drag", action: "Add to selection · marquee select" },
  { keys: "Arrows (+Shift)", action: "Nudge selection 1px (grid spacing)" },
  { keys: "Enter", action: "Finish custom polygon" },
  { keys: "G / Shift + G", action: "Toggle grid · toggle snap" },
  { keys: "Esc", action: "Cancel operation → select tool → clear selection" },
];

function isEditableTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function attachKeyboard(editor: Editor, getTools: () => ToolController | null) {
  const onKey = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) {
      if (e.key === "Escape") (e.target as HTMLElement).blur();
      return;
    }
    const meta = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const tools = getTools();

    if (meta) {
      if (key === "d") {
        e.preventDefault();
        editor.duplicateSelection();
      } else if (key === "a") {
        e.preventDefault();
        editor.selectAll();
      } else if (key === "s") {
        e.preventDefault();
        editor.save();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        tools ? tools.escape() : editor.clearSelection();
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (tools && editor.tool === "custom" && tools.polygonDraft.length) tools.undoVertex();
        else editor.deleteSelection();
        return;
      case "Enter":
        if (tools && editor.tool === "custom" && tools.polygonDraft.length) {
          e.preventDefault();
          tools.finishPolygon();
        }
        return;
      case " ":
        e.preventDefault();
        editor.togglePlay();
        return;
      case ".":
        e.preventDefault();
        editor.step();
        return;
      case ",":
        e.preventDefault();
        editor.stop();
        return;
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown": {
        if (!editor.selectedBodies().length) return;
        e.preventDefault();
        const step = e.shiftKey ? editor.settings.grid.spacing : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        editor.moveSelectedBy(dx, dy);
        return;
      }
    }

    if (e.shiftKey && key === "r") {
      e.preventDefault();
      editor.reset();
      return;
    }
    if (e.shiftKey && key === "g") {
      e.preventDefault();
      editor.updateSettings("grid", { snap: !editor.settings.grid.snap });
      return;
    }
    if (key === "g" && !e.shiftKey) {
      e.preventDefault();
      editor.updateSettings("grid", { show: !editor.settings.grid.show });
      return;
    }
    if (!e.shiftKey && !e.altKey && key in TOOL_KEYS) {
      e.preventDefault();
      editor.setTool(TOOL_KEYS[key]);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

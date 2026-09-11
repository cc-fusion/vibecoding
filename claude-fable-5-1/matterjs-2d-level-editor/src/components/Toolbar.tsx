import {
  Circle,
  Copy,
  Download,
  Eraser,
  Grid3x3,
  Hexagon,
  Keyboard,
  Link2,
  Magnet,
  MousePointer2,
  Pause,
  PenTool,
  Pin,
  Play,
  RectangleHorizontal,
  RotateCcw,
  Save,
  SkipForward,
  Spline,
  Square,
  SquareStack,
  Anchor,
  Trash2,
  Upload,
  Square as StopIcon,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { pickJsonFile } from "@/editor/storage";
import type { ToolId } from "@/editor/types";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import { AlignControls } from "./panels/AlignControls";
import { ShortcutsHelp } from "./ShortcutsHelp";

type IconType = typeof Circle;

const BODY_TOOLS: { id: ToolId; label: string; key: string; Icon: IconType }[] = [
  { id: "select", label: "Select / move", key: "V", Icon: MousePointer2 },
  { id: "rectangle", label: "Rectangle", key: "R", Icon: RectangleHorizontal },
  { id: "square", label: "Square", key: "Q", Icon: Square },
  { id: "circle", label: "Circle", key: "C", Icon: Circle },
  { id: "polygon", label: "Regular polygon", key: "P", Icon: Hexagon },
  { id: "custom", label: "Draw custom polygon", key: "D", Icon: PenTool },
];

const CONSTRAINT_TOOLS: { id: ToolId; label: string; key: string; Icon: IconType }[] = [
  { id: "link", label: "Body-to-body link", key: "L", Icon: Link2 },
  { id: "anchor", label: "World anchor to body", key: "A", Icon: Anchor },
  { id: "spring", label: "Spring", key: "S", Icon: Spline },
  { id: "pin", label: "Pin / hinge", key: "N", Icon: Pin },
];

function ToolButton({ id, label, hotkey, Icon }: { id: ToolId; label: string; hotkey: string; Icon: IconType }) {
  const editor = useEditor();
  const active = editor.tool === id;
  return (
    <button type="button" className={`btn is-icon ${active ? "is-active" : ""}`} aria-label={`${label} (${hotkey})`} aria-pressed={active} title={`${label} — ${hotkey}`} onClick={() => editor.setTool(id)}>
      <Icon size={17} aria-hidden />
    </button>
  );
}

export function Toolbar() {
  const editor = useEditor();
  useEditorVersion();
  const [helpOpen, setHelpOpen] = useState(false);
  const sim = editor.simState;
  const selCount = editor.selection.length;
  const hasBodies = editor.selectedBodies().length > 0;
  const grid = editor.settings.grid;

  return (
    <header className="toolbar" role="toolbar" aria-label="Editor toolbar">
      <div className="toolbar-group" role="group" aria-label="Body tools">
        {BODY_TOOLS.map((t) => (
          <ToolButton key={t.id} id={t.id} label={t.label} hotkey={t.key} Icon={t.Icon} />
        ))}
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" role="group" aria-label="Constraint tools">
        {CONSTRAINT_TOOLS.map((t) => (
          <ToolButton key={t.id} id={t.id} label={t.label} hotkey={t.key} Icon={t.Icon} />
        ))}
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" role="group" aria-label="Edit">
        <button type="button" className="btn is-icon" title="Duplicate — Ctrl/⌘ D" aria-label="Duplicate selection" disabled={!hasBodies} onClick={() => editor.duplicateSelection()}>
          <Copy size={16} aria-hidden />
        </button>
        <button type="button" className="btn is-icon is-danger" title="Delete — Del" aria-label="Delete selection" disabled={!selCount} onClick={() => editor.deleteSelection()}>
          <Trash2 size={16} aria-hidden />
        </button>
        <button
          type="button"
          className={`btn is-icon ${editor.settings.ui.stickyMultiSelect ? "is-active" : ""}`}
          title="Multi-select mode (taps add to selection)"
          aria-label="Toggle multi-select mode"
          aria-pressed={editor.settings.ui.stickyMultiSelect}
          onClick={() => editor.updateSettings("ui", { stickyMultiSelect: !editor.settings.ui.stickyMultiSelect })}
        >
          <SquareStack size={16} aria-hidden />
        </button>
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" role="group" aria-label="Align and distribute">
        <AlignControls compact />
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" role="group" aria-label="Simulation">
        <button type="button" className={`btn is-icon is-run ${sim === "running" ? "is-active" : ""}`} title="Start — Space" aria-label="Start simulation" disabled={sim === "running"} onClick={() => editor.start()}>
          <Play size={16} aria-hidden />
        </button>
        <button type="button" className={`btn is-icon is-pause ${sim === "paused" ? "is-active" : ""}`} title="Pause — Space" aria-label="Pause simulation" disabled={sim !== "running"} onClick={() => editor.pause()}>
          <Pause size={16} aria-hidden />
        </button>
        <button type="button" className="btn is-icon" title="Step one tick — ." aria-label="Step simulation" disabled={sim === "running"} onClick={() => editor.step()}>
          <SkipForward size={16} aria-hidden />
        </button>
        <button type="button" className="btn is-icon" title="Stop (keep positions) — ," aria-label="Stop simulation" disabled={sim === "stopped"} onClick={() => editor.stop()}>
          <StopIcon size={15} aria-hidden fill="currentColor" />
        </button>
        <button type="button" className="btn is-icon" title="Reset to pre-simulation state — Shift R" aria-label="Reset scene" disabled={!editor.resetSnapshot} onClick={() => editor.reset()}>
          <RotateCcw size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="btn is-icon is-danger"
          title="Clear all bodies and constraints"
          aria-label="Clear scene"
          disabled={!editor.bodies.length && !editor.constraints.length}
          onClick={() => {
            if (window.confirm("Remove all bodies and constraints from the scene?")) editor.clear();
          }}
        >
          <Eraser size={16} aria-hidden />
        </button>
        <span className={`badge ml-1 ${sim === "running" ? "is-running" : sim === "paused" ? "is-paused" : ""}`} role="status" aria-live="polite">
          <span className="dot" aria-hidden />
          {sim === "running" ? "Running" : sim === "paused" ? "Paused" : "Editing"}
        </span>
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" role="group" aria-label="View">
        <button type="button" className={`btn is-icon ${grid.show ? "is-active" : ""}`} title="Toggle grid — G" aria-label="Toggle grid" aria-pressed={grid.show} onClick={() => editor.updateSettings("grid", { show: !grid.show })}>
          <Grid3x3 size={16} aria-hidden />
        </button>
        <button type="button" className={`btn is-icon ${grid.snap ? "is-active" : ""}`} title="Toggle snap to grid — Shift G" aria-label="Toggle snap" aria-pressed={grid.snap} onClick={() => editor.updateSettings("grid", { snap: !grid.snap })}>
          <Magnet size={16} aria-hidden />
        </button>
      </div>
      <span className="toolbar-sep" />
      <div className="toolbar-group" role="group" aria-label="File">
        <button type="button" className="btn is-icon" title="Save — Ctrl/⌘ S" aria-label="Save to browser storage" onClick={() => editor.save()}>
          <Save size={16} aria-hidden />
        </button>
        <button type="button" className="btn is-icon" title="Load saved level" aria-label="Load from browser storage" onClick={() => editor.load()}>
          <FolderOpen size={16} aria-hidden />
        </button>
        <button type="button" className="btn is-icon" title="Export JSON" aria-label="Export JSON" onClick={() => editor.exportJson()}>
          <Download size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="btn is-icon"
          title="Import JSON"
          aria-label="Import JSON"
          onClick={async () => {
            const text = await pickJsonFile();
            if (text !== null) editor.importJson(text);
          }}
        >
          <Upload size={16} aria-hidden />
        </button>
      </div>
      <div className="toolbar-group ml-auto pl-2">
        <button type="button" data-shortcuts-toggle className={`btn is-icon ${helpOpen ? "is-active" : ""}`} title="Keyboard shortcuts" aria-label="Keyboard shortcuts" aria-expanded={helpOpen} onClick={() => setHelpOpen((v) => !v)}>
          <Keyboard size={16} aria-hidden />
        </button>
      </div>
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </header>
  );
}

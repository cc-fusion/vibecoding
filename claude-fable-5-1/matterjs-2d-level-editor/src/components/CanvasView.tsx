import { Check, SlidersHorizontal, Undo2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { ToolController, isConstraintTool } from "@/editor/tools";
import { useEditor, useEditorVersion } from "@/editor/useEditor";

const TOOL_HINTS: Record<string, string> = {
  select: "",
  rectangle: "Drag to size a rectangle · tap to place last-used size",
  square: "Drag to size a square · tap to place last-used size",
  circle: "Drag from centre to set radius · tap to place last-used radius",
  polygon: "Drag from centre to set radius · tap to place last-used polygon",
  custom: "Tap to add vertices · tap first vertex, double-tap or Enter to finish",
  link: "Tap first body, then a second body",
  anchor: "Tap a world anchor point, then a body",
  spring: "Tap a body or empty space, then a body",
  pin: "Tap a body to pin it · tap overlapping bodies to hinge them",
};

export function CanvasView() {
  const editor = useEditor();
  useEditorVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    editor.attach(canvas);
    const tools = new ToolController(editor, canvas);
    tools.attach();
    editor.tools = tools;
    return () => {
      tools.detach();
      if (editor.tools === tools) editor.tools = null;
      editor.detach();
    };
  }, [editor]);

  const preview = editor.preview;
  const draft = preview?.type === "polygon-draft" ? preview : null;
  const pendingConstraint = preview?.type === "constraint" && preview.a ? preview : null;
  const tool = editor.tool;
  let hint = TOOL_HINTS[tool] ?? "";
  let hintError = false;
  if (draft) {
    if (draft.points.length >= 3 && draft.error) {
      hint = draft.error;
      hintError = true;
    } else if (draft.points.length >= 3) hint = `${draft.points.length} vertices · tap first vertex or Finish to create`;
    else hint = `${draft.points.length} of 3 minimum vertices placed`;
  } else if (pendingConstraint) {
    hint = isConstraintTool(tool) ? "Now tap the second body" : hint;
  }

  const sel = editor.selection;
  const selText =
    sel.length === 0 ? "nothing selected" : sel.length === 1 ? (sel[0].type === "body" ? editor.getBody(sel[0].id)?.body.label : editor.getConstraint(sel[0].id)?.constraint.label) : `${sel.length} selected`;
  const g = editor.engine.gravity;

  return (
    <main className="canvas-area">
      <canvas ref={canvasRef} className={`tool-${tool}`} tabIndex={0} aria-label="Level canvas" />

      {(hint || draft || pendingConstraint) && (
        <div className={`tool-hint ${hintError ? "is-error" : ""}`} role="status" aria-live="polite">
          <span className="truncate">{hint}</span>
          {(draft?.points.length || pendingConstraint) && (
            <span className="actions">
              {draft && (
                <>
                  <button type="button" className="btn btn-sm is-primary" disabled={!draft.canClose} onClick={() => editor.tools?.finishPolygon()} aria-label="Finish polygon">
                    <Check size={12} aria-hidden /> Finish
                  </button>
                  <button type="button" className="btn btn-sm is-outline" onClick={() => editor.tools?.undoVertex()} aria-label="Undo last vertex">
                    <Undo2 size={12} aria-hidden />
                  </button>
                </>
              )}
              <button type="button" className="btn btn-sm is-outline" onClick={() => editor.tools?.escape()} aria-label="Cancel">
                <X size={12} aria-hidden />
              </button>
            </span>
          )}
        </div>
      )}

      <div className="statusbar" aria-hidden>
        <span>
          <strong>{editor.width}</strong>×<strong>{editor.height}</strong>
        </span>
        {editor.cursor && (
          <span>
            x <strong>{Math.round(editor.cursor.x)}</strong> y <strong>{Math.round(editor.cursor.y)}</strong>
          </span>
        )}
        <span>{selText}</span>
        <span>
          g <strong>{g.x.toFixed(2)}</strong>, <strong>{g.y.toFixed(2)}</strong>
          {editor.usingSensorGravity ? " (sensor)" : ""}
        </span>
        <span>
          {editor.bodies.length}b · {editor.constraints.length}c
        </span>
        <span>
          tick <strong>{editor.stepCount}</strong>
        </span>
        <span>{editor.fps} fps</span>
      </div>

      <div className="toasts" role="log" aria-live="polite">
        {editor.toasts.map((t) => (
          <div key={t.id} className={`toast is-${t.kind}`}>
            <span className="font-semibold uppercase text-[10px] tracking-wide pt-0.5" style={{ color: t.kind === "error" ? "var(--danger)" : t.kind === "success" ? "var(--ok)" : t.kind === "warning" ? "var(--warn)" : "var(--accent)" }}>
              {t.kind}
            </span>
            <span>{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => editor.dismissToast(t.id)}>
              <X size={13} aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {!editor.panelOpen && (
        <button type="button" className="fab" onClick={() => editor.setPanelOpen(true)} aria-label="Open properties panel">
          <SlidersHorizontal size={16} aria-hidden />
          {sel.length === 0 ? (tool === "select" ? "World" : "Tool") : sel.length === 1 ? "Properties" : `${sel.length} selected`}
        </button>
      )}
    </main>
  );
}

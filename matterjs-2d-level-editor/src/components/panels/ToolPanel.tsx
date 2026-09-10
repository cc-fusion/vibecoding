import { Check, Undo2, X } from "lucide-react";
import { BODY_KIND_LABEL } from "@/editor/bodies";
import { CONSTRAINT_KIND_LABEL } from "@/editor/constraints";
import { isConstraintTool } from "@/editor/tools";
import type { BodyKind, ConstraintKind } from "@/editor/types";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import { CheckField, ColorField, NumberField, Row, Section, SelectField } from "../fields";

const BODY_HELP: Record<BodyKind, string> = {
  rectangle: "Drag corner-to-corner to size a rectangle, or tap to place one with the last-used size.",
  square: "Drag to size a square (largest side wins), or tap to place the last-used size.",
  circle: "Drag outward from the centre to set the radius, or tap to place the last-used radius.",
  polygon: "Drag outward from the centre to set the radius, or tap to place the last-used polygon.",
  custom: "Tap to place vertices. Finish by tapping the first vertex, double-tapping, pressing Enter, or using Finish below.",
};

const CONSTRAINT_HELP: Record<ConstraintKind, string> = {
  link: "Tap a point on the first body, then a point on a second body. Rigid by default.",
  anchor: "Tap a world point for the anchor, then tap the body to attach.",
  spring: "Tap a body or empty space for the first end, then a body for the second. Soft with damping.",
  pin: "Tap a body to pin that point to the world. Tap where two bodies overlap to hinge them together.",
};

export function ToolPanel() {
  const editor = useEditor();
  useEditorVersion();
  const tool = editor.tool;

  if (isConstraintTool(tool)) {
    const d = editor.lastUsed.constraints[tool];
    const pending = editor.preview?.type === "constraint" && editor.preview.a;
    return (
      <>
        <div className="section-body pt-3">
          <p className="hint">{CONSTRAINT_HELP[tool]}</p>
          {pending && (
            <div className="note is-ok flex items-center justify-between gap-2">
              <span>First endpoint set — tap the second body.</span>
              <button type="button" className="btn btn-sm is-outline" onClick={() => editor.tools?.escape()}>
                <X size={12} aria-hidden /> Cancel
              </button>
            </div>
          )}
        </div>
        <Section id={`t-${tool}`} title={`${CONSTRAINT_KIND_LABEL[tool]} defaults`}>
          <p className="hint">Remembered separately for each constraint type. Editing a selected constraint also updates these.</p>
          <NumberField label="Stiffness" value={d.stiffness} min={0} max={1} step={0.01} slider onCommit={(v) => editor.updateLastUsedConstraint(tool, { stiffness: v })} />
          <NumberField label="Damping" value={d.damping} min={0} max={1} step={0.01} slider onCommit={(v) => editor.updateLastUsedConstraint(tool, { damping: v })} />
          {tool !== "pin" && (
            <>
              <SelectField
                label="Length"
                value={d.lengthMode}
                options={[
                  { value: "auto", label: "Distance between endpoints" },
                  { value: "fixed", label: "Fixed value" },
                ]}
                onChange={(v) => editor.updateLastUsedConstraint(tool, { lengthMode: v })}
              />
              {d.lengthMode === "fixed" && <NumberField label="Fixed length" value={d.length} min={0} max={5000} unit="px" onCommit={(v) => editor.updateLastUsedConstraint(tool, { length: v })} />}
            </>
          )}
          <SelectField
            label="Style"
            value={d.render.type}
            options={[
              { value: "line", label: "Line" },
              { value: "spring", label: "Spring coil" },
            ]}
            onChange={(v) => editor.updateLastUsedConstraint(tool, { render: { ...d.render, type: v } })}
          />
          <ColorField label="Color" value={d.render.strokeStyle} onChange={(v) => editor.updateLastUsedConstraint(tool, { render: { ...d.render, strokeStyle: v } })} />
          <NumberField label="Line width" value={d.render.lineWidth} min={0.5} max={10} step={0.5} decimals={1} onCommit={(v) => editor.updateLastUsedConstraint(tool, { render: { ...d.render, lineWidth: v } })} />
        </Section>
      </>
    );
  }

  const kind = tool as BodyKind;
  const d = editor.lastUsed.bodies[kind];
  const draft = editor.preview?.type === "polygon-draft" ? editor.preview : null;
  const patch = (p: Partial<typeof d>) => editor.updateLastUsedBody(kind, p as never);

  return (
    <>
      <div className="section-body pt-3">
        <p className="hint">{BODY_HELP[kind]}</p>
        {kind === "custom" && (
          <div className={`note ${draft?.error && draft.points.length >= 3 ? "is-error" : draft?.canClose ? "is-ok" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <span>
                {draft ? `${draft.points.length} vertex${draft.points.length === 1 ? "" : "es"} placed` : "No vertices yet"}
                {draft?.error && draft.points.length >= 3 ? ` — ${draft.error}` : draft?.canClose ? " — valid, ready to finish" : draft && draft.points.length < 3 ? ` — need ${3 - draft.points.length} more` : ""}
              </span>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <button type="button" className="btn btn-sm is-primary" disabled={!draft?.canClose} onClick={() => editor.tools?.finishPolygon()}>
                <Check size={12} aria-hidden /> Finish
              </button>
              <button type="button" className="btn btn-sm is-outline" disabled={!draft?.points.length} onClick={() => editor.tools?.undoVertex()}>
                <Undo2 size={12} aria-hidden /> Undo vertex
              </button>
              <button type="button" className="btn btn-sm is-outline" disabled={!draft?.points.length} onClick={() => editor.tools?.escape()}>
                <X size={12} aria-hidden /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <Section id={`t-${kind}`} title={`${BODY_KIND_LABEL[kind]} defaults`}>
        <p className="hint">Remembered separately for each shape type and applied to new {BODY_KIND_LABEL[kind].toLowerCase()}s.</p>
        {kind === "rectangle" && "width" in d && (
          <>
            <NumberField label="Width" value={d.width} min={2} max={4000} unit="px" onCommit={(v) => patch({ width: v } as never)} />
            <NumberField label="Height" value={d.height} min={2} max={4000} unit="px" onCommit={(v) => patch({ height: v } as never)} />
          </>
        )}
        {kind === "square" && "size" in d && <NumberField label="Size" value={d.size} min={2} max={4000} unit="px" onCommit={(v) => patch({ size: v } as never)} />}
        {kind === "circle" && "radius" in d && <NumberField label="Radius" value={d.radius} min={1} max={2000} unit="px" onCommit={(v) => patch({ radius: v } as never)} />}
        {kind === "polygon" && "sides" in d && (
          <>
            <NumberField label="Sides" value={d.sides} min={3} max={24} decimals={0} onCommit={(v) => patch({ sides: Math.round(v) } as never)} />
            <NumberField label="Radius" value={d.radius} min={1} max={2000} unit="px" onCommit={(v) => patch({ radius: v } as never)} />
          </>
        )}
        <CheckField label="Static" checked={d.isStatic} onChange={(v) => patch({ isStatic: v })} />
        <CheckField label="Sensor" checked={d.isSensor} onChange={(v) => patch({ isSensor: v })} />
        <NumberField label="Density" value={d.density} step={0.0005} min={0.00001} decimals={5} onCommit={(v) => patch({ density: v })} />
        <NumberField label="Restitution" value={d.restitution} min={0} max={1} step={0.05} slider onCommit={(v) => patch({ restitution: v })} />
        <NumberField label="Friction" value={d.friction} min={0} max={1} step={0.05} slider onCommit={(v) => patch({ friction: v })} />
        <NumberField label="Air friction" value={d.frictionAir} min={0} max={1} step={0.005} decimals={3} onCommit={(v) => patch({ frictionAir: v })} />
        <ColorField label="Fill" value={d.render.fillStyle} onChange={(v) => patch({ render: { ...d.render, fillStyle: v } })} />
        <ColorField label="Stroke" value={d.render.strokeStyle} onChange={(v) => patch({ render: { ...d.render, strokeStyle: v } })} />
        <Row label="Opacity">
          <NumberField bare value={d.render.opacity} min={0} max={1} step={0.05} slider onCommit={(v) => patch({ render: { ...d.render, opacity: v } })} />
        </Row>
      </Section>
    </>
  );
}

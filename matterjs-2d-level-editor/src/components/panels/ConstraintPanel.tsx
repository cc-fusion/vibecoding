import { Trash2 } from "lucide-react";
import { CONSTRAINT_KIND_LABEL, constraintWorldPoints, type ConstraintPropKey, type EditorConstraint } from "@/editor/constraints";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import { CheckField, ColorField, NumberField, Row, Section, SelectField, TextField } from "../fields";

export function ConstraintPanel({ entity }: { entity: EditorConstraint }) {
  const editor = useEditor();
  useEditorVersion();
  const c = entity.constraint;
  const set = (key: ConstraintPropKey, v: number | string | boolean) => editor.setConstraintProp(entity.id, key, v);
  const render = c.render as unknown as { strokeStyle?: string; lineWidth?: number; type?: string; anchors?: boolean };
  const { a, b } = constraintWorldPoints(c);
  const currentLength = Math.hypot(a.x - b.x, a.y - b.y);
  const bodyA = entity.bodyAId ? editor.getBody(entity.bodyAId) : null;
  const bodyB = entity.bodyBId ? editor.getBody(entity.bodyBId) : null;
  const isPin = entity.kind === "pin";

  const endpoint = (which: "A" | "B") => {
    const body = which === "A" ? bodyA : bodyB;
    const pt = which === "A" ? c.pointA : c.pointB;
    const world = which === "A" ? a : b;
    const kx: ConstraintPropKey = which === "A" ? "pointAx" : "pointBx";
    const ky: ConstraintPropKey = which === "A" ? "pointAy" : "pointBy";
    return (
      <Section id={`c-end${which}`} title={`Endpoint ${which} — ${body ? "body" : "world point"}`}>
        {body ? (
          <>
            <Row label="Body">
              <button type="button" className="btn btn-sm is-outline justify-start" onClick={() => editor.select([{ type: "body", id: body.id }])}>
                {body.body.label}
              </button>
            </Row>
            <Row label="Offset">
              <div className="field-pair">
                <NumberField bare value={pt.x} step={1} title={`Offset X from ${body.body.label}`} onCommit={(v) => set(kx, v)} />
                <NumberField bare value={pt.y} step={1} title={`Offset Y from ${body.body.label}`} onCommit={(v) => set(ky, v)} />
              </div>
            </Row>
            <Row label="World">
              <span className="hint font-mono">
                {world.x.toFixed(1)}, {world.y.toFixed(1)}
              </span>
            </Row>
          </>
        ) : (
          <Row label="Anchor">
            <div className="field-pair">
              <NumberField bare value={pt.x} step={1} title="World anchor X" onCommit={(v) => set(kx, v)} />
              <NumberField bare value={pt.y} step={1} title="World anchor Y" onCommit={(v) => set(ky, v)} />
            </div>
          </Row>
        )}
      </Section>
    );
  };

  return (
    <>
      <div className="section-body pt-3">
        <TextField label="Label" value={c.label} onCommit={(v) => set("label", v)} />
        <Row label="Type">
          <span className="hint">{CONSTRAINT_KIND_LABEL[entity.kind]}</span>
        </Row>
        <Row label="ID">
          <span className="hint font-mono truncate" title={entity.id}>
            {entity.id}
          </span>
        </Row>
        <button type="button" className="btn is-outline is-danger" onClick={() => editor.deleteSelection()}>
          <Trash2 size={14} aria-hidden /> Delete constraint
        </button>
      </div>

      <Section id="c-behaviour" title="Behaviour">
        {!isPin && (
          <>
            <NumberField label="Rest length" value={c.length} min={0} max={5000} step={1} unit="px" onCommit={(v) => set("length", v)} />
            <Row label="Current">
              <div className="flex items-center gap-2">
                <span className="hint font-mono">{currentLength.toFixed(1)} px</span>
                <button type="button" className="btn btn-sm is-outline" onClick={() => set("length", currentLength)}>
                  Use current
                </button>
              </div>
            </Row>
          </>
        )}
        {isPin && <p className="hint">Pins are zero-length rigid joints; bodies rotate freely around the pin point.</p>}
        <NumberField label="Stiffness" value={c.stiffness} min={0} max={1} step={0.01} slider onCommit={(v) => set("stiffness", v)} title="1 = rigid, < 0.1 = soft spring" />
        <NumberField label="Damping" value={c.damping ?? 0} min={0} max={1} step={0.01} slider onCommit={(v) => set("damping", v)} title="Only meaningful for soft constraints" />
        {c.stiffness >= 0.9 && (c.damping ?? 0) > 0 && <p className="hint">Damping has little effect at high stiffness.</p>}
      </Section>

      {endpoint("A")}
      {endpoint("B")}

      <Section id="c-appearance" title="Appearance">
        <SelectField
          label="Style"
          value={(render.type === "spring" ? "spring" : "line") as "line" | "spring"}
          options={[
            { value: "line", label: "Line" },
            { value: "spring", label: "Spring coil" },
          ]}
          onChange={(v) => set("type", v)}
        />
        <ColorField label="Color" value={render.strokeStyle ?? "#ffffff"} onChange={(v) => set("strokeStyle", v)} />
        <NumberField label="Line width" value={render.lineWidth ?? 2} min={0.5} max={10} step={0.5} decimals={1} onCommit={(v) => set("lineWidth", v)} />
        <CheckField label="Anchors" checked={render.anchors !== false} hint="Draw endpoint markers" onChange={(v) => set("anchors", v)} />
      </Section>
    </>
  );
}

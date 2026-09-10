import { Copy, Trash2 } from "lucide-react";
import { BODY_KIND_LABEL, readBodyPhysics, type BodyPropKey, type EditorBody } from "@/editor/bodies";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import { CheckField, ColorField, NumberField, Row, Section, TextField, shared, type Mixed } from "../fields";
import { AlignControls } from "./AlignControls";

const DEG = 180 / Math.PI;

/** Shared physics + collision + appearance controls used by both single and batch editing. */
function PhysicsSections({ bodies, set, single }: { bodies: EditorBody[]; set: (key: BodyPropKey, v: number | string | boolean) => void; single: boolean }) {
  const phys = bodies.map((b) => readBodyPhysics(b.body));
  const pick = <K extends keyof (typeof phys)[0]>(k: K) => shared(phys.map((p) => p[k])) as (typeof phys)[0][K] | Mixed;
  const isStatic = pick("isStatic");
  const rend = bodies.map((b) => b.body.render);

  return (
    <>
      <Section id="b-physics" title="Physics">
        <CheckField label="Static" checked={isStatic} hint="Immovable, infinite mass" onChange={(v) => set("isStatic", v)} />
        <CheckField label="Sensor" checked={pick("isSensor")} hint="Detects overlap, no collision response" onChange={(v) => set("isSensor", v)} />
        <NumberField label="Density" value={pick("density")} step={0.0005} min={0.00001} decimals={5} onCommit={(v) => set("density", v)} title="Mass is derived from density × area" />
        {single && (
          <>
            <NumberField label="Mass" value={phys[0].mass} step={0.1} min={0.0001} decimals={3} onCommit={(v) => set("mass", v)} title="Setting mass updates density for this area" />
            <Row label="Area / inertia">
              <span className="hint font-mono">
                {phys[0].area.toFixed(0)} px² · {Number.isFinite(phys[0].inertia) ? phys[0].inertia.toFixed(0) : "∞"}
              </span>
            </Row>
          </>
        )}
        {isStatic === true && <p className="hint">Static bodies report infinite mass to Matter.js; the values above are kept and restored when the body becomes dynamic again.</p>}
        <NumberField label="Restitution" value={pick("restitution")} min={0} max={1} step={0.05} slider onCommit={(v) => set("restitution", v)} />
        <NumberField label="Friction" value={pick("friction")} min={0} max={1} step={0.05} slider onCommit={(v) => set("friction", v)} />
        <NumberField label="Static friction" value={pick("frictionStatic")} min={0} max={10} step={0.1} onCommit={(v) => set("frictionStatic", v)} />
        <NumberField label="Air friction" value={pick("frictionAir")} min={0} max={1} step={0.005} decimals={3} onCommit={(v) => set("frictionAir", v)} />
        <NumberField label="Sleep threshold" value={pick("sleepThreshold")} min={-1} max={600} decimals={0} title="Frames of low motion before sleeping (requires engine sleeping)" onCommit={(v) => set("sleepThreshold", v)} />
      </Section>

      <Section id="b-collision" title="Collision filter" defaultOpen={false}>
        <NumberField label="Group" value={shared(phys.map((p) => p.collisionFilter.group))} step={1} decimals={0} title="Same positive group always collides; same negative group never collides" onCommit={(v) => set("group", Math.trunc(v))} />
        <NumberField label="Category" value={shared(phys.map((p) => p.collisionFilter.category))} step={1} min={1} decimals={0} title="Bit flag (1, 2, 4, 8 …)" onCommit={(v) => set("category", Math.trunc(v))} />
        <NumberField label="Mask" value={shared(phys.map((p) => p.collisionFilter.mask))} step={1} min={0} decimals={0} title="Bitmask of categories this body collides with" onCommit={(v) => set("mask", Math.trunc(v))} />
        <p className="hint">Bodies collide when both masks include the other's category, unless a non-zero group overrides it.</p>
      </Section>

      <Section id="b-appearance" title="Appearance">
        <ColorField label="Fill" value={shared(rend.map((r) => String(r.fillStyle ?? "")))} onChange={(v) => set("fillStyle", v)} />
        <ColorField label="Stroke" value={shared(rend.map((r) => String(r.strokeStyle ?? "")))} onChange={(v) => set("strokeStyle", v)} />
        <NumberField label="Stroke width" value={shared(rend.map((r) => r.lineWidth ?? 1))} min={0} max={10} step={0.5} decimals={1} onCommit={(v) => set("lineWidth", v)} />
        <NumberField label="Opacity" value={shared(rend.map((r) => r.opacity ?? 1))} min={0} max={1} step={0.05} slider onCommit={(v) => set("opacity", v)} />
      </Section>
    </>
  );
}

function ShapeSection({ entity }: { entity: EditorBody }) {
  const editor = useEditor();
  const shape = entity.shape;
  return (
    <Section id="b-shape" title="Shape">
      <Row label="Type">
        <span className="hint">{BODY_KIND_LABEL[shape.kind]}</span>
      </Row>
      {shape.kind === "rectangle" && (
        <>
          <NumberField label="Width" value={shape.width} min={2} max={4000} unit="px" onCommit={(v) => editor.reshape(entity.id, { ...shape, width: v })} />
          <NumberField label="Height" value={shape.height} min={2} max={4000} unit="px" onCommit={(v) => editor.reshape(entity.id, { ...shape, height: v })} />
        </>
      )}
      {shape.kind === "square" && <NumberField label="Size" value={shape.size} min={2} max={4000} unit="px" onCommit={(v) => editor.reshape(entity.id, { ...shape, size: v })} />}
      {shape.kind === "circle" && <NumberField label="Radius" value={shape.radius} min={1} max={2000} unit="px" onCommit={(v) => editor.reshape(entity.id, { ...shape, radius: v })} />}
      {shape.kind === "polygon" && (
        <>
          <NumberField label="Sides" value={shape.sides} min={3} max={24} decimals={0} onCommit={(v) => editor.reshape(entity.id, { ...shape, sides: Math.round(v) })} />
          <NumberField label="Radius" value={shape.radius} min={1} max={2000} unit="px" onCommit={(v) => editor.reshape(entity.id, { ...shape, radius: v })} />
        </>
      )}
      {shape.kind === "custom" && (
        <Row label="Vertices">
          <span className="hint font-mono">
            {shape.vertices.length} · {entity.body.parts.length > 1 ? `${entity.body.parts.length - 1} convex parts` : "convex"}
          </span>
        </Row>
      )}
    </Section>
  );
}

export function BodyPanel({ entity }: { entity: EditorBody }) {
  const editor = useEditor();
  useEditorVersion();
  const b = entity.body;
  const set = (key: BodyPropKey, v: number | string | boolean) => editor.setBodyProp([entity.id], key, v);
  const attached = editor.constraints.filter((c) => c.bodyAId === entity.id || c.bodyBId === entity.id);

  return (
    <>
      <div className="section-body pt-3">
        <TextField label="Label" value={b.label} onCommit={(v) => set("label", v)} />
        <Row label="ID">
          <span className="hint font-mono truncate" title={entity.id}>
            {entity.id}
          </span>
        </Row>
        <div className="flex gap-1.5 pt-1">
          <button type="button" className="btn is-outline flex-1" onClick={() => editor.duplicateSelection()}>
            <Copy size={14} aria-hidden /> Duplicate
          </button>
          <button type="button" className="btn is-outline is-danger flex-1" onClick={() => editor.deleteSelection()}>
            <Trash2 size={14} aria-hidden /> Delete
          </button>
        </div>
      </div>

      <Section id="b-transform" title="Transform">
        <Row label="Position">
          <div className="field-pair">
            <NumberField bare value={b.position.x} step={1} title="X" onCommit={(v) => set("x", v)} />
            <NumberField bare value={b.position.y} step={1} title="Y" onCommit={(v) => set("y", v)} />
          </div>
        </Row>
        <NumberField label="Angle" value={b.angle * DEG} step={1} unit="deg" decimals={1} onCommit={(v) => set("angle", v / DEG)} />
        <Row label="Velocity">
          <div className="field-pair">
            <NumberField bare value={b.velocity.x} step={0.5} title="Velocity X" onCommit={(v) => set("vx", v)} />
            <NumberField bare value={b.velocity.y} step={0.5} title="Velocity Y" onCommit={(v) => set("vy", v)} />
          </div>
        </Row>
        <NumberField label="Angular vel." value={b.angularVelocity} step={0.01} decimals={3} unit="rad/t" onCommit={(v) => set("angularVelocity", v)} />
        {b.isSleeping && <p className="hint">Body is sleeping.</p>}
      </Section>

      <ShapeSection entity={entity} />
      <PhysicsSections bodies={[entity]} set={set} single />

      {attached.length > 0 && (
        <Section id="b-constraints" title="Attached constraints" defaultOpen={false}>
          {attached.map((c) => (
            <button key={c.id} type="button" className="btn is-outline justify-start w-full" onClick={() => editor.select([{ type: "constraint", id: c.id }])}>
              {c.constraint.label}
            </button>
          ))}
        </Section>
      )}
    </>
  );
}

export function MultiBodyPanel({ bodies }: { bodies: EditorBody[] }) {
  const editor = useEditor();
  useEditorVersion();
  const ids = bodies.map((b) => b.id);
  const set = (key: BodyPropKey, v: number | string | boolean) => editor.setBodyProp(ids, key, v);
  const kinds = new Set(bodies.map((b) => b.kind));
  const constraintCount = editor.selectedConstraints().length;

  return (
    <>
      <div className="section-body pt-3">
        <p className="hint">
          {bodies.length} bodies selected ({[...kinds].map((k) => BODY_KIND_LABEL[k]).join(", ")})
          {constraintCount ? ` · ${constraintCount} constraint(s)` : ""}. Fields showing <span className="kbd">Mixed</span> differ across the selection; editing applies to all.
        </p>
        <div className="flex gap-1.5 pt-1">
          <button type="button" className="btn is-outline flex-1" onClick={() => editor.duplicateSelection()}>
            <Copy size={14} aria-hidden /> Duplicate
          </button>
          <button type="button" className="btn is-outline is-danger flex-1" onClick={() => editor.deleteSelection()}>
            <Trash2 size={14} aria-hidden /> Delete
          </button>
        </div>
      </div>
      <Section id="m-arrange" title="Arrange">
        <AlignControls />
      </Section>
      <Section id="m-transform" title="Transform">
        <NumberField label="Angle" value={shared(bodies.map((b) => Math.round(b.body.angle * DEG * 10) / 10))} step={1} unit="deg" decimals={1} onCommit={(v) => set("angle", v / DEG)} />
        <Row label="Velocity">
          <div className="field-pair">
            <NumberField bare value={shared(bodies.map((b) => Math.round(b.body.velocity.x * 100) / 100))} step={0.5} title="Velocity X" onCommit={(v) => set("vx", v)} />
            <NumberField bare value={shared(bodies.map((b) => Math.round(b.body.velocity.y * 100) / 100))} step={0.5} title="Velocity Y" onCommit={(v) => set("vy", v)} />
          </div>
        </Row>
        <NumberField label="Angular vel." value={shared(bodies.map((b) => Math.round(b.body.angularVelocity * 1000) / 1000))} step={0.01} decimals={3} onCommit={(v) => set("angularVelocity", v)} />
      </Section>
      <PhysicsSections bodies={bodies} set={set} single={false} />
    </>
  );
}

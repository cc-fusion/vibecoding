import { Download, Eraser, FolderOpen, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import { pickJsonFile } from "@/editor/storage";
import { CheckField, ColorField, NumberField, Row, Section, TextField } from "../fields";
import { GravitySection } from "./GravitySection";

export function WorldPanel() {
  const editor = useEditor();
  useEditorVersion();
  const s = editor.settings;

  return (
    <>
      <Section id="world" title="World">
        <TextField label="Level name" value={s.world.name} onCommit={(v) => editor.updateSettings("world", { name: v })} />
        <ColorField label="Background" value={s.world.background} onChange={(v) => editor.updateSettings("world", { background: v })} />
        <Row label="Canvas">
          <span className="hint font-mono">
            {editor.width} × {editor.height} px · origin top-left
          </span>
        </Row>
        <Row label="Contents">
          <span className="hint font-mono">
            {editor.bodies.length} bodies · {editor.constraints.length} constraints
          </span>
        </Row>
      </Section>

      <Section id="engine" title="Engine">
        <NumberField label="Time scale" value={s.engine.timeScale} min={0} max={3} step={0.05} slider onCommit={(v) => editor.updateSettings("engine", { timeScale: v })} />
        <NumberField label="Step rate" value={s.engine.stepHz} min={10} max={240} step={1} unit="Hz" decimals={0} onCommit={(v) => editor.updateSettings("engine", { stepHz: v })} />
        <CheckField label="Sleeping" checked={s.engine.enableSleeping} hint="Idle bodies sleep" onChange={(v) => editor.updateSettings("engine", { enableSleeping: v })} />
        <NumberField label="Position iter." value={s.engine.positionIterations} min={1} max={20} decimals={0} onCommit={(v) => editor.updateSettings("engine", { positionIterations: Math.round(v) })} />
        <NumberField label="Velocity iter." value={s.engine.velocityIterations} min={1} max={20} decimals={0} onCommit={(v) => editor.updateSettings("engine", { velocityIterations: Math.round(v) })} />
        <NumberField label="Constraint iter." value={s.engine.constraintIterations} min={1} max={10} decimals={0} onCommit={(v) => editor.updateSettings("engine", { constraintIterations: Math.round(v) })} />
        <p className="hint">Higher iteration counts improve stacking and joint stability at a CPU cost.</p>
      </Section>

      <Section id="render" title="Rendering & debug">
        <CheckField label="Wireframes" checked={s.render.wireframes} onChange={(v) => editor.updateSettings("render", { wireframes: v })} />
        <CheckField label="Angle axes" checked={s.render.showAxes} onChange={(v) => editor.updateSettings("render", { showAxes: v })} />
        <CheckField label="Labels" checked={s.render.showLabels} onChange={(v) => editor.updateSettings("render", { showLabels: v })} />
        <CheckField label="AABB bounds" checked={s.render.showBounds} onChange={(v) => editor.updateSettings("render", { showBounds: v })} />
        <CheckField label="Velocities" checked={s.render.showVelocity} onChange={(v) => editor.updateSettings("render", { showVelocity: v })} />
        <CheckField label="Contacts" checked={s.render.showCollisions} hint="Collision points" onChange={(v) => editor.updateSettings("render", { showCollisions: v })} />
        <CheckField label="Sleep state" checked={s.render.showSleeping} hint="Dim sleeping bodies" onChange={(v) => editor.updateSettings("render", { showSleeping: v })} />
        <CheckField label="Anchors" checked={s.render.showConstraintAnchors} hint="Constraint endpoints" onChange={(v) => editor.updateSettings("render", { showConstraintAnchors: v })} />
        <CheckField label="Boundaries" checked={s.render.showBoundaries} hint="Draw world walls" onChange={(v) => editor.updateSettings("render", { showBoundaries: v })} />
      </Section>

      <Section id="grid" title="Grid & snap">
        <CheckField label="Show grid" checked={s.grid.show} onChange={(v) => editor.updateSettings("grid", { show: v })} />
        <CheckField label="Snap to grid" checked={s.grid.snap} hint="Placement, drawing, dragging" onChange={(v) => editor.updateSettings("grid", { snap: v })} />
        <NumberField label="Spacing" value={s.grid.spacing} min={4} max={200} step={1} unit="px" decimals={0} onCommit={(v) => editor.updateSettings("grid", { spacing: Math.round(v) })} />
      </Section>

      <GravitySection />

      <Section id="boundaries" title="Boundaries">
        <p className="hint">Static walls managed by the editor. They are not scene objects and are never selectable or exported as bodies.</p>
        <div className="grid grid-cols-2 gap-x-3">
          <CheckField label="Top" checked={s.boundaries.top} onChange={(v) => editor.updateSettings("boundaries", { top: v })} />
          <CheckField label="Bottom" checked={s.boundaries.bottom} onChange={(v) => editor.updateSettings("boundaries", { bottom: v })} />
          <CheckField label="Left" checked={s.boundaries.left} onChange={(v) => editor.updateSettings("boundaries", { left: v })} />
          <CheckField label="Right" checked={s.boundaries.right} onChange={(v) => editor.updateSettings("boundaries", { right: v })} />
        </div>
        <NumberField label="Thickness" value={s.boundaries.thickness} min={4} max={200} unit="px" decimals={0} onCommit={(v) => editor.updateSettings("boundaries", { thickness: v })} />
        <NumberField label="Friction" value={s.boundaries.friction} min={0} max={1} step={0.05} slider onCommit={(v) => editor.updateSettings("boundaries", { friction: v })} />
        <NumberField label="Restitution" value={s.boundaries.restitution} min={0} max={1} step={0.05} slider onCommit={(v) => editor.updateSettings("boundaries", { restitution: v })} />
        <ColorField label="Color" value={s.boundaries.color} onChange={(v) => editor.updateSettings("boundaries", { color: v })} />
      </Section>

      <Section id="persistence" title="Persistence">
        <p className="hint">Changes autosave to this browser's localStorage. Use export/import to move levels between devices.</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className="btn is-outline" onClick={() => editor.save()}>
            <Save size={14} aria-hidden /> Save
          </button>
          <button type="button" className="btn is-outline" onClick={() => editor.load()}>
            <FolderOpen size={14} aria-hidden /> Load
          </button>
          <button type="button" className="btn is-outline" onClick={() => editor.exportJson()}>
            <Download size={14} aria-hidden /> Export JSON
          </button>
          <button
            type="button"
            className="btn is-outline"
            onClick={async () => {
              const text = await pickJsonFile();
              if (text !== null) editor.importJson(text);
            }}
          >
            <Upload size={14} aria-hidden /> Import JSON
          </button>
          <button type="button" className="btn is-outline is-danger" onClick={() => editor.clearSavedData()}>
            <Eraser size={14} aria-hidden /> Clear saved
          </button>
          <button type="button" className="btn is-outline" onClick={() => editor.restoreDefaults()}>
            <RotateCcw size={14} aria-hidden /> Restore defaults
          </button>
        </div>
        <Row label="Storage">
          <span className="hint font-mono">{editor.storageCorrupt ? "unreadable (untouched)" : editor.hasSaved() ? "saved document present" : "empty"}</span>
        </Row>
        <button
          type="button"
          className="btn is-outline is-danger w-full"
          onClick={() => {
            if (window.confirm("Remove all bodies and constraints from the scene?")) editor.clear();
          }}
        >
          <Trash2 size={14} aria-hidden /> Clear scene
        </button>
      </Section>

      <Section id="ui" title="Editor preferences" defaultOpen={false}>
        <CheckField label="Sticky multi" checked={s.ui.stickyMultiSelect} hint="Taps add to selection" onChange={(v) => editor.updateSettings("ui", { stickyMultiSelect: v })} />
        <p className="hint">Keyboard shortcuts are listed under the keyboard icon in the toolbar.</p>
      </Section>
    </>
  );
}

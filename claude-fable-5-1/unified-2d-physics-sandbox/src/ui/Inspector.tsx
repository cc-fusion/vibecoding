import type { Sandbox } from '../app/sandbox';
import type { Tool } from '../editor/editor';
import { getVelocity, getAngularVelocity } from '../sim/rigid';
import type { RigidBodyDef, SoftBodyDef, ConstraintDef, FluidRegionDef, ToolDefaults, DebugFlags } from '../sim/schema';
import { Section, Row, NumField, SliderField, Toggle, SelectField, Btn, ColorField } from './fields';

interface Props { sb: Sandbox; selection: string[]; tool: Tool; tick: number }

const mixed = <T,>(vals: T[]): T | null => (vals.length && vals.every(v => v === vals[0]) ? vals[0] : null);
const deg = (r: number) => (r * 180) / Math.PI, rad = (d: number) => (d * Math.PI) / 180;

export function Inspector({ sb, selection, tool }: Props) {
  const w = sb.world;
  if (selection.length === 0) {
    return (
      <>
        {tool !== 'select' && <ToolPanel sb={sb} tool={tool} />}
        {tool === 'select' && <SelectHints sb={sb} />}
        <WorldPanel sb={sb} />
      </>
    );
  }
  if (selection.length === 1) {
    const id = selection[0];
    if (w.rigid.has(id)) return <RigidPanel sb={sb} id={id} />;
    if (w.soft.has(id)) return <SoftPanel sb={sb} id={id} />;
    if (w.constraints.has(id)) return <ConstraintPanel sb={sb} id={id} />;
    if (w.regions.has(id)) return <RegionPanel sb={sb} id={id} />;
  }
  return <MultiPanel sb={sb} selection={selection} />;
}

function Header({ title, sub, sb }: { title: string; sub?: string; sb: Sandbox }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div><div className="text-sm font-semibold text-zinc-100">{title}</div>{sub && <div className="text-[10.5px] text-zinc-500 font-mono truncate max-w-[200px]">{sub}</div>}</div>
      <div className="flex gap-1">
        <Btn small title="Duplicate (Ctrl+D)" onClick={() => sb.editor.duplicateSelection()}>Dup</Btn>
        <Btn small danger title="Delete (Del)" onClick={() => sb.editor.deleteSelection()}>Del</Btn>
      </div>
    </div>
  );
}

// ---------------- Rigid ----------------
function RigidPanel({ sb, id }: { sb: Sandbox; id: string }) {
  const e = sb.world.rigid.get(id)!;
  const d = e.def, b = e.body, v = getVelocity(b);
  const up = (p: Partial<RigidBodyDef>) => sb.world.updateRigid(id, p);
  return (
    <>
      <Header title={`Rigid ${d.shape}${d.isStatic ? ' (static)' : ''}`} sub={id} sb={sb} />
      <Section title="Transform">
        <NumField label="Position X" value={b.position.x} onChange={x => up({ x })} />
        <NumField label="Position Y" value={b.position.y} onChange={y => up({ y })} />
        <NumField label="Rotation" unit="°" value={deg(b.angle)} onChange={a => up({ angle: rad(a) })} step={5} />
        <NumField label="Angular vel" unit="rad/s" value={getAngularVelocity(b)} onChange={angularVelocity => up({ angularVelocity })} step={0.5} />
        <NumField label="Velocity X" unit="u/s" value={v.x} onChange={vx => up({ vx })} step={10} />
        <NumField label="Velocity Y" unit="u/s" value={v.y} onChange={vy => up({ vy })} step={10} />
      </Section>
      <Section title="Shape">
        {d.shape === 'rect' && <><NumField label="Width" value={d.w} min={2} max={4000} onChange={w => up({ w })} /><NumField label="Height" value={d.h} min={2} max={4000} onChange={h => up({ h })} /></>}
        {d.shape === 'circle' && <NumField label="Radius" value={d.radius} min={2} max={2000} onChange={radius => up({ radius })} />}
        {d.shape === 'polygon' && <NumField label="Scale radius" value={d.radius} min={4} max={2000} title="Uniformly rescales the polygon" onChange={r => { const k = r / Math.max(1e-6, d.radius); up({ radius: r, vertices: d.vertices.map(p => ({ x: p.x * k, y: p.y * k })) }); }} />}
        <ColorField label="Color" value={d.color} onChange={color => up({ color })} />
      </Section>
      <Section title="Material">
        <NumField label="Density" unit="×water" value={d.density} min={0.01} max={100} step={0.1} onChange={density => up({ density })} />
        <NumField label="Mass" value={b.mass} digits={2} disabled onChange={() => {}} />
        <NumField label="Friction" value={d.friction} min={0} max={5} step={0.05} onChange={friction => up({ friction })} />
        <NumField label="Air friction" value={d.frictionAir} min={0} max={1} step={0.005} digits={3} onChange={frictionAir => up({ frictionAir })} />
        <NumField label="Restitution" value={d.restitution} min={0} max={1} step={0.05} onChange={restitution => up({ restitution })} />
        <Row><Toggle label="Static" value={d.isStatic} onChange={isStatic => up({ isStatic, color: isStatic && d.color === '#e0a552' ? '#8a94a6' : d.color })} /><Toggle label="Sensor" value={d.isSensor} onChange={isSensor => up({ isSensor })} /></Row>
      </Section>
      <Section title="Collision filter">
        <NumField label="Category" value={d.category} min={0} max={0xffffffff} step={1} digits={0} onChange={category => up({ category: Math.round(category) })} />
        <NumField label="Mask" value={d.mask} min={0} max={0xffffffff} step={1} digits={0} onChange={mask => up({ mask: Math.round(mask) })} />
        <NumField label="Group" value={d.group} min={-1000} max={1000} step={1} digits={0} onChange={group => up({ group: Math.round(group) })} />
      </Section>
    </>
  );
}

// ---------------- Soft ----------------
function SoftPanel({ sb, id }: { sb: Sandbox; id: string }) {
  const s = sb.world.soft.get(id)!;
  const d = s.def;
  const c = new Float32Array(2); s.centroid(c);
  const up = (p: Partial<SoftBodyDef>) => sb.world.updateSoft(id, p);
  return (
    <>
      <Header title={`Soft ${d.shape}`} sub={`${id} · ${s.n} nodes`} sb={sb} />
      <Section title="Transform">
        <NumField label="Center X" value={c[0]} onChange={x => up({ x: d.x + (x - c[0]) })} />
        <NumField label="Center Y" value={c[1]} onChange={y => up({ y: d.y + (y - c[1]) })} />
        <NumField label="Velocity X" unit="u/s" value={d.vx} step={10} onChange={vx => up({ vx })} />
        <NumField label="Velocity Y" unit="u/s" value={d.vy} step={10} onChange={vy => up({ vy })} />
        <NumField label="Rotation" unit="°" value={deg(d.angle)} step={5} title="Rebuilds the rest shape" onChange={a => up({ angle: rad(a), x: c[0], y: c[1] })} />
      </Section>
      <Section title="Shape (rebuilds mesh)">
        {(d.shape === 'blob' || d.shape === 'star') && <NumField label="Radius" value={d.radius} min={10} max={1000} onChange={radius => up({ radius, x: c[0], y: c[1] })} />}
        {d.shape === 'rect' && <><NumField label="Width" value={d.w} min={10} max={3000} onChange={w => up({ w, x: c[0], y: c[1] })} /><NumField label="Height" value={d.h} min={10} max={3000} onChange={h => up({ h, x: c[0], y: c[1] })} /></>}
        {d.shape === 'star' && <><NumField label="Points" value={d.points} min={3} max={12} digits={0} onChange={p => up({ points: Math.round(p), x: c[0], y: c[1] })} /><NumField label="Inner ratio" value={d.innerRatio} min={0.2} max={0.95} step={0.05} onChange={innerRatio => up({ innerRatio, x: c[0], y: c[1] })} /></>}
        <NumField label="Node spacing" unit="u" value={d.resolution} min={8} max={120} step={2} onChange={resolution => up({ resolution, x: c[0], y: c[1] })} />
        <ColorField label="Color" value={d.color} onChange={color => { up({ color }); s.color = color; }} />
      </Section>
      <Section title="Material (live)">
        <SliderField label="Stiffness" value={d.stiffness} min={0} max={1} onChange={stiffness => up({ stiffness })} />
        <SliderField label="Shape retention (elasticity)" value={d.shapeRetention} min={0} max={1} onChange={shapeRetention => up({ shapeRetention })} />
        <SliderField label="Damping" value={d.damping} min={0} max={1} onChange={damping => up({ damping })} />
        <SliderField label="Internal pressure (area ×)" value={d.pressure} min={0.2} max={3} onChange={pressure => up({ pressure })} />
        <NumField label="Density" unit="×water" value={d.density} min={0.01} max={50} step={0.1} onChange={density => up({ density })} />
        <NumField label="Mass" value={s.mass} disabled onChange={() => {}} />
        <NumField label="Friction" value={d.friction} min={0} max={2} step={0.05} onChange={friction => up({ friction })} />
        <NumField label="Restitution" value={d.restitution} min={0} max={1} step={0.05} onChange={restitution => up({ restitution })} />
      </Section>
    </>
  );
}

// ---------------- Constraint ----------------
function ConstraintPanel({ sb, id }: { sb: Sandbox; id: string }) {
  const e = sb.world.constraints.get(id)!;
  const d = e.def;
  const up = (p: Partial<ConstraintDef>) => sb.world.updateConstraint(id, p);
  const bodyOptions = [{ value: '__world', label: 'World' }, ...[...sb.world.rigid.values()].map(r => ({ value: r.def.id, label: `${r.def.shape} ${r.def.id.slice(-6)}` }))];
  const soft = d.softA ? sb.world.soft.get(d.softA) : null;
  return (
    <>
      <Header title={`Constraint: ${d.kind}`} sub={id} sb={sb} />
      <Section title="Type">
        <SelectField label="Kind" value={d.kind} full options={[{ value: 'link', label: 'Rigid link' }, { value: 'spring', label: 'Spring' }, { value: 'pin', label: 'Pin (to world)' }]} onChange={kind => up({ kind, stiffness: kind === 'spring' ? Math.min(d.stiffness, 0.2) : 1 })} />
      </Section>
      {soft ? (
        <Section title="Soft attachment">
          <NumField label="Node index" value={d.nodeA} min={0} max={soft.n - 1} digits={0} onChange={n => up({ nodeA: Math.round(n) })} />
          <div className="text-[10.5px] text-zinc-500 self-end pb-1 truncate">{d.softA}</div>
          <NumField label="Anchor X" value={d.pointA.x} onChange={x => up({ pointA: { x, y: d.pointA.y } })} />
          <NumField label="Anchor Y" value={d.pointA.y} onChange={y => up({ pointA: { x: d.pointA.x, y } })} />
        </Section>
      ) : (
        <>
          <Section title="Endpoint A">
            <SelectField label="Body A" full value={d.bodyA ?? '__world'} options={bodyOptions} onChange={v => {
              const bodyA = v === '__world' ? null : v;
              if (bodyA && bodyA === d.bodyB) return;
              const ep = sb.editor.constraintEndpoints(id);
              const nb = bodyA ? sb.world.rigid.get(bodyA)!.body : null;
              const pointA = ep ? (nb ? { x: ep.a.x - nb.position.x, y: ep.a.y - nb.position.y } : ep.a) : { x: 0, y: 0 };
              up({ bodyA, pointA });
            }} />
            <NumField label={d.bodyA ? 'Local X' : 'World X'} value={d.pointA.x} onChange={x => up({ pointA: { x, y: d.pointA.y } })} />
            <NumField label={d.bodyA ? 'Local Y' : 'World Y'} value={d.pointA.y} onChange={y => up({ pointA: { x: d.pointA.x, y } })} />
          </Section>
          <Section title="Endpoint B">
            <SelectField label="Body B" full value={d.bodyB ?? '__world'} options={bodyOptions} onChange={v => {
              const bodyB = v === '__world' ? null : v;
              if (bodyB && bodyB === d.bodyA) return;
              const ep = sb.editor.constraintEndpoints(id);
              const nb = bodyB ? sb.world.rigid.get(bodyB)!.body : null;
              const pointB = ep ? (nb ? { x: ep.b.x - nb.position.x, y: ep.b.y - nb.position.y } : ep.b) : { x: 0, y: 0 };
              up({ bodyB, pointB });
            }} />
            <NumField label={d.bodyB ? 'Local X' : 'World X'} value={d.pointB.x} onChange={x => up({ pointB: { x, y: d.pointB.y } })} />
            <NumField label={d.bodyB ? 'Local Y' : 'World Y'} value={d.pointB.y} onChange={y => up({ pointB: { x: d.pointB.x, y } })} />
          </Section>
        </>
      )}
      <Section title="Response">
        {d.kind !== 'pin' && !soft && <NumField label="Rest length" value={d.length} min={0} max={5000} onChange={length => up({ length })} />}
        <NumField label="Stiffness" value={d.stiffness} min={0.0001} max={1} step={0.01} digits={3} onChange={stiffness => up({ stiffness })} />
        <NumField label="Damping" value={d.damping} min={0} max={1} step={0.01} onChange={damping => up({ damping })} />
        {!soft && d.kind !== 'pin' && <Btn small onClick={() => { const ep = sb.editor.constraintEndpoints(id); if (ep) up({ length: Math.hypot(ep.b.x - ep.a.x, ep.b.y - ep.a.y) }); }}>Set length = current</Btn>}
      </Section>
    </>
  );
}

// ---------------- Fluid region ----------------
function RegionPanel({ sb, id }: { sb: Sandbox; id: string }) {
  const r = sb.world.regions.get(id)!;
  const up = (p: Partial<FluidRegionDef>) => sb.world.updateRegion(id, p);
  return (
    <>
      <Header title={r.type === 'emitter' ? 'Fluid emitter' : 'Fluid fill region'} sub={id} sb={sb} />
      <Section title="Region">
        <SelectField label="Type" full value={r.type} options={[{ value: 'fill', label: 'Fill once (on create/reset)' }, { value: 'emitter', label: 'Emitter (continuous)' }]} onChange={type => up({ type })} />
        <NumField label="X" value={r.x} onChange={x => up({ x })} /><NumField label="Y" value={r.y} onChange={y => up({ y })} />
        <NumField label="Width" value={r.w} min={4} onChange={w => up({ w })} /><NumField label="Height" value={r.h} min={4} onChange={h => up({ h })} />
        {r.type === 'emitter' && <>
          <NumField label="Rate" unit="p/s" value={r.rate} min={0} max={5000} step={10} onChange={rate => up({ rate })} />
          <div />
          <NumField label="Velocity X" value={r.vx} step={10} onChange={vx => up({ vx })} /><NumField label="Velocity Y" value={r.vy} step={10} onChange={vy => up({ vy })} />
        </>}
        {r.type === 'fill' && <Btn small onClick={() => { sb.world.fluid.fillRect(r.x, r.y, r.w, r.h); sb.world.markChanged(); }}>Fill again now</Btn>}
      </Section>
      <FluidSettingsPanel sb={sb} />
    </>
  );
}

// ---------------- Multi ----------------
function MultiPanel({ sb, selection }: { sb: Sandbox; selection: string[] }) {
  const w = sb.world, ed = sb.editor;
  const rigids = selection.map(id => w.rigid.get(id)).filter(Boolean) as { def: RigidBodyDef }[];
  const softs = selection.map(id => w.soft.get(id)).filter(Boolean) as { def: SoftBodyDef }[];
  const cons = selection.filter(id => w.constraints.has(id));
  const regs = selection.filter(id => w.regions.has(id));
  const upR = (p: Partial<RigidBodyDef>) => rigids.forEach(r => w.updateRigid(r.def.id, p));
  const upS = (p: Partial<SoftBodyDef>) => softs.forEach(s => w.updateSoft(s.def.id, p));
  const upC = (p: Partial<ConstraintDef>) => cons.forEach(id => w.updateConstraint(id, p));
  const movable = rigids.length + softs.length + regs.length;
  return (
    <>
      <Header title={`${selection.length} objects`} sub={[rigids.length && `${rigids.length} rigid`, softs.length && `${softs.length} soft`, cons.length && `${cons.length} constraints`, regs.length && `${regs.length} regions`].filter(Boolean).join(' · ')} sb={sb} />
      {movable >= 2 && (
        <Section title="Align">
          <div className="col-span-2 grid grid-cols-6 gap-1">
            {(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'] as const).map(m => <Btn key={m} small title={`Align ${m}`} onClick={() => ed.align(m)}>{{ left: '⇤', hcenter: '⇹', right: '⇥', top: '⤒', vcenter: '⇳', bottom: '⤓' }[m]}</Btn>)}
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-1">
            <Btn small disabled={movable < 3} onClick={() => ed.distribute('x')}>Distribute H</Btn>
            <Btn small disabled={movable < 3} onClick={() => ed.distribute('y')}>Distribute V</Btn>
          </div>
        </Section>
      )}
      {rigids.length > 0 && (
        <Section title={`Rigid bodies (${rigids.length})`}>
          <NumField label="Density" value={mixed(rigids.map(r => r.def.density))} min={0.01} max={100} step={0.1} onChange={density => upR({ density })} />
          <NumField label="Friction" value={mixed(rigids.map(r => r.def.friction))} min={0} max={5} step={0.05} onChange={friction => upR({ friction })} />
          <NumField label="Restitution" value={mixed(rigids.map(r => r.def.restitution))} min={0} max={1} step={0.05} onChange={restitution => upR({ restitution })} />
          <NumField label="Air friction" value={mixed(rigids.map(r => r.def.frictionAir))} min={0} max={1} step={0.005} digits={3} onChange={frictionAir => upR({ frictionAir })} />
          <Toggle label="Static" value={mixed(rigids.map(r => r.def.isStatic))} onChange={isStatic => upR({ isStatic })} />
          <Toggle label="Sensor" value={mixed(rigids.map(r => r.def.isSensor))} onChange={isSensor => upR({ isSensor })} />
          <NumField label="Rotation" unit="°" value={mixed(rigids.map(r => Math.round(deg(w.rigid.get(r.def.id)!.body.angle))))} step={5} onChange={a => upR({ angle: rad(a) })} />
          <ColorField label="Color" value={mixed(rigids.map(r => r.def.color))} onChange={color => upR({ color })} />
        </Section>
      )}
      {softs.length > 0 && (
        <Section title={`Soft bodies (${softs.length})`}>
          <SliderField label="Stiffness" value={mixed(softs.map(s => s.def.stiffness))} min={0} max={1} onChange={stiffness => upS({ stiffness })} />
          <SliderField label="Shape retention" value={mixed(softs.map(s => s.def.shapeRetention))} min={0} max={1} onChange={shapeRetention => upS({ shapeRetention })} />
          <SliderField label="Damping" value={mixed(softs.map(s => s.def.damping))} min={0} max={1} onChange={damping => upS({ damping })} />
          <SliderField label="Pressure" value={mixed(softs.map(s => s.def.pressure))} min={0.2} max={3} onChange={pressure => upS({ pressure })} />
          <NumField label="Density" value={mixed(softs.map(s => s.def.density))} min={0.01} max={50} step={0.1} onChange={density => upS({ density })} />
          <NumField label="Friction" value={mixed(softs.map(s => s.def.friction))} min={0} max={2} step={0.05} onChange={friction => upS({ friction })} />
        </Section>
      )}
      {cons.length > 0 && (
        <Section title={`Constraints (${cons.length})`}>
          <NumField label="Stiffness" value={mixed(cons.map(id => w.constraints.get(id)!.def.stiffness))} min={0.0001} max={1} step={0.01} digits={3} onChange={stiffness => upC({ stiffness })} />
          <NumField label="Damping" value={mixed(cons.map(id => w.constraints.get(id)!.def.damping))} min={0} max={1} step={0.01} onChange={damping => upC({ damping })} />
        </Section>
      )}
    </>
  );
}

// ---------------- Tool defaults ----------------
function ToolPanel({ sb, tool }: { sb: Sandbox; tool: Tool }) {
  const w = sb.world, ed = sb.editor, td = w.ui.toolDefaults;
  const up = (p: Partial<ToolDefaults>) => w.updateUi({ toolDefaults: { ...td, ...p } });
  const drawing = ed.polygonPoints.length > 0;
  const polyControls = (
    <div className="col-span-2 flex gap-1 flex-wrap">
      <Btn small onClick={() => ed.finishPolygon()} disabled={ed.polygonPoints.length < 3}>Finish ({ed.polygonPoints.length})</Btn>
      <Btn small onClick={() => ed.undoPolygonPoint()} disabled={!drawing}>Undo point</Btn>
      <Btn small onClick={() => ed.cancelPolygon()} disabled={!drawing}>Cancel</Btn>
    </div>
  );
  const titles: Record<Tool, string> = { select: 'Select', rect: 'Rigid rectangle', circle: 'Rigid circle', polygon: 'Rigid polygon', soft: 'Soft body', fluid: 'Fluid', constraint: 'Constraint' };
  return (
    <>
      <div className="text-sm font-semibold text-zinc-100 mb-2">Tool: {titles[tool]}</div>
      {(tool === 'rect' || tool === 'circle' || tool === 'polygon') && (
        <Section title="New rigid body">
          <Toggle label="Static geometry" value={td.rigidStatic} onChange={rigidStatic => up({ rigidStatic })} full />
          <NumField label="Density" value={td.rigidDensity} min={0.01} max={100} step={0.1} onChange={rigidDensity => up({ rigidDensity })} />
          <NumField label="Friction" value={td.rigidFriction} min={0} max={5} step={0.05} onChange={rigidFriction => up({ rigidFriction })} />
          <NumField label="Restitution" value={td.rigidRestitution} min={0} max={1} step={0.05} onChange={rigidRestitution => up({ rigidRestitution })} />
          {tool === 'polygon' && <>
            <SelectField label="Mode" value={ed.polygonCustom ? 'custom' : 'regular'} options={[{ value: 'regular', label: 'Regular (drag)' }, { value: 'custom', label: 'Custom (click vertices)' }]} onChange={v => { ed.polygonCustom = v === 'custom'; ed.cancelPolygon(); }} />
            {!ed.polygonCustom && <NumField label="Sides" value={td.rigidSides} min={3} max={12} digits={0} onChange={s => up({ rigidSides: Math.round(s) })} />}
            {ed.polygonCustom && polyControls}
          </>}
          <p className="col-span-2 text-[10.5px] text-zinc-500">{tool === 'polygon' && ed.polygonCustom ? 'Click to place vertices; click the first vertex, double-click or press Enter to finish. Esc cancels.' : 'Drag on the canvas to define the shape.'}</p>
        </Section>
      )}
      {tool === 'soft' && (
        <Section title="New soft body">
          <SelectField label="Shape" full value={td.softShape} options={[{ value: 'blob', label: 'Blob (drag radius)' }, { value: 'rect', label: 'Rectangle (drag box)' }, { value: 'star', label: 'Star (drag radius)' }, { value: 'polygon', label: 'Custom polygon (click)' }]} onChange={softShape => { up({ softShape }); ed.cancelPolygon(); }} />
          <NumField label="Node spacing" value={td.softResolution} min={8} max={120} step={2} onChange={softResolution => up({ softResolution })} />
          <NumField label="Density" value={td.softDensity} min={0.01} max={50} step={0.1} onChange={softDensity => up({ softDensity })} />
          <SliderField label="Stiffness" value={td.softStiffness} min={0} max={1} onChange={softStiffness => up({ softStiffness })} />
          <SliderField label="Pressure" value={td.softPressure} min={0.2} max={3} onChange={softPressure => up({ softPressure })} />
          {td.softShape === 'polygon' && polyControls}
        </Section>
      )}
      {tool === 'fluid' && (
        <>
          <Section title="New fluid region">
            <SelectField label="Mode" full value={td.fluidMode} options={[{ value: 'fill', label: 'Fill region with fluid' }, { value: 'emitter', label: 'Emitter (continuous source)' }]} onChange={fluidMode => up({ fluidMode })} />
            {td.fluidMode === 'emitter' && <NumField label="Emit rate" unit="p/s" value={td.emitterRate} min={0} max={5000} step={10} onChange={emitterRate => up({ emitterRate })} />}
            <p className="col-span-2 text-[10.5px] text-zinc-500">Drag a rectangle on the canvas. Particles: {w.fluid.numParticles} / {w.fluid.maxParticles}</p>
          </Section>
          <FluidSettingsPanel sb={sb} />
        </>
      )}
      {tool === 'constraint' && (
        <Section title="New constraint">
          <SelectField label="Kind" full value={td.constraintKind} options={[{ value: 'spring', label: 'Spring (drag A → B / world)' }, { value: 'link', label: 'Rigid link (drag A → B / world)' }, { value: 'pin', label: 'Pin to world (click body)' }]} onChange={constraintKind => up({ constraintKind })} />
          {td.constraintKind === 'spring' && <SliderField label="Spring stiffness" value={td.springStiffness} min={0.001} max={0.5} step={0.001} digits={3} onChange={springStiffness => up({ springStiffness })} />}
          <p className="col-span-2 text-[10.5px] text-zinc-500">Press on a rigid/soft body and drag to another body, or release on empty space to anchor to the world.</p>
        </Section>
      )}
    </>
  );
}

function SelectHints({ sb }: { sb: Sandbox }) {
  const ed = sb.editor;
  return (
    <Section title="Selection">
      <Toggle full label="Touch multi-select mode (tap toggles)" value={ed.multiSelectMode} onChange={v => { ed.multiSelectMode = v; ed.onChange?.(); }} />
      <div className="col-span-2 flex gap-1 flex-wrap"><Btn small onClick={() => ed.selectAll()}>Select all</Btn></div>
      <p className="col-span-2 text-[10.5px] text-zinc-500">Click/tap to select, Shift/Ctrl-click or multi-select mode to add. Drag empty space for a marquee. Drag objects to move; flick to throw.</p>
    </Section>
  );
}

// ---------------- World ----------------
export function FluidSettingsPanel({ sb }: { sb: Sandbox }) {
  const w = sb.world, f = w.fluidSettings;
  const up = (p: Partial<typeof f>) => w.updateFluidSettings(p);
  return (
    <Section title="FLIP fluid solver" right={<span className="text-[10px] text-zinc-500 tabular-nums">{w.fluid.numParticles} particles</span>}>
      <SliderField label="FLIP ratio (0 = PIC, 1 = FLIP)" value={f.flipRatio} min={0} max={1} onChange={flipRatio => up({ flipRatio })} />
      <NumField label="Cell size" unit="u" value={f.cellSize} min={10} max={120} step={5} digits={0} title="Rebuilds the grid" onChange={cellSize => up({ cellSize })} />
      <NumField label="Particle radius" unit="×cell" value={f.particleRadiusFactor} min={0.15} max={0.5} step={0.05} onChange={particleRadiusFactor => up({ particleRadiusFactor })} />
      <NumField label="Pressure iters" value={f.pressureIters} min={1} max={200} digits={0} onChange={v => up({ pressureIters: Math.round(v) })} />
      <NumField label="Fluid substeps" value={w.settings.fluidSubsteps} min={1} max={4} digits={0} onChange={v => w.updateWorldSettings({ fluidSubsteps: Math.round(v) })} />
      <NumField label="Separation iters" value={f.separationIters} min={0} max={8} digits={0} onChange={v => up({ separationIters: Math.round(v) })} />
      <NumField label="Separation strength" value={f.separationStrength} min={0} max={2} step={0.1} onChange={separationStrength => up({ separationStrength })} />
      <NumField label="Over-relaxation" value={f.overRelaxation} min={1} max={1.99} step={0.05} onChange={overRelaxation => up({ overRelaxation })} />
      <NumField label="Density" unit="×water" value={f.density} min={0.05} max={20} step={0.1} onChange={density => up({ density })} />
      <Toggle label="Density drift correction" value={f.driftCompensation} onChange={driftCompensation => up({ driftCompensation })} />
      <NumField label="Drift stiffness" value={f.driftStiffness} min={0} max={5} step={0.1} onChange={driftStiffness => up({ driftStiffness })} />
      <NumField label="Gravity scale" value={f.gravityScale} min={-3} max={3} step={0.1} onChange={gravityScale => up({ gravityScale })} />
      <NumField label="Coupling scale" value={f.couplingScale} min={0} max={5} step={0.1} title="Scales fluid ↔ body forces" onChange={couplingScale => up({ couplingScale })} />
      <NumField label="Max particles" value={f.maxParticles} min={100} max={60000} step={500} digits={0} title="Rebuilds buffers" onChange={v => up({ maxParticles: Math.round(v) })} />
      <div className="col-span-2 flex gap-1"><Btn small danger onClick={() => { w.fluid.clearParticles(); w.authoredFluidState = null; w.markChanged(); }}>Remove all fluid</Btn></div>
    </Section>
  );
}

function WorldPanel({ sb }: { sb: Sandbox }) {
  const w = sb.world, s = w.settings, ui = w.ui, m = sb.motion;
  const upW = (p: Partial<typeof s>) => w.updateWorldSettings(p);
  const upUi = (p: Partial<typeof ui>) => w.updateUi(p);
  const upDbg = (p: Partial<DebugFlags>) => upUi({ debug: { ...ui.debug, ...p } });
  const upDg = (p: Partial<typeof ui.deviceGravity>) => { upUi({ deviceGravity: { ...ui.deviceGravity, ...p } }); m.options = { ...w.ui.deviceGravity }; };
  const g = w.gravity;
  return (
    <>
      <div className="text-sm font-semibold text-zinc-100 mb-2">World settings</div>
      <Section title="Gravity">
        <NumField label="Gravity X" unit="u/s²" value={s.gravity.x} step={50} disabled={!!w.gravityOverride} onChange={x => upW({ gravity: { x, y: s.gravity.y } })} />
        <NumField label="Gravity Y" unit="u/s²" value={s.gravity.y} step={50} disabled={!!w.gravityOverride} onChange={y => upW({ gravity: { x: s.gravity.x, y } })} />
        <div className="col-span-2 flex gap-1 flex-wrap">
          <Btn small onClick={() => upW({ gravity: { x: 0, y: 981 } })}>Earth ↓</Btn>
          <Btn small onClick={() => upW({ gravity: { x: 0, y: 162 } })}>Moon</Btn>
          <Btn small onClick={() => upW({ gravity: { x: 0, y: 0 } })}>Zero-g</Btn>
          <Btn small onClick={() => upW({ gravity: { x: 0, y: -981 } })}>Flip ↑</Btn>
        </div>
      </Section>
      <Section title="Device motion gravity" right={<span className={`text-[10px] ${m.status === 'active' ? 'text-emerald-400' : 'text-zinc-500'}`}>{m.status}</span>}>
        <div className="col-span-2 flex gap-1 flex-wrap">
          <Btn small active={m.enabled} onClick={() => sb.toggleMotion()}>{m.enabled ? 'Disable sensors' : 'Enable device gravity'}</Btn>
          <Btn small disabled={!m.enabled} onClick={() => m.calibrate()}>Recenter</Btn>
        </div>
        {w.gravityOverride && <div className="col-span-2 text-[10.5px] text-zinc-400 tabular-nums">Live: {g.x.toFixed(0)}, {g.y.toFixed(0)}</div>}
        <SliderField label="Sensitivity" value={ui.deviceGravity.sensitivity} min={0.1} max={3} step={0.05} onChange={sensitivity => upDg({ sensitivity })} />
        <SliderField label="Smoothing" value={ui.deviceGravity.smoothing} min={0} max={0.95} step={0.01} onChange={smoothing => upDg({ smoothing })} />
        <Toggle label="Invert X" value={ui.deviceGravity.invertX} onChange={invertX => upDg({ invertX })} />
        <Toggle label="Invert Y" value={ui.deviceGravity.invertY} onChange={invertY => upDg({ invertY })} />
      </Section>
      <Section title="Time & solvers">
        <SliderField label="Time scale" value={s.timeScale} min={0.1} max={2} step={0.05} onChange={timeScale => upW({ timeScale })} />
        <NumField label="Rigid substeps" value={s.rigidSubsteps} min={1} max={8} digits={0} onChange={v => upW({ rigidSubsteps: Math.round(v) })} />
        <NumField label="Soft substeps" value={s.softSubsteps} min={1} max={12} digits={0} onChange={v => upW({ softSubsteps: Math.round(v) })} />
        <NumField label="World width" value={s.width} min={400} max={6000} step={100} digits={0} title="Rebuilds boundaries and fluid grid" onChange={v => upW({ width: Math.round(v) })} />
        <NumField label="World height" value={s.height} min={300} max={6000} step={100} digits={0} onChange={v => upW({ height: Math.round(v) })} />
      </Section>
      <FluidSettingsPanel sb={sb} />
      <Section title="Editor aids">
        <Toggle label="Show grid" value={ui.grid} onChange={grid => upUi({ grid })} />
        <Toggle label="Snap to grid" value={ui.snap} onChange={snap => upUi({ snap })} />
        <NumField label="Grid size" value={ui.gridSize} min={5} max={500} step={5} digits={0} onChange={gridSize => upUi({ gridSize })} />
      </Section>
      <Section title="Debug rendering">
        <Toggle label="Rigid outlines/bounds" value={ui.debug.rigidOutlines} onChange={rigidOutlines => upDbg({ rigidOutlines })} />
        <Toggle label="Soft nodes" value={ui.debug.softNodes} onChange={softNodes => upDbg({ softNodes })} />
        <Toggle label="Soft springs" value={ui.debug.softSprings} onChange={softSprings => upDbg({ softSprings })} />
        <Toggle label="Fluid particles" value={ui.debug.fluidParticles} onChange={fluidParticles => upDbg({ fluidParticles })} />
        <Toggle label="Fluid grid" value={ui.debug.fluidGrid} onChange={fluidGrid => upDbg({ fluidGrid })} />
        <Toggle label="Cell classification" value={ui.debug.fluidCells} onChange={fluidCells => upDbg({ fluidCells })} />
        <Toggle label="Velocity vectors" value={ui.debug.velocity} onChange={velocity => upDbg({ velocity })} />
        <Toggle label="Fluid regions" value={ui.debug.fluidRegions} onChange={fluidRegions => upDbg({ fluidRegions })} />
      </Section>
      <Section title="Scene data">
        <div className="col-span-2 grid grid-cols-2 gap-1">
          <Btn small onClick={() => sb.save()}>Save</Btn>
          <Btn small onClick={() => sb.load()}>Load</Btn>
          <Btn small onClick={() => sb.exportJson()}>Export JSON</Btn>
          <Btn small onClick={() => sb.importJson()}>Import JSON</Btn>
          <Btn small title="Store current positions, velocities and fluid particles as the authored reset state" onClick={() => { w.commitRuntime(); sb.onMessage?.('Current state captured as authored scene', 'info'); }}>Capture state</Btn>
          <Btn small onClick={() => sb.restoreDefaults()}>Restore defaults</Btn>
          <Btn small danger className="col-span-2" onClick={() => sb.clearSavedData()}>Clear saved browser data</Btn>
        </div>
        <p className="col-span-2 text-[10.5px] text-zinc-500">Changes are auto-saved to this browser. Reset restores the authored scene; Clear removes all objects.</p>
      </Section>
    </>
  );
}

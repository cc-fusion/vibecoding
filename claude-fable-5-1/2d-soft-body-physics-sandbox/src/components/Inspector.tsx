import { useEffect, useState } from 'react';
import { Anchor, Copy, Move, Snowflake, Trash2 } from 'lucide-react';
import { useSandbox } from '../sim/useSandbox';
import type { RigidObject, SoftObject } from '../sim/types';
import { NumberField, Readout, Section, Segmented, Slider, Toggle } from './controls';
import { cn } from '../utils/cn';

export function Inspector() {
  const sb = useSandbox();
  const sel = sb.selected;
  const [tab, setTab] = useState<'object' | 'world'>('world');
  useEffect(() => {
    setTab(sel ? 'object' : 'world');
  }, [sb.selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showObject = tab === 'object' && sel;

  return (
    <aside className="flex h-full w-full flex-col bg-[#0f141b] text-slate-200">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 px-2 py-2">
        <TabButton active={!!showObject} disabled={!sel} onClick={() => setTab('object')}>
          {sel ? (sel.kind === 'soft' ? 'Soft Body' : sel.body.isStatic ? 'Static Body' : 'Rigid Body') : 'Object'}
          {sel && <span className="ml-1 font-mono text-[10px] text-slate-500">#{sel.id}</span>}
        </TabButton>
        <TabButton active={tab === 'world' || !sel} onClick={() => setTab('world')}>
          World
        </TabButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showObject ? sel.kind === 'soft' ? <SoftInspector o={sel} /> : <RigidInspector o={sel} /> : <WorldInspector />}
      </div>
    </aside>
  );
}

function TabButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40',
        active ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function ObjectActions({ id }: { id: number }) {
  const sb = useSandbox();
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <ActionButton icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" onClick={() => { sb.duplicate(id); sb.refreshStats(); }} />
      <ActionButton icon={<Snowflake className="h-3.5 w-3.5" />} label="Freeze" tip="Zero all velocity" onClick={() => sb.freezeSelected()} />
      <ActionButton icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" danger onClick={() => { sb.remove(id); sb.refreshStats(); }} />
    </div>
  );
}

function ActionButton({ icon, label, onClick, danger, tip }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; tip?: string }) {
  return (
    <button
      type="button"
      title={tip ?? label}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[11px] font-medium transition-colors',
        danger
          ? 'border-red-500/30 text-red-300 hover:bg-red-500/15'
          : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function SoftInspector({ o }: { o: SoftObject }) {
  const sb = useSandbox();
  const s = o.soft;
  const p = s.params;
  const set = (k: keyof typeof p) => (v: number) => sb.setSoftParams(o.id, { [k]: v });
  const v = s.averageVelocity();
  const areaRatio = s.restArea > 0 ? (Math.abs(s.area) / s.restArea) * 100 : 100;

  return (
    <>
      <Section title="Actions">
        <ObjectActions id={o.id} />
      </Section>
      <Section title="Material">
        <Slider label="Stiffness" value={p.stiffness} min={0} max={1} onChange={set('stiffness')} tip="Spring stiffness of the outline mesh. Higher = firmer, less wobble." />
        <Slider label="Damping" value={p.damping} min={0} max={1} onChange={set('damping')} tip="How quickly oscillations die out." />
        <Slider label="Pressure" value={p.pressure} min={0} max={1} onChange={set('pressure')} tip="Internal gas pressure that preserves the body's area — resists being flattened." />
        <Slider label="Elasticity" value={p.elasticity} min={0} max={1} onChange={set('elasticity')} tip="Shape memory: how strongly the body recovers its original outline." />
      </Section>
      <Section title="Physical">
        <Slider label="Mass" value={p.mass} min={0.2} max={5} step={0.05} unit="×" onChange={set('mass')} tip="Density multiplier applied to every node." />
        <Slider label="Friction" value={p.friction} min={0} max={1} onChange={set('friction')} tip="Surface friction against other bodies." />
        <Slider label="Bounce" value={p.restitution} min={0} max={1} onChange={set('restitution')} tip="Restitution of the surface nodes." />
        <Slider
          label="Resolution"
          value={p.resolution}
          min={8}
          max={64}
          step={1}
          unit="nodes"
          onChange={() => undefined}
          onCommit={(val) => sb.setSoftParams(o.id, { resolution: val })}
          tip="Number of outline nodes. Re-meshes the body on release — higher is smoother but heavier."
        />
      </Section>
      <Section title="Readout">
        <Readout label="Nodes / Springs" value={`${s.particles.length} / ${s.constraints.length}`} />
        <Readout label="Volume" value={`${areaRatio.toFixed(0)}%`} />
        <Readout label="Center" value={`${s.center.x.toFixed(0)}, ${s.center.y.toFixed(0)}`} />
        <Readout label="Velocity" value={`${(Math.hypot(v.x, v.y) * 60).toFixed(0)} px/s`} />
        <Readout label="Orientation" value={`${((s.angle * 180) / Math.PI).toFixed(1)}°`} />
        <Readout label="Total mass" value={s.totalMass().toFixed(2)} />
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function RigidInspector({ o }: { o: RigidObject }) {
  const sb = useSandbox();
  const b = o.body;
  const isStatic = b.isStatic;
  const set = (k: 'mass' | 'friction' | 'restitution' | 'x' | 'y' | 'angle') => (v: number) => sb.setRigidProps(o.id, { [k]: v });
  const shapeLabel = o.def.shape === 'rect' ? `Rectangle ${Math.round(o.def.w)}×${Math.round(o.def.h)}` : o.def.shape === 'circle' ? `Circle r=${Math.round(o.def.r)}` : `Polygon (${o.def.verts.length} verts)`;
  const angleDeg = (((b.angle * 180) / Math.PI + 180) % 360 + 360) % 360 - 180;

  return (
    <>
      <Section title="Actions">
        <ObjectActions id={o.id} />
      </Section>
      <Section title="Body" right={<span className="font-mono text-[10px] text-slate-500">{shapeLabel}</span>}>
        <div>
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-slate-400">Body type</span>
          <Segmented
            className="w-full [&>button]:flex-1"
            value={isStatic ? 'static' : 'dynamic'}
            onChange={(v) => sb.setRigidProps(o.id, { mode: v })}
            options={[
              { value: 'dynamic', label: <span className="flex items-center justify-center gap-1"><Move className="h-3 w-3" />Dynamic</span>, tip: 'Affected by gravity, forces and collisions' },
              { value: 'static', label: <span className="flex items-center justify-center gap-1"><Anchor className="h-3 w-3" />Static</span>, tip: 'Fixed in place; other bodies collide with it' },
            ]}
          />
        </div>
        <Slider label="Mass" value={isStatic ? 0 : b.mass} min={0.1} max={40} step={0.1} disabled={isStatic} onChange={set('mass')} tip="Body mass (inertia scales with it)." />
        <Slider label="Friction" value={b.friction} min={0} max={1} onChange={set('friction')} tip="Coulomb friction coefficient." />
        <Slider label="Restitution" value={b.restitution} min={0} max={1} onChange={set('restitution')} tip="Bounciness of collisions." />
      </Section>
      <Section title="Transform">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Position X" value={b.position.x} onChange={set('x')} unit="px" />
          <NumberField label="Position Y" value={b.position.y} onChange={set('y')} unit="px" />
        </div>
        <Slider
          label="Rotation"
          value={angleDeg}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(deg) => set('angle')((deg * Math.PI) / 180)}
          tip="Rotate the body (Q / E keys rotate the selection by 5°)."
        />
      </Section>
      <Section title="Readout">
        <Readout label="Velocity" value={isStatic ? '—' : `${(b.velocity.x * 60).toFixed(0)}, ${(b.velocity.y * 60).toFixed(0)} px/s`} />
        <Readout label="Speed" value={isStatic ? '—' : `${(b.speed * 60).toFixed(0)} px/s`} />
        <Readout label="Angular vel." value={isStatic ? '—' : `${((b.angularVelocity * 60 * 180) / Math.PI).toFixed(0)} °/s`} />
        <Readout label="Area" value={`${Math.round(b.area)} px²`} />
        <Readout label="Inertia" value={isStatic ? '∞' : b.inertia.toFixed(0)} />
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function WorldInspector() {
  const sb = useSandbox();
  const p = sb.params;
  const d = p.debug;
  const setDebug = (k: keyof typeof d) => (v: boolean) => sb.setWorldParams({ debug: { ...d, [k]: v } });
  const zeroG = p.gravityX === 0 && p.gravityY === 0;

  return (
    <>
      <Section
        title="Gravity"
        right={
          <button
            type="button"
            onClick={() => (zeroG ? sb.setWorldParams({ gravityX: 0, gravityY: 1 }) : sb.setWorldParams({ gravityX: 0, gravityY: 0 }))}
            className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', zeroG ? 'border-sky-500/50 bg-sky-500/15 text-sky-200' : 'border-slate-700 text-slate-400 hover:text-slate-200')}
          >
            Zero-G
          </button>
        }
      >
        <Slider label="Gravity X" value={p.gravityX} min={-2} max={2} step={0.05} unit="g" onChange={(v) => sb.setWorldParams({ gravityX: v })} tip="Horizontal gravity (positive = right)." />
        <Slider label="Gravity Y" value={p.gravityY} min={-2} max={2} step={0.05} unit="g" onChange={(v) => sb.setWorldParams({ gravityY: v })} tip="Vertical gravity (positive = down)." />
        <div className="grid grid-cols-4 gap-1">
          {[
            ['Earth', 0, 1],
            ['Moon', 0, 0.17],
            ['Up', 0, -1],
            ['Side', 1, 0],
          ].map(([label, gx, gy]) => (
            <button
              key={label as string}
              type="button"
              onClick={() => sb.setWorldParams({ gravityX: gx as number, gravityY: gy as number })}
              className="rounded border border-slate-700 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              {label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Simulation">
        <Slider label="Speed" value={p.speed} min={0.1} max={3} step={0.05} unit="×" onChange={(v) => sb.setWorldParams({ speed: v })} tip="Time scale. Values below 1 slow down time; above 1 run extra sub-steps." />
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton icon={<span className="font-mono text-[10px]">⏯</span>} label={p.paused ? 'Resume' : 'Pause'} onClick={() => sb.togglePause()} />
          <ActionButton icon={<span className="font-mono text-[10px]">▸|</span>} label="Step" onClick={() => { if (!p.paused) sb.setWorldParams({ paused: true }); sb.requestStep(); }} />
        </div>
      </Section>
      <Section title="Debug view">
        <Toggle label="Nodes" checked={d.nodes} onChange={setDebug('nodes')} tip="Show soft-body particle nodes" />
        <Toggle label="Springs / constraints" checked={d.springs} onChange={setDebug('springs')} tip="Show soft-body edge and bending springs" />
        <Toggle label="Collision shapes" checked={d.shapes} onChange={setDebug('shapes')} tip="Show collider outlines and AABBs" />
        <Toggle label="Velocity vectors" checked={d.velocities} onChange={setDebug('velocities')} tip="Draw velocity arrows" />
        <Toggle label="Grid" checked={p.grid} onChange={(v) => sb.setWorldParams({ grid: v })} />
      </Section>
      <Section title="Scene">
        <div className="grid grid-cols-3 gap-1.5">
          <ActionButton icon={<span className="text-[10px]">⟲</span>} label="Reset" onClick={() => sb.loadInitialScene()} />
          <ActionButton icon={<span className="text-[10px]">⚄</span>} label="Spawn" onClick={() => sb.spawnRandom()} />
          <ActionButton icon={<span className="text-[10px]">✕</span>} label="Clear" danger onClick={() => { sb.clear(); sb.refreshStats(); }} />
        </div>
      </Section>
      <Section title="Shortcuts">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {[
            ['V S R C P', 'Tools'],
            ['Space', 'Pause / resume'],
            ['.', 'Step one frame'],
            ['Del', 'Delete selection'],
            ['Ctrl+D', 'Duplicate'],
            ['Q / E', 'Rotate rigid body'],
            ['Enter / Esc', 'Close / cancel polygon'],
            ['G', 'Toggle mesh debug'],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <kbd className="rounded border border-slate-700 bg-slate-900 px-1 font-mono text-[10px] text-slate-300">{k}</kbd>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

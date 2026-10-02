import type { ReactNode } from 'react';
import type { Settings } from '../game/storage';

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-[var(--ink-dim)]">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-9 text-right tabular-nums">{Math.round(value * 100)}</span>
    </label>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-3 py-1 text-left text-sm">
      <span className="text-[var(--ink-dim)]">{label}</span>
      <span className={`flex h-6 w-11 items-center rounded-full border px-0.5 transition-colors ${value ? 'border-[var(--gold)] bg-[var(--terra)]' : 'border-white/20 bg-black/30'}`}>
        <span className={`h-5 w-5 rounded-full bg-[#fff3d6] shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  return (
    <div className="flex flex-col gap-2">
      <Toggle label="Mute all audio" value={settings.muted} onChange={v => set({ muted: v })} />
      <Slider label="Master" value={settings.master} onChange={v => set({ master: v })} />
      <Slider label="Music" value={settings.music} onChange={v => set({ music: v })} />
      <Slider label="Effects" value={settings.sfx} onChange={v => set({ sfx: v })} />
      <Toggle label="Screen shake" value={settings.shake} onChange={v => set({ shake: v })} />
      <Toggle label="Show tutorial on first campaign map" value={settings.tutorial} onChange={v => set({ tutorial: v })} />
    </div>
  );
}

export function Screen({ title, subtitle, onBack, children, wide }: { title: string; subtitle?: string; onBack?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="water-bg fade-in absolute inset-0 overflow-y-auto scroll-thin">
      <div className={`mx-auto flex min-h-full flex-col gap-4 px-4 py-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="flex items-center gap-3">
          {onBack && <button className="btn btn-alt btn-sm" onClick={onBack}>← Back</button>}
          <div>
            <h2 className="font-display text-2xl font-black text-[var(--gold)] sm:text-3xl">{title}</h2>
            {subtitle && <p className="text-sm text-[var(--ink-dim)]">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return <span className="tracking-widest">{Array.from({ length: max }, (_, i) => <span key={i} className={i < n ? 'text-[var(--gold)]' : 'text-white/20'}>★</span>)}</span>;
}

export function Bar({ v, color, goal }: { v: number; color: string; goal?: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40">
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color }} />
      {goal !== undefined && <div className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: `${Math.min(1, goal) * 100}%` }} />}
    </div>
  );
}

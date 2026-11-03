import type { Settings } from '../game/storage';

function Range({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="flex flex-col text-lg mb-2">
      <span>{label}: {fmt ? fmt(value) : value}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} className="mc-range" />
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="font-pixel">
      <div className="text-2xl mb-2">Options</div>
      <Range label="Render distance" value={settings.renderDistance} min={3} max={12} step={1} onChange={v => set('renderDistance', v)} fmt={v => `${v} chunks`} />
      <Range label="Field of view" value={settings.fov} min={55} max={110} step={1} onChange={v => set('fov', v)} />
      <Range label="Mouse sensitivity" value={settings.sensitivity} min={0.2} max={3} step={0.05} onChange={v => set('sensitivity', v)} fmt={v => `${Math.round(v * 100)}%`} />
      <Range label="Volume" value={settings.volume} min={0} max={1} step={0.05} onChange={v => set('volume', v)} fmt={v => `${Math.round(v * 100)}%`} />
      <div className="flex gap-3">
        <button className="mc-btn flex-1" onClick={() => set('music', !settings.music)}>Music: {settings.music ? 'On' : 'Off'}</button>
        <button className="mc-btn flex-1" onClick={() => set('bobbing', !settings.bobbing)}>View bob: {settings.bobbing ? 'On' : 'Off'}</button>
      </div>
    </div>
  );
}

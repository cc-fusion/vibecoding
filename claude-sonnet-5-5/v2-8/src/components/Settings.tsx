import { audio } from "../game/audio";
import type { Settings } from "../game/save";

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-sky-100">{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={() => audio.sfx("click")}
        className="flex-1 accent-amber-400"
      />
      <span className="w-10 text-right tabular-nums text-white/70">{Math.round(value * 100)}%</span>
    </label>
  );
}

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      className="flex items-center justify-between w-full text-sm py-1.5 text-left"
      onClick={() => { onChange(!on); audio.sfx("click"); }}
    >
      <span>
        <span className="text-sky-100">{label}</span>
        {hint && <span className="block text-[11px] text-white/45">{hint}</span>}
      </span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${on ? "bg-amber-500" : "bg-slate-600"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export default function SettingsPanel({ s, onChange }: { s: Settings; onChange: (p: Partial<Settings>) => void }) {
  return (
    <div className="space-y-3">
      <Toggle label="Mute all audio" on={s.muted} onChange={(v) => onChange({ muted: v })} hint="Shortcut: M on the title screen" />
      <Slider label="Master" value={s.master} onChange={(v) => onChange({ master: v })} />
      <Slider label="Music" value={s.music} onChange={(v) => onChange({ music: v })} />
      <Slider label="Effects" value={s.sfx} onChange={(v) => onChange({ sfx: v })} />
      <div className="border-t border-white/10 pt-2">
        <Toggle label="Screen shake" on={s.shake} onChange={(v) => onChange({ shake: v })} hint="Disable if you are sensitive to motion" />
        <Toggle label="Touch controls" on={s.touch} onChange={(v) => onChange({ touch: v })} hint="On-screen buttons (auto-enabled on touch devices)" />
      </div>
    </div>
  );
}

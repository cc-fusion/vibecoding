import { Fragment, useState } from 'react';
import { DIFFS, MODS, FACTIONS, FACTION_IDS, PACKAGES, SEGS, modPayMul } from '../game/data';
import type { DiffId, PkgKind, Settings, SegType } from '../game/data';
import { audio } from '../game/audio';
import { Btn, Title } from './common';

export function DifficultyPicker({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const toggle = (id: string) => onChange({ ...settings, mods: settings.mods.includes(id) ? settings.mods.filter((m) => m !== id) : [...settings.mods, id] });
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-indigo-300/70 mb-2 font-display">Difficulty</div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(DIFFS) as DiffId[]).map((d) => {
          const on = settings.difficulty === d;
          return (
            <button key={d} onClick={() => { audio.sfx('ui'); onChange({ ...settings, difficulty: d }); }}
              className="rounded-md p-2 text-left border transition" style={{ borderColor: on ? DIFFS[d].color : 'rgba(255,255,255,0.12)', background: on ? DIFFS[d].color + '22' : 'rgba(0,0,0,0.3)' }}>
              <div className="font-display font-bold text-sm" style={{ color: DIFFS[d].color }}>{DIFFS[d].name}</div>
              <div className="text-[11px] leading-tight text-indigo-100/70 mt-1">{DIFFS[d].desc}</div>
            </button>
          );
        })}
      </div>
      <div className="text-xs uppercase tracking-widest text-indigo-300/70 mt-4 mb-2 font-display flex justify-between">
        <span>Modifiers</span><span className="text-yellow-300">Pay ×{modPayMul(settings.mods).toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MODS.map((m) => {
          const on = settings.mods.includes(m.id);
          return (
            <button key={m.id} onClick={() => { audio.sfx('ui'); toggle(m.id); }}
              className="rounded-md p-2 text-left border transition flex gap-2 items-start" style={{ borderColor: on ? '#ffe04a' : 'rgba(255,255,255,0.12)', background: on ? 'rgba(255,224,74,0.12)' : 'rgba(0,0,0,0.3)' }}>
              <span className="mt-0.5">{on ? '☑' : '☐'}</span>
              <span><span className="font-bold text-sm">{m.name}</span> <span className="text-yellow-300 text-xs">+{Math.round(m.pay * 100)}%</span>
                <span className="block text-[11px] text-indigo-100/70 leading-tight">{m.desc}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Slider({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-indigo-200">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => on(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-10 text-right tabular-nums">{Math.round(v * 100)}</span>
    </label>
  );
}

export function SettingsPanel({ settings, onChange, onClose, showDifficulty = true }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; showDifficulty?: boolean }) {
  const seg = (label: string, opts: [string, string][], cur: string, set: (v: string) => void) => (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 text-indigo-200">{label}</span>
      <div className="flex gap-1 flex-1">
        {opts.map(([k, l]) => (
          <button key={k} onClick={() => { audio.sfx('ui'); set(k); }} className="px-3 py-1 rounded border text-xs font-display uppercase"
            style={{ borderColor: cur === k ? '#28e0ff' : 'rgba(255,255,255,0.15)', color: cur === k ? '#28e0ff' : '#aab', background: cur === k ? 'rgba(40,224,255,0.12)' : 'transparent' }}>{l}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <Title>Settings</Title>
      <div className="space-y-3">
        <Slider label="Master" v={settings.master} on={(v) => onChange({ ...settings, master: v })} />
        <Slider label="Music" v={settings.music} on={(v) => onChange({ ...settings, music: v })} />
        <Slider label="Effects" v={settings.sfx} on={(v) => onChange({ ...settings, sfx: v })} />
        <Slider label="Screen shake" v={settings.shake} on={(v) => onChange({ ...settings, shake: v })} />
        {seg('Mute', [['n', 'Sound on'], ['y', 'Muted']], settings.muted ? 'y' : 'n', (v) => onChange({ ...settings, muted: v === 'y' }))}
        {seg('Particles', [['high', 'High'], ['low', 'Low']], settings.particles, (v) => onChange({ ...settings, particles: v as Settings['particles'] }))}
        {seg('Touch pad', [['auto', 'Auto'], ['on', 'Always'], ['off', 'Off']], settings.touch, (v) => onChange({ ...settings, touch: v as Settings['touch'] }))}
      </div>
      {showDifficulty && <DifficultyPicker settings={settings} onChange={onChange} />}
      <div className="flex justify-end"><Btn onClick={onClose}>Close</Btn></div>
    </div>
  );
}

const KEYS: [string, string][] = [
  ['→ / D', 'Accelerate (build momentum)'], ['← / A', 'Brake'], ['Space / W / ↑', 'Jump (hold for height) · hold into walls to WALL-RUN'],
  ['S / ↓ / Ctrl', 'Slide (tap before landing to ROLL)'], ['Shift / L', 'Dash (mid-air OK, brief invulnerability)'], ['E / F', 'Hack nearby terminal'],
  ['Q', 'EMP burst'], ['R', 'Smoke bomb'], ['K', 'Skeleton Key (inside a hack)'], ['Esc / P', 'Pause'],
];

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ['Controls', 'How to play', 'Packages', 'Factions', 'Terrain'];
  return (
    <div className="space-y-4">
      <Title>Field Manual</Title>
      <div className="flex flex-wrap gap-1">
        {tabs.map((t, i) => <button key={t} onClick={() => { audio.sfx('ui'); setTab(i); }} className="px-3 py-1 rounded border text-xs font-display uppercase"
          style={{ borderColor: tab === i ? '#28e0ff' : 'rgba(255,255,255,0.15)', color: tab === i ? '#28e0ff' : '#aab', background: tab === i ? 'rgba(40,224,255,0.12)' : 'transparent' }}>{t}</button>)}
      </div>
      <div className="text-sm leading-relaxed text-indigo-100/90 space-y-2 min-h-[260px]">
        {tab === 0 && (<>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {KEYS.map(([k, d]) => (<Fragment key={k}><kbd className="font-display text-xs px-2 py-1 rounded bg-white/10 border border-white/20 text-cyan-300 self-start whitespace-nowrap">{k}</kbd><span>{d}</span></Fragment>))}
          </div>
          <p><b className="text-cyan-300">Mouse:</b> left-click = jump (hold), right-click = dash; click puzzle buttons while hacking.</p>
          <p><b className="text-cyan-300">Hacking:</b> arrows/WASD, Space = lock, 1–4 = symbols, Backspace = clear, Esc = abort.</p>
          <p><b className="text-cyan-300">Touch:</b> on-screen buttons appear automatically on touch devices. <b className="text-cyan-300">Gamepad:</b> A jump, B slide, X dash, Y hack, LB EMP, RB smoke, LT brake, RT/stick accelerate, Start pause.</p>
        </>)}
        {tab === 1 && (<>
          <p><b className="text-cyan-300">Run:</b> you auto-run right. Hold forward to build <b>Momentum</b>: more speed, longer jumps, bigger score multipliers. Crashing, braking and stumbling bleed it away.</p>
          <p><b className="text-pink-300">Package integrity</b> is your payout. Crashes, lasers, bolts, drops and your cargo's own quirks damage it. At 0% the job fails.</p>
          <p><b className="text-red-300">Heat:</b> alarms, scans and cops raise Heat (★). Heat summons the <b>Sentinel Pack</b> behind you, then drones, squads and roadblocks. If the pack catches you, you are busted. Heat cools when unseen.</p>
          <p><b className="text-yellow-300">Route planning:</b> before every job choose one terrain per leg. Each shows threat, reward and how well it suits your package.</p>
          <p><b className="text-green-300">Hacking:</b> terminals slow time. Crack them to kill hazards, cool heat, find cash, boost reputation — or to cripple the Warden.</p>
          <p><b className="text-indigo-300">Campaign:</b> deliver 2 packages in a district to unlock the next. Reach Spire Heights and take down the Warden. Sentinel notoriety at 100% burns you out for good.</p>
        </>)}
        {tab === 2 && (Object.keys(PACKAGES) as PkgKind[]).map((k) => (
          <p key={k}><span className="text-lg">{PACKAGES[k].icon}</span> <b style={{ color: PACKAGES[k].color }}>{PACKAGES[k].name}</b> — {PACKAGES[k].desc} <i className="text-indigo-300">{PACKAGES[k].tip}</i></p>
        ))}
        {tab === 3 && (<>
          {FACTION_IDS.map((f) => (
            <div key={f} className="mb-2"><b style={{ color: FACTIONS[f].color }}>{FACTIONS[f].icon} {FACTIONS[f].name}</b> <span className="text-indigo-300">(rival: {FACTIONS[FACTIONS[f].rival].name})</span>
              <div className="text-xs">{FACTIONS[f].blurb}</div></div>
          ))}
          <p className="text-xs">Delivering for a faction raises their rep and lowers their rival's. Allies give hack-time bonuses, discounts and exclusive gear. Hostile factions send hunters in their turf, and at a Kill Order they refuse your work.</p>
        </>)}
        {tab === 4 && (Object.keys(SEGS) as SegType[]).map((k) => (
          <p key={k}><span className="text-lg">{SEGS[k].icon}</span> <b className="text-cyan-300">{SEGS[k].name}</b> — {SEGS[k].desc}</p>
        ))}
        {tab === 4 && <p className="text-xs">Hazards: tripwires (slide), laser gates (time or dash), turrets &amp; drones (dodge, dash through drones), Sentinels &amp; hunters (stomp, slide, dash), crowds, roadblocks, steam vents, ziplines (hold jump near the cable).</p>}
      </div>
      <div className="flex justify-end"><Btn onClick={onClose}>Close</Btn></div>
    </div>
  );
}

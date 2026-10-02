import { useState } from 'react';
import { DIFFS, MILESTONES } from '../game/data';
import type { Stats } from '../game/sim';
import type { Settings } from '../game/save';
import { audio } from '../game/audio';
import { Btn, cx, fmt, Kbd, Modal, Slider, Toggle } from './ui';

export interface EndSummary {
  win: boolean; reason: string; years: number; charter: number; peakH: number; finalH: number; pop: number; peakPop: number;
  score: number; lp: number; milestones: number; stats: Stats; world: string; diff: string; techs: number; recorded: boolean;
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'goal' | 'systems' | 'controls'>('goal');
  return (
    <Modal title="Field Manual" onClose={onClose} wide>
      <div className="mb-4 flex gap-2">
        {(['goal', 'systems', 'controls'] as const).map((t) => (
          <Btn key={t} small variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>
            {t === 'goal' ? 'Goal' : t === 'systems' ? 'How the world works' : 'Controls'}
          </Btn>
        ))}
      </div>
      {tab === 'goal' && (
        <div className="space-y-3 text-sm leading-relaxed text-slate-200">
          <p><b className="text-cyan-200">You hold the Charter</b> to turn a dead world habitable before the deadline runs out. A small colony dome is your foothold; everything else is up to you.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Warm the planet, thicken the air, and bring liquid water back into the cycle.</li>
            <li>Seed life — microbes first, then lichens, grasses, shrubs, forests and rainforests — to make oxygen and food.</li>
            <li>Grow your colonies. Open Settlements need breathable air, mild temperatures, moisture and nearby plants to eat.</li>
            <li>Survive disasters and <b className="text-rose-300">The Reckoning</b>: a boss cataclysm (comet swarm → impact winter → superflare) that arrives once the world begins to flourish.</li>
            <li><b>Win:</b> after the Reckoning, hold habitability above the target with the population goal met for 8 straight years.</li>
            <li><b>Lose:</b> all colonists die, or the charter expires.</li>
          </ol>
          <p className="text-slate-400">Between runs, Legacy Points buy permanent perks and unlock harsher worlds: Glacia (flooding snowball) and Cinderia (runaway greenhouse).</p>
          <div className="rounded-lg bg-white/5 p-3 text-xs text-slate-300">
            <b>Milestones</b> grant research and materials: {MILESTONES.slice(0, 6).map((m) => m.name).join(', ')}… Check the Ledger tab to track them.
          </div>
        </div>
      )}
      {tab === 'systems' && (
        <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
          {[
            ['🌡️ Temperature', 'Sunlight (latitude, seasons, mirrors, clouds, dust) × albedo sets a base; greenhouse gases (CO₂, PFC, water vapor) add warming. Thin air transports heat poorly, so poles stay frozen.'],
            ['💧 Water cycle', 'Oceans and soil evaporate, wind carries vapor, mountains squeeze out rain, rivers run downhill, cold turns it to snow and ice. Ice reflects sunlight: melt it and the planet warms further.'],
            ['🌬️ Atmosphere', 'N₂ sets pressure (≥ 45 kPa is comfortable), O₂ must sit near 16–30, CO₂ is toxic above 0.6 kPa. Pressure also drives wind power and heat spread. See the Planet tab and the Ledger balance sheet.'],
            ['🌱 Life', 'Each species has temperature, soil-moisture and pressure needs. Plants absorb CO₂, release O₂, hold moisture, darken the ground and spread. Too much O₂ plus dry heat means wildfires.'],
            ['⚡ Power', 'Solar, wind and geothermal feed everything else. Brownouts throttle labs, scrubbers, domes, mirrors and more. Clouds and dust cut solar; thin air cripples wind.'],
            ['👥 Colonies', 'Domes survive anything while powered, but cap at 30. Settlements grow big only in a habitable, well-fed climate. Flooded, burned or abandoned buildings are lost.'],
            ['🌋 Disasters', 'Dust storms, eruptions, deluges, wildfires, heat/cold anomalies, meteors, flares and droughts. Forecasts give you time; Early Warning and Foresight extend it.'],
            ['☄️ The Reckoning', 'Phase 1: click red reticles to intercept fragments (18⚡). Phase 2: survive the impact winter. Phase 3: ride out the superflare. Keep energy banked!'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="mb-1 font-bold text-cyan-100">{t}</div><p className="text-[13px] text-slate-300">{d}</p></div>
          ))}
        </div>
      )}
      {tab === 'controls' && (
        <div className="grid gap-x-8 gap-y-2 text-sm text-slate-200 md:grid-cols-2">
          {[
            ['Left click', 'Use active tool / select tile / intercept'],
            ['Right click · Esc', 'Cancel tool (Esc again = pause menu)'],
            ['Drag · Arrow keys', 'Pan map'],
            ['Wheel · + / −', 'Zoom (also on-screen buttons)'],
            ['Space', 'Pause / resume'],
            ['[  ]', 'Slower / faster (1× 2× 4×)'],
            ['1 – 9, 0', 'Select structure from the build list'],
            ['Q · X', 'Inspect · Demolish'],
            ['S T M V H C F', 'Surface, Temperature, Moisture, Vegetation, Habitability, Clouds, Wind-flow overlays'],
            ['B R G L', 'Build, Research, Planet, Ledger tabs'],
            ['? · F1', 'This manual'],
            ['Touch', 'Tap to place/select, drag to pan, ± buttons to zoom'],
          ].map(([k, d]) => (
            <div key={k} className="flex items-center gap-3"><span className="w-40 shrink-0"><Kbd>{k}</Kbd></span><span className="text-slate-300">{d}</span></div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function SettingsModal(props: {
  settings: Settings; onChange: (s: Settings) => void; onClose: () => void; diff?: string; onDiff?: (d: string) => void;
}) {
  const s = props.settings;
  const set = (p: Partial<Settings>) => props.onChange({ ...s, ...p });
  return (
    <Modal title="Settings" onClose={props.onClose}>
      <div className="space-y-4">
        <Toggle label={s.muted ? '🔇 Sound muted' : '🔊 Sound on'} value={!s.muted} onChange={(v) => set({ muted: !v })} />
        <Slider label="Master volume" value={s.master} onChange={(v) => set({ master: v })} />
        <Slider label="Music & ambience" value={s.music} onChange={(v) => set({ music: v })} />
        <Slider label="Sound effects" value={s.sfx} onChange={(v) => { set({ sfx: v }); audio.sfx('click'); }} />
        <Toggle label="Screen shake" value={s.shake} onChange={(v) => set({ shake: v })} />
        <Toggle label="Particles & weather effects" value={s.particles} onChange={(v) => set({ particles: v })} />
        {props.diff && props.onDiff && (
          <div>
            <div className="mb-1 text-sm text-slate-300">Difficulty (applies immediately)</div>
            <div className="grid grid-cols-3 gap-2">
              {DIFFS.map((d) => (
                <button key={d.id} type="button" onClick={() => { audio.sfx('click'); props.onDiff?.(d.id); }} className={cx('rounded-lg border px-2 py-2 text-left text-xs transition', props.diff === d.id ? 'border-cyan-300 bg-cyan-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                  <div className="text-sm font-bold">{d.name}</div>
                  <div className="text-slate-400">{d.charter}y · {Math.round(d.winH * 100)}% · {d.popGoal} pop</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end"><Btn variant="primary" onClick={props.onClose}>Done</Btn></div>
      </div>
    </Modal>
  );
}

export function PauseModal(props: { onResume: () => void; onSettings: () => void; onHelp: () => void; onRestart: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState<'restart' | 'quit' | null>(null);
  return (
    <Modal title="Paused">
      {confirm ? (
        <div className="space-y-4 text-center">
          <p className="text-slate-200">{confirm === 'restart' ? 'Restart this world from the beginning? Progress in this run is lost.' : 'Abandon this run and return to the title screen?'}</p>
          <div className="flex justify-center gap-3">
            <Btn onClick={() => setConfirm(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => (confirm === 'restart' ? props.onRestart() : props.onQuit())}>Yes, {confirm}</Btn>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Btn variant="primary" onClick={props.onResume}>▶ Resume</Btn>
          <Btn onClick={props.onSettings}>⚙ Settings &amp; Difficulty</Btn>
          <Btn onClick={props.onHelp}>📖 Field Manual &amp; Controls</Btn>
          <Btn onClick={() => setConfirm('restart')}>↻ Restart World</Btn>
          <Btn variant="danger" onClick={() => setConfirm('quit')}>⏏ Quit to Title</Btn>
        </div>
      )}
    </Modal>
  );
}

export function EndModal(props: { s: EndSummary; onRetry: () => void; onMenu: () => void; onContinue?: () => void }) {
  const { s } = props;
  const rows: [string, string][] = [
    ['Years elapsed', `${s.years.toFixed(1)} / ${s.charter}`],
    ['Peak habitability', `${Math.round(s.peakH * 100)}%`],
    ['Final habitability', `${Math.round(s.finalH * 100)}%`],
    ['Population (peak)', `${fmt(s.pop)} (${fmt(s.peakPop)})`],
    ['Milestones', `${s.milestones} / ${MILESTONES.length}`],
    ['Technologies', String(s.techs)],
    ['Structures built / lost', `${s.stats.built} / ${s.stats.lost}`],
    ['Comets dropped', String(s.stats.comets)],
    ['Meteors stopped / hit', `${s.stats.stopped} / ${s.stats.hit}`],
    ['Disasters endured', String(s.stats.events)],
    ['Warmest average', `${s.stats.maxTemp.toFixed(1)}°C`],
  ];
  return (
    <Modal title={s.win ? '🌍 World Certified Habitable' : '💀 Charter Failed'}>
      <div className="pop-in space-y-4">
        <p className={cx('text-base', s.win ? 'text-emerald-200' : 'text-rose-200')}>{s.reason}</p>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="mb-2 flex items-end justify-between">
            <div><div className="text-xs uppercase tracking-wider text-slate-400">{s.world} · {s.diff}</div><div className="text-3xl font-bold text-amber-200">{fmt(s.score)} pts</div></div>
            <div className="text-right"><div className="text-xs text-slate-400">Legacy Points</div><div className="text-2xl font-bold text-cyan-200">{s.recorded ? `+${s.lp}` : '—'}</div></div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {rows.map(([a, b]) => (<div key={a} className="flex justify-between border-b border-white/5 py-0.5"><span className="text-slate-400">{a}</span><span className="tabular-nums">{b}</span></div>))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {props.onContinue && <Btn variant="good" onClick={props.onContinue}>🌱 Keep Terraforming</Btn>}
          <Btn variant="primary" onClick={props.onRetry}>↻ Retry</Btn>
          <Btn onClick={props.onMenu}>Title Screen</Btn>
        </div>
      </div>
    </Modal>
  );
}

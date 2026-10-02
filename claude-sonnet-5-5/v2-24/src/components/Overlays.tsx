import { useState } from 'react';
import type { Result } from '../game/engine';
import type { Settings } from '../game/storage';
import { DIFFS, SCENARIOS } from '../game/data';
import { SettingsPanel, Stars } from './ui';
import { ControlsTable } from './Help';

export function PauseMenu({ settings, onSettings, diff, onDiff, onResume, onRestart, onQuit, scName }: {
  settings: Settings; onSettings: (s: Settings) => void; diff: number; onDiff: (n: number) => void;
  onResume: () => void; onRestart: () => void; onQuit: () => void; scName: string;
}) {
  const [view, setView] = useState<'main' | 'settings' | 'help'>('main');
  const [confirm, setConfirm] = useState<'restart' | 'quit' | null>(null);
  return (
    <div className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <div className="panel pop-in scroll-thin max-h-full w-full max-w-md overflow-y-auto p-5">
        <h2 className="font-display text-center text-2xl font-black text-[var(--gold)]">Paused</h2>
        <p className="mb-3 text-center text-xs text-[var(--ink-dim)]">{scName}</p>
        {view === 'main' && (
          <div className="flex flex-col gap-2.5">
            <button className="btn btn-gold" onClick={onResume}>▶ Resume</button>
            <div className="rounded-lg bg-black/25 p-2">
              <div className="mb-1 text-xs text-[var(--ink-dim)]">Difficulty (changeable mid-game)</div>
              <div className="flex gap-1.5">
                {DIFFS.map((d, i) => <button key={d.id} className={`btn btn-sm flex-1 ${diff === i ? 'btn-gold' : 'btn-alt'}`} onClick={() => onDiff(i)}>{d.name}</button>)}
              </div>
            </div>
            <button className="btn btn-alt" onClick={() => setView('settings')}>⚙ Settings</button>
            <button className="btn btn-alt" onClick={() => setView('help')}>📖 Controls & Tips</button>
            {confirm === 'restart' ? (
              <div className="flex items-center gap-2 text-sm">Restart this city? <button className="btn btn-sm" onClick={onRestart}>Yes</button><button className="btn btn-alt btn-sm" onClick={() => setConfirm(null)}>No</button></div>
            ) : <button className="btn" onClick={() => setConfirm('restart')}>↺ Restart</button>}
            {confirm === 'quit' ? (
              <div className="flex items-center gap-2 text-sm">Abandon the city? <button className="btn btn-sm" onClick={onQuit}>Yes</button><button className="btn btn-alt btn-sm" onClick={() => setConfirm(null)}>No</button></div>
            ) : <button className="btn btn-alt" onClick={() => setConfirm('quit')}>⌂ Quit to Title</button>}
          </div>
        )}
        {view === 'settings' && (<div className="flex flex-col gap-3"><SettingsPanel settings={settings} onChange={onSettings} /><button className="btn btn-alt" onClick={() => setView('main')}>← Back</button></div>)}
        {view === 'help' && (
          <div className="flex flex-col gap-3">
            <ControlsTable />
            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--ink-dim)]">
              <li>Water flows downhill. Press <b>H</b> to see bed heights; hover with the Aqueduct tool to preview.</li>
              <li>Houses need a channel within 1 tile and a drain within 1 tile.</li>
              <li>Watch the Omen bar. Open spillways before storms; fill reservoirs before droughts.</li>
              <li>Click cracked aqueducts and rubble with the Inspect tool to repair.</li>
            </ul>
            <button className="btn btn-alt" onClick={() => setView('main')}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(t: number) { const m = Math.floor(t / 60); return `${m}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }

export function EndScreen({ r, onRetry, onNext, onContinue, onLegacy, onQuit, savedLP }: {
  r: Result; onRetry: () => void; onNext?: () => void; onContinue?: () => void; onLegacy: () => void; onQuit: () => void; savedLP: number;
}) {
  const sc = SCENARIOS[r.scenario];
  const rows: [string, string][] = [
    ['Time', fmtTime(r.time)], ['Final population', Math.round(r.pop).toString()], ['Peak population', Math.round(r.stats.peakPop).toString()],
    ['Happiness', Math.round(r.happy).toString()], ['Pollution', `${Math.round(r.pollution * 100)}%`], ['Deaths', Math.floor(r.stats.deaths).toString()],
    ['Homes lost', r.stats.homesLost.toString()], ['Flood events', r.stats.floods.toString()], ['Disasters faced', r.stats.events.toString()],
    ['Water delivered', Math.round(r.stats.delivered).toString()], ['Water wasted', Math.round(r.stats.wasted).toString()], ['Waste treated', Math.round(r.stats.treated).toString()],
    ['Coin earned', Math.round(r.stats.earned).toString()], ['Structures built', r.stats.built.toString()], ['Harvests', r.stats.harvests.toString()], ['Techs researched', r.techs.toString()],
  ];
  return (
    <div className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="panel pop-in scroll-thin max-h-full w-full max-w-xl overflow-y-auto p-5">
        <div className="text-center">
          <div className="text-5xl">{r.win ? '🏛️' : '🌊'}</div>
          <h2 className={`font-display text-3xl font-black ${r.win ? 'text-[var(--gold)]' : 'text-[var(--bad)]'}`}>{r.win ? 'Victory!' : 'Defeat'}</h2>
          <p className="text-sm text-[var(--ink-dim)]">{sc.name} — {r.reason}</p>
          {r.win && <div className="mt-1 text-3xl"><Stars n={r.stars} /></div>}
          <div className="mt-1 text-lg">Score <b className="text-[var(--gold)]">{r.score}</b> · <span className="chip">+{savedLP} Legacy Points</span></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-white/10 py-0.5"><span className="text-[var(--ink-dim)]">{k}</span><b>{v}</b></div>)}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {r.win && onNext && <button className="btn btn-gold" onClick={onNext}>Next Province ▶</button>}
          {r.win && onContinue && <button className="btn btn-alt" onClick={onContinue}>Keep Building</button>}
          <button className="btn" onClick={onRetry}>↺ {r.win ? 'Replay' : 'Retry'}</button>
          <button className="btn btn-alt" onClick={onLegacy}>🏺 Legacy Hall</button>
          <button className="btn btn-alt" onClick={onQuit}>⌂ Title</button>
        </div>
        <div className="mt-2 text-center text-[11px] text-[var(--ink-dim)]">Legacy points are added to your hall automatically.</div>
      </div>
    </div>
  );
}

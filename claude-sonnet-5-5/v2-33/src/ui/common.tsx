import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Settings } from '../game/save';
import type { Stats } from '../game/data';
import { fmt, fmtTime } from '../game/data';
import { audio } from '../game/audio';

export function useTick(ms = 150) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export function Bar({ v, max = 1, color = '#4de1ff' }: { v: number; max?: number; color?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
  return (
    <div className="bar">
      <div style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm pointer-events-auto">
      <div className={`panel anim-in flex max-h-full w-full flex-col rounded-lg ${wide ? 'max-w-4xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between border-b border-cyan-400/20 px-4 py-2">
          <h2 className="font-title text-lg text-cyan-200">{title}</h2>
          {onClose && (
            <button className="btn" onClick={onClose}>
              ✕ Close
            </button>
          )}
        </div>
        <div className="scroll min-h-0 flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

export function SettingsPanel({ s, onChange }: { s: Settings; onChange: (s: Settings) => void }) {
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => (
    <label className="flex items-center gap-3">
      <span className="w-24 text-sm text-slate-300">{label}</span>
      <input
        type="range" min={0} max={1} step={0.05} value={s[key]} className="flex-1"
        onChange={(e) => onChange({ ...s, [key]: Number(e.target.value) })}
        onPointerUp={() => audio.play('click')}
      />
      <span className="w-10 text-right text-sm tabular-nums text-cyan-200">{Math.round(s[key] * 100)}%</span>
    </label>
  );
  const toggle = (label: string, key: 'muted' | 'shake' | 'edge', desc?: string) => (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded border border-cyan-400/15 px-3 py-2 hover:bg-cyan-400/5">
      <span>
        <span className="text-sm text-slate-100">{label}</span>
        {desc && <span className="block text-xs text-slate-400">{desc}</span>}
      </span>
      <input type="checkbox" checked={s[key]} onChange={(e) => onChange({ ...s, [key]: e.target.checked })} className="h-5 w-5 accent-cyan-400" />
    </label>
  );
  return (
    <div className="space-y-3">
      {slider('Master volume', 'master')}
      {slider('Music', 'music')}
      {slider('Effects', 'sfx')}
      {toggle('Mute all audio', 'muted')}
      {toggle('Screen shake', 'shake', 'Camera shake on explosions and impacts.')}
      {toggle('Edge scrolling', 'edge', 'Move the mouse to the screen edge to pan the camera.')}
    </div>
  );
}

const KEYS: [string, string][] = [
  ['Left-click / drag', 'Select ship / box-select. Double-click selects all of that type.'],
  ['Right-click', 'Command: wreck → tow (tugs) or cut (cutters); enemy → attack; station → return to dock; empty space → move.'],
  ['WASD / Arrows / edge / middle-drag', 'Pan the camera'],
  ['Mouse wheel  (+ / -)', 'Zoom'],
  ['Q', 'Toggle AUTO for selected ships (they pick wrecks / guard / explore on their own)'],
  ['X  ·  R', 'Stop and hold  ·  Return to the station'],
  ['Space  ·  Tab', 'Centre on selection / station  ·  Cycle through ships'],
  ['Ctrl+A  ·  1-9', 'Select all  ·  Recall group (Ctrl/Shift+number assigns it)'],
  ['B M K C U F', 'Panels: Fleet/shipyard, Market, Rights, Crew, Lab, Factions'],
  ['V', 'Game speed 1x / 2x / 3x'],
  ['Esc / P · H', 'Pause menu · Help'],
  ['Touch', 'Tap a ship to select, tap a target to command, drag to pan, use the on-screen zoom buttons.'],
];

export function HelpContent() {
  const H = ({ children }: { children: ReactNode }) => <h3 className="mb-1 mt-4 font-title text-sm text-amber-200">{children}</h3>;
  const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-slate-300">{children}</p>;
  return (
    <div>
      <H>Objective</H>
      <P>
        You run a salvage syndicate over a field of dead warships. Every sector has a <b>quota</b> of salvage value to deliver before the charter
        audit timer runs out. Clear five sectors, then haul <b>The Leviathan</b> home past the pirate dreadnought MAW to win. You lose if your station
        falls, the audit expires, or you go insolvent with no fleet.
      </P>
      <H>Controls</H>
      <div className="grid gap-1">
        {KEYS.map(([k, d]) => (
          <div key={k} className="flex gap-3 text-sm">
            <span className="w-52 shrink-0 font-semibold text-cyan-200">{k}</span>
            <span className="text-slate-300">{d}</span>
          </div>
        ))}
      </div>
      <H>🛰️ Tractor-beam logistics</H>
      <P>
        Tugs latch onto wrecks and tow them to the dock. A wreck needs <b>tow power ≥ 40% of its mass</b> to move at all, and moves faster with more
        power, so send several tugs (or a Heavy Hauler) at big hulks. When two syndicates tow the same wreck it becomes a <b>tug-of-war</b>: the strongest side
        wins it. 🔥 Cutters strip wrecks on site (85% yield) and ferry cargo home; never cut reactor hulks, as they go critical, so tow them. Ships burn fuel while moving.
      </P>
      <H>📜 Salvage rights</H>
      <P>
        Stake a claim for a fraction of a wreck's value and rivals will respect it unless they hate you. Poaching their claims costs relations. Bid in prize-wreck
        auctions against the AI syndicates, and sell claim rights to rivals for cash and goodwill.
      </P>
      <H>💱 Market, contracts &amp; fuel</H>
      <P>
        Prices drift with demand and events, and every unit you sell pushes the price down before it slowly recovers, so sell in batches and watch the charts.
        Fulfil contracts for premiums and relations. Refine Power Cores into fuel if you run dry.
      </P>
      <H>🧑‍🚀 Crew</H>
      <P>
        Each ship needs a captain. Match specialties (Rigger → tugs/cutters, Gunner → gunships, Pilot → scouts). Pay policy and fear of losses drive morale;
        low morale slows work and causes desertion. Turncoats from rival factions may defect if relations sour.
      </P>
      <H>🏴 Factions &amp; heat</H>
      <P>
        Ironclad raids you when hostile, Verdant embargoes your goods, and the Magpies hijack your tows. Gifts, treaties and contracts keep the peace; sabotage and mercenaries
        are available for dirty work. Delivering loot raises <b>heat</b>, which draws bigger and faster pirate raids.
      </P>
      <H>Progression</H>
      <P>
        In a run: research upgrades in the Lab (credits + Data Shards) and pick a boon after each sector. Between runs: earn <b>Renown</b> and spend it in the Archives on permanent upgrades and ship unlocks.
      </P>
    </div>
  );
}

export function StatsGrid({ stats, time }: { stats: Stats; time: number }) {
  const rows: [string, string][] = [
    ['Time played', fmtTime(time)],
    ['Salvage delivered', `${fmt(stats.delivered)} cr`],
    ['Wrecks towed', String(stats.towed)],
    ['Wrecks stripped', String(stats.cut)],
    ['Enemies destroyed', String(stats.kills)],
    ['Ships lost', String(stats.lost)],
    ['Credits earned (sales)', fmt(stats.earned)],
    ['Credits spent', fmt(stats.spent)],
    ['Raids repelled', `${stats.repelled}/${stats.raids}`],
    ['Claims / auctions won', `${stats.claims} / ${stats.auctions}`],
    ['Contracts done', String(stats.contracts)],
    ['Crew hired', String(stats.hires)],
    ['Peak fleet size', String(stats.peakFleet)],
    ['Sectors cleared', String(stats.sectors)],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-cyan-400/10 py-0.5">
          <span className="text-slate-400">{k}</span>
          <span className="font-semibold tabular-nums text-cyan-100">{v}</span>
        </div>
      ))}
    </div>
  );
}

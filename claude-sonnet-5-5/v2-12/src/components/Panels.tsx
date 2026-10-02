import { useState, ReactNode } from 'react';
import { Btn, Panel, Slider, Toggle, UnitIcon } from './ui';
import { Settings } from '../game/save';
import { DIFFS, MODS, UNITS, TERRAIN_INFO, UType } from '../game/data';

export function SettingsPanel({
  settings, onChange, onClose, onReset,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onReset?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  return (
    <Panel title="Settings" className="p-4">
      <div className="mt-2 flex flex-col gap-3">
        <Slider label="Master" value={settings.master} onChange={(v) => set({ master: v })} />
        <Slider label="Music" value={settings.music} onChange={(v) => set({ music: v })} />
        <Slider label="Effects" value={settings.sfx} onChange={(v) => set({ sfx: v })} />
        <Toggle label="Mute all audio" value={settings.muted} onChange={(v) => set({ muted: v })} hint="Shortcut: M" />
        <Toggle label="Screen shake" value={settings.shake} onChange={(v) => set({ shake: v })} />
        <Toggle label="High particle density" value={settings.particles === 1} onChange={(v) => set({ particles: v ? 1 : 0 })} />
        <Toggle label="Tutorial coach (first battle)" value={settings.coach} onChange={(v) => set({ coach: v })} />
        <div>
          <div className="mb-1 text-xs uppercase tracking-widest text-slate-400">Difficulty (AI sharpness applies instantly)</div>
          <div className="grid grid-cols-3 gap-2">
            {DIFFS.map((d) => (
              <Btn key={d.id} small active={settings.diff === d.id} variant={settings.diff === d.id ? 'primary' : 'ghost'} onClick={() => set({ diff: d.id })}>
                {d.name}
              </Btn>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">{DIFFS.find((d) => d.id === settings.diff)?.desc}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {onReset &&
            (confirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">Erase ALL progress?</span>
                <Btn small variant="danger" onClick={() => { onReset(); setConfirm(false); }}>Yes, erase</Btn>
                <Btn small onClick={() => setConfirm(false)}>No</Btn>
              </div>
            ) : (
              <Btn small variant="danger" onClick={() => setConfirm(true)}>Reset progress</Btn>
            ))}
          <Btn variant="primary" onClick={onClose} className="ml-auto">Close</Btn>
        </div>
      </div>
    </Panel>
  );
}

const TABS = ['Basics', 'Gravity', 'Pieces', 'Terrain', 'Campaign', 'Controls'] as const;

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-700/50 py-1.5 text-sm">
      <kbd className="min-w-[88px] shrink-0 rounded bg-slate-800 px-2 py-0.5 text-center font-mono text-xs text-cyan-200">{k}</kbd>
      <span className="text-slate-300">{children}</span>
    </div>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Basics');
  const types: UType[] = ['mote', 'sling', 'prism', 'bulwark', 'singularity', 'core', 'warden', 'horizon'];
  return (
    <Panel title="Field Manual" className="p-4">
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Btn key={t} small active={tab === t} variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>{t}</Btn>
        ))}
      </div>
      <div className="mt-3 min-h-[320px] space-y-2 text-sm leading-relaxed text-slate-300">
        {tab === 'Basics' && (
          <>
            <p><b className="text-cyan-200">Goal.</b> Chess-like tactics on a board where every piece has <b>mass</b>, and mass bends space. Win by meeting the battle objective: destroy the enemy <b>Core</b> or boss, eliminate all hostiles, or survive a number of rounds. You lose if your <b>Core</b> dies - by combat <i>or</i> by drifting into a black hole.</p>
            <p><b className="text-cyan-200">Your turn.</b> Click a cyan piece. Blue tiles are where it can move (numbers show gravity-adjusted cost). After moving, red-outlined enemies can be attacked. Each piece may <b>move once</b> and then <b>act once</b> (attack, Wait or Brace). Press <b>End Turn</b> when done.</p>
            <p><b className="text-cyan-200">Enemy phase &amp; drift.</b> Enemies move and attack. Then <b>gravity drift</b> hits: any piece feeling a strong enough pull slides one tile toward it. Small arrows on pieces preview this. Red arrows mean death in a black hole.</p>
            <p><b className="text-cyan-200">Energy.</b> You gain +1 Energy per round. Spend 2 on a <b>Gravity Pulse</b>: drop a temporary well (attracts) or repulsor (pushes) on any open tile.</p>
            <p><b className="text-cyan-200">Between battles.</b> Earn Stardust and XP. Promote veterans in the Barracks, recruit new pieces, and fund Research upgrades.</p>
          </>
        )}
        {tab === 'Gravity' && (
          <>
            <p><b className="text-cyan-200">1. Movement is warped.</b> Moving <i>toward</i> heavy masses costs less (green numbers); moving <i>away</i> costs more (orange). Light pieces feel it more; heavy ones have inertia. Nebula adds +0.8.</p>
            <p><b className="text-cyan-200">2. Beams bend.</b> Ranged lines curve at every tile toward strong fields. Hover an enemy to see the exact curved path. Lobbed Slingshot shells ignore bending. Lens promotions straighten beams.</p>
            <p><b className="text-cyan-200">3. Downhill damage.</b> Firing along the field at your tile gives +1 damage; firing against a strong field gives -1.</p>
            <p><b className="text-cyan-200">4. Drift.</b> At round end, a piece whose field strength exceeds its threshold (0.4 + 0.45 x mass) slides one tile along it. Heavy or anchored pieces resist. Drifting into a hole kills; ramming an enemy hurts both.</p>
            <p><b className="text-cyan-200">5. Impulse.</b> Bulwarks push, Singularities pull. Targets shove 1 tile if the attacker is not much lighter. Walls and rocks deal slam damage; holes swallow.</p>
            <p><b className="text-cyan-200">6. Brace.</b> Ends a piece&apos;s turn but adds +3 mass until next round - it anchors itself and bends nearby space.</p>
            <p><b className="text-cyan-200">Field overlay.</b> Press <b>G</b> to see field arrows and strength tint.</p>
          </>
        )}
        {tab === 'Pieces' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => {
              const d = UNITS[t];
              return (
                <div key={t} className="flex gap-3 rounded-lg border border-slate-700/60 bg-slate-900/60 p-2">
                  <UnitIcon type={t} team={d.boss ? 'e' : 'p'} size={40} />
                  <div>
                    <div className="font-semibold text-slate-100">{d.name} <span className="text-xs text-slate-400">({d.role})</span></div>
                    <div className="text-xs text-cyan-200">Mass {d.mass} · HP {d.hp} · ATK {d.atk} · Move {d.move} · Range {d.adirs === 'knight' ? 'L' : d.range}</div>
                    <div className="text-xs text-slate-400">{d.blurb}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'Terrain' && (
          <div className="space-y-2">
            {Object.entries(TERRAIN_INFO).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-2">
                <b className="text-cyan-200">{v.name}</b> - {v.desc}
              </div>
            ))}
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-2"><b className="text-cyan-200">Gravity Pulse</b> - Temporary well/repulsor you place. Numbers show rounds remaining.</div>
          </div>
        )}
        {tab === 'Campaign' && (
          <>
            <p><b className="text-cyan-200">10 battles</b> across sectors, with bosses at battles 5 and 10. Each battle awards up to 3 stars: win, lose no pieces, and meet the par (rounds, or Core above half HP for survival battles).</p>
            <p><b className="text-cyan-200">Promotion trees.</b> Pieces earn XP from hits and kills. At 8 XP and 20 XP they can promote (costing Stardust) along one of two branches.</p>
            <p><b className="text-cyan-200">Difficulty.</b> {DIFFS.map((d) => `${d.name}: ${d.desc}`).join(' ')}</p>
            <p><b className="text-cyan-200">Modifiers.</b> {MODS.map((m) => `${m.name} (+${Math.round(m.bonus * 100)}% rewards): ${m.desc}`).join(' ')}</p>
            <p>Progress saves automatically in your browser. Defeat still pays a little Stardust and XP, so you always advance.</p>
          </>
        )}
        {tab === 'Controls' && (
          <>
            <Row k="Click / Tap">Select piece, move, attack, place pulse. On touch, tap an enemy twice to confirm an attack.</Row>
            <Row k="Right-click">Cancel selection / pulse mode</Row>
            <Row k="Arrows + Enter">Move the yellow cursor and click with Enter / Space</Row>
            <Row k="Tab / N">Select next unready piece</Row>
            <Row k="W">Wait (end piece&apos;s turn)</Row>
            <Row k="B">Brace (+3 mass)</Row>
            <Row k="Z / Backspace">Undo move (before acting)</Row>
            <Row k="P">Gravity Pulse mode (then 1 = well, 2 = repulsor)</Row>
            <Row k="G">Toggle gravity field overlay</Row>
            <Row k="E">End turn</Row>
            <Row k="Esc">Cancel / pause menu</Row>
            <Row k="M">Mute / unmute</Row>
          </>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Btn variant="primary" onClick={onClose}>Close</Btn>
      </div>
    </Panel>
  );
}

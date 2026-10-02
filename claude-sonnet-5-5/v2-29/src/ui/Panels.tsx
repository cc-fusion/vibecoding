import type { ReactNode } from 'react';
import { BRANCHES, CODEX_PERKS, computeStats, DIFFS, LORE, MODS, SITES, UPGRADES, lvl, type Upgrade } from '../game/data';
import type { SaveData, Settings } from '../game/save';
import type { DiveResult } from '../game/engine';
import { audio } from '../game/audio';

export const FONT = { fontFamily: 'Cinzel, "Trajan Pro", Georgia, serif' } as const;

export function Btn({ children, onClick, kind = 'primary', disabled, className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'gold'; disabled?: boolean; className?: string }) {
  const styles = {
    primary: 'bg-cyan-700/80 hover:bg-cyan-600 border-cyan-300/50 text-white',
    ghost: 'bg-slate-900/70 hover:bg-slate-800 border-slate-400/30 text-slate-100',
    danger: 'bg-rose-800/80 hover:bg-rose-700 border-rose-300/40 text-white',
    gold: 'bg-amber-600/90 hover:bg-amber-500 border-amber-200/60 text-slate-950',
  }[kind];
  return (
    <button
      disabled={disabled}
      onClick={() => { audio.init(); audio.play(disabled ? 'deny' : 'click'); if (!disabled) onClick?.(); }}
      className={`px-4 py-2.5 rounded-lg border font-semibold tracking-wide transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[92vh] overflow-auto rounded-2xl border border-cyan-300/25 bg-gradient-to-b from-[#0c2536] to-[#050f19] p-5 shadow-[0_0_80px_rgba(60,200,255,0.2)]`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl text-cyan-100" style={FONT}>{title}</h2>
          {onClose && <Btn kind="ghost" onClick={onClose}>✕ Close</Btn>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm text-cyan-50">
      <span className="w-28">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-cyan-400" />
      <span className="w-10 text-right tabular-nums">{Math.round(value * 100)}</span>
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (p: Partial<Settings>) => { onChange({ ...settings, ...p }); };
  return (
    <div className="flex flex-col gap-3">
      <Slider label="Master volume" value={settings.master} onChange={(v) => set({ master: v })} />
      <Slider label="Music" value={settings.music} onChange={(v) => set({ music: v })} />
      <Slider label="Sound effects" value={settings.sfx} onChange={(v) => set({ sfx: v })} />
      <label className="flex items-center gap-3 text-sm text-cyan-50"><input type="checkbox" checked={settings.muted} onChange={(e) => set({ muted: e.target.checked })} className="accent-cyan-400 w-4 h-4" /> Mute all audio (M)</label>
      <label className="flex items-center gap-3 text-sm text-cyan-50"><input type="checkbox" checked={settings.shake} onChange={(e) => set({ shake: e.target.checked })} className="accent-cyan-400 w-4 h-4" /> Screen shake</label>
      <label className="flex items-center gap-3 text-sm text-cyan-50">
        <span className="w-28">Particles</span>
        <select value={settings.particles} onChange={(e) => set({ particles: parseInt(e.target.value) })} className="bg-slate-900 border border-cyan-300/30 rounded px-2 py-1">
          <option value={0}>Low</option><option value={1}>Medium</option><option value={2}>High</option>
        </select>
      </label>
    </div>
  );
}

export function DifficultyPicker({ save, onDiff, onMods }: { save: SaveData; onDiff: (id: string) => void; onMods: (m: string[]) => void }) {
  const mult = DIFFS.find((d) => d.id === save.difficulty)?.marks ?? 1;
  const bonus = save.mods.reduce((a, id) => a + (MODS.find((m) => m.id === id)?.marks || 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {DIFFS.map((d) => (
          <button key={d.id} onClick={() => { audio.play('click'); onDiff(d.id); }} className={`text-left p-3 rounded-xl border transition-all ${save.difficulty === d.id ? 'border-amber-300 bg-amber-300/10 shadow-[0_0_20px_rgba(255,210,100,0.25)]' : 'border-cyan-300/20 bg-slate-900/60 hover:bg-slate-800/70'}`}>
            <div className="font-bold text-cyan-50" style={FONT}>{d.name}</div>
            <div className="text-xs text-cyan-100/70 mt-1">{d.blurb}</div>
            <div className="text-xs text-amber-200 mt-2">Marks ×{d.marks}</div>
          </button>
        ))}
      </div>
      <div>
        <div className="text-sm text-cyan-100 mb-2 font-semibold">Dive modifiers (more risk, more marks)</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {MODS.map((m) => {
            const on = save.mods.includes(m.id);
            return (
              <button key={m.id} onClick={() => { audio.play('click'); onMods(on ? save.mods.filter((x) => x !== m.id) : [...save.mods, m.id]); }} className={`text-left p-2.5 rounded-lg border flex gap-2 items-start ${on ? 'border-rose-300 bg-rose-400/10' : 'border-cyan-300/20 bg-slate-900/60 hover:bg-slate-800/70'}`}>
                <span className="text-xl">{m.icon}</span>
                <span><span className="font-semibold text-cyan-50">{m.name}</span> <span className="text-amber-200 text-xs">+{Math.round(m.marks * 100)}%</span><br /><span className="text-xs text-cyan-100/70">{m.desc}</span></span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-sm text-amber-200">Total payout multiplier: ×{(mult * (1 + bonus)).toFixed(2)}</div>
    </div>
  );
}

export function HelpPanel() {
  const keys: [string, string][] = [
    ['W A S D / Arrows', 'Thrust the submersible'],
    ['Mouse', 'Aim the harpoon'],
    ['Left Click / Space', 'Fire harpoon'],
    ['Shift', 'Boost (burns power, makes noise)'],
    ['L', 'Toggle lantern'],
    ['Q', 'Sonar ping — reveals creatures, loot and maps terrain'],
    ['F', 'Drop a flare — lures jellies and eels'],
    ['R', 'EMP pulse — stuns creatures (needs EMP Coil)'],
    ['E', 'Interact: terminals and the surface dock'],
    ['Esc / P', 'Pause'],
    ['M', 'Mute'],
  ];
  const sys: [string, string][] = [
    ['🫧 Air', 'Drains constantly, faster when deep or boosting. Refill at the surface or at bubbling vents. Running dry slowly crushes your hull.'],
    ['⚖️ Pressure', 'Each hull has a rated depth. Dive past it and the hull takes growing damage — upgrade Titanium Plating before chasing deep sites.'],
    ['💡 Light & Power', 'Lantern, boost, sonar and EMP share one battery. Light reveals the dark but draws jellies; darkness hides you but hides loot too.'],
    ['🦈 Ecosystem Threat', 'Noise (boost, harpoons, sonar, relics, blood) raises Threat. Higher Threat spawns hunters and stronger predators. Sit still in the dark to let it fall.'],
    ['📦 Cargo', 'Salvage adds weight and slows you. If you die you keep only what Salvage Insurance covers — dock to bank everything.'],
    ['🗿 Terminals', 'Solve ancient machines (Glyph Echo, Ring Lock, Resonance Grid) while the sea keeps moving. Unlock the vault, take the Core, and surface.'],
    ['🐙 Creatures', 'Silverfin shoals (prey), stinger jellies, moray eels, lure anglers, Archive sentinels and drones — and the Warden of the Heart Vault.'],
  ];
  return (
    <div className="grid md:grid-cols-2 gap-5 text-sm text-cyan-50">
      <div>
        <h3 className="text-lg text-amber-200 mb-2" style={FONT}>Controls</h3>
        <table className="w-full">
          <tbody>
            {keys.map(([k, v]) => (
              <tr key={k} className="border-b border-cyan-300/10"><td className="py-1.5 pr-3 font-mono text-amber-100 whitespace-nowrap">{k}</td><td className="py-1.5 text-cyan-100/80">{v}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-cyan-100/70"><b>Gamepad:</b> L-stick move, R-stick aim, RT/RB fire, LT boost, X lantern, Y sonar, B flare, LB EMP, A interact, Start pause.<br /><b>Touch:</b> on-screen stick and buttons appear automatically (aim auto-targets).</p>
      </div>
      <div>
        <h3 className="text-lg text-amber-200 mb-2" style={FONT}>Systems</h3>
        <div className="flex flex-col gap-2">
          {sys.map(([t, d]) => (<div key={t} className="rounded-lg bg-slate-900/60 border border-cyan-300/15 p-2"><b className="text-cyan-100">{t}</b><div className="text-cyan-100/75">{d}</div></div>))}
        </div>
        <p className="mt-3 text-cyan-100/70">Tip: take the <b>Training Dive</b> from the title screen for an interactive tutorial. Hit the Warden when it is <b>open</b> after a dash — bait it into walls!</p>
      </div>
    </div>
  );
}

function pips(l: number, m: number) {
  return Array.from({ length: m }, (_, i) => <span key={i} className={`inline-block w-2.5 h-2.5 rounded-full mr-1 ${i < l ? 'bg-amber-300' : 'bg-slate-700'}`} />);
}

export function Workshop({ save, onBuy }: { save: SaveData; onBuy: (u: Upgrade) => void }) {
  const st = computeStats(save, []);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {[
          ['Crush rating', `${st.rating} m`], ['Hull', `${st.maxHull}`], ['Air', `${st.maxAir}`], ['Power', `${st.maxPower}`],
          ['Cargo', `${st.cargoCap}`], ['Harpoon', `${st.dmg.toFixed(0)} dmg / ${st.cd.toFixed(2)}s`], ['Lantern', `${Math.round(st.lensR)} px`], ['Flares', `${st.flares}`],
        ].map(([k, v]) => (<div key={k} className="rounded bg-slate-900/70 border border-cyan-300/15 px-2 py-1.5"><div className="text-cyan-200/60">{k}</div><div className="text-amber-100 font-bold">{v}</div></div>))}
      </div>
      <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4">
        {BRANCHES.map((b) => (
          <div key={b.id} className="rounded-xl border p-3 bg-slate-950/40" style={{ borderColor: b.color + '55' }}>
            <div className="font-bold mb-2" style={{ ...FONT, color: b.color }}>{b.icon} {b.name}</div>
            <div className="flex flex-col gap-2">
              {UPGRADES.filter((u) => u.branch === b.id).map((u) => {
                const l = lvl(save, u.id);
                const maxed = l >= u.max;
                const reqOk = !u.req || lvl(save, u.req.id) >= u.req.lvl;
                const cost = u.cost[l] ?? 0;
                const afford = save.marks >= cost;
                const reqName = u.req ? UPGRADES.find((x) => x.id === u.req!.id)?.name : '';
                return (
                  <div key={u.id} className={`rounded-lg border p-2 ${reqOk ? 'border-cyan-300/20 bg-slate-900/60' : 'border-slate-700/40 bg-slate-900/30 opacity-60'}`}>
                    <div className="flex justify-between items-center"><span className="font-semibold text-cyan-50 text-sm">{u.icon} {u.name}</span><span>{pips(l, u.max)}</span></div>
                    <div className="text-[11px] text-cyan-100/70 my-1">{u.desc}</div>
                    {!reqOk && <div className="text-[11px] text-rose-300">Requires {reqName} Lv {u.req!.lvl}</div>}
                    <button
                      disabled={maxed || !reqOk || !afford}
                      onClick={() => onBuy(u)}
                      className="mt-1 w-full text-xs py-1 rounded border border-amber-300/50 bg-amber-500/20 hover:bg-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-semibold"
                    >
                      {maxed ? 'MAXED' : `Upgrade — ${cost} ◈`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CodexPanel({ save }: { save: SaveData }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-cyan-100/80">Recover glowing tablets in the deep to read the history of the Archive. {save.codex.length}/12 found.</div>
      <div className="flex flex-wrap gap-2 text-xs">
        {CODEX_PERKS.map((p) => (<span key={p.n} className={`px-2 py-1 rounded border ${save.codex.length >= p.n ? 'border-amber-300 text-amber-200 bg-amber-300/10' : 'border-slate-600 text-slate-400'}`}>{p.n} fragments: {p.text}</span>))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {LORE.map((l) => {
          const f = save.codex.includes(l.id);
          return (
            <div key={l.id} className={`rounded-lg border p-3 ${f ? 'border-cyan-300/30 bg-slate-900/60' : 'border-slate-700/40 bg-slate-900/30'}`}>
              <div className="font-bold text-sm" style={{ ...FONT, color: f ? '#9fe8ff' : '#667' }}>{f ? l.title : `Fragment ${l.id + 1} — undiscovered`}</div>
              <div className="text-xs mt-1 text-cyan-100/80 italic">{f ? l.text : `Found in ${SITES[[0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4][l.id]].name}.`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReportScreen({ res, onRetry, onBay, onNext, onTitle }: { res: DiveResult; onRetry: () => void; onBay: () => void; onNext: (() => void) | null; onTitle: () => void }) {
  const site = res.siteId >= 0 ? SITES[res.siteId] : null;
  const victory = res.outcome === 'success' && res.siteId === 4;
  const title = victory ? 'THE ARCHIVE IS SAVED' : res.outcome === 'success' ? 'DIVE COMPLETE' : res.outcome === 'retreat' ? 'RETREATED TO DOCK' : res.outcome === 'death' ? 'SUBMERSIBLE LOST' : res.outcome === 'abandon' ? 'DIVE ABANDONED' : 'TRAINING COMPLETE';
  const col = res.outcome === 'death' ? '#ff6b6b' : res.outcome === 'abandon' ? '#9aa' : victory ? '#ffd27a' : '#6dffd0';
  const acc = res.shots ? Math.round((res.hits / res.shots) * 100) : 0;
  const rows: [string, string][] = [
    ['Time below', `${Math.floor(res.time / 60)}:${String(Math.floor(res.time % 60)).padStart(2, '0')}`],
    ['Max depth', `${Math.round(res.maxDepth)} m`],
    ['Terminals solved', `${res.nodes}/${res.nodesTotal}`],
    ['Creatures downed', String(res.creatures)],
    ['Relics', String(res.relics)],
    ['Fragments', String(res.tablets.length)],
    ['Damage taken', String(Math.round(res.damage))],
    ['Harpoon accuracy', `${acc}% (${res.hits}/${res.shots})`],
    ['Flares used', String(res.flares)],
    ['Peak threat', `${Math.round(res.threatPeak)}%`],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-gradient-to-b from-[#06182a] via-[#04101d] to-black overflow-auto">
      <div className="w-full max-w-2xl rounded-2xl border p-6 bg-[#06131f]/90" style={{ borderColor: col + '66', boxShadow: `0 0 80px ${col}33` }}>
        <h1 className="text-3xl md:text-4xl text-center mb-1" style={{ ...FONT, color: col }}>{title}</h1>
        <p className="text-center text-cyan-100/70 mb-4 text-sm">
          {site ? site.name : 'Training Pool'}
          {res.outcome === 'death' && ` — ${res.cause}`}
          {res.outcome === 'success' && res.bossDown && ' — the Warden is defeated'}
        </p>
        {victory && <p className="text-center text-amber-100 mb-4 italic">You carry the first reader&apos;s lamp to the surface. The sea may keep the rest. The library can finally close — or you can keep diving for glory.</p>}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
          {rows.map(([k, v]) => (<div key={k} className="flex justify-between border-b border-cyan-300/10 py-1"><span className="text-cyan-100/70">{k}</span><span className="text-cyan-50 font-semibold">{v}</span></div>))}
        </div>
        <div className="rounded-xl bg-black/30 border border-amber-300/30 p-3 mb-4 text-sm">
          <div className="flex justify-between"><span>Cargo value</span><span>{res.cargoValue} ◈</span></div>
          {res.outcome === 'death' && <div className="flex justify-between text-rose-300"><span>Recovered by insurance</span><span>{res.kept} ◈</span></div>}
          {res.reward > 0 && <div className="flex justify-between text-emerald-300"><span>Expedition reward{res.firstClear ? ' (first clear ×1.5)' : ''}</span><span>+{res.reward} ◈</span></div>}
          <div className="flex justify-between text-lg font-bold text-amber-200 mt-1"><span>Marks earned</span><span>{res.payout} ◈</span></div>
          {res.tablets.length > 0 && <div className="text-cyan-200 mt-1">📜 {res.tablets.length} new fragment(s) added to the Codex</div>}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {onNext && <Btn kind="gold" onClick={onNext}>Next expedition ▶</Btn>}
          {res.outcome !== 'training' && <Btn onClick={onRetry}>{res.outcome === 'death' ? 'Retry dive' : 'Dive again'}</Btn>}
          <Btn kind="ghost" onClick={onBay}>Workshop &amp; Bay</Btn>
          <Btn kind="ghost" onClick={onTitle}>Title</Btn>
        </div>
      </div>
    </div>
  );
}

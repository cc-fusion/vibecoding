import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  DIFFICULTIES, MODIFIERS, UPGRADES, ENEMIES, SPECIES, SPECIES_ORDER, BUILDINGS, BUILD_ORDER, SPELLS, RES_KEYS, RES_META,
} from '../game/data';
import type { Res } from '../game/data';
import type { SaveData } from '../game/save';
import type { RunResult } from '../game/engine';
import { audio } from '../game/audio';

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm anim-fade" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`panel anim-up w-full ${wide ? 'max-w-4xl' : 'max-w-md'} max-h-full overflow-auto scroll p-5`}>{children}</div>
    </div>
  );
}

export function costText(c: Partial<Res>) {
  return RES_KEYS.filter((k) => c[k]).map((k) => `${RES_META[k].icon}${c[k]}`).join(' ');
}

// ---------------- Title ----------------
export function Title(props: { save: SaveData; onPlay: () => void; onTutorial: () => void; onDark: () => void; onHelp: () => void; onSettings: () => void }) {
  const { save } = props;
  return (
    <div className="title-bg absolute inset-0 overflow-auto scroll flex flex-col items-center justify-center p-4 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {['💀', '🦴', '👻', '⚰️', '🕯️', '🧟', '🪦', '🌙'].map((e, i) => (
          <div key={i} className="absolute anim-float opacity-20 text-4xl sm:text-6xl" style={{ left: `${8 + i * 12}%`, top: `${10 + ((i * 37) % 70)}%`, animationDelay: `${i * 0.7}s` }}>{e}</div>
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2 max-w-xl w-full">
        <div className="text-6xl anim-flicker">🪦</div>
        <h1 className="font-title text-4xl sm:text-6xl font-black text-[#e8e2cf] drop-shadow-[0_0_24px_rgba(183,140,255,0.7)] leading-tight">Graveyard Shift<br /><span className="text-[#b78cff]">Necropolis</span></h1>
        <p className="text-stone-400 max-w-md mt-1">Run an undead workforce around the clock. Schedule the shifts, feed the resource chains, and hold your haunted ground against zealots and rival necromancers.</p>
        <div className="grid gap-2 mt-5 w-full max-w-xs">
          <button className="btn btn-primary text-base py-3" onClick={props.onPlay}>⚰️ New Run</button>
          <button className="btn btn-teal" onClick={props.onTutorial}>📖 Interactive Tutorial</button>
          <button className="btn" onClick={props.onDark}>🔮 Dark Arts <span className="chip">💠 {save.shards}</span></button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={props.onHelp}>❓ How to Play</button>
            <button className="btn" onClick={props.onSettings}>⚙️ Settings</button>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4 text-xs text-stone-400">
          <span className="chip">Runs {save.runs}</span><span className="chip">Victories {save.wins}</span>
          <span className="chip">Best day {save.bestDay}</span><span className="chip">Raiders slain {save.totalKills}</span><span className="chip">Bosses {save.bosses}</span>
        </div>
        {!save.settings.tutorialSeen && <p className="text-xs text-[#7fe3d4] mt-1 anim-flicker">First time? Try the interactive tutorial.</p>}
      </div>
    </div>
  );
}

// ---------------- Run setup ----------------
export function Setup(props: { save: SaveData; diffId: string; mods: string[]; setDiff: (id: string) => void; toggleMod: (id: string) => void; onStart: () => void; onBack: () => void }) {
  const diff = DIFFICULTIES.find((d) => d.id === props.diffId) || DIFFICULTIES[1];
  const mult = diff.shards * (1 + props.mods.reduce((a, id) => a + (MODIFIERS.find((m) => m.id === id)?.shards || 0), 0));
  return (
    <div className="title-bg absolute inset-0 overflow-auto scroll p-4 flex items-start sm:items-center justify-center">
      <div className="panel anim-up p-5 w-full max-w-3xl">
        <h2 className="font-title text-3xl font-bold text-[#b78cff]">Prepare the Necropolis</h2>
        <p className="text-sm text-stone-400 mb-3">Choose a difficulty and optional curses. Harder runs reward more Soul Shards.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} onClick={() => { audio.sfx('click'); props.setDiff(d.id); }} className={`text-left p-3 rounded-xl border transition ${props.diffId === d.id ? 'bg-white/10 scale-[1.02]' : 'bg-white/5 hover:bg-white/10'}`} style={{ borderColor: props.diffId === d.id ? d.color : 'rgba(255,255,255,0.1)' }}>
              <div className="font-title text-lg font-bold" style={{ color: d.color }}>{d.name}</div>
              <div className="text-xs text-stone-300 mt-1">{d.desc}</div>
              <div className="text-[11px] text-stone-500 mt-2">Raids ×{d.raid} · Foe HP ×{d.hp} · Shards ×{d.shards}</div>
            </button>
          ))}
        </div>
        <h3 className="font-title text-lg mt-4 mb-2 text-stone-300">Modifiers</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {MODIFIERS.map((m) => {
            const on = props.mods.includes(m.id);
            return (
              <button key={m.id} onClick={() => { audio.sfx('click'); props.toggleMod(m.id); }} className={`text-left p-2.5 rounded-lg border flex gap-2 items-start transition ${on ? 'bg-[#b78cff]/20 border-[#b78cff]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                <span className="text-xl">{m.icon}</span>
                <span><span className="font-semibold text-sm">{m.name} <span className="text-[#7fe3d4] text-xs">+{Math.round(m.shards * 100)}% shards</span></span><br /><span className="text-xs text-stone-400">{m.desc}</span></span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
          <span className="chip text-sm">💠 Shard multiplier ×{mult.toFixed(2)}</span>
          <div className="flex gap-2">
            <button className="btn" onClick={props.onBack}>← Back</button>
            <button className="btn btn-primary" onClick={props.onStart}>Raise the Necropolis ⚰️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Dark Arts ----------------
export function DarkArts(props: { save: SaveData; onBuy: (id: string) => void; onBack: () => void }) {
  const { save } = props;
  return (
    <div className="title-bg absolute inset-0 overflow-auto scroll p-4 flex items-start justify-center">
      <div className="panel anim-up p-5 w-full max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-title text-3xl font-bold text-[#b78cff]">Dark Arts</h2>
            <p className="text-sm text-stone-400">Spend Soul Shards, earned at the end of every run, on permanent boons. Saved in your browser.</p>
          </div>
          <div className="flex items-center gap-2"><span className="chip text-base">💠 {save.shards}</span><button className="btn" onClick={props.onBack}>← Back</button></div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {UPGRADES.map((u) => {
            const lvl = save.upgrades[u.id] || 0;
            const maxed = lvl >= u.max;
            const req = u.requires && !(save.upgrades[u.requires] > 0);
            const cost = u.cost[Math.min(lvl, u.max - 1)];
            const can = !maxed && !req && save.shards >= cost;
            return (
              <div key={u.id} className={`p-3 rounded-xl border bg-white/5 flex flex-col gap-1 ${maxed ? 'border-[#7fe3d4]/60' : 'border-white/10'}`}>
                <div className="flex items-center gap-2"><span className="text-2xl">{u.icon}</span><span className="font-semibold">{u.name}</span></div>
                <p className="text-xs text-stone-400 flex-1">{u.desc}</p>
                {req && <p className="text-[11px] text-[#ff9a6b]">Requires {UPGRADES.find((x) => x.id === u.requires)?.name}</p>}
                <div className="flex items-center justify-between mt-1">
                  <div className="flex gap-1">{Array.from({ length: u.max }).map((_, i) => <span key={i} className={`w-3 h-3 rounded-full ${i < lvl ? 'bg-[#7fe3d4]' : 'bg-white/15'}`} />)}</div>
                  <button className={`btn btn-sm ${can ? 'btn-primary' : ''}`} disabled={!can} onClick={() => props.onBuy(u.id)}>{maxed ? 'Mastered' : `💠 ${cost}`}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Help ----------------
export function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('basics');
  const tabs = [['basics', 'Basics'], ['systems', 'Systems'], ['units', 'Undead & Buildings'], ['foes', 'Foes'], ['controls', 'Controls']];
  const Key = ({ k }: { k: string }) => <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-xs font-mono">{k}</kbd>;
  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-title text-2xl font-bold text-[#b78cff]">How to Play</h2>
        <button className="btn btn-sm" onClick={onClose}>✕ Close</button>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">{tabs.map(([id, n]) => <button key={id} className={`btn btn-sm ${tab === id ? 'btn-primary' : ''}`} onClick={() => setTab(id)}>{n}</button>)}</div>
      <div className="text-sm text-stone-300 space-y-3 leading-relaxed">
        {tab === 'basics' && (<>
          <p><b>Goal:</b> keep the <b>Mausoleum 🏛️</b> standing until the final day, then destroy both bosses — the Sun Inquisitor (day) and the Archlich (night). Lose the Mausoleum and the Necropolis falls.</p>
          <p><b>Resource chain:</b> ⚒️ Gravedigger → ⚰️ Corpses → ⚙️ Mill → 🦴 Bones, or 🔮 Altar → 👻 Souls + 🧪 Ectoplasm. Sell goods (🪚 Carver, 🏺 Embalmer) for 🪙 Coin. Bones & Coin build everything; Souls fuel rites, wards and better undead.</p>
          <p><b>Workers:</b> undead auto-assign to buildings with free slots, matching species skill. Select a worker and click a building to <i>pin</i> them there. Buildings with a ⚠ bubble are stalled (missing input, ammo, crew).</p>
          <p><b>Shifts:</b> every worker is on Dayside ☀️, Nightside 🌙 or Round-the-clock ⏳. Off-shift undead return to Crypts to recover Integrity and Morale. Round-the-clock output is constant but wear and sourness are far faster.</p>
          <p><b>Raids:</b> Zealots attack at midday, when they are strongest. Rival necromancers raid after dusk. Warning markers show the approach edge ~9 seconds ahead. Raid size grows with the day and with your <b>Infamy</b>.</p>
        </>)}
        {tab === 'systems' && (<>
          <p><b>🌗 Day/Night:</b> Zombies, ghouls and wraiths lose efficiency in sunlight; wraiths barely exist by day but are twice as good at night. Skeletons and golems are indifferent. Eclipse and the Inquisitor's Radiance bend the sun.</p>
          <p><b>🩻 Integrity:</b> work wears undead down. Below 20 they stop and retreat to rest until 70. Combat damage uses the same bar — at 0 they are destroyed forever, and the survivors lose Morale.</p>
          <p><b>😠 Morale:</b> boosts output up to +20%. Falls with work (fast on Round-the-clock), deaths and enemy curses. Rises in crypts, near a staffed Dirge Hall and on haunted ground. Under 8 the worker goes on strike.</p>
          <p><b>🕯️ Haunted sites:</b> buildings on them work 40% faster and workers there gain morale. Priests consecrate them (7 s unopposed) — kill priests or cover the site with a Ward Obelisk. Click a consecrated site to re-haunt it for 5 Souls.</p>
          <p><b>📣 Infamy:</b> raising the dead and selling goods raises it; it slowly decays. Higher Infamy means bigger raids and, above 75, an extra Paladin. Bribe the Bishop (B) for 80 🪙 to cut it.</p>
          <p><b>👻 Rival necromancers</b> siphon Souls, Corpses and Ectoplasm from your stockpile (recovered when they die) and curse morale. Souls in stock also attract bigger rival raids.</p>
          <p><b>🛡️ Armour:</b> Paladins and bosses shrug off physical bolts. Wards, Bone Storm, wraiths and the Mausoleum bolt deal armour-piercing necrotic damage.</p>
        </>)}
        {tab === 'units' && (<>
          <div className="grid sm:grid-cols-2 gap-2">
            {SPECIES_ORDER.map((id) => { const s = SPECIES[id]; return <div key={id} className="p-2 rounded-lg bg-white/5"><b>{s.icon} {s.name}</b> <span className="text-xs text-stone-500">{costText(s.cost)}</span><br /><span className="text-xs">{s.desc} Day ×{s.day} · Night ×{s.night}</span></div>; })}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {BUILD_ORDER.map((id) => { const b = BUILDINGS[id]; return <div key={id} className="p-2 rounded-lg bg-white/5"><b>{b.icon} {b.name}</b> <span className="text-xs text-stone-500">{costText(b.cost)}</span><br /><span className="text-xs">{b.desc}</span></div>; })}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SPELLS.map((s) => <div key={s.id} className="p-2 rounded-lg bg-white/5"><b>{s.icon} {s.name}</b> <kbd className="text-xs">{s.key.toUpperCase()}</kbd> <span className="text-xs text-stone-500">{costText(s.cost)}</span><br /><span className="text-xs">{s.desc}</span></div>)}
          </div>
        </>)}
        {tab === 'foes' && (
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.values(ENEMIES).map((e) => <div key={e.id} className="p-2 rounded-lg bg-white/5"><b>{e.icon} {e.name}</b> <span className="text-xs" style={{ color: e.team === 'zealot' ? '#ffd36b' : '#7bff9e' }}>{e.team}</span><br /><span className="text-xs">{e.desc} HP {e.hp}{e.boss ? ' (boss)' : ''}</span></div>)}
          </div>
        )}
        {tab === 'controls' && (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            <div><Key k="Left click" /> select / place / pin worker to building</div>
            <div><Key k="Right click" /> or <Key k="Esc" /> cancel tool, selection</div>
            <div><Key k="1"/>–<Key k="0"/> <Key k="-"/> <Key k="="/> choose building</div>
            <div><Key k="X" /> demolish tool (50% refund)</div>
            <div><Key k="Q" /> <Key k="W" /> <Key k="E" /> <Key k="R" /> cast rites (press again to cast at cursor)</div>
            <div><Key k="B" /> bribe the bishop</div>
            <div><Key k="Space" /> pause / resume</div>
            <div><Key k="Tab" /> cycle game speed</div>
            <div><Key k="M" /> mute</div>
            <div><Key k="H" /> this help</div>
            <div><b>Touch:</b> tap to select/place, use the on-screen buttons for everything else.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Settings ----------------
export function SettingsPanel({ save, onChange, onClose }: { save: SaveData; onChange: (s: SaveData) => void; onClose: () => void }) {
  const s = save.settings;
  const set = (p: Partial<SaveData['settings']>) => {
    const next = { ...save, settings: { ...s, ...p } };
    audio.setVolumes({ master: next.settings.master, music: next.settings.music, sfx: next.settings.sfx, muted: next.settings.muted });
    onChange(next);
  };
  const row = (label: string, k: 'master' | 'music' | 'sfx') => (
    <label className="block text-sm" key={k}>{label} <span className="text-stone-500">{Math.round(s[k] * 100)}%</span>
      <input type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => { set({ [k]: parseFloat(e.target.value) } as Partial<SaveData['settings']>); }} onPointerUp={() => audio.sfx('click')} />
    </label>
  );
  return (
    <Modal onClose={onClose}>
      <h2 className="font-title text-2xl font-bold text-[#b78cff] mb-3">Settings</h2>
      <div className="space-y-3">
        {row('Master volume', 'master')}{row('Music', 'music')}{row('Sound effects', 'sfx')}
        <div className="flex gap-2 flex-wrap">
          <button className={`btn ${s.muted ? 'btn-danger' : ''}`} onClick={() => set({ muted: !s.muted })}>{s.muted ? '🔇 Muted' : '🔊 Sound on'}</button>
          <button className="btn" onClick={() => set({ shake: !s.shake })}>{s.shake ? '📳 Screen shake: on' : '📳 Screen shake: off'}</button>
        </div>
        <p className="text-xs text-stone-500">Difficulty and modifiers are chosen when a run begins (New Run). Settings are saved automatically.</p>
      </div>
      <div className="mt-4 text-right"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

// ---------------- End screen ----------------
export function EndScreen(props: { won: boolean; result: RunResult; goal: number; endless: boolean; onContinue: () => void; onRetry: () => void; onDark: () => void; onTitle: () => void; tutorial: boolean }) {
  const r = props.result;
  const mm = Math.floor(r.time / 60), ss = Math.floor(r.time % 60).toString().padStart(2, '0');
  const rows: [string, string | number][] = [
    ['Days survived', r.days], ['Time played', `${mm}:${ss}`], ['Zealots slain', r.zealots], ['Rivals banished', r.rivals], ['Bosses felled', r.bosses],
    ['Undead raised', r.raised], ['Undead destroyed', r.lost], ['Buildings raised', r.built], ['Coin earned', r.coin], ['Corpses dug', r.corpses],
    ['Workers collapsed', r.collapsed], ['Sites consecrated', r.sites], ['Rites cast', r.spells], ['Peak infamy', r.peakInfamy],
  ];
  return (
    <Modal wide>
      <div className="text-center">
        <div className="text-6xl">{props.won ? '👑' : '☠️'}</div>
        <h2 className={`font-title text-4xl font-black mt-1 ${props.won ? 'text-[#f2c14e]' : 'text-[#ff6b81]'}`}>{props.won ? 'The Necropolis Endures' : 'The Dead Are Laid to Rest'}</h2>
        <p className="text-stone-400 text-sm mt-1">{props.won ? 'Both the Sun Inquisitor and the Archlich lie broken. Your workforce works eternal.' : 'The Mausoleum has fallen. Zealots and rivals pick over the bones.'}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {rows.map(([k, v]) => <div key={k} className="p-2 rounded-lg bg-white/5 text-center"><div className="text-lg font-bold">{v}</div><div className="text-[11px] text-stone-400">{k}</div></div>)}
      </div>
      <div className="mt-3 text-center"><span className="chip text-base">💠 +{r.shards} Soul Shards earned{props.tutorial ? ' (tutorial cap)' : ''}</span></div>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {props.won && !props.endless && <button className="btn btn-primary" onClick={props.onContinue}>♾️ Continue (Endless)</button>}
        <button className={`btn ${props.won ? '' : 'btn-primary'}`} onClick={props.onRetry}>🔁 {props.won ? 'New run (same settings)' : 'Retry'}</button>
        <button className="btn" onClick={props.onDark}>🔮 Dark Arts</button>
        <button className="btn" onClick={props.onTitle}>🏠 Title</button>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ADVS, ADV_POOL, DIFFICULTIES, MODIFIERS, MONSTERS, SPELLS, STRUCTS, STRUCT_ORDER, UPGRADES, MAX_WAVES } from './data';
import type { MonsterType } from './data';
import { sound } from './audio';
import type { Save } from './storage';

export type SaveUpdater = (fn: (s: Save) => Save) => void;

export function Modal({ children, onClose, wide, title }: { children: ReactNode; onClose?: () => void; wide?: boolean; title?: string }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
      <div className={`panel pop relative max-h-full overflow-y-auto w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} p-4 sm:p-6`}>
        {title && <h2 className="font-display text-2xl sm:text-3xl text-amber-300 mb-3 text-center">{title}</h2>}
        {onClose && (
          <button className="btn absolute top-2 right-2 !px-2 !py-0.5" onClick={() => { sound.sfx('click'); onClose(); }} aria-label="Close">✕</button>
        )}
        {children}
      </div>
    </div>
  );
}

/* ───────────── Settings ───────────── */
export function SettingsPanel({ save, updateSave, onDifficulty }: { save: Save; updateSave: SaveUpdater; onDifficulty?: (id: string) => void }) {
  const s = save.settings;
  const set = (patch: Partial<Save['settings']>) => {
    updateSave((v) => ({ ...v, settings: { ...v.settings, ...patch } }));
  };
  const Slider = ({ label, k }: { label: string; k: 'master' | 'sfx' | 'music' }) => (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-amber-100">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[k]} onChange={(e) => set({ [k]: parseFloat(e.target.value) } as Partial<Save['settings']>)} className="flex-1" />
      <span className="w-10 text-right text-xs text-purple-200">{Math.round(s[k] * 100)}%</span>
    </label>
  );
  return (
    <div className="space-y-3">
      <button className={`btn w-full ${s.muted ? 'btn-red' : ''}`} onClick={() => { set({ muted: !s.muted }); }}>
        {s.muted ? '🔇 Muted — click to unmute' : '🔊 Sound on — click to mute'}
      </button>
      <Slider label="Master" k="master" />
      <Slider label="Effects" k="sfx" />
      <Slider label="Music" k="music" />
      <label className="flex items-center gap-3 text-sm">
        <span className="w-24 text-amber-100">Screen shake</span>
        <input type="range" min={0} max={1.5} step={0.1} value={s.shake} onChange={(e) => set({ shake: parseFloat(e.target.value) })} className="flex-1" />
        <span className="w-10 text-right text-xs text-purple-200">{Math.round(s.shake * 100)}%</span>
      </label>
      <div>
        <div className="text-sm text-amber-100 mb-1">Difficulty {onDifficulty ? '(applies immediately)' : '(for new runs)'}</div>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} className={`btn !px-1 !py-2 text-xs ${s.difficulty === d.id ? 'btn-gold' : ''}`} onClick={() => { set({ difficulty: d.id }); onDifficulty?.(d.id); }}>
              <div className="text-lg">{d.icon}</div>
              {d.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Help ───────────── */
const TABS = ['Goal', 'Building', 'Heroes', 'Systems', 'Controls'] as const;
export function HelpPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Goal');
  return (
    <div>
      <div className="flex flex-wrap gap-1 justify-center mb-3">
        {TABS.map((t) => (
          <button key={t} className={`btn !py-1 !px-3 text-sm ${tab === t ? 'btn-gold' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="text-sm leading-relaxed text-purple-100 space-y-2">
        {tab === 'Goal' && (
          <>
            <p>You are the <b className="text-amber-300">Dungeon Lord</b>. Heroes pour in from the <b>Entrance</b> (left) and march toward your <b className="text-pink-300">Dungeon Heart</b> (right). If the Heart's HP hits zero, you lose.</p>
            <p>Survive <b>{MAX_WAVES} waves</b>. Waves <b>4, 8 and 12</b> are boss waves: Sir Aldric, Archmage Vexara and finally the Hero of Dawn. After victory you may continue into Endless mode.</p>
            <p><b>Each wave has two phases:</b></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Prep</b> — dig tunnels, place traps, lairs and economy buildings. Check the scouting report for the incoming party. Press <kbd>Space</kbd> to start the raid.</li>
              <li><b>Raid</b> — heroes fight in real time. Cast spells, repair, rebuild (at +50% cost) and watch the morale meter. After each wave you choose a permanent <b>Edict</b>.</li>
            </ul>
            <p>Souls earned in each run are spent in the <b>Ledger</b> (main menu) on permanent upgrades and unlocks that persist between runs.</p>
          </>
        )}
        {tab === 'Building' && (
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2">Dig (<kbd>D</kbd>) rock next to existing tunnels — the dashed gold line shows the route heroes will take. Longer routes keep them under fire. Fill (<kbd>F</kbd>) tunnels you dug (never cut off the Heart). Inspect (<kbd>V</kbd>) a structure to <b>upgrade</b> (up to Lv 3) or <b>sell</b> (60% refund).</div>
            {STRUCT_ORDER.map((id) => {
              const d = STRUCTS[id];
              return (
                <div key={id} className="flex gap-2 bg-black/25 rounded p-2">
                  <div className="text-2xl">{d.icon}</div>
                  <div>
                    <div className="font-bold text-amber-200">{d.name} <span className="text-xs text-amber-400">{d.cost}g · [{d.key.toUpperCase()}]</span></div>
                    <div className="text-xs">{d.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'Heroes' && (
          <div className="grid sm:grid-cols-2 gap-2">
            {[...ADV_POOL, 'aldric', 'vexara', 'hero'].map((id) => {
              const d = ADVS[id as keyof typeof ADVS];
              return (
                <div key={id} className="flex gap-2 bg-black/25 rounded p-2">
                  <div className="text-2xl">{d.icon}</div>
                  <div>
                    <div className="font-bold" style={{ color: d.color }}>{d.name} {d.boss && <span className="text-xs text-red-300">BOSS</span>}</div>
                    <div className="text-xs">HP {d.hp} · DMG {d.dmg} · Greed {Math.round(d.greed * 100)}% — {d.desc}</div>
                  </div>
                </div>
              );
            })}
            <div className="sm:col-span-2 text-xs text-purple-300">Your monsters: {(Object.keys(MONSTERS) as MonsterType[]).map((k) => `${MONSTERS[k].icon} ${MONSTERS[k].name}`).join(' · ')}</div>
          </div>
        )}
        {tab === 'Systems' && (
          <ul className="space-y-2">
            <li>🔷 <b>Mana economy</b> — regenerates constantly (more with Mana Wells). Traps cost mana to rearm, lairs cost mana to hatch & respawn monsters, and spells cost mana. Run dry and your dungeon goes quiet.</li>
            <li>🤑 <b>Loot greed</b> — heroes detour to Treasure Caches within a reach set by their greed. Hoarders grab loot and flee for the exit; kill them and the gold is yours again, let them escape and it's gone. Use caches as bait to pull parties through trap gauntlets.</li>
            <li>🏳️ <b>Morale</b> — the party shares a morale meter. Deaths, traps, curses, wraiths and Terrify erode it; clerics and paladins restore/shield it. Below 25 the party breaks and runs (bosses never flee). Fleeing heroes that survive return next wave as <b>veterans ★</b> with +20% power each.</li>
            <li>👑 <b>Dungeon reputation</b> — climbs as you slay heroes and fall when they escape. Higher reputation means bigger, tougher parties and elite classes arriving sooner — but richer bounties and parties that start the raid frightened.</li>
            <li>📜 <b>Edicts</b> — after each wave pick one of three permanent run-wide modifiers. Combine them for powerful synergies.</li>
            <li>✦ <b>Souls & the Ledger</b> — banked at the end of each run (win, lose or abandon) and spent on permanent upgrades and unlocks. Harder difficulties and modifiers multiply souls.</li>
            <li>Spells: {SPELLS.map((s) => `${s.icon} ${s.name}`).join(' · ')}</li>
          </ul>
        )}
        {tab === 'Controls' && (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm">
            {[
              ['Left click / tap', 'Use current tool / cast spell'],
              ['Click + drag', 'Dig or build across several tiles'],
              ['Right click / Esc', 'Cancel tool, spell or selection'],
              ['Space / Enter', 'Start raid'],
              ['P / Esc (idle)', 'Pause menu'],
              ['X', 'Cycle game speed 1× / 2× / 3×'],
              ['D / F / V', 'Dig / Fill / Inspect'],
              ['U', 'Upgrade selected structure'],
              ['Delete / Backspace', 'Sell selected structure'],
              ['1 2 3 4', 'Cast spells (then click target)'],
              ...STRUCT_ORDER.map((id) => [STRUCTS[id].key.toUpperCase(), STRUCTS[id].name]),
            ].map(([k, v]) => (
              <div key={k + v} className="flex justify-between gap-2 border-b border-white/5 py-0.5"><kbd className="text-amber-300">{k}</kbd><span className="text-right">{v}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Ledger ───────────── */
export function LedgerPanel({ save, updateSave, onReset }: { save: Save; updateSave: SaveUpdater; onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const buy = (id: string, cost: number) => {
    updateSave((s) => {
      const lv = s.levels[id] || 0;
      if (s.souls < cost) return s;
      return { ...s, souls: s.souls - cost, levels: { ...s.levels, [id]: lv + 1 } };
    });
    sound.sfx('upgrade');
  };
  const groups = ['Vitality', 'Arcana', 'Craft', 'Unlocks'] as const;
  return (
    <div>
      <div className="text-center mb-3">
        <span className="text-2xl font-bold text-purple-200">✦ {save.souls}</span> <span className="text-sm text-purple-300">souls to spend</span>
      </div>
      {groups.map((g) => (
        <div key={g} className="mb-3">
          <div className="font-display text-amber-300 border-b border-amber-300/20 mb-2">{g}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {UPGRADES.filter((u) => u.group === g).map((u) => {
              const lv = save.levels[u.id] || 0;
              const max = u.costs.length;
              const cost = u.costs[lv];
              const can = lv < max && save.souls >= cost;
              return (
                <div key={u.id} className="bg-black/30 rounded-lg p-2 flex gap-2 items-center border border-white/5">
                  <div className="text-3xl">{u.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-amber-100 text-sm">{u.name} {max > 1 && <span className="text-xs text-purple-300">Lv {lv}/{max}</span>}</div>
                    <div className="text-xs text-purple-200">{u.desc}</div>
                  </div>
                  {lv >= max ? (
                    <div className="text-xs text-green-300 font-bold">{max > 1 ? 'MAX' : 'OWNED'}</div>
                  ) : (
                    <button className={`btn !px-2 !py-1 text-xs ${can ? 'btn-gold' : ''}`} disabled={!can} onClick={() => buy(u.id, cost)}>✦ {cost}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="text-xs text-purple-300 grid grid-cols-2 sm:grid-cols-5 gap-1 text-center mt-2">
        <div>Runs<br /><b className="text-amber-200">{save.lifetime.runs}</b></div>
        <div>Victories<br /><b className="text-amber-200">{save.lifetime.wins}</b></div>
        <div>Heroes slain<br /><b className="text-amber-200">{save.lifetime.kills}</b></div>
        <div>Bosses felled<br /><b className="text-amber-200">{save.lifetime.bosses}</b></div>
        <div>Best wave<br /><b className="text-amber-200">{save.lifetime.bestWave}</b></div>
      </div>
      <div className="text-center mt-3">
        {confirm ? (
          <span className="space-x-2">
            <span className="text-sm text-red-300">Erase all progress?</span>
            <button className="btn btn-red !py-1" onClick={() => { onReset(); setConfirm(false); }}>Yes, erase</button>
            <button className="btn !py-1" onClick={() => setConfirm(false)}>Cancel</button>
          </span>
        ) : (
          <button className="btn !py-1 text-xs" onClick={() => setConfirm(true)}>Reset progress</button>
        )}
      </div>
    </div>
  );
}

/* ───────────── Run setup ───────────── */
export function SetupPanel({ save, updateSave, onStart }: { save: Save; updateSave: SaveUpdater; onStart: (diffId: string, mods: string[], tutorial: boolean) => void }) {
  const [diff, setDiff] = useState(save.settings.difficulty);
  const [mods, setMods] = useState<string[]>(save.settings.mods);
  const [tut, setTut] = useState(!save.tutorialDone);
  const d = DIFFICULTIES.find((x) => x.id === diff) || DIFFICULTIES[1];
  const mult = d.souls * (1 + mods.reduce((a, id) => a + (MODIFIERS.find((m) => m.id === id)?.souls || 0), 0));
  return (
    <div className="space-y-4">
      <div>
        <div className="font-display text-amber-300 mb-1">Difficulty</div>
        <div className="grid sm:grid-cols-3 gap-2">
          {DIFFICULTIES.map((x) => (
            <button key={x.id} className={`btn text-left !p-3 ${diff === x.id ? 'btn-gold' : ''}`} onClick={() => { setDiff(x.id); sound.sfx('click'); }}>
              <div className="text-2xl">{x.icon}</div>
              <div className="font-bold">{x.name}</div>
              <div className={`text-xs font-normal ${diff === x.id ? 'text-amber-950' : 'text-purple-200'}`}>{x.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-display text-amber-300 mb-1">Modifiers <span className="text-xs text-purple-300">(more souls, more danger)</span></div>
        <div className="grid sm:grid-cols-2 gap-2">
          {MODIFIERS.map((m) => {
            const on = mods.includes(m.id);
            return (
              <button key={m.id} className={`btn text-left flex gap-2 items-center !p-2 ${on ? 'btn-gold' : ''}`} onClick={() => { setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id]); sound.sfx('click'); }}>
                <span className="text-2xl">{m.icon}</span>
                <span>
                  <div className="font-bold text-sm">{m.name} <span className="text-xs">+{Math.round(m.souls * 100)}% souls</span></div>
                  <div className={`text-xs font-normal ${on ? 'text-amber-950' : 'text-purple-200'}`}>{m.desc}</div>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={tut} onChange={(e) => setTut(e.target.checked)} />
        <span>Show the interactive tutorial (extra starting gold)</span>
      </label>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-purple-200">Soul multiplier: <b className="text-amber-300">×{mult.toFixed(2)}</b></div>
        <button
          className="btn btn-gold text-lg !px-8"
          onClick={() => {
            updateSave((s) => ({ ...s, settings: { ...s.settings, difficulty: diff, mods } }));
            onStart(diff, mods, tut);
          }}
        >
          ⚔️ Begin the Descent
        </button>
      </div>
    </div>
  );
}

/* ───────────── Title ───────────── */
export function TitleScreen({ save, go }: { save: Save; go: (s: 'setup' | 'ledger' | 'help' | 'settings') => void }) {
  const floaters = ['👺', '💀', '🟢', '😈', '🗿', '👻', '💰', '🔥', '📌', '🧙', '⚔️', '🛡️'];
  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 30%, #3a1850 0%, #140b22 55%, #07040c 100%)' }}>
      {floaters.map((f, i) => (
        <div
          key={i}
          className="absolute text-4xl sm:text-6xl opacity-20 pointer-events-none"
          style={{ left: `${(i * 83) % 95}%`, top: `${(i * 37) % 85}%`, animation: `pulseGlow ${3 + (i % 4)}s ease-in-out infinite`, filter: 'blur(1px)', boxShadow: 'none' }}
        >
          {f}
        </div>
      ))}
      <div className="relative z-10 text-center p-4 fadeup w-full max-w-md">
        <div className="text-6xl sm:text-7xl mb-1 flicker">🏰</div>
        <h1 className="font-display text-4xl sm:text-6xl font-black text-amber-300" style={{ textShadow: '0 0 30px rgba(244,196,83,.5), 0 4px 0 #6b3b00' }}>
          Dungeon Lord's Ledger
        </h1>
        <div className="text-purple-200 mb-6 italic">Build the dungeon. Bait the heroes. Balance the books.</div>
        <div className="flex flex-col gap-2">
          <button className="btn btn-gold text-xl !py-3" onClick={() => { sound.init(); sound.sfx('click'); go('setup'); }}>⚔️ New Run</button>
          <button className="btn !py-2" onClick={() => { sound.init(); sound.sfx('click'); go('ledger'); }}>📖 The Ledger <span className="text-purple-300">(✦ {save.souls})</span></button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => { sound.init(); sound.sfx('click'); go('help'); }}>❓ How to Play</button>
            <button className="btn" onClick={() => { sound.init(); sound.sfx('click'); go('settings'); }}>⚙️ Settings</button>
          </div>
        </div>
        <div className="mt-5 text-xs text-purple-300">
          Runs {save.lifetime.runs} · Victories {save.lifetime.wins} · Best wave {save.lifetime.bestWave}/{MAX_WAVES}
        </div>
      </div>
    </div>
  );
}

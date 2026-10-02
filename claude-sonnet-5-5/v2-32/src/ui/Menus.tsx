import { useState } from 'react';
import {
  DIFFS, ENEMIES, INST, INST_ORDER, LEVELS, MODS, UNLOCKS, UPGRADES, upgCost, BOSSES, REGULAR,
} from '../game/data';
import type { EnemyId, InstId } from '../game/data';
import { audio } from '../game/audio';
import { persist, wipeSave } from '../game/save';
import type { SaveData } from '../game/save';
import type { Game, RunResult, Snapshot } from '../game/engine';

export const ENEMY_ICON: Record<EnemyId, string> = {
  screecher: '♯', drone: '⚡', brute: '🛡️', mute: '🤫', syncopator: '🌀', metronome: '⏱️', echo: '👥',
  howler: '📢', colossus: '🗿', tyrant: '⏲️', choir: '🎭', cacophony: '💀',
};

export function applyAudio(save: SaveData) {
  const s = save.settings;
  audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
}

function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="tracking-widest">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-300' : 'text-white/20'}>★</span>
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ Title
export function TitleScreen({ save, onPlay, onTutorial, onHelp, onSettings, onToggleMute }: {
  save: SaveData; onPlay: () => void; onTutorial: () => void; onHelp: () => void; onSettings: () => void; onToggleMute: () => void;
}) {
  const clears = Object.keys(save.cleared).length;
  return (
    <div className="relative h-full w-full overflow-hidden flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#14222f_0%,#070d13_70%)]">
      <svg className="absolute -left-24 -top-24 w-[420px] h-[420px] opacity-10 spin-slow" viewBox="0 0 100 100"><GearShape /></svg>
      <svg className="absolute -right-32 bottom-[-120px] w-[560px] h-[560px] opacity-10 spin-rev" viewBox="0 0 100 100"><GearShape /></svg>
      <svg className="absolute left-[12%] bottom-[8%] w-40 h-40 opacity-10 spin-rev" viewBox="0 0 100 100"><GearShape /></svg>
      {['♪', '♫', '♩', '♬', '♪', '♫'].map((n, i) => (
        <span key={i} className="absolute floaty text-amber-300/30 text-4xl select-none" style={{ left: `${8 + i * 16}%`, top: `${15 + ((i * 23) % 60)}%`, animationDelay: `${i * 0.7}s` }}>{n}</span>
      ))}
      <div className="relative z-10 text-center px-4 pop-in max-h-full overflow-y-auto py-6">
        <div className="text-amber-200/70 tracking-[0.5em] text-xs sm:text-sm uppercase mb-2">A clockwork rhythm defence</div>
        <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl leading-tight shimmer-text drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]">
          Orchestra<br />of Automata
        </h1>
        <p className="mt-3 text-sm sm:text-base text-amber-100/70 max-w-xl mx-auto">
          Compose music for brass-and-gear musicians. Every note you write becomes an attack. Conduct on the beat and drown out the Discord.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 w-64 mx-auto">
          <button className="btn w-full text-lg py-3" onClick={onPlay}>🎼 Begin the Concert</button>
          <button className="btn btn-ghost w-full" onClick={onTutorial}>
            🎓 Rehearsal (Tutorial){!save.tutorialDone && <span className="chip !bg-amber-300/20 text-amber-200">start here</span>}
          </button>
          <button className="btn btn-ghost w-full" onClick={onHelp}>📖 How to Play & Controls</button>
          <div className="flex gap-3 w-full">
            <button className="btn btn-ghost flex-1" onClick={onSettings}>⚙️ Settings</button>
            <button className="btn btn-ghost" onClick={onToggleMute} aria-label="Toggle mute">{save.settings.muted ? '🔇' : '🔊'}</button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
          <span className="chip">🎵 Opus: {save.opus}</span>
          <span className="chip">Movements cleared: {clears}/5</span>
          <span className="chip">Best combo: {save.best.combo}</span>
          {save.best.encoreWave > 0 && <span className="chip">Encore best: wave {save.best.encoreWave}</span>}
        </div>
      </div>
    </div>
  );
}

function GearShape() {
  const pts: string[] = [];
  const n = 12;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 38 : 48;
    const a = (i * Math.PI) / n;
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
  }
  return (
    <g fill="none" stroke="#d4a24c" strokeWidth="2">
      <polygon points={pts.join(' ')} />
      <circle cx="50" cy="50" r="18" />
      <circle cx="50" cy="50" r="6" />
    </g>
  );
}

// ------------------------------------------------------------------ Conservatory
export function Conservatory({ save, refresh, onStart, onTitle, onTutorial, onSettings }: {
  save: SaveData; refresh: () => void; onStart: (levelId: number, diff: string, mods: string[]) => void;
  onTitle: () => void; onTutorial: () => void; onSettings: () => void;
}) {
  const [tab, setTab] = useState<'campaign' | 'workshop'>('campaign');
  const firstOpen = (() => {
    for (let i = 0; i < 5; i++) if (!save.cleared[String(i)]) return i;
    return 5;
  })();
  const [sel, setSel] = useState(firstOpen);
  const s = save.settings;
  const unlocked = (id: number) => id === 0 || (id === 5 ? !!save.cleared['4'] : !!save.cleared[String(id - 1)]);
  const lv = LEVELS[sel];
  const modBonus = s.mods.reduce((a, id) => a + (MODS.find((m) => m.id === id)?.bonus ?? 0), 0);
  const diff = DIFFS.find((d) => d.id === s.difficulty) ?? DIFFS[1];

  const setDiff = (id: string) => { s.difficulty = id; persist(save); audio.sfx('click'); refresh(); };
  const toggleMod = (id: string) => {
    s.mods = s.mods.includes(id) ? s.mods.filter((m) => m !== id) : [...s.mods, id];
    persist(save); audio.sfx('click'); refresh();
  };
  const buy = (id: string, max: number, cost: number) => {
    const lvl = save.upg[id] || 0;
    if (lvl >= max || save.opus < cost) { audio.sfx('deny'); return; }
    save.opus -= cost;
    save.upg[id] = lvl + 1;
    persist(save); audio.sfx('upgrade'); refresh();
  };
  const unlock = (id: InstId, cost: number) => {
    if (save.unlocked.includes(id) || save.opus < cost) { audio.sfx('deny'); return; }
    save.opus -= cost;
    save.unlocked.push(id);
    persist(save); audio.sfx('upgrade'); refresh();
  };

  return (
    <div className="h-full w-full flex flex-col bg-[radial-gradient(ellipse_at_top,#14222f_0%,#070d13_75%)]">
      <header className="flex items-center gap-2 p-3 border-b border-amber-300/20 flex-wrap">
        <button className="btn btn-ghost btn-sm" onClick={onTitle}>← Title</button>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-amber-200 mr-auto">The Conservatory</h2>
        <span className="chip text-sm !px-3 !py-1">🎵 Opus: <b className="text-amber-200">{save.opus}</b></span>
        <button className="btn btn-ghost btn-sm" onClick={onSettings}>⚙️</button>
      </header>
      <div className="flex gap-1 px-3 pt-2">
        <button className={`tab ${tab === 'campaign' ? 'active' : ''}`} onClick={() => { setTab('campaign'); audio.sfx('click'); }}>🗺️ Campaign</button>
        <button className={`tab ${tab === 'workshop' ? 'active' : ''}`} onClick={() => { setTab('workshop'); audio.sfx('click'); }}>🔧 Workshop (Upgrades)</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === 'campaign' ? (
          <div className="grid lg:grid-cols-[340px_1fr] gap-4 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
              {!save.tutorialDone && (
                <button className="panel p-3 text-left hover:brightness-125 pulse-glow" onClick={onTutorial}>
                  <div className="font-bold text-amber-200">🎓 New here? Take the Rehearsal</div>
                  <div className="text-xs text-amber-100/70">A short interactive tutorial. Earns bonus Opus.</div>
                </button>
              )}
              {LEVELS.map((l) => {
                const ok = unlocked(l.id);
                const st = save.cleared[String(l.id)] || 0;
                return (
                  <button key={l.id} disabled={!ok} onClick={() => { setSel(l.id); audio.sfx('click'); }}
                    className={`panel p-3 text-left transition ${sel === l.id ? 'ring-2 ring-amber-300' : ''} ${ok ? 'hover:brightness-125' : 'opacity-40 cursor-not-allowed'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{ok ? (l.id === 5 ? '♾️' : '🎼') : '🔒'}</span>
                      <div className="flex-1">
                        <div className="font-display font-bold text-amber-100">{l.name}</div>
                        <div className="text-xs text-amber-100/60">{l.sub}</div>
                      </div>
                      {l.id < 5 ? <Stars n={st} /> : save.best.encoreWave > 0 && <span className="chip">best {save.best.encoreWave}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="panel p-4 sm:p-5 flex flex-col gap-4">
              <div>
                <div className="font-display text-2xl font-bold text-amber-200">{lv.name}</div>
                <p className="text-amber-100/80 text-sm mt-1">{lv.desc}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  <span className="chip">🎚️ {lv.bpm} BPM</span>
                  <span className="chip">🌊 {lv.id === 5 ? 'Endless waves' : `${lv.waves} waves`}</span>
                  <span className="chip">🎲 Boon every {lv.id === 5 ? 3 : 2} waves</span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-200/60 mb-1">Discord forces</div>
                <div className="flex flex-wrap gap-2">
                  {lv.enemies.map((e) => (
                    <span key={e} className="chip !text-sm" title={ENEMIES[e].desc}>{ENEMY_ICON[e]} {ENEMIES[e].name}</span>
                  ))}
                  {lv.boss && <span className="chip !text-sm !border-rose-400/60 text-rose-200" title={ENEMIES[lv.boss].desc}>{ENEMY_ICON[lv.boss]} BOSS: {ENEMIES[lv.boss].name}</span>}
                  {lv.id === 5 && <span className="chip !text-sm !border-rose-400/60 text-rose-200">💀 Rotating bosses</span>}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-200/60 mb-1">Difficulty</div>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFS.map((d) => (
                    <button key={d.id} onClick={() => setDiff(d.id)} className={`panel p-2 text-center ${s.difficulty === d.id ? 'ring-2 ring-amber-300 !bg-amber-300/10' : 'opacity-80 hover:opacity-100'}`}>
                      <div className="font-display font-bold">{d.name}</div>
                      <div className="text-[11px] text-amber-100/60">{d.sub}</div>
                      <div className="text-[10px] text-amber-100/50">Harmony {d.harmony} · Opus ×{d.opus}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-amber-200/60 mb-1">Modifiers <span className="normal-case tracking-normal">(more Opus for each)</span></div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {MODS.map((m) => {
                    const on = s.mods.includes(m.id);
                    return (
                      <button key={m.id} onClick={() => toggleMod(m.id)} className={`panel p-2 text-left flex items-center gap-2 ${on ? 'ring-2 ring-rose-300 !bg-rose-400/10' : 'opacity-80 hover:opacity-100'}`}>
                        <span className="text-xl">{m.icon}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-bold">{m.name} <span className="text-amber-300 text-xs">+{Math.round(m.bonus * 100)}%</span></span>
                          <span className="block text-[11px] text-amber-100/60">{m.desc}</span>
                        </span>
                        <span className={`text-xs ${on ? 'text-rose-200' : 'text-white/30'}`}>{on ? 'ON' : 'off'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="btn text-lg px-8 py-3" onClick={() => onStart(lv.id, s.difficulty, s.mods)} disabled={!unlocked(lv.id)}>▶ Perform</button>
                <span className="text-xs text-amber-100/60">Opus multiplier: ×{(diff.opus * (1 + modBonus)).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid gap-4">
            <div>
              <h3 className="font-display text-lg text-amber-200 mb-2">🎻 New Automata</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {UNLOCKS.map((u) => {
                  const owned = save.unlocked.includes(u.id);
                  const d = INST[u.id];
                  return (
                    <div key={u.id} className="panel p-3 flex flex-col gap-1">
                      <div className="text-3xl">{d.icon}</div>
                      <div className="font-bold">{d.name}</div>
                      <div className="text-[11px] uppercase tracking-wider text-amber-300/70">{d.role}</div>
                      <div className="text-xs text-amber-100/70 flex-1">{d.desc}</div>
                      <button className="btn btn-sm mt-1" disabled={owned || save.opus < u.cost} onClick={() => unlock(u.id, u.cost)}>
                        {owned ? '✓ Owned' : `Unlock · ${u.cost} 🎵`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg text-amber-200 mb-2">🔧 Permanent Upgrades</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {UPGRADES.map((u) => {
                  const lvl = save.upg[u.id] || 0;
                  const maxed = lvl >= u.max;
                  const cost = upgCost(u, lvl);
                  return (
                    <div key={u.id} className="panel p-3 flex items-center gap-3">
                      <div className="text-3xl">{u.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{u.name}</div>
                        <div className="text-[11px] text-amber-100/65">{u.desc}</div>
                        <div className="mt-1 flex gap-1">
                          {Array.from({ length: u.max }).map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded ${i < lvl ? 'bg-amber-300' : 'bg-white/15'}`} />)}
                        </div>
                      </div>
                      <button className="btn btn-sm whitespace-nowrap" disabled={maxed || save.opus < cost} onClick={() => buy(u.id, u.max, cost)}>
                        {maxed ? 'MAX' : `${cost} 🎵`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs text-amber-100/50 text-center">Earn Opus by clearing waves and movements. Progress is saved in your browser.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Settings
export function SettingsPanel({ save, onChange, onClose, game, snap }: {
  save: SaveData; onChange: () => void; onClose: () => void; game?: Game | null; snap?: Snapshot | null;
}) {
  const s = save.settings;
  const [confirmWipe, setConfirmWipe] = useState(false);
  const upd = (patch: Partial<typeof s>) => {
    Object.assign(s, patch);
    applyAudio(save);
    persist(save);
    onChange();
  };
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-28">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => upd({ [key]: Number(e.target.value) })} className="flex-1" />
      <span className="w-10 text-right text-amber-200">{Math.round(s[key] * 100)}</span>
    </label>
  );
  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel w-full max-w-lg p-5 max-h-full overflow-y-auto pop-in">
        <div className="flex items-center mb-3">
          <h3 className="font-display text-2xl text-amber-200 flex-1">Settings</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div className="flex flex-col gap-3">
          <button className="btn btn-ghost self-start" onClick={() => upd({ muted: !s.muted })}>{s.muted ? '🔇 Muted — click to unmute' : '🔊 Sound on — click to mute'}</button>
          {slider('Master volume', 'master')}
          {slider('Music volume', 'music')}
          {slider('Effects volume', 'sfx')}
          <label className="flex items-center gap-3 text-sm">
            <span className="w-28">Screen shake</span>
            <input type="range" min={0} max={1} step={0.25} value={s.shake} onChange={(e) => upd({ shake: Number(e.target.value) })} className="flex-1" />
            <span className="w-10 text-right text-amber-200">{Math.round(s.shake * 100)}%</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <span className="w-28">Input offset</span>
            <input type="range" min={-150} max={150} step={5} value={s.offset} onChange={(e) => upd({ offset: Number(e.target.value) })} className="flex-1" />
            <span className="w-14 text-right text-amber-200">{s.offset} ms</span>
          </label>
          <div className="text-[11px] text-amber-100/50 -mt-2">If PERFECT hits feel early/late, nudge this to compensate for audio or display lag.</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={s.tick} onChange={(e) => upd({ tick: e.target.checked })} /> Metronome tick on every beat
          </label>
          {game && snap && !snap.isTutorial && (
            <div className="border-t border-amber-300/20 pt-3">
              <div className="text-xs uppercase tracking-widest text-amber-200/60 mb-1">Difficulty (applies live)</div>
              <div className="grid grid-cols-3 gap-2">
                {DIFFS.map((d) => (
                  <button key={d.id} className={`btn btn-sm ${snap.diffId === d.id ? '' : 'btn-ghost'}`} onClick={() => game.setDifficulty(d.id)}>{d.name}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {MODS.map((m) => (
                  <button key={m.id} className={`btn btn-sm ${snap.mods.includes(m.id) ? '' : 'btn-ghost'}`} title={m.desc} onClick={() => game.toggleMod(m.id)}>{m.icon} {m.name}</button>
                ))}
              </div>
            </div>
          )}
          {!game && (
            <div className="border-t border-amber-300/20 pt-3">
              {confirmWipe ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rose-300">Erase ALL progress?</span>
                  <button className="btn btn-danger btn-sm" onClick={() => { const fresh = wipeSave(); Object.keys(save).forEach((k) => delete (save as unknown as Record<string, unknown>)[k]); Object.assign(save, fresh); applyAudio(save); setConfirmWipe(false); onChange(); }}>Yes, erase</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmWipe(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmWipe(true)}>🗑️ Reset saved progress</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Help
export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'basics' | 'controls' | 'inst' | 'foes' | 'systems'>('basics');
  const tabs: [typeof tab, string][] = [['basics', 'Basics'], ['controls', 'Controls'], ['inst', 'Automata'], ['foes', 'Foes'], ['systems', 'Systems']];
  const keys: [string, string][] = [
    ['Space', 'Conduct the beat (also: click the podium / tap the baton button)'],
    ['1 – 7', 'Arm an instrument from the palette'],
    ['Click / Enter', 'Place armed instrument, or select an automaton'],
    ['Arrows / WASD', 'Move the keyboard cursor on the staff'],
    ['Shift-click · Right-click (roll)', 'Toggle a note as an ACCENT in the piano roll'],
    ['F or Q', 'Unleash Fortissimo (when Crescendo is full)'],
    ['N', 'Call the next wave early for bonus cogs'],
    ['[  ]', 'Slow down / speed up the tempo (70–150 BPM)'],
    ['U', 'Upgrade selected automaton'],
    ['X / Delete', 'Sell selected automaton'],
    ['Esc / P', 'Deselect, or pause / resume'],
    ['Right-click (staff)', 'Disarm the placing tool'],
  ];
  return (
    <div className="absolute inset-0 z-50 bg-black/75 flex items-center justify-center p-3" onMouseDown={(e) => e.stopPropagation()}>
      <div className="panel w-full max-w-3xl max-h-full flex flex-col pop-in">
        <div className="flex items-center p-4 pb-0">
          <h3 className="font-display text-2xl text-amber-200 flex-1">How to Play</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div className="flex gap-1 px-4 pt-2 flex-wrap border-b border-amber-300/20">
          {tabs.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="p-4 overflow-y-auto text-sm text-amber-50/85 leading-relaxed">
          {tab === 'basics' && (
            <div className="flex flex-col gap-3">
              <p><b className="text-amber-200">Goal:</b> Discordant foes march along the five lanes of a musical staff toward your Conductor's podium on the left. Each one that gets through drains <b>Harmony</b>. Survive every wave of a movement and defeat its boss to win.</p>
              <p><b className="text-amber-200">1 · Build.</b> Spend <b>Cogs ⚙️</b> to place automata on the left side of the staff (dashed line = limit). Click an automaton to open its <b>composition editor</b>.</p>
              <p><b className="text-amber-200">2 · Compose.</b> The 16-step <b>piano roll</b> is a looping bar. Whenever the playhead passes a note, that automaton plays and ATTACKS. Higher rows are higher scale degrees. Accents hit 1.8× harder but cost more steam.</p>
              <p><b className="text-amber-200">3 · Mind the steam.</b> Every note burns <b>steam pressure</b> (blue bar). Out of steam = fizzle. Dense patterns drain faster, and a faster tempo drains faster still.</p>
              <p><b className="text-amber-200">4 · Chords.</b> Automata playing notes on the <i>same step</i> form chords: consonant intervals (unison, 3rds, 4ths, 5ths, 6ths) boost damage up to +140%; adjacent scale degrees clash and weaken notes. Compose harmonies on purpose!</p>
              <p><b className="text-amber-200">5 · Conduct.</b> Press <b>Space</b> as the shrinking ring meets the podium circle. Perfect/Good hits build <b>combo</b> (+1% damage each, max +30%), refill steam, and charge <b>Crescendo</b>. Fill it, then press <b>F</b> for <b>Fortissimo</b>: double damage for 8 beats.</p>
              <p><b className="text-amber-200">6 · Adapt.</b> Some foes can only be hurt on downbeats (steps 1·5·9·13), others only off them. Armoured foes shrug off weak hits. Between waves you pick <b>Boons</b>, and between runs you spend <b>Opus</b> in the Conservatory.</p>
              <p className="text-amber-100/60">Tempo changes more than speed: every foe marches one step per beat, but cog rewards scale with tempo (slow ×0.8 → fast ×1.3).</p>
            </div>
          )}
          {tab === 'controls' && (
            <div className="grid gap-1">
              {keys.map(([k, d]) => (
                <div key={k} className="flex gap-3 items-start border-b border-white/5 py-1">
                  <kbd className="min-w-[8.5rem] text-center px-2 py-0.5 rounded bg-white/10 border border-amber-300/30 text-amber-200 text-xs font-mono">{k}</kbd>
                  <span>{d}</span>
                </div>
              ))}
              <p className="mt-2 text-amber-100/60">Touch: tap cards to arm, tap squares to place, tap the podium or the CONDUCT button on the beat. The window also auto-pauses if you tab away.</p>
            </div>
          )}
          {tab === 'inst' && (
            <div className="grid sm:grid-cols-2 gap-2">
              {INST_ORDER.map((id) => {
                const d = INST[id];
                return (
                  <div key={id} className="panel p-3 flex gap-3">
                    <div className="text-3xl">{d.icon}</div>
                    <div>
                      <div className="font-bold">{d.name} <span className="text-xs text-amber-300/70">· {d.role}</span></div>
                      <div className="text-xs text-amber-100/70">{d.desc}</div>
                      <div className="text-[11px] text-amber-100/50 mt-1">Cost {d.cost} · HP {d.hp} · Steam/note {d.pc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'foes' && (
            <div className="grid sm:grid-cols-2 gap-2">
              {[...REGULAR, ...BOSSES].map((id) => {
                const e = ENEMIES[id];
                return (
                  <div key={id} className={`panel p-3 flex gap-3 ${e.boss ? '!border-rose-400/50' : ''}`}>
                    <div className="text-3xl">{ENEMY_ICON[id]}</div>
                    <div>
                      <div className="font-bold">{e.name}{e.boss && <span className="chip ml-2 !text-rose-200">BOSS</span>}</div>
                      <div className="text-xs text-amber-100/70">{e.desc}</div>
                      <div className="text-[11px] text-amber-100/50 mt-1">HP {e.hp} · Armour {e.armor} · Leak {e.leak} Harmony</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'systems' && (
            <div className="flex flex-col gap-2">
              <p>⏱️ <b>Rhythm</b> — a global 16-step clock drives every automaton, foe movement, and your conducting.</p>
              <p>🎼 <b>Composition</b> — your piano-roll patterns <i>are</i> your attacks <i>and</i> the music you hear.</p>
              <p>♨️ <b>Steam economy</b> — note density, accents, and tempo trade damage against pressure.</p>
              <p>🎶 <b>Harmony</b> — simultaneous notes form chords (bonus) or clashes (penalty); Harp resonance and Music Box cogs scale with chords.</p>
              <p>🪄 <b>Conducting</b> — combo, Crescendo and Fortissimo reward precision.</p>
              <p>🛡️ <b>Rhythm-locked foes</b> — Syncopators, Metronomes and certain bosses react to <i>when</i> in the bar a note was fired.</p>
              <p>🔧 <b>Meta</b> — boons each run, Opus upgrades and instrument unlocks between runs; difficulty and modifiers raise the Opus multiplier.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Result
export function ResultScreen({ result, save, onRetry, onNext, onMap, onTitle }: {
  result: RunResult; save: SaveData; onRetry: () => void; onNext: (() => void) | null; onMap: () => void; onTitle: () => void;
}) {
  const st = result.stats;
  const mins = Math.floor(st.time / 60);
  const secs = Math.floor(st.time % 60).toString().padStart(2, '0');
  const acc = st.perfect + st.good + st.miss > 0 ? Math.round(((st.perfect + st.good) / (st.perfect + st.good + st.miss)) * 100) : 0;
  const isFinale = result.victory && result.levelId === 4;
  const rows: [string, string | number][] = [
    ['Time', `${mins}:${secs}`], ['Foes silenced', st.kills], ['Waves cleared', st.wavesCleared], ['Notes played', st.notes],
    ['Damage dealt', Math.round(st.damage)], ['Chords struck', st.chords], ['Perfect / Good / Miss', `${st.perfect} / ${st.good} / ${st.miss}`],
    ['Conducting accuracy', `${acc}%`], ['Best combo', st.maxCombo], ['Cogs earned', Math.round(st.cogsEarned)],
    ['Automata lost', st.autosLost], ['Deflected notes', st.deflects], ['Steam fizzles', st.fizzles],
    ['Harmony left', `${Math.ceil(result.harmonyLeft)} / ${result.maxHarmony}`],
  ];
  return (
    <div className={`h-full w-full overflow-y-auto flex items-center justify-center p-4 ${result.victory ? 'bg-[radial-gradient(ellipse_at_center,#2a2410_0%,#070d13_75%)]' : 'bg-[radial-gradient(ellipse_at_center,#2a0f16_0%,#070d13_75%)]'}`}>
      <div className="panel max-w-3xl w-full p-5 sm:p-8 pop-in my-auto">
        <div className="text-center">
          <div className="text-xs tracking-[0.4em] uppercase text-amber-200/60">{result.levelName} · {result.diffName}</div>
          <h2 className={`font-display font-black text-4xl sm:text-6xl mt-1 ${result.victory ? 'shimmer-text' : 'text-rose-300'}`}>
            {result.tutorial ? 'Rehearsal Complete' : isFinale ? 'Symphony Complete!' : result.victory ? 'Movement Complete' : result.levelId === 5 ? 'The Fugue Ends' : 'The Hall Falls Silent'}
          </h2>
          {result.victory && !result.tutorial && <div className="text-4xl mt-2"><Stars n={result.stars} /></div>}
          <p className="text-amber-100/70 mt-2 text-sm">
            {result.tutorial ? 'You know the basics. Venture into the Conservatory to begin the campaign.'
              : isFinale ? 'The Cacophony is silenced and the hall rings with your masterpiece. The Endless Fugue encore is now unlocked!'
                : result.victory ? (result.firstClear ? 'A new movement opens before you.' : 'Another fine performance.')
                  : 'Discord overwhelmed the podium. Refine your composition and try again.'}
          </p>
          <div className="mt-3 inline-block chip !text-base !px-4 !py-1.5">🎵 +{result.opus} Opus <span className="text-amber-100/50">(total {save.opus})</span></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          {rows.map(([k, v]) => (
            <div key={k} className="bg-white/5 rounded-lg px-3 py-2 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-amber-100/50">{k}</div>
              <div className="font-bold text-amber-100">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {onNext && <button className="btn" onClick={onNext}>Next Movement ▶</button>}
          {!result.tutorial && <button className={`btn ${onNext ? 'btn-ghost' : ''}`} onClick={onRetry}>↻ {result.victory ? 'Play Again' : 'Retry'}</button>}
          <button className="btn btn-ghost" onClick={onMap}>🔧 Conservatory{result.opus > 0 ? ' (spend Opus)' : ''}</button>
          <button className="btn btn-ghost" onClick={onTitle}>Title</button>
        </div>
      </div>
    </div>
  );
}

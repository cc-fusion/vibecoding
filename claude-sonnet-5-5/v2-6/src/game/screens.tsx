import { useState } from 'react';
import { cn } from '../utils/cn';
import {
  DIFFS, MODS, UPGRADES, TOOLS, TRIBES, TECHS, ERAS, upgradeCost,
  type SaveData, type EndResult, type Settings,
} from './data';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose?: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]">
      <div className={cn('panel pop-in flex max-h-[92vh] w-full flex-col overflow-hidden', wide ? 'max-w-4xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-lg font-extrabold tracking-wide text-amber-200">{title}</h2>
          {onClose && <button className="btn !px-3 !py-1" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="scroll overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function TitleScreen(p: {
  save: SaveData; onPlay: () => void; onTutorial: () => void; onHelp: () => void; onSettings: () => void; onSanctum: () => void;
}) {
  const s = p.save;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-black/60 via-black/25 to-black/70 p-4 text-center">
      <div className="fade-up pointer-events-auto flex flex-col items-center">
        <div className="mb-2 text-sm font-bold uppercase tracking-[0.5em] text-teal-200/80">A god-game of moving continents</div>
        <h1 className="title-logo text-5xl font-black leading-none tracking-tight sm:text-7xl md:text-8xl">TECTONIC<br />SHEPHERD</h1>
        <p className="mt-4 max-w-md text-sm text-indigo-100/80 sm:text-base">
          Drag the plates beneath five rival tribes. Raise mountains, open seas, tame volcanoes — and keep your people alive until the Titan sleeps.
        </p>
        <div className="mt-7 flex w-72 flex-col gap-2.5">
          <button className="btn btn-primary !py-3 text-lg" onClick={p.onPlay}>▶ Begin Shepherding</button>
          <button className="btn btn-teal" onClick={p.onTutorial}>
            🎓 Interactive Tutorial {!s.tutorialDone && <span className="rounded bg-black/30 px-1.5 text-xs">start here</span>}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn !px-2 text-sm" onClick={p.onHelp}>📖 Help</button>
            <button className="btn !px-2 text-sm" onClick={p.onSanctum}>✨ Sanctum</button>
            <button className="btn !px-2 text-sm" onClick={p.onSettings}>⚙ Settings</button>
          </div>
        </div>
        <div className="mt-6 flex gap-5 text-xs text-indigo-200/70">
          <span>💠 Insight <b className="text-amber-200">{s.insight}</b></span>
          <span>🏆 Best <b className="text-amber-200">{s.best}</b></span>
          <span>🌍 Runs <b className="text-amber-200">{s.runs}</b></span>
          <span>👑 Wins <b className="text-amber-200">{s.wins}</b></span>
        </div>
      </div>
    </div>
  );
}

export function NewGameModal(p: { save: SaveData; onStart: (diff: string, mods: string[]) => void; onClose: () => void }) {
  const [diff, setDiff] = useState(p.save.diff);
  const [mods, setMods] = useState<string[]>(p.save.mods);
  const mult = (DIFFS.find((d) => d.id === diff)?.score || 1) * (1 + MODS.filter((m) => mods.includes(m.id)).reduce((a, m) => a + m.bonus, 0));
  return (
    <Modal title="New World" onClose={p.onClose}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-200/70">Difficulty</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {DIFFS.map((d) => (
          <button key={d.id} onClick={() => setDiff(d.id)} className={cn('rounded-xl border p-3 text-left transition', diff === d.id ? 'border-amber-300 bg-amber-300/15 pulse-glow' : 'border-white/15 bg-white/5 hover:bg-white/10')}>
            <div className="font-bold">{d.name}</div>
            <div className="mt-1 text-xs text-indigo-100/70">{d.desc}</div>
            <div className="mt-2 text-[11px] text-amber-200/80">Score ×{d.score}</div>
          </button>
        ))}
      </div>
      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest text-indigo-200/70">Modifiers (bonus score &amp; insight)</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODS.map((m) => {
          const on = mods.includes(m.id);
          return (
            <button key={m.id} onClick={() => setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id])} className={cn('rounded-xl border p-3 text-left transition', on ? 'border-teal-300 bg-teal-300/15' : 'border-white/15 bg-white/5 hover:bg-white/10')}>
              <div className="flex justify-between font-bold"><span>{on ? '☑' : '☐'} {m.name}</span><span className="text-xs text-amber-200">+{Math.round(m.bonus * 100)}%</span></div>
              <div className="mt-1 text-xs text-indigo-100/70">{m.desc}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-indigo-100/70">Total score multiplier: <b className="text-amber-200">×{mult.toFixed(2)}</b></span>
        <button className="btn btn-primary" onClick={() => p.onStart(diff, mods)}>Create World ▶</button>
      </div>
    </Modal>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ['Goal', 'Controls', 'Systems', 'Tribes & Tech'];
  return (
    <Modal title="How to Play" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t, i) => <button key={t} className={cn('btn !py-1.5 text-sm', tab === i && '!border-amber-300 !bg-amber-300/20')} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      {tab === 0 && (
        <div className="space-y-3 text-sm leading-relaxed text-indigo-100/90">
          <p>You are the <b className="text-amber-200">Tectonic Shepherd</b>. Eight plates drift across the mantle carrying five tribes. Shape the land so tribes <b>grow, learn, trade and survive</b>.</p>
          <p>Each <b>Era</b> sets goals (population, settlements, discoveries). Meeting them advances time and escalates disasters. The fifth era unleashes <b className="text-red-300">the Titan</b> — a boss whose pressure you must vent with Tremors until its fury is spent. Calm the Titan to win; lose every tribe and the world falls silent.</p>
          <p>Earn <b>Insight</b> every run to buy permanent upgrades and new powers in the <b>Sanctum</b>.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Plates that <b>overlap</b> grind into mountains and build <b className="text-red-300">fault stress</b>.</li>
            <li>Plates that <b>part</b> open rifts: deep sea, volcanoes — and distance between tribes.</li>
            <li>Stress releases as <b>quakes</b>. Quakes under the sea birth <b>tsunamis</b>. Vent stress early with <b>Tremor</b>.</li>
            <li>Settlements ride their plate. Keep them away from lava, drowned coasts and collisions.</li>
          </ul>
        </div>
      )}
      {tab === 1 && (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-bold text-amber-200">Mouse / Touch</h3>
            <ul className="space-y-1 text-indigo-100/90">
              <li><b>Drag</b> – push the plate under the cursor (Shepherd tool)</li>
              <li><b>Click</b> – use the selected power at the cursor</li>
              <li><b>Click ✦ bubbles</b> – collect Favor from prayers (any tool)</li>
              <li><b>Right-click</b> – Tide: lower the sea</li>
              <li>Touch works the same: drag with a finger, tap to cast.</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-1 font-bold text-amber-200">Keyboard</h3>
            <ul className="space-y-1 text-indigo-100/90">
              {TOOLS.map((t) => <li key={t.id}><kbd className="rounded bg-white/10 px-1.5">{t.key}</kbd> {t.icon} {t.name}</li>)}
              <li><kbd className="rounded bg-white/10 px-1.5">Tab</kbd> cycle map overlay (terrain / plates / stress / fertility)</li>
              <li><kbd className="rounded bg-white/10 px-1.5">Space</kbd> pause · <kbd className="rounded bg-white/10 px-1.5">F</kbd> game speed</li>
              <li><kbd className="rounded bg-white/10 px-1.5">T</kbd> tribes panel · <kbd className="rounded bg-white/10 px-1.5">M</kbd> mute · <kbd className="rounded bg-white/10 px-1.5">H</kbd> help · <kbd className="rounded bg-white/10 px-1.5">Esc</kbd> menu</li>
            </ul>
          </div>
        </div>
      )}
      {tab === 2 && (
        <div className="space-y-3 text-sm leading-relaxed text-indigo-100/90">
          <p><b className="text-amber-200">Energy</b> (blue) pays for moving plates, Tremor, Volcano and Tide. It regenerates constantly. Heavier plates cost more.</p>
          <p><b className="text-amber-200">Favor</b> (gold) comes from prayers (✦ bubbles above settlements) and era milestones. It pays for Blessing, Omen of Peace and Sanctuary.</p>
          <p><b className="text-amber-200">Climate</b>: sea level, latitude and elevation decide biomes. Mountains cast rain shadows and deserts form downwind. Volcanic ash is fertile. Rising seas drown coasts; glacial snaps expose land bridges.</p>
          <p><b className="text-amber-200">Diplomacy</b>: tribes in contact (by land, or by sea with Seafaring/Navigation) trade when relations are warm and go to war when they sour. Crowded neighbours, Emberborn aggression and Warlike mode push toward war. Drag plates apart to break contact — or cast an Omen of Peace.</p>
          <p><b className="text-amber-200">Devotion</b> grows with prosperity, falls with disasters and war, and speeds up growth and research.</p>
          <p><b className="text-amber-200">Disaster events</b> are telegraphed: sea rise, glacial snap, drought, quake swarm, eruption, tsunami. Stress zones flicker red on every overlay before they snap.</p>
        </div>
      )}
      {tab === 3 && (
        <div className="space-y-3 text-sm text-indigo-100/90">
          <div className="grid gap-2 sm:grid-cols-2">
            {TRIBES.map((t) => <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 p-2"><b style={{ color: t.color }}>{t.icon} {t.name}</b><div className="text-xs text-indigo-100/70">{t.trait}</div></div>)}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {TECHS.map((t) => <div key={t.id} className="rounded-md bg-white/5 px-2 py-1 text-xs"><b>{t.icon} {t.name}</b> <span className="text-amber-200/70">T{t.tier}</span> – {t.desc}</div>)}
          </div>
          <div className="text-xs text-indigo-100/60">Eras: {ERAS.map((e) => e.name).join(' → ')}</div>
        </div>
      )}
    </Modal>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 text-indigo-100/80">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-9 text-right tabular-nums text-amber-200">{Math.round(value * 100)}</span>
    </label>
  );
}

export function SettingsModal(p: {
  save: SaveData; onSettings: (s: Settings) => void; inGame: boolean; diff: string; mods: string[];
  onDifficulty: (diff: string, mods: string[]) => void; onClose: () => void; onReset: () => void;
}) {
  const s = p.save.settings;
  const set = (patch: Partial<Settings>) => p.onSettings({ ...s, ...patch });
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Settings" onClose={p.onClose}>
      <div className="space-y-3">
        <Slider label="Master" value={s.master} onChange={(v) => set({ master: v })} />
        <Slider label="Music" value={s.music} onChange={(v) => set({ music: v })} />
        <Slider label="Effects" value={s.sfx} onChange={(v) => set({ sfx: v })} />
        <div className="flex flex-wrap gap-2 pt-1">
          <button className={cn('btn text-sm', s.muted && '!border-red-300 !bg-red-400/20')} onClick={() => set({ muted: !s.muted })}>{s.muted ? '🔇 Muted' : '🔊 Sound on'}</button>
          <button className={cn('btn text-sm', s.shake && '!border-teal-300')} onClick={() => set({ shake: !s.shake })}>📳 Screen shake: {s.shake ? 'on' : 'off'}</button>
          <button className={cn('btn text-sm', s.lines && '!border-teal-300')} onClick={() => set({ lines: !s.lines })}>🔗 Relation lines: {s.lines ? 'on' : 'off'}</button>
        </div>
        {p.inGame && (
          <div className="border-t border-white/10 pt-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-200/70">Difficulty (live)</h3>
            <div className="flex flex-wrap gap-2">
              {DIFFS.map((d) => <button key={d.id} className={cn('btn text-sm', p.diff === d.id && '!border-amber-300 !bg-amber-300/20')} onClick={() => p.onDifficulty(d.id, p.mods)}>{d.name}</button>)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {MODS.map((m) => {
                const on = p.mods.includes(m.id);
                return <button key={m.id} title={m.desc} className={cn('btn text-xs', on && '!border-teal-300 !bg-teal-300/15')} onClick={() => p.onDifficulty(p.diff, on ? p.mods.filter((x) => x !== m.id) : [...p.mods, m.id])}>{on ? '☑' : '☐'} {m.name}</button>;
              })}
            </div>
          </div>
        )}
        <div className="border-t border-white/10 pt-3">
          {!confirm ? <button className="btn text-xs !text-red-200" onClick={() => setConfirm(true)}>Erase saved progress…</button> : (
            <div className="flex items-center gap-2 text-sm">Erase Insight, upgrades and records? <button className="btn !border-red-300 text-xs" onClick={() => { p.onReset(); setConfirm(false); }}>Yes, erase</button><button className="btn text-xs" onClick={() => setConfirm(false)}>Cancel</button></div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function SanctumModal(p: { save: SaveData; onBuyUpgrade: (id: string) => void; onUnlock: (id: string) => void; onClose: () => void }) {
  const s = p.save;
  return (
    <Modal title={`✨ The Sanctum — ${s.insight} Insight`} onClose={p.onClose} wide>
      <p className="mb-3 text-sm text-indigo-100/70">Insight is earned at the end of every run. Spend it on permanent boons that carry across worlds.</p>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-200/70">Divine Powers</h3>
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        {TOOLS.filter((t) => t.unlock > 0).map((t) => {
          const have = s.unlocked.includes(t.id);
          return (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div><div className="font-bold">{t.icon} {t.name}</div><div className="text-xs text-indigo-100/70">{t.desc}</div></div>
              {have ? <span className="text-sm font-bold text-teal-300">Unlocked</span> : <button className="btn btn-primary shrink-0 !px-3 !py-1.5 text-sm" disabled={s.insight < t.unlock} onClick={() => p.onUnlock(t.id)}>{t.unlock} 💠</button>}
            </div>
          );
        })}
      </div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-200/70">Boons</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const lvl = s.upgrades[u.id] || 0; const maxed = lvl >= u.max; const cost = upgradeCost(u, lvl);
          return (
            <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <div className="font-bold">{u.icon} {u.name} <span className="text-xs text-amber-200">{lvl}/{u.max}</span></div>
                <div className="text-xs text-indigo-100/70">{u.desc}</div>
                <div className="mt-1 flex gap-1">{Array.from({ length: u.max }).map((_, i) => <span key={i} className={cn('h-1.5 w-5 rounded', i < lvl ? 'bg-amber-300' : 'bg-white/15')} />)}</div>
              </div>
              {maxed ? <span className="text-sm font-bold text-teal-300">Max</span> : <button className="btn btn-primary shrink-0 !px-3 !py-1.5 text-sm" disabled={s.insight < cost} onClick={() => p.onBuyUpgrade(u.id)}>{cost} 💠</button>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function PauseMenu(p: { onResume: () => void; onHelp: () => void; onSettings: () => void; onRestart: () => void; onQuit: () => void }) {
  return (
    <Modal title="⏸ Paused">
      <div className="flex flex-col gap-2.5">
        <button className="btn btn-primary" onClick={p.onResume}>▶ Resume</button>
        <button className="btn" onClick={p.onHelp}>📖 Help &amp; Controls</button>
        <button className="btn" onClick={p.onSettings}>⚙ Settings &amp; Difficulty</button>
        <button className="btn" onClick={p.onRestart}>↺ Restart World</button>
        <button className="btn !text-red-200" onClick={p.onQuit}>⌂ Abandon to Title</button>
      </div>
    </Modal>
  );
}

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function EndScreen(p: { r: EndResult; save: SaveData; onRetry: () => void; onTitle: () => void; onSanctum: () => void; onContinue: () => void }) {
  const { r } = p; const st = r.stats;
  const rows: [string, string | number][] = [
    ['Time', fmtTime(st.time)], ['Era reached', ERAS[Math.min(4, r.era)].name], ['Peak population', Math.floor(st.peakPop)], ['Tribes surviving', `${st.tribesAlive}/5`],
    ['Discoveries', st.techs], ['Settlements founded', st.founded], ['Settlements lost', st.lost], ['Lives lost', Math.floor(st.deaths)],
    ['Quakes (max M)', `${st.quakes} (${st.maxMag.toFixed(1)})`], ['Eruptions', st.eruptions], ['Tsunamis', st.tsunamis], ['Wars', st.wars],
    ['Prayers answered', st.prayers], ['Plates moved', `${Math.round(st.dist)} cells`], ['Titan damage', Math.round(st.titanDmg)],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/65 p-3 backdrop-blur-[2px]">
      <div className="panel pop-in my-auto w-full max-w-2xl p-6">
        <div className={cn('text-center text-4xl font-black tracking-wide sm:text-5xl', r.victory ? 'title-logo' : 'text-red-300')}>{r.victory ? 'THE TITAN SLEEPS' : 'THE SILENCE'}</div>
        <p className="mt-2 text-center text-sm text-indigo-100/80">{r.reason}</p>
        <div className="mt-4 flex items-center justify-center gap-6 text-center">
          <div><div className="text-xs uppercase tracking-widest text-indigo-200/60">Score</div><div className="text-3xl font-black text-amber-200">{r.score}</div>{r.newBest && <div className="text-xs font-bold text-teal-300">★ New best!</div>}</div>
          <div><div className="text-xs uppercase tracking-widest text-indigo-200/60">Insight earned</div><div className="text-3xl font-black text-teal-200">+{r.insight}</div></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-white/5 py-0.5"><span className="text-indigo-100/60">{k}</span><b>{v}</b></div>)}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button className="btn btn-primary" onClick={p.onRetry}>↺ {r.victory ? 'New World' : 'Try Again'}</button>
          {r.victory && <button className="btn btn-teal" onClick={p.onContinue}>∞ Continue (Eternal Age)</button>}
          <button className="btn" onClick={p.onSanctum}>✨ Sanctum ({p.save.insight} 💠)</button>
          <button className="btn" onClick={p.onTitle}>⌂ Title</button>
        </div>
      </div>
    </div>
  );
}

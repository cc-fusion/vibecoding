import { useState, type ReactNode } from 'react';
import { CHARTER, DIFFS, EDEF, MODS, WAVE_COUNT, DEFAULT_SAVE, type EType, type Save, writeSave } from '../game/data';
import type { Game } from '../game/sim';
import { audio } from '../game/audio';
import { Btn, Modal, Slider, Toggle, fmt } from './common';

export function TitleScreen(p: { save: Save; onNew: () => void; onTutorial: () => void; onCharter: () => void; onHelp: () => void; onSettings: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950/55 via-slate-950/20 to-slate-950/75 p-4">
      <div className="text-center anim-float">
        <div className="mb-1 text-sm font-semibold uppercase tracking-[0.5em] text-cyan-300/90">⚓ A coastal fortress at the mercy of the moon ⚓</div>
        <h1 className="font-display text-5xl font-extrabold leading-none tracking-wider text-amber-200 drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-7xl">
          TIDAL FORGE
        </h1>
        <h2 className="font-display text-3xl font-bold tracking-[0.35em] text-cyan-100 drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)] sm:text-5xl">CITADEL</h2>
      </div>
      <div className="mt-8 flex w-64 flex-col gap-2.5">
        <Btn kind="primary" onClick={p.onNew} className="!py-3 !text-base">⛵ Set Sail</Btn>
        <Btn onClick={p.onTutorial}>📖 Guided Tutorial</Btn>
        <Btn onClick={p.onCharter}>📜 Citadel Charter <span className="ml-1 rounded bg-amber-400/20 px-1.5 text-amber-200">{Math.floor(p.save.renown)} renown</span></Btn>
        <div className="flex gap-2"><Btn className="flex-1" onClick={p.onHelp}>❓ How to Play</Btn><Btn className="flex-1" onClick={p.onSettings}>⚙️ Settings</Btn></div>
      </div>
      <div className="mt-6 flex gap-4 rounded-lg bg-slate-950/60 px-4 py-2 text-xs text-slate-300">
        <span>Best wave <b className="text-amber-200">{p.save.bestWave}</b></span>
        <span>Best score <b className="text-amber-200">{fmt(p.save.bestScore)}</b></span>
        <span>Voyages <b className="text-amber-200">{p.save.runs}</b></span>
        <span>Victories <b className="text-amber-200">{p.save.wins}</b></span>
      </div>
    </div>
  );
}

export function NewGameModal(p: { onStart: (diff: string, mods: string[]) => void; onClose: () => void }) {
  const [diff, setDiff] = useState('open');
  const [mods, setMods] = useState<string[]>([]);
  const d = DIFFS.find((x) => x.id === diff)!;
  const mult = d.renown * (1 + mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus || 0), 0));
  return (
    <Modal title="Plan Your Campaign" onClose={p.onClose} wide>
      <div className="grid gap-2 sm:grid-cols-3">
        {DIFFS.map((x) => (
          <button key={x.id} onClick={() => { audio.sfx('ui'); setDiff(x.id); }} className={`rounded-lg border p-3 text-left transition ${diff === x.id ? 'border-amber-300 bg-amber-900/25' : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/70'}`}>
            <div className="font-display text-lg text-amber-200">{x.name}</div>
            <div className="text-xs text-slate-300">{x.desc}</div>
            <div className="mt-1 text-[11px] text-slate-400">Fleet HP x{x.hp} · size x{x.count} · damage x{x.dmg}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-200">Modifiers <span className="text-xs font-normal text-slate-400">(each adds bonus renown)</span></div>
      <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
        {MODS.map((m) => (
          <button key={m.id} onClick={() => { audio.sfx('ui'); setMods(mods.includes(m.id) ? mods.filter((q) => q !== m.id) : [...mods, m.id]); }} className={`rounded-lg border p-2 text-left transition ${mods.includes(m.id) ? 'border-cyan-300 bg-cyan-900/30' : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/70'}`}>
            <div className="text-sm font-bold text-slate-100">{mods.includes(m.id) ? '☑' : '☐'} {m.name} <span className="text-xs text-emerald-300">+{Math.round(m.bonus * 100)}%</span></div>
            <div className="text-[11px] text-slate-400">{m.desc}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-300">Renown multiplier: <b className="text-amber-200">x{mult.toFixed(2)}</b></div>
        <div className="flex gap-2"><Btn onClick={p.onClose}>Back</Btn><Btn kind="primary" onClick={() => p.onStart(diff, mods)}>Begin Voyage</Btn></div>
      </div>
    </Modal>
  );
}

export function CharterModal(p: { save: Save; setSave: (s: Save) => void; onClose: () => void }) {
  const s = p.save;
  const buy = (id: string) => {
    const def = CHARTER.find((c) => c.id === id)!; const lvl = s.charter[id] || 0;
    const cost = def.cost(lvl);
    if (lvl >= def.max || s.renown < cost) { audio.sfx('err'); return; }
    const ns: Save = { ...s, renown: s.renown - cost, charter: { ...s.charter, [id]: lvl + 1 } };
    writeSave(ns); p.setSave(ns); audio.sfx('upgrade');
  };
  const section = (g: 'Upgrade' | 'Unlock') => (
    <div>
      <div className="mb-1 mt-2 text-xs font-bold uppercase tracking-widest text-cyan-300">{g === 'Upgrade' ? 'Permanent Upgrades' : 'Blueprints & Rights'}</div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {CHARTER.filter((c) => c.group === g).map((c) => {
          const lvl = s.charter[c.id] || 0; const maxed = lvl >= c.max; const cost = c.cost(lvl); const ok = !maxed && s.renown >= cost;
          return (
            <div key={c.id} className={`flex items-center gap-2 rounded-lg border p-2 ${maxed ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700 bg-slate-900/60'}`}>
              <div className="text-2xl">{c.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-100">{c.name}</div>
                <div className="text-[11px] leading-snug text-slate-400">{c.desc}</div>
                {c.max > 1 && <div className="mt-0.5 flex gap-0.5">{Array.from({ length: c.max }, (_, i) => <span key={i} className={`h-1.5 w-4 rounded ${i < lvl ? 'bg-amber-300' : 'bg-slate-700'}`} />)}</div>}
              </div>
              {maxed ? <span className="text-xs font-bold text-amber-300">{c.max > 1 ? 'MAX' : 'OWNED'}</span> : <Btn small kind={ok ? 'primary' : 'ghost'} disabled={!ok} onClick={() => buy(c.id)}>{cost}📜</Btn>}
            </div>
          );
        })}
      </div>
    </div>
  );
  return (
    <Modal title="Citadel Charter" onClose={p.onClose} wide>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm text-slate-300">Renown earned from every voyage is spent here and kept between runs.</div>
        <div className="rounded-lg bg-amber-400/15 px-3 py-1 font-display text-lg text-amber-200">📜 {Math.floor(s.renown)}</div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-1">{section('Upgrade')}{section('Unlock')}</div>
      <div className="mt-3 text-right"><Btn onClick={p.onClose}>Close</Btn></div>
    </Modal>
  );
}

const TABS = ['Goal', 'Tide & Gates', 'Engines', 'Economy', 'Enemies', 'Controls'] as const;
export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Goal');
  const P = ({ children }: { children: ReactNode }) => <p className="mb-2 text-sm leading-relaxed text-slate-200">{children}</p>;
  const body = () => {
    switch (tab) {
      case 'Goal': return (<>
        <P>You command a seaside citadel under siege by a pirate armada. <b className="text-amber-200">Survive {WAVE_COUNT} waves</b> and sink the two flagships (Admiral Brack at wave 6, the Drowned King at wave 12) to win. If the <b>Keep</b> falls, or every sailor deserts, you lose.</P>
        <P>The sea rises and falls every {60}s as the moon crosses the sky. A moon near its zenith means high tide. The moon&apos;s fullness shows spring tides (bigger swings) versus neap tides (smaller ones).</P>
        <P>After each voyage you earn <b className="text-amber-200">Renown</b>, spent in the Citadel Charter on permanent upgrades and new blueprints.</P>
      </>);
      case 'Tide & Gates': return (<>
        <P><b className="text-cyan-300">The tide forecast</b> (bottom right) predicts the sea level. Cyan dashes show the lagoon, gold marks the next wave.</P>
        <P><b className="text-cyan-300">Sluice gates:</b> the seawall has two gates (keys <b>1</b> and <b>2</b>) that connect the sea to your inner <b>lagoon</b>. Water flows from the higher surface to the lower and spins turbines for <b>power</b>. Power ∝ head × flow, so let a big head build before opening.</P>
        <P><b className="text-cyan-300">Flooding:</b> lagoon terraces are flooded when the lagoon surface rises above them. Flooded buildings stop working, take damage and sour the crew. Brine Pans, engines and the fishery are waterproof. Storm surges can overtop the wall: raise it!</P>
        <P><b className="text-cyan-300">Ships have draft.</b> At low tide big ships run aground on the shoals: they stop, take +30% damage (+80% from catapults), and cannot advance until the sea rises. At high tide the heavy hulls sail right up to your wall.</P>
      </>);
      case 'Engines': return (<>
        <P>Siege engines are built on mounts along the seawall and offshore piers. They are <b className="text-cyan-300">wave powered</b>: each mount has a float level, and the engine charges fastest while the sea is within ±65 of it (highlighted in green when selected). Out of band they crawl at 15%.</P>
        <P><b>Wave Ballista</b>: fast piercing bolts, weak vs armor. <b>Tide Cannon</b>: explosive splash. <b>Surge Catapult</b>: huge splash, ×1.8 vs grounded ships. <b>Hydro-Ram</b>: piercing jet fed by lagoon head (lagoon above sea). Engines need crew, and iron ammo (except the Hydro-Ram). Click a ship to focus-fire it.</P>
        <P>Pier mounts are submerged and disabled at high tide, but are in the sweet spot at low tide.</P>
      </>);
      case 'Economy': return (<>
        <P><b>Quarry</b> → stone. <b>Ironworks</b> turns stone + power into iron. <b>Brine Pans</b> make gold when the lagoon sits near the pan level. <b>Fishery</b> feeds the crew at low tide. <b>Mess Hall</b> turns food into morale. <b>Barracks</b> house more sailors. <b>Carpenter</b> repairs and douses fires. <b>Capacitor Bank</b> stores power. <b>Observatory</b> extends the forecast and engine range.</P>
        <P><b>Crew &amp; morale:</b> every building needs sailors. Morale scales work speed (60%–120%). It rises with food, mess halls, barracks and victories, and falls with floods, fires, hunger and damage. Below 12 morale, sailors desert!</P>
        <P><b>Abilities:</b> Q Rally Cry, W Arc Discharge (power → lightning), E Emergency Shoring, R Fire Brigade. Click <b>flotsam crates</b> in the water for loot. Events: storm surges, rogue waves, fog, red tide, merchant convoys.</P>
      </>);
      case 'Enemies': return (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(Object.keys(EDEF) as EType[]).map((k) => (
            <div key={k} className="rounded-lg border border-slate-700 bg-slate-900/60 p-2">
              <div className="text-sm font-bold" style={{ color: EDEF[k].col }}>{EDEF[k].name}{EDEF[k].boss ? ' ★ BOSS' : ''}</div>
              <div className="text-[11px] text-slate-300">{EDEF[k].desc}</div>
              <div className="text-[10px] text-slate-500">HP {EDEF[k].hp} · draft {EDEF[k].draft} · armor {EDEF[k].armor}</div>
            </div>
          ))}
        </div>
      );
      default: return (
        <div className="grid gap-x-6 gap-y-1 text-sm text-slate-200 sm:grid-cols-2">
          {[['Click a plot / building', 'Build, upgrade, staff, repair'], ['Click a ship', 'Focus fire (click again to clear)'], ['Click a crate', 'Collect flotsam'], ['1 / 2', 'Cycle sluice gates: Shut/Open/Auto'], ['Q W E R', 'Rally / Arc / Shoring / Fire brigade'], ['Space', 'Call next wave early (bonus gold)'], ['F', 'Cycle game speed 1x–3x'], ['Esc or P', 'Pause menu'], ['M', 'Mute'], ['H', 'This help'], ['Touch', 'Tap works for everything']].map(([k, v]) => <div key={k} className="flex gap-2"><kbd className="min-w-24 rounded bg-slate-800 px-2 py-0.5 text-center text-xs font-bold text-amber-200">{k}</kbd><span className="text-slate-300">{v}</span></div>)}
        </div>
      );
    }
  };
  return (
    <Modal title="Harbormaster's Guide" onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap gap-1.5">{TABS.map((t) => <Btn key={t} small active={tab === t} onClick={() => setTab(t)}>{t}</Btn>)}</div>
      <div className="max-h-[55vh] overflow-y-auto pr-1">{body()}</div>
      <div className="mt-3 text-right"><Btn onClick={onClose}>Close</Btn></div>
    </Modal>
  );
}

export function SettingsModal(p: { save: Save; setSave: (s: Save) => void; onClose: () => void }) {
  const st = p.save.settings;
  const [confirm, setConfirm] = useState(false);
  const upd = (patch: Partial<Save['settings']>) => {
    const ns = { ...p.save, settings: { ...st, ...patch } };
    audio.setVol({ master: ns.settings.master, music: ns.settings.music, sfx: ns.settings.sfx, muted: ns.settings.muted });
    writeSave(ns); p.setSave(ns);
  };
  return (
    <Modal title="Settings" onClose={p.onClose}>
      <div className="flex flex-col gap-2.5">
        <Slider label="Master" value={st.master} onChange={(v) => upd({ master: v })} />
        <Slider label="Music" value={st.music} onChange={(v) => upd({ music: v })} />
        <Slider label="Effects" value={st.sfx} onChange={(v) => { upd({ sfx: v }); audio.sfx('build'); }} />
        <Toggle label="Mute all audio" value={st.muted} onChange={(v) => upd({ muted: v })} />
        <Toggle label="Screen shake" value={st.shake} onChange={(v) => upd({ shake: v })} />
        <Toggle label="High particle density" value={st.particles} onChange={(v) => upd({ particles: v })} desc="Turn off for better performance" />
        <div className="mt-1 border-t border-slate-700 pt-2">
          {confirm ? (
            <div className="flex items-center gap-2 text-sm"><span className="text-rose-300">Erase renown and Charter?</span>
              <Btn small kind="danger" onClick={() => { const ns: Save = { ...DEFAULT_SAVE, charter: {}, settings: { ...st } }; writeSave(ns); p.setSave(ns); setConfirm(false); }}>Yes, erase</Btn>
              <Btn small onClick={() => setConfirm(false)}>Cancel</Btn></div>
          ) : <Btn small kind="danger" onClick={() => setConfirm(true)}>Reset progress</Btn>}
        </div>
        <div className="text-right"><Btn kind="primary" onClick={p.onClose}>Done</Btn></div>
      </div>
    </Modal>
  );
}

export function PauseModal(p: { onResume: () => void; onHelp: () => void; onSettings: () => void; onRestart: () => void; onQuit: () => void }) {
  const [confirm, setConfirm] = useState<'' | 'restart' | 'quit'>('');
  return (
    <Modal title="Paused">
      {confirm ? (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-200">{confirm === 'restart' ? 'Abandon this voyage and start over?' : 'Abandon this voyage and return to the title?'} <span className="text-slate-400">(No renown is awarded for abandoned voyages.)</span></div>
          <div className="flex gap-2"><Btn kind="danger" onClick={confirm === 'restart' ? p.onRestart : p.onQuit}>Yes</Btn><Btn onClick={() => setConfirm('')}>No</Btn></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Btn kind="primary" onClick={p.onResume}>▶ Resume</Btn>
          <Btn onClick={p.onHelp}>❓ How to Play</Btn>
          <Btn onClick={p.onSettings}>⚙️ Settings</Btn>
          <Btn onClick={() => setConfirm('restart')}>🔄 Restart voyage</Btn>
          <Btn onClick={() => setConfirm('quit')}>🏠 Quit to title</Btn>
        </div>
      )}
    </Modal>
  );
}

export function EndScreen(p: { g: Game; win: boolean; onRetry: () => void; onContinue: () => void; onCharter: () => void; onQuit: () => void }) {
  const { g, win } = p; const s = g.stats; const r = g.result;
  const items: [string, string][] = [
    ['Waves repelled', `${s.waves} (reached ${g.wave})`], ['Ships sunk', String(s.kills)], ['Flagships sunk', String(s.bosses)], ['Damage dealt', fmt(s.dmgDealt)],
    ['Ships grounded', String(s.grounded)], ['Shots fired', String(s.shots)], ['Stone quarried', fmt(s.stoneMined)], ['Iron forged', fmt(s.ironForged)],
    ['Gold earned', fmt(s.goldEarned)], ['Tidal power', fmt(s.powerGen)], ['Flood events', String(s.floods)], ['Buildings lost', String(s.lost)],
    ['Flotsam looted', String(s.flotsam)], ['Deserters', String(s.desertions)], ['Time at sea', `${Math.floor(g.t / 60)}m ${Math.floor(g.t % 60)}s`], ['Difficulty', DIFFS.find((d) => d.id === g.diff.id)?.name || ''],
  ];
  return (
    <Modal wide>
      <div className="text-center">
        <div className={`font-display text-4xl font-extrabold tracking-widest sm:text-5xl ${win ? 'text-amber-200' : 'text-rose-300'}`}>{win ? 'VICTORY' : 'THE CITADEL HAS FALLEN'}</div>
        <div className="mt-1 text-sm text-slate-300">{win ? 'The Drowned King sinks beneath the waves. The tide is yours, Harbormaster.' : 'The sea claims your fortress. The tide will turn again…'}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {items.map(([k, v]) => <div key={k} className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div><div className="text-sm font-bold text-slate-100">{v}</div></div>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 rounded-lg bg-amber-400/10 py-2">
        <div className="text-center"><div className="text-[10px] uppercase text-amber-300/80">Score</div><div className="font-display text-2xl text-amber-200">{fmt(r?.score || 0)}</div></div>
        <div className="text-center"><div className="text-[10px] uppercase text-amber-300/80">Renown gained</div><div className="font-display text-2xl text-amber-200">+{r?.gain || 0} 📜</div></div>
        {g.save.bestScore === (r?.score || -1) && <div className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300">NEW BEST!</div>}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {win && <Btn kind="primary" onClick={p.onContinue}>♾ Continue (endless)</Btn>}
        <Btn kind={win ? 'ghost' : 'primary'} onClick={p.onRetry}>🔄 {win ? 'New voyage' : 'Retry'}</Btn>
        <Btn onClick={p.onCharter}>📜 Spend renown</Btn>
        <Btn onClick={p.onQuit}>🏠 Title</Btn>
      </div>
    </Modal>
  );
}

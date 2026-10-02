import { useMemo, useState } from 'react';
import { DIFFICULTIES, FACTIONS, FINALE_NIGHT, GOODS, GOOD_IDS, KIT, LEGACY, MODIFIERS } from '../game/data';
import type { Game } from '../game/engine';
import { audio } from '../game/audio';
import { cn } from '../utils/cn';
import { click, fmt, Overlay, Pips, Slider, Stat, Toggle } from './Common';
import { FavorTree } from './Favors';

/* ---------------- Title ---------------- */
export function Title({ game, onNew, onHelp, onSettings, onLegacy }: { game: Game; onNew: () => void; onHelp: () => void; onSettings: () => void; onLegacy: () => void }) {
  const stars = useMemo(() => Array.from({ length: 70 }).map(() => ({ x: Math.random() * 100, y: Math.random() * 70, d: Math.random() * 3 })), []);
  const save = game.hasSave();
  const b = game.meta.best;
  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center" style={{ zIndex: 30, background: 'radial-gradient(ellipse at 50% 20%, #3b1f66 0%, #1a1038 40%, #07091a 80%)' }}>
      {stars.map((s, i) => <span key={i} className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }} />)}
      <div className="absolute rounded-full" style={{ top: '6%', right: '14%', width: 'min(18vw,150px)', height: 'min(18vw,150px)', background: 'radial-gradient(circle at 35% 35%, #fff7de, #f2d99a 60%, #c9a45c)', boxShadow: '0 0 80px 20px rgba(255,220,150,.35)' }} />
      <div className="absolute top-0 left-0 right-0 flex justify-around pointer-events-none">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="lantern text-3xl sm:text-4xl" style={{ animationDelay: `${i * 0.37}s`, marginTop: `${(i % 3) * 14}px`, filter: 'drop-shadow(0 0 12px rgba(255,160,60,.8))' }}>🏮</div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1/4 pointer-events-none" style={{ background: 'linear-gradient(0deg, #0a0614, transparent)' }} />
      <div className="relative text-center px-4 anim-fadeUp">
        <div className="text-amber-200/80 tracking-[0.5em] text-xs sm:text-sm font-display mb-2">A NIGHT MARKET OF SECRETS</div>
        <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-amber-100 title-glow leading-tight">Bazaar of<br />Whispers</h1>
        <p className="mt-3 max-w-md mx-auto text-sm sm:text-base text-white/70">Trade in rumors. Bend the prices. Outwit the Magpie before dawn collects its tithe.</p>
        <div className="mt-6 flex flex-col gap-2.5 items-stretch max-w-xs mx-auto">
          {save && <button className="btn btn-gold text-lg py-3" onClick={() => { click(); if (!game.continueRun()) onNew(); }}>▶ Continue Run</button>}
          <button className={cn('btn text-lg py-3', !save && 'btn-gold')} onClick={() => { click(); onNew(); }}>✦ New Game</button>
          <button className="btn" onClick={() => { click(); onLegacy(); }}>🏛️ Broker's Legacy <span className="text-amber-200">({game.meta.marks} marks)</span></button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => { click(); onHelp(); }}>❓ How to Play</button>
            <button className="btn btn-ghost" onClick={() => { click(); onSettings(); }}>⚙ Settings</button>
          </div>
        </div>
        <div className="mt-5 text-xs text-white/45">Best: {b.nights} nights · peak worth {fmt(b.worth)}c · {b.wins} victories · {b.runs} runs</div>
      </div>
    </div>
  );
}

/* ---------------- New game ---------------- */
export function NewGame({ game, onBack }: { game: Game; onBack: () => void }) {
  const [diff, setDiff] = useState(game.run.diff || 'broker');
  const [mods, setMods] = useState<string[]>([]);
  const d = DIFFICULTIES.find(x => x.id === diff)!;
  const bonus = mods.reduce((s, id) => s + (MODIFIERS.find(m => m.id === id)?.marks || 0), 0);
  return (
    <Overlay z={35}>
      <div className="panel w-full max-w-3xl max-h-full overflow-y-auto scroll p-4 sm:p-6 anim-pop">
        <div className="flex justify-between items-start mb-3">
          <div><h2 className="font-display text-2xl text-amber-100">Choose Your Night</h2><p className="text-sm text-white/60">{FINALE_NIGHT} nights to the Masquerade. Pay Madame Vesper's tithe at every dawn.</p></div>
          <button className="btn btn-ghost btn-sm" onClick={() => { click(); onBack(); }}>← Back</button>
        </div>
        <div className="grid sm:grid-cols-3 gap-2.5">
          {DIFFICULTIES.map(x => (
            <button key={x.id} onClick={() => { click(); setDiff(x.id); }} className={cn('card p-3 text-left transition hover:bg-white/10', diff === x.id && 'border-amber-300 bg-amber-300/10 glow-pulse')}>
              <div className="font-display text-lg text-amber-100">{x.name}</div>
              <div className="text-xs text-white/60 mb-2">{x.desc}</div>
              <div className="text-[11px] text-white/70 space-y-0.5"><div>Tithe ×{x.quota}</div><div>Night length {Math.round(x.night)}s</div><div>Heat ×{x.heat}</div><div>Start coin {x.coins}c</div><div>Thieves {x.thieves}</div></div>
            </button>
          ))}
        </div>
        <div className="font-display text-xs uppercase tracking-widest text-amber-200/70 mt-4 mb-2">Modifiers (more legacy marks)</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {MODIFIERS.map(m => <Toggle key={m.id} label={`${m.name}  (+${Math.round(m.marks * 100)}% marks)`} hint={m.desc} on={mods.includes(m.id)} onChange={v => setMods(v ? [...mods, m.id] : mods.filter(x => x !== m.id))} />)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-white/60">Mark multiplier: <b className="text-amber-200">×{(d.marks * (1 + bonus)).toFixed(2)}</b>{!game.meta.tutDone && <span className="ml-3 text-sky-300">🎓 An interactive tutorial will guide your first night.</span>}</div>
          <button className="btn btn-gold text-lg px-8" onClick={() => { click(); audio.init(); audio.startMusic(); game.newRun(diff, mods); }}>Begin the Run</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- Legacy ---------------- */
export function Legacy({ game, onBack }: { game: Game; onBack: () => void }) {
  return (
    <Overlay z={35}>
      <div className="panel w-full max-w-2xl max-h-full overflow-y-auto scroll p-4 sm:p-6 anim-pop">
        <div className="flex justify-between items-start mb-3">
          <div><h2 className="font-display text-2xl text-amber-100">🏛️ Broker's Legacy</h2><p className="text-sm text-white/60">Marks are earned at the end of every run and make every future broker stronger.</p></div>
          <button className="btn btn-ghost btn-sm" onClick={() => { click(); onBack(); }}>← Back</button>
        </div>
        <div className="text-center font-display text-3xl text-amber-200 mb-3">{game.meta.marks} <span className="text-base text-white/50">marks</span></div>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {LEGACY.map(l => {
            const lv = game.leg(l.id); const cost = game.legacyCost(l.id);
            return (
              <div key={l.id} className="card p-3">
                <div className="flex items-center gap-2"><span className="text-2xl">{l.icon}</span><div className="flex-1"><div className="font-display text-amber-100">{l.name}</div><div className="text-xs text-white/60">{l.desc}</div></div></div>
                <div className="mt-2 flex items-center justify-between"><Pips n={lv} max={l.max} /><button className="btn btn-sm btn-gold" disabled={!isFinite(cost) || game.meta.marks < cost} onClick={() => game.buyLegacy(l.id)}>{isFinite(cost) ? `${cost} marks` : 'Maxed'}</button></div>
              </div>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- Help ---------------- */
export function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const tabs = ['The Loop', 'Systems', 'Survival', 'Controls'];
  return (
    <Overlay z={60}>
      <div className="panel w-full max-w-2xl max-h-full flex flex-col anim-pop">
        <div className="flex items-center justify-between p-4 pb-2"><h2 className="font-display text-2xl text-amber-100">How to Play</h2><button className="btn btn-ghost btn-sm" onClick={() => { click(); onClose(); }}>✕ Close</button></div>
        <div className="flex gap-1 px-4 pb-2 flex-wrap">{tabs.map((t, i) => <button key={t} className={cn('tabbtn', tab === i && 'on')} onClick={() => { click(); setTab(i); }}>{t}</button>)}</div>
        <div className="p-4 pt-1 overflow-y-auto scroll text-sm leading-relaxed space-y-2.5">
          {tab === 0 && (<>
            <p>You are a broker in a living night market. Each <b>night</b> lasts a few minutes of real time (8 PM to 5 AM). At dawn Madame Vesper collects a <b>tithe</b>. Pay it for {FINALE_NIGHT} nights and survive the <b>Masquerade</b> to win.</p>
            <p><b>1. Gather</b> – Walk up to people (E) and <i>Eavesdrop</i> or buy rumors. Informants (dotted cyan rings) hold the juiciest ones.</p>
            <p><b>2. Spread</b> – <i>Plant</i> a rumor in a gossip. Colored orbs over a head mean they believe a rumor: <span className="text-orange-300">orange = shortage</span>, <span className="text-sky-300">blue = glut</span>, <span className="text-fuchsia-300">pink = scandal</span>. They pass it on whenever they stand close together.</p>
            <p><b>3. Profit</b> – Stalls that believe a rumor change their prices; a widely believed rumor even moves the whole market. Buy where the news hasn't reached, sell where it has. Or sell the rumor itself.</p>
            <p><b>4. Verify</b> – Every rumor is eventually proven <span className="text-emerald-300">true</span> or <span className="text-red-300">false</span>. True tips earn credibility and favor; lies get you burned and sometimes traced.</p>
          </>)}
          {tab === 1 && (<>
            <p><b>Market</b> – Six goods. Stall price = base × events × crowd belief × the vendor's own beliefs × your trade pressure (each unit you buy/sell nudges it). Specialty goods are cheaper at their own stall. Check the Market tab for arbitrage hints.</p>
            <p><b>Rumors</b> – Value falls as more people know it, and as the night passes. Poise (🌀) pays for eavesdropping, planting, debunking and forging. A <i>forged</i> rumor is only true if a real event happens to agree.</p>
            <p><b>Schedules</b> – Everyone walks a route. Vendors leave to the tavern for a break (stall closed!). Talk to someone to learn their route. Storms drive crowds to the tavern; festivals pull them to the fountain.</p>
            <p><b>Factions</b> – Lantern Guild 🏮, Veiled Court 🎭, Tidewater Syndicate ⚓, Ashen Wardens 🛡️. Rival pairs: Guild vs Syndicate, Court vs Wardens. Sell scandals to the target's rival for a premium. Favor earns perk points in four trees. Scandals sap a faction's influence, which moves the price of its goods.</p>
            <p><b>Credibility</b> – Boosts sale prices and how firmly rumors take hold. Truth Lens upgrades hint at which rumors are real.</p>
            <p><b>Commissions</b> – Three optional jobs each night for coin and favor.</p>
          </>)}
          {tab === 2 && (<>
            <p><b>Heat 🔥</b> – Rises when Wardens see you whispering, notice you eavesdropping, or catch you near contraband (Dream-Smoke). At 100 you are arrested: fined, searched, and you gain a strike. <b>Three strikes ends the run.</b> Bribe a Warden to cool off, or pay off the watch at dusk.</p>
            <p><b>Cutpurses</b> – Hooded thieves stalk you and snatch coin. Dash (Space) away, or chase the fleeing thief and press E / dash into them to recover the loot.</p>
            <p><b>The Magpie 🐦</b> – From night 3 a rival seeds false rumors. Debunk them, profit from them, or collect two debunked Magpie rumors as proof and Expose her. On the final night she tries to corner the entire market: don't let her Grip reach 100%.</p>
            <p><b>Events</b> – Galleons, blights, galas, crackdowns, storms, festivals... Rumors of them circulate before they happen. Tips that come true are gold.</p>
            <p><b>Tithe</b> – If you can't pay, your cargo is liquidated at 60%. If that fails, it's over. Difficulty and modifiers can be changed from the pause menu.</p>
          </>)}
          {tab === 3 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {[['WASD / Arrows', 'Move'], ['Click / tap ground', 'Walk there (hold to steer)'], ['Click / tap person', 'Walk over & talk'], ['E / Enter', 'Talk, or catch a thief'], ['Space / Shift', 'Dash (costs Poise)'], ['1 – 5', 'Switch side panels'], ['Tab', 'Show / hide side panel'], ['Esc / P', 'Close talk or pause'], ['M', 'Mute / unmute'], ['Gamepad', 'Stick move · A talk · X dash · Start pause']].map(([k, v]) => (
                <div key={k} className="contents"><kbd className="card px-2 py-1 text-amber-200 text-xs">{k}</kbd><span className="self-center text-white/75">{v}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- Settings ---------------- */
export function Settings({ game, onClose }: { game: Game; onClose: () => void }) {
  const v = audio.vol; const o = game.meta.opts;
  const [confirm, setConfirm] = useState(false);
  return (
    <Overlay z={60}>
      <div className="panel w-full max-w-md max-h-full overflow-y-auto scroll p-5 anim-pop space-y-3">
        <div className="flex justify-between items-center"><h2 className="font-display text-2xl text-amber-100">Settings</h2><button className="btn btn-ghost btn-sm" onClick={() => { click(); onClose(); }}>✕ Close</button></div>
        <Toggle label="Mute all audio" on={v.muted} onChange={m => game.setVol({ muted: m })} />
        <Slider label="Master volume" value={v.master} onChange={x => game.setVol({ master: x })} />
        <Slider label="Music volume" value={v.music} onChange={x => game.setVol({ music: x })} />
        <Slider label="Effects volume" value={v.sfx} onChange={x => { game.setVol({ sfx: x }); audio.play('coin'); }} />
        <Toggle label="Screen shake" on={o.shake} onChange={x => game.setOpt('shake', x)} />
        <Toggle label="Show names near you" on={o.names} onChange={x => game.setOpt('names', x)} />
        <Toggle label="Full particle effects" on={o.particles} onChange={x => game.setOpt('particles', x)} />
        <div className="pt-2 border-t border-white/10">
          {!confirm ? <button className="btn btn-danger btn-sm w-full" onClick={() => setConfirm(true)}>Erase all saved data…</button> : (
            <div className="flex gap-2 items-center"><span className="text-xs flex-1">This deletes marks, upgrades and your saved run.</span>
              <button className="btn btn-danger btn-sm" onClick={() => { try { localStorage.removeItem('bow_meta_v1'); localStorage.removeItem('bow_run_v1'); } catch { /* none */ } window.location.reload(); }}>Erase</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button></div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- Pause ---------------- */
export function Pause({ game, onHelp, onSettings }: { game: Game; onHelp: () => void; onSettings: () => void }) {
  const [confirm, setConfirm] = useState<null | 'retire' | 'quit'>(null);
  return (
    <Overlay z={50}>
      <div className="panel w-full max-w-md max-h-full overflow-y-auto scroll p-5 anim-pop space-y-2.5">
        <h2 className="font-display text-3xl text-center text-amber-100">Paused</h2>
        <button className="btn btn-gold w-full py-2.5 text-lg" onClick={() => { click(); game.setPaused(false); }}>▶ Resume</button>
        <div className="grid grid-cols-2 gap-2"><button className="btn" onClick={() => { click(); onHelp(); }}>❓ Help</button><button className="btn" onClick={() => { click(); onSettings(); }}>⚙ Settings</button></div>
        <div className="font-display text-[11px] uppercase tracking-widest text-amber-200/70 pt-1">Difficulty (applies immediately)</div>
        <div className="grid grid-cols-3 gap-1.5">{DIFFICULTIES.map(d => <button key={d.id} className={cn('btn btn-sm', game.run.diff === d.id && 'btn-gold')} onClick={() => game.setDiff(d.id)}>{d.name}</button>)}</div>
        <div className="space-y-1">{MODIFIERS.map(m => <Toggle key={m.id} label={m.name} hint={m.desc} on={game.hasMod(m.id)} onChange={() => game.toggleMod(m.id)} />)}</div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button className="btn btn-sm" disabled={!game.hasSave()} onClick={() => { click(); game.continueRun(); }} title="Return to dusk of this night with your last saved state">↺ Restart Night</button>
          <button className="btn btn-sm" onClick={() => { click(); setConfirm('quit'); }}>⌂ Title</button>
        </div>
        <button className="btn btn-danger btn-sm w-full" onClick={() => { click(); setConfirm('retire'); }}>Retire this broker</button>
        {confirm && (
          <div className="card p-3 text-sm text-center space-y-2">
            <div>{confirm === 'retire' ? 'End this run now? You will still earn legacy marks.' : 'Return to the title? Tonight\'s progress is lost; your run resumes at dusk.'}</div>
            <div className="flex gap-2 justify-center"><button className="btn btn-danger btn-sm" onClick={() => { if (confirm === 'retire') game.forfeit(); else game.toTitle(); setConfirm(null); }}>Yes</button><button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>No</button></div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

/* ---------------- Dusk ---------------- */
export function Dusk({ game, onHelp, onSettings }: { game: Game; onHelp: () => void; onSettings: () => void }) {
  const [tab, setTab] = useState<'brief' | 'shop' | 'favor'>('brief');
  const run = game.run; const boss = run.night === FINALE_NIGHT && !run.endless;
  const fc = game.forecast();
  const pts = (['guild', 'court', 'syndicate', 'wardens'] as const).reduce((s, f) => s + game.points(f), 0);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 anim-fadeIn" style={{ zIndex: 30, background: 'radial-gradient(ellipse at 50% 0%, #4a2766 0%, #1a1038 45%, #07091a 90%)' }}>
      <div className="panel w-full max-w-4xl max-h-full flex flex-col anim-pop">
        <div className="p-4 pb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs tracking-[0.4em] text-amber-200/70 font-display">DUSK</div>
            <h2 className="font-display text-2xl sm:text-3xl text-amber-100">{boss ? '🐦 The Masquerade' : `Night ${run.night}`}{run.endless && <span className="text-sm text-white/50"> · endless</span>}</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="chip">🪙 {fmt(run.coins)}c</span><span className="chip">🗝️ {Math.round(run.cred)}</span><span className="chip">⛓️ {run.strikes}/3</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { click(); onHelp(); }}>❓</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { click(); onSettings(); }}>⚙</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { click(); game.toTitle(); }}>⌂</button>
          </div>
        </div>
        <div className="flex gap-1 px-4 pb-2">
          {([['brief', '📜 Briefing'], ['shop', '🧰 Workshop'], ['favor', `🏮 Favors${pts > 0 ? ` (${pts})` : ''}`]] as const).map(([k, l]) => <button key={k} className={cn('tabbtn', tab === k && 'on')} onClick={() => { click(); setTab(k); }}>{l}</button>)}
        </div>
        <div className="px-4 pb-3 overflow-y-auto scroll flex-1 min-h-0">
          {tab === 'brief' && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="card p-3"><div className="text-xs text-white/50">Tithe due at dawn</div><div className="font-display text-3xl text-amber-200">{game.quota}c</div>
                  <div className="text-xs text-white/60">You hold {fmt(run.coins)}c{run.coins >= game.quota ? ' — covered, but upgrades cost coin too.' : ' — you must earn more tonight (cargo is liquidated at 60% if short).'}</div></div>
                {boss && <div className="card p-3 border-purple-400/60"><div className="font-display text-purple-200">🐦 The Magpie moves tonight</div><div className="text-xs text-white/70">She seeds lies every ~10s to corner the market. Her Grip must stay under 100%. Debunk her rumors and expose her with proof. Survive until dawn and pay the tithe.</div></div>}
                <div className="card p-3 text-xs space-y-1"><div className="font-display text-sm text-amber-100">Your satchel</div>
                  {GOOD_IDS.filter(g => run.cargo[g].qty > 0).map(g => <div key={g}>{GOODS[g].icon} {GOODS[g].name} ×{run.cargo[g].qty}</div>)}
                  {game.cargoCount === 0 && <div className="text-white/50">Empty. Capacity {game.cap}.</div>}</div>
                <div className="card p-3 text-xs"><div className="font-display text-sm text-amber-100">Forecast {game.leg('omens') === 0 && <span className="text-white/40 font-sans">(unlock Omen Reading in Legacy)</span>}</div>
                  {fc.map((e, i) => <div key={i}>{e.def.icon} {e.def.name} — expected near {['8 PM', '9 PM', '10 PM', '11 PM', '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM'][Math.min(9, Math.round(e.startT * 9))]}</div>)}
                  {game.leg('omens') > 0 && fc.length === 0 && <div>The omens are quiet.</div>}</div>
              </div>
              <div className="space-y-2">
                <div className="font-display text-sm text-amber-100">Tonight's commissions</div>
                {game.pendingComm.map(c => <div key={c.id} className="card p-2.5"><div className="text-sm font-bold flex justify-between"><span>{c.title}</span><span className="text-amber-200">+{c.coins}c · {FACTIONS[c.faction].icon}+{c.favor}</span></div><div className="text-xs text-white/65">{c.desc}</div></div>)}
                <div className="card p-3 text-xs text-white/65">Difficulty: <b className="text-amber-200">{game.diff.name}</b>{run.mods.length > 0 && <> · {run.mods.map(m => MODIFIERS.find(x => x.id === m)?.name).join(', ')}</>}</div>
              </div>
            </div>
          )}
          {tab === 'shop' && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-2.5">
                {KIT.map(k => {
                  const lv = game.kit(k.id); const cost = game.kitCost(k.id);
                  return (
                    <div key={k.id} className="card p-3">
                      <div className="flex items-center gap-2"><span className="text-2xl">{k.icon}</span><div className="flex-1"><div className="font-display text-amber-100">{k.name}</div><div className="text-xs text-white/60">{k.desc}</div></div></div>
                      <div className="mt-2 flex items-center justify-between"><Pips n={lv} max={k.max} /><button className="btn btn-sm btn-gold" disabled={!isFinite(cost) || run.coins < cost} onClick={() => game.buyKit(k.id)}>{isFinite(cost) ? `${cost}c` : 'Maxed'}</button></div>
                    </div>
                  );
                })}
              </div>
              <div className="card p-3 flex items-center justify-between gap-2"><div><div className="font-display text-amber-100">⛓️ Pay off the watch</div><div className="text-xs text-white/60">Clear one strike ({run.strikes}/3). Strikes never fade on their own.</div></div>
                <button className="btn btn-sm btn-gold" disabled={run.strikes <= 0 || run.coins < game.payOffCost()} onClick={() => game.payOffWatch()}>{game.payOffCost()}c</button></div>
            </div>
          )}
          {tab === 'favor' && <FavorTree game={game} />}
        </div>
        <div className="p-4 pt-2 border-t border-white/10 flex justify-end"><button className="btn btn-gold text-lg px-10 py-2.5" onClick={() => { click(); audio.init(); game.beginNight(); }}>🌙 Open the Market</button></div>
      </div>
    </div>
  );
}

/* ---------------- Dawn ---------------- */
export function Dawn({ game }: { game: Game }) {
  const r = game.report; if (!r) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 anim-fadeIn" style={{ zIndex: 30, background: 'linear-gradient(180deg, #2a1b4a 0%, #7a4a6a 55%, #f0a078 120%)' }}>
      <div className="panel w-full max-w-2xl max-h-full overflow-y-auto scroll p-5 anim-pop space-y-3">
        <div className="text-center"><div className="text-xs tracking-[0.4em] text-amber-200/70 font-display">DAWN</div><h2 className="font-display text-3xl text-amber-100">Night {r.night} complete</h2></div>
        <div className="grid grid-cols-2 gap-2">
          <Stat icon="🪙" k="Tithe paid" v={`${r.quota}c`} />
          <Stat icon="💰" k="Coins kept" v={`${fmt(game.run.coins)}c`} />
          <Stat icon="📦" k="Trade profit" v={`${r.tradeProfit >= 0 ? '+' : ''}${fmt(r.tradeProfit)}c`} />
          <Stat icon="🗣️" k="Rumor income" v={`+${fmt(r.rumorIncome)}c`} />
          <Stat icon="🗝️" k="Credibility" v={`${Math.round(game.run.cred)} (${r.credDelta >= 0 ? '+' : ''}${Math.round(r.credDelta)})`} />
          <Stat icon="📋" k="Commissions" v={r.commissions} />
        </div>
        {r.liquidated > 0 && <div className="card p-2 text-sm text-amber-200">Your cargo was liquidated at 60% to cover the tithe (+{r.liquidated}c).</div>}
        {(r.arrests > 0 || r.robbed > 0) && <div className="card p-2 text-sm text-red-200">{r.arrests > 0 && `Arrested ${r.arrests}×. `}{r.robbed > 0 && `Pickpocketed ${r.robbed}×.`}</div>}
        <div>
          <div className="font-display text-xs uppercase tracking-widest text-amber-200/70 mb-1.5">The truth comes out</div>
          <div className="space-y-1.5">
            {r.resolved.length === 0 && <div className="text-xs text-white/50 italic">You dealt in no rumors tonight.</div>}
            {r.resolved.map((x, i) => <div key={i} className="card p-2 text-xs flex gap-2"><span>{x.state === 'true' ? '✅' : '❌'}</span><div><div>{x.text}</div>{x.note && <div className="text-white/50">{x.note}</div>}</div></div>)}
          </div>
        </div>
        <button className="btn btn-gold w-full py-2.5 text-lg" onClick={() => { click(); game.nextNight(); }}>Continue to Dusk →</button>
      </div>
    </div>
  );
}

/* ---------------- End screens ---------------- */
function StatsGrid({ game }: { game: Game }) {
  const s = game.run.stats;
  const rows: [string, string, string | number][] = [
    ['🌙', 'Nights survived', s.nightsSurvived], ['🪙', 'Coins earned', fmt(s.earned)], ['📈', 'Peak net worth', fmt(s.peakWorth) + 'c'], ['📦', 'Trade profit', fmt(s.tradeProfit) + 'c'],
    ['🛒', 'Trades', s.trades], ['👂', 'Eavesdrops', s.eavesdrops], ['💸', 'Rumors bought', s.rumorsBought], ['🗣️', 'Rumors sold', s.rumorsSold],
    ['🕸️', 'Rumors planted', s.rumorsPlanted], ['🪶', 'Rumors forged', s.rumorsForged], ['✅', 'Rumors proven', s.proven], ['🔎', 'Debunks', s.debunks],
    ['🔗', 'Lies traced', s.traced], ['⛓️', 'Arrests', s.arrests], ['🧤', 'Pockets picked', s.robbed], ['🤲', 'Thieves caught', s.caught],
    ['📋', 'Commissions', s.commissions], ['🐦', 'Magpie exposed', s.exposed],
  ];
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{rows.map(([i, k, v]) => <Stat key={k} icon={i} k={k} v={v} />)}</div>;
}

export function GameOver({ game, onRetry }: { game: Game; onRetry: () => void }) {
  const o = game.over; if (!o) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 anim-fadeIn" style={{ zIndex: 45, background: 'radial-gradient(ellipse at 50% 30%, #4a1020 0%, #14081c 60%, #05030c 100%)' }}>
      <div className="panel w-full max-w-2xl max-h-full overflow-y-auto scroll p-5 anim-pop space-y-3" style={{ borderColor: '#ff6a6a77' }}>
        <div className="text-center"><div className="text-5xl mb-1">{o.reason === 'prison' ? '⛓️' : o.reason === 'cornered' ? '🐦' : o.reason === 'forfeit' ? '🎭' : '🕯️'}</div>
          <h2 className="font-display text-3xl text-red-200">{o.title}</h2><p className="text-sm text-white/70 mt-1 max-w-md mx-auto">{o.text}</p></div>
        <StatsGrid game={game} />
        <div className="text-center card p-2">Legacy marks earned: <b className="text-amber-200 text-lg">+{game.marksGained}</b> <span className="text-white/50 text-xs">(total {game.meta.marks})</span></div>
        <div className="grid grid-cols-2 gap-2"><button className="btn btn-gold py-2.5" onClick={() => { click(); onRetry(); }}>↺ Retry</button><button className="btn py-2.5" onClick={() => { click(); game.toTitle(); }}>⌂ Title / Legacy</button></div>
      </div>
    </div>
  );
}

export function Victory({ game, onRetry }: { game: Game; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 anim-fadeIn" style={{ zIndex: 45, background: 'radial-gradient(ellipse at 50% 20%, #7a5a1a 0%, #2a1a4a 55%, #07091a 100%)' }}>
      <div className="panel w-full max-w-2xl max-h-full overflow-y-auto scroll p-5 anim-pop space-y-3" style={{ borderColor: '#f2c14e' }}>
        <div className="text-center"><div className="text-5xl mb-1">👑</div><h2 className="font-display text-3xl text-amber-100 title-glow">Master of Whispers</h2>
          <p className="text-sm text-white/75 mt-1 max-w-md mx-auto">Dawn breaks over the Masquerade. The Magpie's net unravels, the tithe is paid, and every stall in the bazaar now waits to hear what <i>you</i> have heard.</p></div>
        <StatsGrid game={game} />
        <div className="text-center card p-2">Legacy marks earned: <b className="text-amber-200 text-lg">+{game.marksGained}</b> <span className="text-white/50 text-xs">(total {game.meta.marks})</span></div>
        <div className="grid sm:grid-cols-3 gap-2"><button className="btn btn-gold py-2.5" onClick={() => { click(); game.continueEndless(); }}>∞ Keep Brokering</button><button className="btn py-2.5" onClick={() => { click(); onRetry(); }}>↺ New Run</button><button className="btn py-2.5" onClick={() => { click(); game.toTitle(); }}>⌂ Title</button></div>
      </div>
    </div>
  );
}

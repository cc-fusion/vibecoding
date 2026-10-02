import { useState, useEffect, type ReactNode } from 'react';
import { DIFFS, MODS, PERKS, START_YEAR } from '../game/data';
import { loadMeta, saveMeta, resetMeta, type Meta } from '../game/store';
import { audio } from '../game/audio';
import type { Game, GameOpts } from '../game/sim';
import { Modal, Kbd, short, money } from './common';

/* ---------- persistent UI options ---------- */
const OKEY = 'frb_ui_v1';
export const uiOpts: { shake: boolean } = (() => {
  try { const s = localStorage.getItem(OKEY); if (s) return { shake: true, ...JSON.parse(s) }; } catch { /* ignore */ }
  return { shake: true };
})();
export function saveUiOpts() { try { localStorage.setItem(OKEY, JSON.stringify(uiOpts)); } catch { /* ignore */ } }

/* ---------- Title ---------- */
export function TitleScreen({ onNew, onTutorial, onLegacy, onHelp, onSettings }: { onNew: () => void; onTutorial: () => void; onLegacy: () => void; onHelp: () => void; onSettings: () => void }) {
  const meta = loadMeta();
  const b = (fn: () => void) => () => { audio.sfx('click'); fn(); };
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#f3b36a 0%,#e07a4a 38%,#7a3a3a 70%,#2a1810 100%)' }}>
      <div className="absolute rounded-full" style={{ left: '62%', top: '16%', width: 120, height: 120, background: 'radial-gradient(circle,#fff3c0,#ffd070 60%,rgba(255,200,100,0))', filter: 'blur(1px)' }} />
      {[8, 22, 14].map((t, i) => <div key={i} className="absolute text-6xl opacity-60" style={{ top: `${t}%`, animation: `cloud ${70 + i * 30}s linear infinite`, animationDelay: `${-i * 25}s` }}>☁️</div>)}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1200 400" preserveAspectRatio="none" style={{ height: '46%' }}>
        <polygon fill="#5a2c32" points="0,400 0,200 120,110 220,190 330,80 450,200 560,130 700,210 820,100 940,190 1060,120 1200,200 1200,400" />
        <polygon fill="#3a1c1e" points="0,400 0,280 160,220 300,290 460,230 640,300 800,240 980,300 1200,250 1200,400" />
        <rect y="340" width="1200" height="60" fill="#1c0f0a" />
      </svg>
      <div className="absolute left-0 w-full" style={{ bottom: '6.5%', height: 2, background: '#6a5a4a' }} />
      <div className="absolute text-4xl whitespace-nowrap" style={{ bottom: '6.5%', animation: 'trainrun 16s linear infinite' }}>🚂🚃🚃🚃🚃</div>
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
        <div className="text-[#ffe9b0] tracking-[0.3em] text-xs md:text-sm mb-2 opacity-90">A RAILWAY TYCOON OF THE AMERICAN FRONTIER · {START_YEAR}</div>
        <h1 className="font-western text-5xl md:text-8xl text-[#ffe08a] drop-shadow-[0_4px_0_#5a2a10]" style={{ textShadow: '0 4px 0 #7a3a10, 0 8px 18px rgba(0,0,0,0.5)' }}>Frontier<br className="md:hidden" /> Rail Baron</h1>
        <p className="mt-3 max-w-xl text-[#fff0d0] text-sm md:text-base" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>Lay rails across prairie, mountain and river. Grow the towns. Trade stock. Take over rivals. Burn their depots. Drive the Golden Spike.</p>
        <div className="mt-6 grid gap-2 w-[min(320px,90vw)]">
          <button className="btn btn-gold !text-lg !py-3" onClick={b(onNew)}>🚂 New Campaign</button>
          <button className="btn !py-2.5" onClick={b(onTutorial)}>🎓 Interactive Tutorial</button>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn" onClick={b(onLegacy)}>🏛 Legacy</button>
            <button className="btn" onClick={b(onHelp)}>❓ Help</button>
            <button className="btn" onClick={b(onSettings)}>⚙ Audio</button>
          </div>
        </div>
        <div className="mt-5 text-xs text-[#ffe9b0]/90 flex flex-wrap gap-x-5 gap-y-1 justify-center">
          <span>Legacy Points: <b>{meta.lp}</b></span><span>Campaigns: <b>{meta.runs}</b></span><span>Victories: <b>{meta.wins}</b></span><span>Golden Spikes: <b>{meta.spikes}</b></span>
        </div>
        {meta.best.length > 0 && (
          <div className="mt-3 text-[11px] text-[#ffe9b0]/80">Best: {meta.best.slice(0, 3).map((r) => `${r.name} ${short(r.score)} (${r.diff})`).join(' · ')}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- Setup ---------- */
export function SetupScreen({ onStart, onBack }: { onStart: (o: GameOpts) => void; onBack: () => void }) {
  const meta = loadMeta();
  const [name, setName] = useState('Frontier & Western');
  const [diff, setDiff] = useState('railroader');
  const [mods, setMods] = useState<string[]>([]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 99999));
  const [tut, setTut] = useState(!meta.tutorialDone);
  const mult = (DIFFS.find((d) => d.id === diff)?.lpMul || 1) * mods.reduce((a, id) => a * (MODS.find((m) => m.id === id)?.lpMul || 1), 1);
  return (
    <div className="absolute inset-0 overflow-y-auto scroll flex items-start md:items-center justify-center p-3" style={{ background: 'radial-gradient(ellipse at top,#4a3020,#1b120b)' }}>
      <div className="panel rounded-lg p-5 w-[760px] max-w-full anim-fadein">
        <h2 className="font-western text-3xl text-[#ffe08a] mb-1">Charter Your Railroad</h2>
        <p className="text-sm opacity-75 mb-4">{START_YEAR}-{START_YEAR + 15}. Choose your terms, Baron.</p>
        <div className="grid md:grid-cols-[1fr_auto] gap-3 mb-4">
          <label className="text-xs">Company name<input type="text" className="w-full mt-1" maxLength={26} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-xs">Map seed
            <div className="flex gap-1 mt-1"><input type="number" className="w-28" value={seed} onChange={(e) => setSeed(Math.abs(+e.target.value | 0))} /><button className="btn btn-sm" onClick={() => { audio.sfx('click'); setSeed(Math.floor(Math.random() * 99999)); }}>🎲</button></div>
          </label>
        </div>
        <div className="font-western text-sm text-[#e0b050] mb-1">Difficulty</div>
        <div className="grid md:grid-cols-3 gap-2 mb-4">
          {DIFFS.map((d) => (
            <button key={d.id} className={`card p-3 text-left transition ${diff === d.id ? 'outline outline-2 outline-[#e0b050] bg-[#e0b050]/15' : 'hover:bg-white/5'}`} onClick={() => { audio.sfx('click'); setDiff(d.id); }}>
              <div className="font-bold text-[#ffe08a]">{d.name}</div>
              <div className="text-xs opacity-80 mt-0.5">{d.desc}</div>
              <div className="text-[11px] mt-1 opacity-70">Start {money(d.cash)} · Goal {short(d.target)}</div>
            </button>
          ))}
        </div>
        <div className="font-western text-sm text-[#e0b050] mb-1">Modifiers <span className="font-sans text-xs opacity-60">(Legacy Point bonus)</span></div>
        <div className="grid md:grid-cols-2 gap-2 mb-4">
          {MODS.map((m) => {
            const on = mods.includes(m.id);
            return (
              <button key={m.id} className={`card p-2 text-left ${on ? 'outline outline-2 outline-[#e0b050] bg-[#e0b050]/15' : 'hover:bg-white/5'}`} onClick={() => { audio.sfx('click'); setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id]); }}>
                <div className="font-bold text-sm">{on ? '☑' : '☐'} {m.name} <span className="text-[11px] text-[#9fe08a]">x{m.lpMul}</span></div>
                <div className="text-xs opacity-75">{m.desc}</div>
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer"><input type="checkbox" checked={tut} onChange={(e) => setTut(e.target.checked)} /> Guided tutorial hints (rivals sleep until you finish them)</label>
        <div className="flex items-center justify-between">
          <button className="btn" onClick={() => { audio.sfx('click'); onBack(); }}>← Back</button>
          <span className="text-xs opacity-70 hidden md:block">Legacy Point multiplier: <b>x{mult.toFixed(2)}</b></span>
          <button className="btn btn-gold !px-6 !py-2.5 !text-base" onClick={() => { audio.sfx('whistle'); onStart({ seed, diffId: diff, mods, name: name.trim() || 'Frontier & Western', tutorial: tut }); }}>All Aboard! →</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Legacy ---------- */
export function LegacyScreen({ onBack }: { onBack: () => void }) {
  const [meta, setMeta] = useState<Meta>(() => ({ ...loadMeta() }));
  const [confirm, setConfirm] = useState(false);
  const buy = (id: string) => {
    const p = PERKS.find((x) => x.id === id)!;
    const lv = meta.perks[id] || 0;
    if (lv >= p.max || meta.lp < p.cost[lv]) { audio.sfx('error'); return; }
    const m = { ...meta, lp: meta.lp - p.cost[lv], perks: { ...meta.perks, [id]: lv + 1 } };
    saveMeta(m); setMeta(m); audio.sfx('cash');
  };
  return (
    <div className="absolute inset-0 overflow-y-auto scroll flex items-start md:items-center justify-center p-3" style={{ background: 'radial-gradient(ellipse at top,#3a2a40,#150f1a)' }}>
      <div className="panel rounded-lg p-5 w-[760px] max-w-full anim-fadein">
        <div className="flex items-start justify-between">
          <div><h2 className="font-western text-3xl text-[#ffe08a]">The Legacy Ledger</h2><p className="text-sm opacity-75">Your name echoes across campaigns. Spend Legacy Points on permanent advantages.</p></div>
          <div className="text-right"><div className="text-xs opacity-70">Legacy Points</div><div className="text-3xl font-bold text-[#ffe08a]">{meta.lp}</div></div>
        </div>
        <div className="grid md:grid-cols-2 gap-2 my-4">
          {PERKS.map((p) => {
            const lv = meta.perks[p.id] || 0;
            const maxed = lv >= p.max;
            const cost = maxed ? 0 : p.cost[lv];
            return (
              <div key={p.id} className="card p-3">
                <div className="flex justify-between items-center"><b>{p.icon} {p.name}</b><span className="text-xs opacity-70">Lv {lv}/{p.max}</span></div>
                <div className="text-xs opacity-80 my-1">{p.desc}</div>
                <div className="flex gap-1 mb-2">{Array.from({ length: p.max }).map((_, i) => <div key={i} className="h-1.5 flex-1 rounded" style={{ background: i < lv ? '#e0b050' : 'rgba(255,255,255,0.12)' }} />)}</div>
                <button className="btn btn-sm w-full" disabled={maxed || meta.lp < cost} onClick={() => buy(p.id)}>{maxed ? 'Maxed' : `Upgrade · ${cost} LP`}</button>
              </div>
            );
          })}
        </div>
        {meta.best.length > 0 && (
          <div className="mb-4"><div className="font-western text-sm text-[#e0b050] mb-1">Hall of Barons</div>
            <div className="grid gap-1 text-xs">{meta.best.map((r, i) => <div key={i} className="card px-2 py-1 flex justify-between"><span>{i + 1}. {r.name} · {r.result} ({r.diff}, {r.year})</span><b>{short(r.score)}</b></div>)}</div>
          </div>
        )}
        <div className="flex justify-between">
          <button className="btn" onClick={() => { audio.sfx('click'); onBack(); }}>← Back</button>
          {confirm ? <button className="btn btn-red btn-sm" onClick={() => { resetMeta(); setMeta({ ...loadMeta() }); setConfirm(false); }}>Really erase all progress?</button> : <button className="btn btn-sm" onClick={() => setConfirm(true)}>Reset progress</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Help ---------- */
const HELP: { id: string; title: string; body: ReactNode }[] = [
  { id: 'goal', title: 'Goal', body: (<>
    <p>It is {START_YEAR}. The continent is wild. Build a railroad empire and outlast three rival barons.</p>
    <ul className="list-disc pl-5 mt-2 grid gap-1">
      <li><b>Empire:</b> link the west coast to the east coast <i>first</i> (the Golden Spike) and reach the target net worth.</li>
      <li><b>Tycoon:</b> be the richest baron when the final year dawns.</li>
      <li><b>Monopoly:</b> take over every rival through the stock market.</li>
      <li><b>You lose</b> by bankruptcy (3 months overdrawn), a hostile takeover (a rival owns more than half your shares), or by finishing behind another baron.</li>
    </ul></>) },
  { id: 'build', title: 'Building', body: (<>
    <p>Stations collect cargo within <b>3 tiles</b>. Towns make passengers and mail, mines coal, farms grain, lumber camps timber. Factories turn coal + timber into valuable goods.</p>
    <ul className="list-disc pl-5 mt-2 grid gap-1">
      <li>Track cost depends on terrain: prairie is cheap; forests, hills, mountain tunnels and river bridges are not. The pathfinder takes the cheapest route.</li>
      <li>Revenue grows with <b>distance</b>, falls as cargo ages, and varies by cargo type.</li>
      <li>Towns grow when served by passengers/mail and supplied with grain and goods. Bigger towns generate more cargo.</li>
      <li>Rival stations in range share the same cargo: a better rating (frequent, fast service) wins the bigger slice.</li>
      <li>Rival track cannot be crossed. Plan your routes early!</li>
    </ul></>) },
  { id: 'trains', title: 'Trains', body: (<>
    <p>Buy locomotives and give them a <b>timetable</b>: an ordered list of stops with orders (Load/Unload, Full load, Unload only) and dwell time.</p>
    <ul className="list-disc pl-5 mt-2 grid gap-1">
      <li>Trains load only cargo that another stop on their timetable accepts.</li>
      <li>Stations have limited platforms; extra trains queue. Add platforms to relieve congestion.</li>
      <li>Wear builds as trains run; worn trains slow down and break down. Service them or build a depot.</li>
      <li>Hills, mountains, winter and blizzards slow trains. Heavier locomotives handle grades better.</li>
    </ul></>) },
  { id: 'market', title: 'Stock Market', body: (<>
    <p>Every company is publicly traded. Prices follow net worth and profit, with sentiment swinging on news, sabotage, dividends and your own trades.</p>
    <ul className="list-disc pl-5 mt-2 grid gap-1">
      <li>Borrow from the bank (7.5% a year) or issue new shares, which dilutes your stake.</li>
      <li>Buy rival stock for dividends and profit. Own more than 50% of a rival and you can absorb its entire network.</li>
      <li>Keep over 50% of your own company: Vandermoor will quietly buy your shares if you let your stake slip.</li>
    </ul></>) },
  { id: 'rivals', title: 'Rivals & Sabotage', body: (<>
    <p>Three AI barons build real lines, run trains and compete for your cargo. <b>Vandermoor Pacific</b> races you to the Golden Spike.</p>
    <ul className="list-disc pl-5 mt-2 grid gap-1">
      <li>Spend money to derail trains, torch depots, cut rails, incite strikes or spread rumors. Success depends on the victim's security.</li>
      <li>Agents can be caught: fines, lost reputation and rising <b>notoriety</b>. At 100 notoriety, federal marshals shut you down.</li>
      <li>Hire security details to protect yourself. Rivals hold grudges and retaliate.</li>
    </ul></>) },
  { id: 'events', title: 'Events & Jobs', body: (<>
    <p>The frontier is volatile: <b>blizzards</b> slow trains, <b>floods</b> wash out bridges (use Repair), <b>gold rushes</b> boom towns, <b>droughts</b> and <b>wildfires</b> halt industries, <b>bandits</b> rob trains, <b>strikes</b> idle fleets, <b>panics</b> crash the market and <b>land grants</b> cut track costs.</p>
    <p className="mt-2">Accept <b>contracts</b> for bonus pay (late delivery costs reputation) and use the <b>Engineering Office</b> to unlock better locomotives, cheaper track, signals, telegraph and more. Legacy Points earned after each campaign buy permanent perks.</p></>) },
  { id: 'controls', title: 'Controls', body: (
    <div className="grid md:grid-cols-2 gap-3 text-xs">
      <div className="card p-2"><b className="text-[#ffe08a]">Mouse</b><div className="grid gap-1 mt-1"><div><Kbd>Left click</Kbd> use tool / select</div><div><Kbd>Drag</Kbd> pan the map</div><div><Kbd>Wheel</Kbd> zoom</div><div><Kbd>Right click</Kbd> cancel track</div><div><Kbd>Minimap</Kbd> click to jump</div></div></div>
      <div className="card p-2"><b className="text-[#ffe08a]">Keyboard</b><div className="grid gap-1 mt-1"><div><Kbd>WASD</Kbd> / <Kbd>Arrows</Kbd> pan</div><div><Kbd>+</Kbd> <Kbd>-</Kbd> zoom</div><div><Kbd>V</Kbd> select <Kbd>T</Kbd> track <Kbd>B</Kbd> station <Kbd>X</Kbd> demolish</div><div><Kbd>Space</Kbd> pause <Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd> speed</div><div><Kbd>Esc</Kbd> cancel / menu <Kbd>M</Kbd> mute <Kbd>H</Kbd> help</div></div></div>
      <div className="card p-2 md:col-span-2"><b className="text-[#ffe08a]">Touch</b><div className="mt-1">Drag to pan, pinch to zoom, tap to select. With the Track tool: tap the start, tap the destination to preview the route and cost, then tap it again (or press Build) to confirm.</div></div>
    </div>) },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('goal');
  const cur = HELP.find((h) => h.id === tab) || HELP[0];
  return (
    <Modal onClose={onClose} wide>
      <div className="flex justify-between items-center mb-3"><h2 className="font-western text-2xl text-[#ffe08a]">Baron's Handbook</h2><button className="btn btn-sm" onClick={() => { audio.sfx('click'); onClose(); }}>✕ Close</button></div>
      <div className="flex flex-wrap gap-1 mb-3">{HELP.map((h) => <button key={h.id} className={`btn btn-sm ${tab === h.id ? 'btn-on' : ''}`} onClick={() => { audio.sfx('tab'); setTab(h.id); }}>{h.title}</button>)}</div>
      <div className="text-sm leading-relaxed">{cur.body}</div>
    </Modal>
  );
}

/* ---------- Settings ---------- */
export function SettingsModal({ onClose, g }: { onClose: () => void; g?: Game }) {
  const [, force] = useState(0);
  const s = audio.settings;
  const set = (p: Partial<typeof s>) => { audio.init(); audio.set(p); force((x) => x + 1); };
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => (
    <label className="grid grid-cols-[90px_1fr_40px] items-center gap-2 text-sm">{label}
      <input type="range" min={0} max={1} step={0.01} value={s[key]} onChange={(e) => set({ [key]: +e.target.value })} onPointerUp={() => audio.sfx('click')} />
      <span className="text-xs">{Math.round(s[key] * 100)}%</span>
    </label>
  );
  return (
    <Modal onClose={onClose}>
      <div className="flex justify-between items-center mb-3"><h2 className="font-western text-2xl text-[#ffe08a]">Settings</h2><button className="btn btn-sm" onClick={onClose}>✕ Close</button></div>
      <div className="grid gap-3">
        {slider('Master', 'master')}{slider('Music', 'music')}{slider('Effects', 'sfx')}
        <div className="flex gap-2 flex-wrap">
          <button className={`btn ${s.muted ? 'btn-red' : ''}`} onClick={() => set({ muted: !s.muted })}>{s.muted ? '🔇 Muted' : '🔊 Sound on'}</button>
          <button className={`btn ${uiOpts.shake ? 'btn-on' : ''}`} onClick={() => { uiOpts.shake = !uiOpts.shake; saveUiOpts(); force((x) => x + 1); }}>Screen shake: {uiOpts.shake ? 'On' : 'Off'}</button>
          <button className="btn" onClick={() => { audio.init(); audio.sfx('whistle'); }}>Test whistle</button>
        </div>
        {g && (
          <div>
            <div className="text-sm font-bold text-[#e0b050] mb-1">Difficulty (changeable mid-game)</div>
            <div className="grid grid-cols-3 gap-1">{DIFFS.map((d) => <button key={d.id} className={`btn ${g.diff.id === d.id ? 'btn-on' : ''}`} onClick={() => { g.diff = d; force((x) => x + 1); audio.sfx('click'); }}>{d.name}</button>)}</div>
            <div className="text-xs opacity-70 mt-1">{g.diff.desc} Goal net worth {short(g.diff.target)}.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- End screen ---------- */
export function EndScreen({ g, onAgain, onSetup, onTitle, onFree }: { g: Game; onAgain: () => void; onSetup: () => void; onTitle: () => void; onFree: () => void }) {
  const o = g.over!;
  const ranks = g.rankings();
  const [, setN] = useState(0);
  useEffect(() => { setN(1); }, []);
  const win = o.result === 'win';
  const st = o.stats;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto scroll" style={{ background: win ? 'radial-gradient(ellipse at center,rgba(90,70,20,0.88),rgba(10,8,2,0.95))' : 'radial-gradient(ellipse at center,rgba(70,20,15,0.88),rgba(8,2,2,0.96))' }}>
      <div className="panel rounded-lg p-6 w-[720px] max-w-full anim-pop text-center my-auto">
        <div className="text-5xl mb-1">{win ? '🏆' : '💀'}</div>
        <h2 className="font-western text-4xl" style={{ color: win ? '#ffe08a' : '#ff8a7a' }}>{o.title}</h2>
        <p className="mt-2 text-sm opacity-90 max-w-lg mx-auto">{o.text}</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="card p-2"><div className="opacity-60">Net worth</div><b className="text-base text-[#ffe08a]">{short(o.worth)}</b></div>
          <div className="card p-2"><div className="opacity-60">Rank</div><b className="text-base">#{o.rank} of {ranks.length}</b></div>
          <div className="card p-2"><div className="opacity-60">Time played</div><b className="text-base">{o.years.toFixed(1)} yrs</b></div>
          <div className="card p-2"><div className="opacity-60">Legacy Points</div><b className="text-base text-[#9fe08a]">+{o.lp}</b></div>
        </div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[11px]">
          {[['Cargo delivered', Math.round(st.delivered).toLocaleString()], ['Revenue', short(st.revenue)], ['Track laid', `${st.tracks} tiles`], ['Trains bought', st.trainsBought], ['Contracts done', st.contracts], ['Sabotage', st.sabotageDone], ['Times caught', st.caught], ['Rivals absorbed', st.absorbed], ['Peak worth', short(st.peakWorth)], ['Events', st.events], ['Sabotaged', st.sabotageHit], ['Golden Spike', o.spike ? 'Yes' : 'No']].map(([k, v]) => (
            <div key={String(k)} className="card px-2 py-1 flex justify-between"><span className="opacity-70">{k}</span><b>{v}</b></div>
          ))}
        </div>
        <div className="mt-3 text-xs grid gap-1">
          {ranks.map((r, i) => <div key={r.c.id} className="flex justify-between card px-2 py-1"><span style={{ color: r.c.color }}>{i + 1}. {r.c.name}</span><b>{short(r.w)}</b></div>)}
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button className="btn btn-gold" onClick={() => { audio.sfx('click'); onAgain(); }}>↻ Retry same map</button>
          <button className="btn" onClick={() => { audio.sfx('click'); onSetup(); }}>New campaign</button>
          {win && g.over?.title !== 'HOSTILE TAKEOVER' && <button className="btn btn-green" onClick={() => { audio.sfx('click'); onFree(); }}>Keep playing (sandbox)</button>}
          <button className="btn" onClick={() => { audio.sfx('click'); onTitle(); }}>Title screen</button>
        </div>
      </div>
    </div>
  );
}

import { ReactNode } from 'react';
import { DEFS, MANUAL_ORDER } from '../game/engine';
import { LEVELS } from '../game/levels';
import { Save, UPGRADES, upgradeCost } from '../game/save';
import { sfx } from '../game/audio';
import Tile, { ACTIVE_INFO, IDLE_INFO } from './Tile';
import { Robot } from './Hud';

function gearD(teeth: number, ro: number, ri: number) {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  const pt = (a: number, r: number) => `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  for (let k = 0; k < teeth; k++) {
    const a = k * step;
    pts.push(pt(a - step * 0.3, ri), pt(a - step * 0.17, ro), pt(a + step * 0.17, ro), pt(a + step * 0.3, ri));
  }
  return 'M' + pts.join('L') + 'Z';
}

export function GearBackdrop() {
  const gears = [
    { x: 8, y: 14, r: 150, t: 16, rev: false, o: 0.1 },
    { x: 92, y: 80, r: 210, t: 20, rev: true, o: 0.09 },
    { x: 80, y: 8, r: 90, t: 12, rev: true, o: 0.1 },
    { x: 14, y: 88, r: 120, t: 14, rev: false, o: 0.09 },
    { x: 50, y: 50, r: 260, t: 24, rev: false, o: 0.04 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {gears.map((g, k) => (
        <svg
          key={k}
          className={g.rev ? 'gear-bg-rev' : 'gear-bg'}
          style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y}%`, width: g.r * 2, height: g.r * 2, marginLeft: -g.r, marginTop: -g.r, opacity: g.o }}
          viewBox={`${-g.r} ${-g.r} ${g.r * 2} ${g.r * 2}`}
        >
          <path d={gearD(g.t, g.r, g.r * 0.85)} fill="#c9973d" />
          <circle r={g.r * 0.6} fill="#140d07" />
          <circle r={g.r * 0.12} fill="#c9973d" />
        </svg>
      ))}
    </div>
  );
}

function Shell({ title, onBack, right, children }: { title: string; onBack: () => void; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="workshop-bg relative min-h-screen">
      <GearBackdrop />
      <div className="relative mx-auto max-w-5xl p-4">
        <div className="mb-4 flex items-center gap-3">
          <button className="btn-dark" onClick={() => { sfx.click(); onBack(); }}>◀ Back</button>
          <h1 className="font-display flex-1 text-center text-2xl font-extrabold text-amber-200 sm:text-4xl">{title}</h1>
          <div className="min-w-[88px] text-right">{right}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Title({
  save, onCampaign, onOvertime, onWorkshop, onManual, muted, onMute,
}: { save: Save; onCampaign: () => void; onOvertime: () => void; onWorkshop: () => void; onManual: () => void; muted: boolean; onMute: () => void }) {
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  return (
    <div className="workshop-bg relative flex min-h-screen items-center justify-center p-4">
      <GearBackdrop />
      <div className="relative z-10 w-full max-w-xl text-center">
        <div className="mb-1 text-xs uppercase tracking-[0.4em] text-amber-100/50">Professor Cogsworth's Repair Shop presents</div>
        <h1 className="font-display text-5xl font-extrabold leading-tight text-amber-200 drop-shadow-[0_4px_0_#4a3210] sm:text-7xl">
          Clockwork
          <br />
          <span className="text-amber-400">Automaton</span> Repair
        </h1>
        <div className="my-4 flex items-end justify-center gap-4">
          <Robot mood="idle" size={90} seed={1} />
          <Robot mood="working" size={110} seed={3} />
          <Robot mood="idle" size={90} seed={5} />
        </div>
        <p className="mx-auto mb-5 max-w-md text-sm text-amber-100/70">
          Wire gears, route steam conduits and chain logic gates to repair malfunctioning automatons before their boilers explode.
        </p>
        <div className="mx-auto flex max-w-xs flex-col gap-3">
          <button className="btn-brass py-3 text-xl" onClick={() => { sfx.unlock(); sfx.click(); onCampaign(); }}>
            ⚙ Repair Jobs
          </button>
          <button className="btn-brass py-2 text-lg" onClick={() => { sfx.unlock(); sfx.click(); onOvertime(); }}>
            ⏱ Overtime Shifts {save.otBest > 0 && <span className="text-sm opacity-70">(best {save.otBest})</span>}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-dark" onClick={() => { sfx.unlock(); sfx.click(); onWorkshop(); }}>🔩 Workshop</button>
            <button className="btn-dark" onClick={() => { sfx.unlock(); sfx.click(); onManual(); }}>📖 Manual</button>
          </div>
          <button className="btn-dark text-sm" onClick={onMute}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
        </div>
        <div className="mt-5 text-sm text-amber-100/60">
          ⚙ {save.cogs} cogs &nbsp;•&nbsp; ★ {totalStars}/{LEVELS.length * 3}
        </div>
      </div>
    </div>
  );
}

export function LevelSelect({ save, onPlay, onBack }: { save: Save; onPlay: (i: number) => void; onBack: () => void }) {
  return (
    <Shell title="Repair Jobs" onBack={onBack} right={<span className="text-sm text-amber-200">⚙ {save.cogs}</span>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((lv, i) => {
          const unlocked = i === 0 || (save.stars[LEVELS[i - 1].id] || 0) > 0;
          const stars = save.stars[lv.id] || 0;
          return (
            <button
              key={lv.id}
              disabled={!unlocked}
              onClick={() => { sfx.unlock(); sfx.click(); onPlay(i); }}
              className={`brass-panel fade-in flex items-center gap-3 p-3 text-left transition ${unlocked ? 'hover:-translate-y-0.5 hover:brightness-125' : 'opacity-40'}`}
              style={{ animationDelay: `${i * 40}ms`, cursor: unlocked ? 'pointer' : 'not-allowed' }}
            >
              <div className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-amber-700 bg-black/50 text-2xl font-extrabold text-amber-300">
                {unlocked ? i + 1 : '🔒'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display truncate text-lg font-bold text-amber-200">{lv.name}</div>
                <div className="truncate text-xs text-amber-100/60">{lv.patient}</div>
                <div className="mt-1 text-lg">
                  {[1, 2, 3].map((s) => (
                    <span key={s} className={s <= stars ? 'text-yellow-300' : 'text-stone-700'}>★</span>
                  ))}
                  {save.score[lv.id] ? <span className="ml-2 text-xs text-amber-100/60">best {save.score[lv.id]}</span> : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-amber-100/50">Clear a job to unlock the next one. Finish with low pressure for more stars and cogs.</p>
    </Shell>
  );
}

export function Workshop({ save, onBuy, onBack }: { save: Save; onBuy: (id: string) => void; onBack: () => void }) {
  return (
    <Shell title="The Workshop" onBack={onBack} right={<span className="text-lg font-bold text-amber-200">⚙ {save.cogs}</span>}>
      <p className="mb-4 text-center text-sm text-amber-100/70">Spend cogs earned from repairs on permanent shop upgrades.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const lvl = save.upgrades[u.id] || 0;
          const maxed = lvl >= u.max;
          const cost = upgradeCost(u, lvl);
          const can = !maxed && save.cogs >= cost;
          return (
            <div key={u.id} className="brass-panel flex flex-col gap-2 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-700 bg-black/50 text-2xl text-amber-300">{u.icon}</div>
                <div className="flex-1">
                  <div className="font-display text-lg font-bold text-amber-200">{u.name}</div>
                  <div className="text-xs text-amber-100/70">{u.desc}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {Array.from({ length: u.max }, (_, k) => (
                    <div key={k} className={`h-3 w-6 rounded ${k < lvl ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-stone-800'}`} />
                  ))}
                </div>
                <button className="btn-brass text-sm" disabled={!can} onClick={() => onBuy(u.id)}>
                  {maxed ? 'MAX' : `Buy ⚙ ${cost}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function Manual({ onBack }: { onBack: () => void }) {
  const groups: { title: string; kinds: string[]; blurb: string }[] = [
    { title: 'Steam Conduits', kinds: ['steam'], blurb: 'Boilers push steam through pipes. Pipes connect only where openings face each other. Open ends that carry steam LEAK, and leaks make the boiler heat up faster.' },
    { title: 'Gear Trains', kinds: ['gear'], blurb: 'Steam engines turn clockwise. Every neighbouring gear spins the opposite way, so direction depends on the checkerboard parity of the tile. Two engines that disagree will JAM the train.' },
    { title: 'Logic & Signals', kinds: ['logic'], blurb: 'Wires carry ON/OFF signals. Dynamos make signals from spinning gears; relay valves and clutches take signals back into the steam and gear networks.' },
    { title: 'Misc', kinds: ['misc'], blurb: 'Bolted plates block your way.' },
  ];
  const order = (k: string) => MANUAL_ORDER.filter((t) => DEFS[t].kind === k || (k === 'steam' && ['V'].includes(t) && false));
  const show = (g: { kinds: string[] }) => {
    const ts = new Set<string>();
    g.kinds.forEach((k) => order(k).forEach((t) => ts.add(t)));
    return [...ts];
  };
  return (
    <Shell title="Field Manual" onBack={onBack}>
      <div className="brass-panel mb-4 p-4 text-sm leading-relaxed text-amber-100/85">
        <div className="font-display mb-1 text-lg text-amber-300">How to play</div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Meet every <b>Repair Order</b> (green lights on target parts) before boiler pressure hits 100%.</li>
          <li>Pick a part in the <b>tray</b> and click an empty tile. Click a placed part to <b>rotate</b>; right-click (or Salvage mode) to remove it. Levers can be flipped at any time.</li>
          <li><b>Leaks</b> and <b>jams</b> speed up the pressure gauge. <b>Vent</b> (V) dumps 25% pressure. <b>Hint</b> (H) shows a tile to fix for 6% heat.</li>
          <li>Finish under 40% pressure for ★★★. Earn cogs to buy upgrades in the Workshop.</li>
          <li>Keys: R rotate held part • 1-9 pick tray part • X salvage mode • V vent • H hint • P pause.</li>
        </ul>
      </div>
      {groups.map((g) => (
        <div key={g.title} className="brass-panel mb-4 p-4">
          <div className="font-display text-xl text-amber-300">{g.title}</div>
          <p className="mb-3 text-xs text-amber-100/70">{g.blurb}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {show(g).map((t) => (
              <div key={t} className="flex items-center gap-3 rounded-lg bg-black/30 p-2">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded border-2 border-amber-900">
                  <Tile piece={{ type: t, rot: 0, fixed: false, on: t === 's' || t === 'S' }} info={t === 'm' || t === 'X' || t === 'Q' || t === 'P' ? { ...IDLE_INFO, steam: t === 'Q' || t === 'P', spin: t === 'Q' ? 1 : 0, ins: [false] } : ACTIVE_INFO} parity={0} />
                </div>
                <div>
                  <div className="font-bold text-amber-200">{DEFS[t].name}</div>
                  <div className="text-xs text-amber-100/70">{DEFS[t].desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}

export function Ending({ save, onLevels, onTitle, onWorkshop }: { save: Save; onLevels: () => void; onTitle: () => void; onWorkshop: () => void }) {
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const max = LEVELS.length * 3;
  const rank = totalStars >= max ? 'Grand Master Mechanic' : totalStars >= max * 0.7 ? 'Master Mechanic' : totalStars >= max * 0.4 ? 'Journeyman Tinker' : 'Apprentice Greasemonkey';
  return (
    <div className="workshop-bg relative flex min-h-screen items-center justify-center p-4">
      <GearBackdrop />
      <div className="brass-panel pop-in relative z-10 max-w-lg p-8 text-center">
        <div className="font-display text-4xl font-extrabold text-amber-200">Workshop Complete!</div>
        <div className="my-4 flex items-end justify-center gap-3">
          {[0, 2, 4, 6].map((s) => (
            <Robot key={s} mood="fixed" size={70} seed={s} />
          ))}
        </div>
        <p className="mb-3 text-amber-100/80">Every automaton in the shop ticks, whirrs and hisses happily. The Grand Orrery turns once more.</p>
        <div className="mb-1 text-2xl text-yellow-300">★ {totalStars} / {max}</div>
        <div className="font-display mb-5 text-xl text-amber-300">Rank: {rank}</div>
        <p className="mb-5 text-xs text-amber-100/60">Replay jobs for three stars, buy upgrades, or try the endless Overtime shifts.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn-dark" onClick={onTitle}>Title</button>
          <button className="btn-dark" onClick={onWorkshop}>Workshop</button>
          <button className="btn-brass" onClick={onLevels}>Replay jobs</button>
        </div>
      </div>
    </div>
  );
}

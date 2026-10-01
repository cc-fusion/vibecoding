import { useState, type ReactNode } from 'react';
import { MAX_LEVEL, SECTORS, UPGRADES, derive, upgradeCost, type Stats, type Upgrades } from './data';

export const Btn = ({ children, onClick, tone = 'cyan', disabled, className = '' }: { children: ReactNode; onClick: () => void; tone?: 'cyan' | 'amber' | 'red' | 'green' | 'slate'; disabled?: boolean; className?: string }) => {
  const tones: Record<string, string> = {
    cyan: 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-400/30 shadow-cyan-500/20',
    amber: 'border-amber-300/80 bg-amber-400/20 text-amber-100 hover:bg-amber-300/35 shadow-amber-400/30',
    red: 'border-rose-400/70 bg-rose-500/15 text-rose-100 hover:bg-rose-400/30 shadow-rose-500/20',
    green: 'border-emerald-300/70 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-300/30 shadow-emerald-400/20',
    slate: 'border-slate-500/60 bg-slate-600/20 text-slate-200 hover:bg-slate-500/30 shadow-slate-500/10',
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-5 py-2.5 font-mono text-sm font-bold uppercase tracking-widest shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
};

const Shell = ({ children, wide = false }: { children: ReactNode; wide?: boolean }) => (
  <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
    <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} my-auto rounded-2xl border border-cyan-400/25 bg-slate-900/90 p-6 font-mono text-slate-200 shadow-2xl shadow-cyan-900/30`}>{children}</div>
  </div>
);

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex items-center justify-between border-b border-white/5 py-1 text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="font-bold text-white">{value}</span>
  </div>
);

const fmtTime = (t: number) => `${Math.floor(t / 60)}m ${String(Math.floor(t % 60)).padStart(2, '0')}s`;

const StatsBlock = ({ s }: { s: Stats }) => (
  <div className="rounded-lg bg-black/30 p-3">
    <StatRow label="Deliveries" value={s.delivered} />
    <StatRow label="Credits earned" value={`₡ ${s.earned}`} />
    <StatRow label="Flares dodged" value={s.flares} />
    <StatRow label="Debris impacts" value={s.hits} />
    <StatRow label="Hard landings / crashes" value={s.crashes} />
    <StatRow label="Fuel burned" value={Math.round(s.fuelUsed)} />
    <StatRow label="Flight time" value={fmtTime(s.time)} />
  </div>
);

export function HowTo({ onClose }: { onClose: () => void }) {
  const keys: [string, string][] = [
    ['A / D  or  ← / →', 'Rotate ship'],
    ['W  or  ↑', 'Main engine (burns fuel) · tap while docked to catapult launch'],
    ['S', 'Auto-aim retrograde (brake direction) relative to nearest planet'],
    ['E', 'Auto-aim prograde'],
    ['SPACE', 'Deflector shield — blocks debris & flares, drains energy'],
    ['SHIFT', 'Time warp ×3 (off while thrusting, near flares or debris)'],
    ['1 / 2 / 3', 'Accept contract while docked (or click a card)'],
    ['F / R / X', 'Refuel / Repair / Abandon cargo while docked'],
    ['TAB · + / − · wheel', 'System map · zoom'],
    ['ESC / P · M', 'Pause · Mute'],
  ];
  return (
    <Shell wide>
      <h2 className="mb-1 text-2xl font-black tracking-widest text-cyan-300">FLIGHT MANUAL</h2>
      <p className="mb-4 text-sm text-slate-400">Everything in space is falling. You just have to fall in the right direction.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Controls</h3>
          <div className="space-y-1.5 text-xs">
            {keys.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="w-36 shrink-0 rounded bg-slate-800 px-2 py-1 text-center font-bold text-cyan-200">{k}</span>
                <span className="py-1 text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-300">The job</h3>
            Dock at a planet, accept a cargo contract, and deliver it to another world. Complete each sector's quota to reach the depot and upgrade your hauler. Finish all 5 sectors to win.
          </div>
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-300">Gravity</h3>
            The sun and every planet pull on you. The <b className="text-cyan-200">dotted line</b> predicts your future path with moving planets included. Fly behind a moving planet to steal its momentum in a <b className="text-cyan-200">slingshot</b> — it's free speed. A green ring marks where you will touch down, with the predicted dock speed.
          </div>
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-300">Landing</h3>
            Match the planet's velocity. Under the safe speed you dock softly; over it you take damage; far over it you crash and bounce.
          </div>
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-300">Hazards</h3>
            <b className="text-rose-300">Solar flares</b> show a red wedge, then fire. Leave it, hide in a planet's shadow, or shield. <b className="text-slate-100">Debris</b> is flagged by red rings when on a collision course. Staying near the star builds <b className="text-orange-300">heat</b>. Fragile cargo loses value with every hit.
          </div>
        </div>
      </div>
      <div className="mt-5 text-right">
        <Btn onClick={onClose}>Got it</Btn>
      </div>
    </Shell>
  );
}

export function Menu({ onStart, best }: { onStart: () => void; best: number }) {
  const [help, setHelp] = useState(false);
  const orbits = [
    { r: 90, d: 14, c: '#e0a97a', s: 7 },
    { r: 150, d: 26, c: '#6fc3ff', s: 9 },
    { r: 215, d: 41, c: '#f3cf8f', s: 13 },
    { r: 285, d: 60, c: '#b9a5ff', s: 10 },
    { r: 360, d: 88, c: '#9fe0a0', s: 8 },
  ];
  return (
    <div className="absolute inset-0 z-10 overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#151c4a_0%,#070a1c_55%,#02030a_100%)]">
      <div className="stars absolute inset-0" />
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        <div className="absolute -left-10 -top-10 h-20 w-20 rounded-full bg-gradient-to-br from-yellow-100 via-amber-300 to-orange-500 shadow-[0_0_80px_30px_rgba(255,160,50,0.45)]" />
        {orbits.map((o, i) => (
          <div key={i} className="absolute rounded-full border border-blue-300/10" style={{ width: o.r * 2, height: o.r * 2, left: -o.r, top: -o.r, animation: `spin ${o.d}s linear infinite` }}>
            <div className="absolute rounded-full" style={{ width: o.s * 2, height: o.s * 2, left: o.r * 2 - o.s, top: o.r - o.s, background: `radial-gradient(circle at 30% 30%, #fff8, ${o.c} 40%, #0008)`, boxShadow: `0 0 14px ${o.c}66` }} />
          </div>
        ))}
      </div>
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center font-mono">
        <div className="mb-3 text-xs uppercase tracking-[0.5em] text-cyan-300/80">Gravity · Cargo · Nerve</div>
        <h1 className="bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-5xl font-black tracking-[0.12em] text-transparent drop-shadow-[0_0_25px_rgba(90,200,255,0.5)] sm:text-7xl">ORBITAL COURIER</h1>
        <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
          Slingshot cargo between rotating worlds. Read the gravity, dodge solar flares and wreckage, and deliver before the clock runs out.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Btn tone="amber" onClick={onStart} className="px-8 py-3 text-base">Start Career</Btn>
          <Btn tone="slate" onClick={() => setHelp(true)}>Flight Manual</Btn>
        </div>
        {best > 0 && <div className="mt-6 text-xs tracking-widest text-amber-200/80">BEST CAREER EARNINGS ₡ {best}</div>}
        <div className="mt-10 text-[11px] text-slate-500">Keyboard required · WASD / arrows · Space · Shift · Tab</div>
      </div>
      {help && <HowTo onClose={() => setHelp(false)} />}
    </div>
  );
}

export function Briefing({ sector, credits, upgrades, onLaunch, onMenu }: { sector: number; credits: number; upgrades: Upgrades; onLaunch: () => void; onMenu: () => void }) {
  const s = SECTORS[sector - 1];
  const d = derive(upgrades);
  const [help, setHelp] = useState(false);
  const danger = (v: number, max: number) => (
    <span className="tracking-widest text-rose-400">{'■'.repeat(Math.max(1, Math.round((v / max) * 5)))}<span className="text-slate-700">{'■'.repeat(5 - Math.max(1, Math.round((v / max) * 5)))}</span></span>
  );
  return (
    <Shell>
      <div className="text-xs uppercase tracking-[0.4em] text-cyan-300/80">Sector {sector} of {SECTORS.length}</div>
      <h2 className="mt-1 text-3xl font-black tracking-wider text-white">{s.name}</h2>
      <p className="mt-2 text-sm text-slate-300">{s.blurb}</p>
      <div className="mt-4 rounded-lg bg-black/30 p-3">
        <StatRow label="Delivery quota" value={`${s.quota} contracts`} />
        <StatRow label="Planets" value={s.planets} />
        <div className="flex items-center justify-between border-b border-white/5 py-1 text-sm"><span className="text-slate-400">Debris density</span>{danger(s.debris, 58)}</div>
        <div className="flex items-center justify-between border-b border-white/5 py-1 text-sm"><span className="text-slate-400">Flare activity</span>{danger(25 - s.flareMin, 18)}</div>
        <StatRow label="Credits" value={`₡ ${credits}`} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-slate-400">
        <div className="rounded bg-black/30 p-2">Hull<br /><b className="text-white">{d.maxHull}</b></div>
        <div className="rounded bg-black/30 p-2">Fuel<br /><b className="text-white">{d.maxFuel}</b></div>
        <div className="rounded bg-black/30 p-2">Shield<br /><b className="text-white">{d.maxEnergy}</b></div>
        <div className="rounded bg-black/30 p-2">Look-ahead<br /><b className="text-white">{d.predict}s</b></div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Your hauler is fully fuelled and repaired at the start of every sector.</p>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Btn tone="slate" onClick={onMenu}>Menu</Btn>
          <Btn tone="slate" onClick={() => setHelp(true)}>Manual</Btn>
        </div>
        <Btn tone="amber" onClick={onLaunch}>Launch ▶</Btn>
      </div>
      {help && <HowTo onClose={() => setHelp(false)} />}
    </Shell>
  );
}

export function Shop({ sector, credits, upgrades, stats, onBuy, onNext }: { sector: number; credits: number; upgrades: Upgrades; stats: Stats; onBuy: (k: keyof Upgrades) => void; onNext: () => void }) {
  return (
    <Shell wide>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">Sector {sector} cleared</div>
          <h2 className="text-3xl font-black tracking-wider text-white">Hangar & Upgrades</h2>
        </div>
        <div className="rounded-lg border border-amber-300/50 bg-amber-400/10 px-4 py-2 text-xl font-black text-amber-200">₡ {credits}</div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_250px]">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {UPGRADES.map((u) => {
            const lvl = upgrades[u.key];
            const maxed = lvl >= MAX_LEVEL;
            const cost = upgradeCost(u, lvl);
            const can = !maxed && credits >= cost;
            return (
              <div key={u.key} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white"><span className="mr-1.5">{u.icon}</span>{u.name}</div>
                  <div className="flex gap-1">
                    {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                      <span key={i} className={`h-2.5 w-2.5 rounded-sm ${i < lvl ? 'bg-cyan-300 shadow-[0_0_6px_#67e8f9]' : 'bg-slate-700'}`} />
                    ))}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">{u.desc}</div>
                <div className="mt-1.5 text-[11px] text-cyan-200">Now: {u.effect(lvl)}{!maxed && <span className="text-emerald-300"> → {u.effect(lvl + 1)}</span>}</div>
                <button
                  disabled={!can}
                  onClick={() => onBuy(u.key)}
                  className="mt-2 w-full rounded-md border border-amber-300/60 bg-amber-400/15 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-100 transition hover:bg-amber-300/30 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {maxed ? 'Maxed' : `Upgrade · ₡${cost}`}
                </button>
              </div>
            );
          })}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Sector report</h3>
          <StatsBlock s={stats} />
          <Btn tone="amber" onClick={onNext} className="mt-4 w-full">Next sector ▶</Btn>
        </div>
      </div>
    </Shell>
  );
}

export function Pause({ onResume, onRestart, onQuit }: { onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const [help, setHelp] = useState(false);
  return (
    <Shell>
      <h2 className="text-center text-3xl font-black tracking-[0.3em] text-white">PAUSED</h2>
      <div className="mt-6 flex flex-col gap-3">
        <Btn tone="green" onClick={onResume}>Resume</Btn>
        <Btn tone="slate" onClick={() => setHelp(true)}>Flight Manual</Btn>
        <Btn tone="amber" onClick={onRestart}>Restart sector</Btn>
        <Btn tone="red" onClick={onQuit}>Abandon career</Btn>
      </div>
      {help && <HowTo onClose={() => setHelp(false)} />}
    </Shell>
  );
}

export function GameOver({ cause, stats, score, best, sector, onRetry, onMenu }: { cause: string; stats: Stats; score: number; best: number; sector: number; onRetry: () => void; onMenu: () => void }) {
  return (
    <Shell>
      <div className="text-xs uppercase tracking-[0.4em] text-rose-300/80">Mission failed · Sector {sector}</div>
      <h2 className="mt-1 text-3xl font-black tracking-wider text-rose-300">SHIP LOST</h2>
      <p className="mt-2 text-sm text-slate-300">{cause}</p>
      <div className="mt-4"><StatsBlock s={stats} /></div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2">
        <span className="text-xs uppercase tracking-widest text-amber-200">Career earnings</span>
        <span className="text-xl font-black text-amber-200">₡ {score}</span>
      </div>
      <div className="mt-1 text-right text-[11px] text-slate-500">Best ₡ {best}</div>
      <p className="mt-3 text-xs text-slate-400">The insurance company will restore your hauler at the start of the sector with your last upgrades and credits.</p>
      <div className="mt-5 flex justify-between gap-2">
        <Btn tone="slate" onClick={onMenu}>Main menu</Btn>
        <Btn tone="amber" onClick={onRetry}>Retry sector ▶</Btn>
      </div>
    </Shell>
  );
}

export function Victory({ stats, score, best, isBest, onMenu }: { stats: Stats; score: number; best: number; isBest: boolean; onMenu: () => void }) {
  return (
    <Shell>
      <div className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">All sectors complete</div>
      <h2 className="mt-1 bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-400 bg-clip-text text-4xl font-black tracking-wider text-transparent">LEGENDARY COURIER</h2>
      <p className="mt-2 text-sm text-slate-300">You threaded the Ember Gate and the guild has named a docking bay after you. The stars are open to you, captain.</p>
      <div className="mt-4"><StatsBlock s={stats} /></div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2">
        <span className="text-xs uppercase tracking-widest text-amber-200">Career earnings</span>
        <span className="text-xl font-black text-amber-200">₡ {score}</span>
      </div>
      <div className="mt-1 text-right text-[11px] text-amber-200/70">{isBest ? '★ New personal best!' : `Best ₡ ${best}`}</div>
      <div className="mt-5 text-right">
        <Btn tone="amber" onClick={onMenu}>Back to menu</Btn>
      </div>
    </Shell>
  );
}

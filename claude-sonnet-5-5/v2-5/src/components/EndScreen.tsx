import { ENEMIES, ITEMS, type EnemyType, type ItemId } from '../game/defs';
import type { Game } from '../game/engine';
import { Btn } from './ui';

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export default function EndScreen({
  game,
  kind,
  lp,
  onRetry,
  onContinue,
  onTitle,
}: {
  game: Game;
  kind: 'victory' | 'defeat';
  lp: number;
  onRetry: () => void;
  onContinue: () => void;
  onTitle: () => void;
}) {
  const s = game.stats;
  const win = kind === 'victory';
  const sold = (Object.keys(s.sold) as ItemId[]).filter((k) => s.sold[k] > 0).sort((a, b) => s.sold[b] * ITEMS[b].value - s.sold[a] * ITEMS[a].value);
  const rows: [string, string][] = [
    ['Time survived', fmtTime(s.time)],
    ['Raids repelled', `${s.waves}`],
    ['Credits earned', `${Math.round(s.earned)}`],
    ['Goods produced', `${s.produced}`],
    ['Goods lost to drift', `${s.lost}`],
    ['Stolen by looters', `${Math.round(s.stolen)}c`],
    ['Pirates destroyed', `${s.kills}`],
    ['Damage taken', `${Math.round(s.damage)}`],
    ['Structures built / lost', `${s.built} / ${s.destroyed}`],
    ['Contracts fulfilled', `${s.contracts}`],
    ['Techs researched', `${s.techs}`],
    ['Peak power', `${Math.round(s.peakPower)} kW`],
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-auto bg-slate-950/80 p-3 backdrop-blur-sm">
      <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl ${win ? 'border-amber-300/40 bg-slate-900/95' : 'border-rose-400/40 bg-slate-900/95'}`}>
        <div className="text-center">
          <div className="text-5xl">{win ? '🏆' : '💥'}</div>
          <h2 className={`mt-1 text-3xl font-black uppercase tracking-widest ${win ? 'text-amber-300' : 'text-rose-400'}`}>{win ? 'Victory' : 'Ring Core Lost'}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {win ? 'The Dreadnought is scrap and the ring is safe. Your foundry is a legend.' : 'The pirates tore the Ring Core apart. The foundry drifts silent into the dark.'}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 rounded-xl bg-slate-800/70 p-3">
          <div className="text-center">
            <div className="text-xs uppercase text-slate-400">Score</div>
            <div className="text-3xl font-bold tabular-nums text-cyan-300">{game.score()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase text-slate-400">Legacy earned</div>
            <div className="text-3xl font-bold tabular-nums text-amber-300">+{lp} LP</div>
          </div>
        </div>
        <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-white/5 py-0.5">
              <span className="text-slate-400">{k}</span>
              <span className="tabular-nums text-slate-100">{v}</span>
            </div>
          ))}
        </div>
        {sold.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {sold.map((k) => (
              <span key={k} className="rounded-full bg-slate-800 px-2 py-0.5" style={{ color: ITEMS[k].color }}>
                {ITEMS[k].name} ×{s.sold[k]}
              </span>
            ))}
          </div>
        )}
        {Object.keys(s.killsBy).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-300">
            {(Object.keys(s.killsBy) as EnemyType[]).map((k) => (
              <span key={k} className="rounded-full bg-slate-800 px-2 py-0.5">
                {ENEMIES[k].emoji} {ENEMIES[k].name} ×{s.killsBy[k]}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {win && (
            <Btn variant="gold" onClick={onContinue}>
              ♾️ Continue (Endless)
            </Btn>
          )}
          <Btn variant="primary" onClick={onRetry}>
            ↻ {win ? 'New Run' : 'Retry'}
          </Btn>
          <Btn variant="ghost" onClick={onTitle}>
            Title Screen
          </Btn>
        </div>
      </div>
    </div>
  );
}

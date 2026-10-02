import { FACTION_IDS, FACTIONS, FAVOR_PER_POINT, PERKS, type FactionId } from '../game/data';
import type { Game } from '../game/engine';
import { cn } from '../utils/cn';
import { Bar } from './Common';

export function FavorTree({ game, compact = false }: { game: Game; compact?: boolean }) {
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
      {FACTION_IDS.map(f => <FactionCard key={f} game={game} f={f} />)}
    </div>
  );
}

function FactionCard({ game, f }: { game: Game; f: FactionId }) {
  const fac = FACTIONS[f];
  const favor = game.run.favor[f];
  const pts = game.points(f);
  const perks = PERKS.filter(p => p.faction === f);
  const into = Math.max(0, favor) % FAVOR_PER_POINT;
  return (
    <div className="card p-3" style={{ borderColor: fac.color + '55' }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="font-display text-sm" style={{ color: fac.color }}>{fac.icon} {fac.name}</div>
        <div className={cn('chip', pts > 0 && 'glow-pulse')} style={{ color: pts > 0 ? '#ffe9a8' : undefined }}>✦ {pts} point{pts === 1 ? '' : 's'}</div>
      </div>
      <div className="text-[11px] text-white/50 mb-1">{fac.blurb} Rival: {FACTIONS[fac.rival].icon} {FACTIONS[fac.rival].name}</div>
      <Bar value={into} max={FAVOR_PER_POINT} color={fac.color} h={9} label={`Favor ${Math.round(favor)}${favor < -20 ? ' (hostile)' : ''}`} />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3].flatMap(tier => [0, 1, 2].map(col => {
          const p = perks.find(x => x.tier === tier && x.col === col);
          if (!p) return <div key={`${tier}-${col}`} />;
          const owned = game.hasPerk(p.id);
          const reqOk = p.req.every(r => game.hasPerk(r));
          const can = !owned && reqOk && pts >= p.cost;
          return (
            <button
              key={p.id}
              type="button"
              title={p.desc}
              onClick={() => game.buyPerk(p.id)}
              className={cn('text-left rounded-lg p-1.5 border transition relative', owned ? 'bg-amber-400/20 border-amber-300/70' : can ? 'bg-white/10 border-white/40 glow-pulse hover:bg-white/20 cursor-pointer' : 'bg-black/25 border-white/10 opacity-60', !can && !owned && 'cursor-not-allowed')}
              style={{ gridColumn: col + 1 }}
            >
              <div className="flex items-center gap-1 text-[11px] font-bold leading-tight"><span className="text-base">{p.icon}</span><span className="truncate">{p.name}</span></div>
              <div className="text-[10px] text-white/60 leading-tight mt-0.5 min-h-[2.4em]">{p.desc}</div>
              <div className="text-[10px] mt-0.5" style={{ color: owned ? '#ffe9a8' : reqOk ? '#9ad7ff' : '#ff9a8a' }}>
                {owned ? '✔ Unlocked' : reqOk ? `Cost ✦${p.cost}` : `Needs ${p.req.map(r => PERKS.find(q => q.id === r)?.name).join(' + ')}`}
              </div>
            </button>
          );
        }))}
      </div>
    </div>
  );
}

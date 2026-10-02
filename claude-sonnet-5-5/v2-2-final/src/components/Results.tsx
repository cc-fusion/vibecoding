import { Btn, Panel, Stars, Stat } from './ui';
import { LOOT, VENUES, fmt } from '../game/data';
import type { Contract } from '../game/data';
import type { Result } from '../game/sim';
import type { Summary } from '../game/meta';

const ALARM = ['Quiet', 'Alert', 'Alarm', 'Police'];

export function Results({ result, summary, ct, onContinue }: { result: Result; summary: Summary; ct: Contract; onContinue: () => void }) {
  const V = VENUES[ct.venue];
  return (
    <div className="h-full overflow-auto scroll grid-bg p-3 flex items-start sm:items-center justify-center">
      <div className="max-w-3xl w-full space-y-3 rise">
        <Panel>
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] opacity-70">After-action report · {V.name}</div>
            <div className="stamp noir text-5xl mt-1" style={{ color: result.success ? '#5cf0a8' : '#ff4d5e' }}>{result.success ? 'SUCCESS' : 'FAILURE'}</div>
            <div className="text-2xl mt-1"><Stars n={result.stars} /></div>
          </div>
        </Panel>
        <div className="grid sm:grid-cols-2 gap-3">
          <Panel title="Payout">
            <Stat label="Contract fee" value={fmt(summary.fee)} color="#5cf0a8" /><Stat label="Star bonus" value={fmt(summary.bonus)} color="#5cf0a8" />
            <Stat label="Loot to stash" value={fmt(result.lootValue)} color="#ffd35c" /><Stat label="Loot lost" value={fmt(result.lootLost)} color="#ff9a4d" />
            <div className="text-[11px] opacity-70 mt-2">{result.loot.length ? result.loot.map((l) => LOOT[l.cat].icon + ' ' + l.name).join(', ') : 'No loot brought home.'}</div>
            <div className="text-[11px] opacity-60 mt-1">Fence it from the HQ. {result.alarmMax >= 2 ? 'This loot is HOT for 3 days (-30%).' : ''}</div>
          </Panel>
          <Panel title="Consequences">
            <Stat label="Heat gained" value={`+${summary.heatGain}`} color={summary.heatGain > 12 ? '#ff4d5e' : '#ffd35c'} /><Stat label="Notoriety" value={`${summary.rep >= 0 ? '+' : ''}${summary.rep}`} color="#6ee7ff" />
            <Stat label="Max alert" value={ALARM[result.alarmMax]} /><Stat label="Times spotted" value={result.spotted} /><Stat label="Guards KO'd" value={result.guardsDowned} /><Stat label="Time on site" value={`${Math.floor(result.time / 60)}m ${Math.floor(result.time % 60)}s`} />
            {summary.custody.length > 0 && <div className="text-xs mt-2 text-[#ff4d5e]">In custody: {summary.custody.join(', ')} (3 days or pay bail)</div>}
            {summary.lost.length > 0 && <div className="text-xs mt-2 text-[#ff4d5e]">Lost forever (Iron Crew): {summary.lost.join(', ')}</div>}
          </Panel>
        </div>
        {summary.lines.length > 0 && <Panel title="Aftermath"><ul className="text-xs space-y-1 opacity-90">{summary.lines.map((l, i) => <li key={i}>• {l}</li>)}</ul></Panel>}
        <div className="text-center"><Btn variant="primary" onClick={onContinue}>Return to HQ ▶</Btn></div>
      </div>
    </div>
  );
}

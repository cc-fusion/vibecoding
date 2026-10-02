import { useState } from 'react';
import { SCENARIOS, DIFFS, MODS } from '../game/data';
import type { GameConfig } from '../game/engine';
import type { SaveData } from '../game/storage';
import { Screen, Stars } from './ui';

export function Setup({ save, onBack, onStart }: { save: SaveData; onBack: () => void; onStart: (cfg: GameConfig) => void }) {
  const [sel, setSel] = useState(Math.min(save.unlocked - 1, SCENARIOS.length - 1));
  const [diff, setDiff] = useState(1);
  const [mods, setMods] = useState<string[]>([]);
  const [tut, setTut] = useState<boolean>(!!save.settings.tutorial && !save.best['valley']);
  const sc = SCENARIOS[sel];
  const mult = DIFFS[diff].legacy * (1 + mods.reduce((a, m) => a + (MODS.find(x => x.id === m)?.legacy || 0), 0));
  const toggleMod = (id: string) => setMods(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]));

  return (
    <Screen title="Campaign" subtitle="Choose a province, a difficulty, and any self-imposed hardships." onBack={onBack} wide>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCENARIOS.map((s, i) => {
          const locked = i >= save.unlocked;
          const best = save.best[s.id];
          return (
            <button key={s.id} disabled={locked} onClick={() => setSel(i)}
              className={`panel p-3 text-left transition-transform hover:-translate-y-1 disabled:opacity-40 ${sel === i ? 'outline outline-2 outline-[var(--gold)]' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-3xl">{locked ? '🔒' : s.icon}</span>
                <Stars n={best?.stars || 0} />
              </div>
              <div className="font-display mt-1 text-lg font-bold text-[var(--gold)]">{i + 1}. {s.name}</div>
              <div className="mt-1 text-xs text-[var(--ink-dim)]">{locked ? 'Win the previous province to unlock.' : s.blurb}</div>
              {best && <div className="mt-1 text-xs">Best score {best.score}</div>}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-1">
          <h3 className="font-display mb-1 text-lg text-[var(--gold)]">{sc.icon} {sc.name}</h3>
          <ul className="space-y-1 text-sm">
            <li>👥 Population goal: <b>{sc.goalPop}</b> · 😊 Happiness ≥ <b>{sc.goalHappy}</b></li>
            <li>📅 Duration: <b>{sc.years} years</b> (80 s each)</li>
            <li>💧 Springs: <b>{sc.springs}</b> · 🪙 Start: <b>{sc.startCoins}</b></li>
            <li>⚠ Hazards: {sc.hazards.join(', ')}</li>
            <li>👹 Boss: <b className="text-[var(--bad)]">{sc.bossName}</b> — <span className="text-[var(--ink-dim)]">{sc.bossDesc}</span></li>
          </ul>
        </div>
        <div className="panel p-4">
          <h3 className="font-display mb-2 text-lg text-[var(--gold)]">Difficulty</h3>
          <div className="flex flex-col gap-2">
            {DIFFS.map((d, i) => (
              <button key={d.id} onClick={() => setDiff(i)} className={`rounded-lg border p-2 text-left text-sm ${diff === i ? 'border-[var(--gold)] bg-[var(--terra)]/40' : 'border-white/15 bg-black/20'}`}>
                <b className="font-display">{d.name}</b> <span className="chip">×{d.legacy} LP</span>
                <div className="text-xs text-[var(--ink-dim)]">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <h3 className="font-display mb-2 text-lg text-[var(--gold)]">Modifiers</h3>
          <div className="flex flex-col gap-1.5">
            {MODS.map(m => (
              <button key={m.id} onClick={() => toggleMod(m.id)} className={`rounded-lg border p-1.5 text-left text-sm ${mods.includes(m.id) ? 'border-[var(--gold)] bg-[var(--terra)]/40' : 'border-white/15 bg-black/20'}`}>
                {m.icon} <b>{m.name}</b> <span className="chip">+{Math.round(m.legacy * 100)}%</span>
                <div className="text-xs text-[var(--ink-dim)]">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tut} onChange={e => setTut(e.target.checked)} /> Guided tutorial
        </label>
        <div className="text-sm">Legacy reward multiplier: <b className="text-[var(--gold)]">×{mult.toFixed(2)}</b> · Base {sc.legacyReward} LP</div>
        <button className="btn btn-gold" onClick={() => onStart({ scenario: sel, diff, mods, legacy: save.legacy, tutorial: tut })}>Begin Construction ▶</button>
      </div>
    </Screen>
  );
}

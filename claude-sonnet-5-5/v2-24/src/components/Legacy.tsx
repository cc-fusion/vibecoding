import { useState } from 'react';
import { LEGACY } from '../game/data';
import type { SaveData } from '../game/storage';
import { Screen } from './ui';

export function LegacyHall({ save, onBack, onBuy, onReset, sfx }: { save: SaveData; onBack: () => void; onBuy: (id: string) => void; onReset: () => void; sfx: (n: 'click' | 'upgrade' | 'error') => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen title="Legacy Hall" subtitle="Permanent blessings of your engineering dynasty. Earned by building — and by failing gloriously." onBack={onBack}>
      <div className="panel flex items-center justify-between p-3">
        <div className="text-lg">🏺 Legacy Points: <b className="text-[var(--gold)]">{save.legacyPoints}</b></div>
        <div className="text-xs text-[var(--ink-dim)]">Saved in your browser (when available)</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LEGACY.map(u => {
          const rank = save.legacy[u.id] || 0;
          const maxed = rank >= u.max;
          const cost = u.cost * (rank + 1);
          const can = !maxed && save.legacyPoints >= cost;
          return (
            <div key={u.id} className="panel flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{u.icon}</span>
                <div className="flex-1">
                  <div className="font-display font-bold text-[var(--gold)]">{u.name}</div>
                  <div className="text-xs text-[var(--ink-dim)]">{u.desc}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">{Array.from({ length: u.max }, (_, i) => <span key={i} className={`h-3 w-6 rounded-sm border ${i < rank ? 'border-[var(--gold)] bg-[var(--gold)]' : 'border-white/25 bg-black/30'}`} />)}</div>
                <button className="btn btn-sm" disabled={!can} onClick={() => { onBuy(u.id); sfx('upgrade'); }}>{maxed ? 'Maxed' : `Buy · ${cost} LP`}</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        {!confirm ? <button className="btn btn-alt btn-sm" onClick={() => { setConfirm(true); sfx('click'); }}>Erase all progress…</button> : (
          <div className="flex items-center gap-2 text-sm">Really erase everything?
            <button className="btn btn-sm" onClick={() => { onReset(); setConfirm(false); }}>Yes, erase</button>
            <button className="btn btn-alt btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>
    </Screen>
  );
}

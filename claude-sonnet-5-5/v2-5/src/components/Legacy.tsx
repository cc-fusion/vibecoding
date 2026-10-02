import { LEGACY } from '../game/defs';
import { audio } from '../game/audio';
import type { SaveData } from '../game/save';
import { Btn, Modal } from './ui';

export default function Legacy({ save, onChange, onClose }: { save: SaveData; onChange: (s: SaveData) => void; onClose: () => void }) {
  const buy = (id: string) => {
    const def = LEGACY.find((l) => l.id === id);
    if (!def) return;
    const lvl = save.upgrades[id] || 0;
    const cost = def.base * (lvl + 1);
    if (lvl >= def.max || save.legacy < cost) {
      audio.sfx('error');
      return;
    }
    audio.sfx('research');
    onChange({ ...save, legacy: save.legacy - cost, upgrades: { ...save.upgrades, [id]: lvl + 1 } });
  };
  return (
    <Modal title="🏛️ Foundry Legacy" onClose={onClose} wide>
      <p className="mb-3 text-sm text-slate-300">Every run earns <b className="text-amber-300">Legacy Points</b> based on raids survived, score and victory. Spend them on permanent upgrades that carry into every future run.</p>
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-amber-400/10 px-3 py-2 text-amber-200">
        <span className="text-2xl">🏅</span>
        <span className="text-lg font-bold tabular-nums">{save.legacy} LP available</span>
        <span className="ml-auto text-xs text-slate-400">
          Best raid: {save.best.wave} · Best score: {save.best.score} · Victories: {save.best.wins}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LEGACY.map((l) => {
          const lvl = save.upgrades[l.id] || 0;
          const maxed = lvl >= l.max;
          const cost = l.base * (lvl + 1);
          return (
            <div key={l.id} className="rounded-xl border border-white/10 bg-slate-800/60 p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{l.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-slate-100">{l.name}</div>
                  <div className="text-xs text-slate-400">{l.desc}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {Array.from({ length: l.max }).map((_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded ${i < lvl ? 'bg-amber-400' : 'bg-slate-700'}`} />
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <Btn variant="gold" disabled={maxed || save.legacy < cost} onClick={() => buy(l.id)}>
                  {maxed ? 'Maxed' : `Upgrade · ${cost} LP`}
                </Btn>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <Btn variant="primary" onClick={onClose}>
          Back
        </Btn>
      </div>
    </Modal>
  );
}

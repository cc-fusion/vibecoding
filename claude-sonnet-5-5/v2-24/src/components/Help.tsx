import { useState } from 'react';
import { HELP_PAGES, TOOLS } from '../game/data';
import { Screen } from './ui';

export const CONTROLS: [string, string][] = [
  ['Left-click / drag', 'Build with the selected tool (drag paints canals, drains, houses, farms)'],
  ['Right-click / drag', 'Quick demolish (50% refund)'],
  ['1-9, 0, F, B, M, N, G', 'Select build tools (see palette badges)'],
  ['Q / X', 'Inspect tool / Demolish tool'],
  ['R', 'Rotate pump before placing'],
  ['H · C · V', 'Overlays: terrain heights · contact-tracing graph · happiness heat'],
  ['T', 'Open the Tech tab'],
  ['S', 'Cycle game speed (1× 2× 3×)'],
  ['Space / P / Esc', 'Pause menu'],
  ['Touch', 'Tap to build, drag to paint, use the on-screen tool palette'],
];

export function ControlsTable() {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-2">
      {CONTROLS.map(([k, v]) => (
        <div key={k} className="flex gap-2 rounded bg-black/20 p-1.5"><b className="chip shrink-0 text-[var(--gold)]">{k}</b><span className="text-[var(--ink-dim)]">{v}</span></div>
      ))}
    </div>
  );
}

export function Help({ onBack }: { onBack: () => void }) {
  const [p, setP] = useState(0);
  const page = HELP_PAGES[p];
  return (
    <Screen title="How to Play" subtitle="The hydraulic engineer's handbook" onBack={onBack}>
      <div className="flex flex-wrap gap-2">
        {HELP_PAGES.map((h, i) => <button key={h.title} onClick={() => setP(i)} className={`btn btn-sm ${i === p ? 'btn-gold' : 'btn-alt'}`}>{h.title}</button>)}
      </div>
      <div className="panel pop-in space-y-3 p-4 text-[0.95rem] leading-relaxed" key={p}>
        <h3 className="font-display text-xl text-[var(--gold)]">{page.title}</h3>
        {page.body.map((b, i) => <p key={i}>{b}</p>)}
      </div>
      <div className="panel p-4">
        <h3 className="font-display mb-2 text-lg text-[var(--gold)]">Controls</h3>
        <ControlsTable />
      </div>
      <div className="panel p-4">
        <h3 className="font-display mb-2 text-lg text-[var(--gold)]">Structures</h3>
        <div className="grid gap-1.5 text-sm sm:grid-cols-2">
          {TOOLS.filter(t => t.id !== 'select').map(t => (
            <div key={t.id} className="flex gap-2 rounded bg-black/20 p-1.5"><span className="text-xl">{t.icon}</span><div><b>{t.name}</b> <span className="chip">{t.cost}🪙</span><div className="text-xs text-[var(--ink-dim)]">{t.desc}</div></div></div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

import { useState } from 'react';
import { ENEMIES, ITEMS, RECIPES, type EnemyType, type ItemId } from '../game/defs';
import { Btn, Modal } from './ui';

const TABS = ['Basics', 'Drift & Power', 'Recipes', 'Raids', 'Controls'] as const;

const KEYS: [string, string][] = [
  ['Left mouse', 'Place / select / drag belts (hold & drag to lay a belt line)'],
  ['Right mouse', 'Demolish (hold & drag to erase many)'],
  ['Middle mouse / Space+drag', 'Pan camera (also drag with Select tool)'],
  ['Mouse wheel · + / −', 'Zoom'],
  ['W A S D · Arrows', 'Pan camera'],
  ['Tab', 'Cycle build category'],
  ['1 – 9', 'Pick building in current category'],
  ['R / Shift+R', 'Rotate belt direction'],
  ['Q', 'Select tool'],
  ['X', 'Erase tool'],
  ['Esc', 'Cancel tool / pause menu'],
  ['P', 'Pause menu'],
  ['T', 'Technology tree'],
  ['[ and ]', 'Decrease / increase ring spin'],
  ['F', 'Reverse spin direction (20s cooldown)'],
  ['N', 'Call next raid early for a bonus'],
  ['E', 'Cycle game speed (1× 2× 3×)'],
  ['V', 'Toggle drift-leak overlay'],
  ['M', 'Mute'],
  ['Del', 'Demolish selected building'],
  ['Touch', 'Tap to place, drag to pan, pinch to zoom, use the on-screen buttons for erase / rotate'],
];

export default function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Basics');
  return (
    <Modal title="📘 Field Manual" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Btn key={t} variant={t === tab ? 'primary' : 'ghost'} onClick={() => setTab(t)}>
            {t}
          </Btn>
        ))}
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-slate-200">
        {tab === 'Basics' && (
          <>
            <p>
              You run a factory on a <b className="text-cyan-300">rotating space ring</b>. Mine resources, move them on belts, refine them into higher-tier goods and sell them at the <b>Ring Core</b> or <b>Export Docks</b> to fund expansion
              and defense. Pirates raid on a timer, and the ring itself fights back: its spin bends every belt.
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Place <b>Extractors</b> on iron (rust), copper (teal) or comet-ice (pale blue) deposits.</li>
              <li>Lay <b>Conveyors</b> by dragging. Machines output into any adjacent belt and accept from belts pointing into them.</li>
              <li>Smelt, assemble and fabricate. Higher tiers sell for much more, and feed research, ammo and contracts.</li>
              <li>Keep the <b>power grid</b> healthy, since every machine slows down in a brownout.</li>
              <li>Build <b>turrets</b> and feed them plates by belt. Survive all 10 raids and destroy the <b>Dreadnought</b> boss to win.</li>
              <li>Research technologies with the <b>Lab</b>. Earn <b>Legacy Points</b> every run to unlock permanent upgrades.</li>
            </ol>
            <p className="text-slate-400">Contracts pay big bonuses for delivering specific goods before the timer expires. The market also reacts: every sale lowers that item's price a little, and events can cause booms or gluts.</p>
          </>
        )}
        {tab === 'Drift & Power' && (
          <>
            <h3 className="font-bold text-cyan-300">Coriolis drift</h3>
            <p>
              Because the ring spins, anything moving on it is pushed sideways. On belts, items slide toward one side (the right of travel when the spin is clockwise). When an item reaches the edge of its belt it hops onto whatever belt is
              next to it, and if there is nothing there it is <b className="text-rose-300">lost to space</b>. Items on a straight belt can travel only a limited <b>safe run</b> before they leak, shown in the Ring Control panel and as a curved preview while you place belts.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Shorter runs</b>: break long lines up with machines (a machine re-emits fresh, centred items). Turns, junctions and splitters do <i>not</i> reset drift.</li>
              <li><b>Rail Guides</b> (research) are immune to drift. <b>Gyro Stabilizers</b> cut drift 75% within 4 tiles.</li>
              <li><b>Lower the spin</b> to reduce drift, but you lose Dynamo power and slower day/night cycles. Centrifuges run faster on high spin.</li>
              <li><b>Reverse spin (F)</b> flips the drift direction. This is handy when your leaking side is blocked by a wall of machines!</li>
              <li>Turret bullets curve with the spin too. <b>Coriolis Ballistics</b> makes turrets compensate fully.</li>
            </ul>
            <h3 className="font-bold text-cyan-300">Power</h3>
            <p>
              Solar arrays give up to 12 kW but only by day (a faster spin means a shorter day). Spin Dynamos give 8 kW × spin. Fuel Reactors burn fuel cells for 40 kW. Batteries store surplus for the night. If demand exceeds supply everything slows down proportionally.
              Bomber drones love power plants, and a boss EMP knocks the whole grid out.
            </p>
          </>
        )}
        {tab === 'Recipes' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(RECIPES).map((r) => (
                <div key={r.id} className="rounded-lg border border-white/10 bg-slate-800/60 p-2">
                  <div className="font-semibold text-slate-100">{r.name} <span className="text-xs text-slate-400">({r.time}s)</span></div>
                  <div className="text-xs text-slate-300">
                    {(Object.keys(r.inputs) as ItemId[]).map((k) => `${r.inputs[k]}× ${ITEMS[k].name}`).join(' + ')} → {r.outQty}× {ITEMS[r.output].name}
                  </div>
                </div>
              ))}
            </div>
            <h3 className="pt-2 font-bold text-cyan-300">Item values</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ITEMS) as ItemId[]).map((k) => (
                <span key={k} className="rounded-full border border-white/10 bg-slate-800 px-2 py-1 text-xs" style={{ color: ITEMS[k].color }}>
                  {ITEMS[k].name}: {ITEMS[k].value}c · {ITEMS[k].rp} RP
                </span>
              ))}
            </div>
            <p className="text-slate-400">Turrets accept plates (light rounds) or circuits (heavy piercing rounds). Reactors accept fuel cells. Labs accept anything with research value.</p>
          </>
        )}
        {tab === 'Raids' && (
          <>
            <p>Raids come from the map edges flagged in the intel panel. Clear a raid to earn a bonus; call the next one early with <b>N</b> for extra credits. Wave 10 is the <b>Dreadnought</b>. After victory you can continue in endless mode.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(ENEMIES) as EnemyType[]).map((k) => (
                <div key={k} className="rounded-lg border border-white/10 bg-slate-800/60 p-2">
                  <div className="font-semibold" style={{ color: ENEMIES[k].color }}>
                    {ENEMIES[k].emoji} {ENEMIES[k].name}
                  </div>
                  <div className="text-xs text-slate-300">{ENEMIES[k].desc}</div>
                </div>
              ))}
            </div>
            <p className="text-slate-400">Random events strike too: Solar Flares, Micrometeoroid Showers, Spin Instability and market swings.</p>
          </>
        )}
        {tab === 'Controls' && (
          <div className="grid gap-1 sm:grid-cols-2">
            {KEYS.map(([k, v]) => (
              <div key={k} className="flex gap-2 rounded bg-slate-800/50 px-2 py-1">
                <kbd className="min-w-[7rem] shrink-0 rounded bg-slate-700 px-2 py-0.5 text-center text-xs text-cyan-200">{k}</kbd>
                <span className="text-xs text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4">
        <Btn variant="primary" onClick={onClose}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}

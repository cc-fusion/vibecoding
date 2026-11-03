import { X, ArrowRight, Flame, Hammer, Package } from 'lucide-react';
import type { Game, UIState, SlotList } from '../game/game';
import { Slot } from './ItemIcon';

function PlayerInv({ ui, game }: { ui: UIState; game: Game }) {
  const click = (list: SlotList, idx: number) => (b: 0 | 2, s: boolean) => game.slotClick(list, idx, b, s);
  return (
    <div>
      <div className="grid grid-cols-9 gap-[3px]">
        {ui.mainInv.map((s, i) => (
          <Slot key={i} stack={s} onClick={click('inv', i + 9)} onHover={() => game.setHover('inv', i + 9)} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-9 gap-[3px]">
        {ui.hotbar.map((s, i) => (
          <Slot key={i} stack={s} selected={ui.selected === i} hotkey={String(i + 1)} onClick={click('inv', i)} onHover={() => game.setHover('inv', i)} />
        ))}
      </div>
    </div>
  );
}

function PanelShell({ title, icon, game, children, wide }: { title: string; icon: React.ReactNode; game: Game; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4" onMouseDown={() => game.dropCarry()}>
      <div className={`mc-panel max-h-full overflow-y-auto px-5 py-4 ${wide ? 'w-[640px]' : 'w-[520px]'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-pixel text-[15px] text-white">{title}</h2>
          </div>
          <button className="rounded-md p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white" onClick={() => game.closeContainer()} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Left-click: pick up / place · Right-click: half / place one · Shift-click: quick move · 1–9: swap with hotbar · E or Esc: close
        </p>
      </div>
    </div>
  );
}

const RECIPE_HINTS = [
  'Planks — 1 log anywhere',
  'Sticks — 2 planks stacked',
  'Crafting Table — 4 planks in a square',
  'Torch ×4 — coal over a stick',
  'Pickaxe — 3 material on top, 2 sticks below',
  'Furnace — 8 cobblestone in a ring',
  'Chest — 8 planks in a ring',
  'Smelt: sand→glass, ore→ingots, log→charcoal',
];

export function ContainerScreen({ ui, game }: { ui: UIState; game: Game }) {
  const click = (list: SlotList, idx: number) => (b: 0 | 2, s: boolean) => game.slotClick(list, idx, b, s);

  if (ui.screen === 'inventory') {
    if (ui.mode === 'creative') {
      return (
        <PanelShell title="Creative Inventory" icon={<Package size={18} className="text-violet-300" />} game={game} wide>
          <p className="mb-2 text-[12px] text-white/55">Click any item to take a full stack. Everything is unlimited.</p>
          <div className="mb-3 grid max-h-[240px] grid-cols-9 gap-[3px] overflow-y-auto pr-1">
            {ui.creativePalette.map((id, i) => (
              <Slot key={i} stack={{ id, count: 1 }} onClick={click('creative', i)} onHover={() => game.setHover('creative', i)} />
            ))}
          </div>
          <PlayerInv ui={ui} game={game} />
        </PanelShell>
      );
    }
    return (
      <PanelShell title="Inventory & Crafting" icon={<Hammer size={18} className="text-amber-300" />} game={game}>
        <div className="mb-1 flex items-start gap-5">
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-2 gap-[3px]">
              {ui.craft.map((s, i) => (
                <Slot key={i} stack={s} onClick={click('craft', i)} onHover={() => game.setHover('craft', i)} />
              ))}
            </div>
            <ArrowRight className="text-white/40" />
            <Slot stack={ui.craftResult} size={56} onClick={click('result', 0)} onHover={() => game.setHover('result', 0)} />
          </div>
          <ul className="flex-1 space-y-0.5 text-[11px] leading-snug text-white/45">
            {RECIPE_HINTS.slice(0, 5).map(h => <li key={h}>· {h}</li>)}
          </ul>
        </div>
        <PlayerInv ui={ui} game={game} />
      </PanelShell>
    );
  }

  if (ui.screen === 'crafting') {
    return (
      <PanelShell title="Crafting Table" icon={<Hammer size={18} className="text-amber-300" />} game={game}>
        <div className="mb-1 flex items-start gap-5">
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-3 gap-[3px]">
              {ui.craft.map((s, i) => (
                <Slot key={i} stack={s} onClick={click('craft', i)} onHover={() => game.setHover('craft', i)} />
              ))}
            </div>
            <ArrowRight className="text-white/40" />
            <Slot stack={ui.craftResult} size={56} onClick={click('result', 0)} onHover={() => game.setHover('result', 0)} />
          </div>
          <ul className="flex-1 space-y-0.5 pt-1 text-[11px] leading-snug text-white/45">
            {RECIPE_HINTS.map(h => <li key={h}>· {h}</li>)}
          </ul>
        </div>
        <PlayerInv ui={ui} game={game} />
      </PanelShell>
    );
  }

  if (ui.screen === 'furnace' && ui.furnace) {
    const f = ui.furnace;
    return (
      <PanelShell title="Furnace" icon={<Flame size={18} className="text-orange-400" />} game={game}>
        <div className="mb-2 flex items-center justify-center gap-4 py-1">
          <div className="flex flex-col items-center gap-1.5">
            <Slot stack={f.slots[0]} size={52} onClick={click('furnace', 0)} onHover={() => game.setHover('furnace', 0)} />
            <div className="relative flex h-8 w-8 items-end justify-center">
              <Flame size={26} className={f.burnFrac > 0 ? 'text-orange-400' : 'text-white/15'} fill={f.burnFrac > 0 ? '#f58a3a' : 'transparent'} />
              <div className="absolute bottom-0 h-1 w-8 rounded bg-black/60"><div className="h-full rounded bg-orange-400" style={{ width: `${f.burnFrac * 100}%` }} /></div>
            </div>
            <Slot stack={f.slots[1]} size={52} onClick={click('furnace', 1)} onHover={() => game.setHover('furnace', 1)} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-3 w-24 overflow-hidden rounded bg-black/60">
              <div className="h-full bg-gradient-to-r from-amber-200 to-amber-400 transition-[width] duration-200" style={{ width: `${f.cookFrac * 100}%` }} />
            </div>
            <ArrowRight className="text-white/40" size={20} />
          </div>
          <Slot stack={f.slots[2]} size={60} onClick={click('furnace', 2)} onHover={() => game.setHover('furnace', 2)} />
        </div>
        <p className="mb-2 text-center text-[11px] text-white/45">Top: item to smelt · Bottom: fuel (coal, charcoal, wood). Smelts ore→ingots, sand→glass, raw food→cooked.</p>
        <PlayerInv ui={ui} game={game} />
      </PanelShell>
    );
  }

  if (ui.screen === 'chest' && ui.chest) {
    return (
      <PanelShell title="Chest" icon={<Package size={18} className="text-amber-500" />} game={game}>
        <div className="mb-3 grid grid-cols-9 gap-[3px]">
          {ui.chest.map((s, i) => (
            <Slot key={i} stack={s} onClick={click('chest', i)} onHover={() => game.setHover('chest', i)} />
          ))}
        </div>
        <PlayerInv ui={ui} game={game} />
      </PanelShell>
    );
  }

  return null;
}

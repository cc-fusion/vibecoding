import { useEffect, useMemo, useRef, useState } from 'react';
import type { Game } from '../game/game';
import { useGame, Slot, Icon, itemTitle } from './common';
import { ITEMDEF, CREATIVE_ITEMS, maxDur, type Stack } from '../game/items';

let lastX = 0, lastY = 0;

function CursorLayer({ g, hover }: { g: Game; hover: Stack | null }) {
  const cur = useRef<HTMLDivElement>(null), tip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      lastX = e.clientX; lastY = e.clientY;
      if (cur.current) cur.current.style.transform = `translate(${e.clientX - 20}px, ${e.clientY - 20}px)`;
      if (tip.current) tip.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY - 34}px)`;
    };
    window.addEventListener('mousemove', move);
    move({ clientX: lastX, clientY: lastY } as MouseEvent);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  const s = g.cursor.stack;
  return (
    <>
      <div ref={cur} className="pointer-events-none fixed left-0 top-0 z-50" style={{ width: 40, height: 40 }}>
        {s && (<div className="relative w-10 h-10 flex items-center justify-center"><Icon id={s.id} size={36} />{s.n > 1 && <span className="count">{s.n}</span>}</div>)}
      </div>
      <div ref={tip} className="pointer-events-none fixed left-0 top-0 z-50">
        {hover && !s && (
          <div className="px-2 py-1 text-[13px] border-2 border-[#2a0a4a] bg-[#150a20]/95 whitespace-nowrap" style={{ boxShadow: 'inset 0 0 0 1px #5a2a8a' }}>
            <div>{itemTitle(hover)}</div>
            {maxDur(hover.id) > 0 && <div className="text-[11px] text-white/60">Durability {maxDur(hover.id) - (hover.d || 0)} / {maxDur(hover.id)}</div>}
          </div>
        )}
      </div>
    </>
  );
}

export function InventoryScreen({ g }: { g: Game }) {
  useGame(g);
  const [hover, setHover] = useState<Stack | null>(null);
  const [search, setSearch] = useState('');
  const kind = g.screen;
  const creativeView = g.creative && kind === 'inventory';
  const craft = g.activeCraft, be = g.openBE;
  const click = (list: (Stack | null)[], i: number, k: any = 'normal') => (b: number, shift: boolean) => g.slotClick(list, i, k, b, shift);
  const inv = g.inv.slots;
  const recipes = useMemo(() => (kind === 'inventory' || kind === 'table' ? g.recipesFor(craft.w, craft.h) : []), [kind, craft.w, craft.h, g]);
  const sorted = recipes.map((r) => ({ r, can: g.canCraftRecipe(r) })).sort((a, b) => Number(b.can) - Number(a.can));
  const palette = useMemo(() => CREATIVE_ITEMS.filter((id) => !search || ITEMDEF[id]!.name.toLowerCase().includes(search.toLowerCase())), [search]);
  const [zoom, setZoom] = useState(() => Math.min(1, window.innerHeight / (kind === 'chest' || (g.creative && kind === 'inventory') ? 780 : 640)));
  useEffect(() => {
    const f = () => setZoom(Math.min(1, window.innerHeight / (kind === 'chest' || (g.creative && kind === 'inventory') ? 780 : 640)));
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [kind, g]);
  const title = kind === 'inventory' ? (creativeView ? 'Creative Items' : 'Inventory') : kind === 'table' ? 'Crafting Table' : kind === 'furnace' ? 'Furnace' : 'Chest';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/55" onMouseDown={(e) => { if (e.target === e.currentTarget) g.dropCursorOutside(); }} onContextMenu={(e) => e.preventDefault()}>
      <div className="panel p-4" style={{ minWidth: 470, zoom }}>
        <div className="flex justify-between items-center mb-2">
          <div className="text-lg mc-text">{title}</div>
          <button className="text-white/60 hover:text-white text-sm" onClick={() => g.closeScreen()}>✕ close (E)</button>
        </div>

        {creativeView && (
          <div className="mb-3">
            <input className="field mb-2" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()} />
            <div className="scroll grid gap-[2px] overflow-y-auto" style={{ gridTemplateColumns: 'repeat(9, 44px)', maxHeight: 4 * 46 + 2 }}>
              {palette.map((id) => (<Slot key={id} stack={{ id, n: 1 }} onClick={(_b, sh) => g.creativePick(id, sh)} onHover={setHover} />))}
            </div>
          </div>
        )}

        {(kind === 'inventory' && !creativeView) || kind === 'table' ? (
          <div className="flex gap-5 mb-3 items-start">
            <div className="flex items-center gap-3">
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${craft.w}, 44px)` }}>
                {craft.grid.map((s, i) => <Slot key={i} stack={s} onClick={click(craft.grid, i)} onHover={setHover} />)}
              </div>
              <div className="text-2xl text-white/60">➜</div>
              <Slot stack={craft.result} kind="out" size={56} onClick={(b, sh) => g.slotClick([craft.result], 0, 'result', b, sh)} onHover={setHover} />
            </div>
            <div className="flex-1 min-w-[190px]">
              <div className="text-[12px] text-white/60 mb-1">Recipes · click to fill the grid</div>
              <div className="scroll grid gap-[2px] overflow-y-auto content-start" style={{ gridTemplateColumns: 'repeat(5, 38px)', maxHeight: 118 }}>
                {sorted.map(({ r, can }, i) => (
                  <div key={i} className="slot" style={{ width: 38, height: 38, opacity: can ? 1 : 0.35, background: can ? '#3f5a34' : undefined }} onMouseDown={() => g.fillRecipe(r)} onMouseEnter={() => setHover({ id: r.out, n: r.n })} onMouseLeave={() => setHover(null)}>
                    <Icon id={r.out} size={26} />{r.n > 1 && <span className="count" style={{ fontSize: 10 }}>{r.n}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {kind === 'furnace' && be && (
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex flex-col items-center gap-2">
              <Slot stack={be.slots[0]} onClick={click(be.slots, 0, 'furnace_in')} onHover={setHover} />
              <div className="w-8 h-8 relative">
                <div className="absolute inset-0 text-3xl opacity-20 text-center">🔥</div>
                <div className="absolute left-0 right-0 bottom-0 overflow-hidden text-3xl text-center leading-8" style={{ height: `${be.burnMax ? (be.burn / be.burnMax) * 100 : 0}%` }}><div className="absolute bottom-0 left-0 right-0">🔥</div></div>
              </div>
              <Slot stack={be.slots[1]} onClick={click(be.slots, 1, 'furnace_fuel')} onHover={setHover} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-4 bg-black/60 border-2 border-black"><div className="h-full bg-white/80" style={{ width: `${(be.cook / 10) * 100}%` }} /></div>
              <div className="text-[10px] text-white/50">smelting</div>
            </div>
            <Slot stack={be.slots[2]} kind="out" size={56} onClick={click(be.slots, 2, 'furnace_out')} onHover={setHover} />
          </div>
        )}

        {kind === 'chest' && be && (
          <div className="grid gap-[2px] mb-3" style={{ gridTemplateColumns: 'repeat(9, 44px)' }}>
            {be.slots.map((s, i) => <Slot key={i} stack={s} onClick={click(be.slots, i)} onHover={setHover} />)}
          </div>
        )}

        <div className="text-[12px] text-white/60 mb-1">{creativeView ? 'Hotbar & backpack' : 'Backpack'}</div>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(9, 44px)' }}>
          {inv.slice(9).map((s, i) => <Slot key={i + 9} stack={s} onClick={click(inv, i + 9)} onHover={setHover} />)}
        </div>
        <div className="grid gap-[2px] mt-2" style={{ gridTemplateColumns: 'repeat(9, 44px)' }}>
          {inv.slice(0, 9).map((s, i) => <Slot key={i} stack={s} onClick={click(inv, i)} onHover={setHover} />)}
        </div>
        {creativeView && (
          <div className="mt-3 flex items-center gap-3">
            <div className="slot" style={{ width: 44, height: 44 }} onMouseDown={() => g.trashCursor()}><span className="text-xl">🗑️</span></div>
            <div className="text-[12px] text-white/60">Click an item to pick up a stack · shift-click to add · drop on trash to delete</div>
          </div>
        )}
      </div>
      <CursorLayer g={g} hover={hover} />
    </div>
  );
}

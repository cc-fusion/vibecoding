import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { Game } from "@/game/Game";
import { HOTBAR } from "@/game/inventory";
import { itemName, PLACEABLE_BLOCKS, type Recipe } from "@/game/blocks";
import { Button, ItemIcon, Panel, Slot } from "./common";
import { cn } from "@/utils/cn";

export function InventoryScreen({ game }: { game: Game }) {
  const inv = game.inventory;
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [tab, setTab] = useState<"craft" | "blocks">(game.player.creative ? "blocks" : "craft");
  const [craftableOnly, setCraftableOnly] = useState(false);
  const [search, setSearch] = useState("");

  const recipes = game.availableRecipes();
  const stationOk = (r: Recipe) => (r.station === "none" ? true : r.station === "table" ? game.station.table : game.station.furnace);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes
      .map((r) => ({ r, can: inv.canCraft(r), ok: stationOk(r) }))
      .filter((e) => (!craftableOnly || (e.can && e.ok)) && (!q || itemName(e.r.out).toLowerCase().includes(q)))
      .sort((a, b) => Number(b.can && b.ok) - Number(a.can && a.ok));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.version, game.station.table, game.station.furnace, craftableOnly, search, tab]);

  const blocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PLACEABLE_BLOCKS.filter((id) => !q || itemName(id).toLowerCase().includes(q));
  }, [search]);

  const slotHandler = (i: number) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMouse({ x: e.clientX, y: e.clientY });
    game.slotClick(i, e.button === 2 || e.type === "contextmenu" ? 2 : 0, e.shiftKey);
  };

  return (
    <div
      className="absolute inset-0 flex select-none items-center justify-center bg-black/55"
      onMouseMove={game.cursorStack ? (e) => setMouse({ x: e.clientX, y: e.clientY }) : undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && game.cursorStack) game.dropCursor();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex max-h-[92vh] max-w-[96vw] gap-3">
        {/* crafting / creative panel */}
        <Panel className="flex w-[380px] flex-col">
          <div className="mb-2 flex gap-1">
            <TabButton active={tab === "craft"} onClick={() => setTab("craft")}>
              Crafting
            </TabButton>
            {game.player.creative && (
              <TabButton active={tab === "blocks"} onClick={() => setTab("blocks")}>
                All Blocks
              </TabButton>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="ml-auto w-28 rounded-sm border border-stone-600 bg-stone-950/70 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
          {tab === "craft" && (
            <>
              <div className="mb-2 flex items-center gap-3 text-xs">
                <StationBadge ok={game.station.table} label="Crafting Table" />
                <StationBadge ok={game.station.furnace} label="Furnace" />
                <label className="ml-auto flex items-center gap-1 text-stone-300">
                  <input type="checkbox" checked={craftableOnly} onChange={(e) => setCraftableOnly(e.target.checked)} className="accent-emerald-500" />
                  craftable
                </label>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: "60vh" }}>
                {list.length === 0 && <div className="py-6 text-center text-sm text-stone-400">No recipes match.</div>}
                {list.map(({ r, can, ok }) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={(e) => game.craft(r, e.shiftKey)}
                    title={`${itemName(r.out)} ×${r.count}${r.station !== "none" ? ` — needs ${r.station === "table" ? "Crafting Table" : "Furnace"}` : ""}\nClick to craft, Shift+click to craft all`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm border px-2 py-1 text-left transition-colors",
                      can && ok ? "border-emerald-700/60 bg-emerald-900/30 hover:bg-emerald-800/40" : "border-stone-700 bg-stone-900/40 opacity-70 hover:opacity-90",
                    )}
                  >
                    <div className="relative">
                      <ItemIcon id={r.out} size={36} />
                      {r.count > 1 && <span className="text-shadow absolute -bottom-1 -right-1 text-xs font-bold text-white">{r.count}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{itemName(r.out)}</div>
                      <div className="flex flex-wrap items-center gap-1 text-[11px] text-stone-300">
                        {r.in.map((i) => {
                          const have = inv.count(i.id);
                          return (
                            <span key={i.id} className={cn("flex items-center gap-0.5 rounded bg-black/40 px-1", have < i.n && "text-red-300")} title={itemName(i.id)}>
                              <ItemIcon id={i.id} size={14} /> {have}/{i.n}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {r.station !== "none" && (
                      <span className={cn("shrink-0 text-[10px] font-bold uppercase", ok ? "text-emerald-400" : "text-red-400")}>{r.station === "table" ? "Table" : "Furnace"}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === "blocks" && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ maxHeight: "64vh" }}>
              <div className="grid grid-cols-7 gap-0.5">
                {blocks.map((id) => (
                  <Slot
                    key={id}
                    stack={{ id, count: 1 }}
                    size={46}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMouse({ x: e.clientX, y: e.clientY });
                      game.creativeGrab(id, 0);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      game.creativeGrab(id, 2);
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-stone-400">Click: grab a stack · Right click: send to hotbar</p>
            </div>
          )}
        </Panel>

        {/* inventory panel */}
        <Panel title="Inventory" className="flex flex-col">
          <div className="grid grid-cols-9 gap-0.5">
            {Array.from({ length: 27 }, (_, k) => {
              const i = HOTBAR + k;
              return <Slot key={i} stack={inv.slots[i]} size={48} onClick={slotHandler(i)} onContextMenu={slotHandler(i)} />;
            })}
          </div>
          <div className="mt-3 grid grid-cols-9 gap-0.5 border-t-2 border-stone-600 pt-3">
            {Array.from({ length: HOTBAR }, (_, i) => (
              <Slot key={i} stack={inv.slots[i]} size={48} selected={inv.selected === i} onClick={slotHandler(i)} onContextMenu={slotHandler(i)} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-stone-400">Shift+click moves · Right click splits · Click outside drops</span>
            {game.player.creative && game.cursorStack && (
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => game.trashCursor()}>
                Delete held
              </Button>
            )}
            <Button className="px-3 py-1 text-xs" onClick={() => game.closeScreen()}>
              Close (E)
            </Button>
          </div>
        </Panel>
      </div>

      {/* cursor stack */}
      {game.cursorStack && (
        <div className="pointer-events-none fixed z-50" style={{ left: mouse.x - 22, top: mouse.y - 22 }}>
          <Slot stack={game.cursorStack} size={44} className="bg-transparent shadow-none" />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-sm px-3 py-1 text-xs font-bold uppercase tracking-wide", active ? "bg-emerald-700 text-white" : "bg-stone-700 text-stone-300 hover:bg-stone-600")}>
      {children}
    </button>
  );
}

function StationBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 font-bold", ok ? "bg-emerald-900/60 text-emerald-300" : "bg-stone-900/60 text-stone-500")} title={ok ? `${label} nearby` : `No ${label} within reach`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

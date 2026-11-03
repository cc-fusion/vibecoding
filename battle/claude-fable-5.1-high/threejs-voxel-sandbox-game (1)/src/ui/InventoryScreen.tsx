import { useEffect, useState } from "react";
import type { Game } from "../game/game";
import { useHud } from "../game/store";
import { Slot, ItemIcon } from "./ItemIcon";
import { recipesFor, canCraft, type Recipe, type Station } from "../game/crafting";
import { getName, CREATIVE_ITEMS, getFood, getTool } from "../game/blocks";

export function InventoryScreen({ game }: { game: Game }) {
  const hud = useHud();
  const inv = game.inventory;
  const [, force] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [tab, setTab] = useState<"craft" | "creative">(hud.creative ? "creative" : "craft");
  const [filter, setFilter] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const rerender = () => force((n) => n + 1);
  const station: Station = hud.station;

  useEffect(() => {
    const mm = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", mm);
    return () => window.removeEventListener("mousemove", mm);
  }, []);

  const click = (i: number, e: React.MouseEvent, right = false) => {
    if (e.shiftKey) inv.quickMove(i);
    else inv.click(i, right);
    game.audio.play("click");
    rerender();
  };

  const recipes = recipesFor(station);
  const items = CREATIVE_ITEMS.filter((id) => !filter || getName(id).toLowerCase().includes(filter.toLowerCase()));
  const titles: Record<Station, string> = { hand: "Crafting", table: "Crafting Table", furnace: "Furnace" };

  const tooltip = (id: number) => {
    const tool = getTool(id);
    const food = getFood(id);
    return (
      <div>
        <div className="font-bold">{getName(id)}</div>
        {tool && (
          <div className="text-xs text-white/70">
            {tool.type} · tier {tool.tier} · {tool.damage} dmg
          </div>
        )}
        {food && <div className="text-xs text-white/70">Restores {food} hunger</div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/55" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex max-h-[92vh] gap-4">
        {/* Inventory */}
        <div className="mc-panel flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Inventory</h2>
            <span className="text-xs text-white/50">Shift-click to quick move · Right-click to split</span>
          </div>
          <div className="grid grid-cols-9 gap-[2px]">
            {Array.from({ length: 27 }).map((_, k) => {
              const i = k + 9;
              return <Slot key={i} stack={inv.slots[i]} onClick={(e) => click(i, e)} onContextMenu={(e) => click(i, e, true)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
            })}
          </div>
          <div className="grid grid-cols-9 gap-[2px] border-t-2 border-white/10 pt-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Slot key={i} stack={inv.slots[i]} selected={i === inv.selected} onClick={(e) => click(i, e)} onContextMenu={(e) => click(i, e, true)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-white/50">
            <span>Press E or Esc to close</span>
            <button
              className="pointer-events-auto underline hover:text-white"
              onClick={() => {
                game.closeUI();
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Crafting / Creative */}
        <div className="mc-panel flex w-[420px] flex-col p-4">
          <div className="mb-3 flex items-center gap-2">
            <button className={`mc-btn !px-3 !py-1 text-sm ${tab === "craft" ? "primary" : ""}`} onClick={() => setTab("craft")}>
              {titles[station]}
            </button>
            {hud.creative && (
              <button className={`mc-btn !px-3 !py-1 text-sm ${tab === "creative" ? "primary" : ""}`} onClick={() => setTab("creative")}>
                All Items
              </button>
            )}
          </div>
          {tab === "craft" ? (
            <>
              <div className="mb-2 text-xs text-white/60">
                {station === "hand" && "Basic recipes. Use a Crafting Table for tools & more."}
                {station === "table" && "Full recipe book. Click a recipe to craft it."}
                {station === "furnace" && "Smelting. Each operation consumes 1 coal as fuel."}
              </div>
              <div className="scroll-thin grid flex-1 grid-cols-1 gap-1 overflow-y-auto pr-1" style={{ maxHeight: "60vh" }}>
                {recipes.map((r: Recipe, i) => {
                  const ok = canCraft(inv, r);
                  return (
                    <button
                      key={i}
                      disabled={!ok}
                      onClick={() => {
                        game.craft(r);
                        rerender();
                      }}
                      className={`flex items-center gap-3 border-2 px-2 py-1 text-left transition ${ok ? "cursor-pointer border-white/20 bg-white/5 hover:bg-white/15" : "border-white/5 opacity-40"}`}
                    >
                      <div className="relative">
                        <ItemIcon id={r.out.id} size={36} />
                        {r.out.count > 1 && <span className="absolute -bottom-1 -right-1 text-xs font-bold drop-shadow-[1px_1px_0_#000]">{r.out.count}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{getName(r.out.id)}</div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                          {r.in.map((ing, j) => {
                            const have = (r.anyOf?.[ing.id] ?? [ing.id]).reduce((a, id) => a + inv.count(id), 0);
                            return (
                              <span key={j} className={`flex items-center gap-1 ${have >= ing.count ? "text-green-300" : "text-red-300"}`}>
                                <ItemIcon id={ing.id} size={16} />
                                {ing.count}× {getName(ing.id)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <input className="mc-input mb-2 w-full text-sm" placeholder="Search items…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <div className="scroll-thin grid grid-cols-8 gap-[2px] overflow-y-auto pr-1" style={{ maxHeight: "60vh" }}>
                {items.map((id) => (
                  <Slot
                    key={id}
                    stack={{ id, count: 1 }}
                    onClick={() => {
                      game.giveCreative(id);
                      rerender();
                    }}
                    onContextMenu={() => {
                      inv.add(id, 1);
                      rerender();
                    }}
                    title={getName(id)}
                  />
                ))}
              </div>
              <div className="mt-2 text-xs text-white/50">Click for a stack, right-click for one.</div>
            </>
          )}
        </div>
      </div>

      {/* cursor item */}
      {inv.cursor && (
        <div className="pointer-events-none fixed z-30" style={{ left: mouse.x - 18, top: mouse.y - 18 }}>
          <ItemIcon id={inv.cursor.id} size={36} />
          {inv.cursor.count > 1 && <span className="absolute bottom-0 right-0 text-sm font-bold drop-shadow-[1px_1px_0_#000]">{inv.cursor.count}</span>}
        </div>
      )}
      {/* tooltip */}
      {hover !== null && inv.slots[hover] && !inv.cursor && (
        <div className="pointer-events-none fixed z-30 rounded border border-purple-400/50 bg-[#100a1e]/95 px-3 py-1.5 text-white shadow-lg" style={{ left: mouse.x + 14, top: mouse.y + 14 }}>
          {tooltip(inv.slots[hover]!.id)}
        </div>
      )}
    </div>
  );
}

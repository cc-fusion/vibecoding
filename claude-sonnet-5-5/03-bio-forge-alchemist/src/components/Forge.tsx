import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Game, type IngId, type El, ING, POTIONS, RECIPE_KEYS, MON, TIER_NAMES, ROMAN,
  evalGrid, availableIngs, getGridN, getShelfCap, potionValue, getMaxIntegrity, EL_ORDER,
} from "../game/data";
import { IngIcon, PotionIcon, Pips, KeyIcons, keyColors } from "./Icons";
import { groupShelf } from "./Shop";
import { sfx } from "../game/audio";

interface Props {
  g: Game;
  bump: () => void;
  onOpenShop: () => void;
}

const EFFECT: Record<El, string> = {
  E: "Burn (damage over time)",
  D: "Soak: slows; Spark deals x1.5 to soaked",
  M: "Entangle: holds monsters in place",
  S: "Knockback + interrupts attacks",
};

export default function Forge({ g, bump, onOpenShop }: Props) {
  const n = getGridN(g);
  const cap = getShelfCap(g);
  const [sel, setSel] = useState<IngId>("E");
  const [brewing, setBrewing] = useState(false);
  const [tab, setTab] = useState<"forecast" | "recipes">("forecast");
  const [toast, setToast] = useState<string>("");
  const toastT = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      if (toastT.current) window.clearTimeout(toastT.current);
    },
    []
  );

  const say = (msg: string) => {
    setToast(msg);
    if (toastT.current) window.clearTimeout(toastT.current);
    toastT.current = window.setTimeout(() => setToast(""), 2600);
  };

  const ings = availableIngs(g);
  const ingsKey = ings.join("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < ingsKey.length) {
        setSel(ingsKey[i] as IngId);
        sfx.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ingsKey]);
  const clusters = useMemo(() => evalGrid(g.grid, n), [g.grid, n, bumpKey(g)]);
  const clusterOf = useMemo(() => {
    const arr: number[] = new Array(n * n).fill(-1);
    clusters.forEach((c, i) => c.cells.forEach((cell) => (arr[cell] = i)));
    return arr;
  }, [clusters, n]);

  const potionsOut = clusters.filter((c) => c.key);
  const dudCount = clusters.length - potionsOut.length;
  const room = cap - g.shelf.length;
  const tilesPlaced = g.grid.filter(Boolean).length;

  const buy = (id: IngId, qty: number) => {
    const cost = g.prices[id] * qty;
    if (g.gold < cost) {
      sfx.error();
      say("Not enough gold!");
      return;
    }
    g.gold -= cost;
    g.inv[id] += qty;
    sfx.buy();
    bump();
  };

  const placeAt = (i: number, toggle: boolean) => {
    if (brewing) return;
    const cur = g.grid[i];
    if (cur === sel) {
      if (!toggle) return;
      g.grid[i] = null;
      g.inv[sel]++;
      sfx.remove();
      bump();
      return;
    }
    if (g.inv[sel] <= 0) {
      sfx.error();
      say(`Out of ${ING[sel].name}! Buy more in the market.`);
      return;
    }
    if (cur) g.inv[cur]++;
    g.grid[i] = sel;
    g.inv[sel]--;
    sfx.place();
    bump();
  };

  const removeAt = (i: number) => {
    if (brewing) return;
    const cur = g.grid[i];
    if (!cur) return;
    g.grid[i] = null;
    g.inv[cur]++;
    sfx.remove();
    bump();
  };

  const clearGrid = () => {
    if (brewing) return;
    g.grid.forEach((c, i) => {
      if (c) {
        g.inv[c]++;
        g.grid[i] = null;
      }
    });
    sfx.remove();
    bump();
  };

  const brew = () => {
    if (brewing) return;
    if (potionsOut.length === 0) {
      sfx.error();
      say("Nothing to brew! Place ingredient tiles in the cauldron first.");
      return;
    }
    if (potionsOut.length > room) {
      sfx.error();
      say(`Shelf full! You need ${potionsOut.length - room} more free slot(s).`);
      return;
    }
    setBrewing(true);
    sfx.brew();
    const t = window.setTimeout(() => {
      const made = potionsOut.map((c) => ({ key: c.key!, tier: c.tier }));
      g.shelf.push(...made);
      g.grid.fill(null);
      setBrewing(false);
      bump();
      say(`Brewed ${made.length} potion${made.length > 1 ? "s" : ""}!${dudCount ? ` (${dudCount} dud${dudCount > 1 ? "s" : ""} fizzled)` : ""}`);
    }, 850);
    timers.current.push(t);
  };

  const openShop = () => {
    if (brewing) return;
    g.grid.forEach((c, i) => {
      if (c) {
        g.inv[c]++;
        g.grid[i] = null;
      }
    });
    onOpenShop();
  };

  const recycle = (key: string, tier: number) => {
    const idx = g.shelf.findIndex((p) => p.key === key && p.tier === tier);
    if (idx < 0) return;
    g.shelf.splice(idx, 1);
    g.gold += Math.max(1, Math.round(potionValue(key, tier) * 0.3));
    sfx.coin();
    bump();
  };

  // Forecast
  const fc = useMemo(() => {
    const orders = new Map<string, { key: string; tier: number; n: number }>();
    let hidden = 0;
    let cust = 0;
    const raiders = new Map<string, number>();
    let boss: string | null = null;
    for (const ev of g.schedule) {
      if (ev.kind === "cust" && ev.order) {
        cust++;
        if (ev.order.hidden) hidden++;
        else {
          const id = `${ev.order.key}:${ev.order.tier}`;
          const o = orders.get(id);
          if (o) o.n++;
          else orders.set(id, { key: ev.order.key, tier: ev.order.tier, n: 1 });
        }
      } else if (ev.kind === "raid") raiders.set(ev.type, (raiders.get(ev.type) || 0) + 1);
      else if (ev.kind === "boss") boss = ev.type;
    }
    return { orders: [...orders.values()], hidden, cust, raiders: [...raiders.entries()], boss };
  }, [g.schedule]);

  const stacks = groupShelf(g);
  const cell = n === 4 ? 76 : n === 5 ? 66 : 57;

  return (
    <div className="mx-auto w-full max-w-[1240px] p-2 sm:p-3">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-emerald-300/70">Bio-Forge Laboratory</div>
          <div className="text-xl font-bold">Day {g.day} - Preparation</div>
        </div>
        <div className="rounded-md bg-amber-400/15 px-3 py-1 text-lg font-bold text-amber-300">{g.gold}g</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-rose-200">Shop Integrity</span>
          <div className="h-3 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${(g.integrity / getMaxIntegrity(g)) * 100}%` }} />
          </div>
          <span className="tabular-nums text-white/80">{Math.ceil(g.integrity)}/{getMaxIntegrity(g)}</span>
        </div>
        {g.day % 5 === 0 && <div className="animate-pulse rounded-md bg-red-500/25 px-3 py-1 text-sm font-bold text-red-200">BOSS NIGHT</div>}
        <button
          onClick={openShop}
          disabled={brewing}
          className="ml-auto rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-2 text-lg font-extrabold text-black shadow-[0_4px_0_#92400e] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
        >
          Open Shop
        </button>
      </div>

      {g.day === 1 && (
        <div className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm leading-relaxed text-emerald-100">
          <b>Welcome, alchemist!</b> 1) Pick an ingredient on the left, then click (or drag across) cauldron cells to place it. 2) <b>Touching tiles fuse into one potion</b> - separate clusters with empty cells to make several. The elements decide the potion, the cluster size decides its tier. 3) Press <b>Brew</b>, then <b>Open Shop</b>: serve customers by matching their order bubble, and pelt red-ringed raiders with potions!
        </div>
      )}
      {g.notes.map((t, i) => (
        <div key={i} className="mb-2 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">{t}</div>
      ))}

      <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)_330px]">
        {/* Market / Pantry */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-emerald-300">Pantry & Market</h3>
            <span className="text-[10px] text-white/50">prices change daily</span>
          </div>
          <div className="space-y-2">
            {ings.map((id, i) => {
              const d = ING[id];
              const active = sel === id;
              return (
                <div
                  key={id}
                  onClick={() => {
                    setSel(id);
                    sfx.select();
                  }}
                  title={d.desc}
                  className={`cursor-pointer rounded-lg border p-2 transition ${active ? "bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  style={active ? { borderColor: d.color, boxShadow: `0 0 14px ${d.color}55` } : undefined}
                >
                  <div className="flex items-center gap-2">
                    <IngIcon id={id} size={30} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-[10px] text-white/50">
                        {id === "P" ? "size +3, no element" : id === "N" ? "tames 3+ element mixes" : `${d.short} element`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold leading-none" style={{ color: d.color }}>{g.inv[id]}</div>
                      <div className="text-[9px] text-white/40">owned ({i + 1})</div>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      className="flex-1 rounded-md bg-amber-400/20 px-1 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/35"
                      onClick={(e) => {
                        e.stopPropagation();
                        buy(id, 1);
                      }}
                    >
                      Buy 1 - {g.prices[id]}g
                    </button>
                    <button
                      className="flex-1 rounded-md bg-amber-400/20 px-1 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/35"
                      onClick={(e) => {
                        e.stopPropagation();
                        buy(id, 5);
                      }}
                    >
                      x5 - {g.prices[id] * 5}g
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg bg-white/5 p-2 text-[11px] leading-snug text-white/60">
            Tip: Leftover ingredients keep for tomorrow. Killing raiders sometimes drops free ones.
          </div>
        </div>

        {/* Cauldron */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-emerald-300">The Bio-Forge Cauldron ({n}x{n})</h3>
            <div className="flex items-center gap-2 text-xs text-white/60">
              Placing: <IngIcon id={sel} size={18} /> <b style={{ color: ING[sel].color }}>{ING[sel].name}</b>
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className={`relative rounded-2xl border-4 border-[#4a3a2a] bg-gradient-to-b from-[#1b2a22] to-[#0e1712] p-2 shadow-[inset_0_0_30px_rgba(0,255,120,.12)] ${brewing ? "animate-[shake_.12s_infinite]" : ""}`}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)` }}>
                {g.grid.map((c, i) => {
                  const ci = clusterOf[i];
                  const cl = ci >= 0 ? clusters[ci] : null;
                  const col = cl ? (cl.key ? keyColors(cl.key)[0] : "#777") : "#fff";
                  const same = (j: number, ok: boolean) => ok && clusterOf[j] === ci && ci >= 0;
                  const x = i % n;
                  const y = Math.floor(i / n);
                  const bUp = same(i - n, y > 0);
                  const bDown = same(i + n, y < n - 1);
                  const bLeft = same(i - 1, x > 0);
                  const bRight = same(i + 1, x < n - 1);
                  const first = cl && Math.min(...cl.cells) === i;
                  return (
                    <div
                      key={i}
                      onMouseDown={(e) => {
                        if (e.button === 2) removeAt(i);
                        else placeAt(i, true);
                      }}
                      onMouseEnter={(e) => {
                        if (e.buttons === 1 && g.grid[i] !== sel) placeAt(i, false);
                        else if (e.buttons === 2) removeAt(i);
                      }}
                      className={`relative flex items-center justify-center transition ${c ? "" : "hover:bg-white/10"} ${brewing && c ? "animate-pulse" : ""}`}
                      style={{
                        width: cell,
                        height: cell,
                        background: c ? `radial-gradient(circle at 50% 40%, ${ING[c].color}55, ${ING[c].color}18)` : "rgba(255,255,255,.03)",
                        borderStyle: c ? "solid" : "dashed",
                        borderWidth: 3,
                        borderTopColor: c ? (bUp ? "transparent" : col) : "rgba(255,255,255,.08)",
                        borderBottomColor: c ? (bDown ? "transparent" : col) : "rgba(255,255,255,.08)",
                        borderLeftColor: c ? (bLeft ? "transparent" : col) : "rgba(255,255,255,.08)",
                        borderRightColor: c ? (bRight ? "transparent" : col) : "rgba(255,255,255,.08)",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      {c && <IngIcon id={c} size={cell * 0.55} className="pointer-events-none" />}
                      {first && cl && (
                        <div className="pointer-events-none absolute -left-0.5 -top-0.5 rounded-br-md rounded-tl-md bg-black/80 px-1 text-[10px] font-bold leading-tight text-amber-300">
                          {cl.key ? ROMAN[cl.tier] : "x"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={brew}
              disabled={brewing}
              className="rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-6 py-2 font-extrabold text-black shadow-[0_4px_0_#065f46] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
            >
              {brewing ? "Bubbling..." : `Brew ${potionsOut.length || ""} potion${potionsOut.length === 1 ? "" : "s"}`}
            </button>
            <button onClick={clearGrid} disabled={brewing || tilesPlaced === 0} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 disabled:opacity-40">
              Clear grid
            </button>
            <div className="text-xs text-white/50">Left-click / drag to place - click same ingredient or right-click to remove</div>
          </div>
          {toast && <div className="mt-2 rounded-lg bg-amber-300/15 px-3 py-1.5 text-sm text-amber-100">{toast}</div>}

          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="mb-1 flex items-center justify-between text-xs text-white/60">
              <b className="text-white/80">Brew preview</b>
              <span className={potionsOut.length > room ? "text-red-300" : ""}>
                Shelf space: {g.shelf.length}/{cap} ({room} free)
              </span>
            </div>
            {clusters.length === 0 ? (
              <div className="py-2 text-center text-sm text-white/40">Place ingredients to see what will be brewed.</div>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {clusters.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1">
                    {c.key ? <PotionIcon k={c.key} tier={c.tier} size={30} /> : <div className="grid h-[30px] w-[30px] place-items-center text-lg text-white/40">?</div>}
                    <div className="min-w-0 text-xs leading-tight">
                      <div className="truncate font-semibold">{c.key ? POTIONS[c.key].name : "Dud"}</div>
                      <div className="text-[10px] text-white/60">
                        {c.key ? (
                          <>
                            {TIER_NAMES[c.tier - 1]} <Pips tier={c.tier} /> - size {c.size} - {potionValue(c.key, c.tier)}g
                          </>
                        ) : (
                          "size " + c.size
                        )}
                      </div>
                      {c.note && <div className={`text-[10px] ${c.key === "X" ? "text-fuchsia-300" : c.key ? "text-sky-300" : "text-red-300"}`}>{c.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: shelf + tabs */}
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-emerald-300">Potion Shelf</h3>
              <span className="text-xs text-white/60">{g.shelf.length}/{cap}</span>
            </div>
            {stacks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 p-3 text-center text-sm text-white/40">No potions yet. Brew some!</div>
            ) : (
              <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-1">
                {stacks.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1">
                    <PotionIcon k={s.key} tier={s.tier} size={32} />
                    <div className="min-w-0 flex-1 text-xs leading-tight">
                      <div className="truncate font-semibold">{POTIONS[s.key].name}</div>
                      <div className="text-[10px] text-white/60">
                        Tier {ROMAN[s.tier]} <Pips tier={s.tier} /> - {potionValue(s.key, s.tier)}g
                      </div>
                    </div>
                    <span className="font-bold text-amber-200">x{s.count}</span>
                    <button
                      title="Recycle one for 30% of its value (frees a slot)"
                      onClick={() => recycle(s.key, s.tier)}
                      className="rounded bg-red-400/20 px-1.5 py-0.5 text-[10px] text-red-200 hover:bg-red-400/40"
                    >
                      recycle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="mb-2 flex gap-1">
              {(["forecast", "recipes"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    sfx.click();
                  }}
                  className={`flex-1 rounded-md px-2 py-1 text-sm font-semibold capitalize ${tab === t ? "bg-emerald-400/25 text-emerald-200" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                >
                  {t === "forecast" ? "Tonight's Forecast" : "Recipe Book"}
                </button>
              ))}
            </div>
            {tab === "forecast" ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="mb-1 font-semibold text-white/80">Customers: {fc.cust}</div>
                  {fc.orders.length === 0 && fc.hidden === 0 && <div className="text-white/40">None</div>}
                  <div className="space-y-1">
                    {fc.orders.map((o) => {
                      const have = g.shelf.filter((p) => p.key === o.key && p.tier >= o.tier).length;
                      const ok = have >= o.n;
                      return (
                        <div key={`${o.key}:${o.tier}`} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1">
                          <PotionIcon k={o.key} tier={o.tier} size={22} />
                          <span className="flex-1 truncate">{POTIONS[o.key].name} {ROMAN[o.tier]}+</span>
                          <span className="font-bold">x{o.n}</span>
                          <span className={ok ? "text-emerald-300" : "text-rose-300"}>{ok ? "ready" : `have ${have}`}</span>
                        </div>
                      );
                    })}
                    {fc.hidden > 0 && <div className="rounded bg-white/5 px-2 py-1 text-white/60">+ {fc.hidden} walk-in(s) with unknown orders</div>}
                  </div>
                </div>
                <div>
                  <div className="mb-1 font-semibold text-rose-200">Raiders expected</div>
                  {fc.raiders.length === 0 && !fc.boss && <div className="text-white/40">A quiet night. Enjoy it!</div>}
                  <div className="space-y-1">
                    {fc.raiders.map(([t, c]) => (
                      <MonRow key={t} type={t} count={c} />
                    ))}
                    {fc.boss && <MonRow type={fc.boss} count={1} boss />}
                  </div>
                </div>
                <div className="rounded bg-white/5 p-2 text-[11px] text-white/50">
                  Customers that run out of patience turn into raiders. Keep attack potions in reserve!
                </div>
              </div>
            ) : (
              <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1 text-xs">
                {RECIPE_KEYS.map((k) => (
                  <div key={k} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1">
                    <PotionIcon k={k} size={26} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="font-semibold">{POTIONS[k].name}</div>
                      <div className="text-[10px] text-white/50">{POTIONS[k].blurb}</div>
                    </div>
                    {k === "X" ? <span className="text-[10px] text-fuchsia-300">3+ elems</span> : <KeyIcons k={k} size={15} />}
                  </div>
                ))}
                <div className="mt-2 rounded bg-white/5 p-2 leading-snug text-white/70">
                  <b className="text-white/90">Tiers by cluster size:</b> 1-2 tiles = Crude (I), 3-4 = Fine (II), 5+ = Potent (III). Two-element blends sell for x1.5.
                </div>
                <div className="rounded bg-white/5 p-2 leading-snug text-white/70">
                  <b className="text-white/90">Thrown effects:</b>
                  {EL_ORDER.map((e) => (
                    <div key={e} className="mt-1 flex items-center gap-1">
                      <IngIcon id={e} size={14} /> {EFFECT[e]}
                    </div>
                  ))}
                  <div className="mt-1">Hitting a monster's <b>weakness</b> element deals double damage.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function bumpKey(g: Game) {
  return g.grid.map((c) => c ?? "-").join("");
}

function MonRow({ type, count, boss }: { type: string; count: number; boss?: boolean }) {
  const d = MON[type];
  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1 ${boss ? "bg-red-500/20 ring-1 ring-red-400/40" : "bg-white/5"}`}>
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: d.look.body }} />
      <span className="flex-1 truncate">
        {d.name} {boss && <b className="text-red-300">(BOSS)</b>}
      </span>
      {count > 1 && <span className="font-bold">x{count}</span>}
      {d.weak && (
        <span className="flex items-center gap-1 text-[10px] text-white/60">
          weak: <IngIcon id={d.weak} size={14} />
        </span>
      )}
    </div>
  );
}

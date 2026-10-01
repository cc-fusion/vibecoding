import { CHARTS, FISH, FISH_KINDS, LEVY, MAX_UPGRADE, UPGRADES, UPGRADE_KEYS, relicById } from "../game/data";
import { currentLevy, fuelPrice, holdUsed, holdValue, sellPrice, upgradeCost, type Action } from "../game/engine";
import type { Game } from "../game/types";

function SmallBtn({
  children,
  onClick,
  disabled,
  tone = "brass",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "brass" | "sky";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded text-xs font-semibold border transition disabled:opacity-35 disabled:cursor-not-allowed ${
        tone === "brass"
          ? "bg-amber-600/80 hover:bg-amber-500 border-amber-300/60 text-black"
          : "bg-sky-800/70 hover:bg-sky-700 border-sky-300/30 text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, icon, locked, children }: { title: string; icon: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-sky-300/15 bg-[#0a2036]/90 p-3">
      <div className="font-display text-brass-light tracking-wide mb-2">
        {icon} {title}
      </div>
      <div className={locked ? "opacity-30 pointer-events-none select-none" : ""}>{children}</div>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-amber-200 font-semibold bg-black/30 rounded-xl">
          🔒 Pay the levy first
        </div>
      )}
    </div>
  );
}

export default function Harbor({ g, act }: { g: Game; act: (a: Action) => void }) {
  const p = g.p;
  const h = g.harbor!;
  const levy = currentLevy(g);
  const wealth = p.gold + holdValue(g);
  const paid = h.levyPaid;
  const canPay = p.gold >= levy;
  const next = CHARTS[g.chart] ?? CHARTS[4];
  const fp = fuelPrice(g);

  const supply = (label: string, icon: string, have: number, max: number, price: number, one: string, all: string) => (
    <div className="flex items-center gap-2 text-sm py-1 border-b border-sky-300/10 last:border-0">
      <span className="w-6 text-center">{icon}</span>
      <span className="flex-1">
        {label}{" "}
        <span className="text-sky-200/60 text-xs">
          {have}/{max}
        </span>
      </span>
      <span className="text-xs text-amber-200 w-10 text-right">{price}g ea</span>
      <SmallBtn tone="sky" disabled={have >= max || p.gold < price} onClick={() => act({ type: "buy", item: one })}>
        +1
      </SmallBtn>
      <SmallBtn disabled={have >= max || p.gold < price} onClick={() => act({ type: "buy", item: all })}>
        Fill
      </SmallBtn>
    </div>
  );

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#040b14]/95 fade-in">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <div className="text-xs tracking-[0.3em] text-sky-300/60">CHART {g.chart} COMPLETE</div>
            <h2 className="font-display text-3xl md:text-4xl text-brass-light">⚓ Harbor of {CHARTS[g.chart - 1].name}</h2>
          </div>
          <div className="flex-1" />
          <div className="rounded-lg border border-amber-300/40 bg-amber-900/20 px-4 py-2 text-right">
            <div className="text-[10px] uppercase tracking-widest text-amber-100/70">Your gold</div>
            <div className="text-3xl font-bold text-amber-200">🪙 {p.gold}</div>
          </div>
        </div>

        {/* levy */}
        <div
          className={`rounded-xl border p-3 mb-4 flex flex-wrap items-center gap-3 ${
            paid ? "border-emerald-400/50 bg-emerald-900/20" : "border-red-400/40 bg-red-950/30"
          }`}
        >
          <div className="text-3xl">🏛️</div>
          <div className="flex-1 min-w-[220px]">
            <div className="font-semibold">
              {paid ? "Levy paid — the harbor is open to you." : `The Harbor Master demands a levy of ${levy}g.`}
            </div>
            <div className="text-xs text-sky-100/70">
              {paid
                ? "Visit the shipwright and the relic dealer, then set sail."
                : canPay
                ? "Pay it to unlock the shipwright and relic dealer."
                : wealth >= levy
                ? "You're short on gold — sell some of your catch at the market first."
                : "Your gold and your whole catch together cannot cover it..."}
            </div>
          </div>
          {!paid && (
            <SmallBtn disabled={!canPay} onClick={() => act({ type: "levy" })}>
              Pay {levy}g
            </SmallBtn>
          )}
          {!paid && wealth < levy && (
            <button onClick={() => act({ type: "forfeit" })} className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-sm font-semibold border border-red-300/50">
              Declare bankruptcy
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* market */}
          <Section title="Fish Market" icon="🐟">
            <div className="space-y-2">
              {FISH_KINDS.map((k) => {
                const price = sellPrice(g, k);
                const base = FISH[k].value * (1 + p.sellBonus);
                const diff = price - base;
                return (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="text-xl w-7 text-center">{FISH[k].icon}</span>
                    <div className="flex-1">
                      <div>
                        {FISH[k].name} <span className="text-sky-200/60">×{p.hold[k]}</span>
                      </div>
                      <div className={`text-xs ${diff > 0.4 ? "text-emerald-300" : diff < -0.4 ? "text-red-300" : "text-sky-200/60"}`}>
                        {price}g each {diff > 0.4 ? "▲ in demand" : diff < -0.4 ? "▼ glut" : "— steady"}
                      </div>
                    </div>
                    <SmallBtn tone="sky" disabled={p.hold[k] === 0} onClick={() => act({ type: "sell", kind: k, all: false })}>
                      Sell 1
                    </SmallBtn>
                    <SmallBtn disabled={p.hold[k] === 0} onClick={() => act({ type: "sell", kind: k, all: true })}>
                      All
                    </SmallBtn>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-sky-100/70 border-t border-sky-300/10 pt-2">
              <span>
                Hold {holdUsed(p)}/{p.holdMax} · worth {holdValue(g)}g
              </span>
              <SmallBtn
                disabled={holdUsed(p) === 0}
                onClick={() => FISH_KINDS.forEach((k) => act({ type: "sell", kind: k, all: true }))}
              >
                Sell everything
              </SmallBtn>
            </div>
            {p.sellBonus > 0 && <div className="text-[11px] text-amber-200 mt-1">🧭 Astrolabe bonus +{Math.round(p.sellBonus * 100)}% applied</div>}
          </Section>

          {/* shipwright */}
          <Section title="Shipwright" icon="🔧" locked={!paid}>
            {supply("Fuel", "⛽", p.fuel, p.maxFuel, fp, "fuel1", "fuelMax")}
            {supply("Hull repair", "❤️", p.hull, p.maxHull, 4, "hull1", "hullMax")}
            {supply("Net mending", "🕸️", p.nets, p.maxNets, 2, "net1", "netMax")}
            {supply("Harpoons", "🔱", p.harpoons, p.maxHarpoons, 3, "harp1", "harpMax")}
            <div className="text-[10px] uppercase tracking-widest text-sky-200/50 mt-3 mb-1">Permanent upgrades</div>
            <div className="space-y-1.5">
              {UPGRADE_KEYS.map((k) => {
                const u = UPGRADES[k];
                const lvl = p.upg[k];
                const maxed = lvl >= MAX_UPGRADE;
                const cost = upgradeCost(g, k);
                return (
                  <div key={k} className="flex items-center gap-2 rounded-lg bg-black/25 border border-sky-300/10 px-2 py-1">
                    <span className="text-lg">{u.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold">{u.name}</div>
                      <div className="text-[10px] text-sky-200/60">{u.desc}</div>
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: MAX_UPGRADE }).map((_, i) => (
                          <span key={i} className={`h-1.5 w-4 rounded ${i < lvl ? "bg-amber-400" : "bg-sky-900"}`} />
                        ))}
                      </div>
                    </div>
                    <SmallBtn disabled={maxed || p.gold < cost} onClick={() => act({ type: "buy", item: `up:${k}` })}>
                      {maxed ? "MAX" : `${cost}g`}
                    </SmallBtn>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* relic dealer */}
          <Section title="Relic Dealer" icon="🏺" locked={!paid}>
            {h.offers.length === 0 && <div className="text-sm text-sky-200/60">The dealer has nothing left to sell.</div>}
            <div className="space-y-2">
              {h.offers.map((id) => {
                const r = relicById(id);
                return (
                  <div key={id} className="rounded-lg border border-amber-400/30 bg-amber-900/15 p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{r.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-amber-100">{r.name}</div>
                        <div className="text-xs text-sky-100/70">{r.desc}</div>
                      </div>
                      <SmallBtn disabled={p.gold < r.price} onClick={() => act({ type: "buy", item: `relic:${id}` })}>
                        {r.price}g
                      </SmallBtn>
                    </div>
                  </div>
                );
              })}
            </div>
            {p.relics.length > 0 && (
              <div className="mt-3 pt-2 border-t border-sky-300/10">
                <div className="text-[10px] uppercase tracking-widest text-sky-200/50 mb-1">Your artifacts</div>
                <div className="flex flex-wrap gap-1">
                  {p.relics.map((id) => (
                    <span key={id} title={`${relicById(id).name}: ${relicById(id).desc}`} className="text-xl cursor-help">
                      {relicById(id).icon}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-sky-300/15 bg-[#0a2036]/90 p-4">
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs tracking-widest text-sky-300/60">NEXT DESTINATION</div>
            <div className="font-display text-xl text-brass-light">
              Chart {g.chart + 1}: {next.name}
            </div>
            <div className="text-xs text-sky-100/70">
              {next.sub} {g.chart + 1 === 5 ? "No harbor lies beyond — bring harpoons, hull, and courage." : `Next levy: ${currentLevyFor(g.chart + 1)}g.`}
            </div>
          </div>
          <button onClick={() => act({ type: "leave" })} disabled={!paid} className="brass-btn px-8 py-3 rounded-lg text-lg font-display">
            Set Sail →
          </button>
        </div>
      </div>
    </div>
  );
}

function currentLevyFor(chart: number) {
  return LEVY[Math.min(chart - 1, LEVY.length - 1)];
}

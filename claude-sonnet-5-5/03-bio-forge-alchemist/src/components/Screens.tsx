import { useState } from "react";
import { type Game, UPGRADES, getMaxIntegrity, totalScore, bestScore, MON, ING, EL_ORDER } from "../game/data";
import { IngIcon, PotionIcon } from "./Icons";
import { sfx } from "../game/audio";

export function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-emerald-400/30 bg-[#120f1c] p-5 text-sm leading-relaxed shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-emerald-300">How to Play</h2>
          <button className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20" onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl bg-white/5 p-3">
            <h3 className="mb-1 font-bold text-amber-300">1. By day: Brew</h3>
            <p className="text-white/80">
              Buy ingredients, select one, and place tiles on the cauldron grid. <b>Touching tiles fuse into ONE potion.</b> Its elements decide the recipe (one or two elements; three or more makes volatile Chaos Sludge). Its size decides the tier: 1-2 tiles Crude, 3-4 Fine, 5+ Potent. Leave empty cells between clusters to brew several potions at once. Your shelf has limited slots!
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {EL_ORDER.map((e) => (
                <span key={e} className="flex items-center gap-1 rounded bg-black/40 px-2 py-0.5 text-xs">
                  <IngIcon id={e} size={16} /> {ING[e].short}
                </span>
              ))}
            </div>
          </section>
          <section className="rounded-xl bg-white/5 p-3">
            <h3 className="mb-1 font-bold text-amber-300">2. By night: Serve</h3>
            <p className="text-white/80">
              Monsters line up at your counter with an order bubble: the elements and tier they want. Select a matching potion (click it or press 1-9), then click the customer. Faster service pays more, and serving in quick succession builds a combo bonus. A higher-tier potion than requested is accepted and pays more.
            </p>
          </section>
          <section className="rounded-xl bg-white/5 p-3">
            <h3 className="mb-1 font-bold text-rose-300">3. Defend the shop</h3>
            <p className="text-white/80">
              Raiders (red ring) attack your shop. Select any potion and click one to hurl it. Hitting a monster's <b>weakness</b> doubles damage. Fire burns, Dew soaks and slows, Moss entangles, Spark knocks back - and <b>Soaked + Spark = x1.5 shock</b>. Chaos Sludge hits every raider at once. No potion selected? Click to swat for small damage. Customers who lose patience become raiders too!
            </p>
          </section>
          <section className="rounded-xl bg-white/5 p-3">
            <h3 className="mb-1 font-bold text-sky-300">4. Grow</h3>
            <p className="text-white/80">
              After each night, spend gold on upgrades: a wider forge, more shelf space, tougher walls, a Ward Rune sentry, catalysts (Prism Shard: +3 size; Null Salt: stabilizes 3-element mixes) and more. Repair your shop before it falls. Survive <b>10 days</b> (bosses arrive on days 5 and 10) to win!
            </p>
          </section>
        </div>
        <div className="mt-4 rounded-xl bg-white/5 p-3 text-xs text-white/70">
          <b className="text-white/90">Shortcuts:</b> 1-9 select potion - P pause - F fast-forward - Esc deselect - Right-click a cauldron cell to remove.
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {["E", "D", "M", "S", "ED", "DS", "X"].map((k) => (
            <PotionIcon key={k} k={k} tier={2} size={34} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Title({ onStart }: { onStart: () => void }) {
  const [help, setHelp] = useState(false);
  const best = bestScore();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 text-center">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="bubble absolute rounded-full"
            style={{
              left: `${(i * 53) % 100}%`,
              width: 14 + ((i * 17) % 40),
              height: 14 + ((i * 17) % 40),
              animationDelay: `${(i % 9) * -1.3}s`,
              animationDuration: `${7 + (i % 6)}s`,
              background: ["#7bd86b55", "#4cc9f055", "#b14cff44", "#ffd93d44"][i % 4],
            }}
          />
        ))}
      </div>
      <div className="relative z-10">
        <div className="mb-4 flex justify-center gap-2">
          {["E", "D", "M", "S", "X"].map((k, i) => (
            <div key={k} className="animate-[float_3s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.25}s` }}>
              <PotionIcon k={k} tier={3} size={56} />
            </div>
          ))}
        </div>
        <h1 className="bg-gradient-to-b from-emerald-200 via-emerald-400 to-emerald-700 bg-clip-text text-5xl font-black tracking-tight text-transparent drop-shadow-[0_4px_0_rgba(0,0,0,.5)] sm:text-7xl" style={{ fontFamily: "Georgia, serif" }}>
          BIO-FORGE
        </h1>
        <div className="-mt-1 text-2xl font-bold tracking-[0.35em] text-amber-300 sm:text-3xl" style={{ fontFamily: "Georgia, serif" }}>
          ALCHEMIST
        </div>
        <p className="mx-auto mt-4 max-w-md text-white/70">
          Brew living potions on a grid, serve eccentric monster customers, and defend your apothecary when they lose their patience.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => {
              sfx.open();
              onStart();
            }}
            className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-10 py-3 text-xl font-extrabold text-black shadow-[0_5px_0_#065f46] transition hover:brightness-110 active:translate-y-1 active:shadow-none"
          >
            Open the Shop
          </button>
          <button onClick={() => setHelp(true)} className="rounded-xl bg-white/10 px-6 py-2 font-semibold hover:bg-white/20">
            How to Play
          </button>
          {best > 0 && <div className="text-sm text-amber-300/80">Best score: {best}</div>}
        </div>
      </div>
      {help && <HowTo onClose={() => setHelp(false)} />}
    </div>
  );
}

export function Summary({ g, bump, onNext }: { g: Game; bump: () => void; onNext: () => void }) {
  const s = g.stats;
  const maxI = getMaxIntegrity(g);
  const [msg, setMsg] = useState("");
  const buyUpgrade = (id: string) => {
    const u = UPGRADES.find((x) => x.id === id)!;
    const lvl = g.upg[id] || 0;
    if (lvl >= u.costs.length) return;
    const cost = u.costs[lvl];
    if (g.gold < cost) {
      sfx.error();
      setMsg("Not enough gold for that upgrade.");
      return;
    }
    g.gold -= cost;
    g.upg[id] = lvl + 1;
    if (id === "walls") g.integrity = Math.min(getMaxIntegrity(g), g.integrity + 25);
    sfx.buy();
    setMsg(`Purchased ${u.name}!`);
    bump();
  };
  const repair = (amt: number) => {
    const need = Math.ceil(maxI - g.integrity);
    const a = Math.min(amt, need);
    if (a <= 0) return;
    const cost = Math.ceil(a * 1.5);
    if (g.gold < cost) {
      sfx.error();
      setMsg("Not enough gold to repair.");
      return;
    }
    g.gold -= cost;
    g.integrity = Math.min(maxI, g.integrity + a);
    sfx.buy();
    bump();
  };
  const needRepair = Math.ceil(maxI - g.integrity);
  return (
    <div className="mx-auto w-full max-w-5xl p-3">
      <div className="mb-3 rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-400/10 to-transparent p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-amber-300/70">Closing time</div>
            <h2 className="text-3xl font-black text-amber-200" style={{ fontFamily: "Georgia, serif" }}>Day {g.day} survived!</h2>
          </div>
          <div className="rounded-xl bg-amber-400/15 px-4 py-2 text-2xl font-bold text-amber-300">{g.gold}g</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
          <Stat label="Served" v={s.served} />
          <Stat label="Gold earned" v={`${s.earned}g`} />
          <Stat label="Raiders slain" v={s.killed} />
          <Stat label="Enraged" v={s.angry} bad={s.angry > 0} />
          <Stat label="Damage taken" v={Math.round(s.integrityLost)} bad={s.integrityLost > 0} />
          <Stat label="Best combo" v={`x${s.bestCombo}`} />
        </div>
        {s.stolen > 0 && <div className="mt-2 text-sm text-rose-300">Thieves made off with {s.stolen}g.</div>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3">
        <div className="font-bold text-rose-200">Shop Integrity</div>
        <div className="h-3 w-48 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${(g.integrity / maxI) * 100}%` }} />
        </div>
        <span className="tabular-nums">{Math.ceil(g.integrity)}/{maxI}</span>
        <div className="ml-auto flex gap-2">
          <button disabled={needRepair <= 0} onClick={() => repair(10)} className="rounded-lg bg-emerald-400/20 px-3 py-1 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/35 disabled:opacity-40">
            Repair 10 ({Math.ceil(Math.min(10, needRepair) * 1.5)}g)
          </button>
          <button disabled={needRepair <= 0} onClick={() => repair(9999)} className="rounded-lg bg-emerald-400/20 px-3 py-1 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/35 disabled:opacity-40">
            Full repair ({Math.ceil(needRepair * 1.5)}g)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-emerald-300">Shop Upgrades</h3>
          {msg && <span className="text-sm text-amber-200">{msg}</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {UPGRADES.map((u) => {
            const lvl = g.upg[u.id] || 0;
            const maxed = lvl >= u.costs.length;
            const cost = maxed ? 0 : u.costs[lvl];
            const afford = g.gold >= cost;
            return (
              <div key={u.id} className="flex flex-col rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">{u.name}</div>
                  <div className="flex gap-1">
                    {u.costs.map((_, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full ${i < lvl ? "bg-emerald-400" : "bg-white/20"}`} />
                    ))}
                  </div>
                </div>
                <div className="mt-1 flex-1 text-xs text-white/60">{u.desc}</div>
                <button
                  disabled={maxed || !afford}
                  onClick={() => buyUpgrade(u.id)}
                  className={`mt-2 rounded-md px-3 py-1.5 text-sm font-bold ${maxed ? "bg-white/5 text-white/40" : afford ? "bg-amber-400 text-black hover:bg-amber-300" : "bg-white/10 text-white/40"}`}
                >
                  {maxed ? "MAXED" : `Buy - ${cost}g`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/60">
          Next: <b className="text-white">Day {g.day + 1}</b>
          {(g.day + 1) % 5 === 0 && <span className="ml-2 font-bold text-red-300">A boss approaches: {MON[g.day + 1 === 5 ? "ogre" : "dragon"].name}!</span>}
        </div>
        <button
          onClick={onNext}
          className="rounded-2xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-8 py-3 text-lg font-extrabold text-black shadow-[0_4px_0_#065f46] transition hover:brightness-110 active:translate-y-0.5 active:shadow-none"
        >
          Start Day {g.day + 1} Prep
        </button>
      </div>
    </div>
  );
}

function Stat({ label, v, bad }: { label: string; v: string | number; bad?: boolean }) {
  return (
    <div className="rounded-lg bg-black/30 p-2 text-center">
      <div className={`text-xl font-bold ${bad ? "text-rose-300" : "text-white"}`}>{v}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}

export function EndScreen({ g, won, onRestart, onContinue }: { g: Game; won: boolean; onRestart: () => void; onContinue?: () => void }) {
  const score = totalScore(g);
  const best = bestScore();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={`w-full max-w-lg rounded-3xl border p-6 text-center shadow-2xl ${won ? "border-amber-300/50 bg-gradient-to-b from-amber-400/15 to-[#120f1c]" : "border-red-500/40 bg-gradient-to-b from-red-900/30 to-[#120f1c]"}`}>
        <div className="mb-2 flex justify-center gap-1">
          {(won ? ["E", "DM", "S"] : ["X", "X", "X"]).map((k, i) => (
            <PotionIcon key={i} k={k} tier={3} size={54} />
          ))}
        </div>
        <h2 className="text-4xl font-black" style={{ fontFamily: "Georgia, serif", color: won ? "#fde68a" : "#fca5a5" }}>
          {won ? "Legendary Apothecary!" : "The Shop Has Fallen"}
        </h2>
        <p className="mt-2 text-white/70">
          {won
            ? "You outbrewed the Tax Ogre and the Hoardwyrm. Your shop is the talk of the monster realm!"
            : `Your apothecary was reduced to rubble on Day ${g.day}. The monsters are already picking through the wreckage.`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Days survived" v={won ? g.day : g.day - 1} />
          <Stat label="Customers served" v={g.totals.served} />
          <Stat label="Raiders slain" v={g.totals.killed} />
          <Stat label="Gold earned" v={`${g.totals.earned}g`} />
        </div>
        <div className="mt-4 text-2xl font-bold text-amber-300">Score: {score}</div>
        <div className="text-xs text-white/50">Best: {Math.max(best, score)}</div>
        <div className="mt-5 flex flex-col gap-2">
          {won && onContinue && (
            <button onClick={onContinue} className="rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3 font-extrabold text-black shadow-[0_4px_0_#92400e] hover:brightness-110">
              Continue in Endless Mode
            </button>
          )}
          <button onClick={onRestart} className="rounded-xl bg-gradient-to-b from-emerald-300 to-emerald-500 px-6 py-3 font-extrabold text-black shadow-[0_4px_0_#065f46] hover:brightness-110">
            {won ? "Start a New Shop" : "Rebuild & Try Again"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { Game } from "./game/engine";
import { MAX_SECTOR, ORE, OreType, Screen, SECTORS, UPGRADES } from "./game/data";

const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`;

function Btn({
  children,
  onClick,
  tone = "cyan",
  disabled,
  big,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "cyan" | "green" | "amber" | "red";
  disabled?: boolean;
  big?: boolean;
}) {
  const tones = {
    cyan: "border-cyan-400 text-cyan-200 hover:bg-cyan-400/20 shadow-cyan-500/30",
    green: "border-emerald-400 text-emerald-200 hover:bg-emerald-400/20 shadow-emerald-500/30",
    amber: "border-amber-400 text-amber-200 hover:bg-amber-400/20 shadow-amber-500/30",
    red: "border-rose-400 text-rose-200 hover:bg-rose-400/20 shadow-rose-500/30",
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`border bg-black/40 font-bold tracking-widest shadow-[0_0_18px] transition disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:hover:bg-transparent ${
        big ? "px-8 py-3 text-lg" : "px-4 py-2 text-sm"
      } ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Panel({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div
        className={`my-auto w-full ${
          wide ? "max-w-5xl" : "max-w-2xl"
        } border border-cyan-400/50 bg-slate-950/90 p-6 font-mono text-slate-200 shadow-[0_0_40px_rgba(34,211,238,0.25)]`}
      >
        {children}
      </div>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 rounded border border-cyan-400/60 bg-cyan-400/10 px-1.5 py-0.5 text-xs text-cyan-200">{children}</span>;
}

function Menu({ game }: { game: Game }) {
  return (
    <Panel>
      <div className="text-center">
        <div className="text-xs tracking-[0.5em] text-cyan-400">ORE-CORP DEEP FIELD DIVISION</div>
        <h1 className="mt-2 text-4xl font-black tracking-widest text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)] sm:text-5xl">
          SUBLIGHT
          <br />
          MINING RIG
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Carve asteroids down to their golden cores. Route reactor power. Keep your hull cool. Out-gun the automated drones. Meet the quota in five
          sectors.
        </p>
      </div>
      <div className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <Key>W</Key>
          <Key>A</Key>
          <Key>S</Key>
          <Key>D</Key> thrust (inertia!)
        </div>
        <div>
          <Key>MOUSE</Key> aim the rig
        </div>
        <div>
          <Key>HOLD LMB</Key> drill rock & cores
        </div>
        <div>
          <Key>RMB</Key>/<Key>SPACE</Key> pulse cannon
        </div>
        <div>
          <Key>1</Key>–<Key>4</Key> add power pip (<Key>SHIFT</Key>+n removes)
        </div>
        <div>
          <Key>ESC</Key> pause · <Key>M</Key> mute
        </div>
      </div>
      <ul className="mt-5 space-y-1.5 border-t border-cyan-400/20 pt-4 text-xs leading-relaxed text-slate-400">
        <li>
          <span className="text-cyan-300">POWER —</span> Your reactor has limited pips. Engines, Drill, Cannon and Cooling all compete. More drill power =
          faster carving but far more heat.
        </li>
        <li>
          <span className="text-orange-300">HEAT —</span> Drilling and firing heat the hull. At 100% the drill and cannon lock out; above 92% the hull
          melts. Ice ore cools you down.
        </li>
        <li>
          <span className="text-amber-300">CORES —</span> Drill into the glowing centre of a rock and hold to extract its core: huge payout, heavy heat,
          heavy cargo (3 units).
        </li>
        <li>
          <span className="text-fuchsia-300">DRONES —</span> Scouts shoot, Breachers ram, Jammers EMP a power system offline for 5s — re-route while it is
          down.
        </li>
        <li>
          <span className="text-emerald-300">STATION —</span> Fly slowly into the green ring to sell ore, cool down, repair and buy upgrades.
        </li>
      </ul>
      <div className="mt-6 text-center">
        <Btn big onClick={() => game.newGame()}>
          ▶ BEGIN SHIFT
        </Btn>
      </div>
    </Panel>
  );
}

function Shop({ game, refresh }: { game: Game; refresh: () => void }) {
  const cfg = SECTORS[game.sector - 1];
  const sale = game.lastSale;
  const saleItems = (Object.keys(sale.items) as OreType[]).filter((k) => sale.items[k] > 0);
  const complete = game.sectorComplete;
  const pct = Math.min(100, (game.sectorSold / cfg.quota) * 100);
  const bossLeft = game.sector === MAX_SECTOR && !game.bossDefeated;
  return (
    <Panel wide>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.4em] text-emerald-400">DOCKED · REFINERY STATION</div>
          <h2 className="text-2xl font-black tracking-widest text-cyan-200">
            SECTOR {game.sector} · {cfg.name}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">CREDITS</div>
          <div className="text-3xl font-black text-amber-300">¤ {game.credits}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="border border-slate-700 bg-black/30 p-3">
          <div className="text-xs tracking-widest text-slate-400">CARGO SOLD</div>
          {saleItems.length === 0 ? (
            <div className="mt-1 text-sm text-slate-500">Nothing this trip.</div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {saleItems.map((k) => (
                <span key={k} style={{ color: ORE[k].color }}>
                  {sale.items[k]}× {ORE[k].name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 text-sm text-amber-300">+¤ {sale.value}</div>
        </div>
        <div className="border border-slate-700 bg-black/30 p-3">
          <div className="flex justify-between text-xs tracking-widest text-slate-400">
            <span>SECTOR QUOTA</span>
            <span className={complete ? "text-emerald-300" : "text-amber-300"}>
              ¤{game.sectorSold} / ¤{cfg.quota}
            </span>
          </div>
          <div className="mt-2 h-3 w-full border border-slate-600 bg-slate-900">
            <div className={`h-full ${pct >= 100 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {complete
              ? "Quota filed. Your hull is repaired for free at the next sector."
              : pct >= 100 && bossLeft
                ? "Quota met — but the Overseer still prowls the field. Destroy it."
                : cfg.blurb}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {UPGRADES.map((u) => {
          const lvl = game.upg[u.id] || 0;
          const maxed = lvl >= u.max;
          const cost = u.cost(lvl);
          const can = !maxed && game.credits >= cost;
          return (
            <div key={u.id} className="flex flex-col justify-between border border-slate-700 bg-black/30 p-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-cyan-200">{u.name}</div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: u.max }).map((_, i) => (
                      <span key={i} className={`h-2 w-2 ${i < lvl ? "bg-cyan-300" : "bg-slate-700"}`} />
                    ))}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-400">{u.desc}</div>
                <div className="mt-1 text-xs text-emerald-300">
                  Now: {u.effect(lvl)}
                  {!maxed && <span className="text-slate-500"> → {u.effect(lvl + 1)}</span>}
                </div>
              </div>
              <button
                disabled={!can}
                onClick={() => {
                  game.buy(u.id);
                  refresh();
                }}
                className={`mt-2 border px-2 py-1 text-xs font-bold tracking-widest transition ${
                  maxed
                    ? "border-slate-700 text-slate-500"
                    : can
                      ? "border-amber-400 text-amber-200 hover:bg-amber-400/20"
                      : "cursor-not-allowed border-slate-700 text-slate-500"
                }`}
              >
                {maxed ? "MAXED" : `UPGRADE  ¤${cost}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-400/20 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm">
            HULL{" "}
            <span className={game.ship.hull < game.maxHull ? "text-amber-300" : "text-emerald-300"}>
              {Math.ceil(game.ship.hull)}/{game.maxHull}
            </span>
          </div>
          <Btn
            tone="green"
            disabled={game.repairCost <= 0 || game.credits < 1}
            onClick={() => {
              game.repair();
              refresh();
            }}
          >
            REPAIR (¤1 / pt)
          </Btn>
        </div>
        {complete ? (
          <Btn big tone="green" onClick={() => game.nextSector()}>
            DEPLOY TO SECTOR {game.sector + 1} ▶
          </Btn>
        ) : (
          <Btn big onClick={() => game.undock()}>
            UNDOCK ▶
          </Btn>
        )}
      </div>
    </Panel>
  );
}

function Pause({ game }: { game: Game }) {
  return (
    <Panel>
      <h2 className="text-center text-3xl font-black tracking-widest text-cyan-200">PAUSED</h2>
      <p className="mt-2 text-center text-sm text-slate-400">Reactor idling. Drones holding position.</p>
      <div className="mt-6 flex justify-center gap-4">
        <Btn big onClick={() => game.resume()}>
          RESUME
        </Btn>
        <Btn tone="red" onClick={() => game.toMenu()}>
          ABANDON RUN
        </Btn>
      </div>
    </Panel>
  );
}

function Stats({ game }: { game: Game }) {
  const s = game.stats;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
      {[
        ["EARNED", `¤${s.earned}`],
        ["DRONES KILLED", s.kills],
        ["CORES TAKEN", s.cores],
        ["TIME", fmtTime(s.time)],
      ].map(([k, v]) => (
        <div key={k as string} className="border border-slate-700 bg-black/30 p-2">
          <div className="text-[10px] tracking-widest text-slate-500">{k}</div>
          <div className="text-lg font-bold text-amber-300">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Over({ game }: { game: Game }) {
  return (
    <Panel>
      <h2 className="text-center text-4xl font-black tracking-widest text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]">RIG LOST</h2>
      <p className="mt-2 text-center text-sm text-slate-400">{game.deathCause}. Ore-Corp will bill you for the wreckage.</p>
      <p className="mt-1 text-center text-xs text-slate-500">
        Reached sector {game.sector} · {SECTORS[game.sector - 1].name}
      </p>
      <Stats game={game} />
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Btn big tone="amber" onClick={() => game.retrySector()}>
          RETRY SECTOR (−25% ¤, keep upgrades)
        </Btn>
        <Btn tone="red" onClick={() => game.newGame()}>
          NEW RUN
        </Btn>
        <Btn onClick={() => game.toMenu()}>MENU</Btn>
      </div>
    </Panel>
  );
}

function Win({ game }: { game: Game }) {
  return (
    <Panel>
      <div className="text-center text-xs tracking-[0.5em] text-emerald-400">CONTRACT FULFILLED</div>
      <h2 className="mt-1 text-center text-4xl font-black tracking-widest text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]">
        MOTHERLODE CLAIMED
      </h2>
      <p className="mt-2 text-center text-sm text-slate-400">
        The Overseer is scrap, the quotas are filed and the board is thrilled. You are promoted to Senior Deep-Field Prospector.
      </p>
      <Stats game={game} />
      <div className="mt-6 flex justify-center gap-3">
        <Btn big tone="green" onClick={() => game.newGame()}>
          NEW SHIFT
        </Btn>
        <Btn onClick={() => game.toMenu()}>MENU</Btn>
      </div>
    </Panel>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas);
    g.onScreen = (s) => {
      setScreen(s);
      refresh();
    };
    gameRef.current = g;
    g.start();
    refresh();
    return () => {
      g.destroy();
      gameRef.current = null;
    };
  }, []);

  const g = gameRef.current;
  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none" style={{ cursor: screen === "playing" ? "none" : "default" }}>
      <canvas ref={canvasRef} className="block" />
      {g && screen === "menu" && <Menu game={g} />}
      {g && screen === "shop" && <Shop game={g} refresh={refresh} />}
      {g && screen === "paused" && <Pause game={g} />}
      {g && screen === "over" && <Over game={g} />}
      {g && screen === "win" && <Win game={g} />}
    </div>
  );
}

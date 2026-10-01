import type { ReactNode } from "react";
import { CORES, CORE_IDS, MODS, UPGRADES, FINAL_WAVE } from "../game/data";
import type { CoreId, ModId, UpgradeId } from "../game/data";
import type { Game, Offer } from "../game/engine";

const neon = (c: string) => ({ color: c, textShadow: `0 0 8px ${c}, 0 0 24px ${c}88` });

function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#04020e]/75 p-3 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className={`w-full ${wide ? "max-w-6xl" : "max-w-2xl"} my-auto`}>{children}</div>
    </div>
  );
}

function NeonButton({
  children,
  onClick,
  color = "#22e8ff",
  disabled = false,
  small = false,
}: {
  children: ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={(e) => {
        onClick();
        (e.currentTarget as HTMLButtonElement).blur();
      }}
      className={`rounded border-2 font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100 ${
        small ? "px-3 py-1.5 text-[11px]" : "px-7 py-3 text-sm"
      }`}
      style={{
        borderColor: color,
        color,
        background: `${color}18`,
        boxShadow: disabled ? "none" : `0 0 14px ${color}55, inset 0 0 14px ${color}22`,
      }}
    >
      {children}
    </button>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-block rounded border border-cyan-400/60 bg-cyan-400/10 px-1.5 py-0.5 text-[11px] font-bold text-cyan-200">
      {children}
    </span>
  );
}

function Controls() {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] text-slate-300 sm:grid-cols-2">
      <div>
        <Key>W</Key>
        <Key>A</Key>
        <Key>S</Key>
        <Key>D</Key> move
      </div>
      <div>
        <Key>MOUSE</Key> aim · hold <Key>LMB</Key> fire
      </div>
      <div>
        <Key>SPACE</Key> / <Key>SHIFT</Key> / <Key>RMB</Key> dash
      </div>
      <div>
        <Key>P</Key> pause · <Key>M</Key> mute
      </div>
      <div className="text-slate-400 sm:col-span-2">Gamepad: left stick move · right stick aim &amp; fire · A / LB dash</div>
    </div>
  );
}

export function MenuOverlay({ game }: { game: Game }) {
  return (
    <Shell>
      <div className="rounded-lg border border-fuchsia-500/40 bg-black/60 p-6 text-center shadow-[0_0_60px_#ff2bd655] sm:p-10">
        <div className="text-[11px] uppercase tracking-[0.6em] text-cyan-300/80">Arena Protocol // Season 01</div>
        <h1 className="mt-3 text-4xl font-black uppercase leading-none tracking-wider sm:text-6xl" style={neon("#22e8ff")}>
          Neon Grid
        </h1>
        <h1 className="text-4xl font-black uppercase leading-none tracking-wider sm:text-6xl" style={neon("#ff2bd6")}>
          Gladiator
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-slate-300">
          Survive {FINAL_WAVE} waves of the grid. <span className="text-cyan-300">Dash through enemy bullets to reflect them</span>, scavenge scrap, and
          forge your weapon from modular cores and mods between rounds. Three bosses guard the crown.
        </p>
        <div className="my-6 rounded border border-cyan-400/20 bg-cyan-400/5 p-4 text-left">
          <Controls />
        </div>
        <div className="flex flex-col items-center gap-3">
          <NeonButton onClick={() => game.startRun()} color="#22e8ff">
            ▶ Enter the Grid
          </NeonButton>
          <div className="text-xs tracking-widest text-slate-400">
            HIGH SCORE <span className="text-yellow-300">{game.best.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function PauseOverlay({ game }: { game: Game }) {
  return (
    <Shell>
      <div className="rounded-lg border border-cyan-400/40 bg-black/70 p-8 text-center shadow-[0_0_50px_#22e8ff44]">
        <h2 className="text-4xl font-black uppercase tracking-widest" style={neon("#22e8ff")}>
          Paused
        </h2>
        <div className="my-6 rounded border border-cyan-400/20 bg-cyan-400/5 p-4 text-left">
          <Controls />
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <NeonButton onClick={() => game.togglePause()}>Resume</NeonButton>
          <NeonButton onClick={() => game.toMenu()} color="#ff3b6e">
            Abandon Run
          </NeonButton>
        </div>
      </div>
    </Shell>
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function Stat({ label, value, color = "#fff" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function EndOverlay({ game, victory }: { game: Game; victory: boolean }) {
  const r = game.run;
  const color = victory ? "#ffd700" : "#ff3355";
  return (
    <Shell>
      <div className="rounded-lg border bg-black/70 p-6 text-center sm:p-9" style={{ borderColor: `${color}88`, boxShadow: `0 0 60px ${color}44` }}>
        <h2 className="text-4xl font-black uppercase tracking-widest sm:text-5xl" style={neon(color)}>
          {victory ? "Grid Champion" : "Hull Breach"}
        </h2>
        <p className="mt-3 text-sm text-slate-300">
          {victory
            ? "The Overmind is offline. The crowd chants your name. You may retire... or keep fighting in endless mode."
            : `The grid claims another gladiator on wave ${r.wave}.`}
        </p>
        {r.newBest && <div className="mt-3 text-sm font-bold tracking-[0.3em] text-yellow-300">★ NEW HIGH SCORE ★</div>}
        <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Score" value={r.score.toLocaleString()} color="#ffe14f" />
          <Stat label="Wave" value={r.wave} color="#22e8ff" />
          <Stat label="Kills" value={r.kills} />
          <Stat label="Best Chain" value={`${r.maxCombo}`} color="#ff5cf0" />
          <Stat label="Reflected" value={r.reflects} color="#ffffff" />
          <Stat label="Time" value={fmtTime(r.time)} />
        </div>
        <div className="text-xs tracking-widest text-slate-400">
          HIGH SCORE <span className="text-yellow-300">{game.best.toLocaleString()}</span>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {victory && (
            <NeonButton onClick={() => game.continueEndless()} color="#ffd700">
              ∞ Continue (Endless)
            </NeonButton>
          )}
          <NeonButton onClick={() => game.startRun()} color="#22e8ff">
            ↻ {victory ? "New Run" : "Retry"}
          </NeonButton>
          <NeonButton onClick={() => game.toMenu()} color="#ff2bd6">
            Main Menu
          </NeonButton>
        </div>
      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ Forge

function PartCard({ game, offer, free, onClick }: { game: Game; offer: Offer; free: boolean; onClick: () => void }) {
  const isCore = offer.kind === "core";
  const core = isCore ? CORES[offer.id as CoreId] : null;
  const mod = !isCore ? MODS[offer.id as ModId] : null;
  const color = core ? core.color : mod!.color;
  const icon = core ? "◉" : mod!.icon;
  const name = core ? core.name : mod!.name;
  const lvl = mod ? game.run.owned[mod.id] || 0 : 0;
  const canGet = game.canAcquire(offer.kind, offer.id);
  const price = free ? 0 : game.priceOf(offer);
  const afford = game.run.scrap >= price;
  const locked = offer.sold || !canGet || (free && game.run.freePicked) || (!free && !afford);
  const desc = core ? core.desc : mod!.desc(lvl + 1);
  const tag = core ? "CORE" : lvl > 0 ? `FUSE → LV ${lvl + 1}` : "MODULE";
  return (
    <button
      disabled={locked}
      onClick={(e) => {
        onClick();
        (e.currentTarget as HTMLButtonElement).blur();
      }}
      className="group relative flex flex-col rounded border p-3 text-left transition-all duration-150 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed"
      style={{
        borderColor: locked ? "#ffffff22" : color,
        background: locked ? "#ffffff06" : `${color}12`,
        boxShadow: locked ? "none" : `0 0 14px ${color}33`,
        opacity: offer.sold ? 0.35 : locked && !free && !afford ? 0.6 : locked ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded border text-lg font-black" style={{ borderColor: color, color, background: `${color}22` }}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold uppercase tracking-wide" style={{ color }}>
            {name}
          </div>
          <div className="text-[9px] tracking-[0.25em] text-slate-400">{tag}</div>
        </div>
      </div>
      <div className="mt-2 flex-1 text-[11px] leading-snug text-slate-300">{desc}</div>
      <div className="mt-2 text-right text-xs font-black tracking-wider">
        {offer.sold ? (
          <span className="text-slate-500">{free ? "TAKEN" : "SOLD"}</span>
        ) : !canGet ? (
          <span className="text-slate-500">{isCore ? "OWNED" : "MAX LEVEL"}</span>
        ) : free ? (
          <span className="text-emerald-300">FREE PICK</span>
        ) : (
          <span className={afford ? "text-yellow-300" : "text-red-400"}>◆ {price}</span>
        )}
      </div>
    </button>
  );
}

function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-0.5 text-[11px]">
      <span className="text-slate-400">{k}</span>
      <span className="font-bold text-slate-100">{v}</span>
    </div>
  );
}

export function ForgeOverlay({ game }: { game: Game }) {
  const r = game.run;
  const w = game.weapon;
  const slots = game.slots();
  const dps = w.damage * w.count * w.burst * w.rate;
  const ownedMods = (Object.keys(r.owned) as ModId[]).filter((id) => (r.owned[id] || 0) > 0);
  const hp = Math.round(game.playerHp());
  const maxHp = game.maxHp();
  const nextWave = r.wave + 1;
  const bossNext = nextWave % 5 === 0;
  const tags: string[] = [];
  if (w.pierce) tags.push(`Pierce ${w.pierce}`);
  if (w.bounce) tags.push(`Bounce ${w.bounce}`);
  if (w.homing) tags.push("Homing");
  if (w.explode) tags.push(`Blast ${w.explode}px`);
  if (w.chain) tags.push(`Chain ${w.chain}`);
  if (w.slow) tags.push(`Cryo ${Math.round(w.slow * 100)}%`);
  if (w.burn) tags.push(`Burn ${w.burn}/s`);
  if (w.vamp) tags.push(`Leech ${w.vamp}`);
  if (w.reflectMult > 1) tags.push(`Reflect ×${w.reflectMult.toFixed(2)}`);

  return (
    <Shell wide>
      <div className="rounded-lg border border-cyan-400/40 bg-[#05030f]/90 p-4 shadow-[0_0_50px_#22e8ff33] sm:p-6">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.5em] text-slate-400">Wave {r.wave} cleared</div>
            <h2 className="text-2xl font-black uppercase tracking-widest sm:text-3xl" style={neon("#22e8ff")}>
              Forge Bay
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] tracking-[0.3em] text-slate-400">SCRAP</div>
              <div className="text-2xl font-black text-yellow-300">◆ {r.scrap}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[0.3em] text-slate-400">SCORE</div>
              <div className="text-2xl font-black text-white">{r.score.toLocaleString()}</div>
            </div>
            <NeonButton onClick={() => game.startNextWave()} color={bossNext ? "#ff3355" : "#7dff4f"}>
              {bossNext ? "☠ Boss Wave" : "Start Wave"} {nextWave} ▶
            </NeonButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* loadout */}
          <div className="rounded border border-white/10 bg-white/[0.03] p-3 lg:col-span-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-300">Loadout</div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-slate-400">CORE</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {CORE_IDS.filter((id) => r.ownedCores.includes(id)).map((id) => {
                const c = CORES[id];
                const active = r.core === id;
                return (
                  <button
                    key={id}
                    onClick={(e) => {
                      game.setCore(id);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                    className="rounded border px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition hover:scale-105"
                    style={{
                      borderColor: active ? c.color : "#ffffff33",
                      color: active ? c.color : "#9fb4d6",
                      background: active ? `${c.color}25` : "transparent",
                      boxShadow: active ? `0 0 10px ${c.color}66` : "none",
                    }}
                  >
                    {c.name.replace(" Core", "")}
                  </button>
                );
              })}
            </div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-slate-400">
              MODULE SLOTS ({r.equipped.length}/{slots})
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {Array.from({ length: slots }).map((_, i) => {
                const id = r.equipped[i];
                const m = id ? MODS[id] : null;
                return (
                  <button
                    key={i}
                    disabled={!m}
                    onClick={(e) => {
                      if (id) game.toggleEquip(id);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                    className="flex h-16 flex-col items-center justify-center rounded border text-center transition enabled:hover:scale-105"
                    style={{
                      borderColor: m ? m.color : "#ffffff22",
                      borderStyle: m ? "solid" : "dashed",
                      background: m ? `${m.color}18` : "transparent",
                    }}
                    title={m ? "Click to unequip" : "Empty slot"}
                  >
                    {m ? (
                      <>
                        <span className="text-xl" style={{ color: m.color }}>
                          {m.icon}
                        </span>
                        <span className="text-[9px] font-bold uppercase leading-tight" style={{ color: m.color }}>
                          {m.name}
                        </span>
                        <span className="text-[9px] text-slate-300">LV {r.owned[id] || 1}</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-500">EMPTY</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mb-1 text-[10px] tracking-[0.25em] text-slate-400">MODULE BAY (click to equip)</div>
            <div className="mb-3 flex min-h-[32px] flex-wrap gap-1.5">
              {ownedMods.length === 0 && <span className="text-[11px] text-slate-500">No modules yet — claim a free pick →</span>}
              {ownedMods.map((id) => {
                const m = MODS[id];
                const eq = r.equipped.includes(id);
                return (
                  <button
                    key={id}
                    onClick={(e) => {
                      game.toggleEquip(id);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                    title={m.desc(r.owned[id] || 1)}
                    className="rounded border px-1.5 py-1 text-[10px] font-bold uppercase transition hover:scale-105"
                    style={{
                      borderColor: eq ? m.color : "#ffffff33",
                      color: m.color,
                      background: eq ? `${m.color}28` : "transparent",
                      opacity: eq ? 1 : 0.65,
                    }}
                  >
                    {m.icon} {m.name} L{r.owned[id]}
                  </button>
                );
              })}
            </div>
            <div className="rounded bg-black/40 p-2">
              <StatRow k="Damage / shot" v={`${w.damage.toFixed(1)}${w.count > 1 ? ` ×${w.count}` : ""}${w.burst > 1 ? ` ×${w.burst}` : ""}`} />
              <StatRow k="Fire rate" v={`${w.rate.toFixed(2)} /s`} />
              <StatRow k="Est. DPS" v={dps.toFixed(0)} />
              <StatRow k="Hull" v={`${hp} / ${maxHp}`} />
              <StatRow k="Dash" v={`${game.maxCharges()} charges · ${game.dashCd().toFixed(2)}s`} />
              {tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-200">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* salvage */}
          <div className="lg:col-span-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-300">Salvage — choose 1 free part</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {r.free.map((o, i) => (
                <PartCard key={`f${i}`} game={game} offer={o} free onClick={() => game.pickFree(i)} />
              ))}
            </div>
            <div className="mb-2 mt-4 flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-yellow-300">Scrap Market</div>
              <NeonButton small color="#ffe14f" disabled={r.scrap < game.rerollCost()} onClick={() => game.reroll()}>
                Reroll ◆ {game.rerollCost()}
              </NeonButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {r.market.map((o, i) => (
                <PartCard key={`m${i}-${o.id}`} game={game} offer={o} free={false} onClick={() => game.buyMarket(i)} />
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Buying a module you already own <span className="text-fuchsia-300">fuses</span> it to the next level (max 3). Combine <span className="text-cyan-200">Cryo</span> +{" "}
              <span className="text-orange-300">Burn</span> on one target to trigger <span className="text-yellow-300">Thermal Shock</span>.
            </p>
          </div>

          {/* upgrades */}
          <div className="rounded border border-white/10 bg-white/[0.03] p-3 lg:col-span-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-fuchsia-300">Chassis Upgrades</div>
            <div className="flex flex-col gap-2">
              {UPGRADES.map((u) => {
                const lv = r.lv[u.id as UpgradeId];
                const maxed = lv >= u.max;
                const price = game.upgradePrice(u.id);
                const afford = r.scrap >= price;
                return (
                  <button
                    key={u.id}
                    disabled={maxed || !afford}
                    onClick={(e) => {
                      game.buyUpgrade(u.id);
                      (e.currentTarget as HTMLButtonElement).blur();
                    }}
                    className="rounded border p-2 text-left transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed"
                    style={{
                      borderColor: maxed ? "#ffffff22" : afford ? u.color : "#ffffff22",
                      background: afford && !maxed ? `${u.color}10` : "transparent",
                      opacity: maxed ? 0.5 : afford ? 1 : 0.6,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold uppercase" style={{ color: u.color }}>
                        {u.icon} {u.name}
                      </span>
                      <span className="text-[11px] font-black">
                        {maxed ? <span className="text-slate-400">MAX</span> : <span className={afford ? "text-yellow-300" : "text-red-400"}>◆ {price}</span>}
                      </span>
                    </div>
                    <div className="text-[10px] leading-snug text-slate-400">{u.desc}</div>
                    <div className="mt-1 flex gap-1">
                      {Array.from({ length: u.max }).map((_, i) => (
                        <span key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: i < lv ? u.color : "#ffffff1f" }} />
                      ))}
                    </div>
                  </button>
                );
              })}
              <button
                disabled={r.scrap < game.repairCost() || hp >= maxHp}
                onClick={(e) => {
                  game.repair();
                  (e.currentTarget as HTMLButtonElement).blur();
                }}
                className="rounded border border-rose-400 bg-rose-500/10 p-2 text-left transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase text-rose-300">✚ Field Repair</span>
                  <span className="text-[11px] font-black text-yellow-300">◆ {game.repairCost()}</span>
                </div>
                <div className="text-[10px] text-slate-400">Restore 50% hull. ({hp}/{maxHp})</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

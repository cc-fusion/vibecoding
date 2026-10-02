import { useState } from "react";
import { audio } from "../game/audio";
import {
  bossUnlocked,
  bribeCost,
  bribeWatch,
  buyConsumable,
  buyPick,
  buyUpgrade,
  consumableCost,
  contractPay,
  fenceMul,
  heatLabel,
  hintLevel,
  layLow,
  lootValue,
  modPayMul,
  nextRank,
  pickCost,
  rankIndex,
  rankName,
  rentFor,
  sellLoot,
  upgradeCost,
} from "../game/campaign";
import {
  CLIENTS,
  CLIENT_IDS,
  CONSUMABLES,
  CONSUMABLE_IDS,
  DIFFS,
  KINDS,
  LOOT,
  LOOT_KINDS,
  MAX_ITEMS,
  MAX_PICKS,
  MECH_INFO,
  MODS,
  RANKS,
  UPGRADES,
  UPGRADE_IDS,
} from "../game/data";
import type { Campaign, ClientId, Contract, ModId, Settings } from "../game/types";
import { fmtGold } from "../game/util";
import { Modal } from "./Modals";

interface HubProps {
  campaign: Campaign;
  settings: Settings;
  onCampaign: (c: Campaign) => void;
  onStartJob: (ct: Contract, mods: ModId[]) => void;
  onGameOver: (c: Campaign, kind: "arrested" | "bankrupt") => void;
  onSettings: () => void;
  onHelp: () => void;
  onQuit: () => void;
}

type Tab = "board" | "workshop" | "fence" | "ledger";

export default function Hub(p: HubProps) {
  const c = p.campaign;
  const [tab, setTab] = useState<Tab>("board");
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2200);
  };
  const rank = rankIndex(c.renown);
  const nr = nextRank(c.renown);
  const rankPct = nr ? ((c.renown - RANKS[rank].at) / (nr.at - RANKS[rank].at)) * 100 : 100;
  const heatCol = c.heat < 25 ? "#46cfa0" : c.heat < 50 ? "#ffd05a" : c.heat < 75 ? "#ff9a4a" : "#ff4a3a";
  const rent = rentFor(c, p.settings);

  const doLayLow = () => {
    audio.ui();
    const r = layLow(c, p.settings);
    if (r.gameOver) {
      p.onGameOver(r.campaign, r.gameOver);
      return;
    }
    p.onCampaign(r.campaign);
    flash(`You lay low. Day ${r.campaign.day}. Heat cooled, rent paid.`);
  };

  const tabs: [Tab, string, string][] = [
    ["board", "Contracts", "📜"],
    ["workshop", "Workshop", "🔧"],
    ["fence", `Fence${c.loot.length ? ` (${c.loot.length})` : ""}`, "💰"],
    ["ledger", "Ledger", "📒"],
  ];

  return (
    <div className="flex h-full w-full flex-col bg-[radial-gradient(ellipse_at_50%_0%,#231b2d_0%,#120e18_55%,#07060a_100%)]">
      {/* header */}
      <div className="border-b border-[#d6a84c]/25 bg-black/40 px-3 py-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-[140px]">
            <div className="font-display text-lg font-black leading-tight text-[#f3d88d]">House {c.house}</div>
            <div className="text-[11px] text-[#9d9484]">Generation {c.generation + 1} · {DIFFS[p.settings.difficulty].name}</div>
          </div>
          <Stat label="Day" value={String(c.day)} />
          <Stat label="Gold" value={`${c.gold < 0 ? "−" : ""}${fmtGold(Math.abs(c.gold))}g`} color={c.gold < 0 ? "#ff7a6a" : "#ffd05a"} />
          <div className="min-w-[130px] flex-1 basis-40">
            <div className="flex justify-between text-[11px]"><span className="font-bold text-[#d6a84c]">⚜ {rankName(c.renown)}</span><span className="text-[#9d9484]">{c.renown}{nr ? ` / ${nr.at}` : ""}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-[#8a6a2c] to-[#ffe08a]" style={{ width: `${rankPct}%`, transition: "width .6s" }} /></div>
          </div>
          <div className="min-w-[120px] flex-1 basis-32" title="Heat: raises patrol frequency, cuts time and fence prices. 100 = arrest.">
            <div className="flex justify-between text-[11px]"><span className="font-bold" style={{ color: heatCol }}>🔥 Heat — {heatLabel(c.heat)}</span><span className="text-[#9d9484]">{Math.round(c.heat)}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full" style={{ width: `${c.heat}%`, background: heatCol, transition: "width .6s" }} /></div>
          </div>
          <div className="flex gap-1.5">
            <button className="btn btn-sm" onClick={doLayLow} title={`Skip a day: Heat −20, pay ${rent}g rent`}>🌙 Lay Low</button>
            <button className="btn btn-sm" onClick={() => { audio.ui(); p.onHelp(); }}>?</button>
            <button className="btn btn-sm" onClick={() => { audio.ui(); p.onSettings(); }}>⚙</button>
            <button className="btn btn-sm" onClick={() => { audio.back(); p.onQuit(); }}>Menu</button>
          </div>
        </div>
      </div>
      {/* tabs */}
      <div className="border-b border-white/10 bg-black/20 px-2">
        <div className="mx-auto flex max-w-6xl overflow-x-auto">
          {tabs.map(([id, label, icon]) => (
            <button key={id} className={`tab ${tab === id ? "tab-active" : ""}`} onClick={() => { audio.ui(); setTab(id); }}>{icon} {label}</button>
          ))}
          <div className="ml-auto hidden items-center pr-2 text-[11px] text-[#9d9484] sm:flex">Rent: {rent}g/day · Picks: {c.picks}</div>
        </div>
      </div>
      <div className="scroll-y min-h-0 flex-1 p-3">
        <div className="mx-auto max-w-6xl">
          {c.gold < 0 && <div className="mb-3 rounded-lg border border-red-400/40 bg-red-950/40 p-2 text-center text-sm text-red-200">You're in debt ({fmtGold(c.gold)}g). Below −150g your dynasty goes bankrupt. Take a job!</div>}
          {c.heat >= 70 && <div className="mb-3 rounded-lg border border-orange-400/40 bg-orange-950/40 p-2 text-center text-sm text-orange-200">The watch is closing in (Heat {Math.round(c.heat)}). Lay low or bribe the captain before another alarm ends you.</div>}
          {tab === "board" && <Board c={c} s={p.settings} onStart={p.onStartJob} goTab={setTab} />}
          {tab === "workshop" && <Workshop c={c} onCampaign={p.onCampaign} flash={flash} />}
          {tab === "fence" && <Fence c={c} onCampaign={p.onCampaign} flash={flash} />}
          {tab === "ledger" && <Ledger c={c} s={p.settings} onCampaign={p.onCampaign} flash={flash} />}
        </div>
      </div>
      {toast && <div className="anim-slide fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-[#d6a84c]/60 bg-black/90 px-5 py-2 text-sm text-[#f3d88d] shadow-xl">{toast}</div>}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[#9d9484]">{label}</div>
      <div className="font-display text-lg font-black tabular-nums" style={{ color: color || "#f3d88d" }}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ board */

function StageIcons({ ct }: { ct: Contract }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ct.stages.map((s, i) => (
        <span key={i} title={`${MECH_INFO[s.type].name} (lvl ${s.level})${s.affix ? " · " + s.affix : ""}`} className="relative flex h-7 w-7 items-center justify-center rounded border border-white/15 bg-white/5 text-sm">
          {MECH_INFO[s.type].icon}
          {s.affix && <span className="absolute -right-1 -top-1.5 text-[9px]">{s.affix === "trapped" ? "☠" : s.affix === "rusted" ? "⛓" : "🚨"}</span>}
        </span>
      ))}
    </div>
  );
}

function Board({ c, s, onStart, goTab }: { c: Campaign; s: Settings; onStart: (ct: Contract, mods: ModId[]) => void; goTab: (t: Tab) => void }) {
  const [sel, setSel] = useState<Contract | null>(null);
  const refused = CLIENT_IDS.filter((id) => c.rep[id] <= -40);
  const boss = c.board.find((b) => b.boss);
  const rest = c.board.filter((b) => !b.boss);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-black text-[#f3d88d]">Today's Contracts</h2>
        <div className="text-xs text-[#9d9484]">
          {bossUnlocked(c) ? "The Sovereign's Vault awaits." : `Reach rank “${RANKS[4].name}” (${RANKS[4].at} renown) to unlock the Sovereign's Vault.`}
        </div>
      </div>
      {boss && (
        <button onClick={() => { audio.ui(); setSel(boss); }} className="mb-3 w-full rounded-xl border-2 border-[#ff5a3a]/70 bg-gradient-to-r from-[#3a1410] via-[#25100f] to-[#3a1410] p-4 text-left transition hover:brightness-125" style={{ animation: "pulseRed 2.4s infinite" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-xl font-black text-[#ff9a7a]">🏛️ The Sovereign's Vault {c.bossDone && <span className="text-sm text-emerald-300">(breached — replay for loot)</span>}</div>
              <div className="text-xs text-[#d8b8a8]">The capstone challenge. Eight locks of every kind, traps, alarms and relentless patrols.</div>
            </div>
            <div className="text-right font-display text-lg font-bold text-[#ffd05a]">{fmtGold(boss.pay)}g+</div>
          </div>
          <div className="mt-2"><StageIcons ct={boss} /></div>
        </button>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((ct) => {
          const cl = ct.client === "odd" ? null : CLIENTS[ct.client as ClientId];
          const col = cl?.color ?? "#b0a898";
          return (
            <button key={ct.id} onClick={() => { audio.ui(); setSel(ct); }} className="panel flex flex-col gap-2 p-3 text-left transition hover:-translate-y-0.5 hover:brightness-125" style={{ borderColor: col + "66" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: col }}>{cl ? `${cl.icon} ${cl.name}` : "🗝️ Freelance"}</span>
                <span className="text-xs tracking-widest text-[#ffd05a]">{"★".repeat(ct.tier)}<span className="text-[#3a3440]">{"★".repeat(5 - ct.tier)}</span></span>
              </div>
              <div className="font-display text-base font-bold leading-tight text-[#f3d88d]">{ct.title}</div>
              <div className="text-[11px] text-[#9d9484]">{KINDS[ct.kind].icon} {KINDS[ct.kind].name} · {ct.stages.length} locks</div>
              <StageIcons ct={ct} />
              <div className="mt-auto flex items-end justify-between pt-1">
                <div className="text-[11px] text-[#9d9484]">⏳ {Math.round(ct.timeLimit)}s base · 🎁 {ct.lootCount}+ loot</div>
                <div className="font-display text-lg font-black text-[#ffd05a]">{fmtGold(contractPay(c, ct, [], s))}g</div>
              </div>
            </button>
          );
        })}
      </div>
      {refused.length > 0 && (
        <div className="mt-3 text-xs text-red-300/80">
          {refused.map((id) => `${CLIENTS[id].icon} ${CLIENTS[id].name} refuses to deal with you until their grudge fades.`).join(" ")}
        </div>
      )}
      <p className="mt-3 text-[11px] text-[#7d7566]">Board refreshes each day. Higher client reputation unlocks higher-tier work. Need supplies first?{" "}
        <button className="underline hover:text-[#f3d88d]" onClick={() => goTab("workshop")}>Visit the workshop</button>.</p>
      {sel && <ContractModal c={c} s={s} ct={sel} onClose={() => setSel(null)} onStart={(m) => { setSel(null); onStart(sel, m); }} />}
    </div>
  );
}

function ContractModal({ c, s, ct, onClose, onStart }: { c: Campaign; s: Settings; ct: Contract; onClose: () => void; onStart: (m: ModId[]) => void }) {
  const [mods, setMods] = useState<ModId[]>([]);
  const toggle = (m: ModId) => setMods((a) => (a.includes(m) ? a.filter((x) => x !== m) : [...a, m]));
  const cl = ct.client === "odd" || ct.client === "boss" ? null : CLIENTS[ct.client];
  const pay = contractPay(c, ct, mods, s);
  const rivalNote = cl ? `${CLIENTS[cl.rival].icon} ${CLIENTS[cl.rival].name} will think less of you.` : "";
  return (
    <Modal title={ct.title} onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-sm font-bold" style={{ color: cl?.color ?? "#b0a898" }}>{cl ? `${cl.icon} ${cl.name}` : ct.boss ? "🏛️ The Capstone" : "🗝️ Freelance"}</div>
          <p className="mb-3 text-xs text-[#bfb496]">{KINDS[ct.kind].icon} {KINDS[ct.kind].name}: {KINDS[ct.kind].blurb} {cl && <span className="text-[#9d9484]">{rivalNote}</span>}</p>
          <div className="mb-3 space-y-1.5">
            {ct.stages.map((st, i) => (
              <div key={i} className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm">
                <span>{MECH_INFO[st.type].icon}</span>
                <span className="flex-1">{i + 1}. {MECH_INFO[st.type].name}</span>
                <span className="text-[11px] text-[#9d9484]">lvl {st.level}</span>
                {st.affix && <span className="rounded bg-red-900/50 px-1.5 text-[10px] font-bold text-red-200">{st.affix === "trapped" ? "☠ TRAPPED" : st.affix === "rusted" ? "⛓ RUSTED" : "🚨 ALARMED"}</span>}
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-black/30 p-2 text-xs text-[#bfb496]">
            Your kit: <b className="text-[#f3d88d]">{Math.max(1, c.picks)} picks</b>{c.picks === 0 ? " (a free hairpin)" : ""} · stethoscope tier {hintLevel(c)} · {CONSUMABLE_IDS.map((id) => `${CONSUMABLES[id].icon}${c.items[id]}`).join("  ")}
          </div>
        </div>
        <div>
          <div className="mb-2 font-display text-sm font-bold text-[#d6a84c]">RISK MODIFIERS (optional)</div>
          <div className="mb-3 space-y-2">
            {(Object.keys(MODS) as ModId[]).map((m) => (
              <button key={m} onClick={() => { audio.ui(); toggle(m); }} className={`w-full rounded-lg border px-3 py-2 text-left transition ${mods.includes(m) ? "border-[#f3d88d] bg-[#d6a84c]/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                <div className="flex justify-between"><span className="font-semibold">{MODS[m].icon} {MODS[m].name}</span><span className="text-xs">{mods.includes(m) ? "✔ ON" : "off"}</span></div>
                <div className="text-[11px] text-[#bfb496]">{MODS[m].desc}</div>
              </button>
            ))}
          </div>
          <div className="mb-3 rounded-lg border border-[#d6a84c]/30 bg-black/30 p-3 text-sm">
            <div className="flex justify-between"><span className="text-[#9d9484]">Payout (before stars)</span><b className="text-[#ffd05a]">{fmtGold(pay)}g</b></div>
            <div className="flex justify-between"><span className="text-[#9d9484]">Pay multiplier</span><span>×{(modPayMul(mods) * DIFFS[s.difficulty].pay).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-[#9d9484]">Failure fine</span><span className="text-red-300">~{fmtGold(Math.round(pay * 0.12))}g on alarm</span></div>
          </div>
          <button className="btn btn-primary w-full py-3" onClick={() => { audio.init(); audio.ui(); onStart(mods); }}>🗝 Begin the Heist</button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- workshop */

function Workshop({ c, onCampaign, flash }: { c: Campaign; onCampaign: (c: Campaign) => void; flash: (m: string) => void }) {
  const tryBuy = (r: Campaign | null, msg: string) => {
    if (!r) {
      audio.fault();
      flash("Can't afford that — or already maxed.");
      return;
    }
    audio.buy();
    onCampaign(r);
    flash(msg);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section>
        <h2 className="font-display mb-2 text-xl font-black text-[#f3d88d]">Tools &amp; Upgrades <span className="text-xs font-normal text-[#9d9484]">(permanent)</span></h2>
        <div className="space-y-2">
          {UPGRADE_IDS.map((id) => {
            const u = UPGRADES[id];
            const lvl = c.upgrades[id];
            const maxed = lvl >= u.max;
            const cost = upgradeCost(c, id);
            return (
              <div key={id} className="panel flex items-center gap-3 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/40 text-2xl">{u.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-[#f3d88d]">{u.name}</div>
                  <div className="text-[11px] text-[#bfb496]">{u.desc} <span className="text-[#9d9484]">({u.per})</span></div>
                  <div className="mt-1 flex gap-1">{Array.from({ length: u.max }).map((_, i) => <span key={i} className="h-2 w-5 rounded-sm" style={{ background: i < lvl ? "#d6a84c" : "#2a2630" }} />)}</div>
                </div>
                <button className="btn btn-sm shrink-0" disabled={maxed || c.gold < cost} onClick={() => tryBuy(buyUpgrade(c, id), `${u.name} upgraded!`)}>
                  {maxed ? "MAX" : `${fmtGold(cost)}g`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="font-display mb-2 text-xl font-black text-[#f3d88d]">Supplies <span className="text-xs font-normal text-[#9d9484]">(used up in the field)</span></h2>
        <div className="space-y-2">
          <div className="panel flex items-center gap-3 p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/40 text-2xl">🪛</div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-bold text-[#f3d88d]">Lockpick</div>
              <div className="text-[11px] text-[#bfb496]">Each pick survives {4 + 2 * c.upgrades.steel} wear points. Snapped picks are gone for good. Owned: <b>{c.picks}</b>/{MAX_PICKS}</div>
            </div>
            <button className="btn btn-sm shrink-0" disabled={c.gold < pickCost(c) || c.picks >= MAX_PICKS} onClick={() => tryBuy(buyPick(c), "Bought a pick.")}>{pickCost(c)}g</button>
          </div>
          {CONSUMABLE_IDS.map((id) => (
            <div key={id} className="panel flex items-center gap-3 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/40 text-2xl">{CONSUMABLES[id].icon}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold text-[#f3d88d]">{CONSUMABLES[id].name} <span className="rounded bg-[#d6a84c] px-1 text-[10px] text-black">{CONSUMABLES[id].key}</span></div>
                <div className="text-[11px] text-[#bfb496]">{CONSUMABLES[id].desc} Owned: <b>{c.items[id]}</b>/{MAX_ITEMS}</div>
              </div>
              <button className="btn btn-sm shrink-0" disabled={c.gold < consumableCost(c, id) || c.items[id] >= MAX_ITEMS} onClick={() => tryBuy(buyConsumable(c, id), `Bought ${CONSUMABLES[id].name}.`)}>{consumableCost(c, id)}g</button>
            </div>
          ))}
        </div>
        {c.rep.merchants >= 50 && <p className="mt-2 text-xs text-emerald-300">🪙 Gilded Ledger discount applied (−20%).</p>}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ fence */

function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 90;
  const h = 26;
  const min = 0.4;
  const max = 2;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - ((v - min) / (max - min)) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line x1="0" x2={w} y1={h - ((1 - min) / (max - min)) * h} y2={h - ((1 - min) / (max - min)) * h} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 3" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Fence({ c, onCampaign, flash }: { c: Campaign; onCampaign: (c: Campaign) => void; flash: (m: string) => void }) {
  const mul = fenceMul(c);
  const sell = (ids: number[]) => {
    if (!ids.length) return;
    const r = sellLoot(c, ids);
    audio.coin();
    onCampaign(r.campaign);
    flash(`Sold for ${fmtGold(r.gained)}g.`);
  };
  const total = c.loot.reduce((s, l) => s + lootValue(c, l), 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section>
        <h2 className="font-display mb-1 text-xl font-black text-[#f3d88d]">The Fence's Market</h2>
        <p className="mb-2 text-xs text-[#9d9484]">Prices drift daily. Selling floods a category (−6% per item). Your take: ×{mul.toFixed(2)} (Heat {Math.round(c.heat)}{c.rep.underworld >= 50 ? ", Black Lantern +15%" : ""}).</p>
        <div className="space-y-2">
          {LOOT_KINDS.map((k) => {
            const m = c.market[k];
            const prev = m.hist[m.hist.length - 2] ?? m.price;
            const up = m.price >= prev;
            const have = c.loot.filter((l) => l.kind === k);
            return (
              <div key={k} className="panel flex items-center gap-3 p-2.5">
                <div className="text-2xl">{LOOT[k].icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#f3d88d]">{LOOT[k].label}</div>
                  <div className="text-[11px] text-[#9d9484]">Base {LOOT[k].base}g · you hold {have.length}</div>
                </div>
                <Spark data={m.hist} color={up ? "#7dffa8" : "#ff8a7a"} />
                <div className="w-16 text-right">
                  <div className={`font-display text-base font-black tabular-nums ${m.price > 1.2 ? "text-emerald-300" : m.price < 0.8 ? "text-red-300" : "text-[#f3d88d]"}`}>{up ? "▲" : "▼"} ×{m.price.toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-black text-[#f3d88d]">Your Loot</h2>
          <button className="btn btn-sm" disabled={!c.loot.length} onClick={() => sell(c.loot.map((l) => l.id))}>Sell all · {fmtGold(total)}g</button>
        </div>
        {c.loot.length === 0 ? (
          <div className="panel p-6 text-center text-sm text-[#9d9484]">Nothing to sell. Crack some vaults — loot drops on every success, with bonus pieces for flawless jobs.</div>
        ) : (
          <div className="space-y-2">
            {c.loot.map((l) => (
              <div key={l.id} className="panel flex items-center gap-3 p-2.5">
                <div className="text-2xl">{LOOT[l.kind].icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#f3d88d]">{l.name}</div>
                  <div className="text-[11px] text-[#9d9484]">Appraised base {l.base}g</div>
                </div>
                <button className="btn btn-sm shrink-0" onClick={() => sell([l.id])}>Sell {fmtGold(lootValue(c, l))}g</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- ledger */

function Ledger({ c, s, onCampaign, flash }: { c: Campaign; s: Settings; onCampaign: (c: Campaign) => void; flash: (m: string) => void }) {
  const bribe = bribeCost(c);
  const st = c.stats;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section>
        <h2 className="font-display mb-2 text-xl font-black text-[#f3d88d]">Client Reputation</h2>
        <div className="space-y-2">
          {CLIENT_IDS.map((id) => {
            const cl = CLIENTS[id];
            const rep = c.rep[id];
            const pct = Math.abs(rep) / 2;
            return (
              <div key={id} className="panel p-3" style={{ borderColor: cl.color + "55" }}>
                <div className="flex items-center justify-between">
                  <div className="font-display text-sm font-bold" style={{ color: cl.color }}>{cl.icon} {cl.name}</div>
                  <div className="text-xs tabular-nums text-[#d8d0bc]">{rep > 0 ? "+" : ""}{rep} {rep >= 50 ? "· TRUSTED" : rep <= -40 ? "· REFUSES YOU" : ""}</div>
                </div>
                <div className="text-[11px] text-[#9d9484]">{cl.blurb}</div>
                <div className="relative my-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                  <div className="absolute inset-y-0" style={{ background: rep >= 0 ? cl.color : "#ff5a4a", width: `${pct}%`, left: rep >= 0 ? "50%" : `${50 - pct}%` }} />
                </div>
                <div className={`text-[11px] ${rep >= 50 ? "text-emerald-300" : "text-[#7d7566]"}`}>{rep >= 50 ? "✔ " : "🔒 "}{cl.perk}</div>
                <div className="text-[11px] text-[#7d7566]">Tier cap {Math.min(5, 1 + Math.floor(Math.max(0, rep) / 22), rankIndex(c.renown) + 2)} · rival: {CLIENTS[cl.rival].icon} {CLIENTS[cl.rival].name}</div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-4">
        <div className="panel p-3">
          <h3 className="font-display mb-1 text-lg font-black text-[#f3d88d]">🔥 The Watch</h3>
          <p className="text-xs text-[#bfb496]">Heat {Math.round(c.heat)}/100 ({heatLabel(c.heat)}). Cools by {6 + (c.rep.underworld >= 50 ? 3 : 0)}/day naturally. Higher Heat → more frequent patrols, less time, slower noise decay, worse fence prices. At 100 you are arrested.</p>
          <button className="btn btn-sm mt-2" disabled={c.gold < bribe || c.heat <= 0} onClick={() => { const r = bribeWatch(c); if (r) { audio.coin(); onCampaign(r); flash("The captain looks the other way. Heat −22."); } }}>Bribe the captain · {bribe}g (Heat −22)</button>
        </div>
        <div className="panel p-3">
          <h3 className="font-display mb-1 text-lg font-black text-[#f3d88d]">⚜ Dynasty Standing</h3>
          <p className="text-xs text-[#bfb496]">Rank: <b className="text-[#f3d88d]">{rankName(c.renown)}</b> · Renown {c.renown}. Daily rent {rentFor(c, s)}g.</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-[#9d9484]">
            {RANKS.map((r, i) => <li key={r.name} className={c.renown >= r.at ? "text-emerald-300" : ""}>{c.renown >= r.at ? "✔" : "○"} {r.name} — {r.at} renown{i === 4 ? " · unlocks the Sovereign's Vault" : ""}</li>)}
          </ul>
        </div>
        <div className="panel p-3">
          <h3 className="font-display mb-1 text-lg font-black text-[#f3d88d]">📊 Career</h3>
          <div className="grid grid-cols-2 gap-x-4 text-xs text-[#d8d0bc]">
            <span>Jobs done: <b>{st.jobsDone}</b></span><span>Jobs failed: <b>{st.jobsFailed}</b></span>
            <span>Locks opened: <b>{st.stagesCracked}</b></span><span>Flawless (3★): <b>{st.perfect}</b></span>
            <span>Gold earned: <b>{fmtGold(st.goldEarned)}</b></span><span>Gold spent: <b>{fmtGold(st.goldSpent)}</b></span>
            <span>Picks broken: <b>{st.picksBroken}</b></span><span>Faults: <b>{st.faults}</b></span>
            <span>Alarms: <b>{st.alarms}</b></span><span>Guards dodged: <b>{st.patrolsDodged}</b></span>
            <span>Loot sold: <b>{st.lootSold}</b></span><span>Best payout: <b>{fmtGold(st.bestPay)}g</b></span>
          </div>
        </div>
        <div className="panel p-3">
          <h3 className="font-display mb-1 text-lg font-black text-[#f3d88d]">📰 Journal</h3>
          <ul className="space-y-0.5 text-xs text-[#bfb496]">{c.log.slice(0, 8).map((l, i) => <li key={i}>• {l}</li>)}</ul>
        </div>
      </section>
    </div>
  );
}

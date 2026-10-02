import { BOSSES, FACTION_ORDER, FACTIONS, ISSUES, ISSUE_META, RIDERS, TEMPLATES } from "../game/data";
import { ambition, billName, bribeCost, charterOk, commit, forecast, riderCostOf, riderSlots, riderTotal } from "../game/core";
import type { Game } from "../game/core";
import { adjourn, applyTemplate, callVote, doBlackmail, doBribe, doCover, doPledge, doScandalize, doSnoop, doSpeech, selectFaction, setStance, setWhip, toggleRider } from "../game/flow";
import { Btn, toneColor } from "./ui";

const fmt = (n: number) => (n > 0 ? "+" : "") + Math.round(n);
const trustFace = (t: number) => (t < -40 ? "😡" : t < -10 ? "😠" : t < 15 ? "😐" : t < 45 ? "🙂" : "😍");

export function BillPanel({ g }: { g: Game }) {
  const s = g.sitting; const fc = forecast(g); const ro = s.kind === "rival"; const conf = s.kind === "confidence";
  const passing = fc.yes >= fc.needed; const sitting = g.phase === "sitting";
  const blocking = ro && s.whip === "nay"; const winning = blocking ? !passing : passing;
  const boss = s.boss ? BOSSES[s.boss] : null;
  return (
    <div className="panel p-3 flex flex-col gap-2" id="bill-panel">
      <div>
        <div className="font-display text-[11px] text-slate-400 uppercase tracking-widest">{s.title}</div>
        <div className="font-display text-lg font-bold text-[color:var(--color-gold)] leading-tight">{conf ? boss?.title : s.kind === "boss" ? "The Great Charter" : billName(s.bill.stance)}</div>
      </div>
      {s.modifier && <div className="rounded-lg px-2 py-1 text-xs bg-amber-400/10 border border-amber-300/30 text-amber-200">{s.modifier.emoji} <b>{s.modifier.name}</b> — {s.modifier.desc}</div>}
      {s.crisis && <div className="rounded-lg px-2 py-1 text-xs bg-rose-500/10 border border-rose-400/40 text-rose-200">{s.crisis.emoji} <b>{s.crisis.name}</b> — {s.crisis.text} A bill with <b>{ISSUE_META[s.crisis.issue].name} ≥ +1</b> resolves it.</div>}
      {s.kind === "budget" && <div className="rounded-lg px-2 py-1 text-xs bg-rose-500/10 border border-rose-400/40 text-rose-200">🏛️ The Budget MUST pass — failure shuts down the government.</div>}
      {boss && <div className="rounded-lg px-2 py-2 text-xs bg-fuchsia-500/10 border border-fuchsia-400/40 text-fuchsia-100"><div className="font-display text-sm">{boss.emoji} {boss.name}</div><div className="italic">{boss.text}</div>
        {s.kind === "boss" && <div className="mt-1">Reading <b>{s.reading}/3</b> · Carried <b className="text-emerald-300">{s.won}</b> · Defeated <b className="text-rose-300">{s.lost}</b>{s.attack && <div className="text-fuchsia-300 mt-1">⚠ {s.attack.name}: {s.attack.text}</div>}
          <div className={charterOk(g) ? "text-emerald-300" : "text-amber-300"}>Charter rule: no negative stances, ambition ≥ 4 (now {ambition(s.bill.stance)}).</div></div>}</div>}
      {ro && s.sponsor && (
        <div className="rounded-lg p-2 bg-white/5 border border-white/10 text-sm">
          <div>{FACTIONS[s.sponsor].emoji} Tabled by the <b style={{ color: FACTIONS[s.sponsor].color }}>{FACTIONS[s.sponsor].name}</b>{g.factions[s.sponsor].pledges > 0 && <span className="text-amber-300"> — you promised to support them!</span>}</div>
          <div className="flex gap-2 mt-2">
            <Btn kind={s.whip === "aye" ? "green" : ""} className="flex-1" onClick={() => setWhip("aye")}>👍 Whip AYE</Btn>
            <Btn kind={s.whip === "nay" ? "red" : ""} className="flex-1" onClick={() => setWhip("nay")}>👎 Whip NAY</Btn>
          </div>
          {!s.whip && <div className="text-xs text-amber-300 mt-1 pulse-glow rounded px-1">Choose your caucus’s stance before lobbying.</div>}
        </div>
      )}
      {conf ? (
        <div className="text-sm text-slate-300 italic">There is no bill: members weigh the nation’s mood against their ideals, your Renown, Heat and their trust. Lobby hard — {s.thr > 0.5 ? "the Queen demands 52%." : "a simple majority saves you."}</div>
      ) : (
        <div className="flex flex-col gap-1">
          {ISSUES.map((k, i) => {
            const v = s.bill.stance[k]; const m = ISSUE_META[k]; const focus = g.focusIssue === i && !ro; const crisis = s.crisis?.issue === k;
            return (
              <div key={k} className={`rounded-lg px-2 py-1 ${focus ? "bg-white/10 ring-1 ring-amber-300/60" : "bg-black/15"} ${crisis ? "ring-1 ring-rose-400/60" : ""}`} onMouseDown={() => { g.focusIssue = i; commit(); }}>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-display">{m.emoji} {m.name}{crisis && <span className="text-rose-300 text-xs"> ⚠</span>}</span>
                  <span className="font-display font-bold" style={{ color: v === 0 ? "#94a3b8" : v > 0 ? "#86efac" : "#fca5a5" }}>{v === 0 ? "Neutral" : `${v > 0 ? m.pos : m.neg} ${fmt(Math.abs(v))}`} <span className="text-[10px] text-slate-400">({fmt(v * 3)} nation)</span></span>
                </div>
                <input aria-label={m.name} type="range" min={-2} max={2} step={1} value={v} disabled={ro || !sitting} onChange={e => setStance(k, parseInt(e.target.value))} className="w-full my-1" />
                <div className="flex justify-between text-[10px] text-slate-500 -mt-1"><span>{m.neg}</span><span>{m.pos}</span></div>
              </div>
            );
          })}
        </div>
      )}
      {!ro && !conf && (
        <>
          <div>
            <div className="font-display text-[11px] text-slate-400 uppercase tracking-widest mb-1">Quick drafts</div>
            <div className="flex flex-wrap gap-1">
              {TEMPLATES.map(t => <button key={t.id} disabled={!sitting} title={ISSUES.map(k => `${ISSUE_META[k].emoji}${fmt(t.stance[k])}`).join(" ")} onClick={() => applyTemplate(t.id)} className="btn !text-[11px] !px-2 !py-1">{t.emoji} {t.name.split(" ").slice(0, 2).join(" ")}</button>)}
            </div>
          </div>
          <div>
            <div className="font-display text-[11px] text-slate-400 uppercase tracking-widest mb-1">Riders ({s.bill.riders.length}/{riderSlots(g)}) · cost {riderTotal(g)} ✦</div>
            <div className="grid grid-cols-2 gap-1">
              {RIDERS.map(r => {
                const on = s.bill.riders.some(x => x.id === r.id); const tgt = s.bill.riders.find(x => x.id === r.id)?.target;
                return <button key={r.id} disabled={!sitting} title={r.desc} onClick={() => toggleRider(r.id)} className={`btn !text-[11px] !px-2 !py-1 text-left ${on ? "btn-gold" : ""}`}>{r.emoji} {r.name} <span className="opacity-70">{riderCostOf(g, r.id)}✦{on && tgt ? ` →${FACTIONS[tgt].name}` : ""}</span></button>;
              })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 min-h-[2.2em]">{RIDERS.map(r => s.bill.riders.some(x => x.id === r.id) ? `${r.emoji} ${r.desc}` : null).filter(Boolean).join("  ") || "Hover a rider for details. Pork Barrel targets the faction you have selected."}</div>
          </div>
        </>
      )}
      <div className="flex gap-2 mt-auto">
        <Btn id="call-vote" kind="gold" disabled={!sitting} className={`flex-1 !py-3 !text-base ${winning && sitting ? "pulse-glow" : ""}`} onClick={() => callVote()}>🔨 CALL THE VOTE <span className="text-xs opacity-80">(Enter)</span></Btn>
        {s.kind !== "boss" && !conf && <Btn disabled={!sitting} onClick={() => adjourn()} title="Skip the vote (penalties apply)">Adjourn</Btn>}
      </div>
      <div className={`text-center text-xs font-display ${winning ? "text-emerald-300" : "text-rose-300"}`}>Forecast: {fc.yes} Aye / {fc.no} Nay · need {fc.needed} {blocking ? (passing ? "✘ it would pass — block more!" : "✔ it will be blocked") : passing ? "✔ passing" : "✘ short by " + (fc.needed - fc.yes)}</div>
    </div>
  );
}

export function FactionPanel({ g }: { g: Game }) {
  const fc = forecast(g); const sitting = g.phase === "sitting"; const s = g.sitting;
  return (
    <div className="panel p-2 flex flex-col gap-1.5">
      <div className="font-display text-[11px] text-slate-400 uppercase tracking-widest px-1">The House — click to select, keys 1–6</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
        {FACTION_ORDER.map((f, i) => {
          const def = FACTIONS[f]; const F = g.factions[f]; const per = fc.per[f]; const tot = Math.max(1, F.seats); const sel = g.selected === f;
          return (
            <div key={f} id={`fac-${f}`} onClick={() => selectFaction(f)} className={`rounded-lg p-2 cursor-pointer border transition-all duration-150 ${sel ? "bg-white/10 border-amber-300 scale-[1.01]" : "bg-black/20 border-white/10 hover:bg-white/5"}`} style={{ borderLeft: `4px solid ${def.color}` }}>
              <div className="flex items-center justify-between">
                <div className="font-display text-sm flex items-center gap-1"><span className="text-base">{def.emoji}</span>{def.name}<span className="text-[10px] text-slate-500">[{i + 1}]</span></div>
                <div className="text-xs text-slate-300">{F.seats} seats</div>
              </div>
              <div className="flex gap-2 items-center mt-1">
                <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-white/10">
                  <div style={{ width: `${(per.yes / tot) * 100}%`, background: "#4ade80", transition: "width .4s" }} />
                  <div style={{ width: `${(per.no / tot) * 100}%`, background: "#fb7185", transition: "width .4s" }} />
                </div>
                <span className={`text-xs font-display w-12 text-right ${per.lean > 0 ? "text-emerald-300" : "text-rose-300"}`}>{fmt(per.lean)}{per.uncertain ? "?" : ""}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span title="Ideals (Wealth, Order, Commons, Wilds)">{ISSUES.map(k => <span key={k} className="mr-1" style={{ color: F.prefs[k] > 0 ? "#86efac" : F.prefs[k] < 0 ? "#fca5a5" : "#64748b" }}>{ISSUE_META[k].emoji}{F.prefs[k] > 0 ? "+" : ""}{F.prefs[k]}</span>)}</span>
                <span title={`Trust ${Math.round(F.trust)}`}>{trustFace(F.trust)} {Math.round(F.trust)}</span>
              </div>
              <div className="flex gap-2 text-[11px] mt-0.5 min-h-[16px]">
                {F.dirt > 0 && <span title="Dirt on them" className="text-slate-200">🗂️×{F.dirt}</span>}
                {F.pledges > 0 && <span title="Pledges you owe" className="text-amber-300">🤝×{F.pledges}</span>}
                {F.grudge >= 2 && <span title="Grudge" className="text-rose-300">💢</span>}
                {F.coalition >= 3 && <span title="Coalition partner" className="text-emerald-300">💚 ally</span>}
                {s.lobby[f].mod !== 0 && f !== "crows" && <span className={s.lobby[f].mod < 0 ? "text-rose-300" : "text-emerald-300"} title="Event modifier this sitting">⚡{fmt(s.lobby[f].mod)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <ActionBar g={g} sitting={sitting} />
    </div>
  );
}

function ActionBar({ g, sitting }: { g: Game; sitting: boolean }) {
  const f = g.selected; const def = FACTIONS[f]; const F = g.factions[f]; const own = f === "crows"; const cost = own ? 0 : bribeCost(g, f);
  const Btn2 = ({ k, label, sub, onClick, dim }: { k: string; label: string; sub: string; onClick: () => void; dim?: boolean }) => (
    <button disabled={!sitting} onClick={onClick} className={`btn !px-1.5 !py-1.5 text-left ${dim ? "opacity-50" : ""}`}><div className="text-[12px] leading-tight">{label} <span className="opacity-60 text-[10px]">[{k}]</span></div><div className="text-[10px] opacity-75 leading-tight">{sub}</div></button>
  );
  return (
    <div className="rounded-lg p-2 bg-black/30 border border-amber-300/20">
      <div className="font-display text-xs mb-1" style={{ color: def.color }}>{def.emoji} {def.name}: {def.title}</div>
      <div className="text-[11px] text-slate-400 italic leading-snug mb-1.5">{def.blurb} <span className="text-amber-200/80 not-italic">{def.quirk}</span></div>
      <div className="grid grid-cols-2 gap-1">
        <Btn2 k="S" label="🗣️ Speech" sub="Free · 1 AP · builds trust" onClick={() => doSpeech(f)} />
        <Btn2 k="B" label="💰 Bribe" sub={own ? "n/a" : `${cost} ✦ · 1 AP · +Heat`} onClick={() => doBribe(f)} dim={own || g.shinies < cost} />
        <Btn2 k="P" label="🤝 Pledge" sub={own ? "n/a" : `1 AP · owe a vote (${F.pledges}/2)`} onClick={() => doPledge(f)} dim={own || F.pledges >= 2} />
        <Btn2 k="N" label="🔍 Snoop" sub={`1 AP · +Dirt (${F.dirt}/3)`} onClick={() => doSnoop(f)} dim={own || F.dirt >= 3} />
        <Btn2 k="K" label="🗡️ Blackmail" sub="1 AP · −1 Dirt · huge lean" onClick={() => doBlackmail(f)} dim={own || F.dirt < 1} />
        <Btn2 k="X" label="📣 Scandalize" sub="1 AP · −1 Dirt · 2 seats defect" onClick={() => doScandalize(f)} dim={own || F.dirt < 1} />
      </div>
      <button disabled={!sitting} onClick={() => doCover()} className={`btn w-full mt-1 !py-1.5 ${g.shinies < 12 ? "opacity-50" : ""}`}>🧹 Cover-up <span className="opacity-60 text-[10px]">[C]</span> <span className="text-[10px] opacity-75">12 ✦ · 1 AP · −18 Heat</span></button>
    </div>
  );
}

export function NewsLog({ g }: { g: Game }) {
  const lines = g.log.slice(-6).reverse();
  return (
    <div className="panel px-3 py-2 text-[13px] leading-snug overflow-hidden">
      <div className="font-display text-[11px] text-slate-400 uppercase tracking-widest mb-1">📰 The Daily Caw</div>
      {lines.map((l, i) => <div key={l.id} className={`${toneColor(l.tone)} fade-in truncate sm:whitespace-normal`} style={{ opacity: 1 - i * 0.14 }}>{l.text}</div>)}
    </div>
  );
}

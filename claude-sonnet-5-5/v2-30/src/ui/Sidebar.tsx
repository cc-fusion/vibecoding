import type { ReactNode } from "react";
import { ROLES, ROOM_MAP, SECRETS, TRAITS, ROLE_ORDER, type RoomId } from "../game/data";
import { describeLoyalty, type ActionId, type Game, type Npc } from "../game/engine";
import { Bar, Btn, Chip } from "./common";

const stColor = (n: Npc) => (n.status === "conspirator" ? "#e3b95a" : n.status === "arrested" ? "#888" : n.status === "dead" ? "#555" : "#9fb3d8");

function Stat({ label, value, v, color, hint }: { label: string; value: string; v: number; color: string; hint?: string }) {
  return (
    <div title={hint}>
      <div className="flex justify-between text-[13px] leading-tight"><span className="text-[#a89a80]">{label}</span><span style={{ color }}>{value}</span></div>
      <Bar value={v} color={color} h={5} />
    </div>
  );
}

function ActionBtn({ g, n, id }: { g: Game; n: Npc; id: ActionId }) {
  const info = g.actionInfo(n.id, id);
  const spreader = id === "scandal" || id === "frame";
  return (
    <button
      disabled={!info.ok}
      title={info.desc}
      onClick={() => g.perform(n.id, id)}
      className={`btn w-full text-left rounded-md border px-2 py-1.5 cursor-pointer ${info.ok ? "border-[#6a5538] bg-[#2a2034] hover:border-[#e3b95a]" : "border-[#2c2436] bg-[#17121c]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[13px] font-bold">{info.icon} {info.label}{spreader ? "…" : ""}</span>
        <span className="flex gap-1 flex-wrap justify-end">
          {info.gold > 0 && <Chip color="#e3b95a">💰{info.gold}</Chip>}
          {info.infl > 0 && <Chip color="#9fd8ff">⚡{info.infl}</Chip>}
          {info.forge > 0 && <Chip color="#e9dcc0">📝{info.forge}</Chip>}
          {info.chance !== null && <Chip color={info.chance > 0.6 ? "#7cff9f" : info.chance > 0.35 ? "#ffd27a" : "#ff7a7a"}>{Math.round(info.chance * 100)}%</Chip>}
        </span>
      </div>
      <div className={`text-[11px] leading-tight ${info.ok ? "text-[#9a8d74]" : "text-[#ff8a8a]"}`}>{info.ok ? info.desc : info.reason}</div>
    </button>
  );
}

function NpcCard({ g, n }: { g: Game; n: Npc }) {
  const def = ROLES[n.role];
  const loy = describeLoyalty(n, n.known);
  const isMon = n.role === "monarch";
  const list: ActionId[] =
    n.status === "arrested" ? ["free"]
    : n.status === "conspirator" ? ["reward", "doubt", "scandal", "frame"]
    : isMon ? ["doubt", "scandal", "frame"]
    : ["investigate", "recruit", "bribe", "blackmail", "doubt", "scandal", "frame", "assassinate"];
  const ab = def.ability;
  const abInfo = n.status === "conspirator" ? g.abilityInfo(n) : null;
  const agent = g.agentFor(n);
  const rumors = g.rumors.filter((r) => r.known.includes(n.id));
  return (
    <div className="space-y-2 anim-fadeup">
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 bg-black/40" style={{ borderColor: stColor(n) }}>{def.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold leading-tight truncate">{n.name}</div>
          <div className="text-sm" style={{ color: def.color }}>{def.title}</div>
        </div>
        <Chip color={stColor(n)}>{n.status === "conspirator" ? (n.coerced ? "COERCED" : "AGENT") : n.status.toUpperCase()}</Chip>
      </div>
      <p className="text-[13px] text-[#9a8d74] italic leading-tight">{def.blurb}</p>
      {!isMon && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Stat label={n.known ? "Crown loyalty" : "Crown loyalty ~"} value={n.known ? `${Math.round(n.crown)}` : `${loy.label}?`} v={loy.v} color={loy.v > 70 ? "#5aa0e8" : loy.v > 45 ? "#c9c36a" : loy.v > 25 ? "#e08a3c" : "#e04a4a"} hint="Loyalty to the Crown. Low = easier to turn." />
          <Stat label="Devotion to you" value={n.known || n.status === "conspirator" ? `${Math.round(n.affinity)}` : "?"} v={n.known || n.status === "conspirator" ? n.affinity : 0} color="#e3b95a" hint="Below 15, agents betray you." />
          <Stat label="Ambition" value={n.known ? `${Math.round(n.ambition)}` : "?"} v={n.known ? n.ambition : 0} color="#ff9a4d" />
          <Stat label="Wariness" value={n.known ? `${Math.round(n.suspicion)}` : "?"} v={n.known ? n.suspicion : 0} color="#e04a4a" hint="At 60 they report you." />
          {n.status === "conspirator" && <Stat label="Exposure" value={`${Math.round(n.exposure)}`} v={n.exposure} color="#ff5a5a" hint="Spymaster's case against this agent. 100 = arrested." />}
          {(n.heat > 1 || n.disgrace > 1) && <Stat label={n.heat > n.disgrace ? "Framed heat" : "Disgrace"} value={`${Math.round(Math.max(n.heat, n.disgrace))}`} v={Math.max(n.heat, n.disgrace)} color="#c9a6ff" hint="At 100 they're thrown in the dungeon." />}
        </div>
      )}
      {isMon && <div className="text-sm text-[#e3b95a]">Paranoia {Math.round(g.paranoia)} · Vigor {Math.round(g.vigor)}. Use a conspirator in the same room to whisper rumors into the Monarch's ear.</div>}
      <div className="flex flex-wrap gap-1.5 text-sm">
        {n.known ? <Chip color="#9fd8ff" title={TRAITS[n.trait].desc}>{TRAITS[n.trait].icon} {TRAITS[n.trait].name}</Chip> : <Chip color="#777">Trait: ?</Chip>}
        {n.secretKnown ? <Chip color="#c9a6ff">🤫 {SECRETS[n.secret].name}</Chip> : <Chip color="#777">Secret: ?</Chip>}
        <Chip color="#8a8a9a">📍 {n.moving ? "Walking…" : ROOM_MAP[n.room].name}</Chip>
      </div>
      {n.known && <div className="text-[12px] text-[#9a8d74]">{TRAITS[n.trait].desc}</div>}
      {n.relations.length > 0 && (
        <div className="text-[12px] flex flex-wrap gap-1 items-center"><span className="text-[#8a7d66]">Ties:</span>
          {n.relations.map((r) => {
            const o = g.npc(r.id);
            if (!o) return null;
            return (
              <button key={r.id} onClick={() => g.select(o.id)} className="btn cursor-pointer rounded px-1.5 py-0.5 border border-white/10 bg-black/30" style={{ color: r.kind === "ally" ? "#7fe0a0" : r.kind === "rival" ? "#ff8a8a" : "#f59ad0" }}>
                {r.kind === "ally" ? "🤝" : r.kind === "rival" ? "⚔" : "💞"} {o.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}
      {rumors.length > 0 && <div className="text-[12px] text-[#c9a6ff]">💬 Has heard {rumors.length} rumor{rumors.length > 1 ? "s" : ""}.</div>}

      {n.status === "conspirator" && (
        <div className="rounded-lg border border-[#6a5538] bg-[#241b2d] p-2 space-y-1.5">
          <div className="text-[13px] text-[#cdbd9a]">{n.post ? `📍 Posted in ${ROOM_MAP[n.post].name}` : "Following court schedule — click a room on the map to station this agent."}</div>
          <div className="flex gap-2">
            {n.post && <Btn variant="dark" className="!py-1 !text-xs" onClick={() => g.recall(n.id)}>Recall to schedule</Btn>}
          </div>
          {ab && (
            <button disabled={!abInfo?.ok} onClick={() => g.useAbility(n.id)}
              className={`btn w-full text-left rounded-md border px-2 py-1.5 cursor-pointer ${abInfo?.ok ? "border-[#e3b95a] bg-[#3a2c14]" : "border-[#3c3046] bg-[#17121c]"}`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-[13px] font-bold">✦ {ab.name}</span>
                <span className="flex gap-1">{ab.gold > 0 && <Chip color="#e3b95a">💰{ab.gold}</Chip>}{ab.infl > 0 && <Chip color="#9fd8ff">⚡{ab.infl}</Chip>}</span>
              </div>
              <div className="text-[11px] text-[#b9ab8c] leading-tight">{ab.desc}</div>
              <div className={`text-[11px] ${abInfo?.ok ? "text-[#7cff9f]" : "text-[#ff8a8a]"}`}>{abInfo?.ok ? "Ready!" : abInfo?.reason}</div>
            </button>
          )}
          {n.role === "assassin" && <div className="text-[12px] text-[#b9ab8c]">🗡️ While in the same room as a target, use <b>Silence</b> from the target's card.</div>}
        </div>
      )}

      {n.status !== "conspirator" && n.status !== "dead" && !isMon && n.status !== "arrested" && (
        <div className={`text-[12px] ${agent ? "text-[#7cff9f]" : "text-[#ffb07a]"}`}>
          {agent ? `🤝 ${agent.name.split(" ")[0]} is in the room — in-person actions, no courier.` : "No agent in the room: courier actions cost ×2 and may be intercepted."}
        </div>
      )}
      <div className="grid gap-1.5">
        {list.map((id) => <ActionBtn key={id} g={g} n={n} id={id} />)}
      </div>
    </div>
  );
}

export function IntelTab({ g }: { g: Game }) {
  const n = g.npc(g.selected);
  const roster = g.npcs.slice().sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.id - b.id);
  return (
    <div className="space-y-3">
      {g.targeting && (
        <div className="rounded-md border border-[#b99aff] bg-[#2a1d45] p-2 text-sm anim-pop">
          🎯 Choose a <b>{g.targeting.kind === "scandal" ? "scandal" : "frame"}</b> target on the map (or from the roster below).
          <div className="mt-1"><Btn variant="dark" className="!py-0.5 !text-xs" onClick={() => g.cancelTargeting()}>Cancel</Btn></div>
        </div>
      )}
      {n ? <NpcCard g={g} n={n} /> : (
        <div className="text-[#a89a80] text-base leading-snug">
          <p><b className="text-[#e3b95a] font-display">Select someone.</b> Click a token on the palace map, or pick from the roster below. <span className="text-[#c9a6ff]">Hover</span> for a quick look.</p>
          <p className="mt-1 text-sm">Gold rings mark your agents. Colored bars under tokens show Crown loyalty once you've investigated.</p>
        </div>
      )}
      <div>
        <div className="font-display text-xs text-[#e3b95a] mb-1">COURT ROSTER</div>
        <div className="grid grid-cols-2 gap-1">
          {roster.map((r) => {
            const clickable = r.status !== "dead";
            return (
              <button key={r.id} disabled={!clickable}
                onClick={() => { if (g.targeting) g.finishTargeting(r.id); else g.select(r.id); }}
                className={`btn text-left text-[12px] rounded border px-1.5 py-1 flex items-center gap-1 cursor-pointer ${g.selected === r.id ? "border-white bg-[#2f2638]" : "border-[#2e2438] bg-[#17121c]"} ${r.status === "dead" ? "opacity-40 line-through" : ""}`}>
                <span>{ROLES[r.role].icon}</span>
                <span className="truncate flex-1" style={{ color: stColor(r) }}>{r.name.split(" ")[0]}</span>
                <span className="text-[10px] text-[#7a6d58]">{r.status === "conspirator" ? "★" : r.status === "arrested" ? "⛓" : r.status === "dead" ? "☠" : r.known ? "◉" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AgentsTab({ g }: { g: Game }) {
  const agents = g.npcs.filter((n) => n.status === "conspirator");
  const jailed = g.npcs.filter((n) => n.status === "arrested");
  return (
    <div className="space-y-3">
      <div className="text-sm text-[#a89a80]">Stipends: <span className="text-[#e3b95a]">{agents.length * 4} gold/day</span> · Agents: {agents.length}</div>
      {agents.length === 0 && <div className="text-[#ff8a8a]">You have no agents. Recruit someone — you may still use couriers (×2 cost).</div>}
      {agents.map((n) => {
        const ab = ROLES[n.role].ability;
        const info = g.abilityInfo(n);
        return (
          <div key={n.id} className="rounded-lg border border-[#4a3a5a] bg-[#1a1422] p-2 space-y-1.5">
            <button onClick={() => g.select(n.id)} className="btn cursor-pointer flex items-center gap-2 w-full text-left">
              <span className="text-xl">{ROLES[n.role].icon}</span>
              <span className="flex-1 min-w-0"><span className="block font-display text-[13px] font-bold truncate">{n.name}</span><span className="block text-[12px] text-[#a89a80]">{ROLES[n.role].title} · {n.moving ? "walking…" : ROOM_MAP[n.room].name}{n.post ? ` 📍${ROOM_MAP[n.post].name}` : ""}</span></span>
              {n.coerced && <Chip color="#ff9fd0">🩸</Chip>}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Devotion" value={`${Math.round(n.affinity)}`} v={n.affinity} color={n.affinity < 30 ? "#ff5a5a" : "#e3b95a"} />
              <Stat label="Exposure" value={`${Math.round(n.exposure)}`} v={n.exposure} color="#ff5a5a" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {ab && (
                <button disabled={!info.ok} onClick={() => g.useAbility(n.id)} title={ab.desc}
                  className={`btn flex-1 min-w-[140px] rounded-md border px-2 py-1 text-left cursor-pointer ${info.ok ? "border-[#e3b95a] bg-[#3a2c14]" : "border-[#3c3046] bg-[#17121c]"}`}>
                  <div className="font-display text-[12px] font-bold">✦ {ab.name}</div>
                  <div className={`text-[10px] ${info.ok ? "text-[#7cff9f]" : "text-[#ff8a8a]"}`}>{info.ok ? "Ready" : info.reason}</div>
                </button>
              )}
              <Btn variant="dark" className="!py-1 !px-2 !text-[11px]" disabled={!g.actionInfo(n.id, "reward").ok} onClick={() => g.perform(n.id, "reward")}>🎁 25g</Btn>
              {n.post && <Btn variant="dark" className="!py-1 !px-2 !text-[11px]" onClick={() => g.recall(n.id)}>Recall</Btn>}
            </div>
          </div>
        );
      })}
      {jailed.length > 0 && (
        <div>
          <div className="font-display text-xs text-[#ff7a8c] mb-1">IN THE DUNGEON</div>
          {jailed.map((n) => {
            const info = g.actionInfo(n.id, "free");
            return (
              <div key={n.id} className="flex items-center gap-2 rounded border border-[#3a2a30] bg-[#1a1216] p-1.5 mb-1">
                <span>{ROLES[n.role].icon}</span><span className="flex-1 text-[13px] truncate">{n.name}{n.wasConspirator ? " ★" : ""}</span>
                <Btn variant="dark" className="!py-0.5 !px-2 !text-[11px]" disabled={!info.ok} title={info.reason ?? info.desc} onClick={() => g.perform(n.id, "free")}>🔓 70g</Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <div className={`text-[13px] flex gap-1.5 ${ok ? "text-[#7cff9f]" : "text-[#a89a80]"}`}><span>{ok ? "✔" : "○"}</span><span>{children}</span></div>;
}

export function CoupTab({ g, onLaunch }: { g: Game; onLaunch: () => void }) {
  const c = g.coup;
  if (c) {
    const reb = c.squads.filter((s) => s.side === "rebel");
    const left = Math.max(0, c.limit - c.t);
    const rooms = (Object.keys(c.owner) as RoomId[]).filter((r) => c.owner[r] === "rebel");
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-[#6a5538] bg-[#241b2d] p-2">
          <div className="flex justify-between text-sm"><span className="font-display text-[#e3b95a]">RELIEF ARMY ARRIVES IN</span><span className={left < 30 ? "text-[#ff5a5a] font-bold" : ""}>{left.toFixed(0)}s</span></div>
          <Bar value={left} max={c.limit} color={left < 30 ? "#ff3b3b" : "#e3b95a"} h={8} />
          <div className="flex justify-between text-sm mt-2"><span>Monarch in <b>{ROOM_MAP[c.monarchRoom].name}</b>{c.monarchPath.length ? " (fleeing)" : ""}</span><span>{c.capture > 0 ? `Seizing ${(c.capture / 4 * 100).toFixed(0)}%` : ""}</span></div>
          {c.champMax > 0 && <div className="mt-1"><div className="flex justify-between text-[12px]"><span>{g.scn.boss ? "☠ The Hollow Knight" : "🛡️ Royal Champion"}{c.fury ? " — FURY" : ""}</span><span>{Math.ceil(c.champHp)}/{Math.ceil(c.champMax)}</span></div><Bar value={c.champHp} max={c.champMax} color={c.fury ? "#ff3b3b" : "#d05a6a"} h={7} /></div>}
          <div className="text-[12px] text-[#a89a80] mt-1">Loyalist reserve: {Math.ceil(c.reserve)} · Rooms seized: {rooms.length}</div>
        </div>
        <div className="flex gap-2 items-center justify-between">
          <div className="font-display text-xs text-[#e3b95a]">YOUR SQUADS ({reb.length})</div>
          <Btn variant="dark" className="!py-0.5 !text-xs" onClick={() => { c.sel = reb.map((s) => s.id); }}>Select all (A)</Btn>
        </div>
        {reb.length === 0 && <div className="text-[#ff8a8a]">No squads remain!</div>}
        {reb.map((s) => {
          const sel = c.sel.includes(s.id);
          return (
            <button key={s.id} onClick={(e) => { c.sel = e.shiftKey ? (sel ? c.sel.filter((x) => x !== s.id) : [...c.sel, s.id]) : [s.id]; }}
              className={`btn w-full text-left rounded-lg border p-2 cursor-pointer ${sel ? "border-white bg-[#33281a]" : "border-[#4a3a2a] bg-[#1a1422]"}`}>
              <div className="flex justify-between"><span className="font-display text-[13px] font-bold truncate">⚑ {s.name}</span><span className="text-[#ffe08a] font-bold">×{Math.ceil(s.count)}</span></div>
              <div className="text-[12px] text-[#a89a80]">{s.path.length ? `Marching → ${ROOM_MAP[s.goal ?? s.path[s.path.length - 1]].name}` : `Holding ${ROOM_MAP[s.room].name}`}</div>
            </button>
          );
        })}
        <div className="text-[12px] text-[#a89a80] leading-snug">Select squads, then click a room on the map. Squads halt at defended rooms; re-issue orders to press on. Concentrate your force — combat follows a square law.</div>
      </div>
    );
  }
  const f = g.forecast();
  const ag = g.agents();
  const has = (r: string) => ag.some((a) => a.role === r);
  const neutral = (r: "spymaster" | "champion") => { const x = g.byRole(r); return !x || x.status !== "free"; };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#6a5538] bg-[#241b2d] p-3">
        <div className="flex justify-between items-baseline"><span className="font-display text-xs text-[#e3b95a]">COUP FORECAST</span><span className="font-display font-bold" style={{ color: f.odds > 55 ? "#7cff9f" : f.odds > 30 ? "#ffd27a" : "#ff7a7a" }}>{f.label} · {f.odds}%</span></div>
        <Bar value={f.odds} color={f.odds > 55 ? "#5fd486" : f.odds > 30 ? "#e3b95a" : "#e04a4a"} h={10} className="mt-1" />
        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <div className="rounded bg-black/30 p-1.5"><div className="text-[#8a7d66] text-[11px]">YOUR FORCES</div><div className="text-[#ffe08a] font-bold text-lg">⚑ {f.rebels}</div><div className="text-[11px] text-[#a89a80]">damage ×{f.mult.toFixed(2)}</div></div>
          <div className="rounded bg-black/30 p-1.5"><div className="text-[#8a7d66] text-[11px]">LOYALISTS ON ROUTE</div><div className="text-[#ff9aa8] font-bold text-lg">🛡 {f.loyal}</div><div className="text-[11px] text-[#a89a80]">reserve {f.reserve} · champ {f.champ.hp > 0 ? Math.round(f.champ.hp) : "—"}</div></div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="font-display text-xs text-[#e3b95a]">READINESS</div>
        <Check ok={ag.length >= 4}>Conspirators: {ag.length} (aim for 4+)</Check>
        <Check ok={has("general")}>Marshal sworn — your largest army</Check>
        <Check ok={has("captain")}>Captain of the Guard sworn</Check>
        <Check ok={neutral("spymaster")}>Spymaster turned, jailed or silenced</Check>
        <Check ok={neutral("champion")}>Champion turned, jailed or silenced</Check>
        <Check ok={g.garrisonCut > 0}>Watch thinned ({g.garrisonCut}/3) · Muster +{g.muster}</Check>
        <Check ok={g.legit >= 30}>Legitimacy {Math.round(g.legit)} · Unrest {Math.round(g.unrest)}</Check>
        <Check ok={g.vigor < 85}>Monarch weakened (vigor {Math.round(g.vigor)})</Check>
        <Check ok={ag.some((a) => ["tower", "ballroom", "chamber", "throne"].includes(a.room) && !a.moving)}>An agent is near the Royal Chamber</Check>
      </div>
      <div className="text-[12px] text-[#a89a80] leading-snug">Squads form where your agents <b>stand</b> at launch. Rooms seized in battle grant bonuses (see Help). The relief army arrives {150 + 20 * g.perk("night")}s after launch.</div>
      <Btn variant="red" className="w-full text-lg py-3" disabled={!g.canLaunch()} onClick={onLaunch}>⚔ LAUNCH THE COUP</Btn>
    </div>
  );
}

function fmt(g: Game, t: number) {
  const d = Math.floor(t / g.dayLen) + 1;
  const h = (6 + ((t % g.dayLen) / g.dayLen) * 24) % 24;
  return `D${d} ${String(Math.floor(h)).padStart(2, "0")}h`;
}

export function LogTab({ g }: { g: Game }) {
  const col = { info: "#cdbd9a", good: "#7cff9f", bad: "#ff8a8a", event: "#ffd27a", rumor: "#c9a6ff", coup: "#ffe08a" } as const;
  return (
    <div className="space-y-3">
      {g.rumors.length > 0 && (
        <div>
          <div className="font-display text-xs text-[#c9a6ff] mb-1">ACTIVE RUMORS</div>
          {g.rumors.map((r) => {
            const t = g.npc(r.target);
            return (
              <div key={r.id} className="text-[13px] rounded border border-[#3a2a55] bg-[#1c1530] p-1.5 mb-1">
                <div className="flex justify-between"><span>{r.kind === "doubt" ? "🌫️ Doubt in the Crown" : r.kind === "scandal" ? `📰 Scandal: ${t?.name ?? "?"}` : `📝 Frame: ${t?.name ?? "?"}`}</span><span className="text-[#8a7d66]">{r.known.length} know</span></div>
                <Bar value={r.strength} max={1} color="#c9a6ff" h={4} />
              </div>
            );
          })}
        </div>
      )}
      <div className="font-display text-xs text-[#e3b95a]">COURT CHRONICLE</div>
      <div className="space-y-1">
        {g.log.map((l) => (
          <div key={l.id} className="text-[13px] leading-tight" style={{ color: col[l.kind] }}><span className="text-[#6a5d48] mr-1">{fmt(g, l.t)}</span>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { CHARTS, CRATE_INFO, FISH, MONSTERS, relicById } from "../game/data";
import {
  currentLevy,
  harpoonTargets,
  holdUsed,
  holdValue,
  isVisible,
  monsterAt,
  netPreview,
  netTargetOk,
  shoalAt,
  stormTurnsLeft,
  tileAt,
} from "../game/engine";
import { dist, type Hex } from "../game/hex";
import type { Game, Mode } from "../game/types";

function Stat({
  icon,
  label,
  value,
  max,
  color,
  danger,
  title,
}: {
  icon: string;
  label: string;
  value: number | string;
  max?: number;
  color: string;
  danger?: boolean;
  title?: string;
}) {
  const pct = max && typeof value === "number" ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      title={title}
      className={`min-w-[84px] flex-1 rounded-lg border px-2.5 py-1.5 bg-[#0a1c2e]/90 ${
        danger ? "border-red-400/70 animate-pulse" : "border-sky-300/15"
      }`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-sky-200/60">
        <span>
          {icon} {label}
        </span>
      </div>
      <div className="text-lg font-bold leading-tight text-white">
        {value}
        {max !== undefined && <span className="text-xs text-sky-200/50 font-medium"> / {max}</span>}
      </div>
      {max !== undefined && (
        <div className="h-1.5 rounded bg-black/40 overflow-hidden mt-0.5">
          <div className="h-full rounded transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

export function Hud({
  g,
  muted,
  onMute,
  onHelp,
  onAbandon,
  confirmAbandon,
}: {
  g: Game;
  muted: boolean;
  onMute: () => void;
  onHelp: () => void;
  onAbandon: () => void;
  confirmAbandon: boolean;
}) {
  const p = g.p;
  const left = stormTurnsLeft(g);
  const levy = currentLevy(g);
  const wealth = p.gold + holdValue(g);
  const final = g.chart === 5;
  const boss = g.monsters.find((m) => m.kind === "kraken");
  return (
    <div className="px-3 pt-2 pb-2 bg-gradient-to-b from-[#0a1c2e] to-[#07131f] border-b border-sky-300/10">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div>
          <div className="font-display text-brass-light text-lg leading-none tracking-wide">
            Chart {g.chart}/5 · {CHARTS[g.chart - 1].name}
          </div>
          <div className="text-[11px] text-sky-200/60 mt-0.5">{CHARTS[g.chart - 1].sub}</div>
        </div>
        <div className="flex-1" />
        <div
          className={`text-xs px-2.5 py-1 rounded-full border ${
            left === null
              ? "border-purple-400/60 text-purple-200 bg-purple-900/40"
              : left <= 2
              ? "border-purple-300/70 text-purple-100 bg-purple-900/40 animate-pulse"
              : "border-sky-300/20 text-sky-100/80 bg-black/20"
          }`}
          title="A squall sweeps west to east. Hexes it covers damage your hull each turn."
        >
          ⛈️ {left === null ? (final ? "Squall has swallowed the Maw" : "Squall at full reach") : g.stormQ <= -6 ? `Squall gathers · ${left} turns` : `Squall advances in ${left}`}
        </div>
        <div className="text-xs text-sky-200/70">Turn {g.turn}</div>
        <button onClick={onHelp} className="px-2.5 py-1 rounded bg-sky-900/50 hover:bg-sky-800/60 border border-sky-300/20 text-xs" title="How to play (H)">
          ❓ Help
        </button>
        <button onClick={onMute} className="px-2.5 py-1 rounded bg-sky-900/50 hover:bg-sky-800/60 border border-sky-300/20 text-xs" title="Toggle sound (M)">
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          onClick={onAbandon}
          className={`px-2.5 py-1 rounded border text-xs ${confirmAbandon ? "bg-red-700 border-red-300 text-white" : "bg-sky-900/50 hover:bg-sky-800/60 border-sky-300/20"}`}
        >
          {confirmAbandon ? "Really abandon?" : "🏳️ Abandon"}
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Stat icon="❤️" label="Hull" value={p.hull} max={p.maxHull} color="#ff6b6b" danger={p.hull <= 3} />
        <Stat icon="⛽" label="Fuel" value={p.fuel} max={p.maxFuel} color="#ffb347" danger={p.fuel <= 3} title="Each move costs 1 fuel (kelp 2)." />
        <Stat icon="🕸️" label="Net" value={p.nets} max={p.maxNets} color="#7fe7ff" title="Net durability. Each cast wears it." />
        <Stat icon="🔱" label="Harpoons" value={p.harpoons} max={p.maxHarpoons} color="#d6d6e8" />
        <Stat icon="🐟" label="Hold" value={holdUsed(p)} max={p.holdMax} color="#8fd0ff" danger={holdUsed(p) >= p.holdMax} />
        <Stat icon="🪙" label="Gold" value={p.gold} color="#ffd45c" />
        {!final ? (
          <div
            className={`min-w-[120px] flex-1 rounded-lg border px-2.5 py-1.5 ${
              wealth >= levy ? "border-emerald-400/50 bg-emerald-900/20" : "border-amber-400/40 bg-amber-900/10"
            }`}
            title="Gold plus the market value of your hold must cover the Harbor Levy."
          >
            <div className="text-[10px] uppercase tracking-wider text-sky-200/60">🏛️ Harbor levy</div>
            <div className="text-lg font-bold leading-tight text-white">
              {levy}g <span className="text-xs font-medium text-sky-200/60">· wealth {wealth}g {wealth >= levy ? "✓" : ""}</span>
            </div>
          </div>
        ) : (
          <div className="min-w-[160px] flex-1 rounded-lg border border-purple-400/50 bg-purple-900/20 px-2.5 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-purple-200/70">☠ Leviathan</div>
            <div className="text-lg font-bold leading-tight text-white">
              {boss ? `${boss.hp} / ${boss.maxHp} HP` : "—"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function describe(g: Game, h: Hex | null, mode: Mode): { title: string; lines: string[] } | null {
  if (!h) return null;
  const t = tileAt(g, h.q, h.r);
  if (!t) return null;
  const vis = isVisible(g, h.q, h.r);
  const lines: string[] = [];
  let title = "Unexplored water";
  if (t.seen) {
    title = { deep: "Deep water", shallow: "Shallows", kelp: "Kelp forest", rock: "Jagged reef", current: "Ocean current" }[t.type];
    if (t.type === "kelp") lines.push("Costs 2 fuel to enter. Shoals love it here.");
    if (t.type === "rock") lines.push("Impassable. Blocks harpoons. Frays nets.");
    if (t.type === "current") lines.push("Ships ending their turn here are carried one hex along the arrow.");
    if (t.type === "shallow") lines.push("Shoals gather in the shallows.");
    if (t.relic) lines.push("🏺 Wreck site — Dredge it (1 fuel) from here or an adjacent hex.");
    if (t.crate) lines.push(`${CRATE_INFO[t.crate].icon} ${CRATE_INFO[t.crate].label} — sail over to salvage.`);
  }
  if (t.special === "gate") {
    title = "Harbor 🗼";
    lines.push("Sail here to dock, sell fish and pay the levy.");
  }
  if (t.special === "start") title = "Your starting dock";
  if (vis) {
    const s = shoalAt(g, h.q, h.r);
    if (s) lines.push(`${FISH[s.kind].icon} ${FISH[s.kind].name} shoal ×${s.count} (${FISH[s.kind].value}g base each)`);
    const m = monsterAt(g, h.q, h.r);
    if (m) {
      const d = MONSTERS[m.kind];
      lines.unshift(`${d.name} — HP ${m.hp}/${m.maxHp}${m.stun > 0 ? " (tangled)" : ""}`);
      lines.push(d.blurb);
    }
  }
  if (g.phase === "sail" && mode === "net" && netTargetOk(g, h.q, h.r)) {
    const pr = netPreview(g, h.q, h.r);
    lines.push(
      `🕸️ Cast here: ~${pr.fish} fish (~${pr.value}g), wear ${pr.cost}${pr.monsters ? `, tangles ${pr.monsters} beast(s)` : ""}${pr.rocks ? `, ${pr.rocks} rock(s) fray it` : ""}.`
    );
  }
  if (g.phase === "sail" && mode === "harpoon") {
    const { targets } = harpoonTargets(g);
    const m = monsterAt(g, h.q, h.r);
    if (m && targets.has(`${h.q},${h.r}`)) lines.push(`🎯 Fire! Deals ${g.p.harpDmg} damage.`);
    else if (m) lines.push("No clear straight line within range.");
  }
  if (dist(g.p, h) > 0 && vis === false && t.seen) lines.push("(fogged — remembered terrain)");
  return { title, lines };
}

export function SidePanel({
  g,
  mode,
  hover,
  onMode,
  onOil,
  onBurn,
  onWait,
}: {
  g: Game;
  mode: Mode;
  hover: Hex | null;
  onMode: (m: Mode) => void;
  onOil: () => void;
  onBurn: () => void;
  onWait: () => void;
}) {
  const p = g.p;
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [g.log.length]);

  const hasRelicNear = Object.values(g.tiles).some((t) => t.relic && dist(p, t) <= 1);
  const modes: { id: Mode; key: string; icon: string; name: string; ok: boolean; hint: string }[] = [
    { id: "sail", key: "1", icon: "⛵", name: "Sail", ok: true, hint: "Move 1 hex (1 fuel)" },
    { id: "net", key: "2", icon: "🕸️", name: "Cast Net", ok: p.nets > 0, hint: `Range ${p.netRange} · hauls 7 hexes` },
    { id: "harpoon", key: "3", icon: "🔱", name: "Harpoon", ok: p.harpoons > 0, hint: `Line ${p.harpRange} · ${p.harpDmg} dmg` },
    { id: "dredge", key: "4", icon: "🏺", name: "Dredge", ok: p.fuel >= 1, hint: hasRelicNear ? "Wreck in reach!" : "Wrecks within 1 hex" },
  ];
  const hints: Record<Mode, string> = {
    sail: "Click a glowing hex or use Q W E / A S D. Kelp costs 2 fuel; currents carry you onward.",
    net: `Click a hex within ${p.netRange} to haul it and its 6 neighbors. Rocks fray the net; beasts caught are tangled for 2 turns (+1 wear).`,
    harpoon: `Click a highlighted monster along a straight line (range ${p.harpRange}). Rocks block the line. Kills return lodged harpoons and pay a bounty.`,
    dredge: "Click a wreck 🏺 on or next to you. Costs 1 fuel. Could be gold, an artifact, supplies... or an ambush.",
  };
  const info = describe(g, hover, mode);
  const fishCount = holdUsed(p);

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 p-2.5 bg-[#08182a] border-l border-sky-300/10">
      <div className="grid grid-cols-2 gap-1.5">
        {modes.map((m) => (
          <button
            key={m.id}
            disabled={!m.ok}
            onClick={() => onMode(m.id)}
            className={`text-left rounded-lg border px-2 py-1.5 transition ${
              mode === m.id ? "border-brass bg-amber-500/20 shadow-[0_0_12px_rgba(217,164,65,0.35)]" : "border-sky-300/15 bg-sky-950/60 hover:bg-sky-900/60"
            } ${m.ok ? "" : "opacity-40 cursor-not-allowed"}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                {m.icon} {m.name}
              </span>
              <kbd className="text-[10px] px-1 rounded bg-black/50 text-sky-200/70">{m.key}</kbd>
            </div>
            <div className="text-[10px] text-sky-200/60">{m.hint}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={onOil}
          disabled={fishCount === 0 || p.fuel >= p.maxFuel}
          title="Render your cheapest fish into fuel (5)"
          className="rounded-lg border border-amber-400/30 bg-amber-900/20 hover:bg-amber-800/30 disabled:opacity-35 px-1.5 py-1.5 text-xs text-left"
        >
          <div className="font-semibold">🛢️ Render <kbd className="float-right text-[10px] px-1 rounded bg-black/50">5</kbd></div>
          <div className="text-[10px] text-amber-100/60">1 fish → {2 + p.oilBonus}⛽</div>
        </button>
        <button
          onClick={onBurn}
          disabled={p.hull <= 2 || p.fuel >= p.maxFuel}
          title="Desperate: -2 hull for +4 fuel (B)"
          className="rounded-lg border border-red-400/30 bg-red-900/20 hover:bg-red-800/30 disabled:opacity-35 px-1.5 py-1.5 text-xs text-left"
        >
          <div className="font-semibold">🔥 Burn <kbd className="float-right text-[10px] px-1 rounded bg-black/50">B</kbd></div>
          <div className="text-[10px] text-red-100/60">-2 hull → +4⛽</div>
        </button>
        <button
          onClick={onWait}
          title="Hold position one turn (Space)"
          className="rounded-lg border border-sky-300/25 bg-sky-900/30 hover:bg-sky-800/40 px-1.5 py-1.5 text-xs text-left"
        >
          <div className="font-semibold">⏳ Wait <kbd className="float-right text-[10px] px-1 rounded bg-black/50">␣</kbd></div>
          <div className="text-[10px] text-sky-100/60">Pass the turn</div>
        </button>
      </div>

      <div className="rounded-lg border border-sky-300/15 bg-black/25 p-2 min-h-[92px] text-xs">
        {info ? (
          <>
            <div className="font-semibold text-brass-light">{info.title}</div>
            {info.lines.map((l, i) => (
              <div key={i} className="text-sky-100/80 mt-0.5">
                {l}
              </div>
            ))}
          </>
        ) : (
          <div className="text-sky-100/70">{hints[mode]}</div>
        )}
      </div>

      {p.relics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.relics.map((id) => {
            const r = relicById(id);
            return (
              <span key={id} title={`${r.name}: ${r.desc}`} className="text-lg rounded bg-amber-900/30 border border-amber-400/30 px-1 cursor-help">
                {r.icon}
              </span>
            );
          })}
        </div>
      )}

      <div className="text-[10px] uppercase tracking-widest text-sky-200/50">Captain's log</div>
      <div ref={logRef} className="flex-1 min-h-[80px] overflow-y-auto rounded-lg bg-black/30 border border-sky-300/10 p-2 space-y-1">
        {g.log.map((l, i) => (
          <div
            key={i}
            className={`text-xs leading-snug ${
              l.tone === "good" ? "text-emerald-300" : l.tone === "bad" ? "text-red-300" : l.tone === "warn" ? "text-amber-300" : "text-sky-100/75"
            }`}
          >
            <span className="text-sky-200/30 mr-1">{l.turn}</span>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

import { memo, useEffect, useRef, useState } from "react";
import { CRATE_INFO } from "../game/data";
import { DIRS, DIR_ANGLES, R, SIZE, dist, hexPoints, key, neighbors, toPixel, type Hex } from "../game/hex";
import {
  harpoonTargets,
  isVisible,
  monsterAt,
  moveCost,
  netArea,
  netTargetOk,
  stormTurnsLeft,
  tileAt,
} from "../game/engine";
import type { Ev, Game, Mode, Tile } from "../game/types";
import { MonsterSprite, ShipSprite, ShoalSprite } from "./Sprites";

const PTS = hexPoints(SIZE - 0.5);
const PALETTE: Record<Tile["type"], string[]> = {
  deep: ["#0d4870", "#0f4f7a", "#0c4268"],
  shallow: ["#2391ab", "#2899b3", "#1f88a3"],
  kelp: ["#1a6b5f", "#1d7466", "#176157"],
  rock: ["#0d4870", "#0f4f7a", "#0c4268"],
  current: ["#115683", "#135b8c", "#10507a"],
};
export const MOVE_KEYS = ["E", "W", "Q", "A", "S", "D"];

interface FxItem {
  id: number;
  ev: Ev;
}

interface HL {
  q: number;
  r: number;
  fill: string;
  stroke: string;
  dash?: boolean;
  pulse?: boolean;
  label?: string;
  sub?: string;
}

const Terrain = memo(function Terrain({
  tiles,
  pq,
  pr,
  vision,
  stormQ,
  warn,
}: {
  tiles: Record<string, Tile>;
  pq: number;
  pr: number;
  vision: number;
  stormQ: number;
  warn: boolean;
}) {
  return (
    <g>
      {Object.values(tiles).map((t) => {
        const { x, y } = toPixel(t.q, t.r);
        const vis = dist({ q: pq, r: pr }, t) <= vision;
        const h = Math.abs(t.q * 31 + t.r * 17);
        const fill = t.seen ? PALETTE[t.type][h % 3] : "#06111e";
        const stormy = t.q < stormQ;
        return (
          <g key={`${t.q},${t.r}`} transform={`translate(${x} ${y})`}>
            <polygon
              points={PTS}
              fill={fill}
              stroke={t.seen ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.035)"}
              strokeWidth="1"
            />
            {t.seen && t.type === "deep" && h % 3 === 0 && (
              <path d="M-8 4 q4 -4 8 0 t8 0" stroke="rgba(255,255,255,0.09)" fill="none" strokeWidth="1.5" />
            )}
            {t.seen && t.type === "shallow" && (
              <g fill="rgba(255,240,200,0.28)">
                <circle cx={-8 + (h % 5)} cy={-6 + (h % 3)} r="1.2" />
                <circle cx={6 - (h % 4)} cy={4} r="1.4" />
                <circle cx={-2} cy={9 - (h % 3)} r="1" />
              </g>
            )}
            {t.seen && t.type === "kelp" && (
              <g>
                {[-10, -3, 5, 11].map((kx, i) => (
                  <path
                    key={i}
                    className="sway"
                    style={{ animationDelay: `${i * 0.4}s` }}
                    d={`M${kx} 12 C${kx - 6} 4 ${kx + 5} -2 ${kx - 1} -13`}
                    stroke={i % 2 ? "#36c27a" : "#26a060"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                ))}
              </g>
            )}
            {t.seen && t.type === "rock" && (
              <g transform={`rotate(${(h % 4) * 90})`}>
                <polygon points="-15,7 -10,-10 0,-15 12,-8 16,5 4,13" fill="#6d7886" stroke="#262d36" strokeWidth="1.6" strokeLinejoin="round" />
                <polygon points="-10,-10 0,-15 3,-2 -7,3" fill="#94a0b0" />
                <polygon points="3,-2 12,-8 16,5 6,6" fill="#5b6572" />
                <polygon points="-16,10 -10,6 -6,12 -13,14" fill="#5b6572" stroke="#262d36" strokeWidth="1" />
              </g>
            )}
            {t.seen && t.type === "current" && (
              <g transform={`rotate(${DIR_ANGLES[t.dir]})`}>
                <rect x="-16" y="-1" width="32" height="2" rx="1" fill="rgba(190,240,255,0.18)" />
                {[0, 0.4, 0.8].map((dl, i) => (
                  <g key={i} className="flow" style={{ animationDelay: `${dl}s` }}>
                    <path d={`M${-9 + i * 7} -6 L${-1 + i * 7} 0 L${-9 + i * 7} 6`} stroke="rgba(200,245,255,0.95)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                ))}
              </g>
            )}
            {t.seen && t.relic && (
              <g>
                <circle r="15" fill="rgba(255,212,92,0.14)" stroke="#ffd45c" strokeWidth="1.3" strokeDasharray="3 3" className="spin-slow" />
                <text y="7" textAnchor="middle" fontSize="19">
                  🏺
                </text>
                <circle cx="9" cy="-9" r="1.8" fill="rgba(255,255,255,0.6)" className="pulse-soft" />
                <circle cx="-9" cy="-4" r="1.3" fill="rgba(255,255,255,0.6)" className="pulse-soft" style={{ animationDelay: "0.5s" }} />
              </g>
            )}
            {t.seen && t.crate && (
              <g>
                <circle r="12" fill="rgba(5,20,35,0.55)" stroke="#9df0a6" strokeWidth="1.2" />
                <text y="6" textAnchor="middle" fontSize="15">
                  {CRATE_INFO[t.crate].icon}
                </text>
              </g>
            )}
            {t.special === "start" && (
              <text y="7" textAnchor="middle" fontSize="20" opacity="0.65">
                ⚓
              </text>
            )}
            {t.special === "gate" && (
              <g>
                <circle r="19" fill="rgba(255,217,138,0.18)" stroke="#ffd98a" strokeWidth="1.6" className="pulse-soft" />
                <text y="9" textAnchor="middle" fontSize="26">
                  🗼
                </text>
              </g>
            )}
            {t.seen && !vis && <polygon points={PTS} fill="rgba(2,8,20,0.52)" />}
            {stormy && <polygon points={PTS} fill="rgba(58,40,100,0.76)" stroke="rgba(190,170,255,0.25)" className="storm-tile" />}
            {!stormy && warn && t.q === stormQ && (
              <polygon points={PTS} fill="rgba(140,110,230,0.14)" stroke="rgba(180,150,255,0.7)" strokeDasharray="4 3" className="pulse-soft" />
            )}
          </g>
        );
      })}
    </g>
  );
});

interface Props {
  g: Game;
  mode: Mode;
  hover: Hex | null;
  onHover: (h: Hex | null) => void;
  onTile: (q: number, r: number) => void;
}

const allTiles = (g: Game) => Object.values(g.tiles);

export default function Board({ g, mode, hover, onHover, onTile }: Props) {
  const [fx, setFx] = useState<FxItem[]>([]);
  const [flash, setFlash] = useState<{ color: string; k: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    if (!g.events.length) return;
    const add: FxItem[] = [];
    for (const ev of g.events) {
      if (ev.t === "float" || ev.t === "ring" || ev.t === "bolt") add.push({ id: idRef.current++, ev });
      else if (ev.t === "flash") setFlash({ color: ev.color, k: idRef.current++ });
      else if (ev.t === "shake" && wrapRef.current) {
        const a = Math.min(22, ev.amount);
        const frames: Keyframe[] = [];
        for (let i = 0; i < 8; i++) {
          const f = 1 - i / 8;
          frames.push({ transform: `translate(${(Math.random() * 2 - 1) * a * f}px, ${(Math.random() * 2 - 1) * a * f}px)` });
        }
        frames.push({ transform: "translate(0,0)" });
        wrapRef.current.animate(frames, { duration: 380, easing: "ease-out" });
      }
    }
    if (add.length) {
      setFx((prev) => [...prev, ...add]);
      const ids = add.map((a) => a.id);
      setTimeout(() => setFx((prev) => prev.filter((f) => !ids.includes(f.id))), 1250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.evSeq]);

  const p = g.p;
  const hl: HL[] = [];
  const hk = hover ? key(hover.q, hover.r) : null;

  if (g.phase === "sail") {
    if (mode === "sail") {
      DIRS.forEach((d, i) => {
        const q = p.q + d.q;
        const r = p.r + d.r;
        const cost = moveCost(g, q, r);
        if (cost === null) return;
        const ok = p.fuel >= cost;
        hl.push({
          q,
          r,
          stroke: ok ? "#ffd98a" : "#ff6b6b",
          fill: ok ? "rgba(255,217,138,0.12)" : "rgba(255,80,80,0.12)",
          pulse: true,
          label: MOVE_KEYS[i],
          sub: cost === 1 ? undefined : cost === 0 ? "free" : `${cost}⛽`,
        });
      });
    } else if (mode === "net") {
      for (const t of allTiles(g)) {
        if (dist(p, t) <= p.netRange && netTargetOk(g, t.q, t.r)) {
          hl.push({ q: t.q, r: t.r, stroke: "rgba(127,231,255,0.45)", fill: "rgba(127,231,255,0.05)" });
        }
      }
      if (hover && netTargetOk(g, hover.q, hover.r)) {
        for (const h of netArea(hover.q, hover.r)) {
          if (!tileAt(g, h.q, h.r)) continue;
          hl.push({ q: h.q, r: h.r, stroke: "#7fe7ff", fill: "rgba(127,231,255,0.3)" });
        }
      }
    } else if (mode === "harpoon") {
      const { lines, targets } = harpoonTargets(g);
      for (const l of lines) hl.push({ q: l.q, r: l.r, stroke: "rgba(255,130,90,0.4)", fill: "rgba(255,120,80,0.10)" });
      for (const m of targets.values()) {
        hl.push({
          q: m.q,
          r: m.r,
          stroke: "#ff6b6b",
          fill: hk === key(m.q, m.r) ? "rgba(255,80,80,0.38)" : "rgba(255,80,80,0.2)",
          pulse: true,
          label: "🎯",
        });
      }
    } else if (mode === "dredge") {
      for (const t of allTiles(g)) {
        if (t.relic && dist(p, t) <= 1) {
          const ok = p.fuel >= 1;
          hl.push({
            q: t.q,
            r: t.r,
            stroke: ok ? "#ffd45c" : "#ff6b6b",
            fill: "rgba(255,212,92,0.18)",
            pulse: true,
            label: "⛏️",
          });
        }
      }
    }
    // threat preview on hovered monster
    if (hover) {
      const m = monsterAt(g, hover.q, hover.r);
      if (m && isVisible(g, m.q, m.r)) {
        if (m.kind === "angler") {
          for (const t of allTiles(g)) if (dist(m, t) <= 2 && dist(m, t) > 0 && t.type !== "rock") hl.push({ q: t.q, r: t.r, stroke: "rgba(255,226,122,0.7)", fill: "rgba(255,226,122,0.10)", dash: true });
        } else if (m.kind === "kraken") {
          for (const t of allTiles(g)) if (dist(m, t) <= 2 && dist(m, t) > 0) hl.push({ q: t.q, r: t.r, stroke: "rgba(200,120,255,0.8)", fill: "rgba(170,80,255,0.12)", dash: true });
        } else {
          for (const n of neighbors(m.q, m.r)) hl.push({ q: n.q, r: n.r, stroke: "rgba(255,110,110,0.75)", fill: "rgba(255,80,80,0.10)", dash: true });
        }
      }
    }
  }

  const turnsLeft = stormTurnsLeft(g);
  const warn = turnsLeft !== null && turnsLeft <= 2 && g.turn >= 1;
  const ship = toPixel(p.q, p.r);
  const slide = { transition: "transform 0.28s cubic-bezier(.4,0,.2,1)" };

  const pings = g.monsters.filter((m) => !isVisible(g, m.q, m.r) && dist(p, m) <= p.vision + 3);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full"
      style={{ background: "radial-gradient(ellipse at center, #0b2a45 0%, #061525 65%, #030a13 100%)" }}
    >
      <svg viewBox="-352 -394 704 788" className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
        <Terrain tiles={g.tiles} pq={p.q} pr={p.r} vision={p.vision} stormQ={g.stormQ} warn={warn} />

        {/* highlights */}
        <g pointerEvents="none">
          {hl.map((h, i) => {
            const { x, y } = toPixel(h.q, h.r);
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <polygon
                  points={PTS}
                  fill={h.fill}
                  stroke={h.stroke}
                  strokeWidth={h.pulse ? 2.5 : 1.5}
                  strokeDasharray={h.dash ? "5 4" : undefined}
                  className={h.pulse ? "pulse-soft" : undefined}
                />
                {h.label && (
                  <text y={h.label.length > 1 ? 6 : -14} textAnchor="middle" fontSize={h.label.length > 1 ? 18 : 11} fontWeight="800" fill="#ffe9b8" stroke="rgba(0,0,0,0.7)" strokeWidth="2.5" paintOrder="stroke">
                    {h.label}
                  </text>
                )}
                {h.sub && (
                  <text y="18" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffb347" stroke="rgba(0,0,0,0.7)" strokeWidth="2.5" paintOrder="stroke">
                    {h.sub}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* shoals */}
        <g pointerEvents="none">
          {g.shoals
            .filter((s) => isVisible(g, s.q, s.r))
            .map((s) => {
              const { x, y } = toPixel(s.q, s.r);
              return (
                <g key={s.id} style={{ transform: `translate(${x}px, ${y}px)`, ...slide, transitionDuration: "0.6s" }}>
                  <ShoalSprite kind={s.kind} count={s.count} seed={s.id} />
                </g>
              );
            })}
        </g>

        {/* sonar pings */}
        <g pointerEvents="none">
          {pings.map((m) => {
            const { x, y } = toPixel(m.q, m.r);
            return (
              <g key={m.id} transform={`translate(${x} ${y})`}>
                <circle r={m.kind === "kraken" ? 16 : 11} fill="rgba(255,80,80,0.08)" stroke="rgba(255,110,110,0.7)" strokeWidth="1.5" className="pulse-soft" />
                <text y="4" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ff9b9b">
                  ?
                </text>
              </g>
            );
          })}
        </g>

        {/* monsters */}
        <g pointerEvents="none">
          {g.monsters
            .filter((m) => isVisible(g, m.q, m.r))
            .map((m) => {
              const { x, y } = toPixel(m.q, m.r);
              return (
                <g key={m.id} style={{ transform: `translate(${x}px, ${y}px)`, ...slide, transitionDuration: "0.4s" }}>
                  <MonsterSprite m={m} />
                </g>
              );
            })}
        </g>

        {/* ship */}
        <g pointerEvents="none" style={{ transform: `translate(${ship.x}px, ${ship.y}px)`, ...slide }}>
          <ShipSprite />
        </g>

        {/* fx */}
        <g pointerEvents="none">
          {fx.map((f) => {
            const e = f.ev;
            if (e.t === "float") {
              const { x, y } = toPixel(e.q, e.r);
              return (
                <text key={f.id} x={x} y={y - 16} textAnchor="middle" fontSize="15" fill={e.color} className="float-up">
                  {e.text}
                </text>
              );
            }
            if (e.t === "ring") {
              const { x, y } = toPixel(e.q, e.r);
              return <circle key={f.id} cx={x} cy={y} r={e.big ? 22 : 15} fill="none" stroke={e.color} strokeWidth="3" className={e.big ? "ring-out-big" : "ring-out"} />;
            }
            if (e.t === "bolt") {
              const a = toPixel(e.from.q, e.from.r);
              const b = toPixel(e.to.q, e.to.r);
              return (
                <g key={f.id} className="bolt-fade">
                  <line x1={a.x} y1={a.y - 4} x2={b.x} y2={b.y} stroke="#6b4a26" strokeWidth="4.5" strokeLinecap="round" />
                  <line x1={a.x} y1={a.y - 4} x2={b.x} y2={b.y} stroke="#ffe9b0" strokeWidth="2" strokeLinecap="round" />
                  <circle cx={b.x} cy={b.y} r="5" fill="#fff" />
                </g>
              );
            }
            return null;
          })}
        </g>

        {/* hit layer */}
        <g>
          {allTiles(g).map((t) => {
            const { x, y } = toPixel(t.q, t.r);
            return (
              <polygon
                key={`${t.q},${t.r}`}
                transform={`translate(${x} ${y})`}
                points={PTS}
                fill="transparent"
                className="tile-hit"
                onMouseEnter={() => onHover({ q: t.q, r: t.r })}
                onMouseLeave={() => onHover(null)}
                onClick={() => onTile(t.q, t.r)}
              />
            );
          })}
        </g>

        {hover && (
          <g pointerEvents="none" transform={`translate(${toPixel(hover.q, hover.r).x} ${toPixel(hover.q, hover.r).y})`}>
            <polygon points={PTS} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {flash && <div key={flash.k} className="flash-overlay absolute inset-0" style={{ background: flash.color }} />}

      {/* compass / corner labels */}
      <div className="absolute left-3 top-3 text-[11px] text-sky-200/60 font-display tracking-widest pointer-events-none">
        ⚓ WEST &nbsp;→&nbsp; EAST {g.chart < 5 ? "🗼" : "☠"}
      </div>
      <div className="absolute right-3 bottom-2 text-[10px] text-sky-200/40 pointer-events-none">radius {R} chart</div>
    </div>
  );
}

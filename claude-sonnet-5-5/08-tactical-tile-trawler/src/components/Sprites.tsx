import type { FishKind, Monster } from "../game/types";
import { FISH } from "../game/data";

export function ShipSprite() {
  return (
    <g className="bob">
      <ellipse cx="0" cy="15" rx="18" ry="4" fill="rgba(0,0,0,0.25)" />
      <path d="M-16 4 H16 L11 14 H-11 Z" fill="#8b5a2b" stroke="#2e1a0b" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M-14 7 H14" stroke="#c48a4a" strokeWidth="1.2" />
      <line x1="0" y1="4" x2="0" y2="-21" stroke="#2e1a0b" strokeWidth="2.2" />
      <path d="M1.5 -19 L15 1 H1.5 Z" fill="#f6efdc" stroke="#9a8f74" strokeWidth="1" strokeLinejoin="round" />
      <path d="M-1.5 -14 L-12 1 H-1.5 Z" fill="#e6d8b6" stroke="#9a8f74" strokeWidth="1" strokeLinejoin="round" />
      <path d="M0 -21 L8 -18 L0 -15 Z" fill="#e0493a" />
      <circle cx="10" cy="9" r="1.3" fill="#ffd98a" />
      <circle cx="-2" cy="9" r="1.3" fill="#ffd98a" />
    </g>
  );
}

function Eel() {
  const d = "M-19 6 C-13 -9 -5 13 2 0 C7 -10 12 -4 16 -8";
  return (
    <g className="wiggle">
      <path d={d} fill="none" stroke="#14694a" strokeWidth="8" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#3fd08a" strokeWidth="5" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#9cf5c6" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 5" />
      <circle cx="17" cy="-8" r="5.5" fill="#34c27f" stroke="#14694a" strokeWidth="1" />
      <circle cx="19" cy="-9.5" r="1.8" fill="#ff3b3b" />
      <path d="M14 -4.5 l2 3.4 l2 -3.4" fill="#fff" />
    </g>
  );
}

function Angler() {
  return (
    <g>
      <path d="M-2 -12 C8 -34 26 -30 23 -19" stroke="#8a6cc0" fill="none" strokeWidth="2" strokeLinecap="round" />
      <circle cx="23" cy="-17" r="9" fill="#ffe27a" opacity="0.25" className="pulse-soft" />
      <circle cx="23" cy="-17" r="4" fill="#fff2a8" className="pulse-soft" />
      <path d="M-15 0 L-27 -9 L-27 9 Z" fill="#2c1e4a" stroke="#120a24" strokeWidth="1" strokeLinejoin="round" />
      <ellipse cx="0" cy="0" rx="17" ry="13" fill="#3a2a5a" stroke="#120a24" strokeWidth="1.5" />
      <circle cx="-6" cy="-4" r="4" fill="#fff" />
      <circle cx="-7" cy="-4" r="1.8" fill="#111" />
      <path d="M-15 6 L-11 12 L-7 6 L-3 12 L1 6 L5 12 L9 6 L13 11" stroke="#fff" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
    </g>
  );
}

function Whale() {
  return (
    <g>
      <path d="M-22 0 Q-32 -4 -36 -15 Q-29 -3 -36 11 Q-29 5 -22 0 Z" fill="#3f5f80" stroke="#1d2f44" strokeWidth="1.2" />
      <ellipse cx="0" cy="0" rx="26" ry="14" fill="#56799b" stroke="#1d2f44" strokeWidth="1.6" />
      <path d="M-22 4 Q0 18 24 4 Q0 10 -22 4 Z" fill="#b9d1e4" opacity="0.85" />
      <circle cx="15" cy="-4" r="3" fill="#fff" />
      <circle cx="16" cy="-4" r="1.4" fill="#111" />
      <path d="M8 -14 L5 -22 M12 -14 L14 -22" stroke="#9fd6ff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M26 2 Q18 6 10 3" stroke="#1d2f44" strokeWidth="1.3" fill="none" />
      <path d="M-4 6 L-14 14 L2 10 Z" fill="#3f5f80" />
    </g>
  );
}

function Kraken({ enraged }: { enraged: boolean }) {
  const body = enraged ? "#a8234f" : "#7b2f73";
  const tent = enraged ? "#c93563" : "#9a3d8f";
  const tents = [-22, -13, -5, 5, 13, 22];
  return (
    <g transform="scale(1.15)">
      {tents.map((x, i) => (
        <path
          key={i}
          className="sway"
          style={{ animationDelay: `${i * 0.25}s` }}
          d={`M${x * 0.5} 6 C${x} 16 ${x * 1.3} 22 ${x * 1.1} 30`}
          stroke={tent}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <ellipse cx="0" cy="-4" rx="18" ry="21" fill={body} stroke="#2a0d28" strokeWidth="1.8" />
      <ellipse cx="-6" cy="-12" rx="5" ry="8" fill="#fff" opacity="0.12" />
      <circle cx="-7" cy="-2" r="4.5" fill="#ffe27a" />
      <circle cx="7" cy="-2" r="4.5" fill="#ffe27a" />
      <ellipse cx="-7" cy="-2" rx="1.4" ry="3.6" fill="#111" />
      <ellipse cx="7" cy="-2" rx="1.4" ry="3.6" fill="#111" />
      <path d="M-8 8 Q0 13 8 8" stroke="#2a0d28" strokeWidth="2" fill="none" strokeLinecap="round" />
      {enraged && <circle cx="0" cy="-4" r="26" fill="none" stroke="#ff4d6d" strokeWidth="1.5" className="pulse-soft" />}
    </g>
  );
}

export function MonsterSprite({ m }: { m: Monster }) {
  const big = m.kind === "kraken";
  const barW = big ? 40 : 28;
  const barY = big ? -40 : m.kind === "angler" ? -34 : -24;
  return (
    <g>
      {m.kind === "eel" && <Eel />}
      {m.kind === "angler" && <Angler />}
      {m.kind === "whale" && <Whale />}
      {m.kind === "kraken" && <Kraken enraged={m.hp <= m.maxHp / 2} />}
      <rect x={-barW / 2} y={barY} width={barW} height="5" rx="2" fill="#1a0a0a" stroke="#000" strokeWidth="0.8" />
      <rect x={-barW / 2 + 0.5} y={barY + 0.5} width={Math.max(0, ((barW - 1) * m.hp) / m.maxHp)} height="4" rx="1.5" fill="#ff5c5c" />
      {m.stun > 0 && (
        <text y="6" textAnchor="middle" fontSize="26" opacity="0.9">
          🕸️
        </text>
      )}
    </g>
  );
}

export function ShoalSprite({ kind, count, seed }: { kind: FishKind; count: number; seed: number }) {
  const color = FISH[kind].color;
  const n = Math.min(4, count + (kind === "sardine" ? 1 : 0));
  const offs = [
    [-7, -5],
    [6, -4],
    [-3, 6],
    [8, 6],
  ];
  return (
    <g>
      {kind === "glow" && <circle r="15" fill={color} opacity="0.2" className="pulse-soft" />}
      {offs.slice(0, n).map(([x, y], i) => (
        <g key={i} className="fish-bob" style={{ animationDelay: `${((seed + i) % 5) * 0.3}s` }} transform={`translate(${x} ${y}) scale(${kind === "tuna" ? 1.25 : kind === "glow" ? 1.1 : 1})`}>
          <path d="M-6 0 Q0 -4.5 6 0 Q0 4.5 -6 0 Z" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
          <path d="M6 0 L10 -3.5 L10 3.5 Z" fill={color} />
          <circle cx="-3" cy="-0.6" r="0.9" fill="#111" />
        </g>
      ))}
      <g transform="translate(11 11)">
        <circle r="6.5" fill="rgba(5,15,30,0.85)" stroke={color} strokeWidth="1" />
        <text y="3" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">
          {count}
        </text>
      </g>
    </g>
  );
}

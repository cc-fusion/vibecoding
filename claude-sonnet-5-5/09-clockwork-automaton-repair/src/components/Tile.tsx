import { memo } from 'react';
import { DEFS, Piece, SimResult } from '../game/engine';

export interface CellInfo {
  steam: boolean;
  spin: number;
  jam: boolean;
  sig: boolean;
  out: boolean;
  ins: boolean[];
  open: boolean;
  clutch: boolean;
  ok: boolean;
  target: boolean;
  leaks: number[];
}

export const IDLE_INFO: CellInfo = {
  steam: false, spin: 0, jam: false, sig: false, out: false, ins: [], open: false, clutch: false, ok: false, target: false, leaks: [],
};
export const ACTIVE_INFO: CellInfo = {
  steam: true, spin: 1, jam: false, sig: true, out: true, ins: [true, true], open: true, clutch: true, ok: true, target: false, leaks: [],
};

export function buildInfos(sim: SimResult): CellInfo[] {
  const n = sim.R * sim.C;
  const leakMap: number[][] = Array.from({ length: n }, () => []);
  for (const l of sim.leaks) leakMap[l.i].push(l.d);
  return Array.from({ length: n }, (_, i) => ({
    steam: sim.steam[i],
    spin: sim.spin[i],
    jam: sim.jammed[i],
    sig: sim.cellSig[i],
    out: sim.outVal[i],
    ins: sim.inVals[i],
    open: sim.valveOpen[i],
    clutch: sim.clutchOn[i],
    ok: sim.satisfied[i],
    target: sim.isTarget[i],
    leaks: leakMap[i],
  }));
}

const EDGE: [number, number][] = [[50, 0], [100, 50], [50, 100], [0, 50]];
const PUFF: [number, number][] = [[50, 4], [96, 50], [50, 96], [4, 50]];

const gearCache = new Map<string, string>();
function gearPath(teeth: number, ro: number, ri: number) {
  const key = `${teeth}-${ro}-${ri}`;
  const hit = gearCache.get(key);
  if (hit) return hit;
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  const pt = (a: number, r: number) => `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
  for (let k = 0; k < teeth; k++) {
    const a = k * step;
    pts.push(pt(a - step * 0.3, ri), pt(a - step * 0.17, ro), pt(a + step * 0.17, ro), pt(a + step * 0.3, ri));
  }
  const d = 'M' + pts.join('L') + 'Z';
  gearCache.set(key, d);
  return d;
}

function Pipes({ ports, hot, junction = true }: { ports: number[]; hot: boolean; junction?: boolean }) {
  return (
    <g>
      {ports.map((d) => (
        <line key={'o' + d} x1={50} y1={50} x2={EDGE[d][0]} y2={EDGE[d][1]} stroke="#24160a" strokeWidth={28} />
      ))}
      {ports.map((d) => (
        <line key={'m' + d} x1={50} y1={50} x2={EDGE[d][0]} y2={EDGE[d][1]} stroke="#b9772f" strokeWidth={21} />
      ))}
      {ports.map((d) => (
        <line key={'h' + d} x1={50} y1={50} x2={EDGE[d][0]} y2={EDGE[d][1]} stroke="#d99a52" strokeWidth={6} transform="translate(0,0)" opacity={0.55} />
      ))}
      {ports.map((d) => (
        <line
          key={'i' + d}
          x1={50}
          y1={50}
          x2={EDGE[d][0]}
          y2={EDGE[d][1]}
          stroke={hot ? '#e6fbff' : '#4a2c12'}
          strokeWidth={8}
          strokeDasharray={hot ? '6 7' : undefined}
          className={hot ? 'steam-flow' : undefined}
        />
      ))}
      {ports.map((d) => {
        const horizontal = d === 1 || d === 3;
        const x = d === 1 ? 92 : d === 3 ? 0 : 35;
        const y = d === 0 ? 0 : d === 2 ? 92 : 35;
        return <rect key={'f' + d} x={x} y={y} width={horizontal ? 8 : 30} height={horizontal ? 30 : 8} rx={2} fill="#8a5420" stroke="#24160a" strokeWidth={2} />;
      })}
      {junction && ports.length !== 2 && <circle cx={50} cy={50} r={14} fill="#b9772f" stroke="#24160a" strokeWidth={3} />}
      {ports.length === 2 && <circle cx={50} cy={50} r={6} fill="#8a5420" stroke="#24160a" strokeWidth={2} />}
      {junction && ports.length !== 2 && <circle cx={50} cy={50} r={5} fill={hot ? '#e6fbff' : '#4a2c12'} />}
    </g>
  );
}

function Wire({ x1, y1, x2, y2, on }: { x1: number; y1: number; x2: number; y2: number; on: boolean }) {
  return (
    <g style={on ? { filter: 'drop-shadow(0 0 3px #ffcf4a)' } : undefined}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#150e06" strokeWidth={11} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? '#ffd45c' : '#8a6a35'} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
}

function Wires({ ports, on }: { ports: number[]; on: boolean }) {
  return (
    <g>
      {ports.map((d) => (
        <line key={'o' + d} x1={50} y1={50} x2={EDGE[d][0]} y2={EDGE[d][1]} stroke="#150e06" strokeWidth={11} strokeLinecap="round" />
      ))}
      <g style={on ? { filter: 'drop-shadow(0 0 3px #ffcf4a)' } : undefined}>
        {ports.map((d) => (
          <line key={'i' + d} x1={50} y1={50} x2={EDGE[d][0]} y2={EDGE[d][1]} stroke={on ? '#ffd45c' : '#8a6a35'} strokeWidth={5} strokeLinecap="round" />
        ))}
        <circle cx={50} cy={50} r={on ? 7 : 6} fill={on ? '#ffd45c' : '#8a6a35'} stroke="#150e06" strokeWidth={2.5} />
      </g>
    </g>
  );
}

function Gear({
  fill, spin, jam, parity, children, dim,
}: { fill: string; spin: number; jam: boolean; parity: number; children?: React.ReactNode; dim?: boolean }) {
  const cls = jam ? 'gear-jam' : spin === 1 ? 'spin-cw' : spin === -1 ? 'spin-ccw' : '';
  return (
    <g className={cls} style={{ transformOrigin: '50px 50px', transformBox: 'view-box' }} opacity={dim ? 0.4 : 1}>
      <g transform={`rotate(${parity ? 15 : 0} 50 50)`}>
        <path d={gearPath(12, 50, 41)} fill={fill} stroke="#1a1209" strokeWidth={2} strokeDasharray={dim ? '4 3' : undefined} />
        <circle cx={50} cy={50} r={36} fill="none" stroke="#00000033" strokeWidth={3} />
        {children}
      </g>
    </g>
  );
}

function Label({ deg, y, text, size = 13, fill = '#e5e7eb' }: { deg: number; y: number; text: string; size?: number; fill?: string }) {
  return (
    <g style={{ transform: `rotate(${-deg}deg)`, transformOrigin: '50px 50px', transition: 'transform .18s ease-out' }}>
      <text x={50} y={y} textAnchor="middle" fontSize={size} fontWeight={800} fill={fill} fontFamily="ui-monospace, Menlo, monospace">
        {text}
      </text>
    </g>
  );
}

interface TileProps {
  piece: Piece | null;
  info?: CellInfo;
  parity?: number;
  ghost?: boolean;
  hint?: boolean;
}

function TileInner({ piece, info = IDLE_INFO, parity = 0, ghost = false, hint = false }: TileProps) {
  const deg = piece ? piece.rot * 90 : 0;
  let body: React.ReactNode = null;

  if (piece) {
    const t = piece.type;
    const def = DEFS[t];
    switch (t) {
      case 'B':
        body = (
          <g>
            <Pipes ports={[0]} hot junction={false} />
            <circle cx={50} cy={58} r={32} fill="#7c2d12" stroke="#24100a" strokeWidth={4} />
            <circle cx={50} cy={58} r={24} fill="#a8401a" />
            <path d="M50 40 C60 50 64 58 57 68 C54 72 46 72 43 68 C36 58 42 50 50 40Z" fill="#ffb347" className="flicker" />
            <path d="M50 52 C55 58 56 63 52 67 C50 69 48 69 47 67 C44 63 46 57 50 52Z" fill="#fff3b0" className="flicker" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <circle key={a} cx={50 + Math.cos((a * Math.PI) / 180) * 29} cy={58 + Math.sin((a * Math.PI) / 180) * 29} r={2.4} fill="#e9a15a" />
            ))}
          </g>
        );
        break;
      case 'I':
      case 'L':
      case 'T':
      case '#':
        body = <Pipes ports={def.steam!} hot={info.steam} />;
        break;
      case 'P':
        body = (
          <g>
            <Pipes ports={[0]} hot={info.steam} junction={false} />
            <rect x={28} y={30} width={44} height={40} rx={5} fill="#6b7280" stroke="#1f2937" strokeWidth={3} />
            <rect x={34} y={35} width={32} height={7} rx={2} fill="#a1a8b5" />
            <rect x={34} y={58} width={32} height={5} rx={2} fill="#4b5563" />
            <g style={{ transform: `translateY(${info.steam ? 0 : -22}px)`, transition: 'transform .4s cubic-bezier(.3,1.6,.5,1)' }}>
              <rect x={45} y={62} width={10} height={24} fill="#d1d5db" stroke="#374151" strokeWidth={1.5} />
              <rect x={30} y={84} width={40} height={10} rx={3} fill="#b45309" stroke="#24100a" strokeWidth={2.5} />
            </g>
          </g>
        );
        break;
      case 'Q':
        body = (
          <g>
            <Gear fill="#c2410c" spin={info.spin} jam={info.jam} parity={parity}>
              <circle cx={50} cy={50} r={22} fill="#7c2d12" stroke="#1a0b05" strokeWidth={2.5} />
              <path d="M50 36 C58 45 60 52 55 59 C53 62 47 62 45 59 C40 52 42 45 50 36Z" fill={info.steam ? '#ffb347' : '#5a3a2a'} />
              <circle cx={50} cy={50} r={4} fill="#1a0b05" />
            </Gear>
            <g>
              <line x1={50} y1={0} x2={50} y2={22} stroke="#24160a" strokeWidth={22} />
              <line x1={50} y1={0} x2={50} y2={22} stroke="#b9772f" strokeWidth={16} />
              <line x1={50} y1={0} x2={50} y2={22} stroke={info.steam ? '#e6fbff' : '#4a2c12'} strokeWidth={6} strokeDasharray={info.steam ? '5 6' : undefined} className={info.steam ? 'steam-flow' : undefined} />
              <rect x={35} y={0} width={30} height={7} rx={2} fill="#8a5420" stroke="#24160a" strokeWidth={2} />
            </g>
          </g>
        );
        break;
      case 'V':
        body = (
          <g>
            <Pipes ports={[0, 2]} hot={info.steam && info.open} />
            <Wire x1={72} y1={50} x2={100} y2={50} on={info.ins[0] === true} />
            <g style={{ transform: `rotate(${info.open ? 90 : 0}deg)`, transformOrigin: '50px 50px', transition: 'transform .3s' }}>
              <circle cx={50} cy={50} r={17} fill="#3b3b44" stroke={info.open ? '#4ade80' : '#ef4444'} strokeWidth={4} />
              <line x1={36} y1={50} x2={64} y2={50} stroke="#cbd5e1" strokeWidth={5} strokeLinecap="round" />
              <line x1={50} y1={36} x2={50} y2={64} stroke="#cbd5e1" strokeWidth={5} strokeLinecap="round" />
              <circle cx={50} cy={50} r={4} fill="#111" />
            </g>
          </g>
        );
        break;
      case 'G':
        body = (
          <Gear fill="#c9a24a" spin={info.spin} jam={info.jam} parity={parity}>
            <circle cx={50} cy={50} r={14} fill="#7a5a1c" stroke="#2a1d08" strokeWidth={2.5} />
            {[0, 90, 180, 270].map((a) => (
              <circle key={a} cx={50 + Math.cos((a * Math.PI) / 180) * 26} cy={50 + Math.sin((a * Math.PI) / 180) * 26} r={5} fill="#2a1d08" />
            ))}
            <circle cx={50} cy={50} r={4.5} fill="#1a1209" />
          </Gear>
        );
        break;
      case 'F':
      case 'f':
        body = (
          <g>
            <Gear fill="#8a94a6" spin={info.spin} jam={info.jam} parity={parity}>
              <circle cx={50} cy={50} r={33} fill="#1b212c" />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <line key={a} x1={50} y1={50} x2={50 + Math.cos((a * Math.PI) / 180) * 33} y2={50 + Math.sin((a * Math.PI) / 180) * 33} stroke="#aab3c4" strokeWidth={6} />
              ))}
              <circle cx={50} cy={50} r={33} fill="none" stroke={info.ok ? '#4ade80' : '#aab3c4'} strokeWidth={3} />
            </Gear>
            <circle cx={50} cy={50} r={14} fill="#10141c" stroke={info.ok ? '#4ade80' : '#c9d1e0'} strokeWidth={3} />
            <text x={50} y={58} textAnchor="middle" fontSize={22} fontWeight={900} fill={info.ok ? '#4ade80' : '#e5e7eb'} fontFamily="sans-serif">
              {t === 'F' ? '↻' : '↺'}
            </text>
          </g>
        );
        break;
      case 'U':
        body = (
          <g>
            <Gear fill="#0e7490" spin={info.spin} jam={info.jam} parity={parity}>
              <circle cx={50} cy={50} r={27} fill="#083344" stroke="#021a24" strokeWidth={2.5} />
            </Gear>
            <polygon points="54,26 38,54 49,54 45,74 63,45 52,45" fill={info.spin !== 0 ? '#ffe066' : '#4b5563'} stroke="#111" strokeWidth={1.5} style={info.spin !== 0 ? { filter: 'drop-shadow(0 0 4px #ffd45c)' } : undefined} />
            <Wire x1={50} y1={0} x2={50} y2={18} on={info.out} />
          </g>
        );
        break;
      case 'K':
        body = (
          <g>
            <Gear fill="#6d28d9" spin={info.clutch ? info.spin : 0} jam={info.clutch && info.jam} parity={parity} dim={!info.clutch}>
              <circle cx={50} cy={50} r={26} fill="#2e1065" stroke="#12062e" strokeWidth={2.5} />
              <path d="M38 50 H62 M50 38 V62" stroke="#c4b5fd" strokeWidth={4} strokeLinecap="round" />
            </Gear>
            <Wire x1={50} y1={0} x2={50} y2={20} on={info.ins[0] === true} />
          </g>
        );
        break;
      case 'W':
      case 'C':
      case 'Y':
      case '+':
        body = <Wires ports={def.wire!} on={info.sig} />;
        break;
      case 'S':
      case 's': {
        const on = !!piece.on;
        body = (
          <g>
            <Wire x1={50} y1={0} x2={50} y2={42} on={info.out} />
            <rect x={26} y={40} width={48} height={48} rx={7} fill="#3a3028" stroke="#150e06" strokeWidth={3} />
            <circle cx={50} cy={72} r={7} fill="#1a1209" />
            <g style={{ transform: `rotate(${on ? 0 : -42}deg)`, transformOrigin: '50px 72px', transition: 'transform .18s' }}>
              <line x1={50} y1={72} x2={50} y2={46} stroke="#d1d5db" strokeWidth={5} strokeLinecap="round" />
              <circle cx={50} cy={45} r={7} fill={on ? '#4ade80' : '#ef4444'} stroke="#111" strokeWidth={2} />
            </g>
            <Label deg={deg} y={86} text={on ? 'ON' : 'OFF'} size={10} fill={on ? '#86efac' : '#fca5a5'} />
          </g>
        );
        break;
      }
      case 'Z':
      case 'z': {
        const on = t === 'z';
        body = (
          <g>
            <Wire x1={50} y1={0} x2={50} y2={34} on={info.out} />
            <circle cx={50} cy={58} r={29} fill="#1f2937" stroke="#6b7280" strokeWidth={4} />
            <circle cx={50} cy={58} r={22} fill={on ? '#3b2f0a' : '#12161d'} stroke="#0b0e13" strokeWidth={2} />
            <Label deg={deg} y={63} text={on ? 'ON' : 'OFF'} size={15} fill={on ? '#ffd45c' : '#6b7280'} />
            <rect x={43} y={78} width={14} height={9} rx={2} fill="#9ca3af" stroke="#111" strokeWidth={1.5} />
            <path d="M45 78 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#9ca3af" strokeWidth={2.5} />
          </g>
        );
        break;
      }
      case 'A':
      case 'R':
      case 'E':
      case 'N': {
        const label = t === 'A' ? 'AND' : t === 'R' ? 'OR' : t === 'E' ? 'XOR' : 'NOT';
        const inPorts = def.sigIn!;
        body = (
          <g>
            {inPorts.map((d, k) => (
              <Wire key={d} x1={EDGE[d][0]} y1={EDGE[d][1]} x2={50 + (EDGE[d][0] - 50) * 0.4} y2={50 + (EDGE[d][1] - 50) * 0.4} on={info.ins[k] === true} />
            ))}
            <Wire x1={50} y1={0} x2={50} y2={30} on={info.out} />
            <rect x={20} y={28} width={60} height={46} rx={7} fill="#262b38" stroke={info.out ? '#ffd45c' : '#8f97a8'} strokeWidth={3} />
            <polygon points="44,34 56,34 50,26" fill={info.out ? '#ffd45c' : '#8f97a8'} />
            <Label deg={deg} y={57} text={label} size={t === 'E' || t === 'A' || t === 'N' ? 15 : 17} fill={info.out ? '#ffe9a0' : '#e5e7eb'} />
          </g>
        );
        break;
      }
      case 'M': {
        const lit = info.ins[0] === true;
        body = (
          <g>
            <Wire x1={50} y1={0} x2={50} y2={38} on={lit} />
            <rect x={36} y={74} width={28} height={14} rx={3} fill="#6b7280" stroke="#1f2937" strokeWidth={2.5} />
            <circle cx={50} cy={54} r={24} fill={lit ? '#ffe27a' : '#4a4130'} stroke="#1a1209" strokeWidth={3.5} style={lit ? { filter: 'drop-shadow(0 0 10px #ffd45c)' } : undefined} />
            <path d="M42 62 C42 54 46 52 46 46 M58 62 C58 54 54 52 54 46 M44 56 H56" stroke={lit ? '#a16207' : '#2a2418'} strokeWidth={2.5} fill="none" />
          </g>
        );
        break;
      }
      case 'm': {
        const ring = info.ins[0] === true;
        body = (
          <g>
            <Wire x1={50} y1={0} x2={50} y2={32} on={ring} />
            <path d="M26 74 Q26 36 50 32 Q74 36 74 74 Z" fill={ring ? '#f87171' : '#6b4a3a'} stroke="#1a1209" strokeWidth={3.5} style={ring ? { filter: 'drop-shadow(0 0 9px #ef4444)' } : undefined} className={ring ? 'bell-ring' : undefined} />
            <rect x={22} y={72} width={56} height={8} rx={3} fill="#9ca3af" stroke="#1f2937" strokeWidth={2} />
            <circle cx={50} cy={86} r={5} fill="#9ca3af" stroke="#1f2937" strokeWidth={2} />
          </g>
        );
        break;
      }
      case 'X':
        body = (
          <g>
            <rect x={6} y={6} width={88} height={88} rx={6} fill="#3d4350" stroke="#1b1f27" strokeWidth={3} />
            {[-60, -30, 0, 30, 60].map((o) => (
              <line key={o} x1={10 + o} y1={90} x2={90 + o} y2={10} stroke="#b4871f" strokeWidth={8} opacity={0.5} />
            ))}
            <rect x={6} y={6} width={88} height={88} rx={6} fill="none" stroke="#1b1f27" strokeWidth={3} />
            {[[14, 14], [86, 14], [14, 86], [86, 86]].map(([x, y]) => (
              <circle key={`${x}${y}`} cx={x} cy={y} r={4} fill="#8b93a3" stroke="#111" strokeWidth={1.5} />
            ))}
          </g>
        );
        break;
    }
  }

  const showBolts = piece && piece.fixed && piece.type !== 'X' && !DEFS[piece.type].gear;

  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full select-none" style={{ overflow: 'hidden' }}>
      <rect x={0} y={0} width={100} height={100} fill={piece ? '#33281b' : '#1b150f'} />
      <rect x={1.5} y={1.5} width={97} height={97} fill="none" stroke={piece ? '#4a3a27' : '#2a2016'} strokeWidth={1.5} />
      {!piece && <path d="M44 50 H56 M50 44 V56" stroke="#2f241a" strokeWidth={2} />}
      {showBolts &&
        [[7, 7], [93, 7], [7, 93], [93, 93]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} fill="#7a6a55" stroke="#1a1209" strokeWidth={1} />)}
      {piece && (
        <g
          style={{
            transform: `rotate(${deg}deg)`,
            transformOrigin: '50px 50px',
            transition: 'transform .18s ease-out',
            opacity: ghost ? 0.5 : 1,
          }}
        >
          {body}
        </g>
      )}
      {info.leaks.map((d) => (
        <g key={'leak' + d} transform={`translate(${PUFF[d][0]} ${PUFF[d][1]})`}>
          <circle r={6} fill="#e6fbff" className="puff" style={{ animationDelay: '0s' }} />
          <circle r={5} cx={d === 1 ? 5 : d === 3 ? -5 : 4} cy={d === 0 ? -5 : d === 2 ? 5 : -3} fill="#cfeff7" className="puff" style={{ animationDelay: '.3s' }} />
          <circle r={4} cx={d === 1 ? 2 : d === 3 ? -2 : -4} cy={d === 0 ? -2 : d === 2 ? 2 : 3} fill="#ffffff" className="puff" style={{ animationDelay: '.6s' }} />
        </g>
      ))}
      {info.target && !ghost && (
        <g>
          <circle cx={88} cy={12} r={7} fill="#0b0e13" />
          <circle cx={88} cy={12} r={5} fill={info.ok ? '#4ade80' : '#ef4444'} style={info.ok ? { filter: 'drop-shadow(0 0 4px #4ade80)' } : undefined} />
        </g>
      )}
      {info.jam && (
        <g className="jam-flash">
          <rect x={3} y={3} width={94} height={94} fill="none" stroke="#ef4444" strokeWidth={4} />
          <text x={50} y={58} textAnchor="middle" fontSize={26} fill="#fecaca" fontWeight={900}>
            ⚠
          </text>
        </g>
      )}
      {hint && <rect x={3} y={3} width={94} height={94} fill="#fde04755" stroke="#fde047" strokeWidth={5} className="hint-pulse" />}
    </svg>
  );
}

export default memo(TileInner);
